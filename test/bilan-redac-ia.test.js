// ✍️ Le bilan corrigé ou reformulé par une IA (v1.80.0) — l'utilisateur : « une correction orthographique,
// grammaticale, mais aussi une re-rédaction, une reformulation, une réorganisation de ce qui est rédigé dans les
// bilans ». Le bilan part pseudonymisé, la proposition revient noms remis, comparée mot à mot, et ne remplace le bilan
// que sur « Remplacer le bilan » (un cran d'undo). Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;

test('comparaison mot à mot : gardé, retiré, ajouté ; les blancs ne comptent pas', () => {
  const d = evObj(`_motsDiff('Nathan a fait des progret en math.', 'Nathan a fait des progrès en  maths.')`);
  assert.deepStrictEqual(d, [{ k: '=', t: 'Nathan a fait des ' }, { k: '-', t: 'progret ' }, { k: '+', t: 'progrès ' }, { k: '=', t: 'en  ' }, { k: '-', t: 'math.' }, { k: '+', t: 'maths.' }]);
  assert.deepStrictEqual(evObj(`_motsDiff('a b', 'a b')`), [{ k: '=', t: 'a b' }]);
  assert.deepStrictEqual(evObj(`_motsDiff('', 'x')`), [{ k: '+', t: 'x' }]);
  const long = evObj(`_motsDiff('m '.repeat(700), 'm')`);
  assert.deepStrictEqual(long.map(x => x.k), ['-', '+'], 'au-delà de 600 mots : remplacé en bloc');
});

test('consignes : corriger ne touche qu’à la langue, reformuler garde tout ; la longueur du bulletin pour un conseil reformulé', () => {
  const c = ev(`_iaRedacConsigne('corriger', true, 600)`), r = ev(`_iaRedacConsigne('reformuler', true, 600)`);
  assert.match(c, /UNIQUEMENT l'orthographe/);
  assert.ok(!/600/.test(c), 'corriger ne parle pas de longueur');
  assert.match(r, /Gardez TOUTES les informations/);
  assert.match(r, /au plus 600 caractères/);
  assert.ok(!/600/.test(ev(`_iaRedacConsigne('reformuler', false, 600)`)), 'mi-période : pas de limite');
  for (const t of [c, r]) assert.match(t, /gardez-les tels quels, crochets compris/);
});

test('de bout en bout : le bilan part sans nom, la réponse revient noms remis et comparée, Remplacer = un cran d’undo', () => {
  ev(DEMO);
  ev(ELS);
  try {
    const sid = ev(`(() => { const cls = getCls(); return cls.eleves.find(s => _bilanCible(cls, s, { type: 'conseil', date: _ficheMoments(cls).find(c => c.key === 'bil:conseil:0').date })); })()`);
    assert.ok(sid, 'la démo a un bilan au conseil du S1');
    const J = JSON.stringify(sid), prenom = ev(`S.eleves[${J}].prenom`);
    const mode = `{ type: 'conseil', date: _ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0').date }`;
    const avant = ev(`_bilanCible(getCls(), ${J}, ${mode}).texte`);
    ev(`_ficheSid = ${J}; _ficheMoment = 'bil:conseil:0'; undoStack.length = 0;
        S.eleves[${J}].bilans.find(b => b.texte === ${JSON.stringify(avant)}).texte = ${JSON.stringify(prenom)} + ' doit travaillé davantage.';
        iaRedacModeUI('reformuler'); openRedacIA();`);
    const txt = ev(`__els.get('mir-txt').value`);
    assert.strictEqual(txt, '[Élève] doit travaillé davantage.');
    const contenu = ev(`_iaRedacContenu(_iaRedac)`);
    assert.ok(contenu.startsWith(ev(`IA_REDAC_CONSIGNES.reformuler`)) && contenu.trimEnd().endsWith(txt));
    assert.ok(!contenu.includes(prenom), 'aucun prénom ne part');
    assert.match(ev(`__els.get('mir-cons').textContent`), /au plus \d+ caractères/);
    // La réponse : guillemets et gras retirés, repère remis, changements marqués.
    ev(`_iaReponseVers('mir', '« **[Élève] doit travailler davantage.** »')`);
    assert.strictEqual(ev(`_iaRedacProposition(_iaRedac)`), `${prenom} doit travailler davantage.`);
    const html = ev(`__els.get('mir-diff').innerHTML`);
    assert.match(html, /<del>travaillé <\/del><ins>travailler <\/ins>davantage\./);
    assert.match(html, /\/ \d+ caractères/, 'conseil : le compteur du bulletin');
    assert.strictEqual(ev(`undoStack.length`), 0, 'rien ne change avant Remplacer');
    ev(`iaRedacRangerUI()`);
    assert.strictEqual(ev(`_bilanCible(getCls(), ${J}, ${mode}).texte`), `${prenom} doit travailler davantage.`);
    assert.strictEqual(ev(`undoStack.length`), 1);
    ev(`undoLast()`);
    assert.strictEqual(ev(`_bilanCible(getCls(), ${J}, ${mode}).texte`), `${prenom} doit travaillé davantage.`, 'Ctrl+Z rend l’ancien bilan');
  } finally { ev(FIN_ELS); ev(`iaRedacModeUI('corriger')`); }
});

test('sans bilan écrit, ou IA désactivée : rien ne s’ouvre', () => {
  ev(DEMO);
  ev(`(() => { const cls = getCls(); _ficheSid = cls.eleves.find(s => !_bilansOf(s).length) || cls.eleves[0]; S.eleves[_ficheSid].bilans = []; _ficheMoment = 'bil:conseil:0'; _iaRedac = null; openRedacIA(); })()`);
  assert.strictEqual(ev(`_iaRedac`), null);
  assert.ok(ev(`_ficheRedacHTML(getCls(), S.eleves[_ficheSid], _ficheMomentCourant(getCls()))`).includes('openRedacIA()'));
  ev(`S.prefs.iaActive = false`);
  assert.ok(!ev(`_ficheRedacHTML(getCls(), S.eleves[_ficheSid], _ficheMomentCourant(getCls()))`).includes('openRedacIA()'), 'désactivée : pas de bouton');
  ev(`S.prefs.iaActive = true`);
});

test('envoi direct : une requête de texte simple, nommée dans le journal', () => {
  const r = evObj(`_iaRequete('redac', 'x', { modele: 'claude-opus-5-5' }, 'k')`);
  assert.strictEqual(r.body.output_config.format, undefined, 'pas de forme imposée : du texte');
  assert.deepStrictEqual(r.body.messages, [{ role: 'user', content: 'x' }]);
  assert.ok(ev(`IA_SORTES.redac && IA_SORTES_COURT.redac && IA_PLEIN_MODALES.includes('mir')`));
});
