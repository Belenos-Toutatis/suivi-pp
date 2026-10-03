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

test('Liste des élèves : les colonnes se masquent par leurs puces (écran ET papier), un cran d\'undo ; un point par moment de bilan', () => {
  // v1.44.2 : le tableau du prototype — des puces de colonnes visibles, une colonne Bilans
  // à un point par moment (cliquable vers la rédaction de CE moment).
  ev(FIXTURE);
  ev(`_bilanColsAjout = new Set(); _eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 }; localStorage.removeItem('suiviPP_elevesAffichage');
      bilanAdd('s1', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1 de Léa' });`);
  const capture = () => ev(`(() => {
    const zone = document.createElement('div'); const orig = document.getElementById;
    document.getElementById = id => id === 'eleves-body' ? zone : orig.call(document, id);
    try { renderStudents(); } finally { document.getElementById = orig; }
    return zone.innerHTML; })()`);
  let html = capture();
  assert.ok(html.includes(`elevesBilanOuvrir('s1','bil:miperiode:0')`) && html.includes(`elevesBilanOuvrir('s1','bil:conseil:0')`), 'un point par moment');
  assert.match(html, /class="el-bd f" onclick="elevesBilanOuvrir\('s1','bil:miperiode:0'\)"/, 'plein : écrit');
  assert.match(html, /aria-pressed="true" onclick="elevesColToggle\('docs',false\)"[^>]*>Papiers</, 'la puce de la colonne');
  const u = ev(`undoStack.length`);
  ev(`elevesColToggle('docs', false); elevesColToggle('bilans', false)`);
  ev(`elevesColToggle('docs', false)`);
  assert.strictEqual(ev(`undoStack.length`), u + 2, 'déjà masquée : rien n\'est empilé');
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), ['docs', 'bilans']);
  assert.ok(ev(`S.prefs.elevesColsOff !== DEFAULT_PREFS.elevesColsOff && DEFAULT_PREFS.elevesColsOff.length === 0`), 'remplacé, jamais modifié en place');
  html = capture();
  assert.ok(!html.includes(`sortEleves('docs')`) && !html.includes('elevesBilanOuvrir'), 'masquées à l\'écran');
  const pr = ev(`_elevesPrintHTML(S.classes['5C'])`);
  assert.ok(!pr.includes('>Non rendus<') && !pr.includes('Mi-S1') && !pr.includes('>Conseil S1<'), 'et sur le papier');
  // Les clés d'avant : « cumul » masquait le carnet ; Δ, aménagements, colonnes de bilan sont ignorées.
  ev(`S.prefs.elevesColsOff = ['cumul', 'delta', 'amen', 'bil:conseil:0']`);
  assert.deepStrictEqual(evObj(`_elevesColsOff()`), ['carnet']);
  ev(`S.prefs.elevesColsOff = []`);
});

test('Liste des élèves : les bilans des PÉRIODES PRÉCÉDENTES ont aussi leurs colonnes (seulement si remplies)', () => {
  ev(FIXTURE);
  // Période courante : S2 (dernier relevé en mars).
  ev(`_bilanColsAjout = new Set(); S.releves['5C']['2026-03-05'] = { date:'2026-03-05', ts:2, counts:{ s1:9, s2:12 } };
      bilanAdd('s1', { date:'2025-09-30', type:'mois', texte:'Septembre' });
      bilanAdd('s2', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1' });
      bilanAdd('s2', { date:'2026-04-02', type:'mois', texte:'Avril' });`);
  const cols = () => evObj(`_bilanColonnesListe(S.classes['5C'], _carnetCurrentPeriodIdx(S.classes['5C']), _bilanColsAjout).map(c => [c.court, c.pIdx])`);
  assert.deepStrictEqual(cols(), [['Point sept.', 0], ['Mi-S1', 0], ['Point avr.', 1], ['Conseil S2', 1]],
    'le conseil du S1, vide, n\'a pas de colonne ; celui du S2 (courant) toujours');
  ev(`bilanAdd('s1', { date:'2026-01-22', type:'conseil', texte:'Conseil S1' })`);
  assert.deepStrictEqual(cols().map(c => c[0]), ['Point sept.', 'Mi-S1', 'Conseil S1', 'Point avr.', 'Conseil S2']);
  // Une case du S1 ouvre la rédaction de CE moment, daté au S1.
  ev(`document.getElementById('mbilan')?.classList.remove('on'); _bilanMode = null; elevesBilanOuvrir('s2', 'bil:conseil:0')`);
  assert.deepStrictEqual(evObj(`_bilanMode`), { type: 'conseil', date: '2026-01-22' });
  // Et sur le papier.
  ev(`_eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 }; S.prefs.elevesColsOff = []`);
  const pr = ev(`_elevesPrintHTML(S.classes['5C'])`);
  assert.ok(['Point sept.', 'Mi-S1', 'Conseil S1', 'Point avr.', 'Conseil S2'].every(t => pr.includes(`<th>${t}</th>`)));
  ev(`_bilanMode = null; _bilanOrdreFige = null`);
});

// ── Liste des élèves refondue (v1.43.0) : deux affichages, filtres, vues, avis ──
test('Liste : filtres d\'un clic (cumulés), vues toutes faites, colonne et résumé des avis', () => {
  ev(FIXTURE);
  ev(`_bilanColsAjout = new Set(); _eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 }; _elevesFiltres = new Set();
      bilanAdd('s1', { date:'2026-01-20', type:'conseil', texte:'Conseil de Léa' });
      incidentAdd('s2', { date:'2025-12-03', type:'retenue', objet:'Bavardages', texte:'' });`);
  const ids = () => evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`);
  const tous = ids();
  ev(`elevesFiltreToggle('incid')`);
  assert.deepStrictEqual(ids(), ['s2'], 'un incident dans la période');
  ev(`elevesFiltreToggle('sansBilan')`);
  assert.deepStrictEqual(ids(), ['s2'], 'cumulés : incident ET sans bilan du conseil');
  ev(`elevesFiltreToggle('incid')`);
  assert.ok(!ids().includes('s1') && ids().length === tous.length - 1, 'sans bilan : Léa sort');
  // Le papier le dit.
  assert.match(ev(`_elevesPrintHTML(S.classes['5C'])`), /filtre : sans bilan du conseil/);
  ev(`_elevesFiltres.clear()`);
  // Vues : un cran d'undo, la même préférence que ☰ Colonnes, reconnue ensuite.
  const u = ev(`undoStack.length`);
  ev(`elevesVueUI('papiers')`);
  assert.strictEqual(ev(`undoStack.length`), u + 1);
  assert.strictEqual(ev(`_elevesVueCourante()`), 'papiers');
  assert.ok(!ev(`_elevesColVue('carnet')`) && ev(`_elevesColVue('docs')`));
  ev(`elevesVueUI('papiers')`);
  assert.strictEqual(ev(`undoStack.length`), u + 1, 'déjà dans cette vue : rien n\'est empilé');
  ev(`elevesColToggle('carnet', true)`);
  assert.strictEqual(ev(`_elevesVueCourante()`), '', 'retouchée : personnalisée');
  ev(`elevesVueUI('tout')`);
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), []);
  // Avis : résumé par élève, sur la feuille la plus récente de la période courante.
  ev(`const c = avisCampagneCreer(S.classes['5C'], { pIdx: _carnetCurrentPeriodIdx(S.classes['5C']), disciplines: ['maths', 'anglais'] });
      c.avis = { s1: { maths: { travail: 'Bien', participation: 'Oui', comportement: 'Calme' }, anglais: { travail: 'Moyen' } } }; c.cibles = ['s2'];`);
  const r1 = evObj(`(() => { const r = _avisResume(_avisDeLaPeriode(S.classes['5C'], _carnetCurrentPeriodIdx(S.classes['5C'])), 's1'); return { n: r.n, total: r.total, pleins: r.disc.map(x => x.n) }; })()`);
  assert.deepStrictEqual(r1, { n: 2, total: 2, pleins: [1, 3] }, 'dans l\'ordre des onglets : anglais (langues) puis maths');
  ev(`elevesFiltreToggle('cible')`);
  assert.deepStrictEqual(ids(), ['s2'], 'avis demandés en particulier');
  ev(`_elevesFiltres.clear()`);
  const h = ev(`_avisCelluleHTML(S.classes['5C'], _avisDeLaPeriode(S.classes['5C'], _carnetCurrentPeriodIdx(S.classes['5C'])), 's1')`);
  assert.match(h, /<i class="p"><\/i><i class="f"><\/i>/, 'un trait partiel, un trait plein');
  assert.match(h, />2\/2</);
  // Tri : demandés d'abord, puis le plus d'avis.
  ev(`eleveSort = { col: 'avis', dir: 1 }`);
  assert.deepStrictEqual(ids().slice(0, 2), ['s2', 's1']);
  ev(`eleveSort = { col: 'nom', dir: 1 }`);
});

test('Carte de chaleur : une case par relevé, matière, discipline, papier, mois, bilan — tout échappé', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = '';`);
  const g = evObj(`(() => { const cls = getCls(); const bc = _bilanColonnesListe(cls, _carnetCurrentPeriodIdx(cls), new Set());
    return _chaleurGroupes(cls, bc).map(x => ({ key: x.key, n: x.sub.length })); })()`);
  assert.deepStrictEqual(g.map(x => x.key), ['carnet', 'mbn', 'obstot', 'moy', 'avis', 'docs', 'inc', 'ct', 'bil']);
  assert.ok(g.every(x => x.n > 0));
  // Un nom piégé ne passe pas en clair.
  ev(`const s = S.eleves[getCls().eleves[0]]; s.nom = '<img src=x onerror=alert(1)>'`);
  const html = evObj(`(() => { const cls = getCls(); return _elevesChaleurHTML(cls, _elevesRows(cls), []).table; })()`);
  assert.ok(!html.includes('<img src=x') && html.includes('&lt;img'));
  // Chaque case : [classe, texte, infobulle] ; le relevé d'un absent dit « absent ».
  const abs = evObj(`(() => { const cls = getCls(), m = _relMap(cls.id); for (const d of _relDates(cls.id)) for (const sid of cls.eleves) if (m[d].counts[sid] === 'A') return { d, sid }; return null; })()`);
  if (abs) assert.match(evObj(`_chaleurGroupes(getCls(), []).find(x => x.key === 'carnet')?.cell(${JSON.stringify(abs.sid)}, ${JSON.stringify(abs.d)})?.[2] || 'absent'`), /absent/);
  assert.deepStrictEqual(evObj(`_moisDe({ start: '2025-08-01', end: '2026-01-31' }).map(x => x[1])`), ['août', 'sept.', 'oct.', 'nov.', 'déc.', 'janv.']);
});

test('Liste : tri par prénom depuis l\'en-tête, réversible ; un ordre de place retombe sur le nom', () => {
  ev(FIXTURE);
  ev(`S.eleves.s3 = { id:'s3', nom:'ZORRO', prenom:'Abel', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s3'); _elevesFiltres = new Set(); _eleveFilter = '';`);
  ev(`eleveSort = { col: 'prenom', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.prenom)`), ['Abel', 'Léa', 'Noé']);
  ev(`sortEleves('prenom')`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.prenom)`), ['Noé', 'Léa', 'Abel']);
  assert.match(ev(`_elevesThNomHTML()`), /onclick="sortEleves\('nom'\)"[^>]*>Nom<\/button>.*onclick="sortEleves\('prenom'\)"[^>]*>Prénom</s);
  ev(`eleveSort = { col: 'place', dir: 1 }; (() => { const z = document.createElement('div'); const o = document.getElementById; document.getElementById = id => id === 'eleves-body' ? z : o.call(document, id); try { renderStudents(); } finally { document.getElementById = o; } })()`);
  assert.strictEqual(ev(`eleveSort.col`), 'nom');
});

test('Liste : retirer un moment de bilan — vide et ajouté : il disparaît ; avec des bilans : masqué (retenu), les bilans restent, ＋ le remet', () => {
  ev(FIXTURE);
  ev(`_bilanColsAjout = new Set(); _eleveFilter = ''; _elevesFiltres = new Set(); S.prefs.bilansMasques = []; undoStack.length = 0;
      bilanAdd('s1', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1 de Léa' });`);
  const vues = () => evObj(`_bilanColsVues(S.classes['5C'], _carnetCurrentPeriodIdx(S.classes['5C'])).map(c => c.key)`);
  const p = ev(`_carnetCurrentPeriodIdx(S.classes['5C'])`);
  const mois = p === 0 ? '2025-12' : '2026-03';   // un mois DE la période courante
  // Un point du mois ajouté pour la séance, encore vide : retiré sans trace (rien dans S).
  ev(`elevesBilanColAjout('bil:mois:${mois}')`);
  assert.ok(vues().includes(`bil:mois:${mois}`));
  const u = ev(`undoStack.length`);
  ev(`elevesBilanColRetirer('bil:mois:${mois}')`);
  assert.ok(!vues().includes(`bil:mois:${mois}`));
  assert.strictEqual(ev(`undoStack.length`), u, 'rien de durable : rien d\'empilé');
  // La mi-période porte un bilan : masquée, retenue, un cran d'undo ; le bilan reste.
  ev(`elevesBilanColRetirer('bil:miperiode:0')`);
  assert.ok(!vues().includes('bil:miperiode:0'));
  assert.deepStrictEqual(evObj(`S.prefs.bilansMasques`), ['bil:miperiode:0']);
  assert.strictEqual(ev(`undoStack.length`), u + 1);
  assert.strictEqual(ev(`_bilansOf('s1').length`), 1, 'le bilan est toujours là');
  assert.ok(!ev(`_elevesPrintHTML(S.classes['5C'])`).includes('Mi-S1'), 'pas sur le papier non plus');
  // v1.46.8 : la fiche ne suit plus 🗓 Moments mais la sélection de la carte de chaleur — le
  // moment retiré de la liste y reste proposé, et son bilan lisible.
  assert.ok(evObj(`_ficheMoments(S.classes['5C']).map(c => c.key)`).includes('bil:miperiode:0'), 'la fiche ne suit plus la liste');
  assert.ok(ev(`(() => { const cls = S.classes['5C'], col = _ficheMomentCourant(cls); return _ficheBilansAutresHTML(cls, S.eleves.s1, col); })()`).includes('Mi-S1 de Léa'), 'le bilan reste lisible dans la fiche');
  // Un conseil (toujours présent) remis par ＋ se retire d'UN seul clic (v1.46.1 : il en
  // fallait deux — le premier ne faisait que le sortir de l'ajout de la séance).
  ev(`elevesBilanColRetirer('bil:conseil:${p}'); elevesBilanColAjout('bil:conseil:${p}')`);
  assert.ok(vues().includes(`bil:conseil:${p}`));
  ev(`elevesBilanColRetirer('bil:conseil:${p}')`);
  assert.ok(!vues().includes(`bil:conseil:${p}`), 'un seul clic');
  ev(`elevesBilanColAjout('bil:conseil:${p}')`);
  // Aucun moment : pas de colonne Bilans dans la liste.
  assert.ok(!ev(`_elevesIndicHTML(S.classes['5C'], _elevesRows(S.classes['5C']), [], null)`).includes('el-c-bilans'));
  assert.ok(ev(`_elevesIndicHTML(S.classes['5C'], _elevesRows(S.classes['5C']), _bilanColsVues(S.classes['5C'], ${p}), null)`).includes('el-c-bilans'));
  // ＋ le remet.
  ev(`elevesBilanColAjout('bil:miperiode:0')`);
  assert.ok(vues().includes('bil:miperiode:0'));
  assert.deepStrictEqual(evObj(`S.prefs.bilansMasques`), []);
  assert.ok(p >= 0);
});

test('Point du mois : « de mars » mais « d\'avril », « d\'août », « d\'octobre »', () => {
  assert.deepStrictEqual(evObj(`['mars', 'avril', 'août', 'octobre', 'septembre'].map(_deMois)`), ['de mars', 'd\'avril', 'd\'août', 'd\'octobre', 'de septembre']);
  assert.strictEqual(ev(`_bilanLabel({ type: 'mois', date: '2026-04-10' })`), 'Point d\'avril');
});

test('Liste « Moments » : les moments de la colonne avec −, ceux qu\'on peut ajouter avec +, dans l\'ordre', () => {
  ev(FIXTURE);
  ev(`_bilanColsAjout = new Set(); S.prefs.bilansMasques = []; bilanAdd('s1', { date:'2025-11-20', type:'miperiode', texte:'Mi-S1' });`);
  const ms = evObj(`_elevesMoments(S.classes['5C'], 0)`);
  const vus = ms.filter(m => m.vu).map(m => m.key);
  assert.deepStrictEqual(vus, ['bil:miperiode:0', 'bil:conseil:0']);
  assert.strictEqual(ms.find(m => m.key === 'bil:miperiode:0').n, 1);
  assert.ok(ms.some(m => !m.vu && m.key === 'bil:mois:2025-10' && m.label === 'Point d\'octobre'), 'un mois à ajouter, bien élidé');
  const ordre = ms.map(m => m.key);
  assert.ok(ordre.indexOf('bil:mois:2025-10') < ordre.indexOf('bil:conseil:0'), 'le conseil au bout');
  const h = ev(`_elevesMomentsHTML(S.classes['5C'], 0)`);
  assert.match(h, /onclick="elevesBilanColRetirer\('bil:miperiode:0'\)"[^>]*>−</);
  assert.match(h, /onclick="elevesBilanColAjout\('bil:mois:2025-10'\)"[^>]*>\+</);
  // Retiré : il passe du côté « + ».
  ev(`elevesBilanColRetirer('bil:miperiode:0')`);
  assert.strictEqual(evObj(`_elevesMoments(S.classes['5C'], 0)`).find(m => m.key === 'bil:miperiode:0').vu, false);
});

test('Vue « Préparer le conseil » : la colonne Contacts y est ; qui avait l\'ancienne vue la retrouve avec les contacts', () => {
  ev(FIXTURE);
  ev(`elevesVueUI('conseil')`);
  assert.ok(ev(`_elevesColVue('contacts')`));
  assert.strictEqual(ev(`_elevesVueCourante()`), 'conseil');
  ev(`S.prefs.elevesColsOff = ['grp', 'docs', 'contacts']; postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), ['grp', 'docs']);
  assert.strictEqual(ev(`_elevesVueCourante()`), 'conseil');
  ev(`S.prefs.elevesColsOff = ['grp', 'contacts']; postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.prefs.elevesColsOff`), ['grp', 'contacts'], 'un réglage personnel n\'est pas touché');
  ev(`elevesVueUI('tout')`);
});
