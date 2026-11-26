// « Autre activité » à la place d'un cours (v1.96.0) et pour une partie de la classe seulement (v1.96.1) : vrais clics dans la fenêtre
// d'un créneau, depuis les trois familles ; ce que montrent la fiche individuelle, la fiche collective et la fiche de classe ; fiche
// imprimée avec un nom long ; réouverture, retour au cours normal, Ctrl+Z ; enregistrement relu ; renommage venu de Suivi PP.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), { execSync } = require("child_process");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html"), OUT = DIR + "/sorties/impr";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1024, height: 768 });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
    await p.evaluate(() => { doDemo(); window.aujourdhui = () => "2026-11-18"; }); await wait(400);
    const D = "2026-11-17", B = "BRIDGE Michael", M = "MOSTOWSKI Michał", P = "PODEANU Mihaela";
    const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await wait(500); };
    const cours = (nom, q) => p.evaluate((D, nom, q) => { const c = coursPour(creneau(S, semaines(S), D, q), groupesDe(S, nom), nom); return { mat: c.mat, prof: c.prof, absent: !!c.absent }; }, D, nom, q);
    const ouvrir = async sel => { await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), sel); await p.click(sel); await wait(350); };
    const boite = () => p.evaluate(() => !!document.querySelector("#boite[open]"));
    const valider = async () => { await p.click('#boite [data-r="oui"]'); await wait(450); };
    const ps = await p.evaluate(D => creneauxDu(S, D).filter(q => creneau(S, semaines(S), D, q).mat), D);
    const avant = await p.evaluate(() => JSON.stringify(S));

    // 1. toute la classe, toute la journée, sans enseignant — depuis la fiche individuelle
    await go("#indiv/demo-bridge:2026-11-20");
    const h0 = await p.evaluate(D => document.querySelector(`td[data-crn="${D}|0"]`).getBoundingClientRect().height, D);
    await ouvrir(`td[data-crn="${D}|0"]`);
    ok(await p.evaluate(() => document.querySelector('input[name="crn-pour"][value="eleves"]').checked && [...document.querySelectorAll("[data-actel]:checked")].map(x => x.dataset.actel).join() === "BRIDGE Michael"), "depuis une fiche individuelle : « certains élèves », cet élève coché d'office");
    await p.click('#boite input[value="act"]'); await wait(100);
    ok(await p.evaluate(() => document.activeElement.id === "crn-act" && !document.querySelector(".crn-a").classList.contains("off") && document.querySelector(".crn-r").classList.contains("off")), "« Autre activité » : le champ de l'activité prend la main, le bloc « Remplacé » s'éteint");
    await valider();
    ok(await boite() && await p.evaluate(() => /Indiquez l’activité/.test(document.querySelector("#boite").textContent)), "activité vide : refusée, la fenêtre reste ouverte");
    await p.type("#crn-act", "Formation aux gestes qui sauvent");
    await p.click('#boite input[name="crn-pour"][value="classe"]'); await wait(80);
    ok(await p.evaluate(() => document.querySelector(".crn-l").classList.contains("off")), "« toute la classe » : la liste des élèves se cache");
    await p.click("#boite [data-acttout]"); await wait(80);
    ok(await p.evaluate(n => document.querySelectorAll("[data-actq]:checked").length === n, ps.length), "« Toute la journée » coche tous les créneaux du jour");
    const tailleDlg = await p.evaluate(() => { const m = document.querySelector("#boite"), r = m.getBoundingClientRect(); return { haut: r.top >= 0 && r.bottom <= innerHeight + 1, large: m.scrollWidth <= m.clientWidth + 1 }; });
    ok(tailleDlg.haut && tailleDlg.large, "1024 × 768 : la fenêtre tient à l'écran " + JSON.stringify(tailleDlg));
    await valider();
    let c = []; for (const q of ps) c.push(await cours(P, q));
    ok(c.every(x => x.mat === "Formation aux gestes qui sauvent" && x.prof === ""), "toute la journée : l'activité, sans enseignant, pour toute la classe");
    const cell = await p.evaluate(D => { const td = document.querySelector(`td[data-crn="${D}|0"]`), r = td.getBoundingClientRect(); return { t: td.firstChild.textContent, h: r.height, deborde: td.scrollHeight > td.clientHeight + 2 }; }, D);
    ok(cell.t === "Formation aux gestes qui sauvent" && Math.abs(cell.h - h0) < 1, "fiche individuelle : le nom entier, la ligne garde sa hauteur " + JSON.stringify(cell));
    // la fiche imprimée : une page, le nom lisible
    await p.evaluate(() => { window.print = () => { }; }); await p.click('[data-act="print-ind"]'); await wait(600);
    const pdf = OUT + "/activite-longue.pdf"; await p.emulateMediaType("print"); await p.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true }); await p.emulateMediaType("screen");
    const pages = Number(execSync(`pdfinfo "${pdf}"`).toString().match(/Pages:\s+(\d+)/)[1]), txt = execSync(`pdftotext -enc UTF-8 "${pdf}" -`).toString("utf8").replace(/\s+/g, " ");
    ok(pages === 1 && /Formation/.test(txt) && /gestes/.test(txt) && /Visa du professeur/.test(txt), `fiche imprimée : ${pages} page, l'activité et le visa`);
    await p.evaluate(() => dispatchEvent(new Event("afterprint"))); await wait(200);
    // réouverture
    await ouvrir(`td[data-crn="${D}|3"]`);
    ok(await p.evaluate(() => document.querySelector('input[name="crn"]:checked').value === "act" && document.getElementById("crn-act").value === "Formation aux gestes qui sauvent" && document.querySelector('input[name="crn-pour"]:checked').value === "classe"), "rouverte : « Autre activité », son nom, toute la classe");
    await p.click('#boite [data-r="non"]'); await wait(200);
    // les deux autres familles
    await go("#fiche/" + D);
    ok(await p.evaluate(() => /Formation aux gestes/.test(document.querySelector("table.fiche thead").textContent)), "fiche collective : l'activité en tête des cours");
    await go("#classesem/3");
    ok(await p.evaluate(D => [...document.querySelectorAll(`td[data-crn^="${D}|"]`)].every(td => /Formation/.test(td.textContent)), D), "fiche de classe : l'activité sur tous les créneaux du jour");
    ok(await p.evaluate(D => [...document.querySelectorAll(`td[data-crn^="${D}|"]`)].every(td => td.textContent.trim() === "Formation aux gestes qui sauvent"), D), "… son nom entier, jamais abrégé en « Formation . » (l'affichage le coupe proprement)");
    // Ctrl+Z
    await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(500);
    ok((await cours(P, 0)).mat !== "Formation aux gestes qui sauvent", "Ctrl+Z : les cours reviennent");
    ok(await p.evaluate(a => JSON.stringify(S.jours) === JSON.parse(a).jours ? true : JSON.stringify(S.jours) === JSON.stringify(JSON.parse(a).jours), avant), "… exactement l'état d'avant");

    // 2. une partie de la classe, avec un enseignant, depuis la fiche de classe
    await ouvrir(`td[data-crn="${D}|1"]`);
    ok(await p.evaluate(() => document.querySelector('input[name="crn-pour"][value="classe"]').checked), "depuis la fiche de classe : « toute la classe » d'office");
    await p.click('#boite input[value="act"]'); await p.type("#crn-act", "Sortie au cinéma"); await p.type("#crn-act-prof", "M. ROUGET");
    await p.click('#boite input[name="crn-pour"][value="eleves"]'); await wait(80);
    await valider();
    ok(await boite() && await p.evaluate(() => /Cochez les élèves/.test(document.querySelector("#boite").textContent)), "certains élèves, aucun coché : refusé");
    await p.evaluate((B, M) => { for (const x of document.querySelectorAll("[data-actel]")) if ([B, M].includes(x.dataset.actel)) x.checked = true; }, B, M);
    await p.evaluate(() => { document.querySelectorAll("[data-actq]").forEach(x => { x.checked = ["1", "2"].includes(x.dataset.actq); }); });
    await valider();
    const cb = await cours(B, 1), cm = await cours(M, 2), cp = await cours(P, 1);
    ok(cb.mat === "Sortie au cinéma" && cb.prof === "M. ROUGET" && cm.mat === "Sortie au cinéma" && cp.mat !== "Sortie au cinéma", `inscrits : l'activité avec l'enseignant ; les autres : leur cours (${cp.mat})`);
    ok(await p.evaluate(D => { const a = S.jours[D].act; return a && a[1] && a[2] && !a[0] && a[1].noms.length === 2 && !(1 in (S.jours[D].mat || {})); }, D), "rangé à part (jours.act), sur les deux créneaux cochés, rien pour la classe");
    const cl = await p.evaluate((D, B, P) => { const t = n => { const s = S.classeEleves.findIndex(e => e.nom === n), td = document.querySelector(`td[data-cl="${s}.1"][data-d="${D}"]`); return td ? td.getAttribute("title") || td.dataset.tip || "" : "?"; }; return [t(B), t(P), document.querySelector(`td[data-crn="${D}|1"]`).textContent]; }, D, B, P);
    ok(/Sortie au cinéma/.test(cl[0]) && !/Sortie/.test(cl[1]) && !/Sortie/.test(cl[2]), "fiche de classe : la case d'un inscrit dit l'activité ; celle des autres et l'en-tête, le cours");
    // fiche collective : chaque élève, son cours
    await go("#fiche/" + D);
    const coll = await p.evaluate((B, M) => { const s = n => S.eleves.findIndex(e => e.nom === n), o = S.eleves.findIndex(e => e.nom && e.nom !== B && e.nom !== M && eleveActif(S, S.eleves.indexOf(e), ficheDate) && coursPour(creneau(S, semaines(S), ficheDate, 1), groupesDe(S, e.nom), e.nom).mat);
      return [s(B), o, document.querySelectorAll(`td[data-x^="${s(B)}.0.1."]`).length, document.querySelectorAll(`td[data-x^="${o}.0.1."]`).length]; }, B, M);
    ok(coll[0] >= 0 && coll[1] >= 0 && coll[2] === 4 && coll[3] === 4, "fiche collective : inscrits et non-inscrits gardent leurs cases à cocher " + JSON.stringify(coll));
    // fiches individuelles
    await go("#indiv/demo-bridge:2026-11-20");
    ok(await p.evaluate(D => document.querySelector(`td[data-crn="${D}|1"]`).firstChild.textContent === "Sortie au cinéma", D), "fiche individuelle d'un inscrit : l'activité");
    await go("#indiv/demo-podeanu:2026-11-20");
    ok(await p.evaluate(D => document.querySelector(`td[data-crn="${D}|1"]`).firstChild.textContent !== "Sortie au cinéma", D), "fiche individuelle d'une non-inscrite : son cours");
    // enseignant absent pour la classe : les inscrits ont quand même l'activité
    await p.evaluate(D => { jour(S, D, true).profAbs[1] = true; commit(); }, D); await wait(200);
    const ab = [await cours(B, 1), await cours(P, 1)];
    ok(!ab[0].absent && ab[0].mat === "Sortie au cinéma" && ab[1].absent, "enseignant de la classe absent : l'activité a lieu pour les inscrits, pas de cours pour les autres");
    await p.evaluate(D => { delete S.jours[D].profAbs[1]; commit(); }, D);
    // les résultats d'un non-inscrit ne bougent pas
    // réouverture depuis la fiche d'une non-inscrite : la liste des inscrits, pas elle
    await ouvrir(`td[data-crn="${D}|1"]`);
    ok(await p.evaluate(P => document.querySelector('input[name="crn"]:checked').value === "act" && document.querySelector('input[name="crn-pour"]:checked').value === "eleves" && [...document.querySelectorAll("[data-actel]:checked")].map(x => x.dataset.actel).length === 2 && !document.querySelector(`[data-actel="${P}"]`).checked && [...document.querySelectorAll("[data-actq]:checked")].map(x => x.dataset.actq).join() === "1,2", P), "rouverte : les deux inscrits cochés, ses deux créneaux seulement");
    await p.evaluate(P => { document.querySelector(`[data-actel="${P}"]`).checked = true; }, P); await valider();
    ok((await cours(P, 1)).mat === "Sortie au cinéma" && (await cours(P, 2)).mat === "Sortie au cinéma" && (await cours(P, 3)).mat !== "Sortie au cinéma", "une inscrite de plus, sur les créneaux de l'activité");
    // passer à toute la classe remplace l'activité d'une partie
    await ouvrir(`td[data-crn="${D}|1"]`); await p.click('#boite input[name="crn-pour"][value="classe"]'); await p.evaluate(() => { document.querySelector('[data-actq="2"]').checked = false; });
    await valider();
    ok(await p.evaluate(D => S.jours[D].mat[1] === "Sortie au cinéma" && !(S.jours[D].act || {})[1] && !!(S.jours[D].act || {})[2], D), "« toute la classe » : l'activité devient celle de la classe sur ce créneau, l'autre créneau ne bouge pas");
    // cours normal retire tout
    await ouvrir(`td[data-crn="${D}|2"]`); await p.click('#boite input[value="normal"]'); await valider();
    ok(await p.evaluate(D => !(S.jours[D].act || {})[2] && !S.jours[D].act, D) && (await cours(B, 2)).mat !== "Sortie au cinéma", "« Cours normal » : l'activité d'une partie disparaît");
    // 3. un élève absent à une activité : absent, pas d'activité dans ses résultats
    await p.evaluate((D, B, M) => { jour(S, D, true).act = { 3: { mat: "Conférence", prof: "", noms: [B, M] } }; commit(); poserAbsences([{ nom: B, d: D, p: 3 }], true); commit(); }, D, B, M);
    await go("#indiv/demo-bridge:2026-11-20");
    ok(await p.evaluate(D => !!document.querySelector(`td[data-iabs="0.${D}.3"]`) && document.querySelector(`td[data-crn="${D}|3"]`).firstChild.textContent === "Conférence", D), "absent à son activité : la case « absent(e) », l'activité nommée");
    // 4. enregistrement relu, renommage venu de Suivi PP
    const n = await p.evaluate(() => { const y = normalizeState(JSON.parse(JSON.stringify(S))); return JSON.stringify(y.jours) === JSON.stringify(S.jours); });
    ok(n, "relu à l'identique (normalizeState)");
    const re = await p.evaluate((D, B) => { const cl = { eleves: S.classeEleves.map(e => ({ nom: e.nom === B ? "BRIDGE Mike" : e.nom, groupes: e.groupes, debut: e.debut || "", fin: e.fin || "" })), groupes: S.groupes.map(g => g.nom), renommer: [[B, "BRIDGE Mike"]] };
      appliquerClasseHote(S, cl); return [S.jours[D].act[3].noms.join(), coursPour(creneau(S, semaines(S), D, 3), groupesDe(S, "BRIDGE Mike"), "BRIDGE Mike").mat]; }, D, B);
    ok(re[0].includes("BRIDGE Mike") && !re[0].includes(B) && re[1] === "Conférence", "renommage venu de Suivi PP : l'inscrit suit " + JSON.stringify(re));
    // 5. thème sombre : la liste des élèves lisible
    await p.evaluate(() => { appliquerTheme("sombre"); location.hash = "#classesem/3"; }); await wait(500);
    await ouvrir(`td[data-crn="${D}|3"]`);
    const ctr = await p.evaluate(() => { const l = document.querySelector(".crn-l label"), cs = getComputedStyle(l), bg = getComputedStyle(document.querySelector("#boite")).backgroundColor, lum = c => { const v = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; const a = lum(cs.color), z = lum(bg); return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05); });
    ok(ctr >= 4.5, `thème sombre : la liste des élèves contrastée (${ctr.toFixed(1)}:1)`);
    await p.screenshot({ path: DIR + "/sorties/activite-sombre.png" });
    await p.click('#boite [data-r="non"]');
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5 }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
