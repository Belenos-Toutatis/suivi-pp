// Sauvegarde, sync et stockage. Deux familles :
//   - les fonctions pures (classification de version, rotation des backups, jauge) ;
//   - la SIMULATION DEUX POSTES : deux sandboxes, deux localStorage, deux _DEVICE_ID,
//     un « disque » partagé — et la classification vérifiée à chaque étape jusqu'à la
//     résolution de conflit. C'est le seul test qui voit ce que l'horloge vectorielle
//     est censée protéger.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// ─────────────────────────────────────────────── Classification des versions

const BASE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0 }; S.cur='5C';`;

test('_versionRelation : contenu identique ⇒ equal, quoi que disent les horloges', () => {
  ev(BASE);
  // ⚠️ C'est l'arbitre ultime : Nextcloud retouche le mtime sans changer le contenu, et
  // une horloge divergente sur un contenu identique n'est pas un vrai conflit.
  const disk = evObj(`JSON.parse(JSON.stringify(S))`);
  disk.savedAt = Date.now() + 99999;
  disk.clock = { autrePoste: 42 };
  assert.strictEqual(ev(`_versionRelation(${JSON.stringify(disk)})`), 'equal');
});

test('_versionRelation classe ahead / behind / diverged par l\'horloge', () => {
  ev(BASE);
  ev(`S.clock = { A: 2, B: 1 }; S.eleves.s1 = { id:'s1', nom:'X', prenom:'y', classe_id:'5C', tags:[] };`);
  const mk = (clock, extra) => JSON.stringify({ ...evObj(`JSON.parse(JSON.stringify(S))`), clock, eleves: extra });
  const e1 = { s1: { id: 's1', nom: 'X', prenom: 'y', classe_id: '5C', tags: [] }, s2: { id: 's2', nom: 'Z', prenom: 'w', classe_id: '5C', tags: [] } };
  assert.strictEqual(ev(`_versionRelation(${mk({ A: 3, B: 1 }, e1)})`), 'ahead');
  assert.strictEqual(ev(`_versionRelation(${mk({ A: 1, B: 1 }, e1)})`), 'behind');
  // Le disque domine sur B et connaît un 3ᵉ appareil, mais ne recule nulle part → toujours 'ahead'.
  assert.strictEqual(ev(`_versionRelation(${mk({ A: 2, B: 2, C: 1 }, e1)})`), 'ahead');
  // Vraie divergence : chaque côté a un compteur que l'autre n'a pas — A devant sur A,
  // le disque devant sur B. Personne ne domine : c'est le seul cas de conflit.
  assert.strictEqual(ev(`_versionRelation(${mk({ A: 1, B: 2 }, e1)})`), 'diverged');
});

test('_versionRelation : disque avec horloge, mémoire vierge ⇒ ahead (jamais un écrasement silencieux)', () => {
  ev(BASE);
  // Profil neuf : comparer les savedAt ferait passer un état local fraîchement initialisé
  // pour « plus récent » et écraserait le fichier de l'autre poste.
  ev(`S.clock = {}; S.savedAt = Date.now() + 99999;`);
  assert.strictEqual(ev(`_versionRelation({ classes: { '5C': { id:'5C', nom:'5C', eleves:['s9'] } }, eleves: { s9: {} }, clock: { A: 5 }, savedAt: 1 })`), 'ahead');
});

test('_contentFingerprint ignore savedAt et clock — sinon chaque save créerait un backup', () => {
  const a = ev(`_contentFingerprint({ classes:{x:1}, savedAt: 1, clock: { A: 1 } })`);
  const b = ev(`_contentFingerprint({ classes:{x:1}, savedAt: 2, clock: { A: 9, B: 3 } })`);
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, ev(`_contentFingerprint({ classes:{x:2}, savedAt: 1, clock: {} })`));
});

// ─────────────────────────────────────────────── Rotation des backups

test('_parseBackupName ne reconnaît que le format exact', () => {
  assert.strictEqual(ev(`_parseBackupName('suivi-pp-bk-2026-03-11-14h05m.json')`), new Date(2026, 2, 11, 14, 5).getTime());
  for (const bad of ['suivi-pp-auto.json', 'suivi-pp-bk-2026-03-11.json', 'plan-classe-bk-2026-03-11-14h05m.json', 'suivi-pp-checkpoint-x-2026-03-11-14h05m00s.json']) {
    assert.strictEqual(ev(`_parseBackupName(${JSON.stringify(bad)})`), null, bad);
  }
});

test('_backupsToDelete garde le plus récent de chaque tranche, et purge au-delà du dernier palier', () => {
  ev(`S = _emptyState(); postLoadHook(); S.prefs.backupStrategy = 'standard';`);
  const MIN = 60000, H = 60 * MIN, D = 24 * H;
  // ⚠️ Les tranches sont alignées sur le temps ABSOLU (floor(ts / taille)), pas sur l'âge :
  // deux backups à 3 min d'écart peuvent tomber de part et d'autre d'une frontière. On
  // ancre donc `now` sur une frontière de 10 min et on reste à l'intérieur des tranches.
  const now = Math.floor(Date.UTC(2026, 5, 1, 12, 0, 0) / (10 * MIN)) * (10 * MIN);
  const at = (ago, tag) => ({ name: tag, ts: now - ago });
  const b = [
    at(1 * MIN, 'recent-a'), at(4 * MIN, 'recent-b'), at(8 * MIN, 'recent-c'),   // même tranche de 10 min
    at(25 * MIN, 'autre-tranche'),
    at(3 * H + 5 * MIN, 'h-a'), at(3 * H + 40 * MIN, 'h-b'),                     // < 48 h → tranche d'une heure
    at(5 * D, 'jour'),
    at(200 * D, 'expire'),                                                        // > 120 j
  ];
  const del = [...ev(`_backupsToDelete(${JSON.stringify(b)}, ${now})`)];
  const kept = b.map(x => x.name).filter(n => !del.includes(n));
  assert.ok(del.includes('expire'), 'au-delà du dernier palier, le backup est supprimé');
  // Dans la tranche de 10 min : seul le plus récent survit.
  assert.ok(kept.includes('recent-a'));
  assert.ok(del.includes('recent-b') && del.includes('recent-c'));
  // Les deux backups de la même heure : un seul gardé, le plus récent.
  assert.ok(kept.includes('h-a') && del.includes('h-b'));
  assert.ok(kept.includes('autre-tranche') && kept.includes('jour'));
});

test('stratégie « off » : on cesse d\'en créer, on ne DÉTRUIT rien', () => {
  ev(`S = _emptyState(); postLoadHook(); S.prefs.backupStrategy = 'off';`);
  assert.strictEqual(ev(`_currentBackupStrategy().enabled`), false);
  assert.strictEqual(ev(`_currentBackupStrategy().minIntervalMs`), Infinity);
  const now = Date.now();
  const b = [{ name: 'vieux', ts: now - 400 * 86400000 }, { name: 'recent', ts: now }];
  assert.deepStrictEqual([...ev(`_backupsToDelete(${JSON.stringify(b)}, ${now})`)], []);
});

test('une clé de stratégie inconnue retombe sur « standard »', () => {
  ev(`S = _emptyState(); postLoadHook(); S.prefs.backupStrategy = 'nawak';`);
  assert.strictEqual(ev(`_currentBackupStrategyKey()`), 'standard');
});

// ─────────────────────────────────────────────── Fichiers et jauge

test('_fileKind reconnaît nos fichiers ET les copies de conflit de Nextcloud', () => {
  const k = n => evObj(`_fileKind(${JSON.stringify(n)})`);
  assert.strictEqual(k('suivi-pp-auto.json').label, 'Sync auto');
  assert.strictEqual(k('suivi-pp-bk-2026-03-11-14h05m.json').label, 'Backup');
  assert.strictEqual(k('suivi-pp-checkpoint-avant_conseil-2026-03-11-14h05m00s.json').label, 'Point « avant conseil »');
  assert.strictEqual(k('suivi-pp-conflit-autre-2026-03-11-14h05m00s.json').label, 'Archive conflit');
  assert.strictEqual(k('suivi pp (conflicted copy 2026-03-11).json').label, 'Conflit Nextcloud');
  assert.strictEqual(k('export-du-jour.json').label, 'Export');
});

test('_checkpointSafeLabel neutralise ce qui casserait un nom de fichier', () => {
  assert.strictEqual(ev(`_checkpointSafeLabel('avant conseil S1')`), 'avant_conseil_S1');
  assert.strictEqual(ev(`_checkpointSafeLabel('a/b\\\\c:d*e?f"g<h>i|j')`), 'abcdefghij');
  assert.strictEqual(ev(`_checkpointSafeLabel('')`), 'point');
  assert.strictEqual(ev(`_checkpointSafeLabel('///')`), 'point');
});

test('_byteLen compte les OCTETS, pas les caractères', () => {
  assert.strictEqual(ev(`_byteLen('abc')`), 3);
  assert.strictEqual(ev(`_byteLen('é')`), 2);           // un « é » compte double
  assert.strictEqual(ev(`_byteLen('Léa')`), 4);
});

test('_fmtBytes va jusqu\'au gigaoctet — un quota en Mo serait illisible', () => {
  assert.strictEqual(ev(`_fmtBytes(512)`), '512 o');
  assert.strictEqual(ev(`_fmtBytes(2048)`), '2 Ko');
  assert.strictEqual(ev(`_fmtBytes(5 * 1024 * 1024)`), '5,0 Mo');
  assert.strictEqual(ev(`_fmtBytes(3 * 1024 * 1024 * 1024)`), '3,0 Go');
});

test('_isAppLsKey distingue nos clés de celles d\'un autre outil de la même origine', () => {
  assert.strictEqual(ev(`_isAppLsKey('suiviPP_v1')`), true);
  assert.strictEqual(ev(`_isAppLsKey('suiviPP_theme')`), true);
  // ⚠️ Le préfixe DOIT différer de celui de Plan de classe, qui peut partager l'origine.
  assert.strictEqual(ev(`_isAppLsKey('planClasse_v3')`), false);
  assert.strictEqual(ev(`_isAppLsKey('autreOutil')`), false);
});

test('_versionSummary compte les sections à deux niveaux', () => {
  const d = { classes: { a: 1, b: 2 }, eleves: { x: 1 }, releves: { '5C': { d1: {}, d2: {} }, '5D': { d1: {} } },
              documents: { d: 1 }, elections: { '5C': { e1: {} } }, savedAt: 42 };
  assert.deepStrictEqual(evObj(`_versionSummary(${JSON.stringify(d)})`),
    { classes: 2, eleves: 1, releves: 3, documents: 1, elections: 1, savedAt: 42 });
  assert.deepStrictEqual(evObj(`_versionSummary(null)`), { classes: 0, eleves: 0, releves: 0, documents: 0, elections: 0, savedAt: null });
});

// ─────────────────────────────────────────────── Deux postes

test('SIMULATION DEUX POSTES : divergence détectée, résolution non destructive', () => {
  // Deux instances de l'app, chacune son localStorage et son _DEVICE_ID (le harnais en
  // tire un au hasard par sandbox). Le « disque » est une variable partagée.
  const A = loadApp(), B = loadApp();
  const a = c => A.__TESTEVAL(c), b = c => B.__TESTEVAL(c);
  const INIT = `S = _emptyState(); postLoadHook();
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0 }; S.cur='5C';`;
  a(INIT); b(INIT);
  assert.notStrictEqual(a('_DEVICE_ID'), b('_DEVICE_ID'), 'deux appareils distincts');

  // 1. A saisit un élève et écrit sur le disque.
  a(`pushUndo(); S.eleves.s1 = { id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s1'); save();`);
  let disk = JSON.parse(a('JSON.stringify(S)'));

  // 2. B, encore vierge, lit le disque : le disque est en AVANCE → rechargement proposé.
  assert.strictEqual(b(`_versionRelation(${JSON.stringify(disk)})`), 'ahead');
  b(`S = ${JSON.stringify(disk)}; postLoadHook();`);
  assert.strictEqual(b(`Object.keys(S.eleves).length`), 1);

  // 3. B modifie et réécrit ; A n'a pas encore relu → A est EN RETARD (pas un conflit).
  b(`pushUndo(); S.eleves.s2 = { id:'s2', nom:'MARTIN', prenom:'Noé', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s2'); save();`);
  disk = JSON.parse(b('JSON.stringify(S)'));
  assert.strictEqual(a(`_versionRelation(${JSON.stringify(disk)})`), 'ahead');   // vu de A, le disque est devant

  // 4. Divergence réelle : A modifie de son côté SANS avoir relu.
  a(`pushUndo(); S.eleves.s3 = { id:'s3', nom:'PETIT', prenom:'Inès', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s3'); save();`);
  assert.strictEqual(a(`_versionRelation(${JSON.stringify(disk)})`), 'diverged');

  // 5. « Garder ma version » : A fusionne l'horloge du disque et bumpe → il DOMINE.
  a(`if(!S.clock)S.clock={}; _clockMergeMax(S.clock, ${JSON.stringify(disk.clock)}); _clockBumpSelf(); _baseClock = JSON.parse(JSON.stringify(S.clock));`);
  assert.strictEqual(a(`_versionRelation(${JSON.stringify(disk)})`), 'behind');
  // Et vu de B, la version de A est maintenant en avance : plus de conflit en boucle.
  const diskA = JSON.parse(a('JSON.stringify(S)'));
  assert.strictEqual(b(`_versionRelation(${JSON.stringify(diskA)})`), 'ahead');

  // 6. Le compteur de l'AUTRE appareil n'a jamais reculé — sans quoi le conflit reviendrait.
  const cA = JSON.parse(a('JSON.stringify(S.clock)'));
  for (const [dev, n] of Object.entries(disk.clock)) assert.ok(cA[dev] >= n, `compteur de ${dev} conservé`);
});

test('SIMULATION DEUX POSTES : recharger la version distante ne laisse pas un Ctrl+Z la défaire', () => {
  const A = loadApp();
  const a = c => A.__TESTEVAL(c);
  a(`S = _emptyState(); postLoadHook(); S.classes['5C'] = { id:'5C', nom:'5C', eleves:[], ord:0 }; S.cur='5C';
     pushUndo(); S.eleves.local = { id:'local', nom:'LOCAL', prenom:'x', classe_id:'5C', tags:[] }; save();`);
  assert.ok(a('undoStack.length') > 0);
  const distant = { ..._emptyLike(), classes: { '5C': { id: '5C', nom: '5C', eleves: [], ord: 0 } },
                    eleves: { distant: { id: 'distant', nom: 'DISTANT', prenom: 'y', classe_id: '5C', tags: [] } }, clock: { autre: 9 } };
  a(`_applyReloadedData(${JSON.stringify(distant)}, { lastModified: 12345 })`);
  // ⚠️ Les piles référencent l'état PRÉ-reload : les garder ferait revenir l'état local
  // par-dessus les données distantes au premier Ctrl+Z.
  assert.strictEqual(a('undoStack.length'), 0);
  assert.strictEqual(a('redoStack.length'), 0);
  assert.deepStrictEqual([...a('Object.keys(S.eleves)')], ['distant']);
  assert.strictEqual(a('_lastParsedMtime'), 12345);

  function _emptyLike() { return { version: 1, savedAt: 1, releves: {}, documents: {}, elections: {}, tags: {}, prefs: {}, cur: '5C' }; }
});
