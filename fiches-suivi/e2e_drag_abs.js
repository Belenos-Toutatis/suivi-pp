const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: DIR + "/sorties/chrome-profile6", args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 1000 });
  let accept = true, dialogs = 0; await require("./boites")(page, { compter: () => dialogs++, decide: () => accept });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  const D = "2026-10-13";
  await page.evaluate(D => { location.hash = "#fiche/" + D; }, D); await new Promise(r => setTimeout(r, 200));
  const center = async sel => { const b = await (await page.$(sel)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const drag = async (a, b, steps = 25) => { const [x0, y0] = await center(a), [x1, y1] = await center(b);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps }); await page.mouse.up(); await new Promise(r => setTimeout(r, 150)); };
  const abs = s => page.evaluate((D, s) => absCreneaux(S, D, s), D, s);
  const nbX = (s, ps) => page.evaluate((D, s, ps) => Object.keys(S.jours[D].x).filter(k => { const [a, , p] = k.split(".").map(Number); return a === s && ps.includes(p); }).length, D, s, ps);

  // élèves 0 et 1 en mode « certains créneaux »
  await page.select('select[data-eabs="0"]', "creneaux");
  await page.select('select[data-eabs="1"]', "creneaux");
  ok(await nbX(0, [1, 2, 3]) > 0, "des croix existent avant (M2-M4 élève 1)");
  // glisser M2 → M4 pour l'élève 0
  dialogs = 0;
  await drag('button[data-absp="0.1"]', 'button[data-absp="0.3"]');
  ok(JSON.stringify(await abs(0)) === "[1,2,3]" && dialogs === 1 && await nbX(0, [1, 2, 3]) === 0,
     `glisser M2→M4 : créneaux ${JSON.stringify(await abs(0))}, une seule confirmation (${dialogs}), croix effacées`);
  ok((await page.$$eval("tbody", tb => tb[0].querySelectorAll("td.c.abs").length)) >= 3 * 16, "cases hachurées après le glisser");
  // refus de confirmation : rien ne change
  accept = false;
  await drag('button[data-absp="1.4"]', 'button[data-absp="1.6"]');
  ok(JSON.stringify(await abs(1)) === "[]" && (await page.$$eval('button[data-absp^="1."].on', b => b.length)) === 0, "refus de la confirmation : aucune absence, boutons revenus");
  accept = true;
  // glisser d'un élève à l'autre (vertical) sur S1
  await drag('button[data-absp="0.4"]', 'button[data-absp="1.4"]', 40);
  ok((await abs(0)).includes(4) && (await abs(1)).includes(4), "glisser vertical : S1 pour les deux élèves");
  // éteindre en glissant depuis un bouton allumé
  await drag('button[data-absp="0.1"]', 'button[data-absp="0.2"]');
  ok(JSON.stringify(await abs(0)) === "[3,4]", `glisser depuis un créneau allumé : éteint (reste ${JSON.stringify(await abs(0))})`);
  // les boutons restent affichés même si la liste correspond à un préréglage
  ok(await page.$('button[data-absp="0.0"]') !== null, "boutons M1…S3 toujours affichés");

  // enseignants : glisser sur la ligne « Enseignant absent ? »
  const ths = await page.$$eval("[data-pabsth]", t => t.map(x => Number(x.dataset.pabsth)));
  const [pa, pb] = [ths[0], ths[2]];
  dialogs = 0;
  await drag(`[data-pabsth="${pa}"]`, `[data-pabsth="${pb}"]`, 40);
  const pr = await page.evaluate((D, ths) => ths.filter(p => profAbsent(S, D, p)), D, ths);
  ok(pr.length === 3 && pr[0] === pa && pr[2] === pb && dialogs <= 1, `enseignants absents ${pr.map(p => "M" + (p + 1)).join(", ")} en un geste (${dialogs} confirmation)`);
  ok(await page.evaluate((D, pr) => Object.keys(S.jours[D].x).every(k => !pr.includes(Number(k.split(".")[2]))), D, pr), "croix de ces créneaux effacées");
  await drag(`[data-pabsth="${pa}"]`, `[data-pabsth="${ths[1]}"]`, 30);
  ok(await page.evaluate((D, ths) => ths.filter(p => profAbsent(S, D, p)).length, D, ths) === 1, "glisser depuis une case cochée : décoche");
  // clic simple sur la case à cocher elle-même
  await page.click(`input[data-pabs="${ths[3]}"]`);
  ok(await page.evaluate((D, p) => profAbsent(S, D, p), D, ths[3]), "clic simple sur la case : coche (pas de double bascule)");
  await page.click(`input[data-pabs="${ths[3]}"]`);
  ok(!(await page.evaluate((D, p) => profAbsent(S, D, p), D, ths[3])), "second clic : décoche");
  // clavier
  await page.focus(`input[data-pabs="${ths[3]}"]`); await page.keyboard.press("Space"); await new Promise(r => setTimeout(r, 100));
  ok(await page.evaluate((D, p) => profAbsent(S, D, p), D, ths[3]), "au clavier (espace) : coche");
  await page.screenshot({ path: DIR + "/sorties/shot-drag-abs.png", clip: { x: 0, y: 150, width: 1500, height: 650 } });
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close();
})();
