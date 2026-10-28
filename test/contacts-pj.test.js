// Fichiers joints à un contact avec la famille (v1.78.0) — « la retranscription d'une conversation
// téléphonique, d'un échange de mails ». Comme les PDF des incidents : copiés dans le dossier des pièces
// jointes (sous-dossier contacts/), l'entrée n'en garde que la référence ; l'app n'efface jamais un fichier.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1'], ord:0 };
  S.cur = '5C';
  S.eleves = { s1: { id:'s1', nom:'GUÉRIN', prenom:'Nathan', classe_id:'5C', tags:[] } };
  _remSid = 's1';
  journalAdd('s1', '2025-10-11', 'appel', 'Appel à la mère');`;

// Un dossier en mémoire, à la forme de File System Access (comme dans photos.test.js).
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

test('noms : l\'extension du fichier est gardée, le nom automatique dit le type, qui, la date', () => {
  assert.strictEqual(ev(`_pjSafeName('Retranscription appel.TXT', true, 'txt')`), 'Retranscription appel.txt');
  assert.strictEqual(ev(`_pjSafeName('C:\\\\x\\\\échange.docx', true, 'docx')`), 'échange.docx');
  assert.strictEqual(ev(`_pjSafeName('sans extension', true, '')`), 'sans extension');
  assert.strictEqual(ev(`_pjSafeName('fiche')`), 'fiche.pdf', 'les PDF ne changent pas');
  assert.strictEqual(ev(`_pjAutoNom('contact', { date: '2025-10-11', type: 'Appel téléphonique', nom: 'GUÉRIN', prenom: 'Nathan', ext: 'txt' })`),
    'Appel téléphonique — GUÉRIN Nathan — 2025-10-11.txt');
  assert.strictEqual(ev(`_pjExt('a.b.EML')`), 'eml');
  assert.strictEqual(ev(`_pjExt('rien')`), '');
});

test('lecture : PDF et image dans le lecteur, texte et page dans un cadre sans script, le reste à enregistrer — jamais le SVG', () => {
  const s = n => ev(`_pjSorte(${JSON.stringify(n)})`);
  assert.strictEqual(s('x.pdf'), 'pdf');
  assert.strictEqual(s('x.JPG'), 'image');
  assert.strictEqual(s('x.txt'), 'texte');
  assert.strictEqual(s('x.eml'), 'texte');
  assert.strictEqual(s('x.html'), 'page');
  assert.strictEqual(s('x.docx'), 'autre');
  assert.strictEqual(s('x.svg'), 'autre', 'un SVG porte du script : pas affiché');
});

test('modèle : joindre sans doublon, cinq au plus, détacher ; plus de fichier = plus de champ', () => {
  ev(FIXTURE);
  const ref = n => `{ nom: '${n}', fichier: '${n}', taille: 10 }`;
  assert.strictEqual(ev(`journalPjAdd('s1', S.eleves.s1.journal[0].id, [${ref('a.txt')}, ${ref('b.pdf')}, ${ref('a.txt')}])`), 2);
  assert.deepStrictEqual(evObj(`_journalPj(S.eleves.s1.journal[0]).map(p => p.fichier)`), ['a.txt', 'b.pdf']);
  assert.strictEqual(ev(`journalPjAdd('s1', S.eleves.s1.journal[0].id, [${['c', 'd', 'e', 'f'].map(x => ref(x + '.txt')).join(',')}])`), 3, 'cinq au plus');
  assert.strictEqual(ev(`journalPjAdd('s1', 'inconnu', [${ref('z.txt')}])`), -1);
  assert.strictEqual(ev(`journalPjRemove('s1', S.eleves.s1.journal[0].id, 'a.txt')`), true);
  assert.strictEqual(ev(`journalPjRemove('s1', S.eleves.s1.journal[0].id, 'a.txt')`), false);
  for (const f of ['b.pdf', 'c.txt', 'd.txt', 'e.txt']) ev(`journalPjRemove('s1', S.eleves.s1.journal[0].id, '${f}')`);
  assert.strictEqual(ev(`'pj' in S.eleves.s1.journal[0]`), false);
});

test('chargement : des références illisibles sont écartées, un champ qui n\'est pas une liste disparaît', () => {
  ev(FIXTURE);
  ev(`S.eleves.s1.journal[0].pj = [{ nom: 'ok.txt', fichier: 'ok.txt', taille: 3 }, { nom: 'x' }, 42, null];
      S.eleves.s1.journal.push({ id: 'j2', date: '2025-11-02', ts: 1, type: 'mot', texte: 'Mot', pj: 'n\\'importe quoi' });
      postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.journal[0].pj`), [{ nom: 'ok.txt', fichier: 'ok.txt', taille: 3 }]);
  assert.strictEqual(ev(`'pj' in S.eleves.s1.journal.find(x => x.id === 'j2')`), false);
});

test('copie : dans contacts/, sous le nom choisi ; un fichier détaché devient orphelin, jamais effacé tout seul', async () => {
  ev(FIXTURE);
  const r = JSON.parse(await ev(`(async () => {
    pjDirHandle = ${FAUX_DOSSIER};
    const choix = pjChooseName;
    pjChooseName = (orig, auto, ext) => Promise.resolve(auto);
    const f1 = new Blob(['Bonjour madame']); f1.name = 'appel.txt';
    const f2 = new Blob(['%PDF']); f2.name = 'mails.pdf';
    const refs = await _journalPjCopier('s1', S.eleves.s1.journal[0], [f1, f2]);
    pjChooseName = choix;
    journalPjAdd('s1', S.eleves.s1.journal[0].id, refs);
    const dans = [...pjDirHandle.dirs.get('contacts').files.keys()].sort();
    const racine = [...pjDirHandle.files.keys()];
    const orph0 = await pjOrphelins();
    journalPjRemove('s1', S.eleves.s1.journal[0].id, refs[0].fichier);
    const orph1 = await pjOrphelins();
    pjDirHandle = null;
    return JSON.stringify({ refs, dans, racine, orph0, orph1 });
  })()`));
  assert.deepStrictEqual(r.dans, ['Appel téléphonique — GUÉRIN Nathan — 2025-10-11.pdf', 'Appel téléphonique — GUÉRIN Nathan — 2025-10-11.txt']);
  assert.deepStrictEqual(r.racine, [], 'rien à la racine, à côté des PDF des incidents');
  assert.strictEqual(r.refs[0].taille, 14);
  assert.deepStrictEqual(r.orph0, []);
  assert.deepStrictEqual(r.orph1, ['contacts/Appel téléphonique — GUÉRIN Nathan — 2025-10-11.txt']);
});

test('deux fichiers du même nom : le second reçoit « (2) », extension gardée', async () => {
  const r = await ev(`(async () => {
    const d = ${FAUX_DOSSIER};
    const f = new Blob(['x']); f.name = 'a.txt';
    const a = await pjStore(f, 'Note.txt', { dir: d, ext: 'txt' });
    const b = await pjStore(f, 'Note.txt', { dir: d, ext: 'txt' });
    return a.fichier + ' | ' + b.fichier;
  })()`);
  assert.strictEqual(r, 'Note.txt | Note (2).txt');
});

test('renoncer au nom d\'un fichier : rien n\'est copié, rien n\'est noté', async () => {
  ev(FIXTURE);
  const r = await ev(`(async () => {
    pjDirHandle = ${FAUX_DOSSIER};
    const choix = pjChooseName; pjChooseName = () => Promise.resolve(null);
    const f = new Blob(['x']); f.name = 'a.txt';
    const refs = await _journalPjCopier('s1', S.eleves.s1.journal[0], [f]);
    pjChooseName = choix;
    const ok = refs === null && !pjDirHandle.dirs.has('contacts');
    pjDirHandle = null;
    return ok;
  })()`);
  assert.strictEqual(r, true);
});

test('rendu : chaque fichier s\'ouvre, se détache ; un nom piégé est échappé', () => {
  ev(FIXTURE);
  ev(`journalPjAdd('s1', S.eleves.s1.journal[0].id, [{ nom: '<img src=x onerror=alert(1)>.txt', fichier: "a'b.txt", taille: 1 }])`);
  const h = ev(`_journalPjLigneHTML(S.eleves.s1.journal[0])`);
  assert.ok(!h.includes('<img'), 'le nom est échappé');
  assert.match(h, /journalPjOuvrirUI\('s1','[^']+','a\\'b\.txt'\)/);
  assert.match(h, /journalPjRetirerUI/);
  assert.match(h, /📎 Joindre/);
  const l = ev(`_journalPjLiensHTML('s1', S.eleves.s1.journal[0])`);
  assert.ok(!l.includes('<img') && l.includes('journalPjOuvrirUI'));
  assert.strictEqual(ev(`_journalPjLiensHTML('s1', { id: 'x' })`), '');
});

test('Ctrl+Z : détacher un fichier se défait', () => {
  ev(FIXTURE);
  ev(`journalPjAdd('s1', S.eleves.s1.journal[0].id, [{ nom: 'a.txt', fichier: 'a.txt', taille: 1 }]); save();`);
  ev(`journalPjRetirerUI(S.eleves.s1.journal[0].id, 'a.txt')`);
  assert.strictEqual(ev(`_journalPj(S.eleves.s1.journal[0]).length`), 0);
  ev(`undoLast()`);
  assert.strictEqual(ev(`_journalPj(S.eleves.s1.journal[0]).length`), 1);
});
