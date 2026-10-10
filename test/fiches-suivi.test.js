// 📋 Suivis (2026-10-10) : l'application des fiches de suivi (fiches-suivi/) dans un cadre, son état rangé dans S.
// Ici, le côté Suivi PP : ce qu'on envoie à la fiche, ce qu'on range de ce qu'elle renvoie, la pile d'annulation,
// la purge, l'import, la démo, le bloc embarqué. Le côté fiche (cadre réel) : fiches-suivi/e2e_integre.js.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; redoStack.length = 0;`;
// Un cadre simulé : on garde ce que Suivi PP lui envoie.
const CADRE = `globalThis.__envois = []; _suivisFrame = { contentWindow: { postMessage: m => __envois.push(JSON.parse(JSON.stringify(m))) } }; _suivisPret = true;
  _suivisVu = { cle: null, json: null, classe: null, app: null }; _suivisRaison = null;`;

test('la classe envoyée à la fiche : « NOM Prénom », groupe et options, arrivée, départ ramené au dernier jour présent', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), [a, b] = cls.eleves;
    S.eleves[a].nom = 'Carpe'; S.eleves[a].prenom = 'Léa'; S.eleves[a].groupe = 2; S.eleves[a].arrivalDate = '2025-11-03';
    S.eleves[a].tags = [Object.values(S.tags).find(t => t.abbr === 'LATIN').id];
    S.eleves[b].departureDate = '2026-03-16';
    const { classe, noms } = _suivisClasse(cls.id);
    const ea = classe.eleves.find(e => e.nom === 'CARPE Léa'), eb = classe.eleves.find(e => e.nom === noms[b]);
    return { nom: classe.nom, annee: classe.annee, n: classe.eleves.length, ea, finB: eb.fin, triee: classe.eleves.map(e => e.nom).join('|') === classe.eleves.map(e => e.nom).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' })).join('|'),
      groupes: classe.groupes, nomA: noms[a] }; })()`);
  assert.strictEqual(r.nom, '5e C');
  assert.match(r.annee, /^\d{4}-\d\d$/);
  assert.strictEqual(r.n, 25);
  assert.deepStrictEqual(r.ea, { nom: 'CARPE Léa', groupes: ['Groupe 2', 'LATIN'], debut: '2025-11-03', fin: '' });
  assert.strictEqual(r.finB, '2026-03-15', 'départ le 16 (premier jour d\'absence) → dernier jour présent le 15');
  assert.ok(r.triee, 'par ordre alphabétique');
  assert.deepStrictEqual(r.groupes.slice(0, 3), ['Groupe 1', 'Groupe 2', 'Groupe 3']);
  assert.ok(r.groupes.includes('LATIN') && r.groupes.includes('DNL'));
  assert.strictEqual(r.nomA, 'CARPE Léa');
});

test('un élève renommé ici : la fiche reçoit le renommage (ancien nom → nouveau)', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[0];
    S.fichesSuivi[cls.id] = { noms: { [sid]: 'ANCIEN Nom' } };
    return _suivisClasse(cls.id).classe.renommer; })()`);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0][0], 'ANCIEN Nom');
});

test('premier échange : « charger » porte le suivi, la classe, l’apparence, la pile ; la démo est demandée', () => {
  ev(DEMO); ev(CADRE);
  const r = evObj(`(() => { _suivisEnvoyer(); const m = __envois[0]; return { n: __envois.length, type: m.type, app: m.app, cle: m.cle, etat: m.etat, demo: m.demo, theme: m.theme, polices: m.polices, pile: m.pile, eleves: m.classe.eleves.length }; })()`);
  assert.deepStrictEqual(r, { n: 1, type: 'charger', app: 'suivi-pp', cle: '5C', etat: null, demo: true, theme: 'clair',
    polices: { ecran: 'andika', papier: 'lm' }, pile: { annuler: false, retablir: false }, eleves: 25 });
  // Rien de changé : pas de second « charger », seulement la pile.
  const r2 = evObj(`(() => { __envois.length = 0; _suivisEnvoyer(); return __envois.map(m => m.type); })()`);
  assert.deepStrictEqual(r2, ['pile']);
});

test('un geste dans la fiche pose UN cran d’annulation ; Ctrl+Z le défait ; une frappe groupée n’en pose pas', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const etat = n => `{ app: 'fiche-suivi-collective', format: 1, savedAt: 'x', S: { classe: '5e C', referent: '${n}', classeEleves: [] } }`;
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${etat('M. A')}, etape: true });
    const u1 = undoStack.length, ref1 = S.fichesSuivi['5C'].etat.S.referent, demo = 'demo' in S.fichesSuivi['5C'], noms = Object.keys(S.fichesSuivi['5C'].noms).length;
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${etat('M. AB')}, etape: false });
    const u2 = undoStack.length;
    undoLast(true);
    return { u1, ref1, demo, noms, u2, apres: (S.fichesSuivi['5C'].etat || {}).S?.referent ?? null, redo: redoStack.length }; })()`);
  assert.strictEqual(r.u1, 1);
  assert.strictEqual(r.ref1, 'M. A');
  assert.strictEqual(r.demo, false, 'le marqueur de démonstration part quand la fiche range son suivi');
  assert.strictEqual(r.noms, 25);
  assert.strictEqual(r.u2, 1, 'frappe groupée : pas de second cran');
  assert.strictEqual(r.apres, null, 'Ctrl+Z revient avant le premier geste : pas encore de suivi');
  assert.strictEqual(r.redo, 1);
});

test('un geste sans effet ne laisse pas de cran vide ; une saisie refusée retire le sien', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const etat = `{ app: 'fiche-suivi-collective', format: 1, savedAt: 'x', S: { classe: '5e C', referent: 'M. A' } }`;
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${etat}, etape: true });
    const u1 = undoStack.length;
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { ...${etat}, savedAt: 'plus tard' }, etape: true });   // le même suivi, daté autrement
    const u2 = undoStack.length;
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { app: 'fiche-suivi-collective', format: 1, savedAt: 'y', S: { classe: '5e C', referent: 'M. Z' } }, etape: true });
    const u3 = undoStack.length;
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${etat}, etape: false, retirer: true });   // revenue en arrière
    return { u1, u2, u3, u4: undoStack.length, ref: S.fichesSuivi['5C'].etat.S.referent }; })()`);
  assert.deepStrictEqual(r, { u1: 1, u2: 1, u3: 2, u4: 1, ref: 'M. A' });
});

test('le suivi est rangé sous la classe QUE LA FICHE AVAIT, même si l’on a changé de classe entre-temps', () => {
  ev(DEMO); ev(CADRE);
  const r = evObj(`(() => { _suivisEnvoyer(); _createClassBare('4B', '4e B', getCls().annee); switchClass('4B'); _suivisEnvoyer();
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { referent: 'tard' } }, etape: false });
    return { c5: S.fichesSuivi['5C']?.etat?.S?.referent, c4: S.fichesSuivi['4B']?.etat ?? null, inconnue: (_suivisRecevoir({ type: 'etat', cle: 'nulle_part', etat: null }), 'nulle_part' in S.fichesSuivi) }; })()`);
  assert.deepStrictEqual(r, { c5: 'tard', c4: null, inconnue: false });
});

test('Ctrl+Z demandé par la fiche : annulé ici, le suivi repart avec la raison, sans notre toast', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer();');
  const r = evObj(`(() => {
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { referent: 'X' } }, etape: true });
    __envois.length = 0; S.cur = '5C';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on')); document.getElementById('tab-suivis').classList.add('on');
    _suivisRaison = 'annuler'; undoLast(true); _suivisEnvoyer();   // (le harnais ne redessine pas l'onglet : on envoie à sa place)
    const ch = __envois.find(m => m.type === 'charger');
    return { ch: !!ch, raison: ch && ch.raison, etat: ch && ch.etat, reste: _suivisRaison, toast: document.getElementById('toast').textContent || '' }; })()`);
  assert.strictEqual(r.ch, true);
  assert.strictEqual(r.raison, 'annuler');
  assert.strictEqual(r.etat, null);
  assert.strictEqual(r.reste, null, 'la raison est consommée par l’envoi');
  assert.ok(!/Annulation effectuée/.test(r.toast), 'la fiche dit elle-même ce qui a été annulé');
});

test('purge : une classe supprimée emporte ses fiches ; un élève supprimé, son nom envoyé', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[3];
    S.fichesSuivi[cls.id] = { etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: {} }, noms: { [sid]: 'X Y', autre: 'Z' } };
    _purgeStudentRefs(sid); const apresEleve = Object.keys(S.fichesSuivi[cls.id].noms);
    _purgeClassRefs(cls.id); return { apresEleve, classe: cls.id in S.fichesSuivi }; })()`);
  assert.deepStrictEqual(r, { apresEleve: ['autre'], classe: false });
});

test('import JSON : la section est acceptée, ses clés empoisonnées refusées, une entrée qui n’est pas un objet écartée', () => {
  ev(DEMO);
  const ok = ev(`_validateImport({ classes: {}, eleves: {}, fichesSuivi: { '5C': { etat: { S: { jours: { '2025-10-13': { x: { '0.1': 2 } } } } } } } })`);
  assert.strictEqual(ok, null);
  const ko = ev(`_validateImport(JSON.parse('{"fichesSuivi":{"5C":{"etat":{"S":{"__proto__":{"x":1}}}}}}'))`);
  assert.match(String(ko), /interdite/);
  const r = evObj(`(() => { S.fichesSuivi = { a: 3, b: { noms: {} } }; _sanitizeCoreSections(); const x = Object.keys(S.fichesSuivi);
    S.fichesSuivi = 'non'; _sanitizeCoreSections(); return { x, type: typeof S.fichesSuivi }; })()`);
  assert.deepStrictEqual(r, { x: ['b'], type: 'object' });
});

test('démonstration : la classe porte le marqueur, que la fiche remplacera par sa démonstration', () => {
  ev(DEMO);
  assert.deepStrictEqual(evObj(`S.fichesSuivi`), { '5C': { demo: true } });
});

test('Ctrl+P sur l’onglet 📋 Suivis : l’impression de la fiche (dans son cadre)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /tab === 'suivis' && _suivisFrame && _suivisPret\) \{ e\.preventDefault\(\); _suivisPost\(\{ type: 'imprimer' \}\)/);
});

test('le bloc embarqué : la version intégrée, intacte (empreinte), marquée, sans polices, sans adresse externe', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const m = /<script type="application\/octet-stream" id="fiches-suivi-app" data-octets="(\d+)" data-empreinte="([0-9a-f]{16})">([A-Za-z0-9+/=]+)<\/script>/.exec(src);
  assert.ok(m, 'bloc #fiches-suivi-app absent');
  const html = zlib.inflateRawSync(Buffer.from(m[3], 'base64'));
  assert.strictEqual(html.length, Number(m[1]));
  assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex').slice(0, 16), m[2], 'bloc modifié à la main : relancer fiches-suivi/app/assemble.py');
  const t = html.toString('utf8');
  assert.ok(t.includes('<html lang="fr" data-hote="suivi-pp" class="integree">'));
  assert.ok(t.includes('/*POLICES-HOTE*/') && !t.includes('@font-face'), 'les polices sont celles de Suivi PP');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(t), 'aucune requête réseau dans la fiche');
  // Le harnais prend le DERNIER script : le bloc doit venir avant celui de l'application.
  assert.ok(src.indexOf('id="fiches-suivi-app"') < src.lastIndexOf('<script>'));
});

test('polices : le cadre reçoit celles de la page (JetBrains Mono, Andika, Latin Modern), au sous-ensemble élargi', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const a = src.indexOf('/* ANDIKA-DEBUT */'), b = src.indexOf('/* LM-FIN */');
  const bloc = src.slice(a, b);
  assert.strictEqual((bloc.match(/@font-face/g) || []).length, 8);
  assert.ok(src.includes("@font-face {\n  font-family: 'JetBrains Mono';"), 'motif lu par _suivisPolicesCSS');
  const gen = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gen_fonts.py'), 'utf8');
  assert.match(gen, /data = woff2\(motif\.format\(f\), UNI_LARGE\)/, 'les blocs de Suivi PP au sous-ensemble élargi, comme ceux des fiches');
});
