// Audit complet du 2026-10-06 (v1.55.8) — les défauts corrigés en v1.55.9. Chaque test a été
// vérifié en échec sur la v1.55.8 avant la correction.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; _ficheMoment = null; undoStack.length = 0;`;
// Des éléments qui DURENT (le stub du harnais en rend un neuf par appel) ; `ouvertes` : les
// fenêtres dont classList.contains('on') répond vrai.
const ELS = (ouvertes = []) => `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) { const e = document.createElement('div'); e.contains = () => false;
    if (${JSON.stringify(ouvertes)}.includes(id)) e.classList = { add() {}, remove() {}, toggle() {}, contains: c => c === 'on' };
    __els.set(id, e); } return __els.get(id); };`;
const FIN = `document.getElementById = __gid; _appDialogResolve = null;`;

test('défaut 1 — la liste des papiers à rendre se redessine après Ctrl+Z', () => {
  ev(DEMO); ev(ELS(['mAppDialog']));
  try {
    const r = evObj(`(() => {
      const cls = getCls(), sid = cls.eleves.find(id => _papiersARendre(cls, id).length >= 2);
      elevesPapiersUI(sid);
      const d0 = _papiersARendre(cls, sid)[0];
      elevesPapierRenduUI(sid, d0.id);
      const apres = __els.get('appDialog-msg').innerHTML;
      undoLast();
      return { d0: d0.id, titre: d0.titre, apres, annule: __els.get('appDialog-msg').innerHTML, t: __els.get('appDialog-title').textContent,
        n: _papiersARendre(cls, sid).length };
    })()`);
    assert.ok(r.apres.includes('rendu le') && !r.apres.includes(`'${r.d0}')`), 'après ✓ Rendu : marqué rendu, plus de bouton');
    assert.ok(r.annule.includes(`elevesPapierRenduUI(`) && r.annule.includes(`'${r.d0}')`), 'après Ctrl+Z : le papier est de nouveau à rendre, avec son bouton');
    assert.ok(!r.annule.includes('rendu le'), 'plus de « rendu le … » pour un papier qui ne l\'est plus');
    assert.match(r.t, new RegExp(`${r.n} papiers à rendre`));
  } finally { ev(FIN); }
});

test('défaut 1 — les listes d\'incidents et de contacts d\'une case se redessinent aussi', () => {
  ev(DEMO); ev(ELS(['mAppDialog']));
  try {
    const r = evObj(`(() => {
      const cls = getCls(), sid = cls.eleves.find(id => _chaleurIncidentsListe(id, '0000-01-01', '9999-12-31').length);
      const n = _chaleurIncidentsListe(sid, '0000-01-01', '9999-12-31').length;
      pushUndo(); S.eleves[sid].incidents.push({ id: 'inc_test', date: _periods(cls)[0].start, ts: 1, type: S.eleves[sid].incidents[0].type, objet: 'Ajouté', texte: '' });
      chaleurIncidentsUI(sid, '0000-01-01', '9999-12-31', 'toute l\\'année');
      const avant = __els.get('appDialog-title').textContent;
      undoLast();
      const apres = __els.get('appDialog-title').textContent, html = __els.get('appDialog-msg').innerHTML;
      // Contacts : même chose.
      const sc = cls.eleves.find(id => _contactsListe(id, '0000-01-01', '9999-12-31').length);
      const nc = _contactsListe(sc, '0000-01-01', '9999-12-31').length;
      pushUndo(); S.eleves[sc].journal.push({ id: 'j_test', date: _periods(cls)[0].start, ts: 1, type: 'appel', texte: 'Ajouté' });
      chaleurContactsUI(sc, '0000-01-01', '9999-12-31', 'toute l\\'année');
      undoLast();
      return { n, avant, apres, html, nc, tc: __els.get('appDialog-title').textContent };
    })()`);
    assert.match(r.avant, new RegExp(`— ${r.n + 1} incidents`));
    assert.match(r.apres, new RegExp(`— ${r.n} incidents?`), 'Ctrl+Z retire l\'incident : la liste le montre');
    assert.ok(!r.html.includes('inc_test'));
    assert.match(r.tc, new RegExp(`— ${r.nc} contacts?`));
  } finally { ev(FIN); }
});

test('défaut 2 — la date proposée tombe dans la case, puis dans l\'année scolaire', () => {
  ev(DEMO);
  // Pur.
  const cls = `getCls()`;
  const p = evObj(`_periods(${cls})`), debut = p[0].start, fin = p[p.length - 1].end, an = fin.slice(0, 4);
  assert.strictEqual(ev(`_ymdJourValide('${an}-02-31')`), `${an}-02-28`);
  assert.strictEqual(ev(`_ymdJourValide('2024-02-31')`), '2024-02-29', 'année bissextile');
  assert.strictEqual(ev(`_ymdJourValide('${an}-04-31')`), `${an}-04-30`);
  assert.strictEqual(ev(`_ymdJourValide('${an}-05-31')`), `${an}-05-31`);
  assert.strictEqual(ev(`_dateParDefaut(${cls}, '${an}-02-01', '${an}-02-31', '${an}-10-06')`), `${an}-02-28`, 'après la case : son dernier jour');
  assert.strictEqual(ev(`_dateParDefaut(${cls}, '${an}-02-01', '${an}-02-31', '${an}-01-06')`), `${an}-02-01`, 'avant la case : son premier jour');
  assert.strictEqual(ev(`_dateParDefaut(${cls}, '${an}-02-01', '${an}-02-31', '${an}-02-10')`), `${an}-02-10`, 'dans la case : aujourd\'hui');
  assert.strictEqual(ev(`_dateParDefaut(${cls}, null, null, '2099-01-01')`), fin, 'sans case : ramenée dans l\'année');
});

test('défaut 2 — par les vrais ouvreurs : incident, contact (case vide de février, ou sans case) et relevé', () => {
  // La démo est une année entièrement passée : aujourd'hui tombe hors de tout.
  ev(DEMO);
  const p = evObj(`_periods(getCls())`), debut = p[0].start, fin = p[p.length - 1].end, an = fin.slice(0, 4);
  ev(ELS());
  try {
    const r = evObj(`(() => {
      const cls = getCls(), a = '${an}-02-01', b = '${an}-02-31';
      const sid = cls.eleves.find(id => !_chaleurIncidentsListe(id, a, b).length && !_contactsListe(id, a, b).length);
      chaleurIncidentsUI(sid, a, b, 'février');
      const inc = __els.get('minc-date').value;
      chaleurContactsUI(sid, a, b, 'février');
      const ct = __els.get('mrem-jdate').value;
      openIncident(sid);
      const incLibre = __els.get('minc-date').value;
      openContacts(sid);
      const ctLibre = __els.get('mrem-jdate').value;
      openReleveNew();
      return { inc, ct, incLibre, ctLibre, rel: __els.get('mrel-date').value, auj: _todayYmd() };
    })()`);
    assert.ok(r.inc >= `${an}-02-01` && r.inc <= `${an}-02-28`, `incident d'une case vide de février : ${r.inc}`);
    assert.ok(r.ct >= `${an}-02-01` && r.ct <= `${an}-02-28`, `contact d'une case vide de février : ${r.ct}`);
    for (const d of [r.incLibre, r.ctLibre, r.rel]) assert.ok(d >= debut && d <= fin, `ramenée dans l'année : ${d}`);
  } finally { ev(FIN); }
});

test('défaut 3 — à la fermeture, le focus va au remplaçant de l\'ouvreur redessiné, sinon sort de la fenêtre', () => {
  const r = evObj(`(() => {
    const vu = { getBoundingClientRect: () => ({ width: 10, height: 10 }) };
    // Comme dans un navigateur : focus() déplace activeElement, blur() le rend à la page.
    let actif = null;
    const mk = (nom, oc, attache) => { const x = { ...vu, nom, attache, getAttribute: k => k === 'onclick' ? oc : null,
      focus() { log.push('focus ' + nom); actif = x; }, blur() { log.push('blur ' + nom); actif = null; } }; return x; };
    const log = [];
    const ancien = mk('ancien', "elevesPapiersUI('s1')", false), neuf = mk('neuf', "elevesPapiersUI('s1')", true), autre = mk('autre', "openFiche('s1')", true);
    const dedans = mk('dedans', null, true);
    const D = document, sv = { contains: D.contains, qsa: D.querySelectorAll, ae: Object.getOwnPropertyDescriptor(D, 'activeElement') };
    D.contains = x => !!x.attache;
    D.querySelectorAll = s => s === '[onclick]' ? [autre, neuf] : [];
    Object.defineProperty(D, 'activeElement', { get: () => actif, configurable: true });
    actif = dedans;
    const fen = { _opener: ancien, contains: x => x === dedans, removeEventListener() {}, _a11yTrap: null };
    try {
      _modalTeardownA11y(fen);
      const r1 = log.slice(); log.length = 0;
      // L'ouvreur a disparu sans remplaçant : le focus quitte la fenêtre fermée.
      D.querySelectorAll = () => [];
      fen._opener = ancien; actif = dedans;
      _modalTeardownA11y(fen);
      return { r1, r2: log.slice() };
    } finally {
      D.contains = sv.contains; D.querySelectorAll = sv.qsa;
      if (sv.ae) Object.defineProperty(D, 'activeElement', sv.ae); else delete D.activeElement;
    }
  })()`);
  assert.deepStrictEqual(r.r1, ['focus neuf'], 'le bouton redessiné au même onclick reprend le focus');
  assert.deepStrictEqual(r.r2, ['blur dedans'], 'sans remplaçant, le focus ne reste pas dans la fenêtre cachée');
});

test('défaut 4 — les listes (papiers, incidents, contacts) ne portent pas l\'icône ❓', () => {
  ev(DEMO); ev(ELS(['mAppDialog']));
  try {
    const r = evObj(`(() => {
      const cls = getCls(), out = [];
      elevesPapiersUI(cls.eleves.find(id => _papiersARendre(cls, id).length)); out.push(__els.get('appDialog-icon').textContent);
      chaleurIncidentsUI(cls.eleves.find(id => _chaleurIncidentsListe(id, '0000-01-01', '9999-12-31').length), '0000-01-01', '9999-12-31', 'x'); out.push(__els.get('appDialog-icon').textContent);
      chaleurContactsUI(cls.eleves.find(id => _contactsListe(id, '0000-01-01', '9999-12-31').length), '0000-01-01', '9999-12-31', 'x'); out.push(__els.get('appDialog-icon').textContent);
      _appDialogShow({ title: 't', type: 'question', message: '' }); out.push(__els.get('appDialog-icon').textContent);
      return out;
    })()`);
    assert.deepStrictEqual(r, ['', '', '', '❓'], 'une vraie question garde son ❓');
  } finally { ev(FIN); }
});

test('défaut 5 — une discipline sans avis ne s\'ouvre pas par son en-tête, et ◀ ▶ la saute', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    const cls = getCls(), camp = Object.values(S.avis[cls.id]).sort((a, b) => Object.keys(b.avis || {}).length - Object.keys(a.avis || {}).length)[0];
    const D = camp.disciplines, eleves = _avisEleves(cls, camp), sid0 = eleves[0].id;
    // Trois disciplines de suite : avis, rien, avis.
    const pose = did => { camp.avis[sid0] = camp.avis[sid0] || {}; camp.avis[sid0][did] = { [_avisCols(camp)[0].key]: 'Bien.' }; };
    pose(D[0].id); pose(D[2].id);
    for (const s of Object.keys(camp.avis)) if (camp.avis[s]) delete camp.avis[s][D[1].id];
    const h = _avisGrilleHTML(cls, camp);
    const ouvre = did => h.split('openAvisLire(' + _escAttr(JSON.stringify({ did }))).length - 1;
    const l0 = _avisLectureHTML(cls, camp, { did: D[0].id }), l2 = _avisLectureHTML(cls, camp, { did: D[2].id }), l1 = _avisLectureHTML(cls, camp, { did: D[1].id });
    return { vide: ouvre(D[1].id), plein: ouvre(D[0].id), next0: l0.next?.did, prev2: l2.prev?.did, d0: D[0].id, d2: D[2].id, l1n: l1.next?.did, l1p: l1.prev?.did };
  })()`);
  assert.strictEqual(r.vide, 0, 'ni l\'en-tête ni le pied d\'une discipline sans avis ne s\'ouvrent');
  assert.strictEqual(r.plein, 2, 'une discipline avec des avis : l\'en-tête et le pied');
  assert.strictEqual(r.next0, r.d2, '▶ saute la discipline vide');
  assert.strictEqual(r.prev2, r.d0, '◀ saute la discipline vide');
  assert.strictEqual(r.l1p, r.d0, 'ouverte quand même, la discipline vide a ses voisines');
  assert.strictEqual(r.l1n, r.d2);
});

// Défaut 7 — le code mort. Une fonction de l'app que RIEN ne nomme (ni l'app, ni les tests, ni les
// scripts) est retirée. Les fonctions pures testées sans être appelées par l'app restent.
function fonctionsMortes(src, autres) {
  const defs = [...src.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)].map(m => m[1]);
  const re = n => new RegExp('(?<![\\w$])' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
  return defs.filter(n => (src.match(re(n)) || []).length < 2 && !autres.some(t => re(n).test(t)));
}
const AUTRES = [
  ...fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== path.basename(__filename)).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')),
  ...fs.readdirSync(path.join(__dirname, '..', 'scripts')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(__dirname, '..', 'scripts', f), 'utf8')),
];
test('défaut 7 — aucune fonction morte', () => {
  assert.deepStrictEqual(fonctionsMortes(SRC, AUTRES), []);
});
test('défaut 7 — méta-test : le détecteur voit une fonction morte injectée', () => {
  assert.deepStrictEqual(fonctionsMortes(SRC + '\nfunction _zzMorteDeTest(x) { return x; }\n', AUTRES), ['_zzMorteDeTest']);
});
