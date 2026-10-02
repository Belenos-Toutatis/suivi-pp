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

test('Catalogue des disciplines : les douze d\'office, réglages gardés, une d\'office supprimée revient', () => {
  ev(FIXTURE);
  // Rangées par DOMAINE (langues, lettres, sciences, arts, EPS) : l'ordre des onglets.
  assert.deepStrictEqual(evObj(`_disciplinesAll().map(d => d.nom)`), ['Allemand', 'Anglais', 'Français', 'Histoire-géographie',
    'Enseignement des religions', 'Mathématiques', 'Physique-chimie', 'Sciences de la vie et de la Terre', 'Technologie',
    'Arts plastiques', 'Éducation musicale', 'Éducation physique et sportive']);
  ev(`disciplineSet('maths', { nom: 'Maths', actif: false }); delete S.disciplines.svt; const d = disciplineAdd('Latin'); window.__did = d.id; _disciplinesSeed()`);
  assert.strictEqual(ev(`S.disciplines.maths.nom`), 'Maths', 'un nom changé survit au semis');
  assert.strictEqual(ev(`S.disciplines.maths.actif`), false);
  assert.ok(ev(`!!S.disciplines.svt`), 'une discipline d\'office absente revient');
  assert.strictEqual(ev(`S.disciplines[window.__did].nom`), 'Latin');
  assert.strictEqual(ev(`disciplineAdd('latin')`), null, 'pas de doublon (casse ignorée)');
  assert.strictEqual(ev(`disciplineAdd('ALLEMAND')`), null, 'l\'allemand est d\'office');
  // Un « Allemand » créé à la main AVANT qu'il soit d'office : on garde le sien, sans doublon.
  ev(`delete S.disciplines.allemand; S.disciplines.disc_x = { id: 'disc_x', nom: 'Allemand', onglet: 'Allemand', actif: true, ord: 50, builtin: false }; _disciplinesSeed()`);
  assert.strictEqual(ev(`'allemand' in S.disciplines`), false);
  assert.strictEqual(ev(`_disciplinesAll().filter(d => d.nom === 'Allemand').length`), 1);
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
  assert.strictEqual(disc('ALLEMAND'), 'allemand');
  // Rien n'est deviné pour ce qu'aucune discipline d'office ne couvre (la LCE) : on demande.
  assert.deepStrictEqual(evObj(`_avisMatieresARattacher('5C').map(m => m.nom)`), ['LANGU.CULT EU ALLEM']);
  // Une discipline « LCE allemand » ajoutée reconnaît la matière ; on peut aussi rattacher à la main.
  ev(`window.__all = disciplineAdd('LCE allemand').id; matiereSetDisc(${JSON.stringify(mid('LANGU.CULT EU ALLEM'))}, window.__all)`);
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
  assert.deepStrictEqual(c.disciplines.map(d => d.onglet), ['Anglais', 'Religions', 'Maths'], 'dans l\'ordre du catalogue, pas du clic');
  const f = evObj(`_avisFeuilles(getCls(), window.__c)`);
  assert.strictEqual(f.length, 3);
  assert.strictEqual(f[2].name, 'Maths');
  assert.strictEqual(f[2].rows[0][0].text, 'Mathématiques — M. E, Mme F');
  // Une couleur par domaine, une nuance par discipline : l'anglais (2e langue) est plus clair que l'allemand.
  assert.match(f[0].tabColor, /^#[0-9a-f]{6}$/);
  assert.notStrictEqual(ev(`_discCouleur('anglais')`), ev(`_discCouleur('allemand')`));
  assert.strictEqual(ev(`_discCouleur('allemand')`), ev(`DOMAINES.langues.couleur`), 'la première du domaine a la teinte franche');
  assert.deepStrictEqual(f[0].rows[3].map(x => x.text), ['Élève', 'Travail', 'Participation', 'Comportement']);
  // La consigne de chaque colonne, sous l'en-tête.
  assert.deepStrictEqual(f[0].rows[2].map(x => x.text), ['', ...evObj(`AVIS_CRITERES.map(c => c.aide)`)]);
  // S1 : PETIT est parti le 15/09 (après le 1er août, donc présent au S1) ; ARRIVE arrive en mars → pas au S1.
  assert.deepStrictEqual(f[0].rows.slice(4).map(r => r[0].text), ['<b>BOLD</b> Zoé', 'DURAND Léa', 'MARTIN Noé', 'PETIT Inès']);
  const s2 = evObj(`_avisFeuilles(getCls(), avisCampagneCreer(getCls(), { pIdx: 1, disciplines: ['maths'] }))`);
  assert.deepStrictEqual(s2[0].rows.slice(4).map(r => r[0].text), ['<b>BOLD</b> Zoé', 'ARRIVE Tard', 'DURAND Léa', 'MARTIN Noé']);
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
    const m = f.find(x => x.name === 'Maths'); m.rows[3] = ['Élève', 'Implication', 'Investissement', 'Comportement'];   // anciens en-têtes, déplacés
    m.rows[5][1] = 'Très impliquée'; m.rows[5][2] = 'Sérieuse.\\nRégulière.';
    m.rows.push(['DURANT Léo', 'Bavard', '', '']);
    const a = f.find(x => x.name === 'Anglais'); a.name = 'Feuille2'; a.rows[6] = ['Noé Martin', '', '', 'Agité'];
    f.push({ name: 'Brouillon', rows: [['notes perso']] });
    return _avisLire(getCls(), window.__c, f);
  })()`);
  assert.deepStrictEqual(lec.avis.s1, { maths: { participation: 'Très impliquée', travail: 'Sérieuse.\nRégulière.' } });
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
      window.__c.avis = { s1: { maths: { travail: 'Ancien' }, anglais: { comportement: 'Gardé' } }, s2: { maths: { participation: 'Effacé' } } };`);
  const f = evObj(`_avisFusion(window.__c, { avis: { s1: { maths: { travail: 'Nouveau' } } }, lus: ['maths'] })`);
  assert.deepStrictEqual(f.avis, { s1: { maths: { travail: 'Nouveau' }, anglais: { comportement: 'Gardé' } } });
  assert.strictEqual(f.change, true);
  assert.strictEqual(evObj(`_avisFusion(window.__c, { avis: {}, lus: [] })`).change, false, 'un fichier vide ne change rien');
});

test('.ods : aller-retour par le vrai format, et lecture d\'un fichier enregistré par LibreOffice', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'eps'] });
      window.__c.avis = { s1: { maths: { travail: 'Sérieuse & « régulière »\\n<script>' } }, s5: { eps: { comportement: '  deux  espaces  ' } } };`);
  const back = evObj(await ev(`(async () => {
    const sheets = await _odsRead(_odsBuild(_avisFeuilles(getCls(), window.__c)));
    return _avisLire(getCls(), window.__c, sheets);
  })()`));
  assert.deepStrictEqual(back.avis, { s1: { maths: { travail: 'Sérieuse & « régulière »\n<script>' } }, s5: { eps: { comportement: 'deux  espaces' } } });
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
      c.avis = { s5: { anglais: { travail: '<img src=x onerror=alert(1)>' }, maths: { comportement: 'Calme' } } };`);
  const a = evObj(`_avisEleve(getCls(), 's5', 0)`);
  assert.deepStrictEqual(a.items.map(x => x.disc.id), ['anglais', 'maths'], 'dans l\'ordre des onglets');
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
  assert.strictEqual(evObj(`_avisCibles(getCls(), _avisCampagnes(S.cur)[0])`).length, 2, 'deux élèves demandés en particulier');
  assert.match(ev(`_avisMessage(getCls(), _avisCampagnes(S.cur)[0])`), /avant le /);
  assert.ok(cid);
});

test('Revue avant / après : chaque case qui change, et rien n\'est repris sans être coché', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] });
      window.__c.avis = { s1: { maths: { travail: 'Ancien', comportement: 'Calme' }, anglais: { participation: 'Gardé' } } };`);
  // La feuille : un avis modifié, un effacé (accident ?), un nouveau ; l'onglet Anglais ABSENT.
  const lec = { avis: { s1: { maths: { travail: 'Nouveau' } }, s2: { maths: { participation: 'Très bien' } } }, lus: ['maths'] };
  ev(`window.__lec = ${JSON.stringify(lec)}`);
  const ch = evObj(`_avisChangements(getCls(), window.__c, window.__lec)`);
  assert.deepStrictEqual(ch.map(c => [c.sid, c.did, c.key, c.type]), [
    ['s1', 'maths', 'travail', 'modif'], ['s1', 'maths', 'comportement', 'suppr'], ['s2', 'maths', 'participation', 'ajout']]);
  assert.ok(!ch.some(c => c.did === 'anglais'), 'un onglet absent du fichier ne propose aucun effacement');
  // Cochés d'office : modifications et ajouts, jamais un effacement ; rien pour une nouvelle feuille.
  assert.deepStrictEqual(evObj(`_avisCochesDefaut('relire', _avisChangements(getCls(), window.__c, window.__lec))`), [0, 2]);
  assert.deepStrictEqual(evObj(`_avisCochesDefaut('nouvelle', _avisChangements(getCls(), window.__c, window.__lec))`), []);
  // Appliquer seulement l'ajout : l'avis effacé par accident reste, la modification n'est pas prise.
  const av = evObj(`_avisAvecChoix(window.__c, _avisChangements(getCls(), window.__c, window.__lec), [2])`);
  assert.deepStrictEqual(av, { s1: { maths: { travail: 'Ancien', comportement: 'Calme' }, anglais: { participation: 'Gardé' } }, s2: { maths: { participation: 'Très bien' } } });
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

test('Colonnes : les anciens avis (investissement, implication) migrent vers travail et participation', () => {
  ev(FIXTURE);
  ev(`S.avis['5C'] = { av_1: { id: 'av_1', date: '2026-01-10', cible: '2026-01-31', disciplines: [{ id: 'maths', nom: 'Mathématiques', onglet: 'Maths', profs: '' }],
        avis: { s1: { maths: { investissement: 'Sérieuse', implication: 'Participe', comportement: 'Calme' } } } } }; _sanitizeCoreSections()`);
  assert.deepStrictEqual(evObj(`S.avis['5C'].av_1.avis.s1.maths`), { travail: 'Sérieuse', participation: 'Participe', comportement: 'Calme' });
  assert.deepStrictEqual(evObj(`S.avis['5C'].av_1.cibles`), []);
  assert.deepStrictEqual(evObj(`AVIS_CRITERES.map(c => c.label)`), ['Travail', 'Participation', 'Comportement']);
});

test('Élèves demandés en particulier : surlignés dans la feuille, cités dans le message', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'], cibles: ['s2', 's1', 'inconnu'], lien: 'https://nuage.example/s/abc' })`);
  assert.deepStrictEqual(evObj(`window.__c.cibles`), ['s2', 's1'], 'un élève hors de la classe est écarté');
  const f = evObj(`_avisFeuilles(getCls(), window.__c)`)[0];
  const styles = Object.fromEntries(f.rows.slice(4).map(r => [r[0].text, r[0].style]));
  assert.strictEqual(styles['DURAND Léa'], 'vif');
  assert.strictEqual(styles['MARTIN Noé'], 'vif');
  assert.strictEqual(styles['PETIT Inès'], 'nom');
  assert.match(f.rows[1][0].text, /SURLIGNÉS EN JAUNE/);
  const msg = ev(`_avisMessage(getCls(), window.__c)`);
  assert.match(msg, /– DURAND Léa\n– MARTIN Noé/, 'par ordre alphabétique');
  assert.match(msg, /https:\/\/nuage\.example\/s\/abc/);
  assert.match(msg, /Je prépare le conseil de classe du S1 de la 5e C\./);
  // Sans élève en particulier, la partie disparaît du message et du titre de la feuille.
  ev(`avisCiblesSet('5C', window.__c.id, [])`);
  assert.ok(!/surlignés en jaune/.test(ev(`_avisMessage(getCls(), window.__c)`)));
  assert.ok(!/SURLIGNÉS/.test(evObj(`_avisFeuilles(getCls(), window.__c)`)[0].rows[1][0].text));
});

test('Message aux collègues : un moment au choix, des parties à garder ou non, des textes réécrits', () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] })`);
  const m = () => ev(`_avisMessage(getCls(), window.__c)`);
  assert.match(m(), /^Bonjour,\n\nJe prépare le conseil de classe/);
  assert.match(m(), /\[lien de partage de la feuille\]/, 'sans lien, un repère à remplacer');
  assert.match(m(), /– Travail : travail personnel/, 'les colonnes expliquées');
  assert.ok(!/avant le/.test(m()), 'pas d\'échéance, pas de phrase d\'échéance');
  ev(`window.__c.msg = { moment: 'mois', mois: 11, echeance: '2025-11-14', off: ['colonnes'] }`);
  assert.match(m(), /pour le mois de novembre\./);
  assert.match(m(), /avant le vendredi 14 novembre\./);
  assert.ok(!/Trois colonnes/.test(m()), 'une partie écartée n\'est plus dans le message');
  ev(`window.__c.msg = { moment: 'miperiode', off: [] }`);
  assert.match(m(), /Je prépare le conseil de mi-semestre \(S1\) de la 5e C\./);
  // Un texte réécrit sert de modèle ; les repères y sont remplacés.
  ev(`S.prefs.avisMsg = { contexte_miperiode: 'Point de mi-{periode} en {classe}.', fin: 'Bien à vous,' }`);
  assert.match(m(), /Point de mi-S1 en 5e C\./);
  assert.match(m(), /Bien à vous,\n$/);
  assert.strictEqual(ev(`_avisMsgModele('fin', 'conseil')`), 'Bien à vous,');
  assert.strictEqual(ev(`_avisMsgDefaut('fin', 'conseil')`), 'Merci beaucoup,');
  // Un nom d'élève piégé reste du texte : le message n'est jamais du HTML (textarea).
  ev(`avisCiblesSet('5C', window.__c.id, ['s5'])`);
  assert.match(m(), /– <b>BOLD<\/b> Zoé/);
});

test('.ods : quadrillage masqué, le tableau dessiné par ses bordures, consignes encadrées', () => {
  ev(FIXTURE);
  // « Afficher les lignes de la grille » décoché (arbitré par l'utilisateur) : vue ET onglet.
  const set = ev(`_odsSettings([{ name: 'Maths', freeze: { rows: 4, cols: 1 }, tabColor: '#2e8752' }])`);
  assert.ok((set.match(/config:name="ShowGrid" config:type="boolean">false</g) || []).length >= 2, 'au niveau de la vue et de l\'onglet');
  assert.ok(!/ShowGrid" config:type="boolean">true/.test(set));
  const f = evObj(`_avisFeuilles(getCls(), avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }))`)[0];
  assert.ok(f.rows[2].every(c => c.style === 'consigne'), 'la ligne des consignes a des bordures, comme le tableau');
  assert.match(f.rows[1][0].text, /\*\*Nouveau paragraphe dans la même case : Ctrl\+Entrée\.\*\*/, 'rappelé sur chaque onglet, en gras');
  assert.match(f.rows[1][0].text, /« \*\*rien à signaler\*\* »/);
  assert.strictEqual(f.rows[1][0].gras, true);
  // Onglet verrouillé : seules les cases de saisie s'écrivent.
  assert.strictEqual(f.protege, true);
  const xml = ev(`(() => { const u8 = _odsBuild(_avisFeuilles(getCls(), avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] })));
    return new TextDecoder().decode(u8); })()`);
  assert.match(xml, /table:protected="true"/);
  assert.match(xml, /style:name="ce_saisie"[^>]*>[^]*?style:cell-protect="none"/);
  assert.match(xml, /<text:span text:style-name="T1">rien à signaler<\/text:span>/, 'le gras arrive dans le fichier');
  assert.ok(!xml.includes('**'), 'les repères de gras ne s\'écrivent pas');
});

test('Colonne des noms à la largeur du plus long', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_avisLargeurNoms(['DURAND Léa'])`), 4.6, 'jamais sous le minimum');
  const long = ev(`_avisLargeurNoms(['DURAND Léa', 'DE LA FONTAINE-SAINT-MARTIN Marie-Charlotte'])`);
  assert.ok(long > 10, `nom long : ${long} cm`);
  assert.ok(ev(`_avisLargeurNoms(['W'.repeat(80)])`) <= 12, 'plafonnée');
  ev(`S.eleves.s1.nom = 'DE LA FONTAINE-SAINT-MARTIN'; S.eleves.s1.prenom = 'Marie-Charlotte'`);
  const f = evObj(`_avisFeuilles(getCls(), avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] }))`)[0];
  assert.strictEqual(f.colWidthsCm[0], long);
});

test('Objectif de la feuille : conseil, mi-période ou point du mois — dit dans la feuille, et choisi au bilan', () => {
  ev(FIXTURE);
  ev(`window.__a = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'], objectif: 'miperiode' });
      window.__b = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths'] });
      window.__a.avis = { s1: { maths: { travail: 'Avis de mi-semestre' } } };
      window.__b.avis = { s1: { maths: { travail: 'Avis du conseil' } } };`);
  assert.deepStrictEqual(evObj(`_avisObjectif(getCls(), window.__a)`), { key: 'miperiode', court: 'conseil de mi-semestre', long: 'le conseil de mi-semestre (S1)' });
  assert.strictEqual(ev(`_avisObjectif(getCls(), window.__b).long`), 'le conseil de classe du S1', 'conseil par défaut');
  assert.match(evObj(`_avisFeuilles(getCls(), window.__a)`)[0].rows[1][0].text, /avis pour le conseil de mi-semestre \(S1\)/);
  // En trimestres, on dit « mi-trimestre ».
  ev(`S.prefs.periodMode = 'trimestre'`);
  assert.strictEqual(ev(`_avisObjectif(getCls(), window.__a).court`), 'conseil de mi-trimestre');
  ev(`S.prefs.periodMode = 'semestre'`);
  // Le bilan de mi-période lit la feuille de mi-période, le conseil celle du conseil.
  ev(`window.__a.date = '2026-01-05'; window.__b.date = '2025-11-10'`);
  assert.strictEqual(ev(`_avisEleve(getCls(), 's1', 0, 'miperiode').items[0].travail`), 'Avis de mi-semestre');
  assert.strictEqual(ev(`_avisEleve(getCls(), 's1', 0, 'conseil').items[0].travail`), 'Avis du conseil');
  assert.strictEqual(ev(`_avisEleve(getCls(), 's1', 0).items[0].travail`), 'Avis de mi-semestre', 'sans préférence : la plus récente');
  // Point du mois.
  ev(`window.__a.msg = { moment: 'mois', mois: 11 }`);
  assert.strictEqual(ev(`_avisObjectif(getCls(), window.__a).long`), 'le point de novembre');
});
