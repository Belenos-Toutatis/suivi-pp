const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const browser = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 1300 });
  const dialogs = []; let reponse = null;
  await require("./boites")(page, { messages: dialogs, reponse: () => reponse });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(APP); await page.evaluate(() => localStorage.clear()); await page.goto(APP + "#sommaire");
  await page.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await page.evaluate(h => { location.hash = h; }, h); await wait(250); };

  // 1. date tapée au clavier
  await go("#reglages/eleves");
  await page.click('details.el-dates[data-eld="0"] summary'); await wait(150);
  await page.focus('input[data-path="eleves.0.fin"]'); await page.keyboard.type("20112026"); await page.keyboard.press("Tab"); await wait(200);
  ok((await page.evaluate(() => S.eleves[0].fin)) === "2026-11-20", "date tapée au clavier « 20112026 » → " + await page.evaluate(() => S.eleves[0].fin));
  await page.evaluate(() => { S.eleves[0].fin = ""; commit(); });

  // 2. renommer / supprimer une matière
  await go("#reglages/matieres");
  await page.evaluate(() => { const i = S.matieres.findIndex(m => m.nom === "Mathématiques"); const el = document.querySelector(`input[data-path="matieres.${i}.nom"]`); el.value = "Maths"; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await wait(100);
  ok(await page.evaluate(() => S.edt.A[0][1].mat === "Maths" && creneau(S, semaines(S), "2026-10-12", 1).prof === "M. BROCHET"), "renommer « Mathématiques » en « Maths » : emploi du temps et enseignant suivent");
  dialogs.length = 0;
  await page.evaluate(() => { const i = S.matieres.findIndex(m => m.nom === "SVT"); document.querySelector(`button[data-del="matieres.${i}"]`).click(); });
  ok(dialogs.some(m => m.includes("est utilisée")), "supprimer une matière utilisée : confirmation demandée");

  // 3. annuler / rétablir
  await go("#fiche/2026-10-12");
  await page.evaluate(() => { delete S.jours["2026-10-12"]; commit(); });
  await page.click('td[data-x="0.0.0.1"]'); await wait(100);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 0) === 1), "croix posée");
  await page.evaluate(() => document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control"); await wait(150);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 0) === -1), "Ctrl+Z : croix annulée");
  await page.keyboard.down("Control"); await page.keyboard.press("y"); await page.keyboard.up("Control"); await wait(150);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 0) === 1), "Ctrl+Y : croix rétablie");
  await page.click("#b-undo"); await wait(150);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 0) === -1), "bouton ↶ : annulé");

  // 4. glisser rapide (4 événements sur 16 lignes)
  const ctr = async sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const [x0, y0] = await ctr('td[data-x="0.0.1.0"]'), [x1, y1] = await ctr('td[data-x="3.3.1.0"]');
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); await wait(150);
  const n = await page.evaluate(() => [0, 1, 2, 3].reduce((a, s) => a + [0, 1, 2, 3].filter(o => croix(S, "2026-10-12", s, o, 1) === 0).length, 0));
  ok(n === 16, `glisser rapide : ${n} croix sur 16`);

  // 5. clavier sur la grille
  await page.focus('td[data-x="0.0.2.0"]'); await page.keyboard.press("Space"); await wait(50);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 0, 2) === 0), "Espace sur une case : croix");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await wait(50);
  ok(await page.evaluate(() => croix(S, "2026-10-12", 0, 1, 2) === 1 && document.activeElement.dataset.x === "0.1.2.1"), "flèches puis Entrée : croix sur la case voisine, focus conservé");
  ok((await page.evaluate(() => location.hash)) === "#fiche/2026-10-12", "les flèches dans la grille ne changent pas de jour");
  ok(await page.$eval('td[data-x="0.0.2.0"]', td => td.getAttribute("role") === "checkbox" && td.getAttribute("aria-checked") === "true" && td.getAttribute("aria-label").includes("M3")), "case accessible : rôle case à cocher, état, libellé");

  // 6. créneau sans matière non saisissable ; fiche complète = 4 objectifs
  await go("#fiche/2026-10-14");
  ok(!(await page.$('td[data-x="0.0.4.0"]')) && (await page.evaluate(() => creneau(S, semaines(S), "2026-10-14", 4).mat)) === "", "créneau sans cours (mercredi S1) : pas de case cliquable");
  await go("#fiche/2026-10-12");
  ok(await page.evaluate(() => etatJour(S, semaines(S), "2026-10-12") === "part"), "jour avec quelques croix : « en partie saisie »");

  // 7. remplaçant et matière libre
  reponse = JSON.stringify({ crn: "rempl", "crn-prof": "M. REMPLAÇANT" });
  await page.click('button[data-rempl="0"]'); await wait(250);
  ok(await page.evaluate(() => creneau(S, semaines(S), "2026-10-12", 0).prof === "M. REMPLAÇANT"), "remplaçant enregistré pour le jour");
  reponse = "Permanence";
  await page.select('select[data-mat="6"]', "__autre__"); await wait(200);
  ok(await page.evaluate(() => creneau(S, semaines(S), "2026-10-12", 6).mat === "Permanence"), "matière libre « Permanence »");
  reponse = null;

  // 8. déplacer les saisies d'un jour
  reponse = "2026-10-13";   // choisi dans la liste des jours
  await page.evaluate(() => { S.jours["2026-10-14"] = S.jours["2026-10-12"]; delete S.jours["2026-10-12"]; commit(); });
  await go("#fiche/2026-10-14");
  dialogs.length = 0; await page.evaluate(() => { delete S.jours["2026-10-13"]; commit(); });
  await page.click("#m-fiche summary"); await wait(100);
  await page.click('button[data-act="move-day"]'); await wait(300);
  ok(await page.evaluate(() => !S.jours["2026-10-14"] && croix(S, "2026-10-13", 0, 0, 2) === 0 && location.hash === "#fiche/2026-10-13"), "saisies déplacées du 14/10 au 13/10");
  reponse = null;

  // 9. totaux : semaine en cours par défaut
  await page.evaluate(() => { window.aujourdhui = () => "2026-11-26"; });
  await go("#totaux");
  ok((await page.$eval("#pick-week", s => s.selectedOptions[0].textContent)).includes("Semaine 48"), "onglet Totaux : semaine en cours (S48)");

  // 10. bilan sur une période
  await go("#bilan");
  await page.select("#bil-de", "2"); await wait(200);
  ok((await page.$eval(".f-title", e => e.textContent)).includes("semaines 46 à 51"), "bilan limité à une période (à partir de S46)");

  // 11. enregistrement : retour visible ; ouverture refusée sans changer la cible
  await page.evaluate(() => {
    window.__ecrit = [];
    const handle = name => ({ name, getFile: async () => new File([new Uint8Array([1, 2, 3])], name), createWritable: async () => ({ write: async b => window.__ecrit.push(name), close: async () => {} }) });
    window.showSaveFilePicker = async () => handle(NOM_PAGE);   /* enregistrement dans la page elle-même */
    window.showOpenFilePicker = async () => [handle("Notes 5E.ods")];
  });
  await page.evaluate(() => { dirty = false; fileHandle = null; });
  await page.evaluate(() => openFile()); await wait(500);
  await page.evaluate(() => { S.classe = "5E bis"; commit(); });
  await page.evaluate(() => saveFile(false)); await wait(800);
  const ecrit = await page.evaluate(() => window.__ecrit);
  ok(ecrit.length === 1 && ecrit[0] === "Fiche de suivi collective.html", "après une reprise refusée, Ctrl+S enregistre dans la page (pas dans « Notes 5E.ods ») : " + JSON.stringify(ecrit));
  ok((await page.$eval("#status", e => e.textContent)) === "Enregistré dans ce fichier" && (await page.$eval("#toast", e => e.textContent)).includes("Enregistré"), "statut « Enregistré dans ce fichier » et message de confirmation");

  // 12. fichier .json tronqué : refusé avec un message clair, le suivi affiché est gardé
  const res = await page.evaluate(async () => { const t = JSON.stringify({ app: "fiche-suivi-collective", format: 1, S }); const avant = S.classe;
    const ok = await loadFile(new File([t.slice(0, t.length / 2)], "abime.json")); return [ok, S.classe === avant]; });
  ok(res[0] === false && res[1], "fichier .json abîmé : refusé, le suivi affiché est gardé");

  // 13. caractère U+FFFF dans un commentaire : le fichier se rouvre
  const rouvre = await page.evaluate(async () => { jour(S, "2026-10-15", true).com[0] = "test \uFFFF fin"; const t = JSON.stringify({ app: "fiche-suivi-collective", format: 1, S });
    await loadFile(new File([t], "x.json")); return S.jours["2026-10-15"].com[0]; });
  ok(typeof rouvre === "string" && rouvre.includes("fin"), "U+FFFF dans un commentaire : le fichier se rouvre");

  // 14. fichier piégé : aucun script exécuté
  const xss = await page.evaluate(async () => {
    const st = { typeDebut: '<img src=x onerror="window.__x=1">', typesForces: { "2026-10-12": '<img src=x onerror="window.__x=2">' }, eleves: [{ nom: '<img src=x onerror="window.__x=3">' }] };
    await loadFile(new File([JSON.stringify({ app: "fiche-suivi-collective", format: 1, S: st })], "piege.json")); render(); location.hash = "#reglages"; await new Promise(r => setTimeout(r, 300));
    location.hash = "#sommaire"; await new Promise(r => setTimeout(r, 300));
    return [window.__x || null, S.typeDebut];
  });
  ok(xss[0] === null && xss[1] === "A", "fichier .json piégé (nom, type de semaine) : aucun script exécuté, valeur ramenée à « A »");

  // 15. deux onglets sur le même suivi : synchronisation
  await page.evaluate(() => doDemo()); await wait(200);
  const page2 = await browser.newPage(); await require("./boites")(page2);
  await page2.goto(APP + "#sommaire"); await wait(300);
  await page2.evaluate(() => { S.referent = "VIA ONGLET 2"; commit(); }); await wait(300);
  ok((await page.evaluate(() => S.referent)) === "VIA ONGLET 2", "deux onglets, même suivi : l’onglet 1 reprend la modification de l’onglet 2");
  await page2.close();

  // 16. impression : vue sans contenu imprimable
  dialogs.length = 0; await go("#reglages");
  await page.evaluate(() => imprimerVue()); await wait(100);
  ok(dialogs.some(m => m.includes("Rien à imprimer")), "Imprimer depuis Réglages : message clair");

  // 17. fermer et effacer du navigateur
  await page.evaluate(() => { dirty = false; }); await page.evaluate(() => document.querySelector("#b-close").click()); await wait(200);
  ok(await page.evaluate(() => S === null && localStorage.getItem(LS_KEY) === null && !!document.querySelector(".accueil")), "« Fermer et effacer de ce navigateur » : données retirées, retour à l’accueil");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await browser.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
