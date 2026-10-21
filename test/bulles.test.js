// Infobulles dessinées par l'app (v1.72.0) : les bulles natives (`title`) peuvent sortir illisibles sous Linux
// (fond transparent, texte blanc sur page claire) ; l'app les dessine elle-même, aux couleurs de ses deux thèmes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

test('position : sous le curseur, au-dessus près du bas ou sous une photo, jamais hors de l’écran', () => {
  const P = (...a) => evObj(`_bullePlace(${a.join(',')})`);
  assert.deepStrictEqual(P(100, 100, 200, 40, 1000, 800, false), { left: 112, top: 120 });
  assert.deepStrictEqual(P(100, 780, 200, 40, 1000, 800, false), { left: 112, top: 726 }, 'retournée au-dessus en bas de l’écran');
  assert.deepStrictEqual(P(100, 300, 200, 40, 1000, 800, true), { left: 112, top: 246 }, 'au-dessus quand la photo occupe le dessous');
  assert.deepStrictEqual(P(950, 100, 200, 40, 1000, 800, false), { left: 792, top: 120 }, 'poussée à gauche au bord droit');
  assert.deepStrictEqual(P(5, 20, 360, 40, 320, 800, true), { left: 8, top: 40 }, 'écran étroit, pas de place au-dessus : en dessous, marge 8');
});

test('le mécanisme : le texte passe dans data-bulle le temps du survol, la bulle a ses couleurs dans les deux thèmes', () => {
  assert.match(SRC, /cible\.setAttribute\('data-bulle', texte\); cible\.removeAttribute\('title'\);/);
  assert.match(SRC, /document\.addEventListener\('pointerover', e => \{\n  if \(e\.pointerType && e\.pointerType !== 'mouse'\) return;/, 'à la souris seulement');
  assert.match(SRC, /#bulle \{[^}]*background: var\(--bulle-bg\); color: var\(--bulle-fg\)/);
  assert.match(SRC, /@media print \{ #bulle \{ display: none !important; \} \}/);
  // Rendre le texte ne remplace pas celui que le code aurait posé entre-temps.
  assert.match(SRC, /if \(!c\.hasAttribute\('title'\) && c\.hasAttribute\('data-bulle'\)\) c\.setAttribute\('title', c\.getAttribute\('data-bulle'\)\);/);
  assert.strictEqual(ev(`typeof _bulleRendre === 'function' && typeof _bulleMasquer === 'function' && typeof _bulleMontrer === 'function'`), true);
});
