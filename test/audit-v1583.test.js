// Audit complet du 2026-10-10 — cohérence entre écrans, intégrité, échappement. Les défauts corrigés
// en v1.58.3 ; chaque test vérifié en échec sur la v1.58.2. Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;`;

test('trimestres : les deux moitiés de mars sont deux moments, et chacun garde son bilan', () => {
  ev(DEMO);
  const r = evObj(`(() => { S.prefs.periodMode = 'trimestre'; const cls = getCls(), sid = cls.eleves[0];
    bilanAdd(sid, { date: '2026-03-10', type: 'mois', texte: 'T2 mars' });
    bilanAdd(sid, { date: '2026-03-20', type: 'mois', texte: 'T3 mars' });
    const ms = _chaleurMomentsTous(cls).filter(c => c.type === 'mois' && c.ym === '2026-03');
    return { cles: ms.map(c => c.key), courts: ms.map(c => c.court), textes: ms.map(c => _bilanDeColonne(cls, sid, c)?.texte) }; })()`);
  assert.strictEqual(new Set(r.cles).size, 2, 'deux clés distinctes');
  assert.deepStrictEqual(r.courts, ['Point mars T2', 'Point mars T3']);
  assert.deepStrictEqual(r.textes, ['T2 mars', 'T3 mars']);
  // En semestres, rien ne change : un mois entier garde sa clé d'avant.
  ev(`S.prefs.periodMode = 'semestre'`);
  assert.ok(evObj(`_chaleurMomentsTous(getCls()).filter(c => c.type === 'mois').every(c => /^bil:mois:\\d{4}-\\d{2}$/.test(c.key))`));
});

test('fiche : les papiers à rendre sont ceux des autres écrans (pas d’archivé, pas de « rendu après »), et le compteur ne lit pas le titre', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[0];
    // un document non archivé, titre avec virgule et deux-points, pas rendu ; un archivé pas rendu
    const mk = (titre, archive) => { const id = 'dx_' + titre.length + (archive ? 'a' : ''); S.documents[id] = { id, titre, classIds: [cls.id], suiviRetour: true, champs: [], retours: {}, archive, dateDistribution: '2025-09-02', ord: 99 }; return id; };
    for (const doc of Object.values(S.documents)) if (doc.retours) doc.retours[sid] = { rendu: true, dateRetour: '2025-09-05', reponses: {}, note: '' };
    mk('Fiche, version 2 : à signer', false); mk('Vieux papier', true);
    const col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const f = _ficheFaits(cls, S.eleves[sid], col).find(x => x.k === 'papier');
    return { n: f?.n, html: f?.html, liste: _papiersARendre(cls, sid).map(x => x.titre) }; })()`);
  assert.strictEqual(r.n, 1);
  assert.deepStrictEqual(r.liste, ['Fiche, version 2 : à signer']);
  assert.ok(!/Vieux papier/.test(r.html), 'un document archivé n’est pas « à rendre »');
});

test('synthèse d’un moment sans relevé : le cumul reporté, pas une case vide', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), dates = _relDates(cls.id);
    const col = _chaleurMomentsTous(cls).find(c => c.type === 'mois' && !dates.some(d => d.startsWith(c.ym)) && dates.some(d => d < c.ym + '-01'));
    const syn = _periodeSynthese(cls, col.pIdx, { type: col.type, col });
    const row = syn.rows.find(x => _cumulAu(cls.id, x.sid, _ficheBornes(cls, col).end) !== null);
    return { cumul: row.cumulFin, attendu: _cumulAu(cls.id, row.sid, _ficheBornes(cls, col).end) }; })()`);
  assert.ok(r.cumul !== null);
  assert.strictEqual(r.cumul, r.attendu);
});

test('carte de chaleur : un événement d’août a sa colonne, et le Total des mois concorde', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[2];
    S.eleves[sid].journal = [{ id: 'j_aout', date: '2025-08-28', ts: 1, type: 'appel', texte: 'Rentrée' }];
    const col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    const g = _chaleurGroupes(cls, [], col).find(x => x.key === 'ct');
    const mois = g.sub.filter(s => s.id !== '__tot');
    const somme = mois.reduce((n, s) => n + (+g.cell(sid, s.id)[1] || 0), 0);
    return { premier: mois[0].id, somme, total: +g.sum(sid)[1] }; })()`);
  assert.strictEqual(r.premier, '2025-08');
  assert.strictEqual(r.somme, r.total);
  // Sans événement en août : pas de colonne d'août.
  ev(DEMO);
  assert.notStrictEqual(evObj(`(() => { const cls = getCls(); const col = _chaleurMomentsTous(cls).find(c => c.type === 'conseil' && c.pIdx === 0);
    return _chaleurGroupes(cls, [], col).find(x => x.key === 'ct').sub[0].id; })()`), '2025-08');
});

test('intégrité : le PV signé d’une désignation vidée par une suppression garde sa référence', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), a = cls.eleves[3];
    cls.delegues = { date: '2025-09-20', titulaires: [a], suppleants: [], note: '', pv: { nom: 'PV.pdf', fichier: 'PV délégués.pdf', taille: 10 } };
    _purgeStudentRefs(a);
    return { garde: !!cls.delegues?.pv, ref: _pjReferences().has ? _pjReferences().has('PV délégués.pdf') : JSON.stringify([..._pjReferences()]).includes('PV délégués.pdf') }; })()`);
  assert.deepStrictEqual(r, { garde: true, ref: true });
});

test('Ctrl+Z : un refus ne laisse ni cran vide, ni Ctrl+Y fantôme, ni niveau perdu pile pleine ; une saisie après Ctrl+Z a son cran', () => {
  ev(DEMO);
  const r = evObj(`(() => {
    const toasts = []; const _t = toast; toast = m => toasts.push(String(m));
    for (let i = 0; i < MAX_UNDO; i++) { pushUndo(); S.prefs.__mark = i; }
    const premier = undoStack[0];
    const sa = Object.keys(S.salles)[0] || salleAdd({ nom: 'Test', rows: 4, cols: 4 })?.id;
    const n0 = undoStack.length, redo0 = redoStack.length;
    _salleMut(() => false);
    const apresRefus = { n: undoStack.length, premierGarde: undoStack[0] === premier, redo: redoStack.length, annul: toasts.some(m => /Annulation effectuée/.test(m)) };
    // relevé refusé (« abc ») : pas de cran
    undoStack.length = 0; redoStack = []; _salvesDesarmer();
    const cls = getCls(), ymd = _relDates(cls.id)[0], sid = cls.eleves[0];
    relCellChange({ dataset: { ymd, sid }, value: 'abc' });
    const apresAbc = undoStack.length;
    relCellChange({ dataset: { ymd, sid }, value: '1' });
    undoLast();
    relCellChange({ dataset: { ymd, sid }, value: '2' });   // dans les 2 s : la salve était armée
    const apresUndoSaisie = undoStack.length;
    toast = _t;
    return { n0, apresRefus, redo0, apresAbc, apresUndoSaisie }; })()`);
  assert.strictEqual(r.apresRefus.n, r.n0, 'pas de cran vide');
  assert.ok(r.apresRefus.premierGarde, 'le plus ancien niveau n’est pas perdu');
  assert.strictEqual(r.apresRefus.redo, r.redo0);
  assert.ok(!r.apresRefus.annul, 'pas de « Annulation effectuée » pour un refus');
  assert.strictEqual(r.apresAbc, 0);
  assert.ok(r.apresUndoSaisie >= 1, 'une saisie juste après Ctrl+Z pose son cran');
});

test('horloge : importer un fichier ou recharger la démo ne la fait pas reculer', async () => {
  ev(DEMO);
  const r = JSON.parse(await ev(`(async () => {
    S.clock = { [_DEVICE_ID]: 50, autre: 7 };
    const avant = S.clock[_DEVICE_ID];
    await _demoReplaceState('x', () => createDemo({ force: true }), 'ok');
    return JSON.stringify({ avant, apres: S.clock[_DEVICE_ID], autre: S.clock.autre }); })()`));
  assert.ok(r.apres > r.avant, `horloge ${r.avant} → ${r.apres}`);
  assert.strictEqual(r.autre, 7);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  const imp = src.slice(src.indexOf('function importJSON('), src.indexOf('function importJSON(') + 2500);
  assert.match(imp, /_clockMergeMax\(S\.clock, prevClock\); _clockBumpSelf\(\)/);
});

test('chargement : une sauvegarde locale illisible est gardée à part, pas écrasée', () => {
  const r = evObj(`(() => { localStorage.setItem(LS_KEY, '{"classes": {"x"'); _loadIllisible = false; load();
    return { garde: localStorage.getItem(LS_KEY + '_illisible'), drapeau: _loadIllisible }; })()`);
  assert.strictEqual(r.garde, '{"classes": {"x"');
  assert.ok(r.drapeau);
  const r2 = evObj(`(() => { localStorage.setItem(LS_KEY, 'null'); load(); return _isPlainObj(S); })()`);
  assert.ok(r2, '« null » ne casse pas le chargement');
});

test('fichier altéré : nombres ramenés à leur type (rien d’injecté), tableaux abîmés sans plantage des grilles', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), s = S.eleves[cls.eleves[0]];
    s.groupe = '<img src=x onerror=alert(1)>'; S.eleves[cls.eleves[1]].groupe = '2';
    s.journal = [null, { id: 'j1', date: 7, type: 'appel', texte: 'x' }];
    const el = Object.values(S.elections[cls.id])[0];
    el.tours[0].bulletins[0] = { ...el.tours[0].bulletins[0], n: "1);alert(2);//" };
    const el2 = Object.values(S.elections[cls.id])[1]; el2.elus = { titulaires: 7 }; el2.candidats = [null, ...el2.candidats];
    const sa = Object.values(S.salles)[0]; if (sa) sa.rows = '"><img src=x>';
    postLoadHook();
    let err = null; try { _syntheseRows(cls).forEach(() => {}); _elevesIndicHTML(cls, _elevesRows(cls), []); _elevesChaleurHTML(cls, _elevesRows(cls), []); for (const sid of cls.eleves) _delegueOf(sid); } catch (e) { err = e.message; }
    return { g0: s.groupe, g1: S.eleves[cls.eleves[1]].groupe, journal: s.journal.length, date: s.journal[0].date, n: el.tours[0].bulletins[0].n,
      rows: sa ? sa.rows : 6, err }; })()`);
  assert.deepStrictEqual(r, { g0: null, g1: 2, journal: 1, date: '', n: 1, rows: 6, err: null });
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.match(src, /appAlert\('Rien à récupérer', `Dans « \$\{_escName\(f\.name\)\} »/);
});

test('arbitré : le « +n » suit la période du dernier relevé ; la fiche lit la feuille d’avis du moment ; la feuille de mi-période a les moyennes du moment', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), ps = _periods(cls);
    // Le dernier relevé en S1, aujourd'hui en S2 : le « +n » reste sur S1.
    for (const d of _relDates(cls.id)) if (d >= ps[1].start) delete S.releves[cls.id][d];
    const f = _obsFenetre(cls, 'per', ps[1].start.slice(0, 8) + '10');
    // Une feuille de mi-période : un élève sans avis dedans voit « aucun », pas la feuille du conseil.
    const mi = _chaleurMomentsTous(cls).find(c => c.type === 'miperiode' && c.pIdx === 0);
    const camp = _avisFeuilleDuMoment(cls, mi);
    const sid = cls.eleves.find(id => camp && !Object.keys(camp.avis?.[id] || {}).length);
    const av = sid ? _ficheAvis(cls, sid, mi) : null;
    // Moyennes de la feuille de mi-période : pas d'import daté après la fin du moment.
    const syn = _periodeSynthese(cls, 0, { type: 'miperiode', col: mi });
    return { per: [f.start, f.end, ps[0].start, ps[0].end], meme: !av || av.camp.id === camp.id, vide: av ? av.items.length : 0,
      moyDate: syn.moyennes ? syn.moyennes.date : null, finMi: _ficheBornes(cls, mi).end }; })()`);
  assert.deepStrictEqual(r.per.slice(0, 2), r.per.slice(2), 'le « +n » couvre la période du dernier relevé');
  assert.ok(r.meme && r.vide === 0, 'la fiche reste sur la feuille du moment, même vide');
  assert.ok(!r.moyDate || r.moyDate <= r.finMi, `moyennes du ${r.moyDate} pour une mi-période finie le ${r.finMi}`);
});
