// Enregistrement dans la page elle-même : le sélecteur de fichier de Chrome est simulé par un faux « handle » qui écrit sur le disque.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const path = require("path");
const DIR = __dirname, SRC = DIR + "/app/Fiche de suivi collective.html";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const T = fs.mkdtempSync(DIR + "/sorties/autoenreg-"), A = path.join(T, "Classe test.html"), B = path.join(T, "Autre classe.html");
  fs.copyFileSync(SRC, A); fs.copyFileSync(SRC, B);
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1366, height: 900 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  // faux sélecteur : le fichier choisi est celui indiqué par window.__cible (chemin sur le disque)
  await p.exposeFunction("__ecrire", (chemin, texte) => { fs.writeFileSync(chemin, texte); return true; });
  await p.exposeFunction("__lire", chemin => (fs.existsSync(chemin) ? fs.readFileSync(chemin, "utf8") : ""));
  const simuler = () => p.evaluate(() => {
    window.__choix = [];
    window.showSaveFilePicker = async o => { const chemin = window.__cible; window.__choix.push(o.suggestedName);
      return { name: chemin.split("/").pop(), getFile: async () => new File([await window.__lire(chemin)], chemin.split("/").pop()), queryPermission: async () => "granted", requestPermission: async () => "granted",
        createWritable: async () => { let t = ""; return { write: async bl => { t = await bl.text(); }, close: async () => { await window.__ecrire(chemin, t); } }; } }; };
  });
  const url = f => "file://" + f;
  await p.goto(url(A)); await p.evaluate(() => localStorage.clear()); await p.goto(url(A)); await wait(300);
  ok(await p.$(".accueil") !== null, "fichier vierge : écran d’accueil");
  // 1. nouveau suivi, saisies, Ctrl+S
  await p.evaluate(() => { doNew(); S.classe = "5E TEST"; S.eleves[0].nom = "SAUMON Léa"; commit(); }); await wait(200);
  await simuler(); await p.evaluate(A => { window.__cible = A; }, A);
  msgs.length = 0;
  await p.keyboard.down("Control"); await p.keyboard.press("s"); await p.keyboard.up("Control"); await wait(800);
  const html1 = fs.readFileSync(A, "utf8");
  ok(msgs.some(m => m.includes("Enregistrer dans ce fichier")) && (await p.evaluate(() => window.__choix[0])) === "Classe test.html", "premier enregistrement : explication, puis le fichier ouvert est proposé");
  ok(/<script id="donnees-suivi" type="application\/json">\{"app":"fiche-suivi-collective"/.test(html1) && html1.includes("SAUMON Léa") && html1.startsWith("<!DOCTYPE html>"), `le fichier contient les données (${Math.round(html1.length / 1024)} Ko)`);
  ok(await p.evaluate(() => !dirty && $("#status").textContent === "Enregistré dans ce fichier"), `état : « ${await p.$eval("#status", e => e.textContent)} »`);
  // 2. rechargement sans copie de secours : les données viennent du fichier
  await p.evaluate(() => localStorage.clear()); await p.goto(url(A)); await wait(400);
  ok(await p.evaluate(() => S && S.classe === "5E TEST" && S.eleves[0].nom === "SAUMON Léa" && !dirty), "rouvert (navigateur vidé) : le suivi est relu dans le fichier");
  // 3. modification non enregistrée puis rechargement : reprise depuis la copie de secours
  await p.evaluate(() => { S.eleves[1].nom = "TRUITE Max"; commit(); }); await wait(200);
  await p.goto(url(A)); await wait(600);
  ok(await p.evaluate(() => S.eleves[1].nom === "TRUITE Max" && dirty), "modification non enregistrée retrouvée au rechargement (et signalée)");
  // 4. deuxième enregistrement : la page ne grossit pas (pas de données en double)
  await simuler(); await p.evaluate(A => { window.__cible = A; }, A);
  await p.evaluate(() => saveFile(false)); await wait(800);
  const html2 = fs.readFileSync(A, "utf8");
  ok(html2.includes("TRUITE Max") && (html2.match(/<script id="donnees-suivi" type="application\/json">/g) || []).length === 1 && Math.abs(html2.length - html1.length) < 200, `réenregistré : un seul bloc de données, taille stable (${html1.length} → ${html2.length})`);
  // 5. le fichier enregistré fonctionne seul (autre profil, toutes les pages)
  const p2 = await b.newPage(); await require("./boites")(p2); const e2 = []; p2.on("pageerror", e => e2.push(e.message));
  await p2.goto(url(A)); await p2.evaluate(() => localStorage.clear()); await p2.goto(url(A)); await wait(400);
  for (const v of ["#sommaire", "#reglages", "#edt", "#totaux", "#bilan"]) { await p2.evaluate(v => { location.hash = v; }, v); await wait(200); }
  ok(e2.length === 0 && await p2.evaluate(() => S.eleves[1].nom === "TRUITE Max"), `le fichier enregistré s’ouvre et fonctionne (${e2.length} erreur)`);
  // 6. un autre fichier .html ne voit pas ce suivi (copie de secours propre à chaque fichier)
  await p2.goto(url(B)); await wait(400);
  ok(await p2.$(".accueil") !== null, "un autre fichier vierge garde son écran d’accueil (pas de mélange entre classes)");
  // 7. reprendre le suivi d'un autre fichier .html, puis d'un .ods
  const r7 = await p2.evaluate(async (texte) => { await loadFile(new File([texte], "Classe test.html")); return [S.classe, dirty]; }, fs.readFileSync(A, "utf8"));
  ok(r7[0] === "5E TEST" && r7[1], "reprise du suivi d’un autre fichier .html (à enregistrer ensuite)");
  // 7b. un .json incomplet (champs manquants) et un fichier d'une version plus récente (champ inconnu gardé)
  const r8 = await p2.evaluate(async () => { const vieux = { app: "fiche-suivi-collective", format: 1, savedAt: "2026-09-01T10:00:00Z", S: { classe: "4B ANCIEN", eleves: [{ nom: "ANCIEN Paul" }], jours: {} } };
    await loadFile(new File([JSON.stringify(vieux)], "ancien.json")); const a = [S.classe, S.eleves[0].nom, Array.isArray(S.classeEleves), !!S.decoupage];
    const neuf = { app: "fiche-suivi-collective", format: 99, S: { ...S, champDuFutur: { x: 1 } } };
    await loadFile(new File([JSON.stringify(neuf)], "futur.json")); await new Promise(r => setTimeout(r, 500)); return [...a, JSON.stringify(S.champDuFutur)]; });
  ok(r8[0] === "4B ANCIEN" && r8[1] === "ANCIEN Paul" && r8[2] && r8[3] && r8[4] === '{"x":1}', ".json incomplet complété, champ d’une version plus récente gardé " + JSON.stringify(r8));
  await p2.close();
  // 8. démonstration dans un fichier qui contient un suivi : confirmation avant d'écraser
  msgs.length = 0;
  await p.evaluate(() => doDemo()); await wait(300);
  await simuler(); await p.evaluate(A => { window.__cible = A; }, A);
  await p.evaluate(() => saveFile(false)); await wait(800);
  ok(msgs.some(m => m.includes("Remplacer le suivi enregistré")), "enregistrer la démonstration par-dessus un suivi : confirmation demandée");
  // 8b. premier enregistrement d'un autre suivi : choisir par erreur un fichier qui contient déjà un suivi → confirmation
  msgs.length = 0;
  await p.evaluate(() => { fileHandle = null; idEnregistre = ""; doNew(); S.classe = "AUTRE"; commit(); });
  await simuler(); await p.evaluate(A => { window.__cible = A; }, A);
  await p.evaluate(() => saveFile(false)); await wait(800);
  ok(msgs.some(m => m.includes("Remplacer un autre suivi")), "choisir un fichier qui contient un autre suivi : confirmation demandée");
  // 9. navigateur sans écriture directe : téléchargement d'une copie au nom du fichier
  const r9 = await p.evaluate(async () => { delete window.showSaveFilePicker; const vu = []; window.telechargerBlob = (bl, nom) => vu.push(nom); S.classe = "X"; commit(); await saveFile(false); return vu; });
  ok(r9.length === 1 && r9[0] === "Classe test.html", `sans écriture directe : copie téléchargée « ${r9[0]} »`);
  // 10. export .json (sauvegarde à part) relu à l'identique
  const r10 = await p.evaluate(async () => { let blob = null; window.showSaveFilePicker = async () => ({ name: "x.json", createWritable: async () => ({ write: async b => { blob = b; }, close: async () => {} }) }); await exporterJson(); const d = JSON.parse(await blob.text()); return [d.format, d.S.classe]; });
  ok(r10[0] === 1 && r10[1] === "X", "export .json relu à l’identique");
  console.log(errs.length ? "ERREURS " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true }); fs.rmSync(T, { recursive: true, force: true });
})();
