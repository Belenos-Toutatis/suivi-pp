// Fichiers de référence du format 1 (10/10/2026) : toute version suivante doit les rouvrir sans rien perdre.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const D = __dirname;
(async () => { const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require(D + "/boites.js")(p, {});
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  const r = await p.evaluate(() => { doDemo(); S.demo = false; S.classe = "5E RÉF";
    /* quelques réglages hors démo, pour que la référence couvre plus de champs */
    S.decoupage = { mode: "trimestres", fins: [] }; S.pastillesVertes = true; S.etablissement = { nom: "Collège de référence", logo: "", sansNom: false };
    S.absencesProf.push({ prof: S.matieres.find(m => m.prof).prof, du: "2026-11-16", au: "2026-11-17", remplacant: "" });
    S = normalizeState(S); const d = { app: "fiche-suivi-collective", format: FORMAT_DONNEES, savedAt: "2026-10-10T12:00:00.000Z", S };
    return { json: JSON.stringify(d, null, 1), html: pageAvecDonnees(d) }; });
  fs.writeFileSync(D + "/compat/format1-2026-10-10.json", r.json); fs.writeFileSync(D + "/compat/format1-2026-10-10.html", r.html);
  console.log(r.json.length, r.html.length);
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
