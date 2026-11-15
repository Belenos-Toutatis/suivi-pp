// Fiches individuelles : règle de retenue (n « TI » sur la fiche = h heures ; fiche non rendue = h heures), commune ou propre à un suivi,
// annoncée sur la fiche imprimée, la page du suivi, la carte, le bilan pour la famille et le courriel. L'application ne pose rien elle-même.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };

  // ----- sans règle : nouveau suivi et ancien fichier -----
  ok(await p.evaluate(() => { const n = normalizeState({}); return n.retenueIndiv.i === 0 && n.retenueIndiv.nonRendue === 0; }), "nouveau suivi : aucune règle de retenue par défaut");
  ok(await p.evaluate(() => { const n = normalizeState({ individuels: [{ nom: "X", objectifs: ["a"] }] }); return n.retenueIndiv.i === 0 && n.individuels[0].retenue === null && JSON.stringify(n.individuels[0].nonRendues) === "{}"; }), "ancien fichier : pas de règle, pas de fiche non rendue");
  ok(await p.evaluate(() => { const n = normalizeState({ retenueIndiv: { i: "99", heures: -3, nonRendue: "x" }, individuels: [{ nom: "X", objectifs: ["a"], retenue: { i: 2.6 }, nonRendues: { "2026-11-20": true, "pas une date": true, "2026-11-27": "oui" } }] });
    return n.retenueIndiv.i === 20 && n.retenueIndiv.heures === 1 && n.retenueIndiv.nonRendue === 0 && n.individuels[0].retenue.i === 3 && Object.keys(n.individuels[0].nonRendues).join() === "2026-11-20"; }), "fichier abîmé : valeurs bornées, seules les vraies dates « true » gardées");

  await p.evaluate(() => doDemo()); await wait(200);
  // ----- démonstration : 3 « TI » = 1 heure, fiche non rendue = 1 heure -----
  const calc = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), cy = cyclesIndiv(ind);
    return cy.map(c => { const x = retenueFiche(ind, c), nI = statsIndiv(ind, c).reduce((a, s) => a + s[2], 0); return { nI, hI: x.hI, attendu: Math.floor(nI / 3) }; }); });
  ok(calc.length > 2 && calc.every(x => x.hI === x.attendu), `BRIDGE : heures = paliers de 3 « TI » sur chaque fiche (${calc.map(x => `${x.nI} I → ${x.hI} h`).join(", ")})`);
  ok(calc.some(x => x.hI > 0), "au moins une fiche de la démonstration avec une retenue");
  // ----- plafond par fiche (v1.86.0) -----
  const pl = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).hI > 2), x = retenueFiche(ind, c);
    const ph = phraseRetenue(ind, c); S.retenueIndiv.max = 0; const sans = retenueFiche(ind, c).total; S.retenueIndiv.max = 2; return { x, ph, sans }; });
  ok(pl.x.total === 2 && pl.x.plafond && pl.sans === pl.x.brut && pl.x.brut > 2, `plafond de 2 heures : ${pl.x.brut} h ramenées à 2 ; sans plafond (0) : ${pl.sans} h`);
  ok(/Retenue prévue : 2 heures \(\d+ « TI » sur la fiche ; plafond de la fiche atteint, la règle en donnerait \d+\)\./.test(pl.ph), `phrase : « ${pl.ph} »`);
  ok(await p.evaluate(() => normalizeState({ retenueIndiv: { i: 3 } }).retenueIndiv.max === 2 && normalizeState({ retenueIndiv: { max: 99 } }).retenueIndiv.max === 12 && normalizeState({ retenueIndiv: { max: 0 } }).retenueIndiv.max === 0), "plafond : 2 heures si absent, borné à 12, 0 = pas de plafond");
  const pd = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"), c = cyclesIndiv(ind).find(x => x.fin === "2026-11-20"), x = retenueFiche(ind, c); return { x, ph: phraseRetenue(ind, c) }; });
  ok(pd.x.nonRendue && pd.x.hNR === 1 && pd.x.total === 1 && pd.ph === "Retenue prévue : 1 heure (fiche non rendue le jour de remise).", `PODEANU, fiche du 20/11 non rendue : « ${pd.ph} »`);

  // ----- fiche imprimée : la règle sous la consigne -----
  await go("#indiv/demo-bridge");
  ok(await p.$eval(".f-consigne", e => /Attention\s*:\s*3\s*«\s*TI\s*»\s*sur la fiche = 1 heure de retenue · fiche non rendue le jour de remise = 1 heure de retenue · 2 heures au plus par fiche\./.test(e.innerText)), "fiche : « Attention : 3 « TI » sur la fiche = 1 heure de retenue · fiche non rendue… · 2 heures au plus par fiche »");

  // ----- page du suivi : phrase, case « non rendue » -----
  const finB = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), cy = cyclesIndiv(ind); return cy.find(c => retenueFiche(ind, c).hI > 0).fin; });
  await go("#indiv/demo-bridge:" + finB);
  ok(await p.evaluate(() => { const r = document.querySelector(".retenue-ind"); return !!r && /Retenue prévue\s*:\s*\d+ heures? \(\d+\s*«\s*TI\s*»\s*sur la fiche\s*[;)]/.test(r.innerText) && !!r.querySelector(".ret-oui") && !!r.closest(".no-print"); }), "page du suivi : « ⚠ Retenue prévue : … (n « TI » sur la fiche) », écran seulement");
  await p.click('input[data-nr^="0|"]'); await wait(300);
  ok(await p.evaluate(fin => S.individuels[0].nonRendues[fin] === true && retenueFiche(S.individuels[0], cyclesIndiv(S.individuels[0]).find(c => c.fin === fin)).hNR === 1 && /fiche non rendue/.test(document.querySelector(".retenue-ind").innerText), finB), "case « Fiche non rendue » cochée : une heure de plus, dite dans la phrase");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  ok(await p.evaluate(fin => !S.individuels[0].nonRendues[fin], finB), "Ctrl+Z : la fiche redevient rendue");

  // ----- bilan pour la famille et courriel -----
  ok(await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin); return /<h3>Retenue<\/h3><p class="bf-retenue">Retenue prévue/.test(bilanFamilleHTML(ind, c)); }, finB), "bilan pour la famille (PDF) : partie « Retenue »");
  ok(await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin), m = S.courrielIndiv; return texteCourriel(m.texte, ind, c).includes("Retenue prévue") && texteCourriel(m.texte, ind, c, true).includes("<b>Retenue prévue"); }, finB), "courriel (texte et mis en forme) : la retenue prévue");
  ok(await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total === 0 && statsIndiv(ind, x).some(s => s[1])); return !c || (!bilanFamilleHTML(ind, c).includes("<h3>Retenue</h3>") && !texteCourriel(S.courrielIndiv.texte, ind, c).includes("Retenue")); }), "fiche sans retenue : rien dans le bilan ni le courriel");

  // ----- carte -----
  await go("#indiv");
  ok(await p.evaluate(() => [...document.querySelectorAll(".ind-carte")].every(a => { const ind = S.individuels.find(i => a.getAttribute("href") === "#indiv/" + i.id), cy = cyclesIndiv(ind), r = cy.filter(c => remiseCycle(c) <= aujourdhui()).pop(), t = r ? retenueFiche(ind, r).total : 0;
    return t ? (a.querySelector(".ic-ret") || {}).textContent === `⚠ retenue ${t} h` : !a.querySelector(".ic-ret"); })), "cartes : « ⚠ retenue n h » pour la dernière fiche remise, rien sinon");

  // ----- règle propre à un suivi -----
  await go("#indiv/demo-mostowski"); await p.evaluate(() => { document.querySelector("details.reg-ind").open = true; }); await wait(150);
  await p.click('input[data-ret-propre="1"]'); await wait(300);
  ok(await p.evaluate(() => JSON.stringify(S.individuels[1].retenue) === JSON.stringify(S.retenueIndiv)), "« Règle propre » cochée : part de la règle des réglages");
  await p.evaluate(() => { document.querySelector("details.reg-ind").open = true; }); await wait(100);
  await p.$eval('input[data-num="individuels.1.retenue.i"]', e => { e.value = "2"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  await p.$eval('input[data-num="individuels.1.retenue.nonRendue"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.individuels[1].retenue.i === 2 && S.individuels[1].retenue.nonRendue === 0 && S.retenueIndiv.i === 3 && regleRetenueIndiv(S.individuels[1]) === "2 « TI » sur la fiche = 1 heure de retenue · 2 heures au plus par fiche"), "règle propre : 2 « TI » = 1 heure, sans retenue pour une fiche non rendue ; celle des réglages inchangée");
  ok(await p.$eval(".f-consigne", e => /Attention\s*:\s*2\s*«\s*TI\s*»/.test(e.innerText) && !/non rendue/.test(e.innerText)), "fiche de ce suivi : sa règle imprimée");
  await go("#reglages/suivisIndiv");
  ok(await p.evaluate(() => /règle propre\s*:\s*MOSTOWSKI Michał \(2\s*«\s*TI\s*»\s*sur la fiche = 1 heure de retenue · 2 heures au plus par fiche\)/.test(document.body.innerText)), "Réglages : le suivi à règle propre est listé");
  // règle commune modifiée : le suivi à règle propre ne bouge pas
  await p.$eval('input[data-num="retenueIndiv.i"]', e => { e.value = "4"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.retenueIndiv.i === 4 && S.individuels[1].retenue.i === 2 && regleRetenueIndiv(S.individuels[0]).startsWith("4 « TI »")), "règle des réglages à 4 : BRIDGE suit, MOSTOWSKI garde la sienne");
  await p.$eval('input[data-num="retenueIndiv.i"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  await p.$eval('input[data-num="retenueIndiv.nonRendue"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => regleRetenueIndiv(S.individuels[0]) === "" && !/Attention/.test(indivHTML(S.individuels[0], cyclesIndiv(S.individuels[0])[0], false))), "plus de règle : rien d’imprimé sur la fiche");

  // ----- impression : la ligne de la règle ne fait pas déborder la fiche (4 objectifs, consigne la plus longue, tous les créneaux) -----
  { const { execSync } = require("child_process"), OUT = DIR + "/sorties/impr"; fs.mkdirSync(OUT, { recursive: true });
    const pdf = async (name, pages) => { await p.evaluate(h => { document.querySelector("#print-area").innerHTML = h.map(x => `<div class="page sheet">${x}</div>`).join(""); }, pages);
      await p.emulateMediaType("print"); await p.pdf({ path: `${OUT}/${name}.pdf`, landscape: true, format: "A4", printBackground: true, preferCSSPageSize: true }); await p.emulateMediaType("screen");
      return { n: Number(execSync(`pdfinfo "${OUT}/${name}.pdf" | grep Pages | awk '{print $2}'`).toString()), txt: execSync(`pdftotext "${OUT}/${name}.pdf" -`).toString() }; };
    await p.evaluate(() => { S.retenueIndiv = { i: 3, heures: 1, nonRendue: 1 }; const ind = S.individuels[0]; ind.retenue = null; ind.objectifs = ["Je travaille sans bavarder.", "J’écoute les consignes en silence.", "Je termine le travail écrit demandé en classe.", "Je note les devoirs dans mon agenda."];
      ind.saisies = Object.fromEntries(Object.entries(ind.saisies).map(([k, v]) => [k, { c: [v.c[0], v.c[1], v.c[2], 3], r: v.r }])); ind.consigne = S.consignesIndiv.findIndex(m => m.label === "Dernier enseignant, chaque soir") + 1; });
    for (const tous of [false, true]) { await p.evaluate(t => { S.creneauMidi = t; S.creneauS4 = t; S.creneauS5 = t; }, tous);
      const r = await pdf(`retenue-fiche${tous ? "-tous" : ""}`, await p.evaluate(() => { const ind = S.individuels[0]; return [indivHTML(ind, cyclesIndiv(ind)[1], false)]; }));
      ok(r.n === 1 && /Attention/.test(r.txt) && /non rendue/.test(r.txt), `fiche imprimée, 4 objectifs, consigne de 3 lignes et règle${tous ? ", tous les créneaux" : ""} : ${r.n} page`); }
    await p.evaluate(() => { S.creneauMidi = false; S.creneauS4 = false; S.creneauS5 = false; });
    const rf = await pdf("retenue-famille", await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total); return [bilanFamilleHTML(ind, c), indivHTML(ind, c, false, true)]; }));
    ok(rf.n === 2 && /Retenue prévue/.test(rf.txt), `bilan pour la famille avec la retenue : ${rf.n} pages`); }

  // ----- changement du jour de remise : la marque « non rendue » suit sa fiche -----
  await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"); const av = cyclesIndiv(ind); ind.remise = 4; recalerBilans(ind, av); });
  ok(await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"), k = Object.keys(ind.nonRendues); return k.length === 1 && k[0] === "2026-11-19" && cyclesIndiv(ind).some(c => c.fin === k[0]); }), "remise passée au jeudi : la fiche non rendue du vendredi 20/11 devient celle du jeudi 19/11");

  await go("#indiv/demo-bridge:" + finB); await p.screenshot({ path: DIR + "/sorties/retenue-indiv.png" });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
