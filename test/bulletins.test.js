// 📄 Les bulletins de Mon Bureau Numérique, en PDF (v1.75.0) : chaque appréciation d'un professeur devient un avis
// de sa discipline pour la période. Fixture INVENTÉE à la mise en page du vrai (scripts/gen_bulletin_fixture.py) —
// dépôt public.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
sb.__u8 = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'bulletin-mbn-invente.pdf')));
const LIRE = async () => JSON.parse(await ev(`(async () => JSON.stringify(_bullLire(await _recapPages(__u8))))()`));
// La démo, dont trois élèves prennent les noms du faux bulletin.
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;
  (() => { const cls = getCls(); [['MARTIN', 'Léa'], ['DUBOIS', 'Hugo'], ['BERNARD-PETIT', 'Chloé Anne']].forEach(([n, p], i) => {
    const s = S.eleves[cls.eleves[i]]; s.nom = n; s.prenom = p; }); })();`;

test('lecture : l’élève par l’en-tête de page, deux pages, deux exemplaires fondus, « Non renseigné » vide, pôles et moyennes écartés', async () => {
  const lu = await LIRE();
  assert.strictEqual(lu.periode, 'Premier semestre');
  assert.strictEqual(lu.annee, '2025-2026');
  assert.deepStrictEqual(lu.eleves.map(e => [e.nom, e.page]), [['MARTIN Léa', 1], ['DUBOIS Hugo', 3], ['BERNARD-PETIT Chloé Anne', 5], ['INCONNU Zoé', 6]]);
  assert.strictEqual(lu.doublons, 1, 'le second exemplaire de Hugo (l’autre responsable légal)');
  const lea = lu.eleves[0];
  assert.deepStrictEqual(lea.matieres.map(m => m.nom), ['FRANÇAIS', 'HISTOIRE-GEOGRAPHIE EMC', 'ALLEMAND', 'ALLEMAND BILINGUE', 'MATHÉMATIQUES', 'ESPAGNOL LV2', 'SCIENCES VIE & TERRE', 'ÉD.PHYSIQUE & SPORT.', 'ENS.RELIG.CATHOLIQUE']);
  const M = Object.fromEntries(lea.matieres.map(m => [m.nom, m]));
  assert.strictEqual(M['FRANÇAIS'].texte, "Des résultats satisfaisants. Léa participe volontiers à l'oral mais doit soigner l'orthographe.");
  assert.strictEqual(M['SCIENCES VIE & TERRE'].texte, "Un semestre encourageant : Léa s'investit davantage en travaux pratiques et progresse nettement à l'écrit.", 'continue en haut de la page 2');
  assert.strictEqual(M['MATHÉMATIQUES'].texte, '', '« Non renseigné »');
  assert.strictEqual(M['MATHÉMATIQUES'].profs, 'Mme PIN, Mme SAULE, Mme FRENE', 'le professeur sur deux lignes');
  assert.deepStrictEqual([M['ENS.RELIG.CATHOLIQUE'].profs, M['ENS.RELIG.CATHOLIQUE'].groupe], ['Mme ORME', '5C-CATH (1)']);
  const tout = JSON.stringify(lu);
  for (const x of ['thème du programme', '12,5', '13,4', 'Retards', 'Pôle', 'Autres matières', 'Communication']) assert.ok(!tout.includes(x), `écarté : ${x}`);
});

test('la période : « Premier semestre » → S1 ; un découpage qui ne concorde pas est signalé', () => {
  ev(DEMO);
  assert.deepStrictEqual(evObj(`_bullPeriode(getCls(), 'Premier semestre')`), { idx: 0, connu: true, accord: true });
  assert.deepStrictEqual(evObj(`_bullPeriode(getCls(), 'Second semestre')`), { idx: 1, connu: true, accord: true });
  assert.strictEqual(evObj(`_bullPeriode(getCls(), 'Deuxième trimestre')`).accord, false);
});

test('la revue puis le rangement : une feuille « bulletin » de la période, deux matières d’une discipline réunies, rien de deviné', async () => {
  ev(DEMO);
  const lu = await LIRE();
  ev(`window.__lu = ${JSON.stringify(lu)}`);
  const b = evObj(`_bullBilan(getCls(), __lu, {}, 0)`);
  assert.strictEqual(b.camp, null);
  assert.deepStrictEqual(b.L.filter(l => !l.sid).map(l => l.nom), ['INCONNU Zoé'], 'un élève inconnu n’est jamais deviné');
  assert.deepStrictEqual(b.sansDisc, ['ESPAGNOL LV2'], 'une matière inconnue est demandée');
  assert.strictEqual(b.vides, 2, 'mathématiques et EPS « Non renseigné »');
  const sid0 = ev(`getCls().eleves[0]`), par = Object.fromEntries(b.lignes.filter(l => l.sid === sid0).map(l => [l.did, l.apres]));
  assert.deepStrictEqual(Object.keys(par).sort(), ['allemand', 'francais', 'histoire_geo', 'religions', 'svt'].sort());
  assert.strictEqual(par.allemand, 'Allemand : Bonne participation.\nAllemand bilingue : Très bon semestre en section bilingue.');
  assert.ok(b.lignes.every(l => l.etat === 'ajout'));
  // Ranger tout : un cran d'undo, la feuille venue du bulletin.
  const n0 = ev(`undoStack.length`);
  const r = evObj(`(() => { pushUndo(); const b = _bullBilan(getCls(), __lu, {}, 0), r = _bullAppliquer(getCls(), b, 0, new Set(b.lignes.map(l => l.cle)), 'bulletins.pdf'); return { n: r.n, id: r.camp.id }; })()`);
  assert.strictEqual(ev(`undoStack.length`), n0 + 1);
  assert.strictEqual(r.n, b.lignes.length);
  const camp = evObj(`_avisMap(getCls().id)[${JSON.stringify(r.id)}]`);
  assert.strictEqual(camp.source, 'bulletin');
  assert.deepStrictEqual(camp.colonnes.map(c => c.key), ['appreciation']);
  assert.strictEqual(camp.msg.moment, 'conseil');
  assert.strictEqual(camp.disciplines.find(d => d.id === 'francais').profs, 'Mme ROSE', 'le professeur du bulletin');
  assert.strictEqual(camp.avis[sid0].svt.appreciation, "Un semestre encourageant : Léa s'investit davantage en travaux pratiques et progresse nettement à l'écrit.");
  // Réimporter le même fichier : tout est déjà là. Un texte retouché depuis est proposé, avant et après.
  assert.ok(evObj(`_bullBilan(getCls(), __lu, {}, 0)`).lignes.every(l => l.etat === 'identique'));
  ev(`_avisMap(getCls().id)[${JSON.stringify(r.id)}].avis[${JSON.stringify(sid0)}].francais.appreciation = 'Ancien texte.'`);
  const m = evObj(`_bullBilan(getCls(), __lu, {}, 0)`).lignes.filter(l => l.etat === 'modif');
  assert.deepStrictEqual(m.map(l => [l.did, l.avant]), [['francais', 'Ancien texte.']]);
});

test('rattacher à la main : un élève inconnu, une matière (gardée pour les prochains imports)', async () => {
  ev(DEMO);
  ev(`window.__lu = ${JSON.stringify(await LIRE())}`);
  const sid5 = ev(`getCls().eleves[5]`);
  const L = evObj(`_bullBilan(getCls(), __lu, { '3': ${JSON.stringify(sid5)} }, 0).lignes.filter(l => l.sid === ${JSON.stringify(sid5)}).map(l => l.apres)`);
  assert.deepStrictEqual(L, ['Assez bien.']);
  ev(`(() => { const d = disciplineAdd('Espagnol'); window.__esp = d.id; ficheMatSetDisc('ESPAGNOL LV2', d.id); })()`);
  const b = evObj(`_bullBilan(getCls(), __lu, {}, 0)`);
  assert.deepStrictEqual(b.sansDisc, []);
  assert.ok(b.lignes.some(l => l.did === ev(`__esp`) && l.apres === 'Muy bien, sigue así.'));
});

test('ensuite : le panneau de l’onglet Avis (pas de relecture du Nuage), les synthèses par une IA reçoivent les appréciations', async () => {
  ev(DEMO);
  ev(`window.__lu = ${JSON.stringify(await LIRE())}`);
  const id = ev(`(() => { const b = _bullBilan(getCls(), __lu, {}, 0); const r = _bullAppliquer(getCls(), b, 0, new Set(b.lignes.map(l => l.cle)), '<img src=x onerror=alert(1)>.pdf'); return r.camp.id; })()`);
  const h = ev(`_avisCampHTML(getCls(), _avisMap(getCls().id)[${JSON.stringify(id)}])`);
  assert.match(h, /Réimporter les bulletins/);
  assert.match(h, /Le ton des avis/);
  assert.ok(!/<img src=x/.test(h), 'le nom du fichier est échappé');
  assert.ok(!/Mettre la feuille à jour|lien de partage/i.test(h), 'rien à partager ni à relire dans le Nuage');
  assert.match(ev(`_avisTitreFeuille(getCls(), _avisMap(getCls().id)[${JSON.stringify(id)}])`), /^📄 Bulletin · S1/);
  // Le texte d'un élève pour le conseil du S1 porte ses appréciations, sous un repère.
  const t = ev(`(() => { const cls = getCls(), col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'); return _iaDonnees(cls, S.eleves[cls.eleves[1]], col, new Set(['avis']), '[Élève 7]').texte; })()`);
  assert.match(t, /Appréciations des professeurs au bulletin \(le conseil de classe du S1\)/);
  assert.match(t, /– Mathématiques : Excellent travail, résultats très solides\./);
  assert.match(t, /Avis des collègues \(le conseil de classe du S1\)/, 'la feuille des collègues du même moment aussi');
});
