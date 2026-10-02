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

// _syntheseRow.moyenne : assemblage de ce que l'onglet Moyennes calcule déjà — testé
// ici seulement pour l'ASSEMBLAGE (dernier import, delta, sous10), pas pour
// l'arithmétique elle-même (voir test/moyennes.test.js).
const CSV_M1 = "Nom et prénom de l'élève;Périodes;MATHEMATIQUES;Moy.\nDURAND Léa;Premier semestre;12;12\nMARTIN Noé;Premier semestre;8;8";
const CSV_M2 = "Nom et prénom de l'élève;Périodes;MATHEMATIQUES;PHYSIQUE-CHIMIE;Moy.\nDURAND Léa;Premier semestre;15;9;12\nMARTIN Noé;Premier semestre;5;4;4,5";
const impMoy = (csv, date) => ev(`(() => { const p = _moyParse(${JSON.stringify(csv)});
  const m = _moyMatch(p, '5C', {});
  return moyImport('5C', p, m, { date: ${JSON.stringify(date)} }); })()`);

test('_syntheseRow.moyenne : dernier import, delta depuis le précédent de la période, sous10', () => {
  ev(FIXTURE);
  impMoy(CSV_M1, '2025-10-01');
  impMoy(CSV_M2, '2025-11-05');
  const r1 = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s1)`);
  assert.strictEqual(r1.moyenne.generale, 12, 'moyenne générale du DERNIER import');
  assert.strictEqual(r1.moyenne.delta, 0, 'inchangée depuis le premier import (12 → 12)');
  assert.strictEqual(r1.moyenne.sous10, 1, 'PHYSIQUE-CHIMIE à 9 est sous 10, MATHEMATIQUES à 15 non');
  const r2 = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s2)`);
  assert.strictEqual(r2.moyenne.generale, 4.5);
  assert.strictEqual(r2.moyenne.delta, -3.5);
  assert.strictEqual(r2.moyenne.sous10, 2, 'les deux matières sont sous 10');
});

test('_syntheseRow.moyenne : null pour un élève absent de tous les imports', () => {
  ev(FIXTURE);
  impMoy(CSV_M1, '2025-10-01');
  impMoy(CSV_M2, '2025-11-05');
  const r3 = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s3)`);
  assert.strictEqual(r3.moyenne, null);
});

test('_elevesRows : par moyenne, la plus BASSE d\'abord au premier clic, les sans-moyenne en fin', () => {
  ev(FIXTURE);
  impMoy(CSV_M1, '2025-10-01');
  impMoy(CSV_M2, '2025-11-05');
  ev(`_eleveFilter = ''; eleveSort = { col: 'moy', dir: 1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s2', 's1', 's3']);
  ev(`eleveSort = { col: 'moy', dir: -1 }`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1', 's2', 's3'], 'inversé, s3 sans moyenne reste en fin');
  ev(`eleveSort = { col: 'nom', dir: 1 }`);
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

test('liste des élèves : la case Incidents ouvre la saisie d\'une entrée, comme la remarque ; la dernière entrée s\'ouvre en modification', () => {
  // Demande de l'utilisateur (2026-09-11) : « comme pour les remarques, je dois pouvoir
  // cliquer sur la case incident pour en saisir un ». On capture le HTML rendu en
  // détournant getElementById le temps du rendu.
  ev(FIXTURE);
  ev(`_eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 };`);
  const capture = () => ev(`(() => {
    const zone = document.createElement('div'); const orig = document.getElementById;
    document.getElementById = id => id === 'eleves-body' ? zone : orig.call(document, id);
    try { renderStudents(); } finally { document.getElementById = orig; }
    return zone.innerHTML; })()`);
  let html = capture();
  // Sans entrée : un bouton ⚖️ qui ouvre la saisie d'une NOUVELLE entrée pour cet élève.
  // v1.44.2 : un point quand il n'y a rien — il ouvre la saisie d'une NOUVELLE entrée.
  assert.ok(/onclick="openIncident\('s2'\)"[^>]*>·<\/button>/.test(html), 'bouton de saisie sur un élève sans incident');
  assert.ok(!html.includes(`openIncident('s2','`), 'rien à modifier chez s2');
  // Avec une entrée : le compteur sur le bouton, et la dernière entrée cliquable vers sa modification.
  ev(`incidentAdd('s1', { date:'2025-12-03', type:'retenue', objet:'Bavardages', texte:'' });
      incidentAdd('s1', { date:'2026-01-15', type:'commission_educative', objet:'Récidive', texte:'Décision : tutorat' });`);
  html = capture();
  assert.ok(/onclick="openIncident\('s1'\)"[^>]*>⚖ 2<\/button>/.test(html), 'le nombre d\'entrées sur le bouton');
  const id = evObj(`_incidentsOf('s1')[0].id`);
  assert.strictEqual(evObj(`_incidentsOf('s1')[0].date`), '2026-01-15', 'la plus récente d\'abord');
  assert.ok(html.includes(`openIncident('s1','${id}')`), 'la dernière entrée s\'ouvre en modification');
  // La date du dernier (sans l'année) ; l'instance et l'objet sont dans l'infobulle.
  assert.ok(/title="Commission éducative : Récidive — clic pour modifier cette entrée">15\/01</.test(html), 'date et instance de la dernière entrée');
});

test('Liste des élèves imprimée : feuille .pp-t, colonnes fixes à 100 %, en-tête répétable, taille fixe', () => {
  ev(FIXTURE);
  ev(`_eleveFilter = ''; eleveSort = { col: 'nom', dir: 1 }; S.eleves.s1.nom = 'DUR<b>AND';`);
  const html = ev(`_elevesPrintHTML(S.classes['5C'])`);
  assert.ok(html.includes('class="pp-t pp-el"'));
  assert.ok(html.includes('<thead>'), 'l\'en-tête en thead : il se répète en haut de chaque page');
  const w = [...html.matchAll(/<col style="width:([\d.]+)%">/g)].map(m => +m[1]);
  assert.strictEqual(w.length, 11);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 100) < 0.05);
  assert.ok(html.includes('DUR&lt;b&gt;AND') && !html.includes('DUR<b>AND'), 'échappé');
  // ⚠️ Pas d'ajustement à une page : la taille est fixe (arbitré par l'utilisateur).
  assert.strictEqual(ev(`_ELEVES_PRINT_PT`), 8.5);
  assert.ok(!/function printEleves[\s\S]{0,300}_printFitMeasure/.test(ev(`printEleves.toString()`)), 'printEleves ne mesure pas');
});
