// Corrections de l'audit 6
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs");
const D = __dirname, ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m), att = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox", "--lang=fr-FR"] });
  const p = await b.newPage(); let refuser = false; await require(D + "/boites.js")(p, { messages: [], decide: () => !refuser });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1024, height: 768 });
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await att(300);
  // 1. logo dans la marge : l'image préparée n'est pas vide
  let r = await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 200; c.height = 100; const g = c.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(0, 0, 200, 100);
    S.etablissement = { nom: "Collège", logo: c.toDataURL("image/png") }; render(); await new Promise(r => setTimeout(r, 400));
    const im = new Image(); im.src = logoMarge.png; await im.decode(); const k = document.createElement("canvas"); k.width = im.width; k.height = im.height; const g2 = k.getContext("2d"); g2.drawImage(im, 0, 0);
    return g2.getImageData(Math.floor(im.width / 2), Math.floor(im.height / 2), 1, 1).data[3]; });
  ok(r > 0, "logo de la marge : l’image est bien dessinée (opacité " + r + ")");
  // 2. absence longue refusée : rien n'est gardé
  await p.evaluate(() => { location.hash = "#reglages/matieres"; }); await att(300);
  await p.evaluate(() => { S.absencesProf.push({ prof: "M. BROCHET", du: "", au: "", remplacant: "" }); render(); }); await att(300);
  const i = await p.evaluate(() => S.absencesProf.length - 1);
  await p.click(`input[data-path="absencesProf.${i}.du"]`); await p.keyboard.type("16112026", { delay: 40 }); await p.keyboard.press("Tab"); await att(300);
  refuser = true; await p.click(`input[data-path="absencesProf.${i}.au"]`); await p.keyboard.type("20112026", { delay: 40 }); await p.mouse.click(700, 100); await att(500); refuser = false;
  r = await p.evaluate(i => S.absencesProf[i].au, i);
  ok(r === "", "absence longue : « Annuler » à la question d’effacement rétablit l’ancienne date (" + JSON.stringify(r) + ")");
  // 3. premier jour vidé : refusé, la page reste affichable
  await p.evaluate(() => { location.hash = "#reglages/calendrier"; }); await att(400);
  const d0 = await p.evaluate(() => S.debut);
  await p.evaluate(() => { const t = document.querySelector('input[data-path="debut"]'); t.value = ""; t.dispatchEvent(new Event("change", { bubbles: true })); }); await att(300);
  ok(await p.evaluate(() => S.debut) === d0 && await p.evaluate(() => !/Affichage impossible/.test(document.querySelector("#view").textContent)), "premier jour vidé : refusé, la page reste affichable");
  // 4. période par défaut : 1er semestre jusqu'à la 3e semaine du 2e
  r = await p.evaluate(() => { const a0 = window.aujourdhui; S.debut = "2026-09-01"; S.fin = "2027-07-02"; S.decoupage = { mode: "semestres", fins: [] }; const sems = semaines(S);
    window.aujourdhui = () => "2027-02-03"; const x = periodeSynthDefaut(sems); window.aujourdhui = () => "2027-03-10"; const y = periodeSynthDefaut(sems); window.aujourdhui = a0; return [sems[x[1]].num, sems[y[0]].num]; });
  ok(r[0] === 4 && r[1] === 5, "synthèse : 1er semestre proposé début février, 2e semestre en mars " + JSON.stringify(r));
  // 5. totaux à 8 objectifs et 12 élèves : pages équilibrées
  r = await p.evaluate(() => { const o = S.objectifs; while (S.objectifs.length < 8) S.objectifs.push({ court: "Obj", desc: "" }); const noms = S.classeEleves.map(e => e.nom).filter(n => !S.eleves.some(x => x.nom === n)); while (S.eleves.length < 12) S.eleves.push({ nom: noms.shift(), debut: "", fin: "" });
    S = normalizeState(S); const pg = pagesTotaux(1); return pg.map(h => (h.match(/<tbody class="(imp)?( inactif)?">/g) || []).length + "|" + (h.match(/\((\d)\/(\d)\)/) || [""])[0]); });
  ok(r.length >= 3 && r.every(x => Number(x.split("|")[0]) >= 3), "totaux 8 objectifs × 12 élèves : pages équilibrées " + JSON.stringify(r));
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
