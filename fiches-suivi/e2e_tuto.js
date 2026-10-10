const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); await require("./boites")(p, {}); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(300);
  ok(await p.evaluate(() => !!document.querySelector('.tuto-accueil [data-act="tuto"]')), "accueil : « Suivre le tutoriel »");
  await p.click('.tuto-accueil [data-act="tuto"]'); await wait(800);
  const r0 = await p.evaluate(() => ({ demo: !!(S && S.demo), bulle: !document.querySelector("#tuto-bulle").hidden, titre: document.querySelector("#tuto-bulle h3").textContent }));
  ok(r0.demo && r0.bulle && r0.titre === "Bienvenue", "départ : démonstration chargée, bulle « Bienvenue »");
  await p.screenshot({ path: DIR + "/sorties/tuto-1.png" });
  // parcourir tous les chapitres
  const absents = [], vus = [];
  for (let k = 0; k < 60; k++) {
    const e = await p.evaluate(() => { const h = document.querySelector("#tuto-bulle h3"), t = document.querySelector("#tuto-trou").getBoundingClientRect(), bu = document.querySelector("#tuto-bulle").getBoundingClientRect();
      const recouvre = !document.querySelector("#tuto-trou").classList.contains("plein") && !(bu.right <= t.left || bu.left >= t.right || bu.bottom <= t.top || bu.top >= t.bottom);
      return { t: h ? h.textContent : "", ch: tuto ? tuto.ch : -1, i: tuto ? tuto.i : -1, absent: !!document.querySelector("#tuto-bulle .tb-absent"), hash: location.hash, dedans: bu.left >= 0 && bu.top >= 0 && bu.right <= innerWidth && bu.bottom <= innerHeight, recouvre, tw: t.width };
    });
    vus.push(e); if (e.absent) absents.push(`${e.ch}.${e.i} ${e.t} (${e.hash})`);
    if (!e.dedans) absents.push("bulle hors écran : " + e.t);
    if (k === 7) await p.screenshot({ path: DIR + "/sorties/tuto-2.png" });
    if (k === 13) await p.screenshot({ path: DIR + "/sorties/tuto-3.png" });
    const btn = await p.$('#tuto-bulle [data-tuto="suiv"]') || await p.$('#tuto-bulle [data-tuto="chap"]');
    if (!btn) break;
    await btn.click(); await wait(350);
  }
  const total = await p.evaluate(() => TUTO.reduce((a, c) => a + c.etapes.length, 0));
  ok(vus.length === total, `toutes les étapes parcourues avec « Suivant » / « Chapitre suivant » (${vus.length} sur ${total})`);
  ok(!absents.length, "chaque étape éclaire son élément, bulle dans l’écran " + absents.join(" | "));
  const rec = vus.filter(v => v.recouvre).map(v => v.t);
  console.log("bulle sur la cible (grandes cibles) :", rec.join(" | "));
  await p.click('#tuto-bulle [data-tuto="fin"]'); await wait(200);
  ok(await p.evaluate(() => document.querySelector("#tuto-bulle").hidden && !localStorage.getItem(LS_KEY + "-tuto")), "« Terminer » : la bulle disparaît");
  // reprendre où on en était
  await p.evaluate(() => { allerEtape(2, 3); }); await wait(400);
  await p.keyboard.press("Escape"); await wait(200);
  ok(await p.evaluate(() => document.querySelector("#tuto-bulle").hidden && JSON.parse(localStorage.getItem(LS_KEY + "-tuto")).i === 3), "Échap : tutoriel interrompu, progression gardée");
  await p.click("#m-file summary"); await wait(150); await p.click("#b-tuto"); await wait(600);
  ok(await p.evaluate(() => tuto && tuto.ch === 2 && tuto.i === 3 && !document.querySelector("#tuto-bulle").hidden), "Fichier › Tutoriel : « Reprendre où j’en étais » proposé par défaut");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
