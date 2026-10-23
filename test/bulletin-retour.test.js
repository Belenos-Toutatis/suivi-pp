// 📄 → 🤖 → 🎓 Les appréciations retravaillées dans une conversation, rapportées dans le BILAN du conseil (v1.76.0) :
// arbitré par l'utilisateur, le bilan du conseil EST l'appréciation du bulletin (600 caractères au plus) ; le bilan
// déjà écrit part comme brouillon ; la correspondance repère → élève reste dans l'app. Noms de la démo (inventés).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;
  localStorage.removeItem(LS_IA_LOT); for (const k in _iaLotEtats) delete _iaLotEtats[k];`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;

test('la limite : 600 d’office, réglable de 100 à 5 000, un compteur pour le conseil seulement', () => {
  ev(DEMO);
  assert.strictEqual(ev(`_appreciationMax()`), 600);
  assert.strictEqual(ev(`_bilanCompteHTML(642)`), '642 / 600 caractères — 42 de trop pour le bulletin');
  ev(`renderDonnees = () => {}; setPref('appreciationMax', '40')`);
  assert.strictEqual(ev(`_appreciationMax()`), 600, 'refusé : moins de 100');
  ev(`setPref('appreciationMax', '500')`);
  assert.strictEqual(ev(`_appreciationMax()`), 500);
  ev(`setPref('appreciationMax', '600')`);
  const f = c => ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === '${c}'); return _ficheRedacHTML(cls, S.eleves[cls.eleves[0]], col); })()`);
  assert.match(f('bil:conseil:0'), /id="fi-bil-n"[^>]*>\d+ \/ 600 caractères/);
  assert.ok(!/id="fi-bil-n"/.test(f('bil:miperiode:0')), 'pas de compteur pour une mi-période');
});

test('toute la classe → le bilan du conseil : avant / après, un texte trop long décoché, un cran d’undo, la synthèse IA intacte', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:conseil:0'; openSynthIAClasse();`);
    assert.strictEqual(ev(`_iaLotDest(_iaLot, _iaLotCol(_iaLot))`), 'bilan', 'un conseil : le bilan d’office');
    const cls = evObj(`(() => { const c = getCls(); return c.eleves; })()`), codes = evObj(`_iaLot.codes`);
    const mode = `{ type: 'conseil', date: _periods(getCls())[0].end }`;
    // Trois élèves : un qui a déjà un bilan (remplacé), un sans bilan (créé), un trop long pour le bulletin.
    const avec = cls.find(s => ev(`!!_bilanCible(getCls(), ${JSON.stringify(s)}, ${mode})`)), sans = cls.find(s => !ev(`!!_bilanCible(getCls(), ${JSON.stringify(s)}, ${mode})`));
    const long = cls.find(s => s !== avec && s !== sans);
    const avant = ev(`_bilanCible(getCls(), ${JSON.stringify(avec)}, ${mode}).texte`), synthAvant = ev(`JSON.stringify(_synthIAOf(${JSON.stringify(avec)}))`);
    const rep = JSON.stringify({ syntheses: [
      { eleve: `[Élève ${codes[avec]}]`, appreciation: 'Un semestre sérieux, à poursuivre.' },
      { eleve: `[Élève ${codes[sans]}]`, appreciation: 'Des efforts visibles en fin de période.' },
      { eleve: `[Élève ${codes[long]}]`, appreciation: 'Très long. '.repeat(70) }] });
    ev(`__els.get('miac-rep').value = ${JSON.stringify(rep)}; iaLotReponseSaisie(); _iaLotRevueRender();`);
    const R = evObj(`_iaLot.revue.lignes.map(l => ({ sid: l.sid, etat: l.etat, avantTexte: l.avantTexte, trop: l.trop, coche: _iaLotCoche(_iaLot, l) }))`);
    const L = sid => R.find(l => l.sid === sid);
    assert.deepStrictEqual([L(avec).etat, L(avec).avantTexte, L(avec).coche], ['remplace', avant, true]);
    assert.deepStrictEqual([L(sans).etat, L(sans).coche], ['nouvelle', true]);
    assert.deepStrictEqual([L(long).trop, L(long).coche], [true, false], 'trop long pour le bulletin : décoché d’office');
    const html = ev(`__els.get('miac-revue').innerHTML`);
    assert.match(html, /Bilan écrit :/);
    assert.match(html, /de trop pour le bulletin/);
    ev(`undoStack.length = 0; iaLotRangerUI();`);
    assert.strictEqual(ev(`undoStack.length`), 1);
    assert.strictEqual(ev(`_bilanCible(getCls(), ${JSON.stringify(avec)}, ${mode}).texte`), 'Un semestre sérieux, à poursuivre.');
    assert.strictEqual(ev(`_bilanCible(getCls(), ${JSON.stringify(sans)}, ${mode}).texte`), 'Des efforts visibles en fin de période.');
    assert.strictEqual(ev(`!!_bilanCible(getCls(), ${JSON.stringify(long)}, ${mode}) && _bilanCible(getCls(), ${JSON.stringify(long)}, ${mode}).texte.startsWith('Très long')`), false, 'décoché : pas rangé');
    assert.strictEqual(ev(`JSON.stringify(_synthIAOf(${JSON.stringify(avec)}))`), synthAvant, 'la synthèse IA n’est pas touchée');
    ev(`undoLast()`);
    assert.strictEqual(ev(`_bilanCible(getCls(), ${JSON.stringify(avec)}, ${mode}).texte`), avant, 'Ctrl+Z rend le bilan d’avant');
  } finally { ev(FIN_ELS); }
});

test('une mi-période : la synthèse IA d’office ; « Ranger dans » change la destination', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:miperiode:0'; openSynthIAClasse('bil:miperiode:0');`);
    assert.strictEqual(ev(`_iaLotDest(_iaLot, _iaLotCol(_iaLot))`), 'synthese');
    ev(`iaLotDestUI('bilan')`);
    assert.strictEqual(ev(`_iaLotDest(_iaLot, _iaLotCol(_iaLot))`), 'bilan');
    assert.match(ev(`__els.get('miac-dest').innerHTML`), /<option value="bilan" selected>le bilan de ce moment<\/option>/);
  } finally { ev(FIN_ELS); }
});

test('de qui on parle : le repère dans la fiche, la fenêtre des correspondances (bloquée : dit, sans erreur)', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:conseil:0'; openSynthIAClasse();`);
    const sid = ev(`getCls().eleves[2]`), n = ev(`_iaLot.codes[${JSON.stringify(sid)}]`);
    const f = ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'); return _ficheRedacHTML(cls, S.eleves[${JSON.stringify(sid)}], col); })()`);
    assert.ok(f.includes(`Dans la conversation : <strong>[Élève ${n}]</strong>`));
    assert.match(ev(`__els.get('miac-corr').innerHTML`), /iaCorrFenetreUI\(\)/);
    ev(`window.open = () => null; iaCorrFenetreUI();`);
    assert.strictEqual(ev(`_iaCorrWin`), null);
  } finally { ev(FIN_ELS); }
});
