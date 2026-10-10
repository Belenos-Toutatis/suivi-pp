// Audit d'écran avec l'auditeur de Suivi PP (scripts/audit_browser.js) : contraste WCAG de chaque texte, débordement
// horizontal, texte tronqué sans infobulle — sur chaque vue du menu et les réglages, en thème clair et sombre, avec les
// deux polices d'affichage, à 1366 × 768 et 1024 × 768 (2026-10-10, apparence de Suivi PP).
// Usage : node e2e_contraste.js [fichier.html]   (par défaut, l'application assemblée)
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), path = require("path");
const DIR = __dirname, APP = "file://" + (process.argv[2] ? path.resolve(process.argv[2]) : DIR + "/app/Fiche de suivi collective.html");
const AUDIT = path.join(DIR, "..", "scripts", "audit_browser.js");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await wait(400);
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.addScriptTag({ path: AUDIT });
  const passe = async (label) => page.evaluate(l => { __audit.reset(); __audit.run(l); const r = __audit.report(); return JSON.stringify(r.defauts || r); }, label);
  const bilan = [];
  for (const [w, h] of [[1366, 768], [1024, 768]]) {
    await page.setViewport({ width: w, height: h });
    for (const theme of ["clair", "sombre"]) for (const police of ["", "lm"]) {
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      /* l'accueil (aucun suivi ouvert) : le suivi est mis de côté le temps de la mesure */
      await page.evaluate(() => { window.__S = S; S = null; location.hash = ""; render(); });
      bilan.push([`${w} · ${theme} · ${police || "andika"} · accueil`, await passe("accueil")]);
      await page.evaluate(() => { S = window.__S; render(); });
      await page.evaluate(async p => { if (!S || !S.demo) await doDemo(); if (p) S.policeEcran = p; else delete S.policeEcran; if (typeof appliquerPolices === "function") appliquerPolices(); }, police);
      const vues = await page.evaluate(() => [...new Set([...document.querySelectorAll(".side nav a[href^='#']")].map(a => a.getAttribute("href")))]
        .concat(["#reglages", "#reglages/pastilles", "#reglages/calendrier", "#reglages/matieres", "#reglages/classeEntiere", "#reglages/suivisIndiv", "#reglages/ficheClasse", "#indiv/demo-bridge"]));
      for (const v of vues) {
        await page.evaluate(v => { location.hash = v; }, v); await wait(250);
        bilan.push([`${w} · ${theme} · ${police || "andika"} · ${v}`, await passe(v)]);
      }
    }
  }
  let nbDef = 0;
  for (const [l, r] of bilan) { const d = JSON.parse(r); const n = Array.isArray(d) ? d.length : 0; nbDef += n; if (n) ok(false, `${l} : ${r.slice(0, 4000)}`); }
  ok(nbDef === 0, `${bilan.length} états mesurés (contraste, débordement, texte tronqué) : ${nbDef} défaut${nbDef > 1 ? "s" : ""}`);
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
