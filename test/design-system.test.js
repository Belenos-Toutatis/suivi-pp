// Design system — les invariants du CSS, vérifiés sur le TEXTE du fichier.
//
// ⚠️ Ces règles ont coûté 244 écarts de contraste mesurés dans le projet de référence,
// et elles ne se voient pas à l'écran : un token oublié dans le bloc d'impression ne se
// manifeste que sur PAPIER, en thème sombre, le jour du conseil de classe. Aucun audit
// de contraste à l'écran ne peut les attraper — d'où un test qui lit le CSS lui-même.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

// Extrait le corps du bloc dont l'accolade ouvrante suit `from`, en comptant les niveaux.
function blockAt(from) {
  const i = SRC.indexOf('{', from);
  let depth = 0, j = i;
  for (;;) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) break;
    j++;
  }
  return SRC.slice(i + 1, j);
}
const tokensOf = block => new Set([...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));

const iRoot = SRC.indexOf('\n:root {');
const iDark = SRC.indexOf('\nhtml[data-theme="dark"] {');
const iPrint = SRC.indexOf('html[data-theme="dark"]', SRC.indexOf('@media print {', iDark));

const ROOT = tokensOf(blockAt(iRoot));
const DARK = tokensOf(blockAt(iDark));
const PRINT = tokensOf(blockAt(iPrint));

test('les trois blocs de tokens existent et ne sont pas vides', () => {
  for (const [nom, s] of [[':root', ROOT], ['dark', DARK], ['print', PRINT]]) {
    assert.ok(s.size > 50, `bloc ${nom} : ${s.size} tokens, la découpe a dû rater`);
  }
});

test('TOUT token redéfini pour le thème sombre est neutralisé dans le bloc d\'impression', () => {
  // La règle n° 1 du design system. Un token oublié ici s'imprime en couleurs de nuit
  // sur du papier blanc — ambre sur blanc, illisible, et découvert au moment de s'en servir.
  const manquants = [...DARK].filter(t => !PRINT.has(t)).sort();
  assert.deepStrictEqual(manquants, [], 'tokens sombres absents du bloc @media print');
});

test('le bloc d\'impression ne neutralise rien qui n\'existe pas en thème sombre', () => {
  // L'inverse : une déclaration d'impression sans token sombre correspondant est morte,
  // et masque le fait que le token a été renommé ou supprimé d'un seul côté.
  const orphelins = [...PRINT].filter(t => !DARK.has(t)).sort();
  assert.deepStrictEqual(orphelins, [], 'tokens du bloc @media print sans équivalent sombre');
});

test('tout token réellement UTILISÉ est déclaré dans :root', () => {
  // ⚠️ Le thème clair est le défaut : un token déclaré seulement dans le bloc sombre y
  // est irrésolu, et la propriété tombe. Des tokens hérités de la référence sont dans ce
  // cas (--cell-occupied, --warn-bg, --gN-light : plans de salle, teintes de groupe),
  // conservés par symétrie mais INUTILISÉS. Ce test les laisse dormir et se déclenche
  // le jour où quelqu'un s'en sert — c'est-à-dire le jour où ça devient un défaut.
  // Commentaires retirés d'abord : la doc du fichier CITE des `var(--x, littéral)`.
  const sansCommentaires = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const utilises = new Set([...sansCommentaires.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(m => m[1]));
  const orphelins = [...utilises].filter(t => !ROOT.has(t)).sort();
  assert.deepStrictEqual(orphelins, [], 'tokens utilisés sans valeur en thème clair');
});

test('aucune couleur d\'encre en dur sur un fond coloré', () => {
  // ⚠️ Règle 4 du design system : jamais `color:#fff` en dur sur un fond coloré — surtout
  // pas sur une couleur choisie par l'utilisateur (les options de documents le sont).
  // Toujours _contrastTextColor(bg), qui tranche par contraste WCAG réel.
  const script = SRC.slice(SRC.indexOf('<script>', SRC.indexOf('</style>')));
  const suspects = [];
  for (const m of script.matchAll(/background\s*:\s*\$\{([^}]{1,80})\}\s*;\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|white|black)/g)) {
    suspects.push(m[0].slice(0, 70));
  }
  assert.deepStrictEqual(suspects, [], 'encre figée derrière un fond dynamique');
});

test('les deux orientations d\'impression sont posées ET retirées', () => {
  // Les pages nommées ne suffisent pas (Firefox les ignore) : un `@page` anonyme est
  // injecté le temps de l'impression. ⚠️ S'il n'était pas retiré, il imposerait son
  // orientation à l'impression SUIVANTE, qui n'a pas la même.
  assert.ok(/@page \{ size: A4 landscape/.test(SRC), 'orientation paysage injectée');
  assert.ok(/@page \{ size: A4 portrait/.test(SRC), 'orientation portrait injectée');
  // Chaque `_setPageOrientation` a son `_clearPageOrientation` dans le même chemin.
  const poses = (SRC.match(/_setPageOrientation\(/g) || []).length;
  const retraits = (SRC.match(/_clearPageOrientation\(/g) || []).length;
  assert.ok(poses >= 2, 'les deux chemins d\'impression posent une orientation');
  assert.ok(retraits >= poses, `${poses} poses pour ${retraits} retraits`);
});

test('toute modale peut recevoir le focus à l\'ouverture', () => {
  // ⚠️ Sans focus À L'INTÉRIEUR, le piège à focus ne s'enclenche jamais : Tab parcourt
  // la page masquée derrière la modale. openMod focalise [data-autofocus], à défaut la
  // boîte .mb elle-même — donc toute modale doit avoir au moins une .mb.
  const sansBoite = [];
  const ouvertures = [...SRC.matchAll(/<div id="([A-Za-z0-9_-]+)" class="mo"/g)];
  for (let k = 0; k < ouvertures.length; k++) {
    const a = ouvertures[k].index;
    const b = k + 1 < ouvertures.length ? ouvertures[k + 1].index : SRC.indexOf('<script>', a);
    if (!/class="mb"/.test(SRC.slice(a, b))) sansBoite.push(ouvertures[k][1]);
  }
  assert.ok(ouvertures.length >= 15, `${ouvertures.length} modales trouvées, la découpe a dû rater`);
  assert.deepStrictEqual(sansBoite, [], 'modales sans boîte focalisable');
  assert.ok(/mb.setAttribute\('tabindex', '-1'\)/.test(SRC), 'le repli de focus sur .mb est toujours là');
});

test('MÉTA-TEST : les détecteurs voient bien un défaut injecté', () => {
  // Sans ce test, une découpe cassée rendrait tous les précédents silencieusement
  // vacants : trois ensembles vides sont « symétriques ».
  const faux = new Set(['--paper', '--inexistant']);
  assert.deepStrictEqual([...faux].filter(t => !PRINT.has(t)), ['--inexistant']);
  const script = 'x = `background:${bg};color:#fff`';
  assert.strictEqual([...script.matchAll(/background\s*:\s*\$\{([^}]{1,80})\}\s*;\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|white|black)/g)].length, 1);
});

// ─────────────────────── Responsive (étape 10) ───────────────────────
// ⚠️ Ces trois règles se cassent sans bruit : on ne les voit qu'en réduisant la
// fenêtre, ce que personne ne fait en développant. Un tableau ajouté sans son
// conteneur de défilement fait glisser la barre d'onglets hors de l'écran du
// téléphone — et on ne peut plus changer d'onglet.

test('tout tableau large est dans un conteneur de défilement horizontal', () => {
  // On repère les `<table class="dt"` émis en JS et on vérifie que le fragment qui
  // précède ouvre bien un .rel-wrap. Les tableaux explicitement bornés en largeur
  // (max-width) sont dispensés : ils tiennent par construction.
  const script = SRC.slice(SRC.indexOf('<script>', SRC.indexOf('</style>')));
  const nus = [];
  for (const m of script.matchAll(/<table class="dt[^"]*"([^>]*)>/g)) {
    if (/max-width:\s*\d/.test(m[1])) continue;
    const avant = script.slice(Math.max(0, m.index - 120), m.index);
    if (!/rel-wrap/.test(avant)) nus.push(script.slice(m.index, m.index + 60));
  }
  assert.deepStrictEqual(nus, [], 'tableaux larges sans conteneur .rel-wrap');
});

test('les volets de l\'élection peuvent se rétrécir', () => {
  // ⚠️ Un enfant de grille vaut `min-width: auto` : il refuse de descendre sous la
  // largeur mini de son contenu, et le overflow-x du tableau à l'intérieur ne peut
  // alors jamais s'enclencher. C'est le volet qui pousse la page, pas le tableau.
  assert.ok(/\.el-left,\s*\.el-right\s*\{[^}]*min-width:\s*0/.test(SRC),
    '.el-left / .el-right doivent porter min-width: 0');
  assert.ok(!/\.el-split\s*\{\s*grid-template-columns:\s*1fr/.test(SRC),
    'la grille doit utiliser minmax(0, 1fr), jamais 1fr nu');
});

test('en projection, les noms des candidats ne se tronquent pas', () => {
  // Le seul écran public de l'app. « Aaliyah LAMB… » projeté devant la classe
  // désigne un élève à moitié : ici le texte passe avant la mise en page.
  const m = SRC.match(/\.el-right\.big \.el-name-t,\s*\.el-right\.big \.el-name-s\s*\{([^}]*)\}/);
  assert.ok(m, 'la règle de projection des noms a disparu');
  assert.ok(/white-space:\s*normal/.test(m[1]), 'le nom doit pouvoir revenir à la ligne');
  assert.ok(/text-overflow:\s*clip/.test(m[1]), 'aucune ellipse en projection');
});

test('la saisie en série n\'ouvre JAMAIS le calendrier natif', () => {
  // ⚠️ `showPicker()` en arrivant sur le champ date suivant affiche le calendrier
  // par-dessus le clavier : il faut une seconde frappe d'Entrée pour le refermer avant
  // de pouvoir taper. Sur vingt-cinq dates, c'est vingt-cinq frappes perdues — pour une
  // aide qui n'en est pas une, puisque toucher un champ date ouvre déjà le sélecteur
  // natif sur tactile. Ce test empêche de le « réparer » une troisième fois.
  const m = SRC.match(/function eleveNaisKey\(e\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'la navigation clavier des dates a disparu');
  // Commentaires retirés : celui qui explique la règle la CITE, forcément.
  const code = m[0].replace(/^\s*\/\/.*$/gm, ' ');
  assert.ok(!/showPicker/.test(code), 'eleveNaisKey ne doit pas ouvrir le sélecteur natif');
});
