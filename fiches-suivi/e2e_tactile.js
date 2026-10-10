const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.setViewport({ width: 1024, height: 700, hasTouch: true });
  await page.goto(APP); await page.evaluate(() => doDemo()); await page.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await wait(300);
  await page.evaluate(() => { delete S.jours["2026-10-12"]; commit(); document.querySelector("details.aide").open = false; });
  await wait(100);
  const ctr = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const nb = () => page.evaluate(() => Object.keys((S.jours["2026-10-12"] || { x: {} }).x).length);
  // 1. appui simple
  let [x, y] = await ctr('td[data-x="0.0.0.0"]');
  await page.touchscreen.tap(x, y); await wait(200);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 0) === 0), "appui simple au doigt : croix");
  // 2. balayage vertical depuis une case : la page défile, aucune croix
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(100);
  [x, y] = await ctr('td[data-x="2.0.1.1"]');
  const n0 = await nb();
  await page.touchscreen.touchStart(x, y);
  for (let k = 1; k <= 10; k++) { await page.touchscreen.touchMove(x, y - k * 25); await wait(16); }
  await page.touchscreen.touchEnd(); await wait(400);
  const sy = await page.evaluate(() => window.scrollY);
  ok(sy > 50 && (await nb()) === n0, `balayage vertical : la page défile (${Math.round(sy)} px), aucune croix ajoutée`);
  // 3. appui long puis glisser vertical : coche, sans défiler
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(150);
  [x, y] = await ctr('td[data-x="0.0.2.0"]'); const [, y2] = await ctr('td[data-x="0.3.2.0"]');
  await page.touchscreen.touchStart(x, y); await wait(450);
  for (let k = 1; k <= 10; k++) { await page.touchscreen.touchMove(x, y + (y2 - y) * k / 10); await wait(16); }
  await page.touchscreen.touchEnd(); await wait(300);
  const c3 = await page.evaluate(() => [0, 1, 2, 3].filter(o => croix(S, "2026-10-12", 0, o, 2) === 0).length);
  ok(c3 === 4 && (await page.evaluate(() => window.scrollY)) < 5, `appui long puis glisser vers le bas : ${c3} croix sur 4, pas de défilement`);
  // 4. glisser horizontal : coche dans la même colonne de code
  [x, y] = await ctr('td[data-x="1.0.0.1"]'); const [x2] = await ctr('td[data-x="1.0.3.1"]');
  await page.touchscreen.touchStart(x, y);
  for (let k = 1; k <= 12; k++) { await page.touchscreen.touchMove(x + (x2 - x) * k / 12, y); await wait(16); }
  await page.touchscreen.touchEnd(); await wait(300);
  const c4 = await page.evaluate(() => [0, 1, 2, 3].map(p => croix(S, "2026-10-12", 1, 0, p)));
  ok(c4[0] >= 0 && c4.slice(1).every(v => v === -1), `glisser horizontal au doigt : coche dans le créneau de départ seulement (${JSON.stringify(c4)})`);
  // 5. souris : appui puis relâchement hors de la case = annulé
  await page.setViewport({ width: 1024, height: 1200, hasTouch: false });
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(100);
  [x, y] = await ctr('td[data-x="3.1.4.2"]');
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 400, { steps: 1 }); await page.mouse.up(); await wait(150);
  // le glisser hors de la grille a quitté la case : selon la règle « glisser », la case de départ est cochée ; un clic relâché ailleurs sans quitter vers une autre case…
  await page.evaluate(() => { delete S.jours["2026-10-12"].x["3.1.4"]; commit(); });
  [x, y] = await ctr('td[data-x="3.1.4.2"]');
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 3, y + 3); await page.mouse.up(); await wait(100);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 3, 1, 4) === 2), "clic à la souris (léger bougé dans la case) : croix au relâchement");
  // 6. appui puis sortie vers la colonne des objectifs (sans traverser d'autre case) : rien n'est coché
  await page.evaluate(() => { delete S.jours["2026-10-12"].x["2.2.0"]; commit(); });
  [x, y] = await ctr('td[data-x="2.2.0.0"]'); const [xo] = await ctr("tbody td.obj");
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(xo, y, { steps: 6 }); await page.mouse.up(); await wait(100);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 2, 2, 0) === -1), "appui puis relâchement hors de la grille : annulé, aucune croix");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
