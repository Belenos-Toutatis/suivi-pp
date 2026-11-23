// Audit du 2026-11-22 — avis des collègues et bulletins : les défauts confirmés, corrigés. Chaque test a été
// vérifié en échec sur la version d'avant la correction. Noms inventés (ceux de la démonstration).

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const J = c => JSON.parse(ev(`JSON.stringify((() => { ${c} })())`));

// La démonstration, plus une feuille « bulletin » (objectif conseil, plus récente) pour la période de la feuille
// d'avis du conseil : c'est l'état d'une classe dont on vient d'importer les bulletins.
const SETUP = `createDemo({ force: true }); undoStack.length = 0;
  const cls = getCls(), nuage = S.avis[cls.id].demo_av1;
  const sid = Object.keys(nuage.avis).find(s => Object.keys(nuage.avis[s]).length >= 2);
  const dN = Object.keys(nuage.avis[sid])[0], colN = _avisCols(nuage)[0].key, texteNuage = 'AVISDUNUAGE ' + nuage.avis[sid][dN][colN];
  nuage.avis[sid][dN][colN] = texteNuage;
  const bul = { id: 'bul1', source: 'bulletin', date: '2099-01-01', ts: 4070908800000, cible: nuage.cible, label: 'Appréciations du bulletin — S1', fichier: 'b.pdf', lien: '', cibles: [],
    msg: { moment: 'conseil', mois: 1, echeance: '', off: [] }, colonnes: [{ key: 'appreciation', label: 'Appréciation' }],
    disciplines: JSON.parse(JSON.stringify(nuage.disciplines.slice(0, 2))), avis: { [sid]: { [nuage.disciplines[0].id]: { appreciation: 'APPRECIATIONDUBULLETIN sérieuse' } } } };
  S.avis[cls.id].bul1 = bul;
  const pIdx = _periods(cls).findIndex(p => nuage.cible >= p.start && nuage.cible <= p.end);
  const col = _ficheMoments(cls).find(c => c.type === 'conseil' && c.pIdx === pIdx);
  const stu = S.eleves[sid];
`;

test('après l\'import des bulletins, les avis des collègues ET les appréciations du bulletin restent sous les yeux (fiche, faits, bilan, papier)', () => {
  const r = J(`${SETUP}
    const tous = _ficheAvisTous(cls, sid, col);
    const faits = _ficheFaits(cls, stu, col).filter(f => f.k === 'avis').map(f => f.html);
    const vueFaits = _ficheFaitsHTML(cls, stu, col);
    const papier = _fichePrintHTML(cls, sid, col, {}, null);
    const synth = _periodeSynthese(cls, pIdx, { type: 'conseil', col }).rows.find(x => x.sid === sid || (x.stu && x.stu.id === sid));
    return { n: tous.length, sources: tous.map(a => a.camp.source || 'nuage'), premier: _ficheAvis(cls, sid, col).camp.id, faits,
      vueN: vueFaits.includes('AVISDUNUAGE'), vueB: vueFaits.includes('APPRECIATIONDUBULLETIN'),
      papN: papier.includes('AVISDUNUAGE'), papB: papier.includes('APPRECIATIONDUBULLETIN'),
      synthAvis: JSON.stringify(synth && synth.avis) };`);
  assert.strictEqual(r.n, 2);
  assert.deepStrictEqual(r.sources, ['bulletin', 'nuage']);
  assert.strictEqual(r.premier, 'bul1', 'la première feuille reste celle que la fiche montrait');
  assert.strictEqual(r.faits.length, 2, 'un fait par feuille');
  assert.ok(r.vueN && r.vueB, 'vue « Faits et rédaction » : les deux feuilles');
  assert.ok(r.papN && r.papB, 'fiche imprimée : les deux feuilles');
  assert.ok(/AVISDUNUAGE/.test(r.synthAvis) && /APPRECIATIONDUBULLETIN/.test(r.synthAvis), 'synthèse imprimée : les deux feuilles');
});

test('une seule feuille pour le moment : rien ne change (ni sous-titre, ni fait en double)', () => {
  const r = J(`${SETUP} delete S.avis[cls.id].bul1;
    const tous = _ficheAvisTous(cls, sid, col);
    return { n: tous.length, faits: _ficheFaits(cls, stu, col).filter(f => f.k === 'avis').length, sousTitre: /pf-feuille/.test(_ficheFaitsHTML(cls, stu, col)), papier: /fp-feuille/.test(_fichePrintHTML(cls, sid, col, {}, null)) };`);
  assert.deepStrictEqual(r, { n: 1, faits: 1, sousTitre: false, papier: false });
});

test('_avisEleveTous : toutes les feuilles du même objectif dans la période, la plus récente d\'abord ; pas celles d\'un autre objectif', () => {
  const r = J(`${SETUP}
    const l = _avisEleveTous(cls, sid, pIdx, 'conseil').map(a => a.camp.id);
    const mi = _avisEleveTous(cls, sid, pIdx, 'miperiode').map(a => _avisMsgReglages(a.camp).moment);
    return { l, un: _avisEleve(cls, sid, pIdx, 'conseil').camp.id, miUnSeulObjectif: new Set(mi).size <= 1 };`);
  assert.deepStrictEqual(r.l, ['bul1', 'demo_av1']);
  assert.strictEqual(r.un, 'bul1');
  assert.strictEqual(r.miUnSeulObjectif, true);
});

test('nouvelle feuille ouverte depuis un point du mois : le modèle suit l\'objectif du FORMULAIRE (conseil : trois colonnes), pas celui de la feuille qu\'on quitte', () => {
  const r = J(`${SETUP}
    const gid = document.getElementById;
    try {
      // La feuille affichée est un point du mois : son sélecteur d'objectif est encore dans la page, le formulaire non.
      document.getElementById = id => id === 'mavis-obj' ? { value: 'mois' } : id === 'mavis-cols-new' ? null : gid.call(document, id);
      _avisColsDraft = null; const depuisMois = _avisColsDraftPour(null).cols.map(c => c.label);
      // Le formulaire est affiché et l'objectif choisi est « mois » : une seule colonne, comme avant.
      document.getElementById = id => id === 'mavis-obj' ? { value: 'mois' } : id === 'mavis-cols-new' ? {} : gid.call(document, id);
      _avisColsDraft = null; const formulaireMois = _avisColsDraftPour(null).cols.length;
      return { depuisMois, formulaireMois, conseil: _avisModeleDefaut('conseil').colonnes.map(c => c.label) };
    } finally { document.getElementById = gid; _avisColsDraft = null; }`);
  assert.deepStrictEqual(r.depuisMois, r.conseil);
  assert.strictEqual(r.depuisMois.length, 3);
  assert.strictEqual(r.formulaireMois, 1);
});

test('changer de classe ne laisse pas l\'onglet des avis sur « Nouvelle feuille » au retour', () => {
  const r = J(`${SETUP}
    _avisCampId = null; _avisNouvelleVoulue = true;       // le formulaire ouvert dans une classe sans feuille
    S.classes.autre = { id: 'autre', nom: '4A', annee: cls.annee, eleves: [], ord: 9 };
    switchClass('autre'); const apres = { voulue: _avisNouvelleVoulue, camp: _avisCampId === undefined };
    switchClass(cls.id);
    return apres;`);
  assert.deepStrictEqual(r, { voulue: false, camp: true });
});

test('bulletins : le rattachement manuel d\'un élève est retenu sur la feuille et proposé au réimport ; il part avec l\'élève', () => {
  const r = J(`${SETUP} delete S.avis[cls.id].bul1;
    const mat = Object.values(S.matieres).find(m => { const d = _ficheMatDisc(m.nom); return d && S.disciplines[d]; }).nom;
    const connu = S.eleves[cls.eleves[1]];
    const lu = { periode: '', annee: '', doublons: 0, eleves: [
      { nom: 'INCONNU Zoé', matieres: [{ nom: mat, profs: 'M. X', texte: 'Bon semestre.' }] },
      { nom: connu.nom + ' ' + connu.prenom, matieres: [{ nom: mat, profs: 'M. X', texte: 'Sérieux.' }] } ] };
    const avant = _bullManuelConnu(cls, lu);
    const manuel = { '0': sid };
    const bil = _bullBilan(cls, lu, manuel, pIdx);
    const res = _bullAppliquer(cls, bil, pIdx, new Set(bil.lignes.map(l => l.cle)), 'b.pdf');
    const retenu = JSON.parse(JSON.stringify(res.camp.rattach || {}));
    const reimport = _bullManuelConnu(cls, lu);
    const bil2 = _bullBilan(cls, lu, reimport, pIdx);
    res.camp.rattach.piege = 'constructor'; const lu2 = { ...lu, eleves: [...lu.eleves, { nom: 'piege', matieres: [] }] };
    const herite = _bullManuelConnu(cls, lu2);
    _purgeStudentRefs(sid);
    return { avant, n: res.n, retenu: Object.values(retenu), reimport, identiques: bil2.lignes.filter(l => l.etat === 'identique').length, lignes2: bil2.lignes.length, herite: Object.keys(herite), apresPurge: Object.values(res.camp.rattach).includes(sid), sid };`);
  assert.deepStrictEqual(r.avant, {}, 'rien de retenu avant le premier import');
  assert.strictEqual(r.n, 2);
  assert.deepStrictEqual(r.retenu, [r.sid], 'seul le rattachement fait À LA MAIN est retenu');
  assert.deepStrictEqual(r.reimport, { '0': r.sid }, 'au réimport, l\'élève est déjà rattaché');
  assert.strictEqual(r.identiques, 2, 'et ses appréciations sont reconnues comme déjà là');
  assert.deepStrictEqual(r.herite, ['0'], 'un id hérité (« constructor ») ne rattache personne');
  assert.strictEqual(r.apresPurge, false, 'la suppression de l\'élève emporte son rattachement');
});
