// Impression d'un document — choix des colonnes, filtre des lignes, orientation.
//
// Calcul PUR : ce qui part sur le papier se vérifie ICI, pas en regardant un aperçu.
// Une feuille de suivi mal composée ne se découvre autrement qu'imprimée, c'est-à-dire
// trop tard — et le tableau d'un document est le plus large de l'app.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Les trois formes réelles : la fiche d'orientation (champs famille + avis PP), la fiche
// de renseignement (deux classes, aucun champ), le règlement (aucun suivi de retour).
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4'], ord:0 };
  S.classes['5D'] = { id:'5D', nom:'5D', annee:'2025-26', eleves:['s5'], ord:1 };
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PETIT',prenom:'Inès',classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'ROUX',prenom:'Sami',classe_id:'5C',tags:[], departureDate:'2025-09-10'},   // parti AVANT la distribution de d1
    s5:{id:'s5',nom:'ZOLA',prenom:'Ana',classe_id:'5D',tags:[]},
  };
  S.cur = '5C';
  S.documents.d1 = { id:'d1', titre:'Fiche d\\'orientation', classIds:['5C'], dateDistribution:'2025-09-15', dateEcheance:'2025-09-30',
    suiviRetour:true, archive:false, ord:0,
    champs:[
      { id:'opt1', label:'Option 1', type:'choix', par:'famille', obligatoire:true,  options:[{id:'latin',label:'LATIN',color:'#16a085'},{id:'bil',label:'BILINGUE',color:'#c0392b'}] },
      { id:'opts', label:'Autres',   type:'multi', par:'famille', obligatoire:false, options:[{id:'dnl',label:'DNL',color:'#2c3e50'},{id:'catho',label:'CATHO F',color:'#95a5a6'}] },
      { id:'avis', label:'Avis PP',  type:'choix', par:'prof',    obligatoire:true,  options:[{id:'fav',label:'Favorable',color:'#27ae60'},{id:'res',label:'Réservé',color:'#e67e22'}] },
    ],
    retours:{
      s1:{ rendu:true,  dateRetour:'2025-09-20', reponses:{ opt1:'latin', opts:['dnl'] }, note:'' },
      s2:{ rendu:true,  dateRetour:'2025-09-22', reponses:{}, note:'illisible, à relancer' },   // rendu SANS réponse
      s3:{ rendu:false, dateRetour:null,         reponses:{ opt1:'bil' }, note:'' },            // réponse AVANT le papier
    } };
  S.documents.d2 = { id:'d2', titre:'Fiche de renseignement', classIds:['5C','5D'], dateDistribution:'2025-09-02', dateEcheance:null,
    suiviRetour:true, archive:false, ord:1, champs:[], retours:{ s1:{rendu:true,dateRetour:'2025-09-03',reponses:{},note:''} } };
  S.documents.d3 = { id:'d3', titre:'Règlement', classIds:['5C'], dateDistribution:'2025-09-02', dateEcheance:null,
    suiviRetour:false, archive:false, ord:2, champs:[], retours:{} };`;

test('_docPrintColumns : l\'élève est fixe, les autres colonnes suivent le document', () => {
  ev(FIXTURE);
  const c1 = evObj(`_docPrintColumns(S.documents.d1)`);
  // Une seule classe → pas de colonne Classe. Retour suivi → Rendu + Date.
  assert.deepStrictEqual(c1.map(c => c.key), ['eleve', 'rendu', 'date', 'ch:opt1', 'ch:opts', 'ch:avis', 'note']);
  assert.strictEqual(c1[0].fixe, true);
  assert.strictEqual(c1.find(c => c.key === 'ch:avis').prof, true);   // le champ du PP est signalé
  assert.ok(!c1.find(c => c.key === 'ch:opt1').prof);
  // Deux classes → la colonne Classe apparaît : sans elle, deux homonymes ne se distinguent plus.
  assert.ok(evObj(`_docPrintColumns(S.documents.d2)`).some(c => c.key === 'classe'));
  // ⚠️ Pas de suivi du retour → ni Rendu ni Date. Une case à cocher pour un papier qu'on
  // ne ramasse pas ferait courir après ce qui n'existe pas.
  assert.deepStrictEqual(evObj(`_docPrintColumns(S.documents.d3)`).map(c => c.key), ['eleve', 'note']);
});

test('_docPrintKeys : sélection absente = tout, clés inconnues écartées, colonne fixe rétablie', () => {
  ev(FIXTURE);
  assert.deepStrictEqual([...ev(`_docPrintKeys(S.documents.d1, null)`)],
    ['eleve', 'rendu', 'date', 'ch:opt1', 'ch:opts', 'ch:avis', 'note']);
  // L'ordre du TABLEAU prime sur celui de la sélection : une feuille dont les colonnes ne
  // sont pas dans l'ordre de l'écran ne se relit pas à côté de lui.
  assert.deepStrictEqual([...ev(`_docPrintKeys(S.documents.d1, ['note','ch:opt1'])`)], ['eleve', 'ch:opt1', 'note']);
  // ⚠️ Une clé morte — champ supprimé entre deux impressions — ferait une colonne vide et
  // sans titre. Et « eleve » revient même quand la sélection ne la porte pas.
  assert.deepStrictEqual([...ev(`_docPrintKeys(S.documents.d1, ['ch:disparu','date'])`)], ['eleve', 'date']);
  assert.deepStrictEqual([...ev(`_docPrintKeys(S.documents.d1, [])`)], ['eleve']);
});

test('_docPrintOrientation : le paysage à partir de six colonnes', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_docPrintOrientation(5)`), 'portrait');
  assert.strictEqual(ev(`_docPrintOrientation(6)`), 'landscape');
  // La fiche d'orientation complète fait 7 colonnes : paysage, sans qu'on ait à y penser.
  assert.strictEqual(ev(`_docPrintOrientation(_docPrintKeys(S.documents.d1, null).length)`), 'landscape');
});

test('_docPrintCell : ✓ / ☐ pour le retour, les LIBELLÉS des options, rien pour un champ inconnu', () => {
  ev(FIXTURE);
  const cell = (doc, sid, k) => ev(`_docPrintCell(S.documents.${doc}, S.eleves.${sid}, '${k}')`);
  assert.strictEqual(cell('d1', 's1', 'eleve'), 'DURAND Léa');
  // ⚠️ ☐ et non « non » : la feuille sort souvent AVANT le ramassage et se coche au stylo.
  assert.strictEqual(cell('d1', 's1', 'rendu'), '✓');
  assert.strictEqual(cell('d1', 's3', 'rendu'), '☐');
  assert.strictEqual(cell('d1', 's1', 'date'), '20/09/2025');
  assert.strictEqual(cell('d1', 's3', 'date'), '');                    // pas rendu → pas de date
  assert.strictEqual(cell('d1', 's2', 'note'), 'illisible, à relancer');
  // Les réponses sortent en clair : un identifiant d'option ne dit rien sur du papier.
  assert.strictEqual(cell('d1', 's1', 'ch:opt1'), 'LATIN');
  assert.strictEqual(cell('d1', 's1', 'ch:opts'), 'DNL');              // choix multiple
  assert.strictEqual(cell('d1', 's2', 'ch:opt1'), '');                 // rendu, mais rien de coché
  assert.strictEqual(cell('d1', 's1', 'ch:disparu'), '');
  assert.strictEqual(cell('d2', 's5', 'classe'), '5D');
});

test('_docPrintCell : un choix multiple porte TOUTES les options cochées', () => {
  ev(FIXTURE);
  ev(`docToggleReponse(S.documents.d1, 's1', 'opts', 'catho')`);
  assert.strictEqual(ev(`_docPrintCell(S.documents.d1, S.eleves.s1, 'ch:opts')`), 'DNL, CATHO F');
});

test('_docPrintFiltres : on n\'offre que ce que le document permet', () => {
  ev(FIXTURE);
  assert.deepStrictEqual([...ev(`_docPrintFiltres(S.documents.d1).map(f => f.key)`)], ['tous', 'manquants', 'sansReponse']);
  // d2 n'a aucun champ : « réponse manquante » n'aurait aucun sens.
  assert.deepStrictEqual([...ev(`_docPrintFiltres(S.documents.d2).map(f => f.key)`)], ['tous', 'manquants']);
  // d3 ne suit pas le retour : « pas rendu » n'en a pas non plus.
  assert.deepStrictEqual([...ev(`_docPrintFiltres(S.documents.d3).map(f => f.key)`)], ['tous']);
});

test('_docPrintRows : les élèves ATTENDUS, dans l\'ordre du tri — jamais le roster brut', () => {
  ev(FIXTURE);
  const r = evObj(`_docPrintRows(S.documents.d1, ['eleve','rendu'], { filtre:'tous', sort:'nom' })`);
  // s4 est parti avant la distribution : il n'a jamais eu ce papier, on ne l'imprime pas.
  assert.deepStrictEqual(r.map(x => x.sid), ['s1', 's2', 's3']);
  assert.deepStrictEqual(r[0].cells, ['DURAND Léa', '✓']);
  // Le tri par prénom donne Inès, Léa, Noé : la feuille suit ce qu'on a à l'écran.
  assert.deepStrictEqual(evObj(`_docPrintRows(S.documents.d1, ['eleve'], { filtre:'tous', sort:'prenom' })`).map(x => x.sid),
    ['s3', 's1', 's2']);
  // ⚠️ Un tri ne perd JAMAIS un élève, ici comme dans les quatre grilles.
  assert.strictEqual(evObj(`_docPrintRows(S.documents.d1, ['eleve'], { sort:'pat-inconnu' })`).length, 3);
});

test('_docPrintRows : les filtres réduisent les LIGNES, jamais les colonnes', () => {
  ev(FIXTURE);
  const ids = (doc, f) => evObj(`_docPrintRows(S.documents.${doc}, ['eleve','rendu'], { filtre:'${f}' })`).map(x => x.sid);
  assert.deepStrictEqual(ids('d1', 'manquants'), ['s3']);
  // s2 a rendu sans rien cocher, s3 a répondu sans rendre : les deux axes restent indépendants.
  assert.deepStrictEqual(ids('d1', 'sansReponse'), ['s2']);
  assert.strictEqual(evObj(`_docPrintRows(S.documents.d1, ['eleve','rendu'], { filtre:'manquants' })`)[0].cells.length, 2);
});

test('_docPrintRows : un filtre INDISPONIBLE replie sur « tous », jamais sur une page vide', () => {
  ev(FIXTURE);
  // ⚠️ d3 ne suit pas le retour : sa liste de manquants est vide PAR CONSTRUCTION. Prendre
  // le filtre au mot rendrait zéro ligne, et on chercherait la panne du côté de la classe.
  assert.strictEqual(evObj(`_docPrintRows(S.documents.d3, ['eleve'], { filtre:'manquants' })`).length, 4);
  assert.strictEqual(evObj(`_docPrintRows(S.documents.d1, ['eleve'], { filtre:'nimporte' })`).length, 3);
});

test('_docPrintRows : deux classes → la classe range d\'abord, et la colonne le dit', () => {
  ev(FIXTURE);
  const r = evObj(`_docPrintRows(S.documents.d2, ['eleve','classe'], { filtre:'tous' })`);
  assert.deepStrictEqual(r.map(x => x.cells[1]), ['5C', '5C', '5C', '5C', '5D']);
  assert.deepStrictEqual(r.map(x => x.sid), ['s1', 's2', 's3', 's4', 's5']);
});

test('_docPrintSubtitle : la feuille se relit seule trois semaines plus tard', () => {
  ev(FIXTURE);
  const s = ev(`_docPrintSubtitle(S.documents.d1, 'manquants', 1)`);
  assert.match(s, /5C/);
  assert.match(s, /distribué le 15\/09\/2025/);
  assert.match(s, /à rendre pour le 30\/09\/2025/);
  assert.match(s, /2 \/ 3 rendus/);
  assert.match(s, /1 ligne — non rendus/);
  assert.match(s, /imprimé le/);
  // Sans suivi du retour, aucun compte de rendus ne s'invente.
  assert.ok(!/rendus/.test(ev(`_docPrintSubtitle(S.documents.d3, 'tous', 4)`)));
});

test('le PORTRAIT est le défaut — le paysage et l\'automatique restent à un clic', () => {
  ev(FIXTURE);
  // ⚠️ C'est l'orientation habituelle de ce genre de feuille (classeurs, bannettes de la
  // vie scolaire). Le seuil de `_docPrintOrientation` ne sert donc plus qu'au mode
  // « automatique », qu'on choisit exprès — et la modale prévient quand ça va serrer.
  assert.strictEqual(ev(`_docPrintOpts.orientation`), 'portrait');
  // Le menu se lit dans la SOURCE : le DOM du harnais est stubé, et une assertion sur
  // `querySelectorAll` y passerait au vert sur une liste vide — pire que pas de test.
  const html = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const menu = html.slice(html.indexOf('id="mdocp-orient"'), html.indexOf('id="mdocp-orient"') + 400);
  assert.deepStrictEqual((menu.match(/<option value="([a-z]+)"/g) || []).map(m => m.split('"')[1]),
    ['portrait', 'landscape', 'auto'], 'les trois orientations, le portrait en tête');
});
