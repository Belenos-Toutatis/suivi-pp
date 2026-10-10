const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), { execSync } = require("child_process");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html", OUT = DIR + "/sorties/impr";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const NOMS = ["SCHWARTZENBERGER Jean-Baptiste", "DE LA ROCHEFOUCAULD Marie-Amélie", "ANDRIANAMPOINIMERINA Tiana", "MULLER Léa", "KLEIN Hugo", "HAAS Inès",
  "WEBER Noé", "FISCHER Lina", "SCHMITT Tom", "MEYER Zoé", "WOLFF Lucas", "RICHARD Noah"];
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await require("./boites")(page);
  await page.goto(APP); await page.evaluate(() => doDemo());
  const pdf = async (name, pages) => {
    await page.evaluate(p => { document.querySelector("#print-area").innerHTML = p.map(h => `<div class="page sheet">${h}</div>`).join(""); }, pages);
    await page.emulateMediaType("print");
    await page.pdf({ path: `${OUT}/${name}.pdf`, landscape: true, format: "A4", printBackground: true, preferCSSPageSize: true });
    await page.emulateMediaType("screen");
    const n = Number(execSync(`pdfinfo "${OUT}/${name}.pdf" | grep Pages | awk '{print $2}'`).toString());
    const txt = execSync(`pdftotext "${OUT}/${name}.pdf" -`).toString();
    return { n, txt };
  };
  const setN = n => page.evaluate((n, NOMS) => { S.eleves = NOMS.slice(0, n).map(nom => ({ nom, debut: "", fin: "" })); }, n, NOMS);
  for (const n of [12]) { await setN(n); const r = await pdf("bilan12", await page.evaluate(() => [bilanHTML()])); ok(r.n === 1 && r.txt.includes("RICHARD"), `bilan 12 élèves : ${r.n} page, 12e élève présent : ${r.txt.includes("RICHARD")}`); }
  // fiche : en-tête long (consigne 400 car., descriptifs 250 car.)
  await page.evaluate(() => { S.consignes[S.consigneChoisie].texte = "Consigne longue. ".repeat(24); S.objectifs.forEach(o => { o.desc = "Descriptif détaillé de l’objectif, avec des exemples concrets de comportements attendus. ".repeat(3); }); });
  for (const n of [1, 6, 9, 12]) { await setN(n); const r = await pdf(`fiche-long-${n}`, await page.evaluate(() => [ficheHTML("2026-10-13", false)])); ok(r.n === 1, `fiche, en-tête long, ${n} élève(s) : ${r.n} page`); }
  // noms longs non tronqués
  await setN(6); const rn = await pdf("noms", await page.evaluate(() => [ficheHTML("2026-10-13", false)]));
  ok(!rn.txt.includes("…") && rn.txt.includes("SCHWARTZENBERGER") && rn.txt.includes("ROCHEFOUCAULD"), "noms longs : en entier, sans points de suspension");
  // totaux 9 et 12 élèves : aucun élève coupé
  for (const n of [9, 12]) {
    await setN(n); const r = await pdf(`tot${n}`, await page.evaluate(() => [totauxHTML(0)]));
    ok(r.n <= 2, `totaux ${n} élèves : ${r.n} page(s)`);
  }
  // enseignant absent : « ABSENT » lisible
  await page.evaluate(() => doDemo());
  const ra = await pdf("prof-abs", await page.evaluate(() => [ficheHTML("2026-11-19", false)]));
  ok(ra.txt.includes("ABSENT"), "enseignant absent imprimé « ABSENT – … »");
  // semaine avec férié : le jour sans cours n'est pas imprimé
  const rw = await pdf("semaine46", await page.evaluate(() => fichesSemaine(semaines(S)[2])));
  ok(rw.n === 4, `fiches de la semaine 46 (11/11 férié) : ${rw.n} pages`);
  execSync(`pdftoppm -r 60 -png -f 1 -l 1 "${OUT}/fiche-long-9.pdf" "${OUT}/fl9"; pdftoppm -r 60 -png "${OUT}/tot9.pdf" "${OUT}/t9"; pdftoppm -r 60 -png "${OUT}/bilan12.pdf" "${OUT}/b12"; pdftoppm -r 60 -png "${OUT}/noms.pdf" "${OUT}/noms"`);
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
