// Le cadre des bilans de la fiche élève (v1.79.4) — l'utilisateur : « que la partie bilan en bas soit fixe en bas de
// l'écran, et que je puisse à la rigueur la réduire partie par partie ». Collé au bas de la fenêtre (CSS sticky), repliable
// en entier (▾) et partie par partie (synthèse de l'IA, bilan, décisions, autres moments) ; le choix se retient sur le poste.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; _ficheMoment = null;
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1'], ord:0 }; S.cur = '5C';
  S.eleves = { s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]} };
  localStorage.removeItem(_LS_FICHE_PLIS);`;
const redac = () => ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.type === 'conseil');
  bilanAdd('s1', { date: col.date, type: col.type, texte: 'Un bon <b>trimestre</b> ' + 'x'.repeat(200) });
  return _ficheRedacHTML(cls, S.eleves.s1, col); })()`);

test('parties : bilan et décisions dépliés par défaut, le champ garde son nom accessible', () => {
  ev(FIXTURE);
  const h = redac();
  assert.match(h, /<details class="pf-pli" data-pli="bilan" open/);
  assert.match(h, /<details class="pf-pli" data-pli="dec" open/);
  assert.match(h, /id="fi-bil" class="pf-ta" aria-label="[^"]+ce que je dirai"/);
  assert.match(h, /id="fi-dec"[^>]*aria-label="Décisions/);
});

test('replier une partie : retenu sur le poste, l\'aperçu échappé et coupé', () => {
  ev(FIXTURE);
  ev(`fichePliUI({ dataset: { pli: 'bilan' }, open: false })`);
  assert.deepStrictEqual(JSON.parse(ev(`localStorage.getItem(_LS_FICHE_PLIS)`)), { bilan: true });
  const h = redac();
  assert.match(h, /data-pli="bilan" ontoggle/, 'replié : pas d\'attribut open');
  assert.match(h, /data-pli="dec" open/, 'les autres parties ne bougent pas');
  const ap = h.match(/<span class="pf-pli-a">([^<]*)<\/span>/)[1];
  assert.ok(ap.includes('&lt;b&gt;') && ap.endsWith('…') && ap.length < 140, ap);
  ev(`fichePliUI({ dataset: { pli: 'bilan' }, open: true })`);
  assert.deepStrictEqual(JSON.parse(ev(`localStorage.getItem(_LS_FICHE_PLIS)`)), {});
});

test('cadre entier : ▾ le replie sur son titre, retenu ; un stockage illisible ne casse rien', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_ficheBilanBas('x')`), '<div class="pf-bas">x</div>');
  ev(`_fichePliSet('tout', true)`);
  assert.strictEqual(ev(`_ficheBilanBas('x')`), '<div class="pf-bas plie">x</div>');
  ev(`localStorage.setItem(_LS_FICHE_PLIS, '[1,2')`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ev(`_fichePlis()`))), {});
});

test('CSS : collé au bas de la fenêtre à l\'écran seulement, replié = le titre seul', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /@media screen and \(min-height: 560px\) \{\s*\.pf-bas \{ position: sticky; bottom:/);
  assert.match(src, /\.pf-bas\.plie > \.pf-card > :not\(h3\) \{ display: none; \}/);
});
