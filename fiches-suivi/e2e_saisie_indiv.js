const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  await p.evaluate(() => { S.individuels[0].saisies = {}; commit(); location.hash = "#indiv/demo-bridge:2026-11-20"; }); await wait(400);
  const ordre = await p.evaluate(() => ordreIndiv());
  ok(ordre[0].endsWith("2026-11-16.0.0") && ordre[1].endsWith("2026-11-16.0.1") && ordre[3].split(".")[1] === "2026-11-16", "ordre de saisie : objectifs du 1er cours, puis cours suivant, jour par jour " + ordre.slice(0, 4).join(" "));
  // saisie au clavier d'une traite : T S A I puis 4 3 (4 = le meilleur niveau, 1 = le plus faible) ...
  await p.focus(`td[data-ic="${ordre[0]}"]`);
  for (const k of ["t", "s", "a", "i", "4", "3"]) { await p.keyboard.press(k); await wait(120); }
  const v = await p.evaluate(o => o.slice(0, 6).map(c => { const [ii, d, pp, x] = c.split("."); const s = S.individuels[ii].saisies[`${d}.${pp}`]; return s ? s.c[x] : "-"; }), ordre);
  ok(v.join() === "0,1,2,3,0,1", "frappe T S A I 4 3 : six cases remplies d’affilée (4 = TB, 3 = S) " + v.join());
  ok(await p.evaluate(c => document.activeElement.dataset.ic === c, ordre[6]), "le focus est sur la 7e case");
  await p.keyboard.press(" "); await wait(100);
  ok(await p.evaluate(c => document.activeElement.dataset.ic === c, ordre[7]), "Espace : case suivante sans rien changer");
  await p.keyboard.press("Backspace"); await wait(150);
  ok(await p.evaluate(c => document.activeElement.dataset.ic === c, ordre[6]), "Retour arrière sur une case vide : revient à la précédente");
  await p.keyboard.press("Enter"); await wait(100);
  const ir = ordre[6].split(".").slice(0, 3).join(".");
  ok(await p.evaluate(ir => document.activeElement.dataset.ir === ir, ir), "Entrée : remarque du cours");
  await p.keyboard.type("Bavardages"); await p.keyboard.press("Enter"); await wait(150);
  const suivant = ordre.find((c, i) => i > 6 && !c.startsWith(ir + "."));
  ok(await p.evaluate((ir, s) => { const [ii, d, pp] = ir.split("."); return S.individuels[ii].saisies[`${d}.${pp}`].r === "Bavardages" && document.activeElement.dataset.ic === s; }, ir, ordre[6]) , "Entrée dans la remarque d’un cours vide : retour à sa 1re case");
  // remarque au début du cours : Entrée revient aux cases vides du cours
  const c2 = ordre.find((c, i) => i > 9 && c.endsWith(".0")), ir2 = c2.split(".").slice(0, 3).join(".");
  await p.focus(`td[data-ic="${c2}"]`); await p.keyboard.press("Enter"); await p.keyboard.type("Oubli"); await p.keyboard.press("Enter"); await wait(150);
  ok(await p.evaluate(c => document.activeElement.dataset.ic === c, c2), "remarque écrite d’abord : Entrée revient à la 1re case vide du cours");
  for (const k of ["4", "3", "2"]) { await p.keyboard.press(k); await wait(120); }
  const apres3 = await p.evaluate(() => document.activeElement.dataset.ic);
  ok(!apres3.startsWith(ir2 + ".") && await p.evaluate((ir, s) => { const [ii, d, pp] = ir.split("."); const x = S.individuels[ii].saisies[`${d}.${pp}`]; return x.r === "Oubli" && x.c.join() === "0,1,2"; }, ir2), "puis les 3 codes : cours rempli, remarque gardée, on est au cours suivant");
  // Maj+Entrée : remarque du cours qu'on vient de remplir
  await p.keyboard.down("Shift"); await p.keyboard.press("Enter"); await p.keyboard.up("Shift"); await wait(100);
  ok(await p.evaluate(ir => document.activeElement.dataset.ir === ir, ir2), "Maj+Entrée : remarque du cours qu’on vient de remplir");
  await p.keyboard.press("End"); await p.keyboard.type(" de cahier"); await p.keyboard.press("Enter"); await wait(150);
  ok(await p.evaluate(s => document.activeElement.dataset.ic === s, apres3), "Entrée (cours rempli) : retour au cours suivant");
  // flèches
  await p.focus(`td[data-ic="${suivant}"]`); await p.keyboard.press("ArrowUp"); await wait(80);
  ok(await p.evaluate(c => document.activeElement.dataset.ic === c, ordre[6]), "flèche haut : même objectif, cours précédent");
  // palette : aucun code choisi à l'ouverture ; un code choisi s'écrit tout de suite au clic ou au cliquer-glisser
  ok(await p.evaluate(() => codeIndiv === null && !document.querySelector("[data-pal-ind].on")), "à l’ouverture de la fiche : aucun code choisi dans la palette");
  const ctr = sel => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const val = c => p.evaluate(c => { const [ii, d, pp, x] = c.split("."); const s = S.individuels[ii].saisies[`${d}.${pp}`]; return s ? s.c[x] : null; }, c);
  const libres = ordre.filter(c => c.endsWith(".0") && ordre.indexOf(c) > 18).slice(0, 1).map(c => [0, 1, 2].map(o => c.replace(/\.0$/, "." + o)))[0];
  await p.evaluate(c => document.querySelector(`td[data-ic="${c}"]`).scrollIntoView({ block: "center" }), libres[0]); await wait(100);
  const c1 = await ctr(`td[data-ic="${libres[0]}"]`); await p.mouse.click(...c1); await wait(200);
  ok(await val(libres[0]) === null && await p.evaluate(c => document.activeElement.dataset.ic === c, libres[0]), "sans code choisi : un clic choisit la case, rien n’est écrit");
  await p.click('[data-pal-ind="1"]'); await wait(250);
  ok(await val(libres[0]) === 1 && await p.evaluate(c => codeIndiv === 1 && document.activeElement.dataset.ic !== c, libres[0]), "puis S dans la palette : S écrit dans la case, S choisi, case suivante");
  await p.evaluate(c => { const [ii, d, pp] = c.split("."); delete S.individuels[ii].saisies[`${d}.${pp}`]; commit(); }, libres[0]); await wait(200);
  const a = await ctr(`td[data-ic="${libres[0]}"]`), z = await ctr(`td[data-ic="${libres[2]}"]`);
  await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 6 }); await p.mouse.up(); await wait(250);
  const v2 = await p.evaluate(o => o.map(c => { const [ii, d, pp, x] = c.split("."); const s = S.individuels[ii].saisies[`${d}.${pp}`]; return s ? s.c[x] : "-"; }), libres);
  ok(v2.every(x => x === 1), "S choisi, cliquer-glisser sur 3 cases : S partout " + v2.join());
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  ok(await p.evaluate(o => o.every(c => { const [ii, d, pp, x] = c.split("."); const s = S.individuels[ii].saisies[`${d}.${pp}`]; return !s || s.c[x] === null; }), libres), "Ctrl+Z annule tout le glisser d’un coup");
  await p.mouse.click(...c1); await wait(200);
  ok(await val(libres[0]) === 1, "S choisi : un simple clic sur une case y met S tout de suite");
  await p.mouse.click(...c1); await wait(200);
  ok(await val(libres[0]) === null, "2e clic avec le même code : la case est vidée");
  await p.click('[data-pal-ind="1"]'); await wait(200);
  ok(await p.evaluate(() => codeIndiv === null && !document.querySelector("[data-pal-ind].on")), "clic sur le code déjà choisi : il est désélectionné");
  await p.mouse.click(...c1); await wait(200);
  ok(await val(libres[0]) === null, "sans code choisi, le clic ne fait que choisir la case");
  await p.keyboard.press("3"); await wait(150);
  ok(await val(libres[0]) === 1, "puis la touche 3 : S");
  await p.click('[data-pal-ind="-1"]'); await wait(200); await p.mouse.click(...c1); await wait(200);
  ok(await val(libres[0]) === null, "gomme choisie : un clic vide la case");
  ok(await p.evaluate(() => document.querySelector(".pal-ind").getBoundingClientRect().width <= 1024 && document.documentElement.scrollWidth <= 1024), "palette lisible à 1024 px, pas de défilement horizontal");
  await p.evaluate(() => document.querySelector(".pal-ind").scrollIntoView()); await wait(150); await p.screenshot({ path: DIR + "/sorties/saisie-indiv.png" });
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
