// Les trois remarques laissées par l'audit du 2026-10-10 (v1.58.3), corrigées en v1.58.4 ; chaque
// test vérifié en échec sur la v1.58.3. Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;`;

test('déplacer un élève vers une autre classe retire sa place et sa désignation de délégué dans l’ancienne', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[0];
    S.classes.c_autre = { id: 'c_autre', nom: '4B', annee: cls.annee, eleves: [], ord: 9 };
    cls.rooms = cls.rooms || {}; cls.rooms.salleX = { seating: { '0,0': sid } };
    cls.delegues = { date: '2025-09-20', titulaires: [sid], suppleants: [], note: '' };
    const ok = moveStudentToClass(sid, 'c_autre');
    return { ok, roster: cls.eleves.includes(sid), dans: S.classes.c_autre.eleves.includes(sid),
      assis: Object.values(cls.rooms.salleX.seating).includes(sid), del: !!cls.delegues, delOf: _delegueOf(sid) }; })()`);
  assert.deepStrictEqual(r, { ok: true, roster: false, dans: true, assis: false, del: false, delOf: null });
});

test('colonne Moy. : la moyenne d’un élève absent des imports de la période en cours est dite ancienne', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), list = _moyReleves(cls.id), der = list[list.length - 1].periode;
    const sid = cls.eleves.find(id => list.some(x => x.periode !== der && _moyGen(x, id) !== null));
    for (const rel of list) if (rel.periode === der) { delete rel.notes[sid]; delete rel.generale[sid]; }
    const autre = cls.eleves.find(id => id !== sid && list.some(x => x.periode === der && _moyGen(x, id) !== null));
    const m = _moyDerniere(cls.id, sid), a = _moyDerniere(cls.id, autre);
    const ligne = h => _elevesIndicHTML(cls, _elevesRows(cls).filter(x => x.s.id === h), [], null);
    return { anc: m.ancienne, lab: m.perLabel, autre: a.ancienne, html: ligne(sid), htmlAutre: ligne(autre) }; })()`);
  assert.strictEqual(r.anc, true);
  assert.ok(r.lab, 'la période de l’app est nommée');
  assert.strictEqual(r.autre, false);
  assert.ok(r.html.includes('el-mold') && r.html.includes('Absent des imports de la période en cours'));
  assert.ok(!r.htmlAutre.includes('el-mold'));
});

test('Indicateurs : les compteurs d’incidents et de contacts disent qu’ils portent sur l’année', () => {
  ev(DEMO);
  const h = ev(`_elevesIndicHTML(getCls(), _elevesRows(getCls()), [], null)`);
  assert.match(h, /Incidents <span class="el-th-sub">· année<\/span>/);
  assert.match(h, /Contacts <span class="el-th-sub">· année<\/span>/);
  assert.match(h, /Incidents et instances de TOUTE l&#39;année|Incidents et instances de TOUTE l'année/);
});
