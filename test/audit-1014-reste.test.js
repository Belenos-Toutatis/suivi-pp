// Audit du 2026-10-14 — les points mineurs laissés hors des six lots de la v1.67.0 :
// cran d'undo vide sur une partie du message, document archivé dans la chronologie,
// signature en `position: fixed`, intitulés de matières qu'on ne devine pas, papiers
// pas encore distribués. Chaque test a été vérifié en échec avant la correction. Noms inventés.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; undoStack.length = 0;
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1','s2'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
  };`;

test('message aux collègues : cocher une partie déjà cochée ne pose pas de cran d\'undo', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }); undoStack.length = 0;`);
  const key = ev(`AVIS_MSG_PARTIES[0].key`);
  ev(`avisMsgPartieUI(window.__c.id, ${JSON.stringify(key)}, true)`);
  assert.strictEqual(ev(`undoStack.length`), 0, 'partie déjà cochée : aucun cran');
  ev(`avisMsgPartieUI(window.__c.id, ${JSON.stringify(key)}, false)`);
  assert.strictEqual(ev(`undoStack.length`), 1, 'la décocher est un vrai geste : un cran');
  assert.ok(ev(`_avisMsgReglages(_avisCampOf(window.__c.id)).off.includes(${JSON.stringify(key)})`));
});

test('chronologie de la fiche : un document ARCHIVÉ non rendu n\'est pas « pas rendu »', () => {
  ev(FIXTURE);
  ev(`S.documents.d1 = { id:'d1', titre:'Vieille fiche', classIds:['5C'], dateDistribution:'2025-10-01', dateEcheance:null, suiviRetour:true, champs:[], retours:{}, archive:true, ord:0 };
      S.documents.d2 = { id:'d2', titre:'Fiche courante', classIds:['5C'], dateDistribution:'2025-10-02', dateEcheance:null, suiviRetour:true, champs:[], retours:{}, archive:false, ord:1 };
      _ficheMoment = 'bil:conseil:0'; _ficheSid = 's1';`);
  const E = evObj(`_ficheEvenements(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C'])).filter(e => e.k === 'papier').map(e => e.html)`);
  const vieille = E.find(h => /Vieille fiche/.test(h)), courante = E.find(h => /Fiche courante/.test(h));
  assert.ok(vieille && !/pas rendu/.test(vieille) && /\(archivé\)/.test(vieille), vieille);
  assert.match(courante, /pas rendu/, 'un document courant non rendu le reste');
});

test('signature HTML : `position: fixed` ou `sticky` est refusé, le reste du style passe', () => {
  assert.strictEqual(ev(`_htmlSur('<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999">x</div>')`), '<div>x</div>');
  assert.strictEqual(ev(`_htmlSur('<div style="POSITION : sticky">x</div>')`), '<div>x</div>');
  assert.strictEqual(ev(`_htmlSur('<span style="color:#123456;font-weight:bold">x</span>')`), '<span style="color:#123456;font-weight:bold">x</span>');
});

test('matières : DNL, histoire des arts et association sportive ne sont pas devinées ; les intitulés réels le restent', () => {
  ev(FIXTURE);
  const auto = t => ev(`_matiereDiscAuto(_moyNorm(${JSON.stringify(t)}))`);
  for (const t of ['SVT DNL ANGLAIS', 'DNL HISTOIRE GEO ANGLAIS', 'HISTOIRE DES ARTS', 'ASSOCIATION SPORTIVE']) assert.strictEqual(auto(t), null, t);
  assert.strictEqual(auto('SVT BILINGUE'), 'svt');
  assert.strictEqual(auto('HISTOIRE-GEOGRAPHIE EMC'), 'histoire_geo');
  assert.strictEqual(auto('ÉD.PHYSIQUE & SPORT.'), 'eps');
  assert.strictEqual(auto('ANGLAIS LV2'), 'anglais');
});

test('papiers à rendre : un papier pas encore distribué ne compte pas, et la liste comme la pastille le disent ensemble', () => {
  ev(FIXTURE);
  ev(`const demain = _ymdAdd(_todayYmd(), 1);
      S.documents.d1 = { id:'d1', titre:'Préparé d\\'avance', classIds:['5C'], dateDistribution: demain, dateEcheance:null, suiviRetour:true, champs:[], retours:{}, archive:false, ord:0 };
      S.documents.d2 = { id:'d2', titre:'Distribué', classIds:['5C'], dateDistribution:'2025-09-10', dateEcheance:null, suiviRetour:true, champs:[], retours:{}, archive:false, ord:1 };`);
  const liste = evObj(`_papiersARendre(getCls(), 's1').map(d => d.titre)`);
  const pastille = evObj(`_syntheseRow(getCls(), S.eleves.s1).nonRendus`);
  assert.deepStrictEqual(liste, ['Distribué']);
  assert.deepStrictEqual(pastille, liste, 'même filtre des deux côtés');
});
