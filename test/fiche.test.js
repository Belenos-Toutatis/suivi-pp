// Fiche élève — cliquer un nom dans la liste doit montrer TOUT ce que l'app sait de lui,
// sur un seul écran : carnet, documents (archivés compris), élections, remarque, journal.
// Cinq assemblages purs bâtissent cette fiche à partir de briques déjà testées ailleurs
// (_relDelta/_periods pour le carnet, _docExpected/_retour pour les documents, le modèle
// d'élection pour les rôles) — ce fichier ne re-teste pas ces briques, il vérifie que la
// fiche les assemble sans en perdre ni en déformer le sens.
//
// Un fil conducteur traverse les quatre fonctions non triviales : la fiche est un DOSSIER,
// pas une vue courante. Un document archivé y reste, un relevé où l'élève n'a rien y reste
// (case vide = information au moment d'un rendez-vous), une élection d'il y a deux ans y
// reste. Rien n'est filtré au prétexte que ce n'est « plus d'actualité ».

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// ═══════════════════════════════════════ _ficheAge ═══════════════════════════════════════
// Fonction pure, sans S : pas de FIXTURE ici. Le piège n'est pas l'arithmétique du calendrier
// en soi, c'est la tentation de la raccourcir en une soustraction d'années — ce qui donnerait
// un an de trop à quiconque n'a pas encore fêté son anniversaire dans l'année de référence.

test('_ficheAge : la veille de l\'anniversaire, l\'année n\'est pas encore comptée', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  // Né le 31/12/2013 : exemple même du CLAUDE.md. La veille du 13ᵉ anniversaire, 12 ans.
  assert.strictEqual(ev(`_ficheAge('2013-12-31', '2026-12-30')`), 12);
});

test('_ficheAge : le jour même de l\'anniversaire, l\'année compte déjà', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  assert.strictEqual(ev(`_ficheAge('2013-12-31', '2026-12-31')`), 13);
});

test('_ficheAge : le lendemain de l\'anniversaire, l\'âge ne change plus', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  assert.strictEqual(ev(`_ficheAge('2013-12-31', '2027-01-01')`), 13);
});

test('_ficheAge : même piège avec un anniversaire hors fin d\'année, pour ne pas dépendre du passage d\'année', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  // Né le 15/03/2014.
  assert.strictEqual(ev(`_ficheAge('2014-03-15', '2026-03-14')`), 11, 'veille : anniversaire pas encore passé cette année');
  assert.strictEqual(ev(`_ficheAge('2014-03-15', '2026-03-15')`), 12, 'jour même : l\'année compte');
  assert.strictEqual(ev(`_ficheAge('2014-03-15', '2026-03-16')`), 12, 'lendemain : inchangé');
});

test('_ficheAge : replis — naissance absente, invalide, ou postérieure à la référence', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  assert.strictEqual(ev(`_ficheAge(null, '2026-09-10')`), null, 'pas de date de naissance connue');
  assert.strictEqual(ev(`_ficheAge(undefined, '2026-09-10')`), null);
  assert.strictEqual(ev(`_ficheAge('', '2026-09-10')`), null);
  assert.strictEqual(ev(`_ficheAge('31/12/2013', '2026-09-10')`), null, 'mauvais format (jour/mois/année)');
  assert.strictEqual(ev(`_ficheAge('2013-02-30', '2026-09-10')`), null, '30 février : date calendaire impossible');
  // Naissance après la date de référence : un âge négatif ne veut rien dire.
  assert.strictEqual(ev(`_ficheAge('2030-01-01', '2026-09-10')`), null);
});

test('_ficheAge : sans référence explicite, retombe sur aujourd\'hui — pas d\'exception, pas de date figée en dur', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  // Comparé à un appel qui passe explicitement _todayYmd() : les deux doivent s'accorder,
  // quel que soit le jour où ce test tourne.
  assert.strictEqual(ev(`_ficheAge('2013-12-31')`), ev(`_ficheAge('2013-12-31', _todayYmd())`));
});

// ═══════════════════════════════════════ _fichePlaces ═══════════════════════════════════════
// Repose sur `_seatOf`, déjà testé dans test/places.test.js — ici on vérifie seulement
// l'ASSEMBLAGE : une entrée par salle où l'élève a réellement une place, triées par nom de
// salle (français), et la conversion 1-based qui rend `rang`/`colonne` lisibles par un humain.

const FIXTURE_PLACES = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = {
    id:'5C', nom:'5C', annee:'2025-26', ord:0,
    eleves:['s1','s2'],
    rooms: {
      // Trois salles dont les noms sont volontairement DANS le désordre alphabétique et
      // portent un accent, pour vérifier un vrai tri français (localeCompare 'fr') plutôt
      // qu'un tri par clé d'objet ou par ordre d'insertion.
      Z1: { seating: { '0,0':'s1' } },
      A1: { seating: { '1,2':'s1' } },
      E1: { seating: { '2,0':'s1' } },
      // s2 n'a de place dans AUCUNE salle : sert au repli « aucune place ».
      VIDE: { seating: {} },
    },
  };
  S.salles = {
    Z1: { id:'Z1', nom:'Zèbre',  rows:2, cols:2, patterns:[] },
    A1: { id:'A1', nom:'Amphi',  rows:3, cols:3, patterns:[] },
    E1: { id:'E1', nom:'Éveil',  rows:3, cols:2, patterns:[] },
    VIDE: { id:'VIDE', nom:'Salle non affectée', rows:1, cols:1, patterns:[] },
  };
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
  };`;

test('_fichePlaces : une entrée par salle occupée, triées par nom (français), rang/colonne en 1-based', () => {
  ev(FIXTURE_PLACES);
  const out = evObj(`_fichePlaces(S.classes['5C'], 's1')`);
  // Amphi, Éveil, Zèbre — l'ordre alphabétique français, PAS l'ordre des clés Z1/A1/E1.
  assert.deepStrictEqual(out.map(p => p.salleNom), ['Amphi', 'Éveil', 'Zèbre']);
  const amphi = out.find(p => p.salleId === 'A1');
  // Position brute '1,2' (0-based) → rang 2, colonne 3 (1-based) : une fiche se lit par
  // un humain, « rang 2, place 3 », pas par un index de tableau.
  assert.strictEqual(amphi.pos, '1,2');
  assert.strictEqual(amphi.rang, 2);
  assert.strictEqual(amphi.colonne, 3);
  const zebre = out.find(p => p.salleId === 'Z1');
  assert.strictEqual(zebre.pos, '0,0');
  assert.strictEqual(zebre.rang, 1);
  assert.strictEqual(zebre.colonne, 1);
});

test('_fichePlaces : aucune place nulle part → tableau vide, jamais d\'exception', () => {
  ev(FIXTURE_PLACES);
  assert.deepStrictEqual(evObj(`_fichePlaces(S.classes['5C'], 's2')`), []);
});

test('_fichePlaces : replis — élève inconnu, classe sans salles, classe absente', () => {
  ev(FIXTURE_PLACES);
  assert.deepStrictEqual(evObj(`_fichePlaces(S.classes['5C'], 'sFantome')`), []);
  assert.deepStrictEqual(evObj(`_fichePlaces({ id:'5D', rooms:{} }, 's1')`), []);
  assert.deepStrictEqual(evObj(`_fichePlaces(null, 's1')`), []);
});

// ═══════════════════════════════════════ _ficheCarnet ═══════════════════════════════════════
// Repose sur `_relDelta`/`_relValue`/`_periods`/`_relPeriodTotal`, déjà testés dans
// test/carnets.test.js. Ici : l'assemblage couvre TOUS les relevés (trous compris) et TOUTES
// les périodes, dans l'ordre chronologique — une fiche ne cache pas un relevé où il n'y avait
// rien à dire.

const FIXTURE_CARNET = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'A',prenom:'a',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'B',prenom:'b',classe_id:'5C',tags:[]} };
  S.cur = '5C';
  const put = (d, counts, label) => { S.releves['5C'][d] = { date:d, ts:1, counts, label: label || '' }; };
  S.releves['5C'] = {};
  put('2025-10-01', { s1: 7 });                    // premier relevé de s1 : delta = cumul
  put('2025-10-15', { s1: 'A' }, 'avant conseil');  // absent : rien à relever
  put('2025-11-05', { s1: 10 });                    // delta = 10 − 7 = 3 (l'absence est sautée)
  put('2025-12-01', {});                            // s1 : trou, pas relevé du tout
  put('2026-03-01', { s1: 8 });                     // CUMUL QUI DIMINUE : 8 < 10, signalé jamais corrigé
  // s2 : n'a JAMAIS rien dans aucun de ces relevés — sert au repli « aucun relevé chiffré ».`;

test('_ficheCarnet : couvre TOUS les relevés de la classe, dans l\'ordre chronologique, trous compris', () => {
  ev(FIXTURE_CARNET);
  const r = evObj(`_ficheCarnet(S.classes['5C'], 's1')`);
  assert.deepStrictEqual(r.releves.map(x => x.ymd), ['2025-10-01', '2025-10-15', '2025-11-05', '2025-12-01', '2026-03-01']);
});

test('_ficheCarnet : premier relevé, code « absent », trou, et cumul décroissant — les quatre cas de `valeur`', () => {
  ev(FIXTURE_CARNET);
  const r = evObj(`_ficheCarnet(S.classes['5C'], 's1')`);
  const byYmd = ymd => r.releves.find(x => x.ymd === ymd);

  const premier = byYmd('2025-10-01');
  assert.strictEqual(premier.valeur, 7);
  assert.strictEqual(premier.delta, 7, 'premier relevé : le delta vaut le cumul lui-même');
  assert.strictEqual(premier.decroissant, false);

  const absent = byYmd('2025-10-15');
  assert.strictEqual(absent.valeur, 'A');
  assert.strictEqual(absent.label, 'avant conseil');
  assert.strictEqual(absent.delta, null, '« A » n\'est pas un nombre : pas de delta');
  assert.strictEqual(absent.decroissant, false);

  const suivant = byYmd('2025-11-05');
  assert.strictEqual(suivant.valeur, 10);
  assert.strictEqual(suivant.delta, 3, 'le "A" du 15/10 est sauté, on compare au 7 du 01/10');
  assert.strictEqual(suivant.decroissant, false);

  const trou = byYmd('2025-12-01');
  assert.strictEqual(trou.valeur, null, 'pas relevé du tout : ni 0 ni "A"');
  assert.strictEqual(trou.delta, null);
  assert.strictEqual(trou.decroissant, false);

  const decroit = byYmd('2026-03-01');
  assert.strictEqual(decroit.valeur, 8);
  assert.strictEqual(decroit.delta, -2, '8 − 10 : signalé, jamais réécrit');
  assert.strictEqual(decroit.decroissant, true);
});

test('_ficheCarnet : un élève sans aucun relevé chiffré — toutes les valeurs à null, mais les dates y sont', () => {
  ev(FIXTURE_CARNET);
  const r = evObj(`_ficheCarnet(S.classes['5C'], 's2')`);
  assert.strictEqual(r.releves.length, 5, 'les relevés de la CLASSE, pas seulement ceux où l\'élève apparaît');
  assert.ok(r.releves.every(x => x.valeur === null && x.delta === null && x.decroissant === false));
});

test('_ficheCarnet : total de période — calculé pour s1, null pour s2 qui n\'a rien de chiffré dans la période', () => {
  ev(FIXTURE_CARNET);
  const r1 = evObj(`_ficheCarnet(S.classes['5C'], 's1')`);
  // Semestre par défaut : S1 (août → 31 janvier) contient 01/10, 15/10 (A), 05/11, 01/12 (trou) ;
  // dernier cumul chiffré de la période = 10, rien avant le début d'année → total 10.
  const s1v1 = r1.periodes.find(p => p.label === 'S1');
  assert.strictEqual(s1v1.total, 10);
  // S2 (février → juillet) ne contient que le 01/03 (8), face à un dernier cumul chiffré
  // d'AVANT la période (10, le 05/11) → total 8 − 10 = −2 : le cumul a diminué, la période
  // qui l'englobe hérite honnêtement d'un total négatif plutôt que d'un chiffre inventé.
  const s1v2 = r1.periodes.find(p => p.label === 'S2');
  assert.strictEqual(s1v2.total, -2);

  const r2 = evObj(`_ficheCarnet(S.classes['5C'], 's2')`);
  assert.strictEqual(r2.periodes.find(p => p.label === 'S1').total, null);
  assert.strictEqual(r2.periodes.find(p => p.label === 'S2').total, null);
});

test('_ficheCarnet : classe absente → structure vide, jamais d\'exception', () => {
  ev(FIXTURE_CARNET);
  assert.deepStrictEqual(evObj(`_ficheCarnet(null, 's1')`), { releves: [], periodes: [] });
});

// ═══════════════════════════════════════ _ficheDocuments ═══════════════════════════════════════
// Repose sur `_docExpected`/`_retour`, déjà testés dans test/documents.test.js. Ici :
// les documents ARCHIVÉS restent dans la fiche (avec leur drapeau), `attendu` reflète la
// présence de l'élève à la date de référence DU document, et les réponses à choix multiple
// rendent des LIBELLÉS lisibles — jamais les ids internes des options.

const FIXTURE_DOCS = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0 };
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    // Parti le 01/06/2025 : servira au cas « pas attendu » sur un document distribué après.
    s2:{id:'s2',nom:'PARTI',prenom:'Sami',classe_id:'5C',tags:[], departureDate:'2025-06-01'},
  };
  S.cur = '5C';
  // Le cas orientation : un choix unique ET un choix multiple, plus un champ 'prof' resté
  // sans avis (donc absent des reponses rendues, cf. test/documents.test.js sur ce distinguo).
  S.documents.d1 = { id:'d1', titre:'Fiche d\\'orientation', classIds:['5C'], dateDistribution:'2025-09-15', dateEcheance:null,
    suiviRetour:true, archive:false, ord:0,
    champs:[
      { id:'opt1', label:'Option 1',      type:'choix', par:'famille', obligatoire:true,  options:[{id:'latin',label:'LATIN',color:'#111'},{id:'bil',label:'BILINGUE',color:'#222'}] },
      { id:'opts', label:'Autres options', type:'multi', par:'famille', obligatoire:false, options:[{id:'dnl',label:'DNL',color:'#333'},{id:'catho',label:'CATHO F',color:'#444'}] },
      { id:'avis', label:'Avis PP',        type:'choix', par:'prof',    obligatoire:true,  options:[{id:'fav',label:'Favorable',color:'#555'}] },
    ],
    retours:{ s1:{ rendu:true, dateRetour:'2025-09-20', reponses:{ opt1:'latin', opts:['dnl','catho'] }, note:'à vérifier' } } };
  // Document ARCHIVÉ : reste sur la fiche, mais marqué.
  S.documents.d2 = { id:'d2', titre:'Ancien règlement', classIds:['5C'], dateDistribution:'2024-09-01', dateEcheance:null,
    suiviRetour:false, archive:true, ord:1, champs:[], retours:{} };
  // Distribué APRÈS le départ de s2 : s2 n'est pas attendu dessus.
  S.documents.d3 = { id:'d3', titre:'Fiche rentrée 2025', classIds:['5C'], dateDistribution:'2025-09-01', dateEcheance:null,
    suiviRetour:true, archive:false, ord:2, champs:[], retours:{} };`;

test('_ficheDocuments : rend TOUS les documents, archivés compris, dans l\'ordre de la liste', () => {
  ev(FIXTURE_DOCS);
  const r = evObj(`_ficheDocuments(S.classes['5C'], 's1')`);
  assert.deepStrictEqual(r.map(d => d.docId), ['d1', 'd2', 'd3']);
  assert.strictEqual(r.find(d => d.docId === 'd1').archive, false);
  assert.strictEqual(r.find(d => d.docId === 'd2').archive, true, 'archivé, mais toujours présent : une fiche est un dossier');
});

test('_ficheDocuments : le champ à choix multiple rend les LIBELLÉS, pas les ids des options', () => {
  ev(FIXTURE_DOCS);
  const d1 = evObj(`_ficheDocuments(S.classes['5C'], 's1')`).find(d => d.docId === 'd1');
  assert.strictEqual(d1.rendu, true);
  assert.strictEqual(d1.dateRetour, '2025-09-20');
  assert.strictEqual(d1.note, 'à vérifier');
  assert.deepStrictEqual(d1.reponses, [
    { champ: 'Option 1',       par: 'famille', valeurs: ['LATIN'] },
    { champ: 'Autres options', par: 'famille', valeurs: ['DNL', 'CATHO F'] },
  ]);
  // Le champ 'avis' (par le PP) n'a reçu aucune réponse : absent de la liste, pas une
  // entrée avec un tableau vide — la fiche ne liste que ce qui est effectivement renseigné.
  assert.ok(!d1.reponses.some(x => x.champ === 'Avis PP'));
});

test('_ficheDocuments : `attendu` reflète la présence de l\'élève à la date de référence DU document', () => {
  ev(FIXTURE_DOCS);
  const r2 = evObj(`_ficheDocuments(S.classes['5C'], 's2')`);
  // d2 distribué le 01/09/2024, avant le départ (01/06/2025) : s2 était encore là.
  assert.strictEqual(r2.find(d => d.docId === 'd2').attendu, true);
  // d3 distribué le 01/09/2025, après son départ : pas attendu.
  assert.strictEqual(r2.find(d => d.docId === 'd3').attendu, false);
  // Et sans retour du tout dans ce cas : rendu à false, aucune réponse.
  const d3 = r2.find(d => d.docId === 'd3');
  assert.strictEqual(d3.rendu, false);
  assert.deepStrictEqual(d3.reponses, []);
});

test('_ficheDocuments : classe absente → tableau vide', () => {
  ev(FIXTURE_DOCS);
  assert.deepStrictEqual(evObj(`_ficheDocuments(null, 's1')`), []);
});

// ═══════════════════════════════════════ _ficheElections ═══════════════════════════════════════
// Repose sur le modèle d'élection (candidats, assesseurs, elus) déjà exercé dans
// test/elections.test.js et test/departage.test.js. Ici : les RÔLES d'un élève sur une
// élection donnée, avec la possibilité de les CUMULER — dans une même élection (assesseur
// ET candidat, cas rare mais que le modèle n'interdit pas), et à travers deux élections
// différentes (titulaire cette année, assesseur l'an dernier — l'exemple même du CLAUDE.md).

const FIXTURE_ELECTIONS = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4','s5','s6'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'AAA',prenom:'Titu',       classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'BBB',prenom:'Supp',       classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'CCC',prenom:'Perdant',    classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'DDD',prenom:'PerdantSup', classe_id:'5C',tags:[]},
    s5:{id:'s5',nom:'EEE',prenom:'Ancien',     classe_id:'5C',tags:[]},
    s6:{id:'s6',nom:'FFF',prenom:'Isole',      classe_id:'5C',tags:[]},
  };
  // Élection RÉCENTE, un seul siège pour rester à un tour : deux binômes, l'un gagne
  // nettement (majorité absolue), l'autre perd. s1 est en plus posé comme assesseur DE SA
  // PROPRE élection : cas limite que le modèle n'interdit pas, et qui exerce le CUMUL de
  // rôles DANS une même élection (le tableau \`roles\`, pas seulement plusieurs élections).
  const elA = electionCreate('5C', { date:'2025-10-07', nbTitulaires:1, assesseurs:['s5','s1'] });
  electionAddCandidat(elA, 's1', 's2');   // c1 : Titu / Supp — va gagner
  electionAddCandidat(elA, 's3', 's4');   // c2 : Perdant / PerdantSup
  electionAddBulletin(elA, 0, [elA.candidats[0].id]);
  electionAddBulletin(elA, 0, [elA.candidats[0].id]);
  electionAddBulletin(elA, 0, [elA.candidats[1].id]);
  electionCloreTour(elA, 0);              // 2 voix sur 3 exprimés : majorité absolue, clôt
  // Élection PLUS ANCIENNE, restée ouverte : s5 y était candidat titulaire (sans suppléant).
  // Avec elA, ça donne à s5 un rôle sur DEUX élections différentes — assesseur cette année,
  // candidat l'an dernier — l'exemple même cité par CLAUDE.md pour la notion de cumul.
  const elB = electionCreate('5C', { date:'2024-10-01', nbTitulaires:1 });
  electionAddCandidat(elB, 's5', null);`;

test('_ficheElections : rôle simple — titulaire élu, suppléant élu avec lui (binôme)', () => {
  ev(FIXTURE_ELECTIONS);
  // s1 : titulaire du binôme gagnant, ET assesseur de la même élection → deux rôles CUMULÉS
  // sur une seule entrée, pas deux entrées.
  const r1 = evObj(`_ficheElections(S.classes['5C'], 's1')`);
  assert.strictEqual(r1.length, 1, 's1 n\'apparaît que dans l\'élection récente');
  assert.deepStrictEqual([...r1[0].roles].sort(), ['assesseur', 'titulaire']);
  assert.strictEqual(r1[0].elu, true);
  assert.strictEqual(r1[0].clos, true);
});

test('_ficheElections : le suppléant du binôme gagnant est élu AVEC son titulaire', () => {
  ev(FIXTURE_ELECTIONS);
  const r2 = evObj(`_ficheElections(S.classes['5C'], 's2')`);
  assert.strictEqual(r2.length, 1);
  assert.deepStrictEqual(r2[0].roles, ['suppleant']);
  assert.strictEqual(r2[0].elu, true);
});

test('_ficheElections : le binôme qui n\'a pas eu la majorité n\'est pas élu, mais apparaît quand même', () => {
  ev(FIXTURE_ELECTIONS);
  const r3 = evObj(`_ficheElections(S.classes['5C'], 's3')`);
  assert.deepStrictEqual(r3[0].roles, ['titulaire']);
  assert.strictEqual(r3[0].elu, false);
  const r4 = evObj(`_ficheElections(S.classes['5C'], 's4')`);
  assert.deepStrictEqual(r4[0].roles, ['suppleant']);
  assert.strictEqual(r4[0].elu, false);
});

test('_ficheElections : cumul À TRAVERS deux élections — assesseur cette année, candidat l\'an dernier, triées du plus récent au plus ancien', () => {
  ev(FIXTURE_ELECTIONS);
  const r5 = evObj(`_ficheElections(S.classes['5C'], 's5')`);
  assert.strictEqual(r5.length, 2, 's5 apparaît dans les DEUX élections');
  assert.strictEqual(r5[0].date, '2025-10-07', 'la plus récente en premier');
  assert.deepStrictEqual(r5[0].roles, ['assesseur']);
  assert.strictEqual(r5[0].elu, false);
  assert.strictEqual(r5[1].date, '2024-10-01');
  assert.deepStrictEqual(r5[1].roles, ['titulaire']);
  assert.strictEqual(r5[1].elu, false, 'élection restée ouverte : personne n\'est élu');
  assert.strictEqual(r5[1].clos, false);
});

test('_ficheElections : un élève absent de toute élection → tableau vide', () => {
  ev(FIXTURE_ELECTIONS);
  assert.deepStrictEqual(evObj(`_ficheElections(S.classes['5C'], 's6')`), []);
});

test('_ficheElections : classe absente → tableau vide, jamais d\'exception', () => {
  ev(FIXTURE_ELECTIONS);
  assert.deepStrictEqual(evObj(`_ficheElections(null, 's1')`), []);
});

// ─────────────────────────── Corrections depuis la fiche ───────────────────────────
// ⚠️ Le point n'est pas que la fiche sache modifier — c'est qu'elle modifie PAR LES MÊMES
// FONCTIONS que les autres écrans : undo posé, exclusivité des statuts, date de retour.
// Le harnais n'a pas de DOM : _ficheRender rend la main, seules les mutations comptent.

test('ficheSetGroupe / ficheToggleTag : mutation avec undo, depuis la fiche', () => {
  ev(FIXTURE_DOCS);
  ev(`S.tags.tag_1 = { id:'tag_1', abbr:'LATIN', name:'Latin', color:'#16a085' }; _ficheSid = 's1'; undoStack.length = 0;`);
  ev(`ficheSetGroupe(2)`);
  assert.strictEqual(evObj(`S.eleves.s1.groupe`), 2);
  ev(`ficheSetGroupe(null)`);
  assert.strictEqual(evObj(`S.eleves.s1.groupe`), null);
  ev(`ficheToggleTag('tag_1')`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.tags`), ['tag_1']);
  ev(`ficheToggleTag('tag_1')`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.tags`), []);
  ev(`ficheToggleTag('fantome')`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.tags`), [], 'un tag inconnu ne s\'écrit pas');
  assert.ok(evObj(`undoStack.length`) >= 4, 'un cran d\'undo par geste');
  ev(`undoLast()`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.tags`), ['tag_1'], 'Ctrl+Z défait le dernier geste');
});

test('ficheToggleStatus : la même exclusivité que la modale (PPRE / PAP / PPS / ULIS)', () => {
  ev(FIXTURE_DOCS);
  ev(`_ficheSid = 's1'; ficheToggleStatus('ppre'); ficheToggleStatus('pai');`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.ppre, S.eleves.s1.pai]`), [true, true]);
  ev(`ficheToggleStatus('pap')`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.ppre, S.eleves.s1.pap, S.eleves.s1.pai]`), [false, true, true], 'PAP chasse PPRE, PAI reste');
  ev(`ficheCycleUlis()`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.pap, S.eleves.s1.ulis, S.eleves.s1.ulis_incl]`), [false, true, false]);
  ev(`ficheCycleUlis()`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.ulis, S.eleves.s1.ulis_incl]`), [false, true]);
  ev(`ficheCycleUlis()`);
  assert.deepStrictEqual(evObj(`[S.eleves.s1.ulis, S.eleves.s1.ulis_incl]`), [false, false]);
  ev(`ficheToggleStatus('pap'); ficheToggleStatus('pap');`);
  assert.strictEqual(evObj(`S.eleves.s1.pap`), false, 'un second clic retire');
});

test('ficheToggleRendu : coche et décoche par docSetRendu — date du jour posée, puis effacée', () => {
  ev(FIXTURE_DOCS);
  ev(`_ficheSid = 's1'; S.documents.d1.retours.s1.rendu = false; S.documents.d1.retours.s1.dateRetour = null;`);
  ev(`ficheToggleRendu('d1')`);
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.rendu`), true);
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.dateRetour`), ev(`_todayYmd()`));
  assert.deepStrictEqual(evObj(`S.documents.d1.retours.s1.reponses`), { opt1: 'latin', opts: ['dnl', 'catho'] }, 'les réponses ne bougent pas');
  ev(`ficheToggleRendu('d1')`);
  assert.deepStrictEqual(evObj(`[S.documents.d1.retours.s1.rendu, S.documents.d1.retours.s1.dateRetour]`), [false, null]);
  ev(`ficheToggleRendu('fantome')`);   // ne lève pas
});

test('_fichePdcHint : prévient seulement quand la classe vient de Plan de classe', () => {
  ev(FIXTURE_DOCS);
  assert.strictEqual(ev(`_fichePdcHint(S.classes['5C'])`), '');
  ev(`S.classes['5C'].pdcImportAt = '2026-09-01';`);
  assert.match(ev(`_fichePdcHint(S.classes['5C'])`), /Plan de classe.*01\/09\/2026/);
  // Sans marqueur mais avec des salles importées : les données sont antérieures au marqueur.
  ev(`delete S.classes['5C'].pdcImportAt; S.salles.pdc_s1 = { id:'pdc_s1', nom:'102', rows:1, cols:1, patterns:[] };`);
  assert.match(ev(`_fichePdcHint(S.classes['5C'])`), /Plan de classe/);
  assert.doesNotMatch(ev(`_fichePdcHint(S.classes['5C'])`), /dernier import/);
});

test('moveStudentToClass : un seul chemin pour la modale et la fiche, relevés laissés en place', () => {
  ev(FIXTURE_DOCS);
  ev(`S.classes['5D'] = { id:'5D', nom:'5D', annee:'2025-26', eleves:[], ord:1 };
      S.releves['5C'] = { '2025-10-01': { date:'2025-10-01', ts:1, counts: { s1: 7 } } };`);
  assert.strictEqual(ev(`moveStudentToClass('s1', '5D')`), true);
  assert.deepStrictEqual(evObj(`[S.classes['5C'].eleves, S.classes['5D'].eleves, S.eleves.s1.classe_id]`), [['s2'], ['s1'], '5D']);
  assert.strictEqual(evObj(`S.releves['5C']['2025-10-01'].counts.s1`), 7, 'le relevé reste sous l\'ancienne classe');
  assert.strictEqual(ev(`moveStudentToClass('s1', '5D')`), false, 'déjà là');
  assert.strictEqual(ev(`moveStudentToClass('s1', 'nope')`), false);
  assert.strictEqual(ev(`moveStudentToClass('fantome', '5C')`), false);
});

test('la fiche corrige les réponses, la date et la note d\'un document par les fonctions du tableau', () => {
  ev(FIXTURE_DOCS);
  ev(`_ficheSid = 's1';`);
  ev(`ficheDocReponse('d1', 'opt1', 'bil')`);
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.reponses.opt1`), 'bil');
  ev(`ficheDocToggle('d1', 'opts', 'dnl')`);
  assert.deepStrictEqual(evObj(`S.documents.d1.retours.s1.reponses.opts`), ['catho']);
  ev(`ficheDocToggle('d1', 'opts', 'dnl')`);
  assert.deepStrictEqual(evObj(`S.documents.d1.retours.s1.reponses.opts.slice().sort()`), ['catho', 'dnl']);
  ev(`ficheDocDate('d1', '2025-10-02')`);
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.dateRetour`), '2025-10-02');
  ev(`ficheDocNote('d1', '  signature du père manquante ')`);
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.note`), 'signature du père manquante');
  assert.strictEqual(evObj(`S.documents.d1.retours.s1.rendu`), true, 'le retour ne bouge pas');
});

test('la fiche corrige et supprime un contact par journalSetTexte / journalRemove', () => {
  ev(FIXTURE_DOCS);
  const id = ev(`_ficheSid = 's1'; journalAdd('s1', '2025-10-03', 'appel', 'Mère jointe').id`);
  ev(`ficheJournalEdit('${id}', ' Mère jointe, rappel prévu ')`);
  assert.strictEqual(evObj(`S.eleves.s1.journal[0].texte`), 'Mère jointe, rappel prévu');
  ev(`ficheJournalEdit('${id}', '   ')`);
  assert.strictEqual(evObj(`S.eleves.s1.journal[0].texte`), 'Mère jointe, rappel prévu', 'un texte vide ne s\'écrit pas');
  ev(`pushUndo(); journalRemove('s1', '${id}');`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.journal`), []);
});

test('ficheSetPlace : assied l\'élève par seatSet, « aucune » libère', () => {
  ev(FIXTURE_DOCS);
  ev(`_ficheSid = 's1'; S.salles.sa1 = { id:'sa1', nom:'102', rows:2, cols:2, patterns:[] };`);
  ev(`ficheSetPlace('sa1', '1,1')`);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'sa1', 's1')`), '1,1');
  ev(`ficheSetPlace('sa1', '0,0')`);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'sa1', 's1')`), '0,0', 'déplacé, pas dupliqué');
  ev(`ficheSetPlace('sa1', '')`);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'sa1', 's1')`), null);
});
