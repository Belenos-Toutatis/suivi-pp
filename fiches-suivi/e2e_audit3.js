// Corrections issues de l'audit (oct. 2026) : chaque point qui avait été constaté en défaut
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m); const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1024, height: 768 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); window.print = () => { window.__pages = document.querySelectorAll("#print-area .page").length; window.__t = document.title; window.__html = document.querySelector("#print-area").innerHTML; }; }); await wait(300);
  // 1. période sans semaine : bilan affiché, fichier rouvert
  const r1 = await p.evaluate(async () => { const s0 = JSON.stringify(S); S.debut = ""; location.hash = "#bilan"; render(); const ko = /Affichage impossible/.test(document.querySelector("#view").textContent);
    const f = new File([JSON.stringify({ app: "fiche-suivi-collective", format: 1, S })], "vide.json"); const lu = await loadFile(f); S = normalizeState(JSON.parse(s0)); render(); return { ko, lu }; });
  ok(!r1.ko && r1.lu === true, "période sans semaine : le bilan s’affiche et le fichier se rouvre " + JSON.stringify(r1));
  // 2. Ctrl+P sur les trois vues de synthèse : la page affichée
  for (const [h, re] of [["#classesuivi", /semaine après semaine/], ["#classebilan", /bilan par matière/], ["#indivtous", /tous les suivis en parallèle/]]) {
    const t = await p.evaluate(h => { location.hash = h; return new Promise(r => setTimeout(() => { window.dispatchEvent(new Event("beforeprint")); const x = [document.title, document.querySelector("#print-area").textContent.slice(0, 80)]; window.dispatchEvent(new Event("afterprint")); r(x); }, 400)); }, h);
    ok(re.test(t[1]) && !/Fiches? du jour|Fiches - /.test(t[0]), `Ctrl+P sur ${h} : ${t[0]}`); }
  await p.evaluate(() => { location.hash = "#classebilan"; }); await wait(400);
  ok(await p.evaluate(() => !!document.querySelector('[data-act="print-synth"]')), "bilan par matière de la classe : bouton Imprimer");
  // 3. bilan famille : le bilan du professeur principal une seule fois
  await p.evaluate(() => { location.hash = "#indiv/demo-bridge"; }); await wait(500);
  await p.click('[data-act="print-famille"]'); await wait(300);
  const fam = await p.evaluate(() => ({ n: window.__pages, pied: (window.__html.match(/Bilan du professeur principal/g) || []).length, visa: /Visa du pro/.test(window.__html) }));
  ok(fam.n === 2 && fam.pied === 1 && !fam.visa, "bilan pour la famille : 2 pages, bilan du professeur principal une seule fois, pas de visa vide " + JSON.stringify(fam));
  // 4. grille de saisie avant l'évolution
  ok(await p.evaluate(() => { const g = document.querySelector("#grille-indiv"), e = document.querySelector(".no-print .card"); return g && document.querySelector("a[data-vers=grille-indiv]") && g.getBoundingClientRect().top < [...document.querySelectorAll("#view h2")].find(h => /Évolution/.test(h.textContent)).getBoundingClientRect().top; }), "suivi individuel : la grille de saisie vient avant l’évolution, lien « Saisir les codes »");
  // 5. 21e suivi gardé au rechargement
  const n21 = await p.evaluate(() => { while (S.individuels.length < 21) S.individuels.push({ id: nouvelId(), nom: "X" + S.individuels.length, objectifs: ["a"], debut: "", fin: "", remise: 0, courriel: "", saisies: {}, bilans: {} }); return normalizeState(JSON.parse(JSON.stringify(S))).individuels.length; });
  ok(n21 === 21, "21 suivis individuels : tous gardés (" + n21 + ")");
  await p.evaluate(() => { S.individuels = S.individuels.slice(0, 3); commit(); });
  // 6. infobulles du menu sans « \n » en clair
  ok(await p.evaluate(() => ![...document.querySelectorAll("#tabs [title], .nav-g[title]")].some(x => x.getAttribute("title").includes("\\n"))), "menu : infobulles sans « \\n » en clair");
  // 7. fenêtre ouverte : Ctrl+Z n'agit pas derrière
  const z = await p.evaluate(async () => { location.hash = "#reglages/classe"; render(); const avant = JSON.stringify(S); S.classe = "5Z"; commit(); const v1 = JSON.stringify(S);
    const bt = document.createElement("button"); document.querySelector("#boite").appendChild(bt);     // une touche tapée dans la fenêtre
    bt.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); const v2 = JSON.stringify(S); bt.remove(); annuler(-1); return v1 === v2; });
  ok(z, "fenêtre ouverte : Ctrl+Z ne modifie pas les données derrière");
  // 8. vider le nom d'une matière utilisée : refusé
  await p.evaluate(() => { location.hash = "#reglages/matieres"; }); await wait(300);
  const m = await p.evaluate(() => { const i = S.matieres.findIndex(x => x.nom === "Français"); const el = document.querySelector(`[data-path="matieres.${i}.nom"]`); el.value = ""; el.dispatchEvent(new Event("change", { bubbles: true })); return [S.matieres[i].nom, el.value]; });
  ok(m[0] === "Français" && m[1] === "Français", "vider le nom d’une matière utilisée : refusé, nom remis");
  // 9. jour de remise changé : les bilans restent visibles
  const rem = await p.evaluate(async () => { const ind = S.individuels.find(i => i.id === "demo-bridge"), vis = () => cyclesIndiv(ind).filter(c => bilanCycle(ind, c)).length, av = vis();
    location.hash = "#reglages/suivisIndiv"; render(); await new Promise(r => setTimeout(r, 200)); const sel = document.querySelector('[data-num="remiseIndiv"]'); sel.value = "4"; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 200)); return [av, vis()]; });
  ok(rem[0] > 0 && rem[0] === rem[1], "jour de remise changé : les bilans écrits restent visibles " + rem.join(" → "));
  // 10. enseignant absent après saisie : effacé partout
  const abs = await p.evaluate(async () => { const ind = S.individuels.find(i => i.id === "demo-bridge"); const k = Object.keys(ind.saisies)[0], [d, pp] = k.split("."), p = Number(pp);
    const r = annulerCours(d, [p]); await r; const j = S.jours[d]; return [!!ind.saisies[k], Object.keys(j.cl || {}).some(c => c.split(".")[1] === pp), Object.keys(j.x || {}).some(c => c.split(".")[2] === pp), !!j.profAbs[p]]; });
  ok(!abs[0] && !abs[1] && !abs[2] && abs[3], "enseignant absent : saisies individuelles, de classe et collectives du créneau effacées " + JSON.stringify(abs));
  // 11. après « Effacer de ce navigateur » plus de titre ni de tutoriel résiduels
  await p.evaluate(() => { tuto = { ch: 0, i: 2 }; S = null; render(); });
  ok(await p.evaluate(() => !document.body.classList.contains("tuto-actif") && document.querySelector("#brand-sous").textContent === "individuels · collectif · classe"), "sans suivi : ni tutoriel ni ancien titre");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
