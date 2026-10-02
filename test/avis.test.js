// Avis des collègues (v1.39.0) : une feuille du Nuage, un onglet par discipline, que les
// collègues remplissent par un lien de partage ; l'app la prépare et la relit.
// Ce qui est testé ici est PUR : catalogue, rattachement des matières, onglets écrits,
// lecture de ce que les collègues ont écrit — et le format .ods, lu et écrit sans dépendance.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Une classe de 2025-26, quatre élèves dont un parti avant le S2 et un arrivé au S2, et deux
// imports de moyennes aux intitulés RÉELS du bureau numérique (relevés sur de vrais exports).
const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; undoStack.length = 0;
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1','s2','s3','s4','s5'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s3:{id:'s3',nom:'PETIT',prenom:'Inès',classe_id:'5C',tags:[],departureDate:'2025-09-15'},
    s4:{id:'s4',nom:'ARRIVE',prenom:'Tard',classe_id:'5C',tags:[],arrivalDate:'2026-03-01'},
    s5:{id:'s5',nom:'<b>BOLD</b>',prenom:'Zoé',classe_id:'5C',tags:[]},
  };
  const imp = (date, cols) => { const lignes = ["Nom et prénom de l'élève;Périodes;" + cols.join(';') + ';Moy.', 'DURAND Léa;Premier semestre;' + cols.map(() => '12').join(';') + ';12'];
    const parse = _moyParse(lignes.join('\\n')); moyImport('5C', parse, _moyMatch(parse, '5C'), { date, label: '', fichier: 'x.csv' }); };
  imp('2025-10-10', ['ANGLAIS(Mme A)', 'MATHÉMATIQUES(M. B)', 'ÉD.PHYSIQUE & SPORT.(M. C)']);
  imp('2025-12-10', ['ANGLAIS(Mme A)', 'ANGLAIS LV2(Mme D)', 'MATHÉMATIQUES(M. E, Mme F)', 'ÉD.PHYSIQUE & SPORT.(M. C)', 'PHYSIQUE-CHIMIE(M. G)',
    'SCIENCES VIE & TERRE(Mme H)', 'SVT BILINGUE(Mme I)', 'HISTOIRE-GEOGRAPHIE EMC(M. J)', 'ALLEMAND(M. K)', 'LANGU.CULT EU ALLEM(M. K)']);`;
const mid = nom => ev(`_moyMatieresSorted().find(m => m.nom === ${JSON.stringify(nom)}).id`);

test('Catalogue des disciplines : les onze d\'office, réglages gardés, une d\'office supprimée revient', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_disciplinesAll().map(d => d.nom)`), ['Anglais', 'Arts plastiques', 'Éducation musicale',
    'Éducation physique et sportive', 'Enseignement des religions', 'Français', 'Histoire-géographie', 'Mathématiques',
    'Physique-chimie', 'Sciences de la vie et de la Terre', 'Technologie']);
  ev(`disciplineSet('maths', { nom: 'Maths', actif: false }); delete S.disciplines.svt; const d = disciplineAdd('Allemand'); window.__did = d.id; _disciplinesSeed()`);
  assert.strictEqual(ev(`S.disciplines.maths.nom`), 'Maths', 'un nom changé survit au semis');
  assert.strictEqual(ev(`S.disciplines.maths.actif`), false);
  assert.ok(ev(`!!S.disciplines.svt`), 'une discipline d\'office absente revient');
  assert.strictEqual(ev(`S.disciplines[window.__did].nom`), 'Allemand');
  assert.strictEqual(ev(`disciplineAdd('allemand')`), null, 'pas de doublon (casse ignorée)');
  assert.strictEqual(ev(`disciplineRemove('maths')`), false, 'une discipline d\'office ne se supprime pas');
  assert.strictEqual(ev(`_discOngletSur('Hist/géo : [5e]*')`), 'Hist-géo - -5e-');
  assert.ok(ev(`_discOngletSur('x'.repeat(50)).length`) <= 31);
});

test('Matières du bureau numérique → disciplines : reconnues, à rattacher, ou rattachées à la main', () => {
  ev(FIXTURE);
  const disc = nom => ev(`_matiereDisc(${JSON.stringify(mid(nom))})`);
  assert.strictEqual(disc('ANGLAIS'), 'anglais');
  assert.strictEqual(disc('ANGLAIS LV2'), 'anglais');
  assert.strictEqual(disc('MATHÉMATIQUES'), 'maths');
  assert.strictEqual(disc('ÉD.PHYSIQUE & SPORT.'), 'eps');
  assert.strictEqual(disc('PHYSIQUE-CHIMIE'), 'physique_chimie', '⚠️ pas l\'EPS : « PHYSIQUE » seul ne suffit pas');
  assert.strictEqual(disc('SCIENCES VIE & TERRE'), 'svt');
  assert.strictEqual(disc('SVT BILINGUE'), 'svt');
  assert.strictEqual(disc('HISTOIRE-GEOGRAPHIE EMC'), 'histoire_geo');
  // Rien n'est deviné pour ce qu'aucune discipline d'office ne couvre : on demande.
  assert.strictEqual(disc('ALLEMAND'), null);
  assert.deepStrictEqual(evObj(`_avisMatieresARattacher('5C').map(m => m.nom)`), ['ALLEMAND', 'LANGU.CULT EU ALLEM']);
  // Une discipline « Allemand » ajoutée reconnaît la matière de même nom ; l'autre se rattache à la main.
  ev(`window.__all = disciplineAdd('Allemand').id; matiereSetDisc(${JSON.stringify(mid('LANGU.CULT EU ALLEM'))}, window.__all)`);
  assert.strictEqual(disc('ALLEMAND'), ev(`window.__all`));
  assert.strictEqual(disc('LANGU.CULT EU ALLEM'), ev(`window.__all`));
  assert.deepStrictEqual(evObj(`_avisMatieresARattacher('5C')`), []);
  // Ignorer, puis revenir à l'automatique.
  ev(`matiereSetDisc(${JSON.stringify(mid('SVT BILINGUE'))}, '')`);
  assert.strictEqual(disc('SVT BILINGUE'), '');
  ev(`matiereSetDisc(${JSON.stringify(mid('SVT BILINGUE'))}, 'auto')`);
  assert.strictEqual(disc('SVT BILINGUE'), 'svt');
  assert.strictEqual(ev(`matiereSetDisc(${JSON.stringify(mid('SVT BILINGUE'))}, 'inconnue')`), false);
  // Supprimer la discipline ajoutée : ses matières repassent « à rattacher ».
  ev(`disciplineRemove(window.__all)`);
  assert.strictEqual(disc('LANGU.CULT EU ALLEM'), null);
});

test('Professeurs d\'une discipline : ceux du DERNIER import, toutes ses matières, sans doublon', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_discProfs('5C', 'anglais')`), 'Mme A, Mme D', 'LV1 et LV2 réunies');
  assert.strictEqual(ev(`_discProfs('5C', 'maths')`), 'M. E, Mme F', 'le dernier import remplace le premier');
  assert.strictEqual(ev(`_discProfs('5C', 'eps')`), 'M. C');
  assert.strictEqual(ev(`_discProfs('5C', 'religions')`), '', 'aucune matière : professeur inconnu');
});

test('La feuille préparée : un onglet par discipline, les élèves PRÉSENTS de la période, par ordre alphabétique', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais', 'religions'], lien: 'javascript:alert(1)' })`);
  const c = evObj(`window.__c`);
  assert.strictEqual(c.cible, '2026-01-31', 'S1 : la fin de la période');
  assert.strictEqual(c.lien, '', 'un lien qui n\'est pas https est refusé');
  assert.deepStrictEqual(c.disciplines.map(d => d.onglet), ['Maths', 'Anglais', 'Religions']);
  const f = evObj(`_avisFeuilles(getCls(), window.__c)`);
  assert.strictEqual(f.length, 3);
  assert.strictEqual(f[0].name, 'Maths');
  assert.strictEqual(f[0].rows[0][0].text, 'Mathématiques — M. E, Mme F');
  assert.deepStrictEqual(f[0].rows[2].map(x => x.text), ['Élève', 'Investissement', 'Comportement', 'Implication']);
  // S1 : PETIT est parti le 15/09 (après le 1er août, donc présent au S1) ; ARRIVE arrive en mars → pas au S1.
  assert.deepStrictEqual(f[0].rows.slice(3).map(r => r[0].text), ['<b>BOLD</b> Zoé', 'DURAND Léa', 'MARTIN Noé', 'PETIT Inès']);
  const s2 = evObj(`_avisFeuilles(getCls(), avisCampagneCreer(getCls(), { pIdx: 1, disciplines: ['maths'] }))`);
  assert.deepStrictEqual(s2[0].rows.slice(3).map(r => r[0].text), ['<b>BOLD</b> Zoé', 'ARRIVE Tard', 'DURAND Léa', 'MARTIN Noé']);
  assert.strictEqual(ev(`avisCampagneCreer(getCls(), { pIdx: 0, disciplines: [] })`), null, 'sans discipline, pas de feuille');
});

test('Lecture : par nom d\'onglet et d\'en-tête, élèves par leur nom — rien n\'est deviné', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais', 'svt'] })`);
  // Ce qu'auraient écrit les collègues : en maths, colonnes DÉPLACÉES et un élève au nom
  // retouché ; en anglais, l'onglet RENOMMÉ (reconnu par son titre) et un nom écrit
  // « Prénom NOM » ; un onglet ajouté par erreur ; la SVT n'a rien écrit.
  const lec = evObj(`(() => {
    const f = _avisFeuilles(getCls(), window.__c).map(sh => ({ name: sh.name, rows: sh.rows.map(r => r.map(c => c.text)) }));
    const m = f[0]; m.rows[2] = ['Élève', 'Implication', 'Investissement', 'Comportement'];
    m.rows[4][1] = 'Très impliquée'; m.rows[4][2] = 'Sérieuse.\\nRégulière.';
    m.rows.push(['DURANT Léo', 'Bavard', '', '']);
    const a = f[1]; a.name = 'Feuille2'; a.rows[5] = ['Noé Martin', '', 'Agité', ''];
    f.push({ name: 'Brouillon', rows: [['notes perso']] });
    return _avisLire(getCls(), window.__c, f);
  })()`);
  assert.deepStrictEqual(lec.avis.s1, { maths: { implication: 'Très impliquée', investissement: 'Sérieuse.\nRégulière.' } });
  assert.deepStrictEqual(lec.avis.s2, { anglais: { comportement: 'Agité' } });
  assert.deepStrictEqual(lec.lus.sort(), ['anglais', 'maths', 'svt']);
  assert.deepStrictEqual(lec.inconnus, ['Brouillon']);
  assert.deepStrictEqual(lec.nonReconnus, [{ onglet: 'Maths', nom: 'DURANT Léo' }]);
  // Deux homonymes parfaits : la ligne est rapportée, jamais rangée au hasard.
  ev(`S.eleves.s9 = { id:'s9', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] }; getCls().eleves.push('s9')`);
  const h = evObj(`_avisLire(getCls(), window.__c, [{ name: 'Maths', rows: [['Élève', 'Investissement'], ['DURAND Léa', 'x']] }])`);
  assert.deepStrictEqual(h.avis, {});
  assert.strictEqual(h.nonReconnus.length, 1);
});

test('Relecture : un onglet lu fait foi, un onglet ABSENT garde ses avis', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] });
      window.__c.avis = { s1: { maths: { investissement: 'Ancien' }, anglais: { comportement: 'Gardé' } }, s2: { maths: { implication: 'Effacé' } } };`);
  const f = evObj(`_avisFusion(window.__c, { avis: { s1: { maths: { investissement: 'Nouveau' } } }, lus: ['maths'] })`);
  assert.deepStrictEqual(f.avis, { s1: { maths: { investissement: 'Nouveau' }, anglais: { comportement: 'Gardé' } } });
  assert.strictEqual(f.change, true);
  assert.strictEqual(evObj(`_avisFusion(window.__c, { avis: {}, lus: [] })`).change, false, 'un fichier vide ne change rien');
});

test('.ods : aller-retour par le vrai format, et lecture d\'un fichier enregistré par LibreOffice', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'eps'] });
      window.__c.avis = { s1: { maths: { investissement: 'Sérieuse & « régulière »\\n<script>' } }, s5: { eps: { comportement: '  deux  espaces  ' } } };`);
  const back = evObj(await ev(`(async () => {
    const sheets = await _odsRead(_odsBuild(_avisFeuilles(getCls(), window.__c)));
    return _avisLire(getCls(), window.__c, sheets);
  })()`));
  assert.deepStrictEqual(back.avis, { s1: { maths: { investissement: 'Sérieuse & « régulière »\n<script>' } }, s5: { eps: { comportement: 'deux  espaces' } } });
  assert.deepStrictEqual(back.lus, ['maths', 'eps']);
  // Un fichier passé par LibreOffice (deflate, répétitions de cases vides, ses propres styles).
  const u8 = [...fs.readFileSync(path.join(__dirname, 'fixtures', 'avis-libreoffice.ods'))];
  const lo = evObj(await ev(`_odsRead(new Uint8Array(${JSON.stringify(u8)}))`));
  assert.deepStrictEqual(lo.map(s => s.name), ['Maths', 'SVT']);
  assert.deepStrictEqual(lo[0].rows[3], ['DURAND Léa', 'Sérieuse & régulière.\nParticipe <souvent>.', '', 'Très impliquée']);
  assert.deepStrictEqual(lo[1].rows[1], ['PETIT Inès', '', '', 'Discrète']);
  // Ce qui n'est pas un .ods est refusé par une Error, jamais par autre chose.
  for (const bad of ['[1,2,3]', 'new Uint8Array(0)', 'new Uint8Array([80,75,3,4,0,0])']) {
    await assert.rejects(ev(`_odsRead(${bad})`), e => e && typeof e.message === 'string' && /illisible|archive/i.test(e.message));
  }
});

test('Les avis d\'un élève pour une période, et sur la synthèse de période (échappés)', () => {
  ev(FIXTURE);
  ev(`const c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] });
      c.avis = { s5: { anglais: { investissement: '<img src=x onerror=alert(1)>' }, maths: { comportement: 'Calme' } } };`);
  const a = evObj(`_avisEleve(getCls(), 's5', 0)`);
  assert.deepStrictEqual(a.items.map(x => x.disc.id), ['maths', 'anglais'], 'dans l\'ordre des onglets');
  assert.strictEqual(ev(`_avisEleve(getCls(), 's5', 1)`), null, 'rien au S2');
  const t = evObj(`_periodePrintHTML(getCls(), 0, { blocs: ['avis'], type: 'conseil', forme: 'tableau' })`).html;
  assert.match(t, /Avis des collègues/);
  assert.ok(!t.includes('<img src=x'), 'avis échappé');
  assert.match(t, /&lt;img src=x/);
  assert.ok(!t.includes('<b>BOLD</b>'));
  const fi = evObj(`_periodePrintHTML(getCls(), 0, { blocs: ['avis'], type: 'conseil', forme: 'fiches' })`).html;
  assert.match(fi, /Collègues/);
  assert.match(fi, /<strong>Mathématiques<\/strong> — <em>comport\.<\/em> Calme/);
  // Décoché par défaut : la feuille ne s'allonge pas sans qu'on le demande.
  assert.ok(!ev(`_periodePrintOpts.blocs.includes('avis')`));
});

test('Import JSON : la section avis passe la liste blanche, une clé piégée est refusée', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_validateImport({ avis: { '5C': { av_1: {} } }, disciplines: { maths: {} } })`), null);
  assert.match(String(ev(`_validateImport({ avis: { '5C': { 'pas bien !': {} } } })`)), /Clé invalide/);
  // Une campagne abîmée est réparée au chargement, pas rejetée.
  ev(`S.avis = { '5C': { av_1: { id: 'av_1', disciplines: 'x', avis: { s1: 'y', s2: { maths: 3 } } } } }; _sanitizeCoreSections()`);
  assert.deepStrictEqual(evObj(`S.avis['5C'].av_1.disciplines`), []);
  assert.deepStrictEqual(evObj(`S.avis['5C'].av_1.avis`), { s2: {} });
});

test('Démo : une feuille du S1 déjà relue, et une matière que l\'app demande où ranger', () => {
  ev(`S = _emptyState(); createDemo({ force: true }); postLoadHook();`);
  const cid = ev(`S.cur`);
  const c = evObj(`_avisCampagnes(S.cur)[0]`);
  assert.ok(c, 'une feuille d\'avis dans la démo');
  assert.ok(ev(`_avisCompte(_avisCampagnes(S.cur)[0]).n`) >= 10);
  assert.strictEqual(ev(`_avisPeriode(getCls(), _avisCampagnes(S.cur)[0]).label`), 'S1');
  assert.deepStrictEqual(evObj(`_avisMatieresARattacher(S.cur).map(m => m.nom)`), ['ESPAGNOL LV2']);
  assert.ok(cid);
});

test('Revue avant / après : chaque case qui change, et rien n\'est repris sans être coché', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] });
      window.__c.avis = { s1: { maths: { investissement: 'Ancien', comportement: 'Calme' }, anglais: { implication: 'Gardé' } } };`);
  // La feuille : un avis modifié, un effacé (accident ?), un nouveau ; l'onglet Anglais ABSENT.
  const lec = { avis: { s1: { maths: { investissement: 'Nouveau' } }, s2: { maths: { implication: 'Très bien' } } }, lus: ['maths'] };
  ev(`window.__lec = ${JSON.stringify(lec)}`);
  const ch = evObj(`_avisChangements(getCls(), window.__c, window.__lec)`);
  assert.deepStrictEqual(ch.map(c => [c.sid, c.did, c.key, c.type]), [
    ['s1', 'maths', 'investissement', 'modif'], ['s1', 'maths', 'comportement', 'suppr'], ['s2', 'maths', 'implication', 'ajout']]);
  assert.ok(!ch.some(c => c.did === 'anglais'), 'un onglet absent du fichier ne propose aucun effacement');
  // Cochés d'office : modifications et ajouts, jamais un effacement ; rien pour une nouvelle feuille.
  assert.deepStrictEqual(evObj(`_avisCochesDefaut('relire', _avisChangements(getCls(), window.__c, window.__lec))`), [0, 2]);
  assert.deepStrictEqual(evObj(`_avisCochesDefaut('nouvelle', _avisChangements(getCls(), window.__c, window.__lec))`), []);
  // Appliquer seulement l'ajout : l'avis effacé par accident reste, la modification n'est pas prise.
  const av = evObj(`_avisAvecChoix(window.__c, _avisChangements(getCls(), window.__c, window.__lec), [2])`);
  assert.deepStrictEqual(av, { s1: { maths: { investissement: 'Ancien', comportement: 'Calme' }, anglais: { implication: 'Gardé' } }, s2: { maths: { implication: 'Très bien' } } });
  // La campagne elle-même n'est pas touchée par le calcul.
  assert.strictEqual(ev(`window.__c.avis.s2`), undefined);
});

test('Professeur tapé à la main : passe avant les moyennes, vidé il redevient automatique', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_discProfs('5C', 'religions')`), '');
  ev(`disciplineSet('religions', { profs: '  Mme K  ' }); disciplineSet('maths', { profs: 'M. Z' })`);
  assert.strictEqual(ev(`_discProfs('5C', 'religions')`), 'Mme K');
  assert.strictEqual(ev(`_discProfs('5C', 'maths')`), 'M. Z', 'le nom tapé passe avant celui des moyennes');
  assert.strictEqual(ev(`_discProfsAuto('5C', 'maths')`), 'M. E, Mme F');
  const c = evObj(`avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['religions'] })`);
  assert.strictEqual(c.disciplines[0].profs, 'Mme K', 'en tête de l\'onglet');
  ev(`disciplineSet('maths', { profs: '' })`);
  assert.strictEqual(ev(`_discProfs('5C', 'maths')`), 'M. E, Mme F');
  assert.strictEqual(ev(`'profs' in S.disciplines.maths`), false);
  ev(`S.disciplines.anglais.profs = 42; _disciplinesSeed()`);
  assert.strictEqual(ev(`'profs' in S.disciplines.anglais`), false, 'une valeur abîmée est écartée au chargement');
});
