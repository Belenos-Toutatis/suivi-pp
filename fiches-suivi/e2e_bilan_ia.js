// 🤖 Bilan d'une fiche individuelle avec une IA (v1.95.0), dans le VRAI « suivi pp.html » : bouton de la fiche → fenêtre de Suivi PP
// (texte anonymisé, relu) → proposition → « Mettre dans le bilan » → la fiche, un cran d'annulation. Aucun appel au réseau : la réponse
// est collée. Réécriture, nouvelle consigne sur la proposition, bilan changé entre-temps, IA désactivée, fiche autonome sans bouton.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), path = require("path"); const DIR = __dirname;
const SUIVI = path.join(DIR, "..", "suivi pp.html");
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(DIR + "/sorties", { recursive: true });
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1366, height: 800 });
    const errs = [], reseau = []; p.on("pageerror", e => errs.push(e.message)); p.on("request", r => { if (/anthropic/.test(r.url())) reseau.push(r.url()); });
    await p.goto("file://" + SUIVI); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(1500);
    const h = (f, ...a) => p.evaluate(f, ...a);
    await h(() => switchTab("suivis")); let fr = null;
    for (let i = 0; i < 60 && !(fr = p.frames().find(f => f.url().startsWith("about:srcdoc"))); i++) await wait(150);
    await wait(2500);
    const f = (fn, ...a) => fr.evaluate(fn, ...a);
    const ind = await f(() => { const i = S.individuels.find(x => cyclesIndiv(x).some(c => statsIndiv(x, c).some(s => s[1]))), cy = cyclesIndiv(i).filter(c => statsIndiv(i, c).some(s => s[1])), c = cy[1] || cy[0]; return { id: i.id, nom: i.nom, fin: c.fin, n: S.individuels.indexOf(i) }; });
    const bil = () => f(x => { const i = S.individuels.find(y => y.id === x.id); return bilanCycle(i, cyclesIndiv(i).find(c => c.fin === x.fin)); }, ind);
    const range = () => h(x => { const i = S.fichesSuivi[S.cur].etat.S.individuels.find(y => y.id === x.id); return i.bilans[x.fin] || ""; }, ind);
    const prenom = await h(n => { const s = getCls().eleves.map(id => S.eleves[id]).find(e => _suivisNom(e) === n); return s.prenom; }, ind.nom);
    const nomFam = await h(n => getCls().eleves.map(id => S.eleves[id]).find(e => _suivisNom(e) === n).nom, ind.nom);
    // remise à zéro du bilan, une remarque qui nomme l'élève
    await f(x => { const i = S.individuels.find(y => y.id === x.id), c = cyclesIndiv(i).find(y => y.fin === x.fin); for (const d of c.jours) delete i.bilans[d]; const k = Object.keys(i.saisies).find(k => c.jours.includes(k.split(".")[0])); i.saisies[k].r = x.prenom + " a oublié son cahier."; commit(); location.hash = "#indiv/" + x.id + ":" + x.fin; }, { ...ind, prenom });
    await wait(800);
    const bouton = `[data-bia="${ind.n}.${ind.fin}"]`;
    const vu = await f(s => { const x = document.querySelector(s); return x ? [getComputedStyle(x).display, x.textContent] : null; }, bouton);
    ok(vu && vu[0] !== "none" && /Rédiger avec une IA/.test(vu[1]), "fiche : bouton « Rédiger avec une IA… » sous le bilan " + JSON.stringify(vu));
    const ouvrir = async () => { await f(s => document.querySelector(s).scrollIntoView({ block: "center" }), bouton); await wait(150); await fr.click(bouton); await wait(700); };
    const ouverte = () => h(() => document.getElementById("mif").classList.contains("on"));

    // 1. rédiger
    await ouvrir();
    ok(await ouverte(), "clic : la fenêtre s'ouvre dans Suivi PP");
    let t = await h(() => document.getElementById("mif-txt").value);
    ok(/Objectifs et réussite :/.test(t) && /Objectif 1/.test(t) && /Remarques des enseignants :/.test(t) && /\[Élève\] a oublié son cahier/.test(t), "texte : objectifs, remarques, [Élève]");
    ok(!new RegExp(`(?<![\\p{L}])(${prenom}|${nomFam})(?![\\p{L}])`, "iu").test(t), "ni le prénom ni le nom de l'élève");
    const profs = await f(() => [...new Set(S.matieres.map(m => (m.prof || "").replace(/^(M\.|Mme)\s+/, "").trim()).filter(Boolean))]);
    ok(profs.length > 3 && !profs.some(n => new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "iu").test(t)), `aucun des ${profs.length} enseignants`);
    ok(await h(() => document.querySelectorAll('input[name="mif-mode"]:disabled').length === 2 && document.querySelector('input[name="mif-mode"]:checked').value === "construire"), "bilan vide : « Rédiger » seul possible");
    ok(await h(() => document.querySelectorAll("#mif-blocs input:checked").length === 4 && document.querySelector("#mif-forme select").value === "courte"), "quatre blocs cochés, deux ou trois phrases d'office");
    const susp = await h(() => (_iaFiche.suspects || []).map(s => s.mot));
    ok(susp.length <= 3, "relecture : peu de mots à vérifier " + JSON.stringify(susp));
    ok(await h(() => _iaFicheContenu(_iaFiche).endsWith(document.getElementById("mif-txt").value.trim() + "\n")), "ce qui part = la consigne puis le texte relu");
    ok(await h(() => { const m = document.querySelector("#mif .mb").getBoundingClientRect(); return m.width <= innerWidth && document.querySelector("#mif .mb").scrollWidth <= document.querySelector("#mif .mb").clientWidth + 1; }), "fenêtre sans défilement horizontal");
    await p.screenshot({ path: DIR + "/sorties/bilan-ia.png" });
    const crans = await h(() => undoStack.length);
    await p.type("#mif-rep", "[Élève] a progressé. Le matériel reste à revoir."); await wait(200);
    ok(await h(() => /caractères/.test(document.getElementById("mif-diff").textContent)) && (await bil()) === "", "proposition affichée ; la fiche n'a pas bougé");
    await h(() => iaFicheRangerUI()); await wait(900);
    const attendu = `${prenom} a progressé. Le matériel reste à revoir.`;
    ok((await bil()) === attendu && (await range()) === attendu, "« Mettre dans le bilan » : nom remis, dans la fiche et dans Suivi PP");
    ok(!(await ouverte()) && await h(n => undoStack.length === n + 1, crans), "fenêtre fermée, un seul cran d'annulation");
    ok(await f(a => document.querySelector("textarea[data-ib]").value === a, attendu), "le champ du bilan montre le texte");
    // 2. Ctrl+Z / Ctrl+Y
    await f(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }))); await wait(800);
    ok((await bil()) === "", "Ctrl+Z rend l'ancien bilan (vide)");
    await f(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }))); await wait(800);
    ok((await bil()) === attendu, "Ctrl+Y le remet");

    // 3. réécrire un texte écrit à la hâte : la frappe en cours est prise
    await f(() => { const ta = document.querySelector("textarea[data-ib]"); ta.focus(); ta.select(); });
    await p.keyboard.type(prenom + " oubli tjrs son matos, bavarde"); await ouvrir();
    t = await h(() => document.getElementById("mif-txt").value);
    ok(/Texte à reformuler :\n\[Élève\] oubli tjrs son matos, bavarde$/.test(t) && !/Objectifs/.test(t), "réécrire : le seul texte, tel qu'il vient d'être tapé " + JSON.stringify(t.slice(-60)));
    ok(await h(() => document.querySelector('input[name="mif-mode"]:checked').value === "reecrire"), "« Réécrire mon texte » d'office");
    await p.type("#mif-rep", "[Élève] oublie toujours son matériel et bavarde."); await wait(200);
    ok(await h(() => !!document.querySelector("#mif-diff ins") && !!document.querySelector("#mif-diff del")), "comparaison mot à mot");
    // 4. retravailler la proposition avec une consigne
    await h(() => iaFicheReprendreUI()); await wait(300);
    ok(await h(() => document.activeElement.id === "mif-perso" && document.querySelector('input[name="mif-mode"]:checked').value === "consigne" && /Texte à reformuler :\n\[Élève\] oublie toujours/.test(document.getElementById("mif-txt").value)), "↻ Retravailler : la proposition est le texte de départ, le champ de la consigne attend");
    await p.keyboard.type("plus encourageant"); await wait(500);
    ok(await h(() => /\nConsigne du professeur principal : plus encourageant\n/.test(document.getElementById("mif-txt").value) && /suivant la consigne/.test(document.getElementById("mif-cons").textContent)), "la consigne est dans le texte relu");
    await h(() => { document.getElementById("mif-idees").querySelector("button").click(); }); await wait(200);
    ok(await h(() => / ; /.test(document.getElementById("mif-perso").value)), "une idée de consigne s'ajoute à la mienne");
    await p.type("#mif-rep", "[Élève] peut progresser : un sac prêt la veille."); await wait(150);
    // 5. le bilan change entre-temps dans la fiche : refusé, la proposition reste
    await f(x => { const i = S.individuels.find(y => y.id === x.id); i.bilans[x.fin] = "Autre texte."; commit(); }, ind); await wait(500);
    await h(() => iaFicheRangerUI()); await wait(600);
    ok((await bil()) === "Autre texte." && await ouverte() && await h(() => /changé entre-temps/.test(document.getElementById("toast").textContent)), "bilan changé entre-temps : rien n'est remplacé, la fenêtre reste");
    await h(() => closeMod2("mif")); await wait(300);
    await ouvrir(); await p.type("#mif-rep", "[Élève] avance bien."); await h(() => iaFicheRangerUI()); await wait(800);
    ok((await bil()) === `${prenom} avance bien.`, "rouverte : le bilan est remplacé");

    // 6. la dernière vérification avant l'envoi direct (sans envoyer)
    await ouvrir(); await h(() => { localStorage.setItem(LS_IA_CLE, "sk-ant-essai"); iaFicheEnvoyerUI(); }); await wait(300);
    ok(await h(() => document.getElementById("miaenv").classList.contains("on") && /fiche de suivi/.test(document.getElementById("miaenv-sous").textContent) && document.getElementById("miaenv-go").disabled), "Envoyer à Claude : dernière vérification, bouton éteint tant qu'on n'a pas coché « J'ai relu »");
    await h(() => { closeMod2("miaenv"); closeMod2("mif"); localStorage.removeItem(LS_IA_CLE); }); await wait(300);
    ok(!reseau.length, "rien n'est parti vers le réseau");
    // 7. IA désactivée
    await h(() => setPref("iaActive", false)); await wait(500);
    ok(await f(s => getComputedStyle(document.querySelector(s)).display === "none", bouton), "IA désactivée : plus de bouton dans la fiche");
    await h(() => setPref("iaActive", true)); await wait(500);
    ok(await f(s => getComputedStyle(document.querySelector(s)).display !== "none", bouton), "réactivée : le bouton revient");
    ok(await f(x => { const i = S.individuels.find(y => y.id === x.id), c = cyclesIndiv(i).find(y => y.fin === x.fin); return !/data-bia|avec une IA/.test(indivHTML(i, c, false)) && !/data-bia/.test(bilanFamilleHTML(i, c)); }, ind), "rien sur le papier");
    // 8. fiche autonome
    const q = await b.newPage(); await q.goto("file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html")); await wait(600); await q.evaluate(() => { doDemo(); location.hash = "#indiv/demo-bridge"; }); await wait(700);
    ok(await q.evaluate(() => !document.querySelector("[data-bia]") && !!document.querySelector("textarea[data-ib]")), "fiche autonome : pas de bouton");
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5 }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
