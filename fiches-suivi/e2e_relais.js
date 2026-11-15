// Fiches individuelles : circulation de la fiche (consigne propre à un suivi, modèles « dernier enseignant » et « chaque soir »),
// enseignants du dernier cours (jour de remise) et du premier cours (fiche suivante) lus dans l'emploi du temps, rappel au PP.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  const p = await b.newPage(); const msgs = []; await require("./boites")(p, { messages: msgs }); await p.setViewport({ width: 1024, height: 768 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => doDemo()); await wait(200);
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(300); };

  // ----- modèles proposés -----
  ok(await p.evaluate(() => S.consignesIndiv.length === 8 && CONSIGNES_INDIV_V2.every(l => S.consignesIndiv.some(m => m.label === l))), "8 modèles de consigne, dont les 3 nouveaux");
  ok(await p.evaluate(() => S.consignesIndiv.filter(m => /\[premier enseignant\]/.test(m.texte)).length === 3 && S.consignesIndiv.filter(m => /\[dernier enseignant\]/.test(m.texte)).length === 2), "nouveaux modèles : [premier enseignant] dans les 3, [dernier enseignant] dans les 2 « dernier enseignant »");

  // ----- démonstration : MOSTOWSKI (remise le jeudi) a sa propre consigne, BRIDGE suit les réglages -----
  const m = await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-mostowski"), cy = cyclesIndiv(ind), c = cy[1], r = relaisIndiv(ind, c);
    return { consigne: ind.consigne, label: modeleConsigneIndiv(ind).label, texte: consigneIndiv(ind, c), r, jr: jourSemaine(r.remise), jp: jourSemaine(r.reprise) }; });
  ok(m.consigne > 0 && m.label === "Dernier enseignant, le jour de remise", `MOSTOWSKI : consigne propre « ${m.label} »`);
  ok(m.jr === 4 && m.jp === 5, `remise le jeudi (${m.r.remise}), fiche suivante le vendredi (${m.r.reprise})`);
  ok(!!(m.r.dernier && m.r.dernier.prof && m.r.premier && m.r.premier.prof), `enseignants trouvés : dernier cours ${m.r.dernier && m.r.dernier.prof} (${m.r.dernier && m.r.dernier.mat}), premier cours ${m.r.premier && m.r.premier.prof} (${m.r.premier && m.r.premier.mat})`);
  ok(m.texte.includes(`${m.r.dernier.prof} (${m.r.dernier.mat}, dernier cours)`) && m.texte.includes(`${m.r.premier.prof} (${m.r.premier.mat}, premier cours)`) && !/\[/.test(m.texte), "consigne : les deux enseignants nommés, plus aucun mot entre crochets");
  ok(await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-bridge"); return !ind.consigne && consigneIndiv(ind, cyclesIndiv(ind)[0]) === consigneIndiv({ ...ind }, cyclesIndiv(ind)[0]) && modeleConsigneIndiv(ind) === S.consignesIndiv[S.consigneIndivChoisie]; }), "BRIDGE : consigne des réglages");
  // le premier cours du vendredi : dernier créneau vérifié à la main (aucun cours plus tôt)
  ok(await p.evaluate(() => { const ind = S.individuels.find(i => i.id === "demo-mostowski"), c = cyclesIndiv(ind)[1], r = relaisIndiv(ind, c), sems = semaines(S), grs = groupesDe(S, ind.nom);
    const avant = creneauxDu(S, r.reprise).slice(0, creneauxDu(S, r.reprise).indexOf(r.premier.p)); return avant.every(q => { const cr = coursPour(creneau(S, sems, r.reprise, q), grs); return !cr.mat || cr.absent; }); }), "premier cours : aucun cours de l’élève avant lui ce jour-là");

  // ----- page du suivi : fiche imprimée et rappel -----
  const fin1 = await p.evaluate(() => cyclesIndiv(S.individuels.find(i => i.id === "demo-mostowski"))[1].fin);
  await go("#indiv/demo-mostowski:" + fin1);
  const page = await p.evaluate(() => ({ cons: document.querySelector(".f-consigne").innerText, relais: (document.querySelector("ul.relais") || {}).innerText || "" }));
  ok(page.cons.includes("dernier cours") && page.cons.includes(m.r.premier.prof), "fiche : la consigne imprimée nomme les enseignants");
  ok(page.relais.includes("Remise le jeudi") && page.relais.includes("Nouvelle fiche le vendredi") && page.relais.includes(m.r.dernier.prof) && page.relais.includes(m.r.premier.prof) && page.relais.includes("casier"), "rappel « D’une fiche à la suivante » : qui récupère, dans quel casier déposer la nouvelle");
  ok(await p.evaluate(() => !!document.querySelector("ul.relais").closest(".no-print")), "rappel : écran seulement");
  // le PP lui-même au premier cours
  const moi = await p.evaluate(fin => { const ind = S.individuels.find(i => i.id === "demo-mostowski"), c = cyclesIndiv(ind).find(x => x.fin === fin), r = relaisIndiv(ind, c);
    const ref = S.referent; S.referent = r.premier.prof; const t = relaisIndivHTML(ind, c); S.referent = ref; return t.includes("c’est vous : donnez-la directement"); }, fin1);
  ok(moi, "premier cours du PP lui-même : « c’est vous : donnez-la directement à l’élève »");

  // ----- enseignant absent ou remplacé ce matin-là -----
  const abs = await p.evaluate(fin => { const ind = S.individuels.find(i => i.id === "demo-mostowski"), c = cyclesIndiv(ind).find(x => x.fin === fin), r0 = relaisIndiv(ind, c);
    const j = jour(S, r0.reprise, true); j.prof[r0.premier.p] = "M. Remplaçant"; const r1 = relaisIndiv(ind, c);
    delete j.prof[r0.premier.p]; j.profAbs[r0.premier.p] = true; const r2 = relaisIndiv(ind, c); delete j.profAbs[r0.premier.p];
    return { rempl: r1.premier.prof, p0: r0.premier.p, p2: r2.premier && r2.premier.p, fin: r2.premier && r2.premier.p !== r0.premier.p }; }, fin1);
  ok(abs.rempl === "M. Remplaçant", "remplaçant ce jour-là : c’est lui qui est nommé");
  ok(abs.fin, `enseignant absent au premier créneau : le cours suivant est retenu (${abs.p0} → ${abs.p2})`);

  // ----- carte du suivi -----
  await go("#indiv");
  ok(await p.evaluate(() => [...document.querySelectorAll(".ic-relais")].length === S.individuels.length && document.querySelector('a[href="#indiv/demo-mostowski"] .ic-relais').textContent.includes("📥 nouvelle fiche →")), "cartes : une ligne « 📥 nouvelle fiche → … » par suivi");

  // ----- choisir la consigne d'un suivi dans ses réglages -----
  await go("#indiv/demo-bridge"); await p.evaluate(() => { document.querySelector("details.reg-ind").open = true; }); await wait(150);
  ok(await p.$$eval('select[data-num="individuels.0.consigne"] option', o => o.length === 9 && o[0].textContent.startsWith("comme les réglages")), "réglages du suivi : « Consigne » = comme les réglages + les 8 modèles");
  await p.select('select[data-num="individuels.0.consigne"]', "8"); await wait(300);
  ok(await p.evaluate(() => S.individuels[0].consigne === 8 && document.querySelector(".f-consigne").innerText.includes("montre à mes parents")), "BRIDGE : « Chaque soir à la maison » choisi, imprimé sur sa fiche");
  await go("#reglages/suivisIndiv");
  ok(await p.evaluate(() => /consigne\s+propre\s*:\s*BRIDGE Michael \(Chaque soir à la maison\), MOSTOWSKI Michał \(Dernier enseignant, le jour de remise\)/.test(document.body.innerText)), "Réglages : les suivis à consigne propre sont listés");
  ok(await p.evaluate(() => !document.querySelector(".apercu i").textContent.includes("montre à mes parents")), "Réglages : l’aperçu montre la consigne des réglages, pas celle propre au 1er suivi");

  // ----- supprimer un modèle : les consignes propres suivent -----
  await p.click("details.modeles summary"); await wait(100);
  await p.click('button[data-del="consignesIndiv.1"]'); await wait(300);    // un modèle AVANT ceux des deux suivis
  ok(await p.evaluate(() => S.individuels[0].consigne === 7 && modeleConsigneIndiv(S.individuels[0]).label === "Chaque soir à la maison" && modeleConsigneIndiv(S.individuels[1]).label === "Dernier enseignant, le jour de remise"), "modèle supprimé avant : les suivis gardent leur modèle (numéros décalés)");
  await p.evaluate(() => { if (!document.querySelector("details.modeles").open) document.querySelector("details.modeles summary").click(); }); await wait(100);
  await p.click('button[data-del="consignesIndiv.6"]'); await wait(300);    // « Chaque soir à la maison » lui-même
  ok(await p.evaluate(() => S.individuels[0].consigne === 0 && S.individuels[1].consigne === 5), "modèle du suivi supprimé : retour à la consigne des réglages ; l’autre suivi inchangé");
  // revenir aux modèles proposés : retrouvés par leur intitulé
  await p.evaluate(() => { document.querySelector("details.modeles").open = true; }); await wait(100);
  await p.click('[data-act="consignes-indiv-defaut"]'); await wait(400);
  ok(await p.evaluate(() => S.consignesIndiv.length === 8 && modeleConsigneIndiv(S.individuels[1]).label === "Dernier enseignant, le jour de remise"), "« Revenir aux modèles proposés » : la consigne propre est retrouvée par son intitulé");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(300);
  ok(await p.evaluate(() => S.consignesIndiv.length === 6), "Ctrl+Z : les modèles d’avant reviennent");

  // ----- anciens fichiers : les 3 modèles proposés une fois, jamais imposés ensuite -----
  const mig = await p.evaluate(() => { const vieux = CONSIGNES_INDIV_DEFAUT.slice(0, 5).map(([label, texte]) => ({ label, texte }));
    const a = normalizeState({ consignesIndiv: vieux.map(x => ({ ...x })), individuels: [{ nom: "X", objectifs: ["a"], consigne: 12 }] });
    const b2 = normalizeState({ consignesIndiv: vieux.map(x => ({ ...x })), consignesIndivV: 2 });
    const c = normalizeState({ consignesIndiv: [{ label: "Dernier enseignant, chaque soir", texte: "à moi" }] });
    const d = normalizeState(JSON.parse(JSON.stringify(a)));
    return { a: a.consignesIndiv.length, aCons: a.individuels[0].consigne, b: b2.consignesIndiv.length, c: c.consignesIndiv.map(x => x.texte), d: d.consignesIndiv.length, neuf: normalizeState({}).consignesIndiv.length }; });
  ok(mig.a === 8 && mig.d === 8, "ancien fichier (5 modèles) : les 3 nouveaux ajoutés à la suite, une seule fois");
  ok(mig.b === 5, "fichier récent dont on a supprimé les nouveaux modèles : ils ne reviennent pas");
  ok(mig.c.length === 3 && mig.c[0] === "à moi", "modèle du même intitulé déjà là : gardé tel quel, pas de doublon");
  ok(mig.aCons === 0, "consigne propre hors de la liste : celle des réglages");
  ok(mig.neuf === 8, "nouveau suivi : 8 modèles");

  // ----- emploi du temps inconnu : formulation générique -----
  ok(await p.evaluate(() => enseignantCours(null, "premier cours") === "l’enseignant du premier cours" && enseignantCours({ mat: "SVT", prof: "" }, "dernier cours") === "l’enseignant du dernier cours (SVT)"), "sans enseignant connu : « l’enseignant du premier cours », avec la matière si elle est connue");

  await go("#indiv/demo-mostowski:" + fin1); await p.screenshot({ path: DIR + "/sorties/relais.png" });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1024), "pas de défilement horizontal à 1024 px");
  await go("#indiv"); await p.screenshot({ path: DIR + "/sorties/relais-cartes.png" });
  console.log(errs.length ? "ERREURS JS : " + errs.join(" | ") : "aucune erreur JS");
  await b.close(); fs.rmSync(prof, { recursive: true, force: true });
})();
