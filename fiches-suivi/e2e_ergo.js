const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: DIR + "/sorties/chrome-ergo", args: ["--no-sandbox"] });
  const page = await browser.newPage(); await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.setViewport({ width: 2560, height: 1440 });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  ok((await page.evaluate(() => document.documentElement.style.zoom)) === "", "écran 2560 : pas d’agrandissement automatique (100 %)");
  // glisser sous zoom
  await page.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await wait(200);
  await page.evaluate(() => { delete S.jours["2026-10-12"]; render(); });
  const box = async sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const [x0, y0] = await box('td[data-x="0.0.0.0"]'), [x1, y1] = await box('td[data-x="1.3.0.0"]');
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 30 }); await page.mouse.up(); await wait(150);
  const n = await page.evaluate(() => Object.values(S.jours["2026-10-12"].x).filter(v => v === 0).length);
  ok(n === 8, `cliquer-glisser avec le zoom : ${n} croix (attendu 8)`);
  // zoom manuel
  await page.click("#m-file summary"); await page.click("#z-plus"); 
  ok((await page.evaluate(() => document.documentElement.style.zoom)) === "1.1", "A+ : 110 %");
  await page.click("#z-moins");
  // clavier : flèches
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press("ArrowRight"); await wait(150);
  ok((await page.evaluate(() => location.hash)) === "#fiche/2026-10-13", "flèche → : jour suivant");
  await page.keyboard.press("ArrowLeft"); await wait(150);
  ok((await page.evaluate(() => location.hash)) === "#fiche/2026-10-12", "flèche ← : jour précédent");
  // flèche dans un champ : pas de navigation
  await page.focus('textarea[data-com="0"]'); await page.keyboard.press("ArrowRight"); await wait(100);
  ok((await page.evaluate(() => location.hash)) === "#fiche/2026-10-12", "flèche dans un commentaire : on reste sur la fiche");
  // impression du navigateur (Ctrl+P / menu) : la zone d'impression est remplie
  const pa = await page.evaluate(() => { window.dispatchEvent(new Event("beforeprint")); const h = document.querySelector("#print-area").innerHTML; window.dispatchEvent(new Event("afterprint")); return h; });
  ok(pa.includes("Journée du lundi 12 octobre 2026"), "impression par le navigateur : la fiche affichée est imprimée (plus de page blanche)");
  // en-tête collant
  await page.setViewport({ width: 1024, height: 520 });
  await page.evaluate(() => { location.hash = "#fiche/2026-10-13"; }); await wait(200);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await wait(150);
  const st = await page.evaluate(() => { const th = document.querySelector("table.fiche thead th.per"), bar = { offsetHeight: 0 };   // plus de barre du haut : l’en-tête colle en haut de la fenêtre
    return [Math.round(th.getBoundingClientRect().top), bar.offsetHeight, document.documentElement.style.zoom]; });
  ok(st[0] >= st[1] - 2 && st[0] <= st[1] + 4 && st[2] === "", `1024 : en-tête de la fiche collé sous la barre en défilant (haut ${st[0]} px, barre ${st[1]} px)`);
  const fit = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, [...document.querySelectorAll("table.fiche tbody tr:nth-child(2) td.c")].pop().getBoundingClientRect().right]);
  ok(fit[0] <= fit[1] && fit[2] <= fit[1], `1024 : la fiche tient en largeur, dernière colonne (S3, I) visible (${Math.round(fit[2])} ≤ ${fit[1]})`);
  await page.screenshot({ path: DIR + "/sorties/1024-sticky.png" });
  // menu Fichier
  await page.evaluate(() => { document.querySelector("#m-file").open = false; });
  await page.click("#m-file summary"); ok(await page.evaluate(() => document.querySelector("#m-file").open), "menu Fichier s'ouvre");
  await page.keyboard.press("Escape"); ok(!(await page.evaluate(() => document.querySelector("#m-file").open)), "Échap le referme");
  // statut
  ok((await page.$eval("#status", e => e.textContent)) === "Pas encore enregistré", "statut clair quand rien n'est enregistré");
  // sommaire : semaine en cours (on simule le 13/10)
  await page.evaluate(() => { window.aujourdhui = () => "2026-10-13"; location.hash = "#sommaire"; }); await wait(200);
  ok(await page.evaluate(() => !!document.querySelector(".sf-sem.now.on") && !!document.querySelector(".somm-jour.today")), "sommaire : semaine en cours choisie, jour encadré");
  // réglages : rubriques
  await page.evaluate(() => { location.hash = "#reglages"; }); await page.mouse.move(700, 500); await wait(700);   // souris hors du menu (il s’ouvre au survol, par-dessus la page)
  await page.click('.rub a[href="#reglages/calendrier"]'); await wait(400);
  const r = await page.evaluate(() => [location.hash, !!document.querySelector(".annee"), document.querySelector(".rub a.on b").textContent]);
  ok(r[0] === "#reglages/calendrier" && r[1] && r[2] === "Période et calendrier", `réglages : la rubrique « Période et calendrier » s’ouvre avec son calendrier`);
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close();
})();
