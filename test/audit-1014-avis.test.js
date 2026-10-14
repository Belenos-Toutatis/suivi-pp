// Audit du 2026-10-14, lot « avis » : 🗣 Avis des collègues et disciplines.
// Signature HTML filtrée sans aucun chargement, colonnes renommées relues par la bonne clé,
// mise à jour de la feuille qui n'efface plus en silence, onglet au nom le plus long,
// U+FFFE / U+FFFF retirés du XML, LCE jamais rattachée d'office.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; undoStack.length = 0;
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1','s2','s4','s5'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'BERNARD',prenom:'Jean',classe_id:'5C',tags:[]},
    s5:{id:'s5',nom:'BERNARD',prenom:'Jean',classe_id:'5C',tags:[]},
  };`;
const H = ['Élève', 'Travail', 'Participation', 'Comportement'];
const tete = t => [[t], ['mode d\'emploi'], ['', 'a', 'b', 'c']];

// ── 1. _htmlSur : aucun style ne peut charger quoi que ce soit, même déguisé ──
test('signature HTML : entités nommées, image-set, cursor, list-style-image — le style est refusé', () => {
  const pieges = [
    '<div style="background:url&lpar;https://t/x.png&rpar;">a</div>',
    '<div style="background:&bsol;75 rl(https://t/x.png)">a</div>',
    '<div style="background:url&LeftParenthesis;https://t/x)">a</div>',
    "<div style='background-image:image-set(\"https://t/i.png\" 1x)'>a</div>",
    "<div style='background-image:-webkit-image-set(\"https://t/i.png\" 1x)'>a</div>",
    '<div style="cursor:url&lpar;https://t/cur.png&rpar;,auto">a</div>',
    '<div style="list-style-image:image-set(\'https://t/l.png\' 1x)">a</div>',
    '<div style="border-image-source:linear-gradient(red,blue)">a</div>',
    '<div style="font-family:x;src:url(https://t/f)">a</div>',
    '<div style="color:red&semi;background:red">a</div>',
  ];
  for (const p of pieges) {
    const o = ev(`_htmlSur(${JSON.stringify(p)})`);
    assert.ok(!/style=/.test(o), `style gardé : ${p} → ${o}`);
    assert.strictEqual(ev(`_htmlSur(${JSON.stringify(o)})`), o, 'idempotent');
  }
  // Les signatures ordinaires passent toujours : couleurs, gras, tailles, polices, liens.
  const ok = [
    '<p style="color:#1a2b3c;font-weight:bold;font-size:12pt;font-family:Arial, sans-serif">Jean</p>',
    "<div style=\"font-family:'Times New Roman';line-height:1.2\">x</div>",
    '<td style="border-left:2px solid #c00;padding-left:6px">t</td>',
    '<a href="https://www.ac-x.fr/a?b=1&amp;c=2" style="color:blue">site</a>',
    '<a href="mailto:jean@ac-x.fr">mail</a>',
  ];
  for (const p of ok) assert.ok(/style=|href=/.test(ev(`_htmlSur(${JSON.stringify(p)})`)), `signature ordinaire abîmée : ${p}`);
  assert.strictEqual(ev(`_htmlSur('<span style="color:rgb(10,20,30);font-style:italic">x</span>')`), '<span style="color:rgb(10,20,30);font-style:italic">x</span>');
});

// ── 2. Colonnes : deux clés ne lisent jamais le même en-tête ──
test('colonnes : titres échangés — chaque clé relit SA colonne, aucun titre porté n\'est un alias', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }); window.__c.avis = { s1: { maths: { travail: 'T', participation: 'P' } } };`);
  const r = evObj(`avisColonnesSet(window.__c, [{ key: 'travail', label: 'Participation' }, { key: 'participation', label: 'Travail' }, { key: 'comportement', label: 'Comportement' }])`);
  assert.ok(r.ok);
  const cols = evObj('window.__c.colonnes');
  const titres = cols.map(c => c.label.toUpperCase());
  for (const c of cols) for (const a of c.alias || []) assert.ok(!titres.includes(a.toUpperCase()), `alias « ${a} » = titre d'une colonne`);
  // Aller-retour : la feuille écrite par l'app se relit sans aucun changement.
  await ev(`_odsRead(_odsBuild(_avisFeuilles(getCls(), window.__c))).then(sh => { window.__lec = _avisLire(getCls(), window.__c, sh); })`);
  assert.deepStrictEqual(evObj('window.__lec.avis'), { s1: { maths: { travail: 'T', participation: 'P' } } });
  assert.deepStrictEqual(evObj('_avisChangements(getCls(), window.__c, window.__lec)'), []);
});
test('colonnes : un ancien titre repris par une colonne neuve lui revient, l\'ancienne clé ne le lit plus', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] });
    avisColonnesSet(window.__c, [{ key: 'travail', label: 'Résultats' }, { key: 'participation', label: 'Participation' }, { key: 'comportement', label: 'Comportement' }]);
    avisColonnesSet(window.__c, [...window.__c.colonnes, { label: 'Travail' }]);`);
  assert.ok(!(evObj('window.__c.colonnes[0].alias') || []).some(a => a === 'Travail'));
  const lec = evObj(`_avisLire(getCls(), window.__c, ${JSON.stringify([{ name: 'Maths', rows: [...tete('Mathématiques'),
    ['Élève', 'Travail', 'Résultats', 'Participation', 'Comportement'], ['DURAND Léa', 'nouvelle', 'résultats', '', '']] }])})`);
  assert.deepStrictEqual(lec.avis, { s1: { maths: { travail: 'résultats', c_travail: 'nouvelle' } } });
  // Même avec un alias resté d'un fichier ancien : le titre prime, un en-tête n'a qu'une clé.
  ev(`window.__c.colonnes[0].alias = ['Travail'];`);
  const lec2 = evObj(`_avisLire(getCls(), window.__c, ${JSON.stringify([{ name: 'Maths', rows: [...tete('Mathématiques'),
    ['Élève', 'Travail', 'Participation'], ['DURAND Léa', 'nouvelle', 'p']] }])})`);
  assert.deepStrictEqual(lec2.avis, { s1: { maths: { c_travail: 'nouvelle', participation: 'p' } } });
});

// ── 3. Mettre la feuille à jour : ce que l'app ne reconnaît pas est RECOPIÉ ──
const handle = `window.__toasts = []; window.__log = []; window.__ecrit = null;
  toast = m => { window.__toasts.push(m); };
  _uiConfirm = o => { window.__log.push('CONFIRMATION'); };
  _avisRevueOuvrir = r => { window.__log.push('REVUE'); window.__rv = r; };
  window.__h = { name: 'avis.ods', getFile: async () => ({ arrayBuffer: async () => window.__fichier.buffer.slice(0) }),
    createWritable: async () => ({ write: async d => { window.__ecrit = d; }, close: async () => {} }) };`;
const ecrit = () => ev(`_odsRead(window.__ecrit).then(sh => JSON.parse(JSON.stringify(sh.map(s => ({ name: s.name, rows: s.rows })))))`);
test('mise à jour : onglet ajouté par un collègue et onglet d\'une discipline retirée — gardés, et dit', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }); window.__c.avis = { s1: { maths: { travail: 'm' } } };`);
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify([
    { name: 'Maths', rows: [...tete('Mathématiques'), H, ['DURAND Léa', 'm']] },
    { name: 'Notes perso', rows: [['Remarques du prof de musique']] },
    { name: 'Anglais', rows: [...tete('Anglais'), H, ['DURAND Léa', 'avis anglais']] }])});`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  assert.deepStrictEqual(evObj('window.__log'), []);
  const sh = await ecrit();
  assert.deepStrictEqual(sh.map(s => s.name), ['Maths', 'Notes perso', 'Anglais']);
  assert.deepStrictEqual(sh[1].rows, [['Remarques du prof de musique']]);
  assert.ok(sh[2].rows.some(r => r.includes('avis anglais')));
  const t = evObj('window.__toasts').join(' ');
  assert.match(t, /Gardé tel quel/);
  assert.match(t, /« Notes perso »/);
  assert.match(t, /« Anglais »/);
});
test('mise à jour : lignes d\'homonymes non reconnues recopiées au bout de l\'onglet ; onglet aux en-têtes inconnus renommé', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] });`);
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify([
    { name: 'Maths', rows: [...tete('Mathématiques'), ['Élève', 'Participation', 'Travail', 'Comportement', 'Divers'],
      ['BERNARD Jean', 'p1', 't1', '', 'en plus'], ['BERNARD Jean', '', 't2'], ['DURANT Léa', '', 'faute de nom']] },
    { name: 'Anglais', rows: [...tete('Anglais'), ['Élève', 'Autre chose'], ['DURAND Léa', 'x']] }])});`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  const sh = await ecrit();
  // Les deux onglets de l'app, puis l'onglet illisible gardé sous un autre nom.
  assert.deepStrictEqual(sh.map(s => s.name), ['Anglais', 'Maths', 'Anglais (2)']);
  assert.deepStrictEqual(sh[2].rows.slice(-1), [['DURAND Léa', 'x']]);
  // Au bout de l'onglet Maths, remises dans l'ordre des colonnes de l'app (Travail, Participation, Comportement).
  assert.deepStrictEqual(sh[1].rows.slice(-3), [['BERNARD Jean', 't1', 'p1', '', 'en plus'], ['BERNARD Jean', 't2'], ['DURANT Léa', 'faute de nom']]);
  assert.match(evObj('window.__toasts').join(' '), /3 lignes d'élèves non reconnues/);
  // Relue : rien n'est rangé sur les homonymes, rien n'est perdu à la mise à jour suivante.
  ev(`window.__fichier = window.__ecrit;`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  const sh2 = await ecrit();
  assert.deepStrictEqual(sh2.find(s => s.name === 'Maths').rows.slice(-3), sh[1].rows.slice(-3));
  assert.strictEqual(sh2.find(s => s.name === 'Maths').rows.length, sh[1].rows.length, 'rien ne s\'accumule');
});
test('mise à jour par la revue : ce qui est gardé passe aussi ; fichier étranger : la confirmation reste', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }); window.__c.avis = { s1: { maths: { travail: 'app' } } };`);
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify([
    { name: 'Maths', rows: [...tete('Mathématiques'), H, ['DURAND Léa', 'feuille']] }, { name: 'Notes perso', rows: [['perso']] }])});`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  assert.deepStrictEqual(evObj('window.__log'), ['REVUE']);
  ev(`window.__rv.coches = new Set(); _avisRevue = window.__rv;`);
  await ev(`avisRevueValider()`);
  assert.deepStrictEqual((await ecrit()).map(s => s.name), ['Maths', 'Notes perso']);
  // Témoin : un fichier qui n'a rien d'une feuille d'avis demande toujours confirmation.
  ev(`window.__log = []; window.__ecrit = null; window.__fichier = _odsBuild([{ name: 'Budget', rows: [['perso']] }]);`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  assert.deepStrictEqual(evObj('window.__log'), ['CONFIRMATION']);
  assert.strictEqual(ev('window.__ecrit'), null);
});

// ── 4. Onglet renommé : la discipline au nom le plus long ──
test('onglet « Anglais euro (Mme Z) » rangé sous Anglais euro, pas sous Anglais ; homonymes : rien deviné', () => {
  ev(FIXTURE);
  ev(`S.disciplines.ae = { id:'ae', nom:'Anglais euro', onglet:'Anglais euro', actif:true, ord:3000, builtin:false, domaine:'langues' };
    window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['anglais', 'ae'] });`);
  const lec = evObj(`_avisLire(getCls(), window.__c, ${JSON.stringify([
    { name: 'Anglais euro (Mme Z)', rows: [...tete('Anglais euro — Mme Z'), H, ['DURAND Léa', 'euro']] },
    { name: 'Anglais', rows: [...tete('Anglais — Mme A'), H, ['MARTIN Noé', 'anglais']] }])})`);
  assert.deepStrictEqual(lec.avis, { s1: { ae: { travail: 'euro' } }, s2: { anglais: { travail: 'anglais' } } });
  // Deux disciplines au même nom : l'onglet renommé n'est rangé nulle part.
  ev(`S.disciplines.a2 = { id:'a2', nom:'Anglais', onglet:'Anglais bis', actif:true, ord:3001, builtin:false, domaine:'langues' };
    window.__c.disciplines.push({ id: 'a2', nom: 'Anglais', onglet: 'Anglais bis', profs: '' });`);
  const lec2 = evObj(`_avisLire(getCls(), window.__c, ${JSON.stringify([{ name: 'Anglais (Mme Z)', rows: [...tete('Anglais — Mme Z'), H, ['DURAND Léa', 'x']] }])})`);
  assert.deepStrictEqual(lec2.lus, []);
  assert.deepStrictEqual(lec2.inconnus, ['Anglais (Mme Z)']);
});

// ── 5. XML : U+FFFE et U+FFFF retirés ──
test('_odsEsc retire U+FFFE et U+FFFF (interdits en XML 1.0)', async () => {
  assert.strictEqual(ev(`_odsEsc('a\\uFFFEb\\uFFFFc<')`), 'abc&lt;');
  await ev(`window.__u = _odsBuild([{ name: 'A', rows: [['avec\\uFFFF\\uFFFEcar']] }])`);
  const sh = await ev(`_odsRead(window.__u).then(s => JSON.parse(JSON.stringify(s)))`);
  assert.strictEqual(sh[0].rows[0][0], 'aveccar');
});

// ── 6. La LCE n'est jamais rattachée d'office ──
test('_matiereDiscAuto : « LCE ALLEMAND », « LCE ANGLAIS » → l\'app demande', () => {
  ev(FIXTURE);
  for (const l of ['LCE ALLEMAND', 'LCE ANGLAIS', 'LANGU.CULT EU ALLEM', 'ANGLAIS LCE'])
    assert.strictEqual(ev(`_matiereDiscAuto(_moyNorm(${JSON.stringify(l)}))`), null, l);
  assert.strictEqual(ev(`_matiereDiscAuto(_moyNorm('ALLEMAND LV2'))`), 'allemand');
  assert.strictEqual(ev(`_matiereDiscAuto(_moyNorm('ANGLAIS LV1'))`), 'anglais');
  assert.strictEqual(ev(`_matiereDiscAuto(_moyNorm('SCIENCES ET TECHNOLOGIE'))`), 'technologie', '« ET » ne passe pas pour une LCE');
  // Une discipline « LCE allemand » ajoutée par l'utilisateur reconnaît toujours la matière de même nom.
  const id = ev(`disciplineAdd('LCE allemand').id`);
  assert.strictEqual(ev(`_matiereDiscAuto(_moyNorm('LCE ALLEMAND'))`), id);
});
