// Fiche individuelle, case de la remarque (v1.93.1) : le champ n'occupait que le haut de la case (17 px sur 57) et un clic au milieu
// ou en bas ne faisait rien, alors que l'infobulle annonce « Clic dans la case ». Vrais clics de souris, de 1 à 4 objectifs, aux
// deux tailles d'écran ; le champ s'élargit sans être coupé par sa case ; la fiche garde la hauteur de ses lignes.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(DIR + "/sorties", { recursive: true });
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await require("./boites")(p);
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.setViewport({ width: 1366, height: 768 });
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
    await p.evaluate(() => { doDemo(); window.aujourdhui = () => "2026-11-18"; }); await wait(400);
    for (const [w, h] of [[1024, 768], [1366, 768]]) for (const no of [1, 2, 3, 4]) {
      await p.setViewport({ width: w, height: h });
      await p.evaluate(no => { const ind = S.individuels[0]; ind.objectifs = ["Objectif 1", "Objectif 2", "Objectif 3", "Objectif 4"].slice(0, no); commit(); location.hash = "#indiv"; }, no); await wait(200);
      await p.evaluate(() => { location.hash = "#indiv/" + S.individuels[0].id; }); await wait(450);
      for (const [nom, f] of [["en haut", .12], ["au milieu", .5], ["en bas", .88]]) {
        const g = await p.evaluate(f => { document.activeElement && document.activeElement.blur(); const i = [...document.querySelectorAll("input[data-ir]")].find(x => !x.value), td = i.closest("td");
          td.scrollIntoView({ block: "center" }); const r = td.getBoundingClientRect(); return { cle: i.dataset.ir, x: r.x + r.width / 2, y: r.y + r.height * f, w: r.width, tr: td.parentElement.getBoundingClientRect().height }; }, f);
        await p.mouse.click(g.x, g.y); await wait(120);
        const a = await p.evaluate(cle => { const i = document.querySelector(`input[data-ir="${cle}"]`), r = i.getBoundingClientRect(), td = i.closest("td").getBoundingClientRect();
          const e = document.elementFromPoint(r.right - 6, r.y + r.height / 2);
          return { act: document.activeElement === i, w: r.width, h: r.height, tdh: td.height, visible: e === i, tr: i.closest("tr").getBoundingClientRect().height }; }, g.cle);
        ok(a.act, `${w} px, ${no} objectif(s) : clic ${nom} de la case → la remarque s'écrit`);
        if (a.act && f === .5) { ok(a.w >= 200 && a.visible, `${w} px, ${no} objectif(s) : le champ s'élargit et n'est pas coupé ${JSON.stringify(a)}`);
          ok(Math.abs(a.tr - g.tr) < 1, `${w} px, ${no} objectif(s) : la ligne garde sa hauteur`); }
      }
      // chaque jour de la fiche : le champ élargi reste dans la feuille
      const cles = await p.evaluate(() => { document.activeElement.blur(); const vus = {}; document.querySelectorAll("input[data-ir]").forEach(i => { const d = i.dataset.ir.split(".")[1]; vus[d] = vus[d] || i.dataset.ir; }); return Object.values(vus); });
      const hors = [];
      for (const cle of cles) {
        const d = await p.evaluate(cle => { document.activeElement.blur(); const td = document.querySelector(`input[data-ir="${cle}"]`).closest("td"); td.scrollIntoView({ block: "center" }); const r = td.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, cle);
        await p.mouse.click(...d); await wait(60);
        const z = await p.evaluate(cle => { const i = document.querySelector(`input[data-ir="${cle}"]`), r = i.getBoundingClientRect(), s = i.closest(".sheet").getBoundingClientRect(), y = r.y + r.height / 2;
          return { cle, act: document.activeElement === i, dep: Math.round(r.right - s.right), w: r.width, visible: document.elementFromPoint(r.right - 6, y) === i && document.elementFromPoint(r.x + 6, y) === i }; }, cle);
        if (!(z.act && z.dep <= 0 && z.w >= 200 && z.visible)) hors.push(z);
      }
      ok(cles.length >= 4 && !hors.length, `${w} px, ${no} objectif(s) : champ élargi entier dans la feuille, chaque jour (${cles.length}) ${JSON.stringify(hors)}`);
    }
    // écrire, enregistrer, relire
    const cle = await p.evaluate(() => { document.activeElement.blur(); const i = [...document.querySelectorAll("input[data-ir]")].find(x => !x.value), td = i.closest("td"); td.scrollIntoView({ block: "center" }); return i.dataset.ir; });
    const c = await p.evaluate(k => { const r = document.querySelector(`input[data-ir="${k}"]`).closest("td").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * .8]; }, cle);
    await p.mouse.click(...c); await p.keyboard.type("Oubli de cahier"); await wait(150);
    ok(await p.evaluate(k => { const [i, d, n] = k.split("."); const s = S.individuels[i].saisies[`${d}.${n}`]; return !!s && s.r === "Oubli de cahier"; }, cle), "la remarque tapée après un clic en bas de la case est enregistrée");
    await p.keyboard.press("Escape"); await wait(120);
    ok(await p.evaluate(() => !!document.activeElement.dataset.ic), "Échap : retour aux cases du cours");
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5 }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
