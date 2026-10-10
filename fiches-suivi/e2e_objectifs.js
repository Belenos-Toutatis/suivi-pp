const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), { execSync } = require("child_process");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 900 });
  const dialogs = []; await require("./boites")(page, { messages: dialogs });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await page.evaluate(h => { location.hash = h; }, h); await wait(250); };
  const sig = () => page.evaluate(() => S.objectifs.map((o, i) => o.court + ":" + Object.values(S.jours).reduce((a, j) => a + Object.keys(j.x).filter(k => k.split(".")[1] === String(i)).length, 0)));
  await go("#reglages/fiche");
  const s0 = await sig();
  // ajouter un 5e objectif
  await page.click('button[data-ob="add.0"]'); await wait(150);
  ok(await page.evaluate(() => S.objectifs.length === 5 && document.activeElement.dataset.path === "objectifs.4.court"), "ajout d’un 5e objectif, curseur dans son intitulé");
  await page.keyboard.type("Lever la main"); await page.keyboard.press("Tab"); await wait(150);
  ok((await page.evaluate(() => S.objectifs[4].court)) === "Lever la main", "intitulé saisi");
  // fiche : 5 lignes par élève, saisie sur le 5e objectif
  await go("#fiche/2026-10-13");
  ok(await page.evaluate(() => document.querySelector("table.fiche tbody").querySelectorAll("tr:not(.tete-eleve):not(.com-ligne)").length === 5), "fiche : 5 lignes par élève");
  await page.click('td[data-x="0.4.0.0"]'); await wait(100);
  ok(await page.evaluate(() => croix(S, "2026-10-13", 0, 4, 0) === 0 && etatJour(S, semaines(S), "2026-10-13") === "part"), "croix sur le 5e objectif ; le jour n’est plus « complet » (5e objectif à remplir)");
  // déplacer : les croix suivent
  await go("#reglages/fiche");
  await page.click('button[data-ob="up.4"]'); await wait(150);
  const s1 = await sig();
  ok(s1[3].startsWith("Lever la main") && s1[4] === s0[3], "déplacer le 5e objectif en 4e : les croix suivent leur objectif");
  // supprimer : confirmation, croix effacées, suivants remontent
  dialogs.length = 0;
  await page.click('button[data-ob="del.0"]'); await wait(150);
  const s2 = await sig();
  ok(dialogs.length === 1 && s2.length === 4 && s2[0] === s1[1] && s2[2].startsWith("Lever la main"), "supprimer le 1er objectif : confirmation, ses croix disparaissent, les suivants remontent avec les leurs");
  ok(await page.evaluate(() => Object.values(S.jours).every(j => Object.keys(j.x).every(k => Number(k.split(".")[1]) < S.objectifs.length))), "aucune croix orpheline");
  // limites
  await page.evaluate(() => { while (S.objectifs.length < MAX_OBJ) S.objectifs.push({ court: "Objectif " + (S.objectifs.length + 1), desc: "" }); commit(); });
  ok(await page.$eval('button[data-ob="add.0"]', b => b.disabled), `${await page.evaluate(() => MAX_OBJ)} objectifs : bouton « Ajouter » désactivé`);
  // impression : 8 objectifs, 6 puis 12 élèves → 1 page
  for (const n of [6, 12]) {
    await page.evaluate(n => { while (S.eleves.length < n) S.eleves.push({ nom: "ÉLÈVE " + (S.eleves.length + 1), debut: "", fin: "" }); S.eleves.length = n; commit(); }, n);
    await page.evaluate(() => { document.querySelector("#print-area").innerHTML = `<div class="page sheet">${ficheHTML("2026-10-13", false)}</div>`; });
    await page.emulateMediaType("print"); await page.pdf({ path: `${DIR}/sorties/obj8-${n}.pdf`, landscape: true, format: "A4", printBackground: true, preferCSSPageSize: true }); await page.emulateMediaType("screen");
    const pages = Number(execSync(`pdfinfo "${DIR}/sorties/obj8-${n}.pdf" | grep Pages | awk '{print $2}'`).toString());
    ok(pages === 1, `fiche imprimée, 8 objectifs × ${n} élèves : ${pages} page`);
  }
  // un seul objectif
  await page.evaluate(() => { S.eleves.length = 6; S.objectifs.length = 1; commit(); });
  await go("#totaux/0");
  ok(await page.evaluate(() => document.querySelector("table.tot tbody").rows.length === 1), "un seul objectif : totaux à une ligne par élève");
  // fichier de données : aller-retour avec 3 objectifs
  await page.evaluate(() => { S.objectifs = [{ court: "A", desc: "a" }, { court: "B", desc: "b" }, { court: "C", desc: "c" }]; commit(); });
  const rt = await page.evaluate(async () => { S = normalizeState(JSON.parse(JSON.stringify(S))); const st = normalizeState(JSON.parse(JSON.stringify(S))); return JSON.stringify(st.objectifs) === JSON.stringify(S.objectifs) && JSON.stringify(st.jours) === JSON.stringify(S.jours); });
  ok(rt, "aller-retour .json avec 3 objectifs : identique");
  ok(await page.evaluate(() => normalizeState({ objectifs: [{ court: "x" }] }).objectifs.length === 1 && normalizeState({}).objectifs.length === 4), "fichier sans liste d’objectifs : 4 objectifs par défaut");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
