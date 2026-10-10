const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p, {}); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  await p.evaluate(() => { window.__titres = []; window.print = () => { window.__titres.push(document.title); }; });
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(400); };
  await go("#classe/2026-11-17"); await wait(300);
  const r = await p.evaluate(() => ({ h: location.hash, nav: document.querySelector("#tabs a.on").dataset.v, cols: document.querySelectorAll("table.cs thead th.cs-nom").length, lignes: document.querySelectorAll("table.cs tbody tr").length, codes: document.querySelectorAll("table.cs td.clc .ccode").length, att: (document.querySelector(".cs-attention") || {}).textContent }));
  console.log(JSON.stringify(r));
  ok(r.h === "#classesem/3" && r.nav === "classe" && r.cols === 26, "#classe/17-11 → fiche de classe de la semaine 47, une colonne par élève (26), menu « Fiches de classe » actif");
  ok(r.codes > 0 && /3 remarques cumulées sur la semaine = 1 heure de retenue/.test(r.att), "codes de la semaine affichés ; bandeau « ATTENTION — 3 remarques … = 1 heure de retenue »");
  // saisie : clic sur une case → choix d'un code
  const cle = await p.evaluate(() => { const td = [...document.querySelectorAll("table.cs td.clc")].find(t => !t.textContent && t.dataset.d === "2026-11-18"); return td.dataset.cl + "|" + td.dataset.d; });
  const [k, d] = cle.split("|");
  await p.click('[data-pal-cl="?"]'); await p.click(`td[data-cl="${k}"][data-d="${d}"]`); await wait(300);
  ok(await p.evaluate(() => !document.querySelector("#pop-cl").hidden), "clic sur une case : choix des codes");
  await p.keyboard.press("b"); await wait(250);
  ok(await p.evaluate((k, d) => S.jours[d].cl[k] === "B", k, d), "lettre B : code enregistré pour ce jour-là (mêmes données que la fiche du jour)");
  await p.keyboard.press("Escape"); await wait(200);
  await p.keyboard.press("ArrowDown"); await wait(100);
  ok(await p.evaluate(k => document.activeElement.dataset.cl && document.activeElement.dataset.cl.split(".")[0] === k.split(".")[0], k), "flèche bas : même élève, créneau suivant");
  // totaux et retenues
  const t = await p.evaluate(() => { const w = semaines(S)[5], b = bilanSemaineClasse(w); return b.map(x => [x.neg, x.pos, x.total, x.retenue]); });
  ok(t.every(([n, po, to, re]) => to === Math.max(0, n - po) && re === Math.floor(to / 3)), "total = remarques − positifs ; retenue = 1 h par tranche de 3 " + JSON.stringify(t.filter(x => x[0]).slice(0, 4)));
  // responsable du jour
  await p.type('input[data-clresp="2026-11-16"]', "BRIDGE Michael"); await wait(200);
  ok(await p.evaluate(() => S.jours["2026-11-16"].clresp === "BRIDGE Michael"), "responsable du lundi enregistré");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: DIR + "/sorties/classe-sem.png" });
  // impression : 1 page portrait
  await p.click('[data-act="print-cl-sem"]'); await wait(300);
  ok((await p.evaluate(() => window.__titres.pop())) === "Suivi 5E - Classe entière - Fiche de la semaine - semaine 47 du 16-11-2026 au 20-11-2026", "nom du PDF « Suivi 5E - Classe entière - Fiche de la semaine - semaine 47 du … au … »");
  await p.emulateMediaType("print"); const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); fs.writeFileSync(DIR + "/sorties/classe-sem.pdf", pdf);
  const nbp = f => Number(require("child_process").execSync(`pdfinfo "${f}"`).toString().match(/Pages:\s+(\d+)/)[1]); const pages = nbp(DIR + "/sorties/classe-sem.pdf");
  ok(pages === 1, "impression : " + pages + " page(s)");
  // semaine avec un jour férié (11 novembre)
  await p.emulateMediaType("screen"); await go("#classesem/2");
  ok(await p.evaluate(() => document.querySelectorAll("table.cs tr.off").length > 0), "jour sans cours (11 novembre) : lignes grisées");
  await p.click('[data-act="print-cl-sem"]'); await wait(300); await p.emulateMediaType("print"); const pdf2 = await p.pdf({ preferCSSPageSize: true, printBackground: true }); fs.writeFileSync(DIR + "/sorties/classe-sem2.pdf", pdf2);
  ok(nbp(DIR + "/sorties/classe-sem2.pdf") === 1, "semaine avec férié : 1 page");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
