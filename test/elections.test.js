// Élection des délégués — l'arithmétique, écrite AVANT la grille.
// ⚠️ Les suffrages exprimés se comptent en BULLETINS, pas en voix : avec deux noms par
// bulletin, compter en voix diviserait tous les pourcentages par deux et personne ne
// serait jamais élu au premier tour. C'est l'erreur silencieuse la plus probable du projet.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Classe de 25, quatre binômes candidats, un tour ouvert. `B(...)` ajoute des bulletins.
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:[], ord:0 }; S.cur = '5C';
  for (let i = 1; i <= 25; i++) { const id = 's' + i; S.eleves[id] = { id, nom: 'N' + i, prenom: 'P' + i, classe_id: '5C', tags: [] }; S.classes['5C'].eleves.push(id); }
  S.eleves.s26 = { id:'s26', nom:'PARTI', prenom:'X', classe_id:'5C', tags:[], departureDate:'2025-09-20' }; S.classes['5C'].eleves.push('s26');
  // ⚠️ PLURINOMINALE à dessein (deux noms par bulletin) : c'est le cas arithmétiquement
  // piégeux (exprimés en bulletins, pas en voix), et un réglage — plus le défaut (v1.30.0).
  const el = electionCreate('5C', { date: '2025-10-07', titre: 'Test', nomsParBulletin: 2 });
  ['c1','c2','c3','c4'].forEach((id, i) => el.candidats.push({ id, sidTitulaire: 's' + (i+1), sidSuppleant: 's' + (i+11), nomTitulaire: 'T' + (i+1), nomSuppleant: 'S' + (i+1), color: '#16a085', ordre: i, retire: false }));
  el.tours[0].candidats = ['c1','c2','c3','c4'];
  window.EL = el;
  window.B = (...bs) => { for (const b of bs) electionAddBulletin(EL, 0, Array.isArray(b) ? b : b.voix, Array.isArray(b) ? null : b); };`;

// ─────────────────────────────────────────────── Création et modalités

test('electionCreate : modalités par défaut = les textes (uninominal, binômes) ; le plurinominal reste un réglage', () => {
  ev(FIXTURE);
  // Le DÉFAUT (v1.30.0, arbitré par l'utilisateur) : UN nom par bulletin, comme R421-28.
  assert.strictEqual(evObj(`(() => { const e = electionCreate('5C', { date: '2025-10-07' }); delete S.elections['5C'][e.id]; return e.nomsParBulletin; })()`), 1);
  // Et la fixture, elle, demande explicitement deux noms.
  const el = evObj(`EL`);
  assert.deepStrictEqual(
    { nbT: el.nbTitulaires, nbS: el.nbSupplants, binome: el.binome, npb: el.nomsParBulletin, maj: el.majoriteAbsolueT1, dep: el.departage, clos: el.clos, tours: el.tours.length, sieges: el.tours[0].siegesAPourvoir },
    { nbT: 2, nbS: 2, binome: true, npb: 2, maj: true, dep: 'plusJeune', clos: false, tours: 1, sieges: 2 });
  // Inscrits = effectif présent à la date de l'élection : s26 parti le 20/09 n'y est pas.
  assert.strictEqual(el.inscrits, 25);
  assert.strictEqual(ev(`Object.keys(S.elections['5C']).length`), 1);
});

// ─────────────────────────────────────────────── Statut d'un bulletin

test('statut déduit : 0 nom → blanc, trop de noms → nul, sinon valide ; nul forcé avec motif', () => {
  ev(FIXTURE);
  ev(`B([], ['c1'], ['c1','c2'], ['c1','c2','c3'], { voix: ['c1'], nul: true, motifNul: 'inscription inappropriée' })`);
  const st = evObj(`EL.tours[0].bulletins.map(b => _elStatut(b, EL))`);
  assert.deepStrictEqual(st, ['blanc', 'valide', 'valide', 'nul', 'nul']);
  assert.strictEqual(ev(`EL.tours[0].bulletins[4].motifNul`), 'inscription inappropriée');
  // Numérotés dans l'ordre de saisie, comme la colonne A de son classeur.
  assert.deepStrictEqual([...ev(`EL.tours[0].bulletins.map(b => b.n)`)], [1, 2, 3, 4, 5]);
});

test('un même nom écrit deux fois sur un bulletin compte UNE voix, et le bulletin reste valide', () => {
  ev(FIXTURE);
  ev(`B(['c1','c1'])`);
  assert.deepStrictEqual([...ev(`EL.tours[0].bulletins[0].voix`)], ['c1']);
  assert.strictEqual(ev(`_elStatut(EL.tours[0].bulletins[0], EL)`), 'valide');
});

// ─────────────────────────────────────────────── Dépouillement

test('exprimés = votants − blancs − nuls, en BULLETINS ; voix = bulletins valides portant le nom', () => {
  ev(FIXTURE);
  // 10 bulletins : 6 valides à deux noms, 1 valide à un nom, 2 blancs, 1 nul (3 noms).
  ev(`B(['c1','c2'],['c1','c2'],['c1','c3'],['c1','c3'],['c2','c3'],['c2','c4'],['c1'],[],[],['c1','c2','c3'])`);
  const d = evObj(`_elDepouillement(EL, 0)`);
  assert.strictEqual(d.votants, 10);
  assert.strictEqual(d.blancs, 2);
  assert.strictEqual(d.nuls, 1);
  assert.strictEqual(d.exprimes, 7);                       // pas 13 (le total des voix)
  assert.deepStrictEqual(d.voix, { c1: 5, c2: 4, c3: 3, c4: 1 });
  assert.strictEqual(Object.values(d.voix).reduce((a, b) => a + b, 0), 13);   // ≈ le double des exprimés : le piège
  // Le nul à trois noms n'apporte AUCUNE voix, même à des candidats réels.
});

test('majorité absolue = STRICTEMENT plus de la moitié des exprimés, en entiers', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_elMajoriteAbsolue(24)`), 13);   // pas 12
  assert.strictEqual(ev(`_elMajoriteAbsolue(25)`), 13);
  assert.strictEqual(ev(`_elMajoriteAbsolue(1)`), 1);
  assert.strictEqual(ev(`_elMajoriteAbsolue(0)`), 1);     // sans exprimé, personne n'est élu
  assert.strictEqual(ev(`_elAtteintMajorite(12, 24)`), false);
  assert.strictEqual(ev(`_elAtteintMajorite(13, 24)`), true);
});

// ─────────────────────────────────────────────── Attribution des sièges

test('1er tour : élus = ceux qui atteignent la majorité absolue, dans la limite des sièges', () => {
  ev(FIXTURE);
  // 20 bulletins valides : c1 sur 15, c2 sur 12, c3 sur 8, c4 sur 5 → exprimés 20, majorité 11.
  ev(`for (let i = 0; i < 20; i++) B([ ['c1','c2'],['c1','c2'],['c1','c2'],['c1','c3'],['c2','c3'],['c1','c4'],['c1','c2'],['c1','c3'],['c2','c3'],['c1','c4'] ][i % 10])`);
  const r = evObj(`_elResultatTour(EL, 0)`);
  assert.deepStrictEqual(r.elus, ['c1', 'c2']);
  assert.strictEqual(r.siegesRestants, 0);
  assert.strictEqual(r.egalite, null);
});

test('⚠️ un tour peut ne pourvoir QU\'UN siège sur deux — le second tour porte sur le reste', () => {
  ev(FIXTURE);
  // 10 valides : c1 sur 8, c2 sur 4, c3 sur 4, c4 sur 4 → majorité 6 : seul c1 passe.
  ev(`B(['c1','c2'],['c1','c2'],['c1','c3'],['c1','c3'],['c1','c4'],['c1','c4'],['c1','c2'],['c1','c3'],['c2','c4'],['c4','c3'])`);
  const r = evObj(`_elResultatTour(EL, 0)`);
  assert.deepStrictEqual(r.elus, ['c1']);
  assert.strictEqual(r.siegesRestants, 1);
  // Clôture : le 2nd tour est ouvert sur 1 siège, avec les non-élus non retirés.
  const c = evObj(`(() => { const w = electionCloreTour(EL, 0); return { w, tours: EL.tours.length, sieges: EL.tours[1].siegesAPourvoir, cands: EL.tours[1].candidats, elus: EL.elus, clos: EL.clos }; })()`);
  assert.strictEqual(c.tours, 2);
  assert.strictEqual(c.sieges, 1);
  assert.deepStrictEqual(c.cands, ['c2', 'c3', 'c4']);
  assert.deepStrictEqual(c.elus.titulaires, ['c1']);
  assert.deepStrictEqual(c.elus.suppleants, ['c1']);      // binôme : le suppléant est élu AVEC son titulaire
  assert.strictEqual(c.clos, false);                       // l'élection n'est pas finie
});

test('2nd tour : majorité RELATIVE — les mieux placés prennent les sièges restants', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c3'],['c1','c3'],['c1','c4'],['c1','c4'],['c1','c2'],['c1','c3'],['c2','c4'],['c4','c3']); electionCloreTour(EL, 0);`);
  // T2 : c3 sur 3 bulletins, c2 sur 2, c4 sur 1 — aucune majorité absolue, c3 élu quand même.
  ev(`electionAddBulletin(EL, 1, ['c3']); electionAddBulletin(EL, 1, ['c3']); electionAddBulletin(EL, 1, ['c3','c2']); electionAddBulletin(EL, 1, ['c2']); electionAddBulletin(EL, 1, ['c4']); electionAddBulletin(EL, 1, []);`);
  const r = evObj(`_elResultatTour(EL, 1)`);
  assert.deepStrictEqual(r.elus, ['c3']);
  const c = evObj(`(() => { electionCloreTour(EL, 1); return { elus: EL.elus, clos: EL.clos, tours: EL.tours.length }; })()`);
  assert.deepStrictEqual(c.elus.titulaires, ['c1', 'c3']);
  assert.strictEqual(c.clos, true);
  assert.strictEqual(c.tours, 2);                          // pas de 3e tour
});

test('égalité sur le DERNIER siège attribuable → signalée, pas tranchée en silence', () => {
  ev(FIXTURE);
  // c1 majorité nette ; c2 et c3 à égalité au-dessus de la majorité, un seul siège pour eux deux.
  // 11 valides : c1×9, c2×7, c3×7, c4×0 → majorité 6 ; c2 et c3 à 7, un seul siège restant.
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c3'],['c1','c3'],['c1','c3'],['c2','c3'],['c2','c3'],['c1','c2'],['c1','c3'],['c1','c2'],['c3','c2'],['c3']);`);
  const d = evObj(`_elDepouillement(EL, 0).voix`);
  assert.strictEqual(d.c2, d.c3, 'le fixture doit produire une égalité');
  const r = evObj(`_elResultatTour(EL, 0)`);
  assert.deepStrictEqual(r.elus, ['c1']);
  assert.deepStrictEqual(r.egalite, { candIds: ['c2', 'c3'], sieges: 1 });
  // Sans date de naissance, « plus jeune » ne peut pas trancher : clore refuse et le dit.
  const w = evObj(`electionCloreTour(EL, 0)`);
  assert.ok(w.bloque, 'la clôture doit être bloquée');
  assert.match(w.warnings.join(' '), /égalité/i);
  // Tranché à la main : c3.
  ev(`EL.departageManuel = { 1: ['c3'] }`);
  assert.deepStrictEqual(evObj(`_elResultatTour(EL, 0)`).elus, ['c1', 'c3']);
  assert.strictEqual(evObj(`_elResultatTour(EL, 0)`).egalite, null);
});

test('égalité qui ne touche PAS le dernier siège : aucun départage demandé', () => {
  ev(FIXTURE);
  // c1 et c2 à égalité, tous deux élus : 2 sièges, 2 candidats à égalité au-dessus → pas d'égalité à trancher.
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2'],['c3'])`);
  const r = evObj(`_elResultatTour(EL, 0)`);
  assert.deepStrictEqual(r.elus.sort(), ['c1', 'c2']);
  assert.strictEqual(r.egalite, null);
});

test('un candidat retiré entre les deux tours ne figure pas au second', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c3'],['c1','c3'],['c1','c4'],['c1','c4'],['c1','c2'],['c1','c3'],['c2','c4'],['c4','c3']); EL.candidats[3].retire = true; electionCloreTour(EL, 0);`);
  assert.deepStrictEqual([...ev(`EL.tours[1].candidats`)], ['c2', 'c3']);
});

test('clôture : un écart entre bulletins annoncés et dépouillés est SIGNALÉ (pas bloquant)', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 12; B(['c1','c2'],['c1','c2'],['c1','c2'],['c1'],['c1','c2'],['c1','c2'],['c1','c2'],['c2'],['c1','c2'],['c1','c2'])`);
  const w = evObj(`electionCloreTour(EL, 0)`);
  assert.ok(!w.bloque);
  assert.match(w.warnings.join(' '), /12 .*10|annonc/i);
  assert.strictEqual(ev(`EL.tours[0].clos`), true);
});

test('un tour clos refuse toute nouvelle saisie', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0);`);
  assert.strictEqual(ev(`electionAddBulletin(EL, 0, ['c3'])`), null);
  assert.strictEqual(ev(`EL.tours[0].bulletins.length`), 3);
});

// ─────────────────────────────────────────────── Projection en direct

test('_elLive : les barres sont des VOIX ; le pourcentage porte sur les bulletins dépouillés, avec son dénominateur', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 24; B(['c1','c2'],['c1'],[],['c2','c3'])`);
  const L = evObj(`_elLive(EL, 0)`);
  assert.strictEqual(L.depouilles, 4);
  assert.strictEqual(L.votantsAnnonces, 24);
  assert.strictEqual(L.axeMax, 24);                       // axe fixe, gradué sur les votants annoncés
  const c1 = L.candidats.find(c => c.id === 'c1');
  assert.strictEqual(c1.voix, 2);
  assert.strictEqual(c1.pct, 50);                         // 2 sur 4 bulletins dépouillés, pas sur 24
  assert.strictEqual(L.denominateurPct, 4);
});

test('⚠️ le pourcentage d\'un candidat peut BAISSER alors que ses voix montent — comportement figé', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 24; B(['c1'])`);
  const a = evObj(`_elLive(EL, 0).candidats.find(c => c.id === 'c1')`);
  ev(`B(['c2'], ['c1','c2'])`);
  const b = evObj(`_elLive(EL, 0).candidats.find(c => c.id === 'c1')`);
  assert.strictEqual(a.voix, 1); assert.strictEqual(a.pct, 100);
  assert.strictEqual(b.voix, 2); assert.strictEqual(b.pct, 67);   // 2/3 : plus de voix, moins de pourcents
  assert.ok(b.voix > a.voix && b.pct < a.pct, 'ne PAS « corriger » ceci : c\'est arithmétiquement normal');
});

test('« déjà élu » ⇔ voix × 2 > votants annoncés — et RIEN d\'autre ne le déclenche', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 10; for (let i = 0; i < 5; i++) B(['c1','c2'])`);
  let L = evObj(`_elLive(EL, 0)`);
  assert.strictEqual(L.candidats.find(c => c.id === 'c1').dejaElu, false);   // 5 × 2 = 10, pas STRICTEMENT plus
  // c1 est à 100 % des dépouillés : ça ne suffit pas.
  assert.strictEqual(L.candidats.find(c => c.id === 'c1').pct, 100);
  ev(`B(['c1'])`);
  L = evObj(`_elLive(EL, 0)`);
  assert.strictEqual(L.candidats.find(c => c.id === 'c1').dejaElu, true);    // 6 × 2 = 12 > 10
  assert.strictEqual(L.candidats.find(c => c.id === 'c2').dejaElu, false);
  // Sans annonce des votants, aucun verdict anticipé n'est possible.
  ev(`EL.tours[0].votantsAnnonces = null`);
  assert.ok(evObj(`_elLive(EL, 0)`).candidats.every(c => c.dejaElu === false));
});

test('la ligne de majorité ne peut que DESCENDRE : chaque blanc ou nul la fait baisser', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 24`);
  assert.strictEqual(evObj(`_elLive(EL, 0)`).seuilProjete, 13);     // 24 exprimés au plus → 13
  ev(`B(['c1','c2'])`);
  assert.strictEqual(evObj(`_elLive(EL, 0)`).seuilProjete, 13);     // un valide ne change rien
  ev(`B([])`);
  assert.strictEqual(evObj(`_elLive(EL, 0)`).seuilProjete, 12);     // 23 exprimés au plus → 12
  ev(`B(['c1','c2','c3','c4'])`);
  assert.strictEqual(evObj(`_elLive(EL, 0)`).seuilProjete, 12);     // 22 → 12
  ev(`B([])`);
  assert.strictEqual(evObj(`_elLive(EL, 0)`).seuilProjete, 11);     // 21 → 11
});

test('⚠️ aucun « éliminé » n\'est jamais émis en cours de dépouillement', () => {
  ev(FIXTURE);
  ev(`EL.tours[0].votantsAnnonces = 10; for (let i = 0; i < 9; i++) B(['c1','c2'])`);
  const txt = JSON.stringify(evObj(`_elLive(EL, 0)`));
  assert.doesNotMatch(txt, /elimin/i);
  assert.ok(!Object.keys(evObj(`_elLive(EL, 0).candidats[0]`)).some(k => /elim/i.test(k)));
});

test('_elLive ne projette JAMAIS le numéro de bulletin', () => {
  ev(FIXTURE);
  ev(`B(['c1'], ['c2'])`);
  const L = evObj(`_elLive(EL, 0)`);
  assert.strictEqual(L.bulletins, undefined);
  assert.doesNotMatch(JSON.stringify(L), /"n":/);
});

// ─────────────────────────────────────────────── Délégués dérivés

test('_delegueOf : dérivé de l\'élection close la plus récente, jamais stocké sur l\'élève', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0);`);
  assert.strictEqual(ev(`EL.clos`), true);
  assert.strictEqual(ev(`_delegueOf('s1')`), 'titulaire');     // c1 titulaire
  assert.strictEqual(ev(`_delegueOf('s11')`), 'suppleant');    // suppléant de c1
  assert.strictEqual(ev(`_delegueOf('s3')`), null);
  assert.strictEqual(ev(`'delegue' in S.eleves.s1`), false);   // rien n'est écrit sur l'élève
  // Une correction du dépouillement se répercute d'elle-même.
  ev(`EL.elus.titulaires = ['c3']; EL.elus.suppleants = ['c3'];`);
  assert.strictEqual(ev(`_delegueOf('s1')`), null);
  assert.strictEqual(ev(`_delegueOf('s3')`), 'titulaire');
});

test('la suppression d\'un élève laisse l\'élection intacte, identité figée lisible', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0); _purgeStudentRefs('s1');`);
  assert.strictEqual(ev(`EL.candidats[0].sidTitulaire`), 's1');
  assert.strictEqual(ev(`_elCandNom(EL.candidats[0])`), 'T1');
  assert.deepStrictEqual([...ev(`_auditState()`)], []);
});

test('sans candidat restant, pas de second tour vide : l\'élection se clôt, siège vacant signalé', () => {
  ev(FIXTURE);
  ev(`EL.candidats.splice(1); EL.tours[0].candidats = ['c1']; B(['c1'], ['c1'], ['c1'])`);
  const w = evObj(`electionCloreTour(EL, 0)`);
  assert.strictEqual(ev(`EL.tours.length`), 1);
  assert.strictEqual(ev(`EL.clos`), true);
  assert.match(w.warnings.join(' '), /vacant.*faute de candidat/);
});

test('_nomHTML : le nom surligné selon le mandat, vert titulaire / jaune suppléant', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0);`);
  assert.match(ev(`_nomHTML('s1', S.eleves.s1.nom, S.eleves.s1.prenom)`), /^<span class="nom del-t" title="Délégué titulaire/);
  assert.match(ev(`_nomHTML('s11', S.eleves.s11.nom, S.eleves.s11.prenom)`), /^<span class="nom del-s" title="Délégué suppléant/);
  // Sans mandat : ni classe ni infobulle — et le nom est échappé.
  assert.strictEqual(ev(`_nomHTML('s3', '<b>X</b>', 'Y&Z')`), '<span class="nom"><strong>&lt;b&gt;X&lt;/b&gt;</strong> Y&amp;Z</span>');
  // Une correction du dépouillement se répercute sur le surlignage, puisque rien n'est stocké.
  ev(`EL.elus.titulaires = ['c3']; EL.elus.suppleants = ['c3'];`);
  assert.match(ev(`_nomHTML('s1', 'A', 'B')`), /^<span class="nom">/);
});

// ─────────────────────────────── Délégués désignés sans vote

test('deleguesSet : roster seulement, un rôle par élève, date obligatoire ; deleguesClear', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`deleguesSet(S.classes['5C'], { date: 'hier', titulaires: ['s1'] })`), false);
  assert.strictEqual(ev(`deleguesSet(S.classes['5C'], { date: '2025-10-01', titulaires: [], suppleants: [] })`), false);
  assert.strictEqual(ev(`deleguesSet(S.classes['5C'], { date: '2025-10-01', titulaires: ['s1', 'fantome', 's1'], suppleants: ['s1', 's3'], note: ' PV papier ' })`), true);
  assert.deepStrictEqual(evObj(`S.classes['5C'].delegues`), { date: '2025-10-01', titulaires: ['s1'], suppleants: ['s3'], note: 'PV papier', pv: null });
  // Le PV signé joint survit à une correction des noms ; _pjReferences le compte.
  ev(`S.classes['5C'].delegues.pv = { nom: 'PV.pdf', fichier: 'pv-5C-PV.pdf', taille: 12 };
      deleguesSet(S.classes['5C'], { date: '2025-10-02', titulaires: ['s2'], suppleants: [] });`);
  assert.deepStrictEqual(evObj(`S.classes['5C'].delegues.pv`), { nom: 'PV.pdf', fichier: 'pv-5C-PV.pdf', taille: 12 });
  assert.ok(evObj(`[..._pjReferences()]`).includes('pv-5C-PV.pdf'));
  ev(`EL.pv = { nom: 'PV élection.pdf', fichier: 'pv-el1-PV_election.pdf', taille: 12 };`);
  assert.ok(evObj(`[..._pjReferences()]`).includes('pv-el1-PV_election.pdf'), "le PV d'une élection aussi");
  assert.strictEqual(ev(`deleguesClear(S.classes['5C'])`), true);
  assert.strictEqual(ev(`S.classes['5C'].delegues`), undefined);
  assert.strictEqual(ev(`deleguesClear(S.classes['5C'])`), false);
});

test('_delegueOf : la désignation directe vaut sans élection, et la plus récente des deux fait foi', () => {
  ev(FIXTURE);
  // Sans aucune élection : la désignation seule.
  ev(`deleguesSet(S.classes['5C'], { date: '2025-10-01', titulaires: ['s1'], suppleants: ['s3'] })`);
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s3'), _delegueOf('s2')]`), ['titulaire', 'suppleant', null]);
  // Une élection close PLUS RÉCENTE l'emporte.
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0); EL.date = '2025-10-15';`);
  assert.strictEqual(ev(`EL.clos`), true);
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s11'), _delegueOf('s3')]`), ['titulaire', 'suppleant', null]);
  // Une désignation PLUS RÉCENTE que l'élection reprend la main (démission, reprise de classe).
  ev(`deleguesSet(S.classes['5C'], { date: '2026-01-10', titulaires: ['s3'], suppleants: [] })`);
  assert.deepStrictEqual(evObj(`[_delegueOf('s3'), _delegueOf('s1'), _delegueOf('s11')]`), ['titulaire', null, null]);
  // Le même jour : la désignation l'emporte (>=), c'est le geste le plus délibéré.
  ev(`S.classes['5C'].delegues.date = '2025-10-15';`);
  assert.strictEqual(ev(`_delegueOf('s3')`), 'titulaire');
});

test('_purgeStudentRefs retire un délégué désigné, et la désignation vide disparaît', () => {
  ev(FIXTURE);
  ev(`deleguesSet(S.classes['5C'], { date: '2025-10-01', titulaires: ['s1'], suppleants: ['s3'] }); _purgeStudentRefs('s1');`);
  assert.deepStrictEqual(evObj(`S.classes['5C'].delegues.titulaires`), []);
  ev(`_purgeStudentRefs('s3');`);
  assert.strictEqual(ev(`S.classes['5C'].delegues`), undefined);
});

// ─────────────────────────────── Éco-délégués (v1.27.0)

test('electionCreate type eco : UN élu, sans binôme ni suppléant, un nom par bulletin (les textes) ; un fichier ancien vaut délégués', () => {
  ev(FIXTURE);
  // Circulaire n° 2019-121 § 1.2 : « l'élection, dans chaque classe, d'un éco-délégué … selon
  // les mêmes modalités » que les délégués (uninominal à deux tours) ; aucun suppléant.
  const eco = evObj(`electionCreate('5C', { type: 'eco', date: '2025-10-14' })`);
  assert.deepStrictEqual([eco.type, eco.nbTitulaires, eco.nbSupplants, eco.binome, eco.nomsParBulletin, eco.titre], ['eco', 1, 0, false, 1, 'Élection des éco-délégués — 5C — 2025-26']);
  // Deux si l'établissement le décide : un réglage, pas une constante.
  assert.deepStrictEqual(evObj(`(e => [e.nbTitulaires, e.nomsParBulletin])(electionCreate('5C', { type: 'eco', nbTitulaires: 2, nomsParBulletin: 2 }))`), [2, 2]);
  // Chaque mandat cite ses textes, avec un lien https, et le HTML les échappe.
  for (const k of ['delegues', 'eco']) {
    const t = evObj(`_EL_TYPES.${k}.textes`);
    assert.ok(t.length >= 2 && t.every(x => /^https:\/\/(www\.)?(legifrance|education|service-public)\.gouv\.fr\//.test(x.url) && x.ref && x.quoi), k);
  }
  assert.ok(ev(`_elTextesHTML(_EL_TYPES.eco)`).includes('rel="noopener"'));
  assert.ok(ev(`_elTextesHTML({ textes: [{ ref: 'a<b', quoi: 'x"y', url: 'https://x/"' }] })`).includes('a&lt;b'), 'échappé');
  assert.strictEqual(evObj(`_elType(EL).key`), 'delegues');
  assert.strictEqual(evObj(`_elType({ type: 'zut' }).key`), 'delegues', 'type inconnu → délégués');
  // nbSupplants absent (fichier antérieur) = autant que de titulaires ; 0 est une valeur.
  assert.strictEqual(evObj(`_elNbSup({ nbTitulaires: 3 })`), 3);
  assert.strictEqual(evObj(`_elNbSup({ nbTitulaires: 3, nbSupplants: 0 })`), 0);
  // Hors binôme, 2 titulaires et 1 suppléant : c'est possible aussi.
  const mixte = evObj(`electionCreate('5C', { type: 'delegues', binome: false, nbSupplants: 1 })`);
  assert.deepStrictEqual([mixte.binome, mixte.nbSupplants], [false, 1]);
  // En binôme, les suppléants suivent les titulaires quoi qu'on demande.
  assert.strictEqual(evObj(`electionCreate('5C', { binome: true, nbTitulaires: 2, nbSupplants: 0 }).nbSupplants`), 2);
});

test('éco-délégué élu : scrutin uninominal, un élu au premier tour, AUCUN suppléant ; _ecoDelegueOf le voit, _delegueOf non', () => {
  ev(FIXTURE);
  ev(`window.ECO = electionCreate('5C', { type: 'eco', date: '2025-10-14' });
      ['e1','e2','e3'].forEach((id, i) => ECO.candidats.push({ id, sidTitulaire: 's' + (i+20), sidSuppleant: null, nomTitulaire: 'E' + i, nomSuppleant: '', color: '#16a085', ordre: i, retire: false }));
      ECO.tours[0].candidats = ['e1','e2','e3'];
      for (let i = 0; i < 9; i++) electionAddBulletin(ECO, 0, ['e1']);
      for (let i = 0; i < 5; i++) electionAddBulletin(ECO, 0, ['e2']);
      for (let i = 0; i < 2; i++) electionAddBulletin(ECO, 0, ['e3']);
      electionCloreTour(ECO, 0);`);
  // 9 voix sur 16 exprimés : majorité absolue (9 × 2 = 18 > 16), un seul siège, élection close.
  assert.deepStrictEqual(evObj(`[ECO.clos, ECO.tours.length, ECO.elus.titulaires, ECO.elus.suppleants]`), [true, 1, ['e1'], []]);
  // Deux noms sur un bulletin à un nom : nul, déduit.
  assert.strictEqual(ev(`_elStatut(electionAddBulletin(ECO, 0, ['e1','e2']) || { voix: ['e1','e2'] }, ECO)`), 'nul');
  assert.deepStrictEqual(evObj(`['s20','s21','s22'].map(_ecoDelegueOf)`), ['titulaire', null, null]);
  assert.deepStrictEqual(evObj(`['s20','s21','s22'].map(sid => _delegueOf(sid))`), [null, null, null], 'un éco-délégué n’est pas délégué de classe');
  // Et l'inverse : clore l'élection des délégués ne fait pas d'éco-délégués.
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0);`);
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _ecoDelegueOf('s1')]`), ['titulaire', null]);
  assert.ok(ev(`_nomHTML('s20', 'A', 'B')`).includes('🌱') && !ev(`_nomHTML('s20', 'A', 'B')`).includes('del-t'));
  assert.ok(ev(`_nomHTML('s1', 'A', 'B')`).includes('del-t') && !ev(`_nomHTML('s1', 'A', 'B')`).includes('🌱'));
});

test('éco-délégués désignés sans vote : cls.ecoDelegues, même arbitrage par la date, purge', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`deleguesSet(S.classes['5C'], { date: '2025-10-01', titulaires: ['s5'], suppleants: ['s6'] }, 'eco')`), true);
  assert.deepStrictEqual(evObj(`[S.classes['5C'].ecoDelegues.titulaires, 'delegues' in S.classes['5C']]`), [['s5'], false], 'la désignation éco ne touche pas celle des délégués');
  assert.deepStrictEqual(evObj(`[_ecoDelegueOf('s5'), _ecoDelegueOf('s6'), _delegueOf('s5')]`), ['titulaire', 'suppleant', null]);
  ev(`_purgeStudentRefs('s5');`);
  assert.deepStrictEqual(evObj(`[S.classes['5C'].ecoDelegues.titulaires, S.classes['5C'].ecoDelegues.suppleants]`), [[], ['s6']]);
  ev(`_purgeStudentRefs('s6');`);
  assert.strictEqual(evObj(`'ecoDelegues' in S.classes['5C']`), false, 'vidée, la désignation disparaît');
  assert.strictEqual(ev(`deleguesClear(S.classes['5C'], 'eco')`), false);
});

// ─────────────────── Remplacement d'un délégué en cours d'année (v1.29.0)

test('electionRemplacer : titulaire parti → son suppléant devient titulaire ; suppléant parti → pas de successeur ; refus des doublons', () => {
  ev(FIXTURE);
  ev(`B(['c1','c2'],['c1','c2'],['c1','c2'],['c1','c2']); electionCloreTour(EL, 0);`);
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s11'), _delegueOf('s2'), _delegueOf('s12')]`), ['titulaire', 'suppleant', 'titulaire', 'suppleant']);
  assert.strictEqual(evObj(`electionRemplacer(EL, { candId: 'c3', qui: 'titulaire', date: '2025-11-05', motif: 'demission' })`), null, 'c3 n’est pas élu');
  assert.strictEqual(evObj(`electionRemplacer(EL, { candId: 'c1', qui: 'titulaire', date: '2025-13-05' })`), null, 'date illisible');
  const r = evObj(`electionRemplacer(EL, { candId: 'c1', qui: 'titulaire', date: '2025-11-05', motif: 'depart', texte: ' déménage ' })`);
  assert.deepStrictEqual([r.nomParti, r.nomRemplacant, r.remplacantCandId, r.motif, r.texte], ['T1', 'S1', 'c1', 'depart', 'déménage']);
  // ⚠️ Le titulaire parti n'est PLUS délégué (avant la v1.29.0, il le restait) ; son suppléant est titulaire.
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s11'), _delegueOf('s2'), _delegueOf('s12')]`), [null, 'titulaire', 'titulaire', 'suppleant']);
  const eff = evObj(`_elEffectifs(EL)`);
  assert.deepStrictEqual(eff.titulaires.map(t => [t.sid, t.promu]), [['s11', true], ['s2', false]]);
  assert.deepStrictEqual(eff.suppleants.map(t => t.sid), ['s12']);
  assert.strictEqual(evObj(`electionRemplacer(EL, { candId: 'c1', qui: 'titulaire', date: '2025-12-01' })`), null, 'le même mandat ne se remplace qu’une fois');
  // Le suppléant de c2 part : pas de successeur, le titulaire reste seul.
  const r2 = evObj(`electionRemplacer(EL, { candId: 'c2', qui: 'suppleant', date: '2026-01-10', motif: 'autre' })`);
  assert.deepStrictEqual([r2.nomParti, r2.remplacantCandId], ['S2', null]);
  assert.deepStrictEqual(evObj(`[_delegueOf('s2'), _delegueOf('s12'), _elEffectifs(EL).suppleants.length]`), ['titulaire', null, 0]);
  // Retirer : tout revient.
  assert.strictEqual(evObj(`electionRemplacementRemove(EL, '${r.id}')`), true);
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s11')]`), ['titulaire', 'suppleant']);
  // Une désignation sans vote plus récente prime toujours.
  ev(`deleguesSet(S.classes['5C'], { date: '2026-02-01', titulaires: ['s5'] });`);
  assert.deepStrictEqual(evObj(`[_delegueOf('s5'), _delegueOf('s11')]`), ['titulaire', null]);
});

test('remplacement sans suppléant (éco-délégué) : le siège est VACANT, et l’élection ne l’invente pas', () => {
  ev(FIXTURE);
  ev(`window.ECO = electionCreate('5C', { type: 'eco', date: '2025-10-14' });
      ['e1','e2'].forEach((id, i) => ECO.candidats.push({ id, sidTitulaire: 's' + (i+20), sidSuppleant: null, nomTitulaire: 'E' + i, nomSuppleant: '', color: '#16a085', ordre: i, retire: false }));
      ECO.tours[0].candidats = ['e1','e2'];
      for (let i = 0; i < 9; i++) electionAddBulletin(ECO, 0, ['e1']);
      for (let i = 0; i < 3; i++) electionAddBulletin(ECO, 0, ['e2']);
      electionCloreTour(ECO, 0);`);
  assert.strictEqual(evObj(`_ecoDelegueOf('s20')`), 'titulaire');
  assert.strictEqual(evObj(`electionRemplacer(ECO, { candId: 'e1', qui: 'suppleant', date: '2026-01-10' })`), null, 'pas de suppléant à faire partir');
  const r = evObj(`electionRemplacer(ECO, { candId: 'e1', qui: 'titulaire', date: '2026-01-10', motif: 'depart' })`);
  assert.strictEqual(r.remplacantCandId, null);
  assert.deepStrictEqual(evObj(`[_ecoDelegueOf('s20'), _elEffectifs(ECO).vacants, _elEffectifs(ECO).titulaires.length]`), [null, 1, 0]);
});

test('remplacement HORS binôme : le suppléant élu choisi prend le siège, une seule fois', () => {
  ev(FIXTURE);
  ev(`window.HB = electionCreate('5C', { binome: false, nbTitulaires: 2, nbSupplants: 2, nomsParBulletin: 2, date: '2025-10-10' });
      ['h1','h2','h3','h4'].forEach((id, i) => HB.candidats.push({ id, sidTitulaire: 's' + (i+1), sidSuppleant: null, nomTitulaire: 'H' + (i+1), nomSuppleant: '', color: '#16a085', ordre: i, retire: false }));
      HB.tours[0].candidats = ['h1','h2','h3','h4'];
      for (let i = 0; i < 10; i++) electionAddBulletin(HB, 0, ['h1','h2']);
      for (let i = 0; i < 3; i++) electionAddBulletin(HB, 0, ['h3']);
      electionAddBulletin(HB, 0, ['h4']);
      electionCloreTour(HB, 0);`);
  assert.deepStrictEqual(evObj(`[HB.elus.titulaires, HB.elus.suppleants]`), [['h1', 'h2'], ['h3', 'h4']]);
  assert.strictEqual(evObj(`electionRemplacer(HB, { candId: 'h1', qui: 'titulaire', date: '2025-12-01', remplacantCandId: 'h2' })`), null, 'h2 n’est pas suppléant');
  const r = evObj(`electionRemplacer(HB, { candId: 'h1', qui: 'titulaire', date: '2025-12-01', remplacantCandId: 'h3' })`);
  assert.strictEqual(r.nomRemplacant, 'H3');
  assert.deepStrictEqual(evObj(`[_delegueOf('s1'), _delegueOf('s3'), _delegueOf('s4'), _elEffectifs(HB).vacants]`), [null, 'titulaire', 'suppleant', 0]);
  assert.strictEqual(evObj(`electionRemplacer(HB, { candId: 'h2', qui: 'titulaire', date: '2026-01-01', remplacantCandId: 'h3' })`), null, 'h3 a déjà pris un siège');
  const r2 = evObj(`electionRemplacer(HB, { candId: 'h2', qui: 'titulaire', date: '2026-01-01' })`);
  assert.deepStrictEqual([r2.remplacantCandId, evObj(`_elEffectifs(HB).vacants`)], [null, 1], 'sans successeur choisi : vacant');
});

// ─────────────────────────────────────────────── Modale : défauts des textes, suppléants réglables

test('modale : le nombre de suppléants reste réglable en binôme — le binôme se défait, ne refuse pas ; ↺ remet les défauts des textes', () => {
  ev(FIXTURE);
  // Des éléments PERSISTANTS par id (le stub du harnais en rend un neuf à chaque appel).
  ev(`window.__reg = {}; window.__gebi = document.getElementById;
      document.getElementById = id => window.__reg[id] || (window.__reg[id] = { value: '', checked: false, disabled: false, textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
      const g = document.getElementById; g('mel-type').value = 'delegues'; g('mel-nbt').value = '2'; g('mel-binome').checked = true; g('mel-nbs').value = '2';`);
  try {
    // Choisir un AUTRE nombre de suppléants en binôme → le binôme se décoche (et un toast le dit).
    ev(`document.getElementById('mel-nbs').value = '1'; _elNbsChange()`);
    assert.strictEqual(evObj(`[document.getElementById('mel-binome').checked, document.getElementById('mel-nbs').value]`).join(), 'false,1');
    assert.ok(evObj(`document.getElementById('toast').textContent`).includes('binôme'));
    // Recocher le binôme aligne les suppléants ; changer les titulaires en binôme les fait suivre.
    ev(`document.getElementById('mel-binome').checked = true; _elBinomeChange()`);
    assert.strictEqual(ev(`document.getElementById('mel-nbs').value`), '2');
    ev(`document.getElementById('mel-nbt').value = '3'; _elNbtChange()`);
    assert.strictEqual(ev(`document.getElementById('mel-nbs').value`), '3');
    // Hors binôme, le même nombre reste libre : 2 titulaires + 1 suppléant ne défait rien.
    ev(`document.getElementById('mel-binome').checked = false; document.getElementById('mel-nbs').value = '1'; _elNbsChange()`);
    assert.strictEqual(ev(`document.getElementById('mel-binome').checked`), false);
    // ↺ Défauts des textes : ceux de _EL_TYPES, et rien d'autre — le texte les décrit.
    ev(`document.getElementById('mel-npb').value = '2'; document.getElementById('mel-maj').checked = false; document.getElementById('mel-dep').value = 'manuel'; _elDefautsReset()`);
    assert.deepStrictEqual(evObj(`(g => [g('mel-nbt').value, g('mel-binome').checked, g('mel-nbs').value, g('mel-npb').value, g('mel-maj').checked, g('mel-dep').value])(document.getElementById)`), [2, true, 2, 1, true, 'plusJeune']);
    const hint = ev(`_elDefautsHint(_EL_TYPES.delegues)`);
    assert.ok(/textes/.test(hint) && /2 titulaires/.test(hint) && /chacun avec son suppléant/.test(hint) && /1 nom par bulletin \(uninominal\)/.test(hint), hint);
    const hintEco = ev(`_elDefautsHint(_EL_TYPES.eco)`);
    assert.ok(/1 titulaire,/.test(hintEco) && /sans suppléant/.test(hintEco) && /uninominal/.test(hintEco), hintEco);
    // Verrouillée (dépouillement commencé) : ↺ ne touche à rien.
    ev(`document.getElementById('mel-nbt').disabled = true; document.getElementById('mel-npb').value = '2'; _elDefautsReset()`);
    assert.strictEqual(ev(`document.getElementById('mel-npb').value`), '2');
  } finally {
    ev(`document.getElementById = window.__gebi`);
  }
});

test('Nom écrit sur un bulletin : une colonne de plus en cours de dépouillement, sans suppléant, retirable sans voix', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), t = el.tours[el.tours.length - 1];
    const nb = t.bulletins.length;
    const pris = el.candidats.map(c => c.sidTitulaire);
    const libre = cls.eleves.find(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    const refusCand = electionAddEcrit(el, pris[0]);
    const c = electionAddEcrit(el, libre);
    const deux = electionAddEcrit(el, libre);
    const col = t.candidats.includes(c.id);
    electionAddBulletin(el, el.tours.length - 1, [c.id]);
    const d = _elDepouillement(el, el.tours.length - 1);
    const retireAvecVoix = electionRemoveEcrit(el, c.id);
    electionRemoveBulletin(el, el.tours.length - 1, t.bulletins[t.bulletins.length - 1].n);
    const retireSans = electionRemoveEcrit(el, c.id);
    const pv = (() => { const e2 = _elList(cls.id).find(e => e.clos); const c2 = electionAddEcrit(e2, libre); return c2; })();
    return JSON.stringify({ nb, refusCand, ecrit: c.ecrit, sup: c.sidSuppleant, deux, col, voix: d.voix[c.id], retireAvecVoix, retireSans, apres: el.candidats.some(x => x.id === c.id), clos: pv });
  })()`));
  assert.ok(r.nb > 0, 'le tour a déjà des bulletins');
  assert.strictEqual(r.refusCand, null, 'un candidat déjà inscrit ne se rajoute pas');
  assert.strictEqual(r.ecrit, true);
  assert.strictEqual(r.sup, null, 'sans suppléant');
  assert.strictEqual(r.deux, null, 'une seule colonne par élève');
  assert.ok(r.col, 'colonne du tour en cours, même avec des bulletins');
  assert.strictEqual(r.voix, 1);
  assert.strictEqual(r.retireAvecVoix, false, 'une colonne qui porte une voix ne se retire pas');
  assert.strictEqual(r.retireSans, true);
  assert.strictEqual(r.apres, false);
  assert.strictEqual(r.clos, null, 'élection close : refus');
});

test('Nom d\'un non-candidat : la modalité « nul » annule le bulletin, « compte » (défaut) le garde', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = el.tours.length - 1;
    const libre = cls.eleves.find(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    const c = electionAddEcrit(el, libre);
    const b = electionAddBulletin(el, ti, [c.id]);
    const defaut = _elStatut(b, el);
    el.nonCandidat = 'nul';
    const strict = _elStatut(b, el), voix = _elDepouillement(el, ti).voix[c.id] || 0;
    const autre = electionAddBulletin(el, ti, [el.tours[ti].candidats[0]]);
    return JSON.stringify({ defaut, strict, voix, autre: _elStatut(autre, el) });
  })()`));
  assert.deepStrictEqual(r, { defaut: 'valide', strict: 'nul', voix: 0, autre: 'valide' });
});

test('Élu non candidat : la clôture demande s\'il accepte ; refusé, le siège va au suivant selon la règle du tour', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = el.tours.length - 1, t = el.tours[ti];
    const libre = cls.eleves.find(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    electionPreparerBulletins(el, ti, null);   // les lignes « à lire » de la démo retirées
    const c = electionAddEcrit(el, libre);
    for (let i = 0; i < 40; i++) electionAddBulletin(el, ti, [c.id]);
    t.votantsAnnonces = t.bulletins.length;
    const q = electionCloreTour(el, ti);
    const snap = JSON.stringify(el);
    c.accepte = true;
    const oui = electionCloreTour(el, ti);
    const eluOui = el.elus.titulaires.includes(c.id);
    const el2 = JSON.parse(snap); S.elections[cls.id][el2.id] = el2;
    _elCand(el2, c.id).accepte = false;
    const non = electionCloreTour(el2, ti);
    return JSON.stringify({ bloque: q.bloque, accepter: q.accepter === c.id, ouiBloque: oui.bloque, eluOui, nonBloque: non.bloque,
      eluNon: el2.elus.titulaires.includes(c.id), autres: el2.elus.titulaires.length, second: el2.tours.length });
  })()`));
  assert.strictEqual(r.bloque, true, 'la clôture attend la réponse');
  assert.strictEqual(r.accepter, true);
  assert.strictEqual(r.ouiBloque, false);
  assert.strictEqual(r.eluOui, true, 'il accepte : il est élu');
  assert.strictEqual(r.nonBloque, false);
  assert.strictEqual(r.eluNon, false, 'il refuse : pas de siège');
  assert.ok(r.autres >= 1 || r.second === 2, 'le siège va au suivant, ou à un second tour');
});

test('Suppléant d\'un élu non candidat (binôme) : aucun, élu ensuite ou désigné — il devient le suppléant en exercice', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = el.tours.length - 1, t = el.tours[ti];
    const libres = cls.eleves.filter(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    electionPreparerBulletins(el, ti, null);
    const c = electionAddEcrit(el, libres[0]);
    for (let i = 0; i < 40; i++) electionAddBulletin(el, ti, [c.id]);
    t.votantsAnnonces = t.bulletins.length;
    c.accepte = true;
    electionCloreTour(el, ti);
    let g = 0; while (!el.clos && g++ < 3) { const k = el.tours.length - 1; electionAddBulletin(el, k, [el.tours[k].candidats[0]]); el.tours[k].votantsAnnonces = el.tours[k].bulletins.length; electionCloreTour(el, k); }
    const aucun = _elSupNcTexte(el, c);
    const avant = electionSuppleantNC(el, c.id, { mode: 'designe', sid: libres[1], date: '1999-01-01' });
    const pris = electionSuppleantNC(el, c.id, { mode: 'election', sid: _elCand(el, el.elus.titulaires.find(id => id !== c.id)).sidTitulaire, date: el.date });
    const ok = electionSuppleantNC(el, c.id, { mode: 'election', sid: libres[1], date: el.date });
    const eff = _elEffectifs(el);
    const texte = _elSupNcTexte(el, c);
    const ui = _elSupNcHTML(el);
    const raz = electionSuppleantNC(el, c.id, { mode: 'aucun' });
    return JSON.stringify({ aucun, avant, pris, ok, supEff: eff.suppleants.some(x => x.sid === libres[1]), texte, ui: ui.includes('elsn-m-0'), raz, apres: c.sidSuppleant });
  })()`));
  assert.match(r.aucun, /sans suppléant/);
  assert.strictEqual(r.avant, false, 'pas avant le scrutin');
  assert.strictEqual(r.pris, false, 'pas un élu de cette élection');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.supEff, true, 'il est le suppléant en exercice');
  assert.match(r.texte, /élu par un scrutin le/);
  assert.ok(r.ui, 'le choix est proposé sous les élus');
  assert.strictEqual(r.raz, true);
  assert.strictEqual(r.apres, null, 'revenir à « aucun » retire le suppléant');
});

test('Compte de l\'urne : des lignes « à lire » préparées, qui ne comptent qu\'une fois lues ; un compte plus bas ne retire jamais un bulletin lu', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = 0, t = el.tours[ti];
    const demo = { n: t.bulletins.length, alire: t.bulletins.filter(b => b.lu === false).length, votants: _elDepouillement(el, ti).votants };
    const bloque = electionCloreTour(el, ti).bloque;
    const p = electionPreparerBulletins(el, ti, 30);
    const apres30 = { n: t.bulletins.length, votants: _elDepouillement(el, ti).votants, live: _elLive(el, ti).depouilles };
    const premier = t.bulletins.find(b => b.lu === false);
    electionSetBulletin(el, ti, premier.n, { lu: true });
    const blanc = { st: _elStatut(premier, el), blancs: _elDepouillement(el, ti).blancs, champ: 'lu' in premier };
    const moins = electionPreparerBulletins(el, ti, 5);
    return JSON.stringify({ demo, bloque, p, apres30, blanc, moins, reste: t.bulletins.length, lus: t.bulletins.filter(b => b.lu !== false).length });
  })()`));
  assert.deepStrictEqual(r.demo, { n: 25, alire: 7, votants: 18 }, 'la démo : 18 lus sur 25 préparés');
  assert.strictEqual(r.bloque, true, 'on ne clôt pas avec des bulletins à lire');
  assert.deepStrictEqual(r.p, { ajoutes: 5, retires: 0 });
  assert.deepStrictEqual(r.apres30, { n: 30, votants: 18, live: 18 }, 'les lignes à lire ne sont ni votants ni dépouillés');
  assert.deepStrictEqual(r.blanc, { st: 'blanc', blancs: 2, champ: false }, 'Entrée / Blanc : un bulletin blanc, sans champ « lu »');
  assert.strictEqual(r.moins.retires, 11, 'seules les lignes à lire partent');
  assert.strictEqual(r.reste, 19);
  assert.strictEqual(r.lus, 19, 'aucun bulletin lu retiré, même sous le compte');
});

test('Scrutin du suppléant tenu dans l\'app : une élection rattachée, son élu reporté à la clôture, jamais prise pour l\'élection des délégués', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = 0, t = el.tours[ti];
    electionPreparerBulletins(el, ti, null);
    const libres = cls.eleves.filter(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    const c = electionAddEcrit(el, libres[0]);
    for (let i = 0; i < 40; i++) electionAddBulletin(el, ti, [c.id]);
    t.votantsAnnonces = t.bulletins.length; c.accepte = true;
    electionCloreTour(el, ti);
    let g = 0; while (!el.clos && g++ < 3) { const k = el.tours.length - 1; electionAddBulletin(el, k, [el.tours[k].candidats[0]]); el.tours[k].votantsAnnonces = el.tours[k].bulletins.length; electionCloreTour(el, k); }
    const avant = _delegueOf(c.sidTitulaire);
    const sub = electionCreerScrutinSuppleant(el, c.id);
    const forme = { nbT: sub.nbTitulaires, sup: _elNbSup(sub), binome: sub.binome, npb: sub.nomsParBulletin, supDe: sub.supDe.candId === c.id, enCours: _elSupNcTexte(el, c) };
    const a = electionAddCandidat(sub, libres[1], null), b = electionAddCandidat(sub, libres[2], null);
    electionPreparerBulletins(sub, 0, 5);
    [[a.id], [a.id], [a.id], [b.id], []].forEach((v, i) => electionSetBulletin(sub, 0, i + 1, { voix: v }));
    electionCloreTour(sub, 0);
    const msg = _elSupDeAppliquer(sub);
    return JSON.stringify({ avant, forme, subClos: sub.clos, msg, sup: _elCand(el, c.id).sidSuppleant === libres[1], texte: _elSupNcTexte(el, c),
      delegueTit: _delegueOf(c.sidTitulaire), delegueSup: _delegueOf(libres[1]), nonDelegue: _delegueOf(libres[2]) });
  })()`));
  assert.deepStrictEqual(r.forme, { nbT: 1, sup: 0, binome: false, npb: 1, supDe: true, enCours: 'scrutin du suppléant en cours' });
  assert.strictEqual(r.subClos, true);
  assert.strictEqual(r.msg, '', 'report sans avertissement');
  assert.strictEqual(r.sup, true, 'son élu est le suppléant');
  assert.match(r.texte, /suppléant élu par un scrutin le .* \(5 votants, 4 exprimés, 3 voix\)/);
  assert.strictEqual(r.delegueTit, r.avant, 'le scrutin du suppléant ne remplace pas celle des délégués');
  assert.strictEqual(r.delegueSup, 'suppleant');
  assert.strictEqual(r.nonDelegue, null);
});

test('Scrutin du suppléant : les élus de l\'élection d\'origine ne sont ni proposés ni acceptés comme candidats', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => !e.clos), ti = 0, t = el.tours[ti];
    electionPreparerBulletins(el, ti, null);
    const libres = cls.eleves.filter(id => !el.candidats.some(c => c.sidTitulaire === id || c.sidSuppleant === id));
    const c = electionAddEcrit(el, libres[0]);
    for (let i = 0; i < 40; i++) electionAddBulletin(el, ti, [c.id]);
    t.votantsAnnonces = t.bulletins.length; c.accepte = true;
    electionCloreTour(el, ti);
    let g = 0; while (!el.clos && g++ < 3) { const k = el.tours.length - 1; electionAddBulletin(el, k, [el.tours[k].candidats[0]]); el.tours[k].votantsAnnonces = el.tours[k].bulletins.length; electionCloreTour(el, k); }
    const elus = el.elus.titulaires.map(id => _elCand(el, id)).flatMap(x => [x.sidTitulaire, x.sidSuppleant]).filter(Boolean);
    const sub = electionCreerScrutinSuppleant(el, c.id);
    _elView = sub.id;
    const html = _elRenderCandidats(sub, sub.tours[0]) + _elEcritHTML(sub);
    const proposes = elus.filter(sid => html.includes('value="' + sid + '"'));
    const refus = elus.map(sid => electionAddCandidat(sub, sid, null)).every(x => x === null);
    const refusEcrit = electionAddEcrit(sub, elus[0]) === null;
    const libre = electionAddCandidat(sub, libres[1], null) !== null;
    return JSON.stringify({ nbElus: elus.length, proposes, refus, refusEcrit, libre });
  })()`));
  assert.ok(r.nbElus >= 3, 'titulaires et suppléants élus');
  assert.deepStrictEqual(r.proposes, [], 'aucun élu dans les listes de choix');
  assert.strictEqual(r.refus, true, 'refusés aussi par le modèle');
  assert.strictEqual(r.refusEcrit, true);
  assert.strictEqual(r.libre, true, 'un élève non élu reste candidat');
});

test('Égalité départagée par l\'âge : les dates de naissance au PV, à la projection et dans l\'onglet', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls();
    const ids = cls.eleves.filter(id => _ymdValid(S.eleves[id].naissance) && _isStudentActive(S.eleves[id])).slice(0, 2);
    S.eleves[ids[0]].naissance = '2012-03-04'; S.eleves[ids[1]].naissance = '2012-11-20';
    const el = electionCreate(cls.id, { nbTitulaires: 1, binome: false, nbSupplants: 0, nomsParBulletin: 1, majoriteAbsolueT1: false, departage: 'plusJeune' });
    S.elections[cls.id][el.id] = el;
    const a = electionAddCandidat(el, ids[0], null), b = electionAddCandidat(el, ids[1], null);
    electionPreparerBulletins(el, 0, 4);
    [[a.id], [b.id], [a.id], [b.id]].forEach((v, i) => electionSetBulletin(el, 0, i + 1, { voix: v }));
    electionCloreTour(el, 0);
    const dep = _elDepartagesHTML(el, 0, 'x');
    const proj = _elWinResultatHTML(el), onglet = _elRenderResultats(el);
    return JSON.stringify({ clos: el.clos, elu: el.elus.titulaires[0] === b.id, dep, proj: proj.includes('20/11/2012') && proj.includes('04/03/2012'), onglet: onglet.includes('départagée par l') });
  })()`));
  assert.strictEqual(r.clos, true);
  assert.strictEqual(r.elu, true, 'le plus jeune (né en novembre) est élu');
  assert.match(r.dep, /Égalité à 2 voix, départagée par l'âge \(le plus jeune est élu\)/);
  assert.match(r.dep, /né\(e\) le 04\/03\/2012/);
  assert.match(r.dep, /né\(e\) le 20\/11\/2012 — élu/);
  assert.strictEqual(r.proj, true, 'à la projection');
  assert.strictEqual(r.onglet, true, 'dans l onglet');
});

test('Procès-verbal : une case de signature par élu (titulaires et suppléants), mesuré pour UNE page', () => {
  const r = JSON.parse(ev(`(() => {
    S = _emptyState(); postLoadHook(); createDemo({ force: true });
    const cls = getCls(), el = _elList(cls.id).find(e => e.clos && !e.supDe && e.tours.length === 2);
    const elus = el.elus.titulaires.map(id => _elCand(el, id));
    const sups = elus.map(c => _elCandNomSup(c));
    const h = _pvElusSignHTML(el, elus, sups);
    const eco = _elList(cls.id).find(e => e.clos && e.type === 'eco');
    const he = _pvElusSignHTML(eco, eco.elus.titulaires.map(id => _elCand(eco, id)), []);
    const cadres = h.split('class="pv-binome"').slice(1).map(x => (x.match(/class="pv-sign-l"/g) || []).length);
    return JSON.stringify({ cadres, cases: (h.match(/class="pv-sign-l"/g) || []).length, attendu: elus.length + sups.filter(Boolean).length,
      titre: h.includes('acceptation du mandat'), eco: (he.match(/class="pv-sign-l"/g) || []).length, ecoSup: he.includes('Suppléant') });
  })()`));
  assert.strictEqual(r.cases, r.attendu, 'une case par élu');
  assert.deepStrictEqual(r.cadres, [2, 2], 'en binôme : un cadre par binôme, titulaire et suppléant ensemble');
  assert.ok(r.titre);
  assert.strictEqual(r.eco, 1, 'éco-délégué : un élu, pas de suppléant');
  assert.strictEqual(r.ecoSup, false);
  const SRC = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const pv = SRC.slice(SRC.indexOf('function electionPrintPV('), SRC.indexOf('function _pvElusSignHTML('));
  assert.match(pv, /_pvFitPt\(/, 'la taille est calculée pour une page');
  assert.match(pv, /_pvElusSignHTML\(el, elus, sups\)/);
});
