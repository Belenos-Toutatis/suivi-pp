// Bilans de période — ce que je dirai au conseil de classe, ce que je retiens à
// mi-période. Entrées datées sur l'élève, période DÉDUITE de la date.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre';
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
  };
  S.releves['5C'] = { '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1:7, s2:10 } } };`;

test('bilanAdd : refuse une date illisible ou un texte vide, replie un type inconnu sur « conseil »', () => {
  ev(FIXTURE);
  assert.strictEqual(evObj(`bilanAdd('s1', { date:'2025-13-01', type:'conseil', texte:'x' })`), null);
  assert.strictEqual(evObj(`bilanAdd('s1', { date:'2025-11-01', type:'conseil', texte:'   ' })`), null);
  assert.strictEqual(evObj(`bilanAdd('zz', { date:'2025-11-01', type:'conseil', texte:'x' })`), null);
  const e = evObj(`bilanAdd('s1', { date:'2025-11-01', type:'nimporte', texte:'  Sérieux.  ' })`);
  assert.deepStrictEqual([e.type, e.texte], ['conseil', 'Sérieux.']);
  assert.strictEqual(evObj(`S.eleves.s1.bilans.length`), 1);
});

test('_bilansOf : du plus récent au plus ancien ; bilanSet et bilanRemove', () => {
  ev(FIXTURE);
  ev(`bilanAdd('s1', { date:'2025-11-01', type:'miperiode', texte:'A' });
      bilanAdd('s1', { date:'2026-01-20', type:'conseil', texte:'B' });
      bilanAdd('s1', { date:'2025-12-15', type:'conseil', texte:'C' });`);
  assert.deepStrictEqual(evObj(`_bilansOf('s1').map(e => e.texte)`), ['B', 'C', 'A']);
  const id = evObj(`_bilansOf('s1')[2].id`);
  assert.strictEqual(evObj(`bilanSet('s1', '${id}', { date:'2025-11-02', type:'conseil', texte:'A2' })`), true);
  assert.strictEqual(evObj(`bilanSet('s1', '${id}', { date:'2025-11-02', type:'conseil', texte:'' })`), false, 'un bilan ne se vide pas');
  assert.deepStrictEqual(evObj(`_bilansOf('s1').find(e => e.id === '${id}')`).texte, 'A2');
  assert.strictEqual(evObj(`bilanRemove('s1', '${id}')`), true);
  assert.strictEqual(evObj(`bilanRemove('s1', '${id}')`), false);
  assert.strictEqual(evObj(`_bilansOf('s1').length`), 2);
});

test('_bilanPeriode : le plus récent DE la période, du type demandé d\'abord, l\'autre type à défaut', () => {
  ev(FIXTURE);
  ev(`bilanAdd('s1', { date:'2025-11-10', type:'miperiode', texte:'mi S1' });
      bilanAdd('s1', { date:'2026-01-20', type:'conseil', texte:'conseil S1' });
      bilanAdd('s1', { date:'2026-03-10', type:'miperiode', texte:'mi S2' });`);
  const cls = `S.classes['5C']`;
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's1', 0, 'conseil').texte`), 'conseil S1');
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's1', 0, 'miperiode').texte`), 'mi S1');
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's1', 0).texte`), 'conseil S1', 'sans type : le plus récent');
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's1', 1, 'conseil').texte`), 'mi S2', 'pas de conseil au S2 : le bilan de mi-période vaut mieux que rien');
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's2', 0, 'conseil')`), null);
  assert.strictEqual(evObj(`_bilanPeriode(${cls}, 's1', 7, 'conseil')`), null, 'période inexistante');
});

test('_syntheseRow porte le bilan de la PÉRIODE COURANTE, et la liste trie « rédigé d\'abord »', () => {
  ev(FIXTURE);
  // Dernier relevé le 01/10 → période courante S1. Un bilan au S2 n'y apparaît pas.
  ev(`bilanAdd('s2', { date:'2026-03-10', type:'conseil', texte:'S2' });
      bilanAdd('s2', { date:'2026-01-20', type:'conseil', texte:'S1 de Noé' });`);
  const r = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s2)`);
  assert.deepStrictEqual([r.bilan.texte, r.bilan.type, r.nbBilans], ['S1 de Noé', 'conseil', 2]);
  assert.strictEqual(evObj(`_syntheseRow(S.classes['5C'], S.eleves.s1).bilan`), null);
  ev(`_eleveFilter = ''; eleveSort = { col: 'bilan', dir: 1 };`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s2', 's1']);
  ev(`eleveSort = { col: 'nom', dir: 1 };`);
});

test('postLoadHook : un élève sans section bilans en reçoit une vide, une entrée non-objet est écartée', () => {
  ev(FIXTURE);
  ev(`S.eleves.s1.bilans = [ 'zut', { id:'b1', date:'2025-11-01', ts:1, type:'conseil', texte:'ok' } ]; delete S.eleves.s2.bilans; postLoadHook();`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.bilans.length, S.eleves.s2.bilans]`), [1, []]);
});

test('_ymdClampAnnee : une date hors de l\'année scolaire de la classe est ramenée à ses bornes', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_ymdClampAnnee(S.classes['5C'], '2026-09-11')`), '2026-07-31');
  assert.strictEqual(ev(`_ymdClampAnnee(S.classes['5C'], '2025-03-01')`), '2025-08-01');
  assert.strictEqual(ev(`_ymdClampAnnee(S.classes['5C'], '2026-01-20')`), '2026-01-20');
});
