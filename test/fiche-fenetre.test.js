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
  assert.match(h, /aria-label="Jusqu&#39;au"|aria-label="Jusqu'au"/);
  assert.match(h, /id="fi-datebil" value="2026-11-10"/, 'la date du bilan, dans son champ');
  assert.doesNotMatch(h, /fiche jusqu/, 'la fiche s’arrête à cette date : rien de plus à dire');
});

// v1.81.2 — l'utilisateur : « il faudrait que je puisse choisir la date du bilan, ce serait plus simple ». Arbitré : une
// date par MOMENT pour toute la classe (`cls.datesBilan`), qui redate les bilans déjà écrits et date les suivants.
test('date du bilan pour la classe : redate les bilans du moment, pas les autres ; refuse une date hors du moment', () => {
  monter([bil('miperiode', '2026-10-25'), bil('conseil', '2026-12-15')]);
  ev(`S.classes.c1.eleves.push('s2'); S.eleves.s2 = { id: 's2', nom: 'Durand', prenom: 'Paul', classe_id: 'c1', bilans: [{ id: 'b2', date: '2026-10-28', ts: 1, type: 'miperiode', texte: 'B.' }] }`);
  const mode = `{ type: 'miperiode', date: '2026-10-25' }`;
  assert.strictEqual(ev(`dateBilanSet(S.classes.c1, ${mode}, '2026-11-10')`), 2, 'deux bilans redatés');
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify([S.eleves.s1.bilans.map(b => b.date), S.eleves.s2.bilans[0].date, S.classes.c1.datesBilan])`)),
    [['2026-11-10', '2026-12-15'], '2026-11-10', [{ type: 'miperiode', date: '2026-11-10' }]], 'le conseil garde sa date');
  assert.strictEqual(ev(`dateBilanSet(S.classes.c1, ${mode}, '2026-11-10')`), 0, 'rien à redater');
  assert.strictEqual(ev(`S.classes.c1.datesBilan.length`), 1, 'une seule date par moment');
  assert.strictEqual(ev(`dateBilanSet(S.classes.c1, ${mode}, '2027-02-10')`), false, 'une autre période : refusé');
  assert.strictEqual(ev(`dateBilanSet(S.classes.c1, { type: 'mois', date: '2026-11-15' }, '2026-12-02')`), false, 'un point de novembre daté de décembre : refusé');
  assert.strictEqual(ev(`S.eleves.s1.bilans[0].date`), '2026-11-10', 'rien n’a bougé');
  assert.strictEqual(ev(`dateBilanSet(S.classes.c1, ${mode}, '')`), 0, 'vide : la date est retirée');
  assert.strictEqual(ev(`S.classes.c1.datesBilan`), undefined);
  assert.strictEqual(ev(`S.eleves.s1.bilans[0].date`), '2026-11-10', 'les bilans gardent la leur');
});

test('date du bilan pour la classe : c’est la date du moment (bilans à venir) et la fin de la fiche d’un élève sans bilan', () => {
  monter([]);
  ev(`localStorage.removeItem(_LS_FICHE_JUSQUA); S.classes.c1.datesBilan = [{ type: 'miperiode', date: '2026-11-12' }]`);
  assert.strictEqual(ev(`${COL('bil:miperiode:0')}.date`), '2026-11-12', 'un bilan écrit ensuite prend cette date');
  const f = fen('bil:miperiode:0');
  assert.deepStrictEqual([f.end, f.pourquoi], ['2026-11-12', 'bilan'], 'élève sans bilan : la fiche s’arrête à la date de la classe');
  ev(`localStorage.setItem(_LS_FICHE_JUSQUA, 'auj')`);
  assert.notStrictEqual(fen('bil:miperiode:0').pourquoi, 'bilan', '« aujourd’hui » l’ignore');
  assert.doesNotMatch(ev(`_ficheBarHTML(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')})`), /fi-datebil/, 'le champ n’est là qu’avec « date du bilan »');
  ev(`localStorage.removeItem(_LS_FICHE_JUSQUA)`);
  const h = ev(`_ficheBarHTML(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')})`);
  assert.match(h, /id="fi-datebil" value="2026-11-12" min="2026-08-01" max="2027-01-31" onchange="_dateChamp\(event,\(\)=>ficheDateBilanUI\(this\)\)" onblur="_dateChamp/);
  assert.match(ev(`_ficheBarHTML(S.classes.c1, S.eleves.s1, ${COL('bil:mois:2026-11')})`), /min="2026-11-01" max="2026-11-30"/, 'un point du mois : son mois');
});

test('date du bilan pour la classe : normalisée au chargement (entrée illisible écartée, type inconnu écarté)', () => {
  monter([]);
  ev(`S.classes.c1.datesBilan = [{ type: 'miperiode', date: '2026-11-12' }, { type: 'miperiode', date: 'nimporte' }, { type: 'autre', date: '2026-11-12' }, 'x', null]`);
  ev(`_sanitizeCoreSections(); _sanitizeImbrique()`);
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(S.classes.c1.datesBilan)`)), [{ type: 'miperiode', date: '2026-11-12' }]);
  ev(`S.classes.c1.datesBilan = 'x'; _sanitizeCoreSections(); _sanitizeImbrique()`);
  assert.strictEqual(ev(`S.classes.c1.datesBilan`), undefined);
});

// v1.81.1 — l'utilisateur : « j'ai commencé à écrire les bilans plus tôt, mais j'aimerais que ça tienne compte de tout ce
// qui a lieu jusqu'à la date ». « Jusqu'au : aujourd'hui » ignore la date du bilan (retenu sur le poste).
test('« Jusqu’au » : la date du bilan (défaut) ou aujourd’hui, quelle que soit la date du bilan', () => {
  monter([bil('miperiode', '2026-10-25')]);
  ev(`localStorage.removeItem(_LS_FICHE_JUSQUA)`);
  assert.strictEqual(ev(`_ficheJusqua()`), 'bilan');
  let f = fen('bil:miperiode:0');
  assert.deepStrictEqual([f.end, f.pourquoi], ['2026-10-31', 'moment'], 'bilan commencé le 25/10 : la fiche s’arrête à la fin du moment');
  ev(`localStorage.setItem(_LS_FICHE_JUSQUA, 'auj')`);
  const auj = ev(`_todayYmd()`), fin = auj > '2027-01-31' ? '2027-01-31' : auj < '2026-10-31' ? '2026-10-31' : auj;
  f = fen('bil:miperiode:0');
  assert.strictEqual(f.end, fin, 'aujourd’hui (borné à la période, jamais avant la fin du moment)');
  const c = ev(`_ficheCourbeFin(S.classes.c1, 's1', ${COL('bil:miperiode:0')}, '2026-11-20')`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c)), { fin: '2026-11-20', pourquoi: 'aujourdhui' }, 'la courbe suit');
  const h = ev(`_ficheBarHTML(S.classes.c1, S.eleves.s1, ${COL('bil:miperiode:0')})`);
  assert.match(h, /class="on" aria-pressed="true" onclick="ficheJusquaSet\('auj'\)"/);
  ev(`localStorage.setItem(_LS_FICHE_JUSQUA, 'n_importe')`);
  assert.strictEqual(ev(`_ficheJusqua()`), 'bilan');
  ev(`localStorage.removeItem(_LS_FICHE_JUSQUA)`);
});
