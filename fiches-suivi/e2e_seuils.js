const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1366, height: 1000 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo());
  ok(JSON.stringify(await p.evaluate(() => seuils(S))) === '{"rouge":60,"orange":80,"vert":90,"vertFonce":95}', "seuils par défaut : rouge < 60, orange < 80, vert ≥ 90, vert foncé ≥ 95");
  const u = await p.evaluate(() => [[.96, 0], [.95, 0], [.94, 0], [.90, 0], [.89, 0], [.80, 0], [.99, 1], [.79, 0], [.60, 0], [.59, 0], [.24, 2]].map(([v, i]) => niveauReussite(S, v, i) || "·"));
  ok(u.join(" ") === "vf vf v v · · · o o r r", `règle : 96/95→vert foncé, 94/90→vert clair, 89/80→rien, 99 % avec 1 I→rien, 79/60→orange, 59/24→rouge (${u.join(" ")})`);
  const inco = await p.evaluate(() => JSON.stringify(seuils({ seuils: { rouge: 85, orange: 70, vert: 50, vertFonce: 40 } })));
  ok(inco === '{"rouge":85,"orange":85,"vert":85,"vertFonce":85}', `seuils incohérents remis dans l’ordre (${inco})`);
  // totaux
  await p.evaluate(() => { location.hash = "#totaux/5"; }); await wait(400);
  if (!(await p.$eval("#tot-verts", c => c.checked))) { await p.click("#tot-verts"); await wait(300); }
  const t = await p.evaluate(() => [...document.querySelectorAll("table.tot td.pc")].map(td => ({ v: parseInt(td.textContent), bon: td.classList.contains("bon"), fonce: td.classList.contains("fonce"), i: td.classList.contains("aI") ? Number((td.title.match(/(\d+) croix « I »/) || [0, 0])[1]) : 0 })));
  const bons = t.filter(x => x.bon), avecI = t.filter(x => x.i);
  ok(bons.length > 0 && bons.every(x => x.v >= 90 && !x.i) && bons.filter(x => x.fonce).every(x => x.v >= 95) && bons.filter(x => !x.fonce).every(x => x.v < 95),
    `totaux : ${bons.length} pastilles vertes, toutes ≥ 90 % et sans I (foncées ≥ 95 %)`);
  ok(avecI.length > 0 && avecI.every(x => !x.bon) && t.filter(x => x.v >= 90 && x.i).length > 0, `totaux : ${avecI.length} cases avec repère I, jamais en vert (dont ${t.filter(x => x.v >= 90 && x.i).length} à 90 % ou plus)`);
  const coherent = await p.evaluate(() => { const T = statsSemaine(S, semaines(S), 5); const td = document.querySelector("table.tot tbody tr td.pc"); const n = T.el[0].obj[0].jours[0][3]; return (td.classList.contains("aI") ? Number((td.title.match(/(\d+) croix « I »/) || [0, 0])[1]) : 0) === n; });
  ok(coherent, "le repère I d’une case correspond au nombre de croix I du jour");
  await (await p.$(".sheet")).screenshot({ path: DIR + "/sorties/seuils-totaux.png" });
  // impression
  await p.evaluate(() => { document.querySelector("#print-area").innerHTML = `<div class="page sheet">${totauxHTML(5)}</div>`; }); await p.emulateMediaType("print");
  await p.pdf({ path: DIR + "/sorties/seuils-totaux.pdf", preferCSSPageSize: true }); await p.emulateMediaType("screen");
  ok(require("child_process").execSync(`pdfinfo "${DIR}/sorties/seuils-totaux.pdf"`).toString().includes("Pages:           1"), "totaux imprimés sur une page");
  // bilan
  await p.evaluate(() => { location.hash = "#bilan"; }); await wait(400);
  ok(await p.$("#tot-verts") !== null, "bilan : case « Pastilles vertes aussi » présente (même réglage)");
  const bl = await p.evaluate(() => [...document.querySelectorAll("table.bil td.pcb")].map(td => ({ r: parseInt(td.textContent.replace("▼", "")), bon: td.classList.contains("bon"), fonce: td.classList.contains("fonce"), i: td.classList.contains("aI") })));
  ok(bl.filter(x => x.bon).every(x => x.r >= 90 && !x.i) && bl.some(x => x.i) && !bl.some(x => x.bon && x.i), `bilan : ${bl.filter(x => x.bon).length} cases vertes (réussite ≥ 90 %, sans I), ${bl.filter(x => x.i).length} avec repère I`);
  const blc = await p.evaluate(() => [...document.querySelectorAll("table.bil td.pcb")].map(td => [parseInt(td.textContent.replace("▼", "")), td.classList.contains("warn"), td.classList.contains("alert")]));
  ok(blc.every(([n, w, a]) => (a === (n < 60)) && (w === (n >= 60 && n < 80))), "bilan : même indicateur que les totaux, la réussite — orange sous 80 %, rouge sous 60 %");
  await (await p.$(".sheet")).screenshot({ path: DIR + "/sorties/seuils-bilan.png" });
  // fiche du jour
  await p.evaluate(() => { location.hash = "#fiche/2026-12-01"; }); await wait(400);
  const k = await p.evaluate(() => { const v = document.querySelectorAll("#kpis-jour .val")[1]; return { txt: v.textContent.trim(), niv: v.querySelector(".niv").className, i: !!v.querySelector(".kpi-i") }; });
  ok(k.txt.length > 0, `fiche du jour : carte réussite « ${k.txt} » (${k.niv})${k.i ? ", repère I affiché" : ""}`);
  await p.screenshot({ path: DIR + "/sorties/seuils-fiche.png", clip: { x: 240, y: 120, width: 1120, height: 120 } });
  // réglages : changer le seuil, et aller-retour ODS
  await p.evaluate(() => { location.hash = "#reglages/pastilles"; }); await wait(400);
  await p.$eval('input[data-num="seuils.vert"]', i => { i.value = "80"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => seuils(S).vert) === 80, "Réglages : seuil vert clair changé à 80 %");
  await p.$eval('input[data-num="seuils.vertFonce"]', i => { i.scrollIntoView({ block: "center" }); });
  await p.screenshot({ path: DIR + "/sorties/seuils-reglages.png" });
  const rt = await p.evaluate(() => normalizeState(JSON.parse(JSON.stringify(S))).seuils);
  ok(rt && rt.vert === 80 && rt.vertFonce === 95, `seuils gardés dans le fichier de données (${JSON.stringify(rt)})`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
