// Fichier de la page retenu d'une visite à l'autre (enregistrement dans la page .html), droit d'écriture redemandé.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); const msgs = []; await require("./boites")(page, { messages: msgs });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP); await page.evaluate(() => { localStorage.clear(); doDemo(); });
  await page.evaluate(async () => { await memoriserFichier({ name: NOM_PAGE, kind: "file" }); });
  await page.reload(); await wait(500);
  ok(await page.evaluate(() => fileHandle && fileHandle.name === NOM_PAGE), "après rechargement : la page elle-même est retrouvée comme fichier d’enregistrement");
  // droit d'écriture redemandé, puis écriture directe
  await page.evaluate(() => {
    window.__demande = 0; window.__ecrit = 0; window.showSaveFilePicker = async () => { throw new Error("sélecteur ouvert à tort"); };
    fileHandle = { name: NOM_PAGE, queryPermission: async () => "prompt", requestPermission: async () => { window.__demande++; return "granted"; },
      createWritable: async () => ({ write: async () => { window.__ecrit++; }, close: async () => {} }) }; idEnregistre = S.id;
  });
  await page.evaluate(() => saveFile(false)); await wait(600);
  ok(await page.evaluate(() => window.__demande === 1 && window.__ecrit === 1 && !dirty), "Ctrl+S après rechargement : autorisation demandée puis écriture dans la page");
  // droit refusé : on redemande, et la page choisie redevient le fichier habituel
  await page.evaluate(() => {
    S.classe = "Y"; commit();
    window.__picker = 0; window.showSaveFilePicker = async () => { window.__picker++; return { name: NOM_PAGE, createWritable: async () => ({ write: async () => {}, close: async () => {} }) }; };
    fileHandle = { name: NOM_PAGE, queryPermission: async () => "prompt", requestPermission: async () => "denied" };
  });
  await page.evaluate(() => saveFile(false)); await wait(800);
  ok(await page.evaluate(() => window.__picker === 1 && !dirty && fileHandle.name === NOM_PAGE), "autorisation refusée : le sélecteur s’ouvre, la page choisie redevient le fichier habituel");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
