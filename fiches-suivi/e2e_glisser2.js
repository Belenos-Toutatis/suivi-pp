const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 1300 });
  const dialogs = []; await require("./boites")(page, { messages: dialogs });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  await page.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await wait(300);
  await page.evaluate(() => { delete S.jours["2026-10-12"]; commit(); });
  const ctr = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const chemin = async pts => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 8 }); await page.mouse.up(); await wait(150); };
  const x = (s, o, p) => page.evaluate((s, o, p) => croix(S, "2026-10-12", s, o, p), s, o, p);
  // 1. descente en déviant : TB sur les objectifs 1-2, puis S, puis À (même cours M1)
  await chemin([await ctr('td[data-x="0.0.0.0"]'), await ctr('td[data-x="0.1.0.0"]'), await ctr('td[data-x="0.2.0.1"]'), await ctr('td[data-x="0.3.0.2"]')]);
  const r1 = [await x(0, 0, 0), await x(0, 1, 0), await x(0, 2, 0), await x(0, 3, 0)];
  ok(JSON.stringify(r1) === "[0,0,1,2]", `descente en déviant dans le même cours : codes ${JSON.stringify(r1)} (attendu TB, TB, S, À)`);
  // 2. sur une même ligne, aller-retour dans le cours : la dernière case survolée l'emporte
  await chemin([await ctr('td[data-x="1.0.0.0"]'), await ctr('td[data-x="1.0.0.3"]'), await ctr('td[data-x="1.0.0.1"]')]);
  ok((await x(1, 0, 0)) === 1, "dans un même cours, la dernière case survolée l’emporte (S)");
  // 3. glisser horizontal vers d'autres cours : code de départ partout, y compris dans le premier cours
  await chemin([await ctr('td[data-x="2.1.0.1"]'), await ctr('td[data-x="2.1.3.3"]')]);
  const r3 = [0, 1, 2, 3].map(async p => x(2, 1, p)); const v3 = await Promise.all(r3);
  ok(v3[0] === 3 && v3.slice(1).every(v => v === -1), `glisser horizontal M1→M4 : seul M1 est coché (dernière case survolée, I), les autres créneaux restent vides (${JSON.stringify(v3)})`);
  // 4. clic droit : absent sur ce cours, puis présent
  dialogs.length = 0;
  await page.click('td[data-x="3.0.1.0"]', { button: "right" }); await wait(200);
  ok(await page.evaluate(() => absCreneaux(S, "2026-10-12", 3).includes(1)), "clic droit : l’élève est absent en M2");
  ok((await page.$$eval('tbody', tb => tb[3].querySelectorAll('td.c.abs[data-abs="3.1"]').length)) === 4 * 4, "les 16 cases du cours sont hachurées");
  await page.click('td[data-abs="3.1"]', { button: "right" }); await wait(200);
  ok(await page.evaluate(() => !absCreneaux(S, "2026-10-12", 3).includes(1)), "second clic droit (sur la case hachurée) : de nouveau présent");
  // 5. clic droit avec des croix déjà saisies : confirmation
  dialogs.length = 0;
  await page.click('td[data-x="0.0.0.0"]', { button: "right" }); await wait(200);
  ok(dialogs.some(m => m.includes("croix")) && await page.evaluate(() => absCreneaux(S, "2026-10-12", 0).includes(0) && croix(S, "2026-10-12", 0, 0, 0) === -1), "clic droit sur un cours déjà saisi : confirmation, croix effacées");
  // 6. pas de menu contextuel du navigateur sur la grille
  ok(await page.evaluate(() => { const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); document.querySelector('td[data-x]').dispatchEvent(ev); return ev.defaultPrevented; }), "le menu contextuel du navigateur ne s’ouvre pas sur la grille");
  // 7. glisser au bouton droit sur plusieurs élèves (même cours M3) : tous absents, une seule confirmation
  await page.evaluate(() => { const j = S.jours["2026-10-12"]; if (j) j.abs = {}; jour(S, "2026-10-12", true).x["1.0.2"] = 0; commit(); });
  dialogs.length = 0;
  const [ax, ay] = await ctr('td[data-x="0.1.2.1"]'), [bx, by] = await ctr('td[data-x="3.2.2.1"]');
  await page.mouse.move(ax, ay); await page.mouse.down({ button: "right" });
  await page.mouse.move(bx, by, { steps: 25 });
  const pendant = await page.$$eval("td.pre-abs", t => t.length);
  await page.mouse.up({ button: "right" }); await wait(250);
  const abs = await page.evaluate(() => [0, 1, 2, 3].map(s => absCreneaux(S, "2026-10-12", s).includes(2)));
  ok(pendant > 0 && abs.every(Boolean), `glisser au bouton droit de l’élève 1 à l’élève 4 en M3 : tous absents (${JSON.stringify(abs)}), cours surlignés pendant le geste (${pendant} cases)`);
  ok(dialogs.length === 1 && dialogs[0].includes("croix"), "une seule confirmation (une croix existait en M3 pour l’élève 2)");
  // 8. dans l'autre sens, depuis une case hachurée : tous présents
  const [cx, cy] = await ctr('td[data-abs="0.2"]'), [dx, dy] = await ctr('td[data-abs="3.2"]');
  await page.mouse.move(cx, cy); await page.mouse.down({ button: "right" }); await page.mouse.move(dx, dy, { steps: 25 }); await page.mouse.up({ button: "right" }); await wait(250);
  ok(await page.evaluate(() => [0, 1, 2, 3].every(s => !absCreneaux(S, "2026-10-12", s).includes(2))), "glisser au bouton droit depuis une case hachurée : tous de nouveau présents");
  // 9. annuler d'un coup
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control"); await wait(200);
  ok(await page.evaluate(() => [0, 1, 2, 3].every(s => absCreneaux(S, "2026-10-12", s).includes(2))), "Ctrl+Z annule tout le glisser d’un coup");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
