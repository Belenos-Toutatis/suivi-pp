// Audit du 2026-11-22 — fiche élève, annulation, petits écrans : les défauts confirmés, corrigés. Chaque test a
// été vérifié en échec sur la version d'avant la correction. Noms inventés (ceux de la démonstration).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
const SETUP = `createDemo({ force: true }); undoStack.length = 0; redoStack.length = 0;
  const cls = getCls(); _ficheSid = cls.eleves[0];
  const col = _ficheMomentCourant(cls), mode = { type: col.type, date: col.date };
  const champ = (value, bad) => ({ value, validity: { badInput: !!bad } });`;

test('la date du bilan de la classe s\'efface en vidant le champ (« Date illisible : l\'ancienne est gardée » la rendait ineffaçable)', () => {
  const r = J(`${SETUP}
    delete cls.datesBilan; dateBilanSet(cls, mode, col.date);
    const posee = !!_dateBilanCible(cls, mode), datesBilans = JSON.stringify(cls.eleves.map(s => _bilanCible(cls, s, mode)?.date));
    undoStack.length = 0;
    ficheDateBilanUI(champ('', true)); const partielle = !!_dateBilanCible(cls, mode);     // à moitié tapée : rien ne bouge
    ficheDateBilanUI(champ('', false));                                                   // vidée exprès
    const apres = { retiree: !_dateBilanCible(cls, mode), crans: undoStack.length, bilansIntacts: JSON.stringify(cls.eleves.map(s => _bilanCible(cls, s, mode)?.date)) === datesBilans };
    undoLast(true);
    return { posee, partielle, apres, rendue: !!_dateBilanCible(getCls(), mode) };`);
  assert.strictEqual(r.posee, true);
  assert.strictEqual(r.partielle, true, 'une date partielle n\'efface rien');
  assert.deepStrictEqual(r.apres, { retiree: true, crans: 1, bilansIntacts: true });
  assert.strictEqual(r.rendue, true, 'Ctrl+Z rend la date');
});

test('vider le champ quand la classe n\'a pas de date de bilan ne pose aucun cran d\'annulation', () => {
  const r = J(`${SETUP} delete cls.datesBilan; ficheDateBilanUI(champ('', false)); return undoStack.length;`);
  assert.strictEqual(r, 0);
});

test('Ctrl+Z / Ctrl+Y réappliquent l\'interrupteur de l\'IA et la police (les boutons 🤖 restaient cachés jusqu\'au retour dans Données)', () => {
  const r = J(`${SETUP}
    const vrai = _applyPolices; let n = 0; _applyPolices = function () { n++; return vrai.apply(this, arguments); };
    try {
      pushUndo(); S.prefs.iaActive = false; save();
      n = 0; undoLast(true); const undo = n;
      n = 0; redoLast(true); const redo = n;
      return { undo, redo, ia: S.prefs.iaActive };
    } finally { _applyPolices = vrai; }`);
  assert.ok(r.undo >= 1, 'Ctrl+Z réapplique les réglages portés par <html>');
  assert.ok(r.redo >= 1, 'Ctrl+Y aussi');
  assert.strictEqual(r.ia, false);
});

test('courbe des observations : l\'étiquette « +n » du dernier point n\'est plus rognée par le haut du dessin', () => {
  // Un cumul ne baisse pas : le dernier point est le plus haut, son étiquette sortait du cadre (ligne de base à 5 px).
  const r = J(`${SETUP}
    const sid = cls.eleves.find(s => { const p = _ficheCourbePoints(cls, s, { ..._ficheFenetreMoment(cls, s, col).p }, { carnet: true, mbn: false }); return p.length > 1 && p[p.length - 1][1] > p[p.length - 2][1]; });
    _ficheCourbeSrc.carnet = true;
    const h = _ficheCourbeHTML(cls, S.eleves[sid], col);
    return { ys: [...h.matchAll(/class="lb" x="[^"]*" y="([^"]*)"/g)].map(m => +m[1]) };`);
  assert.ok(r.ys.length > 0, 'la démonstration a une courbe qui monte');
  assert.ok(Math.min(...r.ys) >= 12, 'étiquette la plus haute : ' + Math.min(...r.ys));   // 10,5 px de corps : ligne de base à 12 au moins
});

test('le cadre Bilans ne colle au bas de la fiche que sur un écran assez large ET assez haut (arbitré : sous 700 px de large il reprend sa place)', () => {
  const i = SRC.indexOf('.pf-bas { position: sticky;');
  const media = SRC.slice(SRC.lastIndexOf('@media', i), i);
  assert.match(media, /min-width:\s*700px/);
  assert.match(media, /min-height:\s*560px/);
});

test('infobulle : mesurée à gauche de l\'écran avant d\'être placée, et retirée quand son élément a quitté la page', () => {
  const fn = SRC.slice(SRC.indexOf('function _bulleMontrer('), SRC.indexOf('function _bulleMontrer(') + 1600);
  // `left` de la bulle précédente : l'élément fixe se réduisait à la place restante, la mesure était fausse et la
  // bulle finissait collée au bord droit (375 px).
  assert.ok(fn.indexOf("style.left = '0px'") > 0 && fn.indexOf("style.left = '0px'") < fn.indexOf('offsetWidth'), 'position remise à gauche AVANT la mesure');
  assert.match(fn, /isConnected/, 'surveille que la cible est toujours dans la page');
  const r = J(`
    globalThis.innerWidth = 1000; globalThis.innerHeight = 800;
    const c = { isConnected: true, hasAttribute: () => false, removeAttribute() {}, getAttribute: () => null };
    _bulle.cible = c; _bulle.texte = 'Texte'; _bulle.svgTitre = null; _bulleMontrer();
    const montree = _bulle.el && _bulle.el.hidden === false;
    c.isConnected = false; _bulleVeille();
    return { montree, cachee: _bulle.el.hidden === true, cible: _bulle.cible };`);
  assert.deepStrictEqual(r, { montree: true, cachee: true, cible: null });
});
