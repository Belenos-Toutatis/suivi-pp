// 🤖 Synthèse DE la classe par une IA (v1.71.0) : les bilans d'un moment sous des repères, les chiffres de la classe,
// une réponse courte rangée sur la classe, lue dans Vie de classe et imprimée en tête de la synthèse de période.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null; for (const k in _iaClEtats) delete _iaClEtats[k];`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;
const COL = `_ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0')`;
const MODE = `{ type: 'conseil', date: _periods(getCls())[0].end }`;
const PLIE = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const restes = (texte, noms) => noms.filter(n => new RegExp(`(^|[^\\p{L}\\p{N}])${ESC(PLIE(n))}([^\\p{L}\\p{N}]|$)`, 'u').test(PLIE(texte)));

test('modèle : une synthèse par moment, sur la classe ; vidée = retirée ; chargement abîmé nettoyé', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), p = _periods(cls)[1], m = { type: 'miperiode', date: p.start }, o = [];
    o.push(synthClasseSet(cls, m, ' Classe calme. '), synthClasseSet(cls, m, 'Classe calme.'), synthClasseSet(cls, m, 'Classe calme et active.'));
    o.push(_synthClasseCible(cls, m).texte, _synthClasseOf(cls).length, synthClasseSet(cls, m, ''), _synthClasseOf(cls).length);
    return o; })()`);
  assert.deepStrictEqual(r, ['ajout', null, 'modif', 'Classe calme et active.', 2, 'suppr', 1], 'la démo en porte déjà une (conseil du S1)');
  ev(`getCls().synthClasse.push('x', { date: 'hier', texte: 'a' }, { date: '2025-10-01', texte: 3 }); postLoadHook();`);
  assert.deepStrictEqual(evObj(`getCls().synthClasse.map(x => x.id)`), ['demo_sc01']);
  ev(`getCls().synthClasse = {}; postLoadHook();`);
  assert.strictEqual(ev(`'synthClasse' in getCls()`), false);
});

test('le texte et le JSON : la classe en tête, une section par élève qui a un bilan, aucun nom connu', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), col = ${COL}, codes = _iaLotCodes(_iaLotEleves(cls, col, false));
    const t = _iaClasseTexte(cls, col, codes, new Set(IA_BLOCS_CLASSE.map(x => x.k))), j = _iaClasseJSON(t.texte, _iaConsigneSynthClasse());
    const noms = new Set(); Object.values(S.eleves).forEach(s => [s.nom, s.prenom].forEach(x => String(x).split(/[\\s-]+/).forEach(w => { if (w.length >= 3) noms.add(w); })));
    const avec = cls.eleves.filter(s => _bilanCible(cls, s, { type: col.type, date: col.date }) || _decisionCible(cls, s, { type: col.type, date: col.date }) || _synthIACible(cls, s, { type: col.type, date: col.date }) || (_ficheAvis(cls, s, col)?.items.length));
    return { t: t.texte, j, json: JSON.stringify(j), noms: [...noms], nBilans: t.nBilans, avec: avec.length,
      suspects: _iaSuspects(t.texte, new Set([...IA_MOTS_OK, ...t.ok])).map(s => s.mot), sansBlocs: _iaClasseTexte(cls, col, codes, new Set(['bilans'])).texte }; })()`);
  assert.deepStrictEqual(Object.keys(r.j), ['consigne', 'classe', 'eleves', 'reponse_attendue']);
  assert.match(r.j.classe[0], /^Moment : Conseil de classe S1, du 01\/09 au 31\/01\. Classe de 5e, 25 élèves ; \d+ bilans? rédigés? pour ce moment\.$/);
  assert.ok(r.j.classe.some(l => /^Moyenne générale de la classe .* élèves? sous 10 sur \d+\.$/.test(l)), 'les chiffres');
  assert.ok(r.j.classe.some(l => l === 'Heures de vie de classe :'));
  assert.strictEqual(r.j.eleves.length, r.avec, 'une section par élève qui a quelque chose, et seulement eux');
  assert.ok(r.nBilans >= 1 && r.j.eleves.every(e => /^\[Élève \d+\]$/.test(e.eleve)));
  assert.strictEqual(restes(r.t.replace(/\[[^\]]+\]/g, ''), r.noms).length + restes(r.json, r.noms).length, 0, 'aucun nom connu');
  assert.deepStrictEqual(restes(r.json + ' ' + r.noms[3], r.noms), [r.noms[3]], 'MÉTA-TEST : le détecteur voit un nom');
  assert.deepStrictEqual(r.suspects, []);
  assert.doesNotMatch(r.sansBlocs, /Moyenne générale|Heures de vie de classe|Décisions :/, 'les cases décochées ne partent pas');
});

test('la réponse : un texte, ou un JSON qui en porte un', () => {
  ev(DEMO);
  assert.strictEqual(ev(`_iaClasseLire('Voici : {"synthese": "Classe calme."}')`), 'Classe calme.');
  assert.strictEqual(ev(`_iaClasseLire('Une classe agréable.\\n\\nÀ suivre : le calme.')`), 'Une classe agréable.\n\nÀ suivre : le calme.');
});

test('fenêtre : réponse rangée sur la classe (un cran d’undo), lue dans Vie de classe, imprimée en tête de la synthèse de période', () => {
  ev(DEMO);
  ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:miperiode:0'; openSynthClasse();`);
    assert.match(ev(`__els.get('mias-txt').value`), /^Moment : Bilan de mi-période S1/);
    const c = ev(`Object.values(_iaCl.codes)[0]`), sid = ev(`Object.keys(_iaCl.codes)[0]`), p = ev(`S.eleves[${JSON.stringify(sid)}].prenom`);
    ev(`undoStack.length = 0; __els.get('mias-rep').value = 'Classe vivante. **[Élève ${c}]** porte le groupe.'; iaClReponseSaisie();`);
    assert.match(ev(`__els.get('mias-rest').innerHTML`), /1 élève cité/);
    ev(`iaClRangerUI()`);
    const mode = `{ type: 'miperiode', date: _periods(getCls())[0].start }`;
    assert.strictEqual(ev(`_synthClasseCible(getCls(), ${mode}).texte`), `Classe vivante. ${p} porte le groupe.`);
    assert.strictEqual(ev(`undoStack.length`), 1);
    // Vie de classe : échappée, et retirable.
    ev(`synthClasseSet(getCls(), ${MODE}, '<b>gras</b> & Cie')`);
    const h = ev(`_synthClasseSecHTML(getCls())`);
    assert.match(h, /🤖 Synthèses de la classe <span class="fi-vide">\(2\)<\/span>/);
    assert.match(h, /&lt;b&gt;gras&lt;\/b&gt; &amp; Cie/);
    assert.match(h, /Conseil de classe S1 · rangée le/);
    // Synthèse de période imprimée : en tête quand le bloc est coché (d'office), absente sinon.
    const imp = blocs => ev(`(() => { const cls = getCls(), col = ${COL}; return _periodePrintHTML(cls, 0, { type: 'conseil', col, forme: 'tableau', blocs: ${JSON.stringify(blocs)} }).html; })()`);
    assert.ok(evObj(`_periodePrintOpts.blocs`).includes('classe'), 'cochée d’office');
    assert.match(imp(['bilan', 'classe']), /<div class="print-hvc pp-pl"><strong>Synthèse de la classe<\/strong> &lt;b&gt;gras/);
    assert.doesNotMatch(imp(['bilan']), /Synthèse de la classe/);
    ev(`undoLast(); undoLast();`);
  } finally { ev(FIN_ELS); }
});

test('✏️ Écrire et ✏️ Modifier : la synthèse de la classe à la main, sans IA ; un cran d’undo ; vider la retire', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _scEdit = null; renderDelegues = () => {};`);
  ev(`window.__gidSc = document.getElementById; document.getElementById = id => { if (!window.__scEls) window.__scEls = new Map(); if (!__scEls.has(id)) __scEls.set(id, document.createElement('div')); return __scEls.get(id); };`);
  try {
    const mi = `_ficheMoments(getCls()).find(c => c.key === 'bil:miperiode:0')`;
    assert.strictEqual(ev(`!!_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date })`), false, 'la démo n’en a pas à la mi-S1');
    ev(`synthClasseEcrireUI(); _scEdit.colKey = 'bil:miperiode:0';`);
    const h = ev(`_synthClasseSecHTML(getCls())`);
    assert.match(h, /id="sc-mom"/); assert.match(h, /id="sc-txt"/); assert.match(h, /✏️ Écrire/);
    ev(`document.getElementById('sc-mom').value = 'bil:miperiode:0'; document.getElementById('sc-txt').value = '  Une classe agréable, au travail inégal.  '; synthClasseEcrireOkUI();`);
    assert.strictEqual(ev(`_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date }).texte`), 'Une classe agréable, au travail inégal.');
    assert.strictEqual(ev(`undoStack.length`), 1);
    // Modifier : sur place, le même moment.
    const id = ev(`_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date }).id`);
    ev(`synthClasseModifierUI(${JSON.stringify(id)})`);
    assert.match(ev(`_synthClasseSecHTML(getCls())`), /<textarea id="sc-txt"[^>]*>Une classe agréable, au travail inégal\.<\/textarea>/);
    ev(`document.getElementById('sc-txt').value = 'Une classe agréable.'; synthClasseEcrireOkUI();`);
    assert.strictEqual(ev(`_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date }).texte`), 'Une classe agréable.');
    // Rien de changé : pas de cran d'undo. Vidé : retirée.
    const n = ev(`undoStack.length`);
    ev(`synthClasseModifierUI(${JSON.stringify(id)}); document.getElementById('sc-txt').value = 'Une classe agréable.'; synthClasseEcrireOkUI();`);
    assert.strictEqual(ev(`undoStack.length`), n);
    ev(`synthClasseModifierUI(${JSON.stringify(id)}); document.getElementById('sc-txt').value = '   '; synthClasseEcrireOkUI();`);
    assert.strictEqual(ev(`_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date })`), null);
    ev(`undoLast()`);
    assert.strictEqual(ev(`_synthClasseCible(getCls(), { type: ${mi}.type, date: ${mi}.date }).texte`), 'Une classe agréable.', 'Ctrl+Z la rend');
    // Écrire sur un moment qui a déjà la sienne : elle revient dans le champ.
    ev(`synthClasseEcrireUI(); _scEdit.colKey = 'bil:conseil:0';`);
    const c0 = ev(`_synthClasseCible(getCls(), { type: 'conseil', date: _periods(getCls())[0].end }).texte`);
    assert.ok(ev(`_synthClasseSecHTML(getCls())`).includes(ev(`_escName(${JSON.stringify(c0)})`)), 'la synthèse rangée revient dans le champ');
  } finally { ev(`document.getElementById = __gidSc;`); }
});
