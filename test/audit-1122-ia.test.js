// Audit du 2026-11-22 — synthèses par une IA : les défauts confirmés, corrigés. Chaque test a été vérifié en
// échec sur la version d'avant la correction. Noms inventés (ceux de la démonstration), adresses fictives.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));
const SETUP = `createDemo({ force: true }); const cls = getCls(), stu = S.eleves.demo_e01, pers = _iaPersonnes(cls, stu);
  const nom = stu.nom.toLowerCase(), prenom = stu.prenom.toLowerCase(), sansAccent = x => x.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  const ps = t => _iaPseudo(t, { personnes: pers }).texte;`;

test('une adresse de courriel qui contient le nom de l\'élève part ENTIÈRE sous « [courriel] » (le prénom du parent et le domaine restaient)', () => {
  const r = J(`${SETUP} return [
    ps('Contact : jean.' + nom + '@ac-lyon.fr'), ps('m.' + sansAccent(nom) + '@example.org'), ps(prenom + '.' + nom + '@ac-lyon.fr, à rappeler'),
    ps('contact@famille-' + sansAccent(nom) + '.fr'), ps('parent.inconnu@example.org') ];`);
  assert.deepStrictEqual(r, ['Contact : [courriel]', '[courriel]', '[courriel], à rappeler', '[courriel]', '[courriel]']);
});

test('le nom reste remplacé HORS de l\'adresse, dans la même phrase', () => {
  const r = J(`${SETUP} return ps('Mère de ' + stu.prenom + ' : jean.' + nom + '@ac-lyon.fr');`);
  assert.match(r, /^Mère de \[[^\]]+\] : \[courriel\]$/);
});

test('téléphones : « (+33)6… », « (+33) 6 … » et « 0033… » sont remplacés comme les autres écritures', () => {
  const r = J(`${SETUP} return ['(+33)612345678', '(+33) 6 12 34 56 78', '0033612345678', '0033 6 12 34 56 78', '06 12 34 56 78', '+33 6 12 34 56 78', '+33(0)6 12 34 56 78', '06.12.34.56.78'].map(ps);`);
  assert.deepStrictEqual(r, Array(8).fill('[téléphone]'));
});

test('ce qui n\'est pas un téléphone ne le devient pas (date, numéro long, effectif)', () => {
  const r = J(`${SETUP} return ['le 12/03/2026 à 14 h', 'dossier 20260312345678', '25 élèves, 12 absents'].map(ps);`);
  assert.deepStrictEqual(r, ['le 12/03/2026 à 14 h', 'dossier 20260312345678', '25 élèves, 12 absents']);
});
