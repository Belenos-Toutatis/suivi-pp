// « Fiches de la semaine… » (v1.91.4) : case « Avec le bilan du professeur principal » dans la fenêtre d'impression groupée.
// Cochée d'office quand toutes les fiches de la semaine choisie ont atteint leur jour de remise ; suit la semaine choisie tant
// qu'on n'y a pas touché ; cochée ou décochée à la main, elle impose son choix à toutes les fiches imprimées.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); let rep = null; await require("./boites")(p, { reponse: () => rep }); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  // deux semaines qui ont des fiches ; « aujourd'hui » = le dernier jour de remise de la première (finie), avant celui de la seconde
  const sem = await p.evaluate(() => { const sems = semaines(S), avec = [...sems.keys()].filter(i => fichesIndivSemaine(sems[i], S.individuels).length);
    const w1 = avec[0], w2 = avec[avec.length - 1], rem = i => fichesIndivSemaine(sems[i], S.individuels).map(([, c]) => remiseCycle(c));
    const jour = rem(w1).sort().at(-1); window.__vrai = aujourdhui; aujourdhui = () => jour;
    for (const i of [w1, w2]) for (const [ind, c] of fichesIndivSemaine(sems[i], S.individuels)) ind.bilans[c.fin] = "Bilan d’essai du professeur principal.";
    printPages = pages => { window.__imp = pages; }; commit(); return { w1, w2, fini2: rem(w2).every(d => d <= jour), n1: fichesIndivSemaine(sems[w1], S.individuels).length }; });
  ok(sem.w1 !== sem.w2 && !sem.fini2, `deux semaines de la démonstration : ${sem.w1} (fiches finies) et ${sem.w2} (fiches à venir)`);
  const bilans = () => p.evaluate(() => (window.__imp || []).map(h => /Bilan d’essai/.test(h)));
  /* geste dans la fenêtre, juste à son ouverture : f reçoit la fenêtre, rend ce qu'on veut noter */
  const ouvrir = async f => { await p.evaluate(src => { window.__note = null; window.__imp = null; document.addEventListener("boite-ouverte", e => { window.__note = (0, eval)(src)(e.target); }, { once: true }); }, f.toString());
    await p.evaluate(() => location.hash = "#indiv"); await wait(300); await p.click('[data-act="print-ind-semaine"]'); await wait(600); return p.evaluate(() => window.__note); };
  const choisir = `(d, i) => { const s = d.querySelector("#pis-sem"); s.value = String(i); s.dispatchEvent(new Event("change", { bubbles: true })); return d.querySelector("#pis-bilan").checked; }`;

  // 1. la case suit la semaine tant qu'on n'y touche pas
  rep = JSON.stringify({ "pis-sem": String(sem.w1) });
  let n = await ouvrir(`d => { const ch = ${choisir}, cb = d.querySelector("#pis-bilan"); return { libelle: /Avec le bilan du professeur principal/.test(cb.closest("label").textContent), s2: ch(d, ${sem.w2}), s1: ch(d, ${sem.w1}) }; }`);
  ok(n && n.libelle, "fenêtre « Imprimer les fiches individuelles » : case « Avec le bilan du professeur principal »");
  ok(n && n.s1 === true && n.s2 === false, `cochée d'office pour la semaine aux fiches finies, décochée pour celle à venir ${JSON.stringify(n)}`);
  let bl = await bilans();
  ok(bl.length === sem.n1 && bl.every(Boolean), `semaine finie, case cochée : ${bl.length} fiches imprimées, toutes avec le bilan`);

  // 2. décochée à la main : elle ne bouge plus quand on change de semaine, et aucune fiche n'a de bilan
  n = await ouvrir(`d => { const ch = ${choisir}, cb = d.querySelector("#pis-bilan"); ch(d, ${sem.w1}); cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); return { s2: ch(d, ${sem.w2}), s1: ch(d, ${sem.w1}) }; }`);
  ok(n && n.s1 === false && n.s2 === false, "décochée à la main : elle reste décochée en changeant de semaine");
  bl = await bilans();
  ok(bl.length === sem.n1 && bl.every(x => !x), "semaine finie, case décochée : cadres de bilan vides");

  // 3. cochée à la main pour la semaine à venir : le bilan s'imprime quand même
  rep = JSON.stringify({ "pis-sem": String(sem.w2), "pis-bilan": true });
  n = await ouvrir(`d => d.querySelector("#pis-bilan").checked`);
  bl = await bilans();
  ok(bl.length > 0 && bl.every(Boolean), "semaine à venir, case cochée à la main : le bilan est imprimé");
  rep = JSON.stringify({ "pis-sem": String(sem.w2) });
  n = await ouvrir(`d => { const ch = ${choisir}; return ch(d, ${sem.w2}); }`); bl = await bilans();
  ok(n === false, "semaine à venir choisie dans la liste : case décochée d’office");
  ok(bl.length > 0 && bl.every(x => !x), "semaine à venir, case laissée décochée : cadres vides (fiches à distribuer)");
  ok(await p.evaluate(() => Object.keys(impBilanChoix).length === 0), "l’impression groupée ne change pas la case de chaque suivi");
  ok(await p.evaluate(() => { let ls = ""; try { ls = Object.keys(localStorage).join(); } catch (e) {} return !/pis-bilan|impBilan/.test(JSON.stringify(S) + ls); }), "le choix n’entre ni dans les données ni dans le stockage du navigateur");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
