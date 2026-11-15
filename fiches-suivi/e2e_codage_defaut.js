// Codes des niveaux (v1.87.0) : TB · B · I · TI proposés par défaut ; un suivi existant garde son codage ;
// « Revenir au codage proposé » dit ce qu'il fait, ne touche ni aux saisies (rangées par niveau) ni aux seuils, et s'annule par Ctrl+Z.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; let accepter = true; await require("./boites")(p, { messages: msgs, decide: () => accepter }); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };

  ok(await p.evaluate(() => newState().codage.map(c => c.code + "=" + c.sens).join(" | ") === "TB=Très bien | B=Bien | I=Insuffisant | TI=Très insuffisant"), "nouveau suivi : TB Très bien · B Bien · I Insuffisant · TI Très insuffisant");
  ok(await p.evaluate(() => { const vieux = [["TB", "Très bien"], ["S", "Satisfaisant"], ["À", "À améliorer"], ["I", "Insuffisant"]].map(([code, sens]) => ({ code, sens }));
    return normalizeState({ codage: vieux }).codage.map(c => c.code).join() === "TB,S,À,I"; }), "suivi existant : il garde son codage");

  await p.evaluate(() => doDemo()); await wait(200);
  // un suivi à l'ancien codage, avec des saisies
  const avant = await p.evaluate(() => { S.codage = [["TB", "Très bien"], ["S", "Satisfaisant"], ["À", "À améliorer"], ["I", "Insuffisant"]].map(([code, sens]) => ({ code, sens })); S.seuils.rouge = 41; commit();
    return { saisies: JSON.stringify(S.individuels.map(i => i.saisies)), x: JSON.stringify(S.jours) }; });
  await go("#reglages/pastilles");
  ok(await p.evaluate(() => { const bt = document.querySelector('[data-act="codage-defaut"]'); return !!bt && !bt.disabled && /TB Très bien · B Bien · I Insuffisant · TI Très insuffisant/.test(bt.closest(".row").innerText); }), "bouton « Revenir au codage proposé », le codage proposé écrit à côté");
  ok(await p.evaluate(() => /les codes déjà saisis ne changent pas/.test(document.querySelector('[data-act="codage-defaut"]').getAttribute("data-tip") || document.querySelector('[data-act="codage-defaut"]').title)), "infobulle : ce que fait le bouton");
  // refus : rien ne change
  accepter = false; await p.click('[data-act="codage-defaut"]'); await wait(400); accepter = true;
  const m = msgs[msgs.length - 1] || "";
  ok(/TB, S, À, I|TB · S · À · I/.test(m) && /4 : TB — Très bien/.test(m) && /1 : TI — Très insuffisant/.test(m) && /ancien « À » devient « I »/.test(m) && /seuils des pastilles ne changent pas/.test(m), "confirmation : ancien et nouveau codage, ce que deviennent les codes saisis, les seuils intacts");
  ok(await p.evaluate(() => S.codage[1].code === "S"), "Annuler : codage inchangé");
  await p.click('[data-act="codage-defaut"]'); await wait(400);
  const apres = await p.evaluate(() => ({ codes: S.codage.map(c => c.code).join(), saisies: JSON.stringify(S.individuels.map(i => i.saisies)), x: JSON.stringify(S.jours), rouge: S.seuils.rouge, dis: document.querySelector('[data-act="codage-defaut"]').disabled }));
  ok(apres.codes === "TB,B,I,TI", "Remplacer : TB, B, I, TI");
  ok(apres.saisies === avant.saisies && apres.x === avant.x, "saisies intactes (fiches individuelles et collectives)");
  ok(apres.rouge === 41, "seuils intacts");
  ok(apres.dis, "codage proposé en place : bouton grisé");
  ok(await p.evaluate(() => { S.retenueIndiv = { i: 2, heures: 1, nonRendue: 0, max: 2 }; return regleRetenueIndiv(S.individuels[0]).startsWith("2 « TI »"); }), "la règle de retenue parle du niveau le plus bas : « TI »");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  ok(await p.evaluate(() => S.codage.map(c => c.code).join() === "TB,S,À,I"), "Ctrl+Z : l'ancien codage revient");
  await p.screenshot({ path: DIR + "/sorties/codage-defaut.png" });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
