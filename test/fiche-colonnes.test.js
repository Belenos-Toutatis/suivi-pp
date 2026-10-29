// Tableau de bord de la fiche (v1.80.1) : les colonnes se remplissent l'une après l'autre, dans l'ordre des cartes,
// à hauteurs aussi égales que possible — l'ordre arbitré (identité, vie scolaire, moyennes, avis) se lit en descendant.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const col = (h, n) => JSON.parse(JSON.stringify(app.__TESTEVAL(`_pfColonnes(${JSON.stringify(h)}, ${n})`)));

test('les cartes restent dans l’ordre : chaque colonne est une suite consécutive, jamais en arrière', () => {
  const r = col([125, 69, 59, 40, 144, 50, 40, 104, 122], 3);
  assert.deepStrictEqual(r, [0, 0, 0, 1, 1, 1, 2, 2, 2]);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1]);
});

test('la plus haute colonne la plus basse possible ; aucune colonne vide', () => {
  const h = [10, 10, 10, 10, 40], r = col(h, 2);
  assert.deepStrictEqual(r, [0, 0, 0, 0, 1], '40 / 40 plutôt que 30 / 50');
  assert.deepStrictEqual(col([5, 5], 4), [0, 1], 'plus de colonnes que de cartes : une carte par colonne');
  assert.deepStrictEqual(col([7, 8, 9], 1), [0, 0, 0]);
  assert.deepStrictEqual(col([], 3), []);
  // Recherche exhaustive : comparée à toutes les coupes possibles d'un petit cas.
  const H = [3, 9, 4, 4, 8, 2, 7], best = (() => { let m = Infinity;
    for (let a = 1; a < H.length; a++) for (let b = a + 1; b < H.length; b++) {
      const s = (i, j) => H.slice(i, j).reduce((x, y) => x + y, 0);
      m = Math.min(m, Math.max(s(0, a), s(a, b), s(b, H.length))); } return m; })();
  const r3 = col(H, 3), haut = Math.max(...[0, 1, 2].map(k => H.filter((_, i) => r3[i] === k).reduce((x, y) => x + y, 0)));
  assert.strictEqual(haut, best);
});
