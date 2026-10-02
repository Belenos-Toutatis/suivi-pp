// Élèves : aménagements (deux groupes d'exclusivité indépendants), options,
// présence en cours d'année. Ce sont des règles métier courtes mais faciles à casser,
// et dont l'erreur ne se voit qu'en relisant une fiche élève.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// ─────────────────────────────────────────────── Aménagements

test('_setStudentStatusExclusive ne vide QUE le groupe du statut posé', () => {
  // PPRE puis PAP : le second chasse le premier (même groupe scolarité).
  assert.deepStrictEqual(
    evObj(`(() => { const s={}; _setStudentStatusExclusive(s,'ppre'); _setStudentStatusExclusive(s,'pap');
                    return { ppre: s.ppre, pap: s.pap }; })()`),
    { ppre: false, pap: true });
  // UPE2A+ et PPRE cohabitent : groupes indépendants. C'est le cas réel de l'allophone
  // en inclusion qui suit aussi un PPRE — le confondre effacerait l'un des deux.
  assert.deepStrictEqual(
    evObj(`(() => { const s={}; _setStudentStatusExclusive(s,'upe2a_incl'); _setStudentStatusExclusive(s,'ppre');
                    return { upe2a_incl: s.upe2a_incl, ppre: s.ppre }; })()`),
    { upe2a_incl: true, ppre: true });
  // PAI, agrandissement et tiers-temps sont chacun seuls dans leur groupe : cumulables avec tout.
  assert.deepStrictEqual(
    evObj(`(() => { const s={}; for (const k of ['pap','upe2a','pai','agrandissement','tiers_temps']) _setStudentStatusExclusive(s,k);
                    return { pap: s.pap, upe2a: s.upe2a, pai: s.pai, agrandissement: s.agrandissement, tiers_temps: s.tiers_temps }; })()`),
    { pap: true, upe2a: true, pai: true, agrandissement: true, tiers_temps: true });
});

test('_setStudentStatusExclusive ignore une clé inconnue plutôt que d\'inventer un champ', () => {
  assert.deepStrictEqual(evObj(`(() => { const s={}; _setStudentStatusExclusive(s,'inexistant'); return s; })()`), {});
});

test('MÉTA-TEST : tout statut déclaré appartient bien à un groupe', () => {
  // Une clé absente de _statusGroup est IGNORÉE en silence : elle ne s'activerait
  // jamais, et rien ne le dirait. Ce test attrape l'oubli au moment de l'ajout.
  const orphans = ev(`STUDENT_STATUSES.filter(k => !_statusGroup(k))`);
  assert.deepStrictEqual([...orphans], []);
});

test('_agrExamSuffix et _amenLabel rendent les aménagements d\'examen en suffixe', () => {
  assert.strictEqual(ev(`_amenLabel({ pap: true }, false)`), 'PAP');
  assert.strictEqual(ev(`_amenLabel({ pap: true, agrandissement: true }, false)`), 'PAP-A');
  assert.strictEqual(ev(`_amenLabel({ pap: true, agrandissement: true, tiers_temps: true }, false)`), 'PAP-A+⅓');
  // Sans pastille principale, le suffixe se suffit à lui-même.
  assert.strictEqual(ev(`_amenLabel({ tiers_temps: true }, false)`), '+⅓');
  assert.strictEqual(ev(`_amenLabel({}, false)`), '');
  // Un seul porteur du suffixe, choisi par _AGR_PRIMARY_ORDER (PAP avant PPS).
  assert.strictEqual(ev(`_amenLabel({ pap: true, upe2a: true, agrandissement: true }, false)`), 'PAP-A · UPE2A');
});

// ─────────────────────────────────────────────── Présence

test('_isStudentActive : la date de DÉPART est le 1er jour d\'absence', () => {
  // Un élève parti le 12 était encore là le 11, et n'est plus là le 12 lui-même.
  assert.strictEqual(ev(`_isStudentActive({ departureDate: '2025-11-12' }, '2025-11-11')`), true);
  assert.strictEqual(ev(`_isStudentActive({ departureDate: '2025-11-12' }, '2025-11-12')`), false);
  // Symétriquement, la date d'ARRIVÉE est le 1er jour de présence.
  assert.strictEqual(ev(`_isStudentActive({ arrivalDate: '2025-11-12' }, '2025-11-11')`), false);
  assert.strictEqual(ev(`_isStudentActive({ arrivalDate: '2025-11-12' }, '2025-11-12')`), true);
  assert.strictEqual(ev(`_isStudentActive({}, '2025-11-12')`), true);
});

// ─────────────────────────────────────────────── Options (tags)

test('createTag ne crée pas de doublon et renvoie l\'existant', () => {
  const r = evObj(`(() => {
    S.tags = {};
    const a = createTag('LATIN', 'Latin');
    const b = createTag('latin');           // même code, casse différente
    return { n: Object.keys(S.tags).length, same: a.id === b.id, name: b.name };
  })()`);
  assert.deepStrictEqual(r, { n: 1, same: true, name: 'Latin' });
});

test('deleteTag retire l\'option du catalogue ET de tous les élèves', () => {
  const r = evObj(`(() => {
    S.tags = {}; S.eleves = {};
    const t = createTag('LATIN'), u = createTag('BIL');
    S.eleves.s1 = { id:'s1', nom:'A', prenom:'a', tags:[t.id, u.id] };
    S.eleves.s2 = { id:'s2', nom:'B', prenom:'b', tags:[t.id] };
    deleteTag(t.id);
    return { catalogue: Object.keys(S.tags).length, s1: S.eleves.s1.tags, s2: S.eleves.s2.tags };
  })()`);
  assert.strictEqual(r.catalogue, 1);
  assert.deepStrictEqual([...r.s1].length, 1);
  assert.deepStrictEqual([...r.s2], []);
  // Et l'audit ne trouve plus de tag fantôme.
  assert.deepStrictEqual([...ev(`_auditState().filter(p => p.includes('tag fantôme'))`)], []);
});

test('_auditState signale un tag fantôme resté sur un élève', () => {
  const pb = ev(`(() => {
    S.classes = {}; S.releves = {}; S.documents = {}; S.tags = {};
    S.eleves = { s1: { id:'s1', nom:'A', prenom:'a', tags:['tag_disparu'] } };
    return _auditState();
  })()`);
  assert.match([...pb].join(' | '), /tag fantôme tag_disparu/);
});

// ─────────────────────────────────────────────── Classes

test('_impClassIdFromLabel compacte l\'ordinal sans toucher au libellé', () => {
  assert.strictEqual(ev(`_impClassIdFromLabel('5ème C')`), '5C');
  assert.strictEqual(ev(`_impClassIdFromLabel('3EME B')`), '3B');
  assert.strictEqual(ev(`_impClassIdFromLabel('5C')`), '5C');
  assert.strictEqual(ev(`_impClassIdFromLabel('2nde 3')`), '23');
  assert.strictEqual(ev(`_impClassIdFromLabel('')`), '');
});

test('_createClassBare ne réécrit jamais une classe existante', () => {
  const r = evObj(`(() => {
    S.classes = {};
    _createClassBare('5C', '5ème C', '2025-26');
    S.classes['5C'].eleves.push('s1');
    _createClassBare('5C', 'AUTRE NOM', '1999-00');   // doit être sans effet
    return { nom: S.classes['5C'].nom, annee: S.classes['5C'].annee, eleves: S.classes['5C'].eleves.length };
  })()`);
  assert.deepStrictEqual(r, { nom: '5ème C', annee: '2025-26', eleves: 1 });
});

// ─────────────────────────────────────────────── Recherche

test('_matchFilter cherche sans accents ni casse, sur le nom comme sur les options', () => {
  ev(`S.tags = {}; const t = createTag('LATIN','Latin'); S.__t = t.id;`);
  const stu = `{ nom:'DURAND', prenom:'Léa', tags:[S.__t] }`;
  assert.strictEqual(ev(`_matchFilter(${stu}, 'lea')`), true);      // « lea » trouve « Léa »
  assert.strictEqual(ev(`_matchFilter(${stu}, 'DUR')`), true);
  assert.strictEqual(ev(`_matchFilter(${stu}, 'latin')`), true);    // par l'option
  assert.strictEqual(ev(`_matchFilter(${stu}, 'durand lea')`), true); // tous les termes
  assert.strictEqual(ev(`_matchFilter(${stu}, 'durand bil')`), false);
  assert.strictEqual(ev(`_matchFilter(${stu}, '')`), true);
});

// ─────────────── Années à deux chiffres dans un champ date ───────────────

test('_ymdCompleteAnnee : « 13 » tapé dans un champ date devient 2013, pas l\'an 0013', () => {
  // ⚠️ Un <input type="date"> livre l'année TELLE QUE TAPÉE. Sur une saisie en série de
  // vingt-cinq dates de naissance, la date était rejetée à chaque fois, juste après que
  // le jour et le mois avaient été correctement saisis — et le message accusait
  // l'utilisateur d'une faute qu'il n'avait pas commise.
  ev(`S = _emptyState(); postLoadHook();`);
  assert.strictEqual(ev(`_ymdCompleteAnnee('0013-05-21')`), '2013-05-21');
  assert.strictEqual(ev(`_ymdCompleteAnnee('0002-01-01')`), '2002-01-01');
  // Une année complète n'est jamais touchée.
  assert.strictEqual(ev(`_ymdCompleteAnnee('2013-05-21')`), '2013-05-21');
  assert.strictEqual(ev(`_ymdCompleteAnnee('1998-12-31')`), '1998-12-31');
});

test('_ymdCompleteAnnee : une année à deux chiffres qui tomberait dans le FUTUR passe en 19xx', () => {
  // Personne n'est né l'an prochain. « 99 » veut dire 1999, pas 2099 — et c'est la seule
  // lecture qui ne demande rien à l'utilisateur.
  ev(`S = _emptyState(); postLoadHook();`);
  const an = Number(ev(`_todayYmd()`).slice(0, 4));
  assert.strictEqual(ev(`_ymdCompleteAnnee('0099-03-04')`), '1999-03-04');
  const futurProche = String((an - 2000) + 1).padStart(2, '0');
  assert.strictEqual(ev(`_ymdCompleteAnnee('00${futurProche}-03-04')`).slice(0, 4), String(1900 + Number(futurProche)));
});

test('_ymdCompleteAnnee : trois chiffres ne se devinent PAS, et le reste passe intact', () => {
  // ⚠️ On ne corrige que ce dont on est sûr : « 202 » peut être 2020 saisi trop vite
  // comme 1202 ou 0202. Deviner ici écrirait une date fausse sans que rien ne le signale.
  ev(`S = _emptyState(); postLoadHook();`);
  assert.strictEqual(ev(`_ymdCompleteAnnee('0202-05-21')`), '0202-05-21');
  assert.strictEqual(ev(`_ymdCompleteAnnee('')`), '');
  assert.strictEqual(ev(`_ymdCompleteAnnee('pas-une-date')`), 'pas-une-date');
  assert.strictEqual(ev(`_ymdCompleteAnnee(null)`), null);
});

test('saisie d\'une date : RIEN ne s\'écrit tant que le champ a le focus', () => {
  // ⚠️ Le défaut que ce test fige : un champ date devient « complet » dès le PREMIER
  // chiffre d'année tapé, et `change` part avec l'an 0001. Une première version
  // normalisait et réécrivait le champ à cet instant — ce qui remet le segment année à
  // zéro, si bien que taper « 1 » puis « 3 » donnait 2001 puis 2003 au lieu de 2013.
  // La correction n'est pas dans le calcul, elle est dans le MOMENT : on attend que le
  // champ soit quitté. Un test qui ne vérifierait que `_ymdCompleteAnnee` passerait sans
  // rien garantir.
  ev(`S = _emptyState(); postLoadHook();
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1'], ord:0 }; S.cur = '5C';
    S.eleves = { s1:{ id:'s1', nom:'A', prenom:'B', classe_id:'5C', tags:[], naissance:'2012-04-09' } };
    globalThis.__inp = { dataset:{ sid:'s1' }, value:'0001-05-21', focus(){}, blur(){} };`);

  ev(`document.activeElement = __inp; eleveNaisChange(__inp);`);
  assert.strictEqual(ev(`__inp.value`), '0001-05-21', 'le champ ne doit PAS être réécrit pendant la frappe');
  assert.strictEqual(ev(`S.eleves.s1.naissance`), '2012-04-09', 'rien ne doit être enregistré pendant la frappe');

  // Deuxième chiffre : l'accumulation a pu se faire, puisque rien n'a été touché.
  ev(`__inp.value = '0013-05-21'; eleveNaisChange(__inp);`);
  assert.strictEqual(ev(`__inp.value`), '0013-05-21');
  assert.strictEqual(ev(`S.eleves.s1.naissance`), '2012-04-09');

  // On quitte le champ : c'est LÀ qu'on complète l'année et qu'on enregistre.
  ev(`document.activeElement = null; eleveNaisCommit(__inp);`);
  assert.strictEqual(ev(`S.eleves.s1.naissance`), '2013-05-21');
  assert.strictEqual(ev(`__inp.value`), '2013-05-21', 'et le champ affiche enfin l\'année entière');
});

// ─────────────────────── Âge sous le nom ───────────────────────

test('_ageSubHTML : l\'âge révolu sous le nom, vide sans date de naissance', () => {
  const ref = ev(`_todayYmd()`);
  const [y] = ref.split('-').map(Number);
  // Né il y a exactement 13 ans + 1 jour → 13 ans révolus, quelle que soit la date du jour.
  const nais = ev(`(() => { const d = new Date(${y - 13}, ${Number(ref.slice(5, 7)) - 1}, ${Number(ref.slice(8, 10))} - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);
  assert.strictEqual(ev(`_ageSubHTML({ naissance: '${nais}' })`), '<span class="age-sub">13 ans</span>');
  assert.strictEqual(ev(`_ageSubHTML({ naissance: null })`), '<span class="age-sub"></span>');
  assert.strictEqual(ev(`_ageSubHTML(undefined)`), '<span class="age-sub"></span>');
  // L'id sert à la mise à jour en place depuis la saisie en série ; il est échappé.
  assert.strictEqual(ev(`_ageSubHTML({ naissance: '' }, 'age-s"1')`), '<span class="age-sub" id="age-s&quot;1"></span>');
});

test('_amenBadgesHTML : seuls les aménagements ACTIFS, dans leur encre — tiret sinon', () => {
  // Les huit boutons cliquables d'origine faisaient de cette colonne la plus large du
  // tableau, pour un réglage qui vient de l'import et se corrige par ✏️.
  const lab = html => [...html.matchAll(/<span class="amen" style="color:var\((--[a-z0-9-]+)\)">([^<]*)<\/span>/g)].map(m => [m[2], m[1]]);
  assert.deepStrictEqual(lab(ev(`_amenBadgesHTML({ ppre: true, pai: true, agrandissement: true })`)),
    [['PPRE', '--st-ppre-fg'], ['PAI', '--st-pai-fg'], ['📄-A', '--agr-fg']]);
  assert.deepStrictEqual(lab(ev(`_amenBadgesHTML({ ulis_incl: true, upe2a: true })`)),
    [['ULIS+', '--st-ulis-i-fg'], ['UPE2A', '--st-upe2a-fg']]);
  assert.match(ev(`_amenBadgesHTML({ tiers_temps: true })`), /⏱/);
  assert.strictEqual(ev(`_amenBadgesHTML({})`), '<span class="tb-hint">—</span>');
  assert.strictEqual(ev(`_amenBadgesHTML(undefined)`), '<span class="tb-hint">—</span>');
});

// ─────────────────── Audit du 2026-09-11 : ce que l'undo et le rechargement doivent redessiner

test('un rechargement distant DÉSARME aussi la salve des naissances en série', () => {
  // Troisième verrou de salve, oublié dans _applyReloadedData jusqu'à l'audit — même
  // piège que _ramUndoArmed en son temps : un Ctrl+Z qui ne remonte plus.
  ev(`S = _emptyState(); postLoadHook(); _elUndoArmed = true; _elUndoTimer = setTimeout(() => {}, 5000);`);
  ev(`_applyReloadedData(${JSON.stringify({ version: 1, classes: {}, eleves: {}, releves: {}, documents: {}, elections: {}, tags: {}, prefs: {}, cur: null })}, { lastModified: 999 })`);
  assert.strictEqual(ev(`_elUndoArmed`), false);
  assert.strictEqual(ev(`_elUndoTimer`), null);
});

test('la fiche, la remarque, les options et les classes se redessinent après un undo (table _MODAL_RERENDER)', () => {
  // La table existait depuis l'étape 1 et était restée VIDE : depuis que la fiche corrige
  // sur place, Ctrl+Z remettait la donnée sans redessiner la fiche (G2 affiché, G1 en S).
  const cles = evObj(`Object.keys(_MODAL_RERENDER)`);
  for (const k of ['mfiche', 'mrem', 'mtags', 'mclasses']) assert.ok(cles.includes(k), k);
  // Et pas les modales de FORMULAIRE, qui portent une saisie en cours.
  for (const k of ['me', 'mincident', 'mbilan', 'mel', 'mdoc']) assert.ok(!cles.includes(k), k + ' ne doit pas être redessinée');
});

test('_bilanOrdre est FIGÉ à l\'ouverture : trié « rédigé d\'abord », enregistrer ne fait pas sauter le suivant', () => {
  ev(`S = _emptyState(); postLoadHook();
      S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 }; S.cur = '5C';
      S.eleves = { s1:{id:'s1',nom:'A',prenom:'a',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'B',prenom:'b',classe_id:'5C',tags:[]}, s3:{id:'s3',nom:'C',prenom:'c',classe_id:'5C',tags:[]} };
      S.releves['5C'] = { '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1:1 } } };
      _eleveFilter = ''; eleveSort = { col: 'bilan', dir: 1 };
      _bilanOrdreFige = null; _bilanSid = 's1';`);
  const avant = evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`);
  assert.deepStrictEqual(avant, ['s1', 's2', 's3']);
  // La modale « s'ouvre » : l'ordre est capturé, puis un bilan est écrit pour s2.
  ev(`_bilanOrdreFige = _elevesRows(S.classes['5C']).map(x => x.s.id); bilanAdd('s2', { date:'2025-11-01', type:'conseil', texte:'x' });`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s2', 's1', 's3'], 'la liste, elle, a bougé');
  assert.deepStrictEqual(evObj(`_bilanOrdre()`), ['s1', 's2', 's3'], 'mais l’ordre parcouru par ◀ ▶ non');
  ev(`_bilanOrdreFige = null; eleveSort = { col: 'nom', dir: 1 };`);
});

// ── Régime et régime de sortie (v1.45.1) ──
test('Régimes : ½ pension, entrée (A…) et sortie (D…) — lecture, affichage, catalogues, migration de la v1.45.1', () => {
  const { loadApp } = require('./harness.js');
  const app2 = loadApp();
  const e2 = c => app2.__TESTEVAL(c), o2 = c => JSON.parse(JSON.stringify(app2.__TESTEVAL(c)));
  assert.deepStrictEqual(o2(`['DEMI-PENSIONNAIRE', 'DP4', 'Demi-pension', 'EXTERNE LIBRE', 'Externe', 'interne', 'INT', '', 'n\\'importe quoi'].map(_impNormRegime)`),
    ['DP', 'DP', 'DP', 'EXT', 'EXT', 'INT', 'INT', null, null]);
  assert.deepStrictEqual(o2(`_impNormJours('Lun., Mar., Mer., Jeu., Ven.')`), ['lun', 'mar', 'mer', 'jeu', 'ven']);
  assert.deepStrictEqual(o2(`_impNormJours('lundi, mardi, jeudi')`), ['lun', 'mar', 'jeu']);
  assert.strictEqual(e2(`_impNormJours('')`), null);
  // Les en-têtes réels de MBN.
  assert.deepStrictEqual(o2(`['Régime de ½ pension', 'Jours de ½ pension', "Régime d'entrée", 'Régime de sortie', 'Date de sortie'].map(_impGuessField)`),
    ['regime', 'jours', 'entree', 'sortie', 'depart']);
  // Deux catalogues d'office : entrée A1 A2, sortie D1 D2 D3.
  e2(`S = _emptyState(); postLoadHook();`);
  assert.deepStrictEqual(o2(`[_entreeCodes().map(c => c.code), _sortieCodes().map(c => c.code)]`), [['A1', 'A2'], ['D1', 'D2', 'D3']]);
  e2(`renderDonnees = () => {}; undoStack.length = 0; regimesCodesUI('regimesSortie', 'D1 = après la dernière heure\\nd2 : à midi\\nD1 = doublon\\n\\nD3')`);
  assert.deepStrictEqual(o2(`_sortieCodes()`), [{ code: 'D1', label: 'après la dernière heure' }, { code: 'D2', label: 'à midi' }, { code: 'D3', label: '' }]);
  assert.strictEqual(e2(`undoStack.length`), 1);
  e2(`S.eleves.x = { id:'x', nom:'A', prenom:'B', regime:'DP', joursDP:['lun','mar','jeu','ven'], entree:'A2', sortie:'D1', tags:[] }`);
  const h = e2(`_regimeBadgesHTML(S.eleves.x)`);
  assert.match(h, /title="Demi-pensionnaire — Lun\. Mar\. Jeu\. Ven\.">DP \(4 j\)</);
  assert.match(h, /class="el-reg el-entree" title="Régime d&#39;entrée A2">A2</);
  assert.match(h, /class="el-reg el-sortie" title="Régime de sortie D1 — après la dernière heure">D1</);
  // Migration : le catalogue unique de la v1.45.1 (A1 A2 D1 D2 D3, sans signification) se
  // sépare, et un code d'entrée rangé en « sortie » passe dans `entree`.
  e2(`S.prefs.regimesSortie = ['A1','A2','D1','D2','D3'].map(code => ({ code, label: '' })); S.eleves.y = { id:'y', nom:'C', prenom:'D', sortie:'A1', tags:[] }; S.eleves.x.regime = 'EXT'; postLoadHook()`);
  assert.deepStrictEqual(o2(`_sortieCodes().map(c => c.code)`), ['D1', 'D2', 'D3']);
  assert.strictEqual(e2(`S.eleves.y.entree`), 'A1', 'un code d\'entrée rangé en sortie passe en entrée');
  assert.strictEqual(e2(`S.eleves.y.sortie`), undefined);
  assert.strictEqual(e2(`S.eleves.x.joursDP`), undefined, 'des jours de ½ pension sans être demi-pensionnaire : effacés');
});

test('Import : régime, sortie et naissance lus pour les nouveaux, et COMPLÉTÉS (jamais remplacés) chez les élèves déjà présents', () => {
  const { loadApp } = require('./harness.js');
  const app2 = loadApp();
  const e2 = c => app2.__TESTEVAL(c), o2 = c => JSON.parse(JSON.stringify(app2.__TESTEVAL(c)));
  e2(`S = _emptyState(); postLoadHook(); S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['a'], ord:0 }; S.cur = '5C';
      S.eleves.a = { id:'a', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[], regime:'EXT' };`);
  const csv = 'Nom;Prénom;Régime;Autorisation de sortie;Date de naissance\nDURAND;Léa;DEMI-PENSIONNAIRE;D1;12/03/2013\nMARTIN;Noé;Externe;D4;05/07/2013';
  const res = o2(`_impAnalyze(${JSON.stringify(csv)}, { defaultClassId:'5C', skipDup:true })`);
  const noe = res.records.find(r => r.nom === 'MARTIN');
  assert.deepStrictEqual([noe.regime, noe.sortie, noe.naissance], ['EXT', 'D4', '2013-07-05']);
  const lea = res.records.find(r => r.nom === 'DURAND');
  assert.strictEqual(lea.ok, false, 'déjà présente : pas de doublon');
  assert.strictEqual(lea.existingSid, 'a');
  // Compléter : la naissance et la sortie (vides) entrent, le régime (déjà « externe ») reste.
  e2(`window.__r = _impAnalyze(${JSON.stringify(csv)}, { defaultClassId:'5C', skipDup:true }); _impCompleter(_impACompleter(window.__r))`);
  assert.deepStrictEqual(o2(`[S.eleves.a.regime, S.eleves.a.sortie, S.eleves.a.naissance]`), ['EXT', 'D1', '2013-03-12']);
  assert.strictEqual(e2(`_impACompleter(window.__r).length`), 0, 'plus rien à compléter');
  // Un code inconnu du catalogue y entre.
  e2(`_sortieAjouteCode('D4')`);
  assert.ok(o2(`_sortieCodes().map(c => c.code)`).includes('D4'));
});


// ── L'export MBN « régimes de sortie » (v1.45.2) : lu en .xlsx par le module ZIP de l'app ──
// Le classeur de test est FABRIQUÉ ici (noms inventés), avec la structure de l'export réel :
// Élève (« NOM Prénom (M.) ») · Classe · Régime de ½ pension · Jours de ½ pension ·
// Régime de sortie · Régime d'entrée.
test('MBN : lecture .xlsx, rattachement des élèves, changements montrés puis appliqués (une case vide ne vide rien)', async () => {
  const { loadApp } = require('./harness.js');
  const app2 = loadApp();
  const e2 = c => app2.__TESTEVAL(c), o2 = c => JSON.parse(JSON.stringify(app2.__TESTEVAL(c)));
  e2(`S = _emptyState(); postLoadHook(); S.classes['5E'] = { id:'5E', nom:'5e E', annee:'2025-26', eleves:['a','b','c'], ord:0 }; S.cur = '5E';
      S.eleves.a = { id:'a', nom:'DURAND', prenom:'Léa', classe_id:'5E', tags:[], regime:'EXT', sortie:'D1' };
      S.eleves.b = { id:'b', nom:'MARTIN', prenom:'Noé', classe_id:'5E', tags:[] };
      S.eleves.c = { id:'c', nom:'PETIT', prenom:'Inès', classe_id:'5E', tags:[], entree:'A2' };`);
  const sst = ['Élève', 'Classe', 'Régime de ½ pension', 'Jours de ½ pension', 'Régime de sortie', "Régime d'entrée",
    'DURAND Léa (Mme)', '5E', 'Demi-pensionnaire', 'Lun., Mar., Mer., Jeu., Ven.', 'D3', 'A1',
    'MARTIN Noé (M.)', 'Externe', 'D2', 'INCONNU Zoé (Mme)'];
  const si = t => sst.indexOf(t);
  const cell = (ref, t) => t === null ? '' : `<c r="${ref}" t="s"><v>${si(t)}</v></c>`;
  const row = (n, vals) => `<row r="${n}">${vals.map((v, i) => cell(String.fromCharCode(65 + i) + n, v)).join('')}</row>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${
    row(1, sst.slice(0, 6))}${row(2, sst.slice(6, 12))}${row(3, ['MARTIN Noé (M.)', '5E', 'Externe', null, 'D2', null])}${row(4, ['INCONNU Zoé (Mme)', '5E', 'Externe', null, 'D2', 'A1'])}</sheetData></worksheet>`;
  const shared = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sst.map(t => `<si><t>${t.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`;
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  e2(`window.__xlsx = _zipStore([{ name: 'xl/workbook.xml', data: ${JSON.stringify(wb)} }, { name: 'xl/_rels/workbook.xml.rels', data: ${JSON.stringify(rels)} },
      { name: 'xl/sharedStrings.xml', data: ${JSON.stringify(shared)} }, { name: 'xl/worksheets/sheet1.xml', data: ${JSON.stringify(sheet)} }])`);
  const sheets = JSON.parse(JSON.stringify(await app2.__TESTEVAL(`_xlsxRead(window.__xlsx)`)));
  assert.strictEqual(sheets[0].name, 'Sheet1');
  assert.deepStrictEqual(sheets[0].rows[1], ['DURAND Léa (Mme)', '5E', 'Demi-pensionnaire', 'Lun., Mar., Mer., Jeu., Ven.', 'D3', 'A1']);
  assert.deepStrictEqual(sheets[0].rows[2], ['MARTIN Noé (M.)', '5E', 'Externe', '', 'D2']);
  e2(`window.__rows = ${JSON.stringify(sheets[0].rows)}`);
  const lu = o2(`_mbnLire(window.__rows)`);
  assert.ok(lu.ok);
  assert.deepStrictEqual(lu.lignes[0], { ligne: 2, nom: 'DURAND Léa', civ: 'F', classe: '5E', regime: 'DP', regimeBrut: 'Demi-pensionnaire', joursDP: ['lun', 'mar', 'mer', 'jeu', 'ven'], entree: 'A1', sortie: 'D3' });
  const L = o2(`_mbnRapprocher(getCls(), _mbnLire(window.__rows).lignes)`);
  assert.deepStrictEqual(L.map(l => l.sid), ['a', 'b', null], 'Zoé n\'est pas de la classe : à rattacher');
  e2(`window.__L = _mbnRapprocher(getCls(), _mbnLire(window.__rows).lignes)`);
  const ch = o2(`_mbnChangements(window.__L)`).map(c => [c.sid, c.champ, c.avant, c.apres]);
  assert.deepStrictEqual(ch, [
    ['a', 'regime', 'EXT', 'DP'], ['a', 'joursDP', null, ['lun', 'mar', 'mer', 'jeu', 'ven']], ['a', 'entree', null, 'A1'], ['a', 'sortie', 'D1', 'D3'], ['a', 'civilite', null, 'F'],
    ['b', 'regime', null, 'EXT'], ['b', 'sortie', null, 'D2'], ['b', 'civilite', null, 'M']]);
  // Inès est absente de l'export : rien ne la touche. Une case d'entrée VIDE pour Noé : rien.
  e2(`undoStack.length = 0; pushUndo(); _mbnAppliquer(_mbnChangements(window.__L))`);
  assert.deepStrictEqual(o2(`[S.eleves.a.regime, S.eleves.a.sortie, S.eleves.a.entree, S.eleves.b.entree ?? null, S.eleves.c.entree]`), ['DP', 'D3', 'A1', null, 'A2']);
  assert.strictEqual(e2(`_mbnChangements(window.__L).length`), 0, 'appliqué : plus rien à changer');
  // Un fichier qui n'est pas l'export : refusé avec un message, pas d'exception.
  assert.match(o2(`_mbnLire([['Nom', 'Note'], ['X', '12']])`).err, /Élève/);
});
