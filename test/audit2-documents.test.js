// Second audit du 2026-10-14, lot « documents » (et fiche / liste des élèves) : réponse orpheline lue sous son id,
// papier pas encore distribué partout, copie d'un document datée, options (chiffre, lettre, préfixe, libellé exact),
// avertissement avant de perdre des réponses, moment de la fiche et carte de chaleur, ✏️ sans modification,
// cumul énorme dans la courbe.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

function mk() {
  const app = loadApp();
  const cache = {};
  const makeEl = () => ({ _h: '', _t: '', _v: '', hidden: false, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} }, style: {}, dataset: {}, children: [], options: [],
    appendChild(c) { return c; }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, closest() { return null; },
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, get textContent() { return this._t; }, set textContent(v) { this._t = v; }, get value() { return this._v; }, set value(v) { this._v = v; }, checked: false });
  app.document.getElementById = id => (cache[id] = cache[id] || makeEl());
  app.__cache = cache;
  return app;
}
const ev = (app, c) => app.__TESTEVAL(c);
const ob = (app, c) => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// 5C, un élève « a », « aujourd'hui » = 14/10/2025 (première période de l'année 2025-26).
const BASE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode='semestre';
 const __t=_todayYmd; _todayYmd=(d)=>d?__t(d):'2025-10-14';
 S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a','b'],ord:0};S.cur='5C';
 S.eleves={a:{id:'a',nom:'A',prenom:'a',classe_id:'5C',tags:[]},b:{id:'b',nom:'B',prenom:'b',classe_id:'5C',tags:[]}};
 globalThis.COL=()=>_chaleurMomentsTous(S.classes['5C']).find(c=>c.type==='conseil'&&c.pIdx===0);`;

// ── 1. Réponse orpheline ──
test('une réponse sur une option retirée ne s\'affiche plus sous son id brut (fiche, fiche imprimée)', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
    champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, BILINGUE',[])},
            {id:'o2',label:'Option 2',type:'multi',par:'famille',obligatoire:false,options:_champParseOptions('LATIN, DNL',[])}],retours:{}};
   const d=S.documents.d1; docSetReponse(d,'a','o1','bilingue'); docSetRendu(d,'a',true); docToggleReponse(d,'a','o2','latin'); docToggleReponse(d,'a','o2','dnl');
   d.champs[0].options=_champParseOptions('LATIN',d.champs[0].options);   // BILINGUE retirée
   d.champs[1].options=_champParseOptions('LATIN',d.champs[1].options);   // DNL retirée`);
  const rep = ob(app, `_ficheDocuments(S.classes['5C'],'a')[0].reponses`);
  assert.deepStrictEqual(rep.map(r => r.champ + ':' + r.valeurs.join()), ['Option 2:LATIN'], 'l\'orpheline disparaît, la réponse valide reste libellée');
  const p = ev(app, `_fichePrintHTML(S.classes['5C'],'a',COL(),{parts:['papiers']},null)`);
  assert.ok(!/bilingue|dnl/i.test(p), 'la fiche imprimée ne montre pas les ids orphelins');
});

// ── 2. Papier pas encore distribué ──
const BASE_AVENIR = BASE + `
 S.documents.d1={id:'d1',titre:'Préparé pour décembre',classIds:['5C'],dateDistribution:'2025-12-01',dateEcheance:null,suiviRetour:true,archive:false,ord:0,champs:[],retours:{}};
 S.documents.d2={id:'d2',titre:'Déjà distribué',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:1,champs:[],retours:{}};`;

test('papier à distribution à venir : ni « pas rendu » ni « à rendre » dans la carte de chaleur, les faits, la fiche, la fiche imprimée, la synthèse', () => {
  const app = mk();
  ev(app, BASE_AVENIR);
  assert.deepStrictEqual(ob(app, `_syntheseRow(S.classes['5C'],S.eleves.a).nonRendus`), ['Déjà distribué']);   // la référence
  const g = ob(app, `(()=>{ const d=_chaleurGroupes(S.classes['5C'],[],COL()).find(x=>x.key==='docs'); return { c:d.cell('a','d1'), c2:d.cell('a','d2'), s:d.sum('a') }; })()`);
  assert.ok(!/miss/.test(g.c[0]) && g.c[1] !== '☐', 'case du papier à venir : neutre');
  assert.strictEqual(g.c2[1], '☐');
  assert.strictEqual(g.s[1], '1 ☐', 'compte : seulement le papier déjà distribué');
  const faits = ob(app, `_ficheFaits(S.classes['5C'],S.eleves.a,COL()).filter(f=>f.k==='papier')`);
  assert.strictEqual(faits.length, 1);
  assert.ok(!/Préparé pour décembre/.test(faits[0].html) && /Déjà distribué/.test(faits[0].html));
  const card = ev(app, `_ficheTableauHTML(S.classes['5C'],S.eleves.a,COL())`);
  assert.ok(/1 à rendre/.test(card) && !/2 à rendre/.test(card), 'compteur de la carte Papiers');
  assert.ok(/pas encore distribué/.test(card), 'dit en clair');
  const pr = ev(app, `_fichePrintHTML(S.classes['5C'],'a',COL(),{parts:['papiers']},null)`);
  assert.ok(!/Préparé pour décembre — ☐/.test(pr) && /pas encore distribué/.test(pr) && /Déjà distribué — ☐ pas rendu/.test(pr));
  const syn = ev(app, `JSON.stringify(_periodeSynthese(S.classes['5C'],0,{type:'conseil'}))`);
  assert.ok(/Déjà distribué/.test(syn) && !/Préparé pour décembre/.test(syn), 'synthèse de période');
});

test('ramassage : un papier pas encore distribué n\'est pas présélectionné « incomplet », mais reste choisissable', () => {
  const app = mk();
  ev(app, BASE_AVENIR + ` renderDocuments=()=>{};`);
  ev(app, `openRamassage()`);
  assert.deepStrictEqual(ob(app, `_ramSel`), ['d2']);
  ev(app, `ramToggleDoc('d1', true)`);
  assert.deepStrictEqual(ob(app, `_ramSel`).sort(), ['d1', 'd2']);
});

// ── 3. Duplicata ──
test('dupliquer un document : la copie est datée (date du jour), elle ne passe pas pour distribuée sans date', () => {
  const app = mk();
  ev(app, BASE + `S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2024-09-10',dateEcheance:'2024-10-01',suiviRetour:true,archive:false,ord:0,champs:[],retours:{}};
    docDuplicate('d1')`);
  const copie = ob(app, `Object.values(S.documents).find(d=>d.id!=='d1')`);
  assert.strictEqual(copie.dateDistribution, ev(app, `_dateParDefaut(S.classes['5C'])`));
  assert.strictEqual(copie.dateEcheance, null);
});

// ── 4. Options ──
test('options : jamais d\'appariement « faute de frappe » sur un chiffre, une lettre isolée ou un préfixe de sens', () => {
  const app = mk();
  const P = (txt, prev) => ob(app, `_champParseOptions(${JSON.stringify(txt)}, ${JSON.stringify(prev)})`);
  const mkOpts = txt => P(txt, []);
  const o12 = mkOpts('Option 1, Option 3');
  assert.deepStrictEqual(P('Option 2, Option 3', o12).map(o => o.id), ['option-2', 'option-3'], 'Option 1 → Option 2 : une autre option');
  const ga = mkOpts('Groupe A, Groupe C');
  assert.deepStrictEqual(P('Groupe B, Groupe C', ga).map(o => o.id), ['groupe-b', 'groupe-c']);
  const fav = mkOpts('Favorable, Réservé');
  assert.deepStrictEqual(P('Défavorable, Réservé', fav).map(o => o.id), ['defavorable', 'reserve']);
  const avis = mkOpts('Avis favorable, Réservé');
  assert.deepStrictEqual(P('Avis défavorable, Réservé', avis).map(o => o.id), ['avis-defavorable', 'reserve']);
  const suff = mkOpts('Suffisant, Moyen');
  assert.deepStrictEqual(P('Insuffisant, Moyen', suff).map(o => o.id), ['insuffisant', 'moyen']);
  // la vraie faute de frappe garde ses réponses (test existant, rappelé)
  const lat = mkOpts('LATIN, BILINGUE');
  assert.deepStrictEqual(P('LATTIN, BILINGUE', lat).map(o => o.id), ['latin', 'bilingue']);
});

test('options : un libellé retrouvé exactement garde son option avant qu\'un autre ne la reprenne par son id', () => {
  const app = mk();
  const P = (txt, prev) => ob(app, `_champParseOptions(${JSON.stringify(txt)}, ${JSON.stringify(prev)})`);
  const a = P('LATIN, BILINGUE', []);
  const b = P('LATTIN, BILINGUE', a);                       // LATTIN garde l'id latin
  assert.deepStrictEqual(b.map(o => o.id), ['latin', 'bilingue']);
  const c = P('LATIN, LATTIN, BILINGUE', b);
  const lattin = c.find(o => o.label === 'LATTIN'), latin = c.find(o => o.label === 'LATIN');
  assert.strictEqual(lattin.id, 'latin', 'LATTIN garde ses réponses');
  assert.notStrictEqual(latin.id, 'latin', 'LATIN est une option neuve');
  assert.strictEqual(new Set(c.map(o => o.id)).size, 3);
});

test('enregistrer un document qui retire une option portant des réponses : avertissement, et on peut renoncer', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
    champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, BILINGUE',[])}],retours:{}};
   docSetReponse(S.documents.d1,'a','o1','bilingue'); docSetReponse(S.documents.d1,'b','o1','bilingue');
   renderDocuments=()=>{}; globalThis.__C=null; _uiConfirm=(o)=>{ globalThis.__C=o; };
   const el=(id,v)=>{ const e=document.getElementById(id); e.value=v; return e; };
   el('mdoc-titre','Orientation'); el('mdoc-desc',''); el('mdoc-dist','2025-09-10'); el('mdoc-ech',''); el('mdoc-suivi','').checked=true;
   document.querySelectorAll = sel => sel==='#mdoc-classes input[data-cid]' ? [{dataset:{cid:'5C'},checked:true}] : [];
   _docEdit={id:'d1',champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, DNL',S.documents.d1.champs[0].options)}]};
   docModalOk();`);
  const c = ob(app, `({ msg: __C && __C.message, opts: S.documents.d1.champs[0].options.map(o=>o.id) })`);
  assert.ok(c.msg && /2 réponses portées sur « BILINGUE » ne seront plus comptées/.test(c.msg), c.msg);
  assert.deepStrictEqual(c.opts, ['latin', 'bilingue'], 'rien n\'est enregistré avant la confirmation');
  ev(app, `__C.onOk()`);
  assert.deepStrictEqual(ob(app, `S.documents.d1.champs[0].options.map(o=>o.id)`), ['latin', 'dnl']);
  // une faute de frappe corrigée ne déclenche aucun avertissement
  ev(app, `globalThis.__C=null; _docEdit={id:'d1',champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, DNL',S.documents.d1.champs[0].options)}]}; docModalOk();`);
  assert.strictEqual(ev(app, `__C`), null);
});

// ── 5. Moment de la fiche et carte de chaleur ──
test('changer de moment dans la fiche redessine la carte de chaleur affichée à côté', () => {
  const app = mk();
  ev(app, BASE + `
   localStorage.setItem('suiviPP_elevesAffichage','chaleur'); window.__calls=[];
   renderStudents=function(){__calls.push('renderStudents');};
   _ficheRender=function(){__calls.push('_ficheRender');}; _ficheSid='a';
   ficheMomentSet('bil:miperiode:0');`);
  assert.deepStrictEqual(ob(app, `__calls`), ['_ficheRender', 'renderStudents']);
  ev(app, `localStorage.setItem('suiviPP_elevesAffichage','indic'); __calls.length=0; ficheMomentSet('bil:conseil:0');`);
  assert.deepStrictEqual(ob(app, `__calls`), ['_ficheRender'], 'la liste en indicateurs n\'est pas redessinée');
});

// ── 6. ✏️ sans modification ──
test('✏️ validée sans rien changer : aucun cran d\'undo, toast « Aucune modification »', () => {
  const app = mk();
  ev(app, BASE + `
   S.eleves.a.groupe=2; S.eleves.a.naissance='2012-03-04'; S.eleves.a.civilite='F';
   globalThis.__T=[]; toast=m=>__T.push(m); refreshSelector=()=>{}; renderStudents=()=>{}; closeMod2=()=>{};
   document.querySelectorAll = () => [];
   const v={ 'es-id':'a','es-nom':'A','es-prn':'a','es-arrival':'','es-departure':'','es-naissance':'2012-03-04','es-civ':'F','es-grp':'2','es-cls':'5C','es-regime':'','es-sortie':'','es-entree':'' };
   for (const k in v) document.getElementById(k).value=v[k];
   for (const k of STUDENT_STATUSES) document.getElementById('es-'+_statusDomId(k)).checked=false;
   undoStack.length=0; saveEdit();`);
  assert.strictEqual(ev(app, `undoStack.length`), 0);
  assert.deepStrictEqual(ob(app, `__T`), ['Aucune modification.']);
  ev(app, `__T.length=0; document.getElementById('es-nom').value='AA'; saveEdit();`);
  assert.strictEqual(ev(app, `undoStack.length`), 1);
  assert.strictEqual(ev(app, `S.eleves.a.nom`), 'AA');
  assert.deepStrictEqual(ob(app, `__T`), ['Élève modifié.']);
});

// ── 7. Cumul énorme ──
test('un cumul énorme (99999999) n\'empêche pas d\'ouvrir la fiche : l\'axe garde une dizaine de graduations', () => {
  const app = mk();
  ev(app, BASE + `S.releves['5C']={'2025-09-15':{date:'2025-09-15',ts:1,counts:{a:2,b:1}},'2025-10-06':{date:'2025-10-06',ts:2,counts:{a:99999999,b:1}}};`);
  const h = ev(app, `_ficheCourbeHTML(S.classes['5C'],S.eleves.a,COL())`);
  const grad = (h.match(/<text x="2" /g) || []).length;
  assert.ok(grad >= 2 && grad <= 12, 'graduations : ' + grad);
  // cumuls ordinaires : toujours tous les 5
  ev(app, `S.releves['5C']['2025-10-06'].counts.a=23;`);
  const h2 = ev(app, `_ficheCourbeHTML(S.classes['5C'],S.eleves.a,COL())`);
  assert.strictEqual((h2.match(/<text x="2" /g) || []).length, 5);   // mx = 23 → 0, 5, 10, 15, 20
});
