// Audit du 2026-10-14, lot « suivis » : 📋 Fiches de suivi intégrées, côté Suivi PP.
// La fiche (dans son cadre) peut tenir un suivi PÉRIMÉ : cachée sur un autre onglet, elle n'apprend un Ctrl+Z, un import, une
// synchronisation ou un renommage qu'au retour sur 📋 Suivis. Ce qu'elle renvoie alors ne doit pas défaire ce qui a été fait
// ici. Scénarios réels (Puppeteer) : s1 à s4 et s6 de l'audit ; ici, la logique pure sur un cadre simulé. Noms inventés.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)) ?? 'null');
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; redoStack.length = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));`;
// Un cadre simulé (la fiche cachée : le harnais ne redessine aucun onglet) ; on garde ce que Suivi PP lui envoie.
const CADRE = `globalThis.__envois = []; _suivisFrame = { contentWindow: { postMessage: m => __envois.push(JSON.parse(JSON.stringify(m))) } }; _suivisPret = true;
  _suivisVu = { cle: null, json: null, classe: null, app: null }; _suivisBase = {}; _suivisRaison = null;`;
// Le suivi tel que la fiche l'envoie, avec le numéro du dernier « charger » qu'elle a reçu.
const ETAT = (com, extra = '') => `{ app: 'fiche-suivi-collective', format: 1, savedAt: 'x', S: { classe: '5e C', referent: 'M. CHÊNE', com: ${JSON.stringify(com)}${extra} } }`;
const dernier = () => ev(`__envois.filter(m => m.type === 'charger').at(-1).version`);

test('défaut 1 — réglage commun envoyé à une fiche qui n’a pas vu le Ctrl+Z : « charger » (le suivi annulé), pas « commun »', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v = dernier();
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('GESTE')}, etape: true });
    undoLast(true);                       // Ctrl+Z depuis un autre onglet : la fiche, cachée, n'est pas prévenue
    __envois.length = 0;
    S.prefs.avisNom = 'Mme PIN'; _suivisCommunMaj();   // un réglage commun changé ici (💾 Données)
    return __envois.map(m => ({ type: m.type, com: m.etat?.S?.com ?? null })); })()`);
  assert.ok(!r.some(m => m.type === 'commun'), 'pas de « commun » à une fiche périmée : ' + JSON.stringify(r));
  const ch = r.find(m => m.type === 'charger');
  assert.ok(ch, 'la fiche reçoit tout le suivi');
  assert.strictEqual(ch.com, null, 'et c’est le suivi annulé');
});

test('défaut 1 — le suivi périmé que la fiche renvoie n’est pas rangé : l’annulation tient, sans cran, et la fiche est rechargée', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v = dernier();
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('GESTE')}, etape: true });
    undoLast(true);
    const u = undoStack.length; __envois.length = 0;
    // la fiche (qui n'a reçu que le premier « charger ») applique un réglage commun à SON suivi et le renvoie
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('GESTE', ", etablissement: { nom: 'Collège X' }")}, etape: false });
    return { com: S.fichesSuivi['5C'].etat?.S?.com ?? null, crans: undoStack.length - u, recharge: __envois.some(m => m.type === 'charger' && !m.etat) }; })()`);
  assert.deepStrictEqual(r, { com: null, crans: 0, recharge: true });
});

test('défaut 1 — suivi importé (ou relu par la synchronisation) pendant que la fiche est cachée : son ancien suivi ne le remplace pas', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v = dernier();
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('AVANT')}, etape: true });
    const sauvegarde = JSON.stringify(S);
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('APRES')}, etape: true });
    _applyReloadedData(JSON.parse(sauvegarde), { lastModified: Date.now() });
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('APRES')}, etape: false });   // réponse à un « commun »
    return S.fichesSuivi['5C'].etat.S.com; })()`);
  assert.strictEqual(r, 'AVANT');
});

test('défaut 1 — élève renommé ici pendant que la fiche est cachée : les noms retenus sont ceux qu’elle a REÇUS, le renommage part au retour', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v = dernier();
  const r = evObj(`(() => { const sid = getCls().eleves[0], ancien = _suivisNom(S.eleves[sid]);
    S.eleves[sid].prenom = 'Aurélien-Noé'; const nouveau = _suivisNom(S.eleves[sid]);
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('X')}, etape: true });
    return { retenu: S.fichesSuivi['5C'].noms[sid], ancien, renommer: _suivisClasse('5C').classe.renommer, nouveau }; })()`);
  assert.strictEqual(r.retenu, r.ancien, 'la fiche n’a jamais reçu « ' + r.nouveau + ' »');
  assert.deepStrictEqual(r.renommer, [[r.ancien, r.nouveau]], 'le prochain « charger » porte le renommage');
});

test('défaut 2 — une frappe partie pendant que Suivi PP rechargeait la fiche (même classe, ↶) n’est pas rangée ; celle d’une AUTRE classe l’est', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v1 = dernier();
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v1}, etat: ${ETAT('UN')}, etape: true });
    undoLast(true); _suivisEnvoyer();        // ↶ de Suivi PP, la fiche affichée est rechargée (numéro suivant)
    // la frappe que la fiche avait en attente part AVANT qu'elle lise ce « charger » : fondée sur « UN »
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v1}, etat: ${ETAT('UN DEUX')}, etape: false });
    const meme = S.fichesSuivi['5C'].etat?.S?.com ?? null;
    // autre cas : changement de classe pendant une frappe — la 5e C n'a pas été remplacée, la frappe est gardée
    const v2 = __envois.filter(m => m.type === 'charger').at(-1).version;
    _createClassBare('4B', '4e B', getCls().annee); switchClass('4B'); _suivisEnvoyer();
    _suivisRecevoir({ type: 'etat', cle: '5C', version: v2, etat: ${ETAT('TROIS')}, etape: false });
    return { meme, autre: S.fichesSuivi['5C'].etat?.S?.com ?? null, rien4B: S.fichesSuivi['4B']?.etat ?? null }; })()`);
  assert.deepStrictEqual(r, { meme: null, autre: 'TROIS', rien4B: null });
});

test('défaut 2 — ↶ / Ctrl+Z de Suivi PP range d’abord la frappe que la fiche n’a pas encore envoyée (comme son propre Ctrl+Z)', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const v = dernier();
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('UN')}, etape: true });
    let attente = { app: 'fiche-suivi', type: 'etat', cle: '5C', version: ${v}, etat: ${ETAT('UN DEUX')}, etape: true };
    _suivisFrame.contentWindow.__ficheEnAttente = () => { const m = attente; attente = null; return m; };
    undoLast(true);                         // annule la frappe « DEUX » (son propre cran), pas « UN »
    const apres = S.fichesSuivi['5C'].etat?.S?.com ?? null;
    redoLast(true);
    return { apres, refait: S.fichesSuivi['5C'].etat?.S?.com ?? null }; })()`);
  assert.deepStrictEqual(r, { apres: 'UN', refait: 'UN DEUX' });
});

test('défaut 3 — un début de période impossible (« 02-30 ») n’est pas réécrit par l’aller-retour du découpage avec la fiche', () => {
  ev(DEMO); ev(CADRE);
  const r = evObj(`(() => {
    S.prefs.periodMode = 'trimestre'; S.prefs.periodStarts = { semestre: ['02-01'], trimestre: ['11-30', '02-30'] };
    _suivisEnvoyer(true);
    const v = __envois.filter(m => m.type === 'charger').at(-1).version, envoye = _suivisCommun('5C').decoupage;
    // la fiche avait son découpage en semestres ; elle applique le nôtre (dates normalisées) et renvoie son suivi
    _suivisRecevoir({ type: 'etat', cle: '5C', version: v, etat: ${ETAT('A', ", decoupage: { mode: 'semestres', fins: ['2026-01-30'] }")}, etape: false });
    const u = undoStack.length;
    _suivisRecevoir({ type: 'etat', cle: '5C', version: v, etat: { app: 'fiche-suivi-collective', format: 1, savedAt: 'y', S: { ...S.fichesSuivi['5C'].etat.S, decoupage: envoye } }, etape: false });
    const garde = JSON.stringify(S.prefs.periodStarts.trimestre);
    // une date vraiment changée dans la fiche, elle, est reprise
    const y = getCls().annee.slice(0, 4);
    _suivisRecevoir({ type: 'etat', cle: '5C', version: v, etat: { app: 'fiche-suivi-collective', format: 1, savedAt: 'z', S: { ...S.fichesSuivi['5C'].etat.S, decoupage: { mode: 'trimestres', fins: [envoye.fins[0], (+y + 1) + '-03-06'] } } }, etape: true });
    return { fins: envoye.fins.length, garde, crans: undoStack.length - u, change: S.prefs.periodStarts.trimestre }; })()`);
  assert.strictEqual(r.fins, 2, 'les dates (personnalisées) partent vers la fiche');
  assert.strictEqual(r.garde, '["11-30","02-30"]', 'le réglage n’est pas réécrit en silence');
  assert.deepStrictEqual(r.change, ['11-30', '03-07'], 'une modification faite dans la fiche est reprise');
});
