// Audit du 2026-11-22 (fiches individuelles) : le résumé du menu des réglages dit TOUS les critères de retenue actifs (il ne citait
// que les « TI ») ; à 1024 px, « = heures » reste à côté de son critère ; un élève parti de la classe n'a plus de fiche après son
// départ (son suivi n'est pas clos : une date de départ se corrige), et la page de son suivi le dit. Noms de la démonstration.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await require("./boites")(p);
    await p.setViewport({ width: 1024, height: 768 });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
    await p.evaluate(() => { doDemo(); window.aujourdhui = () => "2026-11-18"; }); await wait(400);
    const resume = async regle => { await p.evaluate(r => { S.retenueIndiv = r; commit(); location.hash = "#reglages"; }, regle); await wait(350);
      return p.evaluate(() => { const a = [...document.querySelectorAll("a, button, li, .carte, .card")].filter(x => /Fiches individuelles/.test(x.textContent) && /remise le/.test(x.textContent)).sort((x, y) => x.textContent.length - y.textContent.length)[0]; return a ? a.textContent.replace(/\s+/g, " ").trim() : ""; }); };
    // 1. le résumé du menu
    let r = await resume({ i: 3, heures: 1, nonRendue: 2, max: 2, reussite: 75, hReussite: 1 });
    ok(/3 TI = 1 h/.test(r) && /réussite/i.test(r) && /75/.test(r) && /perte/i.test(r), "résumé, trois critères : " + r);
    r = await resume({ i: 0, heures: 1, nonRendue: 0, max: 2, reussite: 75, hReussite: 2 });
    ok(/réussite/i.test(r) && /2 h/.test(r) && !/TI =/.test(r), "résumé, la réussite seule : " + r);
    r = await resume({ i: 0, heures: 1, nonRendue: 2, max: 0, reussite: 75, hReussite: 0 });
    ok(/perte/i.test(r) && /2 h/.test(r), "résumé, la perte seule : " + r);
    r = await resume({ i: 0, heures: 1, nonRendue: 0, max: 2, reussite: 75, hReussite: 0 });
    ok(!/ h\b/.test(r.replace(/remise le \S+/, "")) && /remise le/.test(r), "résumé, aucune règle : rien n'est annoncé — " + r);
    // 2. à 1024 px, chaque « = heures » sur la ligne de son critère
    await p.evaluate(() => { S.retenueIndiv = { i: 5, heures: 1, nonRendue: 1, max: 2, reussite: 75, hReussite: 1 }; commit(); location.hash = "#reglages/suivisIndiv"; }); await wait(450);
    for (const [w, h] of [[1024, 768], [1366, 768]]) { await p.setViewport({ width: w, height: h }); await wait(250);
      const g = await p.evaluate(() => { const y = k => { const e = document.querySelector(`[data-num="retenueIndiv.${k}"]`); return e ? Math.round(e.getBoundingClientRect().top) : null; };
        return { i: y("i"), heures: y("heures"), reussite: y("reussite"), hReussite: y("hReussite"), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      ok(g.i !== null && g.i === g.heures && g.reussite === g.hReussite, `${w} px : chaque « = heures » sur la ligne de son critère ${JSON.stringify(g)}`);
      ok(g.deb <= 0, `${w} px : pas de défilement horizontal`); }
    // 3. élève parti : plus de fiche après son départ
    await p.setViewport({ width: 1366, height: 768 });
    const d = await p.evaluate(() => { const ind = S.individuels[0], avant = cyclesIndiv(ind).map(c => c.fin);
      const e = S.classeEleves.find(x => cleNom(x.nom) === cleNom(ind.nom)); const depart = "2026-11-10";
      const finPropre = ind.fin || ""; e.fin = depart; commit();
      const apres = cyclesIndiv(ind);
      location.hash = "#indiv/" + ind.id;
      return { nom: ind.nom, avant: avant.length, apres: apres.length, derniere: apres.length ? apres[apres.length - 1].fin : null, depart, finPropre, suiviClos: ind.fin || "" }; });
    await wait(450);
    ok(d.apres > 0 && d.apres < d.avant && d.derniere <= d.depart, `élève parti le 10/11 : ${d.apres} fiches au lieu de ${d.avant}, la dernière finit le ${d.derniere}`);
    ok(d.suiviClos === d.finPropre, "le suivi lui-même n'est pas clos (sa date de fin n'est pas touchée)");
    const txt = await p.evaluate(() => document.querySelector("main, #app, body").innerText);
    ok(/quitté la classe le 10\/11/.test(txt), "la page du suivi le dit : « a quitté la classe le 10/11 »");
    const sem = await p.evaluate(() => { const ind = S.individuels[0]; return { nov16: cyclesIndiv(ind).some(c => c.debut >= "2026-11-16"), autres: S.individuels.slice(1).some(i => cyclesIndiv(i).some(c => c.debut >= "2026-11-16")) }; });
    ok(!sem.nov16 && sem.autres, "semaine du 16/11 : plus de fiche pour lui, les autres suivis gardent la leur");
    await p.evaluate(() => { const ind = S.individuels[0], e = S.classeEleves.find(x => cleNom(x.nom) === cleNom(ind.nom)); e.fin = ""; commit(); });
    ok(await p.evaluate(a => cyclesIndiv(S.individuels[0]).length === a, d.avant), "date de départ retirée : toutes ses fiches reviennent");
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
