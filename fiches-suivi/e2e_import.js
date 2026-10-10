const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; let attendre = false, colle = "";
  await p.exposeFunction("__boiteNotifier", (message, type, titre) => { msgs.push(titre + "\n" + message); return { accept: true, valeur: type === "saisie" && colle ? colle : null, attendre }; });
  await p.evaluateOnNewDocument(() => { document.addEventListener("boite-ouverte", async e => { const d = e.target, r = await window.__boiteNotifier(e.detail.message, e.detail.type, e.detail.titre);
    window.__boite = d.innerHTML; if (r.attendre) return; const c = d.querySelector("#boite-champ"); if (c && r.valeur !== null) c.value = r.valeur; const o = d.querySelector('[data-r="oui"]'); (o.disabled ? d.querySelector('[data-r="non"]') : o).click(); }); });
  await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };
  const fichier = async (btn, f) => { const [fc] = await Promise.all([p.waitForFileChooser(), p.click(btn)]); await fc.accept([DIR + "/imp/" + f]); await wait(700); };
  // unitaire : analyse des colonnes
  const an = await p.evaluate(() => [analyserListe(lireCsv("Nom;Prénom;Classe;Groupe\nA;b;5E;G1").lignes), analyserListe(lireCsv("Élève\nBRIDGE Michael").lignes), analyserListe(lireCsv("DUVAL\tMarie\nROI\tLéo").lignes), analyserListe(lireCsv("BRIDGE Michael\nPONTS Miquela").lignes), analyserListe(lireCsv("NOM PRÉNOM,Options\nX Y,Latin").lignes)].map(m => [m.entete, m.nom, m.prenom, m.groupes.join("+")].join()));
  ok(an.join(" | ") === "true,0,1,3 | true,0,-1, | false,0,1, | false,0,-1, | true,0,-1,1", "colonnes reconnues : Nom+Prénom (+ Groupe), Élève, 2 colonnes sans titre, 1 colonne, « NOM PRÉNOM » (+ Options) " + an.join(" | "));
  // CSV Pronote en Windows-1252, plusieurs classes : seuls les élèves de la classe du suivi (5E) sont ajoutés
  await go("#reglages/classeEntiere");
  await p.evaluate(() => { S.classeEleves.splice(26); commit(); });
  await fichier('[data-act="cl-fichier"]', "pronote.csv");
  const cl = await p.evaluate(() => S.classeEleves.slice(26).map(e => e.nom));
  ok(cl.join() === "CARPE Léa,TRUITE Jean-Pierre,SAUMON Max", "CSV Pronote (Windows-1252, « ; ») : les 3 élèves de 5E (BROCHET, en 5A, écarté), accents lus, prénom en capitales remis en forme " + cl.join());
  ok(msgs.some(m => m.includes("pronote.csv") && m.includes("5 lignes")) && /imp-classe/.test(await p.evaluate(() => window.__boite)), "boîte de vérification : nom du fichier, nombre de lignes, choix de la classe (fichier à plusieurs classes)");
  await fichier('[data-act="cl-fichier"]', "pronote.csv");
  ok(await p.evaluate(() => S.classeEleves.length === 29) && /3 déjà dans la liste/.test(await p.evaluate(() => window.__boite)), "réimport : noms déjà présents, rien à changer");
  // groupes et options dans le même tableau
  await fichier('[data-act="cl-fichier"]', "groupes.csv");
  const g = await p.evaluate(() => ({ groupes: S.groupes.map(x => x.nom).join(","), carpe: (S.classeEleves.find(e => e.nom === "CARPE Léa").groupes || []).join("+"), truite: (S.classeEleves.find(e => e.nom === "TRUITE Jean-Pierre").groupes || []).join("+"),
    bridge: (S.classeEleves.find(e => e.nom === "BRIDGE Michael").groupes || []).join("+"), zoe: (S.classeEleves.find(e => e.nom === "TANCHE Zoé") || {}).groupes, n: S.classeEleves.length }));
  console.log(JSON.stringify(g));
  ok(g.groupes === "Groupe 1,Groupe 2,Latin,Théâtre,Groupe 3" && g.carpe === "Groupe 1+Latin+Théâtre" && g.truite === "Groupe 2" && g.zoe.join() === "Groupe 3" && g.n === 30,
    "colonnes « Groupe » et « Options » : « G1 » = Groupe 1, plusieurs options par case, groupes créés (Théâtre, Groupe 3), nouvel élève avec son groupe");
  ok(g.bridge === "Groupe 1+Latin+Théâtre", "élève déjà dans la liste (BRIDGE) : ses groupes sont complétés, pas de doublon");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  ok(await p.evaluate(() => S.groupes.length === 3 && S.classeEleves.length === 29), "Ctrl+Z annule tout l’import");
  // colonne « Chorale » : option si la case est remplie (choisie dans la boîte)
  attendre = true;
  const [fc] = await Promise.all([p.waitForFileChooser(), p.click('[data-act="cl-fichier"]')]); await fc.accept([DIR + "/imp/groupes.csv"]); await wait(700);
  ok(await p.evaluate(() => [...document.querySelectorAll("#boite select[data-imp-col]")].map(x => x.value).join()) === "valeurs,valeurs,ignorer", "autres colonnes : Classe à part, Groupe et Options lus, Chorale ignorée par défaut");
  await p.select('#boite select[data-imp-col="5"]', "coche"); await wait(200);
  ok(/Chorale/.test(await p.$eval("#imp-apercu", e => e.textContent)), "« Chorale : option si la case est remplie » : l’aperçu la montre");
  await p.screenshot({ path: DIR + "/sorties/import.png" });
  await p.click('#boite [data-r="oui"]'); await wait(400);
  ok(await p.evaluate(() => (S.classeEleves.find(e => e.nom === "TRUITE Jean-Pierre").groupes || []).includes("Chorale") && !(S.classeEleves.find(e => e.nom === "CARPE Léa").groupes || []).includes("Chorale")), "Chorale cochée pour TRUITE (« X ») et pas pour CARPE (case vide)");
  attendre = false;
  // élèves du suivi collectif : collage depuis un tableur (pas de groupes ici)
  await go("#reglages/eleves");
  colle = "Nom\tPrénom\nBAR\tLina\nMULET\tSacha\nCOLIN\tEva\nLIEU\tRose\nSOLE\tAbel";
  await p.click('[data-act="el-coller"]'); await wait(700);
  const el = await p.evaluate(() => [S.eleves.length, S.eleves.slice(6).map(e => e.nom).join()]);
  ok(el[0] === 11 && el[1].startsWith("BAR Lina") && !/imp-gr/.test(await p.evaluate(() => window.__boite)), "collage (Nom ↹ Prénom) pour le suivi collectif : élèves ajoutés, pas de colonnes de groupes " + el.join(" "));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
