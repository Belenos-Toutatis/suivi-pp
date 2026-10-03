// 🖨 La fiche élève imprimée (v1.49.0) : une page par élève, bornée au moment choisi —
// depuis la fiche (cet élève ou toute la classe) et par la forme « fiche complète » de la
// synthèse de période. Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

function app() {
  const sb = loadApp();
  const ev = c => sb.__TESTEVAL(c);
  ev(`createDemo()`);
  return { sb, ev };
}

test('fiche imprimée : une page par élève, le moment en tête, tout échappé', () => {
  const { ev } = app();
  const r = JSON.parse(ev(`(() => {
    const cls = S.classes[S.cur], col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const sid = cls.eleves[0];
    S.eleves[sid].nom = '<img src=x onerror=alert(1)>'; S.eleves[sid].remarque = 'Ligne 1\\n<script>x</script>';
    const h = _fichePrintHTML(cls, sid, col, { parts: FICHE_PRINT_PARTS.map(p => p.key), photo: false }, null);
    const tous = _fichePrintEleves(cls, col);
    return JSON.stringify({ h, long: col.long, n: tous.length, present: cls.eleves.filter(id => _isStudentActive(S.eleves[id])).length,
      pages: (tous.map(id => _fichePrintHTML(cls, id, col, {}, null)).join('').match(/class="fp-page"/g) || []).length });
  })()`));
  assert.ok(!r.h.includes('<img src=x') && !r.h.includes('<script>x'), 'nom et remarque échappés');
  assert.ok(r.h.includes('&lt;img src=x'));
  assert.ok(r.h.includes(r.long), 'le moment est dit en tête');
  assert.strictEqual(r.pages, r.n, 'une page par élève présent');
  assert.ok(r.n >= r.present - 2);
});

test('fiche imprimée : un bilan vide laisse des lignes, un bilan écrit est imprimé ; les parties décochées disparaissent', () => {
  const { ev } = app();
  const r = JSON.parse(ev(`(() => {
    const cls = S.classes[S.cur], col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const sid = cls.eleves.find(id => !_bilanCible(cls, id, { type: col.type, date: col.date }));
    const vide = _fichePrintHTML(cls, sid, col, { parts: ['bilan'] }, null);
    bilanAdd(sid, { date: col.date || _periods(cls)[0].end, type: 'conseil', texte: 'Bon trimestre, à poursuivre.' });
    const plein = _fichePrintHTML(cls, sid, col, { parts: ['bilan'] }, null);
    const sansMoy = _fichePrintHTML(cls, sid, col, { parts: ['identite'] }, null);
    const photo = _fichePrintHTML(cls, sid, col, { parts: ['identite'], photo: true }, 'blob:x');
    return JSON.stringify({ vide: vide.includes('fp-lignes'), plein: plein.includes('Bon trimestre') && !plein.includes('fp-lignes"><div></div><div></div><div></div><div></div>'),
      sansMoy: !sansMoy.includes('Moyennes') && sansMoy.includes('Identité'), photo: photo.includes('class="fp-ph" src="blob:x"') });
  })()`));
  assert.deepStrictEqual(r, { vide: true, plein: true, sansMoy: true, photo: true });
});

test('fiche imprimée : bouton dans la fiche, Ctrl+P fiche ouverte, forme « fiche complète » de la synthèse', () => {
  assert.match(SRC, /onclick="openFichePrint\(\)"[^>]*>🖨 Imprimer<\/button>/);
  const kb = SRC.slice(SRC.indexOf("if (ctrl && k === 'p') {"), SRC.indexOf("if (ctrl && k === 'p') {") + 500);
  assert.ok(kb.indexOf('openFichePrint()') > 0 && kb.indexOf('openFichePrint()') < kb.indexOf('printEleves()'), 'la fiche passe avant la liste');
  assert.match(SRC, /<option value="complete">fiche complète/);
  assert.match(SRC, /o\.forme === 'complete' && o\.col/);
  // Les photos sont décodées avant d'ouvrir l'impression.
  assert.match(SRC.slice(SRC.indexOf('function _printHTML('), SRC.indexOf('function _printHTML(') + 1500), /\.decode\(\)/);
});
