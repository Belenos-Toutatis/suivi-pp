// 🤖 Le bilan d'une fiche de suivi individuelle (v1.95.0) — l'utilisateur : « utiliser l'IA de manière anonyme afin de construire la
// remarque du professeur principal ; la réécrire si l'enseignant l'a écrite à la va-vite ; ou lui donner une consigne pour que l'IA
// la reformule ». La fiche envoie ses données, Suivi PP les anonymise et rend le texte accepté. Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0;`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };
  window.__postes = []; window.__post0 = _suivisPost; _suivisPost = m => __postes.push(m);`;
const FIN = `document.getElementById = __gid; _suivisPost = __post0; _iaFiche = null; _iaActif = null; for (const k of Object.keys(_iaFicheEtats)) delete _iaFicheEtats[k];`;
// Un message de la fiche pour le premier élève de la classe : des noms partout où un enseignant peut en écrire.
const MSG = (plus = '') => `(() => { const cls = getCls(), e = S.eleves[cls.eleves[0]], c = S.eleves[cls.eleves[1]];
  const m = { cle: cls.id, ind: 'i1', fin: '2026-11-20', donnees: { nom: _suivisNom(e), periode: 'du lundi 16 novembre au vendredi 20 novembre 2026', enCours: false, bilan: '',
    mots: ['Mathématiques', 'TB'], blocs: { objectifs: ['- Objectif 1 (J’ai mon matériel.) : 75 % de réussite (12 TB, 4 I)'], remarques: ['- Mathématiques, lundi : ' + e.prenom + ' a bousculé ' + c.prenom + ', vu avec M. BROCHETON.'],
    precedent: [e.prenom + ' doit apporter son matériel.'], vie: ['Absences : mardi 17/11 (toute la journée).'] },
    personnes: { profs: [['M. BROCHETON', 'Mathématiques']], referent: 'M. GARDONNET', etablissement: 'Collège Les Tilleuls', eleves: ['ZORGLUB Kévina'] } } };
  ${plus} return m; })()`;

test('consignes : 3e personne, longueur, repères, seul texte ; la consigne personnelle prime', () => {
  for (const m of ['construire', 'reecrire', 'consigne']) {
    const c = ev(`_iaFicheConsigne('${m}', 'courte')`);
    assert.match(c, /3e personne/); assert.match(c, /deux ou trois phrases/); assert.match(c, /crochets compris/); assert.match(c, /seul texte/); assert.match(c, /prime/);
    assert.match(c, /inventez/, m + ' : rien d’inventé');
  }
  assert.match(ev(`_iaFicheConsigne('construire', 'courte')`), /N'annoncez pas la retenue/);
  assert.strictEqual(ev(`_iaFicheLongueur('construire')`), 'courte', 'arbitré : deux ou trois phrases d’office');
  assert.strictEqual(ev(`_iaFicheLongueur('reecrire')`), 'texte');
});

test('rédiger à partir de la fiche : les quatre blocs, aucun nom ne part ; la réponse revient noms remis et va à la fiche', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`openFicheIA(${MSG()})`);
    const txt = ev(`__els.get('mif-txt').value`), noms = evObj(`(() => { const c = getCls(), a = S.eleves[c.eleves[0]], b = S.eleves[c.eleves[1]]; return [a.prenom, a.nom, b.prenom, b.nom]; })()`);
    assert.strictEqual(ev(`_iaFiche.mode`), 'construire', 'bilan vide : rédiger');
    for (const t of ['Objectifs et réussite', 'Remarques des enseignants', 'Bilan de la fiche précédente', 'Absences : mardi']) assert.ok(txt.includes(t), t);
    const contenu = ev(`_iaFicheContenu(_iaFiche)`);
    for (const n of [noms[0], noms[2], 'BROCHETON']) assert.ok(!new RegExp('(?<![\\p{L}])' + n + '(?![\\p{L}])', 'iu').test(contenu), 'ne part pas : ' + n);
    assert.match(txt, /\[Élève\] a bousculé \[Camarade 1\], vu avec (M\. )?\[Professeur de Mathématiques\]/);
    assert.ok(contenu.trimEnd().endsWith(txt.trim()) && contenu.startsWith(ev(`IA_FICHE_CONSIGNES.construire`)), 'la consigne puis le texte relu, rien d’autre');
    // méta : le contrôle voit bien un nom laissé
    assert.strictEqual(ev(`_iaFuites('Vu avec ' + S.eleves[getCls().eleves[0]].prenom, _iaFiche.personnes(), new Set()).length`), 1);
    ev(`_iaReponseVers('mif', '« [Élève] apporte mieux son matériel. **[Élève]** doit encore progresser. »')`);
    const p = ev(`_iaRedacProposition(_iaFiche)`);
    assert.strictEqual(p, `${noms[0]} apporte mieux son matériel. ${noms[0]} doit encore progresser.`);
    assert.match(ev(`__els.get('mif-diff').innerHTML`), /caractères/);
    assert.deepStrictEqual(evObj(`__postes`), [], 'rien n’est envoyé à la fiche avant « Mettre dans le bilan »');
    ev(`iaFicheRangerUI()`);
    assert.deepStrictEqual(evObj(`__postes`), [{ type: 'bilan', cle: ev(`getCls().id`), ind: 'i1', fin: '2026-11-20', avant: '', texte: p }]);
    assert.strictEqual(ev(`undoStack.length`), 0, 'Suivi PP ne touche à rien : c’est la fiche qui pose le bilan');
    ev(`_iaFichePose({ cle: getCls().id, ind: 'i1', fin: '2026-11-20', ok: false, raison: 'le bilan a changé entre-temps' })`);
    assert.ok(ev(`!!_iaFiche`) && ev(`_iaRedacProposition(_iaFiche)`) === p, 'refusé par la fiche : la proposition reste là');
  } finally { ev(FIN); }
});

test('blocs décochés : absents du texte ; « Mon texte actuel » proposé seulement s’il existe', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`openFicheIA(${MSG()})`);
    assert.ok(!ev(`__els.get('mif-blocs').innerHTML`).includes('Mon texte actuel'));
    ev(`iaFicheBlocUI('remarques', false); iaFicheBlocUI('precedent', false)`);
    const t = ev(`__els.get('mif-txt').value`);
    assert.ok(!t.includes('Remarques des enseignants') && !t.includes('fiche précédente') && t.includes('Objectifs et réussite'));
  } finally { ev(FIN); }
});

test('réécrire un texte écrit à la hâte, puis retravailler la proposition avec une consigne', () => {
  ev(DEMO); ev(ELS);
  try {
    ev(`openFicheIA(${MSG("m.donnees.bilan = e.prenom + ' a pas son matos, parle trop avec ' + c.prenom;")})`);
    assert.strictEqual(ev(`_iaFiche.mode`), 'reecrire', 'un texte existe : le réécrire');
    const t = ev(`__els.get('mif-txt').value`);
    assert.match(t, /Texte à reformuler :\n\[Élève\] a pas son matos, parle trop avec \[Camarade 1\]$/);
    assert.ok(!/Objectifs et réussite|Remarques/.test(t), 'seul le texte part');
    ev(`_iaReponseVers('mif', '[Élève] n’a pas son matériel et bavarde avec [Camarade 1].')`);
    assert.match(ev(`__els.get('mif-diff').innerHTML`), /<del>/);
    assert.match(ev(`__els.get('mif-diff').innerHTML`), /<ins>/);
    ev(`iaFicheReprendreUI()`);
    assert.strictEqual(ev(`_iaFiche.mode`), 'consigne');
    assert.strictEqual(ev(`_iaFiche.rep`), '');
    assert.match(ev(`__els.get('mif-txt').value`), /Texte à reformuler :\n\[Élève\] n’a pas son matériel et bavarde avec \[Camarade 1\]\.$/, 'la proposition est le texte de départ, anonymisée, mêmes repères');
    // sans consigne : refusé ; avec : dans le texte relu, anonymisée elle aussi
    ev(`window.__parti = 0; _iaFichePret(() => { __parti++; })`);
    assert.strictEqual(ev(`__parti`), 0, 'mode consigne sans consigne : rien ne part');
    ev(`__els.get('mif-perso').value = 'Plus court, ne parle pas de ' + S.eleves[getCls().eleves[1]].prenom; iaFichePersoUI(); _iaFichePersoMaj(); _iaFichePret(() => { __parti++; })`);
    assert.strictEqual(ev(`__parti`), 1);
    assert.match(ev(`__els.get('mif-txt').value`), /Consigne du professeur principal : Plus court, ne parle pas de \[Camarade 1\]\n/);
    assert.deepStrictEqual(evObj(`_iaFicheConsignes()`), [], 'une consigne qui nomme quelqu’un n’est pas retenue');
    ev(`__els.get('mif-perso').value = 'Insiste sur le matériel'; iaFichePersoUI(); _iaFichePersoMaj(); _iaFichePret(() => {})`);
    assert.deepStrictEqual(evObj(`_iaFicheConsignes()`), ['Insiste sur le matériel']);
    // texte corrigé à la main : seule la ligne de la consigne change
    ev(`__els.get('mif-txt').value += ' Ajout.'; iaTexteSaisi(); __els.get('mif-perso').value = 'Plus ferme'; iaFichePersoUI(); _iaFichePersoMaj()`);
    const u = ev(`__els.get('mif-txt').value`);
    assert.ok(u.endsWith(' Ajout.') && u.includes('Consigne du professeur principal : Plus ferme') && !u.includes('Insiste'));
    ev(`_iaReponseVers('mif', 'x'); iaFicheRangerUI()`);
    assert.strictEqual(evObj(`__postes`)[0].avant, ev(`_iaFiche.d.bilan`), 'comparé au bilan de la FICHE, pas à la proposition retravaillée');
  } finally { ev(FIN); ev(`localStorage.removeItem(LS_IA_FICHE_CONS)`); }
});

test('données de la fiche illisibles, IA désactivée : rien ne s’ouvre ; élève hors de la classe : son nom ne part pas', () => {
  ev(DEMO); ev(ELS);
  try {
    for (const m of ['null', '{}', `{ cle: 'constructor', ind: 'i', fin: '2026-11-20', donnees: {} }`, `{ cle: getCls().id, ind: 'i', fin: 'x', donnees: {} }`, `{ cle: getCls().id, ind: 5, fin: '2026-11-20', donnees: {} }`]) { ev(`openFicheIA(${m})`); assert.strictEqual(ev(`_iaFiche`), null, m); }
    ev(`openFicheIA({ cle: getCls().id, ind: 'i', fin: '2026-11-20', donnees: { nom: 7, bilan: {}, blocs: { objectifs: 'x', remarques: [1, 'ok'] }, personnes: { profs: [['a'], 3, [4]] } } })`);
    assert.deepStrictEqual(evObj(`_iaFiche.d.blocs`), { objectifs: [], remarques: ['ok'], precedent: [], vie: [] });
    ev(`_iaFiche = null; openFicheIA(${MSG("m.donnees.nom = 'DE LA ZORGUE Anatolia'; m.donnees.blocs.remarques = ['- EPS, mardi : Anatolia et Kévina se disputent, De la Zorgue exclue.'];")})`);
    const t = ev(`__els.get('mif-txt').value`);
    assert.ok(!/Anatolia|Zorgue|Kévina/i.test(t), t);
    assert.match(t, /\[Élève\] et \[Camarade 1\] se disputent/);
    ev(`_iaFiche = null; S.prefs.iaActive = false; openFicheIA(${MSG()})`);
    assert.strictEqual(ev(`_iaFiche`), null);
    assert.strictEqual(ev(`_suivisApparence().ia`), false, 'la fiche cache son bouton');
    ev(`S.prefs.iaActive = true`);
    assert.strictEqual(ev(`_suivisApparence().ia`), true);
  } finally { ev(`S.prefs.iaActive = true`); ev(FIN); }
});

test('même moteur que les autres fenêtres : envoi, plein écran, journal', () => {
  const r = evObj(`_iaRequete('fiche', 'x', { modele: 'claude-opus-5-5' }, 'k')`);
  assert.strictEqual(r.body.output_config.format, undefined);
  assert.ok(ev(`IA_SORTES.fiche && IA_SORTES_COURT.fiche && IA_PLEIN_MODALES.includes('mif')`));
});
