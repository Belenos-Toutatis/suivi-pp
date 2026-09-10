// Ordre de « ramassage » d'après le placement — trier une liste d'élèves dans l'ordre
// où le professeur les rencontre en salle, plutôt que dans l'ordre alphabétique.
//
// ⚠️ Ceci n'est PAS le plan de salle : dessiner une salle, placer des élèves par
// glisser-déposer, gérer les îlots... tout cela reste dans « Plan de classe » et est
// explicitement hors périmètre ici (cf. CLAUDE.md, « Hors périmètre »). Ce que cette
// app importe, c'est le RÉSULTAT figé d'un placement déjà fait ailleurs (`S.salles`,
// `cls.rooms[salleId].seating`) et les « patterns de ramassage » qui vont avec — pour
// s'en servir une seule fois : trier. Aucune fonction ici ne modifie un placement.
//
// Deux pièges structurent ces tests :
//
// 1. Les positions sont des chaînes `"rang,colonne"`. Comparer ces chaînes comme du
//    TEXTE trie `'10,0'` avant `'2,0'` et avant `'9,0'` (le caractère '1' bat '2' et
//    '9') — une salle de plus de neuf rangs suffit à casser un tri lexical. La
//    comparaison doit être NUMÉRIQUE sur chaque composante. Un test dédié plante le
//    piège avec des noms délibérément inversés par rapport à l'ordre alphabétique,
//    pour qu'un repli accidentel sur le nom ne puisse pas maquiller un tri cassé.
//
// 2. L'INVARIANT central : un tri qui perd un élève le fait disparaître de la grille
//    de ramassage, et on ne réclame pas un papier à quelqu'un qu'on ne voit pas. Toute
//    fonction de tri ici doit rendre exactement le même ensemble d'ids que celui reçu
//    — même cardinal, aucun doublon — quel que soit le mode. Un élève sans place ou
//    hors d'un pattern n'est jamais perdu : il est simplement rejeté en fin de liste,
//    trié alphabétiquement, pour rester visible et actionnable.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Vérifie l'invariant central, indépendamment du mode testé : même ensemble d'ids,
// même cardinal, aucun doublon. C'est la seule propriété qu'AUCUN mode n'a le droit
// de violer — un mode qui « oublierait » un élève serait pire qu'un mauvais tri.
function assertSameIds(sids, result, msg) {
  assert.strictEqual(result.length, sids.length, msg || 'aucun élève perdu ni ajouté');
  assert.strictEqual(new Set(result).size, result.length, msg || 'aucun doublon');
  assert.deepStrictEqual([...result].sort(), [...sids].sort(), msg || 'même ensemble d\'ids');
}

// ─────────────────────── Fixture ───────────────────────
//
// Salle A101 (3 × 3) : sert aux tests d'ordre de lecture et de pattern.
//   0,0 s1   0,1 s2   0,2 s3
//   1,0 s4   1,1 ∅    1,2 s5
//   2,0 s99  2,1 s6   2,2 ∅
// s99 occupe une place mais n'existe dans AUCUNE des listes `sids` testées ici : il
// simule une place occupée par un élève qu'on ne cherche pas à ramasser (ex. élève
// d'un autre groupe assis provisoirement là). s7, sA, sM, sZ n'ont pas de place en A101.
//
// Salle GYM (11 × 1), colonne unique : sert UNIQUEMENT au piège numérique. Les noms
// sont volontairement inversés par rapport à l'ordre des places (ALFA/MIKE/ZULU en
// alphabétique, mais ZULU est assis le plus tôt) : si le tri retombait par erreur sur
// l'alphabet, ou sur une comparaison lexicale des positions, l'écart serait immédiat.
//   2,0 sZ (ZULU)   9,0 sM (MIKE)   10,0 sA (ALFA)
//
// Salle VIDE : déclarée dans S.salles, mais la classe n'y a jamais rien placé —
// « salle sans placement ».
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = {
    id:'5C', nom:'5C', annee:'2025-26', ord:0, salleCur:'A101',
    eleves:['s1','s2','s3','s4','s5','s6','s7','s8','sA','sM','sZ'],
    rooms: {
      A101: { seating: { '0,0':'s1', '0,1':'s2', '0,2':'s3', '1,0':'s4', '1,2':'s5', '2,0':'s99', '2,1':'s6' } },
      GYM:  { seating: { '2,0':'sZ', '9,0':'sM', '10,0':'sA' } },
    },
  };
  S.salles = {
    A101: { id:'A101', nom:'Salle 101', rows:3, cols:3, patterns: [
      // Un serpentin : ligne 0 de gauche à droite, ligne 1 de droite à gauche, ligne 2
      // de gauche à droite. Volontairement PAS l'ordre de lecture (qui irait
      // 1,0 puis 1,2 ; ici c'est 1,2 puis 1,0) — c'est tout l'intérêt du pattern.
      { id:'serpentin', nom:'Serpentin', order:['0,0','0,1','0,2','1,2','1,1','1,0','2,0','2,1','2,2'] },
      // Un pattern qui ne couvre QUE le premier rang — le reste de la salle est
      // « hors pattern », donc rejeté en fin de liste.
      { id:'partiel', nom:'Rang du fond seulement', order:['0,0','0,1','0,2'] },
    ] },
    GYM:  { id:'GYM', nom:'Gymnase', rows:11, cols:1, patterns:[] },
    VIDE: { id:'VIDE', nom:'Salle non affectée', rows:2, cols:2, patterns:[] },
  };
  S.eleves = {
    s1:{id:'s1',nom:'ALPHA',  prenom:'Ana', classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'BETA',   prenom:'Bo',  classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'GAMMA',  prenom:'Cy',  classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'DELTA',  prenom:'Di',  classe_id:'5C',tags:[]},
    s5:{id:'s5',nom:'EPSILON',prenom:'Eve', classe_id:'5C',tags:[]},
    s6:{id:'s6',nom:'ZETA',   prenom:'Zoe', classe_id:'5C',tags:[]},
    s7:{id:'s7',nom:'ETA',    prenom:'Theo',classe_id:'5C',tags:[]},
    s8:{id:'s8',nom:'ARVO',   prenom:'Bo',  classe_id:'5C',tags:[]},
    sA:{id:'sA',nom:'ALFA',   prenom:'Ali', classe_id:'5C',tags:[]},
    sM:{id:'sM',nom:'MIKE',   prenom:'Mia', classe_id:'5C',tags:[]},
    sZ:{id:'sZ',nom:'ZULU',   prenom:'Zed', classe_id:'5C',tags:[]},
  };`;

// ─────────────────────── _seatOf ───────────────────────

test('_seatOf : rend la place « r,c » d\'un élève assis, null sinon', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'A101', 's1')`), '0,0');
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'GYM', 'sM')`), '9,0');
  // s7 n'a de place dans AUCUNE des deux salles.
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'A101', 's7')`), null);
});

test('_seatOf : replis null — salle inconnue, salle sans placement, salleId null', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'FANTOME', 's1')`), null);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], 'VIDE', 's1')`), null);
  assert.strictEqual(ev(`_seatOf(S.classes['5C'], null, 's1')`), null);
});

// ─────────────────────── _orderByPlace : ordre de lecture ───────────────────────

test('_orderByPlace : rang par rang, gauche à droite — places vides et hors-liste sautées', () => {
  ev(FIXTURE);
  // Ordre d'entrée mélangé à dessein : la fonction doit reconstruire l'ordre, pas
  // recopier celui qu'on lui donne.
  const sids = ['s6', 's1', 's5', 's3', 's2', 's4', 's7'];
  const out = evObj(`_orderByPlace(S.classes['5C'], 'A101', ${JSON.stringify(sids)})`);
  // 1,1 (vide) et 2,0 (occupée par s99, hors liste) sont sautées sans laisser de trou ;
  // s7 (aucune place) est rejeté en toute fin de liste.
  assert.deepStrictEqual(out, ['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
  assertSameIds(sids, out);
});

test('_orderByPlace : le piège du tri lexical — « 10,0 » vient bien APRÈS « 9,0 »', () => {
  ev(FIXTURE);
  // Les noms sont inversés par rapport à l'ordre des places : un repli alphabétique
  // accidentel donnerait sA, sM, sZ — l'exact inverse du bon résultat.
  const sids = ['sA', 'sZ', 'sM'];
  const out = evObj(`_orderByPlace(S.classes['5C'], 'GYM', ${JSON.stringify(sids)})`);
  assert.deepStrictEqual(out, ['sZ', 'sM', 'sA'],
    'rang 2 < rang 9 < rang 10 en numérique — un tri textuel aurait mis "10,0" avant "9,0" ou "2,0"');
  assertSameIds(sids, out);
});

test('_orderByPlace : une place occupée par un élève absent de la liste est ignorée, pas recopiée', () => {
  ev(FIXTURE);
  // s99 est assis en 2,0 mais n'est pas demandé : il ne doit apparaître nulle part
  // dans le résultat, et sa place ne doit pas non plus « sauter » un élève demandé.
  const sids = ['s1', 's6'];
  const out = evObj(`_orderByPlace(S.classes['5C'], 'A101', ${JSON.stringify(sids)})`);
  assert.deepStrictEqual(out, ['s1', 's6']);
  assert.ok(!out.includes('s99'), 's99 ne fait pas partie de la demande : il ne doit jamais apparaître');
});

test('_orderByPlace : plusieurs élèves sans place sont rejetés en fin de liste, triés alphabétiquement', () => {
  ev(FIXTURE);
  // Aucun des trois n'a de place en A101.
  const sids = ['sM', 'sA', 's7'];
  const out = evObj(`_orderByPlace(S.classes['5C'], 'A101', ${JSON.stringify(sids)})`);
  assert.deepStrictEqual(out, ['sA', 's7', 'sM'], 'ALFA < ETA < MIKE');
  assertSameIds(sids, out);
});

test('_orderByPlace : replis alphabétiques — salle inconnue, salle sans placement, salleId null', () => {
  ev(FIXTURE);
  const sids = ['s6', 's1', 's3'];
  const alpha = ['s1', 's3', 's6']; // ALPHA, GAMMA, ZETA
  assert.deepStrictEqual(evObj(`_orderByPlace(S.classes['5C'], 'FANTOME', ${JSON.stringify(sids)})`), alpha);
  assert.deepStrictEqual(evObj(`_orderByPlace(S.classes['5C'], 'VIDE', ${JSON.stringify(sids)})`), alpha);
  assert.deepStrictEqual(evObj(`_orderByPlace(S.classes['5C'], null, ${JSON.stringify(sids)})`), alpha);
});

// ─────────────────────── _orderByPattern ───────────────────────

test('_orderByPattern : suit l\'ordre du pattern, PAS l\'ordre de lecture', () => {
  ev(FIXTURE);
  const sids = ['s7', 's4', 's1', 's6', 's5', 's3', 's2'];
  const out = evObj(`_orderByPattern(S.classes['5C'], 'A101', 'serpentin', ${JSON.stringify(sids)})`);
  // Le serpentin visite 1,2 (s5) avant 1,0 (s4) — inverse de la lecture, qui donnerait
  // s4 avant s5. C'est la preuve que le pattern est vraiment suivi et pas juste
  // « rang par rang » sous un autre nom. s99 (2,0) est hors liste : sauté. s7 (aucune
  // place) est hors pattern : rejeté en fin de liste.
  assert.deepStrictEqual(out, ['s1', 's2', 's3', 's5', 's4', 's6', 's7']);
  assertSameIds(sids, out);
});

test('_orderByPattern : un pattern qui ne couvre qu\'une partie de la salle rejette le reste, trié', () => {
  ev(FIXTURE);
  const sids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
  const out = evObj(`_orderByPattern(S.classes['5C'], 'A101', 'partiel', ${JSON.stringify(sids)})`);
  // Le pattern ne porte que sur le rang 0 : s1, s2, s3. Les quatre autres (aucun
  // n'apparaît dans `order`) sont rejetés en fin de liste, triés alphabétiquement :
  // DELTA, EPSILON, ETA, ZETA.
  assert.deepStrictEqual(out, ['s1', 's2', 's3', 's4', 's5', 's7', 's6']);
  assertSameIds(sids, out);
});

test('_orderByPattern : replis alphabétiques — pattern inconnu, salle inconnue, salleId null', () => {
  ev(FIXTURE);
  const sids = ['s6', 's1', 's3'];
  const alpha = ['s1', 's3', 's6'];
  assert.deepStrictEqual(evObj(`_orderByPattern(S.classes['5C'], 'A101', 'patternFantome', ${JSON.stringify(sids)})`), alpha);
  assert.deepStrictEqual(evObj(`_orderByPattern(S.classes['5C'], 'FANTOME', 'serpentin', ${JSON.stringify(sids)})`), alpha);
  assert.deepStrictEqual(evObj(`_orderByPattern(S.classes['5C'], null, 'serpentin', ${JSON.stringify(sids)})`), alpha);
});

// ─────────────────────── _sortStudents ───────────────────────

test('_sortStudents : mode "nom" — nom puis prénom', () => {
  ev(FIXTURE);
  const sids = ['s6', 's2', 's8', 's1'];
  const out = evObj(`_sortStudents(${JSON.stringify(sids)}, 'nom', S.classes['5C'])`);
  assert.deepStrictEqual(out, ['s1', 's8', 's2', 's6'], 'ALPHA, ARVO, BETA, ZETA');
});

test('_sortStudents : mode "prenom" — prénom puis nom en cas d\'égalité', () => {
  ev(FIXTURE);
  // s2 (BETA/Bo) et s8 (ARVO/Bo) partagent le même prénom : seul le nom les départage.
  const out = evObj(`_sortStudents(['s2', 's8'], 'prenom', S.classes['5C'])`);
  assert.deepStrictEqual(out, ['s8', 's2'], 'même prénom "Bo" : ARVO avant BETA');
});

test('_sortStudents : mode "place" — délègue à _orderByPlace sur la salle COURANTE de la classe', () => {
  ev(FIXTURE);
  const sids = ['s3', 's1', 's2'];
  assert.deepStrictEqual(evObj(`_sortStudents(${JSON.stringify(sids)}, 'place', S.classes['5C'])`), ['s1', 's2', 's3']);
});

test('_sortStudents : mode "place" suit VRAIMENT salleCur, pas une salle codée en dur', () => {
  ev(FIXTURE);
  // On bascule la salle courante sur le gymnase : le tri doit changer en conséquence
  // et retrouver le résultat du piège numérique vu plus haut.
  ev(`S.classes['5C'].salleCur = 'GYM'`);
  const out = evObj(`_sortStudents(['sA', 'sZ', 'sM'], 'place', S.classes['5C'])`);
  assert.deepStrictEqual(out, ['sZ', 'sM', 'sA']);
});

test('_sortStudents : mode "place" sans salle courante utilisable retombe sur l\'alphabet', () => {
  ev(FIXTURE);
  ev(`S.classes['5C'].salleCur = null`);
  const sids = ['s6', 's1', 's3'];
  assert.deepStrictEqual(evObj(`_sortStudents(${JSON.stringify(sids)}, 'place', S.classes['5C'])`), ['s1', 's3', 's6']);
});

test('_sortStudents : mode "pat-<id>" — délègue à _orderByPattern sur la salle courante', () => {
  ev(FIXTURE);
  const sids = ['s7', 's4', 's1', 's6', 's5', 's3', 's2'];
  const out = evObj(`_sortStudents(${JSON.stringify(sids)}, 'pat-serpentin', S.classes['5C'])`);
  assert.deepStrictEqual(out, ['s1', 's2', 's3', 's5', 's4', 's6', 's7']);
});

test('_sortStudents : un mode inconnu retombe sur "nom"', () => {
  ev(FIXTURE);
  const sids = ['s6', 's1'];
  assert.deepStrictEqual(
    evObj(`_sortStudents(${JSON.stringify(sids)}, 'mode-qui-n-existe-pas', S.classes['5C'])`),
    evObj(`_sortStudents(${JSON.stringify(sids)}, 'nom', S.classes['5C'])`),
  );
  assert.deepStrictEqual(evObj(`_sortStudents(${JSON.stringify(sids)}, 'mode-qui-n-existe-pas', S.classes['5C'])`), ['s1', 's6']);
});

// ─────────────────── L'invariant, rejoué sur chaque mode ───────────────────

test('INVARIANT : même ensemble, même cardinal, aucun doublon — sur chaque mode de _sortStudents', () => {
  ev(FIXTURE);
  const sids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'sA', 'sM', 'sZ'];
  const modes = ['nom', 'prenom', 'place', 'pat-serpentin', 'pat-partiel', 'pat-fantome', 'mode-inconnu'];
  for (const mode of modes) {
    const out = evObj(`_sortStudents(${JSON.stringify(sids)}, ${JSON.stringify(mode)}, S.classes['5C'])`);
    assertSameIds(sids, out, `mode "${mode}" : ` + (out.length !== sids.length ? 'un élève a disparu' : 'ensemble incorrect'));
  }
});

test('MÉTA-TEST : assertSameIds détecte bien un id perdu ou dupliqué', () => {
  // Sans ce méta-test, un bug qui ferait disparaître ou doubler un élève dans TOUS les
  // tests ci-dessus pourrait passer inaperçu si assertSameIds elle-même ne détectait
  // rien — exactement le risque que le reste de ce fichier lui délègue.
  assert.throws(() => assertSameIds(['s1', 's2'], ['s1', 's1']), 'un doublon doit être détecté');
  assert.throws(() => assertSameIds(['s1', 's2'], ['s1']), 'un élève perdu doit être détecté');
  assert.doesNotThrow(() => assertSameIds(['s1', 's2'], ['s2', 's1']), 'un cas correct ne doit rien lever');
});

test('_sortModeNorm : un mode devenu caduc affiche « par nom », et n\'est pas oublié', () => {
  // ⚠️ Changer de salle rend caduc le pattern de la précédente. Le tri, lui, replie déjà
  // sur l'alphabétique — mais le menu continuait d'afficher « ramassage : Serpentin ».
  // L'écran mentait sur ce qu'il faisait : c'est le pire des deux mondes, parce qu'on ne
  // cherche pas la cause d'un ordre qu'on croit avoir demandé.
  ev(`S = _emptyState(); postLoadHook();
    S.salles = { sa1: { id:'sa1', nom:'A', rows:2, cols:2, patterns:[{id:'p1', nom:'Serpentin', order:['0,0','0,1']}] },
                 sa2: { id:'sa2', nom:'B', rows:2, cols:2, patterns:[] } };
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0,
      salleCur:'sa1', rooms:{ sa1:{ seating:{'0,0':'s1','0,1':'s2'} }, sa2:{ seating:{'1,1':'s2'} } } };
    S.eleves = { s1:{id:'s1',nom:'B',prenom:'x',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'A',prenom:'y',classe_id:'5C',tags:[]} };
    S.cur = '5C';`);
  const cls = `S.classes['5C']`;
  assert.strictEqual(ev(`_sortModeNorm('pat-p1', ${cls}, [])`), 'pat-p1', 'dans sa salle, le mode tient');
  ev(`${cls}.salleCur = 'sa2'`);
  assert.strictEqual(ev(`_sortModeNorm('pat-p1', ${cls}, [])`), 'nom', 'ailleurs, il retombe sur le nom');
  // …et le tri fait bien ce que le menu annonce : alphabétique, pas un ordre fantôme.
  assert.deepStrictEqual(evObj(`_sortStudents(['s1','s2'], 'pat-p1', ${cls})`), ['s2', 's1']);
  // Revenir dans la salle d'origine ressuscite le mode : on va et vient entre deux pièces.
  ev(`${cls}.salleCur = 'sa1'`);
  assert.strictEqual(ev(`_sortModeNorm('pat-p1', ${cls}, [])`), 'pat-p1');
  // Les modes propres à un écran (Δ, cumul…) ne sont jamais rabotés par la normalisation.
  assert.strictEqual(ev(`_sortModeNorm('delta', ${cls}, [{ key:'delta', label:'Δ' }])`), 'delta');
});

test('le SÉLECTEUR affiche le repli, pas seulement la fonction qui le calcule', () => {
  // ⚠️ Le test précédent vérifie `_sortModeNorm`. Il ne prouve PAS que l'écran l'appelle
  // — et un helper que rien n'utilise est du code mort qui certifie une garantie
  // inexistante. C'est exactement le défaut qu'on vient de corriger (`_sortModeOk`
  // écrit, jamais branché). On teste donc le HTML réellement produit.
  ev(`S = _emptyState(); postLoadHook();
    S.salles = { sa1: { id:'sa1', nom:'A', rows:2, cols:2, patterns:[{id:'p1', nom:'Serpentin', order:['0,0','0,1']}] },
                 sa2: { id:'sa2', nom:'B', rows:2, cols:2, patterns:[] } };
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0,
      salleCur:'sa1', rooms:{ sa1:{ seating:{'0,0':'s1','0,1':'s2'} }, sa2:{ seating:{'1,1':'s2'} } } };
    S.eleves = { s1:{id:'s1',nom:'B',prenom:'x',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'A',prenom:'y',classe_id:'5C',tags:[]} };
    S.cur = '5C';`);
  const cls = `S.classes['5C']`;
  const selectionne = html => (html.match(/<option value="([^"]+)" selected>/) || [])[1];
  assert.strictEqual(selectionne(ev(`_sortPickerHTML('pat-p1', 'x()', ${cls}, [])`)), 'pat-p1');
  ev(`${cls}.salleCur = 'sa2'`);
  assert.strictEqual(selectionne(ev(`_sortPickerHTML('pat-p1', 'x()', ${cls}, [])`)), 'nom',
    'le menu doit montrer « par nom » quand le pattern n\'existe pas dans cette salle');
  // Et le pattern caduc ne doit plus figurer parmi les choix proposés.
  assert.ok(!/pat-p1/.test(ev(`_sortPickerHTML('nom', 'x()', ${cls}, [])`)));
});
