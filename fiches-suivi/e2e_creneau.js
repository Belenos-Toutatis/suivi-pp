const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await p.setViewport({ width: 1024, height: 768 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); location.hash = "#classesem/3"; }); await wait(500);
  const D = "2026-11-17", P = 0;   // mardi 17/11 M1 : Français, Mme SOLE
  const ouvrir = async () => { await p.click(`td[data-crn="${D}|${P}"]`); await wait(300); };
  // remplacé par un collègue qui n'a pas la classe, dans une autre discipline
  await ouvrir();
  ok(await p.evaluate(() => !!document.querySelector("#boite[open] .crn") && document.querySelector("#boite .crn-o small").textContent.includes("Français")), "fiche de classe : clic sur la matière d’un créneau → fenêtre « absent ou remplacé »");
  await p.click('#boite input[value="rempl"]'); await p.evaluate(() => { document.querySelector("#crn-prof").value = "M. LIMANDE"; document.querySelector("#crn-mat").value = "Permanence"; });
  await p.click('#boite [data-r="oui"]'); await wait(400);
  const r = await p.evaluate((D, P) => { const cr = creneau(S, semaines(S), D, P); return [cr.mat, cr.prof, cr.remplace, S.jours[D].prof[P], S.jours[D].mat[P]]; }, D, P);
  ok(r[0] === "Permanence" && r[1] === "M. LIMANDE" && r[2], "remplacé par « M. LIMANDE » (pas dans la liste) en « Permanence » : " + r.join(" · "));
  ok(await p.evaluate((D, P) => document.querySelector(`td[data-crn="${D}|${P}"]`).textContent.includes("Permanence"), D, P), "la fiche de classe affiche la nouvelle matière");
  // même créneau sur la fiche collective et la fiche individuelle
  await p.evaluate(D => { location.hash = "#fiche/" + D; }, D); await wait(400);
  ok(await p.evaluate(() => document.querySelector("table.fiche").textContent.includes("M. LIMANDE")), "fiche collective du jour : le remplaçant apparaît");
  await p.evaluate(() => { location.hash = "#indiv/demo-bridge:2026-11-20"; }); await wait(400);
  ok(await p.evaluate((D, P) => (document.querySelector(`table.indiv td[data-crn="${D}|${P}"]`) || {}).textContent === "Permanence", D, P), "fiche individuelle : la matière de remplacement apparaît");
  // enseignant absent depuis la fiche individuelle
  await p.click(`table.indiv td[data-crn="${D}|${P}"]`); await wait(300);
  await p.click('#boite input[value="absent"]'); await p.click('#boite [data-r="oui"]'); await wait(300);
  if (await p.$('#boite[open]')) { await p.click('#boite [data-r="oui"]'); await wait(300); }   // confirmation : croix déjà saisies
  ok(await p.evaluate((D, P) => S.jours[D].profAbs[P] && !S.jours[D].prof[P] && !(P in S.jours[D].mat) && creneau(S, semaines(S), D, P).absent, D, P), "« Enseignant absent » : pas de cours, remplacement effacé");
  ok(await p.evaluate((D, P) => !!document.querySelector(`table.indiv td.ferme[data-crn="${D}|${P}"]`), D, P), "fiche individuelle : créneau grisé, encore cliquable pour rétablir");
  await p.click(`table.indiv td[data-crn="${D}|${P}"]`); await wait(300); await p.click('#boite input[value="normal"]'); await p.click('#boite [data-r="oui"]'); await wait(300);
  ok(await p.evaluate((D, P) => !S.jours[D].profAbs[P] && creneau(S, semaines(S), D, P).mat === "Français", D, P), "« Cours normal » : retour à l’emploi du temps");
  // fiche collective : le crayon ouvre la même fenêtre
  await p.evaluate(D => { location.hash = "#fiche/" + D; }, D); await wait(400);
  await p.click('[data-rempl="1"]'); await wait(300);
  ok(await p.evaluate(() => !!document.querySelector("#boite[open] .crn")), "fiche collective : le crayon ✎ ouvre la même fenêtre");
  await p.screenshot({ path: DIR + "/sorties/creneau.png" });
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
