// Apparence de Suivi PP (2026-10-10) : polices embarquées (Andika à l'écran, Latin Modern au papier, réglables et enregistrées
// avec le suivi), feuilles affichées en police d'impression avec le bouton « Aa », et import d'une classe depuis une sauvegarde
// de Plan de classe (imp/plan-de-classe.json, noms fictifs).
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = [];
  await p.exposeFunction("__boiteNotifier", (message, type, titre) => { msgs.push(titre + "\n" + message); return { accept: true }; });
  await p.evaluateOnNewDocument(() => { document.addEventListener("boite-ouverte", async e => { const d = e.target, r = await window.__boiteNotifier(e.detail.message, e.detail.type, e.detail.titre);
    window.__boite = d.innerHTML; const cl = d.querySelector("#imp-classe"); if (cl && cl.value === "?") { cl.value = "5E"; cl.dispatchEvent(new Event("change", { bubbles: true })); }
    const o = d.querySelector('[data-r="oui"]'); (o.disabled ? d.querySelector('[data-r="non"]') : o).click(); }); });
  await p.setViewport({ width: 1366, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());   /* « quitter la page ? » d'un suivi non enregistré */
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(300);
  const fam = sel => p.evaluate(s => getComputedStyle(document.querySelector(s)).fontFamily, sel);

  // 1. polices embarquées, chargées, sans rien d'installé : la page les déclare elle-même
  const charge = await p.evaluate(async () => { await document.fonts.ready; await POLICES_CHARGEES;
    return ["Andika", "Latin Modern Roman", "JetBrains Mono"].map(f => document.fonts.check(`1em "${f}"`) && [...document.fonts].some(x => x.family.replace(/"/g, "") === f && x.status === "loaded")); });
  ok(charge.every(Boolean), "Andika, Latin Modern et JetBrains Mono embarquées et chargées " + charge);
  ok(/Andika/.test(await fam("body")), "écran : Andika par défaut");
  // 2. démonstration : la feuille affichée est en police d'impression, avec son bouton « Aa »
  await p.evaluate(() => doDemo()); await p.evaluate(() => { location.hash = "#fiche/2026-10-12"; }); await wait(400);
  ok(/Latin Modern/.test(await fam("#view .sheet")) && /Andika/.test(await fam(".side")), "feuille affichée en Latin Modern (police d'impression), menus en Andika");
  const aa = await p.$("#view .sheet > .bascule-police");
  ok(!!aa && /Latin Modern/.test(await p.evaluate(b => b.title, aa)), "bouton « Aa » sur la feuille, qui dit la police en cours");
  await aa.click(); await wait(100);
  ok(/Andika/.test(await fam("#view .sheet")) && await p.evaluate(() => localStorage.getItem(LS_KEY + "-feuilles-ecran") === "1"), "« Aa » : la feuille passe en police d'affichage (réglage de ce navigateur)");
  await p.emulateMediaType("print");
  ok(/Latin Modern/.test(await p.evaluate(() => { printPages = printPages; const a = document.querySelector("#print-area"); a.innerHTML = '<div class="page sheet">x</div>'; return getComputedStyle(a.firstChild).fontFamily; })), "impression : toujours la police d'impression, quel que soit « Aa »");
  await p.emulateMediaType("screen");
  await (await p.$("#view .sheet > .bascule-police")).click(); await wait(100);
  ok(/Latin Modern/.test(await fam("#view .sheet")), "« Aa » de nouveau : retour à la police d'impression");
  // 3. réglages (Fichier › Apparence) : enregistrés avec le suivi, un cran de Ctrl+Z
  await p.evaluate(() => { $("#m-file").open = true; const s = $("#police-ecran"); s.value = "lm"; s.dispatchEvent(new Event("change")); }); await wait(200);
  ok(await p.evaluate(() => S.policeEcran === "lm" && document.documentElement.dataset.police === "lm") && /Latin Modern/.test(await fam(".side")), "police d'affichage Latin Modern : enregistrée dans le suivi, menus en Latin Modern");
  ok(!(await p.$("#view .sheet > .bascule-police")), "mêmes polices à l'écran et au papier : pas de bouton « Aa »");
  await p.evaluate(() => { const s = $("#police-papier"); s.value = "andika"; s.dispatchEvent(new Event("change")); }); await wait(200);
  await p.emulateMediaType("print");
  ok(/Andika/.test(await p.evaluate(() => getComputedStyle(document.querySelector("#print-area .page")).fontFamily)), "police d'impression Andika : le papier suit");
  await p.emulateMediaType("screen");
  ok(await p.evaluate(() => { S.etablissement.nom = "Collège Les Tilleuls"; pagesAvecEtab(["x"]); return /"Andika"/.test(document.getElementById("style-etab-marge").textContent); }), "marge des impressions (nom de l'établissement) dans la police d'impression");
  const env = await p.evaluate(() => JSON.parse(JSON.stringify(normalizeState(JSON.parse(JSON.stringify(S))))));
  ok(env.policeEcran === "lm" && env.policePapier === "andika", "les réglages survivent à la relecture d'un fichier (normalizeState)");
  ok(await p.evaluate(() => { const n = normalizeState({ classe: "5E" }); return !("policeEcran" in n) && !("policePapier" in n); }), "un ancien suivi n'en reçoit aucun champ : les défauts valent");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(200);
  ok(await p.evaluate(() => !("policePapier" in S)), "Ctrl+Z annule le choix de police");
  // 4. Plan de classe : lecture pure
  const l = await p.evaluate(() => { const d = JSON.parse('{"classes":{"__proto__":{"nom":"x"},"a":{"nom":"5E","eleves":["e1"]},"v":{"nom":"Latin","virtual":true,"eleves":["e1"]}},"eleves":{"e1":{"nom":"CARPE","prenom":"Léa","groupe":2,"tags":["t"]}},"tags":{"t":{"abbr":"LAT","name":"Latin"}}}');
    return lignesPlanDeClasse(d); });
  ok(JSON.stringify(l) === JSON.stringify([["Nom", "Prénom", "Classe", "Groupe", "Options"], ["CARPE", "Léa", "5E", "Groupe 2", "Latin"]]), "Plan de classe → tableau : classes virtuelles écartées, groupe et options " + JSON.stringify(l));
  ok(await p.evaluate(() => { try { lignesPlanDeClasse({ app: "fiche-suivi-collective", S: {} }); return false; } catch (e) { return /Reprendre un suivi/.test(e.message); } }), "un suivi de l'application n'est pas pris pour une sauvegarde de Plan de classe");
  // 5. accueil vierge → « Classe depuis Plan de classe » : nouveau suivi, classe choisie, élèves avec groupes et options
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await wait(300);
  const bt = await p.$('[data-act="new-pdc"]');
  ok(!!bt, "accueil : bouton « Classe depuis Plan de classe (.json)… »");
  const [fc] = await Promise.all([p.waitForFileChooser(), bt.click()]); await fc.accept([DIR + "/imp/plan-de-classe.json"]); await wait(900);
  const r = await p.evaluate(() => ({ classe: S.classe, el: S.classeEleves.map(e => e.nom + (e.groupes ? ":" + e.groupes.join("+") : "")), gr: S.groupes.map(g => g.nom).filter(Boolean) }));
  ok(r.classe === "5E" && r.el.join() === "CARPE Léa:Groupe 1+Latin+Théâtre,TRUITE Jean-Pierre:Groupe 2,BROCHET Noé:Théâtre", "5E choisie parmi 5E et 4B (Latin 5e, virtuelle, écartée) : 3 élèves, groupes et options, la classe nomme le suivi " + JSON.stringify(r));
  ok(/imp-classe/.test(await p.evaluate(() => window.__boite || "")) && !/Latin 5e/.test(await p.evaluate(() => window.__boite || "")), "la boîte propose 5E et 4B, pas la classe virtuelle");
  console.log(errs.length ? "ERREURS JS :\n" + errs.join("\n") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
