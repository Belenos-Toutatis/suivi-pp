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
  assert.match(c, /1 · 0 sur la période/, 'le total, et combien tombent dans le moment');
  assert.doesNotMatch(c, /Aucun contact/);
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
