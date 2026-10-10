// Retours de l'utilisateur après l'audit 4 : menu au survol, logo partout, bulle déplaçable, trimestres/semestres
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs");
const D = __dirname, ok = (c, m) => console.log((c ? "OK    " : "ÉCHEC ") + m), att = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(D + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require(D + "/boites.js")(p, { messages: [] });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1024, height: 768 });
  await p.goto("file://" + D + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await att(300); await p.evaluate(() => { location.hash = "#totaux"; }); await att(400);
  // 1. menu réduit : le survol l'ouvre par-dessus, sans décaler la page
  const x0 = await p.evaluate(() => document.querySelector("main").getBoundingClientRect().left);
  await p.mouse.move(30, 300); await att(600);
  let r = await p.evaluate(() => [document.documentElement.classList.contains("survol"), document.querySelector(".side").getBoundingClientRect().width, document.querySelector("main").getBoundingClientRect().left]);
  ok(r[0] && r[1] > 200 && r[2] === x0, "menu réduit : ouvert au survol par-dessus la page " + JSON.stringify([x0, ...r]));
  await p.mouse.move(700, 400); await att(600);
  ok(await p.evaluate(() => document.documentElement.classList.contains("rail")), "menu : se referme quand la souris en sort");
  // 2. logo : marge haute des documents, dans la page des fiches à cocher s'il y a la place
  r = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 300; c.height = 100; c.getContext("2d").fillRect(0, 0, 300, 100);
    S.etablissement = { nom: "Collège Les Tilleuls, Villeneuve", logo: c.toDataURL("image/png") }; render(); return true; }); await att(400);
  r = await p.evaluate(() => { const tot = pagesAvecEtab([totauxHTML ? "<div>totaux</div>" : ""]), st = document.getElementById("style-etab-marge").textContent;
    return [/etab-marge/.test(tot), /image-set\(/.test(st) && /Collège Les Tilleuls/.test(st), /etab-tete/.test(ficheHTML("2026-11-18", false)), /etab-tete/.test(classeSemaineHTML(5, false))]; });
  ok(r[0] && r[1], "logo et nom dans la marge haute des documents (totaux, bilans…) " + JSON.stringify(r));
  ok(r[2] && r[3], "fiche collective et fiche de classe : logo dans la page quand il y a la place");
  // 3. trimestres / semestres
  r = await p.evaluate(() => { S.anneeScolaire = 2026; S.decoupage = { mode: "trimestres", fins: ["2026-11-20", ""] }; const pa = periodesAnnee(S); S.decoupage = { mode: "semestres", fins: [] }; const ps = periodesAnnee(S); return [pa.map(x => x.lib + ":" + x.au).join(","), ps.map(x => x.lib + ":" + x.au).join(",")]; });
  ok(/1er trimestre:2026-11-20/.test(r[0]) && /3e trimestre/.test(r[0]) && /1er semestre:2027-01-29/.test(r[1]), "trimestres (date corrigée) et semestres (dernier vendredi de janvier) " + JSON.stringify(r));
  r = await p.evaluate(() => { S.decoupage = { mode: "trimestres", fins: ["2026-11-13", ""] }; return periodesBilan(semaines(S)).map(x => x[0]).join(", "); });
  ok(/1er trimestre/.test(r) && /2e trimestre/.test(r), "raccourcis de période : 1er et 2e trimestre — " + r);
  // 4. bulle du tutoriel déplaçable
  await p.evaluate(() => allerEtape(4, 7)); await att(600);
  const t0 = await p.evaluate(() => { const r = document.querySelector("#tuto-bulle .tb-tete").getBoundingClientRect(); return [r.left + 60, r.top + 8]; });
  await p.mouse.move(t0[0], t0[1]); await p.mouse.down(); await p.mouse.move(t0[0] - 400, t0[1] - 250, { steps: 6 }); await p.mouse.up(); await att(200);
  r = await p.evaluate(() => { const r = document.querySelector("#tuto-bulle").getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; });
  ok(Math.abs(r[0] - (t0[0] - 400 - 60)) < 30, "bulle du tutoriel déplacée en la glissant par son bandeau " + JSON.stringify([t0, r]));
  // 5. totaux de 12 élèves : deux pages de 6, le groupe à la fin ; rouge et orange cadrés
  r = await p.evaluate(() => { const noms = S.classeEleves.map(e => e.nom).filter(n => !S.eleves.some(x => x.nom === n)); while (S.eleves.length < 12) S.eleves.push({ nom: noms.shift(), debut: "", fin: "" });
    const pg = pagesTotaux(1), n = h => (h.match(/<tbody class="(imp)?( inactif)?">/g) || []).length; const st = [...document.styleSheets].flatMap(x => [...x.cssRules]).map(x => x.cssText).join(" ");
    return [pg.length, n(pg[0]), n(pg[1]), /class="grp"/.test(pg[0]), /class="grp"/.test(pg[1]), /outline: 1\.6px solid/.test(st) && /outline: 1\.2px dashed/.test(st)]; });
  ok(r[0] === 2 && r[1] === 6 && r[2] === 6 && !r[3] && r[4], "totaux de 12 élèves : deux pages de 6, le groupe à la fin " + JSON.stringify(r));
  ok(r[5], "pastilles : cadre plein (rouge), pointillé (orange)");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
