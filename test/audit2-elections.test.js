// Audit 2 du 2026-10-14 — élections des délégués et heures de vie de classe : les défauts
// confirmés, corrigés. Chaque test a été vérifié en échec sur la version d'avant la correction.
// Noms inventés.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));

// Une classe de 20 élèves s1…s20 (filles aux numéros pairs), naissances distinctes.
// `vote(el, k, liste)` prépare l'urne puis lit chaque bulletin ; `reg` garde les éléments
// demandés par id (le stub du harnais en rend un neuf à chaque appel) ; `pvHTML(el)` rend le PV.
const SETUP = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id: '5C', nom: '5C', annee: '2025-26', eleves: [], ord: 0 }; S.cur = '5C';
  for (let i = 1; i <= 20; i++) { const id = 's' + i; S.eleves[id] = { id, nom: 'N' + i, prenom: 'P' + i, classe_id: '5C', tags: [], civilite: i % 2 ? 'M' : 'F', naissance: '2012-0' + (1 + (i % 9)) + '-' + String(10 + i).padStart(2, '0') }; S.classes['5C'].eleves.push(id); }
  window.vote = (el, k, l) => { electionPreparerBulletins(el, k, l.length); l.forEach((v, i) => electionSetBulletin(el, k, i + 1, { voix: Array.isArray(v) ? v : [v] })); };
  window.rep = (n, x) => Array(n).fill(x);
  window.__gid = window.__gid || document.getElementById;
  window.reg = {}; document.getElementById = id => reg[id] || (reg[id] = Object.assign(__gid.call(document, id), { _id: id }));
  document.querySelectorAll = () => [];
  undoStack.length = 0;
  window.pvHTML = e => { reg['pa'] = { innerHTML: '', querySelector: () => null }; _elView = e.id; electionPrintPV(); return reg['pa'].innerHTML; };
  window.txt = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ');
`;

test('PV d\'une élection close avant la v1.67 : la phrase de départage ne contredit pas les élus enregistrés', () => {
  const r = J(`${SETUP}
    S.eleves.s3.naissance = '2012-01-01'; S.eleves.s5.naissance = '2013-06-01';   // C (s5) plus jeune que B (s3)
    const el = electionCreate('5C', { date: '2025-10-07', binome: false, nbTitulaires: 1, nbSupplants: 1, departage: 'plusJeune' });
    const [A, B, C] = ['s1','s3','s5'].map(s => electionAddCandidat(el, s, null).id);
    vote(el, 0, [...rep(7, A), ...rep(2, B), ...rep(2, C)]); electionCloreTour(el, 0);
    const neuf = txt(_elDepartagesHTML(el, 0, 'pv-mod'));
    el.elus.suppleants = [B];   // ce que la v1.66 enregistrait : le premier saisi
    _elView = el.id;
    return { neuf, pv: txt(pvHTML(el)), res: txt(_elRenderResultats(el)), win: txt(_elWinResultatHTML(el)), sup: _delegueOf('s3') };`);
  // Une élection close aujourd'hui garde sa justification (élus recalculés = élus enregistrés).
  assert.match(r.neuf, /pour la place de suppléant, départagée par l'âge .* P5 N5 , née? le 01\/06\/2013 — suppléant/);
  // L'ancienne : les élus enregistrés font foi, aucune phrase qui désignerait C.
  assert.strictEqual(r.sup, 'suppleant');
  for (const k of ['pv', 'res', 'win']) assert.doesNotMatch(r[k], /pour la place de suppléant/, k);
});

test('↺ Rouvrir retire le départage à la main du tour rouvert : une nouvelle égalité redemande', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', parSiege: false, departage: 'manuel' });
    const [A, B, C] = [['s1','s2'],['s3','s4'],['s5','s6']].map(([t, s]) => electionAddCandidat(el, t, s).id);
    vote(el, 0, [...rep(3, A), ...rep(3, B), ...rep(3, C)]); electionCloreTour(el, 0);
    vote(el, 1, [...rep(3, A), ...rep(3, B), ...rep(3, C)]);
    el.departageManuel = { [_elTourCle(el.tours[1])]: [A, B] };
    const w1 = electionCloreTour(el, 1);
    electionRouvrir(el);
    const garde = _elTourCle(el.tours[1]) in el.departageManuel;
    electionAddBulletin(el, 1, [A]);      // A 4, B 3, C 3 : égalité B / C pour le dernier siège
    const res = _elResultatTour(el, 1);
    const w2 = electionCloreTour(el, 1);
    return { clos1: !w1.bloque, garde, egalite: res.egalite && res.egalite.candIds.length, bloque: w2.bloque, clos: el.clos };`);
  assert.deepStrictEqual(r, { clos1: true, garde: false, egalite: 2, bloque: true, clos: false });
});

test('départage à la main puis clôture ANNULÉE : rien n\'est enregistré ; confirmée : un seul cran pour les deux', async () => {
  const ouvrir = `${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', parSiege: false, departage: 'manuel' });
    const [A, B, C] = [['s1','s2'],['s3','s4'],['s5','s6']].map(([t, s]) => electionAddCandidat(el, t, s).id);
    vote(el, 0, [...rep(3, A), ...rep(3, B), ...rep(3, C)]); electionCloreTour(el, 0);
    vote(el, 1, [...rep(3, A), ...rep(3, B), ...rep(3, C)]);
    _elView = el.id; window.__el = el; window.__A = A; window.__B = B;
    undoStack.length = 0;
    electionCloreUI();
    document.querySelectorAll = sel => /:checked/.test(sel) ? [{ value: __A }, { value: __B }] : [];
    _appDialogResolve(true);
    return 1;`;
  J(ouvrir);
  await new Promise(res => setImmediate(res));
  // La fenêtre de confirmation est ouverte : rien n'est encore dans les données.
  const a = J(`const el = __el; return { dec: Object.keys(el.departageManuel || {}).length, crans: undoStack.length,
    confirme: /Élus : /.test(reg['mconfirm2-msg'].textContent) };`);
  assert.deepStrictEqual(a, { dec: 0, crans: 0, confirme: true });
  // Annuler, puis rouvrir la clôture par le bouton : la question revient.
  const b = J(`closeMod2('mconfirm2'); reg['appDialog-msg'].innerHTML = ''; electionCloreUI();
    return { dec: Object.keys(__el.departageManuel || {}).length, crans: undoStack.length, question: /Égalité|égalité/.test(reg['appDialog-msg'].innerHTML) };`);
  assert.deepStrictEqual(b, { dec: 0, crans: 0, question: true });
  ev(`_appDialogResolve(true)`);
  await new Promise(res => setImmediate(res));
  // Confirmée : décision et clôture ensemble, un seul cran ; Ctrl+Z retire les deux.
  const c = J(`reg['mconfirm2-ok'].onclick();
    const el = () => S.elections['5C'][__el.id];
    const apres = { clos: el().clos, dec: (el().departageManuel[_elTourCle(el().tours[1])] || []).length, crans: undoStack.length };
    undoLast(true);
    return { ...apres, annule: { clos: el().clos, dec: Object.keys(el().departageManuel || {}).length } };`);
  assert.deepStrictEqual(c, { clos: true, dec: 2, crans: 1, annule: { clos: false, dec: 0 } });
});

test('un départage À LA MAIN est dit au PV (sans emoji), dans les résultats et dans la fenêtre détachée', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', parSiege: false, departage: 'manuel' });
    const [A, B, C] = [['s1','s2'],['s3','s4'],['s5','s6']].map(([t, s]) => electionAddCandidat(el, t, s).id);
    vote(el, 0, [...rep(3, A), ...rep(3, B), ...rep(3, C)]); electionCloreTour(el, 0);
    vote(el, 1, [...rep(3, A), ...rep(3, B), ...rep(3, C)]);
    el.departageManuel = { [_elTourCle(el.tours[1])]: [A, C] };
    const w = electionCloreTour(el, 1);
    _elView = el.id;
    const pvBrut = pvHTML(el);
    return { clos: !w.bloque && el.clos, pv: txt(pvBrut), pvEmoji: /⚖/.test(pvBrut), res: txt(_elRenderResultats(el)), win: txt(_elWinResultatHTML(el)) };`);
  assert.ok(r.clos);
  const phrase = /Égalité à 3 voix, départagée à la main par le bureau : P1 N1 — élu ; P3 N3 ; P5 N5 — élu\./;
  for (const k of ['pv', 'res', 'win']) assert.match(r[k], phrase, k);
  assert.doesNotMatch(r.pv, /départagée à la main[^.]*né le/, 'pas de date de naissance pour un départage à la main');
  assert.strictEqual(r.pvEmoji, false);
});

test('scrutin du suppléant d\'un élu non candidat : dates proposées dans l\'année scolaire, jamais avant le scrutin', () => {
  const r = J(`${SETUP}
    S.classes['5C'].annee = '2024-25';   // une année PASSÉE, comme la démo
    const el = electionCreate('5C', { date: '2024-10-07', nbTitulaires: 1, parSiege: false });
    electionAddCandidat(el, 's1', 's2'); const X = electionAddEcrit(el, 's9').id;
    vote(el, 0, [...rep(7, X), ...rep(3, el.candidats[0].id)]); _elCand(el, X).accepte = true; electionCloreTour(el, 0);
    _elView = el.id;
    const champ = (_elSupNcHTML(el).match(/id="elsn-d-0" value="([^"]*)"/) || [])[1];
    const sub = electionCreerScrutinSuppleant(el, X);
    return { attendu: _dateParDefaut(S.classes['5C'], el.date), champ, sub: sub.date };`);
  assert.strictEqual(r.attendu, '2025-07-31');
  assert.strictEqual(r.champ, r.attendu);
  assert.strictEqual(r.sub, r.attendu);
});

test('heure de vie de classe : « ✓ Enregistrer » sans rien changer ne pose pas de cran d\'annulation', () => {
  const r = J(`${SETUP}
    const cls = S.classes['5C'];
    const e = hvcAdd(cls, { date: '2025-10-01', titre: 'Règles', texte: 'x' });
    const remplir = (d, t, x) => { _hvcEdit = e.id; reg['hvc-date'].value = d; reg['hvc-titre'].value = t; reg['hvc-txt'].value = x; };
    document.getElementById('hvc-date'); document.getElementById('hvc-titre'); document.getElementById('hvc-txt');
    remplir('2025-10-01', 'Règles ', 'x'); hvcSaveUI();
    const vide = { crans: undoStack.length, ferme: _hvcEdit === null };
    remplir('2025-10-01', 'Règles de vie', 'x'); hvcSaveUI();
    return { vide, crans: undoStack.length, titre: cls.vieClasse[0].titre, set: hvcSet(cls, e.id, { date: '2025-10-01', titre: 'Règles de vie', texte: 'x' }) };`);
  assert.deepStrictEqual(r, { vide: { crans: 0, ferme: true }, crans: 1, titre: 'Règles de vie', set: null });
});

test('un élu non candidat qui a REFUSÉ : « a refusé » à côté de son nom dans les tableaux des tours', () => {
  const r = J(`${SETUP}
    const el = electionCreate('5C', { date: '2025-10-07', nbTitulaires: 1, parSiege: false, binome: false, nbSupplants: 0, majoriteAbsolueT1: false });
    const A = electionAddCandidat(el, 's1', null).id; const X = electionAddEcrit(el, 's9').id;
    vote(el, 0, [...rep(7, X), ...rep(3, A)]); _elCand(el, X).accepte = false; electionCloreTour(el, 0);
    _elView = el.id;
    const tours = h => txt(h.slice(h.search(/elr-tours|class="el-res"/)));
    return { clos: el.clos, res: tours(_elRenderResultats(el)), win: tours(_elWinResultatHTML(el)) };`);
  assert.ok(r.clos);
  for (const k of ['res', 'win']) assert.match(r[k], /P9 N9 \(nom écrit, a refusé son élection\)/, k);
});
