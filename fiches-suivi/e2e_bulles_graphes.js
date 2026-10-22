// (Espaces fines insécables : la fiche les ajoute à l'affichage, typoFr — d'où les \s des expressions.)
// Infobulles des GRAPHIQUES (barres, points de courbe : un <title> SVG) : c'était le navigateur qui les affichait, avec un fond
// parfois transparent sous Linux (texte blanc sur page claire). Elles passent maintenant par la bulle de l'appli, comme les title.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p); await p.setViewport({ width: 1366, height: 900 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); location.hash = "#classesuivi"; }); await wait(600);
  const etat = () => p.evaluate(() => { const bl = document.querySelector("#bulle"), cs = getComputedStyle(bl);
    return { on: bl.classList.contains("on"), texte: bl.textContent, fond: cs.backgroundColor, encre: cs.color }; });
  // 1. Une barre du graphique des incidents par semaine (fiches de classe).
  const barre = await p.$("svg rect title") ? await p.evaluateHandle(() => document.querySelector("svg rect title").parentNode) : null;
  ok(!!barre, "une barre porte un <title> SVG (#classesuivi)");
  if (barre) {
    await p.mouse.move(1, 1); await wait(120);
    await barre.hover(); await wait(550);
    const r = await etat();
    ok(r.on && /^Semaine\s\d+\s:\s\d+\sincidents?\spour\sla\sclasse/.test(r.texte), `barre : la bulle de l'appli s'affiche (« ${r.texte.slice(0, 50)} »)`);
    const el = await p.evaluate(e => ({ titre: !!e.querySelector("title"), tip: e.dataset.tip || "", aria: e.getAttribute("aria-label") || "" }), barre);
    ok(!el.titre && /^Semaine/.test(el.tip), "le <title> est passé dans data-tip : le navigateur n'affiche plus la sienne");
    ok(/^Semaine\s\d+\s:\s/.test(el.aria), `le nom accessible reste (aria-label « ${el.aria} »)`);
    ok(r.fond === "rgb(31, 36, 48)" && r.encre === "rgb(243, 245, 248)", `thème clair : bulle sombre, texte clair (${r.fond} / ${r.encre})`);
    // Second survol : la même bulle (le texte est gardé dans data-tip).
    await p.mouse.move(1, 1); await wait(150); await barre.hover(); await wait(550);
    ok((await etat()).on, "second survol : la bulle revient");
  }
  // 2. Un point de courbe (cercle) en thème sombre.
  await p.evaluate(() => { document.documentElement.dataset.theme = "sombre";
    const d = document.createElement("div"); d.style.cssText = "position:fixed;left:400px;top:400px;z-index:5";
    d.innerHTML = '<svg width="40" height="40"><circle id="pt-essai" cx="20" cy="20" r="8" fill="#1f5f9e"><title>Fiche du 13/10 : 75 %\nClic : la fiche</title></circle></svg>';
    document.body.appendChild(d); });
  await p.mouse.move(1, 1); await wait(120); await p.hover("#pt-essai"); await wait(550);
  const r2 = await etat();
  ok(r2.on && /^Fiche\sdu\s13\/10\s:\s75\s%/.test(r2.texte), `point de courbe : bulle de l'appli (« ${r2.texte} »)`);
  ok(r2.fond === "rgb(241, 243, 247)" && r2.encre === "rgb(27, 31, 39)", `thème sombre : bulle claire, texte sombre (${r2.fond} / ${r2.encre})`);
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
