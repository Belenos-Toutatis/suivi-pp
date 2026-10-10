// 💾 Données et réglages en SOMMAIRE à gauche (v1.65.0, maquette A choisie par l'utilisateur) : rubriques, recherche, pastilles
// d'état, débuts de période (qui n'avaient aucun écran). Données de démonstration (noms inventés).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; renderDonnees = () => {}; _renderStorageGauge = () => {}; _donFiltre = '';`;
const rendu = k => ev(`(() => { _donRub = ${JSON.stringify(k)}; const z = document.createElement('div'); _renderDonneesInner(z); return z.innerHTML; })()`);

test('dix rubriques, réglages puis données ; chacune se rend, la courante est marquée', () => {
  ev(DEMO);
  const ks = evObj(`DON_RUBS.map(r => r.k)`);
  assert.deepStrictEqual(ks, ['classe', 'periodes', 'disciplines', 'salles', 'instances', 'apparence', 'imports', 'sauvegarde', 'fichiers', 'memoire']);
  for (const k of ks) {
    const h = rendu(k);
    assert.strictEqual((h.match(/class="don-it/g) || []).length, 10, k);
    assert.match(h, new RegExp(`class="don-it on" onclick="donRubUI\\('${k}'\\)"`), k);
    assert.match(h, /<div class="don-grp">Données<\/div>/);
  }
  assert.match(rendu('imports'), /exportJSON\(\)[^]*openImportStudents\(\)[^]*loadDemoOnDemand\(\)[^]*resetEverything\(\)/);
});

test('chercher un réglage : par mots, sans accents ; rien trouvé est dit', () => {
  ev(DEMO);
  const f = q => evObj(`(_donFiltre = ${JSON.stringify(q)}, _donRubsFiltrees().map(r => r.k))`);
  assert.deepStrictEqual(f('police'), ['apparence']);
  assert.deepStrictEqual(f('Période'), ['periodes']);
  assert.ok(f('dossier').includes('sauvegarde') && f('dossier').includes('fichiers'));
  assert.deepStrictEqual(f('latin'), ['disciplines', 'apparence'], 'le latin, et la police Latin Modern');
  ev(`_donFiltre = 'zzzz'`);
  assert.match(ev(`_donListeHTML()`), /Aucune rubrique/);
});

test('pastilles : orange quand une action est attendue', () => {
  ev(DEMO);
  const c = evObj(`({ disc: _donChip('disciplines'), sauv: _donChip('sauvegarde'), fich: _donChip('fichiers'), per: _donChip('periodes'), cl: _donChip('classe') })`);
  assert.strictEqual(c.disc.cl, 'warn', 'ESPAGNOL LV2 des moyennes de la démo n’a pas de discipline');
  assert.match(c.disc.txt, /^\d+ à rattacher$/);
  assert.strictEqual(c.sauv.cl, 'warn');
  assert.strictEqual(c.fich.cl, 'warn');
  assert.strictEqual(c.per.txt, 'semestres');
  assert.match(c.cl.txt, /^5e C · \d+$/);
});

test('débuts de période : réglables, refus d’août et du désordre, retour aux dates d’office, un cran d’undo', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    periodeDebutUI(0, '2026-02-16'); const a = _periodStarts('semestre'), n1 = undoStack.length, o1 = S.prefs.periodStarts;
    periodeDebutUI(0, '2025-08-20'); const b = _periodStarts('semestre');
    periodeDebutUI(0, '2026-02-16'); const n2 = undoStack.length;
    S.prefs.periodMode = 'trimestre'; periodeDebutUI(1, '2025-11-20'); const c = _periodStarts('trimestre');
    periodeDebutUI(0, '2025-11-28'); const d = _periodStarts('trimestre');
    periodeDebutUI(-1); const e = _periodStarts('trimestre');
    return { a, b, n1, n2, c, d, e, rempl: o1 !== S.prefs.periodStarts, sem: _periodStarts('semestre') }; })()`);
  assert.deepStrictEqual(r.a, ['02-16']);
  assert.strictEqual(r.n1, 1);
  assert.deepStrictEqual(r.b, ['02-16'], 'août refusé');
  assert.strictEqual(r.n2, 1, 'sans changement, pas de cran');
  assert.deepStrictEqual(r.c, ['12-01', '03-15'], 'T3 avant T2 : refusé');
  assert.deepStrictEqual(r.d, ['11-28', '03-15']);
  assert.deepStrictEqual(r.e, ['12-01', '03-15']);
  assert.ok(r.rempl);
  assert.deepStrictEqual(r.sem, ['02-16'], 'l’autre découpage garde les siennes');
});

test('Disciplines et matières : un intertitre par domaine, le détail au clic, échappé', () => {
  ev(DEMO);
  let h = rendu('disciplines');
  assert.match(h, /<tr class="fam"><td colspan="5">[^]*Langues/);
  assert.ok(!/class="disc-det"/.test(h));
  ev(`_donDiscOuvert = 'francais'`);
  h = rendu('disciplines');
  assert.match(h, /class="disc-det"[^]*Onglet de la feuille d'avis/);
  assert.match(h, /aria-expanded="true"[^>]*>Français/);
  const x = ev(`(disciplineSet('francais', { nom: '"><img src=x onerror=alert(1)>' }), (() => { _donRub = 'disciplines'; const z = document.createElement('div'); _renderDonneesInner(z); return z.innerHTML; })())`);
  assert.ok(!x.includes('<img src=x'));
});
