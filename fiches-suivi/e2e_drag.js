const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: DIR + "/sorties/chrome-profile5", args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 1000 });
  await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  await page.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => { delete S.jours["2026-10-12"]; render(); });
  const center = async sel => { const b = await (await page.$(sel)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const drag = async (a, b, steps = 25) => { const [x0, y0] = await center(a), [x1, y1] = await center(b);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps }); await page.mouse.up(); await new Promise(r => setTimeout(r, 100)); };
  const x = () => page.evaluate(() => ({ ...(S.jours["2026-10-12"] || { x: {} }).x }));

  // clic simple
  await page.click('td[data-x="0.0.0.1"]');
  ok((await x())["0.0.0"] === 1, "clic simple : croix posée");
  await page.click('td[data-x="0.0.0.1"]');
  ok((await x())["0.0.0"] === undefined, "second clic : croix enlevée");
  // glisser vertical : élève 0, objectifs 0→3, créneau M1, code TB
  await drag('td[data-x="0.0.0.0"]', 'td[data-x="0.3.0.0"]');
  let v = await x();
  ok([0, 1, 2, 3].every(o => v[`0.${o}.0`] === 0) && Object.keys(v).length === 4, "glisser vertical : 4 objectifs cochés TB en M1");
  // glisser horizontal sur plusieurs créneaux : objectif 1 élève 1, de M1 (code S) à M4 → code S partout
  await drag('td[data-x="1.1.0.1"]', 'td[data-x="1.1.3.3"]', 60);
  v = await x();
  ok(v["1.1.0"] === 3 && [1, 2, 3].every(p => v[`1.1.${p}`] === undefined), "glisser horizontal vers M4 : reste dans M1 (dernière case survolée, I), les autres créneaux intacts");
  // glisser à travers deux élèves
  await drag('td[data-x="0.2.1.2"]', 'td[data-x="1.1.1.2"]');
  v = await x();
  ok(v["0.2.1"] === 2 && v["0.3.1"] === 2 && v["1.0.1"] === 2 && v["1.1.1"] === 2, "glisser d'un élève à l'autre");
  // effacer en glissant depuis une case cochée
  await drag('td[data-x="0.0.0.0"]', 'td[data-x="0.3.0.0"]');
  v = await x();
  ok([0, 1, 2, 3].every(o => v[`0.${o}.0`] === undefined), "glisser depuis une case cochée : efface");
  // affichage cohérent et persistance après glisser
  const coh = await page.evaluate(() => { const x = S.jours["2026-10-12"].x;
    const dom = [...document.querySelectorAll("td.c[data-x]")].filter(td => td.textContent !== "").map(td => td.dataset.x).sort();
    const st = Object.entries(x).map(([k, l]) => k + "." + l).sort();
    const saved = Object.keys(localStorage).some(k => { try { return JSON.stringify(JSON.parse(localStorage.getItem(k)).S.jours["2026-10-12"].x) === JSON.stringify(x); } catch { return false; } });
    return [JSON.stringify(dom) === JSON.stringify(st), saved, dom.length]; });
  ok(coh[0] && coh[1], `affichage identique aux données (${coh[2]} croix) et sauvegarde locale à jour`);
  // pas de sélection de texte
  ok((await page.evaluate(() => String(getSelection()))) === "", "aucune sélection de texte parasite");
  // case hachurée (absence) ignorée
  await page.evaluate(() => { jour(S, "2026-10-12", true).abs[2] = [0]; render(); });
  await drag('td[data-x="1.3.0.0"]', 'td[data-x="3.0.0.0"]');
  v = await x();
  ok(v["2.0.0"] === undefined && v["3.0.0"] === 0 && v["1.3.0"] === 0, "les créneaux d'absence sont sautés pendant le glisser");
  await page.screenshot({ path: DIR + "/sorties/shot-drag.png", clip: { x: 0, y: 150, width: 1500, height: 600 } });
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close();
})();
