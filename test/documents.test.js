// Documents administratifs : qui a rendu quoi, et ce qui est porté dessus.
// Deux axes INDÉPENDANTS (rendu / réponses), des champs « famille » ou « prof », des
// compteurs qui ne comptent que ce qu'on attend des familles.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4'], ord:0 };
  S.classes['5D'] = { id:'5D', nom:'5D', annee:'2025-26', eleves:['s5'], ord:1 };
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PETIT',prenom:'Inès',classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'ROUX',prenom:'Sami',classe_id:'5C',tags:[], departureDate:'2025-09-10'},   // parti AVANT la distribution
    s5:{id:'s5',nom:'ZOLA',prenom:'Ana',classe_id:'5D',tags:[]},
  };
  S.cur = '5C';
  // Le cas orientation : deux champs famille, un champ prof.
  S.documents.d1 = { id:'d1', titre:'Fiche d\\'orientation', classIds:['5C'], dateDistribution:'2025-09-15', dateEcheance:'2025-09-30',
    suiviRetour:true, archive:false, ord:0,
    champs:[
      { id:'opt1', label:'Option 1', type:'choix', par:'famille', obligatoire:true,  options:[{id:'latin',label:'LATIN',color:'#16a085'},{id:'bil',label:'BILINGUE',color:'#c0392b'}] },
      { id:'opts', label:'Autres', type:'multi', par:'famille', obligatoire:false, options:[{id:'dnl',label:'DNL',color:'#2c3e50'},{id:'catho',label:'CATHO F',color:'#95a5a6'}] },
      { id:'avis', label:'Avis PP',  type:'choix', par:'prof',    obligatoire:true,  options:[{id:'fav',label:'Favorable',color:'#27ae60'},{id:'res',label:'Réservé',color:'#e67e22'}] },
    ],
    retours:{
      s1:{ rendu:true,  dateRetour:'2025-09-20', reponses:{ opt1:'latin', opts:['dnl'] }, note:'' },
      s2:{ rendu:true,  dateRetour:'2025-09-22', reponses:{}, note:'illisible, à relancer' },   // rendu SANS réponse
      s3:{ rendu:false, dateRetour:null,         reponses:{ opt1:'bil' }, note:'' },           // réponse AVANT le papier (dit à l'oral)
    } };
  // Fiche de renseignement : retour seul, aucun champ.
  S.documents.d2 = { id:'d2', titre:'Fiche de renseignement', classIds:['5C','5D'], dateDistribution:'2025-09-02', dateEcheance:null,
    suiviRetour:true, archive:false, ord:1, champs:[], retours:{ s1:{rendu:true,dateRetour:'2025-09-03',reponses:{},note:''} } };
  // Information pure : pas de suivi du retour.
  S.documents.d3 = { id:'d3', titre:'Règlement', classIds:['5C'], dateDistribution:'2025-09-02', dateEcheance:null,
    suiviRetour:false, archive:false, ord:2, champs:[], retours:{} };`;

test('_docExpected : les élèves des classes du document, présents à la date de référence', () => {
  ev(FIXTURE);
  // s4 est parti le 10/09, avant la distribution du 15/09 : on ne l'attend pas.
  assert.deepStrictEqual([...ev(`_docExpected(S.documents.d1).map(s => s.id)`)], ['s1', 's2', 's3']);
  // d2 couvre deux classes ; distribué le 02/09, s4 était encore là.
  assert.deepStrictEqual([...ev(`_docExpected(S.documents.d2).map(s => s.id)`)].sort(), ['s1', 's2', 's3', 's4', 's5']);
});

test('_docStats : rendus / attendus, et réponses manquantes = ce qu\'on attend des FAMILLES', () => {
  ev(FIXTURE);
  const st = evObj(`_docStats(S.documents.d1)`);
  assert.strictEqual(st.attendus, 3);
  assert.strictEqual(st.rendus, 2);
  assert.deepStrictEqual(st.manquants, ['s3']);
  // Réponses manquantes : champ obligatoire famille (opt1) sans réponse. s2 n'a rien
  // répondu → 1. « Autres » n'est pas obligatoire, « Avis PP » est un champ PROF :
  // ni l'un ni l'autre ne compte — sinon le document serait éternellement incomplet.
  assert.strictEqual(st.reponsesManquantes, 1);
  assert.deepStrictEqual(st.sansReponse, ['s2']);
  // Avis du PP en attente, compté À PART.
  assert.strictEqual(st.avisManquants, 3);
});

test('_docStats : un champ PROF facultatif ne compte pas dans les avis manquants', () => {
  ev(FIXTURE);
  // Un second avis, facultatif — typiquement « Avis PP option 2 », qui n'a de sens que
  // si une deuxième option a été demandée. Le compter ferait de « N avis » du bruit :
  // presque tous les élèves y figureraient sans qu'il y ait rien à faire.
  ev(`S.documents.d1.champs.push({ id:'avis2', label:'Avis PP option 2', type:'choix', par:'prof',
        obligatoire:false, options:[{id:'fav',label:'Favorable',color:'#27ae60'}] })`);
  assert.strictEqual(evObj(`_docStats(S.documents.d1)`).avisManquants, 3);
  // Rendu obligatoire, il compte de nouveau — et personne ne l'a renseigné.
  ev(`S.documents.d1.champs.find(c => c.id === 'avis2').obligatoire = true;
      docSetReponse(S.documents.d1, 's1', 'avis', 'fav'); docSetReponse(S.documents.d1, 's1', 'avis2', 'fav');`);
  assert.strictEqual(evObj(`_docStats(S.documents.d1)`).avisManquants, 2);
});

test('_docStats : document sans suivi du retour → pas de manquants', () => {
  ev(FIXTURE);
  const st = evObj(`_docStats(S.documents.d3)`);
  // Distribué le 02/09 : s4, parti le 10/09, était encore là → 4 attendus (pas 3).
  assert.strictEqual(st.attendus, 4);
  assert.strictEqual(st.rendus, null);
  assert.deepStrictEqual(st.manquants, []);
});

test('rendu et réponses sont deux axes indépendants', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_retour(S.documents.d1, 's2').rendu`), true);
  assert.strictEqual(ev(`_retour(S.documents.d1, 's2').reponses.opt1`), undefined);   // rendu, rien coché
  assert.strictEqual(ev(`_retour(S.documents.d1, 's3').rendu`), false);
  assert.strictEqual(ev(`_retour(S.documents.d1, 's3').reponses.opt1`), 'bil');       // pas rendu, réponse connue
  // Un retour absent renvoie un défaut complet, sans écrire dans le document.
  assert.deepStrictEqual(evObj(`_retour(S.documents.d1, 's9')`), { rendu: false, dateRetour: null, reponses: {}, note: '' });
  assert.strictEqual(ev(`'s9' in S.documents.d1.retours`), false);
});

test('docSetRendu : date du jour posée au premier rendu, effacée quand on décoche', () => {
  ev(FIXTURE);
  ev(`docSetRendu(S.documents.d1, 's3', true)`);
  assert.strictEqual(ev(`S.documents.d1.retours.s3.rendu`), true);
  assert.strictEqual(ev(`S.documents.d1.retours.s3.dateRetour`), ev(`_todayYmd()`));
  assert.strictEqual(ev(`S.documents.d1.retours.s3.reponses.opt1`), 'bil');   // la réponse survit
  ev(`docSetRendu(S.documents.d1, 's3', false)`);
  assert.strictEqual(ev(`S.documents.d1.retours.s3.dateRetour`), null);
  // Une date déjà saisie n'est pas remplacée par celle du jour.
  ev(`docSetRendu(S.documents.d1, 's1', false); docSetRendu(S.documents.d1, 's1', true)`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), ev(`_todayYmd()`));
  ev(`S.documents.d1.retours.s1.dateRetour = '2025-09-20'; docSetRendu(S.documents.d1, 's1', true)`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2025-09-20');
});

test('docSetReponse : choix unique (string ou null), choix multiple (tableau, bascule)', () => {
  ev(FIXTURE);
  ev(`docSetReponse(S.documents.d1, 's2', 'opt1', 'latin')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s2.reponses.opt1`), 'latin');
  ev(`docSetReponse(S.documents.d1, 's2', 'opt1', '')`);
  assert.strictEqual(ev(`'opt1' in S.documents.d1.retours.s2.reponses`), false);     // vide = réponse retirée
  assert.strictEqual(ev(`docSetReponse(S.documents.d1, 's2', 'opt1', 'inconnue')`), false);   // option inexistante refusée
  ev(`docToggleReponse(S.documents.d1, 's1', 'opts', 'catho')`);
  assert.deepStrictEqual([...ev(`S.documents.d1.retours.s1.reponses.opts`)], ['dnl', 'catho']);
  ev(`docToggleReponse(S.documents.d1, 's1', 'opts', 'dnl')`);
  assert.deepStrictEqual([...ev(`S.documents.d1.retours.s1.reponses.opts`)], ['catho']);
  ev(`docToggleReponse(S.documents.d1, 's1', 'opts', 'catho')`);
  assert.strictEqual(ev(`'opts' in S.documents.d1.retours.s1.reponses`), false);     // plus rien → clé retirée
  assert.strictEqual(ev(`docSetReponse(S.documents.d1, 's1', 'champ_inconnu', 'x')`), false);
});

test('docDuplicate : mêmes champs et options, retours VIDES, dates remises à zéro', () => {
  ev(FIXTURE);
  const r = evObj(`(() => { const d = docDuplicate('d1'); return { id: d.id, titre: d.titre, champs: d.champs.length, opts: d.champs[0].options.map(o => o.id), retours: Object.keys(d.retours), dist: d.dateDistribution, ech: d.dateEcheance, cls: d.classIds, n: Object.keys(S.documents).length, distinct: d.champs !== S.documents.d1.champs }; })()`);
  assert.notStrictEqual(r.id, 'd1');
  assert.strictEqual(r.titre, 'Fiche d\'orientation (copie)');
  assert.strictEqual(r.champs, 3);
  assert.deepStrictEqual(r.opts, ['latin', 'bil']);
  assert.deepStrictEqual(r.retours, []);
  assert.strictEqual(r.dist, null);
  assert.strictEqual(r.ech, null);
  assert.deepStrictEqual(r.cls, ['5C']);
  assert.strictEqual(r.n, 4);
  assert.strictEqual(r.distinct, true);   // copie profonde : modifier la copie ne touche pas l'original
});

test('_champParseOptions : « OUI, NON, ULYSS » → options aux ids stables, couleurs conservées', () => {
  const a = evObj(`_champParseOptions('OUI, NON, ULYSS', [])`);
  assert.deepStrictEqual(a.map(o => [o.id, o.label]), [['oui', 'OUI'], ['non', 'NON'], ['ulyss', 'ULYSS']]);
  assert.ok(a.every(o => /^#[0-9a-f]{6}$/i.test(o.color)));
  // Re-saisie avec une option renommée et une ajoutée : les ids et couleurs des options
  // gardées survivent — sinon toutes les réponses déjà cochées deviendraient orphelines.
  const b = evObj(`_champParseOptions('OUI ; NON ; Peut-être', ${JSON.stringify(a)})`);
  assert.strictEqual(b[0].id, 'oui'); assert.strictEqual(b[0].color, a[0].color);
  assert.strictEqual(b[2].id, 'peut-etre');
  // Doublons de libellé → ids distincts, jamais deux options au même id.
  const c = evObj(`_champParseOptions('A, a, A', [])`);
  assert.deepStrictEqual(c.map(o => o.id), ['a', 'a-2', 'a-3']);
  assert.deepStrictEqual(evObj(`_champParseOptions('   ', [])`), []);
});

test('_docMissingText : la liste des manquants, prête à coller pour la vie scolaire', () => {
  ev(FIXTURE);
  const t = ev(`_docMissingText(S.documents.d1)`);
  assert.match(t, /Fiche d'orientation/);
  assert.match(t, /1 manquant/);
  assert.match(t, /PETIT Inès/);
  assert.doesNotMatch(t, /DURAND/);
  assert.doesNotMatch(t, /ROUX/);   // parti : pas attendu, pas relancé
});

test('_docTemplates : les trois formes réelles, dont Devoirs Faits à TROIS options', () => {
  const t = evObj(`_docTemplates()`);
  const df = t.find(x => /Devoirs Faits/i.test(x.titre));
  assert.ok(df);
  assert.strictEqual(df.champs.length, 1);
  assert.deepStrictEqual(df.champs[0].options.map(o => o.label), ['OUI', 'NON', 'ULYSS']);
  assert.ok(t.find(x => /renseignement/i.test(x.titre) && x.champs.length === 0));
  const or = t.find(x => /orientation/i.test(x.titre));
  assert.ok(or.champs.some(c => c.par === 'prof'));
});

test('_purgeClassRefs : un document partagé survit amputé, un document orphelin disparaît', () => {
  ev(FIXTURE);
  ev(`_purgeClassRefs('5C')`);
  assert.strictEqual(ev(`'d1' in S.documents`), false);
  assert.strictEqual(ev(`'d3' in S.documents`), false);
  assert.deepStrictEqual([...ev(`S.documents.d2.classIds`)], ['5D']);
  assert.deepStrictEqual([...ev(`_auditState()`)], []);
});

// docMove : réordonner la liste affichée des documents de la classe courante.
//
// a et b partagent le même ord (0), c et d partagent le même ord (1) : c'est le piège
// principal — deux documents créés dans le même lot sans jamais être déplacés depuis.
// c est en plus ARCHIVÉ, donc masqué par défaut, et intercalé entre b et d dans l'ordre
// brut : il ne doit ni être sauté ni bougé quand on déplace un document visible autour
// de lui. Ordre brut par (ord, titre) : a(0,Alpha) · b(0,Bravo) · c(1,Charlie) · d(1,Delta).
// Ordre AFFICHÉ (c masqué) : a · b · d.
const FIXTURE_MOVE = `S = _emptyState(); postLoadHook();
  S.cur = '5C';
  const _mkDoc = (id, titre, ord, archive) => ({ id, titre, classIds:['5C'], archive, ord, suiviRetour:true, champs:[], retours:{} });
  S.documents.a = _mkDoc('a', 'Alpha',   0, false);
  S.documents.b = _mkDoc('b', 'Bravo',   0, false);
  S.documents.c = _mkDoc('c', 'Charlie', 1, true);
  S.documents.d = _mkDoc('d', 'Delta',   1, false);
  _docShowArchived = false;`;

// Ordres bruts (avec l'archivé) et affichés (sans), pour ne pas répéter le filtre partout.
const _rawOrder = () => [...ev(`_docsOfCurrent().map(d => d.id)`)];
const _shownOrder = () => [...ev(`_docsOfCurrent().filter(d => _docShowArchived || !d.archive).map(d => d.id)`)];
const _ords = () => evObj(`Object.fromEntries(Object.entries(S.documents).map(([k, d]) => [k, d.ord]))`);

test('docMove : descendre renumérote d\'abord (ord dupliqués), puis échange — l\'archivé masqué ne bouge pas', () => {
  ev(FIXTURE_MOVE);
  assert.deepStrictEqual(_shownOrder(), ['a', 'b', 'd']);
  const before = ev(`undoStack.length`);
  ev(`docMove('b', 1)`);
  assert.strictEqual(ev(`undoStack.length`), before + 1);   // pushUndo() a bien eu lieu
  // b descend d'un cran dans la liste AFFICHÉE : il passe après d.
  assert.deepStrictEqual(_shownOrder(), ['a', 'd', 'b']);
  // c, masqué, garde sa place RELATIVE dans l'ordre brut (entre d et b) : il n'a pas
  // été sauté par l'échange, et n'a pas non plus été déplacé lui-même.
  assert.deepStrictEqual(_rawOrder(), ['a', 'd', 'c', 'b']);
  assert.strictEqual(ev(`S.documents.c.titre`), 'Charlie');
  assert.strictEqual(ev(`S.documents.c.archive`), true);
  // Aucun doublon d'ord : c'est l'invariant qui empêche le prochain déplacement d'être
  // un coup dans l'eau (deux ords identiques ne s'échangeraient à rien).
  const ords = Object.values(_ords());
  assert.strictEqual(new Set(ords).size, ords.length);
  // save() a bien écrit l'état renuméroté sur le disque local.
  const persisted = evObj(`JSON.parse(localStorage.getItem(LS_KEY)).documents`);
  assert.deepStrictEqual(_ords(), Object.fromEntries(Object.entries(persisted).map(([k, d]) => [k, d.ord])));
});

test('docMove : monter — même piège des ords dupliqués, sur la paire (a, b)', () => {
  ev(FIXTURE_MOVE);
  ev(`docMove('b', -1)`);
  // b monte d'un cran : il passe avant a.
  assert.deepStrictEqual(_shownOrder(), ['b', 'a', 'd']);
  assert.deepStrictEqual(_rawOrder(), ['b', 'a', 'c', 'd']);
  const ords = Object.values(_ords());
  assert.strictEqual(new Set(ords).size, ords.length);
});

test('docMove : aux extrémités, RIEN ne se passe — ni mutation, ni pushUndo', () => {
  ev(FIXTURE_MOVE);
  const before = _ords();
  const stackLen = ev(`undoStack.length`);
  ev(`docMove('a', -1)`);   // monter le premier de la liste affichée
  ev(`docMove('d', 1)`);    // descendre le dernier de la liste affichée
  assert.strictEqual(ev(`undoStack.length`), stackLen);
  // Les ords dupliqués d'origine sont encore là : même une extrémité ne renumérote pas.
  assert.deepStrictEqual(_ords(), before);
  assert.deepStrictEqual(_shownOrder(), ['a', 'b', 'd']);
});

test('docMove : un id inconnu ne fait rien', () => {
  ev(FIXTURE_MOVE);
  const before = _ords();
  const stackLen = ev(`undoStack.length`);
  ev(`docMove('inconnu', 1)`);
  assert.strictEqual(ev(`undoStack.length`), stackLen);
  assert.deepStrictEqual(_ords(), before);
});

test('docMove : undoLast() rétablit l\'ordre précédent, y compris les ords dupliqués', () => {
  ev(FIXTURE_MOVE);
  const before = _ords();
  ev(`docMove('b', 1)`);
  assert.notDeepStrictEqual(_ords(), before);   // sanity : le déplacement a bien eu lieu
  ev(`undoLast()`);
  assert.deepStrictEqual(_ords(), before);
  assert.deepStrictEqual(_shownOrder(), ['a', 'b', 'd']);
});

// docReorder : généralise docMove pour le glisser-déposer, qui peut traverser plusieurs
// lignes d'un coup — docMove ne décale que d'un cran (dir = ±1), docReorder pose le
// document à un index absolu de la liste AFFICHÉE.
//
// Quatre documents tous VISIBLES (aucun archivé), ords dupliqués comme dans FIXTURE_MOVE
// (même piège : deux documents créés dans le même lot, jamais déplacés depuis). Ordre
// brut = ordre affiché ici, et l'un et l'autre valent l'ordre des ids : w(0,Whiskey) ·
// x(0,X-ray) · y(1,Yankee) · z(1,Zulu) — le tri par (ord, titre) ne mélange pas les
// lettres. Réutilise _rawOrder / _shownOrder / _ords, déjà génériques (ils relisent
// _docsOfCurrent() et _docShowArchived à chaque appel, pas seulement pour docMove).
const FIXTURE_REORDER = `S = _emptyState(); postLoadHook();
  S.cur = '5C';
  const _mkDoc = (id, titre, ord, archive) => ({ id, titre, classIds:['5C'], archive, ord, suiviRetour:true, champs:[], retours:{} });
  S.documents.w = _mkDoc('w', 'Whiskey', 0, false);
  S.documents.x = _mkDoc('x', 'X-ray',   0, false);
  S.documents.y = _mkDoc('y', 'Yankee',  1, false);
  S.documents.z = _mkDoc('z', 'Zulu',    1, false);
  _docShowArchived = false;`;

test('docReorder : descendre de plusieurs crans — retire PUIS réinsère, ne pas confondre avec un échange', () => {
  ev(FIXTURE_REORDER);
  assert.deepStrictEqual(_shownOrder(), ['w', 'x', 'y', 'z']);
  // Les ords sont dupliqués au départ, exactement le piège de docMove.
  assert.deepStrictEqual(_ords(), { w: 0, x: 0, y: 1, z: 1 });
  const before = ev(`undoStack.length`);
  ev(`docReorder('w', 2)`);
  assert.strictEqual(ev(`undoStack.length`), before + 1);   // pushUndo() a bien eu lieu
  // w quitte l'index 0 et se retrouve à l'index 2 : ['x','y','w','z'].
  // Un simple ÉCHANGE des valeurs aux index 0 et 2 aurait donné ['y','x','w','z']
  // (x et y ne bougent pas l'un par rapport à l'autre) — ce n'est PAS ce qui est attendu :
  // w se glisse ENTRE x et y, comme un glisser-déposer qui traverse ces deux lignes.
  assert.deepStrictEqual(_shownOrder(), ['x', 'y', 'w', 'z']);
  assert.notDeepStrictEqual(_shownOrder(), ['y', 'x', 'w', 'z']);   // le résultat d'un échange, rejeté explicitement
  // Aucun ord en double après coup : le prochain glisser-déposer doit pouvoir se fier
  // à des ords tous distincts pour recalculer un index sans ambiguïté.
  const ords = Object.values(_ords());
  assert.strictEqual(new Set(ords).size, ords.length);
});

test('docReorder : monter de plusieurs crans — même piège des ords dupliqués', () => {
  ev(FIXTURE_REORDER);
  ev(`docReorder('z', 0)`);
  // z quitte la fin et se retrouve en tête : ['z','w','x','y'].
  assert.deepStrictEqual(_shownOrder(), ['z', 'w', 'x', 'y']);
  const ords = Object.values(_ords());
  assert.strictEqual(new Set(ords).size, ords.length);
  // save() a bien écrit l'état renuméroté sur le disque local, comme docMove.
  const persisted = evObj(`JSON.parse(localStorage.getItem(LS_KEY)).documents`);
  assert.deepStrictEqual(_ords(), Object.fromEntries(Object.entries(persisted).map(([k, d]) => [k, d.ord])));
});

test('docReorder : toIndex hors bornes est ramené dans [0, longueur-1], dans les deux sens', () => {
  ev(FIXTURE_REORDER);
  // Très au-delà de la fin (99) → ramené à l'index 3, le dernier : w termine la liste.
  ev(`docReorder('w', 99)`);
  assert.deepStrictEqual(_shownOrder(), ['x', 'y', 'z', 'w']);
  ev(FIXTURE_REORDER);
  // Très négatif (-5) → ramené à l'index 0, le premier : z passe en tête.
  ev(`docReorder('z', -5)`);
  assert.deepStrictEqual(_shownOrder(), ['z', 'w', 'x', 'y']);
});

test('docReorder : trois cas sans effet — même index, id inconnu, document archivé masqué', () => {
  ev(FIXTURE_REORDER);
  const before = _ords();
  const stackLen = ev(`undoStack.length`);
  // x est déjà à l'index 1 : le reposer au même endroit ne doit rien déclencher.
  ev(`docReorder('x', 1)`);
  ev(`docReorder('inconnu', 0)`);
  assert.strictEqual(ev(`undoStack.length`), stackLen);
  assert.deepStrictEqual(_ords(), before);
  assert.deepStrictEqual(_shownOrder(), ['w', 'x', 'y', 'z']);

  // Document archivé et masqué (comme dans FIXTURE_MOVE) : absent de la liste AFFICHÉE,
  // il ne doit jamais bouger — ni être choisi comme cible, ni voir son ord renuméroté.
  ev(FIXTURE_MOVE);
  const beforeArch = _ords();
  const stackLenArch = ev(`undoStack.length`);
  ev(`docReorder('c', 0)`);
  assert.strictEqual(ev(`undoStack.length`), stackLenArch);
  assert.deepStrictEqual(_ords(), beforeArch);   // ords dupliqués d'origine encore là : pas de renumérotation dans le vide
  assert.deepStrictEqual(_shownOrder(), ['a', 'b', 'd']);
  assert.strictEqual(ev(`S.documents.c.archive`), true);
});

test('docReorder : undoLast() rétablit exactement l\'ordre et les ords précédents', () => {
  ev(FIXTURE_REORDER);
  const before = _ords();
  ev(`docReorder('w', 2)`);
  assert.notDeepStrictEqual(_ords(), before);   // sanity : le déplacement a bien eu lieu
  ev(`undoLast()`);
  assert.deepStrictEqual(_ords(), before);
  assert.deepStrictEqual(_shownOrder(), ['w', 'x', 'y', 'z']);
});
