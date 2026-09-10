// Départage automatique par l'âge — `stu.naissance` + `_elNaissance` / `_elDepartageAge`.
// ⚠️ Jusqu'ici une égalité se tranchait TOUJOURS à la main (cf. test/elections.test.js,
// « sans date de naissance, plus jeune ne peut pas trancher »). Ces deux fonctions ajoutent
// un départage automatique, mais l'app ne doit JAMAIS deviner ni tirer au sort : au moindre
// doute (date manquante, dates identiques, sièges impossibles), elle répond null et laisse
// l'humain trancher — exactement le même arbitrage que le cumul de carnet qui diminue.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Même classe de 25 + binômes que test/elections.test.js, mais avec des dates de naissance
// posées sur les ÉLÈVES (S.eleves[sid].naissance) : c'est la source de repli. La date FIGÉE
// sur la candidature (cand.naissanceTitulaire) est ajoutée au cas par cas dans chaque test
// qui a besoin de vérifier qu'elle prime.
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0 }; S.cur = '5C';
  for (let i = 1; i <= 25; i++) { const id = 's' + i; S.eleves[id] = { id, nom: 'N' + i, prenom: 'P' + i, classe_id: '5C', tags: [] }; S.classes['5C'].eleves.push(id); }
  const el = electionCreate('5C', { date: '2025-10-07', titre: 'Test' });
  ['c1','c2','c3','c4'].forEach((id, i) => el.candidats.push({ id, sidTitulaire: 's' + (i+1), sidSuppleant: 's' + (i+11), nomTitulaire: 'T' + (i+1), nomSuppleant: 'S' + (i+1), color: '#16a085', ordre: i, retire: false }));
  el.tours[0].candidats = ['c1','c2','c3','c4'];
  window.EL = el;`;

// ─────────────────────────────────────────────── _elNaissance : lecture et priorité

test('_elNaissance : à défaut de date figée, lit celle de l\'élève vivant', () => {
  ev(FIXTURE);
  ev(`S.eleves.s1.naissance = '2011-03-14'`);
  assert.strictEqual(ev(`_elNaissance(EL, 'c1')`), '2011-03-14');
});

test('_elNaissance : sans aucune date (ni figée, ni élève), retourne null', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_elNaissance(EL, 'c1')`), null);
});

test('⚠️ _elNaissance : la date FIGÉE sur la candidature PRIME sur celle de l\'élève vivant', () => {
  ev(FIXTURE);
  // L'élève a été corrigé (ou a changé) après l'élection : le PV ne doit pas en tenir compte.
  ev(`S.eleves.s1.naissance = '2011-09-01'`);
  ev(`EL.candidats[0].naissanceTitulaire = '2011-01-15'`);
  assert.strictEqual(ev(`_elNaissance(EL, 'c1')`), '2011-01-15');
});

test('_elNaissance : candidature figée valable même si l\'élève a été supprimé entre-temps', () => {
  ev(FIXTURE);
  ev(`EL.candidats[0].naissanceTitulaire = '2011-01-15'; delete S.eleves.s1;`);
  assert.strictEqual(ev(`_elNaissance(EL, 'c1')`), '2011-01-15');
});

test('_elNaissance : candidat inconnu ou id absent → null (ne lève pas)', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_elNaissance(EL, 'inexistant')`), null);
});

// ─────────────────────────────────────────────── _elDepartageAge : les modes

test('plusJeune : sur deux candidats, la date de naissance la plus TARDIVE l\'emporte', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';   // c1 : plus âgé
      EL.candidats[1].naissanceTitulaire = '2011-11-05';`); // c2 : plus jeune
  assert.deepStrictEqual(evObj(`_elDepartageAge(EL, ['c1','c2'], 1)`), ['c2']);
});

test('plusAge : sur deux candidats, la date de naissance la plus PRÉCOCE l\'emporte', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusAge';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';   // c1 : plus âgé
      EL.candidats[1].naissanceTitulaire = '2011-11-05';`); // c2 : plus jeune
  assert.deepStrictEqual(evObj(`_elDepartageAge(EL, ['c1','c2'], 1)`), ['c1']);
});

test('⚠️ ordre du MOIS, pas de l\'année seule ni d\'un tri de chaînes naïf : 2011-01-05 vs 2011-11-05', () => {
  ev(FIXTURE);
  // Même année, mois différents. Une comparaison sur l'année seule (2011 === 2011) ou un tri
  // de chaînes mal fait (par ex. sur substring 0-4 seulement) ne verrait aucune différence.
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';
      EL.candidats[1].naissanceTitulaire = '2011-11-05';`);
  // c2 (novembre) est né après c1 (janvier) la même année → c2 est le plus jeune.
  assert.deepStrictEqual(evObj(`_elDepartageAge(EL, ['c1','c2'], 1)`), ['c2']);
});

test('manuel : ne tranche JAMAIS, même avec des dates connues et distinctes', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'manuel';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';
      EL.candidats[1].naissanceTitulaire = '2011-11-05';`);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1','c2'], 1)`), null);
});

test('trois candidats à égalité pour deux sièges : seul le dernier siège est disputé', () => {
  ev(FIXTURE);
  // c1 (2010) et c2 (2011) sont clairement plus jeunes que c3 (2009) : pour DEUX sièges parmi
  // trois, le départage doit renvoyer exactement les deux identifiants des plus jeunes,
  // dans l'ordre du départage (le plus jeune d'abord) — pas les trois, pas dans l'ordre d'entrée.
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2010-06-01';   // c1
      EL.candidats[1].naissanceTitulaire = '2011-06-01';   // c2 : le plus jeune
      EL.candidats[2].naissanceTitulaire = '2009-06-01';`); // c3 : le plus âgé
  assert.deepStrictEqual(evObj(`_elDepartageAge(EL, ['c1','c2','c3'], 2)`), ['c2', 'c1']);
});

// ─────────────────────────────────────────────── _elDepartageAge : indécidable → null

test('une SEULE date manquante parmi les candidats à égalité → null, jamais un verdict partiel', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';
      // c2 n'a aucune date : ni figée, ni sur l'élève (S.eleves.s2.naissance n'existe pas).`);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1','c2'], 1)`), null);
});

test('deux dates identiques sur le dernier siège disputé → null, l\'app ne tire pas au sort', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-05-20';
      EL.candidats[1].naissanceTitulaire = '2011-05-20';`);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1','c2'], 1)`), null);
});

test('sieges <= 0 → null', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';
      EL.candidats[1].naissanceTitulaire = '2011-11-05';`);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1','c2'], 0)`), null);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1','c2'], -1)`), null);
});

test('moins de candidats que de sièges → null', () => {
  ev(FIXTURE);
  ev(`EL.departage = 'plusJeune';
      EL.candidats[0].naissanceTitulaire = '2011-01-05';`);
  assert.strictEqual(ev(`_elDepartageAge(EL, ['c1'], 2)`), null);
});
