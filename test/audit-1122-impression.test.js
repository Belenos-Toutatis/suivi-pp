// Audit du 2026-11-22 — feuilles imprimées : les défauts confirmés, corrigés. Chaque test a été vérifié en
// échec sur la version d'avant la correction.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
const CSS = SRC.slice(SRC.indexOf('<style'), SRC.indexOf('</style>'));

// Les blocs `@media print { … }` de la feuille de style, par appariement des accolades.
function blocsPrint(css) {
  const out = [];
  for (let i = css.indexOf('@media print'); i >= 0; i = css.indexOf('@media print', i + 1)) {
    let j = css.indexOf('{', i), n = 1, k = j + 1;
    for (; k < css.length && n; k++) { if (css[k] === '{') n++; else if (css[k] === '}') n--; }
    out.push([j, k]);
  }
  return out;
}
// Une règle « mesurée » : hors de tout @media print (la boîte de mesure est à l'écran) et sans unité absolue
// (elle doit rétrécir avec la taille calculée). → null si elle est conforme, la raison sinon.
function mesurable(css, selecteur) {
  const i = css.search(new RegExp('(^|\\n)\\s*' + selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{'));
  if (i < 0) return 'règle introuvable';
  if (blocsPrint(css).some(([a, b]) => i > a && i < b)) return 'dans @media print';
  const corps = css.slice(css.indexOf('{', i), css.indexOf('}', i));
  if (/\d(pt|mm|cm)\b/.test(corps)) return 'unité absolue : ' + corps.trim();
  return null;
}

test('synthèse de période imprimée : les blocs « heures de vie de classe » et « synthèse de la classe » sont MESURÉS (« tient sur une page » annonçait 1 page pour 2)', () => {
  // `_printFitMeasure` mesure la feuille dans une boîte hors écran : une règle cantonnée à @media print n'y
  // existe pas. Les blocs `.print-hvc` y étaient (9 pt fixes, marges, bordure) : à 6 pt la feuille imprimée
  // était plus haute que la feuille mesurée, et passait sur une deuxième page.
  assert.strictEqual(mesurable(CSS, '.print-hvc'), null);
  assert.strictEqual(mesurable(CSS, '.print-hvc ul'), null);
});

test('MÉTA-TEST : le détecteur voit une règle cantonnée à @media print, et une unité absolue', () => {
  assert.strictEqual(mesurable(CSS, '.print-list'), 'dans @media print');
  assert.match(mesurable('.x { margin: 0 0 8pt; }', '.x'), /unité absolue/);
  assert.strictEqual(mesurable('.x { margin: 0 0 .8em; }', '.x'), null);
  assert.strictEqual(mesurable(CSS, '.pp-titre'), null, 'les règles .pp-* sont déjà mesurées');
});
