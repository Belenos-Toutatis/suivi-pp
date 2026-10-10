const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => doDemo());
  const etat = () => page.evaluate(() => { const s = document.querySelector("#side"), r = s.getBoundingClientRect(), p = document.querySelector(".side-pied").getBoundingClientRect();
    return { zoom: document.documentElement.style.zoom || "1", haut: Math.round(r.top), bas: Math.round(r.bottom), fen: innerHeight, defile: s.classList.contains("deborde"), piedVisible: p.bottom <= innerHeight + 1 }; });
  for (const [w, h] of [[1024, 768], [1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewport({ width: w, height: h }); await page.evaluate(() => { location.hash = "#fiche/2026-11-19"; appliquerZoom(); }); await wait(300);
    let e = await etat();
    ok(e.zoom === "1" && e.haut === 0 && e.bas === h && !e.defile && e.piedVisible, `${w}×${h} : 100 %, menu à la hauteur exacte de la fenêtre (${e.haut}→${e.bas}), sans défilement, bas du menu visible`);
    await page.evaluate(() => window.scrollTo(0, 600)); await wait(150);
    e = await etat();
    ok(e.haut === 0 && e.bas === h, `${w}×${h} : la page défile, le menu reste en place (${e.haut}→${e.bas})`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // agrandissement manuel A+ : le menu tient toujours dans la fenêtre
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluate(() => { changerZoom(2); }); await wait(200);
  let e = await etat();
  ok(e.zoom === "1.2" && e.bas === 1080 && e.piedVisible, `A+ A+ (120 %) : menu toujours à la hauteur de la fenêtre, bas visible (${JSON.stringify(e)})`);
  await page.evaluate(() => { changerZoom(-2); });
  // fenêtre très basse : le menu défile seulement alors
  await page.setViewport({ width: 1366, height: 380 }); await page.evaluate(() => appliquerZoom()); await wait(200);
  e = await etat();
  ok(e.defile, "fenêtre très basse (380 px) : le menu peut défiler, puisqu’il ne tient pas en entier");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
