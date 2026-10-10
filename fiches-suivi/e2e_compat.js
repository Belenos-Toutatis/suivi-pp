// Rétrocompatibilité (à partir du format 1 du 10/10/2026) : les fichiers de référence de compat/ se rouvrent sans rien perdre.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const D = __dirname;
const ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m), att = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require(D + "/boites.js")(p, { messages: msgs }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  /* tout ce qui est dans la référence doit se retrouver à l'identique (une version plus récente peut ajouter des champs, pas en perdre ni en changer) */
  const garde = `(ref, x) => { const ecarts = []; const cmp = (a, b, ch) => { if (a && typeof a === "object") { for (const k of Object.keys(a)) cmp(a[k], b == null ? undefined : b[k], ch + "." + k); } else if (a !== b) ecarts.push(ch + " : " + JSON.stringify(a) + " → " + JSON.stringify(b)); }; cmp(ref, x, "S"); return ecarts; }`;
  for (const f of fs.readdirSync(D + "/compat").filter(f => /\.(json|html)$/.test(f))) {
    const texte = fs.readFileSync(D + "/compat/" + f, "utf8");
    const r = await p.evaluate(async (texte, f, garde) => { const ref = /\.json$/.test(f) ? JSON.parse(texte).S : lireBloc(texte).S;
      const lu = await loadFile(new File([texte], f)); const ecarts = eval(garde)(ref, JSON.parse(JSON.stringify(S))); render(); return { lu, ecarts: ecarts.slice(0, 5), n: ecarts.length }; }, texte, f, garde);
    ok(r.lu && r.n === 0, `${f} : rouvert sans rien perdre${r.n ? " — écarts : " + r.ecarts.join(" | ") : ""}`);
  }
  /* la page de référence elle-même s'ouvre et affiche son suivi */
  const p2 = await b.newPage(); await require(D + "/boites.js")(p2, {}); const e2 = []; p2.on("pageerror", e => e2.push(e.message));
  await p2.goto("file://" + D + "/compat/format1-2026-10-10.html"); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await att(500);
  for (const v of ["#sommaire", "#indiv", "#classesem/1", "#reglages", "#edt", "#conseil"]) { await p2.evaluate(v => { location.hash = v; }, v); await att(150); }
  ok(e2.length === 0 && await p2.evaluate(() => S && S.classe === "5E RÉF"), "la page de référence enregistrée s’ouvre seule et fonctionne");
  console.log(errs.length + e2.length ? "ERREURS JS : " + [...errs, ...e2].join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
