// Audit du 2026-11-22 — élection des délégués : les défauts confirmés, corrigés. Chaque test a été
// vérifié en échec sur la version d'avant la correction. Noms inventés.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

// Une classe de 10 élèves, une élection ouverte à trois candidats. `entree(n)` : la touche Entrée
// sur une case du bulletin n (le DOM du harnais ne rend aucune ligne : « pas de ligne suivante »).
const SETUP = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id: '5C', nom: '5C', annee: '2025-26', eleves: [], ord: 0 }; S.cur = '5C';
  for (let i = 1; i <= 10; i++) { const id = 's' + i; S.eleves[id] = { id, nom: 'N' + i, prenom: 'P' + i, classe_id: '5C', tags: [] }; S.classes['5C'].eleves.push(id); }
  undoStack.length = 0;
  const el = electionCreate('5C', { date: '2025-10-07', binome: false });
  const [A, B, C] = ['s1', 's2', 's3'].map(s => electionAddCandidat(el, s, null).id);
  _elView = el.id;
  const entree = n => electionBulKey({ key: 'Enter', target: { dataset: { n: String(n) } }, preventDefault() {} });
  const etat = () => { const t = _elCurrent().tours[0], d = _elDepouillement(_elCurrent(), 0); return { lignes: t.bulletins.length, alire: t.bulletins.filter(b => b.lu === false).length, votants: d.votants, blancs: d.blancs, exprimes: d.exprimes }; };
`;

test('urne préparée : Entrée sur la dernière ligne ne crée pas un bulletin de plus (il était compté blanc jusqu\'au PV)', () => {
  const r = J(`${SETUP}
    electionPreparerBulletins(el, 0, 3);
    for (let n = 1; n <= 3; n++) { electionSetBulletin(el, 0, n, { voix: [A] }); entree(n); }
    return etat();`);
  assert.deepStrictEqual(r, { lignes: 3, alire: 0, votants: 3, blancs: 0, exprimes: 3 });
});

test('urne préparée : une dernière ligne laissée vide puis validée par Entrée reste UN blanc, sans ligne de plus', () => {
  const r = J(`${SETUP}
    electionPreparerBulletins(el, 0, 3);
    electionSetBulletin(el, 0, 1, { voix: [A] }); electionSetBulletin(el, 0, 2, { voix: [B] }); entree(3);
    return etat();`);
  assert.deepStrictEqual(r, { lignes: 3, alire: 0, votants: 3, blancs: 1, exprimes: 2 });
});

test('sans compte de l\'urne : la ligne créée par Entrée est « à lire », ni votant ni blanc tant qu\'elle n\'est pas lue', () => {
  const r = J(`${SETUP}
    electionNewBulletinUI();                                   // « + Bulletin » : la première ligne
    const un = etat();
    electionSetBulletin(el, 0, 1, { voix: [A] }); entree(1);   // lue, puis Entrée : la ligne suivante
    const deux = etat();
    electionSetBulletin(el, 0, 2, { voix: [B] });              // la lire la compte
    return { un, deux, trois: etat() };`);
  assert.deepStrictEqual(r.un, { lignes: 1, alire: 1, votants: 0, blancs: 0, exprimes: 0 });
  assert.deepStrictEqual(r.deux, { lignes: 2, alire: 1, votants: 1, blancs: 0, exprimes: 1 });
  assert.deepStrictEqual(r.trois, { lignes: 2, alire: 0, votants: 2, blancs: 0, exprimes: 2 });
});

test('« + Bulletin » au-delà du compte de l\'urne reste possible (un bulletin oublié), en ligne à lire', () => {
  const r = J(`${SETUP}
    electionPreparerBulletins(el, 0, 2);
    electionSetBulletin(el, 0, 1, { voix: [A] }); electionSetBulletin(el, 0, 2, { voix: [B] });
    electionNewBulletinUI();
    return etat();`);
  assert.deepStrictEqual(r, { lignes: 3, alire: 1, votants: 2, blancs: 0, exprimes: 2 });
});

test('grille des bulletins dans son cadre : le cadre et ses boutons tiennent sous la barre de l\'élection', () => {
  // À 1024 × 768 la grille ne tient pas en largeur dans son volet : elle garde son cadre. Trop haut, il passait
  // sous la barre de l'élection quand la page défilait jusqu'aux boutons, et la ligne des candidats disparaissait.
  const regle = (SRC.match(/\.rel-wrap\.frozen\.bul-wrap \{[^}]*\}/) || [''])[0];
  assert.match(regle, /max-height:[^;]*var\(--el-head-h/, 'la hauteur du cadre retranche la barre de l\'élection');
  assert.match(regle, /max-height:[^;]*var\(--bul-sous-h/, 'et les boutons sous la grille');
  const fn = SRC.slice(SRC.indexOf('function _elEnteteColle('), SRC.indexOf('function _elEnteteColle(') + 900);
  assert.match(fn, /setProperty\('--bul-sous-h'/, '_elEnteteColle mesure les boutons sous la grille');
});

test('l\'élection ouverte est reprise après un rechargement de la page (mémoire de séance), jamais une élection disparue ni celle d\'une autre classe', () => {
  const r = J(`${SETUP}
    const mem = {}; globalThis.sessionStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    renderDelegues();                                   // l'élection est ouverte : retenue
    const retenue = JSON.parse(mem.suiviPP_elView || 'null');
    _elView = null; _elViewReprendre(); const reprise = _elView === el.id;   // « rechargement »
    _elView = null; S.cur = 'autre'; _elViewReprendre(); const autreClasse = _elView; S.cur = '5C';
    const garde = mem.suiviPP_elView;
    delete S.elections['5C'][el.id]; _elView = null; _elViewReprendre(); const disparue = _elView;
    mem.suiviPP_elView = JSON.stringify({ c: '5C', id: 'constructor' }); _elViewReprendre(); const heritee = _elView;
    mem.suiviPP_elView = garde; _elView = null; renderDelegues();            // retour à la liste : oubliée
    return { retenue, reprise, autreClasse, disparue, heritee, oubliee: !('suiviPP_elView' in mem) };`);
  assert.strictEqual(r.retenue.c, '5C');
  assert.strictEqual(r.reprise, true);
  assert.strictEqual(r.autreClasse, null);
  assert.strictEqual(r.disparue, null);
  assert.strictEqual(r.heritee, null, 'un id hérité (« constructor ») ne désigne aucune élection');
  assert.strictEqual(r.oubliee, true);
});
