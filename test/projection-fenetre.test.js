// 🖥 Fenêtre détachée du dépouillement (v1.52.0) : le graphique dans une fenêtre à part, à
// mettre sur le second écran — un pur AFFICHAGE, rafraîchi à chaque rendu de l'onglet.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

test('fenêtre détachée : le graphique de l\'élection, jamais le numéro des bulletins ; elle suit les rendus', () => {
  const app = loadApp();
  const ev = c => app.__TESTEVAL(c);
  const r = JSON.parse(ev(`(() => {
    createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos);
    _elView = el.id;
    const box = { innerHTML: '' };
    _elWin = { closed: false, document: { getElementById: id => id === 'el-win' ? box : null } };
    renderDelegues();
    const vu = box.innerHTML;
    _elView = null; box.innerHTML = '';
    _elWinMaj();
    const garde = box.innerHTML;               // revenir à la liste ne vide pas l'écran projeté
    _elWin.closed = true; _elWinMaj();
    return JSON.stringify({ rows: (vu.match(/class="el-row/g) || []).length, cands: el.tours[el.tours.length - 1].candidats.filter(c => !c.retire).length,
      big: vu.includes('el-right big'), num: /bul-n/.test(vu), garde: garde === vu, ferme: _elWin === null });
  })()`));
  assert.ok(r.rows >= 2 && r.big, 'le graphique en grand');
  assert.strictEqual(r.num, false, 'secret du vote : aucun numéro de bulletin');
  assert.ok(r.garde, 'la dernière élection montrée reste affichée');
  assert.ok(r.ferme, 'fenêtre fermée : on l\'oublie');
});

test('fenêtre détachée : bouton à côté de 📽 Projeter, repli si bloquée, Ctrl+Z depuis la fenêtre', () => {
  assert.match(SRC, /onclick="elProjectionFenetre\(\)"[^>]*>🖥 Fenêtre détachée<\/button>/);
  const fn = SRC.slice(SRC.indexOf('function elProjectionFenetre('), SRC.indexOf('function _elWinMaj('));
  assert.match(fn, /if \(!w\) return toast\('⚠️ Le navigateur a bloqué la fenêtre/);
  assert.match(fn, /undoLast\(\)/);
  assert.match(fn, /requestFullscreen/);
  assert.match(SRC, /function renderDelegues\(\) \{ _renderDeleguesCore\(\); _elWinMaj\(\); \}/);
});

test('fenêtre détachée : élection close → le résultat (élus, tours), sans remplacements ni boutons', () => {
  const app = loadApp();
  const ev = c => app.__TESTEVAL(c);
  const r = JSON.parse(ev(`(() => {
    createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => e.clos && e.tours.length === 2 && (e.type || 'delegues') === 'delegues');
    el.candidats[0].nomTitulaire = '<img src=x onerror=alert(1)>';
    _elView = el.id;
    const box = { innerHTML: '' };
    _elWin = { closed: false, document: { getElementById: id => id === 'el-win' ? box : null } };
    renderDelegues();
    const h = box.innerHTML;
    const eco = _elList(cls.id).find(e => e.clos && e.type === 'eco');
    const he = _elWinResultatHTML(eco);
    return JSON.stringify({ resultat: h.includes('class="elr"'), graphique: h.includes('el-chart'), elus: (h.match(/class="elr-elu"/g) || []).length,
      tours: (h.match(/class="elr-tour"/g) || []).length, premier: h.includes('élu au premier tour'), second: h.includes('élu au second tour'),
      relative: h.includes('majorité relative'), rempl: /Remplacement|devient titulaire/.test(h), boutons: /<button/.test(h), xss: h.includes('<img src=x'),
      ecoSup: he.includes('suppléant'), ecoTitre: he.includes('Éco-délégué') });
  })()`));
  assert.deepStrictEqual(r, { resultat: true, graphique: false, elus: 2, tours: 2, premier: true, second: true, relative: true,
    rempl: false, boutons: false, xss: false, ecoSup: false, ecoTitre: true });
});
