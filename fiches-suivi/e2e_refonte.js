const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs, reponse: () => "SAUMON Léa\nTRUITE Max\n\nCARPE Noé" }); await p.setViewport({ width: 1366, height: 900 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };
  const ctr = sel => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  // --- réglages ---
  await go("#reglages");
  ok(await p.$eval(".rub a.on b", e => e.textContent) === "Établissement, classe et référent" && (await p.$$(".rub a")).length === 10, "Réglages : 10 rubriques, « Établissement, classe et référent » ouverte par défaut");
  await p.click('.rub a[href="#reglages/eleves"]'); await wait(300);
  ok(await p.evaluate(() => location.hash === "#reglages/eleves" && document.querySelectorAll(".el-carte").length === 6), "clic sur « Élèves » : 6 cartes d’élèves");
  // dates : le réglage reste ouvert après une modification
  await p.click('.el-carte:nth-child(2) details.el-dates summary'); await wait(150);
  await p.$eval('input[data-path="eleves.1.debut"]', i => { i.value = "2026-11-02"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.eleves[1].debut === "2026-11-02" && document.querySelector('details.el-dates[data-eld="1"]').open && document.querySelector('details.el-dates[data-eld="1"] summary').textContent.includes("à partir du 02/11")), "date de début : enregistrée, réglage resté ouvert, badge « à partir du 02/11 »");
  await p.mouse.click(5, 5); await wait(150);
  // glisser la carte 6 en 1re position
  const de = await ctr('.el-carte:nth-child(6) .poignee'), vers = await ctr('.el-carte:nth-child(1)');
  await p.mouse.move(...de); await p.mouse.down(); await p.mouse.move(vers[0], vers[1], { steps: 8 }); await p.mouse.up(); await wait(300);
  ok(await p.evaluate(() => S.eleves[0].nom === "DA PONTE Mikhaïl" && S.eleves[1].nom === "DEL PONTE Michele"), "glisser la carte de DA PONTE en tête : ordre modifié");
  ok(await p.evaluate(() => { const x = Object.keys(S.jours["2026-11-16"].x).filter(k => k.startsWith("0.")).length; return x > 0; }), "les croix ont suivi l’élève déplacé");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  ok(await p.evaluate(() => S.eleves[0].nom === "DEL PONTE Michele"), "Ctrl+Z annule le déplacement");
  // coller une liste
  await p.click('[data-act="el-coller"]'); await wait(500);
  ok(await p.evaluate(() => S.eleves.length === 9 && S.eleves[8].nom === "CARPE Noé"), "« Coller une liste » : 3 élèves ajoutés (ligne vide ignorée)");
  // calendrier : forcer une semaine
  await go("#reglages/calendrier");
  const avant = await p.evaluate(() => semaines(S).map(w => w.type).join(""));
  await p.click('button[data-cal="2026-11-16"]'); await wait(300);
  const apres = await p.evaluate(() => [semaines(S).map(w => w.type).join(""), S.typesForces["2026-11-16"], document.querySelector('button[data-cal="2026-11-16"]').classList.contains("force")]);
  ok(apres[1] === "A" && apres[0] !== avant && apres[2], `calendrier : clic sur S47 → forcée en A, les suivantes s’adaptent (${avant} → ${apres[0]})`);
  await p.click('button[data-cal="2026-11-16"]'); await wait(300);
  ok(await p.evaluate(a => semaines(S).map(w => w.type).join("") === a && !S.typesForces["2026-11-16"], avant), "second clic : retour à l’alternance automatique");
  ok(await p.$eval('button[data-cal="2026-11-09"]', b => b.classList.contains("f")), "semaine du 11 novembre : point « jour sans cours »");
  // matières : enseignant manquant signalé
  await p.evaluate(() => { S.matieres.find(m => m.nom === "Allemand").prof = ""; commit(); }); await go("#reglages/matieres");
  ok(await p.evaluate(() => document.querySelector('.rub a[href="#reglages/matieres"] .etat').classList.contains("at") && !!document.querySelector("input.manque")), "matière utilisée sans enseignant : « ! » dans le menu et champ signalé");
  // --- emploi du temps ---
  await go("#edt");
  await p.click('[data-vue-edt="A"]'); await wait(200);
  await p.click('[data-pin="Latin"]'); await wait(200);
  await p.type("#pin-salle", "107");
  const c1 = await ctr('td[data-ec="A.2.4"]'), c2 = await ctr('td[data-ec="A.2.6"]');
  await p.mouse.move(...c1); await p.mouse.down(); await p.mouse.move(c2[0], c2[1], { steps: 10 }); await p.mouse.up(); await wait(300);
  ok(await p.evaluate(() => [4, 5, 6].every(k => S.edt.A[2][k].mat === "Latin" && S.edt.A[2][k].salle === "107")), "pinceau « Latin », salle 107 : glisser sur mercredi S1→S3 remplit 3 créneaux");
  await p.mouse.click(...c1); await wait(300);
  ok(await p.evaluate(() => S.edt.A[2][4].mat === ""), "second clic sur un créneau identique : vidé");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  ok(await p.evaluate(() => S.edt.A[2][4].mat === "Latin"), "Ctrl+Z rétablit le créneau");
  await p.click('[data-pin=""]'); await wait(200); await p.mouse.click(...(await ctr('td[data-ec="A.2.5"]'))); await wait(300);
  ok(await p.evaluate(() => S.edt.A[2][5].mat === "" && S.edt.A[2][5].salle === ""), "gomme : créneau vidé");
  await p.keyboard.press("Escape"); await wait(200);
  await p.mouse.click(...(await ctr('td[data-ec="A.0.0"]'))); await wait(300);
  ok(await p.evaluate(() => pinceau && pinceau.mat === "Français" && pinceau.salle === "007" && document.querySelector("#pin-salle").value === "007"), "sans pinceau, clic sur un cours : sa matière et sa salle deviennent le pinceau (pipette)");
  await p.click('[data-vue-edt="AB"]'); await wait(300);
  ok(await p.evaluate(() => document.querySelectorAll("table.edt2.compact").length === 2 && document.querySelectorAll("table.edt2 td.dif").length > 0), "« A et B côte à côte » : deux grilles, différences encadrées");
  await p.reload(); await wait(400); await go("#edt");
  ok(await p.evaluate(() => vueEdt === "AB"), "l’onglet choisi est retenu");
  // horaires
  await p.$eval('input[data-hor="0.debut"]', i => { i.value = "08:05"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  const h = await p.evaluate(() => [S.horaires[0].debut, ficheHTML("2026-10-12", false).includes("8h05")]);
  ok(h[0] === "08:05" && h[1], "horaire de M1 enregistré et imprimé sur la fiche du jour (8h05)");
  // accessibilité clavier : Entrée sur un créneau
  await p.evaluate(() => { pinceau = { mat: "SVT", salle: "Sc2" }; render(); });
  await p.focus('td[data-ec="B.3.6"]'); await p.keyboard.press("Enter"); await wait(300);
  ok(await p.evaluate(() => S.edt.B[3][6].mat === "SVT" && document.activeElement.dataset.ec === "B.3.6"), "au clavier : Entrée pose la matière, le focus reste sur le créneau");
  await p.screenshot({ path: DIR + "/sorties/edt-test.png" });
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); })();
