// La fiche élève refondue (v1.44.0) : trois vues, une ouverture qui suit l'écran, la
// synthèse d'un MOMENT (conseil, mi-période, point du mois) — faits, avis, brouillon, et
// le bilan écrit en place. Ce qui est testé ici est PUR, ou passe par les mêmes fonctions
// que la modale de bilan.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; undoStack.length = 0; _bilanColsAjout = new Set(); _ficheMoment = null; _elevesFiltres = new Set(); _eleveFilter = '';
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PETIT',prenom:'Inès',classe_id:'5C',tags:[]},
  };
  S.releves['5C'] = {
    '2025-09-20': { date:'2025-09-20', ts:1, counts:{ s1:2, s2:0, s3:1 } },
    '2025-11-10': { date:'2025-11-10', ts:2, counts:{ s1:6, s2:1, s3:1 } },
    '2026-01-20': { date:'2026-01-20', ts:3, counts:{ s1:11, s2:3, s3:'A' } },
    '2026-03-10': { date:'2026-03-10', ts:4, counts:{ s1:13, s2:3, s3:2 } },
  };
  incidentAdd('s1', { date:'2025-12-03', type:'retenue', objet:'Bavardages', texte:'' });
  incidentAdd('s1', { date:'2026-02-10', type:'retenue', objet:'Hors S1', texte:'' });
  journalAdd('s1', '2025-10-14', 'appel', 'Appel à la mère');`;

test('Ouverture : à côté de la liste sur un écran large, plein écran sinon ; le bouton bascule pour la session', () => {
  ev(FIXTURE);
  ev(`_ficheOuvForce = null`);
  assert.strictEqual(ev(`_ficheOuverture(2560)`), 'cote', 'écran 21:9');
  assert.strictEqual(ev(`_ficheOuverture(1440)`), 'plein', 'Surface Pro');
  ev(`_ficheOuvForce = 'plein'`);
  assert.strictEqual(ev(`_ficheOuverture(2560)`), 'plein', 'le bouton passe avant la largeur');
  ev(`_ficheOuvForce = 'cote'`);
  assert.strictEqual(ev(`_ficheOuverture(1024)`), 'cote');
  ev(`_ficheOuvForce = null; _ficheSid = 's1'`);
  // La barre porte le bouton, qui dit ce qu'il fera.
  ev(`window.innerWidth = 1440`);
  assert.match(ev(`_ficheBarHTML(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C']))`), /onclick="ficheOuvertureBascule\(\)"[^>]*>◧ À côté de la liste</);
  assert.ok(!/localStorage[^\n]*suiviPP_ficheOuverture/.test(ev(`ficheOuvertureBascule.toString()`)), 'rien de retenu sur le poste');
});

test('Moments : conseil et mi-période de chaque période jusqu\'à la courante, bornes de chacun', () => {
  ev(FIXTURE);
  const ms = evObj(`_ficheMoments(S.classes['5C']).map(c => c.key)`);
  assert.ok(ms.includes('bil:conseil:0') && ms.includes('bil:miperiode:0'), ms.join(' '));
  const b = k => evObj(`(() => { const c = _ficheMoments(S.classes['5C']).find(x => x.key === '${k}'); const b = _ficheBornes(S.classes['5C'], c); return [b.start, b.end]; })()`);
  assert.deepStrictEqual(b('bil:conseil:0'), ['2025-08-01', '2026-01-31']);
  const mi = b('bil:miperiode:0');
  assert.strictEqual(mi[0], '2025-08-01');
  assert.ok(mi[1] >= '2025-10-25' && mi[1] <= '2025-11-05', 'le milieu de la période (1er août → 31 janvier) : ' + mi[1]);
  // Un point du mois : le mois, borné à la période.
  ev(`bilanAdd('s2', { date:'2025-11-12', type:'mois', texte:'Point' })`);
  assert.deepStrictEqual(b('bil:mois:2025-11'), ['2025-11-01', '2025-11-30']);
});

test('Faits d\'un moment : bornés, avec le rang au carnet, les incidents, les contacts — et un brouillon à réécrire', () => {
  ev(FIXTURE);
  ev(`_ficheMoment = 'bil:conseil:0'`);
  const F = evObj(`_ficheFaits(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C']))`);
  const obs = F.find(f => f.k === 'obs');
  assert.match(obs.html, /<strong>11 observations<\/strong> au carnet, dont \d+ depuis la mi-période — le plus haut de la classe/);
  const inc = F.find(f => f.k === 'incid');
  assert.match(inc.html, /1 incident<\/strong> : retenue le 03\/12/);
  assert.ok(!/10\/02/.test(inc.html), 'un incident de février n\'est pas du S1');
  assert.match(F.find(f => f.k === 'contact').html, /appel téléphonique le 14\/10|appel le 14\/10/i);
  // L'absent ('A') n'empêche pas de compter : Inès a 1 au S1 (relevé de janvier : absente).
  assert.match(evObj(`_ficheFaits(S.classes['5C'], S.eleves.s3, _ficheMomentCourant(S.classes['5C']))`).find(f => f.k === 'obs').html, /1 observation<\/strong>/);
  const br = ev(`_ficheBrouillon(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C']))`);
  assert.match(br, /^11 observations au carnet/);
  assert.match(br, /retenue le 03\/12/);
  assert.match(br, /\.$/);
  // Tout est échappé.
  ev(`incidentAdd('s1', { date:'2025-12-05', type:'<img src=x onerror=alert(1)>', objet:'x', texte:'' })`);
  const h = ev(`_ficheFaits(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C'])).map(f => f.html).join('')`);
  assert.ok(!h.includes('<img src=x'));
});

test('Mots qui reviennent dans les avis : comptés par discipline, mots vides écartés', () => {
  ev(FIXTURE);
  const m = evObj(`_avisMotsFrequents([
    { disc:{ id:'a' }, travail:'Bavardages incessants.', comportement:'Bavardages encore, toujours des bavardages' },
    { disc:{ id:'b' }, travail:'Des bavardages et des oublis de matériel.' },
    { disc:{ id:'c' }, remarque:'Oublis de matériel répétés, travail irrégulier' } ], [{ key:'travail' }, { key:'comportement' }, { key:'remarque' }])`);
  assert.deepStrictEqual(m.find(x => x.mot === 'bavardage'), { mot: 'bavardage', n: 2 }, 'deux disciplines, pas quatre mentions');
  assert.ok(m.some(x => x.mot === 'oubli' && x.n === 2));
  assert.ok(!m.some(x => x.mot === 'travail' || x.mot === 'toujour'), 'mots vides écartés');
});

test('Rédaction en place : crée le bilan du moment, le reprend ensuite, un cran d\'undo par changement, un texte vide ne l\'efface pas', () => {
  ev(FIXTURE);
  ev(`_ficheMoment = 'bil:miperiode:0'; _ficheSid = 's2'`);
  // Le champ de la fiche, simulé.
  ev(`window.__ta = document.createElement('textarea'); window.__ta.id = 'fi-bil'; const o = document.getElementById; window.__oldGet = o;
      document.getElementById = id => id === 'fi-bil' ? window.__ta : o.call(document, id);`);
  try {
    const u = ev(`undoStack.length`);
    ev(`window.__ta.value = '  Début difficile.  '; ficheBilanSave()`);
    assert.strictEqual(ev(`undoStack.length`), u + 1);
    const b = evObj(`_bilansOf('s2')`);
    assert.strictEqual(b.length, 1);
    assert.strictEqual(b[0].type, 'miperiode');
    assert.strictEqual(b[0].texte, 'Début difficile.');
    ev(`ficheBilanSave()`);
    assert.strictEqual(ev(`undoStack.length`), u + 1, 'rien de changé : rien d\'empilé');
    ev(`window.__ta.value = 'Début difficile, mieux depuis.'; ficheBilanSave()`);
    assert.strictEqual(ev(`_bilansOf('s2').length`), 1, 'le même bilan est repris, pas un second');
    assert.strictEqual(ev(`_bilansOf('s2')[0].texte`), 'Début difficile, mieux depuis.');
    ev(`window.__ta.value = '   '; ficheBilanSave()`);
    assert.strictEqual(ev(`_bilansOf('s2')[0].texte`), 'Début difficile, mieux depuis.', 'vidé : rien n\'est effacé');
    assert.strictEqual(ev(`window.__ta.value`), 'Début difficile, mieux depuis.', 'le texte revient dans le champ');
  } finally { ev(`document.getElementById = window.__oldGet`); }
});

test('Chronologie : les événements du moment, datés et triés, et la barre de la fiche', () => {
  ev(FIXTURE);
  ev(`_ficheMoment = 'bil:conseil:0'; _ficheSid = 's1'`);
  const E = evObj(`_ficheEvenements(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C'])).map(e => [e.date, e.k])`);
  assert.deepStrictEqual(E, [['2025-09-20', 'obs'], ['2025-10-14', 'contact'], ['2025-11-10', 'obs'], ['2025-12-03', 'incid'], ['2026-01-20', 'obs']]);
  const bar = ev(`_ficheBarHTML(S.classes['5C'], S.eleves.s1, _ficheMomentCourant(S.classes['5C']))`);
  assert.match(bar, /Tableau de bord/);
  assert.match(bar, /Chronologie/);
  assert.match(bar, /Faits et rédaction/);
  assert.match(bar, /1 \/ 3/);
  assert.match(bar, /<optgroup label="S1">/);
});
