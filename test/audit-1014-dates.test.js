// Audit du 2026-10-14, lot « dates » : saisie des dates (années à deux chiffres, dates illisibles),
// dates proposées par défaut (ramenées dans l'année scolaire), fenêtres de temps. Noms inventés.
// Classe d'une année PASSÉE (2020-21) : « aujourd'hui » y est toujours hors année, quel que soit le jour du test.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const BASE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2020-21', eleves:['s1','s2'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]} };
  S.cur = '5C'; undoStack.length = 0;
  S.documents.d1 = { id:'d1', titre:'Fiche', classIds:['5C'], dateDistribution:'2020-09-15', dateEcheance:null, suiviRetour:true, archive:false, ord:0,
    champs:[], retours:{ s1:{ rendu:true, dateRetour:'2020-09-20', reponses:{}, note:'' } } };`;
const STUBS = `window.__els = new Map(); window.__gid = document.getElementById; window.__qsa = document.querySelectorAll;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const UNSTUB = `document.getElementById = __gid; document.querySelectorAll = __qsa;`;

// ── 1. saveEdit : arrivée et départ ──
test('saveEdit : « 01/12/25 » (0025-12-01) est complété en 2025 ; une date illisible est refusée sans rien écrire', () => {
  ev(BASE + STUBS);
  try {
    ev(`openEdit('s1')`);
    ev(`__els.get('es-departure').value = '0025-12-01'`);
    ev(`saveEdit()`);
    assert.strictEqual(ev(`S.eleves.s1.departureDate`), '2025-12-01');
    assert.strictEqual(ev(`__els.get('es-departure').value`), '2025-12-01', 'le champ montre la date complétée');
    ev(`undoStack.length = 0; openEdit('s1')`);
    ev(`__els.get('es-arrival').value = '2025-02-31'; __els.get('es-departure').value = ''`);
    ev(`saveEdit()`);
    assert.strictEqual(ev(`S.eleves.s1.departureDate`), '2025-12-01', 'rien n\'est écrit');
    assert.strictEqual(ev(`S.eleves.s1.arrivalDate || null`), null);
    assert.strictEqual(ev(`undoStack.length`), 0, 'pas de cran d\'undo');
    ev(`__els.get('es-arrival').value = '0024-09-02'; __els.get('es-departure').value = '0025-12-01'`);
    ev(`saveEdit()`);
    assert.strictEqual(ev(`S.eleves.s1.arrivalDate`), '2024-09-02');
  } finally { ev(UNSTUB); }
});

// ── 2. dates des documents ──
test('docModalOk : distribution et échéance complétées ; une date illisible refuse l\'enregistrement', () => {
  ev(BASE + STUBS);
  try {
    ev(`document.querySelectorAll = sel => String(sel).includes('mdoc-classes') ? [{ checked: true, dataset: { cid: '5C' } }] : [];
      _docEdit = { id: 'd1', champs: [] };
      document.getElementById('mdoc-titre').value = 'Fiche'; document.getElementById('mdoc-desc').value = ''; document.getElementById('mdoc-suivi').checked = true;`);
    ev(`document.getElementById('mdoc-dist').value = '0025-09-10'; document.getElementById('mdoc-ech').value = '0025-09-24'; docModalOk()`);
    assert.deepStrictEqual(evObj(`[S.documents.d1.dateDistribution, S.documents.d1.dateEcheance]`), ['2025-09-10', '2025-09-24']);
    ev(`undoStack.length = 0; _docEdit = { id: 'd1', champs: [] };
      document.getElementById('mdoc-dist').value = '2025-02-30'; document.getElementById('mdoc-ech').value = ''; docModalOk()`);
    assert.strictEqual(ev(`S.documents.d1.dateDistribution`), '2025-09-10', 'refusée, rien écrit');
    assert.strictEqual(ev(`undoStack.length`), 0);
    assert.ok(ev(`_docEdit`), 'la fenêtre reste ouverte');
  } finally { ev(UNSTUB); }
});

test('docSetDateRetourUI / ficheDocDate : « 21/05/26 » est complété, une date illisible n\'efface RIEN', () => {
  ev(BASE);
  ev(`docSetDateRetourUI('d1', 's1', '0021-05-21')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-05-21');
  ev(`docSetDateRetourUI('d1', 's1', '2021-02-31')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-05-21', 'date impossible : la date reste');
  ev(`_ficheSid = 's1'; ficheDocDate('d1', '0021-06-02')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-06-02');
  ev(`ficheDocDate('d1', '2021-13-45')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-06-02');
  // Le champ revient à la date enregistrée, et un champ encore au focus n'écrit pas.
  ev(`window.__i = { value: '2021-13-45', validity: { badInput: false } }; docSetDateRetourUI('d1', 's1', __i)`);
  assert.strictEqual(ev(`__i.value`), '2021-06-02');
  ev(`window.__i = { value: '0021-07-01' };
      Object.defineProperty(document, 'activeElement', { get: () => __i, configurable: true });
      try { docSetDateRetourUI('d1', 's1', __i); } finally { delete document.activeElement; }`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-06-02', 'pas écrit tant que le champ est actif');
  ev(`docSetDateRetourUI('d1', 's1', __i)`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-07-01', 'écrit une fois le champ quitté, complété');
  // Vider volontairement efface bien la date.
  ev(`docSetDateRetourUI('d1', 's1', '')`);
  assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), null);
});

test('ramSetDate : année complétée ; illisible ou vide → la date précédente est gardée (plus de retombée sur aujourd\'hui)', () => {
  ev(BASE);
  ev(`_ramDate = '2021-03-01'; _ramSel = ['d1']`);
  ev(`ramSetDate('0021-05-21')`);
  assert.strictEqual(ev(`_ramDate`), '2021-05-21');
  ev(`ramSetDate('2021-02-31')`);
  assert.strictEqual(ev(`_ramDate`), '2021-05-21');
  ev(`ramSetDate('')`);
  assert.strictEqual(ev(`_ramDate`), '2021-05-21');
});

// ── 3. dates par défaut ramenées dans l'année scolaire ──
test('dates par défaut : ramassage, ✓ Rendu, nouveau document, contact de la fiche restent dans l\'année de la classe', () => {
  ev(BASE + STUBS);
  try {
    ev(`S.documents.d1.retours = {}`);
    ev(`openRamassage()`);
    assert.strictEqual(ev(`_ramDate`), '2021-07-31', 'ramassage');
    ev(`_ramSel = ['d1']; ramSetRendu('d1', 's1', true, '')`);
    assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2021-07-31', 'ramassage sans date lisible');
    ev(`_ficheSid = 's2'; ficheToggleRendu('d1')`);
    assert.strictEqual(ev(`S.documents.d1.retours.s2.dateRetour`), '2021-07-31', '✓ Rendu de la fiche');
    ev(`docSetRendu(S.documents.d1, 's2', false); elevesPapierRenduUI('s2', 'd1')`);
    assert.strictEqual(ev(`S.documents.d1.retours.s2.dateRetour`), '2021-07-31', '✓ Rendu de la fenêtre des papiers');
    ev(`openDocNew()`);
    assert.strictEqual(ev(`__els.get('mdoc-dist').value`), '2021-07-31', 'nouveau document');
    ev(`_docEdit = { id: null, champs: [] }; docApplyTemplate(0)`);
    assert.strictEqual(ev(`__els.get('mdoc-dist').value`), '2021-07-31', 'modèle');
    // Le formulaire de contact de la fiche (vue « dossier » d'avant le moment) : test de source, la carte
    // du tableau de bord ouvre la fenêtre des contacts à la place.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
    assert.match(src, /id="fi-j-date" value="\$\{_escAttr\(_dateParDefaut\(cls\)\)\}"/, 'contact');
  } finally { ev(UNSTUB); }
});

// ── 4. fenêtre « n mois » ──
test('_obsFenetre : « 1 mois » / « 2 mois » ne débordent plus en fin de mois', () => {
  ev(BASE);
  const f = (cle, auj) => evObj(`(() => { const F = _obsFenetre(S.classes['5C'], '${cle}', '${auj}'); return F && [F.start, F.end]; })()`);
  assert.deepStrictEqual(f('1m', '2021-03-31'), ['2021-03-01', '2021-03-31']);
  assert.deepStrictEqual(f('2m', '2021-04-30'), ['2021-03-01', '2021-04-30']);
  assert.deepStrictEqual(f('1m', '2021-05-15'), ['2021-04-16', '2021-05-15']);
  assert.deepStrictEqual(f('1m', '2021-05-31'), ['2021-05-01', '2021-05-31']);
  assert.deepStrictEqual(f('2m', '2020-12-31'), ['2020-11-01', '2020-12-31']);
  assert.deepStrictEqual(f('1m', '2021-03-29'), ['2021-03-01', '2021-03-29'], 'fév. 2021 : 28 jours');
  assert.deepStrictEqual(f('2m', '2021-01-15'), ['2020-11-16', '2021-01-15'], 'à cheval sur l\'année');
  // Jamais avant la rentrée.
  assert.deepStrictEqual(f('2m', '2020-09-20'), ['2020-08-01', '2020-09-20']);
});

// ── 5. débuts de période inexistants ──
test('_periods : un début « 02-30 », « 02-29 » (année non bissextile) ou « 04-31 » est ramené au dernier jour du mois', () => {
  ev(BASE);
  const per = (mode, starts) => evObj(`(() => { S.prefs.periodMode = '${mode}'; S.prefs.periodStarts = ${JSON.stringify({ [mode]: starts })};
    return _periods(S.classes['5C']).map(p => [p.start, p.end]); })()`);
  assert.deepStrictEqual(per('semestre', ['02-30']), [['2020-08-01', '2021-02-27'], ['2021-02-28', '2021-07-31']]);
  assert.deepStrictEqual(per('semestre', ['02-29']), [['2020-08-01', '2021-02-27'], ['2021-02-28', '2021-07-31']]);
  assert.deepStrictEqual(per('trimestre', ['12-01', '04-31']), [['2020-08-01', '2020-11-30'], ['2020-12-01', '2021-04-29'], ['2021-04-30', '2021-07-31']]);
  // Année bissextile : le 29 février existe.
  ev(`S.classes['5C'].annee = '2023-24'`);
  assert.deepStrictEqual(per('semestre', ['02-29']), [['2023-08-01', '2024-02-28'], ['2024-02-29', '2024-07-31']]);
  // Chaque jour de l'année scolaire est dans UNE période.
  ev(`S.classes['5C'].annee = '2020-21'`);
  ev(`S.prefs.periodStarts = { semestre: ['02-30'] }; S.prefs.periodMode = 'semestre'`);
  assert.strictEqual(ev(`_periodOf(S.classes['5C'], '2021-02-27').n`), 1);
  assert.strictEqual(ev(`_periodOf(S.classes['5C'], '2021-02-28').n`), 2);
});

// ── 6. heure MBN ──
test('_obsMbnDate : une heure impossible vaut l\'heure vide ; 23:59:50 reste le même jour à 23:59', () => {
  assert.deepStrictEqual(evObj(`_obsMbnDate('12/10/2025 25:99')`), { date: '2025-10-12', heure: '' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('12/10/2025 24:00')`), { date: '2025-10-12', heure: '' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('2025-10-12 10:75')`), { date: '2025-10-12', heure: '' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('2025-10-12T25:00')`), { date: '2025-10-12', heure: '' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('12/10/2025 8h05')`), { date: '2025-10-12', heure: '08:05' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('2025-10-12 23:59')`), { date: '2025-10-12', heure: '23:59' });
  const d = evObj(`_obsMbnDate('45930.99989')`);
  assert.strictEqual(d.heure, '23:59');
  assert.strictEqual(d.date, evObj(`_obsMbnDate('45930')`).date, 'même jour');
  assert.deepStrictEqual(evObj(`_obsMbnDate('45930.5')`).heure, '12:00');
});
