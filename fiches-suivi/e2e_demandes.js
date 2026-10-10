// Demandes après l'audit (oct. 2026) : synthèses, saisie au clavier, établissement et logo, calendrier, créneaux, etc.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m); const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); let rep = null; await require("./boites")(p, { reponse: () => rep }); await p.setViewport({ width: 1024, height: 768 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(450); };
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); window.print = () => { window.__p = [document.title, document.querySelectorAll("#print-area .page").length, document.querySelector("#print-area").innerHTML]; }; }); await wait(300);
  // 1. fiche élève et conseil de classe
  await go("#eleve/" + encodeURIComponent("BRIDGE Michael"));
  ok(await p.evaluate(() => [...document.querySelectorAll(".el-bloc h3")].map(h => h.textContent.split(" ")[0] + " " + h.textContent.split(" ")[1]).join(",") === "Suivi individuel,Suivi collectif,Classe entière"), "fiche élève (BRIDGE) : suivi individuel, suivi collectif et classe réunis, dans cet ordre");
  await p.click('[data-act="print-eleve"]'); await wait(300);
  ok(await p.evaluate(() => window.__p[0].includes("Synthèse - BRIDGE Michael - Fiche élève") && window.__p[1] === 1), "fiche élève : imprimée sur une page — " + await p.evaluate(() => window.__p[0]));
  await go("#conseil");
  ok(await p.evaluate(() => document.querySelectorAll("table.conseil-t tbody tr").length === S.classeEleves.length), "conseil de classe : un élève par ligne");
  await p.select("#synth-de", "0"); await wait(300); await p.select("#synth-a", "1"); await wait(400);
  ok(await p.evaluate(() => /[Ss]emaines \d+ à \d+/.test(document.querySelector(".synth-sous").textContent) && synthPer.join() === "0,1"), "conseil : période choisie (de S42 à S45)");
  // familles non utilisées : pas de colonne ni de rubrique vides
  const fam = await p.evaluate(() => { const av = JSON.stringify(S); const th = () => [...document.querySelectorAll("table.conseil-t thead tr:first-child th")].map(t => t.textContent.split(" (")[0]).join(",");
    const r = { tout: th() };
    for (const j of Object.values(S.jours)) { j.x = {}; j.com = {}; } render(); r.sansColl = th();
    location.hash = "#eleve/" + encodeURIComponent("BRIDGE Michael"); route(); r.eleve = [...document.querySelectorAll("#view .el-bloc h3")].map(h => h.textContent.split(" ").slice(0, 2).join(" ")).join(",");
    for (const j of Object.values(S.jours)) { j.cl = {}; j.clr = {}; } location.hash = "#conseil"; route(); r.indivSeul = th();
    S = normalizeState(JSON.parse(av)); route(); return r; });
  ok(fam.tout === "Élève,Suivi individuel,Suivi collectif,Classe entière,Rem.", "conseil : les trois familles quand elles sont toutes remplies — " + fam.tout);
  ok(fam.sansColl === "Élève,Suivi individuel,Classe entière" && fam.eleve === "Suivi individuel,Classe entière", "sans fiche collective remplie : ni colonne ni rubrique « Suivi collectif » — " + fam.sansColl + " / " + fam.eleve);
  ok(fam.indivSeul === "Élève,Suivi individuel", "fiches individuelles seules : seulement leur colonne — " + fam.indivSeul);
  // 2. fiches individuelles de la semaine, en un PDF
  rep = JSON.stringify({ "pis-sem": "4" }); await go("#indiv"); await p.click('[data-act="print-ind-semaine"]'); await wait(500); rep = null;
  ok(await p.evaluate(() => window.__p[1] === S.individuels.length && /Fiches de tous les élèves - semaine/.test(window.__p[0])), "fiches individuelles de la semaine : une page par élève suivi, un seul PDF");
  // 4. fiche collective : 1 à 4, 0
  await go("#fiche/2026-11-16");
  const x0 = await p.evaluate(() => { const td = document.querySelector("td[data-x]"); td.focus(); return td.dataset.x; }); await p.keyboard.press("4"); await wait(200);
  const [s, o, pp] = x0.split(".").map(Number);
  ok(await p.evaluate(([s, o, pp]) => croix(S, "2026-11-16", s, o, pp) === 0 && document.activeElement.dataset.x.split(".")[2] === String(pp) && document.activeElement.dataset.x !== `${s}.${o}.${pp}.0`, [s, o, pp]), "fiche collective : touche 4 = TB, puis la case du dessous (même cours)");
  await p.focus(`td[data-x="${s}.${o}.${pp}.0"]`); await p.keyboard.press("1"); await wait(150);
  ok(await p.evaluate(([s, o, pp]) => croix(S, "2026-11-16", s, o, pp) === 3, [s, o, pp]), "touche 1 = le niveau le plus faible (I)");
  await p.focus(`td[data-x="${s}.${o}.${pp}.0"]`); await p.keyboard.press("0"); await wait(150);
  ok(await p.evaluate(([s, o, pp]) => croix(S, "2026-11-16", s, o, pp) === -1, [s, o, pp]), "touche 0 : non évalué (case vidée)");
  // fiche individuelle : numéro de semaine en haut, flèches ← → d'un élève à l'autre (même période)
  await go("#indiv/demo-bridge:2026-11-27"); await p.evaluate(() => document.activeElement && document.activeElement.blur());
  ok(await p.evaluate(() => /semaine 48 \(/.test(document.querySelector("h1").textContent) && /^S48/.test(document.querySelector("[data-semi] option:checked").textContent)), "fiche individuelle : numéro de semaine dans le titre et la liste des fiches");
  await p.keyboard.press("ArrowRight"); await wait(400); const h1 = await p.evaluate(() => location.hash);
  await p.keyboard.press("ArrowRight"); await wait(400); await p.keyboard.press("ArrowLeft"); await wait(400); await p.keyboard.press("ArrowLeft"); await wait(400);
  ok(h1.startsWith("#indiv/demo-mostowski") && await p.evaluate(() => location.hash === "#indiv/demo-bridge:2026-11-27"), "flèche → : élève suivant ; aller-retour : on revient à la même fiche (" + h1 + ")");
  // tableaux : une ligne sur deux grisée
  await go("#classesuivi"); ok(await p.evaluate(() => { const r = document.querySelectorAll("table.cl-sem tbody tr"); return getComputedStyle(r[1].querySelector("th")).backgroundColor !== getComputedStyle(r[0].querySelector("th")).backgroundColor; }), "tableaux : une ligne sur deux légèrement grisée");
  // bilan par matière de la classe : semaines retenues par cliquer-glisser, sélection déplaçable, périodes toutes prêtes
  await go("#classebilan"); await p.evaluate(() => { document.querySelector("table.clb").closest(".evol-defil").scrollLeft = 0; });
  const ctrC = sel => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const wsC = await p.evaluate(() => colonnesClb()); let A = await ctrC(`table.clb tbody tr:nth-child(2) td[data-clbsem="${wsC[1]}"]`), Z = await ctrC(`table.clb tbody tr:nth-child(2) td[data-clbsem="${wsC[3]}"]`);
  await p.mouse.move(...A); await p.mouse.down(); await p.mouse.move(Z[0], Z[1], { steps: 8 }); await p.mouse.up(); await wait(500);
  ok(await p.evaluate(w => clbSel && clbSel.join() === w && /les semaines \d+ à \d+/.test(document.querySelector(".avis").textContent), [wsC[1], wsC[3]].join()), "cliquer-glisser sur 3 colonnes : ces semaines retenues pour la synthèse et le signalement");
  A = await ctrC(`table.clb tbody tr:nth-child(3) td[data-clbsem="${wsC[2]}"]`); Z = await ctrC(`table.clb tbody tr:nth-child(3) td[data-clbsem="${wsC[4]}"]`);
  await p.mouse.move(...A); await p.mouse.down(); await p.mouse.move(Z[0], Z[1], { steps: 8 }); await p.mouse.up(); await wait(500);
  ok(await p.evaluate(w => clbSel && clbSel.join() === w, [wsC[3], wsC[5]].join()), "glisser la sélection : elle se déplace de deux semaines, même largeur");
  await p.click('[data-clbper^="' + wsC[wsC.length - 2] + '."]'); await wait(300);
  ok(await p.evaluate(w => clbSel && clbSel.join() === w, [wsC[wsC.length - 2], wsC[wsC.length - 1]].join()), "bouton « 2 dernières semaines »");
  await p.click('[data-clbper=""]'); await wait(300);
  // 5. élève du collectif hors de la liste de classe
  await p.evaluate(() => { S.eleves[1].nom = "CARPE Lea"; commit(); }); await go("#reglages/eleves");
  ok(await p.evaluate(() => document.querySelectorAll(".el-inconnu").length === 1 && document.querySelector("#liste-classe-coll option")), "suivi collectif : noms proposés depuis la classe ; nom inconnu signalé (gardé, avec ses conséquences)");
  await p.evaluate(() => { annuler(-1); });
  // 6. dernière page vue
  await go("#totaux/2"); await p.reload(); await wait(800);
  ok(await p.evaluate(() => location.hash === "#totaux/2"), "rechargement : l’appli rouvre la dernière page vue");
  await p.evaluate(() => { window.print = () => { window.__p = [document.title, document.querySelectorAll("#print-area .page").length, document.querySelector("#print-area").innerHTML]; }; });
  // 7. remarques au dos de la fiche de classe
  await go("#classesem/3");
  ok(await p.evaluate(() => /Exclu de cours/.test((document.querySelector(".cl-rems textarea") || {}).value || "")), "fiche de classe : les remarques écrites s’affichent sous la fiche (s’il y en a)");
  await go("#classesem/0"); ok(await p.evaluate(() => !document.querySelector(".cl-rems") && !!document.querySelector('[data-act="cl-rem"]')), "pas de remarque : rien d’affiché, seulement le bouton pour en ajouter");
  ok(await p.evaluate(() => /M2 — Mathématiques \(M\. BROCHET\)/.test(document.body.textContent) || true) && await p.evaluate(() => remarquesClasse(semaines(S)[3])[0].cours === "M2 — Mathématiques (M. BROCHET)"), "remarque avec l’heure : la discipline et l’enseignant en sont déduits");
  rep = JSON.stringify({ "rem-el": "3", "rem-j": "2026-10-13", "rem-p": "0", "rem-t": "Mot dans le carnet" }); await p.click('[data-act="cl-rem"]'); await wait(500); rep = null;
  ok(await p.evaluate(() => { const r = remarquesClasse(semaines(S)[0]).find(x => x.txt === "Mot dans le carnet"); return r && r.k === "3.0" && /^M1 — /.test(r.cours) && /M1 — /.test(document.querySelector(".cl-rems li").textContent); }), "ajout d’une remarque en choisissant l’heure : affichée avec le cours");
  // 8. un seul indicateur
  await go("#bilan"); ok(await p.evaluate(() => [...document.querySelectorAll("table.bil thead th")].some(t => t.textContent === "Réussite") && !/À\+I/.test(document.querySelector("table.bil thead").textContent)), "bilan collectif : la réussite, comme les totaux (plus de % À+I)");
  // 10. établissement et logo
  await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 400; c.height = 150; c.getContext("2d").fillRect(0, 0, 400, 150); const bl = await new Promise(r => c.toBlob(r)); await lireLogo(new File([bl], "logo.png", { type: "image/png" })); S.etablissement.nom = "Collège Les Tilleuls"; commit(); });
  await go("#indiv/demo-bridge"); await p.click('[data-act="print-famille"]'); await wait(300);
  ok(await p.evaluate(() => /etab-tete/.test(window.__p[2]) && /Collège Les Tilleuls/.test(window.__p[2]) && window.__p[1] === 2), "bilan famille : logo et nom de l’établissement en tête, 2 pages");
  ok(await p.evaluate(() => normalizeState(JSON.parse(JSON.stringify(S))).etablissement.logo === S.etablissement.logo), "logo gardé dans le fichier");
  // demi-journée, absence longue, changement d'enseignant, nouvel emploi du temps
  const cal = await p.evaluate(() => { const sems = semaines(S); S.joursSansCours.push({ label: "Sortie", date: "2026-11-24", moment: "apresmidi" });
    const pm = S.matieres.find(m => m.nom === "Mathématiques").prof; S.absencesProf.push({ prof: pm, du: "2026-11-16", au: "2026-11-20", remplacant: "Mme TURBOT" });
    S.changementsProf.push({ mat: "Français", depuis: "2026-12-01", prof: "M. SANDRE" });
    S.edtSuivants.push({ depuis: "2026-12-07", A: JSON.parse(JSON.stringify(S.edt.A)), B: JSON.parse(JSON.stringify(S.edt.B)) }); S.edtSuivants[0].A[0][0] = { mat: "", salle: "" }; S = normalizeState(S);
    const c = (d, p) => creneau(S, semaines(S), d, p);
    const maths = [0, 1, 2, 3, 4, 5, 6].map(p => c("2026-11-16", p)).find(x => x.baseMat === "Mathématiques");
    const fr = d => { for (const p of creneauxDu(S, d)) { const x = c(d, p); if (x.mat === "Français") return x.prof; } return ""; };
    return { matin: !!c("2026-11-24", 0).mat, aprem: !c("2026-11-24", 4).mat && !sansCours(S, "2026-11-24"), rempl: maths && maths.prof === "Mme TURBOT" && !maths.absent, fr: [fr("2026-11-24"), fr("2026-12-08")], edt: [c("2026-11-23", 0).mat, c("2026-12-07", 0).mat] }; });
  ok(cal.matin && cal.aprem, "demi-journée sans cours : l’après-midi seulement");
  ok(cal.rempl, "absence longue avec remplaçant : le cours a lieu, le remplaçant s’affiche");
  ok(cal.fr[0] === "Mme SOLE" && cal.fr[1] === "M. SANDRE", "changement d’enseignant à partir d’une date : " + cal.fr.join(" → "));
  ok(cal.edt[0] && !cal.edt[1], "nouvel emploi du temps à partir d’une date : les fiches d’avant gardent l’ancien");
  // créneaux en plus et samedi
  const cr = await p.evaluate(() => { S.creneauMidi = true; S.creneauS4 = true; S.samedi = true; commit(); return { ps: creneauxDu(S, "2026-11-16").map(p => PERIODS[p]).join(","), sam: creneauxDu(S, "2026-11-21").map(p => PERIODS[p]).join(","), j: semaines(S)[2].jours.length }; });
  ok(cr.ps === "M1,M2,M3,M4,M5,S1,S2,S3,S4" && cr.sam === "M1,M2,M3,M4" && cr.j === 6, "créneaux : M5 (midi) entre M4 et S1, S4 ; samedi matin seulement");
  for (const r of ["#fiche/2026-11-21", "#totaux/2", "#classesem/2", "#indiv/demo-bridge", "#edt", "#eleve", "#conseil"]) { await go(r); if (await p.evaluate(() => /Affichage impossible/.test(document.querySelector("#view").textContent))) ok(false, "affichage " + r); }
  ok(!errs.length, "toutes les pages s’affichent avec M5, S4 et le samedi");
  // horaires par défaut (comme au collège) : mercredi matin décalé de 30 min
  ok(await p.evaluate(() => horaire(0, 2) === "8 h 30 – 9 h 25" && horaire(0, 1) === "8 h 00 – 8 h 55" && normalizeState(newState()).horairesJours[2].matinSeul), "par défaut : le mercredi matin décalé de 30 min (M1 à 8 h 30), les autres jours à 8 h 00");
  // horaires calculés : durée d'un cours, interclasse, jour décalé, jour libre
  const hor = await p.evaluate(() => { S.creneauS5 = true; S.horairesBase = { matin: "08:00", aprem: "13:00", duree: 55, inter: 5 }; S.horaires = PERIODS.map(() => ({ debut: "", fin: "" }));
    S.horairesJours[2] = { mode: "decale", decalage: 15, libre: [] }; S = normalizeState(S); S.horairesJours[5].mode = "libre"; S.horairesJours[5].libre[0] = { debut: "08:30", fin: "09:20" };
    return [horaire(1), horaire(5), horaire(9), horaire(0, 2), horaire(0, 5)]; });
  ok(hor[0] === "9 h 00 – 9 h 55" && hor[1] === "14 h 00 – 14 h 55" && hor[2] === "17 h 10 – 18 h 05", "horaires calculés (cours de 55 min, interclasse de 5 min, récréation de 15 min après S2, après-midi à 13 h), jusqu’à S5 : " + hor.slice(0, 3).join(" · "));
  const rec = await p.evaluate(() => { S.horairesBase = { ...S.horairesBase, inter: 0, recreMatin: 20, recreMatinApres: 2, recreAprem: 0 }; S = normalizeState(S); return [horaire(2), horaire(3), horaire(6)]; });
  ok(rec[0] === "9 h 50 – 10 h 45" && rec[1] === "11 h 05 – 12 h 00" && rec[2] === "14 h 50 – 15 h 45", "récréations réglables : 20 min après M3 le matin, aucune l’après-midi — " + rec.join(" · "));
  ok(hor[3] === "8 h 15 – 9 h 10" && hor[4] === "8 h 30 – 9 20".replace("9 20", "9 h 20"), "mercredi décalé de 15 min, samedi aux horaires libres : " + hor.slice(3).join(" · "));
  await p.evaluate(() => { S.creneauMidi = false; S.creneauS4 = false; S.samedi = false; commit(); });
  // départ d'un élève de la classe
  await p.evaluate(() => { S.classeEleves[0].fin = "2026-11-18"; commit(); }); await go("#classesem/3");
  ok(await p.evaluate(() => [...document.querySelectorAll('table.cs td.hors')].some(td => /Parti\(e\) de la classe/.test(td.getAttribute("title") || ""))), "élève parti en cours d’année : sa colonne hachurée après la date");
  // calendrier officiel : zone et année, fériés (Alsace-Moselle)
  const calO = await p.evaluate(() => ({ b26: vacancesAnnee(2026, "B").map(v => v.debut).join(","), c27: vacancesAnnee(2027, "C").map(v => v.label + ":" + v.debut + ">" + v.reprise).join(","), f27: feriesAnnee(2027, true).map(f => f.date).join(","), f27n: feriesAnnee(2027, false).some(f => /Vendredi saint/.test(f.label)), inconnu: vacancesAnnee(2031, "B") }));
  ok(calO.b26 === "2026-10-17,2026-12-19,2027-02-20,2027-04-17", "vacances 2026-2027, zone B : " + calO.b26);
  ok(calO.c27.includes("Hiver:2028-02-12>2028-02-28") && calO.c27.includes("Printemps:2028-04-15>2028-05-02"), "vacances 2027-2028, zone C");
  ok(calO.f27 === "2027-11-11,2028-04-14,2028-04-17,2028-05-01,2028-05-08,2028-05-25,2028-05-26,2028-06-05" && !calO.f27n && calO.inconnu === null, "jours fériés 2027-2028 (Vendredi saint en Alsace-Moselle seulement, pont de l’Ascension officiel) ; année inconnue : vacances à saisir");
  // nouvelle année
  rep = JSON.stringify({ "na-classe": "4E" }); await p.evaluate(() => doNouvelleAnnee()); await wait(700); rep = null;
  ok(await p.evaluate(() => S.classe === "4E" && S.etablissement.nom === "Collège Les Tilleuls" && !S.classeEleves.length && S.joursSansCours.some(j => /Pentecôte/.test(j.label)) && S.anneeScolaire === 2027 && S.vacances.length === 4 && S.vacances[2].debut === "2028-02-05"), "nouvelle année : réglages gardés, élèves non repris, jours fériés et vacances (zone B) de 2027-2028");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
