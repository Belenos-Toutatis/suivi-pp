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
  assert.match(bar, /1\/3/);
  // Le prototype : les moments en boutons (« Synthèse pour »), pas un menu.
  // v1.46.8 : le titre ouvre la liste à cocher des moments, la même que la carte de chaleur.
  assert.match(bar, /Synthèse pour ▾<\/summary>/);
  assert.match(bar, /<\/details><span class="pf-seg">/);
  assert.match(bar, /chaleurMomentVu\('[^']+', this\.checked, 'fi'\)/);
  assert.match(bar, /onclick="ficheMomentSet\('bil:conseil:0'\)"[^>]*>Conseil S1</);
});

test('Fiche : plus de « dossier complet » — ses éléments sont dans les cartes, derrière ✎ (corrections en place)', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _ficheMoment = null; try { localStorage.removeItem(_LS_FICHE_VUE); } catch (_) {}`);
  const sid = ev(`getCls().eleves.find(id => _ficheDocuments(getCls(), id).some(d => d.reponses.length))`);
  const rendu = edit => ev(`(() => { _ficheSid = ${JSON.stringify(sid)}; _ficheEdit = ${JSON.stringify(edit)};
    const z = document.createElement('div'); const o = document.getElementById; document.getElementById = x => x === 'mfiche-body' ? z : o.call(document, x);
    try { _ficheRender(); return z.innerHTML; } finally { document.getElementById = o; _ficheEdit = null; } })()`);
  const h = rendu(null);
  assert.ok(!/Dossier complet/.test(h));
  for (const k of ['classe', 'naissance', 'groupe', 'options', 'amen', 'presence', 'place', 'releves', 'bilans', 'incidents', 'contacts', 'papiers'])
    assert.match(h, new RegExp(`class="pf-ed[^"]*" onclick="ficheEdit\\('${k}'\\)"`), `✎ ${k}`);
  assert.match(h, /onclick="ficheCycleCivilite\(\)"/);
  // Les choix portés sur les papiers se lisent dans la carte.
  const ch = evObj(`_ficheDocuments(getCls(), ${JSON.stringify(sid)}).flatMap(d => d.reponses.map(r => r.valeurs[0]))`);
  assert.ok(ch.some(v => h.includes(v)));
  // ✎ ouvre la correction en place.
  assert.match(rendu('papiers'), /ficheDocReponse\(|ficheDocToggle\(/);
  assert.match(rendu('releves'), /ficheSetCumul\(/);
  assert.match(rendu('place'), /ficheSetPlace\(/);
  assert.match(rendu('naissance'), /ficheSetDate\(this,'naissance'\)/);
  assert.match(rendu('presence'), /ficheSetDate\(this,'arrivalDate'\)/);
});

test('Fiche : les textes libres gardent leurs paragraphes (remarque, bilans, avis)', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const r = /([^{}]+)\{\s*white-space:\s*pre-line;\s*\}/g;
  const sel = [...css.matchAll(r)].map(m => m[1]).join(',');
  for (const c of ['.pf-p', '.pf-bil', '.pf-cr > span', '.pf-mx td']) assert.ok(sel.includes(c), c);
});

test('« Modifier l\'élève » : par-dessus la fiche ; civilité, groupe, demi-pension en boutons qui écrivent le champ lu par saveEdit', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const fv = src.match(/function ficheVersEdition\(\) \{[^\n]*\}/)[0];
  assert.ok(!/closeMod2\('mfiche'\)/.test(fv), 'la fiche ne se ferme plus');
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook();
      window.__els = new Map(); window.__gid = document.getElementById;
      document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`);
  try {
    const sid = ev(`getCls().eleves.find(id => S.eleves[id].regime === 'EXT' && S.eleves[id].civilite === 'F' && S.eleves[id].groupe)`);
    ev(`openEdit(${JSON.stringify(sid)})`);
    const s = evObj(`S.eleves[${JSON.stringify(sid)}]`);
    assert.strictEqual(ev(`__els.get('es-civ').value`), 'F');
    assert.match(ev(`__els.get('es-civ-seg').innerHTML`), /class="on" aria-pressed="true" data-v="F"/);
    assert.strictEqual(ev(`__els.get('es-grp').value`), String(s.groupe));
    assert.strictEqual(ev(`__els.get('es-regime').value`), 'EXT');
    assert.strictEqual(ev(`__els.get('es-jours-w').style.display`), 'none', 'pas de jours pour un externe');
    assert.match(ev(`__els.get('es-title').textContent`), new RegExp(s.nom));
  } finally { ev(`document.getElementById = __gid`); }
});

test('« + Ajouter » : la même fenêtre que la modification, vierge ; Ajouter crée l\'élève dans la classe choisie', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;
      window.__els = new Map(); window.__gid = document.getElementById;
      document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`);
  try {
    const n0 = ev(`getCls().eleves.length`);
    ev(`openAddStudent()`);
    assert.strictEqual(ev(`__els.get('es-title').textContent`), '+ Nouvel élève');
    assert.strictEqual(ev(`__els.get('es-ok').textContent`), '✓ Ajouter');
    assert.strictEqual(ev(`__els.get('es-id').value`), '');
    assert.strictEqual(ev(`__els.get('es-nom').value`), '');
    // Sans nom : refusé, rien de créé.
    ev(`saveEdit()`);
    assert.strictEqual(ev(`getCls().eleves.length`), n0);
    ev(`__els.get('es-nom').value = 'NOUVEAU'; __els.get('es-prn').value = 'Inès'; __els.get('es-cls').value = getCls().id;
        __els.get('es-grp').value = '2';
        __els.get('es-civ').value = 'F'; __els.get('es-regime').value = 'DP';`);
    ev(`saveEdit()`);
    assert.strictEqual(ev(`getCls().eleves.length`), n0 + 1);
    const s = evObj(`S.eleves[getCls().eleves.slice(-1)[0]]`);
    assert.deepStrictEqual([s.nom, s.prenom, s.civilite, s.groupe, s.regime, s.classe_id], ['NOUVEAU', 'Inès', 'F', 2, 'DP', ev(`getCls().id`)]);
    assert.strictEqual(ev(`undoStack.length`), 1, 'un cran d\'undo');
  } finally { ev(`document.getElementById = __gid`); }
});

test('La fiche se ferme quand on quitte Élèves, Observations ou Moyennes', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /const FICHE_ONGLETS = \['eleves', 'carnets', 'moyennes'\];/);
  const f = src.slice(src.indexOf('function showTab('), src.indexOf('function switchTab('));
  assert.match(f, /!FICHE_ONGLETS\.includes\(name\)[^\n]*closeMod2\('mfiche'\)/);
});

test('Décisions d\'un moment de bilan : une par moment, sous le bilan (fiche), datées (chronologie), sur la synthèse de période', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _ficheMoment = null;`);
  const sid = ev(`getCls().eleves[3]`), J = JSON.stringify(sid);
  const p0 = evObj(`_periods(getCls())[0]`);
  const mode = `{ type: 'conseil', date: ${JSON.stringify(p0.end)} }`;
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, ${mode}, '  ')`), null, 'vide et rien avant : rien');
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, ${mode}, 'PPRE en maths.')`), 'ajout');
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, { type: 'conseil', date: ${JSON.stringify(p0.start)} }, 'PPRE en maths, tutorat.')`), 'modif', 'même période : la même décision');
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, { type: 'miperiode', date: ${JSON.stringify(p0.start)} }, 'Se placer devant.')`), 'ajout', 'autre moment : une autre');
  assert.strictEqual(ev(`_decisionsOf(${J}).length`), 2);
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, ${mode}, 'PPRE en maths, tutorat.')`), null, 'rien ne change');
  // La fiche : le champ sous le bilan, pour le moment choisi.
  ev(`_ficheMoment = 'bil:conseil:0'`);
  const red = ev(`_ficheRedacHTML(getCls(), S.eleves[${J}], _ficheMomentCourant(getCls()))`);
  assert.match(red, /id="fi-bil"[\s\S]*Décisions · à mettre en place[\s\S]*id="fi-dec"[^>]*>PPRE en maths, tutorat\.</);
  // Chronologie et synthèse de période.
  assert.ok(evObj(`_ficheEvenements(getCls(), S.eleves[${J}], _ficheMomentCourant(getCls())).map(e => e.html)`).some(h => /Décisions/.test(h) && /tutorat/.test(h)));
  assert.strictEqual(ev(`_periodeSynthese(getCls(), 0, { type: 'conseil' }).rows.find(r => r.sid === ${J}).decisions`), 'PPRE en maths, tutorat.');
  assert.match(ev(`_periodePrintHTML(getCls(), 0, { type: 'conseil', blocs: ['bilan'], forme: 'tableau' }).html`), /<strong>Décisions :<\/strong> PPRE en maths, tutorat\./);
  // Vider : retirée.
  assert.strictEqual(ev(`decisionSet(getCls(), ${J}, ${mode}, '')`), 'suppr');
  assert.strictEqual(ev(`_decisionsOf(${J}).length`), 1);
  // Chargement : une entrée illisible est écartée ; la démo en porte.
  ev(`S.eleves[${J}].decisions.push('x', { date: 'hier' }); postLoadHook();`);
  assert.strictEqual(ev(`S.eleves[${J}].decisions.length`), 1);
  assert.ok(ev(`getCls().eleves.filter(id => _decisionsOf(id).length).length`) >= 3);
  ev(`_ficheMoment = null`);
});
