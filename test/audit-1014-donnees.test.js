// Audit du 2026-10-14, lot « données » : import d'un fichier JSON, normalisation, annulation.
// Chaque test vérifié en échec avant la correction. Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true, today: '2026-09-09' }); postLoadHook(); undoStack.length = 0; redoStack.length = 0; _salvesDesarmer();`;
const ONGLETS = ['eleves', 'carnets', 'moyennes', 'documents', 'delegues', 'avis', 'donnees'];
// Les avertissements de la normalisation sont attendus ici : on les tait le temps d'un test.
const silence = fn => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
ev(DEMO);
const BASE = ev(`JSON.stringify(S)`);
// Le chemin d'un fichier importé : liste blanche, puis normalisation. → 'refus' | 'ok'.
const importer = d => silence(() => ev(`(() => { const d = JSON.parse(${JSON.stringify(JSON.stringify(d))});
  if (!_isPlainObj(d) || _validateImport(d)) return 'refus'; S = Object.assign(_emptyState(), d); postLoadHook(); return 'ok'; })()`));
const muter = f => { const d = JSON.parse(BASE); f(d); return d; };
const rendre = () => silence(() => { for (const t of ONGLETS) ev(`renderTab('${t}')`); });

// ── 1. Identifiants écrits en VALEUR, égaux à une propriété de Object.prototype ──
test('S.cur = « constructor » ou « __proto__ » : remplacé par une classe existante, aucun onglet ne tombe', () => {
  for (const v of ['constructor', '__proto__', 'toString']) {
    assert.strictEqual(importer(muter(d => { d.cur = v; })), 'ok');
    assert.strictEqual(ev(`S.cur`), '5C', v);
    assert.doesNotThrow(rendre, v);
  }
});

test('getCls ne rend jamais une propriété héritée, et _auditState signale un S.cur invalide', () => {
  ev(DEMO);
  assert.deepStrictEqual(evObj(`(() => { S.cur = 'constructor'; const r = { cls: getCls(), audit: _auditState() }; S.cur = '5C'; return r; })()`),
    { cls: null, audit: ['classe courante inconnue constructor'] });
});

test('roster, places, classIds et classe_id : une référence qui ne désigne pas une entrée PROPRE est retirée', () => {
  const sid0 = JSON.parse(BASE).classes['5C'].eleves[0];
  const d = muter(d => {
    d.classes['5C'].eleves.push('toString', '__proto__', 'inconnu');
    const room = Object.values(d.classes['5C'].rooms)[0]; room.seating['9,9'] = 'constructor';
    Object.values(d.documents)[0].classIds.push('hasOwnProperty');
    d.eleves[sid0].classe_id = 'constructor';
  });
  assert.strictEqual(importer(d), 'ok');
  const r = evObj(`(() => { const c = S.classes['5C'];
    return { roster: c.eleves.filter(x => !Object.prototype.hasOwnProperty.call(S.eleves, x)),
      assis: Object.values(c.rooms).flatMap(r => Object.values(r.seating)).filter(x => !Object.prototype.hasOwnProperty.call(S.eleves, x)),
      classIds: Object.values(S.documents)[0].classIds, classe: S.eleves['${sid0}'].classe_id, audit: _auditState() }; })()`);
  assert.deepStrictEqual(r, { roster: [], assis: [], classIds: ['5C'], classe: '5C', audit: [] });
  assert.doesNotThrow(rendre);
  assert.doesNotThrow(() => silence(() => ev(`openFiche('${sid0}')`)));
});

test('classe_id inconnu d’un élève qu’aucun roster ne porte : le champ est retiré', () => {
  const d = muter(d => { d.eleves.orphelin = { id: 'orphelin', nom: 'ZORN', prenom: 'Ada', classe_id: 'valueOf', tags: [] }; });
  assert.strictEqual(importer(d), 'ok');
  assert.strictEqual(ev(`'classe_id' in S.eleves.orphelin`), false);
});

test('un roster contenant « __proto__ » ne permet plus d’écrire dans Object.prototype par un geste ordinaire', () => {
  assert.strictEqual(importer(muter(d => { d.classes['5C'].eleves.push('__proto__'); })), 'ok');
  // Et même sans la normalisation, l'accès de base refuse une propriété héritée.
  ev(`_withStudent('__proto__', s => { s.remarque = 'POLLUÉ'; })`);
  const pollue = ev(`Object.prototype.hasOwnProperty('remarque')`);
  ev(`delete Object.prototype.remarque`);
  assert.strictEqual(pollue, false);
  assert.strictEqual(ev(`S.classes['5C'].eleves.includes('__proto__')`), false);
});

// ── 2. Élève sans nom ni prénom ──
test('un élève sans nom ni prénom reçoit des chaînes vides, et Vie de classe ne tombe plus', () => {
  const sids = JSON.parse(BASE).classes['5C'].eleves;
  for (const sid of sids) {
    assert.strictEqual(importer(muter(d => { d.eleves[sid] = {}; })), 'ok');
    assert.deepStrictEqual(evObj(`[S.eleves['${sid}'].nom, S.eleves['${sid}'].prenom]`), ['', '']);
    assert.doesNotThrow(() => silence(() => ev(`renderTab('delegues')`)), sid);
  }
  assert.strictEqual(importer(muter(d => { d.eleves[sids[0]].nom = 42; d.eleves[sids[0]].prenom = null; })), 'ok');
  assert.deepStrictEqual(evObj(`[S.eleves['${sids[0]}'].nom, S.eleves['${sids[0]}'].prenom]`), ['42', '']);
});

// ── 3. L'identifiant suit sa clé ──
test('cls.id (et l’id des salles, tags, matières, disciplines, instances) est remis à sa clé', () => {
  const d = muter(d => {
    d.classes['5C'].id = 'AUTRE';
    for (const k of ['salles', 'tags', 'matieres', 'disciplines', 'instances']) Object.values(d[k])[0].id = 'faux';
  });
  assert.strictEqual(importer(d), 'ok');
  const r = evObj(`(() => ({ cls: getCls().id, releves: _relDates(getCls().id).length,
    faux: ['salles', 'tags', 'matieres', 'disciplines', 'instances'].filter(k => Object.entries(S[k]).some(([id, x]) => x.id !== id)) }))()`);
  assert.deepStrictEqual(r, { cls: '5C', releves: Object.keys(JSON.parse(BASE).releves['5C']).length, faux: [] });
});

// ── 4. Gestes sans effet : aucun cran d'annulation ──
const sansHorloge = j => { const o = JSON.parse(j); delete o.clock; delete o.savedAt; return JSON.stringify(o); };
function geste(code) {
  ev(DEMO);
  const avant = ev(`JSON.stringify(S)`);
  silence(() => ev(code));
  return { change: sansHorloge(avant) !== sansHorloge(ev(`JSON.stringify(S)`)), crans: ev(`undoStack.length`) };
}
test('gestes sans effet : ni changement ni cran d’annulation', () => {
  const cas = {
    'instanceSetUI, espace ajouté au nom': `(() => { const i = Object.values(S.instances)[0]; instanceSetUI(i.id, { label: i.label + ' ' }); })()`,
    'instanceSetUI, espaces ajoutés à la description': `(() => { const i = Object.values(S.instances)[0]; instanceSetUI(i.id, { description: (i.description || '') + '  ' }); })()`,
    'disciplineSetUI, espace ajouté au nom': `(() => { const i = Object.values(S.disciplines)[0]; disciplineSetUI(i.id, { nom: i.nom + ' ' }); })()`,
    'tagSetColor, même couleur': `(() => { const t = Object.values(S.tags)[0]; tagSetColor(t.id, t.color); })()`,
    'avisCibleUI, élève déjà demandé': `(() => { const c = Object.values(S.avis['5C']).find(c => c.cibles.length); avisCibleUI(c.id, c.cibles[0], true); })()`,
    'matiereDiscUI, même rattachement': `(() => { const m = Object.keys(S.matieres)[0]; matiereDiscUI(m, 'auto'); undoStack.length = 0; matiereDiscUI(m, 'auto'); })()`,
    'setBackupStrategy, même stratégie': `setBackupStrategy(S.prefs.backupStrategy)`,
  };
  for (const [nom, code] of Object.entries(cas)) {
    const r = geste(code);
    if (!nom.startsWith('matiereDiscUI')) assert.strictEqual(r.change, false, nom);   // là, le premier appel a pu changer
    assert.strictEqual(r.crans, 0, nom);
  }
  // Contre-épreuve : un vrai changement pose toujours son cran.
  assert.deepStrictEqual(geste(`(() => { const t = Object.values(S.tags)[0]; tagSetColor(t.id, '#123456'); })()`), { change: true, crans: 1 });
  assert.deepStrictEqual(geste(`(() => { const i = Object.values(S.instances)[0]; instanceSetUI(i.id, { label: 'Renommée' }); })()`), { change: true, crans: 1 });
});

// Une case du carnet déjà chiffrée : (date, élève, cumul).
const CASE = `const cls = getCls(), ymd = _relDates(cls.id)[2], sid = cls.eleves.find(s => typeof S.releves[cls.id][ymd].counts[s] === 'number'), v = S.releves[cls.id][ymd].counts[sid];`;
const fauxChamp = `const inp = { dataset: { ymd, sid }, value: '', blur() {}, focus() {}, select() {} };`;
test('carnet : « 08 » retapé sur 8 n’arme pas la salve (pas de Ctrl+Z vide), et le champ réaffiche 8', () => {
  ev(DEMO);
  const r = evObj(`(() => { ${CASE} ${fauxChamp} inp.value = '0' + v; const av = JSON.stringify(S.releves);
    relCellChange(inp); return { crans: undoStack.length, arme: _relUndoArmed, inchange: av === JSON.stringify(S.releves), aff: inp.value === String(v) }; })()`);
  assert.deepStrictEqual(r, { crans: 0, arme: false, inchange: true, aff: true });
  // Contre-épreuve : une vraie saisie arme toujours la salve.
  const r2 = evObj(`(() => { ${CASE} ${fauxChamp} inp.value = String(v + 1); relCellChange(inp); return { crans: undoStack.length, arme: _relUndoArmed }; })()`);
  assert.deepStrictEqual(r2, { crans: 1, arme: true });
  ev(`_salvesDesarmer()`);
});

test('carnet : la touche « inchangé » sur une case déjà à cette valeur ne pose pas de cran', () => {
  ev(DEMO);
  const r = evObj(`(() => { ${CASE} ${fauxChamp} if (typeof CSS === "undefined") globalThis.CSS = { escape: String }; const qs = document.querySelector, qa = document.querySelectorAll;
    document.querySelector = () => inp; document.querySelectorAll = () => [inp];
    try { _relSugPick(ymd, sid, String(v)); } finally { document.querySelector = qs; document.querySelectorAll = qa; }
    return { crans: undoStack.length, arme: _relUndoArmed }; })()`);
  assert.deepStrictEqual(r, { crans: 0, arme: false });
});

// ── Garde-fou : ne RIEN changer à des données saines ──
test('aller-retour export → réimport de la démo : la normalisation ne change rien', () => {
  ev(DEMO);
  const avant = ev(`JSON.stringify(S)`);
  assert.strictEqual(importer(JSON.parse(avant)), 'ok');
  assert.strictEqual(sansHorloge(ev(`JSON.stringify(S)`)), sansHorloge(avant));
});

// ── Fuzz à graine fixe : un fichier altéré est refusé ou chargé, jamais une exception ──
const VALEURS = [null, 0, -1, 1e308, '2', '', 'abc', [], {}, true, [null], [1, 'a', {}], { a: 1 },
  '<img src=x onerror=alert(1)>', '2025-13-45', '0013-05-21', 'constructor', '__proto__', 'toString', 'hasOwnProperty'];
function chemins(o, p, out) { out.push(p); if (o && typeof o === 'object') for (const k of Object.keys(o)) chemins(o[k], p.concat(k), out); return out; }
function fuzz(n, graine) {
  let seed = graine;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const base = JSON.parse(BASE), tous = chemins(base, [], []).filter(p => p.length);
  const erreurs = []; let charges = 0;
  for (let i = 0; i < n; i++) {
    const d = JSON.parse(BASE), dbg = [];
    for (let m = 0; m < 3; m++) {
      const p = tous[Math.floor(rnd() * tous.length)];
      let o = d; for (let j = 0; j < p.length - 1 && o; j++) o = o[p[j]];
      const v = VALEURS[Math.floor(rnd() * VALEURS.length)];
      if (o && typeof o === 'object') { o[p[p.length - 1]] = JSON.parse(JSON.stringify(v)); dbg.push(p.join('.') + '=' + JSON.stringify(v)); }
    }
    try {
      if (importer(d) !== 'ok') continue;
      charges++;
      rendre();
      silence(() => ev(`(() => { _auditState(); const c = getCls(), sid = c && c.eleves[0]; if (sid) openFiche(sid); if (c) _elevesChaleurHTML(c, _elevesRows(c)); })()`));
    } catch (e) { erreurs.push(String(e && e.message).slice(0, 120) + ' | ' + dbg.join(' ; ')); }
  }
  return { erreurs, charges };
}
test('fuzz (graine fixe, 250 fichiers altérés) : import puis rendu des onglets, aucune exception', () => {
  const r = fuzz(250, 20261014);
  assert.ok(r.charges > 150, `le fuzz doit charger la plupart des fichiers (${r.charges})`);
  assert.deepStrictEqual(r.erreurs, []);
  ev(DEMO);
});
test('méta-test du fuzz : une exception au rendu est bien vue', () => {
  ev(`globalThis.__rsAvant = renderStudents; renderStudents = () => { throw new Error('panne volontaire'); }`);
  let r;
  try { r = fuzz(5, 1); } finally { ev(`renderStudents = globalThis.__rsAvant`); }
  assert.ok(r.charges > 0 && r.erreurs.length === r.charges && r.erreurs.every(m => m.includes('panne volontaire')), JSON.stringify(r));
  ev(DEMO);
});
