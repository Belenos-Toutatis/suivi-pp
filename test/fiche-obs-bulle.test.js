// La bulle de la courbe des observations (v1.82.3). L'utilisateur, après la bulle des moyennes : « ça pourrait faire la
// même chose pour les observations ». Au survol, le point le plus proche : cumul du carnet (et son relevé), observations
// MBN depuis la rentrée, total, écart avec le point précédent, observations MBN de ce jour-là. Les données sont portées
// par la courbe (`data-bul`) : la fiche imprimée dessine aussi cette courbe, pour d'autres élèves.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const deco = a => a.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function monter() {
  ev(`(() => {
    S = _emptyState(); postLoadHook();
    S.classes = { c1: { id: 'c1', nom: '5C', annee: '2026-27', eleves: ['s1'] } };
    S.eleves = { s1: { id: 's1', nom: 'Martin', prenom: 'Léa', classe_id: 'c1', obsMbn: [
      { id: 'o1', ts: 1, date: '2026-09-15', heure: '', type: 'Observation négative', motif: 'Bavardage', par: 'M. Durand', info: '' },
      { id: 'o2', ts: 2, date: '2026-10-13', heure: '', type: 'Observation négative', motif: '<b>Oubli</b>', par: '', info: '' },
      { id: 'o3', ts: 3, date: '2026-10-13', heure: '', type: 'Observation négative', motif: 'Travail non fait', par: 'Mme Roy', info: '' },
    ] } };
    S.releves = { c1: { '2026-09-22': { date: '2026-09-22', ts: 1, counts: { s1: 7 } }, '2026-10-13': { date: '2026-10-13', ts: 2, label: 'avant le conseil', counts: { s1: 9 } } } };
    S.cur = 'c1';
    _ficheCourbeSrc = { carnet: true, mbn: true };
  })()`);
}
const courbe = () => ev(`_ficheCourbeHTML(S.classes.c1, S.eleves.s1, _chaleurMomentsTous(S.classes.c1).find(c => c.key === 'bil:conseil:0'))`);
const donnees = h => JSON.parse(deco(h.match(/data-bul="([^"]*)"/)[1]));

test('la courbe porte ses données : un point par point dessiné, cumul, MBN, relevé, observations du jour', () => {
  monter();
  const h = courbe();
  assert.match(h, /onpointermove="ficheObsBulle\(event\)" onpointerleave="ficheBulleFin\(\)"/);
  assert.match(h, /<line class="guide"/);
  assert.doesNotMatch(h, /<title>/, 'plus d’infobulle par point : la bulle dit tout');
  const D = donnees(h);
  assert.strictEqual(D.pts.length, (h.match(/<circle class="pt" data-k="\d+"/g) || []).length);
  assert.deepStrictEqual(D.pts.map(x => x.date), ['2026-09-15', '2026-09-22', '2026-10-13']);
  const oct = D.pts[2];
  assert.deepStrictEqual([oct.carnet, oct.mbn, oct.releve, oct.label], [9, 3, true, 'avant le conseil']);
  assert.deepStrictEqual(oct.jour.map(x => x.motif), ['<b>Oubli</b>', 'Travail non fait']);
  assert.strictEqual(D.pts[0].carnet, null, 'avant le premier relevé : rien de relevé');
});

test('la bulle : carnet, MBN, total, écarts avec le point précédent, observations du jour échappées', () => {
  monter();
  const D = JSON.stringify(donnees(courbe()));
  const h = ev(`_ficheObsBulleHTML(${D}, 2)`);
  assert.match(h, /Au 13\/10\/2026 <span class="bm-p">· avant le conseil<\/span><div class="bm-p">écart depuis le 22\/09<\/div>/);
  assert.match(h, /<td>Carnet \(relevé\)<\/td><td class="v">9<\/td><td class="d">\+2<\/td>/);
  assert.match(h, /<td>MBN<\/td><td class="v">3<\/td><td class="d">\+2<\/td>/);
  assert.match(h, /<tr class="gen"><td>Total<\/td><td class="v">12<\/td><td class="d">\+4<\/td>/);
  assert.match(h, /Ce jour-là dans MBN :[^]*<li>&lt;b&gt;Oubli&lt;\/b&gt;<\/li><li>Travail non fait — Mme Roy<\/li>/);
  const premier = ev(`_ficheObsBulleHTML(${D}, 0)`);
  assert.doesNotMatch(premier, /écart depuis/);
  assert.match(premier, /<td>Carnet<\/td><td class="v">–<\/td>/);
  assert.match(premier, /<li>Bavardage — M\. Durand<\/li>/);
});

test('une seule source cochée : pas de total ; trop d’observations le même jour : « et n autres »', () => {
  monter();
  ev(`_ficheCourbeSrc = { carnet: false, mbn: true }`);
  let D = donnees(courbe());
  assert.strictEqual(D.carnet, false);
  assert.doesNotMatch(ev(`_ficheObsBulleHTML(${JSON.stringify(D)}, 1)`), /Total|Carnet/);
  D.pts[1].jour = Array.from({ length: 9 }, (_, i) => ({ motif: 'm' + i, par: '' }));
  const h = ev(`_ficheObsBulleHTML(${JSON.stringify(D)}, 1)`);
  assert.strictEqual((h.match(/<li>/g) || []).length, 7);
  assert.match(h, /<li>et 3 autres<\/li>/);
  ev(`_ficheCourbeSrc = { carnet: true, mbn: true }`);
});
