// ← → dans 📈 Moyennes (v1.82.5). L'utilisateur : « lorsque je suis sur le tableau des moyennes, flèche gauche,
// flèche droite devrait me faire passer au relevé précédent ou au relevé suivant ». Vue Tableau seulement ; au bout
// d'une période, la flèche passe à la voisine (l'ordre du menu « Import du », période après période).
// Le geste lui-même (écouteur du document) se vérifie dans un vrai navigateur ; ici, le calcul et la garde.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

function monter() {
  ev(`(() => {
    S = _emptyState(); postLoadHook();
    S.classes = { c1: { id: 'c1', nom: '5C', annee: '2026-27', eleves: ['s1'] } };
    S.eleves = { s1: { id: 's1', nom: 'Martin', prenom: 'Léa', classe_id: 'c1' } };
    const r = (id, date, periode) => ({ id, date, periode, ts: 1, matieres: [], notes: {}, generale: { s1: 12 } });
    S.moyennes = { c1: { b: r('b', '2026-10-20', 'Semestre 1'), a: r('a', '2026-10-06', 'Semestre 1'),
      c: r('c', '2027-02-10', 'Semestre 2'), d: r('d', '2027-03-02', 'Semestre 2') } };
    S.cur = 'c1';
    _moyVue = 'tableau'; _moyPeriodeSel = null; _moyRidSel = null;
  })()`);
}
const cur = () => ev(`(() => { const c = _moyCourant(S.classes.c1); return c.periode + ' · ' + c.rel.id; })()`);

test('← → parcourt les imports dans l’ordre, d’une période à la suivante, et s’arrête au bout', () => {
  monter();
  assert.strictEqual(cur(), 'Semestre 2 · d', 'à l’ouverture : le plus récent');
  assert.strictEqual(ev(`moyNav(1)`), false, 'dernier import : rien après');
  const vus = [];
  while (ev(`moyNav(-1)`)) vus.push(cur());
  assert.deepStrictEqual(vus, ['Semestre 2 · c', 'Semestre 1 · b', 'Semestre 1 · a']);
  assert.strictEqual(cur(), 'Semestre 1 · a');
  assert.strictEqual(ev(`moyNav(1)`), true);
  assert.strictEqual(ev(`moyNav(1)`), true);
  assert.strictEqual(cur(), 'Semestre 2 · c', 'repasse en S2 par la droite');
});

test('hors de propos : vue Évolution, aucun import, aucune classe → null (la flèche garde son rôle)', () => {
  monter();
  ev(`_moyVue = 'evolution'`);
  assert.strictEqual(ev(`moyNav(-1)`), null);
  assert.strictEqual(cur(), 'Semestre 2 · d', 'rien n’a bougé');
  ev(`_moyVue = 'tableau'; S.moyennes = {}`);
  assert.strictEqual(ev(`moyNav(-1)`), null);
  ev(`S.cur = null; S.classes = {}`);
  assert.strictEqual(ev(`moyNav(1)`), null);
});

test('l’écouteur : onglet Moyennes, aucune modale, ni menu déroulant ni radio ni curseur, sans modificateur', () => {
  const i = SRC.indexOf("if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight')");
  assert.ok(i > 0);
  const bloc = SRC.slice(i, SRC.indexOf('return;\n  }', i));
  assert.ok(SRC.lastIndexOf('_isTextEntryTarget(e.target)) return;', i) > SRC.lastIndexOf("document.addEventListener('keydown', e => {", i), 'après la garde de saisie de texte');
  for (const m of ["id === 'tab-moyennes'", "!document.querySelector('.mo.on')", "'SELECT'", "'radio'", "'range'", '!ctrl', '!e.altKey', '!e.shiftKey', 'moyNav(', '!== null) e.preventDefault()'])
    assert.ok(bloc.includes(m), m);
  assert.match(SRC, /title="Flèches ← → du clavier : import précédent ou suivant">Import du/);
});
