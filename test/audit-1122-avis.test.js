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
