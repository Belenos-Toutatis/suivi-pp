// Version intégrée à Suivi PP (2026-10-10, onglet 📋 Suivis) : le VRAI « suivi pp.html », ouvert en file:// (le cadre est
// alors d'une autre origine : tout passe par les messages). Démonstration fabriquée par la fiche aux noms de la classe,
// gestes rangés dans Suivi PP avec un cran d'annulation, Ctrl+Z / Ctrl+Y depuis la fiche, renommage, départ, arrivée et
// suppression d'un élève dans Suivi PP, thème et police, changement de classe, reprise d'un suivi de la version autonome
// (noms dans l'autre ordre), Ctrl+P, rechargement de la page. Noms fictifs.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), path = require("path"); const DIR = __dirname;
const SUIVI = path.join(DIR, "..", "suivi pp.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p);
  await p.setViewport({ width: 1440, height: 900 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + SUIVI); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(1200);
  const h = (f, ...a) => p.evaluate(f, ...a);
  let fr = null;
  const cadre = async () => { for (let i = 0; i < 40 && !(fr = p.frames().find(f => f.url().startsWith("about:srcdoc"))); i++) await wait(150); return fr; };
  const f = (fn, ...a) => fr.evaluate(fn, ...a);
  const fiche = () => h(() => JSON.parse(JSON.stringify(S.fichesSuivi[S.cur] || {})));

  // 1. Démonstration de Suivi PP : la classe porte le marqueur ; à l'ouverture de l'onglet, la fiche fabrique SA démonstration
  ok(await h(() => S.fichesSuivi["5C"] && S.fichesSuivi["5C"].demo === true), "démo de Suivi PP : la 5e C attend la démonstration des fiches");
  await h(() => switchTab("suivis")); await cadre(); await wait(2500);
  ok(!!fr, "onglet 📋 Suivis : la fiche dans un cadre (srcdoc)");
  await f(() => { window.__errs = []; addEventListener("error", e => window.__errs.push(e.message)); });
  let e = await fiche();
  ok(e.etat && e.etat.S && e.etat.S.demo && !e.demo && Object.keys(e.noms || {}).length === 25, "démonstration fabriquée par la fiche et rangée dans Suivi PP (25 noms envoyés)");
  const noms = await h(() => _suivisClasse("5C").classe.eleves.map(x => x.nom));
  ok(JSON.stringify(e.etat.S.classeEleves.map(x => x.nom)) === JSON.stringify(noms), "ses élèves sont ceux de la classe, rang pour rang");
  ok(e.etat.S.eleves.filter(x => x.nom).every(x => noms.includes(x.nom)) && e.etat.S.individuels.every(x => noms.includes(x.nom)), "suivi collectif et suivis individuels aux noms de la classe");
  const an = await h(() => getCls().annee.slice(0, 4));
  ok(e.etat.S.anneeScolaire === Number(an) && e.etat.S.debut.startsWith(an), `démonstration déplacée dans l'année de la classe (${an})`);
  ok(await h(() => undoStack.length === 0), "fabriquer la démonstration ne pose pas de cran d'annulation");
  ok(await f(() => location.hash === "#sommaire" && /Suivi PP/.test(document.getElementById("status").textContent) && document.documentElement.classList.contains("integree")), "la fiche s'ouvre sur son sommaire, « dans Suivi PP »");
  ok(await f(() => ["#b-save", "#b-new", "#b-demo", "#b-annee", "#theme"].every(s => { const el = document.querySelector(s); return !el || getComputedStyle(el.closest("label") || el).display === "none"; })), "pas d'Enregistrer, de nouveau suivi, de démonstration, de nouvelle année ni de thème dans la fiche");
  ok(await h(() => !Object.keys(localStorage).some(k => k.startsWith("fiche-suivi-collective:"))), "la fiche n'écrit pas de copie à elle dans le navigateur");
  ok(await f(async () => { await document.fonts.ready; return ["Andika", "Latin Modern Roman", "JetBrains Mono"].every(x => document.fonts.check(`1em "${x}"`)); }), "polices de Suivi PP dans le cadre");

  await fr.click('.side a[href="#edt"]'); await wait(500);
  ok(fr.url() === "about:srcdoc#edt" && await f(() => !!document.querySelector("#view .card, #view table")), "un lien du menu de la fiche reste dans le cadre (#edt), sans recharger Suivi PP dedans");
  // 2. un geste dans la fiche : rangé dans Suivi PP, UN cran d'annulation ; Ctrl+Z et Ctrl+Y depuis la fiche
  await f(() => { location.hash = "#reglages"; }); await wait(500);
  const ref0 = await f(() => document.querySelector("[data-path=referent]").value);   // celui de Suivi PP (réglage commun)
  ok(ref0 === await h(() => S.prefs.avisNom), "référent de la fiche : le professeur principal réglé dans Suivi PP");
  await fr.click("[data-path=referent]", { clickCount: 3 }); await fr.type("[data-path=referent]", "M. GARDON"); await f(() => document.activeElement.blur()); await wait(700);
  e = await fiche();
  ok(e.etat.S.referent === "M. GARDON" && await h(() => undoStack.length) === 1, "frappe dans un champ : rangée dans Suivi PP, un seul cran d'annulation");
  ok(await f(() => !document.getElementById("b-undo").disabled), "le bouton Annuler de la fiche suit la pile de Suivi PP");
  await h(() => { document.getElementById("toast").textContent = ""; });
  await f(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }))); await wait(700);
  e = await fiche();
  ok(e.etat.S.referent === ref0 && await f(r => document.querySelector("[data-path=referent]").value === r, ref0), "Ctrl+Z dans la fiche : annulé dans Suivi PP, la fiche revient");
  const toasts = [await f(() => document.getElementById("toast").textContent), await h(() => document.getElementById("toast").textContent)];
  ok(/Annulé.{1,3}professeur principal/.test(toasts[0]) && !/Annulation effectuée/.test(toasts[1]), "la fiche dit ce qui a été annulé (et Suivi PP ne le redit pas) " + JSON.stringify(toasts));
  await f(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }))); await wait(700);
  ok((await fiche()).etat.S.referent === "M. GARDON", "Ctrl+Y dans la fiche : rétabli");
  await h(() => undoLast()); await wait(600);
  ok(await f(r => document.querySelector("[data-path=referent]").value === r, ref0), "Ctrl+Z dans Suivi PP : la fiche suit");

  // 3. la classe change dans Suivi PP : renommage, départ, arrivée, suppression — chaque élève garde SA ligne
  const avant = (await fiche()).etat.S;
  const r = await h(() => { const cls = getCls(), coll = S.fichesSuivi["5C"].etat.S.eleves.find(x => x.nom), sid = Object.keys(S.fichesSuivi["5C"].noms).find(k => S.fichesSuivi["5C"].noms[k] === coll.nom);
    const autre = cls.eleves.find(x => x !== sid), sup = cls.eleves.find(x => x !== sid && x !== autre && !S.fichesSuivi["5C"].etat.S.eleves.some(y => y.nom === S.fichesSuivi["5C"].noms[x]));
    pushUndo(); S.eleves[sid].prenom = "Aurélien-Noé"; S.eleves[autre].departureDate = (S.fichesSuivi["5C"].etat.S.debut.slice(0, 4)) + "-11-17";
    const nid = "e2e_nouveau"; S.eleves[nid] = { id: nid, nom: "Aaa", prenom: "Zoé", classe_id: cls.id, groupe: 1, tags: [], arrivalDate: null, departureDate: null }; cls.eleves.push(nid);
    const nomSup = S.fichesSuivi["5C"].noms[sup]; _purgeStudentRefs(sup); save(); renderTab("suivis");
    return { ancien: coll.nom, nomAutre: S.fichesSuivi["5C"].noms[autre], nomSup }; });
  await wait(800);
  e = await fiche(); const cl = e.etat.S.classeEleves;
  const nouveauNom = r.ancien.split(" ")[0] + " Aurélien-Noé";
  ok(e.etat.S.eleves.some(x => x.nom === nouveauNom) && !e.etat.S.eleves.some(x => x.nom === r.ancien) && cl.findIndex(x => x.nom === nouveauNom) === avant.classeEleves.findIndex(x => x.nom === r.ancien), "renommé dans Suivi PP : renommé dans le suivi collectif et dans la classe, à la même ligne");
  ok(cl.find(x => x.nom === r.nomAutre).fin.endsWith("-11-16"), "parti le 17/11 dans Suivi PP (premier jour d'absence) : dernier jour le 16/11 dans la fiche");
  ok(cl.length === avant.classeEleves.length + 1 && cl[cl.length - 1].nom === "AAA Zoé" && cl.slice(0, -1).every((x, i) => i === cl.findIndex(y => y.nom === x.nom)), "nouvel élève (premier par ordre alphabétique) : ajouté à la FIN, les autres gardent leur ligne");
  ok(cl.some(x => x.nom === r.nomSup), "élève supprimé dans Suivi PP : sa ligne reste dans la fiche (ses codes sont rangés par position)");
  await f(() => { location.hash = "#reglages/classeEntiere"; }); await wait(500);
  ok(await f(nom => [...document.querySelectorAll(".lcl-hote .lrow")].some(r => r.textContent.includes(nom) && /pas dans Suivi PP/.test(r.textContent) && r.querySelector("[data-del]")), r.nomSup), "Réglages : liste en lecture, la ligne qui n'est plus dans Suivi PP est signalée et peut être retirée");
  ok(await f(() => !document.querySelector('.lcl-hote input[data-path^="classeEleves"], [data-add="classeEleves"]')), "les noms de la classe ne se modifient pas dans la fiche");

  // 4. thème et police de Suivi PP
  await h(() => toggleAppTheme()); await wait(300);
  ok(await f(() => document.documentElement.dataset.theme === "sombre"), "thème sombre de Suivi PP : la fiche suit");
  await h(() => toggleAppTheme()); await h(() => setPref("policeEcran", "lm")); await wait(300);
  ok(await f(() => document.documentElement.dataset.police === "lm"), "police d'écran de Données : la fiche suit");
  await h(() => setPref("policeEcran", "andika")); await wait(200);

  // 5. autre classe : accueil, puis reprise d'un suivi de la version autonome (noms écrits « Prénom NOM »)
  await h(() => { pushUndo(); const c = _createClassBare("4B", "4e B", getCls().annee); const sid = "e2e_truite"; S.eleves[sid] = { id: sid, nom: "Truite", prenom: "Jean-Pierre", classe_id: c.id, groupe: 2, tags: [], arrivalDate: null, departureDate: null }; c.eleves.push(sid); save(); switchClass(c.id); });
  await wait(800);
  ok(/4e B/.test(await f(() => document.querySelector("#view h1").textContent)) && await f(() => !!document.querySelector('[data-act="new"]') && !document.querySelector('[data-act="demo"]')), "classe sans suivi : l'accueil de la version intégrée (sans démonstration sur une vraie classe)");
  const json = path.join(DIR, "sorties", "integre-reprise.json");
  fs.writeFileSync(json, JSON.stringify({ app: "fiche-suivi-collective", format: 1, savedAt: "2025-10-01T00:00:00Z", S: { classe: "4B", referent: "Mme SOLE", classeEleves: [{ nom: "Jean-Pierre TRUITE" }], eleves: [{ nom: "Jean-Pierre TRUITE" }] } }));
  const u0 = await h(() => undoStack.length);
  const [fc] = await Promise.all([fr.waitForFileChooser ? fr.waitForFileChooser() : p.waitForFileChooser(), fr.click('[data-act="open"]')]);
  await fc.accept([json]); await wait(1200);
  e = await fiche();
  ok(e.etat && e.etat.S.consignes && e.etat.S.classeEleves[0].nom === "TRUITE Jean-Pierre" && e.etat.S.eleves[0].nom === "TRUITE Jean-Pierre" && e.etat.S.referent === await h(() => S.prefs.avisNom) && e.etat.S.classe === "4e B", "suivi repris d'un fichier : rangé dans la classe, « Jean-Pierre TRUITE » devient « TRUITE Jean-Pierre » partout ; classe et référent, ceux de Suivi PP");
  ok(e.etat.S.classeEleves[0].groupes && e.etat.S.classeEleves[0].groupes.includes("Groupe 2") && await h(u => undoStack.length === u + 1, u0), "… avec son groupe de Suivi PP, en un cran d'annulation");
  await h(() => switchClass("5C")); await wait(800);
  ok(await f(() => location.hash === "#sommaire") && (await fiche()).etat.S.demo && await h(() => S.fichesSuivi["4B"].etat.S.eleves[0].nom === "TRUITE Jean-Pierre"), "retour à la 5e C : son suivi ; celui de la 4e B intact");

  // 5 bis. la fiche élève de Suivi PP : la carte « 📋 Fiches de suivi », calculée par l'appli des fiches, et « ↗ Ouvrir »
  const ind = await h(() => { const e = S.fichesSuivi["5C"]; const nom = e.etat.S.individuels[0].nom; return { nom, sid: Object.keys(e.noms).find(k => e.noms[k] === nom) }; });
  await h(sid => { switchTab("eleves"); const cls = getCls(); chaleurMomentSet(_chaleurMoments(cls).find(c => c.type === "conseil" && c.pIdx === 0).key); openFiche(sid); }, ind.sid); await wait(800);
  const carte = await h(() => (document.getElementById("pf-suivis-carte") || {}).textContent || "");
  ok(/Suivi individuel/.test(carte) && /Réussite \d+.%.sur \d+ fiche/.test(carte) && /Fiches de classe/.test(carte), "fiche élève (conseil du S1) : la carte des fiches de suivi, calculée par l'appli (suivi individuel, fiches de classe)");
  ok((await h(() => _ficheFaits(getCls(), S.eleves[_ficheSid], _ficheMomentCourant(getCls())).filter(f => f.k === "suivi").length)) >= 2, "… et ses faits, insérables dans le bilan");
  await h(() => document.querySelector("#pf-suivis-carte button").click()); await wait(900);
  ok(await h(() => document.querySelector(".tab.on").id === "tab-suivis") && decodeURIComponent(fr.url()).endsWith("#eleve/" + ind.nom) && await f(n => document.querySelector("#el-choix").value === n, ind.nom), "« ↗ Ouvrir » : l'onglet 📋 Suivis, sur la fiche élève de l'appli");
  // 5 ter. carte de chaleur : le groupe des fiches de suivi ; réglages communs : enseignants de Suivi PP, référent de la fiche
  await h(() => { switchTab("eleves"); elevesAffichageSet("chaleur"); }); await wait(800);
  const tetes = await h(() => [...document.querySelectorAll(".el-chaleur thead th")].map(t => t.textContent.trim()));
  ok(tetes.some(t => /Fiches de suivi/.test(t)) && ["Indiv.", "Classe"].every(x => tetes.includes(x)) && await h(() => document.querySelectorAll('.el-chaleur td[onclick*="suivisAllerUI"]').length > 10), "carte de chaleur : le groupe « 📋 Fiches de suivi » (suivi individuel, fiches de classe), ses cases mènent à l'onglet");
  await h(() => elevesAffichageSet("indic"));
  const profs = await h(() => { const m = S.fichesSuivi["5C"].etat.S.matieres; const r = {}; for (const x of m) { const did = _matiereDiscAuto(_moyNorm(x.nom)); if (did && _discProfsAuto("5C", did)) r[x.nom] = [x.prof, _discProfs("5C", did)]; } return r; });
  ok(Object.keys(profs).length >= 8 && Object.values(profs).every(([a, b]) => a === b), "enseignants des matières : ceux de Suivi PP (moyennes), pas ceux de la démonstration des fiches (" + Object.keys(profs).length + " matières)");
  await h(() => switchTab("suivis")); await wait(600);
  await f(() => { location.hash = "#reglages"; }); await wait(500);
  ok(await f(() => document.querySelector('[data-path="referent"]').classList.contains("commun-hote") && !!document.querySelector(".commun-hote-hint")), "réglages de la fiche : les champs communs avec Suivi PP sont signalés");
  await fr.click("[data-path=referent]", { clickCount: 3 }); await fr.type("[data-path=referent]", "Mme PERCHE"); await f(() => document.activeElement.blur()); await wait(700);
  ok(await h(() => S.prefs.avisNom === "Mme PERCHE"), "référent modifié dans la fiche : c'est aussi le professeur principal de Suivi PP");
  await h(() => undoLast()); await wait(600);
  ok(await h(() => S.prefs.avisNom !== "Mme PERCHE") && await f(() => document.querySelector("[data-path=referent]").value !== "Mme PERCHE"), "Ctrl+Z : annulé des deux côtés");
  // la discipline Latin a un code d'option dans Suivi PP (démo : LATIN) : le pinceau de l'emploi du temps prend le groupe de l'option
  await f(() => { location.hash = "#edt"; }); await wait(600);
  await f(() => { pinGroupe = ""; document.querySelector('[data-pin="Latin"]').click(); }); await wait(300);
  ok(await f(() => pinceau && pinceau.mat === "Latin" && pinGroupe === "Latin"), "emploi du temps : la matière d'une discipline à option (code LATIN dans Suivi PP) se peint d'office pour le groupe de l'option");
  await f(() => { pinceau = null; pinGroupe = ""; });
  // le champ disciplinaire d'une matière = le domaine de sa discipline dans Suivi PP, dans les deux sens
  await h(() => { disciplineSet("histoire_geo", { domaine: "autre" }); save(); _suivisCommunMaj(); }); await wait(500);
  ok(await f(() => champDe(S.matieres.find(m => m.nom === "Hist.-Géo.")) === "autre"), "domaine changé dans Suivi PP : la matière de la fiche change de champ");
  await f(() => { location.hash = "#reglages/matieres"; }); await wait(500);
  const kHg = await f(() => S.matieres.findIndex(m => m.nom === "Hist.-Géo."));
  ok(await f(k => document.querySelector(`select[data-path="matieres.${k}.champ"]`).classList.contains("commun-hote"), kHg), "le menu du champ est signalé commun avec Suivi PP");
  await fr.select(`select[data-path="matieres.${kHg}.champ"]`, "lettres"); await wait(700);
  ok(await h(() => _discDomaine("histoire_geo") === "lettres"), "champ changé dans la fiche : le domaine de la discipline suit dans Suivi PP");
  // 6. Ctrl+P dans Suivi PP sur l'onglet : l'impression de la fiche ; rechargement : tout est là
  await f(() => { window.__imp = 0; addEventListener("message", ev => { if (ev.data && ev.data.type === "imprimer") window.__imp++; }); window.print = () => {}; });
  await h(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true }))); await wait(400);
  ok(await f(() => window.__imp === 1), "Ctrl+P dans Suivi PP : transmis à la fiche");
  const ferr = await f(() => window.__errs);
  // une frappe pas encore envoyée (la fiche attend 0,4 s) au moment où la page se ferme : reprise par Suivi PP
  const jourFiche = (await fiche()).etat.S.debut;
  await f(d => { location.hash = "#fiche/" + d; }, jourFiche); await wait(600);
  const com = await f(() => { const t = document.querySelector("textarea[data-com]"); return t ? t.dataset.com : null; });
  if (com !== null) { await fr.click(`textarea[data-com="${com}"]`); await fr.type(`textarea[data-com="${com}"]`, "Oubli de cahier"); }
  await p.reload(); await wait(1500); fr = null; await cadre(); await wait(2000);
  e = await fiche();
  ok(!!fr && e.etat.S.eleves.some(x => x.nom === nouveauNom), "page rechargée : l'onglet 📋 Suivis rouvre la fiche, avec ses données");
  ok(com !== null && ((e.etat.S.jours[jourFiche] || {}).com || {})[com] === "Oubli de cahier", "un commentaire tapé juste avant de fermer la page n'est pas perdu (frappe pas encore envoyée)");
  ok(!errs.length && !ferr.length, "aucune erreur JS" + (errs.length || ferr.length ? " : " + [...errs, ...ferr].join(" | ") : ""));
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
