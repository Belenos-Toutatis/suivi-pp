// Corrections de l'audit 5
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs");
const D = __dirname, ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m), att = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox", "--lang=fr-FR"] });
  const p = await b.newPage(); await require(D + "/boites.js")(p, { messages: [] });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1024, height: 768 });
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await att(300);
  /* clic sur le segment du JOUR (à gauche du champ) : le milieu dépend de la police (avec Andika, il tombe sur le mois) */
  const jour = async sel => { const bb = await (await p.$(sel)).boundingBox(); await p.mouse.click(bb.x + 10, bb.y + bb.height / 2); };
  const ctrlZ = async () => { await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await att(150); };
  // 1. date tapée : une seule étape d'annulation, année absurde refusée
  await p.evaluate(() => { location.hash = "#reglages/calendrier"; }); await att(400);
  const fin0 = await p.evaluate(() => S.fin);
  await jour('input[data-path="fin"]'); await p.keyboard.type("18122026", { delay: 50 }); await p.keyboard.press("Tab"); await att(300);
  const fin1 = await p.evaluate(() => S.fin); await p.mouse.click(700, 120); await att(100); await ctrlZ();
  ok(fin1 === "2026-12-18" && await p.evaluate(() => S.fin) === fin0, `date tapée puis Ctrl+Z : retour direct à l’ancienne date (${fin1} → ${await p.evaluate(() => S.fin)})`);
  await jour('input[data-path="fin"]'); await p.keyboard.type("1812", { delay: 50 }); await p.keyboard.press("Tab"); await att(300);
  ok(await p.evaluate(() => /^20\d\d-/.test(S.fin)), "date incomplète : l’ancienne date est gardée (" + await p.evaluate(() => S.fin) + ")");
  // 2. heure tapée au clavier
  await p.evaluate(() => { location.hash = "#edt"; }); await att(400);
  await p.click('input[data-path="horairesBase.matin"]'); await p.keyboard.type("0815", { delay: 60 }); await p.keyboard.press("Tab"); await att(300);
  ok(await p.evaluate(() => S.horairesBase.matin) === "08:15", "heure tapée au clavier : début du matin = " + await p.evaluate(() => S.horairesBase.matin));
  // 3. vacances retirées : les semaines gardent leur type
  let r = await p.evaluate(() => { const av = new Map(semaines(S).map(w => [w.lundi, w.type])); const i = S.vacances.findIndex(v => v.label === "Toussaint");
    document.querySelector(`[data-del="vacances.${i}"]`) ? 0 : 0; return [...av.entries()].slice(0, 0); });
  await p.evaluate(() => { location.hash = "#reglages/calendrier"; }); await att(400);
  r = await p.evaluate(async () => { const av = new Map(semaines(S).map(w => [w.lundi, w.type])); const i = S.vacances.findIndex(v => v.label === "Noël" || /No/.test(v.label));
    document.querySelector(`[data-del="vacances.${i}"]`).click(); await new Promise(r => setTimeout(r, 300)); return semaines(S).filter(w => av.has(w.lundi) && av.get(w.lundi) !== w.type).length; });
  ok(r === 0, "vacances retirées : aucune semaine ne change de type A/B (" + r + ")");
  // 4. enseignant avec espace final : absence longue reconnue
  r = await p.evaluate(() => { const m = S.matieres.find(m => m.nom === "Français"); m.prof = "Mme SOLE "; S.absencesProf.push({ prof: "Mme SOLE", du: "2026-11-02", au: "2026-11-06", remplacant: "" });
    const sems = semaines(S), c = [0, 1, 2, 3, 4, 5, 6].map(q => creneau(S, sems, "2026-11-02", q)).find(c => c.mat === "Français"); S.absencesProf.pop(); m.prof = "Mme SOLE"; return c && c.absent; });
  ok(r === true, "nom d’enseignant avec espace final : son absence longue est reconnue");
  // 5. trimestres : chaque semaine dans une seule période
  r = await p.evaluate(() => { S.decoupage = { mode: "trimestres", fins: ["2026-11-18", "2026-12-02"] }; const sems = semaines(S); const l = periodesDecoupage(S, sems, "9999-12-31"); S.decoupage = { mode: "semestres", fins: [] };
    const vus = new Set(); let double = false; for (const [, [a, b2]] of l) for (let i = a; i <= b2; i++) { if (vus.has(i)) double = true; vus.add(i); } return [double, l.map(x => x[0] + ":" + x[1].join("-")).join(" ")]; });
  ok(!r[0], "trimestres : chaque semaine dans une seule période — " + r[1]);
  // 6. liste de la classe sans groupe : une ligne par élève
  r = await p.evaluate(async () => { const g = S.groupes; S.groupes = []; location.hash = "#reglages/classeEntiere"; render(); await new Promise(r => setTimeout(r, 300)); const h = document.querySelector(".liste.lcl .lrow").getBoundingClientRect().height; S.groupes = g; render(); return h; });
  ok(r < 60, "liste de la classe sans groupe : une ligne par élève (" + Math.round(r) + " px)");
  // 7. fiche collective : après un clic, le clavier prend le relais
  await p.evaluate(() => { location.hash = "#fiche/2026-11-17"; }); await att(500);
  const cible = await p.evaluate(() => { const c = document.querySelector("table.fiche td[data-x]"); const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, c.dataset.x]; });
  await p.mouse.click(cible[0], cible[1]); await att(250);
  ok(await p.evaluate(() => !!(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.x)), "fiche collective : la case cliquée prend le focus clavier");
  // 8. bouton Enregistrer : l'icône reste
  ok(await p.evaluate(() => !!document.querySelector("#b-save svg") && !!document.querySelector("#b-save span")), "bouton Enregistrer : icône et texte gardés");
  // 9. espaces insécables : aucune espace ordinaire avant ; : ! ? % » ni après « (pages, infobulles, impression)
  const fautes = [];
  for (const h of ["#sommaire", "#totaux", "#bilan", "#classesem/3", "#classebilan", "#indiv/demo-bridge", "#conseil", "#reglages/calendrier", "#edt"]) {
    await p.evaluate(h => { location.hash = h; }, h); await att(400);
    fautes.push(...await p.evaluate(h => { const w = document.createTreeWalker(document.querySelector("#view"), NodeFilter.SHOW_TEXT), l = [];
      for (let n; (n = w.nextNode());) { const pn = n.parentNode; if (/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(pn.nodeName)) continue; const m = n.nodeValue.match(/.{0,12}( [;:!?%»]|« ).{0,6}/); if (m) l.push(h + " « " + m[0] + " »"); } return l; }, h)); }
  ok(!fautes.length, "espaces insécables dans les pages " + fautes.slice(0, 4).join(" | "));
  r = await p.evaluate(() => [bulleHTML("Titre\n• réussite : 60 %"), (toast("Essai : 50 %"), document.querySelector("#toast").textContent)]);
  ok(!/ [:%]/.test(r[0]) && !/ [:%]/.test(r[1]), "infobulles et messages : espaces insécables");
  await p.evaluate(() => { window.print = () => {}; location.hash = "#totaux"; }); await att(400); await p.evaluate(() => imprimerVue());
  ok(await p.evaluate(() => !/[^\s] %/.test(document.querySelector("#print-area").textContent)), "impression : espaces insécables");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
