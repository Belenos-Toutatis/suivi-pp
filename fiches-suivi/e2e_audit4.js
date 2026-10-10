// Corrections de l'audit 4 (fonctionnement)
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs");
const D = __dirname, ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m), att = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require(D + "/boites.js")(p, { messages: msgs });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1024, height: 768 });
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo());
  // 1. saisies M5 / remarque S5 gardées par normalizeState
  let r = await p.evaluate(() => { S.creneauMidi = true; S.creneauS4 = true; S.creneauS5 = true; const ind = S.individuels[0];
    ind.saisies["2026-11-02.7"] = { c: ind.objectifs.map(() => 0), r: "midi" }; jour(S, "2026-11-17", true).clr["0.9"] = "en S5";
    const n = normalizeState(JSON.parse(JSON.stringify(S))); return [!!n.individuels[0].saisies["2026-11-02.7"], n.jours["2026-11-17"].clr["0.9"], (() => { const m = normalizeState({ ...JSON.parse(JSON.stringify(S)), jours: { "2026-10-13": { abs: { "0": "matin" } } } }); return m.jours["2026-10-13"].abs[0]; })()]; });
  ok(r[0] && r[1] === "en S5", "saisie individuelle en M5 et remarque en S5 gardées au rechargement");
  ok(JSON.stringify(r[2]) === "[0,1,2,3,7]", "ancienne absence « matin » convertie en créneaux " + JSON.stringify(r[2]));
  // 2. totaux de la fiche de classe : un jour sans cours ajouté après coup n'est plus compté
  r = await p.evaluate(() => { const w = semaines(S).find(w => w.jours.includes("2026-10-13")); const tot = () => bilanSemaineClasse(w).reduce((a, x) => a + x.neg, 0);
    const av = tot(), n13 = Object.values(S.jours["2026-10-13"].cl || {}).join("").replace(/[A+]/g, "").length; S.joursSansCours.push({ label: "Sortie", date: "2026-10-13", moment: "" }); viderCacheCalc(); const ap = tot();
    const bm = bilanMatiereClasse(-1), wi = semaines(S).findIndex(x => x.lundi === w.lundi), somme = bm.mats.reduce((a, m) => a + (m.parSem.get(wi) || 0), 0); S.joursSansCours.pop(); viderCacheCalc(); return { av, ap, n13, somme }; });
  ok(r.ap < r.av && r.ap === r.somme, "fiche de classe : le total de la semaine suit le jour sans cours ajouté, comme le bilan par matière " + JSON.stringify(r));
  // 3. réussite individuelle : jour sans cours ajouté après la saisie
  r = await p.evaluate(() => { const ind = S.individuels.find(i => i.nom.startsWith("BRIDGE")), c = cyclesIndiv(ind).find(c => c.jours.includes("2026-11-17"));
    const tot = () => statsIndiv(ind, c).reduce((a, x) => a + x[1], 0), av = tot(); S.joursSansCours.push({ label: "Sortie", date: "2026-11-17", moment: "" }); const ap = tot(); S.joursSansCours.pop(); return { av, ap }; });
  ok(r.ap < r.av, "fiche individuelle : les codes d'un jour devenu sans cours ne comptent plus " + JSON.stringify(r));
  // 4. jour de remise férié
  r = await p.evaluate(() => { const ind = S.individuels[0]; S.joursSansCours.push({ label: "Férié", date: "2026-11-20", moment: "" }); S.joursSansCours.push({ label: "Pont", date: "2026-11-23", moment: "" });
    const c = cyclesIndiv(ind).find(c => c.jours.includes("2026-11-19")); const t = consigneIndiv(ind, c); S.joursSansCours.splice(-2); return t; });
  ok(/jeudi 19 novembre/.test(r) && !/vendredi 20/.test(r) && (/mardi 24 novembre/.test(r) || !/\[reprise\]/.test(r)), "remise un jour férié : la consigne donne le dernier jour de cours — " + r.replace(/\n/g, " ").slice(0, 200));
  // 5. renommer un élève : proposé partout
  r = await p.evaluate(async () => { location.hash = "#reglages/classeEntiere"; await new Promise(r => setTimeout(r, 300));
    const i = S.classeEleves.findIndex(e => e.nom.startsWith("BRIDGE")), inp = document.querySelector(`input[data-path="classeEleves.${i}.nom"]`); inp.value = "BRIDGE Mike"; inp.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 500)); return [S.classeEleves[i].nom, S.eleves.some(e => e.nom === "BRIDGE Mike"), S.individuels.some(e => e.nom === "BRIDGE Mike")]; });
  ok(r[0] === "BRIDGE Mike" && r[1] && r[2], "renommer dans la classe : corrigé aussi dans le suivi collectif et le suivi individuel " + JSON.stringify(r) + " | " + (msgs.at(-1) || "").slice(0, 80));
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await att(200);
  // 6. absence longue sans remplaçant : les « A » des cours annulés sont effacés
  r = await p.evaluate(async () => { const sems = semaines(S); let k = null;
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-14"]) for (const q of creneauxDu(S, d)) { const c = creneau(S, sems, d, q); if (c.mat === "Mathématiques" && !k) k = [d, q, c.prof]; }
    const j = jour(S, k[0], true); j.cl["3." + k[1]] = "A"; S.absencesProf.push({ prof: k[2], du: k[0], au: k[0], remplacant: "" }); await effacerCoursAnnules(); return [k, j.cl["3." + k[1]] === undefined]; });
  ok(r[1] === true, "absence longue : le « A » d'un cours annulé est effacé " + JSON.stringify(r));
  await p.evaluate(() => { S.absencesProf.pop(); });
  // 7. changement d'enseignant daté : les bilans par matière montrent les deux
  r = await p.evaluate(() => { S.changementsProf.push({ mat: "Mathématiques", depuis: "2026-11-16", prof: "Mme NOUVELLE" }); const m = bilanMatiereClasse(-1).mats.find(m => m.mat === "Mathématiques"); const c = bilan(S, semaines(S)).find(x => x.mat === "Mathématiques"); S.changementsProf.pop(); return [m.prof, c && c.prof]; });
  ok(/puis Mme NOUVELLE/.test(r[0]) && /puis Mme NOUVELLE/.test(r[1] || "puis Mme NOUVELLE"), "bilans par matière : « M. … puis Mme NOUVELLE » " + JSON.stringify(r));
  // 8. flèche bas : de M4 à M5
  r = await p.evaluate(async () => { S.creneauMidi = true; S.edt.A[0][7] = { mat: "Mathématiques", salle: "" }; S.edt.B[0][7] = { mat: "Mathématiques", salle: "" }; location.hash = "#indiv/" + S.individuels[0].id; render(); await new Promise(r => setTimeout(r, 300));
    const c = [...document.querySelectorAll("td.ic[data-ic]")].find(x => /\.3\.0$/.test(x.dataset.ic) && x.dataset.ic.split(".")[1] === x.dataset.ic.split(".")[1]); c.focus(); c.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    return [c.dataset.ic, document.activeElement.dataset.ic]; });
  ok(r[1] && r[1].split(".")[2] === "7", "fiche individuelle : flèche bas de M4 va en M5 " + JSON.stringify(r));
  // 9. conseil de classe : temps de calcul
  r = await p.evaluate(() => { const t = performance.now(); conseilHTML(false); return Math.round(performance.now() - t); });
  ok(r < 1500, "conseil de classe calculé en " + r + " ms");
  // 10. date tapée au clavier dans les Réglages
  await p.evaluate(() => { location.hash = "#reglages/calendrier"; }); await att(400);
  /* clic sur le segment du JOUR (à gauche du champ) : le milieu dépend de la police (avec Andika, il tombe sur l'année) */
  { const bb = await (await p.$('input[data-path="fin"]')).boundingBox(); await p.mouse.click(bb.x + 10, bb.y + bb.height / 2); } await p.keyboard.type("18122026", { delay: 60 }); await p.keyboard.press("Tab"); await att(300);
  ok(await p.evaluate(() => S.fin) === "2026-12-18", "date tapée au clavier : fin du suivi = " + await p.evaluate(() => S.fin));
  // 11. changer le premier lundi garde le type A/B des semaines
  r = await p.evaluate(async () => { const t = semaines(S).find(w => w.lundi === "2026-11-02").type; const inp = document.querySelector('input[data-path="debut"]'); inp.focus(); inp.value = "2026-10-19"; inp.dispatchEvent(new Event("change", { bubbles: true })); inp.blur(); await new Promise(r => setTimeout(r, 300)); return [t, semaines(S).find(w => w.lundi === "2026-11-02").type, S.debut]; });
  ok(r[0] === r[1] && r[2] === "2026-10-19", "premier lundi changé : la semaine du 02/11 garde son type " + JSON.stringify(r));
  // 12. samedi : pas de M5
  ok(await p.evaluate(() => { S.creneauMidi = true; return creneauxDu(S, "2026-11-07").includes(7) === false; }), "samedi : M1 à M4 seulement, même avec M5");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
