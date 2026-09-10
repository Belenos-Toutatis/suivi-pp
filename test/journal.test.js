// Journal des contacts avec les familles — le PP appelle, reçoit, écrit. Le texte libre
// de l'élève (`stu.remarque`) existait déjà (« Appel à la mère le 11/10 et le 29/11 »),
// mais un mot libre ne se compte pas et devient illisible un an après. `stu.journal` DATE
// et QUALIFIE chaque contact ; le texte libre reste à côté pour ce qui n'est PAS un
// contact (« peu d'apprentissage des leçons ») — les deux coexistent, l'un ne remplace
// jamais l'autre.
//
// ⚠️ Le piège du tri est le même que pour les relevés : deux appels le même jour ne
// doivent pas se départager au hasard. Le second saisi doit passer devant, d'où `ts`
// comme clé de départage — pas décoratif, il fait tout le travail à date égale.
//
// ⚠️ Ces fonctions n'existent pas encore au moment où ce fichier est écrit : ces tests
// DOIVENT échouer sur une fonction non définie tant que `journalAdd`, `journalSetTexte`,
// `journalRemove`, `_journalOf` et `_journalLast` ne sont pas écrites dans l'app.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0 };
  S.cur = '5C';
  S.eleves = {
    s1: { id:'s1', nom:'ALPHA', prenom:'Ana', classe_id:'5C', tags:[], remarque:"Peu d'apprentissage des leçons." },
    s2: { id:'s2', nom:'BETA',  prenom:'Bo',  classe_id:'5C', tags:[] },
  };`;

// ─────────────────────── Ajout nominal ───────────────────────

test('journalAdd : ajout nominal — forme complète de l\'entrée créée', () => {
  ev(FIXTURE);
  const e = evObj(`journalAdd('s1', '2025-10-11', 'appel', 'Appel à la mère')`);
  assert.strictEqual(typeof e.id, 'string');
  assert.ok(e.id.length > 0, 'un id non vide');
  assert.strictEqual(e.date, '2025-10-11');
  assert.strictEqual(typeof e.ts, 'number');
  assert.strictEqual(e.type, 'appel');
  assert.strictEqual(e.texte, 'Appel à la mère');
  // Poussée dans le journal de l'élève, et relisible par _journalOf.
  assert.strictEqual(evObj(`S.eleves.s1.journal.length`), 1);
  assert.deepStrictEqual(evObj(`_journalOf('s1').map(x => x.id)`), [e.id]);
});

test('journalAdd : deux entrées successives ont des ids différents', () => {
  ev(FIXTURE);
  const ids = evObj(`[journalAdd('s1','2025-10-01','appel','A').id, journalAdd('s1','2025-10-02','appel','B').id]`);
  assert.notStrictEqual(ids[0], ids[1]);
});

// ─────────────────────── Les quatre refus ───────────────────────
// Une entrée sans contenu ni date est du bruit dans un journal qu'on relit un an après
// pour préparer un conseil de classe : elle doit être refusée ET ne rien écrire du tout.

test('journalAdd refuse un élève inconnu — retourne null', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`journalAdd('fantome', '2025-10-01', 'appel', 'Texte')`), null);
});

test('journalAdd refuse une date invalide ou absente — et n\'écrit rien', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`journalAdd('s1', '2025-13-40', 'appel', 'Texte')`), null);   // mois inexistant
  assert.strictEqual(ev(`journalAdd('s1', '01/10/2025', 'appel', 'Texte')`), null);   // mauvais format
  assert.strictEqual(ev(`journalAdd('s1', '', 'appel', 'Texte')`), null);             // vide
  assert.strictEqual(ev(`journalAdd('s1', undefined, 'appel', 'Texte')`), null);      // absente
  assert.strictEqual(ev(`S.eleves.s1.journal`), undefined, 'aucune de ces tentatives n\'a créé de journal');
});

test('journalAdd refuse un texte vide ou fait uniquement d\'espaces — et n\'écrit rien', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`journalAdd('s1', '2025-10-01', 'appel', '')`), null);
  assert.strictEqual(ev(`journalAdd('s1', '2025-10-01', 'appel', '   ')`), null);
  assert.strictEqual(ev(`journalAdd('s1', '2025-10-01', 'appel', undefined)`), null);
  assert.strictEqual(ev(`S.eleves.s1.journal`), undefined);
});

test('MÉTA-TEST : les quatre refus portent bien sur des cas qui, sinon, seraient acceptés', () => {
  // Vérifie que le cas nominal correspondant à chaque refus passerait normalement, pour
  // être sûr que le refus teste bien la bonne condition et non un autre défaut du fixture.
  ev(FIXTURE);
  assert.notStrictEqual(ev(`journalAdd('s1', '2025-10-01', 'appel', 'Texte')`), null);
  assert.notStrictEqual(ev(`journalAdd('s2', '2025-10-01', 'appel', 'Texte')`), null);
});

// ─────────────────────── Repli du type inconnu ───────────────────────

test('un type inconnu retombe sur \'autre\' — jamais de refus pour la catégorie', () => {
  ev(FIXTURE);
  const e = evObj(`journalAdd('s1', '2025-10-01', 'categorie-disparue', 'Note importante')`);
  assert.notStrictEqual(e, null, 'on ne perd pas la note parce que le type n\'existe plus');
  assert.strictEqual(e.type, 'autre');
  assert.strictEqual(e.texte, 'Note importante');
});

test('un type connu (appel, rencontre, courriel, mot, autre) est conservé tel quel', () => {
  ev(FIXTURE);
  for (const t of ['appel', 'rencontre', 'courriel', 'mot', 'autre']) {
    assert.strictEqual(evObj(`journalAdd('s1', '2025-10-01', '${t}', 'x')`).type, t);
  }
});

// ─────────────────────── Nettoyage du texte ───────────────────────

test('journalAdd nettoie le texte de ses espaces de bord', () => {
  ev(FIXTURE);
  const e = evObj(`journalAdd('s1', '2025-10-01', 'appel', '   Appel à la mère   ')`);
  assert.strictEqual(e.texte, 'Appel à la mère');
});

// ─────────────────────── Tri : date décroissante, puis ts ───────────────────────

test('_journalOf trie par date DÉCROISSANTE — le plus récent en premier', () => {
  ev(FIXTURE);
  ev(`journalAdd('s1', '2025-09-01', 'appel',     'Ancien');
      journalAdd('s1', '2025-11-15', 'rencontre', 'Récent');
      journalAdd('s1', '2025-10-10', 'courriel',  'Milieu');`);
  assert.deepStrictEqual(evObj(`_journalOf('s1').map(e => e.date)`), ['2025-11-15', '2025-10-10', '2025-09-01']);
});

test('_journalOf : à date ÉGALE, départage par ts DÉCROISSANT — le dernier saisi devant', () => {
  ev(FIXTURE);
  // ts posés à la main pour ne pas dépendre de la résolution de Date.now() dans le test.
  ev(`(() => {
    const e1 = journalAdd('s1', '2025-10-01', 'appel', 'Premier appel');
    e1.ts = 1000;
    const e2 = journalAdd('s1', '2025-10-01', 'appel', 'Second appel');
    e2.ts = 2000;
  })()`);
  assert.deepStrictEqual(evObj(`_journalOf('s1').map(e => e.texte)`), ['Second appel', 'Premier appel']);
});

test('_journalLast retourne la première entrée de ce tri', () => {
  ev(FIXTURE);
  ev(`journalAdd('s1', '2025-09-01', 'appel', 'Ancien'); journalAdd('s1', '2025-11-15', 'rencontre', 'Récent');`);
  assert.strictEqual(evObj(`_journalLast('s1').texte`), 'Récent');
});

// ─────────────────────── Replis : élève inconnu, journal absent ───────────────────────

test('_journalOf et _journalLast replient proprement sur un élève inconnu — jamais d\'exception', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_journalOf('fantome')`), []);
  assert.strictEqual(ev(`_journalLast('fantome')`), null);
});

test('_journalOf et _journalLast replient proprement sur un élève SANS journal', () => {
  ev(FIXTURE);
  // s2 existe, mais n'a jamais eu de contact noté : pas de propriété `journal` du tout.
  assert.deepStrictEqual(evObj(`_journalOf('s2')`), []);
  assert.strictEqual(ev(`_journalLast('s2')`), null);
});

// ─────────────────────── journalSetTexte ───────────────────────

test('journalSetTexte modifie le texte, nettoyé de ses espaces de bord', () => {
  ev(FIXTURE);
  const id = evObj(`journalAdd('s1', '2025-10-01', 'appel', 'Premier texte').id`);
  assert.strictEqual(ev(`journalSetTexte('s1', '${id}', '  Texte corrigé  ')`), true);
  assert.strictEqual(evObj(`_journalOf('s1')[0].texte`), 'Texte corrigé');
});

test('journalSetTexte refuse un texte vide — sans rien modifier', () => {
  ev(FIXTURE);
  const id = evObj(`journalAdd('s1', '2025-10-01', 'appel', 'Texte original').id`);
  assert.strictEqual(ev(`journalSetTexte('s1', '${id}', '   ')`), false);
  assert.strictEqual(evObj(`_journalOf('s1')[0].texte`), 'Texte original');
});

test('journalSetTexte refuse un id inconnu, ou un élève inconnu', () => {
  ev(FIXTURE);
  ev(`journalAdd('s1', '2025-10-01', 'appel', 'Texte')`);
  assert.strictEqual(ev(`journalSetTexte('s1', 'id-fantome', 'Nouveau texte')`), false);
  assert.strictEqual(ev(`journalSetTexte('fantome', 'peu-importe', 'Nouveau texte')`), false);
  // Et rien n'a bougé côté existant.
  assert.strictEqual(evObj(`_journalOf('s1')[0].texte`), 'Texte');
});

// ─────────────────────── journalRemove ───────────────────────

test('journalRemove supprime l\'entrée visée, et seulement elle', () => {
  ev(FIXTURE);
  ev(`journalAdd('s1', '2025-10-01', 'appel', 'A'); journalAdd('s1', '2025-10-05', 'courriel', 'B');`);
  const ids = evObj(`_journalOf('s1').map(e => e.id)`);   // [B, A] : le plus récent d'abord
  assert.strictEqual(ev(`journalRemove('s1', '${ids[0]}')`), true);
  assert.deepStrictEqual(evObj(`_journalOf('s1').map(e => e.id)`), [ids[1]]);
});

test('journalRemove refuse un id inconnu, ou un élève inconnu — sans rien retirer', () => {
  ev(FIXTURE);
  ev(`journalAdd('s1', '2025-10-01', 'appel', 'A')`);
  assert.strictEqual(ev(`journalRemove('s1', 'id-fantome')`), false);
  assert.strictEqual(ev(`journalRemove('fantome', 'peu-importe')`), false);
  assert.strictEqual(evObj(`_journalOf('s1').length`), 1, 'rien n\'a été retiré par erreur');
});

// ─────────────────────── Coexistence avec la remarque libre ───────────────────────
// ⚠️ Les deux vivent côte à côte. Remplacer la remarque par le journal ferait perdre les
// observations qui ne sont PAS des contacts datés (« peu d'apprentissage des leçons »).

test('journalAdd / journalSetTexte / journalRemove ne touchent JAMAIS stu.remarque', () => {
  ev(FIXTURE);
  const remarqueAvant = ev(`S.eleves.s1.remarque`);
  assert.notStrictEqual(remarqueAvant, undefined, 'le fixture doit partir d\'une remarque non vide pour que le test ait un sens');
  const id = evObj(`journalAdd('s1', '2025-10-01', 'appel', 'Appel au père').id`);
  assert.strictEqual(ev(`S.eleves.s1.remarque`), remarqueAvant);
  ev(`journalSetTexte('s1', '${id}', 'Appel au père — reporté au 12/10')`);
  assert.strictEqual(ev(`S.eleves.s1.remarque`), remarqueAvant);
  ev(`journalRemove('s1', '${id}')`);
  assert.strictEqual(ev(`S.eleves.s1.remarque`), remarqueAvant);
});

// ─────────────────────── Convention du projet : sans pushUndo ni save ───────────────────────

test('journalAdd / journalSetTexte / journalRemove ne font ni pushUndo() ni save() — à l\'appelant de le faire', () => {
  ev(FIXTURE);
  const stackBefore = ev(`undoStack.length`);
  const id = evObj(`journalAdd('s1', '2025-10-01', 'appel', 'A').id`);
  ev(`journalSetTexte('s1', '${id}', 'A corrigé'); journalRemove('s1', '${id}')`);
  assert.strictEqual(ev(`undoStack.length`), stackBefore, 'aucune de ces trois mutations ne pousse d\'undo elle-même');
});
