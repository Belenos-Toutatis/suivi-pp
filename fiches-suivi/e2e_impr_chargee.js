// Fiche individuelle CHARGÉE (audit du 2026-11-22) : dix créneaux (M5, S4 et S5 cochés), quatre objectifs longs, salles aux noms
// longs sous la matière (v1.91.6), consigne propre de trois lignes, règle de retenue — par le vrai chemin d'impression (bouton
// « Imprimer la fiche » → printPages). La page a une hauteur fixe (v1.90.1) : quand les lignes ne pouvaient plus rétrécir, le cadre
// « Bilan du professeur principal » et le visa sortaient de la page et étaient rognés, sans 2e page ni avertissement.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer");
const fs = require("fs"), { execSync } = require("child_process");
const DIR = __dirname, APP = "file://" + encodeURI(DIR + "/app/Fiche de suivi collective.html"), OUT = DIR + "/sorties/impr";
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
const CAS = [
  ["labo, 4 objectifs, consigne propre, règle", { nobj: 4, salle: "Labo physique-chimie", consigne: true, regle: true, bilan: 1 }],
  ["salle informatique, 4 objectifs, consigne propre", { nobj: 4, salle: "Salle informatique 2", consigne: true, bilan: 1 }],
  ["salle très longue, 3 objectifs, consigne propre, règle", { nobj: 3, salle: "Salle polyvalente B204 (annexe)", consigne: true, regle: true, bilan: 2 }],
  ["noms longs, 4 objectifs, samedi, bilan long", { nobj: 4, salle: "Labo physique-chimie", consigne: true, regle: true, bilan: 3, samedi: true, nomLong: true, extreme: true }],
  ["sans salle (comme avant la v1.91.6)", { nobj: 4, consigne: true, regle: true, bilan: 1 }],
  ["créneaux d'office, salle très longue (deux lignes au plus)", { defaut: true, nobj: 4, salle: "Salle polyvalente B204 (annexe)", consigne: true, regle: true, bilan: 2 }],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
    const p = await b.newPage(); await require("./boites")(p);
    await p.setViewport({ width: 1440, height: 900 });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    let k = 0;
    for (const [nom, o] of CAS) {
      await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(600);
      await p.evaluate(() => { doDemo(); }); await wait(400);
      await p.evaluate(() => { window.print = () => { }; });
      await p.evaluate(o => {
        const ind = S.individuels[0];
        ind.objectifs = ["Je lève la main pour prendre la parole et j’attends qu’on me la donne avant de parler.", "J’ai mon matériel complet (cahier, trousse, livre, calculatrice) dès le début du cours.",
          "Je reste concentré(e) et je termine le travail demandé en classe, même quand c’est difficile.", "Je respecte mes camarades et les adultes, dans mes paroles comme dans mes gestes."].slice(0, o.nobj);
        if (!o.defaut) { S.creneauMidi = true; S.creneauS4 = true; S.creneauS5 = true; } S.samedi = !!o.samedi;
        if (o.nomLong) { ind.nom = "DE LA VILLARDIÈRE-SAINT-AUBIN Marie-Charlotte Éléonore"; S.referent = "Mme BROCHET-DE-LA-TOUR-D’AUVERGNE"; }
        if (o.salle) for (const t of Object.keys(S.edt)) for (const d of S.edt[t]) for (const c of d) if (c.mat) { c.salle = o.salle; (c.grp || []).forEach(g => { g.salle = o.salle; }); }
        if (o.consigne) ind.consigne = S.consignesIndiv.reduce((m, c, i) => (c.texte.length > (S.consignesIndiv[m - 1] || { texte: "" }).texte.length ? i + 1 : m), 1);
        if (o.regle) S.retenueIndiv = { i: 5, heures: 1, nonRendue: 1, max: 2, reussite: 65, hReussite: 1 };
        const c = cyclesIndiv(ind)[2];
        ind.bilans[c.fin] = "Semaine difficile au début, puis de vrais progrès à partir du mercredi : l’élève a su se remettre au travail en français et en mathématiques. ".repeat(o.bilan);
        commit(); location.hash = "#indiv/" + ind.id + ":" + c.fin;
      }, o);
      await wait(500);
      await p.click('[data-act="print-ind"]'); await wait(600);
      const f = `${OUT}/indiv-chargee-${++k}.pdf`;
      await p.emulateMediaType("print");
      // La dernière ligne du tableau et le pied sont-ils DANS la page (hauteur fixe, overflow caché) ?
      const geo = await p.evaluate(() => { const pg = document.querySelector("#print-area .page"), r = pg.getBoundingClientRect(), pied = pg.querySelector("table.indiv-pied"), t = pg.querySelector("table.indiv");
        const q = pied ? pied.getBoundingClientRect() : null, lt = [...t.querySelectorAll("tbody tr")].pop().getBoundingClientRect();
        return { page: Math.round(r.bottom), pied: q ? Math.round(q.bottom) : null, derniereLigne: Math.round(lt.bottom), lignes: t.querySelectorAll("tbody tr").length, salles: pg.querySelectorAll(".sal").length }; });
      await p.pdf({ path: f, printBackground: true, preferCSSPageSize: true });
      await p.emulateMediaType("screen");
      const n = Number(execSync(`pdfinfo "${f}" | grep Pages | awk '{print $2}'`).toString());
      const txt = execSync(`pdftotext "${f}" -`).toString();
      /* le cas extrême (samedi, noms et bilan très longs) peut prendre une seconde feuille : jamais de contenu perdu */
      ok(o.extreme ? n <= 2 : n === 1, `${nom} : ${n} page${n > 1 ? "s" : ""}`);
      ok(/Visa du professeur/.test(txt) && /vrais progrès/.test(txt), `${nom} : le bilan du professeur principal et le visa sont sur le papier`);
      ok(geo.lignes === (o.defaut ? geo.lignes : 10), `${nom} : ${geo.lignes} créneaux`);
      if (!o.defaut) ok(/S5/.test(txt), `${nom} : le dernier créneau (S5) est imprimé`);
      if (o.salle) ok(geo.salles > 0 && txt.includes(o.salle.split(" ")[0]), `${nom} : la salle reste sous la matière (${geo.salles} cases)`);
      execSync(`pdftoppm -r 60 -png -f 1 -l 1 "${f}" "${OUT}/indiv-chargee-${k}"`);
    }
    ok(!errs.length, "aucune erreur JS " + JSON.stringify(errs));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true }); }
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
