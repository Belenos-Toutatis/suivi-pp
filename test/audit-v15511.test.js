// Audit du 2026-10-06 (relecture du code v1.54 → v1.55.10) — les défauts corrigés en v1.55.11.
// Noms inventés (dépôt public).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;`;

test('avis : le compte d\'une discipline porte sur les élèves de la feuille, comme sa fenêtre de lecture', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    const cls = getCls();
    const c = Object.values(_avisMap(cls.id)).find(x => Object.keys(x.avis || {}).length);
    const sid = Object.keys(c.avis)[0];
    const did = Object.keys(c.avis[sid]).find(d => _avisALavis(c, sid, d));
    const seul = Object.keys(c.avis).filter(s => _avisALavis(c, s, did)).length === 1;
    S.eleves[sid].departureDate = '2000-01-01';   // parti bien avant la période : hors de la feuille
    const ids = _avisEleves(cls, c).map(s => s.id);
    const html = _avisCampHTML(cls, c);
    return { tous: _avisCompte(c).n, feuille: _avisCompte(c, ids).n, horsFeuille: !ids.includes(sid),
      seul, lien: html.includes("openAvisLire({ did: '" + did + "' })") };
  })()`);
  assert.ok(r.horsFeuille);
  assert.ok(r.feuille < r.tous, 'les avis d\'un élève hors de la feuille ne sont plus comptés');
  if (r.seul) assert.ok(!r.lien, 'plus de lien vers une fenêtre qui dirait « aucun avis »');
});

test('avis : le nom tapé d\'une nouvelle feuille est oublié au changement de classe', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    const autre = 'cl_test_' + Date.now();
    S.classes[autre] = { id: autre, nom: '4B', annee: '2025-26', eleves: [], ord: 9 };
    const avant = S.cur;
    _avisNomDraft = 'Avis — 5e C — à moi.ods';
    switchClass(avant); const meme = _avisNomDraft;
    switchClass(autre); const change = _avisNomDraft;
    switchClass(avant);
    return { meme, change };
  })()`);
  assert.strictEqual(r.meme, 'Avis — 5e C — à moi.ods', 'même classe : le nom tapé reste');
  assert.strictEqual(r.change, null, 'autre classe : le nom proposé reprend');
});

test('contacts : corriger un texte par des espaces de bord seulement n\'empile pas de Ctrl+Z vide', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    const cls = getCls(), sid = cls.eleves.find(id => (S.eleves[id].journal || []).length);
    _remSid = sid;
    const j = S.eleves[sid].journal[0], n0 = undoStack.length;
    journalEditUI(j.id, '  ' + j.texte + ' ');
    const n1 = undoStack.length;
    journalEditUI(j.id, j.texte + ' — rappelé');
    return { n0, n1, n2: undoStack.length, t: S.eleves[sid].journal[0].texte };
  })()`);
  assert.strictEqual(r.n1, r.n0, 'rien de changé : pas de cran d\'undo');
  assert.strictEqual(r.n2, r.n0 + 1, 'un vrai changement : un cran');
  assert.match(r.t, /— rappelé$/);
});

test('fenêtre de dialogue redessinée : le focus passe au bouton qui remplace celui qu\'on a cliqué', () => {
  const f = SRC.slice(SRC.indexOf('function _appDialogMaj('), SRC.indexOf('function _appDialogMaj(') + 900);
  assert.match(f, /indexOf\(document\.activeElement\)/);
  assert.match(f, /\.focus\(\)/);
});
