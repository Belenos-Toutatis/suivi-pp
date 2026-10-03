// 📷 Photos des élèves (v1.48.0) — repris de Plan de classe (test/trombi.test.js, commit ace7234).
// La fixture est un faux trombinoscope (noms inventés, carrés de couleur) imprimé en PDF par
// Chrome : même structure que l'export MBN réel (PDF 1.4, polices Type0 Identity-H avec
// ToUnicode, photos JPEG en DCTDecode, grille de 4 colonnes, noms longs sur plusieurs lignes).
// ⚠️ Dépôt public : aucune vraie photo, aucun vrai trombinoscope ici.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const PDF = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'trombi', 'fake-trombi.pdf')));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

test('trombinoscope : en-tête, photos JPEG et noms lus dans le PDF', async () => {
  sb.__u8 = PDF;
  const r = JSON.parse(await ev(`_trombiParsePdf(__u8).then(r => JSON.stringify({
    h: r.header, e: r.entries.map(e => ({ t: e.text, jpg: !!e.jpeg && e.jpeg[0] === 0xFF && e.jpeg[1] === 0xD8 })) }))`));
  assert.deepStrictEqual(r.h, { classLabel: '6A', count: 10, pp: 'Mme Durand, M. Leroy', year: '2026-2027', date: '03/10/2026', school: 'Collège Jean Moulin' });
  assert.strictEqual(r.e.length, 10);
  assert.ok(r.e.every(e => e.jpg), 'chaque photo est un JPEG recopié tel quel');
  assert.deepStrictEqual(r.e.map(e => e.t), ['MARTIN Léa', 'DUPONT Jean-Baptiste', 'NGUYEN Thi Mai',
    'DE LA TOUR-DUVERNOY Marie-Charlotte', 'BERNARD Hugo', 'PETIT Zoé', 'ROUX Inès', 'FONTAINE-LACROIX Maëlys',
    'LEFÈVRE Noé', 'MOREAU Ambre']);
});

test('trombinoscope : en-tête de MBN, professeur principal dédoublonné', () => {
  const h = ev(`_trombiParseHeader(['Collège Jean Moulin', 'Année scolaire 2026-2027', 'Trombinoscope de la classe 5B',
    '28 élèves', 'Professeur principal : Mme Durand, Mme Petit', 'Trombinoscope édité le 02/10/2026 08:41', 'Page 1 sur 2'])`);
  assert.strictEqual(h.classLabel, '5B');
  assert.strictEqual(h.count, 28);
  assert.strictEqual(h.date, '02/10/2026');
  assert.strictEqual(ev(`_trombiParseHeader(['Professeur principal : Mme Durand, Mme Durand']).pp`), 'Mme Durand');
});

test('trombinoscope : découpe NOM / Prénom', () => {
  const sp = s => JSON.parse(ev(`JSON.stringify(_trombiSplitName(${JSON.stringify(s)}))`));
  assert.deepStrictEqual(sp('DE LA TOUR Jean-Marc'), { nom: 'DE LA TOUR', prenom: 'Jean-Marc' });
  assert.deepStrictEqual(sp('NGUYEN Thi Mai'), { nom: 'NGUYEN', prenom: 'Thi Mai' });
  assert.deepStrictEqual(sp("N'DIAYE Aïssatou"), { nom: "N'DIAYE", prenom: 'Aïssatou' });
  assert.deepStrictEqual(sp('LEFÈVRE ÉLODIE'), { nom: 'LEFÈVRE', prenom: 'ÉLODIE' });
});

test('trombinoscope : association aux élèves — rien n\'est deviné à égalité', () => {
  const props = JSON.parse(ev(`JSON.stringify(_trombiMatch(
    ['DUPONT Jean-Baptiste', 'MARTIN Lea', 'DE LA TOUR Chloé', 'BERNARD Hugo', 'BERNARD Hugo', 'INCONNU Zed', 'DURAND Léo'],
    [ { id: 'a', nom: 'Dupont', prenom: 'Jean Baptiste' }, { id: 'b', nom: 'MARTIN', prenom: 'Léa' },
      { id: 'c', nom: 'De la Tour', prenom: 'Chloé' }, { id: 'd', nom: 'BERNARD', prenom: 'Hugo' },
      { id: 'e', nom: 'DURAND', prenom: 'Léo' }, { id: 'f', nom: 'DURAND', prenom: 'Léonie' } ]))`));
  assert.deepStrictEqual(props.map(p => p.sid), ['a', 'b', 'c', null, null, null, 'e']);
});

test('trombinoscope : classe désignée par « 6A », « 6e A », « 6ème A »', () => {
  const r = JSON.parse(ev(`(() => { const old = S.classes;
    S.classes = { '6A': { id: '6A', nom: '6e A', eleves: [] }, 'X5B': { id: 'X5B', nom: '5ème B', eleves: [] } };
    const r = [_trombiResolveClass('6A'), _trombiResolveClass('6ème A'), _trombiResolveClass('5B'), _trombiResolveClass('4C')];
    S.classes = old; return JSON.stringify(r); })()`));
  assert.deepStrictEqual(r, ['6A', '6A', 'X5B', null]);
});

// Un dossier en mémoire, à la forme de File System Access (comme l'OPFS du navigateur, sans permission).
const FAUX_DOSSIER = `(() => {
  const dir = name => { const files = new Map(), dirs = new Map(); return {
    kind: 'directory', name, files, dirs,
    async getDirectoryHandle(n, o) { if (!dirs.has(n)) { if (!o || !o.create) throw new Error('NotFound'); dirs.set(n, dir(n)); } return dirs.get(n); },
    async getFileHandle(n, o) { if (!files.has(n) && !(o && o.create)) throw new Error('NotFound');
      return { kind: 'file', name: n,
        async getFile() { return files.get(n); },
        async createWritable() { let b = null; return { async write(x) { b = x; }, async close() { files.set(n, b); }, async abort() {} }; } }; },
    async removeEntry(n) { if (!files.delete(n)) throw new Error('NotFound'); },
    async *entries() { for (const [n] of files) yield [n, { kind: 'file' }]; for (const [n, d] of dirs) yield [n, d]; },
  }; };
  return dir('Pièces jointes');
})()`;

test('photos : rangées dans photos/ du dossier des pièces jointes, relues, orphelines après suppression', async () => {
  const r = JSON.parse(await ev(`(async () => {
    S.eleves.ph1 = { id: 'ph1', nom: 'TEST', prenom: 'Photo' };
    pjDirHandle = ${FAUX_DOSSIER};
    const d = await _photosDir(true, false);
    await _photoWrite(d, 'ph1', new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]));
    await _photoWrite(d, 'parti', new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]));
    _photos.sids = new Set(); _photos.ready = false;
    await _photosRefresh(false);
    const lus = [..._photos.sids].sort();
    const racine = [...pjDirHandle.files.keys()];
    const orph = await pjOrphelins();
    await _photoDelete('ph1', false);
    const apres = [...pjDirHandle.dirs.get('photos').files.keys()];
    delete S.eleves.ph1; pjDirHandle = null;
    return JSON.stringify({ lus, racine, orph, apres, has: _photoHas('ph1') });
  })()`));
  assert.deepStrictEqual(r.lus, ['parti', 'ph1']);
  assert.deepStrictEqual(r.racine, [], 'rien à la racine, à côté des PDF');
  assert.deepStrictEqual(r.orph, ['photos/parti.jpg'], 'la photo d\'un élève supprimé est proposée au nettoyage');
  assert.deepStrictEqual(r.apres, ['parti.jpg']);
  assert.strictEqual(r.has, false);
});

test('photos : survol des noms, case de la fiche, import dans Données et Élèves', () => {
  assert.match(ev(`_nomFicheHTML('s1', 'NOM', 'Prénom')`), /data-photo-sid="s1"/);
  assert.match(SRC, /const ident = `<div id="fiche-photo" class="fiche-photo"><\/div>/);
  assert.match(SRC, /<img id="mfiche-ph" class="pf-ph" alt="" hidden>/);
  assert.match(SRC, /_fichePhotoFill\(stu\.id\);/);
  assert.ok((SRC.match(/onclick="openTrombiImport\(\)"/g) || []).length >= 1 && SRC.includes("b('openTrombiImport()'"));
  // Supprimer un élève ne touche pas au fichier : Ctrl+Z rend l'élève, pas sa photo.
  const del = SRC.slice(SRC.indexOf('function deleteStudent('), SRC.indexOf('function deleteStudent(') + 2000);
  assert.ok(!/_photoDelete/.test(del));
});
