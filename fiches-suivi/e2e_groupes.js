const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1366, height: 900 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(400); };
  // modèle
  const m = await p.evaluate(() => { const sems = semaines(S), cr = creneau(S, sems, "2026-11-23", 3);
    return { lib: cr.mat, g1: coursPour(cr, ["Groupe 1"]).mat, g2: coursPour(cr, ["Groupe 2", "Latin"]).mat, aucun: coursPour(cr, []).mat, latin: coursPour(creneau(S, sems, "2026-11-18", 3), ["Groupe 1"]).mat, latin2: coursPour(creneau(S, sems, "2026-11-18", 3), ["Latin"]).mat }; });
  console.log(JSON.stringify(m));
  ok(m.lib === "Physique-Chimie (Groupe 1) / SVT (Groupe 2)" && m.g1 === "Physique-Chimie" && m.g2 === "SVT" && m.aucun === "" && m.latin === "" && m.latin2 === "Latin", "créneau partagé : libellé pour la classe, cours de chaque groupe, option latin");
  // fiche collective : élève pas latiniste → case hachurée le mercredi M4
  await go("#fiche/2026-11-18");
  const f = await p.evaluate(() => { const nb = S.eleves.map((e, s) => groupesDe(S, e.nom)); return { hors: document.querySelectorAll("table.fiche td.c.hors").length, latin: S.eleves.filter(e => (groupesDe(S, e.nom) || []).includes("Latin")).length, n: S.eleves.length, actifsLatin: S.eleves.filter((e, s) => eleveActif(S, s, "2026-11-18")).length }; });
  console.log(JSON.stringify(f));
  ok(f.hors > 0 && f.hors % 4 === 0, `fiche collective du mercredi : cases hachurées pour les non-latinistes en M4 (${f.hors} cases)`);
  // fiche de classe : hachures
  const nonLat = await p.evaluate(() => S.classeEleves.filter(e => !(e.groupes || []).includes("Latin")).length);
  await go("#classesem/3");
  ok(await p.evaluate(() => document.querySelectorAll("table.cs td.hors").length) === nonLat, "fiche de classe (semaine 47, B) : latin du mercredi hachuré pour les " + nonLat + " non-latinistes");
  await go("#classesem/4");
  const c2 = await p.evaluate(() => [document.querySelectorAll("table.cs td.hors").length, [...document.querySelectorAll("table.cs td.cs-mat")].map(t => t.textContent).filter(t => t.includes(" / ")).join(" | ")]);
  ok(c2[0] === nonLat && /Phys\.-Chimie \/ SVT/.test(c2[1]), "semaine 48 (A) : demi-groupes de sciences sans hachure (chacun a cours), matières « Phys.-Chimie / SVT » " + JSON.stringify(c2));
  // fiche individuelle : BRIDGE (Groupe 1, Latin) → Phys.-Chimie en M4 le lundi A, Latin le mercredi
  await go("#indiv/demo-bridge:2026-11-27");
  const ind = await p.evaluate(() => [...document.querySelectorAll("table.indiv td.mat")].map(t => t.textContent).join("|"));
  ok(/Phys\.-Chimie/.test(ind) && /Latin/.test(ind), "fiche individuelle de BRIDGE : ses propres cours (Phys.-Chimie de son groupe, Latin)");
  // réglages : rubrique groupes
  await go("#reglages/groupes");
  ok(await p.evaluate(() => location.hash === "#reglages/groupes" && document.querySelector(".rub a.on b").textContent === "Élèves et groupes" && document.querySelectorAll(".liste.lcl .lrow").length === 26 && document.querySelectorAll(".liste.lcl .lrow:first-child input[data-grel]").length === 3 && document.querySelectorAll(".lhead.lcl [data-grcol]").length === 3), "Réglages › Élèves et groupes (ancienne adresse #reglages/groupes) : 26 élèves, 3 cases de groupe par ligne · Groupes et options : 26 élèves × 3 groupes");
  await p.click('input[data-grel="0"][data-g="Latin"]'); await wait(300);
  ok(await p.evaluate(() => S.classeEleves[0].groupes.includes("Latin")), "cocher Latin pour un élève");
  await p.$eval('input[data-path="groupes.2.nom"]', i => { i.value = "Option latin"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.classeEleves[0].groupes.includes("Option latin") && S.edt.A[2][3].grp[0].g === "Option latin"), "renommer le groupe : élèves et emploi du temps suivent");
  await p.click('[data-grcol="Groupe 1"]'); await wait(300);
  ok(await p.evaluate(() => S.classeEleves.every(e => (e.groupes || []).filter(estDemiGroupe).length <= 1) && /demi-groupe/.test(document.querySelector("#toast").textContent)), "clic sur la colonne Groupe 1 : aucun élève dans deux demi-groupes, le message le dit");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  // emploi du temps : peindre pour un groupe
  await go("#edt");
  await p.click('[data-vue-edt="A"]'); await wait(200);
  ok(await p.evaluate(() => document.querySelectorAll("td.ec.divise").length === 3), "emploi du temps (semaine A) : 3 créneaux partagés affichés");
  await p.click('[data-pin="Anglais"]'); await wait(150); await p.click('[data-pin-gr="Groupe 2"]'); await wait(150);
  await p.click('td[data-ec="A.1.5"]'); await wait(300);
  ok(await p.evaluate(() => JSON.stringify(S.edt.A[1][5]) === JSON.stringify({ mat: "", salle: "", grp: [{ g: "Groupe 2", mat: "Anglais", salle: "" }] })), "pinceau « Anglais » pour Groupe 2 sur un créneau vide : créneau partagé " + await p.evaluate(() => JSON.stringify(S.edt.A[1][5])));
  await p.click('td[data-ec="A.1.5"]'); await wait(300);
  ok(await p.evaluate(() => !S.edt.A[1][5].grp && !S.edt.A[1][5].mat), "2e clic : le cours du groupe est retiré");
  await p.click('[data-pin-gr=""]'); await wait(150); await p.click('td[data-ec="A.0.3"]'); await wait(300);
  ok(await p.evaluate(() => S.edt.A[0][3].mat === "Anglais" && !S.edt.A[0][3].grp), "« Toute la classe » sur un créneau partagé : remplacé pour tous");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: DIR + "/sorties/groupes-edt.png" });
  await go("#reglages/groupes"); await p.screenshot({ path: DIR + "/sorties/groupes-reg.png" });
  // suppression d'un groupe
  await go("#reglages/groupes"); await p.click('[data-del="groupes.0"]'); await wait(400);
  ok(await p.evaluate(() => S.groupes.length === 2 && !S.classeEleves.some(e => (e.groupes || []).includes("Groupe 1")) && !JSON.stringify(S.edt).includes("Groupe 1")) && msgs.some(x => x.includes("Supprimer le groupe")), "supprimer Groupe 1 : confirmation, retiré des élèves et de l’emploi du temps");
  // aller-retour JSON
  const rt = await p.evaluate(() => JSON.stringify(normalizeState(JSON.parse(JSON.stringify(S)))) === JSON.stringify(S));
  ok(rt, "les groupes se relisent à l’identique");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
