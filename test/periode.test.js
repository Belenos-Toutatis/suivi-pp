// Synthèse de période — la feuille du conseil de classe. Tout y est BORNÉ à la période :
// c'est ce qui la distingue de la liste des élèves, et ce qu'il faut tenir.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre';
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[],groupe:1},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PARTI',prenom:'Tôt',classe_id:'5C',tags:[],departureDate:'2025-09-15'},
    s4:{id:'s4',nom:'ARRIVE',prenom:'Tard',classe_id:'5C',tags:[],arrivalDate:'2026-03-01'},
  };
  S.releves['5C'] = {
    '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1:7, s2:10 } },
    '2025-12-05': { date:'2025-12-05', ts:2, counts:{ s1:'A', s2:14 } },
    '2026-01-20': { date:'2026-01-20', ts:3, counts:{ s1:12, s2:15 } },
    '2026-04-10': { date:'2026-04-10', ts:4, counts:{ s1:20, s2:15, s4:3 } },
  };
  S.documents.d1 = { id:'d1', titre:'Fiche de rentrée', classIds:['5C'], dateDistribution:'2025-09-10', dateEcheance:null, suiviRetour:true, archive:false, ord:0, champs:[], retours:{ s2:{ rendu:true, dateRetour:'2025-09-20', reponses:{}, note:'' } } };
  S.documents.d2 = { id:'d2', titre:'Orientation', classIds:['5C'], dateDistribution:'2026-02-15', dateEcheance:null, suiviRetour:true, archive:false, ord:1, champs:[], retours:{} };
  S.documents.d3 = { id:'d3', titre:'Info seule', classIds:['5C'], dateDistribution:'2025-09-10', dateEcheance:null, suiviRetour:false, archive:false, ord:2, champs:[], retours:{} };
  incidentAdd('s1', { date:'2025-11-18', type:'retenue', objet:'Retenue S1', texte:'' });
  incidentAdd('s1', { date:'2026-02-01', type:'retenue', objet:'Retenue S2', texte:'' });
  journalAdd('s1', '2026-01-31', 'appel', 'Appel S1 dernier jour');
  journalAdd('s1', '2026-02-01', 'appel', 'Appel S2 premier jour');
  bilanAdd('s1', { date:'2026-01-20', type:'conseil', texte:'Conseil S1' });
  bilanAdd('s2', { date:'2025-11-15', type:'miperiode', texte:'Mi S1 de Noé' });`;

test('_periodeSynthese : tout est borné à la période — élèves présents, relevés, incidents, contacts, papiers', () => {
  ev(FIXTURE);
  const s1 = evObj(`_periodeSynthese(S.classes['5C'], 0)`);
  assert.strictEqual(s1.periode.label, 'S1');
  assert.strictEqual(s1.nbReleves, 3, 'trois relevés dans S1');
  assert.deepStrictEqual(s1.rows.map(r => r.sid), ['s1', 's2', 's3'], 'parti en septembre : présent pendant S1 ; arrivé en mars : pas encore là');
  assert.strictEqual(s1.rows.find(r => r.sid === 's3').parti, '2025-09-15', 'et la feuille dit quand il est parti');
  const l = s1.rows.find(r => r.sid === 's1');
  // Cumul en FIN de période (pas le dernier de l'année), total de la période, absences aux relevés.
  assert.deepStrictEqual([l.cumulFin, l.cumulFinDate, l.totalPeriode, l.absents], [12, '2026-01-20', 12, 1]);
  assert.deepStrictEqual(l.incidents.map(e => e.objet), ['Retenue S1']);
  assert.deepStrictEqual(l.contacts.map(e => e.texte), ['Appel S1 dernier jour'], 'le 31/01 est dans S1, le 01/02 non');
  assert.deepStrictEqual(l.nonRendus, ['Fiche de rentrée'], 'distribuée avant la fin de S1 et pas rendue ; Orientation (février) et Info seule (sans suivi) non');
  assert.strictEqual(l.bilan.texte, 'Conseil S1');
  const n = s1.rows.find(r => r.sid === 's2');
  assert.deepStrictEqual([n.nonRendus, n.bilan.texte, n.bilan.type], [[], 'Mi S1 de Noé', 'miperiode'], 'rendu → rien ; pas de conseil → le bilan de mi-période');
  // S2 : l'arrivé de mars est là, le total repart du dernier cumul d'avant la période.
  const s2 = evObj(`_periodeSynthese(S.classes['5C'], 1)`);
  assert.deepStrictEqual(s2.rows.map(r => r.sid), ['s1', 's2', 's4']);
  const l2 = s2.rows.find(r => r.sid === 's1');
  assert.deepStrictEqual([l2.cumulFin, l2.totalPeriode, l2.incidents.length, l2.contacts.length, l2.nonRendus], [20, 8, 1, 1, ['Fiche de rentrée', 'Orientation']]);
  assert.strictEqual(s2.rows.find(r => r.sid === 's4').arrive, '2026-03-01');
  assert.strictEqual(evObj(`_periodeSynthese(S.classes['5C'], 5)`), null);
});

test('_periodePrintHTML : tableau paysage, blocs choisis, tout échappé ; les fiches bornées au moment', () => {
  ev(FIXTURE);
  ev(`S.eleves.s1.nom = 'DUR<b>AND'; bilanSet('s1', _bilansOf('s1')[0].id, { date:'2026-01-20', type:'conseil', texte:'<script>x' });`);
  const t = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs','bilan'], type:'conseil', forme:'tableau' })`);
  assert.strictEqual(t.kind, 'landscape');
  assert.ok(t.html.includes('Conseil de classe S1 — 5C — 2025-26'));
  assert.ok(t.html.includes('DUR&lt;b&gt;AND') && t.html.includes('&lt;script&gt;x'), 'échappé');
  assert.ok(!t.html.includes('<th>Incidents</th>') && t.html.includes('<th>Conseil</th>'), 'seuls les blocs cochés');
  // Les « résumés » (un bloc court par élève) sont retirés en v1.50.0 : les fiches sont la fiche élève imprimée.
  const f = evObj(`(() => { const cls = S.classes['5C'], col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const ids = _fichePrintEleves(cls, col); return { ids, html: ids.map(id => _fichePrintHTML(cls, id, col, { parts: ['incidents', 'contacts'] }, null)).join('') }; })()`);
  assert.strictEqual((f.html.match(/class="fp-page"/g) || []).length, f.ids.length, 'une page par élève présent');
  assert.ok(f.html.includes('Retenue S1') && !f.html.includes('Retenue S2'));
});

// ─────────────────────────────────────────────── Moyennes sur la feuille de période

const MOY = (per, lignes) => `Nom et prénom de l'élève;Périodes;MATHEMATIQUES(M. X);PHYSIQUE-CHIMIE(M. Y);Moy.\n` + lignes.map(l => `${l[0]};${per};${l[1]};${l[2]};${l[3]}`).join('\n');
const impMoy = (csv, date) => ev(`(() => { const p = _moyParse(${JSON.stringify(csv)});
  return moyImport('5C', p, _moyMatch(p, '5C', {}), { date: ${JSON.stringify(date)} }); })()`);

test('⚠️ Feuille du S1 : le DERNIER import du S1, même exporté en février, après la fin de la période', () => {
  ev(FIXTURE);
  impMoy(MOY('Premier semestre', [['DURAND Léa', 12, 9, 11], ['MARTIN Noé', 8, 7, '7,5']]), '2025-10-01');
  impMoy(MOY('Premier semestre', [['DURAND Léa', 13, 8, '11,8'], ['MARTIN Noé', 9, 'Abs', 9]]), '2026-02-03');
  const syn = evObj(`_periodeSynthese(S.classes['5C'], 0)`);
  assert.deepStrictEqual(syn.moyennes, { periode: 'Premier semestre', date: '2026-02-03', premier: '2025-10-01', nbImports: 2 });
  const l = syn.rows.find(r => r.sid === 's1').moyennes;
  assert.strictEqual(l.generale, 11.8, 'la générale du dernier import (03/02), pas celle d\'octobre');
  assert.deepStrictEqual(l.delta, { delta: 0.8, depuis: '2025-10-01' }, 'évolution depuis le PREMIER import de la période');
  assert.deepStrictEqual(l.sous10.map(x => [x.nom, x.v]), [['Phys.-chimie', 8]]);
  const n = syn.rows.find(r => r.sid === 's2').moyennes;
  assert.deepStrictEqual(n.notes.map(x => x.v), [9, 'Abs'], 'un code reste un code, et n\'est pas « sous 10 »');
  assert.deepStrictEqual(n.sous10.map(x => x.v), [9]);
  assert.strictEqual(syn.rows.find(r => r.sid === 's3').moyennes, null, 'absent de l\'import : rien');
});

test('⚠️ Feuille du S2 : les moyennes du S1 exportées en février n\'y apparaissent PAS', () => {
  ev(FIXTURE);
  impMoy(MOY('Premier semestre', [['DURAND Léa', 12, 9, 11]]), '2025-12-01');
  impMoy(MOY('Premier semestre', [['DURAND Léa', 13, 8, 12]]), '2026-02-03');
  assert.strictEqual(evObj(`_periodeSynthese(S.classes['5C'], 1)`).moyennes, null, 'le S2 n\'a pas encore d\'import à lui');
  assert.strictEqual(evObj(`_periodeSynthese(S.classes['5C'], 1)`).rows.find(r => r.sid === 's1').moyennes, null);
  impMoy(MOY('Second semestre', [['DURAND Léa', 15, 14, '14,5'], ['ARRIVE Tard', 10, 10, 10]]), '2026-03-20');
  const s2 = evObj(`_periodeSynthese(S.classes['5C'], 1)`);
  assert.strictEqual(s2.moyennes.periode, 'Second semestre');
  const l = s2.rows.find(r => r.sid === 's1').moyennes;
  assert.strictEqual(l.generale, 14.5);
  assert.strictEqual(l.delta, null, 'un seul import dans la période : pas d\'évolution, et surtout pas depuis le S1');
});

test('_periodePrintHTML : le bloc Moyennes, sous 10 en gras, échappé, et dit quand rien n\'est importé', () => {
  ev(FIXTURE);
  const vide = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['moy'], type:'conseil', forme:'tableau' })`);
  assert.ok(vide.html.includes('<th>Moyenne</th>') && vide.html.includes('aucune moyenne importée pour cette période'));
  impMoy(MOY('Premier <img src=x>', [['DURAND Léa', 13, 8, '11,8']]), '2025-11-01');
  const t = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['moy'], type:'conseil', forme:'tableau' })`);
  assert.ok(t.html.includes('<span class="pp-big">11,8</span>'));
  assert.ok(t.html.includes('&lt; 10 : <strong>Phys.-chimie 8</strong>'), 'la matière sous 10 en gras, jamais en couleur');
  assert.ok(!t.html.includes('<img'), 'le nom de période venu du fichier est échappé');
  const f = ev(`(() => { const cls = S.classes['5C'], col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const sid = cls.eleves.find(id => S.eleves[id].nom === 'DURAND'); return _fichePrintHTML(cls, sid, col, { parts: ['moy'] }, null); })()`);
  assert.ok(f.includes('<td>Maths</td><td class="r">13</td>') && f.includes('<td>Phys.-chimie</td><td class="r"><strong>8</strong></td>'), 'en fiche : toutes les matières, sous 10 en gras');
  const sans = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs'], type:'conseil', forme:'tableau' })`);
  assert.ok(!sans.html.includes('<th>Moyenne</th>') && !sans.html.includes('moyennes'), 'bloc décoché : ni colonne ni mention');
});

// ─────────────────────────────────────────────── Une page : la taille de texte se calcule

test('_printFitSize : la plus grande taille qui tient, au quart de point, et l\'aveu quand rien ne tient', () => {
  // Hauteur rendue proportionnelle à la taille : 100 px par point.
  const lin = `pt => pt * 100`;
  assert.deepStrictEqual(evObj(`_printFitSize(${lin}, 2000, 6, 10.5)`), { size: 10.5, fits: true, pages: 1 }, 'tout tient au maximum : on ne grossit pas au-delà');
  assert.deepStrictEqual(evObj(`_printFitSize(${lin}, 820, 6, 10.5)`), { size: 8, fits: true, pages: 1 }, '8,2 → 8 : arrondi vers le BAS, sinon ça déborde');
  const r = evObj(`_printFitSize(${lin}, 820, 6, 10.5)`);
  assert.ok(r.size * 100 <= 820);
  assert.deepStrictEqual(evObj(`_printFitSize(${lin}, 250, 6, 10.5)`), { size: 6, fits: false, pages: 3 }, 'sous le plancher : on le dit, on ne descend pas');
});

test('_printPageMm : surface imprimable A4 et A3, marges comprises', () => {
  assert.deepStrictEqual(evObj(`_printPageMm('A4', 'landscape')`), { w: 273, h: 186 });
  assert.deepStrictEqual(evObj(`_printPageMm('A3', 'landscape')`), { w: 396, h: 273 });
  assert.deepStrictEqual(evObj(`_printPageMm('A4', 'portrait')`), { w: 180, h: 267 });
  assert.deepStrictEqual(evObj(`_printPageMm('??', 'landscape')`), { w: 273, h: 186 }, 'format inconnu : A4');
});

test('Tableau de période : colonnes de largeur fixe, qui somment à 100 %, une par bloc coché', () => {
  ev(FIXTURE);
  const t = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs','bilan'], type:'conseil', forme:'tableau' })`);
  assert.ok(t.html.includes('class="pp-t"'));
  const w = [...t.html.matchAll(/<col style="width:([\d.]+)%">/g)].map(m => +m[1]);
  assert.strictEqual(w.length, 4, 'élève, identité, observations, conseil');
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 100) < 0.05);
  assert.ok(w[3] > w[2], 'le texte libre du conseil a plus de place qu\'une colonne de chiffres');
  assert.strictEqual((t.html.match(/<th>/g) || []).length, 4);
});

// Paliers du carnet (v1.38.1) : S1 → s1 finit à 12 (2e cran), s2 à 15 (3e cran).
test('Synthèse de période : le cumul de fin de période porte la couleur de son palier', () => {
  ev(FIXTURE);
  const t = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs'], type:'conseil', forme:'tableau' })`);
  assert.match(t.html, /<span class="ob-chip ob-2">12<\/span>/);
  assert.match(t.html, /<span class="ob-chip ob-3">15<\/span>/);
  assert.match(t.html, /ob-leg/, 'la légende est au sous-titre');
  // Palier à 0 : ni couleur ni légende. Bloc des observations décoché : pas de légende.
  ev(`S.prefs.obsPalier = 0`);
  const nu = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs'], type:'conseil', forme:'tableau' })`);
  assert.ok(!/ob-chip|ob-leg/.test(nu.html));
  ev(`S.prefs.obsPalier = 5`);
  const sans = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['bilan'], type:'conseil', forme:'tableau' })`);
  assert.ok(!/ob-leg/.test(sans.html));
});
