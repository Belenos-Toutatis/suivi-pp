// Ramassage — cocher « rendu » sur PLUSIEURS documents en une seule passe.
//
// Le geste réel : on passe dans les rangs avec trois papiers différents à récupérer, et
// on coche au fur et à mesure. Ouvrir un document, cocher, revenir, ouvrir le suivant,
// re-cocher les mêmes élèves — c'est ce que cet écran supprime.
//
// ⚠️ Le piège du calcul est qu'un élève n'est pas attendu sur TOUS les documents : celui
// qui est arrivé en novembre n'a jamais eu la fiche de rentrée, celui qui est parti en
// mars n'a pas eu la fiche d'orientation. Une case n'a donc pas trois états (cochée /
// décochée) mais quatre, le quatrième étant « sans objet » — et le confondre avec
// « pas rendu » ferait réclamer un papier à un élève qui ne l'a jamais reçu.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4'], ord:0 };
  S.classes['5D'] = { id:'5D', nom:'5D', annee:'2025-26', eleves:['s9'], ord:1 };
  S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'ALPHA',prenom:'Ana',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'BETA', prenom:'Bo', classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'GAMMA',prenom:'Cy', classe_id:'5C',tags:[], arrivalDate:'2025-11-03'},
    s4:{id:'s4',nom:'DELTA',prenom:'Di', classe_id:'5C',tags:[], departureDate:'2025-10-01'},
    s9:{id:'s9',nom:'OMEGA',prenom:'Ed', classe_id:'5D',tags:[]},
  };
  const mk = (id, o) => { S.documents[id] = Object.assign({ id, titre:id, description:'', classIds:['5C'],
    dateDistribution:'2025-09-15', dateEcheance:null, suiviRetour:true, champs:[], retours:{}, archive:false, ord:0 }, o); return S.documents[id]; };
  // d1 : distribué en septembre — s3 (arrivé en novembre) n'est pas attendu, s4 l'est encore.
  mk('d1', { titre:'Fiche de renseignement', dateEcheance:'2025-09-30', ord:0 });
  // d2 : distribué en décembre — s3 est attendu, s4 est parti.
  mk('d2', { titre:'Devoirs Faits', dateDistribution:'2025-12-01', dateEcheance:'2025-12-15', ord:1 });
  // d3 : archivé. d4 : purement informatif. d5 : autre classe.
  mk('d3', { titre:'Archivé', archive:true, ord:2 });
  mk('d4', { titre:'Note d\\'information', suiviRetour:false, ord:3 });
  mk('d5', { titre:'Autre classe', classIds:['5D'], ord:4 });`;

// ─────────────────────── Quels documents sont ramassables ───────────────────────

test('_ramDocsDisponibles : les documents de la classe dont le retour se suit', () => {
  ev(FIXTURE);
  const ids = evObj(`_ramDocsDisponibles('5C').map(d => d.id)`);
  // Dans l'ordre d'affichage des documents (`ord`), pas dans l'ordre alphabétique :
  // c'est celui que l'utilisateur a sous les yeux dans la liste.
  assert.deepStrictEqual(ids, ['d1', 'd2']);
  // ⚠️ Trois exclusions, trois raisons différentes : un document archivé est rangé, un
  // document informatif n'a RIEN à rendre (le cocher n'aurait aucun sens), et celui
  // d'une autre classe n'est pas dans les mains qu'on a devant soi.
});

test('_ramDocsDisponibles : un document déjà complet reste ramassable', () => {
  ev(FIXTURE);
  ev(`for (const s of _docExpected(S.documents.d1)) docSetRendu(S.documents.d1, s.id, true)`);
  assert.ok(evObj(`_ramDocsDisponibles('5C').map(d => d.id)`).includes('d1'),
    'un retardataire arrive toujours — ne jamais retirer un document de la liste');
});

// ─────────────────────── La grille ───────────────────────

test('_ramRows : une ligne par élève attendu sur AU MOINS un des documents', () => {
  ev(FIXTURE);
  const rows = evObj(`_ramRows(['d1','d2'], '5C')`);
  assert.deepStrictEqual(rows.map(r => r.sid), ['s1', 's2', 's4', 's3']);
  // Tri : par nom, ALPHA · BETA · DELTA · GAMMA.
  assert.deepStrictEqual(rows.map(r => r.nom), ['ALPHA', 'BETA', 'DELTA', 'GAMMA']);
});

test('_ramRows : une case « sans objet » n\'est PAS une case à cocher', () => {
  ev(FIXTURE);
  const rows = evObj(`_ramRows(['d1','d2'], '5C')`);
  const par = Object.fromEntries(rows.map(r => [r.sid, r.cells]));
  // s3 est arrivé en novembre : pas attendu sur d1 (échéance 30/09), attendu sur d2.
  assert.deepStrictEqual(par.s3.map(c => c.attendu), [false, true]);
  // s4 est parti le 01/10 : attendu sur d1, plus là pour d2.
  assert.deepStrictEqual(par.s4.map(c => c.attendu), [true, false]);
  // Les deux autres sont attendus partout.
  assert.deepStrictEqual(par.s1.map(c => c.attendu), [true, true]);
});

test('_ramRows : « reste » ne compte que ce qui est ATTENDU et pas encore rendu', () => {
  ev(FIXTURE);
  ev(`docSetRendu(S.documents.d1, 's1', true)`);
  const rows = evObj(`_ramRows(['d1','d2'], '5C')`);
  const reste = Object.fromEntries(rows.map(r => [r.sid, r.reste]));
  assert.strictEqual(reste.s1, 1);   // d1 rendu, d2 non
  assert.strictEqual(reste.s2, 2);   // rien rendu
  assert.strictEqual(reste.s3, 1);   // seul d2 le concerne
  assert.strictEqual(reste.s4, 1);   // seul d1 le concerne
});

test('_ramRows : la case porte l\'état réel du retour, date comprise', () => {
  ev(FIXTURE);
  ev(`docSetRendu(S.documents.d2, 's2', true); docSetDateRetour(S.documents.d2, 's2', '2025-12-08')`);
  const c = evObj(`_ramRows(['d1','d2'], '5C').find(r => r.sid === 's2').cells[1]`);
  assert.deepStrictEqual(c, { docId: 'd2', attendu: true, rendu: true, dateRetour: '2025-12-08', repManquantes: 0 });
});

test('_ramRows : un document inconnu ou d\'une autre classe ne casse rien', () => {
  ev(FIXTURE);
  const rows = evObj(`_ramRows(['d1','fantome'], '5C')`);
  assert.ok(rows.length > 0);
  for (const r of rows) assert.strictEqual(r.cells.length, 2, 'une colonne par id demandé, même inconnu');
  for (const r of rows) assert.strictEqual(r.cells[1].attendu, false, 'un document inconnu n\'attend personne');
});

test('_ramRows : aucun document sélectionné → aucune ligne', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_ramRows([], '5C')`), []);
});

// ─────────────────────── La mutation ───────────────────────

test('ramSetRendu : coche le retour ET pose la date du ramassage', () => {
  ev(FIXTURE);
  ev(`ramSetRendu('d1', 's1', true, '2025-09-22')`);
  const r = evObj(`_retour(S.documents.d1, 's1')`);
  assert.strictEqual(r.rendu, true);
  // ⚠️ La date du RAMASSAGE, pas celle du jour : on saisit souvent le soir, ou le
  // lendemain matin avec la pile de papiers sur le bureau.
  assert.strictEqual(r.dateRetour, '2025-09-22');
});

test('ramSetRendu : décocher efface la date, et ne touche pas aux réponses', () => {
  ev(FIXTURE);
  ev(`S.documents.d1.champs = [{ id:'c1', label:'Choix', type:'choix', par:'famille', obligatoire:true,
        options:[{id:'oui',label:'OUI',color:'#16a085'}] }];
      ramSetRendu('d1', 's1', true, '2025-09-22');
      docSetReponse(S.documents.d1, 's1', 'c1', 'oui');
      ramSetRendu('d1', 's1', false, '2025-09-22');`);
  const r = evObj(`_retour(S.documents.d1, 's1')`);
  assert.strictEqual(r.rendu, false);
  assert.strictEqual(r.dateRetour, null);
  // Les deux axes restent INDÉPENDANTS : une réponse connue à l'oral survit à un
  // décochage du papier. Les écraser ici perdrait une information non reconstituable.
  assert.deepStrictEqual(r.reponses, { c1: 'oui' });
});

test('ramSetRendu : refuse un élève qui n\'est pas attendu sur ce document', () => {
  ev(FIXTURE);
  // s3 est arrivé après l'échéance de d1 : le cocher inventerait un retour.
  assert.strictEqual(ev(`ramSetRendu('d1', 's3', true, '2025-09-22')`), false);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's3')`).rendu, false);
  assert.strictEqual(ev(`ramSetRendu('fantome', 's1', true, '2025-09-22')`), false);
});

test('ramSetColonne : coche toute une colonne, sans toucher aux non-attendus', () => {
  ev(FIXTURE);
  const n = ev(`ramSetColonne('d1', true, '2025-09-22')`);
  const st = evObj(`_docStats(S.documents.d1)`);
  assert.strictEqual(st.rendus, st.attendus);
  assert.strictEqual(n, st.attendus, 'retourne le nombre de cases réellement changées');
  // s3 n'était pas attendu : rien n'a été écrit pour lui.
  assert.strictEqual(evObj(`Object.keys(S.documents.d1.retours)`).includes('s3'), false);
  // Rejouer ne change plus rien — utile pour que l'undo ne s'empile pas dans le vide.
  assert.strictEqual(ev(`ramSetColonne('d1', true, '2025-09-22')`), 0);
});

test('MÉTA-TEST : le détecteur de « sans objet » voit bien un cas fabriqué', () => {
  // Sans lui, une régression qui rendrait TOUT le monde attendu partout passerait
  // inaperçue : tous les tests ci-dessus continueraient de compter juste.
  ev(FIXTURE);
  ev(`delete S.eleves.s3.arrivalDate; delete S.eleves.s4.departureDate;`);
  const rows = evObj(`_ramRows(['d1','d2'], '5C')`);
  for (const r of rows) assert.deepStrictEqual(r.cells.map(c => c.attendu), [true, true],
    'sans dates d\'arrivée/départ, tout le monde est attendu partout');
});

// ─────────────────────── Deux défauts trouvés en relecture ───────────────────────

test('ramSetColonne restreinte à une liste : n\'écrit RIEN hors de cette liste', () => {
  // ⚠️ L'écran masque par défaut les élèves partis — on ne ramasse rien auprès d'eux.
  // Sans cette restriction, « Tous » marquait « rendu » pour un élève parti dont la
  // ligne n'est même pas affichée : on déclarait recueilli en mains propres un papier
  // remis par quelqu'un qui n'était pas dans la salle, et rien ne le montrait.
  ev(FIXTURE);
  const tous = evObj(`_docExpected(S.documents.d1).map(s => s.id)`);
  assert.ok(tous.includes('s4'), 's4 est parti, mais il était bien attendu sur d1');
  const vivants = tous.filter(id => id !== 's4');
  const n = ev(`ramSetColonne('d1', true, '2025-09-22', ${JSON.stringify(vivants)})`);
  assert.strictEqual(n, vivants.length);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's4')`).rendu, false, 's4 ne doit pas avoir été touché');
  assert.strictEqual(evObj(`Object.keys(S.documents.d1.retours)`).includes('s4'), false,
    'aucune entrée ne doit même avoir été créée pour lui');
  // Sans liste, le comportement d'origine est conservé : tous les attendus.
  ev(FIXTURE);
  assert.strictEqual(ev(`ramSetColonne('d1', true, '2025-09-22')`), tous.length);
});

test('un rechargement distant DÉSARME la salve d\'undo du ramassage', () => {
  // ⚠️ Le verrou de salve vit 2 s. S'il survit à un rechargement, la mutation suivante
  // saute son pushUndo() — et elle porte sur l'état fraîchement rechargé, jamais
  // capturé. Le Ctrl+Z ne remonterait alors pas au-delà. Le jumeau des carnets
  // (`_relUndoArmed`) était désarmé là ; celui-ci avait été oublié.
  ev(FIXTURE);
  ev(`_ramUndoArmed = true; _ramUndoTimer = setTimeout(() => {}, 5000); _ramSel = ['d1'];`);
  ev(`_applyReloadedData(${JSON.stringify({ version: 1, classes: {}, eleves: {}, releves: {}, documents: {}, elections: {}, tags: {}, prefs: {}, cur: null })}, { lastModified: 999 })`);
  assert.strictEqual(ev(`_ramUndoArmed`), false, 'le verrou doit être désarmé');
  assert.strictEqual(ev(`_ramUndoTimer`), null, 'et son minuteur annulé');
  assert.strictEqual(ev(`_ramSel`), null, 'la sélection de ramassage pointait des documents disparus');
});

// ─────────────────── Relever les réponses pendant le ramassage ───────────────────
// Le papier revient et on lit la case cochée dessus : « Devoirs Faits — OUI ». Devoir
// rouvrir le document ensuite, élève par élève, c'est refaire une seconde fois le tour
// de la classe.

const AVEC_CHAMPS = FIXTURE + `
  S.documents.d1.champs = [
    { id:'part', label:'Participation', type:'choix', par:'famille', obligatoire:true,
      options:[{id:'oui',label:'OUI',color:'#16a085'},{id:'non',label:'NON',color:'#c0392b'},{id:'ulyss',label:'ULYSS',color:'#2c3e50'}] },
    { id:'clubs', label:'Activités', type:'multi', par:'famille', obligatoire:false,
      options:[{id:'chorale',label:'Chorale',color:'#27ae60'},{id:'unss',label:'UNSS',color:'#9b59b6'}] },
    { id:'avis', label:'Avis PP', type:'choix', par:'prof', obligatoire:true,
      options:[{id:'fav',label:'Favorable',color:'#27ae60'}] },
  ];`;

test('_ramRows : « à lire » ne compte que les réponses OBLIGATOIRES des FAMILLES', () => {
  ev(AVEC_CHAMPS);
  const r = evObj(`_ramRows(['d1','d2'], '5C').find(x => x.sid === 's1')`);
  // Trois champs sur d1, mais un seul compte : « Activités » est facultatif et « Avis PP »
  // revient au professeur — le noter debout dans les rangs n'a pas de sens, et le compter
  // ferait clignoter une ligne pour un travail qui n'est pas le geste en cours.
  assert.strictEqual(r.cells[0].repManquantes, 1);
  assert.strictEqual(r.resteRep, 1);
  ev(`docSetReponse(S.documents.d1, 's1', 'part', 'oui')`);
  assert.strictEqual(evObj(`_ramRows(['d1','d2'], '5C').find(x => x.sid === 's1')`).resteRep, 0);
});

test('_ramRows : une case sans objet ne réclame aucune réponse', () => {
  ev(AVEC_CHAMPS);
  // s3 est arrivé après l'échéance de d1 : ni papier ni réponse à attendre de lui.
  const r = evObj(`_ramRows(['d1','d2'], '5C').find(x => x.sid === 's3')`);
  assert.strictEqual(r.cells[0].attendu, false);
  assert.strictEqual(r.cells[0].repManquantes, 0);
  assert.strictEqual(r.resteRep, 0);
});

test('ramSetReponse : pose la réponse, et un second appui sur la MÊME option l\'efface', () => {
  ev(AVEC_CHAMPS);
  assert.strictEqual(ev(`ramSetReponse('d1', 's1', 'part', 'oui')`), true);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's1')`).reponses.part, 'oui');
  // ⚠️ Dans les rangs, on corrige une lecture erronée d'un second appui — sans avoir à
  // viser une croix minuscule ni à ouvrir un menu.
  ev(`ramSetReponse('d1', 's1', 'part', 'oui')`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's1')`).reponses.part, undefined);
  // Changer d'option remplace, sans passer par l'effacement.
  ev(`ramSetReponse('d1', 's1', 'part', 'oui'); ramSetReponse('d1', 's1', 'part', 'non')`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's1')`).reponses.part, 'non');
});

test('ramToggleReponse : le choix multiple s\'accumule et se retire', () => {
  ev(AVEC_CHAMPS);
  ev(`ramToggleReponse('d1', 's1', 'clubs', 'chorale'); ramToggleReponse('d1', 's1', 'clubs', 'unss')`);
  assert.deepStrictEqual(evObj(`_retour(S.documents.d1, 's1')`).reponses.clubs, ['chorale', 'unss']);
  ev(`ramToggleReponse('d1', 's1', 'clubs', 'chorale')`);
  assert.deepStrictEqual(evObj(`_retour(S.documents.d1, 's1')`).reponses.clubs, ['unss']);
});

test('ramSetReponse / ramToggleReponse : mêmes gardes que le retour', () => {
  ev(AVEC_CHAMPS);
  // s3 n'est pas attendu sur d1 : lui prêter une réponse fausserait les compteurs.
  assert.strictEqual(ev(`ramSetReponse('d1', 's3', 'part', 'oui')`), false);
  assert.strictEqual(evObj(`Object.keys(S.documents.d1.retours)`).includes('s3'), false);
  assert.strictEqual(ev(`ramToggleReponse('d1', 's3', 'clubs', 'unss')`), false);
  assert.strictEqual(ev(`ramSetReponse('fantome', 's1', 'part', 'oui')`), false);
});

test('relever un choix VAUT constat de retour — à la date du ramassage', () => {
  // ⚠️ Arbitrage de l'utilisateur, et il est juste pour SON geste : si on lit la case
  // cochée sur le papier, c'est qu'on l'a en main. Le faire cocher à part serait deux
  // gestes pour un seul fait.
  ev(AVEC_CHAMPS);
  ev(`ramSetReponse('d1', 's1', 'part', 'oui', '2025-09-22')`);
  const r = evObj(`_retour(S.documents.d1, 's1')`);
  assert.strictEqual(r.rendu, true);
  assert.strictEqual(r.dateRetour, '2025-09-22');
  // Idem pour un choix multiple : c'est l'AJOUT d'une option qui vaut constat.
  ev(`ramToggleReponse('d1', 's2', 'clubs', 'unss', '2025-09-25')`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's2')`).rendu, true);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's2')`).dateRetour, '2025-09-25');
});

test('… mais RETIRER une réponse ne décoche rien', () => {
  // On corrige une lecture, on ne rend pas le papier : le geste inverse n'a pas de
  // symétrique. Décocher le retour reste possible à la main, sur sa propre case.
  ev(AVEC_CHAMPS);
  ev(`ramSetReponse('d1', 's1', 'part', 'oui', '2025-09-22');
      ramSetReponse('d1', 's1', 'part', 'oui', '2025-09-22');`);   // second appui = efface
  const r = evObj(`_retour(S.documents.d1, 's1')`);
  assert.strictEqual(r.reponses.part, undefined, 'la réponse est bien effacée');
  assert.strictEqual(r.rendu, true, 'le papier, lui, est toujours revenu');
  ev(`ramToggleReponse('d1', 's2', 'clubs', 'unss', '2025-09-25');
      ramToggleReponse('d1', 's2', 'clubs', 'unss', '2025-09-25');`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's2')`).rendu, true);
});

test('un retour déjà daté n\'est pas redaté par une réponse relevée plus tard', () => {
  // Le papier est rentré le 22 ; on relève sa réponse le 25 en reprenant la pile. La
  // date du RETOUR est celle du retour, pas celle de la lecture — sinon l'historique
  // des rendus se décalerait à chaque relecture.
  ev(AVEC_CHAMPS);
  ev(`ramSetRendu('d1', 's1', true, '2025-09-22'); ramSetReponse('d1', 's1', 'part', 'oui', '2025-09-25')`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's1')`).dateRetour, '2025-09-22');
});

test('hors des rangs, les deux axes restent indépendants', () => {
  // ⚠️ La règle « un choix vaut retour » ne vaut QUE pour le ramassage. Le tableau du
  // document est l'endroit où l'on note une réponse donnée à l'oral au rendez-vous,
  // avant que le papier revienne : l'y cocher tout seul inventerait un retour.
  ev(AVEC_CHAMPS);
  ev(`docSetReponse(S.documents.d1, 's1', 'part', 'oui')`);
  assert.strictEqual(evObj(`_retour(S.documents.d1, 's1')`).rendu, false);
  // Et l'inverse, partout : cocher le retour n'invente aucune réponse.
  ev(`ramSetRendu('d1', 's2', true, '2025-09-22')`);
  assert.deepStrictEqual(evObj(`_retour(S.documents.d1, 's2')`).reponses, {});
});

test('_ramRows : un document PARTAGÉ avec une autre classe n\'y fait pas entrer ses élèves', () => {
  ev(FIXTURE);
  // ⚠️ On est PP d'UNE classe. d1 partagé 5C + 5D : `_docExpected` remonte s9 (5D), mais
  // la grille de la 5C ne le connaît pas — il n'est pas dans la salle, et « tout cocher »
  // lui aurait attribué un retour en mains propres. Aucune fixture n'avait de papier
  // partagé : c'est le test des totaux de la grille imprimée qui l'a vu.
  ev(`S.documents.d1.classIds = ['5C','5D']`);
  assert.ok(evObj(`_docExpected(S.documents.d1)`).some(s => s.id === 's9'), 'sanity : s9 est bien attendu sur d1');
  const c5 = evObj(`_ramRows(['d1'], '5C')`).map(r => r.sid);
  assert.ok(!c5.includes('s9'));
  assert.deepStrictEqual(c5, ['s1', 's2', 's4']);            // s3 arrivé en novembre : pas attendu en septembre
  // Et il est bien là quand c'est SA classe qu'on ramasse.
  assert.deepStrictEqual(evObj(`_ramRows(['d1'], '5D')`).map(r => r.sid), ['s9']);
  // Classe inconnue → personne : une grille sans salle n'a personne dedans.
  assert.deepStrictEqual(evObj(`_ramRows(['d1'], 'fantome')`), []);
});

// ─────────────────────── Pastilles de reste, empilées ───────────────────────

test('_ramResteHTML : une pastille PAR reste, « complet » sinon', () => {
  // « 2 à rendre » et « 1 à lire » l'un SOUS l'autre : côte à côte, la colonne des noms —
  // collante, donc toujours à l'écran — s'élargissait de toute la pastille.
  const deux = ev(`_ramResteHTML({ reste: 2, resteRep: 1 })`);
  assert.deepStrictEqual(deux.match(/<span class="badge warn">[^<]*<\/span>/g).map(x => x.replace(/<[^>]+>/g, '')),
    ['2 à rendre', '1 à lire']);
  assert.strictEqual(ev(`_ramResteHTML({ reste: 0, resteRep: 3 })`), '<span class="badge warn">3 à lire</span>');
  assert.strictEqual(ev(`_ramResteHTML({ reste: 0, resteRep: 0 })`), '<span class="badge ok">complet</span>');
  assert.strictEqual(ev(`_ramResteLabel({ reste: 2, resteRep: 1 })`), '2 à rendre · 1 à lire');
});
