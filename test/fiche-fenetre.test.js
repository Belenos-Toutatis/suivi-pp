// La FENÊTRE de la fiche (v1.81.0). L'utilisateur : « si le bilan, je le fais le 10 novembre avec ma principale, j'ai
// besoin des notes etc jusqu'à maintenant » — la mi-S1 s'arrêtait au 31/10 ; « si je fais un point au mois de novembre,
// je veux peut-être voir que ce qui est arrivé en novembre, mais aussi avoir l'historique ».
// Arbitré : fin = date du bilan écrit pour ce moment, sinon aujourd'hui (jamais avant la fin du moment) ;
// « Depuis » : le moment (défaut), la période, la rentrée — l'historique en retrait, les compteurs sur le moment.
// Les dates sont fixées par des bilans écrits : rien ne dépend du jour où tourne le test.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const COL = k => `_chaleurMomentsTous(S.classes.c1).find(c => c.key === ${JSON.stringify(k)})`;
const fen = (k, dep) => JSON.parse(ev(`JSON.stringify(_ficheFenetre(S.classes.c1, 's1', ${COL(k)}${dep ? `, '${dep}'` : ''}))`));
function monter(bilans) {
  ev(`(() => {
    S.classes = { c1: { id: 'c1', nom: '5C', annee: '2026-27', eleves: ['s1'] } };
    S.eleves = { s1: { id: 's1', nom: 'Martin', prenom: 'Léa', classe_id: 'c1', bilans: ${JSON.stringify(bilans || [])},
      incidents: [
        { id: 'i1', date: '2026-10-06', ts: 1, type: 'retenue', objet: 'Incident d’octobre', texte: '' },
        { id: 'i2', date: '2026-11-04', ts: 2, type: 'retenue', objet: 'Incident de novembre', texte: '' },
      ] } };
    S.cur = 'c1';
    localStorage.removeItem(_LS_FICHE_DEPUIS);
  })()`);
}
const bil = (type, date) => ({ id: 'b-' + type, date, ts: 1, type, texte: 'Bilan.' });

test('fin : la date du bilan quand elle dépasse le moment, sinon la fin du moment', () => {
  monter([bil('miperiode', '2026-11-10')]);
  let f = fen('bil:miperiode:0');
  assert.deepStrictEqual([f.mStart, f.mEnd, f.end, f.pourquoi], ['2026-08-01', '2026-10-31', '2026-11-10', 'bilan'], 'mi-S1 faite le 10/11 avec la principale');
  monter([bil('miperiode', '2026-10-20')]);
  f = fen('bil:miperiode:0');
  assert.deepStrictEqual([f.end, f.pourquoi], ['2026-10-31', 'moment'], 'jamais plus court que le moment');
  monter([bil('conseil', '2026-12-15')]);
  f = fen('bil:conseil:0');
  assert.strictEqual(f.end, '2027-01-31', 'un conseil écrit avant la fin de période garde toute la période (décisions et papiers à venir)');
});

test('« Depuis » : le moment, la période, la rentrée ; retenu sur le poste, valeur inconnue = le moment', () => {
  monter([bil('mois', '2026-11-20')]);
  assert.strictEqual(fen('bil:mois:2026-11').start, '2026-11-01');
  assert.strictEqual(fen('bil:mois:2026-11', 'periode').start, '2026-08-01');
  assert.strictEqual(fen('bil:mois:2026-11', 'annee').start, '2026-08-01');
  assert.strictEqual(ev(`_ficheDepuis()`), 'moment');
  ev(`localStorage.setItem(_LS_FICHE_DEPUIS, 'periode')`);
  assert.strictEqual(fen('bil:mois:2026-11').start, '2026-08-01', 'le choix du poste s’applique');
  ev(`localStorage.setItem(_LS_FICHE_DEPUIS, 'constructor')`);
  assert.strictEqual(ev(`_ficheDepuis()`), 'moment');
});

test('tableau de bord : l’historique en retrait, le compteur sur le moment seul', () => {
  monter([bil('mois', '2026-11-20')]);
  const carte = () => ev(`(() => { const h = _ficheTableauHTML(S.classes.c1, S.eleves.s1, ${COL('bil:mois:2026-11')}, {}); const i = h.indexOf('Incidents'); return h.slice(i, h.indexOf('</section>', i)); })()`);
  let c = carte();
  assert.match(c, /Incident de novembre/);
  assert.doesNotMatch(c, /Incident d’octobre/, 'depuis le moment : novembre seul');
  ev(`localStorage.setItem(_LS_FICHE_DEPUIS, 'periode')`);
  c = carte();
  assert.match(c, /pf-ent pf-clic pf-avant"[^]*Incident d’octobre/, 'octobre affiché, en retrait');
  assert.doesNotMatch(c, /pf-avant"[^>]*>[^]*?Incident de novembre[^]*?Incident d’octobre/, 'novembre pas en retrait');
  assert.match(c, /^Incidents<span class="pf-k">1<\/span>/, 'le compteur reste celui du moment');
});

test('chronologie : la frise marque le début du moment, les chiffres du haut restent ceux du moment', () => {
  monter([bil('mois', '2026-11-20')]);
  ev(`localStorage.setItem(_LS_FICHE_DEPUIS, 'annee')`);
  const h = ev(`_ficheChronoHTML(S.classes.c1, S.eleves.s1, ${COL('bil:mois:2026-11')})`);
  assert.match(h, /<small>Incidents<\/small><b>1<\/b>/);
  assert.match(h, /class="deb"[^>]*\/><text class="pf-mois"[^>]*>Point nov\./);
  assert.match(h, /class="pf-jr pf-avant" id="fi-ev-\d+"/);
});

test('les faits à insérer et la synthèse de l’IA portent sur le moment, pas sur l’historique', () => {
  monter([bil('mois', '2026-11-20')]);
  ev(`localStorage.setItem(_LS_FICHE_DEPUIS, 'annee')`);
  const inc = ev(`_ficheFaits(S.classes.c1, S.eleves.s1, ${COL('bil:mois:2026-11')}).find(f => f.k === 'incid').html`);
  assert.match(inc, /1 incident/);
  monter([bil('miperiode', '2026-11-10')]);
  const un = ev(`_iaDonnees(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')}, new Set()).texte`);
  assert.match(un, /au 10\/11/, 'un élève : jusqu’à la date de son bilan');
  const tous = `new Set(IA_BLOCS.map(x => x.k))`;
  assert.match(ev(`_iaDonnees(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')}, ${tous}).texte`), /Incident de novembre/);
  const lot = ev(`_iaDonnees(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')}, ${tous}, '[Élève 1]').texte`);
  assert.match(lot, /Incident d’octobre/);
  assert.doesNotMatch(lot, /Incident de novembre/, 'le lot de la classe : les bornes du moment, les mêmes pour tous');
});

test('barre de la fiche : « Depuis » et la date de fin dite', () => {
  monter([bil('miperiode', '2026-11-10')]);
  const h = ev(`_ficheBarHTML(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')})`);
  assert.match(h, /aria-label="Depuis"/);
  assert.match(h, /onclick="ficheDepuisSet\('annee'\)"[^>]*>rentrée</);
  assert.match(h, /jusqu&#39;au 10\/11 \(bilan\)|jusqu'au 10\/11 \(bilan\)/);
});
