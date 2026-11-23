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

test('liste imprimée : un moment sans aucun bilan n\'a pas de colonne (sauf le conseil de la période courante, pour écrire à la main), et six colonnes de moments n\'écrasent plus les noms', () => {
  const r = J(`createDemo({ force: true }); const cls = getCls(), pIdx = _carnetCurrentPeriodIdx(cls);
    const cols = _bilanColsVues(cls, pIdx), entetes = h => (h.match(/<thead>[\\s\\S]*?<\\/thead>/) || [''])[0];
    const largeurs = h => [...h.matchAll(/<col style="width:([\\d.]+)%">/g)].map(m => +m[1]);
    const tous = _elevesPrintHTML(cls), nomAvecSix = largeurs(tous)[0];
    // un moment vidé de ses bilans (la démonstration en a partout) : pas le conseil de la période courante
    const vide = cols.find(c => c.key !== 'bil:conseil:' + pIdx);
    for (const sid of cls.eleves) { const b = _bilanDeColonne(cls, sid, vide); if (b) S.eleves[sid].bilans = S.eleves[sid].bilans.filter(x => x !== b); }
    const avec = entetes(_elevesPrintHTML(cls));
    for (const s of cls.eleves) delete S.eleves[s].bilans;
    const sans = entetes(_elevesPrintHTML(cls));
    const th = (h, c) => h.includes('>' + _escName(c.court) + '</th>');
    return { nCols: cols.length, nomAvecSix, somme: Math.round(largeurs(tous).reduce((a, b) => a + b, 0)), videImprime: th(avec, vide), autresImprimes: cols.filter(c => c !== vide).every(c => th(avec, c)),
      apresEffacement: cols.filter(c => th(sans, c)).map(c => c.key), courant: 'bil:conseil:' + pIdx };`);
  assert.ok(r.nCols >= 5, 'la démonstration montre au moins cinq moments : ' + r.nCols);
  assert.strictEqual(r.videImprime, false, 'un moment sans aucun bilan n\'a pas de colonne');
  assert.strictEqual(r.autresImprimes, true, 'un moment qui a un bilan garde la sienne');
  assert.deepStrictEqual(r.apresEffacement, [r.courant], 'sans aucun bilan : seul le conseil de la période courante reste, pour écrire à la main');
  assert.ok(r.nomAvecSix >= 8, 'colonne des noms avec tous les moments : ' + r.nomAvecSix + ' % (elle tombait à 7 %, les noms se coupaient)');
  assert.strictEqual(r.somme, 100);
});
