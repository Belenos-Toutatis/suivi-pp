const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1366, height: 900 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const cas = [["classe", '.rub a[href="#reglages/eleves"]', "rubrique Élèves"], ["classe", "label.champ", "champ Classe"], ["calendrier", "label.champ", "Premier lundi"],
    ["calendrier", 'button[data-add="vacances"]', "Ajouter des vacances"], ["eleves", ".poignee", "poignée"], ["eleves", "input.nom", "nom d’élève"], ["eleves", "button.ajout", "Ajouter un élève"],
    ["matieres", ".lrow input[data-path$='.prof']", "enseignant"], ["fiche", ".obj-carte textarea", "descriptif"], ["pastilles", ".codage .pill", "niveau de codage"], ["pastilles", ".seuils-grille label", "seuil rouge"]];
  for (const [r, sel, nom] of cas) {
    await p.evaluate(r => { location.hash = "#reglages/" + r; }, r); await wait(250); await p.mouse.move(1, 1); await wait(100);
    const el = await p.$(sel); if (!el) { ok(false, `${nom} : introuvable`); continue; }
    await el.evaluate(e => e.scrollIntoView({ block: "center" })); await wait(200); await p.mouse.move(1, 1); await wait(100); await el.hover(); await wait(550);
    const x = await p.evaluate(() => { const bl = document.querySelector("#bulle"); return { on: bl.classList.contains("on"), t: (bl.querySelector(".t") || {}).textContent || "", n: bl.children.length }; });
    ok(x.on && x.t && x.n >= 2, `${nom} : « ${x.t} » (${x.n} blocs)`);
  }
  // export JSON
  const r = await p.evaluate(async () => { let nom = "", txt = ""; window.showSaveFilePicker = async o => { nom = o.suggestedName; return { name: o.suggestedName, createWritable: async () => ({ write: async bl => { txt = await bl.text(); }, close: async () => {} }) }; };
    document.querySelector("#b-json").click(); await new Promise(r => setTimeout(r, 300)); const d = JSON.parse(txt); return [nom, d.app, d.S.classe, dirty, document.querySelector("#b-saveas").hidden]; });
  ok(/^Suivi 5E - Données - export du \d\d-\d\d-\d{4}\.json$/.test(r[0]) && r[1] === "fiche-suivi-collective" && r[2] === "5E" && !r[4], `« Exporter les données (.json) » : « ${r[0]} » ; « Enregistrer une copie » proposé (enregistrement dans la page)`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
