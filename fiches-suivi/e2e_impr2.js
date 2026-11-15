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
  // fiche individuelle (v1.90.1) : toujours UNE page, le cadre du bilan compris, même avec un en-tête long (consigne de 4 lignes,
  // règle de retenue complète, objectifs sur 2 lignes) — cas rencontré : le bilan partait sur une 2e page
  const consigne = "À présenter à chaque enseignant en début de cours et à récupérer auprès de lui à la fin du cours.\nChaque soir, l’enseignant du dernier cours garde la fiche et la dépose dans le casier de [référent] ; le lendemain matin, [référent] la pose sur le bureau de l’enseignant de la première heure, dans sa salle. La fiche ne quitte pas le collège.\nLe [jour], la famille reçoit le bilan par Mon Bureau Numérique ; la nouvelle fiche est déposée le [reprise] matin sur le bureau de [premier enseignant].";
  await page.evaluate(consigne => { S.retenueIndiv = { i: 4, heures: 1, nonRendue: 1, max: 2, reussite: 75, hReussite: 1 }; S.consignesIndiv.push({ label: "Casier", texte: consigne }); }, consigne);
  for (const [nom, nobj, tous] of [["indiv-3obj-long", 3, false], ["indiv-4obj-tous", 4, true], ["indiv-1obj", 1, false]]) {
    const ri = await pdf(nom, await page.evaluate((nobj, tous) => { S.creneauMidi = tous; S.creneauS4 = tous; S.creneauS5 = tous; const ind = S.individuels[1]; ind.consigne = S.consignesIndiv.length;
      ind.objectifs = ["Je ne bavarde pas en classe.", "Je termine le travail écrit demandé.", "Je note les devoirs dans mon agenda.", "Je lève la main pour prendre la parole."].slice(0, nobj);
      return [indivHTML(ind, cyclesIndiv(ind)[2], false)]; }, nobj, tous));
    ok(ri.n === 1 && /Bilan du professeur/.test(ri.txt) && /Attention/.test(ri.txt) && /premier cours/.test(ri.txt), `fiche individuelle, ${nobj} objectif(s), consigne de 4 lignes${tous ? ", tous les créneaux" : ""} : ${ri.n} page, bilan compris`); }
  await page.evaluate(() => { S.creneauMidi = false; S.creneauS4 = false; S.creneauS5 = false; });
  const rs = await pdf("indiv-semaine", await page.evaluate(() => S.individuels.map(i => indivHTML(i, cyclesIndiv(i)[2], false))));
  ok(rs.n === 3, `fiches individuelles de la semaine, 3 élèves : ${rs.n} pages`);
  const rfam = await pdf("indiv-famille", await page.evaluate(() => { const ind = S.individuels[1], c = cyclesIndiv(ind)[2]; return [bilanFamilleHTML(ind, c), indivHTML(ind, c, false, true)]; }));
  ok(rfam.n === 2, `bilan pour la famille : ${rfam.n} pages (le bilan, puis la fiche)`);
  execSync(`pdftoppm -r 60 -png -f 1 -l 1 "${OUT}/fiche-long-9.pdf" "${OUT}/fl9"; pdftoppm -r 60 -png "${OUT}/tot9.pdf" "${OUT}/t9"; pdftoppm -r 60 -png "${OUT}/bilan12.pdf" "${OUT}/b12"; pdftoppm -r 60 -png "${OUT}/noms.pdf" "${OUT}/noms"`);
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
