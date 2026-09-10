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
