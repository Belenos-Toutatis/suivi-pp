// Polices — Andika à l'écran, Latin Modern au papier, chacune au choix (2026-09-30).
// Et le visuel commun de TOUS les tableaux imprimés.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

test('Par défaut : Andika à l\'écran, Latin Modern à l\'impression', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  assert.deepStrictEqual(evObj(`_applyPolices()`), { ecran: 'andika', papier: 'lm' });
  assert.ok(/--font-ui: var\(--font-andika\);/.test(SRC), 'le token d\'écran vaut Andika sans attribut');
  assert.ok(/--font-print: var\(--font-lm\);/.test(SRC), 'le token du papier vaut Latin Modern sans attribut');
  assert.ok(/html\[data-police="lm"\] \{ --font-ui: var\(--font-lm\); \}/.test(SRC));
  assert.ok(/html\[data-police-papier="andika"\] \{ --font-print: var\(--font-andika\); \}/.test(SRC));
});

test('Les réglages basculent les polices, une valeur inconnue retombe sur le défaut, Ctrl+Z revient', () => {
  // renderDonnees dessine l'écran des réglages, que le DOM simulé ne sait pas porter : neutralisé ici.
  ev(`S = _emptyState(); postLoadHook(); undoStack.length = 0; renderDonnees = () => {};`);
  ev(`setPref('policeEcran', 'lm'); setPref('policePapier', 'andika');`);
  assert.deepStrictEqual(evObj(`_applyPolices()`), { ecran: 'lm', papier: 'andika' });
  assert.strictEqual(ev(`undoStack.length`), 2, 'un réglage = un geste annulable');
  ev(`S.prefs.policeEcran = 'comic'; S.prefs.policePapier = 42;`);
  assert.deepStrictEqual(evObj(`_applyPolices()`), { ecran: 'andika', papier: 'lm' }, 'jamais « aucune police »');
  // L'undo repasse par postLoadHook, qui repose les polices.
  assert.ok(/function postLoadHook\(\)[\s\S]*?_applyPolices\(\);[\s\S]*?_clockOnLoad\(\);/.test(SRC));
});

test('Les deux familles sont EMBARQUÉES (4 variantes chacune), et les anciennes retirées', () => {
  for (const fam of ['Andika', 'Latin Modern Roman']) {
    const n = (SRC.match(new RegExp(`font-family: '${fam}';\\n  font-style: (normal|italic);\\n  font-weight: (400|700);`, 'g')) || []).length;
    assert.strictEqual(n, 4, `${fam} : regular, bold, italic, bold italic`);
  }
  assert.ok(!/font-family: 'Fraunces'/.test(SRC) && !/font-family: 'IBM Plex Sans'/.test(SRC), 'plus rien ne les utilise : elles ne pèsent plus');
  assert.ok(/font-family: 'JetBrains Mono'/.test(SRC), 'la mono reste pour les chiffres des grilles');
});

test('Tous les tableaux imprimés : en-tête répété, rangées alternées, jamais coupées, fonds conservés', () => {
  const print = [...SRC.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
  for (const [nom, re] of [
    ['en-tête répété à chaque page', /\.print-t thead \{ display: table-header-group; \}/],
    ['une rangée sur deux grisée', /\.print-t tbody tr:nth-child\(even\) td \{ background: #f0f0f0; \}/],
    ['rangée jamais coupée', /\.print-t tr \{[^}]*break-inside: avoid/],
    ['fonds conservés à l\'impression', /\.print-t \{[^}]*print-color-adjust: exact/],
    ['tout en police du papier', /\.print-area \*, body\.printing-pv \.pv \* \{ font-family: var\(--font-print\) !important; \}/],
  ]) assert.ok(re.test(print), nom);
  // Les feuilles .pp-t (hors @media print : elles se mesurent) portent le même visuel.
  assert.ok(/\.pp-t tbody tr:nth-child\(even\) td \{ background: #f0f0f0; \}/.test(SRC));
  assert.ok(/\.pp-t thead \{ display: table-header-group; \}/.test(SRC));
  // Le PV aussi, quadrillage gardé — hors @media print depuis la v1.52.9 : il se mesure (une page).
  assert.ok(/\.pv-t tr:nth-child\(even\) td \{ background: #f0f0f0; \}/.test(SRC));
});

test('MÉTA-TEST : l\'extraction des blocs @media print n\'est pas vide', () => {
  const print = [...SRC.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
  assert.ok(print.length > 2000, 'sinon les assertions précédentes chercheraient dans le vide');
  assert.ok(!/\.print-t thead \{ display: table-header-group; \}/.test('.print-t thead { display: block; }'));
});
