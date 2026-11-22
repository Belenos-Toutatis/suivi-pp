// Audit du 2026-11-22 — retours de documents : les défauts confirmés, corrigés. Chaque test a été vérifié en
// échec sur la version d'avant la correction. Noms inventés.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
const BASE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2020-21', eleves:['s1','s2'], ord:0 };
  S.eleves = { s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]}, s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]} };
  S.cur = '5C'; undoStack.length = 0;
  S.documents.d1 = { id:'d1', titre:'Fiche', description:'', classIds:['5C'], dateDistribution:'2020-09-15', dateEcheance:'2020-09-29', suiviRetour:true, archive:false, ord:0,
    champs:[], retours:{ s1:{ rendu:true, dateRetour:'2020-09-20', reponses:{}, note:'' } } };`;
const STUBS = `window.__els = new Map(); window.__gid = document.getElementById; window.__qsa = document.querySelectorAll;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };
  document.querySelectorAll = sel => String(sel).includes('mdoc-classes') ? [{ checked: true, dataset: { cid: '5C' } }] : [];
  window.ouvrir = () => { _docEdit = { id: 'd1', champs: [] }; for (const [k, v] of [['mdoc-titre', 'Fiche'], ['mdoc-desc', ''], ['mdoc-dist', '2020-09-15'], ['mdoc-ech', '2020-09-29']]) { const e = document.getElementById(k); e.value = v; e.validity = { badInput: false }; } document.getElementById('mdoc-suivi').checked = true; };`;
const UNSTUB = `document.getElementById = __gid; document.querySelectorAll = __qsa;`;

test('docModalOk : une date à moitié tapée (champ « 29/09/aaaa ») n\'efface pas l\'échéance — refus, fenêtre gardée', () => {
  ev(BASE + STUBS);
  try {
    // Un champ date incomplet se lit '' avec validity.badInput : il passait pour « vidé » et l'échéance devenait null.
    ev(`ouvrir(); Object.assign(document.getElementById('mdoc-ech'), { value: '', validity: { badInput: true } }); docModalOk()`);
    assert.strictEqual(ev(`S.documents.d1.dateEcheance`), '2020-09-29', 'l\'échéance est gardée');
    assert.ok(ev(`!!_docEdit`), 'la fenêtre reste ouverte');
    assert.strictEqual(ev(`undoStack.length`), 0, 'pas de cran d\'annulation');
    ev(`ouvrir(); Object.assign(document.getElementById('mdoc-dist'), { value: '', validity: { badInput: true } }); docModalOk()`);
    assert.strictEqual(ev(`S.documents.d1.dateDistribution`), '2020-09-15', 'la distribution aussi');
    // Un champ vidé EXPRÈS (pas de badInput) efface toujours.
    ev(`ouvrir(); Object.assign(document.getElementById('mdoc-ech'), { value: '', validity: { badInput: false } }); docModalOk()`);
    assert.strictEqual(ev(`S.documents.d1.dateEcheance`), null, 'vider le champ efface l\'échéance');
    assert.strictEqual(ev(`undoStack.length`), 1);
  } finally { ev(UNSTUB); }
});

test('« ✓ Enregistrer » sans rien changer ne pose pas de cran d\'annulation (le premier Ctrl+Z ne faisait rien de visible)', () => {
  ev(BASE + STUBS);
  try {
    ev(`ouvrir(); docModalOk()`);
    assert.strictEqual(ev(`undoStack.length`), 0);
    assert.ok(ev(`_docEdit === null`), 'la fenêtre se ferme quand même');
    ev(`ouvrir(); document.getElementById('mdoc-titre').value = 'Fiche de renseignement'; docModalOk()`);
    assert.strictEqual(ev(`undoStack.length`), 1, 'un vrai changement pose son cran');
    assert.strictEqual(ev(`S.documents.d1.titre`), 'Fiche de renseignement');
  } finally { ev(UNSTUB); }
});

test('le badge « rendus / attendus » ne se coupe pas sur deux lignes', () => {
  const regle = (SRC.match(/^\.badge \{[^}]*\}/m) || [''])[0];
  assert.match(regle, /white-space:\s*nowrap/);
});
