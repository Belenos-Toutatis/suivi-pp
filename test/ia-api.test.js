// 📤 Envoi direct à Claude (v1.73.0) : la requête (ce qui part, et rien d'autre), la lecture du flux, le coût, le
// journal du poste, la clé hors de S, et un envoi complet sur un `fetch` simulé. Aucun appel réseau réel.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;
  for (const k of [LS_IA_CLE, LS_IA_API, LS_IA_JOURNAL, LS_IA_LOT]) localStorage.removeItem(k); for (const k in _iaLotEtats) delete _iaLotEtats[k];
  renderDonnees = () => {};`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;
const CLE = 'sk-ant-api03-ABCDEFGHIJKLMNOP_test-1234';
const html = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

// Un flux SSE comme celui de l'API, découpé en morceaux arbitraires.
function flux(texte, { modele = 'claude-opus-5-5', entree = 8000, sortie = 3000, stop = 'end_turn', avant = [] } = {}) {
  const evs = [
    { type: 'message_start', message: { id: 'msg_1', model: modele, usage: { input_tokens: entree, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_stop', index: 0 },
    ...avant,
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    ...texte.match(/.{1,7}/gs).map(t => ({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: t } })),
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: sortie } },
    { type: 'message_stop' },
  ];
  return evs.map(e => `event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join('');
}
const morceaux = (s, n) => { const r = []; for (let i = 0; i < s.length; i += n) r.push(s.slice(i, i + n)); return r; };

test('la requête : le contenu exact, les en-têtes du navigateur, ni température ni réglage de réflexion', () => {
  ev(DEMO);
  const r = evObj(`[_iaRequete('eleve', 'CONSIGNE\\n\\nTEXTE', { modele: 'claude-opus-5-5', espace: '' }, ${JSON.stringify(CLE)}),
    _iaRequete('lot', '{"a":1}', { modele: 'claude-haiku-5-5', espace: 'wrkspc_01ABC' }, ${JSON.stringify(CLE)})]`);
  const [a, b] = r;
  assert.strictEqual(a.url, 'https://api.anthropic.com/v1/messages');
  assert.deepStrictEqual(a.body.messages, [{ role: 'user', content: 'CONSIGNE\n\nTEXTE' }], 'rien d’autre que le contenu');
  assert.strictEqual(a.headers['x-api-key'], CLE);
  assert.strictEqual(a.headers['anthropic-version'], '2026-10-21');
  assert.strictEqual(a.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.strictEqual(a.body.model, 'claude-opus-5-5');
  assert.strictEqual(a.body.stream, true);
  assert.strictEqual(a.body.fallbacks, 'default');
  assert.strictEqual(a.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  for (const k of ['temperature', 'top_p', 'top_k', 'thinking', 'system']) assert.ok(!(k in a.body), k);
  assert.ok(!a.body.output_config.format, 'pas de forme imposée pour un élève');
  assert.ok(!('anthropic-workspace-id' in a.headers));
  // Toute la classe : la forme de réponse imposée ; Haiku sans secours ; l'espace de travail s'il est réglé.
  assert.strictEqual(b.body.output_config.format.type, 'json_schema');
  assert.deepStrictEqual(b.body.output_config.format.schema.required, ['syntheses']);
  assert.ok(!('fallbacks' in b.body) && !('anthropic-beta' in b.headers), 'Haiku : pas de fallbacks');
  assert.strictEqual(b.headers['anthropic-workspace-id'], 'wrkspc_01ABC');
  assert.ok(b.body.max_tokens > a.body.max_tokens);
});

test('le flux : morceaux coupés n’importe où, \\r\\n, réflexion ignorée, usage et fin lus', () => {
  ev(DEMO);
  const brut = flux('Bonne période, [Élève] progresse.', { entree: 8123, sortie: 3456 });
  for (const n of [1, 5, 37, brut.length]) {
    const e = evObj(`(() => { const s = _iaSSE(); let e = _iaFluxInit(); for (const m of ${JSON.stringify(morceaux(brut, n))}) for (const x of s.pousse(m)) e = _iaFlux(e, x); return e; })()`);
    assert.strictEqual(e.texte, 'Bonne période, [Élève] progresse.', `morceaux de ${n}`);
    assert.strictEqual(e.entree, 8123); assert.strictEqual(e.sortie, 3456); assert.strictEqual(e.stop, 'end_turn');
    assert.strictEqual(e.modele, 'claude-opus-5-5');
  }
  // Un modèle refuse, un autre reprend : ce que le premier avait écrit ne compte plus.
  const repris = flux('Texte du second.', { avant: [
    { type: 'content_block_start', index: 9, content_block: { type: 'text', text: 'Début du premier' } },
    { type: 'content_block_start', index: 10, content_block: { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } } }] });
  const e2 = evObj(`(() => { const s = _iaSSE(); let e = _iaFluxInit(); for (const x of s.pousse(${JSON.stringify(repris)})) e = _iaFlux(e, x); return e; })()`);
  assert.strictEqual(e2.texte, 'Texte du second.');
  assert.strictEqual(e2.secours, 'claude-opus-5');
  const e3 = evObj(`_iaFlux(_iaFluxInit(), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })`);
  assert.strictEqual(e3.erreur, 'Overloaded');
});

test('le coût : au tarif du modèle, mis en mots ; le journal compte le mois, sans aucune donnée d’élève', () => {
  ev(DEMO);
  const c = evObj(`[_iaCout('claude-opus-5-5', { entree: 1e6, sortie: 1e6 }), _iaCout('claude-sonnet-5-5', { entree: 10000, sortie: 5000 }),
    _iaCout('inconnu', { entree: 1e6 }), _iaDollars(0.1234), _iaDollars(0.004), _iaDollars(0), _iaJetons(12345)]`);
  assert.strictEqual(c[0], 24);
  assert.ok(Math.abs(c[1] - 0.07) < 1e-9);
  assert.strictEqual(c[2], 4, 'modèle inconnu : le tarif du modèle par défaut');
  assert.deepStrictEqual(c.slice(3), ['0,12 $', 'moins de 0,01 $', '0 $', '12 345']);
  const m = evObj(`(() => { const now = new Date(2026, 9, 23, 12), ilya = new Date(2026, 8, 30, 12);
    const j = [{ ts: ilya.getTime(), cout: 5 }, { ts: now.getTime(), cout: 0.25 }, { ts: now.getTime() - 3600e3, cout: 0.5 }];
    return _iaJournalMois(j, now); })()`);
  assert.deepStrictEqual(m, { n: 2, cout: 0.75 });
});

test('les erreurs, en clair : clé refusée, espace de travail, crédit épuisé, surcharge', () => {
  ev(DEMO);
  const t = evObj(`[_iaErreurTexte(401, null),
    _iaErreurTexte(400, { error: { type: 'invalid_request_error', message: 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header' } }),
    _iaErreurTexte(400, { error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }),
    _iaErreurTexte(529, { error: { type: 'overloaded_error', message: 'Overloaded' } })]`);
  assert.match(t[0], /clé est refusée/);
  assert.match(t[1], /espace de travail/);
  assert.match(t[2], /Crédit épuisé/);
  assert.match(t[3], /surchargé/);
});

test('la clé : sur ce poste seulement — jamais dans S ni dans l’export, jamais réécrite dans la page', () => {
  ev(DEMO);
  ev(`iaApiCleUI(${JSON.stringify(CLE)})`);
  assert.strictEqual(ev(`_iaCle()`), CLE);
  assert.ok(!ev(`JSON.stringify(S)`).includes('sk-ant'), 'pas dans S');
  assert.ok(!String(ev(`localStorage.getItem(LS_KEY) || ''`)).includes('sk-ant'), 'pas dans la sauvegarde locale');
  const h = ev(`_iaReglagesHTML()`);
  assert.ok(!h.includes(CLE), 'la clé entière n’est jamais dans la page');
  assert.match(h, /sk-ant-…1234/);
  assert.match(h, /platform\.claude\.com\/settings\/keys/);
  assert.match(h, /platform\.claude\.com\/settings\/billing/);
  assert.match(ev(`_iaApiLigneHTML()`), /crédit restant/);
  // Une clé d'administration, ou mal copiée, est refusée ; effacer la retire.
  ev(`iaApiCleUI('sk-ant-admin01-XXXXXXXXXXXXXXXX')`); assert.strictEqual(ev(`_iaCle()`), CLE);
  ev(`iaApiCleUI('sk ant 123')`); assert.strictEqual(ev(`_iaCle()`), CLE);
  ev(`iaApiCleUI('')`); assert.strictEqual(ev(`_iaCle()`), '');
  assert.match(ev(`_iaApiLigneHTML()`), /la régler/);
});

test('la CSP n’ouvre que l’API d’Anthropic, en plus de GitHub', () => {
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)[1];
  const cs = /connect-src ([^;]+)/.exec(csp)[1].trim().split(/\s+/);
  assert.deepStrictEqual(cs, ["'self'", 'https://api.github.com', 'https://api.anthropic.com']);
});

test('un envoi complet (toute la classe) sur un fetch simulé : rien ne part sans « J’ai relu », la réponse arrive à l’étape 3, le coût est noté', async () => {
  ev(DEMO); ev(ELS);
  ev(`globalThis.__appels = []; globalThis.__flux = null;
    fetch = async (url, o) => { __appels.push({ url, o }); const enc = new TextEncoder(), m = __flux.slice(); let i = 0;
      return { ok: true, status: 200, body: { getReader: () => ({ read: async () => i < m.length ? { value: enc.encode(m[i++]), done: false } : { done: true } }) } }; };`);
  ev(`localStorage.setItem(LS_IA_CLE, ${JSON.stringify(CLE)})`);
  ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'); _iaLotOuvrir(cls, col); })()`);
  const avantIA = ev(`Object.values(S.eleves).reduce((n, s) => n + (s.synthIA || []).length, 0)`);
  const codes = evObj(`_iaLot.codes`);
  const sids = Object.keys(codes);
  ev(`iaLotEnvoyerUI()`);
  const contenu = ev(`document.getElementById('miaenv-txt').value`);
  assert.strictEqual(contenu, ev(`_iaEnvoi.contenu`));
  assert.ok(JSON.parse(contenu).eleves.length === sids.length, 'le JSON de toute la classe, montré en entier');
  // Sans la case cochée : rien ne part.
  await ev(`iaEnvoiGoUI()`);
  assert.strictEqual(ev(`__appels.length`), 0);
  const rep = JSON.stringify({ syntheses: [{ eleve: `[Élève ${codes[sids[0]]}]`, synthese: 'Une période sérieuse.' }, { eleve: `[Élève ${codes[sids[1]]}]`, synthese: 'Des progrès.' }] });
  ev(`__flux = ${JSON.stringify(morceaux(flux(rep, { entree: 9000, sortie: 4000 }), 23))}`);
  ev(`document.getElementById('miaenv-ok').checked = true`);
  await ev(`iaEnvoiGoUI()`);
  const a = evObj(`__appels.map(x => ({ url: x.url, body: JSON.parse(x.o.body), h: x.o.headers }))`);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].body.messages[0].content, contenu, 'exactement le texte montré');
  for (const s of sids) { const n = ev(`S.eleves[${JSON.stringify(s)}].nom`); assert.ok(!a[0].body.messages[0].content.includes(n), 'aucun nom'); }
  assert.strictEqual(ev(`document.getElementById('miac-rep').value`), rep);
  const revue = evObj(`_iaLot.revue.lignes.map(l => ({ sid: l.sid, texte: l.texte }))`);
  assert.deepStrictEqual(revue, [{ sid: sids[0], texte: 'Une période sérieuse.' }, { sid: sids[1], texte: 'Des progrès.' }].sort((x, y) => sids.indexOf(x.sid) - sids.indexOf(y.sid)), 'la revue est faite');
  assert.strictEqual(ev(`Object.values(S.eleves).reduce((n, s) => n + (s.synthIA || []).length, 0)`), avantIA, 'rien n’est rangé tout seul');
  const j = evObj(`_iaJournal()`);
  assert.strictEqual(j.length, 1);
  assert.strictEqual(j[0].sorte, 'lot'); assert.strictEqual(j[0].entree, 9000); assert.strictEqual(j[0].sortie, 4000);
  assert.ok(Math.abs(j[0].cout - (9000 * 4 + 4000 * 20) / 1e6) < 1e-9);
  assert.ok(!JSON.stringify(j).includes('Élève'), 'le journal ne garde que des chiffres');
  ev(FIN_ELS);
});

test('un envoi refusé par l’API : rien n’est posé à l’étape 3, l’erreur est dite', async () => {
  ev(DEMO); ev(ELS);
  ev(`fetch = async () => ({ ok: false, status: 401, json: async () => ({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });`);
  ev(`localStorage.setItem(LS_IA_CLE, ${JSON.stringify(CLE)})`);
  ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'); _iaLotOuvrir(cls, col); document.getElementById('miac-rep').value = ''; })()`);
  ev(`iaLotEnvoyerUI(); document.getElementById('miaenv-ok').checked = true;`);
  await ev(`iaEnvoiGoUI()`);
  assert.strictEqual(ev(`document.getElementById('miac-rep').value`), '');
  assert.strictEqual(evObj(`_iaJournal()`).length, 0, 'aucun jeton compté : rien noté');
  assert.strictEqual(ev(`_iaEnvoi.encours`), false);
  ev(FIN_ELS);
});

test('le pas-à-pas : ouvert sans clé, replié avec ; l’espace de travail et son plafond AVANT la clé', () => {
  ev(DEMO);
  const sans = ev(`_iaReglagesHTML()`);
  assert.match(sans, /<details class="ia-guide" open>/, 'ouvert tant qu’il n’y a pas de clé');
  const i = k => sans.indexOf(k);
  assert.ok(i('settings/workspaces') > 0 && i('plafond de dépense mensuel') > i('settings/workspaces') && i('settings/keys') > i('plafond de dépense mensuel'),
    'espace de travail, puis plafond, puis clé');
  assert.match(sans, /<em>Portée<\/em> : l'espace <strong>Suivi PP<\/strong>/);
  assert.match(sans, /support\.claude\.com\/en\/articles\/17154008/, 'le crédit mensuel de l’abonnement Max');
  assert.match(sans, /31\/07\/20\d\d/, 'une expiration proposée : la fin de l’année scolaire');
  ev(`localStorage.setItem(LS_IA_CLE, ${JSON.stringify(CLE)})`);
  assert.match(ev(`_iaReglagesHTML()`), /<details class="ia-guide">/, 'replié une fois la clé enregistrée');
  ev(`localStorage.removeItem(LS_IA_CLE)`);
});

test('les cases cochées d’office : celles choisies par l’utilisateur (v1.73.2)', () => {
  ev(DEMO);
  assert.deepStrictEqual(evObj(`IA_BLOCS.filter(x => x.on).map(x => x.k)`), ['genre', 'obs', 'abs', 'moy', 'incid', 'avis', 'bilans']);
});

test('la forme : longueur choisie et « sans chiffres » ajoutés après la consigne, dans ce qui est copié comme envoyé', () => {
  ev(DEMO);
  ev(`localStorage.removeItem(LS_IA_FORME)`);
  // D'office : moyenne, sans chiffres — pour les trois fenêtres.
  for (const s of ['eleve', 'lot', 'synthese']) assert.deepStrictEqual(evObj(`_iaForme('${s}')`), { longueur: 'moyenne', sansChiffres: true }, s);
  assert.match(ev(`_iaFormeTexte('eleve')`), /cinq à huit lignes[^]*N'écrivez aucune note ni valeur chiffrée[^]*niveau atteint et la progression/);
  // Une ou deux lignes, pour toute la classe ; chiffres permis pour la synthèse de la classe.
  ev(`iaFormeUI('lot', 'longueur', 'tres-courte'); iaFormeUI('synthese', 'sansChiffres', false); iaFormeUI('eleve', 'longueur', 'n-importe-quoi');`);
  assert.match(ev(`_iaFormeTexte('lot')`), /chaque synthèse tient en une ou deux lignes au plus/);
  assert.ok(!/chiffrée/.test(ev(`_iaFormeTexte('synthese')`)), 'chiffres permis : la phrase disparaît');
  assert.strictEqual(evObj(`_iaForme('eleve')`).longueur, 'moyenne', 'une valeur inconnue ne s’écrit pas');
  // Dans le JSON de toute la classe (copié, téléchargé, envoyé : la même construction).
  ev(ELS);
  ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'); _iaLotOuvrir(cls, col); })()`);
  const j = JSON.parse(JSON.stringify(ev(`_iaLotConstruire(_iaLot)`)));
  assert.ok(j.consigne.startsWith(ev(`_iaConsigneClasse().trim()`)), 'la consigne d’abord');
  assert.match(j.consigne, /une ou deux lignes au plus[^]*aucune note ni valeur chiffrée/);
  // Une consigne RÉÉCRITE garde la forme à la fin.
  ev(`_prefs().iaConsigne = 'Ma consigne à moi, en vingt lignes.'`);
  ev(`(() => { _ia = { txt: 'TEXTE' }; })()`);
  assert.match(ev(`_iaContenuEleve()`), /^Ma consigne à moi, en vingt lignes\.\nLongueur : la synthèse tient en cinq à huit lignes \(cette longueur prime[^]*\n\nTEXTE\n$/);
  ev(`_prefs().iaConsigne = ''; _ia = null; localStorage.removeItem(LS_IA_FORME);`);
  ev(FIN_ELS);
});

test('plein écran : un choix retenu sur le poste, le bouton le dit', () => {
  ev(DEMO);
  ev(`localStorage.removeItem(LS_IA_PLEIN)`);
  assert.strictEqual(ev(`_iaPlein()`), false);
  ev(`iaPleinUI()`); assert.strictEqual(ev(`_iaPlein()`), true);
  ev(`iaPleinUI()`); assert.strictEqual(ev(`_iaPlein()`), false);
  assert.strictEqual((html.match(/class="ia-b ia-lien ia-plein-b" onclick="iaPleinUI\(this\)"/g) || []).length, 4, 'les trois relectures et la dernière vérification');
  assert.strictEqual((html.match(/<textarea id="(mia|miac|mias|miaenv)-txt" class="ia-lit"/g) || []).length, 4);
});
