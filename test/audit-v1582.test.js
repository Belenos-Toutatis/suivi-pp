// Audit du 2026-10-09 (relecture du code v1.56 → v1.58.1) — les défauts corrigés en v1.58.2.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
sb.__u8 = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'recap-mbn-invente.pdf')));

test('décrire un fichier : « lisible » ne passe qu\'au MÊME texte des autres pages ; masquer se propage par la place', async () => {
  const r = JSON.parse(await ev(`(async () => {
    _struct = { pdf: await _recapPages(__u8), texte: '', garder: new Set(), etat: new Map(), page: 0 };
    const _show = _appDialogShow; let rep = '=clair';
    _appDialogShow = () => Promise.resolve(rep);
    _structRender = () => {};
    // L'en-tête « Motif » de la page 4 (tableau des dispenses) : au même endroit, en page 9, le motif
    // d'une absence (« Raison de santé »).
    const pi = 3, li = _struct.pdf[pi].lines.findIndex(l => l.text === 'Motif');
    _structMemePlace = true;
    await structSegUI(pi, li);
    const clairs = [..._struct.etat.entries()].filter(([, e]) => e.mode === 'clair').map(([k]) => { const [p, i] = k.split(':').map(Number); return _struct.pdf[p].lines[i].text; });
    // …puis « masquer » la même case : la place suffit.
    rep = '=masque';
    await structSegUI(pi, li);
    const masques = [..._struct.etat.values()].filter(e => e.mode === 'masque').length;
    _appDialogShow = _show;
    return JSON.stringify({ clairs, masques });
  })()`));
  assert.ok(r.clairs.length >= 1 && r.clairs.every(t => t === 'Motif'), 'aucun motif d\'absence rendu lisible : ' + r.clairs.join(', '));
  assert.ok(r.masques > r.clairs.length, 'masquer atteint aussi les textes différents au même endroit');
  // Ni particules ni lettres isolées parmi les mots laissés en clair d'office.
  assert.strictEqual(ev(`_structMasque('Jean-Marc DE LA TOUR — Mme A. BETA', STRUCT_MOTS_COURANTS)`), 'Xxxx-Xxxx XX XX XXXX — Xxx X. XXXX');
});

test('carte de chaleur : une case vide d\'absences n\'annonce pas un clic qui ne fait rien', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook();`);
  const r = evObj(`(() => { const cls = getCls(); const a = _chaleurGroupes(cls, []).find(x => x.key === 'abs');
    const sid = cls.eleves.find(id => !_absMbnOf(id).length); const c = a.cell(sid, a.sub[0].id), t = a.sum(sid); return [c[2], c[3], t[2], t[3]]; })()`);
  assert.deepStrictEqual(r, ['', null, '', null]);
});

test('absences : le texte court garde « non valable » et « à régulariser » ; « juill. » se lit ; une fin illisible prend le début', () => {
  assert.strictEqual(ev(`_absMbnTexte({ kind: 'absence', debut: '2025-09-22', fin: '2025-09-22', hDebut: '', hFin: '', duree: null, motif: '', valable: false, regul: false }, true)`),
    'Absence · non valable · à régulariser');
  assert.strictEqual(ev(`_absMbnTexte({ kind: 'retard', debut: '2025-10-01', fin: '2025-10-01', hDebut: '08:00', hFin: '08:15', duree: 15, motif: 'Transport' }, true)`),
    'Retard, 08:00–08:15 (15 min) — Transport');
  assert.strictEqual(ev(`_recapDateFr('3 juill. 2025')`), '2025-07-03');
  ev(`(() => { const s = S.eleves[getCls().eleves[0]]; s.absMbn = [{ kind: 'absence', debut: '2025-09-01', fin: 'n/a' }]; postLoadHook(); })()`);
  assert.strictEqual(ev(`S.eleves[getCls().eleves[0]].absMbn[0].fin`), '2025-09-01');
});

test('récapitulatif : deux punitions identiques sont deux cases, deux incidents', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook();`);
  const r = evObj(`(() => { const cls = getCls(), s = S.eleves[cls.eleves[0]]; s.incidents = [];
    const pun = { date: '2025-09-18', consequence: 'Retenue', motif: 'Travail non fait', etat: 'Réalisée', par: 'Vie scolaire' };
    const lu = { periode: { a: '2025-09-01', b: '2025-10-09' }, eleves: [{ nom: s.prenom + ' ' + s.nom, page: 1, naissance: null, groupes: [], regime: '', sortie: '', observations: [], absences: [], punitions: [pun, { ...pun }], illisibles: 0 }] };
    const b = _recapBilan(cls, lu, {}), cles = b.pun.map(x => x.cle);
    const n = _recapAppliquer(b, { obs: false, abs: false, retObs: new Set(), retAbs: new Set(), pun: new Set(cles), fiche: new Set() });
    return { distinctes: new Set(cles).size, n: n.pun, inc: s.incidents.length }; })()`);
  assert.deepStrictEqual(r, { distinctes: 2, n: 2, inc: 2 });
});
