// Nouvelle année : l'emploi du temps repris est le dernier en vigueur, avec créneaux et horaires
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs");
const D = __dirname, ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m);
(async () => {
  const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require(D + "/boites.js")(p, { messages: [], reponse: () => JSON.stringify({ "na-edt": true }) });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1024, height: 768 });
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo());
  await p.evaluate(() => { S.creneauS4 = true; S.samedi = true; S.horairesBase.duree = 50; S.edtSuivants.push({ depuis: "2027-01-04", A: JSON.parse(JSON.stringify(S.edt.A)), B: JSON.parse(JSON.stringify(S.edt.B)) }); S.edtSuivants[S.edtSuivants.length - 1].A[0][0] = { mat: "NOUVELLE", salle: "" }; dirty = false; });
  await p.evaluate(() => doNouvelleAnnee()); await new Promise(r => setTimeout(r, 300));
  await new Promise(r => setTimeout(r, 500));
  const r = await p.evaluate(() => ({ m: S.edt.A[0][0].mat, s4: S.creneauS4, sam: S.samedi, du: S.horairesBase.duree, mer: S.horairesJours[2].mode, v: S.edtSuivants.length }));
  ok(r.m === "NOUVELLE" && r.v === 0, "dernier emploi du temps en vigueur repris, sans versions " + JSON.stringify(r));
  ok(r.s4 && r.sam && r.du === 50 && r.mer === "decale", "créneaux, samedi, durée des cours et mercredi décalé repris");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
