// 🎨 Le ton des avis des collègues (v1.74.0) : passages positifs et négatifs, et leur intensité, surlignés là où
// un avis s'affiche ; analysés par Claude (textes pseudonymisés, mélangés) ; corrigeables à la main. Noms inventés.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;
  localStorage.removeItem(LS_TONS_VUS); _tonsLot = null;`;
const CAMP = `_avisMap(getCls().id)['demo_av1']`;
const PLIE = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

test('un passage posé ou effacé : ce qu’il recouvre est coupé, le reste garde son ton', () => {
  ev(DEMO);
  const r = evObj(`(() => { const a = [{ d: 0, f: 10, v: -2 }, { d: 20, f: 30, v: 3 }];
    return { milieu: _tonAvecPassage(a, 4, 6, 1, true), efface: _tonAvecPassage(a, 5, 25, 0), dessus: _tonAvecPassage(a, 0, 10, 2, true) }; })()`);
  assert.deepStrictEqual(r.milieu, [{ d: 0, f: 4, v: -2 }, { d: 4, f: 6, v: 1, m: 1 }, { d: 6, f: 10, v: -2 }, { d: 20, f: 30, v: 3 }]);
  assert.deepStrictEqual(r.efface, [{ d: 0, f: 5, v: -2 }, { d: 25, f: 30, v: 3 }]);
  assert.deepStrictEqual(r.dessus, [{ d: 0, f: 10, v: 2, m: 1 }, { d: 20, f: 30, v: 3 }]);
});

test('le rendu : le texte tel quel (échappé), un passage = son ton ; un texte réécrit n’a plus de ton', () => {
  ev(DEMO);
  const t = 'Bon <b>élève</b> & sérieux, mais bavard.';
  const h = ev(`(() => { const c = ${CAMP}, sid = getCls().eleves[3]; c.avis[sid] = { maths: { travail: ${JSON.stringify(t)} } };
    _tonEcrire(c, sid, 'maths', 'travail', ${JSON.stringify(t)}, [{ d: 0, f: 26, v: 2 }, { d: 28, f: 39, v: -1 }]);
    return _tonHTML(c, sid, 'maths', 'travail', ${JSON.stringify(t)}); })()`);
  assert.ok(!h.includes('<b>'), 'échappé');
  assert.match(h, /<span class="av-tx" data-ton-ref="[^"]+">/);
  assert.match(h, /<span class="ton tp2"[^>]*>Bon &lt;b&gt;élève&lt;\/b&gt; &amp; sérieux<\/span>, <span class="ton tn1"[^>]*>mais bavard<\/span>\./);
  // Le contenu de .av-tx est EXACTEMENT le texte (la correction à la main mesure la sélection dedans).
  const brut = h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.strictEqual(brut, t);
  // Le collègue réécrit son avis : l'empreinte ne correspond plus, rien n'est surligné.
  assert.ok(!/class="ton /.test(ev(`_tonHTML(${CAMP}, getCls().eleves[3], 'maths', 'travail', 'Bon élève, sérieux.')`)));
  // Sur le papier : pas de quoi corriger ; couleurs masquées : rien.
  assert.ok(!/av-tx|title=/.test(ev(`_tonHTML(${CAMP}, getCls().eleves[3], 'maths', 'travail', ${JSON.stringify(t)}, { papier: true })`)));
  ev(`localStorage.setItem(LS_TONS_VUS, '0')`);
  assert.ok(!/class="ton /.test(ev(`_tonHTML(${CAMP}, getCls().eleves[3], 'maths', 'travail', ${JSON.stringify(t)})`)));
  ev(`localStorage.removeItem(LS_TONS_VUS)`);
});

test('la démo : des avis surlignés (du négatif et du positif dans le même avis), un passage corrigé à la main, d’autres à analyser', () => {
  ev(DEMO);
  const b = evObj(`_tonsBilan(${CAMP})`);
  assert.ok(b.faits >= 5 && b.aFaire > 0 && b.manuels >= 1, JSON.stringify(b));
  const fr = evObj(`(() => { const c = ${CAMP}, sid = getCls().eleves[0]; return _tonSegs(c, sid, 'francais', 'comportement', c.avis[sid].francais.comportement).map(x => x.v); })()`);
  assert.deepStrictEqual(fr, [1, -2]);
});

test('ce qui part pour l’analyse : textes pseudonymisés, mélangés, sans élève ni discipline, seulement ceux à faire', () => {
  ev(DEMO);
  // Un avis qui nomme l'élève et un camarade.
  const sid = ev(`getCls().eleves[4]`), nom = ev(`S.eleves[getCls().eleves[4]].prenom`), cam = ev(`S.eleves[getCls().eleves[5]].prenom`);
  ev(`${CAMP}.avis[${JSON.stringify(sid)}] = { maths: { travail: ${JSON.stringify(`${nom} travaille bien avec ${cam}, mais oublie souvent ses affaires.`)} } }`);
  let g = 7;
  const st = evObj(`(() => { let g = 7; return _tonsPreparer(getCls(), ${CAMP}, false, () => (g = (g * 16807) % 2147483647) / 2147483647); })()`);
  const b = evObj(`_tonsBilan(${CAMP})`);
  assert.strictEqual(st.items.length, b.aFaire, 'seulement les avis sans ton');
  const json = JSON.stringify(st.json);
  const noms = new Set(); for (const s of evObj(`Object.values(S.eleves).map(s => [s.nom, s.prenom])`)) for (const x of s) String(x).split(/[\s-]+/).forEach(w => { if (w.length >= 3) noms.add(w); });
  for (const n of noms) assert.ok(!new RegExp(`(^|[^\\p{L}])${PLIE(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(PLIE(json)), `aucun nom : ${n}`);
  assert.ok(!/eleve|discipline|maths|sid/i.test(Object.keys(st.json.avis[0]).join(' ')), 'chaque avis : id, rubrique, texte');
  assert.deepStrictEqual(Object.keys(st.json.avis[0]).sort(), ['id', 'rubrique', 'texte']);
  assert.notDeepStrictEqual(st.items.map(i => i.sid + i.did + i.k), evObj(`_tonsAFaire(${CAMP}, false).map(i => i.sid + i.did + i.k)`), 'ordre mélangé');
  // La requête impose la forme de la réponse.
  const r = evObj(`_iaRequete('tons', '{}', { modele: 'claude-opus-5-5', espace: '' }, 'sk-ant-api03-xxxxxxxxxxxx')`);
  assert.deepStrictEqual(r.body.output_config.format.schema.required, ['resultats']);
});

test('la réponse rangée : extraits retrouvés (noms remis, espaces souples), passages à la main gardés, un cran d’undo', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[4]`), nom = ev(`S.eleves[getCls().eleves[4]].prenom`);
  const t = `${nom} travaille bien en classe, mais oublie  souvent ses affaires.`;
  ev(`(() => { const c = ${CAMP}; c.avis[${JSON.stringify(sid)}] = { maths: { travail: ${JSON.stringify(t)}, comportement: 'Agréable.' } };
    _tonEcrire(c, ${JSON.stringify(sid)}, 'maths', 'comportement', 'Agréable.', [{ d: 0, f: 9, v: 3, m: 1 }]); })()`);
  ev(`_tonsLot = _tonsPreparer(getCls(), ${CAMP}, true)`);
  const ids = evObj(`_tonsLot.items.filter(i => i.sid === ${JSON.stringify(sid)}).map(i => ({ id: i.id, k: i.k, envoye: _tonsLot.json.avis.find(a => a.id === i.id).texte }))`);
  const tr = ids.find(x => x.k === 'travail'), co = ids.find(x => x.k === 'comportement');
  assert.ok(!tr.envoye.includes(nom), 'le prénom est parti sous un repère');
  const rep = { resultats: [
    { id: tr.id, passages: [{ extrait: tr.envoye.split(',')[0], ton: 2 }, { extrait: 'mais oublie souvent ses affaires.', ton: -1 }, { extrait: 'Jamais écrit dans le texte', ton: -3 }] },
    { id: co.id, passages: [{ extrait: 'Agréable.', ton: 1 }] }] };
  const n0 = ev(`undoStack.length`);
  const out = evObj(`_tonsAppliquer(_tonsLot, ${JSON.stringify('Voici :\n```json\n' + JSON.stringify(rep) + '\n```')})`);
  assert.strictEqual(ev(`undoStack.length`), n0 + 1, 'un seul cran d’undo');
  assert.strictEqual(out.perdus, 1);
  const segs = evObj(`_tonSegs(${CAMP}, ${JSON.stringify(sid)}, 'maths', 'travail', ${JSON.stringify(t)})`);
  assert.deepStrictEqual(segs.map(x => [t.slice(x.d, x.f), x.v]), [[`${nom} travaille bien en classe`, 2], ['mais oublie  souvent ses affaires.', -1]]);
  // Le passage corrigé à la main n'est pas écrasé par l'analyse.
  assert.deepStrictEqual(evObj(`_tonSegs(${CAMP}, ${JSON.stringify(sid)}, 'maths', 'comportement', 'Agréable.')`), [{ d: 0, f: 9, v: 3, m: 1 }]);
  ev(`undoLast()`);
  assert.strictEqual(ev(`_tonSegs(${CAMP}, ${JSON.stringify(sid)}, 'maths', 'travail', ${JSON.stringify(t)})`), null, 'Ctrl+Z défait l’analyse');
  // Une réponse illisible ne range rien.
  assert.strictEqual(evObj(`_tonsAppliquer(_tonsLot, 'pas du JSON')`).avis, 0);
});

test('à la main : la palette pose un ton sur la sélection (un cran d’undo), « Retirer » l’efface', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[0]`), t = ev(`${CAMP}.avis[getCls().eleves[0]].maths.travail`);
  const ref = ev(`[getCls().id, 'demo_av1', ${JSON.stringify(sid)}, 'maths', 'travail'].join('|')`);
  const n0 = ev(`undoStack.length`);
  ev(`_tonPal = { ref: ${JSON.stringify(ref)}, d: 0, f: 8 }; tonPoserUI(1);`);
  assert.strictEqual(ev(`undoStack.length`), n0 + 1);
  assert.deepStrictEqual(evObj(`_tonSegs(${CAMP}, ${JSON.stringify(sid)}, 'maths', 'travail', ${JSON.stringify(t)})`)[0], { d: 0, f: 8, v: 1, m: 1 });
  ev(`_tonPal = { ref: ${JSON.stringify(ref)}, d: 0, f: ${t.length} }; tonPoserUI(0);`);
  assert.deepStrictEqual(evObj(`_tonSegs(${CAMP}, ${JSON.stringify(sid)}, 'maths', 'travail', ${JSON.stringify(t)})`), []);
  // Une référence forgée ou un ton inconnu : rien.
  const n1 = ev(`undoStack.length`);
  ev(`_tonPal = { ref: 'x|y|z|w|v', d: 0, f: 3 }; tonPoserUI(2); _tonPal = { ref: ${JSON.stringify(ref)}, d: 0, f: 3 }; tonPoserUI(7);`);
  assert.strictEqual(ev(`undoStack.length`), n1);
});

test('supprimer un élève emporte le ton de ses avis ; un ton illisible au chargement est écarté', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[0]`);
  assert.ok(ev(`!!${CAMP}.tons[${JSON.stringify(sid)}]`));
  ev(`_purgeStudentRefs(${JSON.stringify(sid)})`);
  assert.ok(!ev(`JSON.stringify(${CAMP}.tons)`).includes(sid));
  ev(`${CAMP}.tons = 'n’importe quoi'; postLoadHook();`);
  assert.strictEqual(ev(`${CAMP}.tons`), undefined);
});
