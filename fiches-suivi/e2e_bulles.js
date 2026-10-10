// Infobules mises en forme : survol, contenu structuré (titre, liste, gras), position dans l'écran, clavier, pas de doublon natif.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1024, height: 768 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); location.hash = "#totaux/5"; }); await wait(400);
  const bulle = () => p.evaluate(() => { const bl = document.querySelector("#bulle"), r = bl.getBoundingClientRect();
    return { on: bl.classList.contains("on"), t: (bl.querySelector(".t") || {}).textContent, li: bl.querySelectorAll("li").length, b: bl.querySelectorAll("b").length, dans: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, html: bl.innerHTML.slice(0, 300) }; });
  await p.hover("table.tot tbody tr td.pc"); await wait(600);
  let r = await bulle(); const natif = await p.evaluate(() => document.querySelector("table.tot tbody tr td.pc").hasAttribute("title"));
  ok(r.on && r.t && r.li >= 2 && r.b >= 1 && r.dans && !natif, `case des totaux : titre « ${r.t} », ${r.li} puces, gras, dans l’écran, plus d’infobule du navigateur en double`);
  console.log("   " + r.html);
  await p.screenshot({ path: DIR + "/sorties/bulle-case.png", clip: { x: 0, y: 150, width: 1024, height: 400 } });
  await p.hover("table.tot thead th:last-child"); await wait(600); r = await bulle();
  await p.hover("table.tot thead tr:nth-child(2) th:last-child"); await wait(600); r = await bulle();
  ok(r.on && r.li === 5 && r.dans, `en-tête « Évol. » : liste des 5 flèches, dans l’écran (bord droit)`);
  await p.screenshot({ path: DIR + "/sorties/bulle-evol.png" });
  await p.mouse.move(5, 760); await wait(300); ok(!(await bulle()).on, "la souris s’éloigne : l’infobule disparaît");
  // bilan
  await p.evaluate(() => { location.hash = "#bilan"; }); await wait(400);
  await p.hover("table.bil tbody tr td.pcb"); await wait(600); r = await bulle();
  ok(r.on && /—/.test(r.t) && r.li >= 2, `bilan : « ${r.t} », ${r.li} puces`);
  await p.screenshot({ path: DIR + "/sorties/bulle-bilan.png", clip: { x: 0, y: 150, width: 1024, height: 420 } });
  // clavier : Tab depuis la liste des semaines vers « Semaine suivante »
  await p.evaluate(() => { location.hash = "#totaux/3"; }); await wait(400);
  await p.evaluate(() => document.querySelector("#pick-week").focus()); await p.keyboard.press("Tab"); await wait(900);
  const fk = await p.evaluate(() => [document.activeElement.id, document.querySelector("#bulle").classList.contains("on")]);
  ok(fk[1], `au clavier, l’infobule apparaît sur l’élément atteint par Tab (${fk[0]})`);
  await p.keyboard.press("Escape"); await wait(100); ok(!(await bulle()).on, "Échap ferme l’infobule");
  // pendant un cliquer-glisser : pas d'infobule
  await p.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await wait(400);
  const c = await p.evaluate(() => { const r = document.querySelector('td[data-x="0.0.0.0"]').getBoundingClientRect(); return [r.x + 5, r.y + 5]; });
  await p.mouse.move(...c); await p.mouse.down(); await p.mouse.move(c[0], c[1] + 60, { steps: 5 }); await wait(700);
  const pendant = (await bulle()).on; await p.mouse.up();
  ok(!pendant, "pas d’infobule pendant un cliquer-glisser");
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
