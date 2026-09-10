// Noyau de l'app : échappement, contraste, horloge vectorielle, intégrité de l'état,
// validation d'import. Ces familles sont testées dès l'étape 1 parce que tout le reste
// s'appuie dessus — un échappement cassé ne se voit qu'à l'exploitation.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
// Les objets renvoyés par le contexte `vm` ont un Object.prototype DIFFÉRENT de celui
// du contexte de test : deepStrictEqual échouerait sur la seule identité de prototype.
// On les repasse par JSON, ce qui compare le contenu — la seule chose qui nous intéresse.
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// ─────────────────────────────────────────────────────────── Échappement

test('_escAttr neutralise les cinq caractères dangereux', () => {
  assert.strictEqual(ev(`_escAttr('<a href="x">O\\'Neil & co</a>')`),
    '&lt;a href=&quot;x&quot;&gt;O&#39;Neil &amp; co&lt;/a&gt;');
  assert.strictEqual(ev('_escAttr(null)'), '');
  assert.strictEqual(ev('_escAttr(undefined)'), '');
});

test('_escJsAttr survit au décodage HTML de l\'attribut (le piège du double contexte)', () => {
  // Le navigateur HTML-décode l'attribut AVANT de parser le JS : _escAttr produirait
  // &#39;, qui redevient ' et referme la chaîne JS → breakout. _escJsAttr échappe au
  // niveau JS, et la séquence \' survit au décodage.
  const out = ev(`_escJsAttr("x'); alert(1); //")`);
  assert.ok(out.includes("\\'"), 'l\'apostrophe doit être échappée au niveau JS');
  assert.ok(!out.includes('&#39;'), 'pas d\'entité HTML pour l\'apostrophe : elle se re-décoderait');
  assert.strictEqual(ev(`_escJsAttr('a\\nb')`), 'a\\nb');
});

test('_csvCellGuard préfixe les cellules interprétées comme formules', () => {
  for (const c of ['=', '+', '-', '@', '\t', '\r']) {
    assert.strictEqual(ev(`_csvCellGuard(${JSON.stringify(c + 'SUM(A1)')})`), "'" + c + 'SUM(A1)');
  }
  assert.strictEqual(ev(`_csvCellGuard('Dupont')`), 'Dupont');
});

test('_html échappe les interpolations et laisse passer _rawHtml', () => {
  assert.strictEqual(ev('_html`<td>${"<b>x</b>"}</td>`'), '<td>&lt;b&gt;x&lt;/b&gt;</td>');
  assert.strictEqual(ev('_html`<td>${_rawHtml("<b>x</b>")}</td>`'), '<td><b>x</b></td>');
});

test('_safeColor refuse une couleur porteuse d\'injection CSS', () => {
  assert.strictEqual(ev(`_safeColor('#e74c3c')`), '#e74c3c');
  assert.strictEqual(ev(`_safeColor('red')`), 'red');
  assert.strictEqual(ev(`_safeColor('red;background:url(https://atk/?c=1)')`), '#7f8c8d');
  assert.strictEqual(ev(`_safeColor('')`), '#7f8c8d');
});

// ─────────────────────────────────────────────────────────── Contraste

test('_wcagContrast : noir sur blanc = 21, identiques = 1', () => {
  assert.strictEqual(Math.round(ev('_wcagContrast(0,0,0,255,255,255)')), 21);
  assert.strictEqual(Math.round(ev('_wcagContrast(120,120,120,120,120,120)')), 1);
});

test('_contrastTextColor tranche par contraste réel, pas par luminance perçue', () => {
  // Les accents saturés de luminance moyenne : le blanc n'y tient que ~2,9:1.
  assert.strictEqual(ev(`_contrastTextColor('#e67e22')`), '#1a252f'); // orange
  assert.strictEqual(ev(`_contrastTextColor('#27ae60')`), '#1a252f'); // vert
  assert.strictEqual(ev(`_contrastTextColor('#1a252f')`), '#fff');    // encre profonde
  assert.strictEqual(ev(`_contrastTextColor('')`), '');
  // La lightness HSL n'est pas la luminance : deux teintes de même L, deux verdicts.
  assert.strictEqual(ev(`_contrastTextColor('hsl(60, 100%, 42%)')`), '#1a252f');  // jaune vif
  assert.strictEqual(ev(`_contrastTextColor('hsl(240, 100%, 42%)')`), '#fff');    // bleu sombre
});

test('_contrastTextColor tient le seuil AA sur les couleurs qu\'il renvoie', () => {
  for (const bg of ['#e67e22', '#27ae60', '#16a085', '#b03d2e', '#f5d76e', '#1a7442']) {
    const fg = ev(`_contrastTextColor('${bg}')`);
    const rgb = fg === '#fff' ? '255,255,255' : '26,37,47';
    const hex = bg.slice(1);
    const c = ev(`_wcagContrast(0x${hex.slice(0,2)},0x${hex.slice(2,4)},0x${hex.slice(4,6)},${rgb})`);
    assert.ok(c >= 4.5, `${bg} → ${fg} ne donne que ${c.toFixed(2)}:1`);
  }
});

// ─────────────────────────────────────────────────────────── Horloge vectorielle

test('_clockCompare classe les quatre relations', () => {
  assert.strictEqual(ev(`_clockCompare({a:1,b:2},{a:1,b:2})`), 'equal');
  assert.strictEqual(ev(`_clockCompare({a:2,b:2},{a:1,b:2})`), 'ahead');
  assert.strictEqual(ev(`_clockCompare({a:1,b:2},{a:1,b:3})`), 'behind');
  assert.strictEqual(ev(`_clockCompare({a:2,b:1},{a:1,b:2})`), 'diverged');
  // Un appareil absent d'une horloge compte pour 0, il ne rend pas les états divergents.
  assert.strictEqual(ev(`_clockCompare({a:1},{a:1,b:0})`), 'equal');
  assert.strictEqual(ev(`_clockCompare({a:1,b:1},{a:1})`), 'ahead');
});

test('_clockBumpForward ne recule jamais sous la valeur pré-restauration', () => {
  // Un snapshot d'undo peut porter un compteur PLUS BAS que l'actuel : le restaurer
  // tel quel ferait reculer l'horloge et rejouerait un conflit déjà résolu.
  assert.strictEqual(ev(`(() => { const o = S; S = { clock: { [_DEVICE_ID]: 3 } }; _clockBumpForward(9); const v = S.clock[_DEVICE_ID]; S = o; return v; })()`), 10);
  assert.strictEqual(ev(`(() => { const o = S; S = { clock: { [_DEVICE_ID]: 12 } }; _clockBumpForward(4); const v = S.clock[_DEVICE_ID]; S = o; return v; })()`), 13);
  // Et il n'invente pas d'appareil : seul le compteur local bouge.
  assert.deepStrictEqual(evObj(`(() => { const o = S; S = { clock: { autre: 4, [_DEVICE_ID]: 1 } }; _clockBumpForward(0); const c = { autre: S.clock.autre, moi: S.clock[_DEVICE_ID] }; S = o; return c; })()`),
    { autre: 4, moi: 2 });
});

test('_clockMergeMax garde le maximum de chaque appareil', () => {
  assert.deepStrictEqual(evObj(`(() => { const t = {a:1,b:5}; _clockMergeMax(t, {a:3,c:2}); return t; })()`), { a: 3, b: 5, c: 2 });
});

test('_clockOnLoad normalise les compteurs d\'un JSON corrompu', () => {
  // Sans normalisation, "5"+1 = "51" : la monotonie et les comparaisons partent en vrille.
  assert.deepStrictEqual(
    evObj(`(() => { const o = S; S = { clock: { a: '5', b: -3, c: 2.7, d: 'zz' } }; _clockOnLoad(); const c = S.clock; S = o; return c; })()`),
    { a: 5, b: 0, c: 2, d: 0 });
});

// ─────────────────────────────────────────────────────────── Intégrité de l'état

test('_sanitizeCoreSections recrée une section absente ou du mauvais type', () => {
  const r = evObj(`(() => {
    const o = S;
    S = { classes: 'oups', eleves: null, releves: undefined, documents: [], elections: 3, prefs: {} };
    _sanitizeCoreSections();
    const r = { c: typeof S.classes, e: typeof S.eleves, r: typeof S.releves, d: Array.isArray(S.documents), el: typeof S.elections };
    S = o; return r;
  })()`);
  assert.deepStrictEqual(r, { c: 'object', e: 'object', r: 'object', d: false, el: 'object' });
});

test('_sanitizeCoreSections supprime les entrées non-objet, y compris à deux niveaux', () => {
  const r = evObj(`(() => {
    const o = S;
    S = { classes: { A: { id: 'A', eleves: 'x' } }, eleves: { s1: null, s2: { id: 's2' } },
          releves: { A: { '2026-01-05': 42, '2026-01-12': { counts: {} } }, B: 'nope' },
          documents: {}, elections: {}, prefs: {} };
    _sanitizeCoreSections();
    const r = { eleves: Object.keys(S.eleves), roster: S.classes.A.eleves,
                relA: Object.keys(S.releves.A), relB: 'B' in S.releves };
    S = o; return r;
  })()`);
  assert.deepStrictEqual(r, { eleves: ['s2'], roster: [], relA: ['2026-01-12'], relB: false });
});

test('postLoadHook complète les réglages sans écraser les choix de l\'utilisateur', () => {
  const r = evObj(`(() => {
    const o = S;
    S = { classes: { A: { id: 'A', nom: '5C', eleves: [] } }, prefs: { periodMode: 'trimestre' } };
    postLoadHook();
    const r = { mode: S.prefs.periodMode, codeA: _codeA(), cur: S.cur };
    S = o; return r;
  })()`);
  assert.deepStrictEqual(r, { mode: 'trimestre', codeA: 'A', cur: 'A' });
});

test('postLoadHook oublie une classe courante qui n\'existe plus', () => {
  assert.strictEqual(ev(`(() => { const o = S; S = { classes: {}, cur: 'DISPARUE' }; postLoadHook(); const c = S.cur; S = o; return c; })()`), null);
});

// ─────────────────────────────────────────────────────────── Validation d'import

test('_validateImport rejette les clés de prototype pollution, même en profondeur', () => {
  // ⚠️ On passe par JSON.parse, comme le vrai chemin d'import : un LITTÉRAL d'objet
  // `{ '__proto__': {} }` ne crée aucune propriété propre — il change le prototype, et
  // Object.keys ne verrait rien. JSON.parse, lui, matérialise bien '__proto__' comme
  // propriété propre. Un test écrit avec un littéral passerait donc à côté du danger.
  assert.match(ev(`_validateImport(JSON.parse('{"classes":{"__proto__":{}}}'))`), /interdite/);
  assert.match(ev(`_validateImport(JSON.parse('{"eleves":{"s1":{"tags":[{"__proto__":1}]}}}'))`), /interdite/);
  assert.match(ev(`_validateImport(JSON.parse('{"documents":{"d1":{"retours":{"s1":{"constructor":1}}}}}'))`), /interdite/);
  assert.match(ev(`_validateImport(JSON.parse('{"prefs":{"a":{"prototype":1}}}'))`), /interdite/);
});

test('_validateImport rejette une clé porteuse d\'injection et accepte les clés légitimes', () => {
  assert.match(ev(`_validateImport({ classes: { "x'); alert(1); //": {} } })`), /invalide/);
  // Dates de relevé, ids d'élection, ids d'appareil : tous compatibles.
  assert.strictEqual(ev(`_validateImport({
    classes: { '5C': {} }, eleves: { 'e_1757_1': {} },
    releves: { '5C': { '2026-01-05': {} } },
    documents: { 'doc_1': {} }, elections: { '5C': { 'el_1': {} } },
    prefs: { periodMode: 'semestre' }, clock: { 'dev_ab12cd34': 7 } })`), null);
});

test('_validateImport contrôle aussi les sous-clés des sections à deux niveaux', () => {
  assert.match(ev(`_validateImport({ releves: { '5C': { 'pas une date ; drop': {} } } })`), /releves\[5C\]/);
  assert.match(ev(`_validateImport({ elections: { '5C': { 'x"y': {} } } })`), /elections\[5C\]/);
});
