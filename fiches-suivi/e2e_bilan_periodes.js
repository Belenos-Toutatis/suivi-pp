const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1024, height: 768 }); await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => doDemo());
  const titre = () => page.$eval(".f-title", e => e.textContent);
  const btn = lib => page.evaluate(lib => { const b = [...document.querySelectorAll(".periodes button")].find(x => x.textContent === lib); if (!b) return false; b.click(); return true; }, lib);
  // aujourd'hui = jeudi 26/11/2026 (semaine 48)
  await page.evaluate(() => { window.aujourdhui = () => "2026-11-26"; location.hash = "#bilan"; }); await wait(300);
  const libs = await page.$$eval(".periodes button[data-act=bil-per]", b => b.map(x => x.textContent));
  ok(JSON.stringify(libs) === JSON.stringify(["Semaine en cours", "Semaine précédente", "2 dernières semaines", "Depuis les dernières vacances", "Tout le suivi"]), "choix proposés le 26/11 (4 dernières semaines = tout le suivi : un seul bouton) : " + libs.join(" | "));
  ok(await page.$eval(".periodes button.on", b => b.textContent) === "Tout le suivi", "par défaut : tout le suivi (bouton actif)");
  await btn("Semaine en cours"); await wait(200);
  ok((await titre()).includes("semaine 48 ("), "semaine en cours → " + (await titre()).slice(0, 60));
  await btn("2 dernières semaines"); await wait(200);
  ok((await titre()).includes("semaines 47 à 48"), "2 dernières semaines → " + (await titre()).slice(0, 70));
  ok(await page.$eval(".periodes button.on", b => b.textContent) === "2 dernières semaines" && await page.$eval("#bil-de", s => s.selectedOptions[0].textContent.startsWith("S47")), "bouton actif et listes « de … à … » cohérents");
  await btn("Depuis les dernières vacances"); await wait(200);
  ok((await titre()).includes("semaines 45 à 48"), "depuis les vacances de la Toussaint (reprise le 02/11) → " + (await titre()).slice(0, 70));
  // après la fin du suivi
  await page.evaluate(() => { window.aujourdhui = () => "2027-01-15"; render(); }); await wait(200);
  const libs2 = await page.$$eval(".periodes button[data-act=bil-per]", b => b.map(x => x.textContent));
  ok(libs2[0] === "Dernière semaine" && libs2.includes("4 dernières semaines") && !libs2.includes("8 dernières semaines"), "après la fin du suivi : « Dernière semaine », « 4 dernières semaines » (8 = tout le suivi : pas de doublon)");
  await btn("Dernière semaine"); await wait(200);
  ok((await titre()).includes("semaine 51 ("), "dernière semaine → S51");
  // impression : même période
  const imp = await page.evaluate(() => pagesVueCourante().pages[0].includes("semaine 51 ("));
  ok(imp, "l’impression reprend la période choisie");
  await page.screenshot({ path: DIR + "/sorties/bilan-periodes.png", clip: { x: 0, y: 0, width: 1024, height: 330 } });
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
