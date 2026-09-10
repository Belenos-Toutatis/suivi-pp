// Suggestions de saisie tactile pour la grille des Carnets. _carnetSuggestions propose des
// cumuls probables (le cumul est monotone non décroissant : le plus probable est « rien de
// neuf », donc la valeur inchangée, puis de petits incréments). Écrit AVANT l'implémentation :
// la fonction n'existe pas encore, ces tests DOIVENT échouer (TypeError: _carnetSuggestions
// n'est pas une fonction) tant qu'elle n'est pas écrite.
//
// ⚠️ La fonction ne doit JAMAIS regarder la valeur déjà présente dans la cellule visée : on
// peut être en train de CORRIGER une saisie fautive, et proposer des incréments à partir
// d'une faute de frappe la propagerait (cf. CLAUDE.md, § Relevés de carnet).

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Même fixture que test/carnets.test.js : une classe 2025-26, trois élèves, huit relevés,
// les mêmes suites que le tableur réel (7·8·8·10·11·14·16·18), avec un 'A' intercalé, un
// vide, et un cumul qui DIMINUE (s3 : 6 → 4).
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'A',prenom:'a',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'B',prenom:'b',classe_id:'5C',tags:[]}, s3:{id:'s3',nom:'C',prenom:'c',classe_id:'5C',tags:[]} };
  S.cur = '5C';
  const put = (d, counts) => { S.releves['5C'][d] = { date:d, ts:1, counts }; };
  S.releves['5C'] = {};
  put('2025-10-01', { s1: 7,   s2: 10,  s3: 3 });
  put('2025-10-15', { s1: 8,   s2: 'A', s3: 3 });
  put('2025-11-05', { s1: 8,   s2: 14         });   // s3 : vide (pas relevé)
  put('2025-12-03', { s1: 10,  s2: 14,  s3: 6 });
  put('2026-01-14', { s1: 11,  s2: 15,  s3: 4 });   // s3 DIMINUE : 6 → 4
  put('2026-02-04', { s1: 14,  s2: 20,  s3: 'A' });
  put('2026-03-11', { s1: 16,  s2: 27,  s3: 9 });
  put('2026-04-08', { s1: 18,  s2: 38,  s3: 9 });`;

// Vérifie l'invariant de forme, quel que soit le cas : toujours 6 entrées, deltas 0..5
// dans l'ordre, valeurs strictement croissantes.
function assertShape(obj) {
  assert.strictEqual(obj.valeurs.length, 6, 'toujours 6 propositions');
  obj.valeurs.forEach((v, i) => assert.strictEqual(v.delta, i, `delta[${i}]`));
  for (let i = 1; i < obj.valeurs.length; i++) {
    assert.ok(obj.valeurs[i].valeur > obj.valeurs[i - 1].valeur,
      `valeurs strictement croissantes (${obj.valeurs[i - 1].valeur} puis ${obj.valeurs[i].valeur})`);
  }
}

// ─────────────────────────────────────────────── Cas nominal

test('_carnetSuggestions : cas nominal — base = dernier cumul chiffré antérieur, premier choix = inchangé', () => {
  ev(FIXTURE);
  // s1 au 15/10 : le seul relevé antérieur chiffré est le 01/10 (7).
  const r = evObj(`_carnetSuggestions('5C', '2025-10-15', 's1')`);
  assert.strictEqual(r.base, 7);
  assert.deepStrictEqual(r.valeurs, [
    { valeur: 7, delta: 0 }, { valeur: 8, delta: 1 }, { valeur: 9, delta: 2 },
    { valeur: 10, delta: 3 }, { valeur: 11, delta: 4 }, { valeur: 12, delta: 5 },
  ]);
  assertShape(r);
});

// ─────────────────────────────────────────────── Premier relevé (base null)

test('_carnetSuggestions : premier relevé chiffré d\'un élève — base null, delta = valeur elle-même', () => {
  ev(FIXTURE);
  // Une date antérieure à tout relevé connu de s1 (01/10 est le tout premier).
  const r = evObj(`_carnetSuggestions('5C', '2025-09-01', 's1')`);
  assert.strictEqual(r.base, null);
  assert.deepStrictEqual(r.valeurs, [
    { valeur: 0, delta: 0 }, { valeur: 1, delta: 1 }, { valeur: 2, delta: 2 },
    { valeur: 3, delta: 3 }, { valeur: 4, delta: 4 }, { valeur: 5, delta: 5 },
  ]);
  assertShape(r);
});

// ─────────────────────────────────────────────── Saut des 'A' et des vides

test('_carnetSuggestions saute les \'A\' pour retrouver la base — un absent ne doit pas remettre le compteur à zéro', () => {
  ev(FIXTURE);
  // s2 est 'A' le 15/10 : au 05/11, la base doit être le 01/10 (10), pas rien et pas 'A'.
  const r = evObj(`_carnetSuggestions('5C', '2025-11-05', 's2')`);
  assert.strictEqual(r.base, 10);
  assert.strictEqual(r.valeurs[0].valeur, 10);
  assert.strictEqual(r.valeurs[5].valeur, 15);
});

test('_carnetSuggestions saute les cases vides pour retrouver la base', () => {
  ev(FIXTURE);
  // s3 n'est pas relevé le 05/11 (vide) : au 03/12, la base doit être le 15/10 (3).
  const r = evObj(`_carnetSuggestions('5C', '2025-12-03', 's3')`);
  assert.strictEqual(r.base, 3);
  assert.strictEqual(r.valeurs[0].valeur, 3);
});

// ─────────────────────────────────────────────── La cellule courante n'est jamais regardée

test('_carnetSuggestions ignore la valeur déjà saisie dans la cellule visée — on peut être en train de la corriger', () => {
  ev(FIXTURE);
  // Référence : sans intervention, la base du 15/10 pour s1 est 7 (cf. test nominal).
  const before = evObj(`_carnetSuggestions('5C', '2025-10-15', 's1')`);
  assert.strictEqual(before.base, 7);
  // On pose une valeur ABERRANTE dans la cellule qu'on est censé être en train de saisir.
  ev(`S.releves['5C']['2025-10-15'].counts.s1 = 999`);
  const after = evObj(`_carnetSuggestions('5C', '2025-10-15', 's1')`);
  // La base ne doit RIEN devoir à ce 999 : toujours 7, comme avant.
  assert.strictEqual(after.base, 7);
  assert.deepStrictEqual(after.valeurs, before.valeurs);
});

// ─────────────────────────────────────────────── Cumul décroissant : on ne « corrige » rien

test('_carnetSuggestions : la base est la dernière valeur CHIFFRÉE, même si elle a diminué', () => {
  ev(FIXTURE);
  // s3 : 03/12 → 6, 14/01 → 4 (DIMINUE), 04/02 → 'A'. Au 11/03, la base doit être 4 (le
  // dernier chiffré, le 14/01), pas 6 (une valeur antérieure plus grande « corrigée »).
  const r = evObj(`_carnetSuggestions('5C', '2026-03-11', 's3')`);
  assert.strictEqual(r.base, 4);
  assert.strictEqual(r.valeurs[0].valeur, 4);
  // Et la donnée stockée n'a évidemment pas bougé.
  assert.strictEqual(ev(`S.releves['5C']['2026-01-14'].counts.s3`), 4);
});

// ─────────────────────────────────────────────── Replis : jamais d'exception, jamais de liste vide

test('_carnetSuggestions : classe inconnue → base null et la liste 0..5, sans lever', () => {
  ev(FIXTURE);
  const r = evObj(`_carnetSuggestions('INCONNUE', '2025-10-01', 's1')`);
  assert.strictEqual(r.base, null);
  assertShape(r);
  assert.strictEqual(r.valeurs[0].valeur, 0);
});

test('_carnetSuggestions : date inconnue ou invalide → base null et la liste 0..5, sans lever', () => {
  ev(FIXTURE);
  for (const bad of ['date-inconnue', '2025-13-40', '01/10/2025', '']) {
    const r = evObj(`_carnetSuggestions('5C', ${JSON.stringify(bad)}, 's1')`);
    assert.strictEqual(r.base, null, `base pour ${JSON.stringify(bad)}`);
    assertShape(r);
  }
});

test('_carnetSuggestions : élève inconnu → base null et la liste 0..5, sans lever', () => {
  ev(FIXTURE);
  const r = evObj(`_carnetSuggestions('5C', '2025-10-01', 'inconnu')`);
  assert.strictEqual(r.base, null);
  assertShape(r);
  assert.strictEqual(r.valeurs[0].valeur, 0);
});

// ─────────────────────────────────────────────── Invariant général, rejoué sur plusieurs cas

test('_carnetSuggestions : invariant — toujours 6 entrées, deltas 0..5, valeurs strictement croissantes', () => {
  ev(FIXTURE);
  const cases = [
    `_carnetSuggestions('5C', '2025-10-15', 's1')`,     // base = 7
    `_carnetSuggestions('5C', '2025-09-01', 's1')`,     // base = null
    `_carnetSuggestions('5C', '2025-11-05', 's2')`,     // base après un 'A'
    `_carnetSuggestions('5C', '2025-12-03', 's3')`,     // base après un vide
    `_carnetSuggestions('5C', '2026-03-11', 's3')`,     // base = valeur diminuée
    `_carnetSuggestions('INCONNUE', 'n\\'importe', 'x')`,  // triple repli
  ];
  for (const c of cases) assertShape(evObj(c));
});
