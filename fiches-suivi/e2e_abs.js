const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const DIR = __dirname;
const APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: DIR + "/sorties/chrome-profile4", args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 1000 });
  await require("./boites")(page);
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo());
  const nav = h => page.evaluate(h => { location.hash = h; }, h).then(() => new Promise(r => setTimeout(r, 150)));

  // 1. enseignant absent (démo : maths le 19/11)
  await nav("#fiche/2026-11-19");
  const absCells = await page.$$eval("td.c.abs", t => t.length);
  ok(absCells > 0, `créneaux de l'enseignant absent hachurés (${absCells} cases)`);
  await page.screenshot({ path: DIR + "/sorties/shot-abs-prof.png", fullPage: true });
  // décocher puis recocher une absence enseignant
  const p0 = await page.$eval("input[data-pabs]:checked", i => i.dataset.pabs);
  await page.click(`input[data-pabs="${p0}"]`);
  ok(await page.evaluate(p => !profAbsent(S, "2026-11-19", Number(p)), p0), "décocher l'absence de l'enseignant");
  await page.click(`td[data-x="0.0.${p0}.1"]`);
  await page.click(`input[data-pabs="${p0}"]`);
  ok(await page.evaluate(p => profAbsent(S, "2026-11-19", Number(p)) && croix(S, "2026-11-19", 0, 0, Number(p)) === -1, p0),
     "recocher : absence enregistrée et croix du créneau effacée");

  // 2. élève absent l'après-midi
  await nav("#fiche/2026-10-13");
  const before = await page.evaluate(() => { const sems = semaines(S); return statsSemaine(S, sems, 0).el[0].attendus; });
  await page.select('select[data-eabs="0"]', "aprem");
  const after = await page.evaluate(() => { const sems = semaines(S); const e = statsSemaine(S, sems, 0).el[0]; return [e.attendus, e.absences, Object.keys(S.jours["2026-10-13"].x).filter(k => k.startsWith("0.") && Number(k.split(".")[2]) >= 4).length]; });
  ok(after[0] < before && after[1] > 0 && after[2] === 0, `élève absent l'après-midi : attendus ${before} → ${after[0]}, absences ${after[1]}, croix de l'après-midi effacées`);
  await page.screenshot({ path: DIR + "/sorties/shot-abs-eleve.png", fullPage: true });

  // 2b. élève absent sur un seul créneau (M3)
  const hach0 = await page.evaluate(() => document.querySelectorAll("tbody")[2].querySelectorAll("td.c.abs").length);
  await page.select('select[data-eabs="2"]', "creneaux");
  await page.click('button[data-absp="2.2"]');
  const one = await page.evaluate(h0 => [absCreneaux(S, "2026-10-13", 2), document.querySelectorAll("tbody")[2].querySelectorAll("td.c.abs").length - h0,
    Object.keys(S.jours["2026-10-13"].x).filter(k => k.startsWith("2.") && k.endsWith(".2")).length], hach0);
  ok(JSON.stringify(one[0]) === "[2]" && one[1] === 16 && one[2] === 0, `absence sur un seul créneau : créneaux ${JSON.stringify(one[0])}, ${one[1]} cases hachurées en plus (4 objectifs × 4 niveaux)`);
  await page.click('button[data-absp="2.5"]');
  ok(JSON.stringify(await page.evaluate(() => absCreneaux(S, "2026-10-13", 2))) === "[2,5]", "ajout d'un 2e créneau (M3 + S2)");
  ok((await page.evaluate(() => absTexte(absCreneaux(S, "2026-10-13", 2)))) === "absent(e) en M3, S2", "libellé « absent(e) en M3, S2 »");
  await page.screenshot({ path: DIR + "/sorties/shot-abs-creneau.png", clip: { x: 0, y: 270, width: 1500, height: 420 } });

  // 3. ajout, déplacement, suppression d'élèves
  await nav("#reglages/eleves");
  const sig = () => page.evaluate(() => S.eleves.map((e, s) => e.nom + ":" + Object.values(S.jours).reduce((a, j) => a + Object.keys(j.x).filter(k => k.startsWith(s + ".")).length, 0)));
  const s0 = await sig();
  await page.evaluate(() => document.querySelector('button[data-el="add.0"]').click());
  ok((await page.evaluate(() => S.eleves.length)) === 7, "ajout d'un 7e élève");
  await page.evaluate(() => document.querySelector('button[data-el="down.0"]').click());
  const s1 = await sig();
  ok(s1[0] === s0[1] && s1[1] === s0[0], "déplacement : l'élève 1 passe 2e avec toutes ses croix");
  await page.evaluate(() => document.querySelector('button[data-el="del.1"]').click()); await new Promise(r => setTimeout(r, 300));
  const s2 = await sig();
  ok(s2.length === 6 && s2[0] === s0[1] && s2[1] === s0[2] && s2[5] === ":0", "suppression : l'élève et ses saisies disparaissent, les suivants remontent avec les leurs");
  await page.screenshot({ path: DIR + "/sorties/shot-reglages-eleves.png" });

  // 4. 9 élèves : la fiche s'imprime sur une page
  for (let i = 0; i < 3; i++) await page.click('button[data-el="add.0"]');
  await page.evaluate(() => { S.eleves.forEach((e, i) => { if (!e.nom) e.nom = "TEST Élève " + (i + 1); }); commit(); });
  await page.evaluate(() => { document.querySelector("#print-area").innerHTML = `<div class="page sheet">${ficheHTML("2026-10-13", false)}</div>`; });
  await page.emulateMediaType("print");
  await page.pdf({ path: DIR + "/sorties/print-9eleves.pdf", landscape: true, format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.emulateMediaType("screen");

  // 5. aller-retour par le fichier de données (.json) avec absences
  const same = await page.evaluate(async () => { const st = normalizeState(JSON.parse(JSON.stringify({ app: "fiche-suivi-collective", S })).S);
    return JSON.stringify(st.jours) === JSON.stringify(S.jours) && st.eleves.length === S.eleves.length; });
  ok(same, "aller-retour .json (absences et élèves conservés)");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close();
})();
