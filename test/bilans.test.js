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

test('Point du mois et bilans d\'une feuille d\'avis : le bon moment, repris plutôt que doublé', () => {
  ev(`S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre';
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1'], ord:0 }; S.cur = '5C';
    S.eleves = { s1:{id:'s1',nom:'A',prenom:'a',classe_id:'5C',tags:[]} };`);
  assert.strictEqual(ev(`_bilanLabel({ type: 'mois', date: '2025-09-20' })`), 'Point de septembre');
  assert.strictEqual(ev(`_bilanLabel({ type: 'miperiode', date: '2025-11-20' })`), 'Bilan de mi-période');
  ev(`bilanAdd('s1', { date: '2025-09-20', type: 'mois', texte: 'Rentrée difficile.' });
      bilanAdd('s1', { date: '2025-11-15', type: 'miperiode', texte: 'Mieux.' })`);
  const cls = `S.classes['5C']`;
  assert.strictEqual(ev(`_bilanCible(${cls}, 's1', { type: 'mois', date: '2025-09-02' }).texte`), 'Rentrée difficile.', 'même mois : repris');
  assert.strictEqual(ev(`_bilanCible(${cls}, 's1', { type: 'mois', date: '2025-10-02' })`), null, 'autre mois : nouveau');
  assert.strictEqual(ev(`_bilanCible(${cls}, 's1', { type: 'miperiode', date: '2026-01-10' }).texte`), 'Mieux.', 'même période');
  assert.strictEqual(ev(`_bilanCible(${cls}, 's1', { type: 'conseil', date: '2026-01-10' })`), null, 'autre type : nouveau');
  // Le moment d'une feuille d'avis : un conseil du S1 préparé en février reste daté du S1.
  ev(`window.__c = avisCampagneCreer(${cls}, { pIdx: 0, disciplines: ['maths'] });
      window.__m = avisCampagneCreer(${cls}, { pIdx: 0, disciplines: ['maths'], objectif: 'mois', mois: 9 });`);
  const mc = evObj(`_avisBilanMode(${cls}, window.__c)`);
  assert.strictEqual(mc.type, 'conseil');
  assert.ok(mc.date >= '2025-08-01' && mc.date <= '2026-01-31', mc.date);
  const mm = evObj(`_avisBilanMode(${cls}, window.__m)`);
  assert.strictEqual(mm.type, 'mois');
  assert.strictEqual(mm.date.slice(0, 7), '2025-09', 'septembre de l\'année scolaire');
});

test('Liste des élèves : une colonne par MOMENT de bilan de la période, dans l\'ordre, conseil au bout', () => {
  ev(FIXTURE);
  const cols = () => evObj(`_bilanColonnes(S.classes['5C'], 0, _bilanColsAjout).map(c => [c.key, c.court, c.date])`);
  ev(`_bilanColsAjout = new Set()`);
  // Sans aucun bilan : la seule colonne du conseil, datée dans la période.
  const c0 = cols();
  assert.strictEqual(c0.length, 1);
  assert.deepStrictEqual(c0[0].slice(0, 2), ['bil:conseil:0', 'Conseil S1']);
  assert.ok(c0[0][2] >= '2025-08-01' && c0[0][2] <= '2026-01-31');
  ev(`bilanAdd('s1', { date:'2025-09-30', type:'mois', texte:'Septembre de Léa' });
      bilanAdd('s2', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1 de Noé' });
      bilanAdd('s2', { date:'2026-01-22', type:'conseil', texte:'Conseil de Noé' });
      bilanAdd('s1', { date:'2026-03-10', type:'mois', texte:'Mars : S2, pas ici' });`);
  assert.deepStrictEqual(cols(), [['bil:mois:2025-09', 'Point sept.', '2025-09-30'], ['bil:miperiode:0', 'Mi-S1', '2025-11-20'], ['bil:conseil:0', 'Conseil S1', '2026-01-22']]);
  // Chaque colonne ne montre QUE son moment : le bilan de mi-période n'est pas celui du conseil.
  const de = (sid, k) => evObj(`(() => { const c = _bilanColonnes(S.classes['5C'], 0, _bilanColsAjout).find(c => c.key === '${k}'); const b = _bilanDeColonne(S.classes['5C'], '${sid}', c); return b && b.texte; })()`);
  assert.strictEqual(de('s2', 'bil:miperiode:0'), 'Mi-S1 de Noé');
  assert.strictEqual(de('s2', 'bil:conseil:0'), 'Conseil de Noé');
  assert.strictEqual(de('s1', 'bil:conseil:0'), null);
  assert.strictEqual(de('s1', 'bil:mois:2025-09'), 'Septembre de Léa');
  // Une colonne ajoutée à la main (vide) se range à sa place ; hors période, ignorée.
  ev(`_bilanColsAjout = new Set(['bil:mois:2025-11', 'bil:mois:2026-04', 'bil:miperiode:1', 'nimporte'])`);
  assert.deepStrictEqual(cols().map(c => c[0]), ['bil:mois:2025-09', 'bil:mois:2025-11', 'bil:miperiode:0', 'bil:conseil:0']);
  assert.ok(/^2025-11-/.test(cols()[1][2]), 'un bilan neuf du point de novembre est daté en novembre');
  // Ce qu'on peut encore ajouter : ni août ni juillet, ni ce qui existe déjà.
  const prop = evObj(`_bilanColsProposables(S.classes['5C'], 0, _bilanColonnes(S.classes['5C'], 0, _bilanColsAjout)).map(o => o.key)`);
  assert.deepStrictEqual(prop, ['bil:mois:2025-10', 'bil:mois:2025-12', 'bil:mois:2026-01']);
  // Le tri par une colonne : rédigé d'abord ; « bilan » (ancien nom) = la colonne du conseil.
  ev(`_eleveFilter = ''; eleveSort = { col: 'bil:mois:2025-09', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1', 's2']);
  ev(`eleveSort = { col: 'bilan', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s2', 's1']);
  // Ouvrir une case : la rédaction de CE moment, à la date de la colonne.
  ev(`_bilanColsAjout = new Set(); closeMod2 && document.getElementById('mbilan')?.classList.remove('on'); elevesBilanOuvrir('s1', 'bil:miperiode:0')`);
  assert.deepStrictEqual(evObj(`_bilanMode`), { type: 'miperiode', date: '2025-11-20' });
  ev(`eleveSort = { col: 'nom', dir: 1 }; _bilanMode = null; _bilanOrdreFige = null`);
});

test('Liste des élèves : des colonnes se masquent (écran ET papier), « vide » est signalé, un cran d\'undo', () => {
  ev(FIXTURE);
  ev(`_bilanColsAjout = new Set(); _eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 };
      bilanAdd('s1', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1 de Léa' });`);
  const capture = () => ev(`(() => {
    const zone = document.createElement('div'); const orig = document.getElementById;
    document.getElementById = id => id === 'eleves-body' ? zone : orig.call(document, id);
    try { renderStudents(); } finally { document.getElementById = orig; }
    return zone.innerHTML; })()`);
  let html = capture();
  assert.ok(html.includes('>Mi-S1') && html.includes('>Conseil S1'), 'une colonne par moment');
  assert.ok(html.includes(`elevesBilanOuvrir('s1','bil:miperiode:0')`));
  assert.ok(/Non rendus<span|Non rendus<\/th>/.test(html) || html.includes('>Non rendus'), 'colonne présente par défaut');
  assert.match(html, /Non rendus <span class="tb-hint">— vide<\/span>/, 'le choix des colonnes dit qu\'elle est vide');
  const u = ev(`undoStack.length`);
  ev(`elevesColToggle('docs', false); elevesColToggle('bil:miperiode:0', false)`);
  ev(`elevesColToggle('docs', false)`);
  assert.strictEqual(ev(`undoStack.length`), u + 2, 'déjà masquée : rien n\'est empilé');
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), ['docs', 'bil:miperiode:0']);
  assert.ok(ev(`S.prefs.elevesColsOff !== DEFAULT_PREFS.elevesColsOff && DEFAULT_PREFS.elevesColsOff.length === 0`), 'remplacé, jamais modifié en place');
  html = capture();
  assert.ok(!html.includes('sortEleves(\'docs\')') && !html.includes('>Mi-S1<'), 'masquées à l\'écran');
  assert.match(html, /☰ Colonnes <span class="tb-hint">\(2 masquées\)<\/span>/);
  const pr = ev(`_elevesPrintHTML(S.classes['5C'])`);
  assert.ok(!pr.includes('>Non rendus<') && !pr.includes('Mi-S1') && pr.includes('>Conseil S1<'), 'et sur le papier');
  assert.strictEqual([...pr.matchAll(/<col style/g)].length, 10);
  // Masquer les vides d'un geste ; tout réafficher.
  ev(`elevesColsVides()`);
  assert.ok(evObj(`S.prefs.elevesColsOff`).includes('incidents') && !evObj(`S.prefs.elevesColsOff`).includes('cumul'), 'le carnet a des relevés : il reste');
  ev(`elevesColsTout()`);
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), []);
});
