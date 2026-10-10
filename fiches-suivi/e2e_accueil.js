const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: fs.mkdtempSync(DIR + "/sorties/chrome-tmp-"), args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1024, height: 768 });
  const dialogs = []; await require("./boites")(page, { messages: dialogs });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await wait(300);
  const vis = sel => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== "none"; }, sel);
  ok(await page.$(".accueil .choix") && (await page.$$(".choix .opt")).length === 3, "premier lancement : écran d'accueil avec 3 choix");
  ok(!(await vis("nav.tabs")) && !(await vis("#b-save")), "onglets et Enregistrer masqués tant qu'il n'y a rien");
  const ordre = await page.$$eval(".choix .opt button", b => b.map(x => x.dataset.act).join(","));
  ok(ordre === "open,new-pdc,new,demo", "ordre : ouvrir, nouveau (depuis Plan de classe, ou vierge), démonstration");
  // démonstration
  await page.click('.choix button[data-act="demo"]'); await wait(200);
  ok(await page.evaluate(() => S && S.demo && location.hash === "#sommaire") && await page.$(".bandeau-demo"), "démonstration chargée, bandeau « données fictives » affiché");
  ok(await vis("nav.tabs"), "onglets réaffichés");
  // depuis la démo : commencer mon propre suivi, sans question puisque rien n'a été modifié
  dialogs.length = 0;
  await page.click('.bandeau-demo button[data-act="new"]'); await wait(200);
  ok(dialogs.length === 0 && await page.evaluate(() => !S.demo && location.hash === "#reglages") && !(await page.$(".bandeau-demo")), "« Commencer mon propre suivi » : suivi vierge, sans confirmation inutile, sur les réglages");
  // glisser-déposer d'un fichier de données .json
  const demoJson = await page.evaluate(() => JSON.stringify({ app: "fiche-suivi-collective", format: 1, S: demoState() }));
  fs.writeFileSync(DIR + "/sorties/Suivi 5E démo.json", demoJson); const b64 = Buffer.from(demoJson).toString("base64");
  await page.evaluate(() => { localStorage.clear(); S = null; dirty = false; render(); });
  ok(await page.$(".accueil"), "retour à l'accueil (données effacées)");
  await page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bytes], "Suivi 5E démo.json", { type: "application/json" }));
    window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
    document.querySelector(".choix .drop").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await wait(800);
  ok(await page.evaluate(() => S && S.eleves.length === 6 && dirty && !document.body.classList.contains("glisse")), "fichier .json glissé sur l'accueil : repris");
  // un fichier qui n'est pas un suivi
  dialogs.length = 0;
  await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(["x"], "notes.txt")); document.body.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await wait(200);
  ok(dialogs.some(m => m.includes("Fichier non reconnu")) && await page.evaluate(() => S.eleves.length === 6), "fichier .txt refusé avec un message clair");
  // bouton Ouvrir de l'accueil → sélecteur de fichier
  await page.evaluate(() => { localStorage.clear(); S = null; dirty = false; render(); });
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 3000 }).catch(() => null), page.evaluate(() => { window.showOpenFilePicker = undefined; document.querySelector('.choix button[data-act="open"]').click(); })]);
  ok(!!chooser, "« Ouvrir un fichier… » ouvre le sélecteur de fichiers");
  if (chooser) { await chooser.accept([DIR + "/sorties/Suivi 5E démo.json"]); await wait(800); ok(await page.evaluate(() => S && S.classe === "5E"), "fichier choisi : ouvert"); }
  // nouveau depuis l'accueil
  await page.evaluate(() => { localStorage.clear(); S = null; dirty = false; render(); });
  await page.click('.choix button[data-act="new"]'); await wait(200);
  ok(await page.evaluate(() => S && location.hash === "#reglages" && S.eleves.every(e => !e.nom)), "« Nouveau suivi » : réglages d'un suivi vierge");
  await page.screenshot({ path: DIR + "/sorties/apres-nouveau.png" });
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close();
})();
