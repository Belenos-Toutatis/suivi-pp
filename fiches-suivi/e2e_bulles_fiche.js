const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1366, height: 900 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); location.hash = "#fiche/2026-10-13"; }); await wait(500);
  const cibles = [[".frise a.on", "jour de la frise"], ["#kpis-jour .kpi:nth-child(1)", "carte Remplissage"], ["#kpis-jour .kpi:nth-child(2)", "carte Réussite"],
    ["#kpis-jour .kpi:nth-child(3)", "carte Absences"], ["select.mat", "matière"], ["th.prof", "enseignant"], ["label.pabs", "enseignant absent"],
    ["button.col-b", "code en tête de colonne"], ["select.eabs", "absence de l’élève"], ["td.obj[title], td.obj[data-tip]", "objectif"], ["#m-fiche summary", "menu ⋯"], ["#m-print summary", "menu ▾"]];
  let n = 0;
  for (const [sel, nom] of cibles) {
    await p.mouse.move(1, 1); await wait(120);
    const el = await p.$(sel); if (!el) { ok(false, `${nom} : élément introuvable (${sel})`); continue; }
    await el.hover(); await wait(550);
    const r = await p.evaluate(() => { const bl = document.querySelector("#bulle"), rr = bl.getBoundingClientRect(); return { on: bl.classList.contains("on"), t: (bl.querySelector(".t") || {}).textContent || "", lignes: bl.children.length, li: bl.querySelectorAll("li").length, dans: rr.left >= 0 && rr.right <= innerWidth && rr.bottom <= innerHeight }; });
    const bon = r.on && r.t && r.lignes >= 2 && r.dans; if (bon) n++;
    ok(bon, `${nom} : « ${r.t} » (${r.lignes} blocs, ${r.li} puces)`);
    if (nom === "carte Réussite") await p.screenshot({ path: DIR + "/sorties/bulle-kpi.png", clip: { x: 240, y: 60, width: 1126, height: 330 } });
    if (nom === "code en tête de colonne") await p.screenshot({ path: DIR + "/sorties/bulle-code.png", clip: { x: 240, y: 280, width: 1126, height: 330 } });
  }
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
