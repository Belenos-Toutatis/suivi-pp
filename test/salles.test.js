// Salles, places et ordres de ramassage — le RÉGLAGE (v1.15.0). Jusque-là on ne faisait
// que lire ce que Plan de classe exporte ; ici on corrige sur place. Les invariants qui
// comptent : une place, un élève de la classe, une fois ; rétrécir ne perd personne ;
// supprimer une salle ne laisse aucun placement orphelin.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0, rooms:{}, salleCur:null };
  S.classes['5D'] = { id:'5D', nom:'5D', annee:'2025-26', eleves:['s9'], ord:1, rooms:{}, salleCur:null };
  S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'ALPHA',prenom:'Ana',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'BETA', prenom:'Bo', classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'GAMMA',prenom:'Cy', classe_id:'5C',tags:[]},
    s9:{id:'s9',nom:'OMEGA',prenom:'Ed', classe_id:'5D',tags:[]},
  };
  S.salles.sa1 = { id:'sa1', nom:'Salle 102', rows:3, cols:4, patterns:[{ id:'p1', nom:'Serpentin', order:['0,0','0,1','1,1'] }] };
  S.classes['5C'].rooms.sa1 = { seating: { '0,0':'s1', '1,1':'s2' } };
  S.classes['5C'].salleCur = 'sa1';`;

test('salleAdd / salleSet : nom obligatoire, dimensions bornées, rétrécir ne jette personne dehors', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`salleAdd('  ', 4, 6)`), null);
  assert.strictEqual(ev(`salleAdd('Labo', 0, 6)`), null);
  assert.strictEqual(ev(`salleAdd('Labo', 4, 31)`), null);
  const id = ev(`salleAdd(' Labo 2 ', 4, 6).id`);
  assert.deepStrictEqual(evObj(`[S.salles['${id}'].nom, S.salles['${id}'].rows, S.salles['${id}'].cols, S.salles['${id}'].patterns]`), ['Labo 2', 4, 6, []]);
  assert.strictEqual(ev(`salleSet('sa1', { nom: '  ' })`), false);
  assert.strictEqual(ev(`salleSet('sa1', { nom: 'Salle 103', rows: 5 })`), true);
  assert.deepStrictEqual(evObj(`[S.salles.sa1.nom, S.salles.sa1.rows, S.salles.sa1.cols]`), ['Salle 103', 5, 4]);
  // s2 est en 1,1 et le pattern visite 1,1 : une salle d'un seul rang les perdrait.
  assert.strictEqual(ev(`salleSet('sa1', { rows: 1 })`), false);
  assert.strictEqual(ev(`salleSet('sa1', { cols: 1 })`), false, 'colonne 1 occupée');
  assert.strictEqual(ev(`salleSet('sa1', { rows: 2, cols: 2 })`), true, 'tout tient encore');
  assert.strictEqual(ev(`salleSet('fantome', { nom: 'x' })`), false);
});

test('seatSet : un élève de la classe, une fois par salle ; null libère', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', '2,3', 's3')`), true);
  assert.strictEqual(evObj(`S.classes['5C'].rooms.sa1.seating['2,3']`), 's3');
  // Déplacer s1 : sa place précédente se libère.
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', '0,3', 's1')`), true);
  assert.deepStrictEqual(evObj(`['0,0' in S.classes['5C'].rooms.sa1.seating, S.classes['5C'].rooms.sa1.seating['0,3']]`), [false, 's1']);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'sa1', 's1')`), '0,3');
  // Refus : hors salle, élève d'une autre classe, salle inconnue.
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', '3,0', 's2')`), false);
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', '0,0', 's9')`), false);
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'nope', '0,0', 's2')`), false);
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', 'a,b', 's2')`), false);
  // Libérer.
  assert.strictEqual(ev(`seatSet(S.classes['5C'], 'sa1', '0,3', null)`), true);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'sa1', 's1')`), null);
  // Une classe sans placement dans cette salle : la salle est créée et devient courante.
  assert.strictEqual(ev(`seatSet(S.classes['5D'], 'sa1', '0,0', 's9')`), true);
  assert.strictEqual(ev(`S.classes['5D'].salleCur`), 'sa1');
});

test('patternAdd / Toggle / Clear / Remove : l\'ordre se dessine table par table', () => {
  ev(FIXTURE);
  const id = ev(`patternAdd('sa1', ' Deux allées ').id`);
  assert.deepStrictEqual(evObj(`S.salles.sa1.patterns.map(p => p.nom)`), ['Serpentin', 'Deux allées']);
  assert.strictEqual(ev(`patternAdd('sa1', '')`), null);
  ev(`patternToggle('sa1', '${id}', '0,3'); patternToggle('sa1', '${id}', '1,3'); patternToggle('sa1', '${id}', '2,3');`);
  assert.deepStrictEqual(evObj(`_pattern('sa1', '${id}').order`), ['0,3', '1,3', '2,3']);
  ev(`patternToggle('sa1', '${id}', '1,3');`);   // recliquer retire, les suivantes remontent
  assert.deepStrictEqual(evObj(`_pattern('sa1', '${id}').order`), ['0,3', '2,3']);
  assert.strictEqual(ev(`patternToggle('sa1', '${id}', '9,9')`), false, 'hors salle');
  assert.strictEqual(ev(`patternSetNom('sa1', '${id}', 'Allées')`), true);
  assert.strictEqual(ev(`patternSetNom('sa1', '${id}', ' ')`), false);
  // L'ordre sert bien au tri de ramassage.
  ev(`seatSet(S.classes['5C'], 'sa1', '2,3', 's3'); seatSet(S.classes['5C'], 'sa1', '0,3', 's2');`);
  assert.deepStrictEqual(evObj(`_orderByPattern(S.classes['5C'], 'sa1', '${id}', ['s1','s2','s3'])`), ['s2', 's3', 's1']);
  assert.strictEqual(ev(`patternClear('sa1', '${id}')`), true);
  assert.deepStrictEqual(evObj(`_pattern('sa1', '${id}').order`), []);
  assert.strictEqual(ev(`patternRemove('sa1', '${id}')`), true);
  assert.deepStrictEqual(evObj(`S.salles.sa1.patterns.map(p => p.nom)`), ['Serpentin']);
  assert.strictEqual(ev(`patternRemove('sa1', '${id}')`), false);
});

test('salleRemove : la salle, ses placements dans chaque classe, et la salle courante', () => {
  ev(FIXTURE);
  ev(`seatSet(S.classes['5D'], 'sa1', '0,0', 's9'); const sa2 = salleAdd('Labo', 2, 2); seatSet(S.classes['5C'], sa2.id, '0,0', 's3');`);
  assert.strictEqual(ev(`salleRemove('sa1')`), true);
  assert.strictEqual(ev(`S.salles.sa1`), undefined);
  assert.strictEqual(ev(`S.classes['5C'].rooms.sa1`), undefined);
  assert.strictEqual(ev(`S.classes['5D'].rooms.sa1`), undefined);
  assert.notStrictEqual(ev(`S.classes['5C'].salleCur`), 'sa1', 'la salle courante bascule sur ce qui reste');
  assert.strictEqual(ev(`S.classes['5D'].salleCur`), null);
  assert.ok(!/sa1/.test(ev(`JSON.stringify(S)`)), 'aucune trace de la salle supprimée');
  assert.strictEqual(ev(`salleRemove('sa1')`), false);
});

test('_pdcOrigine : vrai avec le marqueur d\'import ou une salle pdc_*, faux sinon', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_pdcOrigine(S.classes['5C'])`), false);
  ev(`S.classes['5C'].pdcImportAt = '2026-09-01';`);
  assert.strictEqual(ev(`_pdcOrigine(S.classes['5C'])`), true);
  ev(`delete S.classes['5C'].pdcImportAt; S.salles.pdc_s1 = { id:'pdc_s1', nom:'x', rows:1, cols:1, patterns:[] };`);
  assert.strictEqual(ev(`_pdcOrigine(S.classes['5C'])`), true);
  assert.strictEqual(ev(`_pdcOrigine(null)`), true, 'sans classe, les salles suffisent');
});

test('la grille se dessine VUE DU BUREAU : rang 1 en bas, place 1 à droite, le bureau sous la grille', () => {
  // Test de source, faute de DOM : c'est l'orientation qui compte, et elle se casse en
  // « corrigeant » une boucle qui a l'air à l'envers.
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const m = src.match(/function _sallesEditorHTML\(\)[\s\S]*?\n\}/);
  assert.ok(m, 'l\'éditeur de salles a disparu');
  assert.match(m[0], /for \(let r = sa\.rows - 1; r >= 0; r--\)/, 'les rangs se parcourent du fond vers le devant');
  assert.match(m[0], /for \(let c = sa\.cols - 1; c >= 0; c--\)/, 'les places se parcourent de la gauche du prof vers sa droite');
  assert.match(m[0], /class="salle-bureau"/, 'le bureau est dessiné');
  assert.ok(m[0].indexOf('salle-bureau') > m[0].indexOf('r >= 0; r--'), 'le bureau vient APRÈS les rangs, donc en bas');
});
