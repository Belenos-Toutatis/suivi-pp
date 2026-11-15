// Règle de retenue (v1.91.2) : « désactivé » à côté d'un critère réglé à 0 (nombre de « TI », heures pour la réussite,
// heures par perte), « sans plafond » pour un plafond à 0 — dans les réglages communs et dans la règle propre à un suivi.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p, {}); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };
  /* étiquettes « désactivé » / « sans plafond » rangées par champ */
  const marques = pref => p.evaluate(pref => Object.fromEntries([...document.querySelectorAll(`input[data-num^="${pref}"]`)].map(x => [x.dataset.num.slice(pref.length), (x.closest("label").querySelector("em.ret-off") || {}).textContent || ""])), pref);
  const saisir = (sel, v) => p.evaluate((sel, v) => { const x = document.querySelector(sel); x.value = v; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true })); }, sel, v).then(() => wait(300));

  // réglages communs : la démo règle tout (3 TI, 1 h réussite, 1 h par perte, plafond 2)
  await go("#reglages/suivisIndiv");
  let m = await marques("retenueIndiv.");
  ok(Object.values(m).every(t => t === ""), "réglages, démo : aucun critère désactivé " + JSON.stringify(m));
  await saisir('input[data-num="retenueIndiv.hReussite"]', "0");
  m = await marques("retenueIndiv.");
  ok(m.hReussite === "désactivé" && m.i === "" && m.nonRendue === "", "réglages : réussite = 0 heure → « désactivé » à côté, les autres restent actifs");
  ok(await p.evaluate(() => S.retenueIndiv.hReussite === 0), "la valeur 0 est bien enregistrée");
  await saisir('input[data-num="retenueIndiv.i"]', "0"); await saisir('input[data-num="retenueIndiv.nonRendue"]', "0"); await saisir('input[data-num="retenueIndiv.max"]', "0");
  m = await marques("retenueIndiv.");
  ok(m.i === "désactivé" && m.nonRendue === "désactivé" && m.max === "sans plafond" && m.heures === "" && m.reussite === "", "réglages : 0 « TI », perte à 0 → « désactivé » ; plafond 0 → « sans plafond » ; durée et seuil sans marque");
  await saisir('input[data-num="retenueIndiv.hReussite"]', "2");
  m = await marques("retenueIndiv.");
  ok(m.hReussite === "", "réussite remise à 2 heures : la marque disparaît");
  ok(await p.evaluate(() => { const e = document.querySelector("label.champ em.ret-off"); const l = e.closest("label").querySelector("span"); return e.parentElement === l && getComputedStyle(e).whiteSpace === "nowrap"; }), "la marque est sur la ligne du libellé, au-dessus du champ");

  // règle propre à un suivi
  await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"); ind.retenue = { i: 2, heures: 1, nonRendue: 0, max: 0, reussite: 75, hReussite: 0 }; commit(); });
  await go("#indiv/demo-bridge"); await wait(200);
  const ii = await p.evaluate(() => S.individuels.findIndex(i => i.id === "demo-bridge"));
  m = await marques(`individuels.${ii}.retenue.`);
  ok(m.i === "" && m.hReussite === "désactivé" && m.nonRendue === "désactivé" && m.max === "sans plafond", "règle du suivi : réussite et perte à 0 → « désactivé », plafond 0 → « sans plafond » " + JSON.stringify(m));
  await saisir(`input[data-num="individuels.${ii}.retenue.i"]`, "0");
  m = await marques(`individuels.${ii}.retenue.`);
  ok(m.i === "désactivé", "règle du suivi : 0 « TI » → « désactivé »");
  await saisir(`input[data-num="individuels.${ii}.retenue.nonRendue"]`, "1");
  m = await marques(`individuels.${ii}.retenue.`);
  ok(m.nonRendue === "", "règle du suivi : perte à 1 heure → plus de marque");
  await p.screenshot({ path: DIR + "/sorties/ret-off.png" });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
