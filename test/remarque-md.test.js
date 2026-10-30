// La remarque mise en forme (v1.80.2) : un markdown réduit, rendu à l'affichage — gras, listes, décalage.
// Le texte enregistré ne change pas de nature (une chaîne) : rien à migrer, rien de neuf dans `S`.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const md = t => ev(`_mdMini(${JSON.stringify(t)})`);

test('gras, paragraphes, sauts de ligne', () => {
  assert.strictEqual(md('Très **volontaire** à l\'oral.\nPeu de leçons.\n\nSecond paragraphe.'),
    '<div class="md"><p>Très <strong>volontaire</strong> à l&#39;oral.<br>Peu de leçons.</p><p>Second paragraphe.</p></div>');
  assert.strictEqual(md('2 * 3 et ** seul'), '<div class="md"><p>2 * 3 et ** seul</p></div>', 'des astérisques isolés restent');
});

test('listes à puces et numérotées, décalage par « > », tabulation ou deux espaces', () => {
  assert.strictEqual(md('- un\n* deux\n• trois'), '<div class="md"><ul><li>un</li><li>deux</li><li>trois</li></ul></div>');
  assert.strictEqual(md('1. a\n2) b'), '<div class="md"><ol><li>a</li><li>b</li></ol></div>');
  assert.strictEqual(md('Texte\n> décalé\n>> encore'), '<div class="md"><p>Texte</p><p class="md-r1">décalé</p><p class="md-r2">encore</p></div>');
  assert.strictEqual(md('- a\n  - sous\n\t- tab'), '<div class="md"><ul><li>a</li><li class="md-r1">sous</li><li class="md-r1">tab</li></ul></div>');
  assert.match(md('>>>>>> loin'), /class="md-r4"/, 'quatre crans au plus');
});

test('tout est échappé avant la mise en forme', () => {
  const h = md('**<img src=x onerror=alert(1)>**\n- <script>x</script>');
  assert.ok(!h.includes('<img') && !h.includes('<script'));
  assert.match(h, /<strong>&lt;img/);
});

test('en une ligne : sans marques, des puces', () => {
  assert.strictEqual(ev(`_mdTexte('Très **bien**\\n- a\\n> décalé\\n1. b')`), 'Très bien\n• a\ndécalé\nb');
});

test('barre d’outils : listes ajoutées puis retirées, numéros suivis, décalage et retrait', () => {
  const ap = (l, a) => JSON.parse(JSON.stringify(ev(`_mdAppliquer(${JSON.stringify(l)}, '${a}')`)));
  assert.deepStrictEqual(ap(['a', '', 'b'], 'ul'), ['- a', '', '- b']);
  assert.deepStrictEqual(ap(['- a', '- b'], 'ul'), ['a', 'b'], 'déjà en liste : retirée');
  assert.deepStrictEqual(ap(['- a', 'b'], 'ol'), ['1. a', '2. b']);
  assert.deepStrictEqual(ap(['> x', 'y'], 'ul'), ['> - x', '- y'], 'le décalage reste devant');
  assert.deepStrictEqual(ap(['a', ''], 'dec'), ['> a', '']);
  assert.deepStrictEqual(ap(['> > a', '  b', 'c'], 'ret'), ['> a', 'b', 'c']);
});

test('la fiche montre la remarque mise en forme ; l’éditeur porte la barre', () => {
  ev(`S = _emptyState(); postLoadHook(); S.classes.c = { id: 'c', nom: '5C', eleves: ['s'], ord: 0 }; S.cur = 'c';
      S.eleves.s = { id: 's', nom: 'X', prenom: 'Y', classe_id: 'c', tags: [], remarque: '**Attention**\\n- carnet' };`);
  const h = ev(`(() => { const cls = getCls(), col = _ficheMoments(cls)[0]; return _ficheTableauHTML(cls, S.eleves.s, col, { remHTML: _mdBarreHTML('fi-rem-edit') }); })()`);
  assert.match(h, /<div class="pf-p"><div class="md"><p><strong>Attention<\/strong><\/p><ul><li>carnet<\/li><\/ul><\/div><\/div>/);
  assert.match(ev(`_mdBarreHTML('fi-rem-edit')`), /mdOutil\('fi-rem-edit','gras'\)/);
});
