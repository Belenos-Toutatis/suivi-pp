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

test('_periodePrintHTML : tableau paysage ou fiches portrait, blocs choisis, tout échappé', () => {
  ev(FIXTURE);
  ev(`S.eleves.s1.nom = 'DUR<b>AND'; bilanSet('s1', _bilansOf('s1')[0].id, { date:'2026-01-20', type:'conseil', texte:'<script>x' });`);
  const t = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs','bilan'], type:'conseil', forme:'tableau' })`);
  assert.strictEqual(t.kind, 'landscape');
  assert.ok(t.html.includes('Conseil de classe S1 — 5C — 2025-26'));
  assert.ok(t.html.includes('DUR&lt;b&gt;AND') && t.html.includes('&lt;script&gt;x'), 'échappé');
  assert.ok(!t.html.includes('<th>Incidents</th>') && t.html.includes('<th>Conseil</th>'), 'seuls les blocs cochés');
  const f = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['incidents','contacts'], type:'miperiode', forme:'fiches' })`);
  assert.strictEqual(f.kind, 'portrait');
  assert.ok(f.html.includes('Bilan de mi-période S1') && f.html.includes('class="print-fiche"'));
  assert.strictEqual((f.html.match(/class="print-fiche"/g) || []).length, 3, 'un bloc par élève présent');
  assert.ok(f.html.includes('Retenue S1') && !f.html.includes('Retenue S2'));
});
