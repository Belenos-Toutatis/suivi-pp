// Carte Moyennes de la fiche (v1.82.1). L'utilisateur, capture à l'appui : « il y aurait, comme qui dirait, un petit
// problème d'affichage » — un import par semaine, une colonne par import : la carte débordait, Δ hors de vue, les
// matières sur deux lignes. Arbitré : « courbe + dernière » — une ligne par matière, la courbe de tous les imports,
// la dernière moyenne, l'évolution. Le nombre de colonnes ne dépend plus du nombre d'imports.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const spark = (vals, dates) => ev(`_ficheMoySparkHTML('Maths', ${JSON.stringify((dates || vals.map((_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)).map(d => ({ date: d })))}, ${JSON.stringify(vals)})`);
const pts = h => (h.match(/<circle /g) || []).length;

test('la courbe : un point par nombre, un code ou un vide coupe le trait, le seuil de 10 quand elle le traverse', () => {
  let h = spark([12, 13, 11.5, 14]);
  assert.strictEqual(pts(h), 4);
  assert.strictEqual((h.match(/<polyline /g) || []).length, 1);
  assert.doesNotMatch(h, /class="dix"/, 'toujours au-dessus de 10 : pas de seuil');
  assert.doesNotMatch(h, /class="pt lo"/);
  h = spark([12, 'Abs', 8, 9, null, 11]);
  assert.strictEqual(pts(h), 4);
  assert.strictEqual((h.match(/<polyline /g) || []).length, 1, '12 seul, puis 8 → 9, puis 11 seul : un seul trait');
  assert.strictEqual((h.match(/class="pt lo"/g) || []).length, 2, 'sous 10 : en rouge');
  assert.match(h, /class="dix"/);
  assert.doesNotMatch(h, /<title>/, 'pas d’infobulle par point : la bulle de la carte dit tout (v1.82.2)');
  assert.match(h, /class="pt lo" data-i="2"/, 'chaque point sait de quel import il est');
  assert.match(h, /<line class="guide"/, 'le repère de l’import survolé');
  assert.match(h, /aria-label="Maths : 12 le 01\/10, 8 le 03\/10, 9 le 04\/10, 11 le 06\/10"/);
  assert.strictEqual(spark([null, 'NN']), '', 'aucun nombre : pas de courbe');
});

test('même abscisse pour toutes les lignes : une matière arrivée tard commence à droite', () => {
  const cx = h => [...h.matchAll(/cx="([\d.]+)"/g)].map(m => +m[1]);
  const plein = cx(spark([12, 13, 14, 15])), tard = cx(spark([null, null, 14, 15]));
  assert.deepStrictEqual(tard, plein.slice(2));
});

test('échelle d’au moins 4 points : 13,3 → 13,7 reste presque plat ; une chute de 12 à 5,3 descend franchement', () => {
  const cy = h => [...h.matchAll(/cy="([\d.]+)"/g)].map(m => +m[1]);
  const plat = cy(spark([13.3, 13.7])), chute = cy(spark([12, 5.3]));
  assert.ok(Math.abs(plat[1] - plat[0]) < 2, `presque plat (${plat})`);
  assert.ok(chute[1] - chute[0] > 10, `chute visible (${chute})`);
});

test('la carte de la démo : quatre colonnes quel que soit le nombre d’imports, la dernière moyenne, Δ', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook()`);
  const carte = () => ev(`(() => { const cls = S.classes[S.cur], col = _chaleurMomentsTous(cls).find(c => c.key === 'bil:conseil:0');
    const h = _ficheTableauHTML(cls, S.eleves[cls.eleves[10]], col, {}); const i = h.indexOf('<table class="pf-mini pf-moyc"'); return h.slice(i, h.indexOf('</table>', i)); })()`);
  let c = carte();
  assert.match(c, /<th>Matière<\/th><th title="[^"]*">\d+ imports depuis le \d\d\/\d\d<\/th><th class="r">\d\d\/\d\d<\/th><th class="r">Δ<\/th>/);
  const cols = c => (c.match(/<tr class="pf-gen">([^]*?)<\/tr>/)[1].match(/<td/g) || []).length;
  assert.strictEqual(cols(c), 4);
  // Six imports de plus dans la période : toujours quatre colonnes.
  ev(`(() => { const M = S.moyennes[S.cur], base = Object.values(M).sort((a, b) => a.date.localeCompare(b.date))[0];
    ['10-02', '10-11', '11-03', '11-09', '11-20', '12-01'].forEach((md, i) => { const c = JSON.parse(JSON.stringify(base)); c.id = 'x' + i; c.date = base.date.slice(0, 4) + '-' + md; M[c.id] = c; }); })()`);
  c = carte();
  assert.strictEqual(cols(c), 4);
  assert.match(c, /\d+ imports depuis/);
  assert.match(c, /<td class="pf-mat">Générale<\/td>/);
});

// v1.82.2 — l'utilisateur : « quand la souris survole les points, que les différentes notes à ce moment-là s'affichent
// dans une petite bulle ». La bulle dit toutes les matières à la date de l'import survolé, la ligne survolée marquée.
test('la bulle : toutes les matières à la date de l’import, l’écart avec le précédent, la ligne survolée marquée', () => {
  const D = JSON.stringify({ list: [{ date: '2026-10-23' }, { date: '2026-11-03' }], rows: [
    { nom: 'Hist.-géo.', vals: [12, 5.3] }, { nom: 'Musique', vals: [null, 16] }, { nom: 'EPS', vals: [13, 'Disp'] }, { nom: '<b>x</b>', vals: [1, 2] }, { nom: 'Générale', vals: [12.7, 12.6], gen: true }] });
  const h = ev(`_ficheMoyBulleHTML(${D}, 1, 0)`);
  assert.match(h, /Moyennes au 03\/11\/2026 <span class="bm-p">écart depuis le 23\/10<\/span>/);
  assert.match(h, /<tr class="on"><td>▸ Hist\.-géo\.<\/td><td class="v"><span class="pf-mv lo">5,3<\/span><\/td><td class="d">−6,7<\/td><\/tr>/);
  assert.match(h, /<td>Musique<\/td><td class="v"><span class="pf-mv">16<\/span><\/td><td class="d"><\/td>/, 'pas de note avant : pas d’écart');
  assert.match(h, /<td>EPS<\/td><td class="v"><em>Disp<\/em><\/td>/);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/, 'le nom est échappé');
  assert.match(h, /<tr class=" gen"><td>Générale<\/td>/);
  assert.doesNotMatch(ev(`_ficheMoyBulleHTML(${D}, 0, 1)`), /écart depuis/, 'premier import : pas d’écart');
});

test('la carte prépare la bulle : une entrée par ligne, Générale au bout, gestionnaires sur le tableau', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook()`);
  const h = ev(`(() => { const cls = S.classes[S.cur], col = _chaleurMomentsTous(cls).find(c => c.key === 'bil:conseil:0'); return _ficheTableauHTML(cls, S.eleves[cls.eleves[10]], col, {}); })()`);
  assert.match(h, /<table class="pf-mini pf-moyc" onpointermove="ficheMoyBulle\(event\)" onpointerleave="ficheMoyBulleFin\(\)">/);
  const D = JSON.parse(ev(`JSON.stringify(_ficheMoyBul)`));
  assert.ok(D.rows.length > 2);
  assert.deepStrictEqual(D.rows.at(-1).gen, true);
  assert.strictEqual(D.rows.at(-1).nom, 'Générale');
  assert.strictEqual((h.match(/<td class="pf-spc" data-r="\d+">/g) || []).length, D.rows.length);
  assert.ok(D.rows.every(r => r.vals.length === D.list.length));
});

test('la bulle se pose à côté de la carte (à gauche, sinon à droite), à hauteur du curseur ; sinon sous le curseur', () => {
  const pl = (carte, x, y) => JSON.parse(ev(`JSON.stringify(_ficheMoyBullePlace(${JSON.stringify(carte)}, ${x}, ${y}, 200, 260, 1600, 900))`));
  assert.deepStrictEqual(pl({ left: 1200, right: 1570 }, 1300, 300), { left: 992, top: 276 }, 'à gauche de la carte');
  assert.deepStrictEqual(pl({ left: 20, right: 390 }, 300, 300), { left: 398, top: 276 }, 'à droite quand la carte est à gauche');
  assert.strictEqual(pl({ left: 20, right: 390 }, 300, 800).top, 900 - 8 - 260, 'jamais sous le bas de l’écran');
  const p = pl({ left: 8, right: 1592 }, 300, 300);
  assert.deepStrictEqual(p, JSON.parse(ev(`JSON.stringify(_bullePlace(300, 300, 200, 260, 1600, 900, false))`)), 'pas de place à côté : sous le curseur');
});
