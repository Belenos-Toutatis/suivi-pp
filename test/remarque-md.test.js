// La remarque mise en forme (v1.80.2) : un markdown réduit, rendu à l'affichage — gras, listes, décalage.
// Le texte enregistré ne change pas de nature (une chaîne) : rien à migrer, rien de neuf dans `S`.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const md = t => ev(`_mdMini(${JSON.stringify(t)})`);
const md2 = t => ev(`_mdMini(${JSON.stringify(t)}, true)`);

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

// v1.80.3 : le compte rendu d'un contact avec la famille, même mise en forme.
test('contact : en ligne s’il n’a qu’un paragraphe, en bloc dès une liste ou un décalage', () => {
  assert.strictEqual(md2('Mère **inquiète**\nRappeler lundi'), '<span class="md-l">Mère <strong>inquiète</strong><br>Rappeler lundi</span>');
  assert.strictEqual(md2(''), '<span class="md-l"></span>');
  assert.match(md2('Points :\n- carnet\n- devoirs'), /^<div class="md"><p>Points :<\/p><ul>/);
  assert.match(md2('> décalé'), /^<div class="md"><p class="md-r1">/);
});

test('contact : la fiche le met en forme, la fenêtre des contacts a sa barre (le champ où est le curseur)', () => {
  ev(`S = _emptyState(); postLoadHook(); S.classes.c = { id: 'c', nom: '5C', eleves: ['s'], ord: 0 }; S.cur = 'c';
      S.eleves.s = { id: 's', nom: 'X', prenom: 'Y', classe_id: 'c', tags: [] };
      journalAdd('s', _ficheMoments(getCls())[0].date, 'appel', '**Mère** jointe :\\n- carnet\\n- devoirs');`);
  const h = ev(`(() => { const cls = getCls(), col = _ficheMoments(cls)[0]; return _ficheTableauHTML(cls, S.eleves.s, col, {}); })()`);
  assert.match(h, /appel téléphonique<\/span> · <div class="md"><p><strong>Mère<\/strong> jointe :<\/p><ul><li>carnet<\/li><li>devoirs<\/li><\/ul><\/div>/);
  assert.match(ev(`_mdBarreHTML('@')`), /mdOutil\('@','ul'\)[\s\S]*dans le texte où est le curseur/);
  assert.match(ev(`_iaDonnees(getCls(), S.eleves.s, _ficheMoments(getCls())[0], new Set(['contact'])).texte`), /Mère jointe :/, 'vers l’IA : sans les marques');
});

// v1.80.3 (l'utilisateur : « la fenêtre d'édition est des fois un peu petite, elle ne s'allonge pas avec le texte ») :
// les champs de texte libre prennent la hauteur de leur contenu et grandissent à la frappe.
test('les champs de texte libre grandissent avec leur texte', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  for (const id of ['mrem-txt', 'mbilan-txt', 'mbilan-dec', 'minc-txt']) {
    const tag = (src.match(new RegExp(`<textarea id="${id}"[^>]*>`)) || [''])[0];
    assert.match(tag, /class="ta-auto/, id);
    assert.match(tag, /oninput="_autoTaille\(this\)/, id);
  }
  assert.match(src, /<textarea id="fi-rem-edit" class="ta-auto"[^>]*oninput="_autoTaille\(this\)"/);
  assert.match(src, /textarea\.ta-auto \{ field-sizing: content;/);
  // Méta-test : le détecteur voit bien un champ qui ne grandit pas.
  assert.doesNotMatch('<textarea id="x" rows="4">', /class="ta-auto/);
});
