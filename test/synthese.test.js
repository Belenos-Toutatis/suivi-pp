// Synthèse — une ligne par élève, tout ce qui est connu. Le calcul de la ligne est pur :
// c'est lui que l'écran ET l'impression reprennent.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre';
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 }; S.cur = '5C';
  const t = createTag('LATIN', 'Latin');
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[t.id],civilite:'F',groupe:1,pap:true,tiers_temps:true,remarque:'Appel le 11/10'},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PARTI',prenom:'X',classe_id:'5C',tags:[],departureDate:'2025-09-01'},
  };
  S.releves['5C'] = { '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1:7, s2:10 } }, '2025-11-05': { date:'2025-11-05', ts:2, counts:{ s1:12, s2:'A' } } };
  S.documents.d1 = { id:'d1', titre:'Devoirs Faits', classIds:['5C'], dateDistribution:'2025-09-15', dateEcheance:null, suiviRetour:true, archive:false, ord:0,
    champs:[{ id:'df', label:'Participation', type:'choix', par:'famille', obligatoire:true, options:[{id:'oui',label:'OUI',color:'#16a085'},{id:'non',label:'NON',color:'#c0392b'}] }],
    retours:{ s1:{ rendu:true, dateRetour:'2025-09-20', reponses:{ df:'oui' }, note:'' } } };
  S.documents.d2 = { id:'d2', titre:'Fiche archivée', classIds:['5C'], dateDistribution:'2025-09-15', dateEcheance:null, suiviRetour:true, archive:true, ord:1, champs:[], retours:{} };
  const el = electionCreate('5C', { date:'2025-10-07' }); electionAddCandidat(el, 's1', 's2');
  electionAddBulletin(el, 0, [el.candidats[0].id]); electionAddBulletin(el, 0, [el.candidats[0].id]); electionCloreTour(el, 0);`;

test('_syntheseRow rassemble carnet, documents, réponses, délégué, aménagements, remarque', () => {
  ev(FIXTURE);
  const r = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s1)`);
  assert.strictEqual(r.cumul, 12); assert.strictEqual(r.cumulDate, '2025-11-05');
  assert.strictEqual(r.delta, 5); assert.strictEqual(r.deltaDecroissant, false);
  assert.strictEqual(r.periodeLabel, 'S1'); assert.strictEqual(r.periodeTotal, 12);
  assert.deepStrictEqual(r.nonRendus, []);
  assert.deepStrictEqual(r.reponses, [{ doc: 'Devoirs Faits', champ: 'Participation', par: 'famille', valeurs: ['OUI'] }]);
  assert.strictEqual(r.delegue, 'titulaire');
  assert.strictEqual(r.amenagements, 'PAP+⅓');
  assert.deepStrictEqual(r.options, ['LATIN']);
  assert.strictEqual(r.remarque, 'Appel le 11/10');
});

test('_syntheseRow : un A au dernier relevé remonte au cumul chiffré précédent', () => {
  ev(FIXTURE);
  const r = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s2)`);
  assert.strictEqual(r.cumul, 10); assert.strictEqual(r.cumulDate, '2025-10-01');
  assert.strictEqual(r.delta, 10);                       // premier relevé : delta = cumul
  assert.deepStrictEqual(r.nonRendus, ['Devoirs Faits']);
  assert.strictEqual(r.delegue, 'suppleant');
});

test('_syntheseRow : documents archivés ignorés, élève parti non attendu', () => {
  ev(FIXTURE);
  const rows = evObj(`_syntheseRows(S.classes['5C'])`);
  assert.strictEqual(rows.length, 3);
  const s3 = rows.find(r => r.sid === 's3');
  assert.strictEqual(s3.actif, false);
  assert.deepStrictEqual(s3.nonRendus, []);              // parti avant la distribution : pas attendu
  assert.ok(rows.every(r => !r.nonRendus.includes('Fiche archivée')));
  assert.strictEqual(s3.cumul, null);
});

test('_elevesRows : par Δ décroissant au premier clic, les inconnus en fin ; le tri des non-rendus ; par nom', () => {
  // Depuis la fusion de la Synthèse dans la liste des élèves (v1.23.0), c'est _elevesRows
  // qui trie — pour l'écran et pour l'impression.
  ev(FIXTURE);
  ev(`eleveSort = { col: 'delta', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s2', 's1', 's3']);
  ev(`eleveSort = { col: 'delta', dir: -1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1', 's2', 's3'], 'inversé, les inconnus restent en fin');
  ev(`eleveSort = { col: 'docs', dir: 1 }`);
  assert.strictEqual(evObj(`_elevesRows(S.classes['5C'])[0].s.id`), 's2');
  ev(`eleveSort = { col: 'nom', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1', 's2', 's3']);
  // Le filtre de la liste s'applique aussi.
  ev(`_eleveFilter = 'DUR'`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1']);
  ev(`_eleveFilter = ''`);
});
