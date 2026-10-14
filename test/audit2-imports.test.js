// Second audit du 2026-10-14 — lot « imports » (élèves CSV, Plan de classe, salles, moyennes, réglages, récapitulatif MBN).
// Chaque test porte sur un défaut CONFIRMÉ ; chacun échoue sans sa correction.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const RESET = `S = _emptyState(); postLoadHook();`;
const CLASSE5C = `S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0, rooms:{} }; S.cur = '5C';`;

test('1. « 3E » (classe E du niveau 3) garde sa lettre ; « 3e », « 3ème », « 3EME » seuls donnent le niveau', () => {
  for (const [l, id] of [['3E', '3E'], ['4E', '4E'], ['5E', '5E'], ['6E', '6E'], ['3e', '3'], ['5 e', '5'], ['3ème', '3'], ['3EME', '3'],
                         ['5ème C', '5C'], ['3EME B', '3B'], ['5C', '5C'], ['3ÈME C', '3C'], ['2nde 3', '23']]) {
    assert.strictEqual(ev(`_impClassIdFromLabel(${JSON.stringify(l)})`), id, l);
  }
});

test('2. guillemet ouvrant jamais refermé avant la ligne suivante : les lignes intermédiaires ne sont pas avalées', () => {
  ev(`${RESET} ${CLASSE5C}`);
  const t = 'Nom;Prénom;Remarque\nDURAND;Léa;"à voir\nMARTIN;Noé;ok\nPETIT;Inès;"ras"\nGRAND;Zoé;ok\n';
  const r = J(`_impAnalyze(${JSON.stringify(t)}, { defaultClassId:'5C' })`);
  assert.deepStrictEqual(r.records.map(x => x.nom), ['DURAND', 'MARTIN', 'PETIT', 'GRAND']);
  // Une cellule multiligne bien formée reste, elle, dans sa cellule.
  const ok = J(`_impAnalyze('Nom;Prénom;Remarque\\nDURAND;Léa;"ligne1\\nligne2"\\nMARTIN;Noé;RAS\\n', { defaultClassId:'5C' })`);
  assert.deepStrictEqual(ok.records.map(x => x.remarque), ['ligne1\nligne2', 'RAS']);
  // Cas sans en-tête de même largeur : le découpage par lignes l'emporte aussi.
  assert.strictEqual(J(`_impSplitRecords('a;b;"c\\nd;e;f\\ng;h;"i"\\n').length`), 4);
});

test('3. gestes sans effet sur une salle ou une option : aucun cran d\'undo', () => {
  ev(`${RESET} ${CLASSE5C}`);
  ev(`toast = () => {}; renderDonnees = () => {}; save = () => {}; _tagsRefresh = () => {};`);
  ev(`S.classes['5C'].eleves = ['s1']; S.eleves.s1 = { id:'s1', nom:'A', prenom:'B', classe_id:'5C', tags:[] };
      S.salles.sa = { id:'sa', nom:'S', rows:3, cols:3, patterns:[{ id:'p1', nom:'serp', order:[] }] };
      S.classes['5C'].rooms = { sa:{ seating:{ '0,0':'s1' } } }; S.classes['5C'].salleCur = 'sa';`);
  const depth = () => J(`undoStack.length`);
  const d0 = depth();
  ev(`_salleMut(() => patternClear('sa', 'p1'))`);                  // ordre déjà vide
  ev(`_salleMut(() => patternSetNom('sa', 'p1', 'serp'))`);         // même nom
  ev(`salleSetUI('sa', { nom:'S', rows:3, cols:3 })`);              // même réglage
  ev(`_salleMut(() => seatSet(S.classes['5C'], 'sa', '0,0', 's1'))`); // élève reposé sur sa place
  assert.strictEqual(depth() - d0, 0, 'aucun cran vide');
  // Un vrai changement pose bien un cran.
  ev(`salleSetUI('sa', { nom:'Salle 2' })`);
  assert.strictEqual(depth() - d0, 1);
  // Un refus ne change rien non plus (et rend false).
  assert.strictEqual(ev(`_salleMut(() => false)`), false);
  assert.strictEqual(depth() - d0, 1);
  // Option renommée à l'identique.
  ev(`S.tags.t1 = { id:'t1', abbr:'LAT', name:'Latin', color:'#336699' }; globalThis.__ok = null; _uiPrompt = o => { globalThis.__ok = o.onOk; };`);
  const d1 = depth();
  ev(`tagRename('t1'); __ok('Latin');`);
  assert.strictEqual(depth() - d1, 0);
  ev(`tagRename('t1'); __ok('Latin ancien');`);
  assert.strictEqual(depth() - d1, 1);
  assert.strictEqual(ev(`S.tags.t1.name`), 'Latin ancien');
});

// ─────────────────────────────────────────────── Moyennes : modifier un import
function moyApp() {
  const a = loadApp();
  const e = c => a.__TESTEVAL(c);
  const els = {};
  const mk = (id, v = '') => (els[id] = { id, value: v, innerHTML: '', textContent: '', disabled: false, focus() {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  a.document.getElementById = id => els[id] || mk(id);
  e(`toast = m => { (globalThis.__toasts = globalThis.__toasts || []).push(m); }; closeMod2 = () => {}; openMod = () => {}; renderMoyennes = () => {}; save = () => {};`);
  return { a, e, els, mk, j: c => JSON.parse(JSON.stringify(e(c))) };
}
const MOY_BASE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1'], ord:0, rooms:{} };
  S.eleves = { s1:{ id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] } };
  S.cur = '5C';
  S.moyennes['5C'] = {
    m1:{ id:'m1', date:'2025-10-10', periode:'S1', label:'', ts:1, matieres:[], notes:{}, generale:{} },
    m2:{ id:'m2', date:'2025-10-10', periode:'S1', label:'', ts:2, matieres:[], notes:{}, generale:{} } };`;

test('4a. modifier le libellé d\'un import dont date et période sont déjà en doublon (hérité) n\'est pas refusé', () => {
  const { e, els, mk, j } = moyApp();
  e(MOY_BASE);
  mk('mmoyed-date', '2025-10-10'); mk('mmoyed-label', 'avant conseil'); mk('mmoyed-per', 'S1');
  e(`_moyEditRid = 'm2'; moyEditOk();`);
  assert.strictEqual(j(`S.moyennes['5C'].m2.label`), 'avant conseil');
  assert.strictEqual(j(`(globalThis.__toasts || []).some(t => /existe déjà/.test(t))`), false);
  // Changer la date vers une date déjà prise reste refusé.
  e(`S.moyennes['5C'].m3 = { id:'m3', date:'2025-11-10', periode:'S1', label:'', ts:3, matieres:[], notes:{}, generale:{} };`);
  els['mmoyed-date'].value = '2025-10-10'; els['mmoyed-label'].value = '';
  e(`_moyEditRid = 'm3'; moyEditOk();`);
  assert.strictEqual(j(`S.moyennes['5C'].m3.date`), '2025-11-10');
  assert.strictEqual(j(`moyReleveEdit('5C', 'm2', { label: 'x' })`), true);
});

test('4b. valider sans rien changer (ou espaces seuls, ou même date tapée sur deux chiffres) : pas de cran d\'undo', () => {
  const { e, els, mk, j } = moyApp();
  e(MOY_BASE);
  e(`S.moyennes['5C'].m2.date = '2025-10-11';`);
  mk('mmoyed-date', '2025-10-11'); mk('mmoyed-label', ''); mk('mmoyed-per', 'S1');
  const d0 = j(`undoStack.length`);
  e(`_moyEditRid = 'm2'; moyEditOk();`);
  els['mmoyed-label'].value = '   '; els['mmoyed-per'].value = ' S1 ';
  e(`moyEditOk();`);
  els['mmoyed-date'].value = '11/10/25';
  e(`moyEditOk();`);
  assert.strictEqual(j(`undoStack.length`) - d0, 0);
  // Un vrai changement pose un cran.
  els['mmoyed-date'].value = '2025-10-11'; els['mmoyed-label'].value = 'nouveau';
  e(`moyEditOk();`);
  assert.strictEqual(j(`undoStack.length`) - d0, 1);
});

test('5. code « absent » : un nombre est refusé, le code d\'avant reste', () => {
  ev(`${RESET} toast = () => {}; renderDonnees = () => {}; save = () => {};`);
  const avant = ev(`_prefs().codeAbsent`);
  const d0 = J(`undoStack.length`);
  for (const v of ['5', '12', '0', '-1', '1,5']) {
    ev(`setPref('codeAbsent', ${JSON.stringify(v)})`);
    assert.strictEqual(ev(`_prefs().codeAbsent`), avant, v);
  }
  assert.strictEqual(J(`undoStack.length`) - d0, 0);
  ev(`setPref('codeAbsent', 'ABS')`);
  assert.strictEqual(ev(`_prefs().codeAbsent`), 'ABS');
});

test('6. Plan de classe : un id de classe ou d\'élève « toString » / « valueOf » ne lève pas et ne se lit pas comme « déjà connu »', () => {
  ev(`${RESET}`);
  const E = (nom, prenom) => ({ nom, prenom, tags: [] });
  const d = { classes: { toString: { nom: '5e C', annee: 2025, eleves: ['valueOf', 'a1'] } },
              eleves: { valueOf: E('DUPONT', 'Léa'), a1: E('MARTIN', 'Noé') }, tags: {}, salles: {} };
  const an = J(`_pdcAnalyze(${JSON.stringify(d)})`);
  assert.strictEqual(an.error, undefined);
  assert.strictEqual(an.classes[0].deja, false);
  assert.strictEqual(an.classes[0].nbKnown, 0);
  assert.strictEqual(an.classes[0].nbNew, 2);
  const st = J(`_pdcImport(${JSON.stringify(d)}, ['toString'])`);
  assert.strictEqual(st.eleves, 2);
  assert.strictEqual(ev(`Object.keys(S.classes)[0]`), 'TOSTRING');
  assert.deepStrictEqual(J(`S.classes.TOSTRING.eleves.slice().sort()`), ['a1', 'valueOf']);
  assert.strictEqual(ev(`Object.prototype.hasOwnProperty.call(S.eleves, 'valueOf') && S.eleves.valueOf.nom`), 'DUPONT');
  assert.strictEqual(ev(`typeof Object.prototype.valueOf.nom`), 'undefined', 'le prototype n\'est pas pollué');
  // Réimport : cette fois ils sont connus.
  const an2 = J(`_pdcAnalyze(${JSON.stringify(d)})`);
  assert.strictEqual(an2.classes[0].nbKnown, 2);
  assert.strictEqual(an2.classes[0].deja, true);
  ev(`_pdcImport(${JSON.stringify(d)}, ['toString'])`);
  assert.strictEqual(ev(`Object.keys(S.eleves).length`), 2);
});

// ─────────────────────────────────────────────── Récapitulatif MBN : homonymes
const FICHE = `S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0, rooms:{} }; S.cur = '5C';
  S.eleves = { s1:{ id:'s1', nom:'MARTIN', prenom:'Lucas', classe_id:'5C', tags:[], naissance:'2013-02-01' },
               s2:{ id:'s2', nom:'MARTIN', prenom:'Lucas', classe_id:'5C', tags:[], naissance:'2012-06-05' } };`;
const PAGE = (nom, page, naissance, motif, date) => ({ nom, page, naissance, classe: '5C', groupes: [], regime: '', sortie: '',
  observations: [{ date, heure: '', type: 'Observation négative', motif, par: 'X' }], absences: [], punitions: [], illisibles: 0 });
const LU = `({ periode: null, eleves: [ ${JSON.stringify(PAGE('Lucas MARTIN', 1, '2013-02-01', 'a', '2025-09-09'))}, ${JSON.stringify(PAGE('Lucas MARTIN', 2, '2012-06-05', 'b', '2025-09-12'))} ] })`;

test('7. récapitulatif : deux homonymes se rapprochent par la date de naissance ; le rattachement manuel est indexé par la page', () => {
  ev(`${RESET} ${FICHE}`);
  const R = J(`_recapRattache(getCls(), ${LU}, null).map(l => [l.page, l.sid, l.homonyme])`);
  assert.deepStrictEqual(R, [[1, 's1', false], [2, 's2', false]]);
  const b = J(`(() => { const b = _recapBilan(getCls(), ${LU}, null); return b.obs.nouveaux.map(x => [x.sid, x.ev.motif]); })()`);
  assert.deepStrictEqual(b, [['s1', 'a'], ['s2', 'b']]);
  // Sans date de naissance côté PDF : rien n'est deviné, puis manuel PAR PAGE.
  const sans = `({ periode: null, eleves: [ ${JSON.stringify(PAGE('Lucas MARTIN', 1, null, 'a', '2025-09-09'))}, ${JSON.stringify(PAGE('Lucas MARTIN', 2, null, 'b', '2025-09-12'))} ] })`;
  assert.deepStrictEqual(J(`_recapRattache(getCls(), ${sans}, null).map(l => [l.sid, l.homonyme])`), [[null, true], [null, true]]);
  assert.deepStrictEqual(J(`_recapRattache(getCls(), ${sans}, { 1: 's2', 2: 's1' }).map(l => l.sid)`), ['s2', 's1']);
  // Date partagée par les deux homonymes de la classe : rien n'est deviné.
  ev(`S.eleves.s2.naissance = '2013-02-01';`);
  assert.deepStrictEqual(J(`_recapRattache(getCls(), ${LU}, null).map(l => l.sid)`), [null, null]);
  // Un homonyme sans date connue : la date de la page désigne l'autre, l'autre page reste à rattacher.
  ev(`S.eleves.s2.naissance = null;`);
  assert.deepStrictEqual(J(`_recapRattache(getCls(), ${LU}, null).map(l => l.sid)`), ['s1', null]);
});
