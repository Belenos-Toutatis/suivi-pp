const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1366, height: 900 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); location.hash = "#bilan"; }); await new Promise(r => setTimeout(r, 400));
  const r = await p.evaluate(() => { const th = [...document.querySelectorAll("table.bil thead th")], td = [...document.querySelectorAll("table.bil tbody td")];
    const tr = document.querySelector("table.bil tbody tr");
    return { th: th.filter(e => e.title).length + "/" + th.length, td: td.filter(e => e.title).length + "/" + td.length,
      ex: [...tr.children].slice(4, 7).map(c => c.title) }; });
  ok(r.th.split("/")[0] === r.th.split("/")[1], `titres de colonnes avec infobule : ${r.th}`);
  ok(r.td.split("/")[0] === r.td.split("/")[1], `cases avec infobule : ${r.td}`);
  r.ex.forEach(t => console.log("   « " + t + " »"));
  // Totaux : ligne Total par élève
  await p.evaluate(() => { location.hash = "#totaux/5"; }); await new Promise(r => setTimeout(r, 400));
  const t = await p.evaluate(() => { const T = statsSemaine(S, semaines(S), 5), e = T.el[0], som = [0, 1, 2, 3].map(l => e.obj.reduce((a, ob) => a + ob.sem[l], 0));
    const tr = document.querySelectorAll("table.tot tr.tot-el")[0], nums = [...tr.querySelectorAll("td.n")].map(c => Number(c.textContent) || 0);
    return { attendu: som, vu: nums, nb: document.querySelectorAll("table.tot tr.tot-el").length, pct: tr.querySelectorAll("td.pc")[5].textContent.trim(), epct: Math.round(e.pct * 100) }; });
  ok(JSON.stringify(t.attendu) === JSON.stringify(t.vu) && t.nb === 7, `ligne Total de chaque élève et du groupe (${t.nb}) : TB S À I = ${t.vu.join(" ")}`);
  ok(parseInt(t.pct) === t.epct, `% de la semaine sur la ligne Total = réussite de l’élève (${t.pct})`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
