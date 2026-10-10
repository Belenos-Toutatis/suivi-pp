const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1024, height: 768 });
  const dialogs = []; await require("./boites")(page, { messages: dialogs });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => { doDemo(); window.__pages = []; window.print = () => window.__pages.push([...document.querySelectorAll("#print-area .page")].map(p => p.querySelector("[data-titre]") ? p.querySelector("[data-titre]").textContent.trim() : "?")); });
  await page.evaluate(() => { location.hash = "#fiche/2026-11-18"; }); await wait(400);
  const last = () => page.evaluate(() => window.__pages[window.__pages.length - 1] || []);
  // bouton principal : une seule fiche
  await page.click('.imprimer-groupe > button'); ok((await last()).length === 1, "Imprimer : 1 fiche");
  // menu ▾
  await page.click('#m-print summary'); await wait(150);
  const vis = await page.evaluate(() => { const r = document.querySelector("#m-print .pop").getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight, sx: document.documentElement.scrollWidth }; });
  ok(vis.l >= 0 && vis.r <= vis.w && vis.sx <= vis.w, `menu visible en entier à 1024 (gauche ${Math.round(vis.l)}, droite ${Math.round(vis.r)}, bas ${Math.round(vis.b)}/${vis.h})`);
  await page.screenshot({ path: DIR + "/sorties/impr-menu-1024.png" });
  const txtSem = await page.$eval('#m-print [data-act="print-week"]', b => b.textContent);
  await page.click('#m-print [data-act="print-week"]'); const pw = await last();
  ok(pw.length >= 1 && pw.length <= 5 && /fiches?/.test(txtSem), `Toute la semaine : ${pw.length} fiches (${txtSem.trim()})`);
  ok(!(await page.$eval("#m-print", d => d.open)), "le menu se referme après impression");
  // période sur 3 semaines
  await page.click('#m-print summary'); await wait(100);
  const attendu = await page.evaluate(() => { const du = "2026-11-16", au = "2026-12-04";
    document.querySelector("#pr-du").value = du; document.querySelector("#pr-du").dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#pr-au").value = au; document.querySelector("#pr-au").dispatchEvent(new Event("change", { bubbles: true }));
    return ficheDates().filter(d => d >= du && d <= au && !sansCours(S, d)).length; });
  const nb = await page.$eval("#pr-nb", e => e.textContent);
  ok(nb === attendu + " fiches", `compteur de la période : « ${nb} » (attendu ${attendu})`);
  await page.click('#m-print [data-act="print-periode"]'); const pp = await last();
  ok(pp.length === attendu, `période imprimée : ${pp.length} pages, de « ${pp[0]} » à « ${pp[pp.length - 1]} »`);
  // du après au : corrigé
  await page.click('#m-print summary'); await wait(100);
  const inv = await page.evaluate(() => { const s = document.querySelector("#pr-du"); s.value = "2026-12-11"; s.dispatchEvent(new Event("change", { bubbles: true })); return [s.value, document.querySelector("#pr-au").value, document.querySelector("#pr-nb").textContent]; });
  ok(inv[0] === inv[1] && inv[2] === "1 fiche", `« du » après « au » : « au » suit (${inv.join(" / ")})`);
  // période mémorisée après changement de jour
  await page.keyboard.press("Escape");
  ok(!(await page.$eval("#m-print", d => d.open)), "Échap referme le menu");
  await page.evaluate(() => { location.hash = "#fiche/2026-11-19"; }); await wait(300);
  ok(await page.$eval("#pr-du", s => s.value) === "2026-12-11", "la période choisie est retenue d’un jour à l’autre");
  // grosse période : confirmation
  dialogs.length = 0;
  await page.click('#m-print summary'); await wait(100);
  await page.evaluate(() => { const o = [...document.querySelectorAll("#pr-du option")]; document.querySelector("#pr-du").value = o[0].value; document.querySelector("#pr-du").dispatchEvent(new Event("change", { bubbles: true }));
    const a = [...document.querySelectorAll("#pr-au option")]; document.querySelector("#pr-au").value = a[a.length - 1].value; document.querySelector("#pr-au").dispatchEvent(new Event("change", { bubbles: true })); });
  await page.click('#m-print [data-act="print-periode"]');
  ok(dialogs.length === 1 && /\d+ fiches, soit \d+ pages/.test(dialogs[0]), `plus de 25 fiches : confirmation (${(dialogs[0] || "").replace("\n", " – ")})`);
  // sombre
  await page.evaluate(() => appliquerTheme("sombre")); await page.click('#m-print summary'); await wait(150);
  await page.screenshot({ path: DIR + "/sorties/impr-menu-sombre.png" });
  // vrai PDF d'une période de 5 jours
  await page.evaluate(() => { location.hash = "#fiche/2026-11-18"; window.print = () => {}; }); await wait(300);
  await page.evaluate(() => { const jours = ficheDates().filter(d => d >= "2026-11-16" && d <= "2026-11-20" && !sansCours(S, d)); const a = document.querySelector("#print-area"); a.innerHTML = jours.map(d => `<div class="page sheet">${ficheHTML(d, false)}</div>`).join(""); });
  const nj = await page.evaluate(() => document.querySelectorAll("#print-area .page").length);
  await page.emulateMediaType("print"); const pdf = await page.pdf({ preferCSSPageSize: true });
  fs.writeFileSync(DIR + "/sorties/impr-periode.pdf", pdf);
  const nPages = Number(require("child_process").execSync(`pdfinfo "${DIR}/sorties/impr-periode.pdf"`).toString().match(/Pages:\s+(\d+)/)[1]);
  ok(nPages === nj, `PDF : ${nPages} pages pour ${nj} fiches (une fiche par page)`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
