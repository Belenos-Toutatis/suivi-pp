// Audit du 2026-10-14 — lot « imports » (élèves CSV/tableur, Plan de classe, récapitulatif MBN) et moyennes.
// Chaque test porte sur un défaut CONFIRMÉ par l'audit ; chacun échoue sans sa correction.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const RESET = `S = _emptyState(); postLoadHook();`;
const CLASSE5C = `S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0, rooms:{} }; S.cur = '5C';`;

// ─────────────────────────────────────────────── Moyennes (défauts 1 et 11)

const MOY_CLASSE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0, rooms:{} };
  S.eleves = { s1:{ id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] }, s2:{ id:'s2', nom:'Martin', prenom:'Noé', classe_id:'5C', tags:[] } };
  S.cur = '5C';`;
// Un DOM minimal : le harnais rend un élément neuf à chaque appel, on en garde un par id.
function moyApp() {
  const a = loadApp();
  const e = c => a.__TESTEVAL(c);
  const els = {};
  const mk = (id, v = '') => (els[id] = { id, value: v, innerHTML: '', textContent: '', disabled: false, focus() {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  a.document.getElementById = id => els[id] || mk(id);
  e(`toast = m => { (globalThis.__toasts = globalThis.__toasts || []).push(m); }; closeMod2 = () => {}; openMod = () => {}; renderMoyennes = () => {}; save = () => {};`);
  return { a, e, els, mk, j: c => JSON.parse(JSON.stringify(e(c))) };
}

test('1. aperçu d\'import sans colonne « Périodes » : annonce le remplacement (même période que l\'import)', () => {
  const { e, els, mk, j } = moyApp();
  e(MOY_CLASSE);
  mk('mmoyimp-date', '2025-10-10'); mk('mmoyimp-label'); mk('mmoyimp-prev'); mk('mmoyimp-ok');
  const csv = ["Nom et prénom de l'élève;MATHEMATIQUES(M. G);Moy.", 'DURAND Léa;12;12', 'MARTIN Noé;8;8'].join('\n');
  mk('mmoyimp-txt', csv);
  e(`_moyImp = { fichier:'a.csv', manual:{} }`);
  e(`moyImportOk()`);
  assert.strictEqual(j(`_moyReleves('5C').length`), 1);
  // Même date, même (absente) période : l'aperçu doit prévenir qu'il remplacera.
  els['mmoyimp-txt'].value = csv.replace('12;12', '15;15');
  e(`_moyImp = { fichier:'a.csv', manual:{} }; _moyImpRefresh()`);
  assert.match(els['mmoyimp-prev'].innerHTML, /remplacé/);
  assert.match(els['mmoyimp-ok'].textContent, /Remplacer/);
  e(`moyImportOk()`);
  assert.strictEqual(j(`_moyReleves('5C').length`), 1, 'l\'import remplace bien, comme annoncé');
});

test('11. changer la date d\'un import vers une date déjà prise (même période) est refusé, sans mutation ni cran d\'undo', () => {
  const { e, mk, j } = moyApp();
  e(MOY_CLASSE);
  const H = "Nom et prénom de l'élève;Périodes;MATHEMATIQUES(M. G);Moy.";
  const imp = (v, date) => e(`(() => { const p = _moyParse(${JSON.stringify([H, `DURAND Léa;P1;${v};${v}`].join('\n'))});
    return moyImport('5C', p, _moyMatch(p, '5C', {}), { date: ${JSON.stringify(date)}, replace: true }); })()`);
  imp(10, '2025-10-01'); imp(12, '2025-10-15');
  const [, b] = j(`_moyReleves('5C')`);
  // Le modèle refuse…
  assert.strictEqual(e(`moyReleveEdit('5C', '${b.id}', { date: '2025-10-01' })`), false);
  assert.strictEqual(j(`_moyMap('5C')['${b.id}'].date`), '2025-10-15');
  // …et la fenêtre dit pourquoi, sans empiler d'undo.
  mk('mmoyed-date', '2025-10-01'); mk('mmoyed-label', ''); mk('mmoyed-per', 'P1');
  e(`_moyEditRid = '${b.id}'`);
  const avant = j(`undoStack.length`);
  e(`globalThis.__toasts = []; moyEditOk()`);
  assert.strictEqual(j(`undoStack.length`), avant, 'aucun cran d\'undo');
  assert.strictEqual(j(`_moyMap('5C')['${b.id}'].date`), '2025-10-15');
  assert.strictEqual(j(`_moySameDay('5C', '2025-10-01', 'P1').length`), 1, 'pas de doublon');
  assert.match(j(`globalThis.__toasts`).join(' '), /existe déjà/);
  // Une date libre reste acceptée ; garder sa propre date aussi.
  assert.strictEqual(e(`moyReleveEdit('5C', '${b.id}', { date: '2025-10-20' })`), true);
  assert.strictEqual(e(`moyReleveEdit('5C', '${b.id}', { date: '2025-10-20', label: 'x' })`), true);
});

// ─────────────────────────────────────────────── Plan de classe (2, 3, 4, 6, 10)

const PDC_PLACES = `{
  classes: { '5C': { id:'5C', nom:'5e C', année: 2025, eleves:['p1','p2','p3'], activeRoom:'s1',
     rooms: { s1:{ seating: { '0,0':'p1', '0,1':'p2', '1,0':'p3', '9,9':'ghost' } } } } },
  eleves: {
    p1: { id:'p1', nom:'VINCENT', prenom:'Mathis', tags:[] },
    p2: { id:'p2', nom:'DURAND', prenom:'Léa', tags:[] },
    p3: { id:'p3', nom:'PETIT', prenom:'Inès', tags:[] },
  }, tags:{}, salles: { s1: { nom:'Salle 12', rows:12, cols:6, collectPatterns:[{id:'c1', nom:'serpentin', order:['0,0','0,1']}] } },
}`;

test('2. _pdcImport : élèves retrouvés par nom (ids locaux différents) → leurs places sont conservées', () => {
  ev(`${RESET} S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['loc1','loc2','loc3'],ord:0,rooms:{}};
    S.eleves = { loc1:{id:'loc1',nom:'Vincent',prenom:'Mathis',classe_id:'5C',tags:[]}, loc2:{id:'loc2',nom:'Durand',prenom:'Léa',classe_id:'5C',tags:[]}, loc3:{id:'loc3',nom:'Petit',prenom:'Inès',classe_id:'5C',tags:[]} };`);
  const st = J(`_pdcImport(${PDC_PLACES}, ['5C'])`);
  assert.strictEqual(st.places, 3);
  assert.deepStrictEqual(J(`S.classes['5C'].rooms.pdc_s1.seating`), { '0,0': 'loc1', '0,1': 'loc2', '1,0': 'loc3' });
  assert.strictEqual(J(`Object.keys(S.eleves).length`), 3, 'pas de doublon');
  assert.deepStrictEqual(J(`_auditState ? _auditState() : []`), []);
});

test('3. _pdcImport : classe d\'id source en minuscules → les élèves reçoivent l\'id de la classe créée', () => {
  ev(RESET);
  const d = `{ classes: { 'c_ab12': { id:'c_ab12', nom:'5e C', année: 2025, eleves:['p1'], rooms:{ s1:{ seating:{'0,0':'p1'} } } } },
    eleves: { p1:{ nom:'VINCENT', prenom:'Mathis', tags:[] } }, tags:{}, salles:{ s1:{ nom:'S', rows:5, cols:5 } } }`;
  const st = J(`_pdcImport(${d}, ['c_ab12'])`);
  assert.deepStrictEqual(J(`Object.keys(S.classes)`), ['C_AB12']);
  assert.strictEqual(J(`S.eleves.p1.classe_id`), 'C_AB12');
  assert.strictEqual(st.places, 1);
  // Réimport : retrouve la classe, ne la recrée pas, ne duplique pas l'élève.
  assert.strictEqual(J(`_pdcAnalyze(${d}).classes[0].deja`), true);
  const st2 = J(`_pdcImport(${d}, ['c_ab12'])`);
  assert.strictEqual(st2.classes, 0);
  assert.strictEqual(J(`Object.keys(S.eleves).length`), 1);
  assert.strictEqual(J(`S.classes.C_AB12.eleves.length`), 1);
});

test('4. prénoms composés : « Anne-Sophie » / « Anne Sophie » ne font pas un doublon (CSV et Plan de classe)', () => {
  ev(`${RESET} S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a'],ord:0,rooms:{}}; S.eleves.a={id:'a',nom:'LE GOFF',prenom:'Anne-Sophie',classe_id:'5C',tags:[]}; S.cur='5C';`);
  const r = J(`_impAnalyze('Nom;Prénom\\nLE GOFF;Anne Sophie\\nLe  Goff;ANNE-SOPHIE\\n', { defaultClassId:'5C', skipDup:true })`);
  assert.deepStrictEqual(r.records.map(x => [x.dup, x.ok]), [[true, false], [true, false]]);
  // Doublon interne au fichier, avec et sans trait d'union.
  ev(`${RESET} ${CLASSE5C}`);
  const r2 = J(`_impAnalyze('Nom;Prénom\\nLE GOFF;Anne-Sophie\\nLE GOFF;Anne  Sophie\\n', { defaultClassId:'5C' })`);
  assert.deepStrictEqual(r2.records.map(x => x.ok), [true, false]);
  // Plan de classe : l'élève local est reconnu par son nom malgré la graphie.
  ev(`${RESET} S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['loc'],ord:0,rooms:{}}; S.eleves.loc={id:'loc',nom:'LE GOFF',prenom:'Anne-Sophie',classe_id:'5C',tags:[]};`);
  const d = `{ classes: { '5C': { nom:'5C', eleves:['p9'] } }, eleves: { p9:{ nom:'Le Goff', prenom:'Anne Sophie', tags:[] } }, tags:{} }`;
  assert.strictEqual(J(`_pdcAnalyze(${d}).classes[0].nbKnown`), 1);
  J(`_pdcImport(${d}, ['5C'])`);
  assert.deepStrictEqual(J(`Object.keys(S.eleves)`), ['loc']);
});

test('6. dates impossibles : non reconnues à l\'import CSV et jamais stockées depuis Plan de classe', () => {
  assert.strictEqual(ev(`_impNormDate('31/02/2013')`), null);
  assert.strictEqual(ev(`_impNormDate('2013-13-45')`), null);
  assert.strictEqual(ev(`_impNormDate('12/03/2013')`), '2013-03-12');
  ev(`${RESET} ${CLASSE5C}`);
  const r = J(`_impAnalyze('Nom;Prénom;Date de naissance\\nPETIT;Inès;31/02/2013\\nGRAND;Zoé;2013-13-45\\nDURAND;Léa;12/03/2013\\n', { defaultClassId:'5C' })`);
  assert.deepStrictEqual(r.records.map(x => x.naissance), [null, null, '2013-03-12']);
  assert.ok(r.records[0].warnings.some(w => /non reconnue/.test(w)));
  ev(RESET);
  J(`_pdcImport({ classes: { '5C': { nom:'5C', eleves:['p1'] } }, eleves: { p1:{ nom:'A', prenom:'B', tags:[], naissance:'2013-02-31', arrivalDate:'2025-13-45', departureDate:'2026-01-05' } }, tags:{} }, ['5C'])`);
  assert.deepStrictEqual(J(`[S.eleves.p1.naissance, S.eleves.p1.arrivalDate, S.eleves.p1.departureDate]`), [null, null, '2026-01-05']);
});

test('10. _pdcImport : un id de tag « constructor » / « toString » ne met rien d\'autre qu\'un id dans stu.tags', () => {
  for (const t of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    ev(RESET);
    app.__d = { classes: { '5C': { nom: 'x', eleves: ['a'] } }, eleves: { a: { nom: 'A', prenom: 'B', tags: [t, 'ok'] } }, tags: { ok: { abbr: 'LAT', name: 'Latin' } } };
    ev(`_pdcImport(__d, ['5C'])`);
    const tags = J(`S.eleves.a.tags`);
    assert.ok(tags.every(x => typeof x === 'string'), t + ' : ' + JSON.stringify(tags));
    assert.strictEqual(tags.length, 1, t);
    assert.strictEqual(J(`JSON.stringify(_auditState())`), '[]');
  }
});

// ─────────────────────────────────────────────── Import CSV / tableur (5, 7, 8, 12)

test('5. nom complet « MARTIN Noé (M.) » : la civilité entre parenthèses est lue, pas rangée dans le nom', () => {
  assert.deepStrictEqual(J(`_impSplitFullName('MARTIN Noé (M.)', 'np')`), { nom: 'MARTIN', prenom: 'Noé', civilite: 'M' });
  assert.deepStrictEqual(J(`_impSplitFullName('LE GOFF Anne-Sophie (Mme)', 'np')`), { nom: 'LE GOFF', prenom: 'Anne-Sophie', civilite: 'F' });
  // Pas de civilité : sortie inchangée (clé absente).
  assert.deepStrictEqual(J(`_impSplitFullName('DUPONT Marie', 'np')`), { nom: 'DUPONT', prenom: 'Marie' });
  // Parenthèses qui ne sont pas une civilité : laissées.
  assert.match(J(`_impSplitFullName('DUPONT Marie (2)', 'np')`).prenom, /\(2\)/);
  ev(`${RESET} ${CLASSE5C}`);
  const r = J(`_impAnalyze('Élève;Classe\\nMARTIN Noé (M.);5C\\nDURAND Léa (Mme);5C\\nLE GOFF Anne-Sophie (Mme);5C\\n', { defaultClassId:'5C' })`);
  assert.deepStrictEqual(r.records.map(x => [x.nom, x.prenom, x.civilite]),
    [['MARTIN', 'Noé', 'M'], ['DURAND', 'Léa', 'F'], ['LE GOFF', 'Anne-Sophie', 'F']]);
});

test('7. cellule CSV entre guillemets contenant un retour à la ligne : reste dans sa cellule', () => {
  ev(`${RESET} ${CLASSE5C}`);
  const r = J(`_impAnalyze('Nom;Prénom;Remarque\\nDURAND;Léa;"ligne1\\nligne2"\\nMARTIN;Noé;RAS\\n', { defaultClassId:'5C' })`);
  assert.strictEqual(r.records.length, 2);
  assert.deepStrictEqual(r.records.map(x => x.remarque), ['ligne1\nligne2', 'RAS']);
  assert.deepStrictEqual(r.records.map(x => [x.nom, x.ok]), [['DURAND', true], ['MARTIN', true]]);
  assert.strictEqual(J(`_impDetect('Nom;Prénom;Remarque\\nDURAND;Léa;"a\\nb"\\n').rows.length`), 2);
  // Guillemet au milieu d'un texte libre : pas de ligne avalée.
  assert.strictEqual(J(`_impDetect('DUPONT Martin "Mimi" 1\\nMARTIN Sophie 2').rows.length`), 2);
  // Guillemet jamais refermé : repli sur les lignes.
  assert.strictEqual(J(`_impSplitRecords('a;"b\\nc;d').length`), 2);
});

test('8. .xlsx : un nombre de série dans une colonne date est converti', () => {
  ev(`${RESET} ${CLASSE5C}`);
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Nom</t></is></c><c r="B1" t="inlineStr"><is><t>Prénom</t></is></c><c r="C1" t="inlineStr"><is><t>Date de naissance</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>DURAND</t></is></c><c r="B2" t="inlineStr"><is><t>Léa</t></is></c><c r="C2" s="1"><v>41338</v></c></row>
</sheetData></worksheet>`;
  app.__src = { workbook: '<workbook><sheets><sheet name="Feuil1" r:id="rId1"/></sheets></workbook>', rels: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>', shared: null, get: null };
  app.__sheet = sheet;
  const rows = J(`(() => { const src = __src; src.get = n => n === 'xl/worksheets/sheet1.xml' ? __sheet : null; return _xlsxParse(src)[0].rows; })()`);
  const txt = rows.map(r => r.map(c => String(c ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  const r = J(`_impAnalyze(${JSON.stringify(txt)}, { defaultClassId:'5C' })`);
  assert.strictEqual(r.records[0].naissance, '2013-03-05');
  assert.strictEqual(r.records[0].warnings.length, 0);
  // Hors colonne date, un nombre n'est pas une date.
  assert.strictEqual(ev(`_impNormDate('41338')`), null);
  assert.strictEqual(ev(`_impNormDate('41338', true)`), '2013-03-05');
  assert.strictEqual(ev(`_impNormDate('12', true)`), null);
});

test('12. libellé de classe réduit au niveau : « 3ème » → 3, « 5e » → 5 ; « 5ème C » → 5C inchangé', () => {
  for (const [l, id] of [['3ème', '3'], ['6ème', '6'], ['5e', '5'], ['4EME', '4'], ['5ème C', '5C'], ['3ÈME C', '3C'], ['2NDE3', '23'], ['5C', '5C'], ['6ème 1', '61']]) {
    assert.strictEqual(ev(`_impClassIdFromLabel(${JSON.stringify(l)})`), id, l);
  }
});

// ─────────────────────────────────────────────── Moyennes : intitulés (9)

test('9. _moyAbbr : « SCIENCES VIE & TERRE » → SVT, « ÉD.PHYSIQUE & SPORT. » → EPS', () => {
  assert.strictEqual(ev(`_moyAbbr('SCIENCES VIE & TERRE')`), 'SVT');
  assert.strictEqual(ev(`_moyAbbr('ÉD.PHYSIQUE & SPORT.')`), 'EPS');
  assert.strictEqual(ev(`_moyAbbr('SCIENCES DE LA VIE ET DE LA TERRE')`), 'SVT');
  assert.strictEqual(ev(`_moyAbbr('SVT BILINGUE')`), 'SVT BILINGUE', 'une matière inconnue garde son intitulé');
});

// ─────────────────────────────────────────────── Récupération de champs (13)

test('13. _recupChamps : deux homonymes dans l\'ancienne sauvegarde → rien n\'est deviné pour ce nom', () => {
  ev(`${RESET} S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['s1','s2'],ord:0,rooms:{}};
    S.eleves = { s1:{id:'s1',nom:'Martin',prenom:'Noé',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]} };`);
  const anc = { eleves: {
    a: { nom: 'Martin', prenom: 'Noé', classe_id: '5C', naissance: '2012-01-01' },
    b: { nom: 'martin', prenom: 'noé', classe_id: '5C', naissance: '2013-01-01' },
    c: { nom: 'DURAND', prenom: 'Léa', classe_id: '5C', naissance: '2013-05-05' } } };
  const r = J(`_recupChamps(${JSON.stringify(anc)})`);
  assert.deepStrictEqual(r.map(x => [x.sid, x.champ, x.valeur]), [['s2', 'naissance', '2013-05-05']]);
  // Un seul ancien : proposé, et les espaces multiples sont repliés.
  const r2 = J(`_recupChamps({ eleves: { a: { nom: 'Martin', prenom: 'Noé', classe_id: '5C', naissance: '2012-01-01' } } })`);
  assert.deepStrictEqual(r2.map(x => [x.sid, x.valeur]), [['s1', '2012-01-01']]);
  ev(`S.eleves.s2.nom = 'LE  GOFF'; S.eleves.s2.prenom = 'Anne Sophie'`);
  const r3 = J(`_recupChamps({ eleves: { a: { nom: 'LE GOFF', prenom: 'Anne  Sophie', classe_id: '5C', naissance: '2012-01-01' } } })`);
  assert.deepStrictEqual(r3.map(x => x.sid), ['s2']);
  // Par id, l'homonymie n'empêche rien.
  const r4 = J(`_recupChamps({ eleves: { s1: { id:'s1', nom: 'Martin', prenom: 'Noé', classe_id: '5C', naissance: '2012-01-01' }, b: { nom: 'martin', prenom: 'noé', classe_id: '5C', naissance: '2013-01-01' } } })`);
  assert.deepStrictEqual(r4.map(x => [x.sid, x.valeur]), [['s1', '2012-01-01']]);
});

// ─────────────────────────────────────────────── Récapitulatif MBN (14, 15)

const PT = 72 / 25.4;
const page = items => ({ w: 595, h: 842, x0: 0, y1: 842, images: 0, lines: items.map(([x, y, size, text]) => ({ x: x * PT, y: 842 - y * PT, size, text })) });
const tete = (nom, naiss) => [[33, 10, 12, nom], ...(naiss ? [[33, 18, 8, `13 ans - ${naiss}`]] : []), [10, 26, 8, 'Classe'], [34, 26, 8, '5C'],
  [10, 32, 8, 'Évènements du 1 sept. 2025 au 9 oct. 2025']];
const obsTable = (y0, rows) => {
  const out = [[5, y0, 8, 'Observations'], [5, y0 + 5, 8, 'Date'], [40, y0 + 5, 8, 'Motif'], [100, y0 + 5, 8, 'Type'], [140, y0 + 5, 8, 'Demandeur']];
  rows.forEach((r, i) => { const y = y0 + 11 + i * 7; out.push([5, y, 8, r[0]], [40, y, 8, r[1]], [100, y, 8, r[2]], [140, y, 8, r[3]]); });
  return out;
};
const lire = pages => { app.__pg = pages; return J(`_recapLire(__pg)`); };

test('14. _recapLire : deux homonymes sur deux pages consécutives (naissances différentes) = deux élèves', () => {
  const o1 = obsTable(45, [['9 sept. 2025', 'Bavardage', 'Négatif', 'Mme X']]);
  const o2 = obsTable(45, [['12 sept. 2025', 'Retard répété', 'Négatif', 'Mme Y']]);
  let lu = lire([page([...tete('Lucas MARTIN', '01/02/2013'), ...o1]), page([...tete('Lucas MARTIN', '05/06/2012'), ...o2])]);
  assert.deepStrictEqual(lu.eleves.map(e => [e.nom, e.naissance, e.observations.map(o => o.motif)]),
    [['Lucas MARTIN', '2013-02-01', ['Bavardage']], ['Lucas MARTIN', '2012-06-05', ['Retard répété']]]);
  // Même naissance : c'est la suite du même élève (page de continuation).
  lu = lire([page([...tete('Lucas MARTIN', '01/02/2013'), ...o1]), page([...tete('Lucas MARTIN', '01/02/2013'), ...o2])]);
  assert.strictEqual(lu.eleves.length, 1);
  assert.deepStrictEqual(lu.eleves[0].observations.map(o => o.motif), ['Bavardage', 'Retard répété']);
  // Date absente d'un en-tête : on garde la suite.
  lu = lire([page([...tete('Lucas MARTIN', '01/02/2013'), ...o1]), page([...tete('Lucas MARTIN', null), ...o2])]);
  assert.strictEqual(lu.eleves.length, 1);
});

test('15. _recapInstance : « collectif », « collégien » ne sont pas des colles', () => {
  ev(RESET);
  const id = c => ev(`_recapInstance(${JSON.stringify(c)})`);
  assert.strictEqual(id('Retenue'), 'retenue');
  assert.strictEqual(id('Heure de colle'), 'retenue');
  assert.strictEqual(id('Colles'), 'retenue');
  for (const c of ['Travail d\'intérêt collectif', 'Convocation du collégien', 'Rapport au collègue']) assert.notStrictEqual(id(c), 'retenue', c);
  assert.strictEqual(id('Devoir supplémentaire'), 'devoir_supp');
});
