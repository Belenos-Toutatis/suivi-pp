// Audit du 2026-10-14 — élections des délégués et éco-délégués : les défauts confirmés, corrigés.
// Chaque test a été vérifié en échec sur la version d'avant la correction. Noms inventés.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));

// Une classe de 20 élèves s1…s20 (filles aux numéros pairs), naissances distinctes.
// `vote(el, k, liste)` prépare l'urne puis lit chaque bulletin ; `reg` garde les éléments
// demandés par id (le stub du harnais en rend un neuf à chaque appel).
const SETUP = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id: '5C', nom: '5C', annee: '2025-26', eleves: [], ord: 0 }; S.cur = '5C';
  for (let i = 1; i <= 20; i++) { const id = 's' + i; S.eleves[id] = { id, nom: 'N' + i, prenom: 'P' + i, classe_id: '5C', tags: [], civilite: i % 2 ? 'M' : 'F', naissance: '2012-0' + (1 + (i % 9)) + '-' + String(10 + i).padStart(2, '0') }; S.classes['5C'].eleves.push(id); }
  window.vote = (el, k, l) => { electionPreparerBulletins(el, k, l.length); l.forEach((v, i) => electionSetBulletin(el, k, i + 1, { voix: Array.isArray(v) ? v : [v] })); };
  window.rep = (n, x) => Array(n).fill(x);
  window.__gid = window.__gid || document.getElementById;
  window.reg = {}; document.getElementById = id => reg[id] || (reg[id] = Object.assign(__gid.call(document, id), { _id: id }));
  document.querySelectorAll = () => [];
  undoStack.length = 0;
`;

test('départage à la main de PLUSIEURS sièges : des cases à cocher, autant d\'élus que de sièges, et la clôture aboutit', async () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', parSiege: false, departage: 'manuel' });
    const [A, B, C] = [['s1','s2'],['s3','s4'],['s5','s6']].map(([t, s]) => electionAddCandidat(el, t, s).id);
    vote(el, 0, [...rep(3, A), ...rep(3, B), ...rep(3, C)]); electionCloreTour(el, 0);
    vote(el, 1, [...rep(3, A), ...rep(3, B), ...rep(3, C)]);   // égalité à trois pour deux sièges
    _elView = el.id;
    electionCloreUI();
    const msg = reg['appDialog-msg'].innerHTML;
    window.__A = A; window.__B = B; window.__el = el;
    return { cases: (msg.match(/type="checkbox"/g) || []).length, radios: (msg.match(/type="radio"/g) || []).length, cochez: /Cochez 2 candidats/.test(msg) };`);
  assert.strictEqual(r.cases, 3);
  assert.strictEqual(r.radios, 0);
  assert.ok(r.cochez);
  // Le bouton ne s'active qu'au bon compte ; une troisième case se grise.
  const c = J(`const cs = [{ checked: true }, { checked: false }, { checked: false }];
    document.querySelectorAll = () => cs;
    _elDepCoche(2); const un = reg['el-dep-ok'].disabled;
    cs[1].checked = true; _elDepCoche(2);
    return { un, deux: reg['el-dep-ok'].disabled, troisiemeGrisee: cs[2].disabled };`);
  assert.deepStrictEqual(c, { un: true, deux: false, troisiemeGrisee: true });
  // On valide la fenêtre avec deux cases cochées, puis la confirmation de clôture : les deux sont
  // élus, l'élection se clôt (audit 2 : la décision n'entre dans les données qu'avec la clôture).
  ev(`document.querySelectorAll = sel => /:checked/.test(sel) ? [{ value: __A }, { value: __B }] : []; _appDialogResolve(true);`);
  await new Promise(res => setImmediate(res));
  const f = J(`reg['mconfirm2-ok'].onclick();
    const el = S.elections['5C'][__el.id]; const cle = _elTourCle(el.tours[1]);
    const choix = el.departageManuel[cle];
    return { choix: choix.length, clos: el.clos, elus: el.elus.titulaires.filter(id => id === __A || id === __B).length };`);
  assert.deepStrictEqual(f, { choix: 2, clos: true, elus: 2 });
});

test('remplacement : le suppléant PROMU qui part à son tour laisse le siège vacant (binôme et hors binôme)', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', parSiege: false });
    const A = electionAddCandidat(el, 's1', 's2').id, B = electionAddCandidat(el, 's3', 's4').id;
    vote(el, 0, [...rep(6, A), ...rep(5, B)]); electionCloreTour(el, 0); vote(el, 1, [B]); electionCloreTour(el, 1);
    electionRemplacer(el, { candId: A, qui: 'titulaire', date: '2025-11-01', motif: 'demission' });
    const promu = _delegueOf('s2');
    const r2 = electionRemplacer(el, { candId: A, qui: 'suppleant', date: '2025-12-01', motif: 'depart' });
    const eff = _elEffectifs(el);
    _elView = el.id; const html = _elRemplacementsHTML(el);
    const e2 = electionCreate('5C', { date: '2025-10-08', parSiege: false, binome: false, nbSupplants: 1, nbTitulaires: 1 });
    const X = electionAddCandidat(e2, 's5', null).id, Y = electionAddCandidat(e2, 's6', null).id;
    vote(e2, 0, [...rep(6, X), ...rep(3, Y)]); electionCloreTour(e2, 0);
    electionRemplacer(e2, { candId: X, qui: 'titulaire', date: '2025-11-01', remplacantCandId: Y });
    const rY = electionRemplacer(e2, { candId: Y, qui: 'suppleant', date: '2025-12-01' });
    const h2 = _elEffectifs(e2);
    // L'ordre inverse : un suppléant parti ne peut plus être choisi comme successeur.
    const e3 = electionCreate('5C', { date: '2025-10-09', parSiege: false, binome: false, nbSupplants: 1, nbTitulaires: 1 });
    const P = electionAddCandidat(e3, 's7', null).id, Q = electionAddCandidat(e3, 's8', null).id;
    vote(e3, 0, [...rep(6, P), ...rep(3, Q)]); electionCloreTour(e3, 0);
    electionRemplacer(e3, { candId: Q, qui: 'suppleant', date: '2025-11-01' });
    const succQ = electionRemplacer(e3, { candId: P, qui: 'titulaire', date: '2025-12-01', remplacantCandId: Q });
    return { promu, r2: !!r2, s2: _delegueOf('s2'), vacants: eff.vacants, tit: eff.titulaires.map(t => t.sid),
             html: { vacant: /siège vacant/.test(html), ex: /titulaire, ex-suppléante/.test(html) },
             rY: !!rY, h2: { tit: h2.titulaires.length, vacants: h2.vacants }, s6: _delegueOf('s6'), succQ: !!succQ };`);
  assert.strictEqual(r.promu, 'titulaire');
  assert.ok(r.r2, 'pas de refus « doublon » à tort');
  assert.strictEqual(r.s2, null);
  assert.strictEqual(r.vacants, 1);
  assert.deepStrictEqual(r.tit, ['s3']);
  assert.deepStrictEqual(r.html, { vacant: true, ex: true });
  assert.ok(r.rY);
  assert.deepStrictEqual(r.h2, { tit: 0, vacants: 1 });
  assert.strictEqual(r.s6, null);
  assert.strictEqual(r.succQ, false);
});

test('« ✓ élu » : la borne est max(urne, bulletins dépouillés) quand le dépouillement dépasse le compte de l\'urne', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 0, nbTitulaires: 1 });
    const A = electionAddCandidat(el, 's1', null).id, B = electionAddCandidat(el, 's3', null).id;
    electionPreparerBulletins(el, 0, 10);
    for (let i = 1; i <= 6; i++) electionSetBulletin(el, 0, i, { voix: [A] });
    const pendant = _elLive(el, 0).candidats.find(c => c.id === A).dejaElu;
    for (let i = 7; i <= 10; i++) electionSetBulletin(el, 0, i, { voix: [B] });
    electionAddBulletin(el, 0, [B]); electionAddBulletin(el, 0, [B]);   // 12 dépouillés pour 10 annoncés
    const L = _elLive(el, 0);
    return { pendant, fin: L.candidats.find(c => c.id === A).dejaElu, seuil: L.seuilProjete, chart: /✓ élu/.test(_elRenderChart(el, L)), elu: _elResultatTour(el, 0).elus.includes(A) };`);
  assert.strictEqual(r.pendant, true);
  assert.strictEqual(r.elu, false);
  assert.strictEqual(r.fin, false);
  assert.strictEqual(r.chart, false);
  assert.strictEqual(r.seuil, 7, 'majorité sur 12 exprimés au plus');
});

test('« ✓ élu » seulement si CERTAIN d\'avoir un siège : pas trois « élus » pour deux sièges en plurinominal', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', nomsParBulletin: 2, parSiege: false });
    const A = electionAddCandidat(el, 's1', 's2').id, B = electionAddCandidat(el, 's3', 's4').id, C = electionAddCandidat(el, 's5', 's6').id;
    electionPreparerBulletins(el, 0, 10);
    [[A,B],[A,B],[A,B],[A,C],[A,C],[A,C],[B,C],[B,C],[B,C],[A,B]].forEach((v, i) => electionSetBulletin(el, 0, i + 1, { voix: v }));
    const L = _elLive(el, 0);
    // En cours : 25 annoncés, 18 lus — A 13 dépasse la moitié, mais B et C peuvent encore l'égaler.
    const e2 = electionCreate('5C', { date: '2025-10-08', nomsParBulletin: 2, parSiege: false });
    const P = electionAddCandidat(e2, 's7', 's8').id, Q = electionAddCandidat(e2, 's9', 's10').id, R = electionAddCandidat(e2, 's11', 's12').id;
    electionPreparerBulletins(e2, 0, 25);
    const bs = [...rep(9, [P, Q]), ...rep(4, [P, R]), ...rep(2, [R])];   // P 13, Q 9, R 6 sur 15 lus
    bs.forEach((v, i) => electionSetBulletin(e2, 0, i + 1, { voix: v }));
    for (let i = 16; i <= 18; i++) electionSetBulletin(e2, 0, i, { voix: [] });
    const L2 = _elLive(e2, 0);
    return { elus: L.candidats.filter(c => c.dejaElu).map(c => [A, B, C].indexOf(c.id)),
             p: L2.candidats.find(c => c.id === P).dejaElu };`);
  assert.deepStrictEqual(r.elus.sort(), [0, 1], 'A et B, pas C');
  assert.strictEqual(r.p, false, 'Q (9 + 7) et R (6 + 7) peuvent encore égaler P (13) : deux menaces pour deux sièges');
});

test('un siège après l\'autre, second tour restreint : le siège suivant repart de tous les candidats du siège', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 0 });
    el.secondTour = { mode: 'premiers', n: 2 };
    const [A, B, C, D] = ['s1','s3','s5','s7'].map(s => electionAddCandidat(el, s, null).id);
    vote(el, 0, [...rep(4, A), ...rep(3, B), ...rep(2, C), ...rep(1, D)]); electionCloreTour(el, 0);
    const t2 = el.tours[1].candidats.length;
    vote(el, 1, [...rep(5, A), ...rep(4, B)]); electionCloreTour(el, 1);
    return { t2, siege2: el.tours[2].candidats.map(id => 'ABCD'[[A, B, C, D].indexOf(id)]).join(''), siege: el.tours[2].siege };`);
  assert.strictEqual(r.t2, 2);
  assert.strictEqual(r.siege, 2);
  assert.strictEqual(r.siege2, 'BCD');
});

test('un élu non candidat qui REFUSE est écarté : second tour, qualification, siège suivant, « déjà élu »', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 0, nbTitulaires: 1 });
    el.secondTour = { mode: 'premiers', n: 2 };
    const [A, B, C] = ['s1','s3','s5'].map(s => electionAddCandidat(el, s, null).id);
    const X = electionAddEcrit(el, 's9').id;
    vote(el, 0, [...rep(7, X), ...rep(3, A), ...rep(2, B), ...rep(1, C)]);
    _elCand(el, X).accepte = false;
    const xLive = _elLive(el, 0).candidats.find(c => c.id === X).dejaElu;
    electionCloreTour(el, 0);
    const t2 = el.tours[1].candidats.map(id => id === X ? 'X' : 'ABC'[[A, B, C].indexOf(id)]).join('');
    const e2 = electionCreate('5C', { date: '2025-10-08', binome: false, nbSupplants: 0 });
    const [P, Q] = ['s1','s3'].map(s => electionAddCandidat(e2, s, null).id);
    const Y = electionAddEcrit(e2, 's9').id;
    vote(e2, 0, [...rep(6, Y), ...rep(3, P), ...rep(2, Q)]);
    _elCand(e2, Y).accepte = false;
    electionCloreTour(e2, 0);
    const s1t2 = e2.tours[1].candidats.includes(Y);
    vote(e2, 1, [...rep(4, P), ...rep(2, Q)]); electionCloreTour(e2, 1);
    return { xLive, t2, s1t2, siege2: e2.tours[2].candidats.includes(Y) };`);
  assert.strictEqual(r.xLive, false);
  assert.strictEqual(r.t2, 'AB', 'B qualifié, X écarté');
  assert.strictEqual(r.s1t2, false);
  assert.strictEqual(r.siege2, false);
});

test('hors binôme : un nom écrit n\'est suppléant que s\'il ACCEPTE (refus écarté, question sinon)', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 1, nbTitulaires: 1, majoriteAbsolueT1: false });
    const [A, B] = ['s1','s3'].map(s => electionAddCandidat(el, s, null).id);
    const X = electionAddEcrit(el, 's9').id;
    vote(el, 0, [...rep(7, X), ...rep(5, A), ...rep(1, B)]);
    _elCand(el, X).accepte = false;
    electionCloreTour(el, 0);
    const sup1 = el.elus.suppleants.map(id => 'AB'[[A, B].indexOf(id)] || 'X');
    const e2 = electionCreate('5C', { date: '2025-10-08', binome: false, nbSupplants: 1, nbTitulaires: 1, majoriteAbsolueT1: false });
    const [P, Q] = ['s1','s3'].map(s => electionAddCandidat(e2, s, null).id);
    const Y = electionAddEcrit(e2, 's10').id;
    vote(e2, 0, [...rep(7, P), ...rep(5, Y), ...rep(1, Q)]);
    const w = electionCloreTour(e2, 0);
    const avant = { bloque: w.bloque, accepter: w.accepter === Y, sup: !!w.suppleant, clos: e2.clos, msg: w.warnings[0] };
    _elView = e2.id; electionCloreUI();
    const dlg = reg['appDialog-msg'].innerHTML;
    _elCand(e2, Y).accepte = true;
    electionCloreTour(e2, 0);
    return { sup1, avant, dlg: /élue suppléante/.test(dlg), apres: e2.elus.suppleants.map(id => id === Y ? 'Y' : '?') };`);
  assert.deepStrictEqual(r.sup1, ['B']);
  assert.strictEqual(r.avant.bloque, true);
  assert.strictEqual(r.avant.accepter, true);
  assert.strictEqual(r.avant.sup, true);
  assert.strictEqual(r.avant.clos, false);
  assert.match(r.avant.msg, /accepte d'être suppléante/);
  assert.ok(r.dlg, 'la fenêtre de clôture pose la question');
  assert.deepStrictEqual(r.apres, ['Y']);
});

test('hors binôme : une égalité pour la place de SUPPLÉANT suit la règle de départage (âge, sinon à la main)', () => {
  const r = J(`${SETUP}
    S.eleves.s3.naissance = '2012-01-01'; S.eleves.s5.naissance = '2013-06-01';   // C (s5) plus jeune que B (s3)
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbTitulaires: 1, nbSupplants: 1, departage: 'plusJeune' });
    const [A, B, C] = ['s1','s3','s5'].map(s => electionAddCandidat(el, s, null).id);
    vote(el, 0, [...rep(7, A), ...rep(2, B), ...rep(2, C)]); electionCloreTour(el, 0);
    const sup = el.elus.suppleants.map(id => 'ABC'[[A, B, C].indexOf(id)]).join('');
    const just = /pour la place de suppléant/.test(_elDepartagesHTML(el, 0, 'pv-mod'));
    const e2 = electionCreate('5C', { date: '2025-10-08', binome: false, nbTitulaires: 2, nbSupplants: 1, departage: 'manuel' });
    const [P, Q, R, T] = ['s1','s7','s3','s5'].map(s => electionAddCandidat(e2, s, null).id);
    vote(e2, 0, [...rep(7, P), Q, R, T]); electionCloreTour(e2, 0);
    vote(e2, 1, [...rep(7, Q), ...rep(2, R), ...rep(2, T)]);
    const w = electionCloreTour(e2, 1);
    _elView = e2.id; electionCloreUI();
    const dlg = reg['appDialog-msg'].innerHTML;
    e2.departageManuel[_elSupCle(e2.tours[1])] = [T];
    const w2 = electionCloreTour(e2, 1);
    return { sup, just, bloque: w.bloque, egal: !!w.egaliteSup, dlg: /la place de suppléant/.test(dlg), clos: e2.clos && !w2.bloque, sup2: e2.elus.suppleants.map(id => id === T ? 'T' : '?') };`);
  assert.strictEqual(r.sup, 'C', 'le plus jeune, pas le premier saisi');
  assert.ok(r.just, 'le PV justifie le départage');
  assert.strictEqual(r.bloque, true);
  assert.ok(r.egal);
  assert.ok(r.dlg);
  assert.strictEqual(r.clos, true);
  assert.deepStrictEqual(r.sup2, ['T']);
});

test('un siège après l\'autre : un tour clos fige les candidatures (ni ✕ ni ajout, ni retrait par le modèle)', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 0 });
    const [A, B, C] = ['s1','s3','s5'].map(s => electionAddCandidat(el, s, null).id);
    vote(el, 0, [...rep(6, A), ...rep(2, B), ...rep(2, C)]); electionCloreTour(el, 0);
    const t = el.tours[el.tours.length - 1];
    const html = _elRenderCandidats(el, t);
    const ok = electionRemoveCandidat(el, A);
    // Un nom écrit retiré au tour suivant : la colonne du tour clos reste.
    const e2 = electionCreate('5C', { date: '2025-10-08', binome: false, nbSupplants: 0, nbTitulaires: 1 });
    const [P, Q] = ['s1','s3'].map(s => electionAddCandidat(e2, s, null).id);
    const X = electionAddEcrit(e2, 's9').id;
    vote(e2, 0, [...rep(4, P), ...rep(4, Q), []]); electionCloreTour(e2, 0);
    const okX = electionRemoveEcrit(e2, X);
    return { siege: t.siege, x: /Retirer la candidature/.test(html), ajout: html.includes('+ Candidature'), ok,
             t1: el.tours[0].candidats.length, candA: !!_elCand(el, A), elu: _elResultatTour(el, 0).elus.includes(A),
             okX, t1X: e2.tours[0].candidats.includes(X), t2X: e2.tours[1].candidats.includes(X), candX: !!_elCand(e2, X) };`);
  assert.strictEqual(r.siege, 2);
  assert.strictEqual(r.x, false);
  assert.strictEqual(r.ajout, false);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.t1, 3);
  assert.ok(r.candA && r.elu);
  assert.deepStrictEqual({ okX: r.okX, t1X: r.t1X, t2X: r.t2X, candX: r.candX }, { okX: true, t1X: true, t2X: false, candX: true });
});

test('suppléant d\'un élu non candidat : scrutin supprimé, ou suppléant déjà désigné — un texte cohérent', () => {
  const r = J(`${SETUP}
    const mk = date => {
      const el = electionCreate('5C', { date, nbTitulaires: 1, parSiege: false });
      const A = electionAddCandidat(el, 's1', 's2').id;
      const X = electionAddEcrit(el, 's9').id;
      vote(el, 0, [...rep(7, X), ...rep(3, A)]);
      _elCand(el, X).accepte = true; electionCloreTour(el, 0);
      return { el, X };
    };
    const a = mk('2025-10-07');
    const sub = electionCreerScrutinSuppleant(a.el, a.X);
    delete S.elections['5C'][sub.id];
    const ta = _elSupNcTexte(a.el, _elCand(a.el, a.X));
    const b = mk('2025-10-08');
    electionSuppleantNC(b.el, b.X, { mode: 'designe', sid: 's5', date: '2025-10-09' });
    const sub2 = electionCreerScrutinSuppleant(b.el, b.X);
    return { ta, sub2: !!sub2, mode: _elCand(b.el, b.X).supNc.mode, tb: _elSupNcTexte(b.el, _elCand(b.el, b.X)) };`);
  assert.doesNotMatch(r.ta, /scrutin le\s*$/);
  assert.match(r.ta, /sans suppléant/);
  assert.strictEqual(r.sub2, false, 'pas de scrutin quand un suppléant est déjà désigné');
  assert.strictEqual(r.mode, 'designe');
  assert.match(r.tb, /désigné par P9 N9 le 09\/10\/2025/);
});

test('⚙ Modalités : le binôme est figé dès qu\'une candidature porte un suppléant', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', nbTitulaires: 1, parSiege: false });
    electionAddCandidat(el, 's1', 's2'); electionAddCandidat(el, 's3', 's4');
    _elView = el.id; _elSettingsId = el.id; _elFillSettings(el);
    const fig = { binome: reg['mel-binome'].disabled, nbs: reg['mel-nbs'].disabled, dit: reg['mel-binlock'].style.display === '' };
    reg['mel-binome'].checked = false; reg['mel-nbs'].value = '1';   // forcé malgré le verrou
    electionSettingsOk();
    const e0 = electionCreate('5C', { date: '2025-10-08', nbTitulaires: 1, parSiege: false });
    _elView = e0.id; _elSettingsId = e0.id; _elFillSettings(e0);
    return { fig, binome: el.binome, nbSup: _elNbSup(el), libre: reg['mel-binome'].disabled === false && reg['mel-binlock'].style.display === 'none' };`);
  assert.deepStrictEqual(r.fig, { binome: true, nbs: true, dit: true });
  assert.strictEqual(r.binome, true);
  assert.strictEqual(r.nbSup, 1);
  assert.ok(r.libre, 'sans candidature, le réglage reste libre');
});

test('accord en genre : bloc du suppléant, résultats d\'une seule élue, clôture « sans l\'élue »', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', nbTitulaires: 1, parSiege: false });
    const A = electionAddCandidat(el, 's1', 's3').id;
    const X = electionAddEcrit(el, 's10').id;
    vote(el, 0, [...rep(7, X), ...rep(3, A)]); _elCand(el, X).accepte = true; electionCloreTour(el, 0);
    _elView = el.id;
    const supnc = _elSupNcHTML(el);
    const eco = electionCreate('5C', { date: '2025-10-08', type: 'eco' });
    const E = electionAddCandidat(eco, 's2', null).id; electionAddCandidat(eco, 's5', null);
    vote(eco, 0, rep(5, E)); electionCloreTour(eco, 0);
    const res = _elRenderResultats(eco);
    const e3 = electionCreate('5C', { date: '2025-10-09', binome: false, nbSupplants: 0 });
    const F = electionAddCandidat(e3, 's4', null).id; electionAddCandidat(e3, 's7', null);
    vote(e3, 0, rep(5, F)); _elView = e3.id;
    electionCloreUI();
    const confirm = reg['mconfirm2-msg'].textContent;
    const w = electionCloreTour(e3, 0).warnings.join(' ');
    return { supnc, res, confirm, w };`);
  assert.match(r.supnc, /élue sans avoir été candidate : aucun texte ne dit qui la supplée/);
  assert.match(r.res, /Éco-déléguée élue :/);
  assert.doesNotMatch(r.res, /Éco-déléguées élues/);
  assert.match(r.confirm, /Élue : P4 N4/);
  assert.match(r.confirm, /sans l'élue/);
  assert.match(r.w, /sans l'élue/);
});

test('majorité RELATIVE : les résultats le disent, la projection ne trace pas de ligne de majorité absolue', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbSupplants: 0, nbTitulaires: 1 });
    const [A, B, C] = ['s1','s3','s5'].map(s => electionAddCandidat(el, s, null).id);
    vote(el, 0, [...rep(4, A), ...rep(3, B), ...rep(3, C)]); electionCloreTour(el, 0);
    electionPreparerBulletins(el, 1, 9); for (let i = 1; i <= 3; i++) electionSetBulletin(el, 1, i, { voix: [A] });
    const ch = _elRenderChart(el, _elLive(el, 1));
    for (let i = 4; i <= 9; i++) electionSetBulletin(el, 1, i, { voix: [i < 7 ? B : C] });
    electionCloreTour(el, 1);
    const html = _elRenderResultats(el);
    const heads = [...html.matchAll(/<strong>(Tour \\d)<\\/strong> <span class="tb-hint">— ([^<]*)/g)].map(m => m[2]);
    const e2 = electionCreate('5C', { date: '2025-10-08', binome: false, nbSupplants: 0, nbTitulaires: 1, majoriteAbsolueT1: false });
    const P = electionAddCandidat(e2, 's1', null).id, Q = electionAddCandidat(e2, 's3', null).id;
    vote(e2, 0, [...rep(4, P), ...rep(3, Q), [], [], []]); electionCloreTour(e2, 0);
    const h2 = _elRenderResultats(e2);
    return { ligne: /class="el-maj"/.test(ch), label: /majorité absolue/.test(ch), heads, h2: /majorité relative/.test(h2) && !/majorité absolue/.test(h2) };`);
  assert.strictEqual(r.ligne, false);
  assert.strictEqual(r.label, false);
  assert.match(r.heads[0], /majorité absolue 6/);
  assert.match(r.heads[1], /majorité relative/);
  assert.ok(r.h2);
});

test('dates proposées dans l\'année scolaire de la classe ; une année à deux chiffres se complète', () => {
  const r = J(`${SETUP}
    S.classes['5C'].annee = '2019-20';   // une année passée : aujourd'hui tombe toujours après
    _elSettingsId = null; _elFillSettings(null);
    const melDate = reg['mel-date'].value;
    const el = electionCreate('5C', { date: '2019-10-07', parSiege: false });
    const A = electionAddCandidat(el, 's1', 's2').id;
    vote(el, 0, rep(5, A)); electionCloreTour(el, 0);
    _elView = el.id; _elRemplOpen = true;
    const rp = (_elRemplacementsHTML(el).match(/id="rp-date" value="([^"]*)"/) || [])[1];
    _elRemplOpen = false;
    _delDirectOpen.delegues = true;
    const dd = (_deleguesDirectHTML(S.classes['5C'], _elList('5C'), 'delegues').match(/id="dd-date" value="([^"]*)"/) || [])[1];
    _delDirectOpen.delegues = false;
    // « 19 » tapé pour l'année : 0019-10-08 → 2019-10-08, pas « Date invalide ».
    _elSettingsId = null; _elFillSettings(null); reg['mel-date'].value = '0019-10-08';
    const avant = _elList('5C').length;
    electionSettingsOk();
    const cree = _elList('5C').find(e => e.id === _elView);
    return { melDate, rp, dd, cree: _elList('5C').length === avant + 1 ? cree.date : null };`);
  assert.strictEqual(r.melDate, '2020-07-31');
  assert.strictEqual(r.rp, '2020-07-31');
  assert.strictEqual(r.dd, '2020-07-31');
  assert.strictEqual(r.cree, '2019-10-08');
});
