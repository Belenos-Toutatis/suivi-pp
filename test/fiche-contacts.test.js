// Carte « Contacts avec la famille » du tableau de bord (v1.80.5) : TOUS les contacts, quel que soit le moment
// choisi dans « Synthèse pour ». L'utilisateur : un contact noté le 02/11 n'apparaissait pas dans une fiche ouverte
// sur la mi-S1 (01/08 → 31/10), alors que la fenêtre des contacts le montrait. Les plus récents d'abord, réduits à
// FICHE_CT_N lignes ; « n plus anciens » déplie.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const jour = (n) => `2026-${String(9 + Math.floor(n / 28)).padStart(2, '0')}-${String(1 + n % 28).padStart(2, '0')}`;
function monter(nb) {
  ev(`(() => {
    S.classes = { c1: { id: 'c1', nom: '5C', annee: '2026-27', eleves: ['s1'] } };
    S.eleves = { s1: { id: 's1', nom: 'Martin', prenom: 'Léa', classe_id: 'c1', journal: ${JSON.stringify(
      Array.from({ length: nb }, (_, i) => ({ id: 'j' + i, date: i === nb - 1 ? '2026-11-02' : jour(i), ts: i, type: 'appel', texte: 'Contact n' + i })))} } };
    S.cur = 'c1';
    localStorage.removeItem(_LS_FICHE_PLIS);
  })()`);
}
const carte = (cle) => ev(`(() => { const cls = S.classes.c1, col = _chaleurMomentsTous(cls).find(c => c.key === ${JSON.stringify(cle)});
  const h = _ficheTableauHTML(cls, S.eleves.s1, col, {}); const i = h.indexOf('Contacts avec la famille'); return h.slice(i, h.indexOf('</section>', i)); })()`);

test('un contact postérieur au moment affiché reste dans la carte (mi-S1 finit le 31/10, contact du 02/11)', () => {
  monter(1);
  const c = carte('bil:miperiode:0');
  assert.match(c, /Contact n0/);
  assert.match(c, /02\/11/);
  assert.doesNotMatch(c, /Aucun contact/);
  // v1.81.0 : la fenêtre de la fiche va jusqu'à la date du bilan (sinon aujourd'hui) — dates fixées par un bilan écrit,
  // pour ne pas dépendre du jour où tourne le test.
  ev(`S.eleves.s1.bilans = [{ id: 'b1', date: '2026-10-30', ts: 1, type: 'miperiode', texte: 'x' }]`);
  assert.match(carte('bil:miperiode:0'), /1 · 0 sur la période/, 'bilan écrit le 30/10 : le contact du 02/11 est hors du moment');
  ev(`S.eleves.s1.bilans[0].date = '2026-11-05'`);
  assert.match(carte('bil:miperiode:0'), /<span class="pf-k">1<\/span>/, 'bilan écrit le 05/11 : le moment court jusque-là, le contact y tombe');
  ev(`delete S.eleves.s1.bilans`);
});

test('les plus récents d’abord, réduits à FICHE_CT_N lignes, « n plus anciens » déplie et se retient', () => {
  monter(7);
  const N = ev('FICHE_CT_N');
  let c = carte('bil:conseil:0');
  assert.strictEqual((c.match(/class="pf-ent"/g) || []).length, N);
  assert.ok(c.indexOf('Contact n6') < c.indexOf('Contact n5'), 'le plus récent en tête');
  assert.doesNotMatch(c, /Contact n0/);
  assert.match(c, new RegExp(`${7 - N} contacts plus anciens`));
  ev('_fichePliSet("ctTout", true)');
  c = carte('bil:conseil:0');
  assert.strictEqual((c.match(/class="pf-ent"/g) || []).length, 7);
  assert.match(c, /Réduire aux plus récents/);
});

test('pas de bouton quand tout tient ; carte vide explicite', () => {
  monter(2);
  assert.doesNotMatch(carte('bil:conseil:0'), /pf-ct-tout/);
  ev('S.eleves.s1.journal = []');
  assert.match(carte('bil:conseil:0'), /Aucun contact noté avec la famille/);
});

// v1.80.6 (l'utilisateur : « quand la description devient volumineuse, qu'elle ne fasse plus que 4-5 lignes, avec des
// points de suspension ») : chaque texte coupé à 5 lignes par line-clamp, « lire la suite » le déplie. Le bouton naît
// caché (il n'apparaît que si le texte déborde, mesuré dans le navigateur) ; un contact déplié le reste au re-rendu.
test('texte d’un contact : coupé à 5 lignes, « lire la suite » caché tant qu’on n’a rien mesuré, déplié retenu', () => {
  monter(1);
  let c = carte('bil:conseil:0');
  assert.match(c, /<div class="pf-ct-txt"><span class="pf-ty">appel téléphonique<\/span> · [^]*?<\/div><button class="pf-ct-suite" hidden onclick="ficheContactSuiteUI\(this,'j0'\)" aria-expanded="false">… lire la suite<\/button>/);
  ev('_ficheCtOuverts.add("j0")');
  c = carte('bil:conseil:0');
  assert.match(c, /class="pf-ct-txt ouvert"/);
  assert.match(c, /aria-expanded="true">▴ réduire</);
  ev('_ficheCtOuverts.clear()');
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /\.pf-ct-txt \{[^}]*-webkit-line-clamp: 5/, 'cinq lignes à l’écran');
  assert.match(src, /@media print \{ \.pf-ct-txt \{[^}]*line-clamp: none/, 'jamais coupé sur le papier');
});
