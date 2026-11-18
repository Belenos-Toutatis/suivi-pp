// Fiches individuelles : règle de retenue (n « TI » sur la fiche = h heures ; réussite sous un seuil = h heures ; fiche perdue = h heures par perte, chaque perte datée), commune ou propre à un suivi,
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
  ok(await p.evaluate(() => { const n = normalizeState({ individuels: [{ nom: "X", objectifs: ["a"] }] }); return n.retenueIndiv.i === 0 && n.individuels[0].retenue === null && JSON.stringify(n.individuels[0].pertes) === "[]"; }), "ancien fichier : pas de règle, aucune perte");
  ok(await p.evaluate(() => { const n = normalizeState({ retenueIndiv: { i: "99", heures: -3, nonRendue: "x" }, individuels: [{ nom: "X", objectifs: ["a"], retenue: { i: 2.6 }, pertes: ["2026-11-19", "2026-11-17", "2026-11-17", "pas une date", 3] }] });
    return n.retenueIndiv.i === 20 && n.retenueIndiv.heures === 1 && n.retenueIndiv.nonRendue === 0 && n.individuels[0].retenue.i === 3 && n.individuels[0].pertes.join() === "2026-11-17,2026-11-19"; }), "fichier abîmé : valeurs bornées ; pertes triées, sans doublon, seules les vraies dates gardées");
  ok(await p.evaluate(() => { const n = normalizeState({ individuels: [{ nom: "X", objectifs: ["a"], nonRendues: { "2026-11-20": true, "2026-11-27": "oui", "x": true }, pertes: ["2026-11-10"] }] }).individuels[0];
    return n.pertes.join() === "2026-11-10,2026-11-20" && !("nonRendues" in n); }), "fichier v1.85-v1.89 : la case « fiche perdue » devient une perte datée du dernier jour de la fiche"); 

  await p.evaluate(() => doDemo()); await wait(200);
  // ----- démonstration : 3 « TI » = 1 heure, réussite sous 75 % = 1 heure, fiche perdue = 1 heure -----
  const calc = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), cy = cyclesIndiv(ind);
    return cy.map(c => { const x = retenueFiche(ind, c), nI = statsIndiv(ind, c).reduce((a, s) => a + s[2], 0); return { nI, hI: x.hI, attendu: Math.floor(nI / 3) }; }); });
  ok(calc.length > 2 && calc.every(x => x.hI === x.attendu), `BRIDGE : heures = paliers de 3 « TI » sur chaque fiche (${calc.map(x => `${x.nI} I → ${x.hI} h`).join(", ")})`);
  ok(calc.some(x => x.hI > 0), "au moins une fiche de la démonstration avec une retenue");
  // ----- réussite sous un seuil (v1.88.0) : strictement sous le seuil, sur la réussite arrondie comme elle s'affiche -----
  const re = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), cy = cyclesIndiv(ind), sauve = S.retenueIndiv;
    const tous = cy.map(c => { const x = retenueFiche(ind, c); return { pct: x.pct, hR: x.hR }; });
    const c = cy.find(x => retenueFiche(ind, x).pct !== null), pct = retenueFiche(ind, c).pct;
    S.retenueIndiv = { i: 0, heures: 1, nonRendue: 0, max: 2, reussite: pct, hReussite: 1 }; const pile = retenueFiche(ind, c).hR;
    S.retenueIndiv = { ...S.retenueIndiv, reussite: pct + 1 }; const sous = retenueFiche(ind, c).hR, ph = phraseRetenue(ind, c);
    S.retenueIndiv = { ...S.retenueIndiv, hReussite: 0 }; const off = retenueFiche(ind, c).hR; S.retenueIndiv = sauve;
    const n = normalizeState({ retenueIndiv: { i: 2 } }).retenueIndiv, n2 = normalizeState({ retenueIndiv: { reussite: 0, hReussite: 9 } }).retenueIndiv;
    return { tous, pct, pile, sous, ph, off, def: [n.reussite, n.hReussite], borne: [n2.reussite, n2.hReussite] }; });
  ok(re.tous.every(x => x.hR === (x.pct !== null && x.pct < 75 ? 1 : 0)), `BRIDGE : 1 heure pour chaque fiche sous 75 % (${re.tous.map(x => `${x.pct} % → ${x.hR} h`).join(", ")})`);
  ok(re.pile === 0 && re.sous === 1, `seuil = ${re.pct} % pile : pas de retenue ; seuil à ${re.pct + 1} % : 1 heure`);
  ok(new RegExp(`réussite de ${re.pct} %, sous le seuil de ${re.pct + 1} %`).test(re.ph), `phrase : « ${re.ph} »`);
  ok(re.off === 0, "0 heure : critère désactivé");
  ok(re.def.join() === "75,0" && re.borne.join() === "1,4", "ancienne règle : seuil 75 %, critère désactivé ; fichier abîmé : seuil ≥ 1 %, 4 heures au plus");
  // ----- plafond par fiche (v1.86.0) -----
  const pl = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).hI > 2), x = retenueFiche(ind, c);
    const ph = phraseRetenue(ind, c); S.retenueIndiv.max = 0; const sans = retenueFiche(ind, c).total; S.retenueIndiv.max = 2; return { x, ph, sans }; });
  ok(pl.x.total === 2 && pl.x.plafond && pl.sans === pl.x.brut && pl.x.brut > 2, `plafond de 2 heures : ${pl.x.brut} h ramenées à 2 ; sans plafond (0) : ${pl.sans} h`);
  ok(/Retenue prévue : 2 heures \(\d+ « TI » sur la fiche ; .*plafond de la fiche atteint, la règle en donnerait \d+\)\./.test(pl.ph), `phrase : « ${pl.ph} »`);
  ok(await p.evaluate(() => normalizeState({ retenueIndiv: { i: 3 } }).retenueIndiv.max === 2 && normalizeState({ retenueIndiv: { max: 99 } }).retenueIndiv.max === 12 && normalizeState({ retenueIndiv: { max: 0 } }).retenueIndiv.max === 0), "plafond : 2 heures si absent, borné à 12, 0 = pas de plafond");
  const pd = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"), c = cyclesIndiv(ind).find(x => x.fin === "2026-11-20"), x = retenueFiche(ind, c); return { x, ph: phraseRetenue(ind, c) }; });
  ok(pd.x.pertes.join() === "2026-11-17,2026-11-19" && pd.x.hNR === 2 && /fiche perdue 2 fois : mardi 17\/11 et jeudi 19\/11/.test(pd.ph) && pd.x.total === 2, `PODEANU, perdue mardi et jeudi : 2 heures pour les pertes (une par perte, dans le plafond) — « ${pd.ph} »`);

  // ----- fiche imprimée : la règle sous la consigne -----
  await go("#indiv/demo-bridge");
  ok(await p.$eval(".f-consigne", e => /Attention\s*:\s*3\s*«\s*TI\s*»\s*sur la fiche = 1 heure de retenue · réussite de la fiche sous 75\s*% = 1 heure de retenue · fiche perdue = 1 heure de retenue par perte · 2 heures au plus par fiche\./.test(e.innerText)), "fiche : « Attention : 3 « TI » sur la fiche = 1 heure de retenue · fiche non rendue… · 2 heures au plus par fiche »");

  // ----- page du suivi : phrase, case « fiche perdue » -----
  const finB = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"), cy = cyclesIndiv(ind); return cy.find(c => retenueFiche(ind, c).hI > 0).fin; });
  await go("#indiv/demo-bridge:" + finB);
  ok(await p.evaluate(() => { const r = document.querySelector(".retenue-ind"); return !!r && /Retenue prévue\s*:\s*\d+ heures? \(\d+\s*«\s*TI\s*»\s*sur la fiche\s*[;)]/.test(r.innerText) && !!r.querySelector(".ret-oui") && !!r.closest(".no-print"); }), "page du suivi : « ⚠ Retenue prévue : … (n « TI » sur la fiche) », écran seulement");
  const jr = await p.evaluate(() => document.getElementById("perte-jour-0").value);
  await p.click('button[data-perte-add="0"]'); await wait(300);
  ok(await p.evaluate((fin, jr) => S.individuels[0].pertes.includes(jr) && retenueFiche(S.individuels[0], cyclesIndiv(S.individuels[0]).find(c => c.fin === fin)).hNR === 1 && /fiche perdue le \S+ \d\d\/\d\d/.test(document.querySelector(".retenue-ind").innerText), finB, jr), `« + Perte ce jour-là » (${jr}) : une perte datée, une heure de plus, dite dans la phrase`);
  ok(await p.evaluate(jr => !document.querySelector(`#perte-jour-0 option[value="${jr}"]`) && !!document.querySelector(`[data-perte-del="0|${jr}"]`), jr), "le jour noté sort de la liste et se retire par ✕");
  await p.select("#perte-jour-0", await p.evaluate(() => document.querySelector("#perte-jour-0 option").value)); await p.click('button[data-perte-add="0"]'); await wait(300);
  ok(await p.evaluate(fin => { const ind = S.individuels[0], x = retenueFiche(ind, cyclesIndiv(ind).find(c => c.fin === fin)); return x.pertes.length === 2 && x.hNR === 2 && /2 fois :/.test(phraseRetenue(ind, cyclesIndiv(ind).find(c => c.fin === fin))); }, finB), "deux pertes la même semaine : deux heures (une par perte)");
  ok(await p.evaluate(() => /Depuis le début du suivi\s*:\s*2 pertes/.test(document.querySelector(".retenue-ind").innerText)), "cumul depuis le début du suivi : 2 pertes, avec leurs dates");
  await p.click(`[data-perte-del="0|${jr}"]`); await wait(300);
  ok(await p.evaluate(jr => !S.individuels[0].pertes.includes(jr) && S.individuels[0].pertes.length === 1, jr), "✕ : la perte est retirée");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  ok(await p.evaluate(jr => S.individuels[0].pertes.includes(jr), jr), "Ctrl+Z : la perte retirée revient");
  await p.evaluate(() => { S.individuels[0].pertes = []; commit(); }); await wait(200);

  // ----- bilan pour la famille et courriel -----
  ok(await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin), h = bilanFamilleHTML(ind, c); return /<h3>Bilan du professeur principal<\/h3><div class="bf-bilan"><p class="bil-ret">Retenue prévue/.test(h) && !/<h3>Retenue<\/h3>/.test(h); }, finB), "bilan pour la famille (PDF) : la retenue en première ligne du bilan du professeur principal");
  ok(await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin), m = S.courrielIndiv; return texteCourriel(m.texte, ind, c).includes("Retenue prévue") && texteCourriel(m.texte, ind, c, true).includes("<b>Retenue prévue"); }, finB), "courriel (texte et mis en forme) : la retenue prévue");
  ok(await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total === 0 && statsIndiv(ind, x).some(s => s[1])); return !c || (/<p class="bil-ret">Pas de retenue/.test(bilanFamilleHTML(ind, c)) && texteCourriel(S.courrielIndiv.texte, ind, c).includes("Pas de retenue")); }), "fiche sans retenue, règle réglée : « Pas de retenue … » en tête du bilan et dans le courriel");
  // ligne automatique en tête du bilan (v1.91.0) : sur la fiche, mise à jour à chaque code, « en cours » avant le jour de remise
  ok(await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin), t = (document.querySelector("table.indiv-pied .bil-ret") || {}).textContent || "";
    const sp = x => x.replace(/[\u202F\u00A0]/g, " ").replace(/ +/g, " "); return sp(t) === sp(ligneRetenue(ind, c)) && /^Retenue prévue/.test(sp(t)) && !/En cours/.test(t); }, finB), "fiche affichée : la retenue en tête du cadre « Bilan du professeur principal » (fiche remise : pas de mention « en cours »)");
  const avantCode = await p.evaluate(() => document.querySelector("table.indiv-pied .bil-ret").textContent);
  await p.evaluate(fin => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === fin), k = Object.keys(ind.saisies).find(k => c.jours.includes(k.split(".")[0]) && ind.saisies[k].c.some(v => v !== 3));
    ind.saisies[k].c = ind.saisies[k].c.map(() => 3); commit(); }, finB); await wait(300);
  const apresCode = await p.evaluate(() => document.querySelector("table.indiv-pied .bil-ret").textContent);
  ok(apresCode !== avantCode && /«\s*TI\s*»/.test(apresCode), `un cours passé en « TI » : la ligne suit (« ${avantCode} » → « ${apresCode} »)`);
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  const fut = await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => remiseCycle(x) > aujourdhui()); if (!c) return null; ind.saisies[c.jours[0] + ".0"] = { c: ind.objectifs.map(() => 3), r: "" };
    const l = ligneRetenue(ind, c); delete ind.saisies[c.jours[0] + ".0"]; return { l, j: fmtLong(remiseCycle(c)).replace(/ \d{4}$/, "") }; });
  ok(!fut || fut.l.endsWith(`En cours : la retenue sera fixée le ${fut.j}.`), `fiche pas encore remise : « … En cours : la retenue sera fixée le ${fut && fut.j}. »`);
  ok(await p.evaluate(() => { const sv = S.retenueIndiv; S.retenueIndiv = { i: 0, heures: 1, nonRendue: 0, max: 2, reussite: 75, hReussite: 0 }; const ind = S.individuels[0], c = cyclesIndiv(ind)[0], ok = !ligneRetenue(ind, c) && !/bil-ret/.test(indivHTML(ind, c, false)); S.retenueIndiv = sv; return ok; }), "sans règle ni perte : pas de ligne");

  // ----- carte -----
  await go("#indiv");
  ok(await p.evaluate(() => [...document.querySelectorAll(".ind-carte")].every(a => { const ind = S.individuels.find(i => a.getAttribute("href") === "#indiv/" + i.id), serie = serieIndiv(ind), auj = aujourdhui();
    const faites = serie.filter(f => f.c.debut <= auj), der = faites.length ? faites[faites.length - 1] : serie[serie.length - 1], t = der ? retenueFiche(ind, der.c).total : 0, enc = der && remiseCycle(der.c) > auj;
    return t ? (a.querySelector(".ic-ret") || {}).textContent === `⚠ retenue ${t} h${enc ? " (en cours)" : ""}` : !a.querySelector(".ic-ret"); })), "cartes : « ⚠ retenue n h » pour la fiche AFFICHÉE sur la carte (celle du pourcentage), « (en cours) » avant sa remise");

  // ----- règle propre à un suivi -----
  await go("#indiv/demo-mostowski"); await p.evaluate(() => { document.querySelector("details.reg-ind").open = true; }); await wait(150);
  await p.click('input[data-ret-propre="1"]'); await wait(300);
  ok(await p.evaluate(() => JSON.stringify(S.individuels[1].retenue) === JSON.stringify(S.retenueIndiv)), "« Règle propre » cochée : part de la règle des réglages");
  await p.evaluate(() => { document.querySelector("details.reg-ind").open = true; }); await wait(100);
  await p.$eval('input[data-num="individuels.1.retenue.i"]', e => { e.value = "2"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  await p.$eval('input[data-num="individuels.1.retenue.nonRendue"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.individuels[1].retenue.i === 2 && S.individuels[1].retenue.nonRendue === 0 && S.retenueIndiv.i === 3 && regleRetenueIndiv(S.individuels[1]) === "2 « TI » sur la fiche = 1 heure de retenue · réussite de la fiche sous 75 % = 1 heure de retenue · 2 heures au plus par fiche"), "règle propre : 2 « TI » = 1 heure, sans retenue pour une fiche non rendue ; celle des réglages inchangée");
  ok(await p.$eval(".f-consigne", e => /Attention\s*:\s*2\s*«\s*TI\s*»/.test(e.innerText) && !/perdue/.test(e.innerText)), "fiche de ce suivi : sa règle imprimée");
  await go("#reglages/suivisIndiv");
  ok(await p.evaluate(() => /règle propre\s*:\s*MOSTOWSKI Michał \(2\s*«\s*TI\s*»\s*sur la fiche = 1 heure de retenue · réussite de la fiche sous 75\s*% = 1 heure de retenue · 2 heures au plus par fiche\)/.test(document.body.innerText)), "Réglages : le suivi à règle propre est listé");
  // règle commune modifiée : le suivi à règle propre ne bouge pas
  await p.$eval('input[data-num="retenueIndiv.i"]', e => { e.value = "4"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => S.retenueIndiv.i === 4 && S.individuels[1].retenue.i === 2 && regleRetenueIndiv(S.individuels[0]).startsWith("4 « TI »")), "règle des réglages à 4 : BRIDGE suit, MOSTOWSKI garde la sienne");
  await p.$eval('input[data-num="retenueIndiv.i"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  await p.$eval('input[data-num="retenueIndiv.nonRendue"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  await p.$eval('input[data-num="retenueIndiv.hReussite"]', e => { e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(() => regleRetenueIndiv(S.individuels[0]) === "" && !/Attention/.test(indivHTML(S.individuels[0], cyclesIndiv(S.individuels[0])[0], false))), "plus de règle : rien d’imprimé sur la fiche");

  // ----- impression : la ligne de la règle ne fait pas déborder la fiche (4 objectifs, consigne la plus longue, tous les créneaux) -----
  { const { execSync } = require("child_process"), OUT = DIR + "/sorties/impr"; fs.mkdirSync(OUT, { recursive: true });
    const pdf = async (name, pages) => { await p.evaluate(h => { document.querySelector("#print-area").innerHTML = h.map(x => `<div class="page sheet">${x}</div>`).join(""); }, pages);
      await p.emulateMediaType("print"); await p.pdf({ path: `${OUT}/${name}.pdf`, landscape: true, format: "A4", printBackground: true, preferCSSPageSize: true }); await p.emulateMediaType("screen");
      return { n: Number(execSync(`pdfinfo "${OUT}/${name}.pdf" | grep Pages | awk '{print $2}'`).toString()), txt: execSync(`pdftotext "${OUT}/${name}.pdf" -`).toString() }; };
    await p.evaluate(() => { S.retenueIndiv = { i: 3, heures: 1, nonRendue: 1, max: 2, reussite: 75, hReussite: 1 }; const ind = S.individuels[0]; ind.retenue = null; ind.objectifs = ["Je travaille sans bavarder.", "J’écoute les consignes en silence.", "Je termine le travail écrit demandé en classe.", "Je note les devoirs dans mon agenda."];
      ind.saisies = Object.fromEntries(Object.entries(ind.saisies).map(([k, v]) => [k, { c: [v.c[0], v.c[1], v.c[2], 3], r: v.r }])); ind.consigne = S.consignesIndiv.findIndex(m => m.label === "Dernier enseignant, chaque soir") + 1; });
    for (const tous of [false, true]) { await p.evaluate(t => { S.creneauMidi = t; S.creneauS4 = t; S.creneauS5 = t; }, tous);
      const r = await pdf(`retenue-fiche${tous ? "-tous" : ""}`, await p.evaluate(() => { const ind = S.individuels[0]; return [indivHTML(ind, cyclesIndiv(ind)[1], false)]; }));
      ok(r.n === 1 && /Attention/.test(r.txt) && /perdue/.test(r.txt) && /75/.test(r.txt), `fiche imprimée, 4 objectifs, consigne de 3 lignes et règle${tous ? ", tous les créneaux" : ""} : ${r.n} page`); }
    await p.evaluate(() => { S.creneauMidi = false; S.creneauS4 = false; S.creneauS5 = false; });
    const rf = await pdf("retenue-famille", await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total); return [bilanFamilleHTML(ind, c), indivHTML(ind, c, false, true)]; }));
    ok(rf.n === 2 && /Retenue prévue/.test(rf.txt), `bilan pour la famille avec la retenue : ${rf.n} pages`);
    // v1.91.3 : imprimée avant son jour de remise (à distribuer), la fiche a un cadre de bilan vide ; à partir du jour de remise, tout y est
    const papier = async jour => { const h = await p.evaluate(j => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total), vrai = aujourdhui;
      ind.bilans[c.fin] = "Semaine difficile, à reprendre."; aujourdhui = () => j === "veille" ? addDays(remiseCycle(c), -1) : remiseCycle(c);
      try { return indivHTML(ind, c, false); } finally { aujourdhui = vrai; } }, jour);
      return pdf("retenue-avant-" + jour, [h]); };
    const av = await papier("veille"), le = await papier("remise");
    ok(av.n === 1 && /Bilan du professeur/.test(av.txt) && !/Retenue prévue|Pas de retenue|En cours|Semaine difficile/.test(av.txt) && /Attention/.test(av.txt), "fiche imprimée la veille de sa remise : cadre du bilan vide (ni retenue, ni « en cours », ni bilan), la règle reste dans l’en-tête");
    ok(le.n === 1 && /Retenue prévue/.test(le.txt) && /Semaine difficile/.test(le.txt), "fiche imprimée le jour de sa remise : retenue et bilan du professeur principal");
    ok(await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total), vrai = aujourdhui; aujourdhui = () => addDays(remiseCycle(c), -1);
      try { const d = document.createElement("div"); d.innerHTML = indivHTML(ind, c, true); return !!d.querySelector(".bil-ret") && /Semaine difficile/.test(d.querySelector("textarea[data-ib]").value); } finally { aujourdhui = vrai; } }), "à l’écran, avant la remise : la ligne de retenue et le bilan restent");
    // case « Avec le bilan du professeur principal » : cochée d'office à partir du jour de remise, décochable, cochable avant
    const ind0 = await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total); ind.bilans[c.fin] = "Semaine difficile, à reprendre."; commit(); return { id: ind.id, fin: c.fin }; });
    await p.evaluate(h => { location.hash = h; }, `#indiv/${ind0.id}:${ind0.fin}`); await wait(400);
    const cle = `${ind0.id}|${ind0.fin}`, imprime = () => p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => retenueFiche(ind, x).total), d = document.createElement("div"); d.innerHTML = indivHTML(ind, c, false); return !!d.querySelector(".bil-ret") && /Semaine difficile/.test(d.innerText || d.textContent); });
    ok(await p.evaluate(k => { const x = document.querySelector(`input[data-imp-bilan="${k}"]`); return !!x && x.checked && !!x.closest(".actions") && /Avec le bilan du professeur principal/.test(x.closest("label").textContent); }, cle), "page du suivi, fiche dont la remise est passée : case « Avec le bilan du professeur principal » cochée, à côté de « Imprimer la fiche »");
    ok(await imprime(), "cochée : la fiche imprimée porte la retenue et le bilan");
    await p.click(`input[data-imp-bilan="${cle}"]`); await wait(200);
    ok(!(await imprime()), "décochée : la fiche imprimée a un cadre de bilan vide");
    ok(await p.evaluate(() => !!document.querySelector("#grille-indiv .bil-ret") && /Semaine difficile/.test(document.querySelector("#grille-indiv textarea[data-ib]").value)), "décochée : l’écran garde la ligne de retenue et le bilan");
    await p.evaluate(() => commit()); await wait(300);
    ok(await p.evaluate(k => !document.querySelector(`input[data-imp-bilan="${k}"]`).checked, cle), "le choix tient après un nouveau rendu de la page");
    ok(await p.evaluate(() => { let ls = ""; try { ls = Object.keys(localStorage).join() + Object.values(localStorage).join(); } catch (e) {} return !/impBilan|imp-bilan/.test(JSON.stringify(S) + ls); }), "le choix n’entre ni dans les données ni dans le stockage du navigateur");
    const fut = await p.evaluate(() => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => remiseCycle(x) > aujourdhui()); return c ? c.fin : null; });
    if (fut) { await p.evaluate(h => { location.hash = h; }, `#indiv/${ind0.id}:${fut}`); await wait(400);
      ok(await p.evaluate(k => !document.querySelector(`input[data-imp-bilan="${k}"]`).checked, `${ind0.id}|${fut}`), "fiche à venir : case décochée d’office");
      await p.click(`input[data-imp-bilan="${ind0.id}|${fut}"]`); await wait(200);
      ok(await p.evaluate(f => { const ind = S.individuels[0], c = cyclesIndiv(ind).find(x => x.fin === f), d = document.createElement("div"); d.innerHTML = indivHTML(ind, c, false); return !!d.querySelector(".indiv-pied") && bilanImprime(ind, c); }, fut), "fiche à venir, case cochée à la main : le bilan s’imprimera"); }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "barre d’actions : pas de défilement horizontal à 1024 px"); }

  // ----- changement du jour de remise : les pertes, datées, tombent dans la fiche qui contient leur jour -----
  await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"); const av = cyclesIndiv(ind); ind.remise = 4; recalerBilans(ind, av); });
  ok(await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-podeanu"), cy = cyclesIndiv(ind); return ind.pertes.join() === "2026-11-17,2026-11-19" && pertesFiche(ind, cy.find(c => c.fin === "2026-11-19")).length === 2; }), "remise passée au jeudi : les pertes du mardi 17 et du jeudi 19 restent sur la fiche qui finit le jeudi 19/11");

  await go("#indiv/demo-bridge:" + finB); await p.screenshot({ path: DIR + "/sorties/retenue-indiv.png" });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
