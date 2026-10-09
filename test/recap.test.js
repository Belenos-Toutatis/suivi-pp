// 📄 Récapitulatif vie scolaire de Mon Bureau Numérique, en PDF (v1.58.0) : observations,
// punitions (→ incidents), absences et retards, compléments de fiche. Fixture INVENTÉE à la
// mise en page du vrai (scripts/gen_recap_fixture.py) — dépôt public.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
sb.__u8 = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'recap-mbn-invente.pdf')));
const LIRE = async () => JSON.parse(await ev(`(async () => JSON.stringify(_recapLire(await _recapPages(__u8))))()`));
// La démo, dont trois élèves prennent les noms du faux récapitulatif.
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;
  (() => { const cls = getCls(); [['MARTIN', 'Noé'], ['DUPONT', 'Léa'], ['DE LA TOUR', 'Jean-Marc']].forEach(([n, p], i) => {
    const s = S.eleves[cls.eleves[i]]; s.nom = n; s.prenom = p; s.naissance = null; s.sortie = null; delete s.obsMbn; delete s.absMbn; s.incidents = []; }); })();`;

test('dates et périodes du récapitulatif : mois abrégés, « 1er », « Le … de … à … », « Du … au … », durées', () => {
  assert.deepStrictEqual(evObj(`[_recapDateFr('9 sept. 2025'), _recapDateFr('1er févr. 2026'), _recapDateFr('12 déc. 2025'), _recapDateFr('3 août 2026'), _recapDateFr('31 févr. 2026'), _recapDateFr('9 truc 2025')]`),
    ['2025-09-09', '2026-02-01', '2025-12-12', '2026-08-03', null, null]);
  assert.deepStrictEqual(evObj(`[_recapPeriode('Le 15/09/2025, de 08:00 à 10:00'), _recapPeriode('Du 22/09/2025 08:00 au 23/09/2025 17:00'), _recapPeriode('Récurrence du 15/09/2025 au 15/10/2025')]`),
    [{ debut: '2025-09-15', hDebut: '08:00', fin: '2025-09-15', hFin: '10:00' }, { debut: '2025-09-22', hDebut: '08:00', fin: '2025-09-23', hFin: '17:00' }, null]);
  assert.deepStrictEqual(evObj(`[_recapDuree('1 h 30 min'), _recapDuree('15 min'), _recapDuree('3 h'), _recapDuree('—')]`), [90, 15, 180, null]);
});

test('lecture : un élève par page (la suite sans en-tête rattachée), cases sur deux lignes, dispenses écartées', async () => {
  const lu = await LIRE();
  assert.deepStrictEqual(lu.periode, { a: '2025-09-01', b: '2025-10-09' });
  assert.deepStrictEqual(lu.eleves.map(e => [e.nom, e.page]), [['Noé MARTIN', 1], ['Léa DUPONT', 2], ['Jean-Marc DE LA TOUR', 4], ['Zoé INCONNUE', 5]]);
  const [noe, lea, jm] = lu.eleves;
  assert.strictEqual(noe.naissance, '2013-03-14');
  assert.deepStrictEqual([noe.regime, noe.sortie, noe.groupes], ["DEMI-PENSIONNAIRE DANS L'ETABLISSEMENT", 'D2', ['5DE-CATHO', '5E-GP2']]);
  assert.deepStrictEqual(noe.punitions, [{ date: '2025-09-18', consequence: 'Retenue', motif: 'Manquement au règlement intérieur', etat: 'Réalisée', par: 'Vie scolaire' }]);
  assert.deepStrictEqual(noe.absences.map(a => [a.kind, a.debut, a.fin, a.motif, a.regul, a.valable, a.duree]), [
    ['absence', '2025-09-22', '2025-09-23', 'Raison de santé', false, true, 180],
    ['absence', '2025-09-29', '2025-09-29', "Absent en cours/présent dans l'établissement", true, false, 120],
    ['retard', '2025-10-01', '2025-10-01', 'Problèmes de transport', false, true, 15]]);
  assert.deepStrictEqual(lea.observations.map(o => [o.date, o.motif, o.type]), [['2025-09-15', 'Oubli de matériel', 'Observation négative'],
    ['2025-10-01', 'Oubli de matériel', 'Observation négative'], ['2025-10-06', 'Aide apportée à un camarade', 'Observation positive']], 'la page 3 (sans en-tête) est à Léa');
  assert.deepStrictEqual([jm.observations.length, jm.absences.length, jm.illisibles], [0, 0, 0], 'la dispense n\'est pas une absence');
});

test('import : revue, application, puis réimport sans rien de neuf ; la fiche n\'est complétée que là où elle est vide', async () => {
  ev(DEMO);
  const lu = await LIRE();
  sb.__lu = lu;
  const b = evObj(`(() => { const b = _recapBilan(getCls(), __lu, {}); return { obs: b.obs.nouveaux.length, abs: b.abs.nouveaux.length, pun: b.pun.map(x => [x.inc.type, x.inc.objet, x.deja]),
    fiche: b.fiche.map(f => [f.label, f.texte]), sids: b.sids.length, ret: b.obs.retirables.length }; })()`);
  assert.strictEqual(b.sids, 3, 'Zoé, absente de la classe, n\'est rattachée à personne');
  assert.strictEqual(b.obs, 5);
  assert.strictEqual(b.abs, 3);
  assert.deepStrictEqual(b.pun, [['retenue', 'Manquement au règlement intérieur', false]]);
  assert.ok(b.fiche.some(f => f[0] === 'Naissance' && f[1] === '14/03/2013'));
  assert.ok(b.fiche.some(f => f[0] === 'Régime de sortie' && f[1] === 'D2'));
  assert.ok(!b.fiche.some(f => f[0] === 'Demi-pension'), 'le régime de la démo est déjà rempli : rien n\'est remplacé');
  const n = evObj(`(() => { const b = _recapBilan(getCls(), __lu, {}); pushUndo(); return _recapAppliquer(b, { obs: true, abs: true, retObs: new Set(), retAbs: new Set(),
    pun: new Set(b.pun.map(x => x.cle)), fiche: new Set(b.fiche.map(f => f.cle)) }); })()`);
  assert.deepStrictEqual([n.obs, n.abs, n.pun], [5, 3, 1]);
  const s0 = evObj(`(() => { const s = S.eleves[getCls().eleves[0]]; return { nais: s.naissance, inc: s.incidents.map(i => [i.type, i.texte]), abs: s.absMbn.length, obs: s.obsMbn.length }; })()`);
  assert.strictEqual(s0.nais, '2013-03-14');
  assert.match(s0.inc[0][1], /État : Réalisée · Demandeur : Vie scolaire/);
  // Réimport du même PDF : rien de neuf.
  const b2 = evObj(`(() => { const b = _recapBilan(getCls(), __lu, {}); return [b.obs.nouveaux.length, b.obs.connus, b.abs.nouveaux.length, b.abs.modifies.length, b.abs.connus, b.pun.filter(x => !x.deja).length, b.fiche.filter(f => f.champ !== 'tags').length]; })()`);
  assert.deepStrictEqual(b2, [0, 5, 0, 0, 3, 0, 0]);
  // Une absence régularisée depuis : le réimport la MET À JOUR.
  ev(`S.eleves[getCls().eleves[0]].absMbn[0].regul = true`);
  const m = evObj(`(() => { const b = _recapBilan(getCls(), __lu, {}); return b.abs.modifies.map(x => x.champs); })()`);
  assert.deepStrictEqual(m, [['regul']]);
});

test('observations : une observation de l\'export .xlsx (avec heure et texte) est reconnue ; un retrait n\'est proposé que dans la période et pour un élève du récapitulatif', async () => {
  ev(DEMO);
  sb.__lu = await LIRE();
  ev(`(() => { const cls = getCls(); S.eleves[cls.eleves[0]].obsMbn = [
    { id: 'x1', date: '2025-09-09', heure: '10:05', type: 'Observation négative', motif: 'Travail non fait', par: 'Mme Beta', info: 'Exercices' },
    { id: 'x2', date: '2025-09-30', heure: '', type: 'Observation négative', motif: 'Insolence', par: '', info: '' },
    { id: 'x3', date: '2025-12-01', heure: '', type: 'Observation négative', motif: 'Bavardage', par: '', info: '' }];
    S.eleves[cls.eleves[5]].obsMbn = [{ id: 'x4', date: '2025-09-30', heure: '', type: 'Observation négative', motif: 'Bavardage', par: '', info: '' }]; })()`);
  const b = evObj(`(() => { const b = _recapBilan(getCls(), __lu, {}); return { connus: b.obs.connus, ret: b.obs.retirables.map(x => x.ev.id), nouveaux: b.obs.nouveaux.length }; })()`);
  assert.strictEqual(b.connus, 1, 'même date, même motif : déjà là');
  assert.deepStrictEqual(b.ret, ['x2'], 'x3 est hors période, x4 est à un élève absent du récapitulatif');
  assert.strictEqual(b.nouveaux, 4);
});

test('rattachement manuel : un nom inconnu se rattache, ou reste ignoré', async () => {
  ev(DEMO);
  sb.__lu = await LIRE();
  const r = evObj(`(() => { const cls = getCls(), cible = cls.eleves[7];
    const b = _recapBilan(cls, __lu, { 'Zoé INCONNUE': cible });
    return { sids: b.sids.length, zoe: b.obs.nouveaux.filter(x => x.sid === cible).map(x => x.ev.motif) }; })()`);
  assert.deepStrictEqual(r, { sids: 4, zoe: ['Bavardage'] });
});

test('absences : le compte d\'une période, la colonne seulement quand la classe en a, l\'import branché', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[9];
    return { res: _absMbnResume(sid, '0000-01-01', '9999-12-31'), txt: _absResumeTexte(_absMbnResume(sid, '0000-01-01', '9999-12-31')), any: _absMbnClasseAny(cls) }; })()`);
  assert.deepStrictEqual([r.res.n, r.res.min, r.res.ret, r.res.aRegul], [1, 690, 2, 1]);
  assert.strictEqual(r.txt, '1 absence (11 h 30) · 2 retards · 1 à régulariser');
  assert.ok(r.any);
  assert.match(SRC, /c\.key !== 'abs' \|\| _absMbnClasseAny\(cls\)/);
  assert.match(SRC, /b\('openRecapImport\(\)', '📥 Importer…'\)/);
  assert.match(SRC, /onclick="closeMod2\('mobsmbn'\);openRecapImport\(\)"/);
  // Une entrée abîmée est écartée au chargement.
  ev(`(() => { const s = S.eleves[getCls().eleves[0]]; s.absMbn = [{ kind: 'absence', debut: '2025-09-01' }, { kind: 'zzz', debut: '2025-09-01' }, 'x', { kind: 'retard', debut: 'n/a' }]; postLoadHook(); })()`);
  assert.strictEqual(ev(`S.eleves[getCls().eleves[0]].absMbn.length`), 1);
});
