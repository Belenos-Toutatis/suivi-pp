// Audit ergonomique du 2026-10-03 — les cinq points majeurs (v1.47.0) : décisions dans la
// fenêtre de bilan, nom qui ouvre la fiche partout, totaux qui disent ce qu'ils comptent,
// tri par les en-têtes partout (et « ordre de passage » là où l'on marche dans les rangs),
// contacts modifiés par une seule fenêtre.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; _ficheMoment = null;`;
// Un rendu dans un conteneur qu'on garde (le stub du harnais rend un élément neuf par appel).
const rendu = (id, fn) => ev(`(() => { const z = document.createElement('div'); const o = document.getElementById; document.getElementById = x => x === '${id}' ? z : o.call(document, x);
  try { ${fn}; return z.innerHTML; } finally { document.getElementById = o; } })()`);

test('C1 — la fenêtre de bilan porte les décisions du même moment ; liste et carte de chaleur les signalent', () => {
  ev(DEMO);
  ev(`window.__els = new Map(); window.__gid = document.getElementById;
      document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`);
  try {
    const sid = ev(`getCls().eleves.find(id => !_decisionsOf(id).length)`), J = JSON.stringify(sid);
    const p0 = evObj(`_periods(getCls())[0]`);
    ev(`openBilan(${J}, null, { mode: { type: 'conseil', date: ${JSON.stringify(p0.end)} } }); __els.get('mbilan-type').value = 'conseil'; __els.get('mbilan-date').value = ${JSON.stringify(p0.end)};`);
    assert.strictEqual(ev(`__els.get('mbilan-dec').value`), '');
    // Décisions sans bilan : acceptées, un seul cran d'undo.
    ev(`undoStack.length = 0; __els.get('mbilan-txt').value = ''; __els.get('mbilan-dec').value = 'Tutorat en maths.'; _bilanCommit();`);
    assert.strictEqual(ev(`_decisionCible(getCls(), ${J}, { type: 'conseil', date: ${JSON.stringify(p0.start)} })?.texte`), 'Tutorat en maths.');
    assert.strictEqual(ev(`undoStack.length`), 1);
    // Bilan et décisions ensemble : toujours un seul cran.
    ev(`__els.get('mbilan-txt').value = 'Bon trimestre.'; __els.get('mbilan-dec').value = 'Tutorat en maths. Félicitations.'; _bilanCommit();`);
    assert.strictEqual(ev(`undoStack.length`), 2);
    assert.strictEqual(ev(`_bilanCible(getCls(), ${J}, { type: 'conseil', date: ${JSON.stringify(p0.end)} })?.texte`), 'Bon trimestre.');
    assert.strictEqual(ev(`_decisionCible(getCls(), ${J}, { type: 'conseil', date: ${JSON.stringify(p0.end)} })?.texte`), 'Tutorat en maths. Félicitations.');
    ev(`_bilanCommit()`);
    assert.strictEqual(ev(`undoStack.length`), 2, 'rien ne change : rien d\'empilé');
  } finally { ev(`document.getElementById = __gid`); }
  // Liste : le point du moment est cerclé ; carte de chaleur : ◉.
  const sid = ev(`getCls().eleves.find(id => _decisionsOf(id).some(d => d.type === 'conseil'))`);
  ev(`_bilanColsAjout = new Set(); S.prefs.bilansMasques = []`);
  const bc = `_bilanColsVues(getCls(), _carnetCurrentPeriodIdx(getCls()))`;
  const html = ev(`_elevesIndicHTML(getCls(), _elevesRows(getCls()).filter(x => x.s.id === ${JSON.stringify(sid)}), ${bc}, null)`);
  assert.match(html, /class="el-bd f d"/);
  const cellule = evObj(`(() => { const g = _chaleurGroupes(getCls(), ${bc}).find(x => x.key === 'bil'); const c = ${bc}.find(c => _decisionCible(getCls(), ${JSON.stringify(sid)}, { type: c.type, date: c.date })); return g.cell(${JSON.stringify(sid)}, c.key); })()`);
  assert.strictEqual(cellule[1], '◉');
  assert.match(cellule[2], /Décisions : /);
});

test('C2 — le nom ouvre la fiche dans toutes les grilles d\'élèves, avec la même allure', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[0]`);
  const lien = `onclick="openFiche('${sid}');return false"`;
  assert.ok(rendu('carnets-body', 'renderCarnets()').includes(lien), 'Observations');
  assert.ok(rendu('moyennes-body', 'renderMoyennes()').includes(lien), 'Moyennes');
  const doc = ev(`Object.values(S.documents).find(d => /orientation/i.test(d.titre)).id`);
  assert.ok(rendu('documents-body', `openDoc(${JSON.stringify(doc)})`).includes(lien), 'tableau d\'un document');
  assert.ok(rendu('documents-body', `openRamassage(); _ramSel = [${JSON.stringify(doc)}]; renderDocuments()`).includes(lien), 'ramassage');
  assert.match(ev(`_nomFicheHTML('x', 'NOM', 'Prénom')`), /^<span class="el-civ[^"]*"[^>]*>[^<]*<\/span><a href="#" class="el-nom"/, 'genre puis nom (v1.47.2)');
});

test('C3 — chaque total dit ce qu\'il compte, dans son en-tête', () => {
  ev(DEMO);
  assert.match(ev(`_elevesIndicHTML(getCls(), _elevesRows(getCls()), [], null)`), /Observations <span class="el-th-sub">· total année<\/span>/);
  const fin = ev(`_ficheBornes(getCls(), _chaleurMomentCourant(getCls())).end`);
  assert.strictEqual(ev(`_chaleurGroupes(getCls(), []).find(g => g.key === 'obstot').sub[0].l`), `au ${fin.slice(8, 10)}/${fin.slice(5, 7)}`);
  assert.match(rendu('carnets-body', 'renderCarnets()'), /Total S\d<br><small>carnet \+ MBN<\/small>/);
});

test('C4 — tri par les en-têtes partout ; « ordre de passage » seulement dans Observations et Retours', () => {
  ev(DEMO);
  ev(`carnetSort = 'nom'; _triDir.carnet = 1; moySort = 'nom'; _triDir.moy = 1;`);
  const obs = rendu('carnets-body', 'renderCarnets()');
  for (const k of ['nom', 'prenom', 'delta', 'total', 'somme']) assert.ok(obs.includes(`triTete('carnet','${k}')`), k);
  assert.match(obs, /Ordre de passage/, 'la démo a un placement : le menu est là');
  assert.ok(!/>Trier\b/.test(obs));
  const moy = rendu('moyennes-body', 'renderMoyennes()');
  assert.ok(moy.includes(`triTete('moy','nom')`) && moy.includes(`triTete('moy','gen')`));
  assert.ok(!/Ordre de passage|>Trier\b/.test(moy), 'pas de menu dans Moyennes');
  // Re-cliquer inverse ; un ordre de passage ne s'inverse pas.
  const noms = () => evObj(`_carnetRows(getCls()).map(s => s.nom + s.prenom)`);
  const a = noms();
  ev(`triTete('carnet', 'nom')`);
  assert.deepStrictEqual(noms(), [...a].reverse());
  ev(`ordrePassageSet('carnet', 'place')`);
  assert.strictEqual(ev(`_triDir.carnet`), 1);
  ev(`carnetSort = 'nom'; _triDir.carnet = 1;`);
  // Sans placement, pas de menu.
  ev(`for (const c of Object.values(S.classes)) c.rooms = {};`);
  assert.strictEqual(ev(`_ordrePassageHTML('carnet', getCls())`), '');
});

test('C5 — dans la fiche, les contacts s\'ouvrent dans la même fenêtre que depuis la liste', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves.find(id => _journalOf(id).length)`);
  const html = ev(`(() => { _ficheSid = ${JSON.stringify(sid)}; const c = getCls(); return _ficheTableauHTML(c, S.eleves[${JSON.stringify(sid)}], _ficheMomentCourant(c), {}); })()`);
  assert.ok((html.match(/ficheVersContacts\(\)/g) || []).length >= 2, '+ et ✎');
  assert.ok(!/ficheAddContact|fi-j-txt/.test(html), 'plus de formulaire en place');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /function ficheVersContacts\(\) \{ openContacts\(_ficheSid\);/);
});

test('Fiche : le nom se corrige dans « Identité et repères », plus dans le titre', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[0]`), J = JSON.stringify(sid);
  const corps = rendu('mfiche-body', `_ficheSid = ${J}; _ficheEdit = null; try { localStorage.removeItem(_LS_FICHE_VUE); } catch (_) {} _ficheRender()`);
  assert.match(corps, /<dt>Nom<\/dt><dd>[^<]*<\/dd>|<dt>Nom<\/dt><dd>.*?ficheEdit\('nom'\)/s);
  const titre = rendu('mfiche-title', `_ficheSid = ${J}; _ficheRender()`);
  assert.ok(!/ficheEdit\('nom'\)/.test(titre), 'pas de ✎ dans le titre');
  assert.match(rendu('mfiche-body', `_ficheSid = ${J}; _ficheEdit = 'nom'; _ficheRender(); _ficheEdit = null`), /id="fi-nom"/);
});

test('Points moyens (C6–C12) : moments dits indépendants, MBN corrigeable, imports réunis, cases cliquables, feuille d\'un autre moment dite, boutons nommés', () => {
  ev(DEMO);
  // C6
  assert.match(ev(`_elevesMomentsHTML(getCls(), _carnetCurrentPeriodIdx(getCls()))`), /se choisissent à part/);
  assert.match(ev(`_chaleurMomentsPickHTML(getCls(), 'ch')`), /se choisissent à part/);
  // C7
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 2)`), J = JSON.stringify(sid);
  const n = ev(`_obsMbnOf(${J}).length`), id = ev(`_obsMbnOf(${J})[0].id`);
  assert.strictEqual(ev(`obsMbnRemove(${J}, ${JSON.stringify(id)})`), true);
  assert.strictEqual(ev(`_obsMbnOf(${J}).length`), n - 1);
  assert.strictEqual(ev(`obsMbnRemove(${J}, 'inconnu')`), false);
  // C8 : la section Imports
  // La jauge de mémoire est asynchrone et vise l'écran réel : neutralisée ici (comme dans polices.test.js).
  const don = ev(`(() => { _renderStorageGauge = () => {}; const z = document.createElement('div'); _renderDonneesInner(z); return z.innerHTML; })()`);
  for (const f of ['openImportStudents()', 'openMbnImport()', 'openObsMbnImport()', 'openMoyImport()', "imp-file-pdc", "imp-file-recup", "imp-file'"]) assert.ok(don.includes(f), f);
  assert.match(don, /📥 Imports/);
  // C9 : incidents et bilans cliquables dans la carte de chaleur
  const G = `_chaleurGroupes(getCls(), _bilanColsVues(getCls(), _carnetCurrentPeriodIdx(getCls())))`;
  assert.match(ev(`${G}.find(g => g.key === 'inc').cell(${J}, '__tot')[3]`), /^openIncident\(/);
  assert.match(ev(`(g => g.cell(${J}, g.sub[0].id)[3])(${G}.find(g => g.key === 'bil'))`), /^elevesBilanOuvrir\(/);
  // C10 : une feuille d'un autre moment est dite
  ev(`_ficheMoment = 'bil:conseil:1'`);
  const lab = ev(`${G}.find(g => g.key === 'avis')?.label || ''`);
  if (lab) assert.match(lab, /pas de feuille pour Conseil S2/);
  ev(`_ficheMoment = null`);
  // C12 : boutons nommés, plus de « — » parmi les pastilles
  const liste = rendu('documents-body', `closeRamassage(); _docView = null; renderDocuments()`);
  assert.match(liste, /📋 Retours<\/button>/);
  assert.match(liste, /⧉ Dupliquer<\/button>/);
});

test('Points mineurs (C14) : genre dans toutes les grilles, faits à partir du 1er septembre, onglet Avis sur la dernière feuille', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[0]`);
  assert.match(rendu('carnets-body', 'renderCarnets()'), /<span class="el-civ/);
  assert.match(rendu('moyennes-body', 'renderMoyennes()'), /<span class="el-civ/);
  const faits = ev(`_ficheFaitsHTML(getCls(), S.eleves[${JSON.stringify(sid)}], _ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0'))`);
  assert.match(faits, /du 01\/09 au/);
  // Onglet Avis : une feuille choisie d'office tant qu'on n'a pas demandé « Nouvelle feuille ».
  ev(`_avisCampId = null; _avisNouvelleVoulue = false;`);
  rendu('avis-body', 'renderAvisTab()');
  assert.ok(ev(`!!_avisCampId`));
  ev(`avisRelire = () => {}; avisChoisirFeuille(null)`);
  rendu('avis-body', 'renderAvisTab()');
  assert.strictEqual(ev(`_avisCampId`), null, '« Nouvelle feuille » choisie : on y reste');
});
