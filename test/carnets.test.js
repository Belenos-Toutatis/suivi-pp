// Relevés de carnet — le cœur métier. Le cumul est la seule vérité stockée ; l'évolution
// est CALCULÉE. Écrit AVANT la grille : c'est la logique la plus facile à se tromper et
// la plus coûteuse à déboguer dans un tableau.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// Une classe 2025-26, trois élèves, huit relevés — les mêmes suites que le tableur réel
// (7·8·8·10·11·14·16·18), avec un 'A' intercalé, un vide, et un cumul qui DIMINUE.
const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2','s3'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'A',prenom:'a',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'B',prenom:'b',classe_id:'5C',tags:[]}, s3:{id:'s3',nom:'C',prenom:'c',classe_id:'5C',tags:[]} };
  S.cur = '5C';
  const put = (d, counts) => { S.releves['5C'][d] = { date:d, ts:1, counts }; };
  S.releves['5C'] = {};
  put('2025-10-01', { s1: 7,   s2: 10,  s3: 3 });
  put('2025-10-15', { s1: 8,   s2: 'A', s3: 3 });
  put('2025-11-05', { s1: 8,   s2: 14         });   // s3 : vide (pas relevé)
  put('2025-12-03', { s1: 10,  s2: 14,  s3: 6 });
  put('2026-01-14', { s1: 11,  s2: 15,  s3: 4 });   // s3 DIMINUE : 6 → 4
  put('2026-02-04', { s1: 14,  s2: 20,  s3: 'A' });
  put('2026-03-11', { s1: 16,  s2: 27,  s3: 9 });
  put('2026-04-08', { s1: 18,  s2: 38,  s3: 9 });`;

// ─────────────────────────────────────────────── Valeurs et deltas

test('_relDates renvoie les dates triées — la clé date rend le tri gratuit', () => {
  ev(FIXTURE);
  ev(`S.releves['5C']['2025-09-17'] = { date:'2025-09-17', ts:0, counts:{} }`);   // ajouté après, mais antérieur
  const d = ev(`_relDates('5C')`);
  assert.strictEqual(d[0], '2025-09-17');
  assert.strictEqual(d[d.length - 1], '2026-04-08');
  assert.deepStrictEqual([...ev(`_relDates('INCONNUE')`)], []);
});

test('_relValue distingue nombre, absent et vide — trois choses différentes', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_relValue(S.releves['5C']['2025-10-01'], 's1')`), 7);
  assert.strictEqual(ev(`_relValue(S.releves['5C']['2025-10-15'], 's2')`), 'A');
  assert.strictEqual(ev(`_relValue(S.releves['5C']['2025-11-05'], 's3')`), null);   // vide ≠ 0 ≠ A
  assert.strictEqual(ev(`_relValue({ counts: { s1: 0 } }, 's1')`), 0);              // 0 = carnet vu, rien dedans
  // Robustesse : une valeur corrompue vaut « vide », jamais NaN.
  assert.strictEqual(ev(`_relValue({ counts: { s1: 'zz' } }, 's1')`), null);
  assert.strictEqual(ev(`_relValue({ counts: { s1: '12' } }, 's1')`), 12);          // chaîne numérique tolérée
});

test('_relDelta : le premier relevé compte pour son cumul', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2025-10-01', 's1')`), { n: 7, prev: null, delta: 7, decreasing: false });
});

test('_relDelta : delta = cumul − dernier cumul connu STRICTEMENT antérieur', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2025-10-15', 's1')`), { n: 8, prev: 7, delta: 1, decreasing: false });
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2025-11-05', 's1')`), { n: 8, prev: 8, delta: 0, decreasing: false });
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2026-04-08', 's2')`), { n: 38, prev: 27, delta: 11, decreasing: false });
});

test('_relDelta saute les A et les vides pour trouver le précédent', () => {
  ev(FIXTURE);
  // s2 absent le 15/10 : le 05/11 se compare au 01/10 (10), pas à rien.
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2025-11-05', 's2')`), { n: 14, prev: 10, delta: 4, decreasing: false });
  // s3 non relevé le 05/11 : le 03/12 se compare au 15/10 (3).
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2025-12-03', 's3')`), { n: 6, prev: 3, delta: 3, decreasing: false });
  // s3 absent le 04/02 : le 11/03 se compare au 14/01 (4).
  assert.deepStrictEqual(evObj(`_relDelta('5C', '2026-03-11', 's3')`), { n: 9, prev: 4, delta: 5, decreasing: false });
});

test('_relDelta : A et vide n\'ont pas de delta', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`_relDelta('5C', '2025-10-15', 's2')`), null);
  assert.strictEqual(ev(`_relDelta('5C', '2025-11-05', 's3')`), null);
});

test('_relDelta : un cumul qui DIMINUE est signalé, jamais corrigé', () => {
  ev(FIXTURE);
  const r = evObj(`_relDelta('5C', '2026-01-14', 's3')`);
  assert.deepStrictEqual(r, { n: 4, prev: 6, delta: -2, decreasing: true });
  // Et la valeur stockée n'a pas bougé.
  assert.strictEqual(ev(`S.releves['5C']['2026-01-14'].counts.s3`), 4);
});

test('_relLast : dernier relevé chiffré d\'un élève, avec sa date', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`_relLast('5C', 's2')`), { ymd: '2026-04-08', n: 38 });
  // Un élève dont le dernier relevé est un A : on remonte au précédent chiffré.
  ev(`S.releves['5C']['2026-05-06'] = { date:'2026-05-06', ts:9, counts:{ s2:'A' } }`);
  assert.deepStrictEqual(evObj(`_relLast('5C', 's2')`), { ymd: '2026-04-08', n: 38 });
  assert.strictEqual(ev(`_relLast('5C', 'inconnu')`), null);
});

// ─────────────────────────────────────────────── Périodes

test('_periods : semestres et trimestres tirés de l\'année de la classe et des bornes réglées', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'semestre'`);
  assert.deepStrictEqual(evObj(`_periods(S.classes['5C']).map(p => [p.label, p.start, p.end])`),
    [['S1', '2025-08-01', '2026-01-31'], ['S2', '2026-02-01', '2026-07-31']]);
  ev(`S.prefs.periodMode = 'trimestre'`);
  assert.deepStrictEqual(evObj(`_periods(S.classes['5C']).map(p => [p.label, p.start, p.end])`),
    [['T1', '2025-08-01', '2025-11-30'], ['T2', '2025-12-01', '2026-03-14'], ['T3', '2026-03-15', '2026-07-31']]);
});

test('_periods : les bornes sont des RÉGLAGES, pas des constantes', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'trimestre'; S.prefs.periodStarts = { trimestre: ['11-24', '03-02'] }`);
  assert.deepStrictEqual(evObj(`_periods(S.classes['5C']).map(p => [p.label, p.start])`),
    [['T1', '2025-08-01'], ['T2', '2025-11-24'], ['T3', '2026-03-02']]);
  // Bornes absentes ou invalides → défauts, jamais une exception ni un trou.
  ev(`S.prefs.periodStarts = { trimestre: ['n\\'importe', null] }`);
  assert.strictEqual(evObj(`_periods(S.classes['5C'])`).length, 3);
});

test('_periods : une année de classe illisible retombe sur l\'année scolaire courante', () => {
  ev(FIXTURE);
  ev(`S.classes['5C'].annee = 'oups'; S.prefs.periodMode = 'semestre'`);
  const p = evObj(`_periods(S.classes['5C'])`);
  assert.strictEqual(p.length, 2);
  assert.match(p[0].start, /^\d{4}-08-01$/);
});

test('_periodOf : la période d\'une date, ou null hors année', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'trimestre'`);
  assert.strictEqual(evObj(`_periodOf(S.classes['5C'], '2025-10-01')`).label, 'T1');
  assert.strictEqual(evObj(`_periodOf(S.classes['5C'], '2025-12-01')`).label, 'T2');   // borne incluse
  assert.strictEqual(evObj(`_periodOf(S.classes['5C'], '2026-03-14')`).label, 'T2');
  assert.strictEqual(evObj(`_periodOf(S.classes['5C'], '2026-03-15')`).label, 'T3');
  assert.strictEqual(ev(`_periodOf(S.classes['5C'], '2024-03-15')`), null);
});

// ─────────────────────────────────────────────── Totaux de période

test('_relPeriodTotal = cumul(dernier relevé de la période) − cumul(dernier relevé d\'avant)', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'semestre'`);
  // s1 en S1 (→ 31/01) : dernier = 11 (14/01), avant la période : rien → 11.
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's1', 0)`), 11);
  // s1 en S2 : dernier = 18 (08/04), dernier d'avant = 11 (14/01) → 7.
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's1', 1)`), 7);
  // ⚠️ SURTOUT PAS la somme des cumuls (7+8+8+10+11 = 44) : chaque observation serait
  // comptée autant de fois qu'il y a eu de relevés depuis.
  assert.notStrictEqual(ev(`_relPeriodTotal('5C', 's1', 0)`), 44);
});

test('_relPeriodTotal égale la somme des deltas de la période — les deux définitions coïncident', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'trimestre'`);
  for (const sid of ['s1', 's2', 's3']) for (const i of [0, 1, 2]) {
    const total = ev(`_relPeriodTotal('5C', '${sid}', ${i})`);
    const sum = ev(`(() => { const p = _periods(S.classes['5C'])[${i}]; let s = 0, any = false;
      for (const d of _relDates('5C')) { if (d < p.start || d > p.end) continue;
        const r = _relDelta('5C', d, '${sid}'); if (r) { s += r.delta; any = true; } }
      return any ? s : null; })()`);
    assert.strictEqual(total, sum, `${sid} période ${i}`);
  }
});

test('_relPeriodTotal saute les A : un absent au dernier relevé garde le total du précédent', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'semestre'`);
  // s3 en S2 : relevés 04/02 (A), 11/03 (9), 08/04 (9) → dernier chiffré 9 ; avant S2 : 4 (14/01) → 5.
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's3', 1)`), 5);
  // s2 en S1 : 15/10 est un A, sans effet → 15 − rien = 15.
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's2', 0)`), 15);
});

test('_relPeriodTotal : null quand la période n\'a aucun relevé chiffré pour l\'élève', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'trimestre'; S.releves['5C'] = { '2025-10-01': { date:'2025-10-01', ts:1, counts:{ s1:7 } } }`);
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's1', 0)`), 7);
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's1', 1)`), null);
  assert.strictEqual(ev(`_relPeriodTotal('5C', 's2', 0)`), null);
});

test('changer le réglage des périodes recalcule tout — rien n\'est stocké par période', () => {
  ev(FIXTURE);
  ev(`S.prefs.periodMode = 'semestre'`);
  const s1 = ev(`_relPeriodTotal('5C', 's1', 0)`);
  ev(`S.prefs.periodMode = 'trimestre'`);
  const t1 = ev(`_relPeriodTotal('5C', 's1', 0)`);   // T1 → 30/11 : dernier = 8 (05/11)
  assert.strictEqual(s1, 11);
  assert.strictEqual(t1, 8);
  assert.ok(!JSON.stringify(ev(`S.releves`)).includes('S1'), 'aucune trace de période dans les données');
});

// ─────────────────────────────────────────────── Mutations

test('releveCreate refuse une date déjà prise et une date illisible', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`releveCreate('5C', '2025-10-01')`), null);
  assert.strictEqual(ev(`releveCreate('5C', '01/10/2025')`), null);
  assert.strictEqual(ev(`releveCreate('5C', '2025-13-40')`), null);   // calendrier impossible
  const r = evObj(`releveCreate('5C', '2026-05-06', 'avant conseil')`);
  assert.deepStrictEqual({ date: r.date, label: r.label, counts: r.counts }, { date: '2026-05-06', label: 'avant conseil', counts: {} });
  assert.strictEqual(ev(`S.releves['5C']['2026-05-06'].date`), '2026-05-06');
});

test('releveSetDate déplace l\'entrée, refuse d\'écraser, et garde la clé = date', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`releveSetDate('5C', '2025-10-01', '2025-10-15')`), false);   // existe déjà
  assert.strictEqual(ev(`releveSetDate('5C', '2025-10-01', '2025-09-30')`), true);
  assert.strictEqual(ev(`'2025-10-01' in S.releves['5C']`), false);
  assert.strictEqual(ev(`S.releves['5C']['2025-09-30'].date`), '2025-09-30');
  assert.strictEqual(ev(`S.releves['5C']['2025-09-30'].counts.s1`), 7);
  assert.strictEqual(ev(`releveSetDate('5C', '2025-09-30', '2025-09-30')`), true);   // même date : rien à faire
  // Invariant : chaque entrée porte pour `date` sa propre clé.
  assert.ok(ev(`Object.entries(S.releves['5C']).every(([k, r]) => r.date === k)`));
});

test('releveSetCount : nombre, code absent (insensible à la casse), vide — et refuse le reste', () => {
  ev(FIXTURE);
  ev(`S.prefs.codeAbsent = 'Ab'`);
  assert.strictEqual(ev(`releveSetCount('5C', '2025-10-01', 's1', ' 12 ')`), true);
  assert.strictEqual(ev(`S.releves['5C']['2025-10-01'].counts.s1`), 12);
  assert.strictEqual(ev(`releveSetCount('5C', '2025-10-01', 's1', 'ab')`), true);
  assert.strictEqual(ev(`S.releves['5C']['2025-10-01'].counts.s1`), 'A');          // stocké sous la forme canonique
  assert.strictEqual(ev(`releveSetCount('5C', '2025-10-01', 's1', '')`), true);
  assert.strictEqual(ev(`'s1' in S.releves['5C']['2025-10-01'].counts`), false);   // vide = clé retirée
  assert.strictEqual(ev(`releveSetCount('5C', '2025-10-01', 's1', '0')`), true);
  assert.strictEqual(ev(`S.releves['5C']['2025-10-01'].counts.s1`), 0);            // 0 est une information
  for (const bad of ['-3', '4.5', 'x', '1e3']) assert.strictEqual(ev(`releveSetCount('5C', '2025-10-01', 's1', '${bad}')`), false, bad);
  assert.strictEqual(ev(`releveSetCount('5C', 'date-inconnue', 's1', '1')`), false);
});

test('_purgeStudentRefs retire aussi l\'élève des relevés (et _auditState reste vide)', () => {
  ev(FIXTURE);
  ev(`_purgeStudentRefs('s2')`);
  assert.ok(ev(`Object.values(S.releves['5C']).every(r => !('s2' in r.counts))`));
  assert.deepStrictEqual([...ev(`_auditState()`)], []);
});
