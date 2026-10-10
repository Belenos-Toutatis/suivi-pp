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

// ── v1.60.0 : les fiches de suivi dans la fiche élève (carte, faits, fiche imprimée) ──
// Le résumé vient du cadre (`__ficheResumeEleve`, calculé par l'appli des fiches) : ici, un cadre simulé qui rend un résumé
// fabriqué — avec des textes piégés, pour l'échappement.
const RESUME = `{ du: '2025-10-13', au: '2025-12-19', semaines: [42, 43], codes: ['TB', 'S', 'A', 'I'], lien: '#eleve/X',
  indiv: [{ id: 'i1', lien: '#indiv/i1', objectifs: ['<img src=x onerror=alert(1)>'], moy: 0.62, niv: 'o', fiches: 3, avis: { titre: 'Maintien nécessaire', niv: 'alerte', sous: '' },
    parObjectif: [[{ v: 0.4, niv: 'r' }, { v: 0.8, niv: '' }]], bilans: [{ debut: '2025-10-13', fin: '2025-10-17', texte: 'Bilan <b>piégé</b>' }] }],
  coll: { moy: 0.74, niv: '', nI: 2, abs: 1, tend: 6, vals: [{ v: 0.7, niv: '' }, { v: null, niv: '' }], coms: ['S42 Lun. : bavarde'] },
  classe: { neg: 5, pos: 1, ret: 2, abs: 0, cours: 40, taux: 1.25, tend: 1, sem: [3, 2], retenues: true, par: [{ code: 'B', sens: 'bavardage', n: 3, positif: false }],
    mats: [{ mat: 'Mathématiques', t: 2.5, n: 2, k: 8 }], rems: [{ d: '2025-10-14', cours: 'M2', txt: 'Oubli <script>' }] } }`;
const CADRE_RESUME = `globalThis.__appels = 0; _suivisFrame = { contentWindow: { postMessage() {}, __ficheResumeEleves: (etat, noms, du, au) => { __appels++; return Object.fromEntries(noms.map(n => [n, ${RESUME}])); } } };
  _suivisPret = true; _suivisResumeMemo.clear(); S.fichesSuivi['5C'] = { etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { referent: 'X' } }, noms: {} };`;
const MOMENT = `getCls(), S.eleves[getCls().eleves[0]], _ficheMomentCourant(getCls())`;

test('fiche élève : la carte « 📋 Fiches de suivi » montre le résumé, tout échappé, et mène à l’onglet', () => {
  ev(DEMO); ev(CADRE_RESUME);
  const h = ev(`_ficheSuivisCarteHTML(${MOMENT})`);
  assert.match(h, /id="pf-suivis-carte"/);
  assert.match(h, /Fiches de suivi<span class="pf-k">Maintien nécessaire · collectif 74 % · 5 incidents<\/span>/);
  assert.match(h, /Suivi individuel <span class="pf-sv-avis alerte">/);
  assert.match(h, /<span class="pf-mv lo">40 %<\/span> → <span class="pf-mv">80 %<\/span>/, 'les crans de réussite de l’appli');
  assert.match(h, /Réussite <span class="pf-mv mi">62 %<\/span> sur 3 fiches/);
  assert.match(h, /tendance \+6 pts/);
  assert.match(h, /5 incidents<\/strong> · 1 positif · 1,3 pour 10 cours/);
  assert.match(h, /Surtout : Mathématiques 2,5 pour 10 cours/);
  assert.ok(!/<img|<script|<b>piégé/.test(h), 'rien n’est injecté tel quel');
  assert.match(h, /onclick="ficheVersSuivis\(\)"/);
});

test('fiche élève : pas de carte sans fiches de suivi pour la classe, ni pour un élève absent du suivi ; « lecture… » tant que le cadre n’est pas prêt', () => {
  ev(DEMO);
  assert.strictEqual(ev(`(S.fichesSuivi = {}, _ficheSuivisCarteHTML(${MOMENT}))`), '');
  ev(CADRE_RESUME);
  ev(`_suivisFrame.contentWindow.__ficheResumeEleves = (e, noms) => Object.fromEntries(noms.map(n => [n, { absent: true }])); _suivisResumeMemo.clear();`);
  assert.strictEqual(ev(`_ficheSuivisCarteHTML(${MOMENT})`), '');
  ev(`_suivisPret = false; _suivisResumeMemo.clear();`);
  assert.match(ev(`_ficheSuivisCarteHTML(${MOMENT})`), /Lecture des fiches de suivi…/);
  ev(`_suivisPret = true; _suivisFrame.contentWindow.__ficheResumeEleves = (e, noms) => Object.fromEntries(noms.map(n => [n, { horsPeriode: true, debut: '2025-10-13', fin: '2025-12-19' }])); _suivisResumeMemo.clear();`);
  assert.match(ev(`_ficheSuivisCarteHTML(${MOMENT})`), /Le suivi va du 13\/10\/2025 au 19\/12\/2025 : rien sur ce moment/);
  ev(`_suivisFrame.contentWindow.__ficheResumeEleves = () => { throw new Error('x'); }; _suivisResumeMemo.clear();`);
  assert.match(ev(`_ficheSuivisCarteHTML(${MOMENT})`), /n’ont pas pu être lues/);
});

test('fiche élève : le résumé est demandé une fois par suivi, pour toute la classe — un suivi modifié le redemande', () => {
  ev(DEMO); ev(CADRE_RESUME);
  const r = evObj(`(() => { _ficheSuivisCarteHTML(${MOMENT}); _ficheSuivisCarteHTML(getCls(), S.eleves[getCls().eleves[5]], _ficheMomentCourant(getCls())); const a = __appels;
    S.fichesSuivi['5C'].etat = { ...S.fichesSuivi['5C'].etat }; _ficheSuivisCarteHTML(${MOMENT}); return [a, __appels]; })()`);
  assert.deepStrictEqual(r, [1, 2]);
});

test('faits du moment et fiche imprimée : les fiches de suivi y sont', () => {
  ev(DEMO); ev(CADRE_RESUME);
  const f = evObj(`_ficheFaits(${MOMENT}).filter(x => x.k === 'suivi').map(x => x.phrase)`);
  assert.deepStrictEqual(f, ['suivi individuel : réussite de 62 % sur 3 fiches (maintien nécessaire)', 'suivi collectif : réussite de 74 %, en progrès',
    '5 incidents sur les fiches de classe, surtout en Mathématiques']);
  const p = ev(`_fichePrintHTML(getCls(), getCls().eleves[0], _ficheMomentCourant(getCls()), { parts: ['suivis'] }, null)`);
  assert.match(p, /<h3>Fiches de suivi<\/h3>/);
  assert.match(p, /<strong>40 %<\/strong> → 80 %/, 'sur le papier, une réussite rouge en gras (noir et blanc)');
  assert.ok(!/<img|<script/.test(p));
  assert.ok(evObj(`FICHE_PRINT_PARTS.map(x => x.key)`).includes('suivis') && evObj(`_fichePrintOpts.parts`).includes('suivis'), 'partie cochée d’office');
});

test('« ↗ Ouvrir » : l’onglet 📋 Suivis, sur la synthèse de l’élève dans l’appli', () => {
  ev(DEMO); ev(CADRE_RESUME);
  const r = evObj(`(() => { const envois = []; _suivisFrame.contentWindow.postMessage = m => envois.push(m); _ficheSid = getCls().eleves[0];
    ficheVersSuivis(); return { envois: envois.filter(m => m.type === 'aller'), nom: _suivisNom(S.eleves[_ficheSid]), reste: _suivisAller }; })()`);
  assert.strictEqual(r.envois.length, 1);
  assert.strictEqual(r.envois[0].hash, '#eleve/' + encodeURIComponent(r.nom));
  assert.strictEqual(r.reste, null);
});

// ── v1.61.0 : la carte de chaleur, et les réglages communs aux deux applications ──
test('carte de chaleur : un groupe « 📋 Fiches de suivi » (suivi individuel, collectif, fiches de classe) sur le moment, cliquable', () => {
  ev(DEMO); ev(CADRE_RESUME);
  const r = evObj(`(() => { const cls = getCls(), g = _chaleurGroupes(cls, [], _ficheMomentCourant(cls)).find(x => x.key === 'suivi'), sid = cls.eleves[0];
    return { label: g.label, sub: g.sub.map(x => x.id), ind: g.cell(sid, 'ind'), coll: g.cell(sid, 'coll'), cl: g.cell(sid, 'cl'), sum: g.sum(sid) }; })()`);
  assert.strictEqual(r.label, '📋 Fiches de suivi');
  assert.deepStrictEqual(r.sub, ['ind', 'coll', 'cl']);
  assert.deepStrictEqual(r.ind.slice(0, 2), ['ch-mi', '62 %']);
  assert.match(r.ind[2], /Maintien nécessaire/);
  assert.match(r.ind[3], /^suivisAllerUI\('demo_e01','#indiv\/i1'\)$/);
  assert.deepStrictEqual(r.coll.slice(0, 2), ['', '74 %']);
  assert.deepStrictEqual(r.cl.slice(0, 2), ['ch-inc', '5']);
  assert.deepStrictEqual(r.sum.slice(0, 2), ['ch-inc', '5'], 'replié : la case la plus préoccupante');
  // sans suivi : pas de groupe ; cadre pas prêt : une colonne d'attente
  assert.ok(!ev(`(S.fichesSuivi = {}, _chaleurGroupes(getCls(), [], _ficheMomentCourant(getCls())).some(x => x.key === 'suivi'))`));
  ev(CADRE_RESUME); ev('_suivisPret = false;');
  assert.deepStrictEqual(evObj(`_chaleurGroupes(getCls(), [], _ficheMomentCourant(getCls())).find(x => x.key === 'suivi').sub.map(x => x.id)`), ['att']);
});

const ETAT_FICHE = (o = {}) => `{ app: 'fiche-suivi-collective', format: 1, savedAt: '', S: Object.assign({ classe: '5e C', referent: 'M. CHÊNE', etablissement: { nom: 'Collège des Ormeaux (démo)', logo: '' },
  decoupage: { mode: 'semestres', fins: [] }, matieres: [{ nom: 'Mathématiques', prof: 'M. TILLEUL, Mme FRÊNE' }, { nom: 'Hist.-Géo.', prof: 'M. SAULE' }, { nom: 'Allemand', prof: '' }, { nom: 'Vie de classe', prof: 'M. X' }] }, ${JSON.stringify(o)}) }`;

test('réglages communs envoyés à la fiche : classe, établissement, référent, découpage, enseignant des matières reconnues', () => {
  ev(DEMO); ev(CADRE);
  const c = evObj(`(() => { S.fichesSuivi['5C'] = { etat: ${ETAT_FICHE()} }; return _suivisCommun('5C'); })()`);
  assert.strictEqual(c.classe, '5e C');
  assert.strictEqual(c.etablissement, 'Collège des Ormeaux (démo)');
  assert.strictEqual(c.referent, 'M. CHÊNE');
  assert.deepStrictEqual(c.decoupage, { mode: 'semestres', fins: [] }, 'dates d’office : pas imposées à la fiche');
  assert.deepStrictEqual(Object.keys(c.profs).sort(), ['Allemand', 'Hist.-Géo.', 'Mathématiques'], '« Vie de classe » reste à la fiche ; « Hist.-Géo. » reconnue par l’onglet');
  assert.strictEqual(c.profs['Mathématiques'].prof, 'M. TILLEUL, Mme FRÊNE');
  assert.strictEqual(c.profs['Hist.-Géo.'].did, 'histoire_geo');
  const d = evObj(`(() => { S.prefs.periodMode = 'trimestre'; S.prefs.periodStarts = { trimestre: ['12-06', '03-14'] }; return _suivisCommun('5C').decoupage; })()`);
  assert.strictEqual(d.mode, 'trimestres');
  assert.match(d.fins[0], /^\d{4}-12-05$/);
  assert.match(d.fins[1], /^\d{4}-03-13$/);
  // un changement ici part par « commun »
  const m = evObj(`(() => { __envois.length = 0; _suivisEnvoyer(true); __envois.length = 0; S.prefs.avisNom = 'Mme PIN'; _suivisEnvoyer(); return __envois.filter(x => x.type === 'commun').map(x => x.commun.referent); })()`);
  assert.deepStrictEqual(m, ['Mme PIN']);
});

test('réglages communs changés dans la fiche : repris par Suivi PP, dans le cran du geste — sauf sans suivi d’avant, où la fiche ne fait que combler', () => {
  ev(DEMO); ev(CADRE); ev('_suivisEnvoyer(true);');
  // premier envoi (pas de suivi d'avant) : nos valeurs restent, la fiche ne remplit que ce qui manquait ici (allemand)
  const r1 = evObj(`(() => { const auto = _discProfsAuto('5C', 'maths');
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${ETAT_FICHE({ referent: 'M. ROUGET', matieres: [{ nom: 'Mathématiques', prof: 'M. BROCHET' }, { nom: 'Allemand', prof: 'M. HECHT' }] })}, etape: false });
    return { maths: _discProfs('5C', 'maths') === auto, all: S.disciplines.allemand.profs || null, ref: S.prefs.avisNom }; })()`);
  assert.deepStrictEqual(r1, { maths: true, all: 'M. HECHT', ref: 'M. CHÊNE' });
  // geste dans la fiche : l'enseignant de maths et le référent changent → repris ici ; Ctrl+Z défait les deux côtés
  const r2 = evObj(`(() => { const u = undoStack.length;
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${ETAT_FICHE({ referent: 'Mme PIN', matieres: [{ nom: 'Mathématiques', prof: 'M. NOYER' }, { nom: 'Allemand', prof: 'M. HECHT' }] })}, etape: true });
    const apres = { maths: _discProfs('5C', 'maths'), ref: S.prefs.avisNom, crans: undoStack.length - u };
    undoLast(true); return { apres, annule: { maths: S.disciplines.maths.profs || null, ref: S.prefs.avisNom } }; })()`);
  assert.deepStrictEqual(r2, { apres: { maths: 'M. NOYER', ref: 'Mme PIN', crans: 1 }, annule: { maths: null, ref: 'M. CHÊNE' } });
  // revenir à l'enseignant des moyennes : la saisie à la main est retirée (il redevient automatique)
  const r3 = evObj(`(() => { const auto = _discProfsAuto('5C', 'maths');
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: ${ETAT_FICHE({ matieres: [{ nom: 'Mathématiques', prof: 'M. NOYER' }] })}, etape: true });
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { ...S.fichesSuivi['5C'].etat.S, matieres: [{ nom: 'Mathématiques', prof: auto }] } }, etape: true });
    return 'profs' in S.disciplines.maths; })()`);
  assert.strictEqual(r3, false);
  // découpage changé dans la fiche : mode et dates ici
  const r4 = evObj(`(() => { const a = S.fichesSuivi['5C'].etat.S, y = getCls().annee.slice(0, 4);
    _suivisRecevoir({ type: 'etat', cle: '5C', etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { ...a, decoupage: { mode: 'trimestres', fins: [y + '-11-28', (+y + 1) + '-03-06'] } } }, etape: true });
    return { mode: S.prefs.periodMode, starts: S.prefs.periodStarts.trimestre }; })()`);
  assert.deepStrictEqual(r4, { mode: 'trimestre', starts: ['11-29', '03-07'] });
});

test('fiche de suivi autonome téléchargée depuis Suivi PP : identique à celle du dépôt, vierge, refusée si la page n’a pas la forme attendue', () => {
  const zlib = require('zlib'), fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const integ = zlib.inflateRawSync(Buffer.from(html.match(/id="fiches-suivi-app"[^>]*>([^<]+)</)[1].trim(), 'base64')).toString('utf8');
  const dir = path.join(__dirname, '..', 'fiches-suivi', 'app');
  const polices = fs.readFileSync(path.join(dir, 'polices.css'), 'utf8'), autonome = fs.readFileSync(path.join(dir, 'Fiche de suivi collective.html'), 'utf8');
  sb.__integ = integ; sb.__pol = polices;
  const r = sb.__TESTEVAL(`_suivisAutonomeDepuis(globalThis.__integ, globalThis.__pol)`);
  assert.strictEqual(r, autonome, 'le même fichier que « Fiche de suivi collective.html »');
  assert.ok(!/data-hote|class="integree"/.test(r.slice(0, 200)));
  assert.ok(r.includes('<script id="donnees-suivi" type="application/json">null</script>'), 'vierge');
  sb.__plein = integ.replace('<script id="donnees-suivi" type="application/json">null</script>', '<script id="donnees-suivi" type="application/json">{"app":"fiche-suivi-collective"}</script>');
  assert.strictEqual(sb.__TESTEVAL(`_suivisAutonomeDepuis(globalThis.__plein, '')`), null, 'une page qui contient des données ne sort pas');
  assert.strictEqual(sb.__TESTEVAL(`_suivisAutonomeDepuis('<html lang="fr">', '')`), null);
  assert.match(sb.__TESTEVAL(`(() => { _donRub = 'imports'; const z = document.createElement('div'); _renderStorageGauge = () => {}; _renderDonneesInner(z); return z.innerHTML; })()`), /onclick="suivisTelechargerAutonome\(\)"/);
});
