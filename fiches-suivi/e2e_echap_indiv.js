// Page d'un suivi individuel (v1.91.1) : Échap ramène à la liste des suivis individuels — sauf quand Échap sert déjà
// (menu ou fenêtre ouverts, tutoriel) ou pendant la frappe (remarque, bilan, champ des réglages).
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
  const echap = async () => { await p.keyboard.press("Escape"); await wait(300); return p.evaluate(() => location.hash); };

  await go("#indiv/demo-bridge"); await p.evaluate(() => document.body.focus());
  ok(await echap() === "#indiv", "page du suivi, rien d’ouvert : Échap → liste des suivis individuels");
  ok(await echap() === "#indiv", "sur la liste : Échap ne fait rien de plus");
  // une case de la grille choisie (saisie au clavier) : Échap sort aussi
  await go("#indiv/demo-bridge"); await p.evaluate(() => { const td = document.querySelector("td.ic"); td.focus(); });
  ok(await echap() === "#indiv", "une case de la grille choisie : Échap → liste");
  // pendant la frappe : on reste
  await go("#indiv/demo-bridge"); await p.focus("input[data-ir]");
  ok(await echap() === "#indiv/demo-bridge", "dans une remarque : Échap reste sur la page (il revient aux cases du cours)");
  await p.focus("textarea[data-ib]");
  ok(await echap() === "#indiv/demo-bridge", "dans le bilan : Échap reste sur la page");
  // menu ouvert : Échap le ferme, sans quitter la page
  await p.evaluate(() => document.body.focus());
  const menu = await p.evaluate(() => { const m = document.querySelector("#m-file"); if (!m) return false; m.open = true; return true; });
  if (menu) { ok(await echap() === "#indiv/demo-bridge" && await p.evaluate(() => !document.querySelector("#m-file").open), "menu Fichier ouvert : Échap le ferme et reste sur la page");
    ok(await echap() === "#indiv", "… un second Échap ramène à la liste"); }
  // fenêtre ouverte : Échap la ferme, sans quitter la page
  await go("#indiv/demo-bridge");
  /* boites.js répond tout seul aux fenêtres : une fenêtre restée ouverte est simulée (le focus reste sur la page) */
  await p.evaluate(() => { document.querySelector("#boite").setAttribute("open", ""); document.body.focus(); });
  ok(await echap() === "#indiv/demo-bridge", "fenêtre ouverte : Échap reste sur la page");
  await p.evaluate(() => document.querySelector("#boite").removeAttribute("open"));
  // tutoriel : Échap le ferme, sans quitter la page
  await go("#indiv/demo-bridge");
  await p.evaluate(() => { allerEtape(TUTO.findIndex(c => c.id === "indiv"), 0); tuto = tuto || { ch: TUTO.findIndex(c => c.id === "indiv"), i: 0 }; location.hash = "#indiv/demo-bridge"; document.body.focus(); }); await wait(400);
  const h = await echap(); ok(h === "#indiv/demo-bridge" && await p.evaluate(() => !tuto), `tutoriel ouvert : Échap le ferme sans quitter la page (${h})`);
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
