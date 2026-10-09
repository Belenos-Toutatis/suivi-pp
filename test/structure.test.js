// 🔍 Décrire un fichier sans ses données (v1.57.0) : la mise en page d'un PDF ou d'un tableau
// collé, chaque lettre en X / x et chaque chiffre en 9, sauf les mots laissés en clair.
// Fixture : un récapitulatif INVENTÉ (noms fictifs, dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const PDF = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'recap-invente.pdf')));

test('masque : lettres en X / x, chiffres en 9, mots courants en clair, accents compris', () => {
  const r = JSON.parse(ev(`JSON.stringify([
    _structMasque('MARTIN Noé — 12/09/2025 Bavardage', STRUCT_MOTS_COURANTS),
    _structMasque('Date : 3 Retards, Élève', STRUCT_MOTS_COURANTS),
    _structMasque('Bavardage', new Set(['bavardage'])),
    _structMasque('Léa', null)])`));
  assert.deepStrictEqual(r, ['XXXXXX Xxx — 99/99/9999 Xxxxxxxxx', 'Date : 9 Retards, Élève', 'Bavardage', 'Xxx']);
});

test('tableau collé : une ligne par ligne, ⇥ entre les colonnes, rien de lisible hors des mots gardés', () => {
  const out = ev(`_structColleTexte('Date\\tMotif\\tDemandeur\\n12/09/2025\\tBavardage\\tM. ALPHA\\n', STRUCT_MOTS_COURANTS)`);
  assert.match(out, /^Texte collé : 2 lignes/);
  assert.ok(out.includes('Date ⇥ Motif ⇥ Demandeur'));
  assert.ok(out.includes('99/99/9999 ⇥ Xxxxxxxxx ⇥ X. XXXXX'));
  assert.ok(!/ALPHA|Bavardage/.test(out));
});

test('PDF : pages, rangées en mm, colonnes et tailles ; aucun nom en clair', async () => {
  sb.__u8 = PDF;
  const r = JSON.parse(await ev(`(async () => {
    const doc = await _pdfOpen(__u8), pages = _pdfPages(doc), fc = new Map(), lues = [];
    for (const p of pages) { const { glyphs, images } = await _pdfScanPage(doc, p, fc); const [x0, y0, x1, y1] = p.mb.map(Number);
      lues.push({ w: x1 - x0, h: y1 - y0, x0, y1, images: images.length, lines: _trombiLines(glyphs, 0.6) }); }
    return JSON.stringify({ un: _structPdfTexte(lues, STRUCT_MOTS_COURANTS, 1), tout: _structPdfTexte(lues, STRUCT_MOTS_COURANTS, 99),
      mots: _structMots(lues.flatMap(p => p.lines.map(l => l.text))).map(m => m.k) });
  })()`));
  assert.match(r.un, /^PDF : 2 pages — 1 décrite/);
  assert.match(r.un, /— Page 1 — 210 × 297 mm/);
  assert.ok(r.un.includes('Observations'), 'un mot courant reste en clair');
  assert.match(r.un, /Date \(\d+ pt\) │ \d+: Motif/, 'les colonnes d\'une même rangée, de gauche à droite');
  assert.ok(r.un.includes('99/99/9999'));
  assert.ok(!r.un.includes('— Page 2'));
  assert.ok(r.tout.includes('— Page 2'));
  for (const nom of ['MARTIN', 'Noé', 'DUPONT', 'Léa', 'ALPHA', 'Bavardage', 'Bavarde', 'cahier']) assert.ok(!r.tout.includes(nom), `${nom} masqué`);
  assert.ok(r.mots.includes('martin') && r.mots.includes('observations'), 'les mots rencontrés sont proposés');
});

test('l\'outil est dans 💾 Données ▸ Imports et ne garde rien dans S', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /b\('openStructure\(\)', '🔍 Ouvrir…'\)/);
  const f = src.slice(src.indexOf('function openStructure('), src.indexOf('async function structCopier('));
  assert.ok(!/\bS\.|pushUndo|save\(\)/.test(f), 'aucune écriture dans les données');
});

test('lecteur PDF : filtres ASCII85 et ASCIIHex (posés par certains générateurs devant FlateDecode)', () => {
  const r = JSON.parse(ev(`JSON.stringify([new TextDecoder().decode(_pdfA85(new TextEncoder().encode('<~87cURD]i,"Ebo80~>'))),
    [..._pdfA85(new TextEncoder().encode('z~>'))], new TextDecoder().decode(_pdfAHx(new TextEncoder().encode('48 65 6C6c6F>')))])`));
  assert.deepStrictEqual(r, ['Hello World!', [0, 0, 0, 0], 'Hello']);
});

test('pages choisies : « 5, 8-9 » décrit ces pages-là, dans l\'ordre, et le dit', async () => {
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify([_structPagesNums('5, 8-9'), _structPagesNums('9-8 2'), _structPagesNums('abc'), _structPagesNums('')])`)),
    [[4, 7, 8], [1, 7, 8], null, null]);
  sb.__u8 = PDF;
  const t = await ev(`(async () => {
    const doc = await _pdfOpen(__u8), pages = _pdfPages(doc), fc = new Map(), lues = [];
    for (const p of pages) { const { glyphs, images } = await _pdfScanPage(doc, p, fc); const [x0, y0, x1, y1] = p.mb.map(Number);
      lues.push({ w: x1 - x0, h: y1 - y0, x0, y1, images: images.length, lines: _trombiLines(glyphs, 0.6) }); }
    return _structPdfTexte(lues, STRUCT_MOTS_COURANTS, [1, 7]);
  })()`);
  assert.match(t, /^PDF : 2 pages — 1 décrite/, 'une page qui n\'existe pas est ignorée');
  assert.ok(t.includes('— Page 2 —') && !t.includes('— Page 1 —'));
});

test('page dessinée : un texte peut rester lisible, être masqué, ou dire ce qu\'il contient', async () => {
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify([
    _structSeg('MARTIN Noé', null, STRUCT_MOTS_COURANTS),
    _structSeg('Date', { mode: 'masque' }, STRUCT_MOTS_COURANTS),
    _structSeg('Bavardage', { mode: 'clair' }, STRUCT_MOTS_COURANTS),
    _structSeg('12/09/2025', { mode: 'type', type: 'date' }, STRUCT_MOTS_COURANTS)])`)),
    ['XXXXXX Xxx', 'Xxxx', 'Bavardage', '⟨date : 99/99/9999⟩']);
  sb.__u8 = PDF;
  const t = await ev(`(async () => {
    const doc = await _pdfOpen(__u8), pages = _pdfPages(doc), fc = new Map(), lues = [];
    for (const p of pages) { const { glyphs, images } = await _pdfScanPage(doc, p, fc); const [x0, y0, x1, y1] = p.mb.map(Number);
      lues.push({ w: x1 - x0, h: y1 - y0, x0, y1, images: images.length, lines: _trombiLines(glyphs, 0.6) }); }
    const li = lues[0].lines.findIndex(l => /MARTIN/.test(l.text));
    return _structPdfTexte(lues, STRUCT_MOTS_COURANTS, 1, new Map([['0:' + li, { mode: 'type', type: 'nom de l\\'élève' }]]));
  })()`);
  assert.ok(t.includes("⟨nom de l'élève : Xxxxxxxxxxxxx xxx xxxxxxxx — XXXXXX Xxx — 9x X⟩"), t.split('\n')[3]);
  assert.ok(!t.includes('MARTIN'));
});
