// Paliers d'observations du carnet et feuille imprimée des observations (v1.38.0).
// Demande de l'utilisateur : « un changement de couleur de fond à chaque fois que ça
// franchit un multiple de 5 observations — et dans les réglages, une autre valeur que 5 ».

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);

const FIXTURE = `S = _emptyState(); postLoadHook(); undoStack.length = 0; renderDonnees = () => {};
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
               s2:{id:'s2',nom:'<b>X</b>',prenom:'Noé',classe_id:'5C',tags:[]},
               s3:{id:'s3',nom:'PETIT',prenom:'Inès',classe_id:'5C',tags:[]} };
  S.cur = '5C';
  S.releves['5C'] = {
    '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1: 4,  s2: 10, s3: 'A' } },
    '2025-12-03': { date:'2025-12-03', ts:2, label:'<i>avant conseil</i>', counts:{ s1: 5, s2: 14, s3: 3 } },
    '2026-03-11': { date:'2026-03-11', ts:3, counts:{ s1: 9,  s2: 41 } } };`;

test('_obsBande : un cran par multiple franchi, 0 sous le premier, plafond à huit', () => {
  ev(FIXTURE);
  const b = n => ev(`_obsBande(${JSON.stringify(n)})`);
  assert.strictEqual(b(0), 0);
  assert.strictEqual(b(4), 0);
  assert.strictEqual(b(5), 1, '5 franchit le premier palier');
  assert.strictEqual(b(9), 1);
  assert.strictEqual(b(10), 2);
  assert.strictEqual(b(39), 7);
  assert.strictEqual(b(40), 8);
  assert.strictEqual(b(400), 8, 'plafonné à la dernière teinte');
  // L'absent et le vide n'ont pas de cran : ce ne sont pas des nombres.
  assert.strictEqual(b('A'), 0);
  assert.strictEqual(b(null), 0);
  // Un autre palier, et 0 = sans couleur.
  assert.strictEqual(ev(`_obsBande(9, 3)`), 3);
  assert.strictEqual(ev(`_obsBande(40, 0)`), 0);
  assert.strictEqual(ev(`_obsBandeCls(12)`), ' ob-2');
  assert.strictEqual(ev(`_obsBandeCls(3)`), '');
  assert.strictEqual(ev(`_obsBandeLabel(1)`), '5–9');
  assert.strictEqual(ev(`_obsBandeLabel(8)`), '40 et +');
  assert.strictEqual(ev(`_obsBandeLabel(2, 1)`), '2');
});

test('Réglage obsPalier : 5 par défaut, entier de 0 à 100, un cran d\'undo', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`S.prefs.obsPalier`), 5, 'posé par postLoadHook');
  ev(`setPref('obsPalier', '3')`);
  assert.strictEqual(ev(`S.prefs.obsPalier`), 3);
  assert.strictEqual(ev(`_obsBande(9)`), 3);
  assert.strictEqual(ev(`undoStack.length`), 1);
  for (const bad of ['', 'abc', '2.5', '-1', '101']) {
    ev(`setPref('obsPalier', ${JSON.stringify(bad)})`);
    assert.strictEqual(ev(`S.prefs.obsPalier`), 3, `refusé : « ${bad} »`);
  }
  assert.strictEqual(ev(`undoStack.length`), 1, 'un refus n\'empile rien');
  ev(`setPref('obsPalier', '0')`);
  assert.strictEqual(ev(`_obsBande(40)`), 0, '0 = sans couleurs');
  // Une valeur corrompue dans le fichier retombe sur le défaut, sans lever.
  ev(`S.prefs.obsPalier = 'n\\'importe quoi'`);
  assert.strictEqual(ev(`_obsPalier()`), 5);
});

test('Grille des observations : le cumul porte la classe de son cran', () => {
  ev(FIXTURE);
  ev(`(() => { const el = { innerHTML: '', id: 'carnets-body' };
    document.getElementById = id => id === 'carnets-body' ? el : null;
    window.__carEl = el; })()`);
  ev(`_wrapScrollKeep = () => () => {}; renderCarnets()`);
  const html = ev(`window.__carEl.innerHTML`);
  assert.match(html, /class="rel-cell ob-2"[^>]*>\s*<input[^>]*data-ymd="2025-10-01" data-sid="s2"/, '10 → second cran');
  assert.match(html, /class="rel-cell"[^>]*>\s*<input[^>]*data-ymd="2025-10-01" data-sid="s1"/, '4 → aucun cran');
  assert.match(html, /class="rel-cell abs"[^>]*>\s*<input[^>]*data-sid="s3"/, 'l\'absent n\'a pas de couleur');
  assert.match(html, /openCarnetPrint\(\)/, 'le bouton d\'impression est dans la barre');
  assert.match(html, /ob-leg/, 'la légende est affichée');
});

test('Feuille imprimée : colonnes au choix, période, couleurs, tout échappé', () => {
  ev(FIXTURE);
  const f = o => ev(`_carnetFeuilleHTML(getCls(), ${JSON.stringify(o || {})})`);
  const all = f();
  assert.strictEqual(all.kind, 'landscape');
  assert.match(all.html, /pp-t pp-car/);
  assert.ok(!all.html.includes('<b>X</b>'), 'nom échappé');
  assert.ok(!all.html.includes('<i>avant conseil</i>'), 'libellé de relevé échappé');
  assert.match(all.html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.match(all.html, /<td class="c ob-8">41 <small>\+27<\/small><\/td>/, '41 au dernier cran, évolution en petit');
  assert.match(all.html, /<em>A<\/em>/, 'absent en italique');
  assert.match(all.html, /Δ dernier/);
  assert.match(all.html, /ob-leg/, 'la légende est au sous-titre');
  // Sans couleurs, sans évolution, sans Δ ni totaux, en portrait.
  const nu = f({ couleurs: false, delta: false, dernier: false, totaux: false, kind: 'portrait' });
  assert.strictEqual(nu.kind, 'portrait');
  assert.ok(!/ob-\d/.test(nu.html), 'aucune couleur de palier');
  assert.ok(!nu.html.includes('<small>+'), 'aucune évolution');
  assert.ok(!nu.html.includes('Δ dernier'));
  assert.ok(!/>S1<\/th>/.test(nu.html), 'aucun total de période');
  // Une seule période : S1 = deux relevés, le S2 n'y est pas.
  const s1 = f({ periode: '0' });
  assert.match(s1.html, /01\/10/);
  assert.match(s1.html, /03\/12/);
  assert.ok(!s1.html.includes('11/03'), 'le relevé de mars est au S2');
  assert.match(s1.html, /— S1 —/);
  // Δ dernier borné à la période : s2 au S1 = +4 (10 → 14), pas +27.
  assert.match(s1.html, /<td class="c g dern">\+4<\/td>/);
  // Une période sans relevé : rien à imprimer.
  ev(`S.releves['5C'] = {}`);
  assert.strictEqual(f(), null);
});

test('Ctrl+P sur l\'onglet des observations ouvre le choix, pas l\'impression directe', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /tab === 'carnets'[^\n]*printCarnets\(\)/);
  assert.match(src, /function printCarnets\(\) \{ openCarnetPrint\(\); \}/);
});

test('Feuille imprimée : un Δ nul ne s\'écrit pas (« 3 0 » se lirait « 30 »)', () => {
  ev(FIXTURE);
  ev(`S.releves['5C']['2026-03-11'].counts.s1 = 5`);   // 5 → 5 : inchangé
  const html = ev(`_carnetFeuilleHTML(getCls(), {}).html`);
  assert.ok(!/<small>\+?0<\/small>/.test(html), 'aucun « 0 » en petit à côté d\'un cumul');
  assert.match(html, /<td class="c ob-1">5<\/td>/);
});
