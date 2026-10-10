/* =====================================================================
   Interface
   ===================================================================== */
const LS_KEY = "fiche-suivi-collective";
/* Version INTÉGRÉE à Suivi PP (2026-10-10, onglet 📋 Suivis) : la page est chargée dans un cadre de Suivi PP et marquée
   <html data-hote="suivi-pp"> par assemble.py. Le suivi est alors rangé dans les données de Suivi PP (synchronisation, sauvegardes,
   Ctrl+Z) : ni enregistrement dans la page, ni copie dans ce navigateur. Tout passe par « hôte », plus bas. */
const HOTE = document.documentElement.dataset.hote === "suivi-pp";
let hotePret = false;        // Suivi PP a envoyé le suivi : avant, rien ne part (on écraserait ses données par un suivi vide)
let hoteEtape = false;       // memoriser() a ouvert un cran d'annulation, pas encore transmis
let hoteRetirer = false;     // … puis l'a refermé (saisie refusée) après l'avoir transmis : Suivi PP retire le sien
let hoteDernier = null;      // le suivi tel que Suivi PP l'a (JSON) : on n'envoie que ce qui a changé
let hoteClasse = null;       // la classe dans Suivi PP : { nom, annee, eleves: [{ nom, groupes, debut, fin }], groupes, renommer }
let hoteCle = null;          // la classe affichée (id de Suivi PP) : en changer ramène au sommaire
let hoteDemo = false;        // données de démonstration de Suivi PP : la démonstration des fiches y est permise
let hotePile = {};           // { annuler, retablir } : la pile de Suivi PP
let hotePolices = null;      // { ecran, papier } : les polices réglées dans Suivi PP (💾 Données)
let hoteCommun = null;       // les réglages COMMUNS aux deux applications (cf. appliquerCommunHote)
let S = null;                 // état courant
let dirty = false;            // modifications non enregistrées dans un fichier
let fileHandle = null;        // ce fichier .html, choisi pour l'enregistrement (Chrome/Edge : réenregistrement direct)
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pctTxt = v => (v == null ? "" : Math.round(v * 100) + "\u202f%");     // espace fine insécable : « 24 % » ne se coupe pas

/* ---------- persistance ---------- */
let stockageEnErreur = false;
function persist() {
  if (HOTE) { hoteEnvoyerEtat(); return; }      // version intégrée : l'état part vers Suivi PP, qui l'enregistre
  try {
    localStorage.setItem(CLE_PAGE, JSON.stringify({ S, dirty, base: enregistreLe, id: idEnregistre, nom: nomFichier }));
    stockageEnErreur = false;
  } catch (e) {
    if (!stockageEnErreur) toast("La sauvegarde automatique dans ce navigateur est impossible (stockage plein ou bloqué). Enregistrez régulièrement (Ctrl+S).", 9000);
    stockageEnErreur = true;
  }
}
/* ---------- annuler / rétablir : instantanés de l'état ---------- */
const MAX_ANNULER = 60;
let historique = [], refaire = [], etatPrecedent = null, dernierTexte = 0;
function reinitHistorique() { historique = []; refaire = []; etatPrecedent = S ? JSON.stringify(S) : null; majBoutonAnnuler(); }
let fusionnerEtape = false;           // la sortie d'un champ de date ou d'heure complète l'étape de sa frappe
function memoriser(texte) {
  const now = JSON.stringify(S), fusion = fusionnerEtape; fusionnerEtape = false;
  if (etatPrecedent && now !== etatPrecedent) {
    // la frappe dans un commentaire ne crée qu'une étape par pause d'écriture
    if (!((fusion || (texte && Date.now() - dernierTexte < 2000)) && historique.length)) {
      historique.push(etatPrecedent); if (historique.length > MAX_ANNULER) historique.shift();
      hoteEtape = true;                // version intégrée : Suivi PP posera un cran d'annulation avec cet envoi
    }
    refaire = [];
  }
  if (fusion && historique.length && now === historique[historique.length - 1]) { historique.pop(); if (hoteEtape) hoteEtape = false; else hoteRetirer = true; }   /* saisie refusée à la sortie du champ : l'état est revenu, pas d'étape vide pour Ctrl+Z */
  if (texte) dernierTexte = Date.now(); else dernierTexte = 0;
  etatPrecedent = now; majBoutonAnnuler();
}
function annuler(sens = -1) {
  if (HOTE) { persistMaintenant(); hoteEnvoyer({ type: "annuler", sens }); return; }   // la pile d'annulation est celle de Suivi PP
  const pile = sens < 0 ? historique : refaire, autre = sens < 0 ? refaire : historique;
  if (!pile.length) return;
  autre.push(JSON.stringify(S));
  const avant = S; S = JSON.parse(pile.pop()); etatPrecedent = JSON.stringify(S); dernierTexte = 0;
  dirty = true; persist(); updateStatus(); render(); majBoutonAnnuler();
  const quoi = decrireChangement(avant, S);
  toast(`${sens < 0 ? "Annulé" : "Rétabli"}${quoi ? " : " + quoi : ""}. ${sens < 0 ? "Ctrl+Y pour rétablir." : "Ctrl+Z pour annuler."}`, 5000);
}
/** Ce qui diffère entre deux états, en mots (message de Ctrl+Z et Ctrl+Y) : « croix de la fiche collective du lundi 12 octobre »… */
function decrireChangement(a, b) {
  const diff = (x, y) => JSON.stringify(x) !== JSON.stringify(y), jourTxt = d => fmtLong(d).replace(/ \d{4}$/, ""), lib = [];
  const nomInd = i => (i && i.nom) || "un élève";
  if (diff(a.jours, b.jours)) {
    const dates = [...new Set([...Object.keys(a.jours || {}), ...Object.keys(b.jours || {})])].filter(d => diff((a.jours || {})[d], (b.jours || {})[d])).sort();
    if (dates.length > 1) lib.push(`saisies de ${dates.length} jours (du ${jourTxt(dates[0])} au ${jourTxt(dates.at(-1))})`);
    else if (dates.length) { const d = dates[0], ja = (a.jours || {})[d] || {}, jb = (b.jours || {})[d] || {}, k = c => diff(ja[c], jb[c]);
      lib.push(k("x") ? `croix de la fiche collective du ${jourTxt(d)}` : k("com") ? `commentaire de la fiche collective du ${jourTxt(d)}` : k("cl") ? `codes de la fiche de classe du ${jourTxt(d)}`
        : k("clr") ? `remarque au dos de la fiche de classe (${jourTxt(d)})` : k("abs") ? `absence d’un élève le ${jourTxt(d)}` : `cours du ${jourTxt(d)} (matière, enseignant ou salle)`); } }
  if (diff(a.individuels, b.individuels)) { const la = a.individuels || [], lb = b.individuels || [];
    if (la.length !== lb.length) { const ids = new Set(lb.map(i => i.id)), id2 = new Set(la.map(i => i.id)); const x = la.find(i => !ids.has(i.id)) || lb.find(i => !id2.has(i.id));
      lib.push(`${la.length > lb.length ? "suppression" : "création"} du suivi individuel de ${nomInd(x)}`); }
    else { const i = la.findIndex((x, k) => diff(x, lb[k])), x = la[i], y = lb[i];
      lib.push(diff(x.saisies, y.saisies) ? `fiche individuelle de ${nomInd(x)}` : diff(x.bilans, y.bilans) ? `bilan du suivi de ${nomInd(x)}` : diff(x.objectifs, y.objectifs) ? `objectifs du suivi de ${nomInd(x)}` : `suivi individuel de ${nomInd(x)}`); } }
  const noms = [["eleves", "élèves du suivi collectif"], ["objectifs", "objectifs du suivi collectif"], ["classeEleves", "liste de la classe"], ["groupes", "groupes et options"],
    ["matieres", "matières et enseignants"], ["absencesProf", "absences longues"], ["changementsProf", "changements d’enseignant"], ["edt", "emploi du temps"], ["edtSuivants", "emploi du temps"],
    ["vacances", "calendrier"], ["joursSansCours", "calendrier"], ["debut", "période du suivi"], ["fin", "période du suivi"], ["typesForces", "semaines A et B"], ["decoupage", "trimestres ou semestres"],
    ["horaires", "horaires"], ["horairesBase", "horaires"], ["horairesJours", "horaires"], ["seuils", "seuils des pastilles"], ["pastillesVertes", "pastilles vertes"], ["codage", "codes des niveaux"],
    ["codesClasse", "codes de la fiche de classe"], ["retenueClasse", "règle de retenue"], ["consignes", "consignes"], ["consignesIndiv", "consignes"], ["etablissement", "établissement"],
    ["classe", "nom de la classe"], ["referent", "professeur principal"], ["courrielIndiv", "modèle de courriel"]];
  for (const [k, l] of noms) if (diff(a[k], b[k]) && !lib.includes(l)) lib.push(l);
  if (!lib.length && diff(a, b)) lib.push("réglages");
  return lib.length > 2 ? lib.slice(0, 2).join(", ") + "…" : lib.join(", ");
}
function majBoutonAnnuler() {
  const b = $("#b-undo"); if (!b) return;
  const peut = HOTE ? !!hotePile.annuler : historique.length > 0;
  b.disabled = !peut;
  b.title = peut ? "Annuler la dernière modification (Ctrl+Z)" + (HOTE ? "\nLa même annulation que dans Suivi PP." : "") : "Rien à annuler";
}
let dansChange = false;              // vrai pendant le traitement d'un « change » (voir renderDiffere)
let revision = 0;                    // compteur de modifications
let persistMinuterie = null;
function persistBientot() { clearTimeout(persistMinuterie); persistMinuterie = setTimeout(persist, 400); }
function persistMaintenant() { if (persistMinuterie) { clearTimeout(persistMinuterie); persistMinuterie = null; persist(); } }
window.addEventListener("pagehide", persistMaintenant);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistMaintenant(); });
function commit(rerender = true, texte = false) { if (typeof viderCacheCalc === "function") viderCacheCalc();
  if (S && etatPrecedent && !dateFocus) { const av = JSON.parse(etatPrecedent), cles = ["horaires", "horairesBase", "horairesJours", "creneauMidi", "creneauS4", "creneauS5", "samedi"];
    if (cles.some(k => JSON.stringify(av[k]) !== JSON.stringify(S[k]))) { const m = horairesIncoherents(S);
      if (m && !horairesIncoherents(av)) { for (const k of cles) S[k] = av[k]; toast(m + " L’ancien horaire est gardé.", 8000); render(); return; } } }   /* horaires improbables : refusés */
  dirty = true; revision++; memoriser(texte);
  if (texte) persistBientot(); else { clearTimeout(persistMinuterie); persistMinuterie = null; persist(); }   // frappe : écriture groupée
  updateStatus();
  if (rerender) { if (dansChange) renderDiffere(); else render(); }
  else if (!texte) majKpis();
}
/* ---------- fenêtres internes au milieu de l'écran (à la place des alert, confirm et prompt du navigateur) ----------
   boite() renvoie une promesse : true / false pour une question, le texte (ou null) pour une saisie.
   Une seule fenêtre à la fois : les suivantes attendent leur tour. */
let fileBoites = Promise.resolve();
function boite(o) { const r = fileBoites.then(() => ouvrirBoite(o)); fileBoites = r.catch(() => {}); return r; }
function ouvrirBoite({ titre = "", message = "", ok = "OK", annuler = "Annuler", danger = false, info = false, saisie = null, echap }) {   /* echap : valeur rendue par Échap quand elle diffère du bouton Annuler (ex. null = « ne rien faire ») */
  const d = $("#boite");
  if (!d || typeof d.showModal !== "function") {      // navigateur trop ancien : fenêtres du navigateur
    const m = (titre ? titre + "\n\n" : "") + message;
    return Promise.resolve(saisie ? prompt(m, saisie.valeur || "") : info ? (alert(m), true) : confirm(m));
  }
  const avant = document.activeElement;
  const champ = !saisie ? "" : saisie.html ? saisie.html : saisie.options
    ? `<select id="boite-champ" aria-label="${esc(saisie.libelle || titre)}" autofocus>${saisie.options}</select>`
    : saisie.lignes ? `<textarea id="boite-champ" rows="${saisie.lignes}" aria-label="${esc(saisie.libelle || titre)}" autofocus>${esc(saisie.valeur || "")}</textarea>`
    : `<input id="boite-champ" type="text" value="${esc(saisie.valeur || "")}" placeholder="${esc(saisie.exemple || "")}" aria-label="${esc(saisie.libelle || titre)}" autocomplete="off" autofocus>`;
  d.className = danger ? "danger" : info ? "info" : "";
  d.innerHTML = `<form method="dialog">
    <h2 id="boite-titre"><span class="ico" aria-hidden="true">${danger ? "!" : info ? "i" : "?"}</span>${esc(titre || (info ? "Information" : "Confirmation"))}</h2>
    <p id="boite-msg">${esc(message)}</p>${champ}
    <div class="boutons">${info ? "" : `<button type="button" data-r="non" ${danger && !saisie ? "autofocus" : ""}>${esc(annuler)}</button>`}<button type="submit" data-r="oui" class="${danger ? "rouge" : "primary"}" ${(!danger || info) && !saisie ? "autofocus" : ""}>${esc(ok)}</button></div></form>`;
  typoNoeuds(d);
  return new Promise(res => {
    let fini = false;
    const fin = v => { if (fini) return; fini = true; if (d.open) d.close(); d.innerHTML = "";
      const retour = avant && document.contains(avant) && avant.getClientRects().length ? avant : avant && avant.closest && avant.closest("details") ? avant.closest("details").querySelector("summary") : null;   /* bouton d'un menu refermé : son menu */
      if (retour && retour.focus) retour.focus({ preventScroll: true }); res(v); };
    const valeur = () => saisie ? (saisie.lire ? saisie.lire(d) : $("#boite-champ").value) : true;
    d.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const v = valeur(), err = saisie && saisie.valider ? saisie.valider(v) : "";
      if (err) { let p = d.querySelector(".boite-err"); if (!p) { p = document.createElement("p"); p.className = "boite-err"; p.setAttribute("role", "alert"); d.querySelector("#boite-msg").after(p); }   /* en haut : jamais caché sous les boutons */
        p.textContent = err; const c = $("#boite-champ") || d.querySelector("input:not([type=checkbox]):not([type=radio]), select"); if (c) c.focus(); p.scrollIntoView({ block: "nearest" }); return; }   /* erreur : la boîte reste ouverte, avec le message */
      fin(v); });
    const liste = d.querySelector("select#boite-champ");   /* une liste fermée ne valide pas avec Entrée d'elle-même */
    if (liste) liste.addEventListener("keydown", e => { if (e.key === "Enter" && !e.altKey) { e.preventDefault(); d.querySelector("form").requestSubmit(); } });
    const non = d.querySelector('[data-r="non"]'); if (non) non.onclick = () => fin(saisie ? null : false);
    d.oncancel = e => { e.preventDefault(); fin(echap !== undefined ? echap : info ? true : saisie ? null : false); };   // Échap
    d.showModal();
    if (saisie && saisie.init) saisie.init(d);
    const f = d.querySelector("[autofocus]"); if (f) { f.focus(); if (f.select && f.tagName === "INPUT") f.select(); }
    d.dispatchEvent(new CustomEvent("boite-ouverte", { bubbles: true, detail: { message, titre, type: saisie ? "saisie" : info ? "info" : "question" } }));
  });
}
const demander = (titre, message, o = {}) => boite({ ...o, titre, message });
const informer = (titre, message, o = {}) => boite({ ...o, titre, message, info: true });
const saisir = (titre, message, saisie, o = {}) => boite({ ok: "Valider", ...o, titre, message, saisie });
const PERDU = "Des modifications ne sont pas enregistrées dans le fichier : elles seront perdues.";

/* ---------- typographie française : espaces insécables, ajoutées à l'affichage (les sources et les données n'en ont pas) ----------
   fine insécable avant ; : ! ? % » et après «. */
const typoFr = t => String(t).replace(/ ([;:!?%»])/g, "\u202F$1").replace(/« /g, "«\u202F");   // fine insécable aussi avant « : » (l'insécable normale est trop large dans la police des fiches)
function typoNoeuds(racine) {
  if (!racine) return;
  if (racine.querySelectorAll) racine.querySelectorAll("[placeholder]").forEach(el => { const v = el.getAttribute("placeholder"); if (/ [;:!?%»]|« /.test(v)) el.setAttribute("placeholder", typoFr(v)); });
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentNode;
    return !p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || (p.nodeName === "OPTION" && !p.hasAttribute("value")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });   // une option sans « value » : son texte est sa valeur
  for (let n; (n = w.nextNode());) { const v = n.nodeValue; if (/ [;:!?%»]|« /.test(v)) n.nodeValue = typoFr(v); }
}
/* les zones réécrites après l'affichage (bandeau du jour, aperçus, palettes, bandeaux) passent aussi par typoNoeuds */
new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") { const n = m.target; if (/ [;:!?%»]|« /.test(n.nodeValue) && n.parentNode && !/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(n.parentNode.nodeName)) n.nodeValue = typoFr(n.nodeValue); }
  else m.addedNodes.forEach(n => { if (n.nodeType === 1) typoNoeuds(n); else if (n.nodeType === 3 && n.parentNode) typoNoeuds(n.parentNode); }); } })
  .observe(document.body, { childList: true, subtree: true, characterData: true });
/* ---------- infobulles mises en forme (à la place de celles du navigateur, en texte brut) ----------
   Le texte d'un attribut title est mis en forme : 1re ligne = titre en gras (s'il y a d'autres lignes),
   lignes « • … » = liste à puces, **texte** = gras, ligne vide = espace. */
function bulleHTML(t) {
  const lignes = String(t).split("\n"), fmt = l => esc(typoFr(l)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let h = "", liste = false;
  lignes.forEach((l, i) => {
    const puce = /^\s*[•-] /.test(l);
    if (puce && !liste) { h += "<ul>"; liste = true; } else if (!puce && liste) { h += "</ul>"; liste = false; }
    if (puce) h += `<li>${fmt(l.replace(/^\s*[•-] /, ""))}</li>`;
    else if (!l.trim()) h += '<div class="esp"></div>';
    else h += i === 0 && lignes.length > 1 ? `<div class="t">${fmt(l)}</div>` : `<div>${fmt(l)}</div>`;
  });
  return h + (liste ? "</ul>" : "");
}
const bulle = document.createElement("div"); bulle.id = "bulle"; bulle.setAttribute("role", "tooltip"); bulle.className = "no-print"; document.body.appendChild(bulle);
let cibleBulle = null, minuterieBulle = 0;
function cacherBulle() {
  clearTimeout(minuterieBulle);
  if (cibleBulle) cibleBulle.removeAttribute("aria-describedby");
  cibleBulle = null; bulle.classList.remove("on");
}
function preparerBulle(el) {
  // le title est déplacé dans data-tip : l'infobulle du navigateur ne s'affiche plus en double
  if (el.hasAttribute("title")) {
    const t = el.getAttribute("title"); el.dataset.tip = t; el.removeAttribute("title");
    if (!el.hasAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t.split("\n")[0]);
  }
  return el.dataset.tip;
}
function montrerBulle(el) {
  if (!document.contains(el) || !el.dataset.tip) return;
  bulle.innerHTML = bulleHTML(el.dataset.tip);
  bulle.classList.add("on"); el.setAttribute("aria-describedby", "bulle");
  const r = el.getBoundingClientRect(), b = bulle.getBoundingClientRect(), m = 8;
  let x = Math.min(Math.max(m, r.left + r.width / 2 - b.width / 2), innerWidth - b.width - m);
  let y = r.bottom + 6; if (y + b.height > innerHeight - m) y = Math.max(m, r.top - b.height - 6);
  bulle.style.left = x + "px"; bulle.style.top = y + "px";
}
function viserBulle(el, delai) {
  if (el === cibleBulle) return;
  cacherBulle();
  if (!el || !preparerBulle(el) || document.body.classList.contains("tracage")) return;
  cibleBulle = el; minuterieBulle = setTimeout(() => montrerBulle(el), delai);
}
document.addEventListener("mouseover", e => { if (dernierPointeur === "touch") return; viserBulle(e.target.closest && e.target.closest("[title], [data-tip]"), 350); });
document.addEventListener("mouseout", e => { if (cibleBulle && !(e.relatedTarget && cibleBulle.contains(e.relatedTarget))) cacherBulle(); });
document.addEventListener("focusin", e => { const el = e.target.closest && e.target.closest("[title], [data-tip]"); if (el && el.matches(":focus-visible")) viserBulle(el, 600); else cacherBulle(); });
document.addEventListener("focusout", () => cacherBulle());
/* Champ de date en cours de frappe : au passage du jour au mois, Chrome envoie « change » alors que document.activeElement
   ne désigne plus le champ ; on suit donc nous-mêmes le focus des champs de date. */
let dateFocus = null, valeurFocus = "";
document.addEventListener("focusin", e => { if (e.target.type === "date" || e.target.type === "time") { dateFocus = e.target; valeurFocus = e.target.value; } });
document.addEventListener("blur", e => { if (e.target === dateFocus) dateFocus = null; }, true);     // avant les écouteurs « blur » du champ lui-même
/** À la sortie d'un champ de date : une année de 4 chiffres (19xx-20xx), sinon on garde l'ancienne valeur. */
const dateValide = (v, requise = false) => (!v ? !requise : /^(19|20)\d\d-\d\d-\d\d$/.test(v) && !isNaN(parseD(v)));
const dateEnSaisie = t => document.activeElement === t || dateFocus === t;
/* Changer le premier lundi ne doit pas faire basculer A/B les semaines déjà là : on ajuste le type de la 1re semaine. */
let semAvantDebut = null;
const typesSemaines = () => new Map(semaines(S).map(w => [w.lundi, w.type]));
document.addEventListener("change", e => { const t = e.target; if (S && t.matches && t.matches('[data-num="anneeScolaire"], [data-path="zone"], [data-bool="alsaceMoselle"]'))
  setTimeout(() => toast("Vacances et jours fériés inchangés : cliquez « Préremplir les vacances et les jours fériés » pour les mettre à jour.", 6000), 0); });
/** Dates dans le mauvais ordre (premier et dernier jour du suivi, début et reprise des vacances) : message, sinon "". */
function ordreDates(path, v) {
  if (!v || !S) return ""; const mv = /^vacances\.(\d+)\.(debut|reprise)$/.exec(path || ""), garde = " L’ancienne date est gardée.";
  if (path === "fin" && S.debut && v < S.debut) return "Le dernier jour du suivi est avant le premier." + garde;
  if (path === "debut" && S.fin && v > S.fin) return "Le premier jour du suivi est après le dernier." + garde;
  const me = /^(eleves|classeEleves)\.(\d+)\.(debut|fin)$/.exec(path || "");   /* arrivée et départ d'un élève */
  if (me) { const el = S[me[1]][Number(me[2])] || {}; if (me[3] === "debut" ? el.fin && v > el.fin : el.debut && v < el.debut) return "Le départ de l’élève doit être après son arrivée." + garde; }
  if (mv) { const va = S.vacances[Number(mv[1])] || {}; if (mv[2] === "debut" ? va.reprise && v >= va.reprise : va.debut && v <= va.debut) return "La reprise des vacances doit être après leur début." + garde; }
  return "";
}
const changeTypesAB = p => p === "debut" || /^vacances\.\d+\.(debut|reprise)$/.test(p || "");
document.addEventListener("focusin", e => { if (e.target.dataset && changeTypesAB(e.target.dataset.path) && S) semAvantDebut = typesSemaines(); });
/** avant : lundi → type des semaines d'avant le changement (premier lundi, vacances…). Les semaines déjà là gardent leur type :
    la 1re qui change est forcée à son ancien type (l'alternance repart d'elle), ou le type de la 1re semaine est inversé. */
function garderTypeAB(avant) { if (!avant || !S) return; let n = 0;
  for (let k = 0; k < 8; k++) { const sems = semaines(S), w = sems.find(x => avant.has(x.lundi) && x.type !== avant.get(x.lundi)); if (!w) break; n++;
    // seules des semaines nouvelles la précèdent (premier lundi avancé ou corrigé) : on change le type de la 1re semaine plutôt que de forcer
    if (sems.slice(0, sems.indexOf(w)).every(x => !avant.has(x.lundi)) && !Object.keys(S.typesForces).some(k => k < w.lundi)) S.typeDebut = S.typeDebut === "A" ? "B" : "A";
    else S.typesForces[w.lundi] = avant.get(w.lundi); }
  if (n) toast("Les semaines déjà là gardent leur type A ou B.", 5000); }
document.addEventListener("pointerdown", () => cacherBulle(), true);
document.addEventListener("keydown", e => { if (e.key === "Escape" && cibleBulle) cacherBulle(); }, true);
// fenêtre interne ouverte : ses touches (Ctrl+Z, flèches, Entrée…) n'agissent pas sur la page derrière
$("#boite").addEventListener("keydown", e => e.stopPropagation());
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-hor-raz]"); if (!b || !S) return; S.horaires[b.dataset.horRaz] = { debut: "", fin: "" }; commit(); });
window.addEventListener("scroll", () => cacherBulle(), true);
document.addEventListener("toggle", e => { if (e.target.open && e.target.matches && e.target.matches("details.menu")) cacherBulle(); }, true);   /* l’infobulle du bouton ne couvre pas le menu ouvert */

/** Nom d'un champ pour les messages (son libellé accessible), et nombre avec un vrai signe moins. */
const nomChamp = t => { const l = (t.getAttribute("aria-label") || "").trim(); return l ? l[0].toUpperCase() + l.slice(1) : "Valeur"; };
const nbSigne = n => String(n).replace("-", "−");
/* ---------- message bref en bas de l'écran (lu aussi par les lecteurs d'écran) ---------- */
let toastMinuterie = null;
function toast(msg, ms = 3500) {
  const t = $("#toast"); t.textContent = typoFr(msg); t.classList.add("on");
  clearTimeout(toastMinuterie); toastMinuterie = setTimeout(() => t.classList.remove("on"), ms);
}
let telecharge = false;              // dernier enregistrement fait par téléchargement (pas de mise à jour du fichier d'origine)
function updateStatus() {
  if (HOTE) dirty = false;                 // version intégrée : tout est enregistré par Suivi PP, à chaque modification
  const el = $("#status");
  if (!S) el.textContent = "";
  else el.textContent = dirty ? (idEnregistre ? "Modifié · non enregistré" : "Pas encore enregistré")
                         : idEnregistre ? (telecharge ? "Copie téléchargée" : MODE_ENREG === "json" ? "Enregistré" + (nomFichier ? " · " + nomFichier : "") : "Enregistré dans ce fichier") : S.demo ? "Démonstration" : "Pas encore enregistré";
  el.title = (MODE_ENREG === "json" ? "Fichier de données : " + (nomFichier || "pas encore choisi") : "Fichier : " + NOM_PAGE) + "\n" + (dirty ? (stockageEnErreur ? "ATTENTION : la copie de secours de ce navigateur ne fonctionne pas. Enregistrez (Ctrl+S)." : "Les modifications sont gardées en secours dans ce navigateur, mais pas encore dans le fichier : cliquez sur Enregistrer (Ctrl+S).")
    : telecharge ? "Une copie à jour a été téléchargée : remplacez l’ancien fichier par celle-ci." : idEnregistre ? "Tout est enregistré dans ce fichier." : "Rien n’est encore enregistré dans ce fichier.");
  if (HOTE && S) { el.textContent = S.demo ? "Démonstration · dans Suivi PP" : "Enregistré dans Suivi PP"; el.title = "Le suivi est rangé dans les données de Suivi PP : il suit leur synchronisation et leurs sauvegardes, et Ctrl+Z l’annule comme le reste."; }
  el.classList.toggle("dirty", dirty);
  $("#brand-classe").textContent = S && S.classe ? S.classe : "FS";
  const sems = S ? semaines(S) : [], nbEl = S ? S.eleves.filter(e => e.nom.trim()).length : 0;
  $("#brand-titre").textContent = S && S.classe ? `Fiches de suivi ${S.classe}` : "Fiches de suivi";
  $("#brand-sous").textContent = S && sems.length ? `semaines ${sems[0].num} à ${sems[sems.length - 1].num}` : "individuels · collectif · classe";
  $("#brand-sous").title = $("#brand-titre").textContent + "\n" + $("#brand-sous").textContent;   /* le sous-titre peut être coupé (police plus large) */
  document.documentElement.classList.toggle("modifie", !!dirty);
  $(".side-pied").title = el.textContent;
  document.title = (dirty && S ? "• " : "") + (S && NOMS_VUES[current.view] ? NOMS_VUES[current.view] + (current.view === "fiche" && ficheDate ? " du " + fmtDM(ficheDate) : "") + " – " : "") +
    "Fiches de suivi" + (S && S.classe ? " – " + S.classe : "");
}
function setPath(obj, path, val) {
  const keys = path.split("."); let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
  o[keys[keys.length - 1]] = val;
}
function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }

/* ---------- enregistrement dans la page elle-même ----------
   Les données du suivi sont rangées dans le bloc <script id="donnees-suivi"> de ce fichier .html : Enregistrer (Ctrl+S) réécrit le fichier.
   Chrome et Edge écrivent directement dedans (le fichier est choisi une fois, puis retenu d'une visite à l'autre) ; les autres navigateurs
   téléchargent une copie. Une copie de secours reste dans ce navigateur (propre à chaque fichier) en cas de fermeture sans enregistrer. */
const NOM_PAGE = (() => { try { return decodeURIComponent(location.pathname.split("/").pop()) || "Fiche de suivi collective.html"; } catch (e) { return "Fiche de suivi collective.html"; } })();
const CLE_PAGE = LS_KEY + ":" + (() => { try { return decodeURIComponent(location.pathname); } catch (e) { return location.pathname; } })();
const RE_BLOC = /(<script id="donnees-suivi" type="application\/json">)([\s\S]*?)(<\/script>)/;
/* Où enregistrer (« html » depuis le 10/10/2026, comme un logiciel tout-en-un) : "json" = un fichier de données .json à côté de la page (pendant la mise au point : la page pouvait être remplacée
   par une nouvelle version sans toucher aux données) ; "html" = dans la page elle-même (un seul fichier à copier). */
const MODE_ENREG = HOTE ? "hote" : "html";   // "hote" : version intégrée à Suivi PP, rien ne s'enregistre ici
const NOM_JSON = NOM_PAGE.replace(/\.html?$/i, "") + ".json";
const TYPE_JSON = [{ description: "Données du suivi (.json)", accept: { "application/json": [".json"] } }];
let nomFichier = "";          // mode json : nom du fichier de données choisi
let enregistreLe = "";        // date de l'enregistrement contenu dans le fichier
let idEnregistre = "";        // identifiant du suivi contenu dans le fichier (vide : fichier sans données)
/** Données rangées dans un texte de page : { savedAt, S } ; null s'il n'y en a pas ; lève une erreur si elles sont illisibles. */
function lireBloc(texte) {
  const m = RE_BLOC.exec(texte);
  if (!m) return null;
  const d = JSON.parse(m[2]);
  if (d == null) return null;
  if (!d || typeof d !== "object" || !d.S || d.app !== "fiche-suivi-collective") throw new Error("Les données rangées dans ce fichier ne sont pas reconnues.");
  return d;
}
/** Fichier enregistré par une version plus récente de l'application : prévenir (ses données sont gardées, mais certaines fonctions manquent ici). */
function verifierFormat(d, nom) {
  if (d && Number(d.format) > FORMAT_DONNEES) setTimeout(() => informer("Fichier plus récent", `« ${nom} » a été enregistré par une version plus récente de l’application.\n\nLe suivi s’ouvre, mais utilisez de préférence la version la plus récente pour le modifier.`), 300);
}
/** Texte complet de la page avec les données à jour. */
function pageAvecDonnees(d) {
  const json = JSON.stringify(d).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  if (!RE_BLOC.test(PAGE_SOURCE)) throw new Error("La page de l’application est incomplète : impossible d’y ranger les données.");
  return "<!DOCTYPE html>\n" + PAGE_SOURCE.replace(RE_BLOC, (m, debut, ancien, fin) => debut + json + fin);
}
/* fichier choisi pour l'enregistrement, retenu d'une visite à l'autre (Chrome, Edge) : son « handle » est gardé dans IndexedDB */
function baseFichiers() {
  return new Promise((ok, ko) => {
    const q = indexedDB.open(LS_KEY, 1);
    q.onupgradeneeded = () => q.result.createObjectStore("fichiers");
    q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error);
  });
}
async function memoriserFichier(handle) {
  try {
    const db = await baseFichiers();
    await new Promise((ok, ko) => { const tx = db.transaction("fichiers", "readwrite");
      if (handle) tx.objectStore("fichiers").put({ handle, nom: handle.name, mode: MODE_ENREG }, CLE_PAGE); else tx.objectStore("fichiers").delete(CLE_PAGE);
      tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
  } catch (e) { /* navigateur sans IndexedDB : le fichier sera redemandé au prochain enregistrement */ }
}
async function retrouverFichier() {
  try {
    const db = await baseFichiers();
    const v = await new Promise((ok, ko) => { const q = db.transaction("fichiers").objectStore("fichiers").get(CLE_PAGE); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
    if (v && v.handle && !fileHandle && (MODE_ENREG === "json" ? v.mode === "json" : v.nom === NOM_PAGE)) {
      fileHandle = v.handle;
      if (MODE_ENREG === "json") { nomFichier = v.nom; if (!S && current.view !== "fiche") render(); else updateStatus(); }   // accueil : proposer de rouvrir ce fichier
    }
  } catch (e) { /* idem */ }
}
/** Droit d'écrire dans le fichier retrouvé : Chrome le redemande après un rechargement (à faire pendant le clic). */
async function droitEcriture(h) {
  if (!h || !h.queryPermission) return true;
  try {
    if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
    return (await h.requestPermission({ mode: "readwrite" })) === "granted";
  } catch (e) { return false; }
}
function suggestedName(ext = ".ods") {
  const sems = semaines(S);
  return `Suivi ${S.classe || "classe"}${sems.length ? " S" + sems[0].num + "-S" + sems[sems.length - 1].num : ""}${ext}`.replace(/[\\/:*?"<>|]/g, "-");
}
function telechargerBlob(blob, nom) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const TYPE_HTML = [{ description: "Fiche de suivi (page web .html)", accept: { "text/html": [".html", ".htm"] } }];
let enregistrementEnCours = false;
/** Enregistre le suivi dans ce fichier .html (copie = true : dans un autre fichier, ce fichier-ci n'est pas modifié). */
async function saveFile(copie) {
  if (enregistrementEnCours || !S) return;
  // le fichier contient un autre suivi (nouveau suivi, démonstration, données reprises d'ailleurs) : confirmer avant de l'écraser
  if (!copie && idEnregistre && S.id !== idEnregistre && !(await demander("Remplacer le suivi enregistré ?",
    `Le fichier d’enregistrement contient déjà un autre suivi. L’enregistrer maintenant le remplacera par ${S.demo ? "la démonstration" : "le suivi affiché"}${S.classe ? " (classe " + S.classe + ")" : ""}.`, { ok: "Remplacer", danger: true }))) return;
  enregistrementEnCours = true;
  const rev = revision;               // une saisie faite pendant l'écriture reste « non enregistrée »
  persistMaintenant();
  try {
    $("#b-save span").textContent = "Enregistrement…"; $("#b-save").disabled = true;
    const savedAt = new Date().toISOString();
    const json = MODE_ENREG === "json", d = { app: "fiche-suivi-collective", format: FORMAT_DONNEES, savedAt, S };
    const blob = new Blob([json ? JSON.stringify(d) : pageAvecDonnees(d)], { type: json ? "application/json" : "text/html" });
    const nomDefaut = json ? nomFichier || NOM_JSON : NOM_PAGE, nomCopie = suggestedName(json ? ".json" : ".html");
    let ou = "";                      // "page" : ce fichier ; "copie" : un autre fichier ; "telecharge" : téléchargement
    if (window.showSaveFilePicker) {
      try {
        let h = copie ? null : fileHandle;
        if (h && !(await droitEcriture(h))) h = null;
        if (!h) {
          if (!copie && !(await demander(json ? "Où enregistrer le suivi ?" : "Enregistrer dans ce fichier", json
            ? `Le suivi s’enregistre dans un fichier de données « .json », à garder avec cette page (par exemple dans le même dossier que « ${NOM_PAGE} »).\n\nChoisissez où le ranger dans la fenêtre qui va s’ouvrir : il ne sera plus redemandé ensuite.`
            : `Les données s’enregistrent dans le fichier de l’application lui-même.\n\nDans la fenêtre qui va s’ouvrir, retrouvez le fichier « ${NOM_PAGE} » (celui que vous avez ouvert), choisissez-le et acceptez de le remplacer. Il ne sera plus redemandé ensuite.`, { ok: "Choisir le fichier" }))) return;
          h = await window.showSaveFilePicker({ id: "fiche-suivi", suggestedName: copie ? nomCopie : nomDefaut, types: json ? TYPE_JSON : TYPE_HTML });
          if (!json) { let ex = ""; try { ex = h.getFile ? await (await h.getFile()).text() : ""; } catch (e) { /* fichier neuf */ }   /* ne pas écraser autre chose qu'une page de l'application, ni un autre suivi sans le dire */
            let dx = null; try { dx = lireBloc(ex); } catch (e) { dx = null; }
            if (ex.trim() && !RE_BLOC.test(ex) && !(await demander("Remplacer ce fichier ?", `« ${h.name} » n’est pas une page de cette application. Il sera remplacé par l’application avec le suivi.`, { ok: "Remplacer", danger: true }))) throw Object.assign(new Error(""), { name: "AbortError" });
            if (dx && dx.S && dx.S.id !== S.id && !(await demander("Remplacer un autre suivi ?", `« ${h.name} » contient un autre suivi${dx.S.classe ? " (classe " + dx.S.classe + ")" : ""}. Il sera remplacé par le suivi affiché.`, { ok: "Remplacer", danger: true }))) throw Object.assign(new Error(""), { name: "AbortError" }); }
        }
        const w = await h.createWritable(); await w.write(blob); await w.close();
        if (!copie && (json || h.name === NOM_PAGE)) { fileHandle = h; nomFichier = h.name; memoriserFichier(h); ou = "page"; }
        else ou = "copie:" + h.name;
      } catch (e) {
        if (e.name === "AbortError") throw e;
        // sélecteur refusé (page dans un cadre d'ENT, droits…) : téléchargement à la place
        if (!["SecurityError", "NotAllowedError", "TypeError"].includes(e.name)) throw e;
        telechargerBlob(blob, copie ? nomCopie : nomDefaut); ou = copie ? "copie:" : "telecharge";
      }
    } else { telechargerBlob(blob, copie ? nomCopie : nomDefaut); ou = copie ? "copie:" : "telecharge"; }
    if (ou === "page" || ou === "telecharge") { enregistreLe = savedAt; idEnregistre = S.id; telecharge = ou === "telecharge"; dirty = revision !== rev; }
    persist(); updateStatus();
    if (ou === "page") toast(`Enregistré dans « ${json ? nomFichier : NOM_PAGE} ».`);
    else if (ou === "telecharge") informer("Fichier téléchargé", json
      ? `Ce navigateur ne sait pas écrire directement dans un fichier : « ${nomDefaut} » a été téléchargé (dossier Téléchargements, en général). Gardez le plus récent.\n\nChrome ou Edge enregistrent directement, sans téléchargement.`
      : `Ce navigateur ne sait pas réécrire le fichier ouvert : une copie à jour, « ${NOM_PAGE} », a été téléchargée (dossier Téléchargements, en général).\n\nRemplacez l’ancien fichier par cette copie, ou utilisez Chrome ou Edge, qui enregistrent directement dans le fichier.`);
    else toast(`Copie enregistrée${ou.slice(6) ? " dans « " + ou.slice(6) + " »" : ""}. Ce fichier-ci n’a pas été modifié${dirty ? " : pensez à l’enregistrer aussi" : ""}.`, 6000);
    if (!json && ou !== "page" && !copie && ou !== "telecharge") { /* autre nom choisi : ce n'est pas ce fichier */
      informer("Ce n’était pas ce fichier", `Le suivi a été enregistré dans « ${ou.slice(6)} », pas dans « ${NOM_PAGE} » (le fichier ouvert).\n\nPour continuer avec ces données, ouvrez désormais « ${ou.slice(6)} ». Sinon, enregistrez à nouveau et choisissez « ${NOM_PAGE} ».`);
    }
  } catch (e) {
    if (e.name !== "AbortError") informer("Enregistrement impossible", e.message);
  } finally { enregistrementEnCours = false; $("#b-save span").textContent = "Enregistrer"; $("#b-save").disabled = false; }
}
/** Exporte les données du suivi dans un fichier .json à part (sauvegarde, transfert) : le fichier d'enregistrement habituel n'est pas modifié. */
async function exporterJson() {
  if (!S) return;
  const blob = new Blob([JSON.stringify({ app: "fiche-suivi-collective", format: FORMAT_DONNEES, savedAt: new Date().toISOString(), S }, null, 1)], { type: "application/json" });
  const nom = `Suivi ${(S.classe || "collectif").trim()} - Données - export du ${dateNom(aujourdhui())}.json`.replace(/[\\/:*?"<>|]/g, "-");
  if (window.showSaveFilePicker && !HOTE) {   /* dans le cadre de Suivi PP : un téléchargement, toujours permis */
    try {
      const h = await window.showSaveFilePicker({ id: "fiche-suivi-export", suggestedName: nom, types: TYPE_JSON });
      const w = await h.createWritable(); await w.write(blob); await w.close();
      toast(`Données exportées dans « ${h.name} ».`); return;
    } catch (e) { if (e.name === "AbortError") return; if (!["SecurityError", "NotAllowedError", "TypeError"].includes(e.name)) { informer("Export impossible", e.message); return; } }
  }
  telechargerBlob(blob, nom); toast(`« ${nom} » téléchargé.`);
}
/** Reprend le suivi d'un autre fichier : fichier de données .json, ou une autre copie de cette page (.html). */
async function openFile() {
  if (S && !(await demander("Reprendre un autre suivi ?", `Le suivi affiché sera remplacé par celui du fichier choisi${dirty ? ".\n\n" + PERDU : "."}`, { ok: "Choisir le fichier", danger: dirty }))) return;
  if (window.showOpenFilePicker && !HOTE) {
    try {
      const [h] = await window.showOpenFilePicker({ id: "fiche-suivi", types: [{ description: "Suivi enregistré (.json ou .html)", accept: { "application/json": [".json"], "text/html": [".html", ".htm"] } }] });
      await loadFile(await h.getFile());
    } catch (e) { if (e.name !== "AbortError") informer("Ouverture impossible", e.message); }
  } else $("#file-in").click();
}
/** Rouvre le fichier de données retenu (mode json), par exemple après « Effacer de ce navigateur » ou sur l'accueil. */
async function rouvrirFichier() {
  const h = fileHandle; if (!h) return;
  try {
    if (h.queryPermission && (await h.queryPermission({ mode: "readwrite" })) !== "granted" && (await h.requestPermission({ mode: "readwrite" })) !== "granted") return;
    await loadFile(await h.getFile(), true);
  } catch (e) { informer("Ouverture impossible", `« ${nomFichier} » n’a pas pu être relu (déplacé ou renommé ?).\n\n${e.message}\n\nUtilisez « Reprendre un suivi » pour le retrouver.`); }
}
/** Reprend le suivi d'un fichier ; enregistre = true : c'est le fichier d'enregistrement lui-même (rien à réenregistrer). */
async function loadFile(f, enregistre = false) {
  let nouvel, savedAt = "";
  try {
    if (/\.json$/i.test(f.name)) {
      const d = JSON.parse(await f.text());
      if (!d || d.app !== "fiche-suivi-collective" || !d.S) throw new Error("Ce fichier .json n’est pas un suivi enregistré par cette application.");
      nouvel = normalizeState(d.S); savedAt = d.savedAt || ""; verifierFormat(d, f.name);
    } else if (/\.html?$/i.test(f.name)) {
      const d = lireBloc(await f.text());
      if (!d) throw new Error(/donnees-suivi/.test(await f.text()) ? "Cette page de l’application ne contient pas encore de suivi enregistré." : "Ce fichier .html n’est pas une page de cette application.");
      nouvel = normalizeState(d.S); verifierFormat(d, f.name);
    } else throw new Error("Choisissez un fichier .json (ou .html) enregistré par cette application.");
    essaiRendu(nouvel);               // essai à blanc : un fichier qui ferait planter l'affichage est refusé, l'état actuel est gardé
  } catch (e) { informer("Ouverture impossible", "Impossible de reprendre le suivi de « " + f.name + " ».\n\n" + e.message); return false; }
  S = nouvel; dirty = !enregistre; telecharge = false;
  if (enregistre) { idEnregistre = S.id; enregistreLe = savedAt; nomFichier = f.name; }
  if (HOTE) { delete S.demo; hoteAccorder(S); hoteEtape = true; }   // un geste : Ctrl+Z dans Suivi PP le défait
  reinitHistorique(); reinitVues(); persist(); updateStatus();
  toast(HOTE ? `Suivi de « ${f.name} » repris dans Suivi PP. Ctrl+Z pour revenir en arrière.` : enregistre ? `« ${f.name} » rouvert.` : `Suivi de « ${f.name} » repris. Enregistrez (Ctrl+S) pour le garder${MODE_ENREG === "html" ? " dans ce fichier" : ""}.`, 6000);
  location.hash = "#sommaire"; render();
  return true;
}
/** Calcule toutes les vues avec un état, sans rien afficher : lève une erreur si l'une d'elles échoue. */
function essaiRendu(st) {
  const ancien = S; S = st;
  try {
    const sems = semaines(S);
    viewSommaire(); viewReglages(); viewEdt(); bilanHTML(); viewIndiv();
    sems.forEach((w, wi) => { totauxHTML(wi); w.jours.forEach(d => ficheHTML(d, false)); });
  } finally { S = ancien; }
}

/** Date du jour en heure locale (toISOString donnerait la veille entre minuit et 2 h). */
function aujourdhui() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/* ---------- navigation ---------- */
let current = { view: "sommaire", arg: null };
let ficheDate = null;          // date de la fiche affichée
const absEdit = new Set();     // élèves dont on règle l'absence créneau par créneau (« date.élève »)
const NOMS_VUES = { eleve: "Fiche élève", conseil: "Conseil de classe", sommaire: "Sommaire", fiche: "Fiche collective", classe: "Fiche de classe", classesem: "Fiche de classe de la semaine", classesuivi: "Classe semaine après semaine", classebilan: "Bilan par matière de la classe", indivtous: "Tous les suivis individuels", totaux: "Totaux", bilan: "Bilan", edt: "Emploi du temps", reglages: "Réglages", indiv: "Suivis individuels" };
function route() {
  const [v, arg] = location.hash.replace(/^#/, "").split("/");
  if (v === "classe" && S) {            // ancienne fiche de classe du jour : la fiche de la semaine qui contient ce jour
    const sems = semaines(S), w = (arg && semaineDuJour(sems, arg)) || (ficheDate && semaineDuJour(sems, ficheDate));
    if (arg) ficheDate = arg;
    location.replace("#classesem" + (w ? "/" + sems.indexOf(w) : "")); return;
  }
  const autreVue = !current || current.view !== (v || "sommaire") || (v === "reglages" && (current.arg || "") !== (arg || ""));   /* autre rubrique des réglages : en haut aussi */
  current = { view: v || "sommaire", arg: arg ?? null };
  if (autreVue && (current.view === "indiv" || current.view === "classesem")) { codeIndiv = null; codeCl = null; }   // à l'ouverture d'une fiche : aucun code choisi
  if (S && !HOTE) try { localStorage.setItem(CLE_PAGE + "-page", JSON.stringify({ id: S.id, hash: location.hash })); } catch (e) { /* sans stockage */ }   // rouvrir sur la dernière page vue
  render();
  // changement de page : le focus perdu va au titre de la page (lecteurs d'écran, clavier) ; on remonte en haut si la vue change
  if (!document.activeElement || document.activeElement === document.body) {
    const t = $("#view [data-titre]") || $("#view h1, #view h2");
    if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
  }
  if (autreVue) window.scrollTo(0, 0);
}
/** Repère d'un élément de saisie, pour lui rendre le focus après avoir redessiné la vue. */
function cleFocus(el) {
  const view = $("#view");
  if (!el || el === document.body || !view.contains(el)) return null;
  if (el.id) return "#" + CSS.escape(el.id);
  const d = Object.entries(el.dataset)[0];
  if (d) return `${el.tagName.toLowerCase()}[data-${d[0].replace(/[A-Z]/g, c => "-" + c.toLowerCase())}="${CSS.escape(d[1])}"]`;
  const all = [...view.querySelectorAll("input,select,textarea,button,a[href]")];
  return { index: all.indexOf(el) };
}
/** Fonctions appelées après chaque affichage (placement d'une petite fenêtre, etc.). */
const apresRendu = [];
/** Menu déroulant (▾, Seuils, ⋯) : s'il sortirait de l'écran à gauche ou en bas, il s'ouvre de l'autre côté. */
document.addEventListener("toggle", e => { const d = e.target; if (!d.matches || !d.matches("details.menu") || !d.open || d.closest(".side")) return;
  const pop = d.querySelector(".pop"); if (!pop) return; pop.style.left = pop.style.right = pop.style.top = pop.style.bottom = "";
  const side = document.querySelector(".side"), g = side ? side.getBoundingClientRect().right : 0; let r = pop.getBoundingClientRect();
  if (r.left < g + 4) { pop.style.left = "0"; pop.style.right = "auto"; r = pop.getBoundingClientRect(); }
  if (r.right > innerWidth - 4) { pop.style.right = "0"; pop.style.left = "auto"; }
  if (r.bottom > innerHeight - 4 && d.getBoundingClientRect().top - r.height > 8) { pop.style.top = "auto"; pop.style.bottom = "calc(100% + 4px)"; } }, true);
/** Fiche collective et totaux plus larges que la place (menu déplié, zoom) : le tableau est réduit pour tenir dans sa feuille,
    sans barre de défilement (l'en-tête reste collé en haut). */
function ajusterLargeur() {
  if (current.view !== "fiche" && current.view !== "totaux" && current.view !== "bilan") return;
  document.querySelectorAll("#view .sheet").forEach(sh => { const t = sh.querySelector(":scope > table.fiche, :scope > table.tot, table.fiche, table.tot, table.bil"); if (!t) return;
    t.style.zoom = ""; const cs = getComputedStyle(sh), dispo = sh.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), w = t.scrollWidth;
    if (w > dispo + 1) t.style.zoom = Math.max(0.7, dispo / w).toFixed(3); });
}
window.addEventListener("resize", () => { if (S) ajusterLargeur(); });
function render() { if (typeof viderCacheCalc === "function") viderCacheCalc();
  document.querySelectorAll("#tabs a").forEach(a => { const on = a.dataset.v === (current.view === "classesem" ? "classe" : current.view); a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const view = $("#view"), act = document.activeElement, cle = cleFocus(act);
  let sel = null; try { sel = act && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null; } catch (e) { /* pas de sélection */ }
  document.body.classList.toggle("sans-donnees", !S);
  if (!S) { view.innerHTML = viewAccueil(); typoNoeuds(view); couperTuto(); updateStatus(); return; }   // plus de suivi : ni tutoriel ni ancien titre
  const v = { sommaire: viewSommaire, fiche: viewFiche, classesem: viewClasseSemaine, classesuivi: viewClasseSuivi, classebilan: viewClasseBilan, eleve: viewEleve, conseil: viewConseil, indivtous: viewIndivTous, totaux: viewTotaux, bilan: viewBilan, edt: viewEdt, reglages: viewReglages, indiv: viewIndiv }[current.view] || viewSommaire;
  try { view.innerHTML = bandeauDemo() + v(current.arg); }
  catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h2>Affichage impossible</h2><p>Une erreur empêche d’afficher cette page : ${esc(e.message)}.</p>
      <p>Vos données ne sont pas perdues. Essayez une autre page, annulez la dernière modification (Ctrl+Z) ou rouvrez votre dernier fichier enregistré.</p></div>`;
  }
  updateStatus();
  typoNoeuds($("#view")); apresRendu.forEach(f => f());
  if (cle) {
    const el = typeof cle === "string" ? view.querySelector(cle) : [...view.querySelectorAll("input,select,textarea,button,a[href]")][cle.index];
    if (el && !el.disabled) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* champ sans sélection */ } }
  }
}
/** Après une saisie (« change »), on redessine au tour suivant : le focus a déjà rejoint le champ suivant (touche Tab). */
let renduPrevu = false;
function renderDiffere() {
  if (renduPrevu) return;
  renduPrevu = true;
  setTimeout(() => { renduPrevu = false; render(); }, 0);
}

/* ---------- accueil ---------- */
function viewAccueil() {
  if (HOTE) return viewAccueilHote();
  return `<div class="accueil"><h1 class="titre-accueil">Fiches de suivi</h1>
  <p class="intro">Suivi du comportement, cours par cours : <b>fiches individuelles</b> avec bilan pour la famille, <b>fiches collectives</b> pour quelques élèves suivis ensemble (totaux, bilan par matière) et <b>fiches de classe</b> pour toute la classe.
  Ce fichier ne contient pas encore de suivi. Que voulez-vous faire ?</p>
  <div class="tuto-accueil"><div><b>Première utilisation ?</b> Le tutoriel vous guide pas à pas et explique à quoi sert chaque étape.</div><button class="primary" data-act="tuto">Suivre le tutoriel</button></div>
  <div class="choix">${MODE_ENREG === "json" && fileHandle ? `
    <div class="opt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/></svg><h2>Rouvrir le suivi enregistré</h2>
      <p>Le dernier fichier de données utilisé ici : <b>${esc(nomFichier)}</b>.</p>
      <button class="primary" data-act="rouvrir">Rouvrir « ${esc(nomFichier)} »</button></div>` : ""}
    <div class="opt drop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path d="M12 10.5v6m-2.6-2.6L12 16.5l2.6-2.6"/></svg><h2>Reprendre un suivi existant</h2>
      <p>Choisir un autre fichier de l’application (<b>.html</b>) qui contient un suivi, par exemple une version précédente, ou un fichier de données <b>.json</b>.</p>
      <button class="primary" data-act="open">Choisir le fichier…</button><small>ou glissez le fichier sur cette page</small></div>
    <div class="opt"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M15.5 14.5v5M13 17h5"/></svg><h2>Commencer un nouveau suivi</h2>
      <p>Fiches vierges : vous indiquez la classe, les élèves et l’emploi du temps, les réglages vous guident pas à pas.</p>
      <p class="pdc"><b>Votre classe est dans Plan de classe ?</b> Choisissez son fichier de sauvegarde (.json) : vous choisissez la classe, les élèves arrivent avec leurs groupes et options.</p>
      <div class="opt-btns"><button data-act="new-pdc" title="Nouveau suivi depuis Plan de classe\nUn suivi vierge, puis la liste de la classe lue dans une sauvegarde de Plan de classe (.json)\n• aperçu avant l’import">Classe depuis Plan de classe (.json)…</button>
      <button data-act="new">Nouveau suivi</button></div></div>
    <div class="opt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg><h2>Découvrir avec la démonstration</h2>
      <p>Une classe fictive déjà remplie (26 élèves, 3 suivis individuels, un suivi collectif de 6 élèves, 8 semaines de fiches de classe) pour essayer toutes les fonctions sans risque.</p>
      <button data-act="demo">Voir la démonstration</button></div>
  </div>
  <p class="note">${MODE_ENREG === "json" ? `Le suivi s’enregistre dans un <b>fichier de données .json</b> (bouton Enregistrer ou Ctrl+S ; Chrome ou Edge conseillés), à garder avec cette page.
  Ce navigateur en garde aussi une copie : à la prochaine ouverture, vous retrouvez votre suivi directement. Rien n’est envoyé sur Internet.`
  : `Le suivi s’enregistre <b>dans ce fichier lui-même</b> (bouton Enregistrer ou Ctrl+S ; Chrome ou Edge conseillés) :
  pour le transmettre ou changer d’ordinateur, il suffit de copier ce fichier .html. Rien n’est envoyé sur Internet.`}<br>
  Sur un ordinateur partagé, pensez à « Fichier › Effacer de ce navigateur » en partant.</p></div>`;
}
/** Accueil de la version intégrée : la classe de Suivi PP n'a pas encore de suivi. */
function viewAccueilHote() {
  const n = hoteClasse && Array.isArray(hoteClasse.eleves) ? hoteClasse.eleves.length : 0;
  return `<div class="accueil"><h1 class="titre-accueil">Fiches de suivi${hoteClasse && hoteClasse.nom ? " — " + esc(hoteClasse.nom) : ""}</h1>
  <p class="intro">Suivi du comportement, cours par cours : <b>fiches individuelles</b> avec bilan pour la famille, <b>fiches collectives</b> pour quelques élèves suivis ensemble et <b>fiches de classe</b> pour toute la classe.
  Cette classe n’a pas encore de suivi. Que voulez-vous faire ?</p>
  <div class="tuto-accueil"><div><b>Première utilisation ?</b> Le tutoriel vous guide pas à pas et explique à quoi sert chaque étape.</div><button class="primary" data-act="tuto">Suivre le tutoriel</button></div>
  <div class="choix">
    <div class="opt"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M15.5 14.5v5M13 17h5"/></svg><h2>Commencer le suivi de la classe</h2>
      <p>La liste de la classe vient de Suivi PP${n ? ` (${nbMot(n, "élève")}, avec leurs groupes et options)` : ""} ; les réglages vous guident pour le reste : période, emploi du temps, matières.</p>
      <button class="primary" data-act="new">Commencer le suivi</button></div>
    <div class="opt drop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path d="M12 10.5v6m-2.6-2.6L12 16.5l2.6-2.6"/></svg><h2>Reprendre un suivi existant</h2>
      <p>Un suivi tenu avec l’application autonome (fichier <b>.html</b>) ou exporté (<b>.json</b>) : il est rangé dans Suivi PP, et ses élèves sont rapprochés de ceux de la classe.</p>
      <button data-act="open">Choisir le fichier…</button><small>ou glissez le fichier sur cette page</small></div>
    ${hoteDemo ? `<div class="opt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg><h2>Découvrir avec la démonstration</h2>
      <p>Des fiches fictives déjà remplies, aux noms des élèves de cette classe de démonstration.</p><button data-act="demo">Voir la démonstration</button></div>` : ""}
  </div>
  <p class="note">Le suivi est rangé <b>dans les données de Suivi PP</b> : il suit leur synchronisation et leurs sauvegardes, et Ctrl+Z l’annule comme le reste. Rien n’est envoyé sur Internet.</p></div>`;
}
/** Version intégrée : la liste de la classe, en lecture — elle vient de Suivi PP. Une ligne qui n'y est plus (élève supprimé là-bas,
    nom repris d'un ancien suivi) peut être retirée ici. */
function classeHoteHTML(horsListe) {
  const dansHote = new Set(((hoteClasse && hoteClasse.eleves) || []).map(e => cleNom(e.nom)));
  const kHote = new Set(((hoteClasse && hoteClasse.groupes) || []).map(cleNom)), propres = S.groupes.filter(g => g.nom && !kHote.has(cleNom(g.nom)));   /* groupes créés ici : cochés ici */
  return `<div class="card"><div class="row"><h2 style="margin:0">Élèves de la classe</h2><span class="chip">${S.classeEleves.length}</span></div>
    <p class="hint">La liste vient de <b>Suivi PP</b> (onglet 👥 Élèves) : noms, groupes et options, arrivées et départs se modifient là-bas et arrivent ici tout seuls. Un élève qui quitte la classe garde sa ligne et ses codes ; sa colonne est hachurée après son départ.</p>
    <div class="liste lcl-hote">${S.classeEleves.map((e, i) => `<div class="lrow"><span class="num">${i + 1}</span><span class="nom">${e.nom.trim() ? esc(e.nom) : "<i>(ligne vide)</i>"}</span><span class="small muted">${[...(e.groupes || []).map(esc), e.debut ? "arrivé(e) le " + fmtDM(e.debut) : "", e.fin ? "parti(e) le " + fmtDM(e.fin) : ""].filter(Boolean).join(" · ")}</span>${propres.map(g => `<label class="grc-hote" title="${esc(e.nom)} : ${esc(g.nom)}"><input type="checkbox" data-grel="${i}" data-g="${esc(g.nom)}" ${(e.groupes || []).includes(g.nom) ? "checked" : ""} aria-label="${esc(e.nom)} : ${esc(g.nom)}"> ${esc(g.nom)}</label>`).join("")}${dansHote.has(cleNom(e.nom)) ? "" : `<span class="chip warn" title="Pas dans la classe de Suivi PP\nÉlève supprimé dans Suivi PP, ou nom repris d’un ancien suivi.\n• retirez la ligne si elle ne sert plus (ses codes sur la fiche de classe sont effacés)">pas dans Suivi PP</span><button class="ghost danger" data-del="classeEleves.${i}" title="Retirer de la liste\nSes codes sur la fiche de classe sont effacés." aria-label="Retirer la ligne ${i + 1}">✕</button>`}</div>`).join("")}</div>
    ${horsListe.length ? `<p class="hint" style="color:var(--warn)">Pas dans cette liste (ils suivent tous les cours) : ${horsListe.map(esc).join(", ")}.</p>` : ""}</div>`;
}
/** Bandeau rappelant qu'on regarde les données fictives de la démonstration. */
function bandeauDemo() {
  return S && S.demo ? `<div class="bandeau-demo no-print"><b>Démonstration : élèves et enseignants fictifs.</b>
    <button data-act="tuto" title="Tutoriel de prise en main\nGuide pas à pas sur la démonstration.">Suivre le tutoriel</button><button data-act="new">Commencer mon propre suivi</button><button data-act="open">Reprendre un suivi existant…</button></div>` : "";
}

/* ---------- sommaire du suivi collectif : frise des semaines, semaine choisie, élèves × semaines ---------- */
const SYM_ETAT = { full: "✓", part: "…", off: "–", rien: "–" };
const TITRES_ETAT = { none: "rien de saisi", part: "fiche en partie saisie", full: "fiche complète", rien: "rien à saisir (aucun cours attendu)" };
/** Semaine choisie dans le sommaire : celle de l'adresse (#sommaire/3), sinon la semaine en cours. */
const semaineSommaire = sems => { const a = Number(current.arg); return current.view === "sommaire" && current.arg !== null && current.arg !== "" && Number.isInteger(a) && sems[a] ? a : sems.indexOf(semaineCourante(sems)); };
/** Réussite du groupe sur une semaine : toutes les croix des élèves additionnées. */
function reussiteGroupe(st) { let ok = 0, tot = 0, nI = 0; for (const e of st.el) for (const o of e.obj) { ok += o.sem[0] + o.sem[1]; tot += o.sem.reduce((a, b) => a + b, 0); nI += o.sem[3]; } return { v: tot ? ok / tot : null, nI }; }
const pnSomm = (v, nI) => v === null ? `<span class="muted">—</span>` : `<span class="pn${NIV_CLASSE[niveauReussite(S, v, nI)] || ""}">${pctTxt(v)}</span>`;
function viewSommaire() {
  const sems = semaines(S);
  if (!sems.length) return `<div class="card"><h2>Sommaire du suivi collectif</h2><p>${!S.debut ? "Indiquez la date de début du suivi"
    : S.fin && S.fin < S.debut ? "La date de fin du suivi est antérieure à la date de début : corrigez-la" : "Aucune semaine de cours entre le début et la fin du suivi : vérifiez les dates et les vacances"}
    dans les <a href="#reglages/calendrier">réglages</a>.</p></div>`;
  const today = aujourdhui(), wi = semaineSommaire(sems), w = sems[wi], wCour = semaineCourante(sems);
  const stats = sems.map((_, i) => statsSemaine(S, sems, i)), grp = stats.map(reussiteGroupe);
  const etats = sems.map(x => x.jours.map(d => etatJour(S, sems, d)));
  const vacAvant = i => { if (!i) return ""; const v = S.vacances.find(v => v.debut && v.reprise && v.debut > sems[i - 1].jours.at(-1) && v.reprise <= sems[i].lundi); return v ? (v.label || "vacances") : ""; };
  // frise : une carte par semaine, les vacances entre deux
  const frise = sems.map((x, i) => `${vacAvant(i) ? `<div class="sf-vac" title="Vacances : ${esc(vacAvant(i))}">${esc(vacAvant(i))}</div>` : ""}<a class="sf-sem${i === wi ? " on" : ""}${x === wCour ? " now" : ""}" href="#sommaire/${i}" data-sem="${i}"${i === wi ? ' aria-current="true"' : ""} title="Semaine ${x.num} (${x.type}${x.forced ? ", forcée" : ""})\n${fmtLong(x.lundi)} → ${fmtLong(x.jours.at(-1))}\n• ${nbMot(etats[i].filter(e => e === "full").length, "fiche complète", "fiches complètes")} sur ${etats[i].filter(e => e !== "off").length}\n• réussite du groupe : ${grp[i].v === null ? "—" : pctTxt(grp[i].v)}${x === wCour ? "\n• semaine en cours" : ""}\nClic : choisir cette semaine">
      <span class="sf-t"><b>Semaine ${x.num}</b> <small>(${x.type}${x.forced ? "*" : ""})</small></span><small class="sf-dates">${fmtDM(x.lundi)} → ${fmtDM(x.jours.at(-1))}</small>
      <span class="sf-dots">${x.jours.map((d, k) => `<i class="${etats[i][k]}${d === today ? " today" : ""}">${etats[i][k] === "off" ? "–" : DAYS[k][0]}</i>`).join("")}</span>
      <small class="sf-grp">groupe ${pnSomm(grp[i].v, grp[i].nI)}</small></a>`).join("");
  // bandeau de la semaine choisie
  const aSaisir = w.jours.filter((d, k) => d <= today && (etats[wi][k] === "none" || etats[wi][k] === "part"));
  const bandeau = `<div class="somm-sem" role="group" aria-label="Semaine ${w.num}"><b>Semaine ${w.num} :</b>
    ${w.jours.map((d, k) => { const e = etats[wi][k]; return `<a class="somm-jour ${e}${d === today ? " today" : ""}" href="#fiche/${d}"${d === today ? ' aria-current="date"' : ""} title="${fmtLong(d).replace(/^./, c => c.toUpperCase())}\n${esc(e === "off" ? motifSansCours(S, d) : TITRES_ETAT[e] || "")}${d === today ? "\n• aujourd’hui" : ""}\nClic : ouvrir la fiche collective">${DAYS[k].slice(0, 3)}. ${fmtDM(d)} <span aria-hidden="true">${SYM_ETAT[e] || ""}</span><span class="sr"> : ${esc(e === "off" ? motifSansCours(S, d) : TITRES_ETAT[e] || "")}</span></a>`; }).join("")}
    <span class="spacer"></span><span class="somm-afaire">${aSaisir.length ? `${aSaisir.length} fiche${aSaisir.length > 1 ? "s" : ""} à saisir` : w.jours[0] > today ? "semaine à venir" : "fiches à jour ✓"}</span>
    <a class="btn" href="#totaux/${wi}" title="Totaux de la semaine ${w.num}\nRéussite par élève, par objectif et par jour.">Totaux de la semaine</a>
    <button class="primary" data-act="print-week" data-w="${wi}" title="Imprimer les fiches de la semaine ${w.num}\nUne fiche collective par jour de cours."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Fiches de la semaine ${w.num}</button></div>`;
  // élèves × semaines
  const idx = [...S.eleves.keys()].filter(s => S.eleves[s].nom.trim());
  const lignes = idx.map(s => { let prec = null; const vals = [];
    const cases = sems.map((x, i) => { const e = stats[i].el[s], v = e && e.actifSemaine ? e.pct : null, nI = e ? e.obj.reduce((a, o) => a + o.sem[3], 0) : 0;
      const ev = v !== null && prec !== null ? evolution(v, prec) : ""; const vp = prec; if (v !== null) { prec = v; vals.push(v); }
      return `<td class="${i === wi ? "on" : ""}">${!e || !e.actifSemaine ? `<small class="muted">hors suivi</small>` : `<a href="#totaux/${i}" title="${esc(S.eleves[s].nom)} · semaine ${x.num}\n• réussite : ${v === null ? "rien de saisi" : pctTxt(v)}${nI ? `\n• ${nI} « ${esc(S.codage[3].code)} »` : ""}${vp !== null && v !== null ? `\n• semaine précédente : ${pctTxt(vp)}` : ""}\nClic : totaux de la semaine">${pnSomm(v, nI)}${ev && ev !== "=" ? `<span class="fl ${/[↑↗]/.test(ev) ? "up" : "dn"}">${ev}</span>` : ""}</a>`}</td>`; }).join("");
    const t = tendanceIndiv(vals);
    return `<tr><th class="l" scope="row">${esc(S.eleves[s].nom)}</th>${cases}<td class="tend" title="Tendance\nMoyenne des 2 dernières semaines comparée aux 2 précédentes.">${t === null ? "" : `${flecheTendance(t)} ${ptsTxt(t)}`}</td></tr>`; }).join("");
  const tg = tendanceIndiv(grp.map(g => g.v));
  const tableau = idx.length ? `<div class="evol-defil somm-defil"><table class="somm-el"><thead><tr><th class="l">Réussite par élève</th>${sems.map((x, i) => `<th class="${i === wi ? "on" : ""}"><a href="#sommaire/${i}" title="Semaine ${x.num} : la choisir">S${x.num}</a></th>`).join("")}<th>Tendance</th></tr></thead>
    <tbody>${lignes}<tr class="grp"><th class="l" scope="row">Groupe</th>${grp.map((g, i) => `<td class="${i === wi ? "on" : ""}">${pnSomm(g.v, g.nI)}</td>`).join("")}<td class="tend">${tg === null ? "" : `${flecheTendance(tg)} ${ptsTxt(tg)}`}</td></tr></tbody></table></div>` : "";
  const warn = [];
  if (!idx.length) warn.push(`aucun élève dans le suivi collectif (<a href="#reglages/eleves">Réglages › Élèves du suivi collectif</a>)`);
  if (!["A", "B"].some(t => S.edt[t].some(d => d.some(c => c.mat)))) warn.push(`l’emploi du temps est vide (<a href="#edt">Emploi du temps</a>)`);
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Suivi collectif${S.classe ? " · classe " + esc(S.classe) : ""} · ${nbMot(sems.length, "semaine")} de cours</span><h1 data-titre>Sommaire du suivi collectif</h1></div>
    <div class="actions"><a class="bouton-lien" href="#bilan">Bilan par matière</a></div></div>
  ${warn.length ? `<p class="hint" style="color:var(--warn)">À faire : ${warn.join(" ; ")}.</p>` : ""}
  <div class="card somm2"><div class="somm-frise evol-defil" role="list" aria-label="Semaines du suivi">${frise}</div>
    ${bandeau}
    ${tableau}
    <p class="legend-dots"><span><i class="lg full"></i>fiche complète</span><span><i class="lg part"></i>en partie saisie</span><span><i class="lg none"></i>rien de saisi</span><span><i class="lg off"></i>pas de cours</span>
      <span>clic sur une semaine : la choisir · clic sur une pastille : les totaux de la semaine${sems.some(x => x.forced) ? " · * type de semaine forcé" : ""}</span></p></div>`;
}
// la semaine choisie reste visible dans la frise
apresRendu.push(ajusterLargeur);
apresRendu.push(() => { if (current.view !== "sommaire") return; const c = document.querySelector(".sf-sem.on"), f = document.querySelector(".somm-frise"); if (c && f) f.scrollLeft = Math.max(0, c.offsetLeft - f.offsetLeft - (f.clientWidth - c.offsetWidth) / 2);
  const t = document.querySelector(".somm-el th.on"), d = document.querySelector(".somm-defil"); if (t && d) d.scrollLeft = Math.max(0, t.offsetLeft - d.clientWidth / 2); });

/** Options de matière ; une matière absente de la liste (supprimée) reste affichée pour ne pas disparaître en silence. */
function optionsMatieres(sel) {
  const noms = S.matieres.map(m => m.nom).filter(Boolean);
  return (sel && !noms.includes(sel) ? `<option value="${esc(sel)}" selected>${esc(sel)} (hors liste)</option>` : "") +
    noms.map(n => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
}

/* ---------- fiche du jour ---------- */
let aideOuverte = true;            // mode d'emploi déplié la première fois, puis comme l'utilisateur l'a laissé
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("details.aide")) { aideOuverte = e.target.open; try { localStorage.setItem(LS_KEY + "-aide", aideOuverte ? "1" : "0"); } catch (err) { /* sans stockage */ } } }, true);
try { if (localStorage.getItem(LS_KEY + "-aide") === "0") aideOuverte = false; } catch (e) { /* sans stockage */ }
function ficheDates() { return semaines(S).flatMap(w => w.jours); }
function viewFiche(arg) {
  const dates = ficheDates();
  if (!dates.length) return viewSommaire();
  let date = arg && dates.includes(arg) ? arg : null;
  if (!date) { const today = aujourdhui(); date = dates.find(d => d >= today) || dates[0]; }
  const i = dates.indexOf(date);
  ficheDate = date;
  const sems = semaines(S), w = semaineDuJour(sems, date), wi = sems.indexOf(w);
  const opts = sems.map(x => `<optgroup label="Semaine ${x.num} (${x.type})">${x.jours.map(d => `<option value="${d}" ${d === date ? "selected" : ""}>${fmtLong(d)}</option>`).join("")}</optgroup>`).join("");
  const today = aujourdhui(), iToday = dates.indexOf(today);
  const titres = { none: "rien de saisi", part: "en partie saisie", full: "complète", rien: "rien à saisir" };
  const frise = w.jours.map((d, k) => { const e = etatJour(S, sems, d), lib = e === "off" ? motifSansCours(S, d) : titres[e] || "";
    return `<a href="#fiche/${d}" class="${e}${d === date ? " on" : ""}"${d === date ? ' aria-current="date"' : ""} title="${fmtLong(d).replace(/^./, c => c.toUpperCase())}\n${esc(lib).replace(/^./, c => c.toUpperCase())}">
      <span class="j">${DAYS[k].slice(0, 3)}</span><span class="n">${Number(d.slice(8))}</span><span class="pt" aria-hidden="true"></span><span class="sr"> : ${esc(lib)}</span></a>`; }).join("");
  const k = kpisJour(date, sems, wi);
  const titre = fmtLong(date).replace(/ \d{4}$/, "").replace(/^./, c => c.toUpperCase());
  return `<div class="page-tete no-print">
    <div class="titres"><span class="surtitre">Suivi collectif · fiche collective du jour · semaine ${w.num} (${w.type})</span><h1 data-titre>${titre}</h1></div>
    <div class="nav-jours">
      <button id="b-jour-prec" class="discret" data-go="${dates[i - 1] || ""}" ${i ? "" : "disabled"} title="Jour précédent\nRaccourci : touche ←" aria-label="Jour précédent"><svg class="ic" aria-hidden="true"><use href="#i-prec"/></svg></button>
      <div class="frise" role="group" aria-label="Jours de la semaine">${frise}</div>
      <button id="b-jour-suiv" class="discret" data-go="${dates[i + 1] || ""}" ${i < dates.length - 1 ? "" : "disabled"} title="Jour suivant\nRaccourci : touche →" aria-label="Jour suivant"><svg class="ic" aria-hidden="true"><use href="#i-suiv"/></svg></button>
    </div>
    <div class="actions">
      <span class="imprimer-groupe"><button data-act="print-day" data-date="${date}" title="Imprimer cette fiche\nRaccourci : Ctrl+P"><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button>${menuImpressionFiches(date, sems, w, wi)}</span>
      <details class="menu plus" id="m-fiche"><summary aria-label="Autres actions" title="Autres actions\n• aller à un jour\n• revenir à aujourd’hui\n• déplacer les saisies vers un autre jour\n• effacer les croix du jour">⋯</summary>
        <div class="pop">
          <label class="aller"><span>Aller au</span><select id="pick-day" aria-label="Jour affiché">${opts}</select></label>
          ${iToday >= 0 ? `<button data-go="${today}" ${iToday === i ? "disabled" : ""}>Revenir à aujourd’hui</button>` : ""}
          <button data-act="move-day" data-date="${date}" title="Saisies faites sur le mauvais jour ?\nLes croix, commentaires et absences sont déplacés vers le jour choisi.">Déplacer les saisies vers un autre jour…</button>
          <button data-act="clear-day" data-date="${date}" class="danger">Effacer les croix du jour…</button>
        </div></details>
    </div>
  </div>
  <div class="kpis no-print" id="kpis-jour">${kpisHTML(k)}</div>
  <p class="aide-saisie no-print" title="Saisie de la fiche collective\n• **clic** sur une case : met ou retire la croix\n• **au clavier** : flèches pour se déplacer ; **1** (${esc(S.codage[3].code)}) à **4** (${esc(S.codage[0].code)}) met la croix du niveau puis descend à l’objectif suivant ; **0** : non évalué\n• **Espace** : croix de la colonne choisie\n• Ctrl+Z annule"><b>Clavier :</b> 1 (${esc(S.codage[3].code)}) à 4 (${esc(S.codage[0].code)}) puis la case du dessous · 0 : non évalué · flèches : se déplacer · Espace : croix de la case</p>
  <div class="sheet papier">${ficheHTML(date, true)}</div>
  <div class="pied-fiche no-print">
    <details class="aide"${aideOuverte ? " open" : ""}><summary>Mode d’emploi</summary><ul>
      <li><b>Croix</b> : un clic dans une case met la croix, un second clic l’enlève. <b>Pour aller vite</b> : cliquez et glissez. Le glisser reste dans le créneau horaire de départ : la croix suit la case survolée (descendez en déviant à gauche ou à droite), les autres cours ne sont pas touchés. En partant d’une case déjà cochée, le glisser efface. Cela marche aussi pour les absences.</li>
      <li><b>Tout un cours d’un coup</b> : cliquez sur un code en tête de colonne (${esc(S.codage[0].code)}, ${esc(S.codage[1].code)}…) ; toute la colonne de ce cours prend ce code. Un second clic l’efface.</li>
      <li><b>Clic droit</b> sur une case : l’élève devient absent sur ce cours (ou de nouveau présent). En glissant avec le bouton droit, plusieurs élèves (ou plusieurs cours) d’un coup.</li>
      <li><b>Matière et salle</b> modifiables pour ce jour seulement (cours remplacé, sortie…) ; ✎ pour un remplaçant. Les <b>commentaires</b> (colonne de droite) ne sont pas imprimés.</li>
      <li><b>Clavier</b> : ← et → changent de jour, flèches et Espace dans la grille, Ctrl+S enregistre, Ctrl+P imprime.</li></ul></details>

  </div>`;
}
/** Indicateurs du jour : créneaux remplis, réussite du jour et de la semaine, absences. */
function kpisJour(date, sems, wi) {
  let attendus = 0, remplis = 0, ok = 0, tot = 0, nI = 0;
  for (let s = 0; s < nbBlocs(S); s++) for (const p of creneauxDu(S, date)) {
    const cr = creneau(S, sems, date, p);
    if (!creneauAttendu(S, date, s, p, cr)) continue;
    attendus++;
    let r = false;
    for (let o = 0; o < nbObj(S); o++) { const l = croix(S, date, s, o, p); if (l >= 0) { r = true; tot++; if (l < 2) ok++; if (l === 3) nI++; } }
    if (r) remplis++;
  }
  const profs = creneauxDu(S, date).flatMap(p => { const cr = creneau(S, sems, date, p), n = PERIODS[p];   /* créneau partagé : l'enseignant absent d'un des groupes */
    return cr.absent ? [`${esc(cr.prof || cr.mat)} · ${esc(cr.mat)} (${n})`] : !cr.divise ? [] : [...cr.grp.filter(g => g.absent).map(g => `${esc(g.prof || g.mat)} · ${esc(g.mat)} (${n})`), ...(cr.baseAbsent ? [`${esc(cr.baseProf || cr.baseMat)} · ${esc(cr.baseMat)} (${n})`] : [])]; });
  const eleves = S.eleves.map((e, s) => ({ e, a: absCreneaux(S, date, s) })).filter(x => x.e.nom.trim() && x.a.length && eleveActif(S, S.eleves.indexOf(x.e), date)).map(x => esc(x.e.nom));
  const prec = wi > 0 ? statsSemaine(S, sems, wi - 1) : null, cour = wi >= 0 ? statsSemaine(S, sems, wi) : null;
  const pc = v => (v == null ? "—" : Math.round(v * 100) + "\u202f%");
  return { attendus, remplis, nI, niveau: tot ? niveauReussite(S, ok / tot, nI) : "", reussite: tot ? Math.round(100 * ok / tot) + "\u202f%" : "—",
    precedente: prec ? "semaine précédente : " + pc(prec.pctGroupe) : "semaine en cours : " + pc(cour && cour.pctGroupe),
    profs: profs.length ? profs.join(", ") : "Aucun enseignant absent",
    eleves: eleves.length ? "Élève" + (eleves.length > 1 ? "s" : "") + " : " + eleves.join(", ") : "Aucun élève absent" };
}
function kpisHTML(k) {
  const cI = esc(S.codage[3].code), t = seuils(S);
  return `<div class="kpi" title="Remplissage de la fiche\nCours où au moins une croix est saisie, sur les cours attendus.\n• Cours attendu : cours prévu, enseignant présent, élève suivi et présent"><span class="lib">Remplissage de la fiche</span><span class="val">${k.remplis} <small>/ ${k.attendus} cours</small></span><span class="barre"><i style="width:${k.attendus ? Math.round(100 * k.remplis / k.attendus) : 0}%"></i></span></div>
    <div class="kpi" title="Réussite du jour\nCroix ${esc(S.codage[0].code)} ou ${esc(S.codage[1].code)} ÷ toutes les croix du jour, tous les élèves réunis.\n• rouge sous ${t.rouge} %, orange sous ${t.orange} %\n• vert clair à partir de ${t.vert} %, vert à partir de ${t.vertFonce} %, s’il n’y a aucune croix « ${cI} »${k.nI ? `\n• **${k.nI} croix « ${cI} »** aujourd’hui` : ""}"><span class="lib">Réussite du jour (${esc(S.codage[0].code)} + ${esc(S.codage[1].code)})</span><span class="val"><span class="niv ${k.niveau}">${k.reussite}</span>${k.nI ? ` <span class="kpi-i">${k.nI} croix ${esc(S.codage[3].code)}</span>` : ""}</span><span class="lib">${k.precedente}</span></div>
    <div class="kpi" title="Absences du jour\n• Enseignants absents : leurs cours n’ont pas de cases à remplir\n• Élèves absents : à indiquer sous le nom, ou d’un clic droit sur une case"><span class="lib">Absences du jour</span><span class="val texte">${k.profs}</span><span class="lib">${k.eleves}</span></div>`;
}
/** Remet à jour le bandeau de la fiche du jour sans redessiner la fiche (au plus une fois par image, même pendant un glisser). */
let kpisDemande = 0;
function majKpis() {
  if (kpisDemande || current.view !== "fiche" || !ficheDate) return;
  kpisDemande = requestAnimationFrame(() => {
    kpisDemande = 0;
    const el = $("#kpis-jour"); if (!el || !S) return;
    const sems = semaines(S), w = semaineDuJour(sems, ficheDate);
    el.innerHTML = kpisHTML(kpisJour(ficheDate, sems, sems.indexOf(w)));
    const a = document.querySelector(".frise a.on"), e = etatJour(S, sems, ficheDate);   // pastille du jour dans la frise
    if (a && !a.classList.contains(e)) { a.classList.remove("none", "part", "full", "rien", "off"); a.classList.add(e); }
  });
}
/** Initiales d'un nom (« DEL PONTE Michele » → « DM »). */
function initiales(nom) { const m = String(nom).trim().split(/\s+/).filter(Boolean); return m.length ? (m[0][0] + (m.length > 1 ? m[m.length - 1][0] : "")).toUpperCase() : ""; }
/** Réussite du jour de chaque élève, en texte court. */
function scoresJour(date, sems) {
  return S.eleves.map((e, s) => { let ok = 0, tot = 0;
    for (const p of creneauxDu(S, date)) { const cr = creneau(S, sems, date, p); if (!creneauAttendu(S, date, s, p, cr)) continue;
      for (let o = 0; o < nbObj(S); o++) { const l = croix(S, date, s, o, p); if (l >= 0) { tot++; if (l < 2) ok++; } } }
    return tot ? Math.round(100 * ok / tot) + '\u202f%<span class="large"> de réussite</span>' : "rien de saisi"; });
}
/** Commentaires ouverts à l'écran (« date.élève ») ; un commentaire déjà écrit est toujours affiché. */
const comOuverts = new Set();
/** Case de croix qui reçoit le focus au clavier (une seule à la fois : flèches pour se déplacer, Espace pour cocher). */
let caseClavier = [0, 0, 0, 0];
/** Hauteur des lignes et taille du texte à l'impression : la fiche doit tenir sur une page A4 paysage.
    Le budget (140 mm pour l'en-tête du tableau et les élèves) est réduit si la consigne ou les descriptifs prennent plus de place. */
/** Hauteur des lignes de la fiche collective imprimée (mm) ; etab : place prise par le logo de l'établissement. */
function hauteurLigneFiche(nbBlocs, serre, etab = false) {
  const lignesConsigne = Math.max(1, Math.ceil(consigneTexte(S).length / 160));
  const lignesDesc = Math.ceil(S.objectifs.reduce((a, o, i) => a + Math.max(1, Math.ceil((String(i + 1).length + o.court.length + o.desc.length + 5) / 92)), 0) / 2);
  const budget = 140 - (lignesConsigne - 1) * 4.6 - Math.max(0, lignesDesc - 3) * 4.3 - (serre ? 8 : 0) - (etab ? 5 : 0);   // en-tête sur deux lignes, logo
  const cap = nbBlocs * nbObj(S) <= 12 ? 6 : 4.6, lignes = nbObj(S) * Math.max(1, nbBlocs) + 4;
  return { rh: Math.min(cap, budget / lignes), place: budget / lignes >= cap };
}
/** Logo sur la fiche à cocher : seulement s'il y a de la place (les lignes gardent leur hauteur normale). */
const etabSurFiche = (nbBlocs, serre) => !!(S.etablissement && (S.etablissement.logo || S.etablissement.nom)) && hauteurLigneFiche(nbBlocs, serre, true).place;
function styleImpression(nbBlocs, serre, etab = false) {
  const { rh } = hauteurLigneFiche(nbBlocs, serre, etab);
  return `--rhp:${rh.toFixed(2)}mm;--fsp:${Math.min(11, 2.75 * rh).toFixed(1)}px`;
}
/** Classe de taille réduite pour un texte long dans une case étroite (impression surtout). */
const taille = (t, n1, n2) => (String(t || "").length > n2 ? " xl" : String(t || "").length > n1 ? " lg" : "");
/** Élèves imprimés sur la fiche d'un jour : pas ceux qui ne sont pas suivis ce jour-là (sauf fiche vierge sans aucun nom). */
const blocsFiche = (date, edit) => { const auMoinsUnNom = S.eleves.some(e => e.nom.trim()); return [...Array(nbBlocs(S)).keys()].filter(s => edit || !auMoinsUnNom || eleveActif(S, s, date)); };
/** Fiche collective imprimée : sur une page si les cases restent assez hautes pour cocher au stylo (3,4 mm),
    sinon sur 2 pages ou plus, élèves répartis à parts égales (en-tête et descriptif répétés). */
const LIGNE_FICHE_MIN = 3.4;
function pagesFiche(date) {
  const b = blocsFiche(date, false), serre = creneauxDu(S, date).length > 7;
  let N = 1; while (N < 4 && N < b.length && hauteurLigneFiche(Math.ceil(b.length / N), serre).rh < LIGNE_FICHE_MIN) N++;
  if (N === 1) return [ficheHTML(date, false)];
  const per = Math.ceil(b.length / N);
  return [...Array(N).keys()].map(k => b.slice(k * per, (k + 1) * per)).filter(x => x.length).map((x, k, l) => ficheHTML(date, false, { blocs: x, k: k + 1, N: l.length }));
}
function ficheHTML(date, edit, part = null) {
  const sems = semaines(S), w = semaineDuJour(sems, date), off = sansCours(S, date);
  const auMoinsUnNom = S.eleves.some(e => e.nom.trim());
  const blocs = part ? part.blocs : blocsFiche(date, edit);
  const codes = S.codage.map(c => esc(c.code));
  const ps = creneauxDu(S, date), cr = []; for (const p of ps) cr[p] = creneau(S, sems, date, p);     // créneaux du jour, dans l'ordre de la journée
  const crs = ps.map(p => cr[p]);
  const serre = ps.length > 7, kT = Math.min(1, 7 / ps.length), tl = (t, n1, n2) => taille(t, n1 * kT, n2 * kT);   // plus de 7 créneaux : textes plus petits, sur deux lignes au besoin
  const etabFiche = !edit && etabSurFiche(blocs.length, serre);
  const head = `<div class="f-head">${etabFiche ? enteteEtab(true) : ""}<div class="f-title" role="heading" aria-level="2" data-titre>Fiche de suivi collective – Journée du ${fmtLong(date)}${part ? ` (${part.k}/${part.N})` : ""}${off ? ` – <span class="off">PAS DE COURS (${esc(motifSansCours(S, date))})</span>` : ""}</div>
    <div>Classe : ${esc(S.classe)}</div></div>
    <div class="f-consigne">${esc(consigneTexte(S))}</div>
    <div class="f-line"><span>Créneaux : ${ps.map(p => PERIODS[p]).join(", ")}&nbsp;&nbsp;&nbsp;&nbsp;Codage : ${esc(legendeCodage(S))}</span><span>Semaine ${w.num} (${w.type})</span></div>
    ${edit ? `<details class="f-desc"><summary>Descriptif des objectifs observables <span>(imprimé sur la fiche ; aussi en infobulle sur chaque objectif)</span></summary>`
           : `<div class="f-desc"><b>Descriptif des objectifs observables :</b>`}<ol>${S.objectifs.map((o, i) => `<li>${i + 1}. ${esc(o.court)} : ${esc(o.desc)}</li>`).join("")}</ol>${edit ? "</details>" : "</div>"}`;
  const matOpts = (sel) => `<option value="">—</option>` + optionsMatieres(sel);
  const thPer = crs.map((c, i, _a, p = ps[i]) => `<th colspan="4" class="per g0${edit ? "" : tl(c.salle, 9, 14)}" data-colp="${p}" title="${PERIODS[p]}${horaire(p, jourIdx(date)) ? "\n" + horaire(p, jourIdx(date)) : ""}${c.mat ? "\n" + esc(c.mat) : ""}${c.prof ? "\n" + esc(c.prof) : ""}">${PERIODS[p]}${(hj => hj ? ` <small class="hcr">${hj.replace(/^0/, "").replace(":", "h")}</small>` : "")((horairesJour(S, jourIdx(date))[p] || {}).debut)}${c.salle && !edit ? " - " + esc(c.salle) : ""}${edit ? ` <input class="salle no-print" data-salle="${p}" value="${esc(c.salle)}" placeholder="salle" aria-label="Salle en ${PERIODS[p]}">` : ""}</th>`).join("");
  const thMat = crs.map((c, i, _a, p = ps[i]) => c.demi ? `<th colspan="4" class="per g0 demi${tl(c.demi, 15, 19)}" title="Pas de cours\n${esc(c.demi)}">${esc(c.demi)}</th>` : edit
    ? `<th colspan="4" class="g0"><select class="mat ${c.forced ? "forced" : ""}" data-mat="${p}" aria-label="Matière en ${PERIODS[p]}" title="${c.forced ? "Matière en " + PERIODS[p] + "\nModifiée pour ce jour.\n• Choisir « ↺ Emploi du temps » pour revenir" : "Matière en " + PERIODS[p] + "\nSelon l’emploi du temps.\n• Choisir « Autre… » pour une permanence, une sortie…"}">${c.divise ? `<option selected disabled>${esc(c.mat)}</option>` + matOpts("") : matOpts(c.mat)}<option value="__autre__">Autre (permanence, sortie…)…</option><option value="__edt__">↺ Emploi du temps</option></select></th>`
    : `<th colspan="4" class="per g0${tl(c.mat, 15, 19)}">${esc(c.mat)}</th>`).join("");
  // enseignant absent : « ABSENT » en tête, pour qu'il reste lisible même si le nom est coupé ou imprimé sans couleur
  /* créneau partagé : l'enseignant absent d'un seul groupe est signalé à côté de son nom */
  const profTxt = c => !c.divise || c.absent ? c.prof : [...new Set([...c.grp.map(g => g.prof + (g.absent ? " (absent)" : "")), ...(c.baseMat ? [c.baseProf + (c.baseAbsent ? " (absent)" : "")] : [])].filter(x => x && x !== " (absent)"))].join(" / ");
  const thProf = crs.map((c, i, _a, p = ps[i]) => `<th colspan="4" class="prof g0 ${c.absent ? "absent" : ""}${c.remplace ? " rempl" : ""}${tl((c.absent ? "ABSENT – " : "") + profTxt(c), 15, 19)}" title="${c.prof ? `Enseignant en ${PERIODS[p]}\n**${esc(profTxt(c))}**${c.remplace ? "\n• remplaçant ce jour-là" : ""}${c.absent ? "\n• absent : pas de cours" : ""}` : ""}">${c.absent ? "ABSENT – " : ""}${esc(profTxt(c))}${edit && c.mat ? `<button type="button" class="rempl-b no-print" data-rempl="${p}" title="Absent ou remplacé ?\n• enseignant absent\n• remplacé par un collègue (autre matière possible)" aria-label="Enseignant absent ou remplacé en ${PERIODS[p]}">✎</button>` : ""}</th>`).join("");
  const trAbs = edit ? `<tr class="no-print"><th colspan="2" class="lab">Enseignant absent ?</th>${crs.map((c, i, _a, p = ps[i]) => `<th colspan="4" class="g0"${c.mat ? ` data-pabsth="${p}"` : ""}>${c.mat
    ? `<label class="pabs" title="Enseignant absent\nPas de cours sur ce créneau : ses cases ne sont pas à remplir.\n• Astuce : glisser sur plusieurs cases « absent » les coche d’un coup"><input type="checkbox" data-pabs="${p}" ${c.absent ? "checked" : ""} aria-label="Enseignant absent en ${PERIODS[p]}"> absent</label>` : ""}</th>`).join("")}</tr>` : "";
  // à l'écran, un clic sur un code (TB, S…) met tout le cours dans ce code
  const thCodes = crs.map((c0, i, _a, p = ps[i]) => codes.map((c, k) => `<th class="code ${k ? "" : "g0"}" data-col="${p}.${k}">${edit && !off && c0.mat && !c0.absent
    ? `<button type="button" class="col-b" data-colx="${p}.${k}" title="Tout le cours ${PERIODS[p]} en ${c}\n• Toutes les cases « ${c} » de ce cours sont cochées, pour les élèves présents\n• Cliquer à nouveau les efface" aria-label="Mettre tout le cours ${PERIODS[p]}${c0.mat ? " " + esc(c0.mat) : ""} en ${c}">${c}</button>` : c}</th>`).join("")).join("");
  let body = "";
  for (const s of blocs) {
    const e = S.eleves[s], actif = eleveActif(S, s, date) && !off, named = !!e.nom.trim(), grS = groupesDe(S, e.nom);
    const hors = named && !eleveActif(S, s, date) ? etiquetteHors(S, s, date) : "";
    const absL = absCreneaux(S, date, s), pr = absEdit.has(date + "." + s) ? "creneaux" : absPreset(absL);
    let absSel = "";
    if (edit && named && actif) {
      absSel = `<select class="eabs no-print" data-eabs="${s}" title="Absence de l’élève ce jour-là\n• toute la journée, le matin ou l’après-midi\n• ou certains créneaux seulement\n• Astuce : clic droit sur une case de l’élève" aria-label="Absence de ${esc(e.nom)}"><option value="">présent(e)</option>` +
        Object.entries(ABS_LIBELLES).map(([k, v]) => `<option value="${k}" ${k === pr ? "selected" : ""}>${v}</option>`).join("") +
        `<option value="creneaux" ${pr === "creneaux" ? "selected" : ""}>absent(e) à certains créneaux…</option></select>`;
      if (pr === "creneaux") absSel += `<span class="abs-per no-print">${ps.map(p => PERIODS[p]).map((n, i, _a, p = ps[i]) => `<button type="button" class="${absL.includes(p) ? "on" : ""}" data-absp="${s}.${p}" aria-pressed="${absL.includes(p)}" aria-label="${esc(e.nom)} absent(e) en ${n}" title="Absent(e) en ${n}">${n}</button>`).join("")}</span>`;
    }
    const absTxt = named && actif && absL.length ? `<small class="absnote">(${absTexte(absL)})</small>` : "";
    body += `<tbody class="${s % 2 === 0 ? "shade" : ""} ${named && !eleveActif(S, s, date) ? "inactif" : ""}">`;
    for (let o = 0; o < nbObj(S); o++) {
      body += "<tr>";
      if (o === 0) body += `<th rowspan="${nbObj(S)}" class="nom${tl(e.nom.split(/\s+/).reduce((a, m) => (m.length > a.length ? m : a), ""), 11, 14)}">${s + 1}. ${esc(e.nom)}${hors ? `<small>${hors}</small>` : ""}${edit ? absSel : ""}${edit && absL.length ? "" : absTxt}</th>`;
      body += `<td class="obj${tl(S.objectifs[o].court, 27, 33)}"${edit && S.objectifs[o].desc ? ` title="Objectif ${o + 1} « ${esc(S.objectifs[o].court)} »\n${esc(S.objectifs[o].desc)}"` : ""}>${o + 1}. ${esc(S.objectifs[o].court)}</td>`;
      for (const p of ps) for (let l = 0; l < 4; l++) {
        const crS = coursPour(cr[p], grS);
        if (named && actif && cr[p].mat && !crS.mat) { body += `<td class="c hors ${l ? "" : "g0"}" title="${l ? "" : `Pas concerné(e)\n${esc(e.nom)} n’a pas ce cours (${esc(cr[p].mat)}) : autre groupe ou option.`}"></td>`; continue; }
        if (named && actif && (crS.absent || eleveAbsent(S, date, s, p))) { body += `<td class="c abs ${l ? "" : "g0"}"${edit ? ` data-abs="${s}.${p}"` : ""}></td>`; continue; }
        const v = croix(S, date, s, o, p) === l;
        const can = edit && named && actif && !!cr[p].mat;
        body += `<td class="c ${l ? "" : "g0"} ${v ? "l" + l : ""}"${can ? ` data-x="${s}.${o}.${p}.${l}" role="checkbox" aria-checked="${v}" tabindex="${s === caseClavier[0] && o === caseClavier[1] && p === caseClavier[2] && l === caseClavier[3] ? 0 : -1}" aria-label="${esc(e.nom)}, ${esc(S.objectifs[o].court)}, ${PERIODS[p]}${cr[p].mat ? " " + esc(cr[p].mat) : ""}, ${codes[l]}"` : ""}>${v ? "X" : ""}</td>`;
      }
      if (edit && o === 0) {
        const j = S.jours[date]; const com = (j && j.com[s]) || "";
        body += `<td rowspan="${nbObj(S)}" class="com no-print"><textarea data-com="${s}" placeholder="Commentaire" aria-label="Commentaire pour ${named ? esc(e.nom) : "l’élève " + (s + 1)}" ${named ? "" : "disabled"}>${esc(com)}</textarea></td>`;
      }
      body += "</tr>";
    }
    body += "</tbody>";
  }
  const aide = !edit || off ? "" : !auMoinsUnNom ? `<div class="banner-info no-print">Aucun élève pour l’instant : saisissez leurs noms dans <a href="#reglages/eleves">Réglages › Élèves du suivi collectif</a>.</div>`
    : crs.every(c => !c.mat) && crs.some(c => c.demi) ? `<div class="banner-info no-print">Pas de cours : ${esc(crs.find(c => c.demi).demi)}.</div>`
    : crs.every(c => !c.mat) ? `<div class="banner-info no-print">Aucun cours n’est prévu ce jour dans l’emploi du temps : complétez l’<a href="#edt">Emploi du temps</a>, ou choisissez la matière de chaque créneau ci-dessous.</div>` : "";
  return `${head}${off && edit ? `<div class="banner-off no-print">Jour sans cours : ${esc(motifSansCours(S, date))}. Rien à saisir.</div>` : ""}${aide}
  <table class="fiche${serre ? " serre" : ""}" style="${styleImpression(blocs.length, serre && !edit, etabFiche)}"><colgroup><col class="c-nom"><col class="c-obj">${"<col>".repeat(ps.length * 4)}${edit ? '<col class="c-com no-print">' : ""}</colgroup>
  <thead><tr><th colspan="2" class="lab">Heure – Salle</th>${thPer}${edit ? '<th class="no-print" rowspan="5">Commentaires</th>' : ""}</tr>
  <tr><th colspan="2" class="lab">Matière</th>${thMat}</tr>
  <tr><th colspan="2" class="lab">Enseignant</th>${thProf}</tr>${trAbs}
  <tr><th class="lab">Élève</th><th class="lab">Objectif \\ Codage</th>${thCodes}</tr></thead>${body}</table>`;
}

/** Déplace toutes les saisies d'un jour (croix, commentaires, absences, cours modifiés) vers un autre jour du suivi. */
async function deplacerJour(date) {
  const j = S.jours[date];
  if (!j || !Object.values(j).some(m => Object.keys(m || {}).length)) { informer("Rien à déplacer", "Aucune saisie ce jour-là."); return; }
  const sems = semaines(S), voisin = ficheDates().filter(d => d !== date && !sansCours(S, d)).find(d => d > date);
  const options = sems.map(w => { const js = w.jours.filter(d => d !== date && !sansCours(S, d));
    return js.length ? `<optgroup label="Semaine ${w.num} (${w.type})">${js.map(d => `<option value="${d}" ${d === voisin ? "selected" : ""}>${fmtLong(d)}${Object.values(S.jours[d] || {}).some(x => Object.keys(x || {}).length) ? " (déjà des saisies)" : ""}</option>`).join("")}</optgroup>` : ""; }).join("");
  if (!options) { informer("Rien à faire", "Aucun autre jour de cours dans le suivi."); return; }
  const cible = await saisir("Déplacer les saisies", `Les croix, commentaires et absences du ${fmtLong(date)} ont été faits sur le mauvais jour ? Choisissez le bon jour :`,
    { options, libelle: "Jour où déplacer les saisies" }, { ok: "Déplacer" });
  if (!cible) return;
  const c = S.jours[cible];
  if (c && Object.values(c).some(x => Object.keys(x || {}).length) && !(await demander("Remplacer les saisies ?", `Le ${fmtLong(cible)} contient déjà des saisies. Les remplacer par celles du ${fmtLong(date)} ?`, { ok: "Remplacer", danger: true }))) return;
  S.jours[cible] = j; delete S.jours[date];
  commit(false); toast(`Saisies déplacées vers le ${fmtLong(cible)}. Ctrl+Z pour annuler.`, 5000);
  location.hash = "#fiche/" + cible;
}

/* ---------- totaux ---------- */
/** Semaine des totaux : celle demandée, sinon la semaine en cours. */
function indexTotaux(sems, arg) {
  if (arg != null && arg !== "" && !isNaN(arg)) return Math.min(Math.max(0, Number(arg)), sems.length - 1);
  return Math.max(0, sems.indexOf(semaineCourante(sems)));
}
function viewTotaux(arg) {
  const sems = semaines(S);
  if (!sems.length) return viewSommaire();
  const wi = indexTotaux(sems, arg);
  const opts = sems.map((w, i) => `<option value="${i}" ${i === wi ? "selected" : ""}>Semaine ${w.num} (${w.type}) – du ${fmtDM(w.lundi)}</option>`).join("");
  const ws = sems[wi];
  return `<div class="page-tete no-print"><div class="titres"><span class="surtitre">Suivi collectif · totaux de la semaine · ${ws.type === "A" ? "semaine A" : "semaine B"}</span><h1 data-titre>Semaine ${ws.num} · du ${fmtDM(ws.lundi)} au ${fmtDM(ws.jours.at(-1))}</h1></div>
    <div class="nav-jours"><button id="b-sem-prec" data-gotot="${wi - 1}" ${wi ? "" : "disabled"} title="Semaine précédente (touche ←)" aria-label="Semaine précédente"><svg class="ic" aria-hidden="true"><use href="#i-prec"/></svg></button>
    <select id="pick-week" title="Choisir la semaine" aria-label="Semaine affichée" style="height:36px">${opts}</select><button id="b-sem-suiv" data-gotot="${wi + 1}" ${wi < sems.length - 1 ? "" : "disabled"} title="Semaine suivante (touche →)" aria-label="Semaine suivante"><svg class="ic" aria-hidden="true"><use href="#i-suiv"/></svg></button></div>
    <div class="actions">${menuSeuils()}${caseVertes()}<button class="primary" data-act="print-tot" data-w="${wi}" title="Imprimer les totaux de la semaine (Ctrl+P)"><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div></div>
    ${S.eleves.some(e => e.nom.trim()) ? "" : `<div class="banner-info no-print">Aucun élève dans le suivi collectif : ajoutez-les dans <a href="#reglages/eleves">Réglages › Élèves du suivi collectif</a>.</div>`}
    <div class="sheet">${totauxHTML(wi)}</div>`;
}
const EVOL_TEXTE = { "↑": "nette hausse (au moins 10 points de plus)", "↗": "légère hausse (5 à 9 points de plus)", "=": "stable (moins de 5 points d’écart)",
  "↘": "légère baisse (5 à 9 points de moins)", "↓": "nette baisse (au moins 10 points de moins)" };
const EVOL_CLASSE = { "↑": "up", "↗": "up up2", "↓": "down", "↘": "down down2" };
/** Totaux et bilan : pastille orange ou rouge sous 50 % ; « pastilles vertes » ajoute le vert clair et le vert foncé (seuils réglables,
    jamais s'il y a une croix « I ») — réglage propre à ce navigateur, suivi à l'impression. Le nombre de croix « I » est toujours signalé. */
const NIV_CLASSE = { v: " bon", vf: " bon fonce", o: " p2", r: " p3" };
/** Pastille d'une réussite du suivi collectif (fiche élève, conseil) : mêmes règles que les totaux (pas de vert avec une croix « I », vert seulement si « pastilles vertes aussi »). */
const pnColl = (v, nI) => { const n = niveauReussite(S, v, nI); return (n === "v" || n === "vf") && !S.pastillesVertes ? "" : NIV_CLASSE[n] || ""; };
// au moins une croix « I » : coin rouge en haut à droite de la case (le nombre est dans l'infobulle)
const coinI = n => (n ? " aI" : "");
const caseVertes = () => `<label class="verts" title="Pastilles vertes aussi\n• vert clair : réussite de ${seuils(S).vert} % et plus\n• vert : ${seuils(S).vertFonce} % et plus\n• jamais s’il y a une croix « ${esc(S.codage[3].code)} »\nSeuils réglables (bouton « Seuils »). Vaut pour les totaux et le bilan ; l’impression suit."><input type="checkbox" id="tot-verts" ${S.pastillesVertes ? "checked" : ""}> Pastilles vertes aussi</label>`;
/** Les quatre seuils des pastilles, modifiables (Réglages, et menu « Seuils » des totaux et du bilan). */
function champsSeuils(id) {
  const t = seuils(S), cI = esc(S.codage[3].code);
  const aide = { rouge: "Pastille rouge\nRéussite en dessous de ce seuil.", orange: "Pastille orange\nRéussite en dessous de ce seuil (et au moins le seuil rouge).",
    vert: `Pastille vert clair\nRéussite à partir de ce seuil.\n• jamais s’il y a une croix « ${cI} »`, vertFonce: `Pastille vert (foncé)\nRéussite à partir de ce seuil.\n• jamais s’il y a une croix « ${cI} »` };
  const champ = (cle, lib) => `<label title="${aide[cle]}">${lib} <input type="number" min="0" max="100" step="1" data-num="seuils.${cle}" id="${id}-${cle}" value="${t[cle]}" aria-label="Seuil ${{ rouge: "rouge", orange: "orange", vert: "vert clair", vertFonce: "vert" }[cle]} en %"> %</label>`;
  return `<div class="seuils-grille">
    <i class="pa p3">rouge</i>${champ("rouge", "en dessous de")}
    <i class="pa p2">orange</i>${champ("orange", "en dessous de")}
    <i class="pa bon">vert clair</i>${champ("vert", "à partir de")}
    <i class="pa bon fonce">vert</i>${champ("vertFonce", "à partir de")}</div>
    <p class="hint">Réussite = part des croix ${esc(S.codage[0].code)} et ${esc(S.codage[1].code)}. ${t.vert > t.orange ? `Entre ${t.orange} et ${t.vert - 1} % : pas de pastille.` : ""} Jamais de vert s’il y a au moins une croix « ${cI} ». Le vert ne s’affiche que si « Pastilles vertes aussi » est coché.</p>`;
}
let seuilsOuvert = false;           // menu « Seuils » des totaux et du bilan resté ouvert pendant qu'on règle
document.addEventListener("toggle", e => { if (e.target.id === "m-seuils") seuilsOuvert = e.target.open; }, true);
const menuSeuils = () => `<details class="menu plus seuils-menu" id="m-seuils"${seuilsOuvert ? " open" : ""}><summary title="Seuils des pastilles\n• rouge, orange, vert clair, vert\n• le vert ne s’affiche que si « Pastilles vertes aussi » est coché">Seuils</summary>
  <div class="pop"><b>Seuils des pastilles</b>${champsSeuils("ms")}</div></details>`;
function legendePastilles() {
  const t = seuils(S), cI = esc(S.codage[3].code);
  return `Pastilles : <i class="pa p3">rouge</i> (cadre plein) moins de ${t.rouge} %, <i class="pa p2">orange</i> (pointillé) de ${t.rouge} à ${t.orange - 1} %${S.pastillesVertes ? `, <i class="pa bon">vert clair</i> ${t.vert} % et plus, <i class="pa bon fonce">vert</i> ${t.vertFonce} % et plus (sans aucune croix ${cI})` : ""}. <i class="coin-leg" aria-hidden="true"></i> Coin rouge : au moins une croix « ${cI} » (jamais de vert dans ce cas ; nombre dans l’infobulle).`;
}
// « pastilles vertes aussi » : enregistré avec le suivi (S.pastillesVertes), car il change aussi l'impression
/** part : [premier, après le dernier] des élèves imprimés sur cette page (plus de 8 élèves : deux pages équilibrées). */
function totauxHTML(wi, part = null) {
  const sems = semaines(S), T = statsSemaine(S, sems, wi), P = wi ? statsSemaine(S, sems, wi - 1) : null, w = T.w;
  const codes = S.codage.map(c => esc(c.code)), sens = S.codage.map(c => esc(c.sens));
  const reussis = `${codes[0]} ou ${codes[1]}`, wp = P ? P.w : null;
  const objNomO = o => `objectif ${o + 1} « ${esc(S.objectifs[o].court)} »`;
  const nbX = n => n + (n > 1 ? " croix" : " croix");
  const head = `<div class="f-head"><div class="f-title" role="heading" aria-level="2" data-titre>Suivi collectif – Totaux de la semaine ${w.num} (${w.type}) – du ${fmtLong(w.lundi)} au ${fmtLong(w.jours.at(-1))}${part ? ` (${part[2] || (part[0] ? 2 : 1)}/${part[3] || 2})` : ""}</div><div>Classe : ${esc(S.classe)}</div></div>
    <div class="f-line"><span>Réussite = part des croix « ${codes[0]} » et « ${codes[1]} ». Codage : ${esc(legendeCodage(S))}</span></div>
    <div class="f-line legende-past"><span>${legendePastilles()} Évol. : ↑ +10 points ou plus, <span class="fl">↑</span> +5 à +9, = moins de 5, <span class="fl bas">↓</span> −5 à −9, ↓ −10 ou moins.<span class="no-print"> Survolez un titre ou une case pour savoir ce qu’elle contient.</span></span></div>`;
  // une case de pourcentage : n = [nb TB, nb S, nb À, nb I]
  const pc = (v, n, qui, quand, sep) => {
    const tot = n ? n.reduce((a, b) => a + b, 0) : 0;
    const nI = n ? n[3] : 0;
    const Quand = quand.charAt(0).toUpperCase() + quand.slice(1);
    const t = tot ? `${qui}\n${Quand}\n• ${nbX(n[0] + n[1])} ${reussis} sur ${nbX(tot)}\n• Réussite : **${pctTxt(v)}**${nI ? `\n• ${nbX(nI)} « ${codes[3]} » (${sens[3]}) : pas de pastille verte` : ""}` : `${qui}\n${Quand} : aucune croix saisie`;
    return `<td class="pc ${sep ? "sep " : ""}${NIV_CLASSE[niveauReussite(S, v, nI)] || ""}${coinI(nI)}"${v == null ? "" : ` style="--v:${pctArrondi(v)}%"`} title="${t}"><span>${pctTxt(v)}</span></td>`;
  };
  // ligne « Total » (o = -1) : tous les objectifs additionnés (inutile avec un seul objectif)
  const avecTotal = nbObj(S) > 1 ? 1 : 0;
  const somme = obs => { const taux = n => { const t = n.reduce((a, b) => a + b, 0); return t ? (n[0] + n[1]) / t : null; };
    const jours = w.jours.map((_, d) => [0, 1, 2, 3].map(l => obs.reduce((a, ob) => a + ob.jours[d][l], 0)));
    const sem = [0, 1, 2, 3].map(l => obs.reduce((a, ob) => a + ob.sem[l], 0));
    return { jours, sem, pctJours: jours.map(taux), pct: taux(sem) }; };
  const row = (ob, prev, o, first, label, qui) => {
    const total = o < 0, objNom = o => total ? "tous objectifs" : objNomO(o);
    let h = `<tr class="${total ? "tot-el" : ""}">`;
    if (first) h += label;
    h += total ? `<td class="ob" title="Total\nLes ${nbObj(S)} objectifs additionnés">Total</td>`
      : `<td class="ob" title="${objNom(o).replace(/^o/, "O")}${S.objectifs[o].desc ? "\n" + esc(S.objectifs[o].desc) : ""}">${o + 1}.</td>`;
    h += ob.pctJours.map((v, d) => sansCours(S, w.jours[d]) ? `<td class="sep" title="${DAYS[d]} ${fmtDM(w.jours[d])}\nPas de cours : ${esc(motifSansCours(S, w.jours[d]))}">–</td>`
      : pc(v, ob.jours[d], `${qui} — ${objNom(o)}`, `${DAYS[d].toLowerCase()} ${fmtDM(w.jours[d])}`, true)).join("");
    h += ob.sem.map((n, l) => `<td class="n l${l} ${l ? "" : "sep"} ${n ? "p" + l : ""}${n > 99 ? " n3" : ""}" title="${qui} — ${objNom(o)}\nSemaine ${w.num} : **${nbX(n)} « ${codes[l]} »** (${sens[l]})">${n || ""}</td>`).join("");
    const ev = evolution(ob.pct, prev && prev.pct), a = pctArrondi(ob.pct), b = prev ? pctArrondi(prev.pct) : null;
    h += pc(ob.pct, ob.sem, `${qui} — ${objNom(o)}`, `toute la semaine ${w.num}`, true);
    h += prev ? pc(prev.pct, prev.sem, `${qui} — ${objNom(o)}`, `semaine précédente (${wp.num})`, false) : `<td class="pc" title="Pas de semaine précédente"></td>`;
    const tEv = !ev ? `${qui} — ${objNom(o)}\nPas de comparaison : une des deux semaines n’a pas de croix` : `${qui} — ${objNom(o)}\n• Semaine ${wp.num} : ${b} %\n• Semaine ${w.num} : ${a} %\n• Écart : **${a - b > 0 ? "+" : a - b < 0 ? "−" : ""}${nbMot(Math.abs(a - b), "point")}**, ${EVOL_TEXTE[ev]}`;
    // ↗ et ↘ : flèche droite tournée de 45°, pour qu'elle ait la même taille que ↑ et ↓ quelle que soit la police
    h += `<td class="ev ${EVOL_CLASSE[ev] || ""}" title="${tEv}">${ev === "↗" || ev === "↘" ? `<span class="fl" aria-label="${ev}">${ev === "↗" ? "↑" : "↓"}</span>` : ev}</td>`;
    return h;
  };
  // réussite de la semaine sous le nom : même pastille que les cases, et le nombre de croix « I »
  const pastNom = (v, nI) => v == null ? "—" : `<span class="pn${NIV_CLASSE[niveauReussite(S, v, nI)] || ""}">${pctTxt(v)}</span>${nI ? ` <span class="nI">· ${nI} ${codes[3]}</span>` : ""}`;
  let body = "";
  let rangEl = 0;
  T.el.forEach((e, s) => {
    if (part && (s < part[0] || s >= part[1])) return;
    const el = S.eleves[s], named = !!el.nom.trim(), nIel = nbIde(e.obj);
    const sub = !named ? "" : !e.actifSemaine ? "(hors suivi cette semaine)"
      : `Réussite : ${pastNom(e.pct, nIel)}<br>Fiche : ${e.remplis}/${e.attendus} créneaux${e.absences ? `<br>Absences : ${e.absences} créneau${e.absences > 1 ? "x" : ""}` : ""}`;
    const tNom = !named ? "" : !e.actifSemaine ? `${esc(el.nom)}\nPas suivi(e) cette semaine (dates de début ou de fin du suivi)`
      : `${esc(el.nom)}\n• Réussite de la semaine : **${e.pct == null ? "aucune croix" : pctTxt(e.pct)}**${e.pct == null ? "" : ` (croix ${reussis} ÷ toutes ses croix)`}${nIel ? `\n• ${nbX(nIel)} « ${codes[3]} » (${sens[3]}) : pas de pastille verte` : ""}\n• Fiche remplie : ${nbMot(e.remplis, "créneau", "créneaux")} sur ${e.attendus}${e.absences ? `\n• Absences : ${e.absences} créneau${e.absences > 1 ? "x" : ""} de cours manqué${e.absences > 1 ? "s" : ""}` : ""}`;
    body += `<tbody class="${rangEl++ % 2 ? "imp" : ""}${named && !e.actifSemaine ? " inactif" : ""}">`;   // un élève sur deux grisé
    const qui = esc(el.nom) || `Élève ${s + 1}`;
    e.obj.forEach((ob, o) => {
      const label = `<th rowspan="${nbObj(S) + avecTotal}" class="nom" title="${tNom}">${s + 1}. ${esc(el.nom)}<small>${sub}</small></th>`;
      body += row(ob, P && P.el[s] ? P.el[s].obj[o] : null, o, o === 0, label, qui);
      if (o === 0) body += `<td rowspan="${nbObj(S) + avecTotal}" class="com sep"${e.commentaires.length ? ` title="Commentaires écrits sur les fiches collectives de la semaine"` : ""}>${esc(e.commentaires.join("\n"))}</td>`;
      body += "</tr>";
    });
    if (avecTotal) body += row(somme(e.obj), P && P.el[s] ? somme(P.el[s].obj) : null, -1, false, "", qui) + "</tr>";
    body += "</tbody>";
  });
  const avecGrp = !part || part[1] >= T.el.length;          // la ligne « Groupe » à la fin de la dernière page
  if (avecGrp) body += `<tbody class="grp">`;
  if (avecGrp) T.grp.forEach((g, o) => {
    body += row(g, P ? P.grp[o] : null, o, o === 0, `<th rowspan="${nbObj(S) + avecTotal}" class="nom" title="Groupe\nToutes les croix de tous les élèves additionnées.\n• Réussite du groupe : **${T.pctGroupe == null ? "aucune croix" : pctTxt(T.pctGroupe)}**${nbIde(T.grp) ? `\n• ${nbX(nbIde(T.grp))} « ${codes[3]} » dans la semaine` : ""}">Groupe<small>Réussite : ${pastNom(T.pctGroupe, nbIde(T.grp))}</small></th>`, "Groupe");
    if (o === 0) body += `<td rowspan="${nbObj(S) + avecTotal}" class="com sep"></td>`;
    body += "</tr>";
  });
  if (avecGrp && avecTotal) body += row(somme(T.grp), P ? somme(P.grp) : null, -1, false, "", "Groupe") + "</tr>";
  if (avecGrp) body += "</tbody>";
  const tJour = (d, date) => `${DAYS[d]} ${fmtDM(date)}\nPour chaque objectif, part des croix ${reussis} parmi toutes les croix de la journée (tous les cours additionnés).\n• Case vide : rien de saisi\n• « – » : pas de cours`;
  const tCode = l => `Croix « ${codes[l]} » (${sens[l]})\nNombre de croix de la semaine pour cet objectif, tous les jours et tous les cours additionnés.\n• Ligne « Total » : tous les objectifs réunis`;
  // impression : environ 158 mm de hauteur pour les lignes du tableau sur une page A4 paysage
  const lignes = ((part ? part[1] - part[0] : T.el.length) + (avecGrp ? 1 : 0)) * (nbObj(S) + avecTotal), rh = Math.max(3.4, Math.min(5, 158 / lignes));
  return `${head}<table class="tot${S.pastillesVertes ? " verts" : ""}" style="--rht:${rh.toFixed(2)}mm;--fst:${Math.min(11, rh * 2.35).toFixed(1)}px"><colgroup><col class="c-nom"><col class="c-obj">${'<col class="c-day">'.repeat(nbJours(S))}${'<col class="c-n">'.repeat(4)}<col class="c-p"><col class="c-p"><col class="c-ev"><col class="c-com"></colgroup>
  <thead><tr><th rowspan="2" title="Élève\nSous le nom :\n• sa réussite de la semaine, tous objectifs réunis\n• les croix « ${codes[3]} » de la semaine\n• le remplissage de sa fiche (créneaux remplis / attendus)\n• ses absences">Élève</th><th rowspan="2" title="Objectifs observables\n${S.objectifs.map((ob, i) => `• ${i + 1}. ${esc(ob.court)}`).join("\n")}\n• Total : tous les objectifs additionnés">Obj.</th>${w.jours.map((date, d) => `<th class="sep" title="${tJour(d, date)}"><span class="jl">${DAYS[d]}</span><span class="jc">${DAYS[d].slice(0, 3)}.</span><br><small>${fmtDM(date)}</small></th>`).join("")}
  <th colspan="4" class="sep" title="Semaine\nNombre de croix de chaque code sur toute la semaine, pour chaque objectif.">Semaine</th><th colspan="3" class="sep" title="Synthèse\n• % sem. : réussite de la semaine\n• Préc. : réussite de la semaine précédente\n• Évol. : évolution entre les deux">Synthèse</th><th rowspan="2" class="sep" title="Commentaires\nÉcrits sur les fiches collectives de la semaine, précédés du jour.">Commentaires (jour : texte)</th></tr>
  <tr>${w.jours.map((date, d) => `<th class="sep" title="${tJour(d, date)}">% ${codes[0]}+${codes[1]}</th>`).join("")}${codes.map((c, l) => `<th class="${l ? "" : "sep"}" title="${tCode(l)}">${c}</th>`).join("")}
  <th class="sep" title="Réussite de la semaine\nPour cet objectif : croix ${reussis} ÷ toutes les croix de la semaine (tous les jours, tous les cours).">% sem.</th><th title="${wp ? `Semaine précédente\nMême calcul pour la semaine ${wp.num}.` : "Semaine précédente\nAucune : c’est la première semaine du suivi."}">Préc.</th><th title="Évolution par rapport à la semaine précédente\nSur les pourcentages affichés :\n• ↑ au moins 10 points de plus\n• ↗ de 5 à 9 points de plus\n• = moins de 5 points d’écart\n• ↘ de 5 à 9 points de moins\n• ↓ au moins 10 points de moins\nVide si une des deux semaines n’a pas de croix.">Évol.</th></tr></thead>${body}</table>`;
}

/* ---------- bilan ---------- */
const bilanPin = new Set();        // matières dont la ligne reste surlignée (clic)
document.addEventListener("click", e => {
  const tr = e.target.closest && e.target.closest("table.bil tbody tr[data-pin]");
  if (!tr) return;
  const m = tr.dataset.pin;
  if (bilanPin.has(m)) bilanPin.delete(m); else bilanPin.add(m);
  tr.classList.toggle("pin", bilanPin.has(m)); tr.querySelector(".pin-b").setAttribute("aria-pressed", bilanPin.has(m));
});
let periodeBilan = null;            // [première, dernière semaine] du bilan ; null = tout le suivi
function bornesBilan(sems) {
  const n = sems.length - 1, [a, b] = periodeBilan || [0, n];
  return [Math.min(Math.max(0, a), n), Math.min(Math.max(0, b), n)].sort((x, y) => x - y);
}
/** Périodes toutes prêtes du bilan, comptées jusqu'à la semaine en cours (la dernière commencée). */
function periodesBilan(sems) {
  const today = aujourdhui();
  let fin = -1; sems.forEach((w, i) => { if (w.lundi <= today) fin = i; });
  if (fin < 0) fin = sems.length - 1;                     // suivi pas encore commencé : jusqu'à la fin
  const liste = [];
  const dern = n => [Math.max(0, fin - n + 1), fin];
  const enCours = today >= sems[fin].lundi && today <= addDays(sems[fin].lundi, 6);
  liste.push([enCours ? "Semaine en cours" : "Dernière semaine", dern(1)]);
  if (fin >= 1) liste.push([enCours ? "Semaine précédente" : "Avant-dernière semaine", [fin - 1, fin - 1]]);
  for (const n of [2, 4, 8]) if (fin >= n - 1) liste.push([`${n} dernières semaines`, dern(n)]);
  // depuis les dernières vacances (les semaines qui suivent la dernière reprise passée)
  const reprises = S.vacances.map(v => v.reprise).filter(r => r && r <= today).sort();
  if (reprises.length) {
    const r = reprises[reprises.length - 1], debut = sems.findIndex(w => w.lundi >= r);
    if (debut > 0 && debut <= fin) liste.push(["Depuis les dernières vacances", [debut, fin]]);
  }
  liste.push(...periodesDecoupage(S, sems, today).filter(([, [x, y]]) => x > 0 || y < sems.length - 1));      // trimestres ou semestres (Réglages › Période et calendrier) ; pas un doublon de « Tout le suivi »
  liste.push(["Tout le suivi", [0, sems.length - 1]]);
  const prio = l => (l === "Tout le suivi" || l === "Semaine en cours" || l === "Dernière semaine" ? 1 : 0);   /* doublon : « Tout le suivi » et « Semaine en cours » restent, sinon le dernier */
  return liste.filter(([l, r], i) => !liste.some(([l2, r2], k) => k !== i && r2[0] === r[0] && r2[1] === r[1] && (prio(l2) > prio(l) || (prio(l2) === prio(l) && k > i))));   /* deux boutons pour les mêmes semaines : on garde le dernier (« Tout le suivi », la période nommée) */
}
function viewBilan() {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  const [a, b] = bornesBilan(sems);
  const opts = sel => sems.map((w, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>S${w.num} (${fmtDM(w.lundi)})</option>`).join("");
  const presets = periodesBilan(sems);
  return `<div class="page-tete no-print"><div class="titres"><span class="surtitre">Suivi collectif · ${a === b ? "semaine " + sems[a].num : "semaines " + sems[a].num + " à " + sems[b].num} · du ${fmtDM(sems[a].lundi)} au ${fmtDM(sems[b].jours.at(-1))}</span><h1 data-titre>Bilan par matière</h1></div></div>
  ${sems.length > 1 ? `<div class="periodes no-print" role="group" aria-label="Période du bilan"><b>Période :</b>${presets.map(([lib, [x, y]]) =>
      `<button data-act="bil-per" data-de="${x}" data-a="${y}" aria-pressed="${x === a && y === b}" class="${x === a && y === b ? "on" : ""}">${lib}</button>`).join("")}
    <span class="ou">ou de</span><select id="bil-de" aria-label="Première semaine du bilan">${opts(a)}</select>
    <span class="ou">à</span><select id="bil-a" aria-label="Dernière semaine du bilan">${opts(b)}</select><span class="spacer"></span>` : `<div class="sheet-tools no-print"><span class="spacer"></span>`}${menuSeuils()}${caseVertes()}<button class="primary" data-act="print-bilan" title="Imprimer le bilan (Ctrl+P)"><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg> Imprimer</button></div><div class="sheet scroll">${bilanHTML()}</div>`;
}
function bilanHTML() {
  if (!semaines(S).length) return "";
  const toutes = semaines(S), [a, b] = bornesBilan(toutes), sems = toutes.slice(a, b + 1);
  const rows = bilan(S, sems), nb = nbBlocs(S), codes = S.codage.map(c => esc(c.code));
  const idx = [...Array(nb).keys()].filter(s => S.eleves[s].nom.trim());
  // chaque groupe de 3 colonnes (un élève) commence par un trait épais (classe g) ; les % d'alerte sont des pastilles,
  // pour que le fond de la case suive le grisé d'une ligne sur deux
  // vert (si « pastilles vertes ») : réussite au-dessus des seuils et sans aucune croix I
  const sens = S.codage.map(c => esc(c.sens)), periode = sems.length === 1 ? `semaine ${sems[0].num}` : `semaines ${sems[0].num} à ${sems[sems.length - 1].num}`, Periode = periode.charAt(0).toUpperCase() + periode.slice(1);
  const nbX = n => n + " croix";
  // qui : « Français, DEL PONTE Michele » (l'infobulle de chaque case dit de quoi elle parle)
  // un seul indicateur partout : la réussite (part des croix ${codes[0]} + ${codes[1]}), colorée comme dans les totaux
  const cell = (obs, neg, nI, qui) => { if (!obs) { const t = `title="${qui}\n${Periode} : aucune croix (pas de cours ou rien de saisi)"`; return `<td class="g" ${t}></td><td ${t}></td><td ${t}></td>`; }
    const ok = obs - neg, r = pctArrondi(ok / obs), niv = niveauReussite(S, ok / obs, nI);
    const cl = niv === "r" ? "alert" : niv === "o" ? "warn" : "", vert = S.pastillesVertes && (niv === "v" || niv === "vf") ? NIV_CLASSE[niv].trim() : "";
    const tPc = `${qui}\n${Periode}\n• Réussite : **${r} %** — ${nbX(ok)} ${codes[0]} ou ${codes[1]} sur ${nbX(obs)}${cl ? `\n• ${cl === "alert" ? "Rouge" : "Orange"} : sous ${cl === "alert" ? seuils(S).rouge : seuils(S).orange} %` : ""}${nI ? `\n• ${nbX(nI)} « ${codes[3]} » (${sens[3]}) : pas de vert` : ""}${peuDe(obs, "croix")}`;
    return `<td class="g" title="${qui}\n${Periode}\n• **${nbX(obs)}** en tout (une par objectif et par cours)${peuDe(obs, "croix")}">${obs}</td><td title="${qui}\n${Periode}\n• **${nbX(ok)}** « ${sens[0]} » ou « ${sens[1]} » (${codes[0]}, ${codes[1]})\n• les autres : ${neg} (${codes[2]} : ${neg - nI}, ${codes[3]} : ${nI})">${ok}</td><td class="pcb ${cl || vert}${coinI(nI)}" title="${tPc}">${cl || vert ? `<span class="pa">${cl === "alert" ? "▼ " : ""}${r}\u202f%</span>` : r + "\u202f%"}</td>`; };
  const tot = idx.map(() => ({ obs: 0, neg: 0, i: 0 })); let gO = 0, gN = 0, gI = 0;
  const body = rows.map(r => { let o = 0, n = 0, ni = 0;
    const cells = idx.map((s, k) => { const c = r.el[s]; o += c.obs; n += c.neg; ni += c.i; tot[k].obs += c.obs; tot[k].neg += c.neg; tot[k].i += c.i; return cell(c.obs, c.neg, c.i, `${esc(r.mat)} — ${esc(S.eleves[s].nom)}`); }).join("");
    gO += o; gN += n; gI += ni;
    return `<tr data-pin="${esc(r.mat)}" class="${bilanPin.has(r.mat) ? "pin" : ""}"><td class="l" title="${esc(r.mat)}${r.prof ? " — " + esc(r.prof) : ""}\n• Cliquez pour garder cette ligne surlignée et la suivre sur toute la largeur du tableau\n• Cliquez à nouveau pour l’enlever"><button type="button" class="pin-b" aria-pressed="${bilanPin.has(r.mat)}">${esc(r.mat)}</button>${r.prof ? `<small class="prof">${esc(r.prof)}</small>` : ""}</td>${cell(o, n, ni, `${esc(r.mat)} — tous les élèves`)}${cells}</tr>`; }).join("");
  return `<div class="f-head"><div class="f-title" role="heading" aria-level="2" data-titre style="text-align:left"><b>Suivi collectif – Bilan par matière – ${sems.length === 1 ? `semaine ${sems[0].num} (du ${fmtDM(sems[0].lundi)} au ${fmtDM(sems[0].jours.at(-1))})` : `semaines ${sems[0].num} à ${sems[sems.length - 1].num} (du ${fmtDM(sems[0].lundi)} au ${fmtDM(sems[sems.length - 1].jours.at(-1))}, ${sems.length} semaines de cours)`}${S.classe ? " – Classe " + esc(S.classe) : ""}</b></div></div>
  <p class="hint" style="font-family:var(--serif)">Nombre de croix, dont « ${esc(S.codage[0].sens)} » + « ${esc(S.codage[1].sens)} » (${codes[0]} + ${codes[1]}), et la <b>réussite</b> : leur part, comme dans les totaux. Orange (cadre pointillé) : réussite sous ${seuils(S).orange} %, rouge (cadre plein) et ▼ : sous ${seuils(S).rouge} %${S.pastillesVertes ? `. Vert clair : ${seuils(S).vert} % et plus, vert : ${seuils(S).vertFonce} % et plus, sans aucune croix ${codes[3]}` : ""} (voir « Seuils »). <i class="coin-leg" aria-hidden="true"></i> Coin rouge : au moins une croix ${codes[3]} (jamais de vert dans ce cas ; nombre dans l’infobulle).<span class="no-print"> Survolez un titre ou une case pour savoir ce qu’elle contient. Cliquez sur une matière pour garder sa ligne surlignée et la suivre sur toute la largeur du tableau.</span></p>
  <table class="bil${S.pastillesVertes ? " verts" : ""}"><thead><tr><th rowspan="2" title="Matière et enseignant\nSelon l’emploi du temps et les fiches collectives.\n• Cliquez sur une matière pour garder sa ligne surlignée">Matière<br><small>enseignant</small></th><th colspan="3" class="g" title="Tous les élèves\nLeurs croix additionnées, matière par matière (${periode}).">Tous les élèves</th>${idx.map(s => `<th colspan="3" class="g" title="${esc(S.eleves[s].nom)}\nSes croix, matière par matière (${periode}).">${esc(S.eleves[s].nom)}</th>`).join("")}</tr>
  <tr>${[...Array(idx.length + 1)].map(() => `<th class="g" title="Observations\nNombre de croix sur la période : une par objectif et par cours.">Obs.</th><th title="${codes[0]} + ${codes[1]}\nCe qui allait :\n• « ${sens[0]} » (${codes[0]})\n• « ${sens[1]} » (${codes[1]})">${codes[0]}+${codes[1]}</th><th title="Réussite\nPart des croix ${codes[0]} + ${codes[1]}, comme dans les totaux : plus c’est haut, mieux c’est.\n• orange sous ${seuils(S).orange} %\n• rouge (▼) sous ${seuils(S).rouge} %\n(bouton « Seuils »)">Réussite</th>`).join("")}</tr></thead>
  <tbody>${body || `<tr><td colspan="${4 + 3 * idx.length}">${S.eleves.some(e => e.nom.trim()) ? "Aucune saisie pour l’instant : remplissez les fiches collectives." : `Aucun élève dans le suivi collectif : ajoutez-les dans <a href="#reglages/eleves">Réglages › Élèves du suivi collectif</a>.`}</td></tr>`}
  <tr class="tot"><td class="l" title="Toutes matières\nToutes les matières additionnées.">Toutes matières</td>${cell(gO, gN, gI, "Toutes matières — tous les élèves")}${tot.map((t, k) => cell(t.obs, t.neg, t.i, `Toutes matières — ${esc(S.eleves[idx[k]].nom)}`)).join("")}</tr></tbody></table>`;
}

/* ---------- emploi du temps ---------- */
/* ---------- emploi du temps : palette « pinceau », semaine A, B, ou les deux côte à côte ---------- */
const TEINTES = [["#dde6fd", "#22378f"], ["#d9f0fb", "#0c5577"], ["#f6ead2", "#6d4a0c"], ["#d6f3ee", "#0f5c52"], ["#e3e7f1", "#33415c"], ["#fde8e8", "#7f1d1d"],
  ["#e1f2d7", "#3a6118"], ["#efe1fb", "#5a2d82"], ["#fde3ef", "#86244f"], ["#fff0c9", "#715400"], ["#ffe4d6", "#8a3a12"], ["#ece7e2", "#4f433a"],
  ["#d9f4e3", "#16613a"], ["#f3e8ff", "#6b21a8"], ["#e0f2fe", "#075985"], ["#fef3c7", "#78350f"]];
/** Couleur d'une matière (selon son rang dans la liste des matières). */
function teinte(mat) { const i = S.matieres.findIndex(m => m.nom === mat); return i < 0 ? ["#eef0f6", "#5b6075"] : TEINTES[i % TEINTES.length]; }
const styleMat = mat => { const [c, t] = teinte(mat); return `--c:${c};--t:${t}`; };
/** « 08:05 » → « 8 h 05 » ; horaire d'un créneau « 8 h 00 – 8 h 55 ». */
const fmtHeure = h => (/^\d\d:\d\d$/.test(h || "") ? `${Number(h.slice(0, 2))} h ${h.slice(3)}` : "");
/** Horaire d'un créneau (« 8 h 00 – 8 h 55 ») : de la semaine type, ou d'un jour de la semaine (jd : 0 = lundi … 5 = samedi). */
const horaire = (p, jd = -1) => { const h = horairesJour(S, jd)[p] || {}; return h.debut ? fmtHeure(h.debut) + (h.fin ? " – " + fmtHeure(h.fin) : "") : ""; };
const jourParticulier = jd => { const j = (S.horairesJours || [])[jd]; return !j || !j.mode ? "" : j.mode === "decale" ? `${j.matinSeul ? "matin" : "horaires"} décalé${j.matinSeul ? "" : "s"} de ${j.decalage > 0 ? "+" : ""}${j.decalage} min` : "horaires particuliers"; };
let vueEdt = "A";
let edtVersion = 0;                 // emploi du temps affiché : 0 = dès le début, k = S.edtSuivants[k - 1] (à partir d'une date)
const EDTV = () => (edtVersion && S.edtSuivants[edtVersion - 1]) || S.edt;
try { const v = localStorage.getItem(LS_KEY + "-edt"); if (["A", "B", "AB"].includes(v)) vueEdt = v; } catch (e) { /* sans stockage */ }
let pinceau = null;                // { mat, salle } : matière choisie dans la palette ; mat "" = gomme
let pinGroupe = "";                // pour qui le pinceau peint : "" = toute la classe, sinon un groupe ou une option
const ordreGr = g => { const i = S.groupes.findIndex(x => x.nom === g); return i < 0 ? 99 : i; };
const libGr = x => (x.g === x.mat ? x.mat : `${x.g} : ${x.mat}`);
function celluleEdt(t, d, p, compact) {
  const c = EDTV()[t][d][p], o = EDTV()[t === "A" ? "B" : "A"][d][p], dif = vueEdt === "AB" && t === "B" && JSON.stringify([c.mat, c.grp || []]) !== JSON.stringify([o.mat, o.grp || []]);
  if (c.grp && c.grp.length) {      // créneau partagé : une ligne par groupe ou option
    const tipG = `Semaine ${t} · ${DAYS[d]} ${PERIODS[p]}${horaire(p, d) ? " (" + horaire(p, d) + ")" : ""}\nCréneau partagé :\n${c.grp.map(x => `• **${esc(x.g)}** : ${esc(x.mat)}${profDe(S, x.mat) ? " – " + esc(profDe(S, x.mat)) : ""}${x.salle ? ", salle " + esc(x.salle) : ""}`).join("\n")}${c.mat ? `\n• **les autres** : ${esc(c.mat)}` : "\n• les autres élèves : pas de cours"}\n${pinceau ? (pinGroupe ? `Clic : mettre « ${esc(pinceau.mat || "rien")} » pour ${esc(pinGroupe)}` : "Clic : remplacer pour toute la classe") : "Clic : prendre ce cours comme pinceau"}`;
    return `<td class="ec divise${dif ? " dif" : ""}" data-ec="${t}.${d}.${p}" tabindex="0" role="button" aria-label="Semaine ${t}, ${DAYS[d]} ${PERIODS[p]} : ${c.grp.map(x => esc(x.g) + " " + esc(x.mat)).join(", ")}${c.mat ? ", les autres " + esc(c.mat) : ""}" title="${tipG}">${c.grp.map(x => `<span class="eg" style="${styleMat(x.mat)}"><i>${esc(x.g)}</i> ${esc(compact ? abrege(x.mat) : x.mat)}</span>`).join("")}${c.mat ? `<span class="eg" style="${styleMat(c.mat)}"><i>autres</i> ${esc(compact ? abrege(c.mat) : c.mat)}</span>` : ""}</td>`;
  }
  const prof = c.mat ? profDe(S, c.mat, edtVersion && S.edtSuivants[edtVersion - 1] ? S.edtSuivants[edtVersion - 1].depuis : S.debut) : "", h = horaire(p, d);
  const tip = `Semaine ${t} · ${DAYS[d]} ${PERIODS[p]}${h ? " (" + h + ")" : ""}\n${c.mat ? `**${esc(c.mat)}**${prof ? "\n• " + esc(prof) : ""}${c.salle ? "\n• salle " + esc(c.salle) : ""}` : "Pas de cours"}${dif ? `\n• semaine A : ${o.mat ? esc(o.mat) : "pas de cours"}` : ""}\n${pinceau ? (pinceau.mat ? `Clic : mettre « ${esc(pinceau.mat)} »` : "Clic : vider le créneau") : c.mat ? "Clic : prendre cette matière comme pinceau" : "Choisissez une matière dans la palette"}`;
  return `<td class="ec${c.mat ? "" : " vide"}${dif ? " dif" : ""}" data-ec="${t}.${d}.${p}"${c.mat ? ` style="${styleMat(c.mat)}"` : ""} tabindex="0" role="button" aria-label="Semaine ${t}, ${DAYS[d]} ${PERIODS[p]} : ${c.mat ? esc(c.mat) + (c.salle ? ", salle " + esc(c.salle) : "") : "pas de cours"}" title="${tip}">${c.mat
    ? `<b>${esc(c.mat)}</b>${!compact && prof ? `<small>${esc(prof)}</small>` : ""}${c.salle ? `<span class="salle">${esc(c.salle)}</span>` : ""}` : ""}</td>`;
}
function grilleEdt(t, compact) {
  return `<table class="edt2${compact ? " compact" : ""}${pinceau ? " peinture" : ""}"><thead><tr><th class="cr"><span class="sr">Créneau</span></th>${DAYS.slice(0, nbJours(S)).map((d, k) => `<th${jourParticulier(k) ? ` title="${d} : ${jourParticulier(k)}\nRéglage plus bas (Horaires des créneaux)."` : ""}>${compact ? d.slice(0, 3) + "." : d}${jourParticulier(k) ? ` <small class="jp">⏱</small>` : ""}</th>`).join("")}</tr></thead><tbody>
  ${creneauxActifs(S).map(p => [PERIODS[p], p]).map(([per, p]) => `${p === 4 ? `<tr class="midi" aria-hidden="true"><td colspan="${nbJours(S) + 1}"></td></tr>` : ""}<tr><th class="cr" title="${per}${horaire(p) ? "\n" + horaire(p) : "\nHoraire à indiquer plus bas"}">${per}${!compact && horaire(p) ? `<small>${horaire(p)}</small>` : ""}</th>${DAYS.slice(0, nbJours(S)).map((_, d) => d === 5 && p >= 4 ? `<td class="ec vide sam" aria-hidden="true"></td>` : celluleEdt(t, d, p, compact)).join("")}</tr>`).join("")}</tbody></table>`;
}
function viewEdt() {
  const sems = semaines(S), listeSem = t => { const l = sems.filter(w => w.type === t).map(w => "S" + w.num); return l.length ? l.slice(0, 5).join(", ") + (l.length > 5 ? "…" : "") : "aucune semaine"; };
  const mats = S.matieres.filter(m => m.nom.trim());
  const palette = mats.map(m => `<button type="button" class="pin${pinceau && pinceau.mat === m.nom ? " on" : ""}" data-pin="${esc(m.nom)}" style="${styleMat(m.nom)}" aria-pressed="${!!(pinceau && pinceau.mat === m.nom)}" title="${esc(m.nom)}${m.prof ? "\n" + esc(m.prof) : ""}\n• puis cliquez ou glissez sur les créneaux">${esc(m.nom)}</button>`).join("")
    + `<button type="button" class="pin gomme${pinceau && !pinceau.mat ? " on" : ""}" data-pin="" aria-pressed="${!!(pinceau && !pinceau.mat)}" title="Gomme\nCliquez ou glissez sur les créneaux pour les vider">⌫ Gomme</button>`;
  const onglets = [["A", "Semaine A"], ["B", "Semaine B"], ["AB", "A et B côte à côte"]];
  const bloc = (t, compact) => `<div class="card edt-bloc"><div class="row"><h2 style="margin:0">Semaine ${t}</h2><span class="chip${t === "A" ? " acc" : ""}" title="Semaines de type ${t}\n${sems.filter(w => w.type === t).map(w => "S" + w.num).join(", ") || "aucune"}">${listeSem(t)}</span>${compact && t === "B" ? '<span class="spacer"></span><span class="small dif-leg">cadre orange : différent de A</span>' : ""}</div>${grilleEdt(t, compact)}</div>`;
  if (edtVersion > S.edtSuivants.length) edtVersion = 0;
  const versions = [["dès le début du suivi", 0], ...S.edtSuivants.map((v, k) => [`à partir du ${fmtDM(v.depuis)}/${v.depuis.slice(0, 4)}`, k + 1])];
  const barreVersions = `<div class="card edt-versions"><div class="row"><b>Emploi du temps</b><div class="seg" role="tablist" aria-label="Version de l’emploi du temps">${versions.map(([l, k]) => `<button type="button" role="tab" data-edtv="${k}" aria-selected="${edtVersion === k}" class="${edtVersion === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <button type="button" data-act="edt-nouveau" title="Nouvel emploi du temps à partir d’une date\nChangement en cours d’année (nouveau trimestre, emploi du temps refait…) : les fiches passées gardent l’ancien.\n• il part d’une copie de celui affiché">+ Nouveau à partir du…</button>
    ${edtVersion ? `<button type="button" class="ghost danger" data-act="edt-suppr" title="Supprimer cette version\nLes fiches à partir de cette date reprennent l’emploi du temps précédent.">Supprimer cette version</button>` : ""}</div>
    ${S.edtSuivants.length ? `<p class="hint" style="margin:6px 0 0">Vous modifiez l’emploi du temps <b>${versions.find(v => v[1] === edtVersion)[0]}</b>${edtVersion < S.edtSuivants.length ? ` (jusqu’au ${fmtDM(addDays(S.edtSuivants[edtVersion].depuis, -1))})` : ""}. Pour changer un seul enseignant, voir aussi Réglages › Matières et enseignants.</p>` : ""}</div>`;
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Commun à toutes les fiches · semaines A et B</span><h1 data-titre>Emploi du temps</h1></div>
    <div class="actions"><div class="seg" role="tablist" aria-label="Semaine affichée">${onglets.map(([k, l]) => `<button type="button" role="tab" data-vue-edt="${k}" aria-selected="${vueEdt === k}" class="${vueEdt === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <button data-act="copy-ab" title="Copier la semaine A dans la semaine B\nLa semaine B est remplacée par une copie de la semaine A.">Copier A → B</button>
    <button data-act="print-edt" title="Imprimer\nLes semaines A et B sur une page."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div></div>
  ${barreVersions}
  <div class="card palette-edt">
    <div class="row"><b>${pinceau ? (pinceau.mat ? `Pinceau : <span class="pin on" style="${styleMat(pinceau.mat)}">${esc(pinceau.mat)}</span>` : "Gomme") : "1. Choisissez une matière"}</b>
      <span class="muted small">${pinceau ? "cliquez ou glissez sur les créneaux, comme pour cocher une fiche · Échap pour reposer le pinceau" : "puis cliquez ou glissez sur les créneaux · un clic sur un cours existant reprend sa matière et sa salle"}</span><span class="spacer"></span>
      <label class="row small">Salle <input id="pin-salle" value="${esc(pinceau ? pinceau.salle : "")}" ${pinceau && pinceau.mat ? "" : "disabled"} placeholder="—" style="width:80px" aria-label="Salle mise avec la matière"></label>
      ${pinceau ? '<button type="button" class="ghost" data-pin-pose title="Reposer le pinceau (Échap)">Reposer</button>' : ""}</div>
    <div class="palette">${palette}</div>
    ${S.groupes.some(g => g.nom) ? `<div class="row pin-pour"><b>Pour :</b><div class="seg" role="group" aria-label="Pour qui le pinceau peint">${[["", "Toute la classe"], ...S.groupes.filter(g => g.nom).map(g => [g.nom, g.nom])].map(([v, l]) => `<button type="button" data-pin-gr="${esc(v)}" class="${pinGroupe === v ? "on" : ""}" aria-pressed="${pinGroupe === v}" title="${v ? `Pour : ${esc(l)}\nLe créneau devient partagé : seuls les élèves « ${esc(l)} » ont ce cours ; les autres gardent le leur.\n• gomme : retire le cours de ce groupe` : "Pour toute la classe\nRemplace tout le créneau, groupes compris."}">${esc(l)}</button>`).join("")}</div>
      <span class="muted small">${pinGroupe ? `demi-groupe, langue ou option : seuls les élèves « ${esc(pinGroupe)} » (Réglages › Élèves et groupes) ont ce cours` : "choisissez un groupe ou une option pour partager un créneau"}</span></div>` : ""}
    ${mats.length ? "" : `<p class="hint">Aucune matière : ajoutez-les d’abord dans <a href="#reglages/matieres">Réglages › Matières</a>.</p>`}</div>
  ${vueEdt === "AB" ? `<div class="edt-deux">${bloc("A", true)}${bloc("B", true)}</div>` : bloc(vueEdt, false)}
  <div class="card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0">Créneaux et jours</h2><span class="muted small">pour toutes les fiches</span></div>
    <div class="row creneaux-plus"><label title="Créneau M5\nAprès M4, le midi (12 h – 13 h par exemple) : club, AP, permanence… L’après-midi peut alors commencer à 13 h."><input type="checkbox" data-bool="creneauMidi" ${S.creneauMidi ? "checked" : ""}> M5 (midi)</label>
      <label title="Créneau S4\nAprès S3, jusqu’à 17 h 30 environ."><input type="checkbox" data-bool="creneauS4" ${S.creneauS4 ? "checked" : ""}> S4</label>
      <label title="Créneau S5\nAprès S4, jusqu’à 18 h environ."><input type="checkbox" data-bool="creneauS5" ${S.creneauS5 ? "checked" : ""} ${S.creneauS4 ? "" : "disabled"}> S5</label>
      <label title="Cours le samedi matin\nUn 6e jour, le matin seulement (M1 à M4)."><input type="checkbox" data-bool="samedi" ${S.samedi ? "checked" : ""}> Cours le samedi matin</label></div>
    <p class="hint" style="margin:4px 0 12px">Les créneaux et le jour ajoutés apparaissent dans l’emploi du temps et sur toutes les fiches. Les retirer ne supprime pas ce qui y a été saisi : il réapparaît si on les remet.</p>
  </div>
  <div class="card horaires-card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0">Horaires des créneaux</h2><span class="muted small">imprimés sur les fiches</span></div>
    <div class="champs"><label class="champ" title="Début du matin\nHeure de début de M1.">Début du matin <input type="time" data-path="horairesBase.matin" value="${esc(S.horairesBase.matin)}" aria-label="Début du matin"></label>
      <label class="champ" title="Début de l’après-midi\nHeure de début de S1 (13 h 00, 13 h 30…).">Début de l’après-midi <input type="time" data-path="horairesBase.aprem" value="${esc(S.horairesBase.aprem)}" aria-label="Début de l’après-midi"></label>
      <label class="champ" title="Durée d’une séance\n• de 45 à 60 min ; les heures de fin se calculent toutes seules\n• un cours de 1 h 50 ou de 2 h, ce sont deux séances : mettez la matière sur deux créneaux">Durée d’un cours <span class="row" style="gap:4px"><input type="number" min="45" max="60" step="5" data-num="horairesBase.duree" value="${S.horairesBase.duree}" style="width:70px" aria-label="Durée d’un cours en minutes"> min</span></label>
      <label class="champ" title="Interclasse\nTemps entre la fin d’un cours et le début du suivant.">Interclasse <span class="row" style="gap:4px"><input type="number" min="0" max="10" step="1" data-num="horairesBase.inter" value="${S.horairesBase.inter}" style="width:70px" aria-label="Interclasse en minutes"> min</span></label>
      <label class="champ" title="Récréation du matin\nSa durée (0 : pas de récréation) et le créneau après lequel elle a lieu.\nLes cours suivants commencent d’autant plus tard.">Récréation du matin <span class="row" style="gap:4px"><input type="number" min="0" max="30" step="5" data-num="horairesBase.recreMatin" value="${S.horairesBase.recreMatin}" style="width:70px" aria-label="Durée de la récréation du matin en minutes"> min après <select data-num="horairesBase.recreMatinApres" aria-label="Créneau avant la récréation du matin" style="width:auto">${P_MATIN.filter(p => creneauxActifs(S).includes(p)).map(p => `<option value="${p}"${p === S.horairesBase.recreMatinApres ? " selected" : ""}>${PERIODS[p]}</option>`).join("")}</select></span></label>
      <label class="champ" title="Récréation de l’après-midi\nSa durée (0 : pas de récréation) et le créneau après lequel elle a lieu.\nLes cours suivants commencent d’autant plus tard.">Récréation de l’après-midi <span class="row" style="gap:4px"><input type="number" min="0" max="30" step="5" data-num="horairesBase.recreAprem" value="${S.horairesBase.recreAprem}" style="width:70px" aria-label="Durée de la récréation de l’après-midi en minutes"> min après <select data-num="horairesBase.recreApremApres" aria-label="Créneau avant la récréation de l’après-midi" style="width:auto">${P_APREM.filter(p => creneauxActifs(S).includes(p)).map(p => `<option value="${p}"${p === S.horairesBase.recreApremApres ? " selected" : ""}>${PERIODS[p]}</option>`).join("")}</select></span></label></div>
    <p class="hint">Les heures sont calculées (cours, interclasses et récréations). Corrigez-en une au besoin (cours plus long…) : les suivantes suivent. ↺ revient au calcul.</p>
    <div class="horaires">${(t => creneauxActifs(S).map(p => `<label class="${t[p].autoDebut && t[p].autoFin ? "" : "tape"}"><b>${PERIODS[p]}</b><input type="time" data-hor="${p}.debut" value="${esc(t[p].debut)}" class="${t[p].autoDebut ? "auto" : ""}" aria-label="${PERIODS[p]} : début" title="${t[p].autoDebut ? "Calculé" : "Tapé"}"><input type="time" data-hor="${p}.fin" value="${esc(t[p].fin)}" class="${t[p].autoFin ? "auto" : ""}" aria-label="${PERIODS[p]} : fin" title="${t[p].autoFin ? "Calculé" : "Tapé"}">${t[p].autoDebut && t[p].autoFin ? "" : `<button type="button" class="ghost" data-hor-raz="${p}" title="Revenir aux heures calculées" aria-label="Revenir aux heures calculées pour ${PERIODS[p]}">↺</button>`}</label>`).join(""))(horairesType(S))}</div>
    <h3 style="margin:14px 0 4px">Journées aux horaires particuliers</h3><p class="hint" style="margin:0 0 6px">Mercredi, samedi… : des horaires décalés de quelques minutes, ou entièrement libres.</p>
    <div class="hj-liste">${DAYS.slice(0, nbJours(S)).map((n, d) => { const j = S.horairesJours[d], hj = horairesJour(S, d), ps = d === 5 ? creneauxActifs(S).filter(p => P_MATIN.includes(p) && p !== 7) : creneauxActifs(S);
      return `<div class="hj"><b>${n}</b><select data-hj-mode="${d}" aria-label="Horaires du ${n.toLowerCase()}"><option value=""${!j.mode ? " selected" : ""}>horaires habituels</option><option value="decale"${j.mode === "decale" ? " selected" : ""}>décalés de…</option><option value="libre"${j.mode === "libre" ? " selected" : ""}>horaires libres</option></select>
        ${j.mode === "decale" ? `<span class="row" style="gap:4px"><input type="number" min="-60" max="60" step="5" data-num="horairesJours.${d}.decalage" value="${j.decalage}" style="width:76px" aria-label="Décalage du ${n.toLowerCase()} en minutes"> min <select data-hj-matin="${d}" aria-label="Partie décalée du ${n.toLowerCase()}" style="width:auto"><option value=""${j.matinSeul ? "" : " selected"}>toute la journée</option><option value="1"${j.matinSeul ? " selected" : ""}>le matin seulement</option></select> <small class="muted">(négatif : plus tôt) · M1 à ${fmtHeure(hj[0].debut)}</small></span>` : ""}
        ${j.mode === "libre" ? `<div class="horaires">${ps.map(p => `<label><b>${PERIODS[p]}</b><input type="time" data-hjl="${d}.${p}.debut" value="${esc(hj[p].debut)}" aria-label="${n} ${PERIODS[p]} : début"><input type="time" data-hjl="${d}.${p}.fin" value="${esc(hj[p].fin)}" aria-label="${n} ${PERIODS[p]} : fin"></label>`).join("")}</div>` : ""}</div>`; }).join("")}</div></div>`;
}
/* pinceau : clic ou cliquer-glisser sur les créneaux ; sans pinceau, un clic reprend la matière du créneau (pipette) */
let peinture = null;
function peindreEdt(td) {
  const k = td.dataset.ec; if (peinture.vus.has(k)) return;
  const [t, d, p] = k.split("."), c = EDTV()[t][d][p];
  peinture.vus.set(k, JSON.parse(JSON.stringify(c)));
  if (!pinGroupe) EDTV()[t][d][p] = pinceau.mat ? { mat: pinceau.mat, salle: pinceau.salle } : { mat: "", salle: "" };
  else {                           // un groupe ou une option : son cours seul change, les autres élèves gardent le leur
    const n = { mat: c.mat, salle: c.salle, grp: (c.grp || []).filter(x => x.g !== pinGroupe) };
    if (pinceau.mat) n.grp.push({ g: pinGroupe, mat: pinceau.mat, salle: pinceau.salle });
    n.grp.sort((a, b) => ordreGr(a.g) - ordreGr(b.g)); if (!n.grp.length) delete n.grp;
    EDTV()[t][d][p] = n;
  }
  td.outerHTML = celluleEdt(t, Number(d), Number(p), vueEdt === "AB");
}
function finPeinture() {
  if (!peinture) return;
  const p = peinture; peinture = null; document.body.classList.remove("tracage");
  if (p.vus.size === 1) {          // simple clic sur un créneau qui avait déjà ce cours : on le vide (comme une croix)
    const [k, avant] = [...p.vus][0], [t, d, pp] = k.split(".");
    const ancien = pinGroupe ? (avant.grp || []).find(x => x.g === pinGroupe) || {} : avant;
    if (pinceau.mat && ancien.mat === pinceau.mat && ancien.salle === pinceau.salle && (pinGroupe || !(avant.grp || []).length)) {
      if (!pinGroupe) EDTV()[t][d][pp] = { mat: "", salle: "" };
      else { const c = EDTV()[t][d][pp]; c.grp = (c.grp || []).filter(x => x.g !== pinGroupe); if (!c.grp.length) delete c.grp; }
    }
  }
  commit();
}
document.addEventListener("pointerdown", e => {
  const td = e.target.closest && e.target.closest("td[data-ec]");
  if (!td || e.button !== 0 || !S) return;
  e.preventDefault();
  // le champ « Salle » rend la main : Ctrl+Z doit annuler le coup de pinceau, pas la frappe
  if (document.activeElement && document.activeElement.id === "pin-salle") document.activeElement.blur();
  if (!pinceau) {
    const [t, d, p] = td.dataset.ec.split("."), c0 = EDTV()[t][d][p], g = (c0.grp || []).find(x => x.g === pinGroupe) || (!c0.mat && (c0.grp || [])[0]);
    if (g && !pinGroupe) pinGroupe = g.g;
    const c = g || c0;
    if (c.mat) { pinceau = { mat: c.mat, salle: c.salle }; render(); toast(`Pinceau : « ${c.mat} »${c.salle ? ", salle " + c.salle : ""}${pinGroupe ? ", pour " + pinGroupe : ""}. Cliquez ou glissez sur les créneaux.`); }
    else toast("Choisissez d’abord une matière dans la palette.");
    return;
  }
  peinture = { vus: new Map() }; document.body.classList.add("tracage"); peindreEdt(td);
});
document.addEventListener("pointermove", e => {
  if (!peinture) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), td = el && el.closest("td[data-ec]");
  if (td) peindreEdt(td);
});
document.addEventListener("pointerup", finPeinture);
document.addEventListener("pointercancel", finPeinture);
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-pin], [data-pin-pose], [data-vue-edt], [data-pin-gr], [data-edtv]");
  if (!b) return;
  if (b.dataset.edtv !== undefined) { edtVersion = Number(b.dataset.edtv); render(); return; }
  if (b.dataset.vueEdt) { vueEdt = b.dataset.vueEdt; try { localStorage.setItem(LS_KEY + "-edt", vueEdt); } catch (err) { /* sans stockage */ } render(); return; }
  if (b.hasAttribute("data-pin-pose")) { pinceau = null; render(); return; }
  if (b.dataset.pinGr !== undefined) { pinGroupe = b.dataset.pinGr; render(); return; }
  const mat = b.dataset.pin;
  pinceau = pinceau && pinceau.mat === mat ? null : { mat, salle: pinceau && pinceau.mat === mat ? pinceau.salle : "" };
  render();
  const s = $("#pin-salle"); if (s && pinceau && pinceau.mat) s.focus();
});
document.addEventListener("input", e => { if (e.target.id === "pin-salle" && pinceau) pinceau.salle = e.target.value.trim(); });
document.addEventListener("click", e => {          // réglages : cocher ou décocher un groupe pour toute la classe
  const b = e.target.closest && e.target.closest("[data-grcol]"); if (!b || !S) return;
  const g = b.dataset.grcol, demi = estDemiGroupe(g), autre = x => demi && (x.groupes || []).some(y => y !== g && estDemiGroupe(y));
  const cibles = S.classeEleves.filter(x => !autre(x)), tous = cibles.every(x => (x.groupes || []).includes(g));
  for (const x of cibles) { const l = (x.groupes || []).filter(y => y !== g); if (!tous) l.push(g); l.sort((a, c) => ordreGr(a) - ordreGr(c)); if (l.length) x.groupes = l; else delete x.groupes; }
  const gardes = S.classeEleves.length - cibles.length;
  commit(); toast((tous ? `« ${g} » décoché` : `« ${g} » coché`) + (gardes ? ` pour les élèves qui ne sont pas dans un autre demi-groupe (${nbMot(gardes, "élève")} gardé${gardes > 1 ? "s" : ""} dans le sien).` : " pour toute la classe."), 6000);
});
document.addEventListener("keydown", e => {
  if (current.view !== "edt") return;
  if (e.key === "Escape" && pinceau && !document.querySelector("#boite[open]")) { e.preventDefault(); pinceau = null; render(); return; }
  const td = e.target.closest && e.target.closest("td[data-ec]");
  if (td && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    if (!pinceau) { const [t, d, p] = td.dataset.ec.split("."), c = EDTV()[t][d][p]; if (c.mat) { pinceau = { mat: c.mat, salle: c.salle }; render(); } return; }
    const k = td.dataset.ec; peinture = { vus: new Map() }; peindreEdt(td); finPeinture();
    const n = document.querySelector(`td[data-ec="${k}"]`); if (n) n.focus();
  }
});

/* ---------- réglages : rubriques à gauche, une rubrique à la fois ---------- */
function inp(path, attrs = "", label = "") { return `<input type="text" data-path="${path}" value="${esc(getPath(S, path))}"${label ? ` aria-label="${esc(label)}"` : ""} ${attrs}>`; }
function dateInp(path, label = "") { return `<input type="date" data-path="${path}" value="${esc(getPath(S, path) || "")}"${label ? ` aria-label="${esc(label)}"` : ""}>`; }
const ICO_REG = { ficheClasse: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', groupes: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c0-2.8 2.2-5 5-5M21 19c0-2.8-2.2-5-5-5M10 19h4"/>', classe: '<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/>', calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  suivisIndiv: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  classeEntiere: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M8 4v16"/>',
  eleves: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c2.9.3 5.5 2.6 5.5 5.8"/>',
  matieres: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h3"/>', edt: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/>',
  fiche: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', pastilles: '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/>' };
function rubriquesReglages() {
  const sems = semaines(S), nbEl = S.eleves.filter(e => e.nom.trim()).length, edtRempli = ["A", "B"].some(t => S.edt[t].some(d => d.some(c => c.mat)));
  const sansProf = S.matieres.filter(m => m.nom.trim() && !m.prof.trim() && ["A", "B"].some(t => S.edt[t].some(d => d.some(c => c.mat === m.nom)))).length;
  const t = seuils(S);
  return [
    "Commun à toutes les fiches",
    ["classe", "Établissement, classe et référent", S.classe ? `${esc(S.classe)}${S.referent ? " · " + esc(S.referent) : ""}` : "à compléter", !!S.classe.trim()],
    ["calendrier", "Période et calendrier", S.debut ? `${fmtDM(S.debut)} → ${S.fin ? fmtDM(S.fin) : "…"} · ${sems.length} semaine${sems.length > 1 ? "s" : ""}` : "à compléter", sems.length > 0 && !(S.fin && S.fin < S.debut)],
    ["matieres", "Matières et enseignants", `${nbMot(S.matieres.filter(m => m.nom.trim()).length, "matière")}${sansProf ? ` · ${sansProf} sans enseignant` : ""}`, !sansProf],
    ["classeEntiere", "Élèves et groupes", S.classeEleves.length ? `${nbMot(S.classeEleves.length, "élève")}${S.groupes.some(g => g.nom) ? " · " + (S.groupes.filter(g => g.nom).length > 4 ? nbMot(S.groupes.filter(g => g.nom).length, "groupe") : S.groupes.filter(g => g.nom).map(g => esc(g.nom)).join(", ")) : ""}` : "liste à importer", S.classeEleves.length > 0],
    ["edt", "Emploi du temps", (() => { const r = ["A", "B"].filter(tt => S.edt[tt].some(d => d.some(c => c.mat || (c.grp || []).length))); return r.length === 2 ? "semaines A et B" : r.length ? `semaine ${r[0]} seulement` : "à remplir"; })(), edtRempli, "#edt"],
    "Fiches individuelles et collectives",
    ["pastilles", "Codes et pastilles", `${S.codage.map(c => c.code).join(" ")} · rouge ${t.rouge} · vert clair ${t.vert}`, true],
    "Suivis individuels",
    ["suivisIndiv", "Fiches individuelles", `remise le ${JOURS_REMISE[(S.remiseIndiv || 5) - 1]} · ${S.individuels.length} suivi${S.individuels.length > 1 ? "s" : ""}`, true],
    "Suivi collectif",
    ["eleves", "Élèves du suivi collectif", nbEl ? `${nbEl} élève${nbEl > 1 ? "s" : ""}` : "aucun élève", nbEl > 0],
    ["fiche", "Fiche collective", `consigne, ${nbObj(S)} objectif${nbObj(S) > 1 ? "s" : ""}`, true],
    "Classe entière",
    ["ficheClasse", "Fiche de classe", `${S.codesClasse.filter(c => c.code).length + 1} codes${S.retenueClasse.remarques ? ` · ${nbMot(S.retenueClasse.remarques, "remarque")} = ${S.retenueClasse.heures} h` : ""}`, true]];
}
let elDatesOuvert = -1;            // élève dont le réglage des dates de suivi est ouvert
document.addEventListener("toggle", e => { const d = e.target; if (d.matches && d.matches("details.el-dates")) { if (d.open) elDatesOuvert = Number(d.dataset.eld); else if (elDatesOuvert === Number(d.dataset.eld)) elDatesOuvert = -1; } }, true);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** Calendrier de l'année : une colonne par mois, une case par semaine (A, B, vacances, hors suivi) ; clic = forcer A ↔ B. */
function calendrierHTML() {
  if (!S.debut) return `<p class="hint">Indiquez le premier lundi du suivi : le calendrier s’affichera ici.</p>`;
  const sems = semaines(S), parLundi = new Map(sems.map(w => [w.lundi, w]));
  let lundi = S.debut; while (!isMonday(lundi)) lundi = addDays(lundi, -1);
  const fin = S.fin || addDays(lundi, 7 * 44), mois = new Map();
  for (let i = 0; i < 60 && lundi <= fin; i++, lundi = addDays(lundi, 7)) {
    const w = parLundi.get(lundi), vac = !w && enVacances(S, lundi), cle = lundi.slice(0, 7);
    const off = DAYS.slice(0, nbJours(S)).map((n, d) => [n, addDays(lundi, d)]).filter(([, j]) => w && sansCours(S, j));
    const cls = w ? w.type + (w.forced ? " force" : "") : vac ? "V" : "H";
    const autre = w && w.type === "A" ? "B" : "A";
    const tip = w ? `Semaine ${w.num} · du ${fmtDM(lundi)} au ${fmtDM(addDays(lundi, 4))}\n• type **${w.type}** (${w.forced ? "forcé" : "automatique"})${off.map(([n, j]) => `\n• ${n.toLowerCase()} ${Number(j.slice(8))} : ${esc(motifSansCours(S, j))}`).join("")}\n• clic : ${w.forced ? "revenir à l’alternance automatique" : "forcer en " + autre}`
      : vac ? `Semaine du ${fmtDM(lundi)}\nVacances : ${esc((vacancesDu(S, lundi) || vacancesDu(S, addDays(lundi, 4)) || {}).label || "")}` : `Semaine du ${fmtDM(lundi)}\nHors de la période du suivi`;
    if (!mois.has(cle)) mois.set(cle, []);
    mois.get(cle).push(`<div class="sem-cal"><small>${lundi.slice(8)}</small><button type="button" class="${cls}${off.length ? " f" : ""}"${w ? ` data-cal="${lundi}"` : " disabled"} title="${tip}" aria-label="${w ? `Semaine ${w.num}, type ${w.type}` : vac ? "vacances" : "hors suivi"}">${w ? w.type : vac ? "vac." : "–"}</button></div>`);
  }
  return `<div class="leg-cal"><span><i class="A"></i>semaine A</span><span><i class="B"></i>semaine B</span><span><i class="V"></i>vacances</span><span><i class="H"></i>hors suivi</span><span><b class="pt-f">●</b> jour sans cours</span><span><i class="A force"></i>type forcé</span><span class="spacer"></span><span>Cliquez sur une semaine pour passer A ↔ B</span></div>
  <div class="annee">${[...mois].map(([cle, l]) => `<div class="mois"><h4>${MOIS[Number(cle.slice(5)) - 1]}</h4>${l.join("")}</div>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-cal]");
  if (!b || !S) return;
  const l = b.dataset.cal, w = semaines(S).find(x => x.lundi === l);
  if (!w) return;
  if (S.typesForces[l]) delete S.typesForces[l]; else S.typesForces[l] = w.type === "A" ? "B" : "A";
  commit();
});
function libelleSuivi(e) {
  return !e.debut && !e.fin ? "toute la période" : e.debut && !e.fin ? `à partir du ${fmtDM(e.debut)}` : !e.debut ? `jusqu’au ${fmtDM(e.fin)}` : `du ${fmtDM(e.debut)} au ${fmtDM(e.fin)}`;
}
function rubriqueHTML(cle) {
  const listRows = (key, cols) => S[key].map((it, i) => `<div class="lrow">${cols.map(([f, kind, lab]) => kind === "date" ? dateInp(`${key}.${i}.${f}`, `${lab}, ligne ${i + 1}`)
      : kind === "moment" ? `<select data-path="${key}.${i}.${f}" aria-label="${lab}, ligne ${i + 1}" title="Toute la journée, ou seulement le matin (M1…M4) ou l’après-midi (S1…)"><option value=""${!it[f] ? " selected" : ""}>journée</option><option value="matin"${it[f] === "matin" ? " selected" : ""}>matin</option><option value="apresmidi"${it[f] === "apresmidi" ? " selected" : ""}>après-midi</option></select>`
      : inp(`${key}.${i}.${f}`, "", `${lab}, ligne ${i + 1}`)).join("")}
    <button class="ghost danger" data-del="${key}.${i}" title="${key === "vacances" ? "Supprimer ces vacances\nLeurs semaines redeviennent des semaines de cours." : "Supprimer ce jour sans cours\nSa fiche redevient une fiche normale."}" aria-label="Supprimer la ligne ${i + 1}">✕</button></div>`).join("");
  if (cle === "classe") return `<div class="card"><h2>Établissement</h2><p class="hint">Le nom et le logo figurent en haut de toutes les impressions (dans la marge, sans prendre de place) ; sur les fiches que les enseignants cochent en classe, seulement s’il reste de la place.</p>
    <div class="champs"><label class="champ" style="flex:1 1 320px" title="Nom de l’établissement\n• imprimé à côté du logo (sauf si « le logo contient déjà le nom » est coché)\n• remplace « [établissement] » dans le courriel">Nom de l’établissement ${inp("etablissement.nom", 'placeholder="ex. Collège Les Tilleuls, Villeneuve" maxlength="150"', "Nom de l’établissement")}</label></div>
    <div class="logo-zone${S.etablissement.logo && S.etablissement.sansNom ? " seul" : ""}" tabindex="0" data-logo-zone title="Logo de l’établissement\n• glissez une image ici (JPG, PNG, WebP ou SVG)\n• ou cliquez ici puis collez-la (Ctrl+V)\n• ou « Choisir une image… »">
      ${S.etablissement.logo ? `<img src="${S.etablissement.logo}" alt="Logo de l’établissement">` : `<span class="logo-vide">Logo : glissez une image ici, ou collez-la (Ctrl+V)</span>`}
      <div class="row"><button type="button" data-act="logo-choisir">Choisir une image…</button>${S.etablissement.logo ? `<button type="button" class="ghost danger" data-act="logo-retirer">Retirer le logo</button>` : ""}<small class="muted">JPG, PNG, WebP ou SVG</small></div>
      ${S.etablissement.logo ? `<label class="row small" style="gap:6px;margin-top:6px" title="Logo avec le nom\nLe logo contient déjà le nom de l’établissement (en-tête complet) : il n’est pas répété à côté sur les impressions.\n• le logo s’imprime alors plus large (jusqu’à 11 cm)\n• s’il serait imprimé trop petit pour être lu (moins de 2,5 cm de large), le nom est quand même écrit à côté\n• le nom sert toujours dans le courriel à la famille"><input type="checkbox" data-bool="etablissement.sansNom" ${S.etablissement.sansNom ? "checked" : ""}> Le logo contient déjà le nom : ne pas le répéter à côté</label>` : ""}
      <input type="file" id="logo-fichier" accept=".png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden></div></div>
  <div class="card"><h2>Classe et référent</h2><p class="hint">Communs à toutes les fiches : fiches individuelles, suivi collectif, fiche de classe.</p>
    <div class="champs"><label class="champ" title="Classe\nAffichée en haut des fiches et au début du nom des PDF (« Suivi 5E - … »).">Classe ${inp("classe", 'placeholder="ex. 5E"', "Classe")}</label>
    <label class="champ" title="Référent\n• reçoit les fiches remplies\n• son nom remplace « [référent] » dans la consigne">Référent, qui reçoit les fiches ${inp("referent", 'placeholder="ex. M. GRONDIN"', "Référent, qui reçoit la fiche")}</label></div>
    <p class="hint">Le nom du référent remplace « [référent] » dans la consigne imprimée sur les fiches.</p></div>`;
  if (cle === "calendrier") return `<div class="card"><h2>Année scolaire et zone</h2><p class="hint">Les vacances de la zone et les jours fériés de l’année sont préremplis (calendrier officiel connu : ${Object.keys(CALENDRIERS).map(a => `${a}-${Number(a) + 1}`).join(", ")}).</p>
    <div class="champs"><label class="champ" title="Année scolaire\nCelle des vacances et des jours fériés proposés.">Année scolaire <select data-num="anneeScolaire" aria-label="Année scolaire">${[...new Set([...Object.keys(CALENDRIERS).map(Number), S.anneeScolaire])].sort().map(a => `<option value="${a}"${a === S.anneeScolaire ? " selected" : ""}>${a}-${a + 1}${CALENDRIERS[a] ? "" : " (vacances à saisir)"}</option>`).join("")}</select></label>
      <label class="champ" title="Zone de vacances\n• A : Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers\n• B : Aix-Marseille, Amiens, Lille, Nancy-Metz, Nantes, Nice, Normandie, Orléans-Tours, Reims, Rennes, Strasbourg\n• C : Créteil, Montpellier, Paris, Toulouse, Versailles">Zone <select data-path="zone" aria-label="Zone de vacances">${["A", "B", "C"].map(z => `<option${z === S.zone ? " selected" : ""}>${z}</option>`).join("")}</select></label>
      <label class="champ row" style="gap:8px;align-self:end" title="Alsace-Moselle\nLe Vendredi saint est férié (et le 26 décembre, pendant les vacances)."><input type="checkbox" data-bool="alsaceMoselle" ${S.alsaceMoselle ? "checked" : ""}> Alsace-Moselle</label></div>
    <div class="row" style="margin-top:10px"><button type="button" data-act="cal-preremplir" title="Préremplir le calendrier\nRemplace les vacances par celles de la zone et de l’année choisies, et les jours fériés par ceux de l’année.\n• les autres jours sans cours (sorties, journées banalisées) sont gardés">Préremplir les vacances et les jours fériés</button>
      <button type="button" data-act="cal-annee" title="Période du suivi : toute l’année\nDe la rentrée à la veille des vacances d’été (fiches individuelles et de classe pour toute l’année).">Suivi sur toute l’année scolaire</button></div></div>
  <div class="card"><h2>Période du suivi</h2>${S.fin && semaines(S).length >= MAX_SEMAINES && semaines(S).at(-1).jours.at(-1) < S.fin ? `<p class="avis-inline">⚠ La période dépasse ${MAX_SEMAINES} semaines de cours : les fiches s’arrêtent au ${fmtDM(semaines(S).at(-1).jours.at(-1))}. Un suivi couvre une année scolaire au plus.</p>` : ""}
    <div class="champs"><label class="champ" title="Premier jour du suivi\n• sa semaine est la 1re semaine du suivi (en général un lundi, ou le jour de la rentrée)\n• les semaines de vacances sont sautées">Premier jour du suivi ${dateInp("debut", "Premier jour du suivi")}</label><label class="champ" title="Dernier jour du suivi\nLes fiches et les totaux s’arrêtent à cette date.">Dernier jour ${dateInp("fin", "Dernier jour du suivi")}</label>
    <label class="champ" title="Type de la 1re semaine\nA ou B : les suivantes alternent ensuite.\n• pour forcer une semaine, cliquez-la dans le calendrier">Type de la 1re semaine <select data-path="typeDebut" aria-label="Type de la première semaine"><option ${S.typeDebut === "A" ? "selected" : ""}>A</option><option ${S.typeDebut === "B" ? "selected" : ""}>B</option></select></label></div>
    <h3>Calendrier</h3>${calendrierHTML()}</div>
    ${(() => { const pa = periodesAnnee(S), auto = !S.decoupage.fins.some(Boolean);
      return `<div class="card"><h2>Trimestres ou semestres</h2><p class="hint">Les raccourcis de période des synthèses (fiche élève, conseil de classe) et des bilans proposent chaque ${S.decoupage.mode === "trimestres" ? "trimestre" : "semestre"} commencé.</p>
      <div class="champs"><label class="champ" title="Découpage de l’année\nComme les conseils de classe de l’établissement.">Découpage <select data-path="decoupage.mode" aria-label="Découpage de l’année"><option value="trimestres"${S.decoupage.mode === "trimestres" ? " selected" : ""}>trimestres</option><option value="semestres"${S.decoupage.mode === "semestres" ? " selected" : ""}>semestres</option></select></label>
        ${pa.slice(0, -1).map((x, k) => `<label class="champ" title="Fin du ${x.lib}\nLe dernier jour compté ; le suivant commence le lendemain.">Fin du ${x.lib} <input type="date" data-path="decoupage.fins.${k}" value="${x.au}" aria-label="Fin du ${x.lib}"></label>`).join("")}
        ${auto ? "" : `<button type="button" class="ghost" data-act="decoupage-auto" title="Dates proposées\nTrimestres : jusqu’aux vacances de Noël et de printemps. Semestres : 1er semestre jusqu’au dernier vendredi de janvier.">↺ Dates proposées</button>`}</div>
      <p class="hint" style="margin-bottom:0">${pa.map(x => !x.du || !x.au || (S.fin && x.du > S.fin) || x.au < x.du || (S.debut && x.au < S.debut) ? `${x.lib} : hors du suivi` : `${x.lib} : du ${fmtDM(S.debut && x.du < S.debut ? S.debut : x.du)} au ${fmtDM(S.fin && x.au > S.fin ? S.fin : x.au)}`).join(" · ")}${pa.slice(0, -1).some((x, k) => k && x.au <= pa[k - 1].au) ? `<span class="avis-inline" style="display:block;margin-top:6px">⚠ Les dates de fin ne se suivent pas : vérifiez-les.</span>` : pa.slice(0, -1).some(x => S.debut && x.au < S.debut) ? `<span class="avis-inline" style="display:block;margin-top:6px">⚠ Une date de fin est avant le début du suivi : vérifiez l’année.</span>` : ""}${auto ? " (dates proposées, à corriger selon les conseils de classe)" : ""}</p></div>`; })()}
    <div class="grid2"><div class="card"><h2>Vacances scolaires</h2><p class="hint">Une semaine entièrement en vacances est sautée. Pour les vacances officielles de la zone ${S.zone} ${S.anneeScolaire}-${S.anneeScolaire + 1} : « Préremplir les vacances et les jours fériés » plus haut.</p>
      <div class="lhead l3"><span>Période</span><span>Début (samedi)</span><span>Reprise</span></div><div class="liste l3">${listRows("vacances", [["label", "", "Période de vacances"], ["debut", "date", "Début des vacances"], ["reprise", "date", "Reprise des cours"]])}</div>
      <button data-add="vacances" title="Ajouter des vacances\n• début : le samedi où elles commencent\n• reprise : le jour de la rentrée">+ Ajouter des vacances</button></div>
    <div class="card"><h2>Jours et demi-journées sans cours</h2><p class="hint">Fériés, ponts, journées banalisées, sorties, conseils de classe : les fiches sont marquées « pas de cours » (toute la journée, ou seulement le matin ou l’après-midi).</p>
      <div class="lhead l2 l3m"><span>Motif</span><span>Date</span><span>Quand</span></div><div class="liste l2 l3m">${listRows("joursSansCours", [["label", "", "Motif du jour sans cours"], ["date", "date", "Date du jour sans cours"], ["moment", "moment", "Moment sans cours"]])}</div>
      <button data-add="joursSansCours" title="Ajouter un jour sans cours\nFérié, pont, journée banalisée : la fiche de ce jour est marquée « pas de cours ».">+ Ajouter un jour</button></div></div>`;
  if (cle === "eleves") return `<div class="card"><div class="row"><h2 style="margin:0">Élèves du suivi collectif</h2><span class="chip">${S.eleves.length} sur ${MAX_ELEVES} possibles</span><span class="spacer"></span>
      ${boutonsImport("el", S.eleves.length < MAX_ELEVES)}</div>
    <p class="hint">Choisissez chaque élève dans la liste de la classe (tapez les premières lettres). Glissez une carte par sa poignée ⋮⋮ pour changer l’ordre sur les fiches (les saisies suivent l’élève). Un élève qui quitte le dispositif garde ses résultats : indiquez sa date de fin.</p>
    ${S.classeEleves.some(e => e.nom.trim()) ? "" : `<p class="avis-inline">⚠ <b>La liste de la classe n’est pas encore réglée</b> (<a href="#reglages/classeEntiere">Élèves et groupes</a>). Vous pouvez taper les noms ici, mais sans elle : les groupes et options des élèves sont inconnus (chacun suit l’emploi du temps de toute la classe), et ils ne sont pas reliés aux suivis individuels ni à la fiche de classe.</p>`}
    <datalist id="liste-classe-coll">${S.classeEleves.filter(e => e.nom.trim()).map(e => `<option value="${esc(e.nom)}">`).join("")}</datalist>
    <div class="el-liste">${S.eleves.map((e, i) => { const hors = e.nom.trim() && e.fin && e.fin < aujourdhui();
      const inconnu = e.nom.trim() && S.classeEleves.some(x => x.nom.trim()) && !S.classeEleves.some(x => sansAccent(x.nom) === sansAccent(e.nom));
      return `<div class="el-carte${hors ? " hors" : ""}" data-el-i="${i}"><span class="poignee" data-glisse-el="${i}" title="Changer l’ordre\nGlissez la carte vers le haut ou le bas.\n• les croix suivent l’élève">⋮⋮</span><span class="av" aria-hidden="true">${esc(initiales(e.nom)) || i + 1}</span>
        ${inp(`eleves.${i}.nom`, 'class="nom" list="liste-classe-coll" autocomplete="off" placeholder="NOM Prénom" title="Élève ' + (i + 1) + '\nChoisi dans la liste de la classe (NOM Prénom), tel qu’imprimé sur les fiches."', `Nom et prénom de l’élève ${i + 1}`)}
        <details class="menu el-dates" data-eld="${i}"${elDatesOuvert === i ? " open" : ""}><summary class="chip${e.debut && e.fin && e.fin < e.debut ? " alerte" : e.debut || e.fin ? " acc" : ""}" title="Période de suivi\n${libelleSuivi(e)}\n• cliquez pour la modifier">${libelleSuivi(e)}</summary>
          <div class="pop"><b>Période de suivi</b><div class="champs"><label class="champ" title="Début du suivi\nPour un élève qui arrive en cours d’année.">À partir du ${dateInp(`eleves.${i}.debut`, `Début du suivi de l’élève ${i + 1}`)}</label><label class="champ" title="Fin du suivi\nPour un élève qui quitte le dispositif : ses résultats sont gardés.">Jusqu’au ${dateInp(`eleves.${i}.fin`, `Fin du suivi de l’élève ${i + 1}`)}</label></div>
          ${e.debut && e.fin && e.fin < e.debut ? `<p class="avis-inline">⚠ La fin est avant le début : vérifiez les dates.</p>` : ""}<p class="hint">Vides : suivi pendant toute la période.</p></div></details>
        <details class="menu plus el-menu"><summary aria-label="Actions sur l’élève ${i + 1}" title="Actions\n• monter, descendre\n• supprimer">⋯</summary><div class="pop">
          <button data-el="up.${i}" ${i ? "" : "disabled"}>Monter</button><button data-el="down.${i}" ${i < S.eleves.length - 1 ? "" : "disabled"}>Descendre</button>
          <button data-el="del.${i}" class="danger" ${S.eleves.length > 1 ? "" : "disabled"} title="Supprimer l’élève\nEfface aussi ses croix, commentaires et absences.\n• s’il quitte le dispositif, préférez une date de fin">Supprimer…</button></div></details>${inconnu ? `<span class="el-inconnu" title="Pas dans la liste de la classe\nCet élève reste dans le suivi collectif, mais :\n• ses groupes et options sont inconnus : il suit l’emploi du temps de toute la classe\n• il n’est relié ni à un suivi individuel ni à la fiche de classe\nVérifiez l’orthographe, ou ajoutez-le dans Réglages › Élèves et groupes.">⚠ pas dans la liste de la classe</span>` : ""}</div>`; }).join("")}</div>
    <button class="ajout" data-el="add.0" ${S.eleves.length < MAX_ELEVES ? "" : "disabled"} title="Ajouter un élève\n• ${MAX_ELEVES} élèves au plus\n• arrivée en cours d’année : indiquez ensuite sa date de début">+ Ajouter un élève</button></div>`;
  if (cle === "suivisIndiv") {
    const m = S.courrielIndiv, ex = S.individuels[0], cy = ex ? cyclesIndiv(ex) : [], c = cycleCourant(cy);
    return `<div class="card"><h2>Remise des fiches individuelles</h2>
    <div class="champs"><label class="champ" title="Jour de remise par défaut\nL’élève dépose sa fiche ce jour-là en fin de journée ; la suivante commence au jour de cours suivant (le lundi après un vendredi, la rentrée après des vacances).\n• ex. jeudi si le professeur principal ne travaille pas le vendredi\n• un suivi peut avoir son propre jour">Jour de remise <select data-num="remiseIndiv" aria-label="Jour de remise des fiches individuelles">${JOURS_REMISE.map((j, k) => `<option value="${k + 1}" ${(S.remiseIndiv || 5) === k + 1 ? "selected" : ""}>${j}</option>`).join("")}</select></label></div>
    <p class="hint">Chaque fiche couvre les jours de cours jusqu’au jour de remise (vacances sautées). ${S.individuels.filter(i => i.remise).length ? `Suivi${S.individuels.filter(i => i.remise).length > 1 ? "s" : ""} avec un jour propre : ${S.individuels.filter(i => i.remise).map(i => `${esc(i.nom)} (${JOURS_REMISE[i.remise - 1]})`).join(", ")}.` : "Tous les suivis utilisent ce jour."}</p></div>
  <div class="card"><h2>Consigne imprimée sur les fiches individuelles</h2>
    <div class="champs"><label class="champ" title="Consigne choisie\nImprimée sous le nom de l’élève, sur chaque fiche individuelle.\n• les modèles se modifient juste en dessous">Consigne choisie <select data-num="consigneIndivChoisie" aria-label="Consigne des fiches individuelles">${S.consignesIndiv.map((m, i) => `<option value="${i}" ${i === S.consigneIndivChoisie ? "selected" : ""}>${esc(m.label.trim() || "Modèle " + (i + 1))}</option>`).join("")}</select></label></div>
    ${ex && c ? `<p class="apercu" style="white-space:pre-line"><b>Aperçu (${esc(ex.nom)}) :</b>\n<i>${esc(consigneIndiv(ex, c))}</i></p>` : ""}
    <details class="modeles"><summary>Modifier les modèles de consigne (${S.consignesIndiv.length})</summary><p class="hint">Mots remplacés : « [référent] » par le nom du professeur principal, « [jour] » par le jour de remise de la fiche, « [reprise] » par le jour où l’élève reçoit la fiche suivante (1er jour de cours après la remise : le lundi après un vendredi, la rentrée après des vacances). Un retour à la ligne = une nouvelle ligne sur la fiche.</p>
    ${S.consignesIndiv.map((m, i) => `<div class="lrow lc">${inp(`consignesIndiv.${i}.label`, 'title="Intitulé du modèle\nAffiché dans la liste « Consigne choisie »."', `Intitulé du modèle ${i + 1}`)}<textarea rows="4" data-path="consignesIndiv.${i}.texte" aria-label="Texte du modèle ${i + 1}" title="Texte imprimé\n• [référent] : nom du professeur principal\n• [jour] : jour de remise de la fiche\n• [reprise] : jour où l’élève reçoit la fiche suivante">${esc(m.texte)}</textarea><button class="ghost danger" data-del="consignesIndiv.${i}" ${S.consignesIndiv.length > 1 ? "" : "disabled"} title="Supprimer ce modèle de consigne" aria-label="Supprimer le modèle ${i + 1}">✕</button></div>`).join("")}
    <div class="row"><button data-add="consignesIndiv" ${S.consignesIndiv.length < 20 ? "" : "disabled"}>+ Ajouter un modèle</button><span class="spacer"></span><button class="ghost" data-act="consignes-indiv-defaut" title="Revenir aux modèles proposés\nRemplace les modèles actuels par les ${CONSIGNES_INDIV_DEFAUT.length} modèles proposés (Ctrl+Z pour annuler).">Revenir aux modèles proposés</button></div></details></div>
  <div class="card"><h2>Fin d’un suivi individuel</h2><p class="hint">Aide à la décision affichée sur chaque suivi (« Évolution d’une fiche à l’autre ») : la fin du suivi est jugée envisageable quand chaque objectif atteint le seuil sur plusieurs fiches de suite. La décision revient à l’équipe.</p>
    <div class="champs"><label class="champ" title="Seuil de réussite\nPour chaque objectif, sur chaque fiche.">Réussite d’au moins <span class="row" style="gap:4px"><input type="number" min="50" max="100" step="5" data-num="finSuiviIndiv.seuil" value="${S.finSuiviIndiv.seuil}" style="width:70px" aria-label="Seuil de réussite pour la fin du suivi"> %</span></label>
      <label class="champ" title="Fiches de suite\nLe seuil doit être tenu sur ce nombre de fiches consécutives.">sur <span class="row" style="gap:4px"><input type="number" min="1" max="10" data-num="finSuiviIndiv.fiches" value="${S.finSuiviIndiv.fiches}" style="width:60px" aria-label="Nombre de fiches de suite"> fiches de suite</span></label>
      <label class="champ row" style="gap:8px;align-self:end" title="Sans « ${esc(S.codage[3].code)} »\nAucun « ${esc(S.codage[3].sens)} » sur ces fiches."><input type="checkbox" data-bool="finSuiviIndiv.sansI" ${S.finSuiviIndiv.sansI ? "checked" : ""}> et sans aucun « ${esc(S.codage[3].code)} »</label></div></div>
  <div class="card"><h2>Courriel à la famille</h2><p class="hint">Sur la page d’un suivi individuel : « Copier l’objet » et « Copier le message » (texte mis en forme, à coller dans l’ENT ou une messagerie), ou « Ouvrir la messagerie ». Mots remplacés : « [élève] » (Prénom NOM), « [période] », « [référent] », « [classe] », « [établissement] », « [bilan] » (objectifs et réussite, remarques des enseignants, bilan du professeur principal). **texte** = gras.</p>
    <div class="champs" style="display:block"><label class="champ" title="Objet du courriel">Objet <input type="text" data-path="courrielIndiv.objet" value="${esc(m.objet)}" aria-label="Objet du courriel" style="width:100%"></label>
    <label class="champ" style="margin-top:10px" title="Message du courriel">Message <textarea rows="6" data-path="courrielIndiv.texte" aria-label="Message du courriel" style="width:100%">${esc(m.texte)}</textarea></label></div>
    ${ex && c ? `<div class="apercu apercu-courriel"><b>Aperçu (${esc(ex.nom)}) :</b><p><b>Objet :</b> ${esc(texteCourriel(m.objet, ex, c))}</p><div class="msg">${texteCourriel(m.texte, ex, c, true)}</div></div>` : ""}
    <div class="row"><button class="ghost" data-act="courriel-indiv-defaut" title="Revenir au message proposé">Revenir au message proposé</button></div></div>
  <div class="card"><div class="row"><h2 style="margin:0">Objectifs types des fiches individuelles</h2><span class="chip">${S.banqueObjectifs.length}</span></div>
    <p class="hint">Proposés par le bouton ☰ « Choisir dans la liste » d’un suivi individuel, puis adaptables à l’élève. Formulés du point de vue de l’élève (« Je… »). Le thème sert à les regrouper.</p>
    <div class="lhead lbq"><span>Thème</span><span>Objectif</span></div>
    <div class="liste lbq">${S.banqueObjectifs.map((b, i) => `<div class="lrow">${inp(`banqueObjectifs.${i}.groupe`, `list="themes-obj" title="Thème\nRegroupe les objectifs dans la liste."`, `Thème de l’objectif type ${i + 1}`)}${inp(`banqueObjectifs.${i}.texte`, 'title="Objectif type\nFormulé du point de vue de l’élève : « Je… »."', `Objectif type ${i + 1}`)}<button class="ghost danger" data-del="banqueObjectifs.${i}" title="Retirer de la liste\nLes suivis qui l’utilisent déjà ne changent pas." aria-label="Retirer l’objectif type ${i + 1}">✕</button></div>`).join("")}</div>
    <datalist id="themes-obj">${[...new Set(S.banqueObjectifs.map(b => b.groupe).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join("")}</datalist>
    <div class="row"><button data-add="banqueObjectifs" ${S.banqueObjectifs.length < 80 ? "" : "disabled"} title="Ajouter un objectif type">+ Ajouter un objectif type</button><span class="spacer"></span><button class="ghost" data-act="banque-defaut" title="Revenir à la liste proposée\nRemplace la liste actuelle par les ${BANQUE_OBJ_DEFAUT.length} objectifs proposés (Ctrl+Z pour annuler).">Revenir à la liste proposée</button></div></div>`;
  }
  if (cle === "classeEntiere") {
    const grHoteK = new Set(((hoteClasse && hoteClasse.groupes) || []).map(cleNom));
    const gr = S.groupes.filter(g => g.nom), horsListe = [...S.eleves.filter(e => e.nom.trim()).map(e => e.nom), ...S.individuels.map(i => i.nom).filter(Boolean)].filter((n, i, l) => l.indexOf(n) === i && groupesDe(S, n) === null);
    return `${HOTE ? classeHoteHTML(horsListe) : `<div class="card"><div class="row"><h2 style="margin:0">Élèves de la classe</h2><span class="chip">${S.classeEleves.length} sur ${MAX_CLASSE} possibles</span><span class="spacer"></span>
      ${boutonsImport("cl", S.classeEleves.length < MAX_CLASSE)}</div>
    <p class="hint">Toute la classe, une ligne par élève, avec ses groupes et options : les élèves des fiches individuelles et collectives y sont retrouvés par leur nom, et elle sert à la fiche de classe.${gr.length ? " Cochez les groupes et options de chaque élève ; un clic sur le nom d’un groupe le coche ou le décoche pour toute la classe." : " Pour des demi-groupes ou des options, créez-les plus bas : une colonne à cocher s’ajoutera ici."}</p>
    ${gr.length ? `<div class="lhead lcl${gr.length ? " avec-gr" : ""}${gr.length > 6 ? " beaucoup" : ""}" style="--ng:${gr.length}"><span></span><span>NOM Prénom</span>${gr.map(g => `<button type="button" class="ghost grcol" data-grcol="${esc(g.nom)}" title="${esc(g.nom)}\nCocher ou décocher pour toute la classe.">${esc(g.nom)}</button>`).join("")}<span title="Arrivée, départ\nPour un élève qui arrive ou quitte la classe en cours d’année.">Dates</span><span></span></div>` : ""}
    <div class="liste lcl${gr.length ? " avec-gr" : ""}${gr.length > 6 ? " beaucoup" : ""}" style="--ng:${gr.length}">${S.classeEleves.map((e, i) => `<div class="lrow"><span class="num">${i + 1}</span>${inp(`classeEleves.${i}.nom`, 'placeholder="NOM Prénom" title="Élève ' + (i + 1) + '\nNOM Prénom, tel qu’imprimé sur les fiches."', `Élève ${i + 1} de la classe`)}${gr.map(g => `<label class="grc" title="${esc(e.nom)} : ${esc(g.nom)}"><input type="checkbox" data-grel="${i}" data-g="${esc(g.nom)}" ${(e.groupes || []).includes(g.nom) ? "checked" : ""} aria-label="${esc(e.nom)} : ${esc(g.nom)}"></label>`).join("")}<details class="menu cl-dates"><summary class="chip${e.debut && e.fin && e.fin < e.debut ? " alerte" : e.debut || e.fin ? " acc" : ""}" title="Arrivée, départ\n${e.debut ? "arrivé(e) le " + fmtDM(e.debut) : "dès le début"} · ${e.fin ? "parti(e) le " + fmtDM(e.fin) : "jusqu’à la fin"}\n• cliquez pour modifier">${e.fin ? "parti " + fmtDM(e.fin) : e.debut ? "arrivé " + fmtDM(e.debut) : "dates"}</summary>
      <div class="pop"><b>${esc(e.nom) || "Élève " + (i + 1)}</b><div class="champs"><label class="champ" title="Arrivée dans la classe\nAvant : sa colonne est hachurée sur la fiche de classe.">Arrivé(e) le ${dateInp(`classeEleves.${i}.debut`, `Arrivée de l’élève ${i + 1}`)}</label><label class="champ" title="Départ de la classe\nAprès : sa colonne est hachurée ; ses codes déjà saisis sont gardés.">Parti(e) le ${dateInp(`classeEleves.${i}.fin`, `Départ de l’élève ${i + 1}`)}</label></div>
      ${e.debut && e.fin && e.fin < e.debut ? `<p class="avis-inline">⚠ Le départ est avant l’arrivée : vérifiez les dates.</p>` : ""}<p class="hint">Un élève qui part garde ses codes : préférez une date de départ au bouton ✕.</p></div></details><button class="ghost danger" data-del="classeEleves.${i}" title="Retirer de la classe\nSes codes sur la fiche de classe sont effacés.\n• s’il quitte la classe en cours d’année, indiquez plutôt sa date de départ (« dates »)" aria-label="Retirer l’élève ${i + 1}">✕</button></div>`).join("")}</div>
    <button class="ajout" data-add="classeEleves" ${S.classeEleves.length < MAX_CLASSE ? "" : "disabled"} title="Ajouter un élève à la classe">+ Ajouter un élève</button>
    ${horsListe.length ? `<p class="hint" style="color:var(--warn)">Pas dans cette liste (ils suivent tous les cours) : ${horsListe.map(esc).join(", ")}.</p>` : ""}</div>`}
  <div class="card"><h2>Groupes et options</h2><p class="hint">Toute la classe n’a pas toujours le même emploi du temps : demi-groupes (groupe 1, groupe 2, parfois groupe 3), langues, options (latin…). Créez-les ici, cochez les élèves ci-dessus, puis dans l’<a href="#edt">emploi du temps</a> choisissez « Pour : <i>groupe</i> » sous la palette pour partager un créneau. Sur toutes les fiches, un élève qui n’a pas le cours a sa case hachurée.</p>
    ${HOTE ? `<p class="hint">Les groupes et options <b>venus de Suivi PP</b> s’y règlent (groupe de l’élève, options) ; ceux que vous créez ici servent à l’emploi du temps, et (pour partager un créneau de l’emploi du temps, par exemple) se cochent dans la liste ci-dessus.</p>` : ""}
    <div class="liste lgr">${S.groupes.map((g, i) => HOTE && grHoteK.has(cleNom(g.nom)) ? `<div class="lrow"><span class="nom-fixe" title="${esc(g.nom)}\nVenu de Suivi PP : il s’y règle.">${esc(g.nom)}</span><span class="small muted">${nbMot(S.classeEleves.filter(e => (e.groupes || []).includes(g.nom)).length, "élève")} · Suivi PP</span><span></span></div>` : `<div class="lrow">${inp(`groupes.${i}.nom`, 'placeholder="ex. Groupe 1, Latin" title="Nom du groupe ou de l’option\nCourt : il s’affiche dans l’emploi du temps.\n• le renommer met à jour l’emploi du temps et les élèves"', `Groupe ou option ${i + 1}`)}<span class="small muted">${nbMot(S.classeEleves.filter(e => (e.groupes || []).includes(g.nom)).length, "élève")}</span><button class="ghost danger" data-del="groupes.${i}" title="Supprimer le groupe\nSes cours partagés et ses élèves sont retirés." aria-label="Supprimer le groupe ${i + 1}">✕</button></div>`).join("")}</div>
    <button data-add="groupes" ${S.groupes.length < 12 ? "" : "disabled"}>+ Ajouter un groupe ou une option</button></div>`;
  }
  if (cle === "ficheClasse") return `  <div class="card"><h2>Règle de la semaine (fiche de classe hebdomadaire)</h2><p class="hint">Imprimée en bandeau « ATTENTION » sur la fiche de la semaine ; la ligne « Retenue (h) » est calculée pour chaque élève.</p>
    <div class="champs"><label class="champ" title="Remarques par retenue\n0 : pas de règle, pas de ligne « Retenue ».">Remarques cumulées <input type="number" min="0" max="20" data-num="retenueClasse.remarques" value="${S.retenueClasse.remarques}" style="width:70px" aria-label="Nombre de remarques pour une retenue"></label>
      <label class="champ" title="Durée de la retenue">= heures de retenue <input type="number" min="1" max="4" data-num="retenueClasse.heures" value="${S.retenueClasse.heures}" style="width:60px" aria-label="Heures de retenue"></label>
      <label class="champ row" style="gap:8px;align-self:end" title="Code positif\nChaque code positif (ex. « + ») annule une remarque de la semaine."><input type="checkbox" data-bool="retenueClasse.positifAnnule" ${S.retenueClasse.positifAnnule ? "checked" : ""}> un code positif annule une remarque</label></div>
    ${S.retenueClasse.remarques ? `<p class="apercu"><b>Bandeau imprimé :</b> ATTENTION — ${esc(regleRetenue())}</p>` : ""}</div>
  <div class="card"><h2>Codes de la fiche de classe</h2><p class="hint">L’enseignant n’écrit que ce qui pose problème : une case vide veut dire « rien à signaler ». Un code = une lettre (ou « + »). « ${CODE_ABSENT} » (absent) est toujours disponible.</p>
    <p class="hint"><b>Positif</b> : cochez-le pour un code qui récompense (encouragement, félicitations…). Un code positif ne compte pas comme incident, s’affiche en vert, et${S.retenueClasse.positifAnnule ? " annule une remarque dans la règle de la semaine" : " peut annuler une remarque (règle de la semaine ci-dessus)"}. Les autres codes sont des incidents.</p>
    <div class="lhead lcd"><span>Code</span><span>Signification</span><span>Positif</span></div>
    <div class="liste lcd">${S.codesClasse.map((c, i) => `<div class="lrow${c.positif ? " pos" : ""}">${inp(`codesClasse.${i}.code`, 'maxlength="1" class="code" title="Code\nUne seule lettre (ou « + »), tapée au clavier sur la fiche de classe."', `Code ${i + 1}`)}${inp(`codesClasse.${i}.sens`, 'title="Signification\nImprimée dans la légende de la fiche de classe."', `Signification du code ${i + 1}`)}<label class="pos-c" title="Code positif\nCoché : récompense (ne compte pas comme incident${S.retenueClasse.positifAnnule ? ", annule une remarque" : ""}).\nDécoché : incident."><input type="checkbox" data-bool="codesClasse.${i}.positif" ${c.positif ? "checked" : ""} aria-label="Code ${esc(c.code || String(i + 1))} positif"> ${c.positif ? "positif" : "incident"}</label><button class="ghost danger" data-del="codesClasse.${i}" title="Supprimer ce code" aria-label="Supprimer le code ${i + 1}">✕</button></div>`).join("")}</div>
    <button data-add="codesClasse" ${S.codesClasse.length < 10 ? "" : "disabled"} title="Ajouter un code\n10 au plus.">+ Ajouter un code</button></div>
  <div class="card"><h2>Bilan par matière (classe entière)</h2><p class="hint">Les matières signalées en rouge dans <a href="#classebilan">Classe entière › Bilan par matière</a> : celles qui dépassent la moyenne de la classe (incidents pour 10 cours) d’au moins ce pourcentage. Réglable aussi sur la page du bilan.</p>
    <div class="champs"><label class="champ" title="Seuil de signalement\n• 0 % : toutes les matières au-dessus de la moyenne\n• 50 % : 1,5 fois la moyenne\n• 100 % : le double">Signaler à partir de la moyenne + <span class="row" style="gap:4px"><input type="number" min="0" max="300" step="5" data-num="seuilBilanClasse" value="${S.seuilBilanClasse}" style="width:70px" aria-label="Seuil de signalement du bilan par matière de la classe"> %</span></label></div></div>`;
  if (cle === "matieres") {
    const h = (t, m) => S.edt[t].reduce((a, d) => a + d.filter(c => c.mat === m || (c.grp || []).some(x => x.mat === m)).length, 0);   // créneaux partagés par groupe compris
    return `<div class="card"><h2>Matières et enseignants</h2><p class="hint">L’enseignant s’affiche automatiquement sur les fiches selon la matière. La couleur sert dans l’emploi du temps.</p>
    <div class="lhead lm"><span></span><span>Matière</span><span>Enseignant</span><span title="Cours par semaine
Semaine A · semaine B">Cours A · B</span></div>
    <div class="liste lm">${S.matieres.map((m, i) => { const a = h("A", m.nom), b = h("B", m.nom), manque = m.nom.trim() && !m.prof.trim() && a + b;
      return `<div class="lrow"><span class="pt-mat" style="${styleMat(m.nom)}" aria-hidden="true" title="Couleur de la matière\nDans l’emploi du temps."></span>${inp(`matieres.${i}.nom`, 'aria-label="Matière" title="Matière\nLa renommer ici met à jour l’emploi du temps et les fiches."')}${inp(`matieres.${i}.prof`, `aria-label="Enseignant" placeholder="${manque ? "à indiquer" : "ex. Mme DUPRÉ"}"${manque ? ' class="manque" title="Enseignant à indiquer\nCette matière est dans l’emploi du temps : son enseignant s’affiche sur les fiches."' : ' title="Enseignant\nAffiché automatiquement sur les fiches, selon la matière."'}`)}
        <span class="small muted" title="Créneaux par semaine dans l’emploi du temps\n• semaine A : ${a}\n• semaine B : ${b}">${a + b ? `${a} · ${b}` : "—"}</span><button class="ghost danger" data-del="matieres.${i}" title="Supprimer la matière\n• si elle est utilisée, une confirmation est demandée" aria-label="Supprimer la matière ${esc(m.nom)}">✕</button></div>`; }).join("")}</div>
    <button data-add="matieres" title="Ajouter une matière\nElle apparaît ensuite dans la palette de l’emploi du temps.">+ Ajouter une matière</button></div>
  <datalist id="liste-profs">${[...new Set([...S.matieres.map(m => m.prof.trim()), ...S.changementsProf.map(c => c.prof.trim())].filter(Boolean))].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
  <div class="card"><h2>Changement d’enseignant à partir d’une date</h2><p class="hint">Un enseignant remplacé durablement (mutation, congé long, nouveau collègue) : son nom change sur les fiches à partir de cette date ; les fiches d’avant gardent l’ancien. Pour un emploi du temps refait, voir la page <a href="#edt">Emploi du temps</a> (« Nouveau à partir du… »).</p>
    ${S.changementsProf.length ? `<div class="lhead lchg"><span>Matière</span><span>À partir du</span><span>Nouvel enseignant</span></div>` : ""}
    <div class="liste lchg">${S.changementsProf.map((c, i) => `<div class="lrow"><select data-path="changementsProf.${i}.mat" aria-label="Matière, ligne ${i + 1}"><option value="">— matière —</option>${S.matieres.filter(m => m.nom.trim()).map(m => `<option${m.nom === c.mat ? " selected" : ""}>${esc(m.nom)}</option>`).join("")}</select>${dateInp(`changementsProf.${i}.depuis`, `À partir du, ligne ${i + 1}`)}${inp(`changementsProf.${i}.prof`, 'list="liste-profs" placeholder="M. …"', `Nouvel enseignant, ligne ${i + 1}`)}
      <button class="ghost danger" data-del="changementsProf.${i}" title="Supprimer ce changement" aria-label="Supprimer le changement ${i + 1}">✕</button></div>${c.mat && c.prof ? `<p class="hint" style="margin:0 0 6px">${esc(c.mat)} : ${esc(profDe(S, c.mat, c.depuis ? addDays(c.depuis, -1) : S.debut)) || "?"} → <b>${esc(c.prof)}</b>${c.depuis ? ` à partir du ${fmtDM(c.depuis)}` : " (date à indiquer)"}</p>` : ""}`).join("")}</div>
    <button data-add="changementsProf" title="Ajouter un changement d’enseignant\nMatière, date, nouvel enseignant.">+ Ajouter un changement</button></div>
  <div class="card"><h2>Absences longues d’un enseignant</h2><p class="hint">Un enseignant absent plusieurs jours : ses cours sont annulés (rien à noter, sur toutes les fiches), ou assurés par un remplaçant dont le nom s’affiche. Pour un seul cours, cliquez plutôt la matière sur la fiche du jour.</p>
    ${S.absencesProf.length ? `<div class="lhead labs"><span>Enseignant</span><span>Du</span><span>Au (inclus)</span><span>Remplaçant <small>(vide : cours annulés)</small></span></div>` : ""}
    <div class="liste labs">${S.absencesProf.map((a, i) => `<div class="lrow">${inp(`absencesProf.${i}.prof`, 'list="liste-profs" placeholder="M. …" title="Enseignant absent\nTel qu’indiqué dans les matières."', `Enseignant absent, ligne ${i + 1}`)}${dateInp(`absencesProf.${i}.du`, `Début de l’absence, ligne ${i + 1}`)}${dateInp(`absencesProf.${i}.au`, `Fin de l’absence, ligne ${i + 1}`)}${inp(`absencesProf.${i}.remplacant`, 'placeholder="cours annulés" title="Remplaçant\nSon nom remplace celui de l’enseignant sur les fiches.\n• vide : les cours sont annulés"', `Remplaçant, ligne ${i + 1}`)}
      <button class="ghost danger" data-del="absencesProf.${i}" title="Supprimer cette absence" aria-label="Supprimer l’absence ${i + 1}">✕</button></div>${a.prof && !S.matieres.some(m => m.prof.trim() === a.prof.trim()) && !S.changementsProf.some(c => c.prof.trim() === a.prof.trim()) ? `<p class="avis-inline" style="margin:0 0 6px">⚠ « ${esc(a.prof)} » n’enseigne aucune matière de la liste : vérifiez l’orthographe.</p>` : ""}${a.prof && a.du && !a.au ? `<p class="avis-inline" style="margin:0 0 6px">Indiquez la date de fin de l’absence : elle ne compte qu’avec ses deux dates.</p>` : ""}`).join("")}</div>
    <button data-add="absencesProf" title="Ajouter une absence longue\nEnseignant, dates, remplaçant éventuel.">+ Ajouter une absence</button></div>`;
  }
  if (cle === "fiche") return `<div class="card"><h2>Consigne imprimée sur la fiche collective</h2>
    <div class="champs"><label class="champ" title="Consigne choisie\nImprimée en haut de chaque fiche.\n• les modèles se modifient juste en dessous">Consigne choisie <select data-num="consigneChoisie" aria-label="Consigne choisie">${S.consignes.map((c, i) => `<option value="${i}" ${i === S.consigneChoisie ? "selected" : ""}>${esc(c.label.trim() || "Modèle " + (i + 1))}</option>`).join("")}</select></label></div>
    <p class="apercu"><b>Aperçu :</b> <i>${esc(consigneTexte(S))}</i></p>
    <details class="modeles"><summary>Modifier les modèles de consigne (${S.consignes.length})</summary><p class="hint">« [référent] » est remplacé par le nom du référent.</p>
    ${S.consignes.map((c, i) => `<div class="lrow lc">${inp(`consignes.${i}.label`, "", `Intitulé du modèle ${i + 1}`)}<textarea rows="2" data-path="consignes.${i}.texte" aria-label="Texte du modèle ${i + 1}">${esc(c.texte)}</textarea><button class="ghost danger" data-del="consignes.${i}" title="Supprimer ce modèle de consigne" aria-label="Supprimer le modèle ${i + 1}">✕</button></div>`).join("")}
    <button data-add="consignes">+ Ajouter un modèle</button></details></div>
  <div class="card"><h2>Objectifs du suivi collectif (${S.objectifs.length})</h2><p class="hint">De 1 à ${MAX_OBJ} objectifs, dans l’ordre des fiches. Le descriptif est imprimé sur la fiche. Supprimer un objectif efface ses croix.</p>
    <div class="liste">${S.objectifs.map((o, i) => `<div class="obj-carte"><span class="num" title="Objectif ${i + 1}\nSa place sur les fiches.">${i + 1}</span><div class="obj-champs">${inp(`objectifs.${i}.court`, 'class="court" title="Intitulé court\nImprimé sur chaque ligne de la fiche."', `Intitulé de l’objectif ${i + 1}`)}<textarea rows="2" data-path="objectifs.${i}.desc" aria-label="Descriptif de l’objectif ${i + 1}" placeholder="Descriptif : ce qu’on observe" title="Descriptif\nCe qu’on observe concrètement.\n• imprimé en haut de la fiche\n• rappelé en infobulle sur la fiche collective à l’écran">${esc(o.desc)}</textarea></div>
      <div class="obj-actions"><button class="ghost" data-ob="up.${i}" ${i ? "" : "disabled"} title="Monter l’objectif\nLes croix suivent l’objectif." aria-label="Monter l’objectif ${i + 1}">↑</button><button class="ghost" data-ob="down.${i}" ${i < S.objectifs.length - 1 ? "" : "disabled"} title="Descendre l’objectif\nLes croix suivent l’objectif." aria-label="Descendre l’objectif ${i + 1}">↓</button><button class="ghost danger" data-ob="del.${i}" ${S.objectifs.length > 1 ? "" : "disabled"} title="Supprimer l’objectif\nEfface aussi toutes ses croix (Ctrl+Z pour annuler)." aria-label="Supprimer l’objectif ${i + 1}">✕</button></div></div>`).join("")}</div>
    <button class="ajout" data-ob="add.0" ${S.objectifs.length < MAX_OBJ ? "" : "disabled"} title="Ajouter un objectif\n• ${MAX_OBJ} objectifs au plus\n• il s’ajoute en bas des fiches">+ Ajouter un objectif</button></div>`;
  if (cle === "pastilles") return `<div class="banner-info fort">Ces réglages concernent <b>uniquement les fiches individuelles et les fiches collectives</b>. La fiche de classe a ses propres codes d’incident : <a href="#reglages/ficheClasse">Réglages › Fiche de classe</a>.</div>
  <div class="card"><h2>Codes des niveaux — fiches individuelles et collectives</h2><p class="hint">4 niveaux, du plus positif au plus négatif ; les deux premiers font la « réussite ». Au clavier, comme pour les compétences : 4 pour le meilleur… 1 pour le plus faible. L’enseignant écrit ces codes sur les fiches individuelles et coche ces colonnes sur les fiches collectives.</p>
    <div class="codage">${S.codage.map((c, i) => `<div class="niv"><span class="pill" style="background:var(--lv${i});color:var(--c${i}, #222)" title="Touche ${4 - i}\n${["Le plus positif.\n• compte dans la « réussite »", "Positif.\n• compte dans la « réussite »", "À améliorer.\n• ne compte pas dans la « réussite »", "Le plus négatif.\n• jamais de pastille verte s’il y en a un"][i]}">${4 - i}</span>${inp(`codage.${i}.code`, 'maxlength="3" class="code" title="Code court\n1 à 3 caractères, imprimé en tête de colonne sur les fiches."', `Code du niveau ${i + 1}`)}${inp(`codage.${i}.sens`, 'title="Signification\nImprimée dans la légende des fiches."', `Signification du niveau ${i + 1}`)}</div>`).join("")}</div></div>
  <div class="card"><h2>Pastilles et seuils — fiches individuelles et collectives</h2><p class="hint">Pour les fiches individuelles (fiche en bref, bilan pour la famille) et le suivi collectif (fiche collective, totaux, bilan par matière). Aussi réglables depuis le bouton « Seuils » des totaux et du bilan.</p>${champsSeuils("rs")}<p style="margin-top:8px">${caseVertes()}</p></div>`;
  return "";
}
const boutonsImport = (pre, actif) => `<button data-act="${pre}-coller" title="Coller une liste\n• un nom par ligne (NOM Prénom)\n• ou des colonnes copiées depuis un tableur ou Pronote (Nom, Prénom…)\n• les lignes vides de la liste sont remplies d’abord" ${actif ? "" : "disabled"}>Coller une liste…</button>
      <button data-act="${pre}-fichier" title="Importer un fichier\n• CSV ou texte, tableur LibreOffice (.ods) ou Excel (.xlsx)\n• colonnes « Nom » et « Prénom », ou une colonne « Élève » / « Nom Prénom »\n• ${pre === "cl" ? "colonnes « Groupe », « Option »… : groupes et options importés aussi" : "les autres colonnes sont ignorées"}\n• aperçu avant l’import" ${actif ? "" : "disabled"}>Importer un fichier…</button>`;
function viewReglages(arg) {
  const rub = rubriquesReglages(), cles = rub.filter(Array.isArray).map(r => r[0]);
  if (arg === "groupes") arg = "classeEntiere";        // ancienne rubrique, réunie avec la liste de la classe
  const cle = cles.includes(arg) && arg !== "edt" ? arg : "classe";
  const alertes = [];
  if (S.debut && S.fin && S.fin < S.debut) alertes.push("La date de fin du suivi est antérieure à la date de début.");
  S.eleves.forEach((e, i) => { if (e.debut && e.fin && e.fin < e.debut) alertes.push(`Élève ${i + 1}${e.nom ? " (" + esc(e.nom) + ")" : ""} : la fin du suivi est antérieure à son début.`); });
  const sems = semaines(S);
  if (S.debut && S.fin && sems.length > 3 && !S.vacances.some(v => v.debut && v.reprise && v.debut <= S.fin && v.reprise >= S.debut))
    alertes.push(`Aucune période de vacances ne tombe dans la période du suivi : vérifiez les dates des vacances (bouton « Préremplir » pour l’année ${S.anneeScolaire}-${S.anneeScolaire + 1}, zone ${S.zone}).`);
  let groupe = "";
  const nav = rub.map(r => typeof r === "string" ? `<div class="rub-g">${(groupe = r)}</div>` : `<a href="${r[4] || "#reglages/" + r[0]}" class="${r[0] === cle ? "on" : ""}"${r[0] === cle ? ' aria-current="page"' : ""} title="${groupe} › ${r[1]}\n• ${r[2]}\n• ${r[3] ? "complet" : "**à compléter**"}${r[4] ? "\n• ouvre la page de l’emploi du temps" : ""}"><span class="i" aria-hidden="true"><svg viewBox="0 0 24 24">${ICO_REG[r[0]]}</svg></span><span><b>${r[1]}</b><small>${r[2]}</small></span><span class="etat ${r[3] ? "ok" : "at"}">${r[3] ? "✓" : "!"}</span></a>`).join("");
  return `<div class="page-tete"><div class="titres"><span class="surtitre">${S.classe ? "Classe " + esc(S.classe) : "Nouveau suivi"}</span><h1 data-titre>Réglages</h1></div></div>
  <div class="reg-cadre"><nav class="rub" aria-label="Rubriques des réglages">${nav}</nav>
  <section class="reg-contenu">${alertes.length ? `<div class="banner-off" role="alert">${alertes.join("<br>")}</div>` : ""}${rubriqueHTML(cle)}</section></div>`;
}
/* élèves : changer l'ordre en glissant une carte par sa poignée */
let glisseEl = null;
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("[data-glisse-el]"); if (!h || e.button !== 0) return;
  e.preventDefault(); glisseEl = { de: Number(h.dataset.glisseEl), vers: Number(h.dataset.glisseEl) };
  h.closest(".el-carte").classList.add("glisse"); document.body.classList.add("tracage");
});
document.addEventListener("pointermove", e => {
  if (!glisseEl) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest(".el-carte");
  document.querySelectorAll(".el-carte.cible").forEach(x => x.classList.remove("cible"));
  if (c) { glisseEl.vers = Number(c.dataset.elI); if (glisseEl.vers !== glisseEl.de) c.classList.add("cible"); }
});
document.addEventListener("pointerup", () => {
  if (!glisseEl) return;
  const { de, vers } = glisseEl; glisseEl = null; document.body.classList.remove("tracage");
  if (de === vers) { render(); return; }
  for (let i = de; i !== vers; i += vers > de ? 1 : -1) deplacerEleve(S, i, vers > de ? 1 : -1);
  commit(); toast("Ordre des élèves modifié. Ctrl+Z pour annuler.");
});
/* ---------- import de listes d'élèves : collage, fichier CSV ou texte, tableur (.ods, .xlsx) ----------
   Colonnes reconnues par leur titre (« Nom » + « Prénom », « Élève », « Nom Prénom », « Classe »…), sinon devinées ; modifiables avant l'import. */
const sansAccent = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();
const COL_NOM = /^(nom|noms|nom de famille|nom d'usage|nom usuel|nom de naissance|last ?name|surname|family ?name)$/;
const COL_PRENOM = /^(prenom|prenoms|prenom usuel|premier prenom|first ?name|given ?name)$/;
const COL_COMPLET = /^(eleve|eleves|nom prenom|nom et prenom|nom - prenom|nom, prenom|nom \/ prenom|nom complet|identite|nom de l'eleve|name|full ?name|student)$/;
const COL_CLASSE = /^(classe|division|groupe|class|div)$/;
/** Texte CSV ou collé depuis un tableur → lignes de cellules ; séparateur deviné (tabulation, point-virgule, virgule), guillemets gérés. */
function lireCsv(t) {
  t = String(t).replace(/^﻿/, "");
  const l1 = t.split(/\r?\n/).find(l => l.trim()) || "";
  const [sep, nb] = ["\t", ";", ","].map(s => [s, l1.split(s).length]).sort((a, b) => b[1] - a[1])[0];
  const sp = nb > 1 ? sep : null, lignes = []; let ligne = [], cel = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += ch; }
    else if (ch === '"' && !cel.trim()) { q = true; cel = ""; }
    else if (sp && ch === sp) { ligne.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; ligne.push(cel); lignes.push(ligne); ligne = []; cel = ""; }
    else cel += ch;
  }
  ligne.push(cel); lignes.push(ligne);
  return { sep: sp, lignes: lignes.map(l => l.map(c => c.replace(/\s+/g, " ").trim())).filter(l => l.some(Boolean)) };
}
const COL_GROUPE = /^(groupes?|demi[ -]?groupes?|options?|options? facultatives?|lv ?2|langue( vivante)?( 2)?|enseignements?( optionnels?| facultatifs?)?|specialites?|dispositifs?)$/;
/** Colonnes du nom et du prénom (-1 : nom complet dans la colonne du nom) ; les autres colonnes : groupes ou options reconnus par leur titre. */
function analyserListe(lignes) {
  const tete = (lignes[0] || []).map(sansAccent), trouve = re => tete.findIndex(c => re.test(c));
  let nom = trouve(COL_NOM), prenom = trouve(COL_PRENOM), complet = trouve(COL_COMPLET);
  const classe = (i => (i >= 0 && !COL_GROUPE.test(tete[i]) ? i : -1))(trouve(COL_CLASSE));   // « Groupe » est un groupe, pas une classe
  if (complet < 0) complet = tete.findIndex(c => /\bnom\b/.test(c) && /prenom/.test(c));
  const groupes = tete.map((c, i) => (COL_GROUPE.test(c) ? i : -1)).filter(i => i >= 0);
  const entete = [nom, prenom, complet, classe].some(i => i >= 0) || groupes.length > 0;
  if (entete) {
    if (nom < 0 && complet >= 0) { nom = complet; prenom = -1; }
    if (nom < 0) nom = Math.max(0, tete.findIndex((_, i) => i !== prenom && i !== classe && !groupes.includes(i)));
    return { entete, nom, prenom, groupes, classe };
  }
  // sans titres : deux premières colonnes faites de lettres = nom puis prénom ; sinon 1re colonne = « NOM Prénom »
  const lettres = /^[\p{L}][\p{L}' .-]*$/u;
  if (lignes.some(l => l.length > 1) && lignes.every(l => (!l[0] || lettres.test(l[0])) && (!l[1] || lettres.test(l[1])))) return { entete, nom: 0, prenom: 1, groupes: [] };
  return { entete, nom: 0, prenom: -1, groupes: [] };
}
/** Nom de groupe lu dans un fichier → celui de la liste s'il existe déjà (sans tenir compte des accents ni de la casse ; « G1 » = « Groupe 1 »). */
function nomGroupeImporte(v, connus) {
  let t = v.replace(/\s+/g, " ").trim(); if (!t) return "";
  const g = /^g(?:r(?:oupe|p)?)?\.?\s*(\d)$/i.exec(t); if (g) t = "Groupe " + g[1];
  return connus.find(x => sansAccent(x) === sansAccent(t)) || t.charAt(0).toUpperCase() + t.slice(1);
}
const caseRemplie = v => !!v && !/^(non|no|n|0|-|—|faux|false)$/i.test(v.trim());
/** Prénom écrit en capitales → « Jean-Pierre ». */
const casse = s => s === s.toLocaleUpperCase("fr") && /\p{Lu}{2}/u.test(s) ? s.toLocaleLowerCase("fr").replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("fr")) : s;
function nomImporte(l, m) {
  const n = l[m.nom] || "", p = m.prenom >= 0 ? l[m.prenom] || "" : "";
  if (m.prenom < 0) return n.replace(/\s*,\s*/, " ").trim();
  return [n.toLocaleUpperCase("fr"), casse(p)].filter(Boolean).join(" ");
}
/** Boîte de vérification : colonnes (nom, prénom, groupes et options), aperçu ; ajoute les élèves (lignes vides remplies d'abord)
    et, pour la liste de la classe, leurs groupes et options (complétés aussi pour les élèves déjà présents). */
async function importerEleves(cle, lignes, source) {
  const max = cle === "eleves" ? MAX_ELEVES : MAX_CLASSE, liste = S[cle], avecGroupes = cle === "classeEleves";
  if (!lignes.length) { informer("Aucun nom trouvé", "La liste est vide."); return; }
  const m0 = analyserListe(lignes), nbCol = Math.max(...lignes.map(l => l.length));
  const titreCol = i => `Colonne ${i + 1}${lignes[0][i] ? ` (« ${lignes[0][i].slice(0, 30)} »)` : ""}`;
  const optCol = (sel, aucune) => (aucune ? `<option value="-1"${sel < 0 ? " selected" : ""}>${aucune}</option>` : "") + Array.from({ length: nbCol }, (_, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${esc(titreCol(i))}</option>`).join("");
  const parNom = new Map(liste.map(e => [sansAccent(e.nom), e]).filter(([k]) => k));
  const usages = d => [...d.querySelectorAll("select[data-imp-col]")].map(x => ({ i: Number(x.dataset.impCol), u: x.value })).filter(x => x.u !== "ignorer");
  const calculer = d => {
    const tete = d.querySelector("#imp-tete").checked, m = { nom: Number(d.querySelector("#imp-nom").value), prenom: Number(d.querySelector("#imp-prenom").value) };
    const us = avecGroupes ? usages(d).filter(x => x.i !== m.nom && x.i !== m.prenom) : [], connus = S.groupes.map(g => g.nom).filter(Boolean), crees = [];
    const groupesDeLigne = l => { const r = [];
      for (const { i, u } of us) {
        const v = l[i] || "";
        const noms = u === "valeurs" ? v.split(/\s*(?:[,;\/+]|\bet\b)\s*/i).filter(Boolean) : caseRemplie(v) ? [lignes[0][i] || `Colonne ${i + 1}`] : [];
        for (const n of noms) { const g = nomGroupeImporte(n, [...connus, ...crees]); if (!g) continue; if (!connus.includes(g) && !crees.includes(g)) crees.push(g); if (!r.includes(g)) r.push(g); } }
      return r; };
    const vus = new Set(), nouveaux = [], majs = []; let doublons = 0;
    const cl = d.querySelector("#imp-classe") ? d.querySelector("#imp-classe").value : "";
    for (const l of lignes.slice(tete ? 1 : 0)) {
      if (cl === "?") break;          // plusieurs classes dans le fichier : rien tant que la classe n'est pas choisie
      if (cl && (l[m0.classe] || "").trim() !== cl) continue;
      const n = nomImporte(l, m), k = sansAccent(n); if (!n || vus.has(k)) { if (n) doublons++; continue; }
      vus.add(k); const gr = groupesDeLigne(l), e = parNom.get(k);
      if (e) { const plus = gr.filter(g => !(e.groupes || []).includes(g)); if (plus.length) majs.push({ e, nom: e.nom, plus }); else doublons++; }
      else nouveaux.push({ nom: n, groupes: gr });
    }
    const place = Math.max(0, max - liste.filter(e => e.nom.trim()).length), ajout = nouveaux.slice(0, place);
    const utiles = new Set([...ajout, ...majs].flatMap(x => x.groupes || x.plus));
    const nouveauxGr = crees.filter(g => utiles.has(g)).slice(0, Math.max(0, 12 - S.groupes.filter(g => g.nom).length));
    return { ajout, majs, trop: nouveaux.length - ajout.length, doublons, nouveauxGr, classe: cl && cl !== "?" ? cl : classesFichier.length === 1 ? classesFichier[0] : "" };
  };
  const apercu = d => { const r = calculer(d), gl = l => l && l.length ? ` <small class="muted">— ${l.map(esc).join(", ")}</small>` : "";
    if (d.querySelector("#imp-classe") && d.querySelector("#imp-classe").value === "?") { d.querySelector("#imp-apercu").innerHTML = `<p class="avis-inline">Ce fichier contient plusieurs classes : choisissez la vôtre ci-dessus.</p>`; d.querySelector('[data-r="oui"]').disabled = true; return; }
    d.querySelector("#imp-apercu").innerHTML = `<p><b>${r.ajout.length} élève${r.ajout.length > 1 ? "s" : ""} à ajouter</b>${r.majs.length ? ` · ${r.majs.length} déjà dans la liste, groupes complétés` : ""}${r.doublons ? ` · ${r.doublons} déjà dans la liste (rien à changer)` : ""}${r.trop ? ` · <span class="rouge-txt">${r.trop} au-delà de ${max} élèves (ignoré${r.trop > 1 ? "s" : ""})</span>` : ""}${r.nouveauxGr.length ? ` · groupes et options créés : <b>${r.nouveauxGr.map(esc).join(", ")}</b>` : ""}</p>
      <ol class="imp-noms">${r.ajout.map(x => `<li>${esc(x.nom)}${gl(x.groupes)}</li>`).join("")}${r.majs.map(x => `<li class="maj">${esc(x.nom)} <small class="muted">+ ${x.plus.map(esc).join(", ")}</small></li>`).join("")}</ol>`;
    d.querySelector('[data-r="oui"]').disabled = !r.ajout.length && !r.majs.length; };
  const autres = Array.from({ length: nbCol }, (_, i) => i).filter(i => avecGroupes && m0.entete && i !== m0.nom && i !== m0.prenom && i !== m0.classe);
  // export de plusieurs classes (Pronote…) : on ne garde que la classe choisie (celle du suivi par défaut)
  const classesFichier = m0.classe >= 0 ? [...new Set(lignes.slice(1).map(l => (l[m0.classe] || "").trim()).filter(Boolean))] : [];
  const normCl = v => sansAccent(v).replace(/[\s°ème-]/g, "");
  const classeDefaut = classesFichier.find(c => S.classe && normCl(c) === normCl(S.classe)) || (classesFichier.length === 1 ? classesFichier[0] : "");
  const choixClasse = classesFichier.length > 1 ? `<label class="champ" title="Classe à importer\nLe fichier contient plusieurs classes : seuls les élèves de celle-ci sont ajoutés.">Classe <select id="imp-classe">${classeDefaut ? "" : `<option value="?" selected>— choisissez votre classe —</option>`}<option value="">toutes les classes (${classesFichier.length})</option>${classesFichier.map(c => `<option${c === classeDefaut ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>` : "";
  const exemples = i => [...new Set(lignes.slice(1).map(l => l[i]).filter(Boolean))].slice(0, 4).map(v => `« ${esc(v.slice(0, 18))} »`).join(", ");
  const html = `<div class="imp">
    <label class="imp-tete"><input type="checkbox" id="imp-tete"${m0.entete ? " checked" : ""}> La première ligne contient les titres des colonnes</label>
    <div class="champs"><label class="champ" title="Colonne du nom\nLe nom de famille, ou « NOM Prénom » s’il n’y a pas de colonne de prénom.">Nom <select id="imp-nom">${optCol(m0.nom)}</select></label>
      <label class="champ" title="Colonne du prénom\n« aucune » : la colonne du nom contient déjà « NOM Prénom ».">Prénom <select id="imp-prenom">${optCol(m0.prenom, "aucune : NOM Prénom dans la même colonne")}</select></label>${choixClasse}</div>
    ${autres.length ? `<div class="imp-gr"><b>Groupes et options</b> <small class="muted">(les autres colonnes du tableau)</small>
      ${autres.map(i => `<label class="imp-gl"><span title="${esc(lignes[0][i] || "")}">${esc(lignes[0][i] || `Colonne ${i + 1}`)} <small class="muted">${exemples(i)}</small></span><select data-imp-col="${i}" title="Usage de la colonne\n• ignorer\n• groupes / options écrits : le contenu de la case (ex. « G1 », « Latin, Chorale »)\n• si case remplie : l’option porte le nom de la colonne (ex. « X », « oui »)" aria-label="Usage de la colonne ${esc(lignes[0][i] || String(i + 1))}">
        <option value="ignorer"${m0.groupes.includes(i) ? "" : " selected"}>ignorer</option><option value="valeurs"${m0.groupes.includes(i) ? " selected" : ""}>groupes / options écrits</option><option value="coche">« ${esc((lignes[0][i] || "").slice(0, 16))} » si case remplie</option></select></label>`).join("")}</div>` : ""}
    <div id="imp-apercu"></div></div>`;
  const r = await saisir("Importer une liste d’élèves", `${source} · ${lignes.length} ligne${lignes.length > 1 ? "s" : ""}${nbCol > 1 ? ` · ${nbCol} colonnes` : ""}. Vérifiez les colonnes : l’aperçu se met à jour.`,
    { html, init: d => { apercu(d); d.querySelector(".imp").addEventListener("change", () => apercu(d)); }, lire: d => calculer(d) }, { ok: "Importer" });
  if (!r || (!r.ajout.length && !r.majs.length)) return;
  for (const g of r.nouveauxGr) { const vide = S.groupes.find(x => !x.nom.trim()); if (vide) vide.nom = g; else S.groupes.push({ nom: g }); }
  const okGr = new Set(S.groupes.map(g => g.nom).filter(Boolean)), trier = l => l.filter(g => okGr.has(g)).sort((a, b) => ordreGr(a) - ordreGr(b));
  for (const x of r.ajout) { const e = liste.find(y => !y.nom.trim()) || (liste.push(cle === "eleves" ? { nom: "", debut: "", fin: "" } : { nom: "" }), liste[liste.length - 1]);
    e.nom = x.nom; if (avecGroupes) { const g = unSeulDemiGroupe(trier(x.groupes)); if (g.length) e.groupes = g; } }
  for (const x of r.majs) { const g = unSeulDemiGroupe(trier([...(x.e.groupes || []), ...x.plus])); if (g.length) x.e.groupes = g; }   /* un seul demi-groupe : celui déjà là, ou le premier */
  if (r.classe && !String(S.classe || "").trim()) S.classe = r.classe;   /* suivi neuf : la classe importée lui donne son nom */
  commit(); toast(`${r.ajout.length} élève${r.ajout.length > 1 ? "s" : ""} ajouté${r.ajout.length > 1 ? "s" : ""}${r.majs.length ? `, ${r.majs.length} avec des groupes complétés` : ""}${r.nouveauxGr.length ? ` ; groupes créés : ${r.nouveauxGr.join(", ")}` : ""}. Ctrl+Z pour annuler.`, 7000);
}
/** Coller une liste : un nom par ligne, ou des colonnes copiées d'un tableur (avec ou sans titres). */
async function collerEleves(cle = "eleves") {
  const max = cle === "eleves" ? MAX_ELEVES : MAX_CLASSE;
  const t = await saisir("Coller une liste d’élèves", `Un nom par ligne (NOM Prénom), ou des colonnes copiées depuis un tableur ou Pronote (Nom, Prénom, Classe…).\nLes lignes vides de la liste actuelle sont remplies d’abord ; ${max} élèves au plus.`, { valeur: "", lignes: 8, libelle: "Liste des noms", valider: v => v && v.trim() ? "" : "Collez au moins un nom (un par ligne)." }, { ok: "Continuer" });
  if (!t || !t.trim()) return;
  await importerEleves(cle, lireCsv(t).lignes, "Liste collée");
}
/** Lecture d'une entrée d'un fichier zip (tableur .ods / .xlsx). */
async function lireZip(buf, nom) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) return null;
  let p = v.getUint32(e + 16, true);
  for (let i = 0, n = v.getUint16(e + 10, true); i < n; i++) {
    const meth = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), off = v.getUint32(p + 42, true);
    if (new TextDecoder().decode(buf.subarray(p + 46, p + 46 + ln)) === nom) {
      const debut = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), brut = buf.subarray(debut, debut + taille);
      if (meth === 0) return new TextDecoder().decode(brut);
      if (typeof DecompressionStream === "undefined") throw new Error("navigateur trop ancien pour lire ce tableur");
      return new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    p += 46 + ln + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return null;
}
/** Première feuille d'un tableur LibreOffice (.ods) ou Excel (.xlsx) → lignes de cellules. */
async function lignesTableur(buf) {
  const xml = s => new DOMParser().parseFromString(s, "application/xml"), tous = (n, nom) => [...n.getElementsByTagNameNS("*", nom)];
  const ods = await lireZip(buf, "content.xml");
  if (ods) {
    const table = tous(xml(ods), "table")[0], lignes = [];
    if (!table) return [];
    for (const tr of tous(table, "table-row")) {
      const l = [];
      for (const c of tr.children) { if (!/table-cell$/.test(c.localName)) continue;
        const rep = Math.min(Number(c.getAttribute("table:number-columns-repeated")) || 1, 50), t = tous(c, "p").map(x => x.textContent).join(" ");
        for (let k = 0; k < rep; k++) l.push(t); }
      while (l.length && !l[l.length - 1]) l.pop();
      if (l.length) for (let k = 0, rep = Math.min(Number(tr.getAttribute("table:number-rows-repeated")) || 1, 200); k < rep; k++) lignes.push(l.map(x => x.replace(/\s+/g, " ").trim()));
      if (lignes.length > 2000) break;
    }
    return lignes;
  }
  const feuille = await lireZip(buf, "xl/worksheets/sheet1.xml");
  if (!feuille) throw new Error("tableur non reconnu");
  const partages = tous(xml((await lireZip(buf, "xl/sharedStrings.xml")) || "<sst/>"), "si").map(si => tous(si, "t").map(t => t.textContent).join(""));
  const col = r => [...r.replace(/\d+/g, "")].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return tous(xml(feuille), "row").map(row => { const l = [];
    for (const c of tous(row, "c")) { const t = c.getAttribute("t"), vv = tous(c, "v")[0];
      l[col(c.getAttribute("r") || "A")] = (t === "s" ? partages[Number(vv && vv.textContent)] : t === "inlineStr" ? tous(c, "t").map(x => x.textContent).join("") : vv ? vv.textContent : "") || ""; }
    return Array.from(l, x => (x || "").replace(/\s+/g, " ").trim()); }).filter(l => l.some(Boolean));
}
/** Sauvegarde de Plan de classe (.json, 2026-10-10) → le même tableau qu'un export : Nom · Prénom · Classe · Groupe · Options,
    une ligne par élève des vraies classes (les classes recomposées de Plan de classe, « virtuelles », ne sont pas des divisions).
    Liste blanche : rien d'autre n'est lu du fichier. L'aperçu habituel suit (choix de la classe s'il y en a plusieurs). */
function lignesPlanDeClasse(d) {
  const obj = v => v && typeof v === "object" && !Array.isArray(v), propres = o => Object.keys(o).filter(k => !["__proto__", "constructor", "prototype"].includes(k));
  if (!obj(d) || !obj(d.classes) || !obj(d.eleves)) throw new Error(d && d.app === "fiche-suivi-collective" ? "c’est un suivi de cette application : ouvrez-le par « Reprendre un suivi »" : "ce n’est pas une sauvegarde de Plan de classe (sections « classes » et « eleves » absentes)");
  const tags = obj(d.tags) ? d.tags : {}, nomTag = id => { const t = propres(tags).includes(String(id)) && obj(tags[id]) ? tags[id] : null; return t ? String(t.name || t.abbr || "").trim() : ""; };
  const lignes = [["Nom", "Prénom", "Classe", "Groupe", "Options"]];
  for (const cid of propres(d.classes)) { const c = d.classes[cid]; if (!obj(c) || c.virtual) continue;
    const classe = String(c.nom || cid).trim();
    for (const sid of Array.isArray(c.eleves) ? c.eleves : []) { const e = propres(d.eleves).includes(String(sid)) ? d.eleves[sid] : null;
      if (!obj(e) || !String(e.nom || "").trim()) continue;
      lignes.push([String(e.nom).trim(), String(e.prenom || "").trim(), classe, [1, 2, 3].includes(e.groupe) ? "Groupe " + e.groupe : "",
        (Array.isArray(e.tags) ? e.tags : []).map(nomTag).filter(Boolean).join(", ")]); } }
  if (lignes.length < 2) throw new Error("aucun élève dans ce fichier de Plan de classe");
  return lignes;
}
/** Importer un fichier : CSV ou texte (UTF-8, Windows, UTF-16), tableur .ods ou .xlsx, ou sauvegarde de Plan de classe (.json). */
function importerFichier(cle) {
  const f = document.createElement("input"); f.type = "file"; f.accept = ".csv,.txt,.tsv,.ods,.xlsx,.json";
  f.onchange = async () => {
    const fichier = f.files[0]; if (!fichier) return;
    try {
      const buf = new Uint8Array(await fichier.arrayBuffer());
      let lignes;
      if (buf[0] === 0x50 && buf[1] === 0x4B) lignes = await lignesTableur(buf);
      else if (buf[0] === 0xD0 && buf[1] === 0xCF) throw new Error("ancien format Excel (.xls) : enregistrez-le en .xlsx ou en CSV");
      else { let t;
        if (buf[0] === 0xFF && buf[1] === 0xFE) t = new TextDecoder("utf-16le").decode(buf);
        else try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder("windows-1252").decode(buf); }
        lignes = /^\s*\{/.test(t) ? lignesPlanDeClasse(JSON.parse(t)) : lireCsv(t).lignes; }
      await importerEleves(cle, lignes, `Fichier « ${fichier.name} »`);
    } catch (e) { informer("Import impossible", `Le fichier « ${fichier.name} » n’a pas pu être lu : ${e.message}.\n\nFormats acceptés : CSV ou texte (une ligne par élève), tableur LibreOffice (.ods) ou Excel (.xlsx), sauvegarde de Plan de classe (.json).`); }
  };
  f.click();
}

/* ---------- logo de l'établissement : glisser-déposer, coller (Ctrl+V) ou choisir un fichier ---------- */
/** Lit une image (fichier ou presse-papiers) : SVG gardé tel quel, image réduite à 600 px au plus (le fichier de suivi reste léger). */
async function lireLogo(f) {
  if (!f) return;
  const nom = (f.name || "").toLowerCase(), svg = f.type === "image/svg+xml" || nom.endsWith(".svg");
  if (!svg && !/^image\/(png|jpeg|webp|gif)$/.test(f.type) && !/\.(png|jpe?g|webp|gif)$/.test(nom)) { informer("Image non reconnue", "Choisissez une image JPG, PNG, WebP ou SVG."); return; }
  try {
    let url;
    if (svg) { const t = await f.text(); if (!/<svg[\s>]/i.test(t)) throw new Error("ce fichier SVG est illisible"); if (t.length > 1500000) throw new Error("image SVG trop lourde (1,5 Mo au plus)");
      const u8 = new TextEncoder().encode(t); let bin = ""; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      url = "data:image/svg+xml;base64," + btoa(bin); if (url.length >= 2400000) throw new Error("image SVG trop lourde (1,5 Mo au plus)"); }
    else { const img = await createImageBitmap(f), k = Math.min(1, (img.width > 4 * img.height ? 1600 : 600) / Math.max(img.width, img.height)), c = document.createElement("canvas");   /* bandeau allongé : plus de pixels en largeur */
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      url = f.type === "image/jpeg" || /\.jpe?g$/.test(nom) ? c.toDataURL("image/jpeg", 0.9) : c.toDataURL("image/png"); }
    S.etablissement.logo = url; commit(); toast("Logo enregistré : il apparaîtra en haut des impressions.");
  } catch (e) { informer("Logo non lu", "Impossible de lire cette image" + (/^(ce fichier|image SVG)/.test(e.message) ? " : " + e.message : " : le fichier est abîmé ou n’est pas une image JPG, PNG, WebP ou SVG") + "."); }
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-act="logo-choisir"], [data-act="logo-retirer"]'); if (!b || !S) return;
  if (b.dataset.act === "logo-retirer") { S.etablissement.logo = ""; delete S.etablissement.sansNom; commit(); return; } const i = $("#logo-fichier"); if (i) { i.value = ""; i.click(); } });
document.addEventListener("change", e => { if (S && e.target.id === "logo-fichier" && e.target.files[0]) lireLogo(e.target.files[0]); });
document.addEventListener("dragover", e => { const z = e.target.closest && e.target.closest("[data-logo-zone]"); if (!z) return; e.preventDefault(); z.classList.add("survol"); });
document.addEventListener("dragleave", e => { const z = e.target.closest && e.target.closest("[data-logo-zone]"); if (z) z.classList.remove("survol"); });
document.addEventListener("drop", e => { const z = e.target.closest && e.target.closest("[data-logo-zone]"); if (!z || !S) return; e.preventDefault(); z.classList.remove("survol");
  const f = [...(e.dataTransfer.files || [])][0]; if (f) lireLogo(f); });
// coller une image (ou le code d'un SVG) quand la zone du logo est choisie, ou n'importe où dans Réglages › Établissement si on n'écrit pas dans un champ
document.addEventListener("paste", e => { if (!S || current.view !== "reglages" || !document.querySelector("[data-logo-zone]")) return;
  const dansChamp = e.target.closest && e.target.closest("input, textarea, [contenteditable]"); if (dansChamp) return;
  const it = [...(e.clipboardData && e.clipboardData.items || [])], im = it.find(x => x.kind === "file" && x.type.startsWith("image/"));
  if (im) { e.preventDefault(); lireLogo(im.getAsFile()); return; }
  const t = e.clipboardData && e.clipboardData.getData("text/plain"); if (t && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t)) { e.preventDefault(); lireLogo(new File([t], "logo.svg", { type: "image/svg+xml" })); } });
/** En-tête des documents pour les familles et les équipes : logo et nom de l'établissement (rien s'ils ne sont pas réglés). */
const enteteEtab = (mini = false) => { const e = S.etablissement || {}; return e.logo || e.nom ? `<div class="etab-tete${mini ? " mini" : ""}${e.logo && e.sansNom ? " seul" : ""}">${e.logo ? `<img src="${e.logo}" alt="">` : ""}${e.nom && !(e.logo && e.sansNom && !(mini && logoMarge.src === e.logo && logoMarge.w < 4 * logoMarge.h)) ? `<span>${esc(e.nom)}</span>` : ""}</div>` : ""; };   /* petit en-tête : un logo complet peu allongé ne se lit pas, le nom est écrit à côté */   /* sansNom : le logo contient déjà le nom */

/* ---------- impression ---------- */
let impressionPreparee = false;
/* Nom proposé pour le PDF (Chrome reprend le titre de la page) : du plus général au plus précis.
   Ex. « Suivi 5E - Suivi collectif - Fiche du jour - lundi 12-10-2026 », « Suivi 5E - Suivi individuel - BRIDGE Michael - Fiche - du … au … ». */
const dateNom = d => d.split("-").reverse().join("-");
const suiviNom = () => "Suivi" + (S.classe && S.classe.trim() ? " " + S.classe.trim() : "");
/* Ordre fixe : ce qui ne change pas d'une version à l'autre d'abord (suivi, famille de fiches, élève), puis le type de document, puis la période. */
const nomPdf = (...parts) => [suiviNom(), ...parts].join(" - ").replace(/[\\/:*?"<>|]/g, "-");
const periodeSemaine = w => `semaine ${w.num} du ${dateNom(w.lundi)} au ${dateNom(w.jours.at(-1))}`;
const ficheImprimee = d => pagesFiche(d);   /* une ou plusieurs pages */
const famillePdf = () => "Suivi collectif";
const nomPdfFiches = jours => !jours.length ? nomPdf(famillePdf(), "Fiches") : jours.length === 1 ? nomPdf(famillePdf(), "Fiche du jour", `${fmtLong(jours[0]).split(" ")[0]} ${dateNom(jours[0])}`)
  : nomPdf(famillePdf(), "Fiches", (() => { const sems = semaines(S), w = semaineDuJour(sems, jours[0]);
      return w && w.jours.includes(jours[jours.length - 1]) ? periodeSemaine(w) : `du ${dateNom(jours[0])} au ${dateNom(jours[jours.length - 1])}`; })());
function nomPdfBilan() {
  const toutes = semaines(S), [a, b] = bornesBilan(toutes), w0 = toutes[a], w1 = toutes[b];
  return nomPdf("Suivi collectif", "Bilan par matière", a === b ? periodeSemaine(w0) : `semaines ${w0.num} à ${w1.num} du ${dateNom(w0.lundi)} au ${dateNom(w1.jours.at(-1))}`);
}
const nomPdfEdt = () => nomPdf("Emploi du temps", "semaines A et B" + (edtVersion && S.edtSuivants[edtVersion - 1] ? ` - à partir du ${dateNom(S.edtSuivants[edtVersion - 1].depuis)}` : ""));
/** Totaux à imprimer : le tableau des élèves du suivi collectif (le récapitulatif des incidents est avec la fiche de classe de la semaine). */
/* plus de 8 élèves : deux pages équilibrées (la moitié des élèves sur chacune, l'en-tête répété, le groupe à la fin) */
const pagesTotaux = wi => { const n = S.eleves.length, L = nbObj(S) + (nbObj(S) > 1 ? 1 : 0), N = n > 8 || (n + 1) * L > 46 ? Math.max(2, Math.ceil((n + 1) * L / 44)) : 1, per = Math.ceil(n / N);
  return N === 1 ? [totauxHTML(wi)] : [...Array(N).keys()].map(k => totauxHTML(wi, [k * per, Math.min(n, (k + 1) * per), k + 1, N])).filter((h, k) => k * per < n); };   // pages équilibrées selon la place
const nomPdfTotaux = wi => nomPdf("Suivi collectif", "Totaux", periodeSemaine(semaines(S)[wi]));
/* Logo et nom de l'établissement dans la marge haute des documents qui ne les ont pas déjà : ils ne prennent pas de place
   sur la page (les fiches à cocher les mettent dans la page, seulement s'il y a la place). Le logo est réduit à l'avance
   (image-set : sa hauteur imprimée est fixe, sa définition reste bonne). */
let logoMarge = { src: "", png: "", w: 1, h: 1 };
function preparerLogoMarge() {
  const l = S && S.etablissement && S.etablissement.logo; if (!l) { logoMarge = { src: "", png: "", w: 1, h: 1 }; return; } if (logoMarge.src === l) return;
  logoMarge = { src: l, png: "", w: 1, h: 1 }; const img = new Image();
  img.onload = () => { if (logoMarge.src !== l) return; const r = (img.naturalWidth || 1) / (img.naturalHeight || 1), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(Math.min(1200, 120 * r))); c.height = Math.max(1, Math.round(c.width / r));   /* proportions gardées, même pour un bandeau très allongé */
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    logoMarge.png = c.toDataURL("image/png"); logoMarge.w = c.width; logoMarge.h = c.height; };
  img.src = l;
}
apresRendu.push(preparerLogoMarge);
function pagesAvecEtab(htmlPages) {
  const e = S.etablissement || {}, png = e.logo && logoMarge.src === e.logo ? logoMarge.png : "", mm = 96 / 25.4, r = logoMarge.w / logoMarge.h;
  /* hauteur 4,5 mm × k (portrait : marge plus haute) ; 45 mm × k de large au plus à côté du nom, 110 mm quand le logo est seul (en-tête complet).
     Logo « qui contient déjà le nom » mais trop petit pour être lu (moins de 25 mm de large) : le nom est quand même écrit à côté. */
  const nomK = k => (e.nom && (!(png && e.sansNom) || Math.min(110, 4.5 * k * r) < 25) ? e.nom : ""), seul = !nomK(2);
  const dens = k => Math.max(logoMarge.h / (4.5 * k * mm), logoMarge.w / ((nomK(k) ? 45 * k : 110) * mm));
  const cont = k => [png && `image-set("${png}" ${dens(k).toFixed(3)}x)`, nomK(k) && JSON.stringify((png ? "  " : "") + nomK(k))].filter(Boolean).join(" "), contenu = cont(1);
  let st = document.getElementById("style-etab-marge"); if (!st) { st = document.createElement("style"); st.id = "style-etab-marge"; document.head.append(st); }
  const marge = (k, pb) => `@top-left { content: ${cont(k)}; font: 600 ${(7.5 * Math.min(k, 1.3)).toFixed(1)}pt ${policesDe(S).papier === "andika" ? '"Andika", sans-serif' : '"Latin Modern Roman", serif'}; color: #333; vertical-align: bottom; padding-bottom: ${pb}mm; }`;
  st.textContent = contenu ? `@page etabm { size: A4 landscape; margin: 8mm; ${marge(1, .6)} } @page etabmp { size: A4 portrait; margin: 14mm; ${marge(seul ? 2 : 1.5, 2)} } @page etabmc { size: A4 portrait; margin: 8mm; ${marge(1, .6)} }
    @media print { #print-area .page.etab-marge { page: etabm; } #print-area .page.etab-marge:has(.evol-imp:not(.large)), #print-area .page.etab-marge:has(.synth-imp.portrait), #print-area .page.etab-marge:has(.bilan-famille) { page: etabmp; } #print-area .page.etab-marge:has(.classe-sem) { page: etabmc; } }` : "";
  return htmlPages.map(h => `<div class="page sheet${contenu && !/etab-tete|data-sans-etab/.test(h) ? " etab-marge" : ""}">${h}</div>`).join("");
}
function printPages(htmlPages, nom) {
  htmlPages = htmlPages.filter(h => h);
  if (!htmlPages.length) { informer("Rien à imprimer", "Aucune page à imprimer ici (par exemple : une semaine sans aucun jour de cours)."); return; }
  const area = $("#print-area");
  area.innerHTML = pagesAvecEtab(htmlPages); typoNoeuds(area);
  impressionPreparee = true;
  if (nom) document.title = nom;
  window.print();
  impressionPreparee = false;
  updateStatus();                     // remet le titre habituel de la page
}
/** Pages à imprimer pour la vue affichée (Ctrl+P ou menu Imprimer du navigateur), et nom proposé pour le PDF. */
function pagesVueCourante() {
  if (!S) return { pages: [] };
  const sems = semaines(S);
  if (!sems.length) return { pages: [] };
  if (current.view === "fiche" && ficheDate) return { pages: pagesFiche(ficheDate), nom: nomPdfFiches([ficheDate]) };
  if (current.view === "classesem") { const wi = Number.isInteger(Number(current.arg)) && sems[Number(current.arg)] ? Number(current.arg) : Math.max(0, sems.indexOf(semaineDuJour(sems, ficheDate))); return { pages: [classeSemaineHTML(wi, false)], nom: nomPdf("Classe entière", "Fiche de la semaine", periodeSemaine(sems[wi])) }; }
  if (current.view === "indiv") { const [id, l] = String(current.arg || "").split(":"), ind = indivParId(id);
    const cy = ind ? cyclesIndiv(ind) : [], c = cy.find(x => x.fin === l) || cycleCourant(cy);
    if (!c) return { pages: [] }; return { pages: [indivHTML(ind, c, false)], nom: nomPdfIndiv(ind, [c]) }; }
  if (current.view === "totaux") { const wi = indexTotaux(sems, current.arg); return { pages: pagesTotaux(wi), nom: nomPdfTotaux(wi) }; }
  if (current.view === "bilan") return { pages: [bilanHTML()], nom: nomPdfBilan() };
  if (current.view === "edt") return { pages: [edtImpressionHTML()], nom: nomPdfEdt() };
  if (current.view === "reglages") return { pages: [] };
  if (current.view === "indivtous") return pagesParallele();
  if (current.view === "classesuivi" || current.view === "classebilan") return pagesSynthClasse();
  if (current.view === "eleve" || current.view === "conseil") return pagesSynthese();
  // sommaire : les fiches de la semaine choisie (par défaut, la semaine en cours, sinon la prochaine, sinon la dernière)
  const w = current.view === "sommaire" ? sems[semaineSommaire(sems)] : semaineCourante(sems);
  return { pages: fichesSemaine(w), nom: nomPdfFiches(w.jours.filter(d => !sansCours(S, d))) };
}
/** Semaine en cours ; avant le suivi la première, après le suivi la dernière. */
function semaineCourante(sems) {
  const today = aujourdhui();
  return sems.find(x => x.jours.includes(today)) || sems.find(x => x.jours.at(-1) >= today) || sems[sems.length - 1];
}
/** Fiches d'une semaine à imprimer : les jours sans cours sont sautés. */
function fichesSemaine(w) { return w.jours.filter(d => !sansCours(S, d)).flatMap(d => pagesFiche(d)); }
/** Jours de cours (fiches imprimables) entre deux dates incluses. */
function joursImprimables(du, au) { return ficheDates().filter(d => d >= du && d <= au && !sansCours(S, d)); }
const nbFiches = n => n ? n + (n > 1 ? " fiches" : " fiche") : "aucune fiche";
let periodeImpr = null;             // dernière période choisie pour imprimer plusieurs fiches (le temps de la séance)
/** Menu ▾ à côté du bouton Imprimer de la fiche collective : cette fiche, toute la semaine ou une période. */
function menuImpressionFiches(date, sems, w, wi) {
  const cours = sems.map(x => ({ x, jours: x.jours.filter(d => !sansCours(S, d)) })).filter(g => g.jours.length);
  const tous = cours.flatMap(g => g.jours);
  if (!tous.length) return "";
  const debutSem = w.jours.find(d => !sansCours(S, d)) || date, finSem = [...w.jours].reverse().find(d => !sansCours(S, d)) || date;
  let [du, au] = periodeImpr && tous.includes(periodeImpr[0]) && tous.includes(periodeImpr[1]) ? periodeImpr : [debutSem, finSem];
  if (!tous.includes(du)) du = tous.find(d => d >= du) || tous[tous.length - 1];
  if (!tous.includes(au)) au = [...tous].reverse().find(d => d <= au) || tous[0];
  const opts = v => cours.map(g => `<optgroup label="Semaine ${g.x.num} (${g.x.type})">${g.jours.map(d => `<option value="${d}" ${d === v ? "selected" : ""}>${fmtLong(d)}</option>`).join("")}</optgroup>`).join("");
  const nSem = w.jours.filter(d => !sansCours(S, d)).length;
  return `<details class="menu plus" id="m-print"><summary aria-label="Imprimer plusieurs fiches" title="Imprimer plusieurs fiches\n• toute la semaine\n• ou une période choisie (jours de cours seulement)">▾</summary>
    <div class="pop">
      <button data-act="print-day" data-date="${date}">Cette fiche <span class="kbd">Ctrl+P</span></button>
      <button data-act="print-week" data-w="${wi}" ${nSem ? "" : "disabled"}>Toute la semaine ${w.num} <span class="kbd">${nbFiches(nSem)}</span></button>
      <hr>
      <div class="aller periode-impr" role="group" aria-label="Imprimer les fiches d’une période">
        <span>Les fiches d’une période (jours de cours seulement)</span>
        <label>Du <select id="pr-du">${opts(du)}</select></label>
        <label>au <select id="pr-au">${opts(au)}</select></label>
        <button class="primary" data-act="print-periode">Imprimer <span id="pr-nb">${nbFiches(joursImprimables(du, au).length)}</span></button>
      </div>
    </div></details>`;
}
/** Met à jour le nombre de fiches quand la période change ; garde « du » avant « au ». */
function majPeriodeImpr(change) {
  const du = $("#pr-du"), au = $("#pr-au");
  if (du.value > au.value) { if (change === "pr-du") au.value = du.value; else du.value = au.value; }
  periodeImpr = [du.value, au.value];
  $("#pr-nb").textContent = nbFiches(joursImprimables(du.value, au.value).length);
}
async function imprimerPeriode() {
  const [du, au] = [$("#pr-du").value, $("#pr-au").value], jours = joursImprimables(du, au);
  if (!jours.length) return;
  $("#m-print").open = false;
  if (jours.length > 25 && !(await demander("Imprimer beaucoup de fiches ?", `${jours.length} fiches, soit ${jours.length} pages, du ${fmtLong(jours[0])} au ${fmtLong(jours[jours.length - 1])}.`, { ok: `Imprimer ${jours.length} pages` }))) return;
  $("#m-print").open = false;
  printPages(jours.flatMap(ficheImprimee), nomPdfFiches(jours));
}
/** Emploi du temps A et B, sur une page, pour l'affichage en classe ou le casier. */
function edtImpressionHTML() {
  const grille = t => `<h3 style="margin:6px 0 4px">Semaine ${t}</h3><table class="bil" style="width:100%;table-layout:fixed"><colgroup><col style="width:11%">${DAYS.slice(0, nbJours(S)).map(() => "<col>").join("")}</colgroup><thead><tr><th>Créneau</th>${DAYS.slice(0, nbJours(S)).map((d, jd) => `<th>${d}${jourParticulier(jd) ? `<br><small>⏱ ${jourParticulier(jd)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>
    ${creneauxActifs(S).map(p => [PERIODS[p], p]).map(([per, p]) => `<tr><th>${per}${horaire(p) ? `<br><small>${horaire(p)}</small>` : ""}</th>${DAYS.slice(0, nbJours(S)).map((_, d) => { if (d === 5 && p >= 4) return "<td></td>"; const c = EDTV()[t][d][p];
      if (c.grp && c.grp.length) return `<td>${[...c.grp.map(x => `<b>${esc(x.g)}</b> : ${esc(x.mat)}${x.salle ? " – " + esc(x.salle) : ""}`), ...(c.mat ? [`<b>autres</b> : ${esc(c.mat)}`] : [])].join("<br>")}</td>`;
      return `<td>${c.mat ? `<b>${esc(c.mat)}</b>${c.salle ? " – " + esc(c.salle) : ""}<br><small>${esc(profDe(S, c.mat, edtVersion && S.edtSuivants[edtVersion - 1] ? S.edtSuivants[edtVersion - 1].depuis : S.debut))}</small>` : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  return `<div class="f-head"><div class="f-title" role="heading" aria-level="2" data-titre style="text-align:left"><b>Emploi du temps${S.classe ? " – Classe " + esc(S.classe) : ""}${edtVersion && S.edtSuivants[edtVersion - 1] ? ` – à partir du ${fmtDM(S.edtSuivants[edtVersion - 1].depuis)}/${S.edtSuivants[edtVersion - 1].depuis.slice(0, 4)}` : ""}</b></div></div>${grille("A")}${grille("B")}`;
}
function imprimerVue() {
  if (!S) return;
  const p = pagesVueCourante();
  if (p.pages.length) printPages(p.pages, p.nom);
  else informer("Rien à imprimer", "Pour imprimer, ouvrez une fiche (individuelle, collective, de classe), les totaux, le bilan ou l’emploi du temps.");
}
window.addEventListener("beforeprint", () => {
  if (impressionPreparee || $("#print-area").innerHTML.trim()) return;   // pages déjà préparées par un bouton Imprimer
  const p = pagesVueCourante();
  document.title = p.nom || document.title.replace(/^• /, "");     // nom proposé pour le PDF (sans la puce « modifié ») ; remis par « afterprint »
  $("#print-area").innerHTML = p.pages.length ? pagesAvecEtab(p.pages)
    : `<div class="page sheet"><p>Rien à imprimer sur cette page. Pour imprimer, ouvrez une fiche (individuelle, collective, de classe), les totaux, le bilan ou l’emploi du temps de l’application.</p></div>`;
  typoNoeuds($("#print-area"));
});

/* ---------- clic simple ou cliquer-glisser : croix et absences ----------
   Le premier clic fixe le geste.
   Croix : sur une case vide, on coche ce code partout où l'on passe (même colonne de code pour
   chaque créneau survolé) ; sur une case déjà cochée, on efface.
   Absences (boutons M1…S3 d'un élève, cases « Enseignant absent ? ») : on allume ou on éteint
   tout ce qui est survolé ; les croix devenues sans objet sont effacées au relâchement, après
   une seule confirmation. */
const CIBLES = { x: "td[data-x]", eleve: "[data-absp]", prof: "[data-pabsth]", absd: "table.fiche td[data-x], table.fiche td[data-abs]" };
/** Élève et cours d'une case de la grille (case à cocher ou case hachurée d'absence). */
const elevePeriode = td => (td.dataset.x ? (([a, , c]) => [a, c])(td.dataset.x.split(".").map(Number)) : td.dataset.abs.split(".").map(Number));
/** Clic sur l'en-tête d'un code : toutes les cases de ce cours (élèves présents) prennent ce code ;
    si elles l'ont déjà toutes, elles sont effacées. */
function remplirColonne(p, l) {
  const cibles = [...document.querySelectorAll("table.fiche td[data-x]")].map(td => td.dataset.x.split(".").map(Number)).filter(x => x[2] === p && x[3] === l);
  if (!cibles.length) { toast(`Rien à cocher en ${PERIODS[p]} : aucun élève présent.`); return; }
  const tout = cibles.every(([s, o]) => croix(S, ficheDate, s, o, p) === l), j = jour(S, ficheDate, true);
  for (const [s, o] of cibles) { const k = `${s}.${o}.${p}`; if (tout) delete j.x[k]; else j.x[k] = l; peindreCroix(s, o, p, tout ? -1 : l); }
  commit(false);
  const code = S.codage[l].code, nbEl = new Set(cibles.map(x => x[0])).size;
  toast(tout ? `${PERIODS[p]} : croix « ${code} » effacées. Ctrl+Z pour annuler.` : `${PERIODS[p]} : tout en « ${code} » pour ${nbEl} élève${nbEl > 1 ? "s" : ""}. Ctrl+Z pour annuler.`);
}
/** Surligne, pendant un glisser au bouton droit, les cases d'un élève dans un cours. */
function marquerAbsence(s, p, on) {
  document.querySelectorAll(`table.fiche td[data-abs="${s}.${p}"]`).forEach(td => td.classList.add("pre-pres"));
  for (let o = 0; o < nbObj(S); o++) for (let l = 0; l < 4; l++) {
    const td = document.querySelector(`td[data-x="${s}.${o}.${p}.${l}"]`); if (td) td.classList.add(on ? "pre-abs" : "pre-pres");
  }
}
let trace = null;                   // { type, on/lvl, vus: Set } pendant un glisser
function peindreCroix(s, o, p, lvl) {
  for (let l = 0; l < 4; l++) {
    const td = document.querySelector(`td[data-x="${s}.${o}.${p}.${l}"]`);
    if (!td) continue;
    td.classList.remove("l0", "l1", "l2", "l3");
    if (l === lvl) td.classList.add("l" + l);
    td.textContent = l === lvl ? (td.dataset.code || "X") : "";
    td.setAttribute("aria-checked", l === lvl);
  }
}
function tracer(el) {
  if (trace.type === "x") {
    const [s, o, p, l] = el.dataset.x.split(".").map(Number), k = `${s}.${o}.${p}`;
    // le glisser reste dans le créneau de départ : les autres cours survolés ne sont pas touchés ;
    // dans ce créneau, le code suit la case survolée (on peut dévier à gauche ou à droite)
    if (p !== trace.p0) return;
    const lvl = trace.lvl < 0 ? -1 : l;
    if (trace.vus.get(k) === lvl) return;
    trace.vus.set(k, lvl);
    if (lvl < 0) delete jour(S, ficheDate, true).x[k];
    else jour(S, ficheDate, true).x[k] = lvl;
    peindreCroix(s, o, p, lvl); majKpis();
  } else if (trace.type === "absd") {
    const [s, p] = elevePeriode(el), k = s + "." + p;
    if (trace.vus.has(k) || creneau(S, semaines(S), ficheDate, p).absent) return;
    // ne change que les cours qui ne sont pas déjà dans l'état voulu
    if (absCreneaux(S, ficheDate, s).includes(p) === trace.on) { trace.vus.set(k, false); return; }
    trace.vus.set(k, true); marquerAbsence(s, p, trace.on);
  } else if (trace.type === "eleve") {
    trace.vus.add(el.dataset.absp);
    el.classList.toggle("on", trace.on); el.setAttribute("aria-pressed", trace.on);
  } else {
    trace.vus.add(el.dataset.pabsth);
    el.querySelector("input").checked = trace.on;
  }
}
/* ---------- un cours en particulier : enseignant absent, ou remplacé (autre enseignant, autre matière), pour toutes les fiches ---------- */
/** Fenêtre « Cours de ce créneau » : cours normal, enseignant absent, ou remplacé par un enseignant et une matière au choix (noms nouveaux acceptés). */
async function editerCreneau(d, p) {
  const sems = semaines(S), j0 = S.jours[d] || {}, cr = creneau(S, sems, d, p);
  const w = semaineDuJour(sems, d), dj = (parseD(d).getUTCDay() + 6) % 7, base = w && dj < nbJours(S) ? edtPour(S, d)[w.type][dj][p] : { mat: "" };
  const edtMat = base.grp && base.grp.length ? [...base.grp.map(x => x.mat), ...(base.mat ? [base.mat] : [])].join(" / ") : base.mat, edtProf = base.mat ? profDe(S, base.mat) : "";
  const etat = cr.absent ? "absent" : (j0.prof && j0.prof[p]) || (j0.mat && p in j0.mat) ? "rempl" : "normal";
  const profs = [...new Set([...S.matieres.map(m => m.prof), ...Object.values(S.jours).flatMap(j => Object.values(j.prof || {}))].map(x => (x || "").trim()).filter(Boolean))].sort();
  const mats = [...new Set([...S.matieres.map(m => m.nom), "Permanence", "Étude", "Sortie scolaire", ...Object.values(S.jours).flatMap(j => Object.values(j.mat || {}))].filter(Boolean))];
  const html = `<div class="crn">
    <label class="crn-o"><input type="radio" name="crn" value="normal"${etat === "normal" ? " checked" : ""}><span><b>Cours normal</b><small>${edtMat ? `${esc(edtMat)}${edtProf ? " – " + esc(edtProf) : ""} (emploi du temps)` : "pas de cours à l’emploi du temps"}</small></span></label>
    <label class="crn-o"><input type="radio" name="crn" value="absent"${etat === "absent" ? " checked" : ""}><span><b>Enseignant absent</b><small>pas de cours : rien à noter sur ce créneau, sur toutes les fiches</small></span></label>
    <label class="crn-o"><input type="radio" name="crn" value="rempl"${etat === "rempl" ? " checked" : ""}><span><b>Remplacé</b><small>par un collègue de la classe dans une autre matière, ou par un collègue qui n’a pas la classe</small></span></label>
    <div class="crn-r"><label class="champ">Enseignant <input type="text" id="crn-prof" list="crn-profs" value="${esc((j0.prof && j0.prof[p]) || (etat === "rempl" ? cr.prof : ""))}" placeholder="ex. Mme LIMANDE" autocomplete="off"></label>
      <label class="champ">Matière ou activité <input type="text" id="crn-mat" list="crn-mats" value="${esc(etat === "rempl" ? cr.mat : edtMat || "")}" placeholder="ex. Permanence" autocomplete="off"></label>
      <datalist id="crn-profs">${profs.map(x => `<option value="${esc(x)}">`).join("")}</datalist><datalist id="crn-mats">${mats.map(x => `<option value="${esc(x)}">`).join("")}</datalist>
      <small class="muted">Choisissez dans la liste ou tapez un nouveau nom.</small></div></div>`;
  const v = await saisir(`${DAYS[dj]} ${fmtDM(d)} · ${PERIODS[p]}`, "Ce qui se passe sur ce créneau : les fiches individuelles, la fiche collective et la fiche de classe en tiennent compte.",
    { html, init: dlg => { const maj = () => { const r = dlg.querySelector('input[name="crn"]:checked').value === "rempl"; dlg.querySelector(".crn-r").classList.toggle("off", !r); if (r && !dlg.querySelector("#crn-prof").value) dlg.querySelector("#crn-prof").focus(); };
        dlg.querySelector(".crn").addEventListener("change", maj); dlg.querySelector(".crn").addEventListener("focusin", e => { if (e.target.closest(".crn-r")) dlg.querySelector('input[value="rempl"]').checked = true, dlg.querySelector(".crn-r").classList.remove("off"); }); maj();
        setTimeout(() => { const c = dlg.querySelector('input[name="crn"]:checked'); if (c && !dlg.querySelector(".crn-r").contains(document.activeElement)) c.focus(); }, 0); },
      lire: dlg => ({ etat: dlg.querySelector('input[name="crn"]:checked').value, prof: dlg.querySelector("#crn-prof").value.trim(), mat: dlg.querySelector("#crn-mat").value.trim() }),
      valider: v => v.etat === "rempl" && !v.prof && !(v.mat && v.mat !== edtMat) ? "Indiquez au moins l’enseignant ou la matière du remplacement." : "" }, { ok: "Enregistrer" });
  if (!v) return;
  const j = jour(S, d, true);
  if (v.etat === "absent") {
    if (!(await annulerCours(d, [p]))) return;
    delete j.prof[p]; delete j.mat[p];
  } else if (v.etat === "rempl") {
    delete j.profAbs[p];
    if (v.prof) j.prof[p] = v.prof; else delete j.prof[p];
    if (v.mat && v.mat !== edtMat) j.mat[p] = v.mat; else delete j.mat[p];
    if (!v.prof && !(p in j.mat)) { toast("Indiquez au moins l’enseignant ou la matière du remplacement."); return; }
  } else { delete j.profAbs[p]; delete j.prof[p]; delete j.mat[p]; }
  commit();
  toast(v.etat === "absent" ? `${PERIODS[p]} : enseignant absent.` : v.etat === "rempl" ? `${PERIODS[p]} : remplacé${v.prof ? " par " + v.prof : ""}${p in j.mat ? " (" + j.mat[p] + ")" : ""}.` : `${PERIODS[p]} : cours normal.`, 5000);
}
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-crn]")) { e.preventDefault(); e.target.click(); } });   /* cours d’un créneau : aussi au clavier */
document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-crn]"); if (!t || !S) return; const [d, p] = t.dataset.crn.split("|"); editerCreneau(d, Number(p)); });
/** Enseignant absent = cours annulé : ce qui était déjà noté sur ce créneau, sur TOUTES les fiches (collective, de classe, individuelles),
    est effacé après confirmation, pour que chaque vue compte la même chose. false si l'utilisateur refuse. */
/** Après une absence longue : les saisies déjà faites sur des cours désormais annulés sont effacées (après confirmation). false si refus. */
async function effacerCoursAnnules() {
  const sems = semaines(S), x = [], cl = [], ind = [];
  for (const w of sems) for (const d of w.jours) { const j = S.jours[d]; if (!j) continue;
    for (const p of creneauxDu(S, d)) { const cr = creneau(S, sems, d, p); if (profAbsent(S, d, p) || !(cr.absent || cr.divise && (cr.baseAbsent || cr.grp.some(g => g.absent)))) continue;   /* créneau partagé : élève par élève */
      for (const k of Object.keys(j.x || {})) if (Number(k.split(".")[2]) === p && coursPour(cr, groupesDe(S, (S.eleves[k.split(".")[0]] || {}).nom)).absent) x.push([j, k]);
      for (const k of Object.keys(j.cl || {})) if (Number(k.split(".")[1]) === p && coursPour(cr, (S.classeEleves[k.split(".")[0]] || {}).groupes || []).absent) cl.push([j, k]);   // les « A » seuls aussi (comme annulerCours)
      for (const i of S.individuels) if (i.saisies[`${d}.${p}`] && coursPour(cr, groupesDe(S, i.nom)).absent) ind.push([i, `${d}.${p}`]); } }
  const clCodes = cl.filter(([j, k]) => j.cl[k].replace(CODE_ABSENT, ""));
  if (!x.length && !clCodes.length && !ind.length) { cl.forEach(([j, k]) => delete j.cl[k]); return true; }   // seulement des absences d'élèves : effacées sans question
  if (!(await demander("Absence longue", `Des saisies existent déjà sur des cours qui sont maintenant annulés :\n${[ind.length && `• ${ind.length} cours de suivis individuels`, x.length && `• ${x.length} croix sur les fiches collectives`, clCodes.length && `• des codes de ${clCodes.length} élève${clCodes.length > 1 ? "s" : ""} sur les fiches de classe`].filter(Boolean).join("\n")}\n\nLes effacer ?`, { ok: "Effacer et enregistrer l’absence", danger: true }))) return false;
  x.forEach(([j, k]) => delete j.x[k]); cl.forEach(([j, k]) => delete j.cl[k]); ind.forEach(([i, k]) => delete i.saisies[k]);
  return true;
}
async function annulerCours(d, ps) {
  const j = jour(S, d, true), dans = k => ps.includes(Number(k));
  const x = Object.keys(j.x || {}).filter(k => dans(k.split(".")[2])), cl = Object.keys(j.cl || {}).filter(k => dans(k.split(".")[1]));
  const ind = S.individuels.flatMap(i => ps.filter(p => i.saisies[`${d}.${p}`]).map(p => [i, p]));
  const lignes = [ind.length && `• les codes de ${nbMot(new Set(ind.map(([i]) => i)).size, "suivi individuel", "suivis individuels")} (${[...new Set(ind.map(([i]) => i.nom || "élève"))].join(", ")})`,   /* ordre individuelles → collectives → classe ; la boîte échappe elle-même le texte */
    x.length && `• ${x.length} croix sur la fiche collective`, cl.filter(k => j.cl[k].replace(CODE_ABSENT, "")).length && `• des codes de ${nbMot(cl.filter(k => j.cl[k].replace(CODE_ABSENT, "")).length, "élève")} sur la fiche de classe`].filter(Boolean);
  if (lignes.length && !(await demander("Enseignant absent", `Des saisies existent déjà sur ${ps.length > 1 ? "ces créneaux" : "ce créneau"} :\n${lignes.join("\n")}\n\nCours annulé : les effacer et marquer l’enseignant absent ?`, { ok: "Effacer et marquer absent", danger: true }))) return false;
  x.forEach(k => delete j.x[k]); cl.forEach(k => delete j.cl[k]); ind.forEach(([i, p]) => delete i.saisies[`${d}.${p}`]);
  ps.forEach(p => { j.profAbs[p] = true; });
  return true;
}
const CROIX_ELEVE = n => demander("Élève absent", `Des croix sont déjà saisies sur ${n > 1 ? "ces cours" : "ce cours"}.\nLes effacer et marquer l’absence ?`, { ok: "Effacer les croix et marquer absent", danger: true });
/** Applique les absences tracées ; false si l'utilisateur refuse d'effacer des croix. */
async function appliquerAbsences(trace) {
  const j = jour(S, ficheDate, true);
  if (trace.type === "prof") {
    const pers = [...trace.vus].map(Number);
    if (trace.on) {
      if (!(await annulerCours(ficheDate, pers))) return false;
    } else pers.forEach(p => { delete j.profAbs[p]; });
    return true;
  }
  const listes = new Map();         // élève → nouvelle liste de créneaux
  for (const v of trace.vus) {
    const [s, p] = v.split(".").map(Number);
    const cur = listes.get(s) || absCreneaux(S, ficheDate, s);
    listes.set(s, trace.on ? [...new Set([...cur, p])].sort((a, b) => a - b) : cur.filter(x => x !== p));
  }
  const keys = Object.keys(j.x).filter(k => { const [s, , p] = k.split(".").map(Number); return listes.has(s) && listes.get(s).includes(p); });
  if (keys.length && !(await CROIX_ELEVE(new Set(keys.map(k => k.split(".")[2])).size))) return false;
  keys.forEach(k => delete j.x[k]);
  for (const [s, list] of listes) {
    absEdit.add(ficheDate + "." + s);           // garde les boutons M1…S3 affichés
    if (list.length) j.abs[s] = list; else delete j.abs[s];
  }
  return true;
}
/* Le geste ne s'applique pas à l'appui : un simple clic agit au relâchement sur la même case (on peut donc annuler
   en glissant hors de la case), un glisser agit dès qu'on quitte la première case.
   Au doigt : un balayage vertical fait défiler la page ; un appui long (0,35 s) ou un glisser horizontal coche. */
let droitEnCours = false, droitFini = 0;          // glisser au bouton droit (absences) : le menu contextuel ne doit pas agir en plus
document.addEventListener("pointerdown", e => {
  if (e.button === 2 && e.pointerType !== "touch" && S) {
    const td = e.target.closest && e.target.closest(CIBLES.absd);
    if (!td) return;
    const [s, p] = elevePeriode(td);
    if (creneau(S, semaines(S), ficheDate, p).absent) return;        // enseignant absent : message au clic droit
    e.preventDefault();
    droitEnCours = true;
    trace = { type: "absd", on: !absCreneaux(S, ficheDate, s).includes(p), vus: new Map(), depart: td, enAttente: false, mode: "peindre",
      x: e.clientX, y: e.clientY };
    document.body.classList.add("tracage");
    tracer(td);
    return;
  }
  if (e.button !== 0) return;
  const type = Object.keys(CIBLES).filter(t => t !== "absd").find(t => e.target.closest(CIBLES[t]));
  if (!type) return;
  const el = e.target.closest(CIBLES[type]);
  const tactile = e.pointerType === "touch";
  if (!tactile) e.preventDefault();            // pas de sélection de texte à la souris ; au doigt, le défilement reste possible
  if (type === "x" && !tactile) caseApresClic = el.dataset.x;     // après le clic, le clavier prend le relais sur cette case
  if (type === "x") {
    const [s, o, p, l] = el.dataset.x.split(".").map(Number);
    trace = { type, lvl: croix(S, ficheDate, s, o, p) === l ? -1 : l, p0: p, vus: new Map() };
  } else if (type === "eleve") trace = { type, on: !el.classList.contains("on"), vus: new Set() };
  else trace = { type, on: !el.querySelector("input").checked, vus: new Set() };
  Object.assign(trace, { depart: el, enAttente: true, tactile, mode: tactile ? "" : "peindre", t0: Date.now(),
    x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (!tactile) document.body.classList.add("tracage");
});
function commencerGlisser() {
  if (!trace.enAttente) return;
  trace.enAttente = false;
  document.body.classList.add("tracage");
  tracer(trace.depart);
}
document.addEventListener("pointermove", e => {
  if (!trace || trace.mode !== "peindre") return;
  // un mouvement rapide saute des cases entre deux événements : on parcourt le segment tous les 4 px
  const x0 = trace.x, y0 = trace.y, dx = e.clientX - x0, dy = e.clientY - y0;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let k = 1; k <= n; k++) {
    const el = document.elementFromPoint(x0 + dx * k / n, y0 + dy * k / n)?.closest(CIBLES[trace.type]);
    if (el && (el !== trace.depart || !trace.enAttente)) { commencerGlisser(); tracer(el); }
  }
  trace.x = e.clientX; trace.y = e.clientY;
});
// au doigt : on décide au premier mouvement s'il s'agit de faire défiler la page ou de cocher
document.addEventListener("touchmove", e => {
  if (!trace || !trace.tactile) return;
  const t = e.touches[0]; if (!t) return;
  if (!trace.mode) {
    const dx = t.clientX - trace.sx, dy = t.clientY - trace.sy;
    if (Date.now() - trace.t0 >= 350 || (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy))) trace.mode = "peindre";
    else if (Math.abs(dy) > 6) { trace = null; return; }              // défilement : le geste est abandonné
    else return;
  }
  if (trace.mode === "peindre" && e.cancelable) e.preventDefault();   // pas de défilement pendant qu'on coche
}, { passive: false });
async function finTrace(e) {
  if (!trace) return;
  const t = trace;
  if (t.type === "absd") { trace = null; droitEnCours = false; droitFini = Date.now(); document.body.classList.remove("tracage"); appliquerAbsencesDroit(t); return; }
  document.body.classList.remove("tracage");
  if (t.enAttente) {
    // simple clic (ou appui) : appliqué seulement si on relâche sur la case de départ
    const sous = e && e.type === "pointerup" && document.elementFromPoint(e.clientX, e.clientY);
    if (!(sous && sous.closest(CIBLES[t.type]) === t.depart)) { trace = null; return; }
    tracer(t.depart);
  }
  if (!t.vus.size) { trace = null; return; }
  if (t.type === "x") { trace = null; commit(false); return; }     // les cases sont déjà repeintes
  trace = null;
  if (await appliquerAbsences(t)) commit(); else render();  // refus : on revient à l'état précédent
}
document.addEventListener("pointerup", finTrace);
let caseApresClic = null;
document.addEventListener("pointerup", () => { if (!caseApresClic) return; const k = caseApresClic; caseApresClic = null;
  setTimeout(() => { const c = document.querySelector(`table.fiche td[data-x="${k}"]`); if (c && document.activeElement !== c) c.focus({ preventScroll: true }); }, 60); });
document.addEventListener("pointercancel", () => { if (trace && trace.enAttente) { trace = null; document.body.classList.remove("tracage"); } else finTrace(); });
window.addEventListener("blur", () => finTrace());
// Le clic qui suit le geste ne doit pas rebasculer la case « enseignant absent » (le clavier, lui, passe par « change »)
document.addEventListener("click", e => { if (e.detail && e.target.closest(CIBLES.prof)) e.preventDefault(); }, true);

/* ---------- événements ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-colx],[data-x],[data-act],[data-go],[data-gotot],[data-add],[data-del],[data-el],[data-ob],[data-absp],[data-sec],[data-rempl],[data-comb]");
  if (!t) return;
  if (t.dataset.colx) { const [p, l] = t.dataset.colx.split(".").map(Number); remplirColonne(p, l); return; }
  if (t.dataset.comb !== undefined) {
    const cle = ficheDate + "." + t.dataset.comb, com = ((S.jours[ficheDate] || {}).com || {})[t.dataset.comb];
    if (comOuverts.has(cle) && !com) comOuverts.delete(cle); else comOuverts.add(cle);
    render();
    const ta = document.querySelector(`textarea[data-com="${t.dataset.comb}"]`); if (ta) ta.focus();
    return;
  }
  if (t.dataset.rempl) { editerCreneau(ficheDate, Number(t.dataset.rempl)); return; }
  if (t.dataset.sec) { const c = document.getElementById(t.dataset.sec); if (c) c.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); return; }
  if (t.dataset.x) return;          // croix : gérées au pointeur (clic ou cliquer-glisser), voir plus bas
  else if (t.dataset.go) { location.hash = "#fiche/" + t.dataset.go; }
  else if (t.dataset.gotot !== undefined) { location.hash = "#totaux/" + t.dataset.gotot; }
  else if (t.dataset.add) {
    const key = t.dataset.add, blank = { vacances: { label: "", debut: "", reprise: "" }, joursSansCours: { label: "", date: "" },
      consignes: { label: "Nouveau modèle", texte: "" }, matieres: { nom: "", prof: "" }, classeEleves: { nom: "" }, groupes: { nom: "" }, codesClasse: { code: "", sens: "", positif: false }, banqueObjectifs: { groupe: "", texte: "" }, consignesIndiv: { label: "Nouveau modèle", texte: "" }, absencesProf: { prof: "", du: "", au: "", remplacant: "" }, changementsProf: { mat: "", depuis: "", prof: "" } }[key];
    if (key === "classeEleves" && S.classeEleves.length >= MAX_CLASSE) return;
    S[key].push(blank); commit();
    setTimeout(() => { const c = document.querySelector(`[data-path^="${key}.${S[key].length - 1}."]`); if (c) c.focus(); }, 0);   /* on tape tout de suite dans la nouvelle ligne */
  } else if (t.dataset.absp) {
    if (e.detail) return;           // souris ou doigt : géré au pointeur ; ici seulement le clavier
    const [s, p] = t.dataset.absp.split(".").map(Number), cur = absCreneaux(S, ficheDate, s);
    const next = cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p].sort((a, b) => a - b);
    absEdit.add(ficheDate + "." + s);
    if (await setAbsEleve(s, next)) commit();
  } else if (t.dataset.ob) {
    const [act, i] = t.dataset.ob.split("."), k = Number(i);
    if (act === "add") { if (S.objectifs.length < MAX_OBJ) S.objectifs.push({ court: "", desc: "" }); }
    else if (act === "up" || act === "down") deplacerObjectif(S, k, act === "up" ? -1 : 1);
    else if (act === "del") {
      const nom = S.objectifs[k].court || `l’objectif ${k + 1}`;
      if (!(await demander("Supprimer un objectif", donneesObjectif(S, k) ? `Supprimer « ${nom} » et toutes ses croix sur les fiches ?\n\nCtrl+Z permet d’annuler ensuite.` : `Supprimer « ${nom} » ?`, { ok: "Supprimer", danger: true }))) return;
      supprimerObjectif(S, k);
    }
    commit();
    if (act === "add") { const champ = document.querySelector(`input[data-path="objectifs.${S.objectifs.length - 1}.court"]`); if (champ) champ.focus(); }
  } else if (t.dataset.el) {
    const [act, i] = t.dataset.el.split("."), k = Number(i);
    if (act === "add") { if (S.eleves.length < MAX_ELEVES) { S.eleves.push({ nom: "", debut: "", fin: "" }); commit(); setTimeout(() => { const c = document.querySelector(`input[data-path="eleves.${S.eleves.length - 1}.nom"]`); if (c) c.focus(); }, 0); return; } }
    else if (act === "up" || act === "down") deplacerEleve(S, k, act === "up" ? -1 : 1);
    else if (act === "del") {
      const nom = S.eleves[k].nom || `l’élève ${k + 1}`;
      if (!(await demander("Supprimer un élève", donneesEleve(S, k) ? `Supprimer ${nom} et toutes ses saisies (croix, commentaires, absences) ?\n\nPour un élève qui quitte le dispositif, il vaut mieux indiquer une date de fin.` : `Supprimer ${nom} ?`, { ok: "Supprimer", danger: true }))) return;
      supprimerEleve(S, k); commit(); toast("Élève retiré du suivi collectif. Ctrl+Z pour annuler."); return;
    }
    commit();
  } else if (t.dataset.del) {
    const [key, i] = t.dataset.del.split(".");
    if (key === "vacances") { const avant = typesSemaines(); S.vacances.splice(Number(i), 1); garderTypeAB(avant); commit(); toast("Vacances retirées. Ctrl+Z pour annuler."); return; }
    if (key === "joursSansCours") { S.joursSansCours.splice(Number(i), 1); commit(); toast("Jour sans cours retiré. Ctrl+Z pour annuler."); return; }
    if (key === "absencesProf" || key === "changementsProf") { S[key].splice(Number(i), 1); commit(); toast((key === "absencesProf" ? "Absence retirée" : "Changement d’enseignant retiré") + ". Ctrl+Z pour annuler."); return; }   // les semaines gardent leur type A/B
    if (key === "consignes" && S.consignes.length <= 1) return;
    if (key === "matieres") {
      const nom = S.matieres[Number(i)].nom, n = usageMatiere(S, nom);
      if (n && !(await demander("Supprimer une matière", `« ${nom} » est utilisée dans ${n} créneau${n > 1 ? "x" : ""} de l’emploi du temps ou des fiches.\n\nSi vous la supprimez, ces créneaux garderont son nom (« hors liste ») sans enseignant. Pour changer seulement son nom, modifiez-le directement dans la case.`, { ok: "Supprimer quand même", danger: true }))) return;
    }
    if (key === "codesClasse") {         // code supprimé : retiré des fiches de classe (après confirmation s'il sert)
      const c = S.codesClasse[Number(i)].code, n = c ? Object.values(S.jours).reduce((a, j) => a + Object.values(j.cl || {}).filter(v => v.includes(c)).length, 0) : 0;
      if (n && !(await demander("Supprimer un code", `Le code « ${c} » (${S.codesClasse[Number(i)].sens}) est utilisé ${n} fois sur les fiches de classe : il en sera retiré.\n\nCtrl+Z permet d’annuler.`, { ok: "Supprimer", danger: true }))) return;
      if (c) for (const j of Object.values(S.jours)) for (const k of Object.keys(j.cl || {})) { j.cl[k] = j.cl[k].split(c).join(""); if (!j.cl[k]) delete j.cl[k]; }
    }
    if (key === "groupes") {             // un groupe supprimé : retiré des élèves et des créneaux partagés
      const g = S.groupes[Number(i)].nom, el = S.classeEleves.filter(e => (e.groupes || []).includes(g)).length;
      const cr = ["A", "B"].reduce((a, t) => a + toutesEdt(S).flatMap(E => E[t].flat()).filter(c => (c.grp || []).some(x => x.g === g)).length, 0);
      if (g && (el || cr) && !(await demander("Supprimer le groupe", `« ${g} » : ${nbMot(el, "élève")}, ${nbMot(cr, "créneau", "créneaux")} de l’emploi du temps. Ils lui seront retirés.\n\nCtrl+Z permet d’annuler.`, { ok: "Supprimer", danger: true }))) return;
      for (const e of S.classeEleves) if (e.groupes) { e.groupes = e.groupes.filter(x => x !== g); if (!e.groupes.length) delete e.groupes; }
      for (const E of toutesEdt(S)) for (const t of ["A", "B"]) for (const day of E[t]) for (const c of day) if (c.grp) { c.grp = c.grp.filter(x => x.g !== g); if (!c.grp.length) delete c.grp; }
      if (pinGroupe === g) pinGroupe = "";
    }
    if (key === "classeEleves") {        // les codes de la fiche de classe suivent les élèves : on décale les lignes suivantes
      const k = Number(i), aK = c => Object.values(S.jours).some(j => j[c] && Object.keys(j[c]).some(x => Number(x.split(".")[0]) === k)), a = aK("cl"), r = aK("clr");
      if ((a || r) && !(await demander("Supprimer un élève de la classe", `${S.classeEleves[k].nom || "Cet élève"} a ${a && r ? "des codes et des remarques" : a ? "des codes" : "des remarques"} sur la fiche de classe : ${a && r ? "ils" : a ? "ils" : "elles"} seront effacé${a ? "s" : "es"}.\n\nCtrl+Z permet d’annuler.`, { ok: "Supprimer", danger: true }))) return;
      for (const j of Object.values(S.jours)) { if (j.cl) { const n = {}; for (const [x, v] of Object.entries(j.cl)) { const [s, p] = x.split(".").map(Number); if (s < k) n[x] = v; else if (s > k) n[`${s - 1}.${p}`] = v; } j.cl = n; }
        if (j.clr) { const n = {}; for (const [c, v] of Object.entries(j.clr)) { const [s0, p] = c.split("."), s = Number(s0), suf = p === undefined ? "" : "." + p; if (s < k) n[s + suf] = v; else if (s > k) n[(s - 1) + suf] = v; } j.clr = n; } }
    }
    S[key].splice(Number(i), 1);
    if (key === "consignes" && S.consigneChoisie >= S.consignes.length) S.consigneChoisie = 0;
    if (key === "consignesIndiv" && S.consigneIndivChoisie >= Number(i) && S.consigneIndivChoisie > 0) S.consigneIndivChoisie--;
    commit();
    if (key === "classeEleves") toast("Élève retiré de la liste de la classe. Ctrl+Z pour annuler.");
  } else {
    const act = t.dataset.act;
    if (act === "new") doNew();
    else if (act === "new-pdc") { const avant = S; doNew().then(() => { if (S && S !== avant) importerFichier("classeEleves"); }); }
    else if (act === "open") openFile();
    else if (act === "rouvrir") rouvrirFichier();
    else if (act === "demo") doDemo();
    else if (act === "clear-day") {
      const mf = $("#m-fiche"); if (mf) mf.open = false;
      if (await demander("Effacer la journée", `Effacer toutes les croix du ${fmtLong(t.dataset.date)} ?\n\nLes commentaires et les absences sont gardés. Ctrl+Z permet d’annuler.`, { ok: "Effacer les croix", danger: true })) { const j = S.jours[t.dataset.date]; if (j) j.x = {}; commit(); }
    } else if (act === "print-synth") { const p = pagesSynthClasse(); printPages(p.pages, p.nom);
    } else if (act === "print-cl-sem") { const sems = semaines(S); printPages([classeSemaineHTML(Number(t.dataset.w), false)], nomPdf("Classe entière", "Fiche de la semaine", periodeSemaine(sems[Number(t.dataset.w)]))); }
    else if (act === "print-day") printPages(ficheImprimee(t.dataset.date), nomPdfFiches([t.dataset.date]));
    else if (act === "print-week") { const mp = $("#m-print"); if (mp) mp.open = false; const w = semaines(S)[Number(t.dataset.w)]; printPages(w.jours.filter(d => !sansCours(S, d)).flatMap(ficheImprimee), nomPdfFiches(w.jours.filter(d => !sansCours(S, d)))); }
    else if (act === "print-periode") imprimerPeriode();
    else if (act === "print-tot") printPages(pagesTotaux(Number(t.dataset.w)), nomPdfTotaux(Number(t.dataset.w)));
    else if (act === "print-bilan") printPages([bilanHTML()], nomPdfBilan());
    else if (act === "bil-tout") { periodeBilan = null; render(); }
    else if (act === "bil-per") { periodeBilan = [Number(t.dataset.de), Number(t.dataset.a)]; render(); }
    else if (act === "move-day") { const mf = $("#m-fiche"); if (mf) mf.open = false; deplacerJour(t.dataset.date); }
    else if (act === "print-edt") printPages([edtImpressionHTML()], nomPdfEdt());
    else if (act === "el-coller") collerEleves();
    else if (act === "el-fichier") importerFichier("eleves");
    else if (act === "cl-fichier") importerFichier("classeEleves");
    else if (act === "consignes-indiv-defaut") { if (await demander("Revenir aux modèles proposés", `Les ${S.consignesIndiv.length} modèles de consigne actuels seront remplacés par les ${CONSIGNES_INDIV_DEFAUT.length} modèles proposés.\n\nCtrl+Z permet d’annuler.`, { ok: "Remplacer", danger: true })) { S.consignesIndiv = CONSIGNES_INDIV_DEFAUT.map(([label, texte]) => ({ label, texte })); S.consigneIndivChoisie = 0; commit(); } }
    else if (act === "courriel-indiv-defaut") { S.courrielIndiv = { ...COURRIEL_INDIV_DEFAUT }; commit(); }
    else if (act === "banque-defaut") { if (await demander("Revenir à la liste proposée", `La liste actuelle des objectifs types (${S.banqueObjectifs.length}) sera remplacée par les ${BANQUE_OBJ_DEFAUT.length} objectifs proposés.\n\nLes suivis déjà créés ne changent pas. Ctrl+Z permet d’annuler.`, { ok: "Remplacer", danger: true })) { S.banqueObjectifs = BANQUE_OBJ_DEFAUT.map(([groupe, texte]) => ({ groupe, texte })); commit(); } }
    else if (act === "cl-coller") collerEleves("classeEleves");
    else if (act === "cal-preremplir") { const an = S.anneeScolaire, v = vacancesAnnee(an, S.zone);
      if (S.debut && anneeScolaireDe(S.debut) !== an && !(await demander("Préremplir le calendrier", `Le suivi commence le ${fmtDM(S.debut)}/${S.debut.slice(0, 4)}, dans l’année scolaire ${anneeScolaireDe(S.debut)}-${anneeScolaireDe(S.debut) + 1}, et non ${an}-${an + 1}.\n\nPréremplir quand même avec ${an}-${an + 1} ?`, { ok: "Préremplir quand même" }))) return;
      if (!(await demander("Préremplir le calendrier", `${v ? `Les vacances de la zone ${S.zone}` : "Pas de calendrier officiel connu pour les vacances de cette année : elles restent à saisir. "}${v ? " et les j" : "Les j"}ours fériés ${an}-${an + 1}${S.alsaceMoselle ? " (Alsace-Moselle)" : ""} remplacent ceux de la liste actuelle.\nLes autres jours sans cours (sorties, demi-journées…) sont gardés.`, { ok: "Préremplir" }))) return;
      const feries = new Set(["Armistice", "Toussaint", "Noël", "Vendredi saint (Alsace-Moselle)", "Lundi de Pâques", "Fête du travail", "Victoire 1945", "Ascension", "Pont de l’Ascension", "Lundi de Pentecôte", "Fête nationale"]);
      const avantAB = typesSemaines(); if (v) S.vacances = v; S.joursSansCours = [...feriesAnnee(an, S.alsaceMoselle), ...S.joursSansCours.filter(j => !(feries.has(j.label) && feriesAnnee(anneeScolaireDe(j.date), true).some(f => f.date === j.date)))]   /* un jour ajouté à la main garde sa place, même nommé « Armistice » */.sort((a, b) => (a.date < b.date ? -1 : 1)); garderTypeAB(avantAB); commit();
      toast(v ? "Vacances et jours fériés préremplis." : "Jours fériés préremplis ; les vacances sont à saisir."); }
    else if (act === "decoupage-auto") { S.decoupage.fins = []; commit(); }
    else if (act === "cal-annee") { const c = CALENDRIERS[S.anneeScolaire], w0 = typesSemaines();
      S.debut = c ? c.rentree : `${S.anneeScolaire}-09-01`; /* les jours avant la rentrée sont hors période */ S.fin = c ? addDays(c.ete, -1) : `${S.anneeScolaire + 1}-07-03`;
      garderTypeAB(w0);   // les semaines déjà là gardent leur type A/B
      commit(); toast(`Suivi du ${fmtDM(S.debut)} au ${fmtDM(S.fin)}.`); }
    else if (act === "edt-nouveau") {
      const dt = await saisir("Nouvel emploi du temps", "À partir de quel jour s’applique-t-il ? (en général un lundi)\nIl part d’une copie de l’emploi du temps affiché, à modifier ensuite.", { html: `<label class="champ">À partir du <input type="date" id="edtv-date"></label>`, init: d => d.querySelector("#edtv-date").focus(), lire: d => d.querySelector("#edtv-date").value }, { ok: "Créer" });
      if (!dt) return; if (dt <= S.debut) { informer("Date trop tôt", "Choisissez une date après le début du suivi : avant, c’est l’emploi du temps « dès le début » qui s’applique."); return; }
      if (S.edtSuivants.some(v => v.depuis === dt)) { informer("Déjà prévu", "Un emploi du temps commence déjà ce jour-là."); return; }
      if (S.edtSuivants.length >= 20) { informer("Trop de versions", "20 emplois du temps datés au plus : supprimez-en un avant d’en créer un autre."); return; }
      const src = edtPour(S, dt); S.edtSuivants.push({ depuis: dt, A: JSON.parse(JSON.stringify(src.A)), B: JSON.parse(JSON.stringify(src.B)) }); S.edtSuivants.sort((a, b) => (a.depuis < b.depuis ? -1 : 1));
      edtVersion = S.edtSuivants.findIndex(v => v.depuis === dt) + 1; commit(); toast(`Emploi du temps à partir du ${fmtDM(dt)} : modifiez-le ; les fiches d’avant gardent l’ancien.`, 6000); }
    else if (act === "edt-suppr") { if (!edtVersion) return; const v = S.edtSuivants[edtVersion - 1];
      if (!(await demander("Supprimer cette version", `Supprimer l’emploi du temps à partir du ${fmtDM(v.depuis)} ? Les fiches à partir de cette date reprendront le précédent.`, { ok: "Supprimer", danger: true }))) return;
      S.edtSuivants.splice(edtVersion - 1, 1); edtVersion = 0; commit(); }
    else if (act === "copy-ab") { if (await demander("Copier la semaine A", "Remplacer l’emploi du temps de la semaine B par une copie de la semaine A ?", { ok: "Remplacer la semaine B", danger: true })) { EDTV().B = JSON.parse(JSON.stringify(EDTV().A)); commit(); } }
  }
});
document.addEventListener("change", e => {
  dansChange = true;
  try { onChange(e); } finally { dansChange = false; }
});
async function onChange(e) {
  const t = e.target;
  if (t.id === "pick-day") { location.hash = "#fiche/" + t.value; return; }
  if (t.id === "pr-du" || t.id === "pr-au") { majPeriodeImpr(t.id); return; }
  if (t.id === "pick-week") { location.hash = "#totaux/" + t.value; return; }
  if (t.id === "tot-verts") { S.pastillesVertes = t.checked; commit(false); renderDiffere(); return; }
  if (t.id === "bil-de" || t.id === "bil-a") { periodeBilan = [Number($("#bil-de").value), Number($("#bil-a").value)]; renderDiffere(); return; }
  // vider le nom d'une matière, d'un groupe ou d'un code utilisé effacerait en silence l'emploi du temps ou des saisies : on passe par ✕ (qui demande confirmation)
  if (t.dataset.path && /^(matieres\.\d+\.nom|groupes\.\d+\.nom|codesClasse\.\d+\.code)$/.test(t.dataset.path) && !t.value.trim()) {
    const ancien = getPath(S, t.dataset.path), [quoi] = t.dataset.path.split(".");
    const sert = !ancien ? false : quoi === "matieres" ? toutesEdt(S).some(E => ["A", "B"].some(tt => E[tt].some(d => d.some(c => c.mat === ancien || (c.grp || []).some(x => x.mat === ancien))))) || Object.values(S.jours).some(j => Object.values(j.mat || {}).includes(ancien))
      : quoi === "groupes" ? S.classeEleves.some(e => (e.groupes || []).includes(ancien)) || toutesEdt(S).some(E => ["A", "B"].some(tt => E[tt].some(d => d.some(c => (c.grp || []).some(x => x.g === ancien)))))
      : Object.values(S.jours).some(j => Object.values(j.cl || {}).some(v => v.includes(ancien)));
    if (sert) { t.value = ancien; toast(`« ${ancien} » est utilisé${quoi === "matieres" ? " dans l’emploi du temps" : quoi === "groupes" ? " (élèves ou emploi du temps)" : " sur des fiches de classe"} : pour le supprimer, utilisez le bouton ✕ de sa ligne.`, 6000); return; }
  }
  // renommer une matière avec le nom d'une autre les fusionnerait sans le dire
  if (t.dataset.path && /^matieres\.\d+\.nom$/.test(t.dataset.path) && t.value.trim()) {
    const i = Number(t.dataset.path.split(".")[1]);
    if (S.matieres.some((m, k) => k !== i && m.nom.trim().toLowerCase() === t.value.trim().toLowerCase())) { toast(`La matière « ${t.value.trim()} » existe déjà.`); t.value = S.matieres[i].nom; return; }
  }
  if (t.dataset.path && /^codesClasse\.\d+\.code$/.test(t.dataset.path)) {   // un code = une lettre, en majuscule ; « A » est réservé à « absent »
    t.value = t.value.trim().slice(0, 1).toUpperCase();
    if (t.value === CODE_ABSENT || S.codesClasse.some((c, i) => c.code === t.value && `codesClasse.${i}.code` !== t.dataset.path) && t.value) {
      toast(t.value === CODE_ABSENT ? `« ${CODE_ABSENT} » est réservé à « absent ».` : `Le code « ${t.value} » existe déjà.`); t.value = getPath(S, t.dataset.path); return; }
    // les codes déjà saisis sur les fiches de classe suivent le nouveau code
    const ancien = getPath(S, t.dataset.path);
    if (ancien && t.value && ancien !== t.value) for (const j of Object.values(S.jours)) for (const k of Object.keys(j.cl || {})) j.cl[k] = j.cl[k].split(ancien).join(t.value);
  }
  if (t.dataset.path && /^absencesProf\.\d+\.(prof|du|au|remplacant)$/.test(t.dataset.path)) {
    if (t.type === "date" && dateEnSaisie(t)) {     // date tapée au clavier : rien n'est enregistré avant la sortie du champ (pas de « 0002-… », « Annuler » rétablit vraiment)
      if (!t.dataset.attente) { t.dataset.attente = "1"; t.addEventListener("blur", () => { delete t.dataset.attente; t.dispatchEvent(new Event("change", { bubbles: true })); }, { once: true }); }
      return; }
    if (t.type === "date" && !dateValide(t.value)) { t.value = getPath(S, t.dataset.path); toast("Date incomplète ou invalide. L’ancienne date est gardée."); return; }
    const avant = JSON.stringify(S.absencesProf); setPath(S, t.dataset.path, t.type === "date" ? t.value : t.value.trim().replace(/\s+/g, " "));
    const a = S.absencesProf[Number(t.dataset.path.split(".")[1])];
    if (a.du && a.au && a.au < a.du) { toast("La fin de l’absence est avant son début. L’ancienne date est gardée."); S.absencesProf = JSON.parse(avant); render(); return; }
    if (a.prof && a.du && a.au && !(await effacerCoursAnnules())) { S.absencesProf = JSON.parse(avant); render(); return; }
    commit(); return;
  }
  if (t.dataset.path && /^(matieres\.\d+\.prof|changementsProf\.\d+\.prof)$/.test(t.dataset.path)) t.value = t.value.trim().replace(/\s+/g, " ");   // « Mme SOLE » = « Mme SOLE  »
  if (t.dataset.path && /^horairesBase\.(matin|aprem)$/.test(t.dataset.path) && !t.value && !dateEnSaisie(t)) { t.value = getPath(S, t.dataset.path); toast("Indiquez une heure (le champ ne peut pas rester vide)."); return; }
  if (t.dataset.path === "decoupage.mode") { S.decoupage = { mode: t.value === "trimestres" ? "trimestres" : "semestres", fins: [] }; commit(); return; }   // autre découpage : dates proposées
  const mc = t.dataset.path && /^codage\.(\d)\.code$/.exec(t.dataset.path);
  if (mc) { const v = t.value.trim(), k = Number(mc[1]);   /* code de niveau : ni vide ni en double (les colonnes des fiches et les totaux en dépendent) */
    if (!v || S.codage.some((c, i) => i !== k && c.code.trim().toLowerCase() === v.toLowerCase())) { toast(v ? `Le code « ${v} » sert déjà à un autre niveau.` : "Un code de niveau ne peut pas être vide."); t.value = S.codage[k].code; return; } t.value = v; }
  const mp = t.dataset.path && /^(matieres|changementsProf)\.(\d+)\.prof$/.exec(t.dataset.path);
  if (mp) {                            // corriger le nom d'un enseignant : ses absences longues et ses remplacements y sont reliés par le nom
    const ancien = String(getPath(S, t.dataset.path) || "").trim(), nouveau = t.value, ici = S[mp[1]][Number(mp[2])], meme = v => !!v && v.trim() === ancien;
    if (ancien && nouveau && ancien !== nouveau) {
      const mats = S.matieres.filter(m => m !== ici && meme(m.prof)), chs = S.changementsProf.filter(c => c !== ici && meme(c.prof)), abs = S.absencesProf.filter(a => meme(a.prof) || meme(a.remplacant));
      const jrs = Object.values(S.jours).filter(j => Object.values(j.prof || {}).some(meme)), pl = (n, s1, s2) => `${n} ${n > 1 ? s2 : s1}`;
      const lieux = [abs.length && "les absences longues (" + pl(abs.length, "ligne", "lignes") + ")", mats.length && "d’autres matières (" + mats.map(m => m.nom).join(", ") + ")",
        chs.length && "les changements d’enseignant", jrs.length && "des remplacements notés sur les fiches (" + pl(jrs.length, "jour", "jours") + ")"].filter(Boolean);
      const rep = !lieux.length ? false : await demander("Corriger le nom partout ?", `« ${ancien} » figure aussi dans :\n${lieux.map(l => "• " + l).join("\n")}\n\n• Faute de frappe : « Corriger partout »${abs.length ? ", pour que ses absences s’appliquent toujours" : ""}\n• Autre enseignant : « Seulement ici »\n• Échap : ne rien changer\nCtrl+Z annule.`, { ok: "Corriger partout", annuler: "Seulement ici", echap: null });
      if (rep === null) { t.value = ancien; render(); return; }   /* Échap : le nom n'est pas changé */
      if (rep) {
        for (const m of mats) m.prof = nouveau; for (const c of chs) c.prof = nouveau;
        for (const a of abs) { if (meme(a.prof)) a.prof = nouveau; if (meme(a.remplacant)) a.remplacant = nouveau; }
        for (const j of jrs) for (const k in j.prof) if (meme(j.prof[k])) j.prof[k] = nouveau; }
    }
  }
  const mn = t.dataset.path && /^(classeEleves|eleves|individuels)\.(\d+)\.nom$/.exec(t.dataset.path);
  if (mn) {                            // corriger un nom : les fiches sont reliées par le nom, on propose de le corriger partout
    const ancien = String(getPath(S, t.dataset.path) || "").trim(), nouveau = t.value.trim(), meme = x => x && x.nom && x !== S[mn[1]][Number(mn[2])] && sansAccent(x.nom.trim()) === sansAccent(ancien);
    const ici = S[mn[1]][Number(mn[2])], dejaPris = k => S[k].some(x => x !== ici && x.nom && sansAccent(x.nom.trim()) === sansAccent(nouveau));
    if (nouveau && dejaPris(mn[1])) { toast(`« ${nouveau} » existe déjà dans cette liste : les fiches sont reliées par le nom, deux élèves ne peuvent pas porter le même. Ajoutez une initiale pour les distinguer.`, 7000); t.value = ancien; return; }
    const ailleurs = ancien && nouveau && sansAccent(ancien) !== sansAccent(nouveau) && !dejaPris("classeEleves") ? [["individuels", "les suivis individuels"], ["eleves", "le suivi collectif"], ["classeEleves", "la liste de la classe (fiches de classe)"]].map(([k, l]) => [S[k].filter(meme), l]).filter(([l]) => l.length) : [];
    const rep = !ailleurs.length ? false : await demander("Corriger le nom partout ?", `« ${ancien} » figure aussi dans ${ailleurs.map(x => x[1]).join(" et ")}.\n\nLes fiches d’un élève sont reliées par son nom (groupes et options, fiche élève, conseil de classe) : corrigez-le partout pour garder ces liens.\n\n• Faute de frappe : « Corriger partout »\n• Autre élève : « Seulement ici »\n• Échap : ne rien changer\nCtrl+Z annule.`, { ok: "Corriger partout", annuler: "Seulement ici", echap: null });
    if (rep === null) { t.value = ancien; render(); return; }   /* Échap : le nom n'est pas changé */
    if (rep) for (const [l] of ailleurs) for (const x of l) x.nom = nouveau;
  }
  if (t.dataset.path) {
    const mg = /^groupes\.(\d+)\.nom$/.exec(t.dataset.path);
    if (mg) {                          // renommer un groupe : les élèves et l'emploi du temps suivent
      const ancien = S.groupes[Number(mg[1])].nom, nouveau = t.value.trim();
      if (nouveau && S.groupes.some((g, k) => g.nom && sansAccent(g.nom) === sansAccent(nouveau) && k !== Number(mg[1]))) { toast(`Le groupe « ${nouveau} » existe déjà (majuscules et accents ne comptent pas).`); t.value = ancien; return; }
      if (ancien && nouveau !== ancien) { for (const e of S.classeEleves) if (e.groupes) { e.groupes = e.groupes.map(x => x === ancien ? nouveau : x).filter(Boolean); if (!e.groupes.length) delete e.groupes; }
        for (const E of toutesEdt(S)) for (const tt of ["A", "B"]) for (const day of E[tt]) for (const c of day) if (c.grp) { c.grp = c.grp.map(x => x.g === ancien ? { ...x, g: nouveau } : x).filter(x => x.g); if (!c.grp.length) delete c.grp; }
        if (pinGroupe === ancien) pinGroupe = nouveau; }
      t.value = nouveau;
    }
    const m = /^matieres\.(\d+)\.nom$/.exec(t.dataset.path);
    if (m) renommerMatiere(S, S.matieres[Number(m[1])].nom, t.value);      // l'emploi du temps et les fiches suivent le nouveau nom
    if (t.type === "date" && !dateEnSaisie(t) && !dateValide(t.value, /^(debut|fin)$/.test(t.dataset.path))) { t.value = getPath(S, t.dataset.path); toast("Date incomplète ou invalide. L’ancienne date est gardée."); return; }   // avant d'écrire
    if (t.type === "date" && !dateEnSaisie(t) && ordreDates(t.dataset.path, t.value)) { toast(ordreDates(t.dataset.path, t.value)); t.value = getPath(S, t.dataset.path); return; }
    const w0Debut = changeTypesAB(t.dataset.path) ? (semAvantDebut || typesSemaines()) : null;
    setPath(S, t.dataset.path, t.value);
    if ((t.type === "date" || t.type === "time") && dateEnSaisie(t)) {
      // Chrome signale chaque partie de la date (ou de l'heure) tapée au clavier : on attend la sortie du champ pour redessiner,
      // sinon le curseur revient sur le jour et la date se décale (20112026 → 0002-11-06) ; les frappes font une seule étape d'annulation
      commit(false, true);
      if (!t.dataset.attente) { const avant = valeurFocus; t.dataset.attente = "1"; t.addEventListener("blur", () => { delete t.dataset.attente;
        if (t.type === "date" && !dateValide(getPath(S, t.dataset.path), /^(debut|fin)$/.test(t.dataset.path))) { setPath(S, t.dataset.path, avant); toast("Date incomplète ou invalide. L’ancienne date est gardée."); }
        else if (t.type === "date" && ordreDates(t.dataset.path, getPath(S, t.dataset.path))) { toast(ordreDates(t.dataset.path, getPath(S, t.dataset.path))); setPath(S, t.dataset.path, avant); }
        if (t.type === "time" && !getPath(S, t.dataset.path)) setPath(S, t.dataset.path, avant);
        if (t.type === "time" && horairesIncoherents(S)) { const m = horairesIncoherents(S), v = getPath(S, t.dataset.path); setPath(S, t.dataset.path, avant); if (horairesIncoherents(S)) setPath(S, t.dataset.path, v); else toast(m + " L’ancien horaire est gardé.", 8000); }   /* heure tapée improbable */
        if (w0Debut) { garderTypeAB(w0Debut); semAvantDebut = null; } fusionnerEtape = true; commit(false, true); renderDiffere(); }, { once: true }); }
    } else { if (w0Debut) { garderTypeAB(w0Debut); semAvantDebut = null; } commit(); }
  }
  else if ((t.dataset.hor || t.dataset.hjl) && dateEnSaisie(t)) {     // heure tapée au clavier : traitée à la sortie du champ
    if (!t.dataset.attente) { t.dataset.attente = "1"; t.addEventListener("blur", () => { delete t.dataset.attente; t.dispatchEvent(new Event("change", { bubbles: true })); }, { once: true }); } }
  else if (t.dataset.hor) {               // heure d'un créneau : tapée (gardée) ou égale au calcul (redevient calculée)
    const [p, x] = t.dataset.hor.split("."), h = S.horaires[p] || (S.horaires[p] = { debut: "", fin: "" });
    const avant = h[x]; h[x] = ""; const calc = horairesType(S)[p][x]; h[x] = t.value && t.value !== calc ? t.value : "";
    const ht = horairesType(S)[p]; if (ht.debut && ht.fin && ht.fin <= ht.debut) { h[x] = avant; toast(`${PERIODS[p]} : la fin doit être après le début.`); render(); return; }
    commit(); }
  else if (t.dataset.hjMode !== undefined) { const j = S.horairesJours[Number(t.dataset.hjMode)]; j.mode = t.value;
    if (t.value === "libre" && !j.libre.some(l => l.debut || l.fin)) j.libre = horairesType(S).map(h => ({ debut: h.debut, fin: h.fin }));   // part des horaires habituels
    commit(); }
  else if (t.dataset.hjMatin !== undefined) { S.horairesJours[Number(t.dataset.hjMatin)].matinSeul = t.value === "1"; commit(); }
  else if (t.dataset.hjl) { const [d, p, x] = t.dataset.hjl.split("."), l = S.horairesJours[d].libre[p], avant = l[x]; l[x] = t.value;
    if (l.debut && l.fin && l.fin <= l.debut) { l[x] = avant; toast(`${DAYS[d]} ${PERIODS[p]} : la fin doit être après le début.`); render(); return; } commit(); }
  else if (t.dataset.num && /^(remiseIndiv|individuels\.\d+\.remise)$/.test(t.dataset.num)) {   // jour de remise : les bilans déjà écrits suivent leur fiche
    const touches = t.dataset.num === "remiseIndiv" ? S.individuels : [S.individuels[Number(t.dataset.num.split(".")[1])]];
    const avant = new Map(touches.map(ind => [ind, cyclesIndiv(ind)]));
    setPath(S, t.dataset.num, Number(t.value));
    for (const [ind, cy] of avant) recalerBilans(ind, cy);
    commit(); }
  else if (t.dataset.num && t.type === "number" && (t.value.trim() === "" || !isFinite(Number(t.value)))) { toast(`${nomChamp(t)} : champ vide ou invalide, la valeur d’avant est gardée.`); render(); }   /* champ vidé : on garde la valeur d'avant */
  else if (t.dataset.num) { const tape = Number(t.value); let v = tape, borne = "";
    if (t.type === "number") { const mi = t.min !== "" ? Number(t.min) : -Infinity, ma = t.max !== "" ? Number(t.max) : Infinity; v = Math.min(ma, Math.max(mi, v));
      if (v !== tape) borne = `de ${nbSigne(mi)} à ${nbSigne(ma)}`;
      if (!Number.isInteger(v) && (!t.step || t.step === "any" ? false : Number.isInteger(Number(t.step)))) { v = Math.round(v); if (!borne) borne = "nombre entier"; } }   /* décimal dans un champ entier : arrondi, et on le dit */
    setPath(S, t.dataset.num, v);
    if (/^seuils\./.test(t.dataset.num)) {   /* un seul message : le seuil tapé, puis ceux qu'il a fallu déplacer pour garder l'ordre */
      const cle = t.dataset.num.split(".")[1], avant = { ...S.seuils, [cle]: v }; S.seuils = seuils(S);
      const lib = { rouge: "rouge", orange: "orange", vert: "vert clair", vertFonce: "vert" }, bouges = Object.keys(S.seuils).filter(k => S.seuils[k] !== Number(avant[k]));
      if (bouges.length) toast(`Seuils remis dans l’ordre (rouge ≤ orange ≤ vert clair ≤ vert) : ${bouges.map(k => `${lib[k]} ${S.seuils[k] < Number(avant[k]) ? "ramené" : "porté"} à ${S.seuils[k]} %`).join(", ")}.`, 6000);
      else if (borne) toast(`Seuil ${lib[cle]} : ${borne === "nombre entier" ? "arrondi" : "ramené"} à ${S.seuils[cle]} %${borne === "nombre entier" ? "" : ` (${borne} %)`}.`); }
    else if (borne) toast(`${nomChamp(t)} : valeur ${borne === "nombre entier" ? "arrondie" : "ramenée"} à ${nbSigne(v)}${borne === "nombre entier" ? "" : ` (${borne})`}.`);
    if (/^(finSuiviIndiv|retenueClasse|seuilBilanClasse|horairesBase|horairesJours)\b/.test(t.dataset.num)) { const k = t.dataset.num.split(".")[0]; S[k] = normalizeState({ ...S, [k]: S[k] })[k]; } commit(); }
  else if (t.dataset.bool) { setPath(S, t.dataset.bool, t.checked);
    if (/^creneau/.test(t.dataset.bool)) { const b = S.horairesBase, act = creneauxActifs(S);   // une récréation placée après un créneau retiré revient à sa place habituelle
      if (!act.includes(b.recreMatinApres)) b.recreMatinApres = HORAIRES_BASE.recreMatinApres;
      if (!act.includes(b.recreApremApres)) b.recreApremApres = HORAIRES_BASE.recreApremApres; }
    commit(); }
  else if (t.dataset.grel !== undefined) { const e = S.classeEleves[Number(t.dataset.grel)], g = t.dataset.g; let l = (e.groupes || []).filter(x => x !== g);
    if (t.checked && estDemiGroupe(g)) { const quitte = l.filter(estDemiGroupe); if (quitte.length) { l = l.filter(x => !estDemiGroupe(x)); toast(`${e.nom || "L’élève"} passe de « ${quitte.join(", ")} » à « ${g} » : un élève n’est que dans un seul demi-groupe.`, 6000); } }
    if (t.checked) l.push(g); l.sort((a, b) => ordreGr(a) - ordreGr(b)); if (l.length) e.groupes = l; else delete e.groupes; commit(); }
  else if (t.dataset.force) { if (t.value) S.typesForces[t.dataset.force] = t.value; else delete S.typesForces[t.dataset.force]; commit(); }
  else if (t.dataset.mat !== undefined) {
    const j = jour(S, ficheDate, true); const p = t.dataset.mat;
    if (t.value === "__autre__") {
      const v = await saisir("Autre activité", `Matière ou activité en ${PERIODS[p]} ce jour-là :`, { valeur: "", exemple: "Permanence, Sortie scolaire…", libelle: "Matière ou activité" });
      if (v && v.trim()) j.mat[p] = v.trim(); else { renderDiffere(); return; }
    } else if (t.value === "__edt__") delete j.mat[p]; else j.mat[p] = t.value;
    commit();
  } else if (t.dataset.pabs !== undefined) {
    const p = Number(t.dataset.pabs), j = jour(S, ficheDate, true);
    if (t.checked) {
      if (!(await annulerCours(ficheDate, [p]))) { t.checked = false; return; }
    } else delete j.profAbs[p];
    commit();
  } else if (t.dataset.eabs !== undefined) {
    const s = Number(t.dataset.eabs), v = t.value, key = ficheDate + "." + s;
    if (v === "creneaux") { absEdit.add(key); renderDiffere(); return; }   // affiche les boutons M1…S3
    absEdit.delete(key);
    if (!(await setAbsEleve(s, v ? ABS_PRESETS[v].slice() : []))) { render(); return; }
    commit();
  } else if (t.dataset.salle !== undefined) {
    const j = jour(S, ficheDate, true); j.salle[t.dataset.salle] = t.value; commit();
  }
}
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.com !== undefined) {   // commentaire : enregistré sans redessiner la fiche
    const j = jour(S, ficheDate, true);
    if (t.value.trim()) j.com[t.dataset.com] = t.value; else delete j.com[t.dataset.com];
    commit(false, true);
  }
});
/** Absence d'un élève sur une liste de créneaux ; efface (après confirmation) les croix devenues sans objet. */
async function setAbsEleve(s, list) {
  const j = jour(S, ficheDate, true);
  const keys = Object.keys(j.x).filter(k => { const [a, , p] = k.split(".").map(Number); return a === s && list.includes(p); });
  if (keys.length && !(await CROIX_ELEVE(new Set(keys.map(k => k.split(".")[2])).size))) return false;
  keys.forEach(k => delete j.x[k]);
  if (list.length) j.abs[s] = list; else delete j.abs[s];
  return true;
}
async function doNew() {
  if (HOTE) {
    if (S && !(await demander("Recommencer le suivi de la classe ?", "Le suivi affiché sera remplacé par un suivi vierge (Ctrl+Z dans Suivi PP pour revenir en arrière).", { ok: "Commencer un suivi vierge", danger: true }))) return;
    S = newState(); hoteAccorder(S); hoteEtape = true; reinitHistorique(); reinitVues(); persist(); location.hash = "#reglages"; render(); return;
  }
  if (S && dirty && !(await demander("Commencer un nouveau suivi ?", PERDU, { ok: "Commencer un suivi vierge", danger: true }))) return;
  S = newState(); dirty = true; telecharge = false; reinitHistorique(); reinitVues(); persist(); location.hash = "#reglages"; render();
}
async function doDemo() {
  if (HOTE) {   /* jamais sur une vraie classe : des fiches fictives au nom de vrais élèves */
    if (!hoteDemo) { informer("Démonstration", "La démonstration des fiches de suivi se trouve dans les données de démonstration de Suivi PP (💾 Données ▸ Charger la démo) : une classe fictive, déjà remplie.\n\nIci, c’est le suivi de votre classe."); return; }
    if (S && !(await demander("Recharger la démonstration ?", "Le suivi affiché sera remplacé par la démonstration (Ctrl+Z dans Suivi PP pour revenir en arrière).", { ok: "Recharger la démonstration", danger: true }))) return;
    S = demoHote(hoteClasse); hoteEtape = true; reinitHistorique(); reinitVues(); persist(); location.hash = "#sommaire"; render(); return;
  }
  if (S && dirty && !(await demander("Charger la démonstration ?", PERDU, { ok: "Charger la démonstration", danger: true }))) return;
  S = demoState(); S.demo = true; dirty = false; telecharge = false; reinitHistorique(); reinitVues(); persist(); location.hash = "#sommaire"; render();
}
const fermerMenu = () => { $("#m-file").open = false; };
/** Nouvelle année scolaire : un nouveau suivi qui reprend les réglages choisis de l'actuel. */
async function doNouvelleAnnee() {
  if (!S) { doNew(); return; }
  if (dirty && !(await demander("Nouvelle année scolaire", PERDU + "\n\nEnregistrez d’abord le suivi actuel (Ctrl+S) si vous voulez le garder.", { ok: "Continuer sans enregistrer", danger: true }))) return;
  const an = (d => (Number(d.slice(5, 7)) >= 8 ? Number(d.slice(0, 4)) + 1 : Number(d.slice(0, 4))))(S.debut || aujourdhui());
  const cases = [["etab", "Établissement (nom, logo) et référent", true], ["mat", "Matières et enseignants", true], ["reg", "Codes, pastilles et seuils, consignes, objectifs, fiche de classe, modèles de courriel", true],
    ["edt", "Emploi du temps (et horaires)", false], ["grp", "Groupes et options", false], ["cl", "Liste des élèves de la classe", false], ["coll", "Élèves du suivi collectif", false]];
  const html = `<div class="champs"><label class="champ">Classe ${`<input type="text" id="na-classe" value="${esc(S.classe)}" placeholder="ex. 4E">`}</label><label class="champ">Premier jour du suivi <input type="date" id="na-debut" value="${CALENDRIERS[an] ? CALENDRIERS[an].rentree : (() => { let d = `${an}-09-01`; while (jourSemaine(d) !== 1) d = addDays(d, 1); return d; })()}"></label></div>
    <p class="hint">À garder :</p>${cases.map(([k, l, on]) => `<label class="na-case"><input type="checkbox" id="na-${k}"${on ? " checked" : ""}> ${l}</label>`).join("")}
    <p class="hint">Les jours fériés de ${an}-${an + 1} sont préremplis${CALENDRIERS[an] ? `, ainsi que les vacances de la zone ${S.zone}` : " ; les vacances sont à saisir (Réglages › Période et calendrier), leur calendrier officiel n’étant pas encore connu de l’application"}. Les fiches, saisies et suivis individuels ne sont pas repris.</p>`;
  const r = await saisir(`Nouvelle année scolaire ${an}-${an + 1}`, "Un nouveau suivi, avec les réglages choisis de celui-ci.", { html, lire: d => Object.fromEntries([["classe", d.querySelector("#na-classe").value.trim()], ["debut", d.querySelector("#na-debut").value], ...cases.map(([k]) => [k, d.querySelector("#na-" + k).checked])]),
    valider: v => !v.debut || anneeScolaireDe(v.debut) !== an ? `Indiquez le premier jour du suivi, dans l’année scolaire ${an}-${an + 1}.` : "" }, { ok: "Créer le suivi" });
  if (!r) return;
  const a = S, n = newState(), copie = x => JSON.parse(JSON.stringify(x));
  n.classe = r.classe; n.debut = r.debut || n.debut; n.zone = a.zone; n.alsaceMoselle = a.alsaceMoselle; n.anneeScolaire = an; n.decoupage = { mode: a.decoupage.mode, fins: [] };
  const cal = CALENDRIERS[an]; n.fin = cal ? addDays(cal.ete, -1) : `${an + 1}-07-03`; n.vacances = vacancesAnnee(an, a.zone) || []; n.joursSansCours = feriesAnnee(an, a.alsaceMoselle);
  if (r.etab) { n.etablissement = copie(a.etablissement); n.referent = a.referent; }
  if (r.mat) n.matieres = copie(a.matieres).map(m => ({ ...m, prof: profDe(a, m.nom, "9999-12-31") || m.prof }));   // avec les enseignants en poste (changements datés)
  if (r.reg) for (const k of ["codage", "seuils", "consignes", "consigneChoisie", "objectifs", "codesClasse", "retenueClasse", "seuilBilanClasse", "pastillesVertes", "consignesIndiv", "consigneIndivChoisie", "remiseIndiv", "finSuiviIndiv", "courrielIndiv", "banqueObjectifs"]) if (k in a) n[k] = copie(a[k]);
  if (r.edt) {                     // le dernier emploi du temps en vigueur, avec ses créneaux et ses horaires
    const der = a.edtSuivants.length ? a.edtSuivants[a.edtSuivants.length - 1] : a.edt; n.edt = copie({ A: der.A, B: der.B });
    for (const k of ["horaires", "horairesBase", "horairesJours", "creneauMidi", "creneauS4", "creneauS5", "samedi"]) if (k in a) n[k] = copie(a[k]); }
  if (r.grp || r.edt) n.groupes = copie(a.groupes);
  if (r.cl) n.classeEleves = copie(a.classeEleves).map(e => { delete e.debut; delete e.fin; if (!r.grp && !r.edt) delete e.groupes; return e; });
  if (r.coll) n.eleves = copie(a.eleves).map(e => ({ nom: e.nom, debut: "", fin: "" }));
  S = normalizeState(n); dirty = true; telecharge = false; fileHandle = null; nomFichier = ""; idEnregistre = ""; enregistreLe = "";
  reinitHistorique(); reinitVues(); persist(); location.hash = "#reglages/calendrier"; render();
  toast(`Suivi ${an}-${an + 1} créé. ${CALENDRIERS[an] ? "Vérifiez le calendrier" : "Saisissez les vacances"}, puis enregistrez-le dans un nouveau fichier (Ctrl+S).`, 8000);
}
$("#b-new").onclick = () => { fermerMenu(); doNew(); };
$("#b-annee").onclick = () => { fermerMenu(); doNouvelleAnnee(); };
$("#b-open").onclick = () => { fermerMenu(); openFile(); };
$("#b-save").onclick = () => { if (S) saveFile(false); };
$("#b-undo").onclick = () => annuler(-1);
$("#b-saveas").onclick = () => { fermerMenu(); if (S) saveFile(true); };
$("#b-json").onclick = () => { fermerMenu(); exporterJson(); };
if (MODE_ENREG === "json") $("#b-saveas").hidden = true;      // en mode .json, « Exporter les données » fait la même chose ; en mode .html : copie de la page avec ses données
$("#b-print").onclick = () => { fermerMenu(); imprimerVue(); };
$("#b-demo").onclick = () => { fermerMenu(); doDemo(); };
$("#b-close").onclick = async () => {
  fermerMenu();
  if (!S) return;
  if (!(await demander("Effacer de ce navigateur", (dirty ? "ATTENTION : " + PERDU.charAt(0).toLowerCase() + PERDU.slice(1) + "\n\n" : "") +
    `Effacer la copie de secours gardée dans ce navigateur et oublier l’emplacement du fichier ?\n\nÀ faire sur un ordinateur partagé. Ce qui est enregistré dans le fichier « ${MODE_ENREG === "json" ? nomFichier || NOM_JSON : NOM_PAGE} » n’est pas touché.`, { ok: "Effacer de ce navigateur", danger: true }))) return;
  try { localStorage.removeItem(CLE_PAGE); localStorage.removeItem(CLE_PAGE + "-secours"); } catch (e) { /* sans stockage */ }
  fileHandle = null; memoriserFichier(null); telecharge = false; nomFichier = ""; idEnregistre = ""; enregistreLe = "";
  let d = null; try { d = lireBloc(PAGE_SOURCE); } catch (e) { /* illisible */ }
  S = d ? normalizeState(d.S) : null; dirty = false; if (d) { idEnregistre = S.id; enregistreLe = d.savedAt || ""; } reinitHistorique(); reinitVues();
  updateStatus(); location.hash = "#sommaire"; render();
  toast(d ? `Effacé de ce navigateur. Le suivi affiché est celui enregistré dans « ${NOM_PAGE} ».` : "Effacé de ce navigateur.", 6000);
};
document.addEventListener("pointerdown", e => { if (!e.target.closest("#m-file")) fermerMenu(); for (const id of ["#m-fiche", "#m-print", "#m-seuils"]) { const m = $(id); if (m && !e.target.closest(id)) { m.open = false; if (id === "#m-seuils") seuilsOuvert = false; } } });
$("#m-file").addEventListener("focusout", e => { if (e.relatedTarget && !$("#m-file").contains(e.relatedTarget)) fermerMenu(); });

/* ---------- reprendre un suivi en glissant un fichier (.html ou .ods) sur la page ---------- */
const avecFichier = e => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
let compteGlisse = 0;
window.addEventListener("dragenter", e => { if (!avecFichier(e)) return; compteGlisse++; document.body.classList.add("glisse"); });
window.addEventListener("dragleave", e => { if (!avecFichier(e)) return; if (--compteGlisse <= 0) { compteGlisse = 0; document.body.classList.remove("glisse"); } });
window.addEventListener("dragover", e => { if (avecFichier(e)) e.preventDefault(); });
window.addEventListener("drop", async e => {
  if (!avecFichier(e)) return;
  e.preventDefault(); compteGlisse = 0; document.body.classList.remove("glisse");
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (!/\.(json|html?)$/i.test(f.name)) { informer("Fichier non reconnu", "« " + f.name + " » n’est pas un suivi enregistré par cette application (.json ou .html)."); return; }
  if (S && !(await demander("Reprendre « " + f.name + " » ?", `Le suivi affiché sera remplacé par celui de ce fichier${dirty ? ".\n\n" + PERDU : "."}`, { ok: "Reprendre", danger: dirty }))) return;
  loadFile(f);
});

/* ---------- apparence : automatique (selon le système), claire ou sombre ; réglage propre à ce navigateur ---------- */
let choixTheme = "";
const sombreSysteme = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function appliquerTheme(choix) {
  choixTheme = choix === "clair" || choix === "sombre" ? choix : "";
  document.documentElement.dataset.theme = choixTheme || (sombreSysteme && sombreSysteme.matches ? "sombre" : "clair");
  $("#theme").value = choixTheme;
  if (!HOTE) try { localStorage.setItem(LS_KEY + "-theme", choixTheme); } catch (e) { /* sans stockage */ }   /* intégrée : le thème de Suivi PP */
}
$("#theme").onchange = e => appliquerTheme(e.target.value);
if (sombreSysteme && !HOTE) sombreSysteme.addEventListener("change", () => appliquerTheme(choixTheme));
if (!HOTE) try { appliquerTheme(localStorage.getItem(LS_KEY + "-theme") || ""); } catch (e) { appliquerTheme(""); }

/* ---------- polices : celles de Suivi PP (2026-10-10), au choix comme dans Suivi PP — Andika à l'écran, Latin Modern à l'impression par défaut.
   Enregistrées avec le suivi (S.policeEcran, S.policePapier ; absentes = les défauts). Les feuilles affichées à l'écran prennent la police
   d'impression (on voit ce qui sortira) ; leur bouton « Aa » les bascule dans la police d'affichage (réglage de ce navigateur). ---------- */
const NOMS_POLICES = { andika: "Andika", lm: "Latin Modern" };
const policesDe = st => HOTE && hotePolices ? hotePolices : ({ ecran: st && st.policeEcran === "lm" ? "lm" : "andika", papier: st && st.policePapier === "andika" ? "andika" : "lm" });
let feuillesEcran = false;
try { feuillesEcran = localStorage.getItem(LS_KEY + "-feuilles-ecran") === "1"; } catch (e) { /* sans stockage */ }
function appliquerPolices() {
  const p = policesDe(S), de = document.documentElement;
  if (p.ecran === "lm") de.dataset.police = "lm"; else delete de.dataset.police;
  if (p.papier === "andika") de.dataset.policePapier = "andika"; else delete de.dataset.policePapier;
  de.classList.toggle("feuilles-ecran", feuillesEcran && p.ecran !== p.papier);
  for (const [id, v] of [["#police-ecran", p.ecran === "lm" ? "lm" : ""], ["#police-papier", p.papier === "andika" ? "andika" : ""]]) {
    const el = $(id); if (!el) continue; el.value = v; el.disabled = !S;
    el.closest("label").title = el.closest("label").title.split("\n• ouvrez")[0] + (S ? "" : "\n• ouvrez ou commencez un suivi pour la choisir"); }
  /* le bouton « Aa » de chaque feuille affichée : seulement quand les deux polices diffèrent */
  for (const f of document.querySelectorAll("#view .sheet")) {
    let b = f.querySelector(":scope > .bascule-police");
    if (p.ecran === p.papier) { if (b) b.remove(); continue; }
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "bascule-police no-print"; b.onclick = basculerPoliceFeuilles; f.prepend(b); }
    const autre = feuillesEcran ? p.papier : p.ecran;
    b.textContent = "Aa";
    b.title = `Police de la feuille : ${NOMS_POLICES[feuillesEcran ? p.ecran : p.papier]} (${feuillesEcran ? "celle de l’écran" : "celle de l’impression"})\nClic : ${NOMS_POLICES[autre]}${feuillesEcran ? ", comme sur le papier" : ", la police de l’écran"}\n• l’impression garde toujours la police d’impression`;
    b.setAttribute("aria-pressed", feuillesEcran ? "true" : "false");
  }
}
function basculerPoliceFeuilles() {
  feuillesEcran = !feuillesEcran;
  try { localStorage.setItem(LS_KEY + "-feuilles-ecran", feuillesEcran ? "1" : ""); } catch (e) { /* sans stockage */ }
  appliquerPolices();
}
function choisirPolice(cle, v) {
  if (!S) return;
  const avant = S[cle];
  if (v) S[cle] = v; else delete S[cle];
  if (S[cle] !== avant) commit(); else appliquerPolices();
}
$("#police-ecran").onchange = e => choisirPolice("policeEcran", e.target.value);
$("#police-papier").onchange = e => choisirPolice("policePapier", e.target.value);
apresRendu.push(appliquerPolices);
/* polices chargées d'avance : une impression ou une mesure ne doit jamais partir avec la police de repli */
const POLICES_CHARGEES = document.fonts ? Promise.all(["Andika", "Latin Modern Roman"].flatMap(f => ["400 1em", "700 1em", "italic 400 1em", "italic 700 1em"].map(v => document.fonts.load(`${v} "${f}"`))).concat(document.fonts.load('400 1em "JetBrains Mono"'))).catch(() => {}) : Promise.resolve();

/* ---------- menu latéral : réduit à des icônes sur les écrans étroits, ou au choix ---------- */
let menuChoisi = "";                 // "" automatique, "reduit", "ouvert"
try { menuChoisi = localStorage.getItem(LS_KEY + "-menu") || ""; } catch (e) { /* sans stockage */ }
function appliquerMenu(largeur) {
  const reduit = menuChoisi ? menuChoisi === "reduit" : largeur < 1280;
  document.documentElement.classList.toggle("rail", reduit); document.documentElement.classList.toggle("rail-fixe", reduit); document.documentElement.classList.remove("survol");
  $("#b-replier").setAttribute("aria-label", reduit ? "Agrandir le menu" : "Réduire le menu");
  $("#b-replier").setAttribute("aria-expanded", String(!reduit));
}
$("#b-replier").onclick = () => {
  menuChoisi = document.documentElement.classList.contains("rail") || document.documentElement.classList.contains("survol") ? "ouvert" : "reduit";   // ouvert au survol : le bouton l'épingle
  try { localStorage.setItem(LS_KEY + "-menu", menuChoisi); } catch (e) { /* sans stockage */ }
  appliquerZoom();
};

/* Menu réduit : le survol l'ouvre par-dessus la page, sans la redimensionner ; il se referme quand la souris en sort. */
let survolMenu = 0;
const html0 = document.documentElement, menuOuvertDedans = () => !!document.querySelector(".side details.menu[open]");
function ouvrirSurvol() { if (html0.classList.contains("rail-fixe") && html0.classList.contains("rail")) { html0.classList.remove("rail"); html0.classList.add("survol"); } }
function fermerSurvol() { if (html0.classList.contains("survol") && !menuOuvertDedans() && !tutoMenu) { html0.classList.remove("survol"); html0.classList.add("rail"); } }
$(".side").addEventListener("mouseenter", () => { clearTimeout(survolMenu); survolMenu = setTimeout(ouvrirSurvol, 250); });
$(".side").addEventListener("mouseleave", () => { clearTimeout(survolMenu); survolMenu = setTimeout(fermerSurvol, 300); });
$(".side").addEventListener("click", e => { if (e.target.closest("nav.tabs a")) { clearTimeout(survolMenu); fermerSurvol(); } });
let entreeClavier = false;
document.addEventListener("keydown", () => { entreeClavier = true; }, true); document.addEventListener("pointerdown", () => { entreeClavier = false; }, true);
$(".side").addEventListener("focusin", () => { if (entreeClavier) { clearTimeout(survolMenu); ouvrirSurvol(); } });   // au clavier : le menu s'ouvre pour montrer les noms
$(".side").addEventListener("focusout", e => { if (!e.relatedTarget || !$(".side").contains(e.relatedTarget)) { clearTimeout(survolMenu); survolMenu = setTimeout(fermerSurvol, 100); } });
$(".side").addEventListener("toggle", e => { if (!e.target.open && !$(".side").matches(":hover")) fermerSurvol(); }, true);

/* ---------- taille d'affichage : automatique selon la largeur de l'écran, réglable ---------- */
let zoomPerso = 0;                  // pas de 10 % ajoutés au zoom automatique
function zoomCssPrisEnCharge() { return !(window.CSS && CSS.supports && !CSS.supports("zoom", "1.5")); }
try { zoomPerso = Number(localStorage.getItem(LS_KEY + "-zoom")) || 0; } catch (e) { /* sans stockage */ }
// taille d'affichage : 100 % par défaut (plus d'agrandissement automatique), réglable par A− / A+
function appliquerZoom() {
  let z = 1;
  if (zoomCssPrisEnCharge()) {
    document.documentElement.style.zoom = "";
    z = Math.max(0.7, Math.round((1 + zoomPerso / 10) * 100) / 100);
    document.documentElement.style.zoom = z === 1 ? "" : String(z);
    $("#z-val").textContent = Math.round(z * 100) + " %";
  }
  appliquerMenu(window.innerWidth);
  // hauteur réelle de la fenêtre en pixels « zoomés » : le menu latéral tient exactement dans la fenêtre
  document.documentElement.style.setProperty("--hauteur-fenetre", (window.innerHeight / z) + "px");
  majHauteurBarre();
  ajusterMenuLateral();
}
/** Le menu latéral ne défile que s'il ne tient pas en entier dans la hauteur de la fenêtre. */
function ajusterMenuLateral() {
  const side = $("#side"); if (!side) return;
  side.classList.remove("deborde");
  if (side.scrollHeight > side.clientHeight + 1) side.classList.add("deborde");
}
function changerZoom(d) {
  zoomPerso = Math.max(-3, Math.min(6, zoomPerso + d));
  try { localStorage.setItem(LS_KEY + "-zoom", String(zoomPerso)); } catch (e) { /* sans stockage */ }
  appliquerZoom();
}
// navigateur sans zoom CSS (Firefox avant la version 126) : on indique le zoom du navigateur à la place des boutons
if (!zoomCssPrisEnCharge()) $(".zoom").innerHTML = "<span>Taille d’affichage : touches <b>Ctrl +</b> et <b>Ctrl −</b> du navigateur</span>";
if ($("#z-moins")) $("#z-moins").onclick = () => changerZoom(-1);
if ($("#z-plus")) $("#z-plus").onclick = () => changerZoom(1);
window.addEventListener("resize", appliquerZoom);
/* hauteur de la barre du haut, pour les en-têtes de tableau qui restent visibles en faisant défiler */
// plus de barre du haut : les en-têtes de tableau collent en haut de la fenêtre
function majHauteurBarre() { document.documentElement.style.setProperty("--topbar-h", "0px"); }

/* ---------- même application ouverte dans un autre onglet : la sauvegarde automatique est partagée ---------- */
window.addEventListener("storage", e => {
  if (HOTE || e.key !== CLE_PAGE) return;
  let autre = null; try { autre = JSON.parse(e.newValue || "null"); } catch (err) { /* illisible */ }
  if (autre && autre.S && S && autre.S.id === S.id) {
    // même suivi modifié dans un autre onglet : on reprend ses données, pour ne pas les écraser à la prochaine saisie
    if (document.activeElement && document.activeElement.matches("textarea, input[type=text]")) document.activeElement.blur();
    S = normalizeState(autre.S); dirty = !!autre.dirty; if (autre.base) { enregistreLe = autre.base; idEnregistre = autre.id || idEnregistre; }
    reinitHistorique(); updateStatus(); render();
    toast("Mis à jour avec les modifications faites dans un autre onglet.");
    return;
  }
  if (document.querySelector(".bandeau-onglet")) return;
  const b = document.createElement("div");
  b.className = "bandeau-onglet no-print"; b.setAttribute("role", "alert");
  b.innerHTML = `<b>Attention : l’application est aussi ouverte dans un autre onglet ou une autre fenêtre.</b>
    Les deux partagent la copie de secours de ce navigateur : des modifications peuvent être perdues.
    Travaillez dans un seul onglet (fermez l’autre) et enregistrez (Ctrl+S).
    <button type="button">J’ai compris</button>`;
  b.querySelector("button").onclick = () => b.remove();
  document.body.appendChild(b);
});

/** Fin d'un glisser au bouton droit : les élèves survolés deviennent absents (ou présents) sur ces cours, une seule confirmation. */
async function appliquerAbsencesDroit(t) {
  const cibles = [...t.vus].filter(([, v]) => v).map(([k]) => k.split(".").map(Number));
  if (!cibles.length) { render(); return; }
  const j = jour(S, ficheDate, true), listes = new Map();
  for (const [s, p] of cibles) {
    const cur = listes.get(s) || absCreneaux(S, ficheDate, s);
    listes.set(s, t.on ? [...new Set([...cur, p])].sort((a, b) => a - b) : cur.filter(x => x !== p));
  }
  const keys = Object.keys(j.x).filter(k => { const [s, , p] = k.split(".").map(Number); return t.on && cibles.some(([a, b]) => a === s && b === p); });
  if (keys.length && !(await CROIX_ELEVE(cibles.length))) { render(); return; }
  keys.forEach(k => delete j.x[k]);
  for (const [s, l] of listes) { if (l.length) j.abs[s] = l; else delete j.abs[s]; }
  commit();
  const noms = [...listes.keys()].map(s => S.eleves[s].nom);
  toast(cibles.length === 1 ? `${noms[0]} : ${t.on ? "absent(e)" : "présent(e)"} en ${PERIODS[cibles[0][1]]}. Ctrl+Z pour annuler.`
    : `${cibles.length} cours marqués ${t.on ? "« absent »" : "« présent »"} (${noms.join(", ")}). Ctrl+Z pour annuler.`, 5000);
}

/* ---------- clic droit sur une case : l'élève absent ou présent sur ce cours ---------- */
let dernierPointeur = "mouse";
document.addEventListener("pointerdown", e => { dernierPointeur = e.pointerType; }, true);
document.addEventListener("contextmenu", async e => {
  const td = e.target.closest && e.target.closest("table.fiche td[data-x], table.fiche td[data-abs]");
  if (!td || !S) return;
  e.preventDefault();
  if (dernierPointeur === "touch") return;          // au doigt, l'appui long sert à cocher en glissant
  if (droitEnCours || Date.now() - droitFini < 600) return;   // souris : déjà traité par le glisser au bouton droit (clavier : touche Menu, ci-dessous)
  const [s, p] = td.dataset.x ? (([a, , c]) => [a, c])(td.dataset.x.split(".").map(Number)) : td.dataset.abs.split(".").map(Number);
  if (creneau(S, semaines(S), ficheDate, p).absent) { toast("L’enseignant est absent sur ce cours : cliquez le ✎ de l’en-tête et choisissez « Cours normal » pour le rétablir."); return; }
  const cur = absCreneaux(S, ficheDate, s), absent = !cur.includes(p);
  const next = absent ? [...cur, p].sort((a, b) => a - b) : cur.filter(x => x !== p);
  if (!(await setAbsEleve(s, next))) { render(); return; }
  commit();
  toast(`${S.eleves[s].nom} : ${absent ? "absent(e)" : "présent(e)"} en ${PERIODS[p]}. Ctrl+Z pour annuler.`);
});

/* ---------- croix au clavier : flèches pour se déplacer, Espace ou Entrée pour cocher ---------- */
document.addEventListener("focusin", e => {
  const td = e.target.closest && e.target.closest("td[data-x]");
  if (!td) return;
  document.querySelectorAll('table.fiche td[data-x][tabindex="0"]').forEach(c => { if (c !== td) c.tabIndex = -1; });
  td.tabIndex = 0; caseClavier = td.dataset.x.split(".").map(Number);
});
document.addEventListener("keydown", e => {
  const td = e.target.closest && e.target.closest("td[data-x]");
  if (!td || e.ctrlKey || e.metaKey || e.altKey) return;
  const [s, o, p, l] = td.dataset.x.split(".").map(Number);
  // niveaux au clavier : 1 (le plus faible) à 4 (le meilleur), 0 : non évalué ; puis la case du dessous (objectif suivant, puis élève suivant), même cours
  const niv = niveauTouche(e.key);
  if (niv !== undefined) {
    e.preventDefault(); const cible = niv === null ? -1 : niv;
    if (croix(S, ficheDate, s, o, p) !== cible) setCroix(S, ficheDate, s, o, p, cible);
    peindreCroix(s, o, p, cible); commit(false);
    const lignes = [...new Set([...document.querySelectorAll("table.fiche td[data-x]")].map(c => c.dataset.x.split(".").slice(0, 2).join(".")))];
    for (let li = lignes.indexOf(`${s}.${o}`) + 1; li < lignes.length; li++) { const c = document.querySelector(`td[data-x="${lignes[li]}.${p}.${cible < 0 ? l : cible}"]`) || document.querySelector(`td[data-x^="${lignes[li]}.${p}."]`); if (c) { c.focus(); break; } }
    return;
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    const lvl = croix(S, ficheDate, s, o, p) === l ? -1 : l;
    setCroix(S, ficheDate, s, o, p, l); peindreCroix(s, o, p, lvl); commit(false);
    return;
  }
  const dir = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  if (!dir) return;
  e.preventDefault();
  // lignes de la fiche (élève, objectif) dans l'ordre d'affichage, colonnes = créneau × code
  const lignes = [...new Set([...document.querySelectorAll("table.fiche td[data-x]")].map(c => c.dataset.x.split(".").slice(0, 2).join(".")))];
  const ps = creneauxDu(S, ficheDate);
  let li = lignes.indexOf(`${s}.${o}`), col = ps.indexOf(p) * 4 + l;
  for (let n = 0; n < 40; n++) {
    li += dir[0]; col += dir[1];
    if (li < 0 || li >= lignes.length || col < 0 || col >= ps.length * 4) return;
    const c = document.querySelector(`td[data-x="${lignes[li]}.${ps[Math.floor(col / 4)]}.${col % 4}"]`);
    if (c) { c.focus(); return; }
  }
});

/* ---------- raccourcis clavier ---------- */
document.addEventListener("keydown", e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  const champTexte = e.target.closest && e.target.closest("input[type=text],input:not([type]),textarea,[contenteditable]");
  if (mod && !champTexte && (k === "z" || k === "y")) { e.preventDefault(); annuler(k === "y" || e.shiftKey ? 1 : -1); return; }
  if (mod && k === "s" && HOTE) { e.preventDefault(); if (e.shiftKey) exporterJson(); else toast("Rien à faire : les fiches s’enregistrent toutes seules dans Suivi PP, à chaque modification."); return; }
  if (mod && k === "s") { e.preventDefault(); const f = document.activeElement, champ = f && f.matches && f.matches("input, textarea, select"); if (champ) f.blur();   /* un champ en cours est validé avant l’enregistrement */
    if (S) setTimeout(async () => { await (e.shiftKey && MODE_ENREG === "json" ? exporterJson() : saveFile(e.shiftKey)); const r = f && document.contains(f) ? f : null; if (r && document.activeElement === document.body) r.focus({ preventScroll: true }); }, 0); return; }
  if (mod && k === "o") { e.preventDefault(); openFile(); return; }
  if (mod && k === "p") { e.preventDefault(); imprimerVue(); return; }
  if (e.key === "Escape") { if ($("#m-file").open) { fermerMenu(); $("#m-file summary").focus(); }
    for (const id of ["#m-fiche", "#m-print", "#m-seuils"]) { const m = $(id); if (m && m.open) { m.open = false; if (id === "#m-seuils") seuilsOuvert = false; m.querySelector("summary").focus(); } } return; }
  if (mod || e.altKey || e.shiftKey || !S) return;
  const t = e.target;
  if (t.closest && t.closest("input,select,textarea,[contenteditable],td[data-x]")) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const d = e.key === "ArrowLeft" ? -1 : 1;
  if (current.view === "fiche" && ficheDate) {
    const dates = ficheDates(), n = dates[dates.indexOf(ficheDate) + d];
    if (n) { e.preventDefault(); location.hash = `#${current.view}/` + n; }
  } else if (current.view === "sommaire") {
    const sems = semaines(S), n = semaineSommaire(sems) + d;
    if (n >= 0 && n < sems.length) { e.preventDefault(); location.hash = "#sommaire/" + n; }
  } else if (current.view === "classesem") {
    const sems = semaines(S), n = (Number.isInteger(Number(current.arg)) && current.arg !== null ? Number(current.arg) : Math.max(0, sems.indexOf(semaineDuJour(sems, ficheDate)))) + d;
    if (n >= 0 && n < sems.length) { e.preventDefault(); location.hash = "#classesem/" + n; }
  } else if (current.view === "totaux") {
    const n = indexTotaux(semaines(S), current.arg) + d;
    if (n >= 0 && n < semaines(S).length) { e.preventDefault(); location.hash = "#totaux/" + n; }
  }
});

/* ---------- fiche : repérage de la colonne survolée ---------- */
document.addEventListener("pointerover", e => {
  const td = e.target.closest && e.target.closest("td.c");
  document.querySelectorAll("table.fiche thead th.hl").forEach(th => th.classList.remove("hl"));
  document.querySelectorAll("table.fiche td.col-hl").forEach(c => c.classList.remove("col-hl"));
  const b = e.target.closest && e.target.closest("[data-colx]");
  if (b) { const [p, l] = b.dataset.colx.split("."); document.querySelectorAll(`table.fiche td[data-x$=".${p}.${l}"]`).forEach(c => { if (c.dataset.x.split(".")[2] === p) c.classList.add("col-hl"); }); return; }
  if (!td || !td.dataset.x) return;
  const [, , p, l] = td.dataset.x.split(".");
  document.querySelectorAll(`table.fiche thead th[data-colp="${p}"], table.fiche thead th[data-col="${p}.${l}"]`).forEach(th => th.classList.add("hl"));
});
$("#file-in").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) loadFile(f); };
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", e => { if (dirty && !HOTE) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("afterprint", () => { $("#print-area").innerHTML = ""; if (S) updateStatus(); });

/* ---------- version intégrée à Suivi PP : « hôte » ----------
   Suivi PP charge cette page dans un cadre (onglet 📋 Suivis) et échange avec elle par messages (postMessage, dans les deux sens :
   le cadre peut être d'une autre origine quand Suivi PP est ouvert en file://).
   • Suivi PP → fiche : « charger » (le suivi de la classe, ou rien ; la liste de la classe ; thème, polices ; état de la pile
     d'annulation), « apparence », « pile ».
   • fiche → Suivi PP : « pret », « etat » (le suivi à ranger, à chaque persist ; `etape` : poser un cran d'annulation), « annuler ».
   La pile d'annulation est celle de Suivi PP : Ctrl+Z ici lui est transmis, et le suivi revient par « charger ». */
const hoteCible = (() => { try { return location.origin && location.origin !== "null" ? location.origin : "*"; } catch (e) { return "*"; } })();
function hoteEnvoyer(msg) { try { parent.postMessage(Object.assign({ app: "fiche-suivi" }, msg), hoteCible); } catch (e) { /* cadre détaché */ } }
/** Le message « etat » à envoyer, ou null si Suivi PP a déjà ce suivi. */
function hoteMessageEtat() {
  if (!hotePret) return null;
  const j = S ? JSON.stringify(S) : null;
  if (j === hoteDernier && !hoteRetirer) { hoteEtape = false; return null; }
  hoteDernier = j;
  const m = { app: "fiche-suivi", type: "etat", cle: hoteCle, etat: S ? { app: "fiche-suivi-collective", format: FORMAT_DONNEES, savedAt: new Date().toISOString(), S: JSON.parse(j) } : null, etape: hoteEtape, retirer: hoteRetirer };
  hoteEtape = false; hoteRetirer = false;
  return m;
}
function hoteEnvoyerEtat() { const m = hoteMessageEtat(); if (m) hoteEnvoyer(m); }
/* Suivi PP qui se ferme reprend ici, de façon SYNCHRONE, une frappe pas encore envoyée (persistBientot attend 0,4 s) : un
   message posté pendant la fermeture n'arriverait pas. Le cadre est de même origine (srcdoc) : Suivi PP peut l'appeler. */
if (HOTE) window.__ficheEnAttente = () => { if (!persistMinuterie) return null; clearTimeout(persistMinuterie); persistMinuterie = null; return hoteMessageEtat(); };
function hoteApparence(m) {
  if (m.theme === "clair" || m.theme === "sombre") appliquerTheme(m.theme);
  if (m.polices) { hotePolices = { ecran: m.polices.ecran === "lm" ? "lm" : "andika", papier: m.polices.papier === "andika" ? "andika" : "lm" }; appliquerPolices(); }
}
function hoteCharger(m) {
  persistMaintenant();                     // une frappe en attente part d'abord, avec SA classe (hoteCle)
  hoteApparence(m);
  hotePile = m.pile || {}; hoteClasse = m.classe || null; hoteDemo = !!m.demo;
  const avant = S, autreClasse = m.cle !== hoteCle, premier = !hotePret;
  hoteCle = m.cle;
  let st = null;
  try { st = m.etat && m.etat.S ? normalizeState(m.etat.S) : null; if (st && (premier || autreClasse)) essaiRendu(st); }   /* à l'ouverture seulement : ensuite, c'est le suivi que cette page a envoyé */
  catch (e) { st = null; setTimeout(() => informer("Suivi illisible", "Le suivi rangé dans Suivi PP pour cette classe n’a pas pu être relu.\n\n" + e.message + "\n\nIl n’est pas effacé : Ctrl+Z ou une sauvegarde de Suivi PP permettent de revenir en arrière."), 100); hotePret = false; }
  S = st; dirty = false; telecharge = false;
  if (st || !(m.etat && m.etat.S)) hotePret = true;     // un suivi illisible n'est jamais remplacé par ce qu'on ferait ensuite
  hoteDernier = S ? JSON.stringify(S) : null;
  let change = false;
  if (!S && hoteDemo && hotePret && hoteClasse) { S = demoHote(hoteClasse); change = true; }
  hoteCommun = m.commun || null;
  if (S) change = hoteAccorder(S) || change;
  reinitHistorique(); majBoutonAnnuler();
  if (autreClasse) reinitVues();
  if (m.raison === "annuler" || m.raison === "retablir") {
    const quoi = avant && S ? decrireChangement(avant, S) : avant && !S ? "le suivi de la classe" : !avant && S ? "le suivi de la classe" : "";
    toast(`${m.raison === "annuler" ? "Annulé" : "Rétabli"}${quoi ? " : " + quoi : " (une modification faite dans Suivi PP)"}. ${m.raison === "annuler" ? "Ctrl+Y pour rétablir." : "Ctrl+Z pour annuler."}`, 5000);
  }
  const voulu = S ? (autreClasse || premier || !location.hash ? "#sommaire" : location.hash) : "";
  if ((location.hash || "") !== voulu && (autreClasse || premier || !S)) location.hash = voulu; else { if (premier || autreClasse) route(); else render(); }
  updateStatus();
  if (change) hoteEnvoyerEtat();          // liste de la classe mise à jour, démonstration : rangées sans cran d'annulation
}
window.addEventListener("message", e => {
  if (!HOTE || e.source !== parent || !e.data || e.data.app !== "suivi-pp") return;
  const m = e.data;
  if (m.type === "charger") hoteCharger(m);
  else if (m.type === "apparence") hoteApparence(m);
  else if (m.type === "pile") { hotePile = m.pile || {}; majBoutonAnnuler(); }
  else if (m.type === "commun") { hoteCommun = m.commun || null; if (S && appliquerCommunHote(S, hoteCommun)) { reinitHistorique(); updateStatus(); render(); hoteEnvoyerEtat(); } else if (S) render(); }
  else if (m.type === "imprimer" && S) imprimerVue();
  else if (m.type === "aller" && S && /^#[a-z]+(\/[^\s<>"]*)?$/.test(String(m.hash || ""))) location.hash = m.hash;   // « ↗ Ouvrir » depuis la fiche élève de Suivi PP
});
/* ⚠️ Chargée par srcdoc, la page a pour adresse de base celle de Suivi PP : un lien « #reglages » s'y résoudrait, et le cadre
   partirait charger Suivi PP. Une balise <base href="about:srcdoc"> est refusée par la politique de sécurité de Suivi PP
   (base-uri 'self') : on fait donc nous-mêmes ce que ferait le lien — en dernier, si personne d'autre ne s'en est chargé. */
if (HOTE) window.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || a.target) return;
  e.preventDefault();
  if (location.hash !== a.getAttribute("href")) location.hash = a.getAttribute("href"); else route();
});
/* La fiche élève de Suivi PP montre ce que les fiches de suivi disent d'UN élève sur un moment (carte « 📋 Fiches de suivi », faits,
   fiche imprimée). Suivi PP appelle cette fonction (cadre de même origine), avec le suivi de la classe de l'élève — pas forcément
   celle qu'on affiche ici. Les calculs sont CEUX de la fiche élève de l'application (donneesSynthEleve, famillesUtilisees), sur les
   semaines qui touchent [du, au] ; le résultat est fait de données simples, sans HTML (Suivi PP met en forme et échappe). */
if (HOTE) window.__ficheResumeEleve = (etat, nom, du, au) => { const r = window.__ficheResumeEleves(etat, [nom], du, au); return r ? r[nom] : null; };
/* La même chose pour plusieurs élèves d'un coup (carte de chaleur, toute la classe) : le suivi n'est relu qu'une fois. → { nom: résumé }. */
if (HOTE) window.__ficheResumeEleves = (etat, noms, du, au) => {
  let st; try { st = normalizeState(JSON.parse(JSON.stringify(etat))); } catch (e) { return null; }
  const ancien = S; viderCacheCalc(); S = st;
  try { const res = {}; for (const nom of noms) res[nom] = resumeEleveHote(String(nom || ""), du, au); return JSON.parse(JSON.stringify(res)); }
  finally { S = ancien; viderCacheCalc(); }
};
function resumeEleveHote(nom, du, au) {
  {
    const k = cleNom(nom);
    if (!k || ![S.classeEleves, S.eleves, S.individuels].some(l => l.some(e => e && cleNom(e.nom) === k))) return { absent: true };
    const sems = semaines(S);
    if (!sems.length) return { horsPeriode: true };
    let a = sems.findIndex(w => w.jours.at(-1) >= du), b = -1; sems.forEach((w, i) => { if (w.lundi <= au) b = i; });
    if (a < 0 || b < a) return { horsPeriode: true, debut: sems[0].lundi, fin: sems.at(-1).jours.at(-1) };
    const d = donneesSynthEleve(nom, sems, a, b), u = famillesUtilisees(sems, a, b), niv = (v, n) => (v === null ? "" : niveauReussite(S, v, n));
    const out = { du: sems[a].lundi, au: sems[b].jours.at(-1), semaines: d.ws.map(w => w.num), codes: S.codage.map(c => c.code), lien: "#eleve/" + encodeURIComponent(nom), indiv: [], coll: null, classe: null };
    for (const x of d.indiv.filter(y => y.serie.length || y.bilans.length))
      out.indiv.push({ id: x.ind.id, lien: "#indiv/" + x.ind.id, objectifs: x.ind.objectifs.slice(), moy: x.moy, niv: niv(x.moy, 0), fiches: x.serie.length,
        avis: { titre: x.avis.titre, niv: x.avis.niv, sous: x.avis.sous || "" },
        parObjectif: x.ind.objectifs.map((_, o) => x.serie.map(f => ({ v: f.v[o], niv: niv(f.v[o], f.nI[o]) }))),
        bilans: x.bilans.map(([c, t]) => ({ debut: c.debut, fin: c.fin, texte: t })) });
    if (u.coll && d.coll && !(d.coll.vals.every(v => v === null) && !d.coll.coms.length)) { const c = d.coll;
      out.coll = { moy: c.moy, niv: niv(c.moy, c.nI), nI: c.nI, abs: c.abs, tend: c.tend, vals: c.vals.map((v, i) => ({ v, niv: niv(v, c.nIs[i]) })), coms: c.coms.slice() }; }
    if (u.classe && d.classe) { const c = d.classe;
      out.classe = { neg: c.neg, pos: c.pos, ret: c.ret, abs: c.abs, cours: c.cours, taux: c.taux, tend: c.tend, sem: c.sem.map(x => x.total), retenues: !!S.retenueClasse.remarques,
        par: c.codes.filter(x => c.par[x.code]).map(x => ({ code: x.code, sens: x.sens, n: c.par[x.code], positif: codePositif(x.code) })),
        mats: c.mats.map(m => ({ mat: m.mat, t: m.t, n: m.n, k: m.k })), rems: c.rems.map(r => ({ d: r.d, cours: r.cours || "", txt: r.txt })) }; }
    return out;
  }
}
function initHote() {
  document.documentElement.classList.add("integree");
  S = null; dirty = false; reinitHistorique();
  $("#view").innerHTML = `<p class="hote-attente">Chargement du suivi…</p>`;
  appliquerZoom();
  hoteEnvoyer({ type: "pret" });
}
/** Version intégrée : la liste de la classe vient de Suivi PP. ⚠️ Chaque élève garde SA ligne — les codes de la fiche de classe sont
    rangés par position : un élève reconnu est mis à jour (nom, groupes, arrivée, départ), un nouveau s'ajoute à la fin, aucun n'est
    retiré (un élève parti a une date de départ). Les renommages faits dans Suivi PP suivent partout (classe, suivi collectif, suivis
    individuels) ; un nom écrit dans l'autre ordre (« Léa CARPE ») prend celui de Suivi PP. Les groupes propres à la fiche (créés ici pour
    l'emploi du temps) restent cochés. → true si le suivi a changé. */
function appliquerClasseHote(st, cl) {
  if (!st || !cl || !Array.isArray(cl.eleves)) return false;
  const avant = JSON.stringify(st), cleTriee = n => cleNom(n).split(" ").sort().join(" ");
  const renommer = (a, b) => { const k = cleNom(a); if (!k || k === cleNom(b)) return; for (const l of [st.classeEleves, st.eleves, st.individuels]) for (const e of l) if (e && cleNom(e.nom) === k) e.nom = b; };
  for (const r of Array.isArray(cl.renommer) ? cl.renommer : []) { const [a, b] = Array.isArray(r) ? r.map(x => String(x || "").trim()) : [];
    if (a && b && !st.classeEleves.some(e => cleNom(e.nom) === cleNom(b))) renommer(a, b); }
  const grHote = (Array.isArray(cl.groupes) ? cl.groupes : []).map(g => String(g || "").trim()).filter(Boolean), kHote = new Set(grHote.map(cleNom));
  for (const g of grHote) if (!st.groupes.some(x => cleNom(x.nom) === cleNom(g)) && st.groupes.length < 12) st.groupes.push({ nom: g });
  const nomGr = g => (st.groupes.find(x => x.nom && cleNom(x.nom) === cleNom(g)) || {}).nom;
  const pris = new Set();
  for (const h of cl.eleves) {
    const nom = String((h && h.nom) || "").replace(/\s+/g, " ").trim(); if (!nom) continue;
    let i = st.classeEleves.findIndex((e, k) => !pris.has(k) && cleNom(e.nom) === cleNom(nom));
    if (i < 0) { i = st.classeEleves.findIndex((e, k) => !pris.has(k) && e.nom.trim() && cleTriee(e.nom) === cleTriee(nom)); if (i >= 0) renommer(st.classeEleves[i].nom, nom); }
    if (i < 0) { if (st.classeEleves.length >= MAX_CLASSE) continue; st.classeEleves.push({ nom }); i = st.classeEleves.length - 1; }
    pris.add(i);
    const e = st.classeEleves[i];
    const gs = [...new Set([...(Array.isArray(h.groupes) ? h.groupes : []).map(nomGr).filter(Boolean), ...(e.groupes || []).filter(g => !kHote.has(cleNom(g)))])];
    if (gs.length) e.groupes = unSeulDemiGroupe(gs); else delete e.groupes;
    if (e.groupes && !e.groupes.length) delete e.groupes;
    const d = v => (/^\d{4}-\d\d-\d\d$/.test(String(v || "")) ? v : "");
    if (d(h.debut)) e.debut = d(h.debut); else delete e.debut;
    if (d(h.fin)) e.fin = d(h.fin); else delete e.fin;
  }
  if (!String(st.classe || "").trim() && cl.nom) st.classe = String(cl.nom).trim().slice(0, 40);
  return JSON.stringify(st) !== avant;
}
/** Ce que Suivi PP sait de la classe, posé dans le suivi : sa liste (appliquerClasseHote) et les réglages communs. */
function hoteAccorder(st) { const a = hoteClasse ? appliquerClasseHote(st, hoteClasse) : false; return appliquerCommunHote(st, hoteCommun) || a; }
/** Les réglages COMMUNS aux deux applications (2026-10-10, l'utilisateur : « il faut que les parties communes communiquent ») :
    le nom de la classe, l'établissement, le professeur principal (référent), le découpage de l'année (trimestres ou semestres,
    et ses dates quand Suivi PP en a de réglées) et l'enseignant de chaque matière que Suivi PP reconnaît (Français, Maths… ;
    « Vie de classe », « Devoirs faits » restent à la fiche). Suivi PP les envoie (une valeur vide ne remplace rien) ; une
    modification faite ICI repart vers Suivi PP avec le suivi (c'est lui qui la range) : les deux disent toujours la même chose.
    → true si le suivi a changé. */
function appliquerCommunHote(st, c) {
  if (!st || !c) return false;
  const avant = JSON.stringify(st), t = v => String(v || "").replace(/\s+/g, " ").trim();
  if (t(c.classe)) st.classe = t(c.classe).slice(0, 40);
  if (t(c.etablissement)) st.etablissement.nom = t(c.etablissement).slice(0, 150);
  if (t(c.referent)) st.referent = t(c.referent).slice(0, 120);
  if (c.decoupage) { const mode = c.decoupage.mode === "trimestres" ? "trimestres" : "semestres", fins = (Array.isArray(c.decoupage.fins) ? c.decoupage.fins : []).filter(x => /^\d{4}-\d\d-\d\d$/.test(x));
    if (st.decoupage.mode !== mode) st.decoupage = { mode, fins: [] };
    if (fins.length === (mode === "trimestres" ? 2 : 1)) st.decoupage.fins = fins; }
  for (const m of st.matieres) { const p = c.profs && Object.prototype.hasOwnProperty.call(c.profs, m.nom) ? c.profs[m.nom] : null; if (p && t(p.prof)) m.prof = t(p.prof).slice(0, 120); }
  return JSON.stringify(st) !== avant;
}
/* Réglages : les champs communs portent un repère (bord bleu, infobulle) et leur carte le dit. */
function marquerCommunsHote() {
  if (!HOTE || !S || !hoteCommun || current.view !== "reglages") return;
  const sel = ['[data-path="classe"]', '[data-path="referent"]', '[data-path="etablissement.nom"]', '[data-path="decoupage.mode"]', '[data-path^="decoupage.fins."]'];
  S.matieres.forEach((m, i) => { if (hoteCommun.profs && Object.prototype.hasOwnProperty.call(hoteCommun.profs, m.nom)) sel.push(`[data-path="matieres.${i}.prof"]`); });
  for (const el of document.querySelectorAll("#view " + sel.join(", #view "))) {
    if (el.classList.contains("commun-hote")) continue;
    el.classList.add("commun-hote");
    const lien = el.dataset.path.startsWith("matieres.") ? hoteCommun.profs[S.matieres[Number(el.dataset.path.split(".")[1])].nom] : null;
    el.title = (el.title ? el.title + "\n" : "") + "↔ Commun avec Suivi PP" + (lien ? ` (discipline « ${lien.discipline} »)` : "") + " : le modifier ici le modifie aussi là-bas, et inversement.";
    const carte = el.closest(".card");
    if (carte && !carte.querySelector(".commun-hote-hint")) { const p = document.createElement("p"); p.className = "hint commun-hote-hint";
      p.textContent = "↔ Les champs marqués d’un trait bleu sont communs avec Suivi PP : ce qui est réglé d’un côté l’est aussi de l’autre.";
      const h = carte.querySelector("h2"); if (h) h.after(p); else carte.prepend(p); }
  }
}
if (HOTE) apresRendu.push(marquerCommunsHote);
/** La démonstration dans les données de démonstration de Suivi PP : celle de l'application, aux noms des élèves de la classe de
    Suivi PP (rang pour rang dans la liste de la classe) et déplacée dans son année scolaire (de semaines entières : les jours de la
    semaine sont gardés), avec le calendrier de cette année-là. */
function demoHote(cl) {
  let st = demoState(); st.demo = true;
  const an = Number(String((cl && cl.annee) || "").slice(0, 4));
  if (an && an !== st.anneeScolaire) {
    const jours = 7 * Math.round((an - st.anneeScolaire) * 365.25 / 7), re = /^\d{4}-\d\d-\d\d/;
    const dec = v => typeof v === "string" && re.test(v) ? addDays(v.slice(0, 10), jours) + v.slice(10) : v;
    const marche = x => Array.isArray(x) ? x.map(marche) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [dec(k), marche(v)])) : dec(x);
    st = marche(st); st.anneeScolaire = an; st.vacances = vacancesAnnee(an, st.zone) || st.vacances; st.joursSansCours = feriesAnnee(an, true);
  }
  const noms = ((cl && cl.eleves) || []).map(e => String((e && e.nom) || "").trim()).filter(Boolean), carte = new Map();
  st.classeEleves.forEach((e, i) => { if (noms[i]) carte.set(cleNom(e.nom), noms[i]); });
  const libres = noms.filter(n => ![...carte.values()].includes(n));
  for (const e of [...st.eleves, ...st.individuels]) if (e && e.nom && e.nom.trim() && !carte.has(cleNom(e.nom)) && libres.length) carte.set(cleNom(e.nom), libres.shift());
  for (const l of [st.classeEleves, st.eleves, st.individuels]) for (const e of l) if (e && carte.has(cleNom(e.nom))) e.nom = carte.get(cleNom(e.nom));
  if (noms.length < st.classeEleves.length) {      /* classe plus petite : les lignes de trop et leurs codes partent (ce sont les dernières) */
    const n = noms.length; st.classeEleves = st.classeEleves.slice(0, n);
    for (const j of Object.values(st.jours)) { if (j.cl) for (const k of Object.keys(j.cl)) if (Number(k.split(".")[0]) >= n) delete j.cl[k];
      if (j.clr) for (const k of Object.keys(j.clr)) if (Number(k.split(".")[0]) >= n) delete j.clr[k]; }
  }
  if (cl && cl.nom) st.classe = String(cl.nom).trim().slice(0, 40);
  return normalizeState(st);
}

/* ---------- démarrage ---------- */
/** Démarrage : appelé à la toute fin du script assemblé, une fois toutes les parties chargées (sections.js comprise). */
function init() {
  if (HOTE) { initHote(); return; }
  // 1. ce qui est enregistré dans le fichier lui-même
  let emb = null;
  try { emb = lireBloc(PAGE_SOURCE); } catch (e) {
    setTimeout(() => informer("Données du fichier illisibles", `Les données enregistrées dans « ${NOM_PAGE} » n’ont pas pu être relues.\n\n${e.message}`), 300);
  }
  if (emb) { try { verifierFormat(emb, NOM_PAGE); emb.S = normalizeState(emb.S); idEnregistre = emb.S.id; enregistreLe = emb.savedAt || ""; } catch (e) { emb = null; } }
  // 2. la copie de secours de ce navigateur (propre à ce fichier)
  let local = null;
  try {
    local = JSON.parse(localStorage.getItem(CLE_PAGE) || "null");
    if (local && local.S) local.S = normalizeState(local.S); else local = null;
  } catch (e) {
    local = null;
    try { localStorage.setItem(CLE_PAGE + "-secours", localStorage.getItem(CLE_PAGE)); } catch (err) { /* sans stockage */ }
  }
  if (emb && local && local.dirty && local.S.id === emb.S.id && local.base === enregistreLe) {
    S = local.S; dirty = true;        // modifications pas encore enregistrées dans le fichier : on les reprend
    setTimeout(() => toast("Modifications non enregistrées retrouvées (copie de secours de ce navigateur). Pensez à enregistrer (Ctrl+S).", 7000), 400);
  } else if (emb) {
    if (local && local.dirty && JSON.stringify(local.S) !== JSON.stringify(emb.S)) {
      try { localStorage.setItem(CLE_PAGE + "-secours", JSON.stringify(local)); } catch (err) { /* sans stockage */ }
      setTimeout(() => informer("Copie de secours mise de côté", `Ce navigateur gardait des modifications non enregistrées, mais le fichier « ${NOM_PAGE} » a été enregistré depuis (ailleurs ou dans un autre onglet).\n\nLe suivi affiché est celui du fichier. Les anciennes modifications ont été mises de côté dans ce navigateur.`), 300);
    }
    S = emb.S; dirty = false;
  } else if (local) {
    S = local.S;
    if (MODE_ENREG === "json") { dirty = !!local.dirty; idEnregistre = local.id || ""; enregistreLe = local.base || ""; nomFichier = local.nom || ""; }
    else dirty = !S.demo;
  }
  reinitHistorique();
  persist();
  retrouverFichier();
  if (!location.hash) {                 // la dernière page vue pour ce suivi, sinon le sommaire
    let der = null; try { der = JSON.parse(localStorage.getItem(CLE_PAGE + "-page") || "null"); } catch (e) { /* sans stockage */ }
    location.hash = der && S && der.id === S.id && /^#[a-z]/.test(der.hash || "") ? der.hash : "#sommaire";
  }
  appliquerZoom();
  route();
  if (S) updateStatus(); else $("#status").textContent = "";
}
