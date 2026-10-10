// Le CODE d'option d'une discipline (v1.62.0, l'utilisateur : « dans la liste des disciplines, le code court qui la
// représente, celui qui est associé aux élèves — pour le latin, les élèves auront le tag LAT »). Démo : la discipline
// Latin, code LATIN (l'option des latinistes de la démo). Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;
  globalThis.__lat = Object.values(S.disciplines).find(d => d.nom === 'Latin').id;
  globalThis.__latinistes = getCls().eleves.filter(sid => (S.eleves[sid].tags || []).some(t => S.tags[t]?.abbr === 'LATIN'));
  globalThis.__autre = getCls().eleves.find(sid => !__latinistes.includes(sid));`;

test('le code se range proprement : majuscules, sans doublon, plusieurs séparés par des virgules ; vide = retiré', () => {
  ev(DEMO);
  const r = evObj(`(() => { const d = S.disciplines[__lat];
    disciplineSet(__lat, { code: ' lat ; latin, LAT ' }); const a = d.code;
    disciplineSet(__lat, { code: '  ' }); return { a, b: 'code' in d }; })()`);
  assert.deepStrictEqual(r, { a: 'LAT, LATIN', b: false });
});

test('un élève suit une discipline à option s’il a l’option (par son code ou son nom) ; sans code, toute la classe', () => {
  ev(DEMO);
  const r = evObj(`(() => ({ n: __latinistes.length, lat: getCls().eleves.filter(sid => _discSuit(__lat, sid)).length,
    autre: _discSuit(__lat, __autre), maths: getCls().eleves.every(sid => _discSuit('maths', sid)),
    parNom: (disciplineSet(__lat, { code: 'latin' }), getCls().eleves.filter(sid => _discSuit(__lat, sid)).length),
    inconnu: (disciplineSet(__lat, { code: 'GREC' }), getCls().eleves.filter(sid => _discSuit(__lat, sid)).length) }))()`);
  assert.ok(r.n >= 3);
  assert.strictEqual(r.lat, r.n);
  assert.strictEqual(r.autre, false);
  assert.strictEqual(r.maths, true);
  assert.strictEqual(r.parNom, r.n, 'le nom de l’option (« Latin ») vaut aussi');
  assert.strictEqual(r.inconnu, 0);
});

test('feuille d’avis : l’onglet d’une discipline à option ne liste que ses élèves', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), camp = S.avis[cls.id].demo_av1, f = _avisFeuilles(cls, camp);
    const of = did => f[camp.disciplines.findIndex(d => d.id === did)].rows.length - AVIS_LIGNE_ENTETE;
    return { lat: of(__lat), maths: of('maths'), presents: _avisEleves(cls, camp).length, latPresents: _avisEleves(cls, camp).filter(s => __latinistes.includes(s.id)).length }; })()`);
  assert.strictEqual(r.lat, r.latPresents);
  assert.strictEqual(r.maths, r.presents);
  assert.ok(r.lat < r.maths);
});

test('compter les avis : une discipline non suivie n’est ni « sans réponse » ni dans le total', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), camp = S.avis[cls.id].demo_av1, nd = camp.disciplines.length;
    const lat = __latinistes.find(sid => _avisResume(camp, sid));
    const g = _avisGrilleHTML(cls, camp);
    const lecDisc = _avisLectureHTML(cls, camp, { did: __lat }).titre, lecEl = _avisLectureHTML(cls, camp, { sid: __autre });
    const blocs = _ficheAvisBlocsHTML(camp, __autre);
    return { nd, autre: _avisResume(camp, __autre).total, latiniste: _avisResume(camp, lat).total,
      tiret: g.includes('title="Ne suit pas Latin (option LATIN)">—</td>'), legende: g.includes('— non concerné (option)'),
      lecDisc, sansLat: !/Sans réponse :[^<]*Latin/.test(lecEl.html) && !/Sans réponse :[^<]*Latin/.test(blocs),
      titreEl: lecEl.titre, n: camp.disciplines.filter(d => _discSuit(d.id, __autre)).length }; })()`);
  assert.strictEqual(r.autre, r.nd - 1);
  assert.strictEqual(r.latiniste, r.nd);
  assert.ok(r.tiret, 'la case d’un non-latiniste dit « non concerné »');
  assert.ok(r.legende);
  assert.match(r.lecDisc, /^🗣 Latin — \d+ élèves? sur \d+$/);
  assert.ok(!/sur 2[45]$/.test(r.lecDisc), 'compté sur les latinistes, pas sur la classe');
  assert.ok(r.sansLat, '« Sans réponse » ne cite pas une discipline que l’élève ne suit pas');
  assert.match(r.titreEl, new RegExp(` sur ${r.n}$`));
});

test('carte de chaleur : la case avis d’une discipline non suivie est « — »', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), col = _chaleurMoments(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const g = _chaleurGroupes(cls, [], col).find(x => x.key === 'avis'); return g ? g.cell(__autre, __lat) : null; })()`);
  assert.ok(r, 'groupe des avis présent au conseil du S1');
  assert.strictEqual(r[1], '—');
  assert.match(r[2], /ne suit pas Latin \(option LATIN\)/);
});

test('💾 Données : la colonne du code, le nombre d’élèves qui portent l’option, tout échappé', () => {
  ev(DEMO);
  const h = ev(`_disciplinesTableHTML()`);
  assert.match(h, /<th[^>]*>Option \(code\)<\/th>/);
  assert.match(h, /<datalist id="disc-codes">[^]*<option value="LATIN">/);
  assert.match(h, /value="LATIN"[^>]*list="disc-codes"/);
  assert.match(h, new RegExp(`${evObj('__latinistes.length')} élèves en 5e C`));
  const x = ev(`(disciplineSet(__lat, { code: '"><img src=x onerror=alert(1)>' }), _disciplinesTableHTML())`);
  assert.ok(!x.includes('<IMG') && !x.includes('<img src=x'));
  assert.match(x, /⚠ aucun élève/);
});

test('📋 Suivis : la matière de la fiche rattachée à une discipline à option porte son code', () => {
  ev(DEMO);
  const r = evObj(`(() => { S.fichesSuivi['5C'] = { etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { matieres: [{ nom: 'Latin', prof: '' }, { nom: 'Mathématiques', prof: '' }] } } };
    const c = _suivisCommun('5C'); return { lat: c.profs.Latin, maths: c.profs['Mathématiques'].codes }; })()`);
  assert.strictEqual(r.lat.did, evObj('__lat'));
  assert.deepStrictEqual(r.lat.codes, ['LATIN']);
  assert.deepStrictEqual(r.maths, []);
});
