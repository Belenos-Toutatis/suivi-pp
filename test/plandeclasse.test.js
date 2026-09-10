// Import depuis un export JSON de Plan de classe — lecture seule, liste blanche,
// choix de la classe, ids d'élèves conservés.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Un export réaliste : deux divisions + une classe recomposée virtuelle, des champs
// internes partout (salles, oublis, history) que l'import doit IGNORER.
const PDC = `{
  classes: {
    '6A': { id:'6A', nom:'6e A', année: 2025, eleves:['e_1','e_2'], rooms:{ s1:{} }, activeRoom:'s1' },
    '5C': { id:'5C', nom:'5e C', année: 2025, eleves:['e_3'] },
    'VC': { id:'VC', nom:'DNL', virtual:true, fromTag:'tag_2', eleves:['e_1'] },
  },
  eleves: {
    e_1: { id:'e_1', nom:'VINCENT', prenom:'Mathis', classe_id:'6A', oublis:8, history:[{ts:1}], groupe:1, civilite:'M',
           ppre:true, pap:false, tags:['tag_1','tag_2'], arrivalDate:null, departureDate:null, notes:'note de plan' },
    e_2: { id:'e_2', nom:'DURAND', prenom:'Léa', classe_id:'6A', groupe:2, civilite:'F', ulis_incl:true, tags:['tag_9'], arrivalDate:'2025-11-03' },
    e_3: { id:'e_3', nom:'PETIT', prenom:'Inès', classe_id:'5C', groupe:null, civilite:null, tags:[] },
  },
  tags: { tag_1: { id:'tag_1', abbr:'DF', name:'Devoirs faits', color:'#16a085' },
          tag_2: { id:'tag_2', abbr:'DNL', name:'DNL', color:'#c0392b' } },
  salles: { s1: { nom:'Salle 12' } }, evaluations: { ev1: {} }, cur: '6A',
}`;
const RESET = `S = _emptyState(); postLoadHook();`;

test('_pdcAnalyze liste les divisions, ignore les classes virtuelles, convertit l\'année', () => {
  ev(RESET);
  const r = evObj(`_pdcAnalyze(${PDC})`);
  assert.strictEqual(r.error, undefined);
  assert.deepStrictEqual(r.classes.map(c => c.id), ['5C', '6A']);          // VC absente, tri par nom
  const a = r.classes.find(c => c.id === '6A');
  assert.deepStrictEqual({ nom: a.nom, annee: a.annee, nb: a.nb, deja: a.deja, nbKnown: a.nbKnown, nbNew: a.nbNew },
    { nom: '6e A', annee: '2025-26', nb: 2, deja: false, nbKnown: 0, nbNew: 2 });
});

test('_pdcAnalyze refuse ce qui n\'est pas un export de Plan de classe', () => {
  assert.match(evObj(`_pdcAnalyze([])`).error, /Plan de classe/);
  assert.match(evObj(`_pdcAnalyze({ releves: {} })`).error, /absentes/);
  assert.match(evObj(`_pdcAnalyze(JSON.parse('{"classes":{"__proto__":{}},"eleves":{}}'))`).error, /interdite/);
});

test('_pdcImport ne reprend QUE les classes choisies, par liste blanche, ids conservés', () => {
  ev(RESET);
  const r = evObj(`(() => {
    const st = _pdcImport(${PDC}, ['6A']);
    return { st, classes: Object.keys(S.classes), eleves: Object.keys(S.eleves), e1: S.eleves.e_1, tags: Object.values(S.tags).map(t => t.abbr) };
  })()`);
  assert.deepStrictEqual(r.st, { classes: 1, eleves: 2, maj: 0, tags: 2, salles: 0, places: 0, patterns: 0 });
  assert.deepStrictEqual(r.classes, ['6A']);                                 // pas 5C, pas VC
  assert.deepStrictEqual(r.eleves.sort(), ['e_1', 'e_2']);                   // ids d'origine
  // Liste blanche : les champs internes de Plan de classe ne passent pas.
  assert.strictEqual(r.e1.oublis, undefined);
  assert.strictEqual(r.e1.history, undefined);
  assert.strictEqual(r.e1.notes, undefined);
  assert.strictEqual(r.e1.ppre, true);
  assert.strictEqual(r.e1.pap, false);
  assert.strictEqual(r.e1.groupe, 1);
  assert.deepStrictEqual(r.tags.sort(), ['DF', 'DNL']);
  assert.strictEqual(r.e1.tags.length, 2);
  assert.strictEqual(ev(`S.classes['6A'].annee`), '2025-26');
});

test('_pdcImport laisse tomber un tag inconnu du catalogue source sans planter', () => {
  ev(RESET);
  ev(`_pdcImport(${PDC}, ['6A'])`);
  assert.deepStrictEqual([...ev(`S.eleves.e_2.tags`)], []);                 // tag_9 n'existe pas dans d.tags
  assert.deepStrictEqual([...ev(`_auditState()`)], []);
});

test('réimporter reconnaît les élèves par id ET par nom+prénom, sans doublon, remarque intacte', () => {
  ev(RESET);
  ev(`_pdcImport(${PDC}, ['6A']); S.eleves.e_1.remarque = 'Appel à la mère le 11/10';`);
  // Un élève saisi à la main AVANT l'import, avec un autre id, même identité (accents/casse différents).
  ev(`S.eleves.x9 = { id:'x9', nom:'Petit', prenom:'ines', classe_id:'5C', tags:[] }; _createClassBare('5C','5C'); S.classes['5C'].eleves.push('x9');`);
  const a = evObj(`_pdcAnalyze(${PDC}).classes.map(c => [c.id, c.nbKnown, c.nbNew])`);
  assert.deepStrictEqual(a, [['5C', 1, 0], ['6A', 2, 0]]);
  const r = evObj(`(() => { const st = _pdcImport(${PDC}, ['6A','5C']);
    return { st, n: Object.keys(S.eleves).length, rem: S.eleves.e_1.remarque, roster5C: S.classes['5C'].eleves, nom: S.eleves.x9.nom }; })()`);
  assert.deepStrictEqual(r.st, { classes: 0, eleves: 0, maj: 3, tags: 0, salles: 0, places: 0, patterns: 0 });
  assert.strictEqual(r.n, 3);                                                // aucun doublon
  assert.strictEqual(r.rem, 'Appel à la mère le 11/10');                     // la remarque n'existe qu'ici : conservée
  assert.deepStrictEqual(r.roster5C, ['x9']);                                // reconnu par nom+prénom, id local gardé
  assert.strictEqual(r.nom, 'PETIT');                                        // identité mise à jour depuis la source
});

test('un tag de même abréviation déjà catalogué sous un autre id est réutilisé', () => {
  ev(RESET);
  ev(`createTag('DNL', 'Discipline non linguistique', '#000');`);
  const r = evObj(`(() => { const st = _pdcImport(${PDC}, ['6A']); return { st, tags: Object.values(S.tags).map(t => t.abbr).sort(), e1: S.eleves.e_1.tags }; })()`);
  assert.strictEqual(r.st.tags, 1);                                          // seul DF est créé
  assert.deepStrictEqual(r.tags, ['DF', 'DNL']);
  assert.strictEqual(r.e1.length, 2);
});

test('setPref / _codeA : réglages avec valeurs par défaut', () => {
  ev(RESET);
  assert.strictEqual(ev(`_prefs().periodMode`), 'semestre');
  assert.strictEqual(ev(`_codeA()`), 'A');
  ev(`S.prefs.periodMode = 'trimestre'; S.prefs.codeAbsent = 'abs';`);
  assert.strictEqual(ev(`_prefs().periodMode`), 'trimestre');
  assert.strictEqual(ev(`_codeA()`), 'abs');
  ev(`S.prefs.codeAbsent = '   ';`);
  assert.strictEqual(ev(`_codeA()`), 'A');                                   // vide → défaut, jamais une chaîne vide
});

// ─────────────── Places et ordres de ramassage (import) ───────────────
// ⚠️ Ces données rouvrent un point que le périmètre du projet avait fermé (« plans de
// salle : hors périmètre »). On n'en reprend donc QUE l'ordre : ni cases vides, ni
// îlots, ni emplois du temps, ni tablettes. Un champ repris « au cas où » est un champ
// dont personne ne sait plus, six mois après, s'il est à jour.

const PDC_PLACES = `{
  classes: {
    '6A': { id:'6A', nom:'6e A', année: 2025, eleves:['e_1','e_2'], activeRoom:'s2',
            rooms: {
              s1: { seating: { '0,0':'e_1', '1,1':'e_2', '2,2':'e_INCONNU' } },
              s2: { seating: { '3,0':'e_2', '0,4':'e_1' } },
              s9: { seating: { '0,0':'e_1' } },
            } },
  },
  eleves: {
    e_1: { id:'e_1', nom:'VINCENT', prenom:'Mathis', classe_id:'6A', tags:[] },
    e_2: { id:'e_2', nom:'DURAND',  prenom:'Léa',    classe_id:'6A', tags:[] },
  },
  salles: {
    s1: { nom:'Salle 102', rows:4, cols:6, positions_vides:['0,3'], schedule:{lun:[]},
          ilots:{ i1:{ id:'i1', cells:['0,0','0,1'] } },
          collectPatterns: [ { id:'pat_a', nom:'Serpentin', order:['1,1','0,0'] },
                             { id:'pat_vide', nom:'Jamais dessiné', order:[] },
                             { id:'', nom:'Sans id', order:['0,0'] } ] },
    s2: { nom:'Labo', rows:3, cols:5, collectPatterns: [] },
  },
  tags: {}, cur: '6A',
}`;

test('l\'import reprend salles, places et patterns — et rien d\'autre', () => {
  ev(RESET);
  const st = evObj(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  assert.strictEqual(st.salles, 2, 's9 n\'est pas dans le fichier des salles : ignorée');
  assert.strictEqual(st.places, 4, '2 places par salle reprise, le fantôme exclu');
  assert.strictEqual(st.patterns, 1, 'un pattern vide et un pattern sans id ne comptent pas');
  const salle = evObj(`S.salles['pdc_s1']`);
  assert.deepStrictEqual(Object.keys(salle).sort(), ['cols', 'id', 'nom', 'patterns', 'rows']);
  // ⚠️ Ni positions_vides, ni ilots, ni schedule : ils ne servent pas à ordonner.
  assert.strictEqual(salle.nom, 'Salle 102');
  assert.deepStrictEqual(salle.patterns, [{ id: 'pat_a', nom: 'Serpentin', order: ['1,1', '0,0'] }]);
});

test('une place occupée par un élève non repris est écartée', () => {
  // Sinon l'audit signalerait un élève fantôme assis — et le tri par place ferait
  // apparaître en tête une ligne que plus rien ne nomme.
  ev(RESET);
  ev(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  assert.deepStrictEqual(evObj(`S.classes['6A'].rooms['pdc_s1'].seating`), { '0,0': 'e_1', '1,1': 'e_2' });
  assert.deepStrictEqual(evObj(`_auditState()`), []);
});

test('la salle courante suit celle qui était active dans Plan de classe', () => {
  ev(RESET);
  ev(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  assert.strictEqual(ev(`S.classes['6A'].salleCur`), 'pdc_s2');
});

test('les identifiants de salle sont PRÉFIXÉS à l\'import', () => {
  // ⚠️ Plan de classe nomme ses salles 's1', 's2' — des compteurs locaux, sans unicité
  // entre deux fichiers d'origines différentes. Sans préfixe, la « Salle 102 » d'un
  // collègue écraserait la nôtre au premier import croisé.
  ev(RESET);
  ev(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  assert.deepStrictEqual(evObj(`Object.keys(S.salles).sort()`), ['pdc_s1', 'pdc_s2']);
});

test('réimporter mE T À JOUR les places au lieu de les empiler', () => {
  ev(RESET);
  ev(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  // Les deux élèves ont changé de table entre-temps.
  const bouge = PDC_PLACES.replace("'3,0':'e_2', '0,4':'e_1'", "'1,0':'e_2', '1,1':'e_1'");
  ev(`_pdcImport(${bouge}, ['6A'])`);
  assert.deepStrictEqual(evObj(`S.classes['6A'].rooms['pdc_s2'].seating`), { '1,0': 'e_2', '1,1': 'e_1' });
  assert.strictEqual(evObj(`Object.keys(S.classes['6A'].rooms)`).length, 2);
});

test('un fichier sans salles reste importable', () => {
  // La rétrocompatibilité descend dans les deux sens : un export antérieur à cette
  // fonctionnalité n'a ni `rooms` ni `salles`, et il doit s'importer sans broncher.
  ev(RESET);
  const st = evObj(`_pdcImport(${PDC}, ['5C'])`);
  assert.strictEqual(st.salles, 0);
  assert.deepStrictEqual(evObj(`S.classes['5C'].rooms`), {});
  assert.strictEqual(ev(`S.classes['5C'].salleCur`), null);
  assert.deepStrictEqual(evObj(`_auditState()`), []);
});

test('l\'analyse annonce le placement AVANT l\'import', () => {
  // ⚠️ Sans ce repère affiché à l'écran de choix, un export fait dans Plan de classe sans
  // avoir placé personne donne un import qui ne change rien — et on cherche pourquoi
  // pendant dix minutes. Le compte doit donc être lisible avant de valider.
  ev(RESET);
  const r = evObj(`_pdcAnalyze(${PDC_PLACES})`);
  const c = r.classes.find(x => x.id === '6A');
  assert.strictEqual(c.places, 4, 'deux salles reprises × deux places, le fantôme exclu');
  assert.strictEqual(c.patterns, 1);
  // Un fichier sans salles l'annonce par un zéro, pas par un champ absent : l'écran
  // affiche « aucun placement » plutôt que rien du tout.
  const sans = evObj(`_pdcAnalyze(${PDC})`).classes.find(x => x.id === '5C');
  assert.strictEqual(sans.places, 0);
  assert.strictEqual(sans.patterns, 0);
});

test('l\'analyse ne compte que les places des élèves de LA classe', () => {
  // Une place tenue par quelqu'un qui n'est pas dans la division annoncerait un
  // placement plus riche qu'il ne l'est, et l'import en livrerait moins que promis.
  ev(RESET);
  const c = evObj(`_pdcAnalyze(${PDC_PLACES})`).classes.find(x => x.id === '6A');
  const st = evObj(`_pdcImport(${PDC_PLACES}, ['6A'])`);
  assert.strictEqual(c.places, st.places, 'ce qui est annoncé est exactement ce qui est repris');
});
