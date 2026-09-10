// Import d'élèves — module repris de « plan de classe.html ». Les tests portent sur
// les fonctions PURES (détection, normalisation, analyse complète), qui sont celles où
// une régression passe inaperçue : l'aperçu de la modale a l'air juste tant qu'on ne
// vérifie pas ce qu'il a compris.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
// État de départ commun : une classe 5C existante, aucun élève.
const RESET = `S = { version:1, clock:{}, classes:{ '5C': { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0 } },
  eleves:{}, releves:{}, documents:{}, elections:{}, tags:{}, prefs:{}, cur:'5C' };`;

// ─────────────────────────────────────────────── Découpage et détection

test('_impSplitLine respecte les guillemets et les guillemets doublés', () => {
  assert.deepStrictEqual([...ev(`_impSplitLine('DUPONT;"Martin, dit Tintin";5C', ';')`)],
    ['DUPONT', 'Martin, dit Tintin', '5C']);
  assert.deepStrictEqual([...ev(`_impSplitLine('a;"il dit ""oui""";b', ';')`)],
    ['a', 'il dit "oui"', 'b']);
});

test('_impDetect choisit le séparateur et reconnaît un en-tête', () => {
  const r = evObj(`_impDetect('Nom;Prénom;Classe\\nDUPONT;Martin;5C\\nMARTIN;Sophie;5C')`);
  assert.strictEqual(r.mode, 'table');
  assert.strictEqual(r.sep, ';');
  assert.strictEqual(r.header, true);
  // La tabulation est prioritaire sur le point-virgule.
  assert.strictEqual(evObj(`_impDetect('Nom\\tPrénom\\nA\\tB')`).sep, '\t');
  // Aucun séparateur régulier → texte libre.
  assert.strictEqual(evObj(`_impDetect('DUPONT Martin 1\\nMARTIN Sophie 2')`).mode, 'text');
});

test('_impDetect ne prend pas une 1re ligne d\'élèves pour un en-tête', () => {
  const r = evObj(`_impDetect('DUPONT;Martin;5C\\nMARTIN;Sophie;5C')`);
  assert.strictEqual(r.header, false);
});

// ─────────────────────────────────────────────── Normalisation des valeurs

test('_impNormGroupe accepte toutes les écritures de groupe', () => {
  for (const v of ['1', 'G1', 'g1', 'GP1', 'Gr1', 'Grp1', 'Groupe 1', 'groupe1']) {
    assert.strictEqual(ev(`_impNormGroupe(${JSON.stringify(v)})`), 1, v);
  }
  assert.strictEqual(ev(`_impNormGroupe('4')`), null);
  assert.strictEqual(ev(`_impNormGroupe('LATIN')`), null);
});

test('_impNormCiv comprend les écritures de tableur et le code INSEE', () => {
  for (const v of ['M', 'M.', 'Mr', 'Masculin', 'Garçon', 'G', '1', '(M.)']) {
    assert.strictEqual(ev(`_impNormCiv(${JSON.stringify(v)})`), 'M', v);
  }
  for (const v of ['F', 'Mme', 'Féminin', 'Fille', '2', '(Mme)']) {
    assert.strictEqual(ev(`_impNormCiv(${JSON.stringify(v)})`), 'F', v);
  }
  assert.strictEqual(ev(`_impNormCiv('autre')`), null);
});

test('_impNormDate accepte AAAA-MM-JJ et JJ/MM/AAAA, refuse le reste', () => {
  assert.strictEqual(ev(`_impNormDate('2025-09-12')`), '2025-09-12');
  assert.strictEqual(ev(`_impNormDate('5/9/2025')`), '2025-09-05');
  assert.strictEqual(ev(`_impNormDate('12.09.2025')`), '2025-09-12');
  assert.strictEqual(ev(`_impNormDate('septembre')`), null);
});

test('_impNormAmen : le « + » est séparateur ET marqueur d\'inclusion', () => {
  // ⚠️ Le piège du module : sans protection, « ULIS+ » est coupé sur le « + » et
  // retombe sur ULIS hors inclusion.
  assert.deepStrictEqual(evObj(`_impNormAmen('ULIS+')`), { ulis_incl: true });
  assert.deepStrictEqual(evObj(`_impNormAmen('PAP + PAI')`), { pap: true, pai: true });
  assert.deepStrictEqual(evObj(`_impNormAmen('ULIS+ / PAI')`), { ulis_incl: true, pai: true });
  assert.deepStrictEqual(evObj(`_impNormAmen('PPS,PAI')`), { gevasco: true, pai: true });
});

test('_impNormAmen reconnaît le tiers-temps sous ses graphies, et le suffixe -A', () => {
  for (const v of ['tiers-temps', 'TIERS TEMPS', '1/3 temps', '+⅓', 'temps majoré', 'TT']) {
    assert.strictEqual(evObj(`_impNormAmen(${JSON.stringify(v)})`).tiers_temps, true, v);
  }
  // La forme collée que l'app affiche elle-même : « PAP-A » = PAP + agrandissement.
  assert.deepStrictEqual(evObj(`_impNormAmen('PAP-A')`), { agrandissement: true, pap: true });
});

// ─────────────────────────────────────────────── Codes de groupes Pronote

test('_impStripClassPrefix retire un id de classe connu, puis un motif générique', () => {
  ev(RESET);
  assert.strictEqual(ev(`_impStripClassPrefix('5C-LATIN')`), 'LATIN');
  assert.strictEqual(ev(`_impStripClassPrefix('3ABC-CATHO')`), 'CATHO');   // classe inconnue, motif générique
  assert.strictEqual(ev(`_impStripClassPrefix('LATIN')`), 'LATIN');        // pas de préfixe
  // Un code qui SERAIT entièrement mangé par le motif reste intact.
  assert.strictEqual(ev(`_impStripClassPrefix('5C-')`), '5C-');
});

test('_impDefaultCodeInterp : GPn fait le groupe, le reste une option abrégée', () => {
  assert.deepStrictEqual(evObj(`_impDefaultCodeInterp('GP2')`), { kind: 'grp', n: 2 });
  assert.deepStrictEqual(evObj(`_impDefaultCodeInterp('G3')`), { kind: 'grp', n: 3 });
  // « BIL-LCE » → « BIL » : on garde le 1er segment, pas le code entier.
  assert.deepStrictEqual(evObj(`_impDefaultCodeInterp('BIL-LCE')`), { kind: 'tag', abbrs: ['BIL'] });
  assert.deepStrictEqual(evObj(`_impDefaultCodeInterp('LATIN')`), { kind: 'tag', abbrs: ['LATIN'] });
});

test('_impParseAbbrs : un code peut donner plusieurs options', () => {
  assert.deepStrictEqual([...ev(`_impParseAbbrs('BIL LCE')`)], ['BIL', 'LCE']);
  assert.deepStrictEqual([...ev(`_impParseAbbrs('bil, lce+dnl')`)], ['BIL', 'LCE', 'DNL']);
  assert.deepStrictEqual([...ev(`_impParseAbbrs('   ')`)], []);
});

// ─────────────────────────────────────────────── Noms

test('_impSplitFullName tranche sur les majuscules, quel que soit l\'ordre', () => {
  assert.deepStrictEqual(evObj(`_impSplitFullName('DUPONT Marie', 'np')`), { nom: 'DUPONT', prenom: 'Marie' });
  assert.deepStrictEqual(evObj(`_impSplitFullName('Marie DUPONT', 'np')`), { nom: 'DUPONT', prenom: 'Marie' });
  assert.deepStrictEqual(evObj(`_impSplitFullName('DE LA TOUR Jean', 'np')`), { nom: 'DE LA TOUR', prenom: 'Jean' });
  // Sans majuscules pour trancher : on suit l'ordre annoncé par la colonne.
  assert.deepStrictEqual(evObj(`_impSplitFullName('Dupont Marie', 'np')`), { nom: 'Dupont', prenom: 'Marie' });
  assert.deepStrictEqual(evObj(`_impSplitFullName('Dupont Marie', 'pn')`), { prenom: 'Dupont', nom: 'Marie' });
});

test('parseStudentLine lit une ligne de texte libre', () => {
  ev(RESET);
  const r = evObj(`parseStudentLine('M. DURAND Lucas G1 [LATIN]')`);
  assert.strictEqual(r.nom, 'DURAND');
  assert.strictEqual(r.prenom, 'Lucas');
  assert.strictEqual(r.groupe, 1);
  assert.strictEqual(r.civilite, 'M');
  assert.deepStrictEqual([...r.tagAbbrs], ['LATIN']);
  // Id de classe reconnu, civilité entre parenthèses acceptée n'importe où.
  const r2 = evObj(`parseStudentLine('LEROY Antoine (Mme) 5C')`);
  assert.strictEqual(r2.classeId, '5C');
  assert.strictEqual(r2.civilite, 'F');
  // Une ligne sans prénom n'est pas exploitable.
  assert.strictEqual(ev(`parseStudentLine('DUPONT')`), null);
});

// ─────────────────────────────────────────────── Analyse complète

test('_impAnalyze reconnaît les colonnes par leur titre et remplit les fiches', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom;Classe;Sexe;Aménagements\\nDUPONT;Martin;5C;M;PPRE\\nMARTIN;Sophie;5C;F;ULIS+', { defaultClassId: '5C' })`);
  assert.deepStrictEqual([...r.mapping], ['nom', 'prenom', 'classe', 'civilite', 'amen']);
  assert.strictEqual(r.records.length, 2);
  assert.strictEqual(r.records[0].nom, 'DUPONT');
  assert.strictEqual(r.records[0].civilite, 'M');
  assert.strictEqual(r.records[0].statuses.ppre, true);
  assert.strictEqual(r.records[1].statuses.ulis_incl, true);
  assert.ok(r.records.every(x => x.ok));
});

test('_impAnalyze devine les colonnes d\'après leurs valeurs quand il n\'y a pas d\'en-tête', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('DUPONT;Martin;5C\\nMARTIN;Sophie;5C\\nPETIT;Inès;5C', { defaultClassId: '5C' })`);
  assert.strictEqual(r.header, false);
  assert.deepStrictEqual([...r.mapping], ['nom', 'prenom', 'classe']);
  assert.strictEqual(r.records.length, 3);
});

test('_impAnalyze transforme les codes Pronote en groupe + options', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom;Groupes\\nDUPONT;Martin;5C-GP1,5C-LATIN\\nMARTIN;Sophie;5C-GP2,5C-BIL-LCE', { defaultClassId: '5C' })`);
  assert.strictEqual(r.records[0].groupe, 1);
  assert.deepStrictEqual([...r.records[0].tagAbbrs], ['LATIN']);
  assert.strictEqual(r.records[1].groupe, 2);
  assert.deepStrictEqual([...r.records[1].tagAbbrs], ['BIL']);   // « BIL-LCE » abrégé
  // Le panneau des codes liste ce qui a été rencontré, le plus fréquent d'abord.
  const codes = r.codes.map(c => c.code).sort();
  assert.deepStrictEqual(codes, ['BIL-LCE', 'GP1', 'GP2', 'LATIN']);
});

test('_impAnalyze respecte l\'interprétation imposée par l\'utilisateur (codeMap)', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom;Groupes\\nDUPONT;Martin;5C-BIL-LCE',
    { defaultClassId:'5C', codeMap: { 'BIL-LCE': { kind:'tag', abbrs:['BIL','LCE'] } } })`);
  assert.deepStrictEqual([...r.records[0].tagAbbrs], ['BIL', 'LCE']);
  // Et « ignorer » n'assigne rien du tout.
  const r2 = evObj(`_impAnalyze('Nom;Prénom;Groupes\\nDUPONT;Martin;5C-LATIN',
    { defaultClassId:'5C', codeMap: { LATIN: { kind:'ignore' } } })`);
  assert.deepStrictEqual([...r2.records[0].tagAbbrs], []);
});

test('_impAnalyze crée les classes inconnues, et sait ne pas le faire', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom;Classe\\nDUPONT;Martin;4ème B', { defaultClassId: '5C' })`);
  assert.deepStrictEqual(Object.keys(r.newClasses), ['4B']);          // « 4ème B » → 4B
  assert.strictEqual(r.newClasses['4B'], '4ème B');                   // le libellé complet est conservé
  assert.strictEqual(r.records[0].targetClassId, '4B');
  const r2 = evObj(`_impAnalyze('Nom;Prénom;Classe\\nDUPONT;Martin;4ème B', { defaultClassId: '5C', createClasses: false })`);
  assert.deepStrictEqual(Object.keys(r2.newClasses), []);
  assert.strictEqual(r2.records[0].targetClassId, '5C');              // repli sur la classe courante
  assert.ok(r2.records[0].warnings.some(w => w.includes('inconnue')));
});

test('_impAnalyze rejette les lignes inexploitables en disant pourquoi', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom\\nDUPONT;\\n;Sophie\\n;', { defaultClassId: '5C' })`);
  assert.strictEqual(r.records.length, 2);                            // la ligne vide est sautée
  assert.strictEqual(r.records[0].ok, false);
  assert.match(r.records[0].warnings[0], /prénom manquant/);
  assert.match(r.records[1].warnings[0], /nom manquant/);
});

test('_impAnalyze refuse une ligne sans aucune classe cible', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze('Nom;Prénom\\nDUPONT;Martin', { defaultClassId: null })`);
  assert.strictEqual(r.records[0].ok, false);
  assert.match(r.records[0].warnings.join(' '), /aucune classe cible/);
});

test('_impAnalyze repère les doublons du fichier ET ceux déjà en base', () => {
  ev(RESET);
  ev(`S.eleves.s1 = { id:'s1', nom:'DUPONT', prenom:'Martin', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s1');`);
  // Comparaison sans accents ni casse : « Dupont » et « DUPONT » sont le même élève.
  const r = evObj(`_impAnalyze('Nom;Prénom\\nDupont;martin\\nMARTIN;Sophie\\nMARTIN;Sophie', { defaultClassId:'5C', skipDup:true })`);
  assert.strictEqual(r.records[0].ok, false);
  assert.match(r.records[0].warnings.join(' '), /déjà présent/);
  assert.strictEqual(r.records[1].ok, true);
  assert.strictEqual(r.records[2].ok, false);
  assert.match(r.records[2].warnings.join(' '), /doublon de la ligne 3/);
  // Sans skipDup, le déjà-présent redevient importable (mais reste signalé).
  const r2 = evObj(`_impAnalyze('Nom;Prénom\\nDupont;martin', { defaultClassId:'5C', skipDup:false })`);
  assert.strictEqual(r2.records[0].ok, true);
  assert.strictEqual(r2.records[0].dup, true);
});

test('_impAnalyze ignore une date de départ antérieure à l\'arrivée, et le dit', () => {
  ev(RESET);
  const r = evObj(`_impAnalyze("Nom;Prénom;Date d'arrivée;Date de départ\\nDUPONT;Martin;12/09/2025;01/09/2025", { defaultClassId:'5C' })`);
  assert.strictEqual(r.records[0].arrivalDate, '2025-09-12');
  assert.strictEqual(r.records[0].departureDate, null);
  assert.match(r.records[0].warnings.join(' '), /départ avant l'arrivée/);
});

test('_impAnalyze suit le mappage imposé plutôt que sa propre devinette', () => {
  ev(RESET);
  // Deux colonnes de noms : on force la seconde en prénom.
  const r = evObj(`_impAnalyze('DUPONT;MARTIN\\nDURAND;LEROY', { defaultClassId:'5C', mapping:['nom','prenom'] })`);
  assert.strictEqual(r.records[0].nom, 'DUPONT');
  assert.strictEqual(r.records[0].prenom, 'MARTIN');
});

test('_impAnalyze accepte qu\'on lui impose le mode texte libre', () => {
  ev(RESET);
  // Ce texte serait détecté comme un tableau à virgules ; le mode forcé prime.
  const r = evObj(`_impAnalyze('DUPONT Martin,1\\nMARTIN Sophie,2', { mode:'text', defaultClassId:'5C' })`);
  assert.strictEqual(r.mode, 'text');
  assert.strictEqual(r.records.length, 2);
});
