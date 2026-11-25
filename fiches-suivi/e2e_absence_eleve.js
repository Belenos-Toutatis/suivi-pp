// Absence d'un élève (v1.94.0) : notée une fois, depuis n'importe quelle fiche, elle vaut pour les trois familles — fiche individuelle,
// fiche collective, fiche de classe. Vrais clics : jour, matière, clic droit, palette de la fiche de classe, menu de la fiche collective.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(DIR + "/sorties", { recursive: true });
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1366, height: 900 });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
    const D = "2026-11-17";   // mardi
    const demo = async () => { await p.evaluate(() => { dirty = false; return doDemo(); }); await wait(300); await p.evaluate(() => { window.aujourdhui = () => "2026-11-18"; }); };
    const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(450); };
    const boite = sel => p.evaluate(sel => { const d = document.querySelector("#boite[open]"); return d ? (sel ? !!d.querySelector(sel) : d.innerText) : ""; }, sel || "");
    const oui = async () => { await p.click('#boite [data-r="oui"]'); await wait(350); }, non = async () => { await p.click('#boite [data-r="non"]'); await wait(350); };
    // état des trois familles pour BRIDGE (suivi individuel, suivi collectif et classe)
    const etat = (d, q, nom = "BRIDGE Michael") => p.evaluate((d, q, nom) => { const i = S.individuels.find(x => x.nom === nom), s = S.eleves.findIndex(e => e.nom === nom), c = S.classeEleves.findIndex(e => e.nom === nom), j = S.jours[d] || {};
      const v = i && i.saisies[`${d}.${q}`];
      return { ind: !!i && absIndiv(S, i, d, q), propre: !!i && ((i.abs || {})[d] || []).includes(q), codes: !!v && v.c.some(x => x !== null), rem: v ? v.r : "",
        coll: s >= 0 && absCreneaux(S, d, s).includes(q), croix: s >= 0 && Object.keys(j.x || {}).some(k => { const [a, , r] = k.split(".").map(Number); return a === s && r === q; }),
        cl: ((j.cl || {})[`${c}.${q}`] || ""), actif: c >= 0 && caseClasseActive(semaines(S), d, q, S.classeEleves[c]) }; }, d, q, nom);
    const stat = () => p.evaluate(() => { const i = S.individuels[0], c = cyclesIndiv(i).find(c => c.fin === "2026-11-20"); return { st: statsIndiv(i, c).map(x => x[1]), abs: absencesTxt(i, c), ret: retenueFiche(i, c).nI }; });
    await demo();
    ok(await p.evaluate(() => S.eleves.some(e => e.nom === "BRIDGE Michael") && S.classeEleves.some(e => e.nom === "BRIDGE Michael")), "BRIDGE est suivi dans les trois familles");
    ok(await p.evaluate(() => S.individuels.some(i => Object.keys(i.abs).length && Object.entries(i.abs).every(([d, l]) => l.every(q => absIndiv(S, i, d, q))))), "démonstration : une absence sur une fiche individuelle");

    // 1. la journée, par l'en-tête du jour
    await go("#indiv/demo-bridge:2026-11-20");
    const avant = await stat();
    await p.click(`th[data-jabs="0|${D}"]`); await wait(300);
    ok(await boite("[data-absc]"), "clic sur le jour : la fenêtre liste les cours du jour");
    await p.click('#boite [data-absq="jour"]'); await oui();
    ok(/fiche individuelle \(BRIDGE Michael\)/.test(await boite()) && /croix sur la fiche collective/.test(await boite()), "des codes existent : confirmation qui nomme chaque fiche");
    await non();
    ok((await stat()).st.join() === avant.st.join() && !(await etat(D, 0)).ind, "refus : rien ne change");
    await p.click(`th[data-jabs="0|${D}"]`); await wait(300); await p.click('#boite [data-absq="jour"]'); await oui(); await oui();
    const ps = await p.evaluate(D => coursDuJour(S.individuels[0], D).map(x => x.p), D);
    const es = []; for (const q of ps) es.push(await etat(D, q));
    ok(ps.length >= 4 && es.every(e => e.ind && e.propre && !e.codes), `journée : absent aux ${ps.length} cours de la fiche individuelle, codes effacés`);
    ok(es.every(e => e.coll && !e.croix), "journée : absent aussi sur la fiche collective, croix effacées");
    ok(es.every(e => !e.actif || e.cl === "A"), "journée : code A sur la fiche de classe");
    ok(await p.evaluate(D => absPreset(absCreneaux(S, D, S.eleves.findIndex(e => e.nom === "BRIDGE Michael"))) === "jour", D), "la fiche collective dit « toute la journée »");
    const ap = await stat();
    ok(ap.st.every((n, k) => n < avant.st[k]) && /mardi 17\/11 \(toute la journée\)/.test(ap.abs), "les cours ne comptent plus ; « " + ap.abs + " »");
    const g = await p.evaluate(D => { const l = [...document.querySelectorAll(`td[data-iabs^="0.${D}."]`)]; return { n: l.length, t: l[0] && l[0].textContent, ic: document.querySelectorAll(`td[data-ic^="0.${D}."]`).length, rem: document.querySelectorAll(`input[data-ir^="0.${D}."]`).length, coupe: l.some(x => x.scrollWidth > x.clientWidth + 1) }; }, D);
    ok(g.n === ps.length && g.t === "absent(e)" && !g.ic && g.rem === ps.length && !g.coupe, "grille : une case « absent(e) » par cours, remarque gardée " + JSON.stringify(g));
    // saisie au clavier : la journée est sautée
    const suite = await p.evaluate(D => { const o = ordreIndiv(); return { sans: !o.some(k => k.split(".")[1] === D), n: o.length }; }, D);
    ok(suite.sans && suite.n > 0, "saisie au clavier : les cours d'absence sont sautés");
    await p.focus(`input[data-ir="0.${D}.${ps[0]}"]`); await p.keyboard.type("Malade"); await p.keyboard.press("Enter"); await wait(150);
    ok(await p.evaluate(() => (document.activeElement.dataset.ic || "").includes("2026-11-18")), "Entrée dans la remarque d'un cours d'absence : premier cours du jour suivant");
    ok((await etat(D, ps[0])).ind && (await etat(D, ps[0])).rem === "Malade", "la remarque d'un cours d'absence est gardée");
    ok(await p.evaluate(() => { const i = S.individuels[0], c = cyclesIndiv(i).find(c => c.fin === "2026-11-20"); return /Absences/.test(bilanFamilleHTML(i, c)) && /Absences : mardi 17\/11/.test(bilanCourriel(i, c, false)) && /mardi 17\/11/.test(bilanCourriel(i, c, true)) && /absent\(e\)/.test(indivHTML(i, c, false)); }), "bilan pour la famille, courriel (texte et mis en forme) et fiche imprimée disent l'absence");
    ok(await p.evaluate(() => /absence/i.test(decrireChangement({ ...S, individuels: S.individuels.map(i => ({ ...i, abs: {} })) }, S))), "Ctrl+Z nomme l'absence");

    // 2. un cours, par la matière : présent(e), puis absent(e)
    const q1 = ps[1];
    await p.click(`td[data-crn="${D}|${q1}"][data-crni="0"]`); await wait(300);
    ok(await p.evaluate(() => document.querySelector("#boite #crn-el").checked), "clic sur la matière : « absent(e) à ce cours » est coché");
    await p.click("#boite #crn-el"); await oui();
    let e = await etat(D, q1);
    ok(!e.ind && !e.coll && e.cl === "" && (await etat(D, ps[0])).ind, "décoché : présent à ce cours sur les trois fiches, absent aux autres");
    await p.click(`td[data-ic="0.${D}.${q1}.0"]`, { button: "right" }); await wait(350);
    e = await etat(D, q1); ok(e.ind && e.coll && (!e.actif || e.cl === "A"), "clic droit sur un code : absent à ce cours, sur les trois fiches");
    await p.click(`td[data-iabs="0.${D}.${q1}"]`, { button: "right" }); await wait(350);
    e = await etat(D, q1); ok(!e.ind && !e.coll && e.cl === "", "clic droit sur « absent(e) » : présent");
    await p.click(`td[data-iabs="0.${D}.${ps[0]}"]`); await wait(300);
    ok(await boite("#crn-el"), "clic sur « absent(e) » : la fenêtre du cours"); await non();
    // Présent(e) toute la journée
    await p.click(`th[data-jabs="0|${D}"]`); await wait(300); await p.click('#boite [data-absq=""]'); await oui();
    const z = []; for (const q of ps) z.push(await etat(D, q)); ok(z.every(x => !x.ind && !x.coll && !x.cl.includes("A")), "« Présent(e) » : plus aucune absence, sur les trois fiches");

    // 3. depuis la fiche collective
    await demo(); await go("#fiche/" + D);
    const s = await p.evaluate(() => S.eleves.findIndex(e => e.nom === "BRIDGE Michael"));
    await p.select(`select[data-eabs="${s}"]`, "matin"); await wait(350);
    ok(/fiche individuelle \(BRIDGE Michael\)/.test(await boite()), "fiche collective, « le matin » : la confirmation nomme la fiche individuelle"); await oui();
    const mat = []; for (const q of ps.filter(q => q < 4 || q === 7)) mat.push(await etat(D, q));
    ok(mat.length > 1 && mat.every(x => x.ind && x.coll && (!x.actif || x.cl === "A")), "le matin, depuis la fiche collective : absent sur les trois fiches");
    ok(await p.evaluate(() => { const i = S.individuels[0]; return /mardi 17\/11 \(le matin\)/.test(absencesTxt(i, cyclesIndiv(i).find(c => c.fin === "2026-11-20"))); }), "la fiche individuelle dit « le matin »");
    await p.select(`select[data-eabs="${s}"]`, ""); await wait(350);
    const mt = []; for (const q of ps) mt.push(await etat(D, q)); ok(mt.every(x => !x.ind && !x.coll && !x.cl.includes("A")), "« présent(e) » : retirée partout");

    // 4. depuis la fiche de classe : palette, refus, clavier
    await demo(); await go("#classesem/3");
    const c = await p.evaluate(() => S.classeEleves.findIndex(e => e.nom === "BRIDGE Michael")), cell = `td[data-cl="${c}.${ps[0]}"][data-d="${D}"]`;
    const cl0 = (await etat(D, ps[0])).cl;
    await p.click('[data-pal-cl="A"]'); await wait(250); await p.click(cell); await wait(350);
    ok(/fiche individuelle/.test(await boite()), "fiche de classe, code absent : confirmation (codes ailleurs)"); await non();
    e = await etat(D, ps[0]); ok(e.cl === cl0 && e.codes && !e.ind, "refus : la case reprend son code, rien ne change ailleurs");
    await p.click(cell); await wait(350); await oui();
    e = await etat(D, ps[0]); ok(e.cl === "A" && e.ind && e.coll && !e.codes && !e.croix, "accepté : absent sur les trois fiches");
    await p.click('[data-pal-cl="-"]'); await wait(250); await p.click(cell); await wait(350);
    e = await etat(D, ps[0]); ok(e.cl === "" && !e.ind && !e.coll, "gomme : présent sur les trois fiches");
    // élève sans suivi : aucune question
    const c2 = await p.evaluate(() => S.classeEleves.findIndex(e => !S.eleves.some(x => x.nom === e.nom) && !S.individuels.some(x => x.nom === e.nom)));
    await p.click('[data-pal-cl="A"]'); await wait(250); await p.click(`td[data-cl="${c2}.${ps[0]}"][data-d="${D}"]`); await wait(350);
    ok(!(await boite()) && await p.evaluate((D, k) => S.jours[D].cl[k] === "A", D, `${c2}.${ps[0]}`), "élève sans suivi : noté sans question");

    // 5. absences notées ailleurs AVANT la v1.94.0 : lues, sans rien changer aux résultats
    await demo();
    const anc = await p.evaluate((D, ps) => { const i = S.individuels[0], cy = cyclesIndiv(i).find(c => c.fin === "2026-11-20"), s = S.eleves.findIndex(e => e.nom === i.nom), r0 = JSON.stringify(statsIndiv(i, cy));
      delete i.saisies[`${D}.${ps[1]}`]; const r1 = JSON.stringify(statsIndiv(i, cy)); jour(S, D, true).abs[s] = [ps[0], ps[1]]; const r2 = JSON.stringify(statsIndiv(i, cy));
      return { vide: absIndiv(S, i, D, ps[1]), note: absIndiv(S, i, D, ps[0]), egal: r1 === r2, change: r0 !== r1 }; }, D, ps);
    ok(anc.vide && !anc.note && anc.egal, "absence collective d'avant : lue sur un cours vide, jamais à la place de codes saisis, résultats inchangés " + JSON.stringify(anc));
    // 6. enregistrement relu, valeurs illisibles écartées ; ancien suivi sans absences
    const n = await p.evaluate(() => { const x = JSON.parse(JSON.stringify(S)); x.individuels[0].abs = { "2026-11-17": [2, 0, 2, "x", 99, -1], "bidon": [1], "2026-11-18": "jour" }; delete x.individuels[1].abs;
      const y = normalizeState(x); return [JSON.stringify(y.individuels[0].abs), JSON.stringify(y.individuels[1].abs), JSON.stringify(normalizeState(JSON.parse(JSON.stringify(y))).individuels.map(i => i.abs)) === JSON.stringify(y.individuels.map(i => i.abs))]; });
    ok(n[0] === '{"2026-11-17":[0,2]}' && n[1] === "{}" && n[2], "relecture : " + n.join(" "));
    // 7. les tailles d'écran, 1 à 4 objectifs : la case tient et les lignes gardent leur hauteur
    for (const [w, h] of [[1024, 768], [1366, 768]]) for (const no of [1, 2, 3, 4]) {
      await p.setViewport({ width: w, height: h });
      const r = await p.evaluate((no, D, ps) => { const i = S.individuels[0]; i.objectifs = ["Un", "Deux", "Trois", "Quatre"].slice(0, no); i.abs = {}; location.hash = "#indiv"; return 1; }, no, D, ps); await wait(200);
      await go("#indiv/demo-bridge:2026-11-20");
      const h0 = await p.evaluate((D, q) => document.querySelector(`td[data-crn="${D}|${q}"]`).getBoundingClientRect().height, D, ps[0]);
      await p.evaluate((D, ps) => { poserAbsences(ps.map(q => ({ nom: S.individuels[0].nom, d: D, p: q })), true); commit(); }, D, ps); await wait(350);
      const m = await p.evaluate((D, q) => { const t = document.querySelector(`td[data-iabs="0.${D}.${q}"]`); return { h: document.querySelector(`td[data-crn="${D}|${q}"]`).getBoundingClientRect().height, coupe: t.scrollWidth > t.clientWidth + 1, t: t.textContent }; }, D, ps[0]);
      ok(Math.abs(m.h - h0) < 1 && !m.coupe, `${w} px, ${no} objectif(s) : « ${m.t} » tient dans sa case ${r && JSON.stringify(m)}`);
    }
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5 }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
