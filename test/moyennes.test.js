// Moyennes par matière — l'export du bureau numérique, réimporté au fil de la période.
// Écrit AVANT l'écran : la lecture du tableau, le rapprochement des élèves, le réalignement
// des colonnes quand un fichier en gagne une, et l'arithmétique des statistiques.
//
// ⚠️ Les fixtures sont INVENTÉES (noms, collègues) sur le modèle exact de l'export réel :
// le dépôt est public, aucune vraie donnée d'élève n'y entre.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// L'en-tête réel : nom complet, période, une colonne par matière avec ses professeurs
// entre parenthèses (dont une avec DEUX professeurs, donc une virgule dans le titre),
// puis « Moy. ». Virgule décimale, cases vides, un 0 qui est une vraie note.
const CSV1 = [
  "Nom et prénom de l'élève;Périodes;ANGLAIS LV2(Mme ALPHA);HISTOIRE-GEOGRAPHIE(M. BETA);MATHEMATIQUES(M. GAMMA, Mme DELTA);Moy.",
  'DURAND Léa;Premier semestre;11;12;15;12,7',
  'MARTIN Noé;Premier semestre;8;;0;4',
  'LE GOFF Anne-Sophie;Premier semestre;17,5;Abs;18;17,8',
  'INCONNU Jean;Premier semestre;10;10;10;10',
  '',
].join('\r\n');
// Trois semaines plus tard : une colonne NOUVELLE (un collègue a saisi), des notes qui bougent.
const CSV2 = [
  "Nom et prénom de l'élève;Périodes;ANGLAIS LV2(Mme ALPHA);HISTOIRE-GEOGRAPHIE(M. BETA);MATHEMATIQUES(M. GAMMA, Mme DELTA);PHYSIQUE-CHIMIE(M. EPSILON);Moy.",
  'DURAND Léa;Premier semestre;12;11,5;15;14;13,1',
  'MARTIN Noé;Premier semestre;9;7;2;;6',
  'LE GOFF Anne-Sophie;Premier semestre;17;16;18;19;17,5',
].join('\n');

const CLASSE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3','s4'], ord:0, rooms:{} };
  S.eleves = {
    s1:{ id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] },
    s2:{ id:'s2', nom:'Martin', prenom:'Noé', classe_id:'5C', tags:[] },
    s3:{ id:'s3', nom:'LE GOFF', prenom:'Anne Sophie', classe_id:'5C', tags:[] },
    s4:{ id:'s4', nom:'PETIT', prenom:'Inès', classe_id:'5C', tags:[] },
  };
  S.cur = '5C';`;
const imp = (csv, date, extra) => ev(`(() => { const p = _moyParse(${JSON.stringify(csv)});
  const m = _moyMatch(p, '5C', ${JSON.stringify((extra && extra.manual) || {})});
  return moyImport('5C', p, m, { date: ${JSON.stringify(date)}, replace: ${!!(extra && extra.replace)} }); })()`);
const mid = norm => ev(`_moyMatiereByNorm(${JSON.stringify(norm)})?.id`);

// ─────────────────────────────────────────────── Lecture du tableau

test('_moyParse lit l\'export réel : séparateur, matières, professeurs, virgule décimale', () => {
  const p = evObj(`_moyParse(${JSON.stringify(CSV1)})`);
  assert.strictEqual(p.sep, ';', 'la virgule du titre « M. GAMMA, Mme DELTA » ne doit pas faire choisir « , »');
  const mats = p.cols.filter(c => c.role === 'matiere');
  assert.deepStrictEqual(mats.map(c => c.nom), ['ANGLAIS LV2', 'HISTOIRE-GEOGRAPHIE', 'MATHEMATIQUES']);
  assert.strictEqual(mats[2].profs, 'M. GAMMA, Mme DELTA');
  assert.ok(p.cols.some(c => c.role === 'periode'));
  assert.ok(p.cols.some(c => c.role === 'generale'), '« Moy. » est la moyenne générale, pas une matière');
  assert.strictEqual(p.rows.length, 4, 'la ligne vide finale est ignorée');
  assert.strictEqual(p.rows[0].notes['MATHEMATIQUES'], 15);
  assert.strictEqual(p.rows[0].generale, 12.7);
});

test('Trois états d\'une case : un 0 est une note, un vide n\'en est pas une, un code se garde', () => {
  const p = evObj(`_moyParse(${JSON.stringify(CSV1)})`);
  const noe = p.rows[1], anne = p.rows[2];
  assert.strictEqual(noe.notes['MATHEMATIQUES'], 0, '0 est une vraie note');
  assert.ok(!('HISTOIRE GEOGRAPHIE' in noe.notes), 'une case vide ne crée pas de note');
  assert.strictEqual(anne.notes['HISTOIRE GEOGRAPHIE'], 'Abs', 'un code est conservé tel quel');
  assert.strictEqual(anne.notes['ANGLAIS LV2'], 17.5);
});

test('_moyParse accepte un tableau collé (tabulations) et des colonnes Nom / Prénom séparées', () => {
  const p = evObj(`_moyParse("Nom\\tPrénom\\tFRANÇAIS\\tMoyenne générale\\nDURAND\\tLéa\\t14,5\\t14")`);
  assert.strictEqual(p.sep, '\t');
  assert.strictEqual(p.rows[0].nomAffiche, 'DURAND Léa');
  assert.strictEqual(p.rows[0].notes['FRANCAIS'], 14.5);
  assert.strictEqual(p.rows[0].generale, 14);
});

test('_moyParse refuse ce qui n\'est pas un tableau de moyennes, avec un message', () => {
  assert.ok(ev(`_moyParse('')`).error);
  assert.ok(ev(`_moyParse('juste une ligne sans séparateur')`).error);
  assert.match(ev(`_moyParse('Classe;MATHS\\n5C;12').error`), /noms/);
});

test('Nom de matière : casse, accents et ponctuation ne comptent pas', () => {
  assert.strictEqual(ev(`_moyNorm('Histoire-Géographie')`), ev(`_moyNorm('HISTOIRE GEOGRAPHIE')`));
  assert.deepStrictEqual(evObj(`_moySplitHeader('SCIENCES DE LA VIE ET DE LA TERRE(Mme ZETA)')`),
    { nom: 'SCIENCES DE LA VIE ET DE LA TERRE', profs: 'Mme ZETA' });
  assert.deepStrictEqual(evObj(`_moySplitHeader('LATIN')`), { nom: 'LATIN', profs: '' });
});

test('Date d\'extraction lue dans le nom du fichier du bureau numérique', () => {
  assert.strictEqual(ev(`_moyDateFromFilename('moyennes_5e_premier_semestre_6eme_5eme_4eme_20260929.csv')`), '2026-09-29');
  assert.strictEqual(ev(`_moyDateFromFilename('moyennes.csv')`), null);
  assert.strictEqual(ev(`_moyDateFromFilename('x_20260231.csv')`), null, 'un 31 février n\'est pas une date');
});

// ─────────────────────────────────────────────── Rapprochement des élèves

test('_moyMatch reconnaît les élèves sans tenir compte de la casse, des accents, de l\'ordre ni des traits d\'union', () => {
  ev(CLASSE);
  const m = evObj(`_moyMatch(_moyParse(${JSON.stringify(CSV1)}), '5C')`);
  assert.deepStrictEqual(m.rows.map(r => r.sid), ['s1', 's2', 's3', null]);
  assert.strictEqual(m.rows[3].raison, 'inconnu', 'un élève hors de la classe n\'est rattaché à personne');
  assert.deepStrictEqual(m.absents, ['s4'], 'un élève de la classe absent du fichier est signalé');
});

test('_moyMatch : un rattachement manuel l\'emporte, et une même ligne ne sert pas deux fois', () => {
  ev(CLASSE);
  const m = evObj(`_moyMatch(_moyParse(${JSON.stringify(CSV1)}), '5C', { 5: 's4', 2: '' })`);
  // ligne 2 = DURAND Léa, ignorée à la main ; ligne 5 = INCONNU Jean, rattaché à s4.
  assert.strictEqual(m.rows[0].sid, null);
  assert.strictEqual(m.rows[0].raison, 'ignoré');
  assert.strictEqual(m.rows[3].sid, 's4');
  const d = evObj(`_moyMatch(_moyParse(${JSON.stringify(CSV1)}), '5C', { 5: 's1' })`);
  assert.strictEqual(d.rows[3].sid, null, 's1 déjà pris par sa propre ligne');
  assert.strictEqual(d.rows[3].raison, 'doublon');
});

test('_moyMatch : deux homonymes parfaits dans la classe → rien de deviné, on demande', () => {
  ev(CLASSE);
  ev(`S.eleves.s5 = { id:'s5', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] }; S.classes['5C'].eleves.push('s5');`);
  const m = evObj(`_moyMatch(_moyParse(${JSON.stringify(CSV1)}), '5C')`);
  assert.strictEqual(m.rows[0].sid, null);
  assert.strictEqual(m.rows[0].raison, 'homonymes');
});

// ─────────────────────────────────────────────── Import et réalignement des colonnes

test('moyImport crée un import daté et un catalogue de matières', () => {
  ev(CLASSE);
  const ids = imp(CSV1, '2025-10-01');
  assert.strictEqual(ids.length, 1);
  const rel = evObj(`S.moyennes['5C'][${JSON.stringify(ids[0])}]`);
  assert.strictEqual(rel.date, '2025-10-01');
  assert.strictEqual(rel.periode, 'Premier semestre');
  assert.strictEqual(rel.matieres.length, 3);
  assert.deepStrictEqual(Object.keys(rel.notes).sort(), ['s1', 's2', 's3'], 'la ligne non rattachée n\'entre pas');
  assert.strictEqual(rel.notes.s2[mid('MATHEMATIQUES')], 0);
  assert.strictEqual(rel.generale.s1, 12.7);
  assert.strictEqual(rel.profs[mid('MATHEMATIQUES')], 'M. GAMMA, Mme DELTA');
});

test('⚠️ Une colonne NOUVELLE s\'ajoute au catalogue sans décaler les autres', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  const maths = mid('MATHEMATIQUES');
  const [r2] = imp(CSV2, '2025-10-22');
  assert.strictEqual(ev(`Object.keys(S.matieres).length`), 4, 'trois matières réutilisées, une créée');
  assert.strictEqual(mid('MATHEMATIQUES'), maths, 'la même matière garde le même id d\'un import à l\'autre');
  const pc = mid('PHYSIQUE CHIMIE');
  assert.ok(ev(`_moyColNouvelle('5C', ${JSON.stringify(r2)}, ${JSON.stringify(pc)})`), 'PC est signalée nouvelle');
  assert.ok(!ev(`_moyColNouvelle('5C', ${JSON.stringify(r2)}, ${JSON.stringify(maths)})`));
  // Dans l'import ancien, la matière nouvelle n'a PAS de colonne : ni zéro, ni vide saisi.
  const [r1] = ev(`_moyReleves('5C').map(r => r.id)`);
  assert.strictEqual(ev(`_moyVal(S.moyennes['5C'][${JSON.stringify(r1)}], 's1', ${JSON.stringify(pc)})`), null);
});

test('Une colonne entièrement vide ne devient pas une matière de l\'import', () => {
  ev(CLASSE);
  imp("Nom et prénom de l'élève;MATHEMATIQUES(M. X);TECHNOLOGIE(M. Y)\nDURAND Léa;12;\nMARTIN Noé;8;", '2025-10-01');
  assert.strictEqual(mid('TECHNOLOGIE'), undefined, 'aucune note saisie : la colonne ne naît pas encore');
});

test('Réimporter le même jour pour la même période REMPLACE, sinon on empile', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  assert.strictEqual(ev(`_moySameDay('5C', '2025-10-01', 'Premier semestre').length`), 1);
  imp(CSV2, '2025-10-01', { replace: true });
  assert.strictEqual(ev(`_moyReleves('5C').length`), 1);
  imp(CSV2, '2025-10-22');
  assert.strictEqual(ev(`_moyReleves('5C').length`), 2);
});

test('Un tableau à plusieurs périodes donne un import par période', () => {
  ev(CLASSE);
  imp("Nom et prénom de l'élève;Périodes;MATHS;Moy.\nDURAND Léa;Trimestre 1;12;12\nDURAND Léa;Trimestre 2;14;14\nMARTIN Noé;Trimestre 1;8;8", '2026-01-10');
  assert.deepStrictEqual(evObj(`_moyPeriodes('5C')`), ['Trimestre 1', 'Trimestre 2']);
  assert.strictEqual(ev(`Object.keys(_moyReleves('5C', 'Trimestre 1')[0].notes).length`), 2);
});

// ─────────────────────────────────────────────── Évolution

test('_moyDelta : évolution depuis l\'import précédent de la MÊME période', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  const [r2] = imp(CSV2, '2025-10-22');
  const d = evObj(`_moyDelta('5C', ${JSON.stringify(r2)}, 's1', ${JSON.stringify(mid('ANGLAIS LV2'))})`);
  assert.deepStrictEqual(d, { delta: 1, prev: 11, prevDate: '2025-10-01' });
  // Flottants : 11,5 − 12 = −0,5 exactement, pas −0.4999999.
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r2)}, 's1', ${JSON.stringify(mid('HISTOIRE GEOGRAPHIE'))}).delta`), -0.5);
  // Moyenne générale : mid = null.
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r2)}, 's1', null).delta`), 0.4);
  // Premier import → pas d'évolution.
  const [r1] = ev(`_moyReleves('5C').map(r => r.id)`);
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r1)}, 's1', null)`), null);
});

test('_moyDelta : un code ou un vide ne se soustrait pas — on remonte au dernier nombre', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  const [r2] = imp(CSV2, '2025-10-22');
  // Anne-Sophie : HG « Abs » au 1er import → pas d'évolution calculable au 2e.
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r2)}, 's3', ${JSON.stringify(mid('HISTOIRE GEOGRAPHIE'))})`), null);
  // Noé : HG vide au 1er import → idem.
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r2)}, 's2', ${JSON.stringify(mid('HISTOIRE GEOGRAPHIE'))})`), null);
  // Un 3e import : Noé a 9 en HG → comparé au 7 du 2e.
  const [r3] = imp(CSV2.replace('MARTIN Noé;Premier semestre;9;7;', 'MARTIN Noé;Premier semestre;9;9;'), '2025-11-12');
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r3)}, 's2', ${JSON.stringify(mid('HISTOIRE GEOGRAPHIE'))}).delta`), 2);
});

test('⚠️ Pas d\'évolution d\'une période à l\'autre : les moyennes repartent à chaque période', () => {
  ev(CLASSE);
  imp(CSV1, '2026-01-20');
  const [r2] = imp(CSV2.replace(/Premier semestre/g, 'Second semestre'), '2026-02-20');
  assert.strictEqual(ev(`_moyDelta('5C', ${JSON.stringify(r2)}, 's1', null)`), null);
  assert.ok(!ev(`_moyColNouvelle('5C', ${JSON.stringify(r2)}, ${JSON.stringify(mid('PHYSIQUE CHIMIE'))})`),
    'premier import de la période : rien n\'est « nouveau »');
});

// ─────────────────────────────────────────────── Statistiques

test('_moyStats : moyenne, médiane (paire et impaire), écart type de population', () => {
  const s = evObj(`_moyStats([12, 8, 15, 10, 5])`);
  assert.strictEqual(s.n, 5);
  assert.strictEqual(s.moyenne, 10);
  assert.strictEqual(s.mediane, 10);
  // σ = √((4+4+25+0+25)/5) = √11,6
  assert.ok(Math.abs(s.ecartType - Math.sqrt(11.6)) < 1e-12);
  assert.strictEqual(s.min, 5);
  assert.strictEqual(s.max, 15);
  assert.strictEqual(evObj(`_moyStats([4, 10, 12, 20])`).mediane, 11, 'médiane paire = moyenne des deux du milieu');
  assert.strictEqual(evObj(`_moyStats([14, 14, 14])`).ecartType, 0);
});

test('⚠️ Sous 10 = strictement moins de 10 : un 10 pile a la moyenne', () => {
  const s = evObj(`_moyStats([9.99, 10, 10.01, 0, 20])`);
  assert.strictEqual(s.sous10, 2);
  assert.strictEqual(s.auMoins10, 3);
  assert.strictEqual(s.sous10 + s.auMoins10, s.n);
});

test('_moyStats : les codes et les vides n\'entrent pas dans le calcul, un 0 si', () => {
  const s = evObj(`_moyStats([12, 'Abs', null, undefined, 0, NaN])`);
  assert.strictEqual(s.n, 2);
  assert.strictEqual(s.moyenne, 6);
  assert.strictEqual(s.sous10, 1);
  const vide = evObj(`_moyStats(['Disp'])`);
  assert.strictEqual(vide.n, 0);
  assert.strictEqual(vide.moyenne, null, 'aucune note : pas de moyenne, surtout pas 0');
  assert.strictEqual(vide.sous10, 0);
});

test('_moyColStats porte sur la colonne d\'un import, moyenne générale comprise', () => {
  ev(CLASSE);
  const [r1] = imp(CSV1, '2025-10-01');
  const rel = `S.moyennes['5C'][${JSON.stringify(r1)}]`;
  const maths = evObj(`_moyColStats(${rel}, ${JSON.stringify(mid('MATHEMATIQUES'))})`);
  assert.strictEqual(maths.n, 3);
  assert.strictEqual(maths.moyenne, 11);          // (15 + 0 + 18) / 3
  assert.strictEqual(maths.sous10, 1);
  const hg = evObj(`_moyColStats(${rel}, ${JSON.stringify(mid('HISTOIRE GEOGRAPHIE'))})`);
  assert.strictEqual(hg.n, 1, 'le vide et le code « Abs » sont hors calcul');
  const gen = evObj(`_moyColStats(${rel}, null)`);
  assert.strictEqual(gen.n, 3);
  assert.strictEqual(gen.mediane, 12.7);
  // Restreint à des élèves donnés (ceux affichés).
  assert.strictEqual(evObj(`_moyColStats(${rel}, null, ['s1', 's2'])`).n, 2);
});

test('_moySous10 compte les matières sous la moyenne d\'un élève', () => {
  ev(CLASSE);
  const [r1] = imp(CSV1, '2025-10-01');
  const rel = `S.moyennes['5C'][${JSON.stringify(r1)}]`;
  assert.strictEqual(ev(`_moySous10(${rel}, 's2')`), 2, 'anglais 8 et maths 0 ; HG vide ne compte pas');
  assert.strictEqual(ev(`_moySous10(${rel}, 's1')`), 0);
});

test('_moyEvolution et _moyEleve retracent la période import par import', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  imp(CSV2, '2025-10-22');
  const evo = evObj(`_moyEvolution('5C', 'Premier semestre')`);
  assert.strictEqual(evo.length, 2);
  assert.strictEqual(Object.keys(evo[0].parMatiere).length, 3);
  assert.strictEqual(Object.keys(evo[1].parMatiere).length, 4);
  const el = evObj(`_moyEleve('5C', 's2')`);
  assert.strictEqual(el.length, 1);
  assert.deepStrictEqual(el[0].releves.map(r => r.generale), [4, 6]);
  const der = evObj(`_moyDerniere('5C', 's2')`);
  assert.strictEqual(der.generale, 6);
  assert.strictEqual(der.delta, 2);
  assert.strictEqual(ev(`_moyDerniere('5C', 's4')`), null, 'absent de tous les fichiers');
});

test('_fmtNote / _fmtDelta : virgule française, deux décimales au plus, signe moins typographique', () => {
  assert.strictEqual(ev(`_fmtNote(12.25)`), '12,25');
  assert.strictEqual(ev(`_fmtNote(12.2)`), '12,2');
  assert.strictEqual(ev(`_fmtNote(12)`), '12');
  assert.strictEqual(ev(`_fmtNote(10 / 3)`), '3,33');
  assert.strictEqual(ev(`_fmtNote(null)`), '');
  assert.strictEqual(ev(`_fmtDelta(1.5)`), '+1,5');
  assert.strictEqual(ev(`_fmtDelta(-0.5)`), '−0,5');
  assert.strictEqual(ev(`_fmtDelta(0)`), '=');
});

// ─────────────────────────────────────────────── Robustesse

test('Un JSON portant des moyennes passe _validateImport et _sanitizeCoreSections', () => {
  ev(CLASSE);
  imp(CSV1, '2025-10-01');
  const json = ev(`JSON.stringify(S)`);
  assert.strictEqual(ev(`_validateImport(JSON.parse(${JSON.stringify(json)}))`), null);
  // Un import abîmé (notes non-objet, matières absentes) est réparé, pas fatal.
  ev(`S.moyennes['5C'].casse = { id:'casse', date:'2025-10-02', periode:'P', notes: 7 };
      S.moyennes['5C'].pasobjet = 42; S.matieres.m_x = { id:'m_x', nom:'Latin' }; _sanitizeCoreSections();`);
  assert.ok(!('pasobjet' in ev(`S.moyennes['5C']`)));
  assert.deepStrictEqual(evObj(`S.moyennes['5C'].casse.notes`), {});
  assert.deepStrictEqual(evObj(`S.moyennes['5C'].casse.matieres`), []);
  assert.strictEqual(ev(`S.matieres.m_x.norm`), 'LATIN');
  // Et un import dont la clé est piégée est refusé.
  assert.ok(ev(`_validateImport({ moyennes: { '5C': { 'x"onerror': {} } } })`));
});

test('Un ancien fichier sans section moyennes se charge avec des sections vides', () => {
  ev(`S = JSON.parse('{"version":1,"classes":{},"eleves":{}}'); postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.moyennes`), {});
  assert.deepStrictEqual(evObj(`S.matieres`), {});
});

test('FUZZ : _moyParse + _moyMatch refusent ou aboutissent, jamais ne lèvent', () => {
  ev(CLASSE);
  let seed = 20260929;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const alphabet = ';;\t,"\n()0123456789,.AbsNEé -';
  for (let i = 0; i < 400; i++) {
    let t = CSV2;
    const nb = 1 + Math.floor(rnd() * 8);
    for (let k = 0; k < nb; k++) {
      const pos = Math.floor(rnd() * t.length);
      const op = rnd();
      if (op < 0.4) t = t.slice(0, pos) + t.slice(pos + 1 + Math.floor(rnd() * 6));
      else t = t.slice(0, pos) + alphabet[Math.floor(rnd() * alphabet.length)] + t.slice(pos);
    }
    assert.doesNotThrow(() => ev(`(() => { const p = _moyParse(${JSON.stringify(t)});
      if (p.error) return; const m = _moyMatch(p, '5C'); moyImport('5C', p, m, { date: '2025-12-01' }); })()`), `mutation ${i}`);
  }
  assert.deepStrictEqual([...ev(`_auditState()`)], [], 'aucune référence fantôme après 400 imports mutés');
});

test('_moyAbbr abrège les intitulés connus, garde le suffixe, laisse les inconnus intacts', () => {
  assert.strictEqual(ev(`_moyAbbr('SCIENCES DE LA VIE ET DE LA TERRE')`), 'SVT');
  assert.strictEqual(ev(`_moyAbbr('ANGLAIS LV2')`), 'Anglais LV2');
  assert.strictEqual(ev(`_moyAbbr('Histoire-Géographie EMC')`), 'Hist.-géo. EMC');
  assert.strictEqual(ev(`_moyAbbr('FRANCAISE LANGUE')`), 'FRANCAISE LANGUE', 'préfixe de mot ≠ matière : pas d\'abréviation');
  assert.strictEqual(ev(`_moyAbbr('OPTION CINÉMA')`), 'OPTION CINÉMA');
});

// ─────────────────────────────────────────────── Rendu (garde-fou XSS à l'écran)
// ⚠️ Le stub de test renvoie un élément NEUF à chaque getElementById() : écrire l'écran
// puis le relire donnerait toujours du vide. On stabilise donc les éléments lus ici par
// un petit cache posé une fois, comme le ferait un vrai DOM (id → même nœud).
function _stableDom() {
  ev(`(() => {
    if (globalThis.__testElCache) return;
    globalThis.__testElCache = new Map();
    const orig = document.getElementById.bind(document);
    document.getElementById = id => { if (!__testElCache.has(id)) __testElCache.set(id, orig(id)); return __testElCache.get(id); };
  })()`);
}

test('Rendu : un intitulé de matière, une période et un nom de fichier hostiles ne ressortent jamais en clair', () => {
  ev(CLASSE);
  _stableDom();
  const PAYLOAD = '<img src=x onerror=alert(1)>';
  const csv = [
    `Nom et prénom de l'élève;Périodes;${PAYLOAD}(Mme X);Moy.`,
    `DURAND Léa;${PAYLOAD};12;12`,
  ].join('\n');
  ev(`(() => { const p = _moyParse(${JSON.stringify(csv)});
    const m = _moyMatch(p, '5C', {});
    moyImport('5C', p, m, { date: '2025-10-01', fichier: ${JSON.stringify(PAYLOAD)} }); })()`);

  ev(`renderMoyennes()`);
  assert.ok(!ev(`document.getElementById('moyennes-body').innerHTML`).includes('<img'),
    'vue tableau (élèves) : balise hostile en clair');
  ev(`setMoyVue('evolution')`);
  assert.ok(!ev(`document.getElementById('moyennes-body').innerHTML`).includes('<img'),
    'vue évolution : balise hostile en clair');
  ev(`setMoyVue('tableau')`);

  ev(`openFiche('s1')`);
  assert.ok(!ev(`document.getElementById('mfiche-body').innerHTML`).includes('<img'),
    'fiche élève : balise hostile en clair');
});
