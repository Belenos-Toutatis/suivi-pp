const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1024, height: 768 });
  const natifs = []; page.on("dialog", d => { natifs.push(d.type()); d.accept(); });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  const D = "2026-10-12";
  await page.evaluate(D => { location.hash = "#fiche/" + D; }, D); await wait(300);
  await page.evaluate(D => { const j = jour(S, D, true); j.x = {}; j.profAbs = {}; j.x["0.0.2"] = 0; j.x["1.1.2"] = 1; commit(); }, D); await wait(200);
  const etat = () => page.evaluate(() => { const d = document.querySelector("#boite"); const r = d.getBoundingClientRect();
    return { open: d.open, titre: (d.querySelector("h2") || {}).textContent, focus: document.activeElement && document.activeElement.textContent, cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: innerWidth, h: innerHeight, cls: d.className }; });
  // 1. enseignant absent avec des croix : fenêtre interne, Échap annule
  await page.click('input[data-pabs="2"]'); await wait(200);
  let e = await etat();
  ok(e.open && /Enseignant absent/.test(e.titre) && natifs.length === 0, `fenêtre interne ouverte (« ${e.titre.trim()} »), aucune fenêtre du navigateur`);
  ok(Math.abs(e.cx - e.w / 2) < 2 && Math.abs(e.cy - e.h / 2) < 40, `centrée à l’écran (${Math.round(e.cx)}, ${Math.round(e.cy)} pour ${e.w}×${e.h})`);
  ok(e.focus === "Annuler" && e.cls === "danger", `action destructive : le focus est sur « Annuler » (focus : ${e.focus})`);
  await page.screenshot({ path: DIR + "/sorties/boite-clair.png" });
  await page.keyboard.press("Escape"); await wait(200);
  const r1 = await page.evaluate(D => [document.querySelector("#boite").open, document.querySelector('input[data-pabs="2"]').checked, !!jour(S, D).profAbs[2], croix(S, D, 0, 0, 2)], D);
  ok(!r1[0] && !r1[1] && !r1[2] && r1[3] === 0, `Échap : fenêtre fermée, case décochée, croix gardées ${JSON.stringify(r1)}`);
  // 2. clic dehors ne ferme pas, bouton rouge confirme
  await page.click('input[data-pabs="2"]'); await wait(200);
  await page.mouse.click(30, 700); await wait(100);
  ok((await etat()).open, "un clic à côté de la fenêtre ne la ferme pas");
  await page.click('#boite [data-r="oui"]'); await wait(250);
  const r2 = await page.evaluate(D => [!!jour(S, D).profAbs[2], croix(S, D, 0, 0, 2), croix(S, D, 1, 1, 2)], D);
  ok(r2[0] && r2[1] === -1 && r2[2] === -1, `« Effacer les croix et marquer absent » : appliqué ${JSON.stringify(r2)}`);
  // 3. remplaçant : saisie de texte, Entrée valide
  await page.click('button[data-rempl="0"]'); await wait(200);
  e = await etat();
  const champ = await page.evaluate(() => document.activeElement.name + "=" + document.activeElement.value);
  ok(e.open && champ === "crn=normal", `absent ou remplacé : le choix coché a le focus (${champ})`);
  await page.click("#crn-prof"); await page.keyboard.type("M. MERLU"); await page.keyboard.press("Enter"); await wait(250);
  ok(await page.evaluate(D => creneau(S, semaines(S), D, 0).prof, D) === "M. MERLU", "Entrée valide la saisie : remplaçant enregistré");
  // 4. déplacer les saisies : liste de jours
  await page.click("#m-fiche summary"); await wait(100);
  await page.click('button[data-act="move-day"]'); await wait(250);
  const sel = await page.evaluate(() => { const s = document.querySelector("#boite select"); return s ? [s.value, s.options.length] : null; });
  ok(sel && sel[0] === "2026-10-13" && sel[1] > 20, `déplacer : liste des jours de cours (${sel && sel[1]} choix), le lendemain proposé`);
  await page.screenshot({ path: DIR + "/sorties/boite-liste.png" });
  await page.click('#boite [data-r="non"]'); await wait(150);
  ok(!(await etat()).open && await page.evaluate(() => location.hash) === "#fiche/2026-10-12", "Annuler : rien n’est déplacé");
  // 5. information (Rien à imprimer) et ordre de plusieurs fenêtres
  await page.evaluate(() => { location.hash = "#reglages"; }); await wait(200);
  await page.evaluate(() => { imprimerVue(); informer("Deuxième", "message"); }); await wait(200);
  const t1 = (await etat()).titre; await page.keyboard.press("Enter"); await wait(200);
  const t2 = (await etat()).titre; await page.keyboard.press("Enter"); await wait(200);
  ok(/Rien à imprimer/.test(t1) && /Deuxième/.test(t2) && !(await etat()).open, `deux messages à la suite : l’un après l’autre (« ${t1.trim()} » puis « ${t2.trim()} »)`);
  // 6. sombre
  await page.evaluate(() => { appliquerTheme("sombre"); location.hash = "#fiche/2026-10-12"; }); await wait(250);
  await page.evaluate(() => { const j = jour(S, "2026-10-12", true); j.x["0.0.3"] = 0; commit(); doNew(); }); await wait(250);
  await page.screenshot({ path: DIR + "/sorties/boite-sombre.png" });
  const fond = await page.$eval("#boite", d => getComputedStyle(d).backgroundColor);
  ok(fond !== "rgb(255, 255, 255)", `mode sombre : fond de la fenêtre ${fond}`);
  await page.keyboard.press("Escape"); await wait(150);
  ok(natifs.length === 0, `aucune fenêtre du navigateur pendant tout le test (${natifs.length})`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
