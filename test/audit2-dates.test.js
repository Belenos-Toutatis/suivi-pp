// Audit du 2026-10-14 (seconde passe), lot « dates » : saisie des dates au CLAVIER. Constat mesuré dans Chrome :
// quand un segment (jour, puis mois) est complété, Chrome envoie `change` alors que document.activeElement vaut
// BODY, et le champ reprend le focus juste après. Toute garde « activeElement !== champ ⇒ quitté » laissait
// partir des écritures en pleine frappe. Arbitré : une date s'écrit à la SORTIE du champ (`_dateChamp`).
// Le harnais ne simule pas Chrome : on rejoue ici la SÉQUENCE d'événements mesurée (scripts Puppeteer de
// l'audit pour la vérification à la main). Noms inventés.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const tick = () => new Promise(r => setTimeout(r, 5));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

const BASE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2020-21', eleves:['s1','s2'], ord:0 };
  S.eleves = { s1:{ id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[], naissance:'2008-03-04',
                    journal:[{ id:'j1', date:'2020-09-05', ts:1, type:'appel', texte:'Appel à la mère' }] },
               s2:{ id:'s2', nom:'MARTIN', prenom:'Noé', classe_id:'5C', tags:[], naissance:null } };
  S.cur = '5C'; undoStack.length = 0;
  S.documents.d1 = { id:'d1', titre:'Fiche', classIds:['5C'], dateDistribution:'2020-09-15', dateEcheance:null, suiviRetour:true, archive:false, ord:0,
    champs:[], retours:{ s1:{ rendu:true, dateRetour:'2020-09-20', reponses:{}, note:'' } } };
  window.__toasts = []; window.__toast0 = window.__toast0 || toast; toast = (m) => { __toasts.push(m); };
  window.__BODY = document.body; document.body.tagName = 'BODY';
  window.__champ = (value, extra) => Object.assign({ tagName:'INPUT', type:'date', value, validity:{ badInput:false }, isConnected:true,
    dataset:{}, getAttribute(){ return null; }, focus(){ document.activeElement = this; }, blur(){ document.activeElement = __BODY; } }, extra || {});
  document.activeElement = __BODY;`;
const FIN = `toast = __toast0; document.activeElement = null;`;

// Le code d'un gestionnaire en ligne (onchange / onblur) du premier champ date du HTML qui correspond au motif,
// exécuté comme le ferait le navigateur : `this` = le champ, `event` = l'événement.
function gestionnaire(html, motif, attr) {
  const tag = (html.match(/<input type="date"(?:=>|[^>])*>/g) || []).find(t => t.includes(motif));
  assert.ok(tag, `champ date introuvable : ${motif}`);
  const m = new RegExp(`${attr}="([^"]*)"`).exec(tag);
  assert.ok(m, `${attr} absent : ${tag}`);
  return m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
const jouer = (code, type, related) => ev(`(function (event) { ${code} }).call(__inp, { type: '${type}', target: __inp, relatedTarget: ${related || 'null'} })`);

// ── 1. La détection partagée ──
test('_dateChamp : un `change` reçu champ « quitté » mais qui reprend le focus aussitôt n\'écrit RIEN ; le blur écrit', async () => {
  ev(BASE + `window.__n = 0; window.__inp = __champ('2020-09-02'); window.__w = () => __n++;`);
  try {
    // Ce que fait Chrome au segment complété : `change` avec activeElement = BODY, puis le champ reprend le focus.
    ev(`document.activeElement = __BODY; _dateChamp({ type:'change', target:__inp }, __w); document.activeElement = __inp;`);
    await tick();
    assert.strictEqual(ev(`__n`), 0, 'pas d\'écriture en pleine frappe');
    ev(`_dateChamp({ type:'change', target:__inp }, __w)`);   // champ au focus (calendrier de bureau, dernier segment)
    await tick();
    assert.strictEqual(ev(`__n`), 0);
    // La fenêtre seule perd le focus : `blur` part, mais le champ reste l'élément actif → on reviendra taper.
    ev(`_dateChamp({ type:'blur', target:__inp, relatedTarget:null }, __w)`);
    assert.strictEqual(ev(`__n`), 0, 'blur de la fenêtre : rien');
    // Vraie sortie : écrite tout de suite.
    ev(`document.activeElement = __BODY; _dateChamp({ type:'blur', target:__inp, relatedTarget:null }, __w)`);
    assert.strictEqual(ev(`__n`), 1);
    // `change` d'un champ qui n'a pas le focus (calendrier d'un mobile) et ne le reprend pas : écrit une tâche plus tard.
    ev(`_dateChamp({ type:'change', target:__inp }, __w)`);
    assert.strictEqual(ev(`__n`), 1, 'pas tout de suite');
    await tick();
    assert.strictEqual(ev(`__n`), 2);
    // … sauf si le champ a été remplacé entre-temps (re-rendu) : le blur a déjà écrit.
    ev(`_dateChamp({ type:'change', target:__inp }, __w); __inp.isConnected = false;`);
    await tick();
    assert.strictEqual(ev(`__n`), 2);
  } finally { ev(FIN); }
});

// ── 2 & 3. Régression v1.67 : 31/10 tapé sur une date de septembre ──
test('date de retour : « 31/10/2020 » tapé sur le 20/09 passe par un 31 septembre (badInput) sans que rien ne soit réécrit ni perdu', async () => {
  ev(BASE);
  try {
    const html = ev(`(() => { const el = document.createElement('div'); _renderDocDetail(el, S.documents.d1); return el.innerHTML; })()`);
    const chg = gestionnaire(html, 'doc-date', 'onchange'), blr = gestionnaire(html, 'doc-date', 'onblur');
    ev(`window.__inp = __champ('2020-09-20'); document.activeElement = __inp;`);
    // « 31 » : jour complété → `change` champ « quitté » (BODY), valeur badInput (31 septembre), puis le focus revient.
    ev(`__inp.value = ''; __inp.validity = { badInput: true }; document.activeElement = __BODY;`);
    jouer(chg, 'change');
    ev(`document.activeElement = __inp;`);
    await tick();
    assert.strictEqual(ev(`__inp.value`), '', 'le champ n\'est PAS remis à l\'ancienne date en pleine frappe');
    assert.strictEqual(ev(`__toasts.length`), 0, 'aucun « date illisible » pendant la frappe');
    assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2020-09-20');
    // « 10 » : mois complété → 2020-10-31, `change` BODY puis retour du focus.
    ev(`__inp.value = '2020-10-31'; __inp.validity = { badInput: false }; document.activeElement = __BODY;`);
    jouer(chg, 'change');
    ev(`document.activeElement = __inp;`);
    await tick();
    assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2020-09-20', 'pas d\'écriture intermédiaire');
    assert.strictEqual(ev(`undoStack.length`), 0);
    // Sortie du champ : UNE écriture, un cran.
    ev(`document.activeElement = __BODY;`);
    jouer(blr, 'blur');
    await tick();
    assert.strictEqual(ev(`S.documents.d1.retours.s1.dateRetour`), '2020-10-31');
    assert.strictEqual(ev(`undoStack.length`), 1);
  } finally { ev(FIN); }
});

// ── 4. Date partielle : jamais d'effacement ──
test('date PARTIELLE (badInput) : la fiche, la liste et les contacts gardent l\'ancienne date (et le disent)', () => {
  ev(BASE);
  try {
    ev(`_ficheSid = 's1'; window.__inp = __champ('', { validity: { badInput: true } }); ficheSetDate(__inp, 'naissance')`);
    assert.strictEqual(ev(`S.eleves.s1.naissance`), '2008-03-04', 'fiche : naissance gardée');
    assert.strictEqual(ev(`__inp.value`), '2008-03-04', 'le champ la remontre');
    assert.strictEqual(ev(`undoStack.length`), 0);
    ev(`window.__inp = __champ('', { validity: { badInput: true }, dataset: { sid: 's1' } }); eleveNaisCommit(__inp)`);
    assert.strictEqual(ev(`S.eleves.s1.naissance`), '2008-03-04', 'liste : naissance gardée');
    assert.strictEqual(ev(`__inp.value`), '2008-03-04');
    ev(`_remSid = 's1'; window.__inp = __champ('', { validity: { badInput: true } }); journalDateUI('j1', __inp)`);
    assert.strictEqual(ev(`S.eleves.s1.journal[0].date`), '2020-09-05', 'contact : date gardée');
    assert.strictEqual(ev(`__inp.value`), '2020-09-05');
    assert.strictEqual(ev(`undoStack.length`), 0);
    assert.strictEqual(ev(`__toasts.length`), 3, 'chaque refus est dit');
    // Vider VOLONTAIREMENT (champ vide, pas partiel) efface bien la naissance.
    ev(`window.__inp = __champ(''); ficheSetDate(__inp, 'naissance')`);
    assert.strictEqual(ev(`S.eleves.s1.naissance`), null);
  } finally { ev(FIN); }
});

// ── 5. Champ naissance vide traversé ──
test('eleveNaisCommit : traverser un champ naissance VIDE sans rien taper ne pose pas de cran d\'undo', () => {
  ev(BASE);
  try {
    ev(`_salvesDesarmer(); window.__inp = __champ('', { dataset: { sid: 's2' } }); eleveNaisCommit(__inp)`);
    assert.strictEqual(ev(`undoStack.length`), 0);
    assert.strictEqual(ev(`S.eleves.s2.naissance`), null);
    ev(`__inp.value = '0013-05-21'; eleveNaisCommit(__inp)`);
    assert.strictEqual(ev(`S.eleves.s2.naissance`), '2013-05-21');
    assert.strictEqual(ev(`undoStack.length`), 1);
  } finally { ev(`_salvesDesarmer();` + FIN); }
});

// ── 6. Le focus après un re-rendu ──
test('_focusSignature / _focusRetrouver : le champ visé par Tab est retrouvé dans le rendu neuf (même gestionnaires, même rang)', () => {
  ev(BASE + `
    window.__mk = (on) => ({ tagName:'INPUT', isConnected:true, f:0, getAttribute(a){ return a === 'onchange' ? on : null; }, focus(){ this.f++; document.activeElement = this; } });
    window.__a = __mk("x('1')"); window.__b = __mk("x('2')"); window.__b2 = __mk("x('2')");
    window.__qsa0 = document.querySelectorAll; document.querySelectorAll = () => [__a, __b, __b2];`);
  try {
    ev(`window.__sig = _focusSignature(__b2)`);
    // Rendu neuf : trois éléments pareils, l'ancien est détaché, le focus est tombé sur BODY.
    ev(`__b2.isConnected = false; window.__a2 = __mk("x('1')"); window.__bn = __mk("x('2')"); window.__bn2 = __mk("x('2')");
        document.querySelectorAll = () => [__a2, __bn, __bn2]; document.activeElement = __BODY; _focusRetrouver(__sig)`);
    assert.strictEqual(ev(`__bn2.f`), 1, 'le deuxième des pareils, comme avant');
    assert.strictEqual(ev(`__bn.f + __a2.f`), 0);
    // L'utilisateur est déjà ailleurs : on ne lui vole pas le focus.
    ev(`document.activeElement = __a2; _focusRetrouver(__sig)`);
    assert.strictEqual(ev(`__bn2.f`), 1);
  } finally { ev(`document.querySelectorAll = __qsa0;` + FIN); }
});

// ── Fermeture de la page ──
test('_dateChampFermeture : le champ date en cours de saisie est quitté (son blur l\'enregistre) avant la sauvegarde de fermeture', () => {
  ev(BASE);
  try {
    ev(`window.__inp = __champ('2013-05-21'); __inp.b = 0; __inp.blur = function () { this.b++; }; document.activeElement = __inp; _dateChampFermeture()`);
    assert.strictEqual(ev(`__inp.b`), 1);
    ev(`window.__t = { tagName:'INPUT', type:'text', b:0, blur(){ this.b++; } }; document.activeElement = __t; _dateChampFermeture()`);
    assert.strictEqual(ev(`__t.b`), 0, 'un autre champ n\'est pas touché');
    assert.match(SRC, /addEventListener\('beforeunload', \(\) => \{ try \{ _dateChampFermeture\(\); \} catch \(_\) \{\}[^\n]*save\(\)/);
  } finally { ev(FIN); }
});

// ── 2. Débuts de période (Données) et échéance du message ──
test('periodeDebutUI : rien pendant la frappe, « 15/01 » donne 01-15 à la sortie ; date partielle → rien ; échéance du message de même', async () => {
  ev(BASE);
  try {
    const html = ev(`_donRubHTML('periodes')`);
    const chg = gestionnaire(html, 'pref-debut-0', 'onchange'), blr = gestionnaire(html, 'pref-debut-0', 'onblur');
    ev(`window.__inp = __champ('2021-02-01'); document.activeElement = __inp;`);
    // « 15 » : 2021-02-15, `change` champ « quitté » (BODY), puis le focus revient.
    ev(`__inp.value = '2021-02-15'; document.activeElement = __BODY;`);
    jouer(chg, 'change');
    ev(`document.activeElement = __inp;`);
    await tick();
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('semestre'))`)), ['02-01'], 'pas de « 02-15 » en pleine frappe');
    ev(`__inp.value = '2021-01-15'; document.activeElement = __BODY;`);
    jouer(blr, 'blur');
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('semestre'))`)), ['01-15']);
    assert.strictEqual(ev(`undoStack.length`), 1);
    ev(`window.__inp = __champ('', { validity: { badInput: true } }); periodeDebutUI(0, __inp)`);
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('semestre'))`)), ['01-15'], 'partielle : rien');
    assert.strictEqual(ev(`__inp.value`), '2021-01-15', 'le champ remontre la date en place');
    assert.strictEqual(ev(`undoStack.length`), 1);
    // Échéance du message aux collègues.
    ev(`S.avis['5C'] = { c1: { id:'c1', date:'2020-11-02', cible:'2021-01-31', label:'', fichier:'', lien:'', lu:null, disciplines:[], avis:{}, cibles:[], msg:{ echeance:'2020-11-20' } } };
        _avisRender = () => {};`);
    const htmlAv = ev(`_avisMessageHTML(S.classes['5C'], S.avis['5C'].c1)`);
    assert.match(gestionnaire(htmlAv, 'avisEcheanceUI', 'onchange'), /^_dateChamp\(event,/);
    assert.match(gestionnaire(htmlAv, 'avisEcheanceUI', 'onblur'), /^_dateChamp\(event,/);
    ev(`window.__inp = __champ('', { validity: { badInput: true } }); avisEcheanceUI('c1', __inp)`);
    assert.strictEqual(ev(`_avisMsgReglages(S.avis['5C'].c1).echeance`), '2020-11-20', 'échéance gardée');
    ev(`window.__inp = __champ('0020-11-27'); avisEcheanceUI('c1', __inp)`);
    assert.strictEqual(ev(`_avisMsgReglages(S.avis['5C'].c1).echeance`), '2020-11-27');
  } finally { ev(FIN); }
});

// ── 7. Une borne en août venue d'un fichier ──
test('_periodStarts : une borne en août (« 08-20 », fichier importé) est écartée, la valeur d\'office reprend', () => {
  ev(BASE);
  try {
    ev(`S.prefs.periodStarts = { semestre: ['08-20'], trimestre: ['12-01', '08-02'] }`);
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('semestre'))`)), ['02-01']);
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('trimestre'))`)), ['12-01', '03-15']);
    ev(`S.prefs.periodStarts = { semestre: ['09-20'] }`);
    assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_periodStarts('semestre'))`)), ['09-20'], 'septembre reste permis');
    // Plus de période inversée : chaque période finit après son début.
    ev(`S.prefs.periodStarts = { semestre: ['08-20'] }`);
    const ps = JSON.parse(ev(`JSON.stringify(_periods(S.classes['5C']))`));
    assert.ok(ps.every(p => p.start <= p.end), JSON.stringify(ps));
  } finally { ev(FIN); }
});

// ── Test statique : tout champ date qui ÉCRIT passe par la détection partagée ──
// Les balises `<input type="date" …>` du fichier, gabarits compris (un `>` dans `${…}` ou dans `=>` ne ferme pas).
function balisesDate(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('<input type="date"', i)) >= 0) {
    let j = i, prof = 0;
    for (; j < src.length; j++) {
      if (src[j] === '$' && src[j + 1] === '{') { prof++; j++; continue; }
      if (prof && src[j] === '}') { prof--; continue; }
      if (!prof && src[j] === '>' && src[j - 1] !== '=') break;
    }
    out.push(src.slice(i, j + 1));
    i = j;
  }
  return out;
}
function fautifs(src) {
  return balisesDate(src).filter(t => {
    if (/data-date-affichage/.test(t)) return false;
    const chg = /\sonchange="([^"]*)"/.exec(t), blr = /\sonblur="([^"]*)"/.exec(t);
    if (!chg) return false;   // pas de `change` : rien à craindre (formulaire lu au bouton, ou blur seul)
    return !/^_dateChamp\(event,/.test(chg[1]) || !blr || !/^_dateChamp\(event,/.test(blr[1]);
  });
}
test('statique : chaque champ date muni d\'un onchange passe par _dateChamp (onchange ET onblur), sauf affichage déclaré', () => {
  const toutes = balisesDate(SRC);
  assert.ok(toutes.length >= 20, `balises trouvées : ${toutes.length}`);
  assert.deepStrictEqual(fautifs(SRC), []);
  // Les champs qui écrivent sont bien là (sinon le test serait vacant).
  for (const f of ['ficheSetDate', 'ficheDocDate', 'eleveNaisCommit', 'journalDateUI', 'docSetDateRetourUI', 'ramSetDate', 'periodeDebutUI', 'avisEcheanceUI'])
    assert.ok(toutes.some(t => t.includes(`_dateChamp(event,()=>${f}(`)), f);
  assert.doesNotMatch(SRC, /function (eleveNaisChange|ficheDateChange)\b/, 'les anciennes gardes fausses ont disparu');
});
test('méta-test : le détecteur voit un champ date qui écrit sur son seul onchange', () => {
  const faux = [
    '<input type="date" value="${_escAttr(x)}" onchange="journalDateUI(\'j\', this)">',
    '<input type="date" onchange="_dateChamp(event,()=>f(this))">',                       // sans onblur
    '<input type="date" data-x="${a => a > 1}" onchange="if(document.activeElement!==this)f(this)" onblur="f(this)">',
  ].join('\n');
  assert.strictEqual(fautifs(faux).length, 3);
  assert.strictEqual(fautifs('<input type="date" data-date-affichage onchange="_bilanHint()">').length, 0);
});
