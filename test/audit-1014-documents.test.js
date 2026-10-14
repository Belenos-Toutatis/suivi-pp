// Audit du 2026-10-14, lot « documents » : ramassage d'un papier partagé, réponses orphelines,
// résumé de la synthèse d'un moment, fiche et document archivé, changement de type d'un champ,
// décision hors période, nom de PDF contenant une barre.

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

const BASE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode='semestre';
 S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a','b','c'],ord:0};
 S.classes['5D']={id:'5D',nom:'5D',annee:'2025-26',eleves:['z'],ord:1}; S.cur='5C';
 S.eleves={a:{id:'a',nom:'A',prenom:'a',classe_id:'5C',tags:[]},b:{id:'b',nom:'B',prenom:'b',classe_id:'5C',tags:[]},c:{id:'c',nom:'C',prenom:'c',classe_id:'5C',tags:[]},
  z:{id:'z',nom:'Z',prenom:'z',classe_id:'5D',tags:[]}};`;

// ── 1. Ramassage d'un document partagé : tout se compte sur la classe courante ──
test('ramassage partagé : rendus / attendus, « à lire », « Tous » et toast ne comptent que la classe courante', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.p1={id:'p1',titre:'Partagé',classIds:['5C','5D'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
     champs:[{id:'o',label:'Option',type:'choix',par:'famille',obligatoire:true,options:[{id:'x',label:'X',color:'#16a085'}]}],retours:{}};
   globalThis.__T=[]; toast=(m)=>globalThis.__T.push(m); renderDocuments=()=>{};`);
  const st = ob(app, `_ramStats(S.documents.p1,'5C')`);
  assert.strictEqual(st.attendus, 3);                       // pas 4 : l'élève de la 5D n'est pas dans la salle
  assert.strictEqual(st.reponsesManquantes, 3);
  assert.strictEqual(ob(app, `_docStats(S.documents.p1).attendus`), 4);   // le document, lui, couvre les deux classes
  ev(app, `ramColonne('p1', true)`);
  assert.ok(!/parti/.test(ev(app, `globalThis.__T.join(' | ')`)), 'aucun élève « parti » : celui de la 5D n\'est pas de la classe');
  const apres = ob(app, `_ramStats(S.documents.p1,'5C')`);
  assert.strictEqual(apres.rendus, apres.attendus);          // « complet » : le bouton passera à « Aucun »
  assert.strictEqual(ev(app, `S.documents.p1.retours.z`), undefined);
  // Le badge d'en-tête et le bouton sont ceux de la classe.
  ev(app, `_ramSel=['p1']; _ramSort='nom'`);
  const el = app.document.getElementById('documents-body');
  ev(app, `_renderRamassage(document.getElementById('documents-body'))`);
  assert.match(el.innerHTML, /id="ram-c-p1">3 \/ 3</);
  assert.match(el.innerHTML, /Aucun/);
});
test('ramassage partagé : la présélection « incomplet » ignore les manquants de l\'autre classe', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.p1={id:'p1',titre:'Partagé',classIds:['5C','5D'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,champs:[],
     retours:{a:{rendu:true,dateRetour:'2025-09-12',reponses:{},note:''},b:{rendu:true,dateRetour:'2025-09-12',reponses:{},note:''},c:{rendu:true,dateRetour:'2025-09-12',reponses:{},note:''}}};
   S.documents.p2={id:'p2',titre:'Autre',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:1,champs:[],retours:{}};
   renderDocuments=()=>{}; _todayYmd=()=>'2025-10-01';`);
  ev(app, `openRamassage()`);
  assert.deepStrictEqual(ob(app, `_ramSel`), ['p2']);       // p1 est complet côté 5C (z, de la 5D, n'y change rien)
});

// ── 2 + 5. Réponses : options retirées ou renommées, type de champ changé ──
test('une réponse sur une option retirée ou renommée n\'est plus une réponse', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
    champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, BILINGUE',[])}],retours:{}};
   const d=S.documents.d1; docSetReponse(d,'a','o1','latin'); docSetReponse(d,'b','o1','bilingue');
   for (const s of ['a','b']) docSetRendu(d,s,true);`);
  assert.deepStrictEqual(ob(app, `_docStats(S.documents.d1).sansReponse`), ['c']);
  // L'option « BILINGUE » est retirée des réglages : b redevient « réponse manquante ».
  ev(app, `S.documents.d1.champs[0].options=_champParseOptions('LATIN', S.documents.d1.champs[0].options)`);
  assert.deepStrictEqual(ob(app, `_docStats(S.documents.d1).sansReponse`), ['b', 'c']);
  assert.deepStrictEqual(ob(app, `_ramRows(['d1'],'5C').map(r=>[r.sid,r.resteRep])`), [['a', 0], ['b', 1], ['c', 1]]);
  assert.deepStrictEqual(ob(app, `_docPrintRows(S.documents.d1,['eleve'],{filtre:'sansReponse'}).map(r=>r.sid)`), ['b', 'c']);
  // Même verdict que le bilan imprimé.
  assert.strictEqual(ob(app, `_docPrintBilan(S.documents.d1,['a','b','c'],null).champs[0].sans`), 2);
});
test('corriger une faute de frappe d\'une option garde son id (donc les réponses)', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
    champs:[{id:'o1',label:'Option 1',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATTIN, BILINGUE',[])}],retours:{}};
   docSetReponse(S.documents.d1,'a','o1','lattin');`);
  ev(app, `const ch=S.documents.d1.champs[0]; ch.options=_champParseOptions('LATIN, BILINGUE', ch.options)`);
  assert.deepStrictEqual(ob(app, `S.documents.d1.champs[0].options.map(o=>[o.id,o.label])`), [['lattin', 'LATIN'], ['bilingue', 'BILINGUE']]);
  assert.strictEqual(ob(app, `_docStats(S.documents.d1).sansReponse.includes('a')`), false);
  assert.strictEqual(ev(app, `_docPrintCell(S.documents.d1,S.eleves.a,'ch:o1')`), 'LATIN');
  // Remplacer une option par une AUTRE n'est pas une correction : nouvel id.
  ev(app, `const ch2=S.documents.d1.champs[0]; ch2.options=_champParseOptions('LATIN, ALLEMAND', ch2.options)`);
  assert.deepStrictEqual(ob(app, `S.documents.d1.champs[0].options.map(o=>o.id)`), ['lattin', 'allemand']);
  // Nombre d'options différent : pas d'appariement par position.
  ev(app, `const ch3=S.documents.d1.champs[0]; ch3.options=_champParseOptions('LATINN, ALLEMAND, DNL', ch3.options)`);
  assert.strictEqual(ob(app, `S.documents.d1.champs[0].options[0].id`), 'latinn');
});
test('choix unique ↔ multiple : les deux formes de réponse comptent partout', () => {
  const app = mk();
  ev(app, BASE + `
   S.documents.d1={id:'d1',titre:'Orientation',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:false,ord:0,
    champs:[{id:'o1',label:'Option',type:'choix',par:'famille',obligatoire:true,options:_champParseOptions('LATIN, BILINGUE',[])}],retours:{}};
   const d=S.documents.d1; docSetReponse(d,'a','o1','latin'); docSetReponse(d,'b','o1','bilingue');`);
  ev(app, `S.documents.d1.champs[0].type='multi'`);            // chaînes restées dans un champ multiple
  assert.deepStrictEqual(ob(app, `_docStats(S.documents.d1).sansReponse`), ['c']);
  assert.deepStrictEqual(ob(app, `_ramRows(['d1'],'5C').map(r=>r.resteRep)`), [0, 0, 1]);
  assert.match(ev(app, `_ramChipsHTML(S.documents.d1,'a',S.documents.d1.champs[0])`), /on/);
  assert.strictEqual(ev(app, `_docPrintCell(S.documents.d1,S.eleves.a,'ch:o1')`), 'LATIN');
  // …et l'inverse : tableaux d'un élément dans un champ redevenu à choix unique.
  ev(app, `const d=S.documents.d1; d.champs[0].type='multi'; delete d.retours.a; docToggleReponse(d,'a','o1','latin'); d.champs[0].type='choix'`);
  assert.deepStrictEqual(ob(app, `S.documents.d1.retours.a.reponses.o1`), ['latin']);
  assert.deepStrictEqual(ob(app, `_docStats(S.documents.d1).sansReponse`), ['c']);
  assert.strictEqual(ob(app, `_ramRows(['d1'],'5C')[0].resteRep`), 0);
  // Un appui sur l'option déjà cochée (sous l'ancienne forme) l'efface, il ne la double pas.
  ev(app, `ramSetReponse('d1','a','o1','latin','2025-09-20')`);
  assert.strictEqual(ob(app, `_hasReponse(S.documents.d1.champs[0], _retour(S.documents.d1,'a').reponses)`), false);
});

// ── 3. Résumé de la fenêtre d'impression : la feuille du moment, pas la période ──
test('résumé « synthèse d\'un moment » : élèves, relevés et bilan DE CE MOMENT', () => {
  const app = mk();
  ev(app, `S = _emptyState(); postLoadHook(); S.prefs.periodMode='semestre';
   S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a','b'],ord:0};S.cur='5C';
   S.eleves={a:{id:'a',nom:'A',prenom:'a',classe_id:'5C',tags:[]},b:{id:'b',nom:'B',prenom:'b',classe_id:'5C',tags:[],arrivalDate:'2025-11-10'}};
   S.releves['5C']={'2025-09-20':{date:'2025-09-20',ts:1,counts:{a:3}},'2025-12-10':{date:'2025-12-10',ts:2,counts:{a:6,b:2}}};
   bilanAdd('a',{date:'2026-01-20',type:'conseil',texte:'bilan conseil de a'});`);
  const key = 'bil:mois:2025-09';
  app.document.getElementById('mper-moment')._v = key;
  app.document.getElementById('mper-forme')._v = 'tableau'; app.document.getElementById('mper-format')._v = 'A4';
  app.document.querySelector = sel => /mper-quoi/.test(sel) ? { value: 'moment' } : null;
  app.document.querySelectorAll = sel => /mper-blocs/.test(sel) ? ['obs', 'bilan'].map(k => ({ checked: true, dataset: { ck: k } })) : [];
  ev(app, `_printFitMeasure=()=>({size:8,fits:true,pages:1})`);
  ev(app, `_periodePrintRefresh()`);
  const h = app.document.getElementById('mper-hint')._t;
  assert.match(h, /1 élève présents/);            // b arrive en novembre : pas dans le point de septembre
  assert.match(h, /1 relevé de carnet/);          // celui du 10 décembre n'est pas dans septembre
  assert.match(h, /1 sans bilan rédigé/);         // a n'a que son bilan de CONSEIL : le point de septembre est vide (b est absent de la feuille)
  assert.ok(!/un bilan pour chacun/.test(h));
});

// ── 4. Fiche : un document archivé non rendu n'est pas un manquant ──
test('fiche : un document archivé non rendu est marqué « archivé », jamais « pas rendu »', () => {
  const app = mk();
  ev(app, `S = _emptyState(); postLoadHook(); S.prefs.periodMode='semestre';
   S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a'],ord:0};S.cur='5C';
   S.eleves={a:{id:'a',nom:'A',prenom:'a',classe_id:'5C',tags:[]}};
   S.documents.old={id:'old',titre:'Ancien',classIds:['5C'],dateDistribution:'2025-09-10',dateEcheance:null,suiviRetour:true,archive:true,ord:0,champs:[],retours:{}};`);
  const html = ev(app, `(()=>{ const cls=S.classes['5C']; const col=_chaleurMomentsTous(cls).find(c=>c.type==='conseil'&&c.pIdx===0); return _ficheTableauHTML(cls,S.eleves.a,col,null); })()`);
  const i = html.indexOf('Ancien');
  assert.ok(i > 0);
  const bloc = html.slice(i, i + 300);
  assert.match(bloc, /archivé/);
  assert.ok(!/pas rendu/.test(bloc), 'ne s\'affiche pas comme un manquant');
  assert.match(html, /tout est rendu/);
  const fp = `(()=>{ const cls=S.classes['5C']; const col=_chaleurMomentsTous(cls).find(c=>c.type==='conseil'&&c.pIdx===0); return _fichePrintHTML(cls,'a',col,{parts:['papiers']},null); })()`;
  const p = ev(app, fp);
  const k = p.indexOf('Ancien');
  assert.ok(k > 0);
  assert.match(p.slice(k, k + 200), /archivé/);
  assert.ok(!/pas rendu/.test(p.slice(k, k + 200)));
  // Rendu, il garde sa coche (et dit qu'il est archivé).
  ev(app, `docSetRendu(S.documents.old,'a',true)`);
  const p2 = ev(app, fp);
  assert.match(p2.slice(p2.indexOf('Ancien'), p2.indexOf('Ancien') + 200), /✓ rendu/);
});

// ── 6. Décision hors période ──
test('décision hors de toute période : retrouvée, modifiée, retirée — jamais dupliquée', () => {
  const app = mk();
  ev(app, `S = _emptyState(); postLoadHook(); S.prefs.periodMode='semestre';
   S.classes['5C']={id:'5C',nom:'5C',annee:'2025-26',eleves:['a'],ord:0};S.cur='5C';
   S.eleves={a:{id:'a',nom:'A',prenom:'a',classe_id:'5C',tags:[]}};`);
  const m = `{type:'conseil',date:'2062-01-20'}`, C = `S.classes['5C']`;
  assert.strictEqual(ev(app, `decisionSet(${C},'a',${m},'PPRE')`), 'ajout');
  assert.strictEqual(ev(app, `decisionSet(${C},'a',${m},'PPRE')`), null);
  assert.strictEqual(ev(app, `decisionSet(${C},'a',${m},'PPRE + tutorat')`), 'modif');
  assert.strictEqual(ev(app, `S.eleves.a.decisions.length`), 1);
  assert.strictEqual(ev(app, `decisionSet(${C},'a',${m},'')`), 'suppr');
  assert.strictEqual(ev(app, `S.eleves.a.decisions.length`), 0);
  // Même règle que le bilan, sans confondre deux dates hors période différentes ni une date dans une période.
  ev(app, `bilanAdd('a',{date:'2062-01-20',type:'conseil',texte:'x'})`);
  assert.ok(ev(app, `_bilanCible(${C},'a',${m})`));
  assert.strictEqual(ev(app, `_bilanCible(${C},'a',{type:'conseil',date:'2062-02-01'})`), null);
  ev(app, `decisionSet(${C},'a',{type:'conseil',date:'2062-01-20'},'A')`);
  assert.strictEqual(ev(app, `_decisionCible(${C},'a',{type:'conseil',date:'2026-01-20'})`), null);
});

// ── 7. Nom de PDF contenant une barre ──
test('_pjSafeName : une barre d\'un nom construit ou tapé ne coupe rien ; le chemin d\'un fichier d\'origine part', () => {
  const app = mk();
  ev(app, `S = _emptyState(); postLoadHook();`);
  const auto = ev(app, `_pjAutoNom('incident',{instance:_instanceOf('gpds').label,nom:'GUÉRIN',prenom:'Nathan',date:'2026-02-05'})`);
  assert.match(auto, /^Cellule de veille/);
  assert.match(auto, /GPDS/);
  assert.ok(!/[\\/]/.test(auto));
  assert.strictEqual(ev(app, `_pjSafeName('Commission 5C/5D')`), 'Commission 5C - 5D.pdf');
  assert.strictEqual(ev(app, `_pjSafeName('a\\\\b')`), 'a - b.pdf');
  assert.strictEqual(ev(app, `_pjSafeName('C:\\\\scans\\\\fiche.pdf', true)`), 'fiche.pdf');
  assert.strictEqual(ev(app, `_pjSafeName('dossier/fiche.pdf', true)`), 'fiche.pdf');
});
