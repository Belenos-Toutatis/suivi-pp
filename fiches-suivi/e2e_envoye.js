// Case « Bilan envoyé » d'une fiche individuelle (arbitré le 2026-11-22 : « il ne faut pas modifier les fiches passées une fois que
// le bilan a été envoyé »). Cochée, la fiche garde la règle de retenue du moment : changer la règle ensuite (réglages, ou règle propre
// au suivi) ne recalcule plus sa retenue, nulle part (page, bilan pour la famille, courriel, fiche imprimée). Décochée, elle suit de
// nouveau la règle actuelle. Les fiches non cochées suivent toujours la règle actuelle. Noms de la démonstration.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await require("./boites")(p);
    await p.setViewport({ width: 1366, height: 900 });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
    await p.evaluate(() => { doDemo(); window.aujourdhui = () => "2026-11-25"; }); await wait(400);
    const A = { i: 3, heures: 1, nonRendue: 1, max: 2, reussite: 75, hReussite: 1 }, B = { i: 1, heures: 2, nonRendue: 2, max: 0, reussite: 95, hReussite: 3 };
    const etat = () => p.evaluate(() => { const ind = S.individuels[0], cy = cyclesIndiv(ind), c1 = cy[1], c2 = cy[2];
      return { t1: retenueFiche(ind, c1).total, t2: retenueFiche(ind, c2).total, ph2: phraseRetenue(ind, c2), regle2: regleRetenueEleve(ind, c2), regle1: regleRetenueEleve(ind, c1),
        fiche2: indivHTML(ind, c2, false).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Attention :[^.]*\.[^.]*\./)?.[0] || "", famille2: bilanFamilleHTML(ind, c2).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
        courriel2: decodeURIComponent(courrielFamille(Object.assign({}, ind, { courriel: "famille@example.org" }), c2)), env: JSON.parse(JSON.stringify(ind.envoyes || {})), fin2: c2.fin }; });
    await p.evaluate(a => { S.retenueIndiv = a; const ind = S.individuels[0]; ind.retenue = null; commit(); location.hash = "#indiv/" + ind.id + ":" + cyclesIndiv(ind)[2].fin; }, A); await wait(450);
    const avant = await etat();
    ok(Object.keys(avant.env).length === 0, "au départ, aucune fiche n'est marquée envoyée");
    // 1. cocher « Bilan envoyé » sur la fiche affichée
    const coche = await p.evaluate(() => { const c = document.querySelector("input[data-envoye]"); if (!c) return null; c.click(); return c.dataset.envoye; });
    await wait(350);
    let e = await etat();
    ok(!!coche && e.env[e.fin2] && e.env[e.fin2].le === "2026-11-25" && JSON.stringify(e.env[e.fin2].regle) === JSON.stringify(A), "case cochée : la fiche garde la date et la règle du moment " + JSON.stringify(e.env));
    ok(await p.evaluate(() => { const c = document.querySelector("input[data-envoye]"); return !!c && c.checked && /25\/11/.test(c.closest("li").innerText) && /figée/.test(c.closest("li").innerText); }), "la page le dit : « le 25/11 · règle de retenue figée »");
    // 2. la règle des réglages change : la fiche envoyée ne bouge pas, les autres suivent
    await p.evaluate(bb => { S.retenueIndiv = bb; commit(); }, B); await wait(350);
    e = await etat();
    ok(e.t2 === avant.t2 && e.ph2 === avant.ph2, `fiche envoyée : retenue inchangée après le changement de règle (${e.t2} h — « ${e.ph2} »)`);
    ok(e.t1 !== avant.t1 || e.regle1 !== avant.regle1, `fiche non envoyée : elle suit la règle actuelle (${avant.t1} h → ${e.t1} h)`);
    ok(e.regle2 === avant.regle2 && e.regle1 !== avant.regle1, "la règle écrite pour l'élève : figée sur la fiche envoyée, actuelle sur l'autre");
    ok(e.fiche2 && e.fiche2 === avant.fiche2, "fiche imprimée : la ligne « Attention : » de la fiche envoyée est celle d'alors — " + e.fiche2);
    ok(e.famille2.includes(avant.ph2) && e.courriel2.includes(avant.ph2.slice(0, 30)), "bilan pour la famille et courriel : la même phrase qu'à l'envoi");
    ok(await p.evaluate(() => /a changé depuis/.test(document.querySelector("input[data-envoye]").closest("li").innerText)), "la page signale que la règle a changé depuis");
    // 3. une règle propre au suivi ne la recalcule pas non plus
    await p.evaluate(() => { S.individuels[0].retenue = { i: 1, heures: 4, nonRendue: 4, max: 0, reussite: 99, hReussite: 4 }; commit(); }); await wait(300);
    e = await etat();
    ok(e.t2 === avant.t2, "règle propre au suivi posée après coup : la fiche envoyée ne bouge pas");
    // 4. enregistrée, relue : rien de perdu ; une entrée illisible est écartée
    const relu = await p.evaluate(() => { const n = normalizeState(JSON.parse(JSON.stringify(S))); const m = JSON.parse(JSON.stringify(S)); m.individuels[0].envoyes = { "pas-une-date": { le: "x" }, "2026-11-20": "oui" }; const mauvais = normalizeState(m);
      return { garde: JSON.stringify(n.individuels[0].envoyes), ecarte: JSON.stringify(mauvais.individuels[0].envoyes), ancien: JSON.stringify(normalizeState({ individuels: [{ nom: "X", objectifs: ["a"] }] }).individuels[0].envoyes) }; });
    ok(relu.garde === JSON.stringify(e.env) && relu.ecarte === "{}" && relu.ancien === "{}", "relecture : l'envoi est gardé, une entrée illisible écartée, un suivi d'avant n'en a aucun " + JSON.stringify(relu));
    // 5. décochée : la fiche suit de nouveau la règle actuelle
    await p.evaluate(() => { location.hash = "#indiv/" + S.individuels[0].id + ":" + cyclesIndiv(S.individuels[0])[2].fin; }); await wait(350);
    await p.evaluate(() => document.querySelector("input[data-envoye]").click()); await wait(350);
    e = await etat();
    const attendu = await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind)[2], st = statsIndiv(ind, c), nI = st.reduce((a, x) => a + x[2], 0); return Math.floor(nI / 1) * 4; });
    ok(Object.keys(e.env).length === 0 && e.t2 !== avant.t2 && e.t2 >= attendu, `case décochée : la fiche suit la règle actuelle (${avant.t2} h → ${e.t2} h)`);
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
