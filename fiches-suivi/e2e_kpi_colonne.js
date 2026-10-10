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
  await page.evaluate(() => doDemo());
  const D = "2026-10-12";
  await page.evaluate(D => { location.hash = "#fiche/" + D; }, D); await wait(300);
  await page.evaluate(D => { delete S.jours[D]; commit(); }, D); await wait(200);
  const kpi = () => page.$eval("#kpis-jour", e => e.querySelector(".val").textContent.replace(/\s+/g, " ").trim());
  const reus = () => page.$eval("#kpis-jour", e => e.querySelectorAll(".val")[1].textContent.trim());
  const k0 = await kpi();
  const ctr = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  await page.mouse.click(...await ctr('td[data-x="0.0.0.0"]')); await wait(100);
  const k1 = await kpi();
  ok(k0.startsWith("0 ") && k1.startsWith("1 "), `clic : bandeau à jour sans recharger (« ${k0} » → « ${k1} »)`);
  // pendant un glisser, avant de relâcher
  await page.mouse.move(...await ctr('td[data-x="1.0.0.2"]')); await page.mouse.down();
  await page.mouse.move(...await ctr('td[data-x="1.3.0.2"]'), { steps: 10 });
  await page.mouse.move(...await ctr('td[data-x="2.0.0.2"]'), { steps: 10 }); await wait(100);
  const kDrag = await kpi(), rDrag = await reus();
  await page.mouse.up(); await wait(100);
  ok(kDrag.startsWith("3 "), `pendant le glisser (bouton encore appuyé) : « ${kDrag} », réussite ${rDrag}`);
  // en-tête : tout M3 en TB
  const nb = await page.$$eval('[data-colx]', b => b.length);
  const sansBouton = await page.evaluate(() => [...Array(7).keys()].filter(p => !document.querySelector(`[data-colx="${p}.0"]`)).map(p => PERIODS[p] + (creneau(S, semaines(S), ficheDate, p).absent ? " (prof absent)" : creneau(S, semaines(S), ficheDate, p).mat ? "" : " (pas de cours)")));
  ok(nb > 0, `${nb} codes cliquables en tête de colonne ; pas de bouton en ${sansBouton.join(", ") || "—"}`);
  const p = await page.evaluate(() => [...Array(7).keys()].find(p => document.querySelector(`[data-colx="${p}.0"]`) && p !== 0));
  // un élève absent sur ce cours
  const absent = await page.evaluate(D => [...Array(nbBlocs(S)).keys()].filter(s => eleveActif(S, s, D))[1], D);
  await page.evaluate((D, p, a) => { jour(S, D, true).abs[a] = [p]; commit(); }, D, p, absent);
  await wait(200);
  await page.evaluate((D, p) => { jour(S, D, true).x[`0.1.${p}`] = 3; commit(); }, D, p); await wait(200);
  const kAvant = await kpi();
  await page.hover(`[data-colx="${p}.0"]`); await wait(100);
  const hl = await page.$$eval("td.col-hl", t => t.length), nbObjT = await page.evaluate(() => nbObj(S));
  await page.screenshot({ path: DIR + "/sorties/col-survol.png" });
  await page.click(`[data-colx="${p}.0"]`); await wait(150);
  const r = await page.evaluate((D, p) => { const res = {}; for (let s = 0; s < nbBlocs(S); s++) res[s] = [...Array(nbObj(S)).keys()].map(o => croix(S, D, s, o, p)); return res; }, D, p);
  const actifs = await page.evaluate(D => [...Array(nbBlocs(S)).keys()].filter(s => eleveActif(S, s, D)), D);
  const attendusOK = actifs.filter(s => s !== absent).every(s => r[s].every(v => v === 0));
  ok(attendusOK && r[absent].every(v => v === -1), `clic sur TB en ${["M1","M2","M3","M4","S1","S2","S3"][p]} : élèves présents tout en TB (croix « I » remplacée), élève absent non touché ${JSON.stringify(r)}`);
  ok(hl === (actifs.filter(s => s !== absent).length) * nbObjT / 4 * 4, `survol du code : ${hl} cases de la colonne repérées`);
  const kApres = await kpi(), toast = await page.$eval("#toast", t => t.textContent);
  ok(kApres !== kAvant, `bandeau à jour après le clic de colonne (« ${kAvant} » → « ${kApres} ») ; message : « ${toast} »`);
  await page.click(`[data-colx="${p}.0"]`); await wait(150);
  const r2 = await page.evaluate((D, p) => [...Array(nbBlocs(S)).keys()].flatMap(s => [...Array(nbObj(S)).keys()].map(o => croix(S, D, s, o, p))), D, p);
  ok(r2.every(v => v === -1), "second clic : colonne effacée");
  await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control"); await wait(200);
  const r3 = await page.evaluate((D, p) => croix(S, D, 0, 0, p), D, p);
  ok(r3 === 0, "Ctrl+Z : la colonne revient en TB");
  // clavier
  await page.focus(`[data-colx="${p}.1"]`); await page.keyboard.press("Enter"); await wait(150);
  ok(await page.evaluate((D, p) => croix(S, D, 0, 2, p), D, p) === 1, "au clavier (Entrée sur le code S) : colonne en S");
  // impression : pas de bouton
  const impr = await page.evaluate(D => ficheHTML(D, false).includes("data-colx"), D);
  ok(!impr, "la fiche imprimée n’a pas de bouton dans les en-têtes");
  // performance du bandeau sur PC lent
  const cdp = await page.target().createCDPSession(); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const t = await page.evaluate(() => { const a = performance.now(); for (let i = 0; i < 10; i++) { const sems = semaines(S), w = semaineDuJour(sems, ficheDate); document.querySelector("#kpis-jour").innerHTML = kpisHTML(kpisJour(ficheDate, sems, sems.indexOf(w))); } return (performance.now() - a) / 10; });
  const tc = await page.evaluate(p => { const a = performance.now(); remplirColonne(p, 2); return performance.now() - a; }, p);
  ok(t < 40 && tc < 300, `PC lent (×6) : bandeau recalculé en ${t.toFixed(1)} ms, colonne remplie en ${tc.toFixed(0)} ms`);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.evaluate(() => appliquerTheme("sombre")); await page.hover(`[data-colx="${p}.2"]`); await wait(100);
  await page.screenshot({ path: DIR + "/sorties/col-sombre.png", clip: { x: 60, y: 120, width: 964, height: 420 } });
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
