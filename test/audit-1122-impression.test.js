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

// ── Liste des élèves imprimée : pas de colonne de moment vide ──
const { loadApp } = require('./harness.js');
const app = loadApp();
const J = c => JSON.parse(app.__TESTEVAL(`JSON.stringify((() => { ${c} })())`));

test('liste imprimée : un moment sans aucun bilan n\'a pas de colonne (six colonnes vides écrasaient les noms), un moment qui en a un la garde', () => {
  const r = J(`createDemo({ force: true }); const cls = getCls(), pIdx = _carnetCurrentPeriodIdx(cls);
    const cols = _bilanColsVues(cls, pIdx), entetes = h => (h.match(/<thead>[\\s\\S]*?<\\/thead>/) || [''])[0];
    // un moment vidé de ses bilans (la démonstration en a partout)
    for (const sid of cls.eleves) { const b = _bilanDeColonne(cls, sid, cols[0]); if (b) S.eleves[sid].bilans = S.eleves[sid].bilans.filter(x => x !== b); }
    const pleines = cols.filter(c => cls.eleves.some(s => _bilanDeColonne(cls, s, c))), vides = cols.filter(c => !pleines.includes(c));
    const avec = entetes(_elevesPrintHTML(cls));
    for (const s of cls.eleves) delete S.eleves[s].bilans;
    const sans = entetes(_elevesPrintHTML(cls));
    const th = (h, c) => h.includes('>' + _escName(c.court) + '</th>');
    return { nCols: cols.length, pleines: pleines.length, vides: vides.length, pleinesImprimees: pleines.every(c => th(avec, c)), videsImprimees: vides.filter(c => th(avec, c)).length,
      apresEffacement: cols.filter(c => th(sans, c)).length, nomToujours: sans.includes('Élève') };`);
  assert.ok(r.pleines > 0 && r.vides > 0, 'la démonstration a des moments avec et sans bilan : ' + JSON.stringify(r));
  assert.strictEqual(r.pleinesImprimees, true, 'un moment qui a un bilan garde sa colonne');
  assert.strictEqual(r.videsImprimees, 0, 'un moment sans aucun bilan n\'a pas de colonne');
  assert.strictEqual(r.apresEffacement, 0);
  assert.strictEqual(r.nomToujours, true);
});
