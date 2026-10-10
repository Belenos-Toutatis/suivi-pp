// Les matières rangées par CHAMP DISCIPLINAIRE (2026-10-10, l'utilisateur : « organise les matières par champ disciplinaire, tu
// peux reprendre ceux de Suivi PP ») : déduits du nom, réglables, et suivis par la palette, les réglages, les menus et les bilans.
const puppeteer = require("/usr/local/lib/node_modules/puppeteer"); const fs = require("fs"); const DIR = __dirname;
const ok = (c, m) => console.log((c ? "OK   " : "ÉCHEC") + " " + m);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const prof = fs.mkdtempSync(DIR + "/sorties/chrome-tmp-");
  const b = await puppeteer.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, userDataDir: prof, args: ["--no-sandbox"] });
  try {
  const p = await b.newPage(); await require("./boites")(p, {}); await p.setViewport({ width: 1366, height: 768 }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + DIR + "/app/Fiche de suivi collective.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { doDemo(); }); await wait(300);
  const def = await p.evaluate(() => Object.fromEntries(S.matieres.map(m => [m.nom, champDe(m)])));
  ok(def["Anglais"] === "langues" && def["Français"] === "lettres" && def["Hist.-Géo."] === "lettres" && def["Latin"] === "lettres" && def["Mathématiques"] === "sciences"
    && def["Physique-Chimie"] === "sciences" && def["Arts Plastiques"] === "arts" && def["Éd. Musicale"] === "arts" && def["EPS"] === "eps" && def["Vie de classe"] === "autre"
    && def["Devoirs faits"] === "autre", "champs déduits du nom, comme les domaines de Suivi PP " + JSON.stringify(def));
  ok(await p.evaluate(() => S.matieres.every(m => !("champ" in m))), "rien n'est écrit tant que rien n'est choisi (un ancien suivi ne change pas)");
  ok(await p.evaluate(() => { const n = normalizeState({ matieres: [{ nom: "A", prof: "", champ: "sciences" }, { nom: "B", prof: "", champ: "__proto__" }, { nom: "C", prof: "" }] }).matieres;
    return n[0].champ === "sciences" && !("champ" in n[1]) && !("champ" in n[2]); }), "normalisation : un champ connu est gardé, un inconnu retiré");
  // palette de l'emploi du temps : un paquet par champ, dans l'ordre de Suivi PP
  await p.evaluate(() => { location.hash = "#edt"; }); await wait(500);
  const pal = await p.evaluate(() => [...document.querySelectorAll(".palette .pal-champ")].map(g => [g.querySelector(".pal-t").textContent, [...g.querySelectorAll("[data-pin]")].map(x => x.dataset.pin)]));
  ok(pal.map(g => g[0]).join(" | ") === "Langues | Lettres et humanités | Sciences | Arts | EPS | Autre" && pal[0][1].join() === "Anglais,Allemand,Espagnol"
    && pal[2][1].includes("Mathématiques") && !!(await p.$('.palette > [data-pin=""]')), "palette : rangée par champ (et la gomme à part) " + JSON.stringify(pal.map(g => g[1].length)));
  // réglages : un intertitre par champ, un menu par matière ; changer le champ range la matière ailleurs ; Ctrl+Z
  await p.evaluate(() => { location.hash = "#reglages/matieres"; }); await wait(500);
  ok(await p.evaluate(() => [...document.querySelectorAll(".liste.lm .lgroupe")].length === 6 && document.querySelectorAll('.liste.lm select[data-path$=".champ"]').length === S.matieres.length),
    "réglages : un intertitre par champ, un menu « Champ » par matière");
  const k = await p.evaluate(() => S.matieres.findIndex(m => m.nom === "Latin"));
  await p.select(`select[data-path="matieres.${k}.champ"]`, "langues"); await wait(400);
  const apres = await p.evaluate(k => ({ champ: S.matieres[k].champ, groupe: (() => { let x = document.querySelector(`select[data-path="matieres.${k}.champ"]`).closest(".lrow").previousElementSibling; while (x && !x.classList.contains("lgroupe")) x = x.previousElementSibling; return x && x.textContent; })(),
    pal: ordreMatieres(S).indexOf("Latin") < ordreMatieres(S).indexOf("Français") }), k);
  ok(apres.champ === "langues" && apres.groupe === "Langues" && apres.pal, "champ choisi : rangé sous « Langues », partout");
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await wait(400);
  ok(await p.evaluate(k => !("champ" in S.matieres[k]) && champDe(S.matieres[k]) === "lettres", k), "Ctrl+Z : le champ redevient déduit");
  // menus de matière : groupés
  ok(await p.evaluate(() => { const d = document.createElement("select"); d.innerHTML = optionsMatieres("Latin"); return [...d.querySelectorAll("optgroup")].map(g => g.label).join("|") === "Langues|Lettres et humanités|Sciences|Arts|EPS|Autre" && d.value === "Latin"; }),
    "menus de matière (fiche du jour, changement d'enseignant) : groupés par champ");
  // bilans par matière : dans l'ordre des champs, un trait entre deux champs
  for (const [h, sel] of [["#bilan", "table.bil tbody tr[data-pin]"], ["#classebilan", "table.clb tbody tr:not(.moy)"]]) {
    await p.evaluate(h => { location.hash = h; }, h); await wait(600);
    const r = await p.evaluate(sel => { const tr = [...document.querySelectorAll(sel)].filter(x => x.querySelector(".l, th.l"));
      const noms = tr.map(x => (x.dataset.pin || x.querySelector("th.l").firstChild.textContent).trim()), ordre = ordreMatieres(S).filter(n => noms.includes(n));
      const ch = noms.map(n => champDe(S.matieres.find(m => m.nom === n))), attendu = ch.filter((c, i) => i && c !== ch[i - 1]).length;
      return { meme: JSON.stringify(noms) === JSON.stringify(ordre), sep: document.querySelectorAll(sel.split(" tr")[0] + " tr.nv-champ").length, attendu, n: noms.length }; }, sel);
    ok(r.meme && r.sep === r.attendu && r.attendu >= 3, `${h} : matières dans l'ordre des champs, un trait entre deux champs (${r.n} matières, ${r.sep} traits)`);
  }
  ok(!errs.length, "aucune erreur JS" + (errs.length ? " : " + errs.join(" | ") : ""));
  } finally { await b.close(); fs.rmSync(prof, { recursive: true, force: true }); }
})();
