/* =====================================================================
   Fiche de classe (tous les élèves, codes d'incident) et suivis individuels hebdomadaires
   ===================================================================== */

/* ---------- fiche de classe ---------- */
let clOuvert = null;               // case « élève.créneau » dont le choix des codes est ouvert
const sensCode = c => (c === CODE_ABSENT ? "absent(e)" : (S.codesClasse.find(x => x.code === c) || {}).sens || "");
const codeClasseHTML = c => `<span class="ccode ${c === CODE_ABSENT ? "abs" : codePositif(c) ? "pos" : "neg"}">${c === CODE_ABSENT ? "abs" : esc(c)}</span>`;
const legendeCodesClasse = () => S.codesClasse.filter(c => c.code).map(c => `<b class="cle">${esc(c.code)}</b> ${esc(c.sens)}`).join(" · ") + ` · <b class="cle">${CODE_ABSENT}</b> absent(e)`;
/* ---------- fiche de classe hebdomadaire : une page portrait, un élève par colonne, les jours et créneaux en lignes ---------- */
/** Créneaux affichés pour un jour : jusqu'au dernier cours de l'emploi du temps (au moins M4). */
function creneauxSemaine(sems, d) {
  const ps = creneauxDu(S, d), der = ps.map(p => !!creneau(S, sems, d, p).mat).lastIndexOf(true);
  return ps.filter((p, i) => i <= Math.max(3, der));
}
/** Bilan de la semaine par élève : nombre par code, absences, total des remarques, heures de retenue. */
/** Une case de la fiche de classe où l'on peut noter (mêmes règles que l'affichage) : cours prévu, enseignant présent, élève présent et concerné.
    Un code saisi avant qu'on ajoute un jour sans cours, un départ, un changement de groupe… n'est plus compté. */
function caseClasseActive(sems, d, p, e, cache) {
  if (sansCours(S, d) || !creneauxDu(S, d).includes(p) || !presentClasse(e, d)) return false;
  const k = d + "." + p, cr = cache && cache.has(k) ? cache.get(k) : creneau(S, sems, d, p); if (cache) cache.set(k, cr);
  if (!cr.mat || cr.absent) return false; const c = coursPour(cr, e.groupes || []); return !!c.mat && !c.absent;   /* créneau partagé : le cours de l'élève, et son enseignant présent */
}
/** Calculs mis en cache le temps d'un affichage (vidé à chaque rendu et à chaque modification). */
let cacheCalc = new Map();
const viderCacheCalc = () => { cacheCalc = new Map(); };
function bilanSemaineClasse(w) { const k = "bsc" + w.lundi; if (!cacheCalc.has(k)) cacheCalc.set(k, bilanSemaineClasse0(w)); return cacheCalc.get(k); }
function bilanSemaineClasse0(w) {
  const r = S.retenueClasse, codes = S.codesClasse.filter(c => c.code), sems = semaines(S), cache = new Map();
  return S.classeEleves.map((e, s) => {
    const par = Object.fromEntries(codes.map(c => [c.code, 0])); let abs = 0;
    for (const d of w.jours) for (const [k, v] of Object.entries(((S.jours[d] || {}).cl) || {})) if (Number(k.split(".")[0]) === s && caseClasseActive(sems, d, Number(k.split(".")[1]), e, cache)) for (const c of v) { if (c === CODE_ABSENT) abs++; else if (c in par) par[c]++; }
    const neg = codes.filter(c => !codePositif(c.code)).reduce((a, c) => a + par[c.code], 0), pos = codes.filter(c => codePositif(c.code)).reduce((a, c) => a + par[c.code], 0);
    const total = Math.max(0, neg - (r.positifAnnule ? pos : 0));
    return { par, abs, neg, pos, total, retenue: r.remarques ? Math.floor(total / r.remarques) * r.heures : 0 };
  });
}
const regleRetenue = () => { const r = S.retenueClasse; return r.remarques ? `${r.remarques} remarque${r.remarques > 1 ? "s" : ""} cumulée${r.remarques > 1 ? "s" : ""} sur la semaine = ${r.heures} heure${r.heures > 1 ? "s" : ""} de retenue${r.positifAnnule && S.codesClasse.some(c => codePositif(c.code)) ? ` · ${(l => l.length > 1 ? `les codes ${l.slice(0, -1).join(", ")} et ${l[l.length - 1]} en annulent une` : `le code ${l[0]} en annule une`)(S.codesClasse.filter(c => c.code && codePositif(c.code)).map(c => c.code))}` : ""}` : ""; };
function classeSemaineHTML(wi, edit) {
  const sems = semaines(S), w = sems[wi], n = S.classeEleves.length, codes = S.codesClasse.filter(c => c.code), bil = bilanSemaineClasse(w), r = S.retenueClasse;
  const lignesJour = w.jours.map(d => ({ d, off: sansCours(S, d), ps: creneauxSemaine(sems, d) }));
  const nbL = lignesJour.reduce((a, j) => a + j.ps.length, 0), nbPied = codes.length + 2 + (r.remarques ? 1 : 0);
  // A4 portrait, marges de 8 mm : 281 mm de haut, moins l'en-tête (≈ 27 mm), les noms (34 mm) et les lignes du bas (4,2 mm chacune)
  const dispo = 281 - 27 - 34 - nbPied * 4.2 - 3, etabCl = !edit && !!(S.etablissement.logo || S.etablissement.nom) && (dispo - 12) / nbL >= 4.6;   // logo seulement s'il reste de la place
  const rh = Math.max(3.4, Math.min(6.5, (dispo - (etabCl ? 8 : 0)) / nbL)), cw = Math.max(4.6, Math.min(9, 150 / Math.max(n, 1)));
  const head = `${etabCl ? `<div class="cs-etab">${enteteEtab(true)}</div>` : ""}<div class="cs-titre" role="heading" aria-level="2" data-titre>Fiche de suivi hebdomadaire — classe${S.classe ? " de " + esc(S.classe) : ""}</div>
    <div class="cs-sous">Semaine ${w.num} (${w.type}) — du ${fmtDM(w.lundi)}/${w.lundi.slice(0, 4)} au ${fmtDM(w.jours.at(-1))}/${w.jours.at(-1).slice(0, 4)}</div>
    <div class="cs-resp"><b>Responsable :</b>${w.jours.map((d, k) => `<span><b>${DAYS[k].slice(0, 3)}.</b> ${edit ? `<input type="text" list="liste-cl" data-clresp="${d}" value="${esc((S.jours[d] || {}).clresp || "")}" ${sansCours(S, d) ? "disabled" : ""} aria-label="Responsable de la fiche le ${DAYS[k].toLowerCase()}" title="Responsable de la fiche\n${DAYS[k]} ${fmtDM(d)} : l’élève qui la porte d’un cours à l’autre.">` : `<i>${esc((S.jours[d] || {}).clresp || "")}</i>`}</span>`).join("")}</div>
    ${edit ? `<datalist id="liste-cl">${S.classeEleves.map(e => `<option value="${esc(e.nom)}">`).join("")}</datalist>` : ""}
    <div class="cs-codes">Codes : ${codes.map(c => `<b>${esc(c.code)}</b> = ${esc(c.sens)}`).join(" | ")} | <b>${CODE_ABSENT}</b> = absent(e) — plusieurs codes par case (ex. : <b>${esc(codes.slice(0, 2).map(c => c.code).join(""))}</b>)</div>
    ${r.remarques ? `<div class="cs-attention">ATTENTION — ${esc(regleRetenue())}</div>` : ""}`;
  const noms = S.classeEleves.map((e, s) => `<th class="cs-nom${e.nom.length > 24 ? " tres-long" : e.nom.length > 17 ? " long" : ""}" title="${esc(e.nom)}"><span>${esc(e.nom)}</span></th>`).join("");
  const corps = lignesJour.map(({ d, off, ps }, k) => ps.map((p, i) => {
    const cr = creneau(S, sems, d, p), actif = !off && cr.mat && !cr.absent, cl = ((S.jours[d] || {}).cl) || {};
    const jourTh = i === 0 ? `<th class="cs-jour" rowspan="${ps.length}"><span>${DAYS[k]}</span>${off ? `<small>${esc(motifSansCours(S, d))}</small>` : ""}</th>` : "";
    const cases = S.classeEleves.map((e, s) => { if (!actif) return `<td class="ferme"></td>`;
      if (!presentClasse(e, d)) return `<td class="ferme hors" title="${esc(e.nom)}\n${e.fin && d > e.fin ? "Parti(e) de la classe le " + fmtDM(e.fin) : "Arrivé(e) dans la classe le " + fmtDM(e.debut)}."></td>`;
      const cE = cr.divise ? coursPour(cr, e.groupes || []) : cr;
      if (!cE.mat) return `<td class="ferme hors" title="${esc(e.nom)} · ${DAYS[k]} ${PERIODS[p]}\nPas concerné(e) : ${esc(cr.mat)}."></td>`;
      if (cE.absent) return `<td class="ferme hors prof-abs" title="${esc(e.nom)} · ${DAYS[k]} ${PERIODS[p]}\nPas de cours : ${esc(cE.mat)}, enseignant absent${cE.prof ? ` (${esc(cE.prof)})` : ""}."></td>`;
      const v = cl[`${s}.${p}`] || "";
      return edit ? `<td class="clc${v.includes(CODE_ABSENT) ? " absent" : ""}${clOuvert === `${s}.${p}` && ficheDate === d ? " ouvert" : ""}" data-cl="${s}.${p}" data-d="${d}" tabindex="-1" role="button" aria-label="${esc(e.nom)}, ${DAYS[k]} ${PERIODS[p]} ${esc(cr.mat)} : ${v ? [...v].map(sensCode).join(", ") : "rien à signaler"}" title="${esc(e.nom)} · ${DAYS[k]} ${PERIODS[p]} · ${esc(cr.mat)}\n${v ? [...v].map(x => `• **${x === CODE_ABSENT ? "abs" : esc(x)}** ${esc(sensCode(x))}`).join("\n") : "Rien à signaler"}\n${codeCl === "?" ? "Clic : choisir les codes" : codeCl === "-" ? "Clic ou glisser : effacer" : codeCl === null ? "Clic : choisir la case, puis la lettre du code ou la palette" : `Clic ou glisser : ajouter « ${esc(codeCl)} »`} · au clavier : la lettre du code">${[...v].map(codeClasseHTML).join("")}</td>`
        : `<td class="${v.includes(CODE_ABSENT) ? "absent" : ""}">${[...v].map(x => esc(x === CODE_ABSENT ? "abs" : x)).join("")}</td>`; }).join("");
    return `<tr class="${i === 0 ? "j1" : ""}${off ? " off" : ""}">${jourTh}<th class="cs-cr">${PERIODS[p]}</th><td class="cs-mat${actif ? "" : " ferme"}${actif && cr.divise ? " deux" : ""}${edit && !off && (cr.mat || cr.absent) ? " crn-b" : ""}"${edit && !off && (cr.mat || cr.absent) ? ` data-crn="${d}|${p}" role="button" tabindex="0"` : ""} title="${esc(cr.mat || cr.demi || "Pas de cours")}${cr.prof ? "\n" + esc(cr.prof) : ""}${cr.remplace ? " (remplaçant)" : ""}${cr.absent ? "\nenseignant absent" : ""}${edit && !off && (cr.mat || cr.absent) ? "\nClic : enseignant absent ou remplacé" : ""}">${actif ? esc(cr.divise ? [...cr.grp.map(x => abrege(x.mat)), ...(cr.baseMat ? [abrege(cr.baseMat)] : [])].join(" / ") : abrege(cr.mat)) : off ? "" : cr.absent ? "<small>abs.</small>" : cr.demi ? `<small>${esc(cr.demi)}</small>` : ""}</td>${cases}</tr>`; }).join("")).join("");
  const ligneP = (lib, cls, f) => `<tr class="${cls}"><th colspan="3" class="cs-plib" title="${lib}">${lib}</th>${bil.map(b => `<td>${f(b) || ""}</td>`).join("")}</tr>`;
  const pied = codes.map(c => ligneP(`${esc(c.code)} – ${esc(c.sens)}`, codePositif(c.code) ? "pp pos" : "pp", b => b.par[c.code])).join("")
    + ligneP("Absences (créneaux)", "pp", b => b.abs)
    + ligneP("TOTAL des remarques", "ptot", b => b.total)
    + (r.remarques ? ligneP("Retenue (h)", "pret", b => b.retenue) : "");
  return `<div class="classe-sem" style="--rhs:${rh.toFixed(2)}mm;--cws:${cw.toFixed(2)}mm">${head}
    <table class="cs"><colgroup><col class="c-j"><col class="c-cr"><col class="c-mat">${"<col class=\"c-el\">".repeat(n)}</colgroup>
    <thead><tr><th class="cs-jour">Jour</th><th class="cs-cr">Cr.</th><th class="cs-mat">Matière</th>${noms}</tr></thead><tbody>${corps}${pied}</tbody></table></div>`;
}
/** Infobule d'une case « semaine après semaine » : d'où vient le nombre (codes, jours), ce que retirent les codes positifs, le calcul de la retenue. */
/** Remarques écrites au dos des fiches de classe : S.jours[date].clr[« élève » ou « élève.créneau »] ; d'une semaine, éventuellement d'un élève.
    Avec le créneau, on sait la discipline (et l'enseignant) : r.cours. */
const remarquesClasse = (w, s = -1) => { const sems = semaines(S);
  return w.jours.flatMap(d => Object.entries(((S.jours[d] || {}).clr) || {}).map(([k, v]) => { const [a, p] = k.split("."); return { d, k, s: Number(a), p: p === undefined ? null : Number(p), txt: v }; })
    .filter(r => r.txt && (s < 0 || r.s === s)))
    .map(r => ({ ...r, cours: r.p === null ? "" : (c => `${PERIODS[r.p]} — ${c.mat || "pas de cours"}${c.prof ? ` (${c.prof})` : ""}`)(coursPour(creneau(S, sems, r.d, r.p), (S.classeEleves[r.s] || {}).groupes || [])) }))
    .sort((x, y) => x.d.localeCompare(y.d) || (x.p === null ? -1 : ORDRE_P.indexOf(x.p)) - (y.p === null ? -1 : ORDRE_P.indexOf(y.p)) || x.s - y.s); };
/** « mardi 17/11, M3 — Mathématiques (M. BROCHET) » */
const quandRem = r => `${DAYS[jourSemaine(r.d) - 1]} ${fmtDM(r.d)}${r.cours ? ", " + esc(r.cours) : ""}`;
/** Sous la fiche de la semaine : les remarques, seulement s'il y en a. */
function remarquesClasseHTML(w) {
  const l = remarquesClasse(w); if (!l.length) return "";
  return `<div class="card cl-rems no-print"><h2>Remarques des enseignants <small class="muted">(au dos de la fiche)</small></h2><ul>${l.map(r => `<li><b>${esc((S.classeEleves[r.s] || {}).nom || "?")}</b> · ${quandRem(r)} :
    <textarea rows="1" data-clrem="${r.d}|${r.k}" aria-label="Remarque">${esc(r.txt)}</textarea><button class="ghost danger" data-clrem-del="${r.d}|${r.k}" title="Supprimer cette remarque" aria-label="Supprimer la remarque">✕</button></li>`).join("")}</ul></div>`;
}
document.addEventListener("change", e => { const t = e.target; if (!S || t.dataset.clrem === undefined) return; const [d, k] = t.dataset.clrem.split("|"), j = jour(S, d, true);
  if (t.value.trim()) j.clr[k] = t.value.trim(); else delete j.clr[k]; commit(); });
document.addEventListener("click", async e => { const b = e.target.closest && e.target.closest("[data-clrem-del], [data-act='cl-rem']"); if (!b || !S) return;
  if (b.dataset.clremDel) { const [d, k] = b.dataset.clremDel.split("|"); delete jour(S, d, true).clr[k]; commit(); toast("Remarque supprimée. Ctrl+Z pour annuler."); return; }
  const w = semaines(S)[Number(b.dataset.w)], jours = w.jours.filter(d => !sansCours(S, d)); if (!jours.length) return;
  const html = `<div class="champs"><label class="champ">Élève <select id="rem-el"><option value="" selected disabled>— choisir l’élève —</option>${S.classeEleves.map((x, i) => x.nom.trim() ? `<option value="${i}">${esc(x.nom)}</option>` : "").join("")}</select></label>
    <label class="champ">Jour <select id="rem-j">${jours.map(d => `<option value="${d}"${d === ficheDate ? " selected" : ""}>${DAYS[jourSemaine(d) - 1]} ${fmtDM(d)}</option>`).join("")}</select></label>
    <label class="champ" title="Heure du cours\nLa matière et l’enseignant s’en déduisent (emploi du temps, groupes de l’élève).">Heure <select id="rem-p"></select></label></div>
    <label class="champ">Remarque <textarea id="rem-t" rows="3" placeholder="ex. Exclu de cours, rapport au professeur principal"></textarea></label>`;
  const sems = semaines(S), heures = d => { const s = Number(d.querySelector("#rem-el").value), dt = d.querySelector("#rem-j").value, g = (S.classeEleves[s] || {}).groupes || [];
    d.querySelector("#rem-p").innerHTML = `<option value="">— heure non précisée —</option>` + creneauxDu(S, dt).map(p => [p, coursPour(creneau(S, sems, dt, p), g)]).filter(([, c]) => c.mat).map(([p, c]) => `<option value="${p}">${PERIODS[p]} — ${esc(c.mat)}${c.prof ? ` (${esc(c.prof)})` : ""}</option>`).join(""); };
  const r = await saisir("Remarque au dos de la fiche", `Semaine ${w.num} : recopiez la remarque d’un enseignant.`, { html, init: d => { heures(d); d.querySelector("#rem-el").addEventListener("change", () => heures(d)); d.querySelector("#rem-j").addEventListener("change", () => heures(d)); },
    lire: d => ({ s: d.querySelector("#rem-el").value, d: d.querySelector("#rem-j").value, p: d.querySelector("#rem-p").value, t: d.querySelector("#rem-t").value.trim() }),
    valider: v => v.s === "" || v.s === null ? "Choisissez l’élève concerné." : !v.t ? "Recopiez la remarque." : "" }, { ok: "Ajouter" });
  if (!r || !r.t) return;
  const j = jour(S, r.d, true), k = r.p === "" ? r.s : `${r.s}.${r.p}`; j.clr[k] = j.clr[k] ? j.clr[k] + " — " + r.t : r.t; commit(); toast("Remarque ajoutée sous la fiche de la semaine.");
});
function infoSemaineEleve(e, s, w, x) {
  const r = S.retenueClasse, codes = S.codesClasse.filter(c => c.code), pl = (n, m) => `${n} ${m}${n > 1 ? "s" : ""}`;
  const semsJ = semaines(S), parJour = w.jours.map(d => { let n = 0; for (const [k, v] of Object.entries(((S.jours[d] || {}).cl) || {})) if (Number(k.split(".")[0]) === s && caseClasseActive(semsJ, d, Number(k.split(".")[1]), e)) for (const ch of v) if (ch !== CODE_ABSENT && !codePositif(ch)) n++; return n; });
  const l = [`${esc(e.nom)} · semaine ${w.num}`];
  if (x.neg) {
    l.push(`**${pl(x.neg, "remarque")}** :`);
    for (const c of codes.filter(c => !codePositif(c.code) && x.par[c.code])) l.push(`• ${x.par[c.code]} × ${esc(c.code)} ${esc(c.sens)}`);
    l.push(`• par jour : ${w.jours.map((d, k) => parJour[k] ? `${DAYS[k].slice(0, 3).toLowerCase()}. ${parJour[k]}` : "").filter(Boolean).join(" · ")}`);
  } else l.push("Aucune remarque.");
  if (x.pos) {
    const det = codes.filter(c => codePositif(c.code) && x.par[c.code]).map(c => `${x.par[c.code]} × ${esc(c.code)} ${esc(c.sens)}`).join(", ");
    if (r.positifAnnule && x.neg) { l.push("", `Codes positifs : ${det}`, `• ${x.pos > 1 ? "en annulent" : "en annule"} ${Math.min(x.pos, x.neg)}`, `**Total : ${x.neg} − ${Math.min(x.pos, x.neg)} = ${x.total} remarque${x.total > 1 ? "s" : ""}**`); }
    else l.push("", `Codes positifs : ${det}${r.positifAnnule ? "" : " (n’annulent pas de remarque : règle de la semaine)"}`);
  }
  if (r.remarques && x.total) {
    const q = Math.floor(x.total / r.remarques), reste = x.total - q * r.remarques;
    l.push("", x.retenue ? `**Retenue : ${x.retenue} h** — ${x.total} remarque${x.total > 1 ? "s" : ""} = ${q} × ${r.remarques}${reste ? ` + ${reste}` : ""}, et ${nbMot(r.remarques, "remarque")} = ${r.heures} h` : `Pas de retenue : ${x.total} remarque${x.total > 1 ? "s" : ""}, il en faut ${r.remarques}`);
  }
  if (x.abs) l.push(`• absent(e) à ${x.abs} cours`);
  const rems = remarquesClasse(w, s); if (rems.length) l.push("", "**Remarques des enseignants :**", ...rems.map(r => `• ${DAYS[jourSemaine(r.d) - 1].slice(0, 3).toLowerCase()}. ${fmtDM(r.d)}${r.cours ? ", " + esc(r.cours) : ""} : ${esc(r.txt)}`));
  return l.join("\n");
}
/* ---------- fiche de classe : semaine après semaine (incidents de chaque élève, retenues, tendance) ---------- */
function suiviClasseHTML(wi) {
  const sems = semaines(S), r = S.retenueClasse, aDesSaisies = w => w.jours.some(d => Object.keys(((S.jours[d] || {}).cl) || {}).length);
  const der = Math.max(wi, ...sems.map((w, i) => (aDesSaisies(w) ? i : -1)));
  const cols = sems.slice(0, der + 1).map((w, i) => ({ w, i, b: bilanSemaineClasse(w) }));
  const seuilR = r.remarques || SEUILS_INC.rouge, seuilO = r.remarques ? Math.max(1, r.remarques - 1) : SEUILS_INC.orange;
  const cls = t => (t >= seuilR ? " p3" : t >= seuilO ? " p2" : "");
  const tend = vals => { if (vals.length < 3) return null; const k = Math.min(2, Math.floor(vals.length / 2)), m = l => l.reduce((a, x) => a + x, 0) / l.length; return Math.round((m(vals.slice(-k)) - m(vals.slice(-2 * k, -k))) * 10) / 10; };
  const motT = t => t === null ? "" : t >= 1 ? `<span class="dn">↑ en hausse</span>` : t <= -1 ? `<span class="up">↓ en baisse</span>` : "= stable";
  // graphique : incidents de toute la classe, semaine par semaine
  const incClasse = cols.map(c => c.b.reduce((a, x) => a + x.neg, 0)), mx = Math.max(4, ...incClasse), H = 120, bw = 34, gap = 14, W = cols.length * (bw + gap) + 40;
  const barres = cols.map((c, k) => { const h = Math.round(incClasse[k] / mx * (H - 34)), x = 30 + k * (bw + gap);
    return `<a href="#classesem/${c.i}"><rect x="${x}" y="${H - 18 - h}" width="${bw}" height="${Math.max(h, 1)}" rx="4" fill="${c.i === wi ? "#1f5f9e" : "#a9c4e2"}"${c.i === wi ? ' class="on"' : ""}><title>Semaine ${c.w.num} : ${incClasse[k]} incident${incClasse[k] > 1 ? "s" : ""} pour la classe\nClic : la fiche de cette semaine</title></rect>
      <text x="${x + bw / 2}" y="${H - 22 - h}" text-anchor="middle" font-size="11" fill="#334">${incClasse[k] || ""}</text><text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${c.i === wi ? "#1f5f9e" : "#667"}" font-weight="${c.i === wi ? 700 : 400}"${c.i === wi ? ' class="on"' : ""}>S${c.w.num}</text></a>`; }).join("");
  const graphe = `<svg class="cl-graphe" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Incidents de la classe, semaine par semaine">${barres}</svg>`;
  const lignes = S.classeEleves.map((e, s) => { const vals = cols.map(c => c.b[s].total);
    const somme = vals.reduce((a, x) => a + x, 0), heures = cols.reduce((a, c) => a + c.b[s].retenue, 0), t = tend(vals);
    return `<tr class="${somme ? "" : "rien"}"><th class="l" scope="row">${esc(e.nom)}</th>${cols.map(c => { const x = c.b[s];
      const rem = remarquesClasse(c.w, s).length;
      return `<td class="${c.i === wi ? "on" : ""}"${x.neg || x.pos || rem ? ` title="${infoSemaineEleve(e, s, c.w, x)}"` : ""}>${x.total ? `<span class="pn${cls(x.total)}">${x.total}</span>${x.retenue ? `<small class="ret">${x.retenue} h</small>` : ""}` : x.pos ? `<small class="muted">+${x.pos}</small>` : ""}${rem ? `<small class="rem-mk" aria-label="remarque écrite">✎</small>` : ""}</td>`; }).join("")}
      <td class="sep">${somme || ""}</td><td>${heures ? `<b class="ret">${heures} h</b>` : ""}</td><td class="tend">${motT(t)}</td></tr>`; }).join("");
  const nbRet = cols.map(c => c.b.filter(x => x.retenue).length);
  return `<div class="card cl-suivi synth${S.classeEleves.length > 26 ? " nombreux" : ""}"><div class="row"><h2 style="margin:0">Semaine après semaine</h2><span class="spacer"></span><span class="small muted">${r.remarques ? esc(regleRetenue()) : ""}</span></div>
    <p class="hint ecran">Les incidents de la classe et de chaque élève, au fil des semaines : qui accumule, qui s’améliore. Un clic sur une barre ou une semaine ouvre sa fiche.</p>
    <div class="evol-defil">${graphe}</div>
    <div class="evol-defil"><table class="evol cl-sem"><thead><tr><th class="l">Total des remarques</th>${cols.map(c => `<th class="${c.i === wi ? "on" : ""}"><a href="#classesem/${c.i}" title="Semaine ${c.w.num} : ouvrir sa fiche">S${c.w.num}</a></th>`).join("")}<th class="sep" title="Total sur toutes les semaines affichées">Total</th><th title="Heures de retenue, d’après la règle de la semaine">Retenues</th><th title="Tendance\nMoyenne des 2 dernières semaines comparée aux 2 précédentes.">Tendance</th></tr></thead>
    <tbody>${lignes}<tr class="ens"><th class="l" title="Classe : incidents\nTous les incidents notés, avant l’annulation par les codes positifs (la colonne Total des élèves, elle, les retire).">Classe : incidents notés</th>${cols.map((c, k) => `<td class="${c.i === wi ? "on" : ""}">${incClasse[k] || ""}</td>`).join("")}<td class="sep">${incClasse.reduce((a, x) => a + x, 0) || ""}</td><td></td><td class="tend">${motT(tend(incClasse))}</td></tr>
    ${r.remarques ? `<tr class="nb"><th class="l">Élèves en retenue</th>${cols.map((c, k) => `<td class="${c.i === wi ? "on" : ""}">${nbRet[k] || ""}</td>`).join("")}<td class="sep"></td><td></td><td></td></tr>` : ""}</tbody></table></div>
    <p class="legend-dots"><span><span class="pn p2">${seuilO}</span> ${r.remarques ? "à une remarque de la retenue" : "à surveiller"}</span><span><span class="pn p3">${seuilR}</span> ${r.remarques ? "retenue" : "beaucoup d’incidents"}</span><span>Total = remarques${r.positifAnnule ? " − codes positifs" : ""}</span></p></div>`;
}
apresRendu.push(() => { if (current.view !== "classesem") return; const t = document.querySelector(".cl-sem th.on"), d = t && t.closest(".evol-defil"); if (d) d.scrollLeft = Math.max(0, t.offsetLeft - d.clientWidth / 2); });
function viewClasseSemaine(arg) {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  const today = aujourdhui(); let wi = Number.isInteger(Number(arg)) && arg !== null && arg !== "" && sems[Number(arg)] ? Number(arg) : -1;
  if (wi < 0) { const w = ficheDate && semaineDuJour(sems, ficheDate); wi = w ? sems.indexOf(w) : Math.max(0, sems.findIndex(w => w.jours.at(-1) >= today)); }
  const w = sems[wi], b = bilanSemaineClasse(w), tot = b.reduce((a, x) => a + x.neg, 0), ret = b.reduce((a, x) => a + x.retenue, 0), nRet = b.filter(x => x.retenue).length;
  const opts = sems.map((x, i) => `<option value="${i}" ${i === wi ? "selected" : ""}>Semaine ${x.num} (${fmtDM(x.lundi)} → ${fmtDM(x.jours.at(-1))})</option>`).join("");
  return `<div class="page-tete no-print"><div class="titres"><span class="surtitre">Classe entière · fiche de classe de la semaine · semaine ${w.type}</span><h1 data-titre>Semaine ${w.num} · du ${fmtDM(w.lundi)} au ${fmtDM(w.jours.at(-1))}</h1></div>
    <div class="nav-jours"><button class="discret" data-gocs="${wi - 1}" ${wi ? "" : "disabled"} title="Semaine précédente\nRaccourci : touche ←" aria-label="Semaine précédente"><svg class="ic" aria-hidden="true"><use href="#i-prec"/></svg></button>
      <select id="pick-week-cl" aria-label="Semaine affichée" style="height:36px">${opts}</select>
      <button class="discret" data-gocs="${wi + 1}" ${wi < sems.length - 1 ? "" : "disabled"} title="Semaine suivante\nRaccourci : touche →" aria-label="Semaine suivante"><svg class="ic" aria-hidden="true"><use href="#i-suiv"/></svg></button></div>
    <div class="actions"><button data-act="print-cl-sem" data-w="${wi}" title="Imprimer la fiche de la semaine\nUne page A4 portrait.\nRaccourci : Ctrl+P"><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button>
      <button data-act="cl-rem" data-w="${wi}" title="Remarque d’un enseignant\nÉcrite au dos de la fiche (ex. exclusion de cours, mot dans le carnet) : à recopier ici.\n• elle apparaît sous la fiche, dans « Semaine après semaine » et sur la fiche de l’élève">✎ Remarque…</button></div></div>
  ${S.classeEleves.length ? `<div class="row chips-jour no-print"><span class="chip${tot ? " warn" : ""}">${tot} incident${tot > 1 ? "s" : ""} dans la semaine</span>${S.retenueClasse.remarques ? `<span class="chip${ret ? " warn" : ""}" title="Retenues\n${esc(regleRetenue())}">${nRet} élève${nRet > 1 ? "s" : ""} en retenue (${ret} h)</span>` : ""}
    </div>
  ${edtVide() ? `<div class="banner-info no-print">L’emploi du temps est vide : toutes les cases sont hachurées. Remplissez d’abord l’<a href="#edt">Emploi du temps</a>.</div>` : ""}
  ${paletteClasse()}
  <div class="sheet papier cs-feuille">${classeSemaineHTML(wi, true)}</div>
  ${remarquesClasseHTML(w)}
`
  : `<div class="card"><h2>Liste de la classe à compléter</h2><p>Ajoutez la liste des élèves dans <a href="#reglages/classeEntiere">Réglages › Élèves et groupes</a>.</p></div>`}`;
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-gocs]"); if (b && S && b.dataset.gocs !== "") location.hash = "#classesem/" + b.dataset.gocs; });
document.addEventListener("change", e => { if (S && e.target.id === "pick-week-cl") location.hash = "#classesem/" + e.target.value; });
document.addEventListener("input", e => { const t = e.target; if (!S || t.dataset.clresp === undefined) return;
  const j = jour(S, t.dataset.clresp, true); if (t.value.trim()) j.clresp = t.value; else delete j.clresp; commit(false, true); });
/* choix des codes d'une case : petite fenêtre près de la case */
const popCl = document.createElement("div"); popCl.id = "pop-cl"; popCl.className = "no-print"; popCl.hidden = true; document.body.appendChild(popCl);
const caseCl = k => k && document.querySelector(current.view === "classesem" ? `td[data-cl="${k}"][data-d="${ficheDate}"]` : `td[data-cl="${k}"]`);
function placerPopCl() {
  const td = caseCl(clOuvert);
  if (!td || (current.view !== "classe" && current.view !== "classesem")) { popCl.hidden = true; return; }
  const [s, p] = clOuvert.split(".").map(Number), v = ((S.jours[ficheDate] || {}).cl || {})[clOuvert] || "", cr = coursPour(creneau(S, semaines(S), ficheDate, p), S.classeEleves[s].groupes || []);
  popCl.innerHTML = `<div class="row"><b>${esc(S.classeEleves[s].nom)} · ${PERIODS[p]} ${esc(cr.mat)}</b><span class="spacer"></span><button class="ghost" data-clferme aria-label="Fermer">✕</button></div>
    <div class="chips-codes">${codesClasse(S).map(c => `<button type="button" data-clcode="${esc(c)}" aria-pressed="${v.includes(c)}" class="${v.includes(c) ? "on" : ""}">${codeClasseHTML(c)} ${esc(sensCode(c))}</button>`).join("")}</div>
    <div class="row"><button class="ghost" data-clvide ${v ? "" : "disabled"}>Vider la case</button><span class="spacer"></span><span class="small muted">au clavier : la lettre du code</span></div>`;
  popCl.hidden = false;
  const r = td.getBoundingClientRect(), b = popCl.getBoundingClientRect();
  let x = Math.min(Math.max(8, r.left), innerWidth - b.width - 8), y = r.bottom + 6; if (y + b.height > innerHeight - 8) y = Math.max(8, r.top - b.height - 6);
  popCl.style.left = x + "px"; popCl.style.top = y + "px";
}
apresRendu.push(placerPopCl);
/* ---------- saisie rapide de la fiche de classe : un code choisi dans la palette, puis clic ou cliquer-glisser sur les cases ---------- */
let codeCl = null;               // code choisi dans la palette ; null = aucun (un clic choisit seulement la case) ; "-" = gomme ; "?" = fenêtre de choix
const codePalette = () => codeCl;
function paletteClasse() {
  const cp = codePalette(), btn = (v, txt, tip, cls) => `<button type="button" class="pal-c ${cls || ""}${cp === v ? " on" : ""}" data-pal-cl="${esc(v)}" aria-pressed="${cp === v}" title="${tip}">${txt}</button>`;
  return `<div class="pal-ind pal-cl no-print" role="toolbar" aria-label="Code à mettre dans les cases"><span class="pal-tit">Code :</span>
    ${S.codesClasse.filter(c => c.code).map(c => btn(c.code, `${codeClasseHTML(c.code)} <small>${esc(c.sens)}</small>`, `${esc(c.code)} : ${esc(c.sens)}\n• met ce code dans la case choisie (ou l’en retire)\n• cliquer-glisser : sur plusieurs cases d’un coup\n• au clavier : touche ${esc(c.code)}`)).join("")}
    ${btn(CODE_ABSENT, `${codeClasseHTML(CODE_ABSENT)} <small>absent</small>`, "Absent(e)\nRemplace les autres codes de la case.")}
    ${btn("-", "⌫ Gomme", "Gomme\nCliquez ou glissez pour vider les cases.\n• au clavier : Suppr")}
    ${btn("?", "☰ Choisir", "Fenêtre de choix\nUn clic sur une case ouvre la liste des codes (pour en mettre plusieurs).\n• au clavier : Entrée")}
    <span class="pal-case" id="cl-case" aria-live="polite"></span>
    <span class="pal-aide" title="Saisie rapide\n• **un code choisi dans la palette** : un clic (ou un cliquer-glisser) sur les cases le met tout de suite ; un 2e clic sur ce code le désélectionne\n• **aucun code choisi** : un clic choisit la case, puis la lettre du code ou un code de la palette\n• **au clavier** : flèches pour se déplacer, la lettre du code pour l’ajouter ou le retirer, Espace : élève suivant, Suppr : vider\n• Ctrl+Z annule">Clic ou glisser : met le code · clavier : lettre du code, Espace pour avancer</span></div>`;
}
/** Emploi du temps encore vide (nouveau suivi) : les fiches n'ont aucun cours. */
const edtVide = () => toutesEdt(S).every(E => ["A", "B"].every(t => E[t].every(d => d.every(c => !c.mat && !(c.grp || []).length))));
/* La case choisie (clavier ou souris) : son élève et son cours dans la palette, car les noms en tête de colonne ne restent pas à l'écran. */
const montrerCaseCl = td => { const z = document.getElementById("cl-case"); if (z && td) z.textContent = "› " + (td.getAttribute("aria-label") || "").split(" : ")[0]; };
document.addEventListener("focusin", e => { const td = e.target.closest && e.target.closest("td.clc[data-cl]"); if (td) montrerCaseCl(td); });
document.addEventListener("mouseover", e => { const td = e.target.closest && e.target.closest("td.clc[data-cl]"); if (td) montrerCaseCl(td); });
let derniereSaisieIndiv = null;
/** Change les codes d'une case (date, « élève.créneau ») ; rendu = false : met à jour la case à l'écran sans tout redessiner. */
function poserCodes(d, cle, v, rendu) {
  const j = jour(S, d, true);
  if (v) j.cl[cle] = [...codesClasse(S)].filter(x => v.includes(x)).join(""); else delete j.cl[cle];
  if (!rendu) { const td = document.querySelector(`td[data-cl="${cle}"][data-d="${d}"]`); if (td) { const w = j.cl[cle] || ""; td.innerHTML = [...w].map(codeClasseHTML).join(""); td.classList.toggle("absent", w.includes(CODE_ABSENT)); } }
}
let peintureCl = null;           // { ajoute, vus }
function peindreCl(td) {
  const k = td.dataset.d + "|" + td.dataset.cl; if (peintureCl.vus.has(k)) return; peintureCl.vus.add(k);
  const c = codePalette(), v = ((S.jours[td.dataset.d] || {}).cl || {})[td.dataset.cl] || "";
  if (peintureCl.ajoute === undefined) peintureCl.ajoute = c !== "-" && !v.includes(c);      // la 1re case décide : ajouter ou retirer
  const n = c === "-" ? "" : !peintureCl.ajoute ? v.replace(c, "") : c === CODE_ABSENT ? CODE_ABSENT : v.replace(CODE_ABSENT, "").replace(c, "") + c;
  poserCodes(td.dataset.d, td.dataset.cl, n, false);
}
document.addEventListener("pointerdown", e => {
  const td = e.target.closest && e.target.closest("table.cs td[data-cl]");
  if (!td || e.button !== 0 || !S || codePalette() === "?") return;
  e.preventDefault(); td.focus({ preventScroll: true }); ficheDate = td.dataset.d; clOuvert = null; popCl.hidden = true;
  // un code est choisi dans la palette : le clic (ou le cliquer-glisser) le met tout de suite ; sinon le clic choisit seulement la case
  peintureCl = { vus: new Set(), derniere: td, depart: td, attente: codeCl === null }; document.body.classList.add("tracage"); if (codeCl !== null) peindreCl(td);
});
document.addEventListener("pointermove", e => { if (!peintureCl || peintureCl.attente) return; const el = document.elementFromPoint(e.clientX, e.clientY), td = el && el.closest("table.cs td[data-cl]");
  if (!td) return; peindreCl(td); peintureCl.derniere = td; });
const finPeintureCl = (garder = false) => { if (!peintureCl) return; const t = peintureCl.derniere, attente = peintureCl.attente, plusieurs = peintureCl.vus.size > 1; peintureCl = null; document.body.classList.remove("tracage"); if (attente) { selClFraiche = true; return; }
  commit(); const c = document.querySelector(`td[data-cl="${t.dataset.cl}"][data-d="${t.dataset.d}"]`); if (c) c.focus({ preventScroll: true }); selClFraiche = garder === true; };
document.addEventListener("pointerup", finPeintureCl); document.addEventListener("pointercancel", finPeintureCl);
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-pal-cl]"); if (!b) return;
  const v = b.dataset.palCl, td = selClFraiche && selCl && document.querySelector(`table.cs td[data-cl="${selCl.cl}"][data-d="${selCl.d}"]`);
  if (codeCl === v) { codeCl = null; render(); return; }          // un clic sur le code déjà choisi le désélectionne
  const ecrire = codeCl === null && td && v !== "?"; codeCl = v;  // le code est choisi ; la case qui attendait (choisie sans code) le reçoit
  if (ecrire) { peintureCl = { vus: new Set(), derniere: td }; peindreCl(td); finPeintureCl(true); } else render(); });
let selCl = null, selClFraiche = false;  // dernière case choisie de la fiche de classe ; « fraîche » : choisie (clic, clavier), pas écrite par un glisser
document.addEventListener("focusin", e => { const td = e.target.closest && e.target.closest("table.cs td[data-cl]"); if (td) { selCl = { cl: td.dataset.cl, d: td.dataset.d }; if (!peintureCl) selClFraiche = true; } });
function basculerCode(cle, c) {
  const j = jour(S, ficheDate, true); let v = j.cl[cle] || "";
  if (c === null) v = ""; else v = v.includes(c) ? v.replace(c, "") : c === CODE_ABSENT ? CODE_ABSENT : v.replace(CODE_ABSENT, "") + c;
  if (v) j.cl[cle] = [...codesClasse(S)].filter(x => v.includes(x)).join(""); else delete j.cl[cle];
  commit();
}
document.addEventListener("click", e => {
  if (!S) return;
  const t = e.target.closest && e.target.closest("[data-clcode], [data-clvide], [data-clferme], td[data-cl], [data-goc]");
  if (!t) return;
  if (t.hasAttribute("data-clferme")) { const k = clOuvert; clOuvert = null; render(); const c = caseCl(k); if (c) c.focus(); return; }
  if (t.hasAttribute("data-clvide")) { basculerCode(clOuvert, null); return; }
  if (t.dataset.clcode) { basculerCode(clOuvert, t.dataset.clcode); return; }
  if (t.dataset.d && codePalette() !== "?") return;
  if (t.dataset.d) { if (ficheDate !== t.dataset.d) clOuvert = null; ficheDate = t.dataset.d; }
  clOuvert = clOuvert === t.dataset.cl ? null : t.dataset.cl; render();
  const c = caseCl(t.dataset.cl); if (c) c.focus({ preventScroll: true });
});
document.addEventListener("pointerdown", e => { if (clOuvert && !e.target.closest("#pop-cl") && !e.target.closest("td[data-cl]")) { clOuvert = null; popCl.hidden = true; render(); } });
document.addEventListener("keydown", e => {
  if (!S || (current.view !== "classe" && current.view !== "classesem")) return;
  if (e.key === "Escape" && clOuvert) { e.preventDefault(); const k = clOuvert; clOuvert = null; render(); const c = caseCl(k); if (c) c.focus(); return; }
  const td = e.target.closest && e.target.closest("td[data-cl]");
  if (!td || e.ctrlKey || e.metaKey || e.altKey) return;
  if (td.dataset.d) ficheDate = td.dataset.d;
  const cle = td.dataset.cl, [s, p] = cle.split(".").map(Number);
  const dir = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  if (dir && current.view === "classesem") {      // semaine : colonnes = élèves, lignes = créneaux de la semaine
    e.preventDefault(); e.stopPropagation();
    let n = null;
    if (dir[1]) { const rang = [...td.parentElement.querySelectorAll("td[data-cl]")]; n = rang[rang.indexOf(td) + dir[1]]; }
    else { let tr = td.parentElement; while ((tr = dir[0] > 0 ? tr.nextElementSibling : tr.previousElementSibling) && !(n = tr.querySelector(`td[data-cl^="${s}."]`))); }
    if (n) { n.focus(); ficheDate = n.dataset.d; if (clOuvert) { clOuvert = n.dataset.cl; placerPopCl(); } }
    return;
  }
  if (dir) {
    e.preventDefault(); e.stopPropagation();
    let ns = s + dir[0], np = p + dir[1], n;
    while (ns >= 0 && ns < S.classeEleves.length && np >= 0 && np < NB_P && !(n = document.querySelector(`td[data-cl="${ns}.${np}"]`))) { ns += dir[0]; np += dir[1]; }
    if (n) { document.querySelectorAll('td[data-cl][tabindex="0"]').forEach(x => { x.tabIndex = -1; }); n.tabIndex = 0; n.focus(); if (clOuvert) { clOuvert = n.dataset.cl; placerPopCl(); } }
    return;
  }
  if (e.key === " " && current.view === "classesem") { e.preventDefault(); const rang = [...td.parentElement.querySelectorAll("td[data-cl]")], n = rang[rang.indexOf(td) + 1]; if (n) n.focus(); return; }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clOuvert = clOuvert === cle ? null : cle; render(); const c = caseCl(cle); if (c) c.focus(); return; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); clOuvert = clOuvert ? cle : null; basculerCode(cle, null); const c = caseCl(cle); if (c) c.focus(); return; }
  const k = e.key.length === 1 ? e.key.toUpperCase() : "";
  if (k && codesClasse(S).includes(k)) { e.preventDefault(); const ouvert = clOuvert; clOuvert = ouvert ? cle : null; basculerCode(cle, k); const c = caseCl(cle); if (c) c.focus(); }
}, true);

/* ---------- suivis individuels : une fiche par période de 5 jours de cours, jusqu'au jour de remise ---------- */
const NUM_OBJ = ["①", "②", "③", "④"];
const regIndOuvert = new Set();   // suivis dont les réglages sont dépliés
document.addEventListener("toggle", e => { const d = e.target; if (d.matches && d.matches("details.reg-ind")) { if (d.open) regIndOuvert.add(d.dataset.regind); else regIndOuvert.delete(d.dataset.regind); } }, true);
/** Nom de matière court, pour les colonnes étroites de la fiche individuelle. */
const ABREGES = { "Mathématiques": "Maths", "Physique-Chimie": "Phys.-Chimie", "Technologie": "Techno", "Arts Plastiques": "Arts plast.", "Éd. Musicale": "Musique",
  "Éd. Religieuse": "Religion", "Vie de classe": "Vie classe", "Devoirs faits": "Dev. faits", "Hist.-Géo.": "Hist.-Géo." };
const abrege = m => ABREGES[m] || (m.length > 11 ? m.slice(0, 10) + "." : m);
const indivParId = id => S.individuels.find(i => i.id === id);
const jourSemaine = d => (parseD(d).getUTCDay() + 6) % 7 + 1;          // 1 = lundi … 5 = vendredi
const JOURS_REMISE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
/** Jour de remise d'un suivi : le sien, sinon celui des réglages. */
const remiseDe = ind => ind.remise || S.remiseIndiv || 5;
/** Fiches d'un suivi : chacune va jusqu'au jour de remise (5 jours de cours en général, vacances sautées). Clé d'une fiche : son dernier jour. */
function cyclesIndiv(ind) {
  const cycles = []; let cur = [];
  for (const d of ficheDates()) {
    if (ind.debut && d < ind.debut) continue;
    if (ind.fin && d > ind.fin) break;
    cur.push(d);
    if (jourSemaine(d) === remiseDe(ind)) { cycles.push(cur); cur = []; }
  }
  if (cur.length) cycles.push(cur);
  return cycles.map(j => ({ debut: j[0], fin: j[j.length - 1], jours: j }));
}
/** Fiche en cours (celle qui contient aujourd'hui, sinon la dernière commencée, sinon la première). */
const cycleCourant = (cy, today = aujourdhui()) => cy.find(c => c.fin >= today && c.debut <= today) || cy.filter(c => c.debut <= today).pop() || cy[0];
const periodeCycle = c => `du ${fmtLong(c.debut).replace(/ \d{4}$/, "")} au ${fmtLong(c.fin)}`;
/** Après un changement du jour de remise : chaque bilan écrit passe sur la nouvelle fiche qui contient la plupart de ses jours. */
function recalerBilans(ind, anciens) {
  const nouv = cyclesIndiv(ind), b = {}, reste = { ...ind.bilans };
  for (const c of anciens) { const txt = bilanCycle(ind, c); if (!txt) continue;
    for (const k of [c.fin, ...c.jours]) delete reste[k];
    const cible = nouv.map(n => [n, n.jours.filter(d => c.jours.includes(d)).length]).sort((x, y) => y[1] - x[1])[0];
    const cle = cible && cible[1] ? cible[0].fin : c.fin;
    b[cle] = b[cle] ? b[cle] + "\n" + txt : txt; }
  ind.bilans = { ...reste, ...b };
}
const bilanCycle = (ind, c) => ind.bilans[c.fin] ?? c.jours.map(d => ind.bilans[d]).find(Boolean) ?? "";
/** Réussite d'une fiche pour chaque objectif : [TB+S, total, nb I, nb par code]. */
/** Une saisie compte si le cours a bien lieu (comme sur la grille) : un jour sans cours, un cours annulé ou retiré de l'emploi du temps après coup ne comptent plus. */
const coursIndivActif = (ind, d, p, sems = semaines(S), grs = groupesDe(S, ind.nom)) => { if (sansCours(S, d)) return false; const cr = coursPour(creneau(S, sems, d, p), grs); return !!cr.mat && !cr.absent; };
function statsIndiv(ind, c) {
  const r = ind.objectifs.map(() => [0, 0, 0, [0, 0, 0, 0]]), sems = semaines(S), grs = groupesDe(S, ind.nom);
  for (const d of c.jours) for (const p of creneauxDu(S, d)) { const s = ind.saisies[`${d}.${p}`]; if (!s || !coursIndivActif(ind, d, p, sems, grs)) continue;
    s.c.forEach((x, o) => { if (x === null || x === undefined || !r[o]) return; r[o][1]++; r[o][3][x]++; if (x < 2) r[o][0]++; if (x === 3) r[o][2]++; }); }
  return r;
}
/** Jour où l'élève reçoit la fiche suivante : 1er jour de cours après la remise (lundi après un vendredi, rentrée après des vacances). */
/** Jour de remise réel d'une fiche : son dernier jour de cours (le jour de remise peut être férié, ex. Vendredi saint, pont). */
const remiseCycle = c => [...c.jours].reverse().find(d => !sansCours(S, d)) || c.fin;
function repriseIndiv(ind, c) {
  const cy = cyclesIndiv(ind), k = cy.findIndex(x => x.fin === c.fin), suiv = k >= 0 && cy[k + 1], d1 = suiv && suiv.jours.find(d => !sansCours(S, d));
  if (d1) return fmtLong(d1).replace(/ \d{4}$/, "");
  if (suiv) c = suiv;                 // fiche suivante sans aucun jour de cours : on cherche après elle
  // dernière fiche de la période : 1er jour de semaine sans vacances ni jour férié, même au-delà de la période
  for (let d = addDays(c.fin, 1), i = 0; i < 120; d = addDays(d, 1), i++)
    if (jourSemaine(d) <= 5 && !S.joursSansCours.some(j => j.date === d) && !vacancesDu(S, d)) return fmtLong(d).replace(/ \d{4}$/, "");
  return "jour de cours suivant";
}
const consigneIndiv = (ind, c) => ((S.consignesIndiv[S.consigneIndivChoisie] || S.consignesIndiv[0] || {}).texte || "").replace(/\[reprise\]/gi, () => repriseIndiv(ind, c)).replace(/\[r[ée]f[ée]rent\]/gi, S.referent || "le professeur principal").replace(/\[jour\]/gi, () => fmtLong(remiseCycle(c)).replace(/ \d{4}$/, ""));   /* casse et accents indifférents */
/** Fiche individuelle. famille = true : jointe au bilan pour la famille, sans le pied (bilan et visa déjà en page 1). */
/** Semaine(s) d'une fiche individuelle : « semaine 45 (B) », ou « semaines 47 et 48 » si elle est à cheval ; court : « S45 », « S47-48 ». */
function semainesCycle(c, court = false) {
  const sems = semaines(S), ws = [...new Set(c.jours.map(d => semaineDuJour(sems, d)).filter(Boolean))];
  if (!ws.length) return "";
  if (court) return "S" + ws.map(w => w.num).join("-");
  return ws.length === 1 ? `semaine ${ws[0].num} (${ws[0].type})` : `semaines ${ws.map(w => w.num).join(" et ")}`;
}
function indivHTML(ind, c, edit, famille = false) {
  const sems = semaines(S), ii = S.individuels.indexOf(ind), no = ind.objectifs.length, codes = S.codage.map(x => esc(x.code));
  const types = [...new Set(c.jours.map(d => { const w = semaineDuJour(sems, d); return w ? `${w.num} (${w.type})` : ""; }).filter(Boolean))];
  const objs = ind.objectifs.map((o, k) => `<b>${NUM_OBJ[k]}</b> ${esc(o) || "<i>objectif à écrire</i>"}`).join(" &nbsp; ");
  const head = `<div class="f-head">${enteteEtab(true)}<div class="f-title" role="heading" aria-level="2" data-titre>Fiche de suivi individuelle – ${periodeCycle(c)}</div><div>Semaine${types.length > 1 ? "s" : ""} ${types.join(" et ")}</div></div>
    <div class="f-line"><span><b>Élève :</b> ${esc(ind.nom)}${S.classe ? " – " + esc(S.classe) : ""}</span><span><b>Professeur principal :</b> ${esc(S.referent)}</span></div>
    <div class="f-consigne">${esc(consigneIndiv(ind, c))}</div>
    <div class="cadre-obj"><b>Mes objectifs :</b> ${objs}<span class="petit"> &nbsp; L’enseignant écrit le code : ${S.codage.map(x => `<b>${esc(x.code)}</b> ${esc(x.sens.toLowerCase())}`).join(" · ")}</span></div>`;
  const jt = c.jours.map(d => `<th colspan="${no + 2}" class="g${sansCours(S, d) ? " ferme" : ""}">${DAYS[jourSemaine(d) - 1]} ${fmtDM(d)}${!sansCours(S, d) && jourParticulier(jourIdx(d)) ? ` <small class="j-part">⏱ ${jourParticulier(jourIdx(d))}</small>` : ""}</th>`).join("");   /* les heures de la 1re colonne sont celles des jours habituels */
  const sous = c.jours.map(() => `<th class="g mat">${!edit && c.jours.length * (no + 2) > 30 ? "Mat." : "Matière"}</th>${ind.objectifs.map((_, k) => `<th class="cd" title="Objectif ${k + 1}\n${esc(ind.objectifs[k])}">${NUM_OBJ[k]}</th>`).join("")}${edit ? `<th class="rq" title="Remarque de l’enseignant\nClic dans la case : elle s’élargit pour écrire.">Rem.</th>` : `<th class="rq">${c.jours.length * (no + 2) > 30 ? "Rem. · visa" : "Remarque · visa"}</th>`}`).join("");
  const rangs = creneauxActifs(S);
  const lignes = rangs.map((p, ip) => `<tr><th class="cr">${PERIODS[p]}${horaire(p) ? `<small>${horaire(p).split(" – ")[0]}</small>` : ""}</th>${c.jours.map(d => {
    const nomJ = DAYS[jourSemaine(d) - 1], per = PERIODS[p];
    if (sansCours(S, d)) return ip === 0 ? `<td colspan="${no + 2}" rowspan="${rangs.length}" class="g ferme jour-off">Pas de cours<br>(${esc(motifSansCours(S, d))})</td>` : "";
    if (!creneauxDu(S, d).includes(p)) return `<td colspan="${no + 2}" class="g ferme"></td>`;     // samedi après-midi
    const cr = coursPour(creneau(S, sems, d, p), groupesDe(S, ind.nom));
    if (!cr.mat || cr.absent) return `<td colspan="${no + 2}" class="g ferme${edit && cr.absent ? " crn-b" : ""}"${edit && cr.absent ? ` data-crn="${d}|${p}" role="button" tabindex="0" title="${esc(cr.mat)} : enseignant absent\nClic : rétablir le cours ou indiquer un remplaçant"` : ""}>${cr.absent ? `<small>${esc(cr.mat)} : prof absent</small>` : cr.demi ? `<small>${esc(cr.demi)}</small>` : ""}</td>`;
    const s = ind.saisies[`${d}.${p}`] || { c: [], r: "" };
    const cases = ind.objectifs.map((_, o) => { const x = s.c[o]; const v = x === null || x === undefined ? -1 : x;
      return edit ? `<td class="cd ic${v >= 0 ? " l" + v : ""}" data-ic="${ii}.${d}.${p}.${o}" tabindex="0" role="button" aria-label="${esc(cr.mat)} ${nomJ} ${per}, objectif ${o + 1} : ${v >= 0 ? codes[v] : "vide"}" title="${nomJ} ${fmtDM(d)} ${per} · ${esc(cr.mat)}\nObjectif ${o + 1} : ${esc(ind.objectifs[o])}\n• ${codeIndiv === null ? "clic : choisir la case (puis 1 à 4, ou la palette)" : "clic ou glisser : met le code choisi dans la palette"}\n• au clavier : ${touchesIndiv()}, puis la case suivante est choisie toute seule">${v >= 0 ? codes[v] : ""}</td>`
        : `<td class="cd">${v >= 0 ? codes[v] : ""}</td>`; }).join("");
    return `<td class="g mat${edit ? " crn-b" : ""}"${edit ? ` data-crn="${d}|${p}" role="button" tabindex="0"` : ""} title="${esc(cr.mat)}${cr.prof ? "\n" + esc(cr.prof) : ""}${cr.remplace ? " (remplaçant)" : ""}${edit ? "\nClic : enseignant absent ou remplacé" : ""}">${esc(abrege(cr.mat))}</td>${cases}<td class="rq">${edit ? `<input type="text" data-ir="${ii}.${d}.${p}" value="${esc(s.r)}" aria-label="Remarque ${nomJ} ${per}" title="Remarque\n${nomJ} ${fmtDM(d)} ${per} · ${esc(cr.mat)}${s.r ? "\n" + esc(s.r) : ""}">` : s.r ? `<div class="rq-t">${esc(s.r)}</div>` : ""}</td>`;
  }).join("")}</tr>`).join("");
  const bilan = bilanCycle(ind, c);
  const pied = `<table class="indiv-pied${!edit && bilanCycle(ind, c).length > 180 ? " long" : ""}"><tr><th>Bilan du professeur principal</th><td>${edit ? `<textarea data-ib="${ii}.${c.fin}" rows="2" aria-label="Bilan de la fiche" title="Bilan du professeur principal\nImprimé sur la fiche et dans le bilan envoyé à la famille.">${esc(bilan)}</textarea>` : esc(bilan)}</td><th>Visa du professeur principal</th><td class="sig"></td></tr></table>`;
  return `${head}<table class="indiv${c.jours.length * (no + 2) > 30 ? " dense" : ""}" style="--no:${no};--rhi:${Math.min(16, 112 / creneauxActifs(S).length).toFixed(1)}mm"><colgroup><col class="c-cr">${c.jours.map(() => `<col class="c-mat">${'<col class="c-cd">'.repeat(no)}<col class="c-rq">`).join("")}</colgroup>
    <thead><tr><th rowspan="2" class="cr" title="Créneau">Cr.</th>${jt}</tr><tr>${sous}</tr></thead><tbody>${lignes}</tbody></table>${famille ? "" : pied}`;
}
/** Bilan envoyé à la famille par courriel (PDF) : synthèse lisible des objectifs, remarques des enseignants, bilan du professeur principal. */
function bilanFamilleHTML(ind, c) {
  const cy = cyclesIndiv(ind), k = cy.findIndex(x => x.fin === c.fin), prec = k > 0 ? cy[k - 1] : null;
  const st = statsIndiv(ind, c), sp = prec ? statsIndiv(ind, prec) : null, codes = S.codage.map(x => esc(x.code)), sems = semaines(S);
  const objs = ind.objectifs.map((o, n) => { const x = st[n], v = x[1] ? x[0] / x[1] : null, vp = sp && sp[n][1] ? sp[n][0] / sp[n][1] : null, ev = evolution(v, vp);
    return `<tr><td class="num">${NUM_OBJ[n]}</td><td class="l">${esc(o)}</td><td>${v === null ? "—" : `<span class="pn${NIV_CLASSE[niveauReussite(S, v, x[2])] || ""}">${pctTxt(v)}</span>`}</td>
      <td class="det">${x[1] ? x[3].map((nb, l) => nb ? `${nb} ${codes[l]}` : "").filter(Boolean).join(" · ") : "rien de noté"}</td><td class="ev">${ev ? `${ev} <small>(${pctTxt(vp)})</small>` : ""}</td></tr>`; }).join("");
  const rem = [];
  for (const d of c.jours) for (const p of creneauxDu(S, d)) { const s = ind.saisies[`${d}.${p}`]; if (!s || !s.r.trim()) continue; const cr = coursPour(creneau(S, sems, d, p), groupesDe(S, ind.nom));
    rem.push(`<li><b>${DAYS[jourSemaine(d) - 1]} ${fmtDM(d)}, ${esc(cr.mat)}</b>${cr.prof ? ` (${esc(cr.prof)})` : ""} : ${esc(s.r)}</li>`); }
  const nCours = c.jours.reduce((a, d) => a + ORDRE_P.filter(p => ind.saisies[`${d}.${p}`]).length, 0);
  return `<div class="bilan-famille">${enteteEtab()}<div class="f-head"><div class="f-title" role="heading" aria-level="2">Suivi individuel – bilan pour la famille</div></div>
    <table class="bf-ident"><tr><th>Élève</th><td>${esc(ind.nom)}${S.classe ? " – " + esc(S.classe) : ""}</td><th>Période</th><td>${periodeCycle(c)}</td></tr>
    <tr><th>Professeur principal</th><td>${esc(S.referent)}</td><th>Cours notés</th><td>${nCours}</td></tr></table>
    <h3>Objectifs</h3><p class="petit">Réussite = part des cours notés « ${esc(S.codage[0].sens)} » ou « ${esc(S.codage[1].sens)} ». Codage : ${S.codage.map(x => `${esc(x.code)} ${esc(x.sens.toLowerCase())}`).join(" · ")}.</p>
    <table class="bf-obj"><thead><tr><th></th><th>Objectif</th><th>Réussite</th><th>Détail</th><th>${prec ? "Évolution" : ""}</th></tr></thead><tbody>${objs}</tbody></table>
    <h3>Remarques des enseignants</h3>${rem.length ? `<ul class="bf-rem">${rem.join("")}</ul>` : "<p>Aucune remarque sur cette période.</p>"}
    <h3>Bilan du professeur principal</h3><div class="bf-bilan">${esc(bilanCycle(ind, c)) || "&nbsp;"}</div>
    <p class="petit bf-pied">La fiche remplie par les enseignants figure en page suivante.</p></div>`;
}
const nomPdfIndiv = (ind, cs, type = cs.length > 1 ? "Fiches" : "Fiche") => nomPdf("Suivi individuel", ind.nom || "élève", type, `${cs.length === 1 && semainesCycle(cs[0]) ? semainesCycle(cs[0]).replace(/ \([AB]\)$/, "") + " " : ""}du ${dateNom(cs[0].debut)} au ${dateNom(cs[cs.length - 1].fin)}`);
/** Texte du courriel à la famille (modèle des réglages) : [élève] (Prénom NOM), [période], [référent], [classe], [bilan] (résumé de la fiche).
    html = true : texte mis en forme (pour coller dans l'ENT ou une messagerie) ; **texte** = gras. */
function texteCourriel(modele, ind, c, html = false) {
  const motsNom = ind.nom.trim().split(/\s+/), maj = w => /\p{L}/u.test(w) && w === w.toLocaleUpperCase("fr"), nomM = motsNom.filter(maj), preM = motsNom.filter(w => !maj(w));   /* « DE LA PUENTE Jean Pierre » → « Jean Pierre DE LA PUENTE » */
  const prenomNom = (nomM.length && preM.length ? preM.join(" ") + " " + nomM.join(" ") : motsNom.slice(-1)[0] + " " + motsNom.slice(0, -1).join(" ")).trim();
  const val = { eleve: prenomNom, periode: periodeCycle(c), referent: S.referent || "", classe: S.classe || "", etablissement: (S.etablissement || {}).nom || "" };   /* [Élève], [eleve]… : casse et accents indifférents */
  const mots = t => t.replace(/\[([^\[\]]{4,20})\]/g, (m, k) => { const c = sansAccent(k.trim()).toLowerCase(); return c in val ? val[c] : m; });
  return String(modele || "").split(/\[bilan\]/i).map(t => html ? esc(mots(t)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>") : mots(t).replace(/\*\*(.+?)\*\*/g, "$1"))
    .join(html ? bilanCourriel(ind, c, true) : bilanCourriel(ind, c, false).replace(/\u202F/g, "\u00A0"));   // texte copié vers une messagerie : insécable ordinaire
}
const COUL_NIV = { r: ["#fbe2e0", "#a3262a"], o: ["#fdecd9", "#8a4510"], v: ["#e6f4ea", "#2b6b3d"], vf: ["#c2e3c8", "#1a5229"] };
/** Résumé de la fiche pour le courriel : objectifs (réussite, détail, évolution), remarques des enseignants, bilan du professeur principal. */
function bilanCourriel(ind, c, html) {
  const cy = cyclesIndiv(ind), k = cy.findIndex(x => x.fin === c.fin), prec = k > 0 ? cy[k - 1] : null;
  const st = statsIndiv(ind, c), sp = prec ? statsIndiv(ind, prec) : null, sems = semaines(S);
  const evo = (v, vp) => { const e = evolution(v, vp); return !e ? "" : (e === "=" ? "stable" : /[↑↗]/.test(e) ? "en progrès" : "en baisse") + ` (fiche précédente : ${pctTxt(vp)})`; };
  const objs = ind.objectifs.map((o, n) => { const x = st[n], v = x[1] ? x[0] / x[1] : null, vp = sp && sp[n][1] ? sp[n][0] / sp[n][1] : null;
    return { o, v, niv: v === null ? "" : niveauReussite(S, v, x[2]), det: x[1] ? x[3].map((nb, l) => nb ? `${nb} ${S.codage[l].code}` : "").filter(Boolean).join(" · ") : "rien de noté", evo: evo(v, vp) }; });
  const rem = [];
  for (const d of c.jours) for (const p of creneauxDu(S, d)) { const s = ind.saisies[`${d}.${p}`]; if (!s || !s.r.trim()) continue; const cr = coursPour(creneau(S, sems, d, p), groupesDe(S, ind.nom));
    rem.push({ quand: `${DAYS[jourSemaine(d) - 1]} ${fmtDM(d)}, ${cr.mat}${cr.prof ? ` (${cr.prof})` : ""}`, r: s.r.trim() }); }
  const bilan = bilanCycle(ind, c).trim(), legende = `Réussite = part des cours notés « ${S.codage[0].sens} » ou « ${S.codage[1].sens} ».`;
  if (!html) return [`Objectifs (${legende.replace(/\.$/, "").replace(/^R/, "r")}) :`, ...objs.map((x, n) => `${n + 1}. ${x.o.replace(/[.\s]+$/, "")} : ${x.v === null ? "rien de noté" : `${pctTxt(x.v)} de réussite (${x.det})`}${x.evo ? `, ${x.evo}` : ""}`),
    "", "Remarques des enseignants :", ...(rem.length ? rem.map(r => `- ${r.quand} : ${r.r}`) : ["aucune remarque sur cette période"]),
    ...(bilan ? ["", "Bilan du professeur principal :", bilan] : [])].join("\n");
  const td = "border:1px solid #c9ced4;padding:4px 8px;vertical-align:top;";
  return `<p style="margin:0 0 4px"><b>Objectifs</b> <span style="color:#555">(${esc(legende)})</span></p>
<table style="border-collapse:collapse;margin:0 0 10px"><tr><th style="${td}background:#eceef1;text-align:left">Objectif</th><th style="${td}background:#eceef1">Réussite</th><th style="${td}background:#eceef1;text-align:left">Détail</th>${prec ? `<th style="${td}background:#eceef1;text-align:left">Évolution</th>` : ""}</tr>
${objs.map((x, n) => { const col = COUL_NIV[x.niv]; return `<tr><td style="${td}">${n + 1}. ${esc(x.o)}</td><td style="${td}text-align:center;font-weight:600;${col ? `background:${col[0]};color:${col[1]}` : ""}">${x.v === null ? "—" : pctTxt(x.v)}</td><td style="${td}">${esc(x.det)}</td>${prec ? `<td style="${td}">${esc(x.evo)}</td>` : ""}</tr>`; }).join("\n")}</table>
<p style="margin:0 0 4px"><b>Remarques des enseignants</b></p>${rem.length ? `<ul style="margin:0 0 10px">${rem.map(r => `<li><b>${esc(r.quand)}</b> : ${esc(r.r)}</li>`).join("")}</ul>` : `<p style="margin:0 0 10px">Aucune remarque sur cette période.</p>`}
${bilan ? `<p style="margin:0 0 4px"><b>Bilan du professeur principal</b></p><p style="margin:0 0 10px">${esc(bilan).replace(/\n/g, "<br>")}</p>` : ""}`;
}
function courrielFamille(ind, c) {
  const m = S.courrielIndiv || COURRIEL_INDIV_DEFAUT;
  return `mailto:${encodeURIComponent(ind.courriel)}?subject=${encodeURIComponent(texteCourriel(m.objet, ind, c))}&body=${encodeURIComponent(texteCourriel(m.texte, ind, c))}`;
}
/** Copie dans le presse-papiers : texte mis en forme (HTML) et texte brut, pour coller dans l'ENT ou une messagerie. */
async function copierRiche(html, texte) {
  try {
    if (!html && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texte); return true; }
    if (!html || !window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error("api");
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([texte], { type: "text/plain" }) })]);
    return true;
  } catch (e) {
    const el = document.createElement("div"); el.contentEditable = "true"; el.style.cssText = "position:fixed;left:-9999px;top:0;white-space:pre-wrap";
    if (html) el.innerHTML = html; else el.textContent = texte;
    document.body.appendChild(el); const sel = getSelection(), r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r);
    let ok = false; try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    sel.removeAllRanges(); el.remove(); return ok;
  }
}
/* ---------- suivi individuel : évolution d'une fiche à l'autre et aide à la décision sur le maintien ---------- */
/** Fiches qui ont au moins un cours noté, avec la réussite par objectif et pour l'ensemble. */
function serieIndiv(ind) {
  const sems = semaines(S), grs = groupesDe(S, ind.nom);
  const serie = cyclesIndiv(ind).map(c => { const st = statsIndiv(ind, c), n = c.jours.reduce((a, d) => a + ORDRE_P.filter(p => ind.saisies[`${d}.${p}`] && coursIndivActif(ind, d, p, sems, grs)).length, 0);
    const ok = st.reduce((a, x) => a + x[0], 0), tot = st.reduce((a, x) => a + x[1], 0);
    return { c, n, st, v: st.map(x => x[1] ? x[0] / x[1] : null), nI: st.map(x => x[2]), g: tot ? ok / tot : null, gI: st.reduce((a, x) => a + x[2], 0) }; }).filter(f => f.n > 0);
  // fiche courte (ex. un seul jour avant les vacances) : moins de la moitié des cours d'une fiche habituelle ; elle ne compte pas pour la fin du suivi
  const ns = serie.map(f => f.n).sort((a, b) => a - b), med = ns.length ? ns[Math.floor(ns.length / 2)] : 0;
  serie.forEach(f => { f.courte = serie.length > 1 && f.n < med / 2; });
  return serie;
}
const moyenne = t => { const u = t.filter(x => x !== null && x !== undefined); return u.length ? u.reduce((a, x) => a + x, 0) / u.length : null; };
/** Tendance : moyenne des 2 dernières fiches comparée aux 2 précédentes (en points). */
function tendanceIndiv(vals) {
  const u = vals.filter(x => x !== null); if (u.length < 2) return null;
  const k = Math.min(2, Math.floor(u.length / 2)), a = moyenne(u.slice(-2 * k, -k)), b = moyenne(u.slice(-k));
  return Math.round(b * 100) - Math.round(a * 100);
}
const flecheTendance = d => d === null ? "" : d >= 10 ? "↑" : d >= 5 ? "↗" : d <= -10 ? "↓" : d <= -5 ? "↘" : "=";
const motTendance = d => d === null ? "trop tôt" : d >= 5 ? "en progrès" : d <= -5 ? "en baisse" : "stable";
/** Aide à la décision : fin du suivi envisageable, maintien conseillé, ou maintien nécessaire. */
function avisMaintien(ind, serie0 = serieIndiv(ind)) {
  /* la fiche de la période en cours compte à partir de son jour de remise : avant, elle se remplit encore (pas d'alerte sur les premiers codes) */
  const auj = aujourdhui(), enCoursF = f => f.c.jours[0] <= auj && auj < remiseCycle(f.c), serie = serie0.filter(f => !enCoursF(f)), enCours = serie0.find(enCoursF);
  const cfg = S.finSuiviIndiv, nb = cfg.fiches, pleines = serie.filter(f => !f.courte), der = pleines.slice(-nb), raisons = [];
  const regle = `${nb} fiche${nb > 1 ? "s" : ""} de suite à ${cfg.seuil} % ou plus pour chaque objectif${cfg.sansI ? `, sans « ${S.codage[3].code} »` : ""}`;
  if (!serie.length && enCours) return { niv: "neutre", titre: "Fiche en cours", sous: `L’avis sera donné à partir du jour de remise (${fmtLong(remiseCycle(enCours.c)).replace(/ \d{4}$/, "")}).`, raisons: [], regle };
  if (!serie.length) return { niv: "neutre", titre: "Pas encore de fiche remplie", raisons: [`Fin du suivi envisageable après ${regle}.`], regle };
  const atteint = ind.objectifs.map((_, o) => der.length >= nb && der.every(f => f.v[o] !== null && pctArrondi(f.v[o]) >= cfg.seuil && (!cfg.sansI || !f.nI[o])));
  const tend = ind.objectifs.map((_, o) => tendanceIndiv(serie.map(f => f.v[o]))), dern = serie[serie.length - 1];
  ind.objectifs.forEach((o, k) => {
    const v = dern.v[k], niv = v === null ? "" : niveauReussite(S, v, dern.nI[k]);
    raisons.push({ k, ok: atteint[k], txt: atteint[k] ? `atteint sur ${nb > 1 ? `les ${nb} dernières fiches` : "la dernière fiche"} (${der.map(f => pctTxt(f.v[k])).join(", ")})`
      : `${v === null ? "rien de noté sur la dernière fiche" : `${pctTxt(v)} sur la dernière fiche${dern.nI[k] ? ` (${dern.nI[k]} « ${S.codage[3].code} »)` : ""}`} · ${motTendance(tend[k])}${tend[k] !== null ? ` (${ptsTxt(tend[k])})` : ""}`, alerte: niv === "r" || (tend[k] !== null && tend[k] <= -10) });
  });
  if (atteint.every(Boolean)) return { niv: "fin", titre: "Fin du suivi envisageable", sous: `Tous les objectifs sont atteints sur ${nb > 1 ? `les ${nb} dernières fiches` : "la dernière fiche"}.`, raisons, regle };
  if (raisons.some(r => r.alerte)) return { niv: "alerte", titre: "Maintien nécessaire", sous: "Un objectif au moins est très en dessous du seuil ou en nette baisse.", raisons, regle };
  if (pleines.length < nb) return { niv: "neutre", titre: "Trop tôt pour conclure", sous: `${pleines.length} fiche${pleines.length > 1 ? "s" : ""} complète${pleines.length > 1 ? "s" : ""} : il en faut au moins ${nb} pour envisager la fin du suivi.`, raisons, regle };
  return { niv: "maintien", titre: "Maintien conseillé", sous: `${atteint.filter(Boolean).length} objectif${atteint.filter(Boolean).length > 1 ? "s" : ""} sur ${atteint.length} atteint${atteint.filter(Boolean).length > 1 ? "s" : ""} durablement.`, raisons, regle };
}
const COUL_OBJ = ["#1f5f9e", "#0e7490", "#c2410c", "#9333ea"];
/* courbes lisibles aussi en noir et blanc : chaque série a son trait (plein, tirets, points…) et sa forme de point */
const TRAITS = ["", "7 4", "2 3", "9 3 2 3", "4 2", "12 4"];
const trait = k => (TRAITS[k % TRAITS.length] ? ` stroke-dasharray="${TRAITS[k % TRAITS.length]}"` : "");
function marque(k, x, y, r, fill, inner = "") {
  const f = k % 4, a = ` fill="${fill}"`;
  if (f === 1) return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}"${a}>${inner}</rect>`;
  if (f === 2) return `<path d="M${x},${y - r * 1.2}L${x + r * 1.15},${y + r * 0.85}L${x - r * 1.15},${y + r * 0.85}Z"${a}>${inner}</path>`;
  if (f === 3) return `<path d="M${x},${y - r * 1.3}L${x + r * 1.3},${y}L${x},${y + r * 1.3}L${x - r * 1.3},${y}Z"${a}>${inner}</path>`;
  return `<circle cx="${x}" cy="${y}" r="${r}"${a}>${inner}</circle>`;
}
/** Petite légende d'une série : son trait et sa forme de point. */
const legendeSerie = (k, coul) => `<svg class="leg-serie" width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><line x1="1" y1="6" x2="25" y2="6" stroke="${coul}" stroke-width="2.2"${trait(k)}/>${marque(k, 13, 6, 3.4, coul)}</svg>`;
/** Courbes de réussite par objectif, fiche par fiche, avec la zone rouge et le seuil de fin du suivi. */
function courbeIndiv(ind, serie, cour) {
  const n = serie.length, W = Math.max(360, 70 * n + 60), H = 200, g = 40, d = 16, h = H - 30, x = i => g + (n > 1 ? i * (W - g - d) / (n - 1) : (W - g - d) / 2), y = v => 8 + (1 - v) * (h - 8);
  const t = seuils(S), fin = S.finSuiviIndiv.seuil / 100;
  const lignes = ind.objectifs.map((_, o) => { const pts = serie.map((f, i) => f.v[o] === null ? null : [x(i), y(f.v[o])]);
    const seg = pts.reduce((a, p) => { if (!p) a.push([]); else a[a.length - 1].push(p); return a; }, [[]]).filter(s => s.length);
    return seg.map(s => `<polyline fill="none" stroke="${COUL_OBJ[o]}" stroke-width="2.4"${trait(o)} points="${s.map(p => p.join(",")).join(" ")}"/>`).join("")
      + pts.map((p, i) => p ? marque(o, p[0], p[1], serie[i].c === cour ? 5 : 3.6, COUL_OBJ[o], `<title>${esc(NUM_OBJ[o])} fiche du ${fmtDM(serie[i].c.debut)} au ${fmtDM(serie[i].c.fin)} : ${pctTxt(serie[i].v[o])}</title>`) : "").join(""); }).join("");
  return `<svg class="courbe-indiv" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Réussite par objectif, fiche par fiche">
    <rect x="${g}" y="${y(t.rouge / 100)}" width="${W - g - d}" height="${y(0) - y(t.rouge / 100)}" fill="#fbe2e0" opacity=".7"/>
    <rect x="${g}" y="${y(1)}" width="${W - g - d}" height="${y(fin) - y(1)}" fill="#e6f4ea" opacity=".8"/>
    ${[0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${g}" x2="${W - d}" y1="${y(v)}" y2="${y(v)}" stroke="#d6dae0" stroke-width="1"/><text x="${g - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#667">${v * 100} %</text>`).join("")}
    <line x1="${g}" x2="${W - d}" y1="${y(fin)}" y2="${y(fin)}" stroke="#2b6b3d" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${W - d}" y="${y(fin) - 4}" text-anchor="end" font-size="10.5" fill="#2b6b3d">fin du suivi : ${S.finSuiviIndiv.seuil} %</text>
    ${serie.map((f, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${f.c === cour ? "#1f5f9e" : "#667"}" font-weight="${f.c === cour ? 700 : 400}">${fmtDM(f.c.debut)}</text>`).join("")}
    ${lignes}</svg>`;
}
/* ---------- suivi individuel : bilan par matière (où l'élève se comporte-t-il moins bien ?) ---------- */
const bmObj = {};                  // objectif choisi pour le bilan par matière, par suivi : { k: rang, txt: son texte } (rien = tous)
/** Objectif choisi pour le bilan par matière d'un suivi (-1 = tous) ; suit l'objectif s'il change de rang, revient à « tous » s'il est supprimé. */
function objChoisi(ind) { const c = bmObj[ind.id]; if (!c) return -1;
  if (ind.objectifs[c.k] === c.txt) return c.k; const k = ind.objectifs.indexOf(c.txt); if (k >= 0) { c.k = k; return k; } delete bmObj[ind.id]; return -1; }
/** Réussite par matière et par fiche, pour un objectif (o) ou tous (-1) : [TB+S, total, nb I]. */
function bilanMatiereIndiv(ind, o = -1) {
  const sems = semaines(S), grs = groupesDe(S, ind.nom), serie = serieIndiv(ind), res = new Map(), tous = [0, 0, 0], pr = profsPeriode(S);
  for (const f of serie) for (const d of f.c.jours) for (const p of creneauxDu(S, d)) {
    const s = ind.saisies[`${d}.${p}`]; if (!s) continue;
    const cr = coursPour(creneau(S, sems, d, p), grs); if (!cr.mat || cr.absent) continue;
    if (!res.has(cr.mat)) res.set(cr.mat, { mat: cr.mat, prof: "", par: new Map(), tot: [0, 0, 0] }); pr.note(cr.mat, d); res.get(cr.mat).prof = pr.de(cr.mat) || cr.prof;
    const m = res.get(cr.mat); if (!m.par.has(f.c.fin)) m.par.set(f.c.fin, [0, 0, 0]);
    const cel = m.par.get(f.c.fin);
    s.c.forEach((x, k) => { if (x === null || x === undefined || (o >= 0 && k !== o)) return;
      for (const t of [cel, m.tot, tous]) { t[1]++; if (x < 2) t[0]++; if (x === 3) t[2]++; } });
  }
  const ordre = ordreMatieres(S);   // par champ disciplinaire
  const mats = [...res.values()].filter(m => m.tot[1]).sort((a, b) => ((ordre.indexOf(a.mat) + 1) || 99) - ((ordre.indexOf(b.mat) + 1) || 99));
  return { serie, mats, moy: tous[1] ? tous[0] / tous[1] : null, nI: tous[2] };
}
function bilanMatiereIndivHTML(ind, cour, imprime) {
  const o = objChoisi(ind), { serie, mats, moy } = bilanMatiereIndiv(ind, o);
  if (!mats.length) return imprime ? "" : "";
  const pc = t => (t[1] ? t[0] / t[1] : null), ecart = m => { const v = pc(m.tot); return v === null || moy === null ? null : Math.round(v * 100) - Math.round(moy * 100); };
  const faibles = mats.filter(m => m.tot[1] >= 6 && ecart(m) !== null && ecart(m) <= -10).sort((a, b) => ecart(a) - ecart(b));
  const cel = t => (!t || !t[1] ? `<td class="vide">—</td>` : `<td><span class="pn${NIV_CLASSE[niveauReussite(S, t[0] / t[1], t[2])] || ""}" title="Réussite : ${pctTxt(t[0] / t[1])}\n• ${t[0]} code${t[0] > 1 ? "s" : ""} ${esc(S.codage[0].code)} ou ${esc(S.codage[1].code)} sur ${t[1]}${t[2] ? `\n• ${t[2]} « ${esc(S.codage[3].code)} »` : ""}${peuDe(t[1], "codes")}">${pctTxt(t[0] / t[1])}</span></td>`);
  const debuts = debutsChamp(mats.map(m => m.mat));
  const lignes = mats.map(m => { const e = ecart(m), td = tendanceIndiv(serie.map(f => pc(m.par.get(f.c.fin) || [0, 0, 0])));
    return `<tr class="${faibles.includes(m) ? "faible" : ""}${debuts.has(m.mat) ? " nv-champ" : ""}"><th class="l" scope="row">${esc(m.mat)}${m.prof ? ` <small class="muted">${esc(m.prof)}</small>` : ""}</th>${serie.map(f => cel(m.par.get(f.c.fin))).join("")}
      <td class="sep">${cel(m.tot).replace(/^<td>|<\/td>$/g, "").replace(/^<td class="vide">/, "")}<small class="muted"> · ${m.tot[1]}</small></td>
      <td class="${e !== null && e <= -10 ? "dn" : e !== null && e >= 10 ? "up" : ""}" title="Écart à la moyenne de l’élève (${moy === null ? "—" : pctTxt(moy)}), en points">${e === null ? "" : `${ptsTxt(e)}`}</td>
      <td class="tend">${td === null ? "" : `${flecheTendance(td)} ${motTendance(td)}`}</td></tr>`; }).join("");
  const tete = serie.map(f => `<th class="${f.c === cour ? "cour" : ""}" title="Fiche du ${fmtDM(f.c.debut)} au ${fmtDM(f.c.fin)}">${fmtDM(f.c.debut)}</th>`).join("");
  const choix = imprime ? (o >= 0 ? `<p><b>Objectif :</b> ${NUM_OBJ[o]} ${esc(ind.objectifs[o])}</p>` : "")
    : `<label class="champ row" style="gap:8px">Objectif <select data-bmo="${esc(ind.id)}" aria-label="Objectif du bilan par matière"><option value="-1"${o < 0 ? " selected" : ""}>tous les objectifs</option>${ind.objectifs.map((x, k) => `<option value="${k}"${o === k ? " selected" : ""}>${NUM_OBJ[k]} ${esc(x.length > 50 ? x.slice(0, 48) + "…" : x)}</option>`).join("")}</select></label>`;
  const alerte = faibles.length ? `<div class="avis alerte" style="margin-top:8px"><b>Nettement moins bien en ${faibles.map(m => `${esc(m.mat)} (${ptsTxt(ecart(m))})`).join(", ")}</b> <span>que dans l’ensemble de ses cours (${pctTxt(moy)}).</span></div>`
    : `<p class="hint">Aucune matière nettement en dessous de sa moyenne (${moy === null ? "—" : pctTxt(moy)}).</p>`;
  const corps = `${alerte}<div class="evol-defil"><table class="evol bmi"><thead><tr><th class="l">Réussite par matière</th>${tete}<th class="sep">Période<br><small>cours notés</small></th><th class="ecart-h">Écart à sa moyenne</th><th class="tend-h">Tendance</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <p class="petit muted">Réussite = part des codes « ${esc(S.codage[0].code)} » ou « ${esc(S.codage[1].code)} »${o >= 0 ? " pour cet objectif" : ", tous objectifs réunis"}. Une matière est signalée si elle est à 10 points ou plus sous la moyenne de l’élève (sur au moins 6 codes).</p>`;
  if (imprime) return `<div class="evol-imp${serie.length > 10 ? " large" : ""}"><div class="f-head"><div class="f-title" role="heading" aria-level="2">Suivi individuel – bilan par matière</div></div>
    <p><b>Élève :</b> ${esc(ind.nom)}${S.classe ? " – " + esc(S.classe) : ""} · <b>Fiches :</b> du ${fmtDM(serie[0].c.debut)} au ${fmtLong(serie[serie.length - 1].c.fin)}</p>${choix}${corps}</div>`;
  return `<div class="card evol-indiv bmi-carte"><div class="row"><h2 style="margin:0">Bilan par matière</h2><span class="spacer"></span>${choix}
    <button data-act="print-bmi" data-ind="${esc(ind.id)}" data-w="${cour ? cour.fin : ""}" title="Imprimer le bilan par matière\nUne page."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div>
    <p class="hint">Dans quelles matières l’élève se comporte-t-il moins bien que d’habitude, et cela évolue-t-il d’une fiche à l’autre ?</p>${corps}</div>`;
}
document.addEventListener("change", e => { const t = e.target; if (!S || t.dataset.bmo === undefined) return; const ind = indivParId(t.dataset.bmo), k = Number(t.value);
  if (k < 0 || !ind) delete bmObj[t.dataset.bmo]; else bmObj[t.dataset.bmo] = { k, txt: ind.objectifs[k] }; render(); });
function evolutionIndivHTML(ind, cour, imprime = false) {
  const serie = serieIndiv(ind), avis = avisMaintien(ind, serie);
  if (!serie.length) return imprime ? "" : `<div class="card evol-indiv"><h2>Évolution d’une fiche à l’autre</h2><p class="hint">Rien de saisi pour l’instant : les courbes et la comparaison des fiches apparaîtront dès la première fiche remplie.</p></div>`;
  const cel = (v, nI) => v === null ? `<td class="vide">—</td>` : `<td><span class="pn${NIV_CLASSE[niveauReussite(S, v, nI)] || ""}">${pctTxt(v)}</span>${nI ? `<small class="nI"> ${nI} ${esc(S.codage[3].code)}</small>` : ""}</td>`;
  const tete = serie.map(f => `<th class="${f.c === cour ? "cour" : ""}" title="Fiche du ${fmtDM(f.c.debut)} au ${fmtDM(f.c.fin)}\n• ${f.n} cours notés${f.courte ? "\n• fiche courte : elle ne compte pas pour la fin du suivi" : ""}">${imprime ? "" : `<a href="#indiv/${esc(ind.id)}:${f.c.fin}">`}${fmtDM(f.c.debut)}<br><small>au ${fmtDM(f.c.fin)}${f.courte ? " · courte" : ""}</small>${imprime ? "" : "</a>"}</th>`).join("");
  const lignes = ind.objectifs.map((o, k) => { const td = tendanceIndiv(serie.map(f => f.v[k]));
    return `<tr><th class="l">${legendeSerie(k, COUL_OBJ[k])}${NUM_OBJ[k]} ${esc(o)}</th>${serie.map(f => cel(f.v[k], f.nI[k])).join("")}<td class="tend" title="Tendance\nMoyenne des 2 dernières fiches comparée aux 2 précédentes.">${flecheTendance(td)} ${motTendance(td)}${td !== null ? `<small> (${ptsTxt(td)})</small>` : ""}</td></tr>`; }).join("");
  const tg = tendanceIndiv(serie.map(f => f.g));
  const ens = `<tr class="ens"><th class="l">Ensemble des objectifs</th>${serie.map(f => cel(f.g, f.gI)).join("")}<td class="tend">${flecheTendance(tg)} ${motTendance(tg)}${tg !== null ? `<small> (${ptsTxt(tg)})</small>` : ""}</td></tr>
    <tr class="nb"><th class="l">Cours notés</th>${serie.map(f => `<td>${f.n}</td>`).join("")}<td></td></tr>`;
  const avisH = `<div class="avis ${avis.niv}" role="status"><div class="avis-t"><b>${avis.titre}</b>${avis.sous ? ` <span>${esc(avis.sous)}</span>` : ""}</div>
    <ul>${avis.raisons.map(r => typeof r === "string" ? `<li>${esc(r)}</li>` : `<li class="${r.ok ? "ok" : r.alerte ? "al" : ""}"><b>${NUM_OBJ[r.k]}</b> ${esc(r.txt)}</li>`).join("")}</ul>
    <p class="petit">Règle : fin du suivi envisageable après ${esc(avis.regle)} <span class="no-print">(Réglages › Fiches individuelles)</span>. C’est une aide : la décision revient à l’équipe, avec l’élève et sa famille.</p></div>`;
  const corps = `${avisH}<div class="evol-defil">${courbeIndiv(ind, serie, cour)}</div>
    <div class="evol-defil"><table class="evol"><thead><tr><th class="l">Réussite par fiche</th>${tete}<th class="tend-h">Tendance</th></tr></thead><tbody>${lignes}${ens}</tbody></table></div>`;
  if (imprime) return `<div class="evol-imp${serie.length > 10 ? " large" : ""}"><div class="f-head"><div class="f-title" role="heading" aria-level="2">Suivi individuel – évolution d’une fiche à l’autre</div></div>
    <p><b>Élève :</b> ${esc(ind.nom)}${S.classe ? " – " + esc(S.classe) : ""} · <b>Fiches :</b> du ${fmtDM(serie[0].c.debut)} au ${fmtLong(serie[serie.length - 1].c.fin)} · <b>Professeur principal :</b> ${esc(S.referent)}</p>
    <p class="petit">Réussite = part des cours notés « ${esc(S.codage[0].sens)} » ou « ${esc(S.codage[1].sens)} ». Zone rouge : moins de ${seuils(S).rouge} %.</p>${corps}</div>`;
  return `<div class="card evol-indiv"><div class="row"><h2 style="margin:0">Évolution d’une fiche à l’autre</h2><span class="chip">${serie.length} fiche${serie.length > 1 ? "s" : ""} remplie${serie.length > 1 ? "s" : ""}</span><span class="spacer"></span>
    <button data-act="print-evol" data-ind="${esc(ind.id)}" data-w="${cour ? cour.fin : ""}" title="Imprimer l’évolution\n• page 1 : avis, courbes et tableau des fiches\n• page 2 : bilan par matière\nPour une réunion d’équipe ou avec la famille."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer l’évolution</button></div>${corps}</div>`;
}
apresRendu.push(() => document.querySelectorAll(".evol-defil:not(.somm-frise):not(.somm-defil)").forEach(e => { e.scrollLeft = e.scrollWidth; }));   // les fiches récentes d'abord visibles
/* ---------- tous les suivis individuels en parallèle : une ligne par élève, une colonne par semaine ---------- */
const COUL_EL = ["#1f5f9e", "#0e7490", "#c2410c", "#9333ea", "#15803d", "#b45309", "#be185d", "#475569"];
/** Fiches de chaque suivi rangées par semaine (celle du jour de remise) ; semaines affichées : de la première à la dernière fiche remplie. */
function donneesParallele() {
  const sems = semaines(S), suivis = S.individuels.map((ind, k) => { const par = new Map();
    for (const f of serieIndiv(ind)) { const w = semaineDuJour(sems, f.c.fin); if (!w) continue; const wi = sems.indexOf(w), deja = par.get(wi);
      if (!deja || f.n > deja.n) par.set(wi, deja ? { ...f, autre: deja } : f); else deja.autre = f; }   // deux fiches la même semaine : la plus complète
    return { ind, k, par, avis: avisMaintien(ind) }; });
  const idx = suivis.flatMap(x => [...x.par.keys()]);
  if (!idx.length) return { sems, suivis, cols: [] };
  const a = Math.min(...idx), b = Math.max(...idx);
  return { sems, suivis, cols: sems.slice(a, b + 1).map((w, i) => ({ w, wi: a + i })) };
}
function courbeParallele(d) {
  const n = d.cols.length, W = Math.max(380, 64 * n + 70), H = 210, g = 40, dr = 16, h = H - 30, x = i => g + (n > 1 ? i * (W - g - dr) / (n - 1) : (W - g - dr) / 2), y = v => 8 + (1 - v) * (h - 8);
  const t = seuils(S), fin = S.finSuiviIndiv.seuil / 100;
  const lignes = d.suivis.map(sv => { const pts = d.cols.map((c, i) => { const f = sv.par.get(c.wi); return f && f.g !== null ? [x(i), y(f.g), f] : null; });
    const seg = pts.reduce((a, p) => { if (!p) a.push([]); else a[a.length - 1].push(p); return a; }, [[]]).filter(s => s.length);
    const coul = COUL_EL[sv.k % COUL_EL.length];
    return seg.map(s => `<polyline fill="none" stroke="${coul}" stroke-width="2.4"${trait(sv.k)} points="${s.map(p => p[0] + "," + p[1]).join(" ")}"/>`).join("")
      + pts.map((p, i) => p ? marque(sv.k, p[0], p[1], 3.8, coul, `<title>${esc(sv.ind.nom)} · semaine ${d.cols[i].w.num} : ${pctTxt(p[2].g)}</title>`) : "").join(""); }).join("");
  return `<svg class="courbe-indiv" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Réussite de chaque suivi individuel, semaine par semaine">
    <rect x="${g}" y="${y(t.rouge / 100)}" width="${W - g - dr}" height="${y(0) - y(t.rouge / 100)}" fill="#fbe2e0" opacity=".7"/>
    <rect x="${g}" y="${y(1)}" width="${W - g - dr}" height="${y(fin) - y(1)}" fill="#e6f4ea" opacity=".8"/>
    ${[0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${g}" x2="${W - dr}" y1="${y(v)}" y2="${y(v)}" stroke="#d6dae0"/><text x="${g - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#667">${v * 100} %</text>`).join("")}
    <line x1="${g}" x2="${W - dr}" y1="${y(fin)}" y2="${y(fin)}" stroke="#2b6b3d" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${W - dr}" y="${y(fin) - 4}" text-anchor="end" font-size="10.5" fill="#2b6b3d">fin du suivi : ${S.finSuiviIndiv.seuil} %</text>
    ${d.cols.map((c, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#667">S${c.w.num}</text>`).join("")}${lignes}</svg>`;
}
/** Vue d'ensemble : courbes superposées et tableau élèves × semaines (réussite de l'ensemble des objectifs de chaque fiche), avis sur le maintien. */
function paralleleIndivHTML(imprime) {
  const d = donneesParallele();
  if (!d.cols.length) return imprime ? "" : `<div class="card indiv-parallele"><h2>Tous les suivis en parallèle</h2><p class="hint">Rien de saisi pour l’instant : l’évolution de chaque élève, semaine par semaine, apparaîtra ici dès les premières fiches remplies.</p></div>`;
  const lignes = d.suivis.map(sv => { let prec = null; const vals = [];
    const cases = d.cols.map(c => { const f = sv.par.get(c.wi); if (!f) return `<td class="vide">—</td>`;
      const ev = f.g !== null && prec !== null ? evolution(f.g, prec) : ""; if (f.g !== null) { prec = f.g; vals.push(f.g); }
      return `<td>${imprime ? "" : `<a href="#indiv/${esc(sv.ind.id)}:${f.c.fin}" title="${esc(sv.ind.nom)} · fiche du ${fmtDM(f.c.debut)} au ${fmtDM(f.c.fin)}\n• réussite : ${pctTxt(f.g)}${f.gI ? `\n• ${f.gI} « ${esc(S.codage[3].code)} »` : ""}\n• ${f.n} cours notés\nClic : ouvrir la fiche">`}<span class="pn${NIV_CLASSE[niveauReussite(S, f.g, f.gI)] || ""}">${pctTxt(f.g)}</span>${ev && ev !== "=" ? `<span class="fl ${/[↑↗]/.test(ev) ? "up" : "dn"}">${ev}</span>` : ""}${imprime ? "" : "</a>"}</td>`; }).join("");
    const t = tendanceIndiv(vals);
    return `<tr><th class="l" scope="row">${legendeSerie(sv.k, COUL_EL[sv.k % COUL_EL.length])}${imprime ? esc(sv.ind.nom) : `<a href="#indiv/${esc(sv.ind.id)}">${esc(sv.ind.nom) || "<i>élève à indiquer</i>"}</a>`}</th>${cases}
      <td class="tend" title="Tendance\nMoyenne des 2 dernières fiches comparée aux 2 précédentes.">${t === null ? "" : `${flecheTendance(t)} ${ptsTxt(t)}`}</td><td><span class="avis-chip ${sv.avis.niv}" title="${sv.avis.titre}\n${sv.avis.sous ? esc(sv.avis.sous) + "\n" : ""}• règle : ${esc(sv.avis.regle)}">${sv.avis.titre}</span></td></tr>`; }).join("");
  const corps = `<div class="evol-defil">${courbeParallele(d)}</div>
    <div class="evol-defil"><table class="evol par"><thead><tr><th class="l">Réussite de chaque fiche</th>${d.cols.map(c => `<th title="Semaine ${c.w.num} (${c.w.type})\ndu ${fmtDM(c.w.lundi)} au ${fmtDM(c.w.jours.at(-1))}\n• la fiche dont le jour de remise tombe cette semaine">S${c.w.num}<br><small>${fmtDM(c.w.lundi)}</small></th>`).join("")}<th class="tend-h">Tendance</th><th class="avis-h">Avis</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <p class="petit muted">Réussite de chaque fiche = part des cours notés « ${esc(S.codage[0].sens)} » ou « ${esc(S.codage[1].sens)} », tous objectifs réunis (chaque élève a ses propres objectifs). Une fiche est rangée dans la semaine de son jour de remise.</p>`;
  if (imprime) return `<div class="evol-imp${d.cols.length > 10 ? " large" : ""}"><div class="f-head"><div class="f-title" role="heading" aria-level="2">Suivis individuels – tous les suivis en parallèle</div></div>
    <p><b>Classe :</b> ${esc(S.classe)} · <b>Semaines :</b> ${d.cols[0].w.num} à ${d.cols[d.cols.length - 1].w.num} · <b>Professeur principal :</b> ${esc(S.referent)}</p>${corps}</div>`;
  return `<div class="card indiv-parallele"><div class="row"><h2 style="margin:0">Tous les suivis en parallèle</h2><span class="chip">${d.suivis.length} élève${d.suivis.length > 1 ? "s" : ""}</span><span class="spacer"></span>
    <button data-act="print-parallele" title="Imprimer\nUne page : courbes et tableau de tous les suivis."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div>
    <p class="hint">Chaque élève suivi, semaine par semaine : on voit d’un coup d’œil qui progresse, qui stagne et qui décroche. Un clic sur une pastille ouvre la fiche.</p>${corps}</div>`;
}
/** Tous les suivis individuels, à imprimer (bouton ou Ctrl+P). */
function pagesParallele() { const d = donneesParallele(); if (!d.cols.length) return { pages: [] };
  return { pages: [paralleleIndivHTML(true)], nom: nomPdf("Suivi individuel", "Tous les suivis", `semaines ${d.cols[0].w.num} à ${d.cols[d.cols.length - 1].w.num} du ${dateNom(d.cols[0].w.lundi)} au ${dateNom(d.cols[d.cols.length - 1].w.jours.at(-1))}`) }; }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-act="print-parallele"]'); if (!b || !S) return;
  const p = pagesParallele(); printPages(p.pages, p.nom); });
/** Bilans de la classe entière (semaine après semaine, bilan par matière) à imprimer : la page telle qu'elle est affichée
    (élève, mode, semaine choisis), sans les commandes ni les aides propres à l'écran. */
function pagesSynthClasse() {
  const src = document.querySelector("#view .synth"); if (!src) return { pages: [] };
  const c = src.cloneNode(true);
  c.querySelectorAll(".no-print, .ecran, .clb-regl, button, select, input, .seg").forEach(x => x.remove());
  c.querySelectorAll("[title]").forEach(x => x.removeAttribute("title"));
  c.querySelectorAll("a").forEach(a => a.replaceWith(...a.childNodes));
  c.querySelectorAll(".survol").forEach(x => x.classList.remove("survol"));
  const sems = semaines(S), cols = [...src.querySelectorAll("thead th a[href^='#classesem/']")].map(a => sems[Number(a.getAttribute("href").split("/")[1])]).filter(Boolean);
  const per = cols.length ? (cols.length === 1 ? periodeSemaine(cols[0]) : `semaines ${cols[0].num} à ${cols[cols.length - 1].num} du ${dateNom(cols[0].lundi)} au ${dateNom(cols[cols.length - 1].jours.at(-1))}`) : "";
  const bil = current.view === "classebilan", qui = bil && clbEleve >= 0 ? S.classeEleves[clbEleve].nom : "";
  const titre = bil ? `Classe entière – bilan par matière${qui ? " – " + esc(qui) : ""}` : "Classe entière – semaine après semaine";
  const sous = `<b>Classe :</b> ${esc(S.classe)} · <b>Professeur principal :</b> ${esc(S.referent)}${cols.length ? ` · <b>${cols.length === 1 ? `Semaine ${cols[0].num} du ${fmtDM(cols[0].lundi)} au ${fmtDM(cols[0].jours.at(-1))}` : `Semaines ${cols[0].num} à ${cols[cols.length - 1].num} du ${fmtDM(cols[0].lundi)} au ${fmtDM(cols[cols.length - 1].jours.at(-1))}`}</b>` : ""}${bil ? ` · <b>${clbMode === "taux" ? "Incidents pour 10 cours" : "Nombre d’incidents"}</b> · semaines retenues : ${!clbSel ? "toute la période" : clbSel[0] === clbSel[1] ? `S${sems[clbSel[0]].num}` : `S${sems[clbSel[0]].num} à S${sems[clbSel[1]].num}`} · signalement : moyenne + ${S.seuilBilanClasse} %` : ""}`;
  return { pages: [`<div class="synth-imp${c.classList.contains("nombreux") ? " nombreux" : ""}"><div class="f-head"><div class="f-title" role="heading" aria-level="2">${titre}</div></div><p class="synth-sous">${sous}</p>${c.innerHTML}</div>`],
    nom: nomPdf("Classe entière", ...(qui ? [qui] : []), bil ? "Bilan par matière" : "Semaine après semaine", per) };
}
/* ---------- liste des suivis individuels : cartes enrichies (maquette A) ---------- */
const COUL_NIV_TXT = { r: "var(--pa-r-t)", o: "var(--pa-o-t)", v: "var(--pa-v-t)", vf: "var(--pa-vf-t)" };
const COUL_NIV_BAR = { r: "#e8908a", o: "#f2b77b", v: "#86c99a", vf: "#4fa86a", "": "#a9b1c6" };
/** Mini-courbe de la réussite de chaque fiche (zone rouge sous le seuil rouge, pointillés au seuil de fin du suivi). */
function sparkIndiv(serie, w = 130, h = 46) {
  const n = serie.length; if (!n) return "";
  const x = k => 4 + k * (w - 8) / Math.max(1, n - 1), y = v => h - 4 - v * (h - 8), t = seuils(S);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect x="0" y="${y(t.rouge / 100)}" width="${w}" height="${h - y(t.rouge / 100)}" fill="#fbe2e0" opacity=".6"/>
    <line x1="0" x2="${w}" y1="${y(S.finSuiviIndiv.seuil / 100)}" y2="${y(S.finSuiviIndiv.seuil / 100)}" stroke="#2b6b3d" stroke-dasharray="3 3"/>
    <polyline fill="none" stroke="#1f5f9e" stroke-width="2.2" points="${serie.map((f, k) => x(k) + "," + y(f.g || 0)).join(" ")}"/>
    ${serie.map((f, k) => `<circle cx="${x(k)}" cy="${y(f.g || 0)}" r="2.8" fill="${COUL_NIV_BAR[niveauReussite(S, f.g, f.gI)] || "#1f5f9e"}"/>`).join("")}</svg>`;
}
function carteIndiv(i) {
  const today = aujourdhui(), serie = serieIndiv(i), a = avisMaintien(i, serie), cy = cyclesIndiv(i);
  const faites = serie.filter(f => f.c.debut <= today), der = faites.length ? faites[faites.length - 1] : serie[serie.length - 1];
  const prec = der ? serie[serie.indexOf(der) - 1] : null, dl = der && prec && der.g !== null && prec.g !== null ? Math.round(der.g * 100) - Math.round(prec.g * 100) : null;
  const pro = cy.find(c => c.fin >= today) || cy[cy.length - 1];
  const nivG = der ? niveauReussite(S, der.g, der.gI) : "";
  const objs = i.objectifs.map((o, k) => { const v = der ? der.v[k] : null, nv = v === null ? "" : niveauReussite(S, v, der.nI[k]);
    return `<div class="ic-obj"><span>${NUM_OBJ[k]} ${esc(o) || "<i>objectif à écrire</i>"}</span>${v === null ? `<span class="muted small">—</span>` : `<span class="pn${NIV_CLASSE[nv] || ""}">${pctTxt(v)}</span>`}
      <span class="barre" aria-hidden="true"><i style="width:${v === null ? 0 : Math.round(v * 100)}%;background:${COUL_NIV_BAR[nv] || COUL_NIV_BAR[""]}"></i></span></div>`; }).join("");
  return `<a class="ind-carte ic2 ${a.niv}" href="#indiv/${esc(i.id)}" title="${esc(i.nom) || "Élève à indiquer"}\n${a.titre}${a.sous ? "\n" + esc(a.sous) : ""}\nClic : ouvrir son suivi">
    <span class="ic-bande" aria-hidden="true"></span>
    <div class="ic-haut"><span class="ic-av" aria-hidden="true">${esc(initiales(i.nom))}</span><div><b>${esc(i.nom) || "<i>élève à indiquer</i>"}</b><span class="avis-chip ${a.niv}">${a.titre}</span></div></div>
    <div class="ic-gros">${der ? `<div><div class="ic-val" style="color:${COUL_NIV_TXT[nivG] || "var(--ink)"}">${pctTxt(der.g)}</div><small class="muted">fiche du ${fmtDM(der.c.debut)} ${dl === null ? "" : `<b class="${dl > 0 ? "up" : dl < 0 ? "dn" : ""}">${dl > 0 ? "▲ " : dl < 0 ? "▼ " : "= "}${ptsTxt(dl)}</b>`}</small></div><div class="ic-spark">${sparkIndiv(serie)}</div>` : `<small class="muted">Aucune fiche remplie pour l’instant.</small>`}</div>
    <div class="ic-objs">${objs}</div>
    <div class="ic-pied"><span>📅 ${pro ? `remise le ${JOURS_REMISE[jourSemaine(remiseCycle(pro)) - 1]} ${fmtDM(remiseCycle(pro))}` : "aucune fiche à venir"}</span><span class="small">${serie.length} fiche${serie.length > 1 ? "s" : ""} remplie${serie.length > 1 ? "s" : ""}</span><span class="btn s">Ouvrir</span></div></a>`;
}
function viewIndivTous() {
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Suivis individuels · tous les élèves suivis</span><h1 data-titre>Tous les suivis côte à côte</h1></div>
    <div class="actions"><a class="btn" href="#indiv">Fiches individuelles</a></div></div>
  ${S.individuels.length ? paralleleIndivHTML(false) : `<div class="card"><p>Aucun suivi individuel pour l’instant : créez-en un dans <a href="#indiv">Fiches individuelles</a>.</p></div>`}`;
}
/** Semaine de la classe choisie dans l'adresse (#classesuivi/3), sinon celle de la fiche ouverte, sinon la semaine en cours. */
function semaineClasse(arg) {
  const sems = semaines(S), a = Number(arg);
  if (arg !== null && arg !== undefined && arg !== "" && Number.isInteger(a) && sems[a]) return a;
  const w = ficheDate && semaineDuJour(sems, ficheDate); return w ? sems.indexOf(w) : sems.indexOf(semaineCourante(sems));
}
const BTN_SYNTH = `<button data-act="print-synth" title="Imprimer\nLa page telle qu’elle est affichée (élève, mode, semaine choisis), sur une page A4 paysage.\nRaccourci : Ctrl+P"><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button>`;
function viewClasseSuivi(arg) {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  if (!S.classeEleves.length) return `<div class="card"><h2>Liste de la classe à compléter</h2><p>Ajoutez la liste des élèves dans <a href="#reglages/classeEntiere">Réglages › Élèves et groupes</a>.</p></div>`;
  const wi = semaineClasse(arg);
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Classe entière · incidents au fil des semaines</span><h1 data-titre>Semaine après semaine</h1></div>
    <div class="actions"><a class="btn" href="#classesem/${wi}">Fiche de la semaine ${sems[wi].num}</a>${BTN_SYNTH}</div></div>${suiviClasseHTML(wi)}`;
}
/* ---------- fiche de classe : bilan par matière (incidents par matière, pour la classe ou pour un élève) ---------- */
let clbEleve = -1;                 // élève choisi pour le bilan par matière de la classe : -1 = toute la classe
let clbSel = null;                 // semaines retenues (colonne de synthèse, codes, signalement) : null = toute la période, sinon [première, dernière]
let clbMode = "nombre";            // « nombre » d'incidents, ou « taux » : pour 10 heures de cours
try { if (localStorage.getItem(LS_KEY + "-clb") === "taux") clbMode = "taux"; } catch (e) { /* sans stockage */ }
/** Incidents par matière, semaine par semaine, avec qui les a eus (codes de chaque élève). */
function bilanMatiereClasse(s0) {
  const sems = semaines(S), codes = S.codesClasse.filter(c => c.code), res = new Map(), cols = [], pr = profsPeriode(S);
  sems.forEach((w, wi) => { if (!w.jours.some(d => Object.keys(((S.jours[d] || {}).cl) || {}).length)) return; cols.push({ w, wi });
    for (const d of w.jours) { if (sansCours(S, d)) continue; const cl = ((S.jours[d] || {}).cl) || {};
      for (const p of creneauxDu(S, d)) { const cr = creneau(S, sems, d, p); if (!cr.mat || cr.absent) continue;
        (s0 >= 0 ? [[S.classeEleves[s0], s0]] : S.classeEleves.map((e, s) => [e, s])).forEach(([e, s]) => { if (!presentClasse(e, d)) return; const c = coursPour(cr, e.groupes || []); if (!c.mat || c.absent) return;
          pr.note(c.mat, d); if (!res.has(c.mat)) res.set(c.mat, { mat: c.mat, prof: "", cours: new Set(), coursSem: new Map(), parSem: new Map(), par: Object.fromEntries(codes.map(x => [x.code, 0])), neg: 0, pos: 0, qui: new Map() });
          const m = res.get(c.mat); m.prof = pr.de(c.mat) || c.prof; m.cours.add(`${d}.${p}`); if (!m.coursSem.has(wi)) m.coursSem.set(wi, new Set()); m.coursSem.get(wi).add(`${d}.${p}`);
          for (const x of cl[`${s}.${p}`] || "") { if (x === CODE_ABSENT) continue; if (x in m.par) m.par[x]++;
            if (!m.qui.has(s)) m.qui.set(s, new Map()); const q = m.qui.get(s); if (!q.has(wi)) q.set(wi, ""); q.set(wi, q.get(wi) + x);
            if (codePositif(x)) m.pos++; else { m.neg++; m.parSem.set(wi, (m.parSem.get(wi) || 0) + 1); } } }); } } });
  const ordre = ordreMatieres(S), mats = [...res.values()].sort((a, b) => ((ordre.indexOf(a.mat) + 1) || 99) - ((ordre.indexOf(b.mat) + 1) || 99));
  const tc = mats.reduce((a, m) => a + m.cours.size, 0), tn = mats.reduce((a, m) => a + m.neg, 0);
  return { cols, mats, codes, moy: tc ? tn / tc : 0 };
}
/** Infobule d'une case : quels élèves ont eu quels incidents (sur une semaine, ou sur toute la période si wi est null). */
function quiIncidents(m, wi, filtre) {
  const lignes = [];
  for (const [s, parW] of m.qui) { let v = ""; for (const [w, codes] of parW) if (wi === null || w === wi) v += codes; v = [...v].filter(filtre).join("");
    if (!v) continue; const nb = {}; for (const x of v) nb[x] = (nb[x] || 0) + 1;
    lignes.push([v.length, `• ${esc(S.classeEleves[s].nom)} : ${Object.entries(nb).map(([x, n]) => `${n > 1 ? n + " × " : ""}${esc(x)}`).join(", ")}`]); }
  return lignes.sort((a, b) => b[0] - a[0]).map(l => l[1]).join("\n");
}
function viewClasseBilan(arg) {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  if (!S.classeEleves.length) return `<div class="card"><h2>Liste de la classe à compléter</h2><p>Ajoutez la liste des élèves dans <a href="#reglages/classeEntiere">Réglages › Élèves et groupes</a>.</p></div>`;
  if (clbEleve >= S.classeEleves.length) clbEleve = -1;
  const { cols, mats, codes } = bilanMatiereClasse(clbEleve), taux = clbMode === "taux";
  // semaines retenues pour la colonne de synthèse et le signalement : toutes, ou une suite de colonnes (clbSel = [première, dernière semaine])
  if (clbSel && !cols.some(c => c.wi >= clbSel[0] && c.wi <= clbSel[1])) clbSel = null;
  const dans = wi => !clbSel || (wi >= clbSel[0] && wi <= clbSel[1]), sel = cols.filter(c => dans(c.wi)).map(c => c.wi);
  const libSel = !clbSel ? "toute la période" : sel.length === 1 ? `la semaine ${sems[sel[0]].num}` : `les semaines ${sems[sel[0]].num} à ${sems[sel[sel.length - 1]].num}`;
  const t10 = (n, k) => (k ? 10 * n / k : 0), f1 = x => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const seuil = S.seuilBilanClasse, fac = 1 + seuil / 100;
  // incidents et cours d'une matière : une semaine (wi), ou la sélection (wi = -1)
  const nb = (m, wi) => (wi < 0 ? sel.reduce((a, w) => a + (m.parSem.get(w) || 0), 0) : m.parSem.get(wi) || 0);
  const nc = (m, wi) => (wi < 0 ? sel.reduce((a, w) => a + (m.coursSem.get(w) || new Set()).size, 0) : (m.coursSem.get(wi) || new Set()).size);
  const parCode = (m, code) => { let n = 0; for (const parW of m.qui.values()) for (const [w, c] of parW) if (dans(w)) for (const x of c) if (x === code) n++; return n; };
  const somme = wi => [mats.reduce((a, m) => a + nb(m, wi), 0), mats.reduce((a, m) => a + nc(m, wi), 0)];
  const moyDe = wi => { const [n, k] = somme(wi); return t10(n, k); };     // moyenne de toutes les matières, pour 10 cours
  const moySel = moyDe(-1), quand = wi => (wi < 0 ? libSel : `la semaine ${sems[wi].num}`);
  const qui = clbEleve < 0 ? "la classe" : esc(S.classeEleves[clbEleve].nom);
  // pastilles : chaque case est comparée à la moyenne de sa colonne (ligne du bas) ; rouge à partir du seuil réglable
  const niv = (n, k, ref) => { if (!n || !k || ref <= 0) return ""; const t = t10(n, k); return t >= fac * ref && n >= 2 ? " p3" : t > ref ? " p2" : ""; };
  const forts = mats.filter(m => nb(m, -1) >= 2 && moySel > 0 && t10(nb(m, -1), nc(m, -1)) >= fac * moySel).sort((a, b) => t10(nb(b, -1), nc(b, -1)) - t10(nb(a, -1), nc(a, -1)));
  const val = (n, k) => (taux ? f1(t10(n, k)) : String(n));
  const aide = "Clic : cette semaine seule · cliquer-glisser : plusieurs semaines · glisser la sélection : la déplacer";
  const quiSel = m => { if (clbEleve >= 0) return ""; const l = []; for (const [s, parW] of m.qui) { let v = ""; for (const [w, c] of parW) if (dans(w)) v += c; v = [...v].filter(x => !codePositif(x)).join(""); if (v) l.push([v.length, s, v]); }
    return l.sort((a, b) => b[0] - a[0]).map(([, s, v]) => { const nbc = {}; for (const x of v) nbc[x] = (nbc[x] || 0) + 1; return `• ${esc(S.classeEleves[s].nom)} : ${Object.entries(nbc).map(([x, n]) => `${n > 1 ? n + " × " : ""}${esc(x)}`).join(", ")}`; }).join("\n"); };
  const caseInc = (m, wi, ref) => { const n = nb(m, wi), k = nc(m, wi); return n ? `<span class="pn${niv(n, k, ref)}" title="${esc(m.mat)} · ${quand(wi).replace(/^(la|les) /, "")}\n**${n} incident${n > 1 ? "s" : ""}** en ${k} cours${taux ? ` : ${f1(t10(n, k))} pour 10 cours` : ""}${peuDe(k, "cours", 4)}\n${clbEleve < 0 ? (wi < 0 ? quiSel(m) : quiIncidents(m, wi, x => !codePositif(x))) : ""}${wi >= 0 ? "\n" + aide : ""}">${val(n, k)}</span>` : ""; };
  const ch = wi => { if (!clbSel || !dans(wi)) return ""; return " choisie" + (wi === sel[0] ? " sel-g" : "") + (wi === sel[sel.length - 1] ? " sel-d" : ""); };
  const colAttr = (wi, vide) => ` data-clbsem="${wi}"${vide && wi >= 0 ? ` title="Semaine ${sems[wi].num}\n${aide}"` : ""}`;
  const debuts = debutsChamp(mats.map(m => m.mat));
  const lignes = mats.map(m => `<tr class="${forts.includes(m) ? "fort" : ""}${debuts.has(m.mat) ? " nv-champ" : ""}"><th class="l" scope="row">${esc(m.mat)}${m.prof ? ` <small>${esc(m.prof)}</small>` : ""}</th>
    ${cols.map(c => `<td class="${ch(c.wi)}"${colAttr(c.wi, !nb(m, c.wi))}>${caseInc(m, c.wi, moyDe(c.wi))}</td>`).join("")}
    <td class="sep"${colAttr(-1, true)}><b>${caseInc(m, -1, moySel)}</b></td><td>${nc(m, -1)}</td>
    ${codes.map((x, k) => { const n = parCode(m, x.code), kk = nc(m, -1), pos = codePositif(x.code), t = `${esc(m.mat)} · « ${esc(x.code)} » ${esc(x.sens)}\n**${n}** sur ${libSel}${taux ? ` : ${f1(t10(n, kk))} pour 10 cours` : ""}\n${clbEleve < 0 ? quiIncidents(m, null, y => y === x.code) : ""}`;
      return `<td class="${k ? "" : "sep"}">${n ? (pos ? `<span class="pn bon" title="${t}">${val(n, kk)}</span>` : `<span title="${t}">${val(n, kk)}</span>`) : ""}</td>`; }).join("")}</tr>`).join("");
  // dernière ligne : la moyenne de toutes les matières (pour 10 cours), ou le total (nombre d'incidents)
  const [tn, tc] = somme(-1);
  const ligneMoy = mats.length ? `<tr class="moy"><th class="l" scope="row">${taux ? "Moyenne, toutes matières" : "Total, toutes matières"}</th>
    ${cols.map(c => { const [n, k] = somme(c.wi); return `<td class="${ch(c.wi)}" data-clbsem="${c.wi}" tabindex="0" role="button" title="Semaine ${c.w.num}\n${n} incident${n > 1 ? "s" : ""} en ${k} cours\nsoit ${f1(t10(n, k))} pour 10 cours (moyenne de la semaine)\n${aide}">${n ? val(n, k) : ""}</td>`; }).join("")}
    <td class="sep" data-clbsem="-1" title="${libSel.charAt(0).toUpperCase() + libSel.slice(1)}\n${tn} incident${tn > 1 ? "s" : ""} en ${tc} cours\nsoit ${f1(t10(tn, tc))} pour 10 cours${clbSel ? "\nClic : revenir à toute la période" : ""}"><b>${val(tn, tc)}</b></td><td>${tc}</td>${codes.map((x, k) => { const n = mats.reduce((a, m) => a + parCode(m, x.code), 0); return `<td class="${k ? "" : "sep"}">${n ? val(n, tc) : ""}</td>`; }).join("")}</tr>` : "";
  const choix = `<label class="champ row" style="gap:8px">Pour <select id="clb-eleve" aria-label="Élève du bilan par matière"><option value="-1"${clbEleve < 0 ? " selected" : ""}>toute la classe</option>${S.classeEleves.map((e, s) => `<option value="${s}"${s === clbEleve ? " selected" : ""}>${esc(e.nom)}</option>`).join("")}</select></label>`;
  const bascule = `<div class="clb-mode"><div class="seg" role="group" aria-label="Afficher"><button type="button" data-clbmode="nombre" class="${taux ? "" : "on"}" aria-pressed="${!taux}">Nombre d’incidents</button><button type="button" data-clbmode="taux" class="${taux ? "on" : ""}" aria-pressed="${taux}">Pour 10 cours</button></div>
    <p class="clb-explic">${taux ? `<b>Pour 10 cours</b> : le nombre d’incidents ramené à 10 heures de cours de la matière, pour comparer des matières qui n’ont pas le même horaire. Ex. « 15 » = en moyenne 15 incidents toutes les 10 heures de cours${clbEleve < 0 ? " (toute la classe réunie)" : ""}.` : `<b>Nombre d’incidents</b> : ce qui a été noté sur les fiches de classe. Attention : une matière qui a beaucoup d’heures en a forcément plus ; « Pour 10 cours » permet de comparer.`}</p></div>`;
  // semaines retenues : périodes toutes prêtes (comptées sur les semaines remplies), ou cliquer-glisser sur les colonnes
  const der = n => (cols.length ? [cols[Math.max(0, cols.length - n)].wi, cols[cols.length - 1].wi] : null);
  const reprises = S.vacances.map(v => v.reprise).filter(r => r && r <= aujourdhui()).sort(), depVac = reprises.length ? cols.find(c => sems[c.wi].lundi >= reprises[reprises.length - 1]) : null;
  const presets = [...periodesDecoupage(S, sems), ["2 dernières semaines", der(2)], ["4 dernières semaines", der(4)], ["8 dernières semaines", der(8)], ...(depVac && depVac !== cols[0] ? [["Depuis les dernières vacances", [depVac.wi, cols[cols.length - 1].wi]]] : []), ["Toute la période", null]]
    .filter(([, r], i, l) => r === null || (cols.filter(c => c.wi >= r[0] && c.wi <= r[1]).length < cols.length && l.findIndex(([, r2]) => r2 && r2[0] === r[0] && r2[1] === r[1]) === i));
  const memeSel = r => (r === null ? !clbSel : !!clbSel && clbSel[0] === r[0] && clbSel[1] === r[1]);
  const reglage = `<div class="clb-regl"><div class="periodes" role="group" aria-label="Semaines retenues"><b title="Semaines retenues\nPour la colonne de synthèse, les codes et le signalement.\nAussi : cliquer-glisser sur les colonnes du tableau ; glisser une sélection la déplace.">Semaines :</b>${presets.map(([l, r]) => `<button type="button" data-clbper="${r ? r.join(".") : ""}" class="${memeSel(r) ? "on" : ""}" aria-pressed="${memeSel(r)}">${l}</button>`).join("")}<small class="muted">ou cliquez-glissez sur les colonnes</small></div>
    <label class="champ row" style="gap:6px" title="Seuil de signalement\nUne matière est signalée (en rouge) quand elle dépasse la moyenne d’au moins ce pourcentage, pour 10 cours.\n• 0 % : toutes celles au-dessus de la moyenne\n• 50 % : 1,5 fois la moyenne\n• 100 % : le double">Signaler à partir de la moyenne + <input type="number" min="0" max="300" step="5" data-num="seuilBilanClasse" value="${seuil}" style="width:70px" aria-label="Seuil de signalement en pourcentage au-dessus de la moyenne"> %</label></div>`;
  const message = (() => { if (moySel <= 0) return `<p class="hint">Aucun incident sur ${libSel} pour ${qui}.</p>`;
    const ecart = m => Math.round((t10(nb(m, -1), nc(m, -1)) / moySel - 1) * 100), lim = `${f1(fac * moySel)} pour 10 cours`;
    const ent = `moyenne ${f1(moySel)} pour 10 cours sur ${libSel}, pour ${qui}`;
    if (forts.length) return `<div class="avis alerte"><b>Au moins ${seuil} % au-dessus de la moyenne (${lim} ou plus) :</b>
      <span class="clb-dessus">${forts.map(m => `<span class="fort">${esc(m.mat)} <b>${f1(t10(nb(m, -1), nc(m, -1)))}</b> <small>(+${ecart(m)} %)</small></span>`).join("")}</span><small class="muted">Référence : ${ent}.</small></div>`;
    const haut = mats.filter(m => nb(m, -1)).sort((a, b) => t10(nb(b, -1), nc(b, -1)) - t10(nb(a, -1), nc(a, -1)))[0];
    return `<div class="avis maintien"><b>Aucune matière à ${seuil} % au-dessus de la moyenne (${lim}).</b><small class="muted">Référence : ${ent}.${haut ? ` La plus haute : ${esc(haut.mat)}, ${f1(t10(nb(haut, -1), nc(haut, -1)))} (${ecart(haut) >= 0 ? "+" : ""}${ecart(haut)} %).` : ""}</small></div>`; })();
  const titreSel = !clbSel ? (taux ? "Période" : "Total") : sel.length === 1 ? `S${sems[sel[0]].num}` : `S${sems[sel[0]].num}–${sems[sel[sel.length - 1]].num}`;
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Classe entière · incidents par matière</span><h1 data-titre>Bilan par matière</h1></div><div class="actions">${choix}${mats.length ? BTN_SYNTH : ""}</div></div>
  <div class="card synth">${!mats.length ? `<p class="hint">Rien de saisi pour l’instant sur les fiches de classe.</p>` : `${bascule}${reglage}${message}
    <div class="evol-defil"><table class="evol clb"><thead><tr><th class="l">${taux ? "Incidents pour 10 cours" : "Nombre d’incidents"}</th>${cols.map(c => `<th class="${ch(c.wi)}" data-clbsem="${c.wi}"><a href="#classesem/${c.wi}" title="Semaine ${c.w.num} : ouvrir sa fiche">S${c.w.num}</a></th>`).join("")}<th class="sep${clbSel ? " th-sel" : ""}" data-clbsem="-1" title="${clbSel ? `Semaines retenues : ${libSel}\nClic : revenir à toute la période` : "Toute la période"}">${titreSel}</th><th title="Heures de cours sur ${libSel}">Cours</th>${codes.map((x, k) => `<th class="${k ? "" : "sep"}" title="${esc(x.sens)}">${esc(x.code)}</th>`).join("")}</tr></thead><tbody>${lignes}${ligneMoy}</tbody></table></div>
    <p class="petit muted">${clbEleve < 0 ? `<span class="ecran">Survolez une case : quels élèves ont eu ces incidents. </span>` : ""}Chaque case est comparée à la moyenne de sa colonne (ligne du bas). La colonne « ${titreSel} », les codes et le signalement portent sur ${libSel}${clbSel ? " (colonnes encadrées)" : ""}.<span class="ecran"> Cliquer-glisser sur les colonnes choisit des semaines ; glisser la sélection la déplace.</span> Les absences ne comptent pas.</p>
    <p class="legend-dots"><span><span class="pn p2">orange</span> au-dessus de la moyenne de la colonne</span><span><span class="pn p3">rouge</span> moyenne + ${seuil} % et plus (au moins 2 incidents)</span><span><span class="pn bon">vert</span> codes positifs (${S.codesClasse.filter(c => c.code && codePositif(c.code)).map(c => esc(c.code)).join(", ") || "aucun"})</span></p>`}</div>`;
}
document.addEventListener("change", e => { if (!S || e.target.id !== "clb-eleve") return; clbEleve = Number(e.target.value); render(); });
/** Nouveau suivi, démo ou fichier ouvert : les choix d'affichage du suivi précédent (élève, semaine, période, objectif…) n'ont plus de sens. */
function reinitVues() { clbEleve = -1; clbSel = null; clOuvert = null; for (const k in bmObj) delete bmObj[k]; periodeBilan = null; periodeImpr = null; ficheDate = null; elDatesOuvert = -1; pinceau = null; pinGroupe = ""; }
let clbDefil = null;               // défilement du tableau gardé quand on choisit des colonnes
apresRendu.push(() => { if (current.view !== "classebilan") return; const d = document.querySelector("table.clb") && document.querySelector("table.clb").closest(".evol-defil"); if (!d) return;
  if (clbDefil !== null) { d.scrollLeft = clbDefil; clbDefil = null; return; }
  const t = d.querySelector("thead th.sel-d"); if (t && clbSel) d.scrollLeft = Math.max(0, t.offsetLeft - d.clientWidth + t.offsetWidth + 40); });   // la sélection, visible
const choisirClb = (r, el) => { const d = el && el.closest && el.closest(".evol-defil"); clbSel = r; clbDefil = d ? d.scrollLeft : null; render(); };
/** Colonnes de semaines du tableau, dans l'ordre (semaines remplies seulement). */
const colonnesClb = () => [...document.querySelectorAll("table.clb thead th[data-clbsem]")].map(t => Number(t.dataset.clbsem)).filter(w => w >= 0);
/** Pendant un glisser : encadre les colonnes de la position a à la position b. */
function marquerClb(a, b) { const ws = colonnesClb();
  document.querySelectorAll("table.clb [data-clbsem]").forEach(x => { const i = ws.indexOf(Number(x.dataset.clbsem)), on = i >= a && i <= b;
    x.classList.toggle("choisie", on); x.classList.toggle("sel-g", on && i === a); x.classList.toggle("sel-d", on && i === b); }); }
let glisseClb = null;              // { depart, mode : "choix" | "deplacer", a, b, bouge }
let clicLienAnnule = false;          // un glisser parti d'un lien « S46 » ne doit pas ouvrir la fiche
document.addEventListener("pointerdown", e => { if (!S || current.view !== "classebilan" || e.button !== 0 || !e.target.closest) return; const lien = !!e.target.closest("a");
  const t = e.target.closest("table.clb [data-clbsem]"); if (!t || Number(t.dataset.clbsem) < 0) return;
  const ws = colonnesClb(), p = ws.indexOf(Number(t.dataset.clbsem)), sa = clbSel ? ws.findIndex(w => w >= clbSel[0]) : -1, sb = clbSel ? ws.length - 1 - [...ws].reverse().findIndex(w => w <= clbSel[1]) : -1;
  glisseClb = clbSel && p >= sa && p <= sb ? { depart: p, mode: "deplacer", a0: sa, b0: sb, a: sa, b: sb, bouge: false, el: t, lien } : { depart: p, mode: "choix", a: p, b: p, bouge: false, el: t, lien };
  document.body.classList.add("tracage"); if (!lien) e.preventDefault(); });
document.addEventListener("dragstart", e => { if (glisseClb) e.preventDefault(); });
document.addEventListener("click", e => { if (clicLienAnnule && e.target.closest && e.target.closest("a")) { e.preventDefault(); e.stopPropagation(); } clicLienAnnule = false; }, true);
document.addEventListener("pointermove", e => { if (!glisseClb) return; const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest("table.clb [data-clbsem]"); if (!t || Number(t.dataset.clbsem) < 0) return;
  const ws = colonnesClb(), p = ws.indexOf(Number(t.dataset.clbsem)); if (p < 0 || (p === glisseClb.depart && !glisseClb.bouge)) return; glisseClb.bouge = true;
  if (glisseClb.mode === "choix") { glisseClb.a = Math.min(glisseClb.depart, p); glisseClb.b = Math.max(glisseClb.depart, p); }
  else { const n = glisseClb.b0 - glisseClb.a0; let a = glisseClb.a0 + p - glisseClb.depart; a = Math.max(0, Math.min(ws.length - 1 - n, a)); glisseClb.a = a; glisseClb.b = a + n; }
  marquerClb(glisseClb.a, glisseClb.b); });
document.addEventListener("pointerup", () => { if (!glisseClb) return; const g = glisseClb; glisseClb = null; document.body.classList.remove("tracage"); const ws = colonnesClb();
  if (g.lien && !g.bouge) return;     // simple clic sur le lien : il ouvre la fiche de la semaine
  if (g.bouge) { clicLienAnnule = g.lien; choisirClb(g.a === 0 && g.b === ws.length - 1 ? null : [ws[g.a], ws[g.b]], g.el); return; }
  const w = ws[g.depart]; choisirClb(clbSel && clbSel[0] === w && clbSel[1] === w ? null : [w, w], g.el); });   // simple clic : cette semaine seule (2e clic : toute la période)
document.addEventListener("click", e => { if (!S || current.view !== "classebilan" || !e.target.closest) return;
  const b = e.target.closest("[data-clbper]"); if (b) { choisirClb(b.dataset.clbper ? b.dataset.clbper.split(".").map(Number) : null, document.querySelector("table.clb")); return; }
  const t = e.target.closest("table.clb [data-clbsem='-1']"); if (t && clbSel) choisirClb(null, t); });
document.addEventListener("keydown", e => { if (!S || current.view !== "classebilan" || (e.key !== "Enter" && e.key !== " ")) return; const t = e.target.closest && e.target.closest("td[data-clbsem][tabindex]"); if (!t) return;
  e.preventDefault(); const w = Number(t.dataset.clbsem); choisirClb(w < 0 || (clbSel && clbSel[0] === w && clbSel[1] === w) ? null : [w, w], t); });
document.addEventListener("mouseover", e => { if (!S || current.view !== "classebilan" || !e.target.closest) return; const t = e.target.closest("table.clb [data-clbsem]"), v = t ? t.dataset.clbsem : null;
  document.querySelectorAll("table.clb .survol").forEach(x => { if (x.dataset.clbsem !== v) x.classList.remove("survol"); });
  if (v !== null) document.querySelectorAll(`table.clb [data-clbsem="${v}"]`).forEach(x => x.classList.add("survol")); });
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-clbmode]"); if (!b || !S) return; clbMode = b.dataset.clbmode; try { localStorage.setItem(LS_KEY + "-clb", clbMode); } catch (err) { /* sans stockage */ } render(); });
/** Suivi individuel voisin (dans l'ordre de la liste), à la fiche qui couvre la même date. */
function indivVoisin(ind, sens, date) {
  const i = S.individuels.indexOf(ind), v = S.individuels[i + sens]; if (!v) return null;
  const cy = cyclesIndiv(v), c = (date && (cy.find(x => x.debut <= date && x.fin >= date) || cy.find(x => x.debut >= date))) || cycleCourant(cy);
  return v.id + (c ? ":" + c.fin : "");
}
let dateIndiv = null, garderDateIndiv = false;   // milieu de la fiche affichée : la même période d'un élève à l'autre
const navEleveIndiv = (ind, cote) => { if (S.individuels.length < 2) return ""; const i = S.individuels.indexOf(ind);
  const [g, d] = `<button type="button" class="nav-el" data-goi="${i > 0 ? indivVoisin(ind, -1, dateIndiv) : ""}" ${i > 0 ? "" : "disabled"} title="Élève précédent\nMême période.\nRaccourci : flèche ←" aria-label="Élève précédent">‹</button><button type="button" class="nav-el" data-goi="${i < S.individuels.length - 1 ? indivVoisin(ind, 1, dateIndiv) : ""}" ${i < S.individuels.length - 1 ? "" : "disabled"} title="Élève suivant\nMême période.\nRaccourci : flèche →" aria-label="Élève suivant">›</button>`.split("</button>").map((x, k) => k ? x + "</button>" : x + "</button>");
  return cote === "d" ? " " + d : g + " "; };   /* ‹ NOM › : élève précédent à gauche du nom, suivant à droite */
// flèches ← → : élève précédent ou suivant (hors de la grille de saisie et des champs, où les flèches déplacent)
document.addEventListener("keydown", e => {
  if (!S || current.view !== "indiv" || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable], td[data-ic], #boite")) return;
  const ind = indivParId(String(current.arg || "").split(":")[0]); if (!ind) return;
  const v = indivVoisin(ind, e.key === "ArrowRight" ? 1 : -1, dateIndiv); if (!v) return;
  e.preventDefault(); garderDateIndiv = true; location.hash = "#indiv/" + v;
});
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("button.nav-el"); if (b) garderDateIndiv = true; }, true);
function viewIndiv(arg) {
  const [id, fin] = String(arg || "").split(":"), ind = id && indivParId(id);
  if (!ind) {
    const cartes = S.individuels.map(i => carteIndiv(i)).join("");
    return `<div class="page-tete"><div class="titres"><span class="surtitre">Suivis individuels · un élève, ses objectifs, une fiche jusqu’au jour de remise</span><h1 data-titre>Fiches individuelles</h1></div>
      <div class="actions">${S.individuels.length > 1 ? `<a class="btn" href="#indivtous" title="Tous les suivis\nL’évolution de chaque élève, côte à côte.">Voir tous les suivis côte à côte</a>` : ""}${S.individuels.length ? `<button data-act="print-ind-semaine" title="Imprimer les fiches de la semaine\nLa fiche de chaque élève suivi pour la semaine choisie, en un seul PDF."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Fiches de la semaine…</button>` : ""}<button class="primary" data-act="ind-ajout" title="Nouveau suivi individuel\n• un élève, ses objectifs (1 à ${MAX_IND_OBJ})\n• une fiche jusqu’au jour de remise">+ Nouveau suivi individuel</button></div></div>
      ${S.individuels.length ? `<div class="ind-grille">${cartes}</div>` : `<div class="card"><p>Aucun suivi individuel pour l’instant. Un suivi individuel, c’est une fiche pour un élève, avec ses propres objectifs, qu’il fait remplir par chaque enseignant et dépose le jour de remise ; la famille reçoit le bilan par courriel.</p></div>`}`;
  }
  const cy = cyclesIndiv(ind);
  const c = cy.find(x => x.fin === fin) || cycleCourant(cy);
  const ii = S.individuels.indexOf(ind);
  const ouvert = regIndOuvert.has(ind.id) || !ind.nom.trim() || ind.objectifs.every(x => !x.trim());
  const reglages = `<details class="card reg-ind no-print" data-regind="${esc(ind.id)}"${ouvert ? " open" : ""}><summary><svg class="ic" aria-hidden="true"><use href="#i-reglages"/></svg>Réglages du suivi <small>élève, ${ind.objectifs.length} objectif${ind.objectifs.length > 1 ? "s" : ""}, remise le ${JOURS_REMISE[remiseDe(ind) - 1]}, dates, courriel de la famille</small></summary><div class="reg-ind-corps">
      <div class="champs"><label class="champ" title="Élève\nNOM Prénom, imprimé sur la fiche.">Élève <input type="text" data-path="individuels.${ii}.nom" value="${esc(ind.nom)}" list="liste-classe" aria-label="Élève"></label>
        <label class="champ" title="Jour de remise\nL’élève dépose sa fiche ce jour-là en fin de journée ; la suivante commence au jour de cours suivant (le lundi après un vendredi).\n• par défaut, celui des réglages (Réglages › Fiches individuelles)">Remise le <select data-num="individuels.${ii}.remise" aria-label="Jour de remise de la fiche"><option value="0" ${ind.remise ? "" : "selected"}>comme les réglages (${JOURS_REMISE[(S.remiseIndiv || 5) - 1]})</option>${JOURS_REMISE.map((j, k) => `<option value="${k + 1}" ${ind.remise === k + 1 ? "selected" : ""}>${j}</option>`).join("")}</select></label>
        <label class="champ" title="Début du suivi individuel">Depuis le <input type="date" data-path="individuels.${ii}.debut" value="${esc(ind.debut)}" aria-label="Début du suivi individuel"></label>
        <label class="champ" title="Fin du suivi individuel\nVide : jusqu’à la fin de la période.">Jusqu’au <input type="date" data-path="individuels.${ii}.fin" value="${esc(ind.fin)}" aria-label="Fin du suivi individuel"></label>
        <label class="champ" title="Courriel de la famille\nPour envoyer le bilan ; il ne quitte pas cet ordinateur.">Courriel de la famille <input type="email" data-path="individuels.${ii}.courriel" value="${esc(ind.courriel)}" placeholder="parents@exemple.fr" aria-label="Courriel de la famille"></label></div>
      ${ind.fin && S.fin && ind.fin > S.fin ? `<p class="hint" style="margin:8px 0 0">⚠ Les fiches s’arrêtent à la fin de la période du suivi (${fmtDM(S.fin)}) : pour aller jusqu’au ${fmtDM(ind.fin)}, allongez-la dans <a href="#reglages/calendrier">Réglages › Période et calendrier</a>.</p>` : ""}
      <datalist id="liste-classe">${[...new Set([...S.classeEleves, ...S.eleves].map(e => e.nom).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="liste" style="margin-top:12px">${ind.objectifs.map((o, n) => `<div class="lrow lo"><b>${NUM_OBJ[n]}</b><input type="text" data-path="individuels.${ii}.objectifs.${n}" value="${esc(o)}" placeholder="ex. Je lève la main pour prendre la parole." aria-label="Objectif ${n + 1}" title="Objectif ${n + 1}\nFormulé du point de vue de l’élève : « Je… »."><button class="ghost" data-io="banque.${ii}.${n}" title="Choisir dans la liste\nUn objectif type, à adapter ensuite à l’élève." aria-label="Choisir l’objectif ${n + 1} dans la liste">☰</button><button class="ghost danger" data-io="del.${ii}.${n}" ${ind.objectifs.length > 1 ? "" : "disabled"} title="Supprimer l’objectif\nEfface aussi ses codes déjà saisis." aria-label="Supprimer l’objectif ${n + 1}">✕</button></div>`).join("")}</div>
      <div class="row"><button data-io="add.${ii}" ${ind.objectifs.length < MAX_IND_OBJ ? "" : "disabled"} title="Ajouter un objectif\n${MAX_IND_OBJ} au plus : la fiche reste lisible.">+ Ajouter un objectif</button><button data-io="banque.${ii}.${ind.objectifs.length}" ${ind.objectifs.length < MAX_IND_OBJ ? "" : "disabled"} title="Ajouter depuis la liste\nUn objectif type (Réglages › Fiches individuelles), à adapter ensuite.">+ Ajouter depuis la liste…</button><span class="spacer"></span><button class="ghost danger" data-io="suppr.${ii}" title="Supprimer ce suivi individuel\nEfface ses objectifs, ses saisies et ses bilans.">Supprimer ce suivi…</button></div></div></details>`;
  if (!c) return `<div class="page-tete"><div class="titres"><span class="surtitre"><a href="#indiv">Suivis individuels</a></span><h1 data-titre>${esc(ind.nom) || "Nouveau suivi individuel"}</h1></div></div>${reglages}<div class="ind-haut ind-seul no-print"><div class="card"><p>Aucun jour de cours dans la période de ce suivi : vérifiez ses dates.</p></div></div>`;
  const k = cy.indexOf(c), st = statsIndiv(ind, c);
  if (garderDateIndiv) garderDateIndiv = false; else dateIndiv = c.jours[Math.floor(c.jours.length / 2)];   // en passant d'un élève à l'autre, la date de départ reste la même (pas de glissement)
  const opts = cy.map(x => `<option value="${x.fin}" ${x === c ? "selected" : ""}>${semainesCycle(x, true)} · du ${fmtDM(x.debut)} au ${fmtDM(x.fin)}</option>`).join("");
  const resume = ind.objectifs.map((o, n) => { const x = st[n], v = x[1] ? x[0] / x[1] : null;
    return `<li><b>${NUM_OBJ[n]}</b> ${esc(o) || "<i>objectif à écrire</i>"} ${v === null ? '<span class="muted small">rien de saisi</span>' : `<span class="pn${NIV_CLASSE[niveauReussite(S, v, x[2])] || ""}" title="Réussite de la fiche\n• ${x[0]} ${S.codage[0].code} ou ${S.codage[1].code} sur ${x[1]}${x[2] ? `\n• ${x[2]} « ${S.codage[3].code} »` : ""}">${pctTxt(v)}</span>${x[2] ? ` <span class="nI">· ${x[2]} ${esc(S.codage[3].code)}</span>` : ""}`}</li>`; }).join("");
  const mail = ind.courriel ? `<a class="btn" href="${courrielFamille(ind, c)}" title="Ouvrir la messagerie\nOuvre votre logiciel de messagerie avec l’objet et le message préparés (sans mise en forme).\n• sinon : copier l’objet et le message, puis les coller dans l’ENT">Ouvrir la messagerie</a>`
    : `<button disabled title="Ouvrir la messagerie\nIndiquez d’abord le courriel de la famille.\n• sinon : copier l’objet et le message, puis les coller dans l’ENT">Ouvrir la messagerie</button>`;
  return `<div class="page-tete no-print"><div class="titres"><span class="surtitre"><a href="#indiv">Suivis individuels</a> · ${navEleveIndiv(ind, "g")}<b class="nom-el">${esc(ind.nom)}</b>${navEleveIndiv(ind, "d")}</span><h1 data-titre>Fiche individuelle du ${fmtDM(c.debut)} au ${fmtDM(c.fin)} <span class="h1-sem">${semainesCycle(c)}</span></h1></div>
    <div class="nav-jours"><button class="discret" data-goi="${cy[k - 1] ? ind.id + ":" + cy[k - 1].fin : ""}" ${k ? "" : "disabled"} title="Fiche précédente" aria-label="Fiche précédente"><svg class="ic" aria-hidden="true"><use href="#i-prec"/></svg></button>
      <select data-semi="${esc(ind.id)}" aria-label="Fiche affichée" style="height:36px">${opts}</select>
      <button class="discret" data-goi="${cy[k + 1] ? ind.id + ":" + cy[k + 1].fin : ""}" ${k < cy.length - 1 ? "" : "disabled"} title="Fiche suivante" aria-label="Fiche suivante"><svg class="ic" aria-hidden="true"><use href="#i-suiv"/></svg></button></div>
    <div class="actions"><button data-act="print-ind" data-ind="${esc(ind.id)}" data-w="${c.fin}" title="Imprimer la fiche vierge ou remplie\nÀ donner à l’élève le jour où elle commence."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer la fiche</button>
      <button data-act="print-ind-tout" data-ind="${esc(ind.id)}" title="Imprimer toutes les fiches\nUne par période du suivi (${cy.length}).">Toutes les fiches</button></div></div>
  ${reglages}
  <div class="ind-haut ind-seul no-print">
    <div class="card"><h2>Fiche en bref</h2><ol class="resume">${resume}</ol>
      <h3 style="margin-top:14px">Le ${JOURS_REMISE[jourSemaine(remiseCycle(c)) - 1]} ${fmtDM(remiseCycle(c))}, après la remise</h3>
      <ol class="etapes-remise"><li><a href="#grille-indiv" data-vers="grille-indiv">Saisir les codes et les remarques</a> dans la fiche ci-dessous, puis le bilan.</li>
        <li><button class="primary" data-act="print-famille" data-ind="${esc(ind.id)}" data-w="${c.fin}" title="Bilan pour la famille (PDF)\n• page 1 : objectifs, remarques, bilan\n• page 2 : la fiche remplie\nChoisissez « Enregistrer en PDF » dans la fenêtre d’impression.">Bilan pour la famille (PDF)</button></li>
        <li><b>Envoyer à la famille</b> <span class="small muted">(ENT ou messagerie)</span>
          <div class="row envoi"><button data-act="copier-objet" data-ind="${esc(ind.id)}" data-w="${c.fin}" title="Copier l’objet\nÀ coller dans l’objet du message (Ctrl+V).">Copier l’objet</button>
          <button data-act="copier-message" data-ind="${esc(ind.id)}" data-w="${c.fin}" title="Copier le message\nTexte mis en forme : objectifs et réussite, remarques des enseignants, bilan.\n• à coller dans le message de l’ENT ou de la messagerie (Ctrl+V)\n• modèle dans Réglages › Fiches individuelles">Copier le message</button>${mail}</div>
          <details class="apercu-courriel"><summary>Voir le message</summary><p><b>Objet :</b> ${esc(texteCourriel((S.courrielIndiv || COURRIEL_INDIV_DEFAUT).objet, ind, c))}</p><div class="msg">${texteCourriel((S.courrielIndiv || COURRIEL_INDIV_DEFAUT).texte, ind, c, true)}</div></details>
          <span class="small muted">Le PDF du bilan peut être joint en plus.</span></li></ol></div></div>
  ${edtVide() ? `<div class="banner-info no-print">L’emploi du temps est vide : toutes les cases sont hachurées. Remplissez d’abord l’<a href="#edt">Emploi du temps</a>.</div>` : ""}
  ${paletteIndiv()}
  <div class="sheet papier indiv-feuille" id="grille-indiv">${indivHTML(ind, c, true)}</div>
  <div class="no-print">${evolutionIndivHTML(ind, c)}${bilanMatiereIndivHTML(ind, c, false)}</div>`;
}
/* ---------- saisie de la fiche individuelle, remplie d'une traite le jour de la remise ----------
   souris : un code choisi dans la palette, puis clic ou cliquer-glisser sur les cases (un clic sur une case qui a déjà ce code la vide) ;
   clavier : 1 (le plus faible) à 4 (le meilleur), 0 non évalué, ou l'initiale du code, et la case suivante est choisie toute seule (objectif suivant, puis cours suivant, puis jour suivant). */
let codeIndiv = null;                    // code choisi dans la palette : 0 à 3, -1 = gomme, null = aucun (un clic choisit seulement la case)
/** Initiales des codes (sans accent) utilisables au clavier, si elles ne se confondent pas : { T: 0, S: 1, A: 2, I: 3 }. */
function lettresIndiv() {
  const l = S.codage.map(x => sansAccent(x.code).slice(0, 1).toUpperCase());
  return Object.fromEntries(l.map((x, i) => [x, i]).filter(([x]) => /[A-Z]/.test(x) && l.filter(y => y === x).length === 1));
}
const touchesIndiv = () => { const l = Object.keys(lettresIndiv()); return `1 (${esc(S.codage[3].code)}) à 4 (${esc(S.codage[0].code)}), 0 : non évalué${l.length ? " — ou " + l.join(", ") : ""}`; };
// lien interne vers la grille de saisie (le # de l'adresse sert déjà à la navigation entre pages)
document.addEventListener("click", e => { const a = e.target.closest && e.target.closest("a[data-vers]"); if (!a) return; e.preventDefault();
  const c = document.getElementById(a.dataset.vers); if (c) { c.scrollIntoView({ behavior: "smooth", block: "start" }); const td = c.querySelector("td.ic"); if (td) td.focus({ preventScroll: true }); } });
function paletteIndiv() {
  const btn = (i, txt, tip) => `<button type="button" class="pal-c${i >= 0 ? " l" + i : " gomme"}${codeIndiv === i ? " on" : ""}" data-pal-ind="${i}" aria-pressed="${codeIndiv === i}" title="${tip}">${txt}</button>`;
  return `<div class="pal-ind no-print" role="toolbar" aria-label="Code à mettre dans les cases">
    <span class="pal-tit">Code :</span>${S.codage.map((x, i) => btn(i, `<b>${esc(x.code)}</b> <small>${toucheNiveau(i)}</small>`, `${esc(x.code)} : ${esc(x.sens)}\n• choisi : un clic (ou un cliquer-glisser) sur les cases le met tout de suite ; un 2e clic sur ce code le désélectionne\n• sans code choisi : la case choisie reçoit ce code, puis la suivante\n• au clavier : touche ${toucheNiveau(i)}${Object.entries(lettresIndiv()).find(([, k]) => k === i) ? " ou " + Object.entries(lettresIndiv()).find(([, k]) => k === i)[0] : ""}`)).join("")}${btn(-1, "⌫ Gomme <small>0</small>", "Gomme : non évalué\nVide la case choisie (ou les cases glissées).\n• au clavier : 0 (ou Suppr)")}
    <span class="pal-aide" title="Saisie au clavier\n• **${touchesIndiv()}** : met le code, puis passe à la case suivante (objectif suivant, puis cours suivant, puis jour suivant)\n• **Espace** : passer la case sans rien changer\n• **Retour arrière** : vider la case précédente et y revenir\n• **Suppr** : vider la case\n• **Entrée** : écrire la remarque du cours (juste après avoir rempli un cours : la remarque de ce cours-là) ; Entrée à nouveau : retour à la 1re case encore vide du cours, ou cours suivant s’il est rempli\n• **Maj+Entrée** : remarque du cours précédent (celui qu’on vient de remplir)\n• **flèches** : se déplacer"><b>Clavier :</b> ${touchesIndiv()} puis la case suivante est choisie toute seule · Espace : passer · ← Retour arrière : corriger · Entrée : remarque du cours qu’on vient de remplir</span></div>`;
}
/** Cases de la fiche affichée, dans l'ordre de saisie : jour par jour, cours par cours, objectif par objectif. */
function ordreIndiv() {
  return [...document.querySelectorAll("td[data-ic]")].map(td => td.dataset.ic).sort((a, b) => {
    const [, da, pa, oa] = a.split("."), [, db, pb, ob] = b.split(".");
    return da < db ? -1 : da > db ? 1 : (ORDRE_P.indexOf(Number(pa)) - ORDRE_P.indexOf(Number(pb))) || (oa - ob); });   // ordre de la journée (Midi entre M4 et S1)
}
const caseIndiv = cle => cle && document.querySelector(`td[data-ic="${cle}"]`);
function focusIndiv(cle) { const n = caseIndiv(cle); if (n) { n.focus({ preventScroll: true }); n.scrollIntoView({ block: "nearest", inline: "nearest" }); } }
function poserIndiv(cle, val, rendu = true) {
  const [ii, d, p, o] = cle.split("."), ind = S.individuels[ii], k = `${d}.${p}`;
  const s = ind.saisies[k] || (ind.saisies[k] = { c: ind.objectifs.map(() => null), r: "" });
  const avant = s.c[o] === undefined ? null : s.c[o];
  s.c[o] = val;
  if (s.c.every(v => v === null || v === undefined) && !s.r.trim()) delete ind.saisies[k];
  if (!rendu) { const td = caseIndiv(cle); if (td) { td.className = `cd ic${val !== null ? " l" + val : ""}`; td.textContent = val !== null ? S.codage[val].code : ""; } }
  return avant;
}
function saisirIndiv(cle, val, aller) {
  const ordre = ordreIndiv(), k = ordre.indexOf(cle);
  poserIndiv(cle, val); commit();
  focusIndiv(aller === undefined ? cle : ordre[Math.min(Math.max(k + aller, 0), ordre.length - 1)]);
}
let peintureInd = null;
function peindreIndiv(td) {
  const cle = td.dataset.ic; if (peintureInd.vus.has(cle)) return;
  peintureInd.vus.set(cle, poserIndiv(cle, codeIndiv < 0 ? null : codeIndiv, false));
}
function finPeintureIndiv() {
  if (!peintureInd) return;
  const p = peintureInd; peintureInd = null; document.body.classList.remove("tracage");
  if (p.attente) { selIndFraiche = true; return; }       // simple choix de la case : la palette y écrira
  if (p.vus.size === 1) { const [cle, avant] = [...p.vus][0]; if (codeIndiv >= 0 && avant === codeIndiv) poserIndiv(cle, null, false); }   // un clic sur le même code vide la case
  commit(); focusIndiv(p.derniere); selIndFraiche = false;   // après un clic qui écrit ou un glisser, choisir un autre code ne réécrit pas la dernière case
}
document.addEventListener("pointerdown", e => {
  const td = e.target.closest && e.target.closest("td[data-ic]");
  if (!td || e.button !== 0 || !S) return;
  e.preventDefault(); td.focus({ preventScroll: true });
  // un code est choisi dans la palette : le clic (ou le cliquer-glisser) le met tout de suite ; sinon le clic choisit seulement la case
  peintureInd = { vus: new Map(), derniere: td.dataset.ic, depart: td, attente: codeIndiv === null }; document.body.classList.add("tracage"); if (codeIndiv !== null) peindreIndiv(td);
});
document.addEventListener("pointermove", e => {
  if (!peintureInd) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), td = el && el.closest("td[data-ic]");
  if (td && !peintureInd.attente) { peindreIndiv(td); peintureInd.derniere = td.dataset.ic; }
});
document.addEventListener("pointerup", finPeintureIndiv);
document.addEventListener("pointercancel", finPeintureIndiv);
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-pal-ind]"); if (!b) return;
  const v = Number(b.dataset.palInd);
  if (codeIndiv === v) { codeIndiv = null; render(); return; }    // un clic sur le code déjà choisi le désélectionne
  const ecrire = codeIndiv === null && selIndFraiche && caseIndiv(selInd); codeIndiv = v;   // le code est choisi ; la case qui attendait le reçoit, puis la suivante
  if (ecrire) saisirIndiv(selInd, v < 0 ? null : v, 1); else render();
});
let selInd = null, selIndFraiche = false;    // dernière case choisie de la fiche individuelle ; « fraîche » : choisie (clic, clavier), pas encore écrite par un glisser
document.addEventListener("focusin", e => { const td = e.target.closest && e.target.closest("td[data-ic]"); if (td) { selInd = td.dataset.ic; if (!peintureInd) selIndFraiche = true; } });
document.addEventListener("click", async e => {
  if (!S) return;
  const t = e.target.closest && e.target.closest("[data-io], [data-goi], [data-act='ind-ajout'], [data-act='print-ind'], [data-act='print-ind-tout'], [data-act='print-famille'], [data-act='copier-objet'], [data-act='copier-message'], [data-act='print-evol'], [data-act='print-bmi']");
  if (!t) return;
  if (t.dataset.goi !== undefined) { if (t.dataset.goi) location.hash = "#indiv/" + t.dataset.goi; return; }
  if (t.dataset.io) {
    const [a, ii, n] = t.dataset.io.split("."), ind = S.individuels[ii];
    if (a === "banque") {
      const groupes = [...new Set(S.banqueObjectifs.filter(b => b.texte.trim()).map(b => b.groupe || "Autres"))];
      if (!groupes.length) { informer("Liste vide", "Ajoutez des objectifs types dans Réglages › Fiches individuelles."); return; }
      const deja = new Set(ind.objectifs);
      const options = groupes.map(g => `<optgroup label="${esc(g)}">${S.banqueObjectifs.filter(b => b.texte.trim() && (b.groupe || "Autres") === g).map(b => `<option value="${esc(b.texte)}"${deja.has(b.texte) ? " disabled" : ""}>${esc(b.texte)}${deja.has(b.texte) ? " (déjà choisi)" : ""}</option>`).join("")}</optgroup>`).join("");
      const choix = await saisir(Number(n) < ind.objectifs.length ? `Objectif ${Number(n) + 1}` : "Ajouter un objectif", "Choisissez un objectif type ; vous pourrez ensuite l’adapter à l’élève.", { options, libelle: "Objectif type" }, { ok: "Choisir" });
      if (!choix) return;
      if (Number(n) >= ind.objectifs.length) { if (ind.objectifs.length >= MAX_IND_OBJ) return; ind.objectifs.push(choix); for (const s of Object.values(ind.saisies)) s.c.push(null); }
      else ind.objectifs[n] = choix;
      commit();
      const c = document.querySelector(`input[data-path="individuels.${ii}.objectifs.${Math.min(Number(n), ind.objectifs.length - 1)}"]`); if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
      return;
    }
    if (a === "add" && ind.objectifs.length < MAX_IND_OBJ) { ind.objectifs.push(""); for (const s of Object.values(ind.saisies)) s.c.push(null); commit(); const c = document.querySelector(`input[data-path="individuels.${ii}.objectifs.${ind.objectifs.length - 1}"]`); if (c) c.focus(); }
    else if (a === "del" && ind.objectifs.length > 1) {
      const a2 = Object.values(ind.saisies).some(s => s.c[n] !== null && s.c[n] !== undefined);
      if (a2 && !(await demander("Supprimer l’objectif", `« ${ind.objectifs[n] || "objectif " + (Number(n) + 1)} » a déjà des codes saisis : ils seront effacés.\n\nCtrl+Z permet d’annuler.`, { ok: "Supprimer", danger: true }))) return;
      ind.objectifs.splice(n, 1); for (const s of Object.values(ind.saisies)) s.c.splice(n, 1); commit();
    } else if (a === "suppr") {
      if (!(await demander("Supprimer le suivi individuel", `Supprimer le suivi de ${ind.nom || "cet élève"}, avec ses objectifs, ses saisies et ses bilans ?\n\nCtrl+Z permet d’annuler.`, { ok: "Supprimer", danger: true }))) return;
      S.individuels.splice(ii, 1); commit(false); location.hash = "#indiv"; toast("Suivi individuel supprimé. Ctrl+Z pour annuler.");
    }
    return;
  }
  if (t.dataset.act === "ind-ajout") {
    const dejaSuivi = n => S.individuels.some(i => i.nom.trim() && sansAccent(i.nom) === sansAccent(n));   /* un seul suivi individuel par élève */
    const noms = [...new Set([...S.eleves, ...S.classeEleves].map(e => e.nom).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    if (S.individuels.length >= MAX_INDIV) { informer("Nombre maximal atteint", `${MAX_INDIV} suivis individuels au plus. Supprimez un suivi terminé pour en créer un nouveau.`); return; }
    let nom = await saisir("Nouveau suivi individuel", "Élève à suivre :", noms.length ? { options: `<option value="" selected disabled>— choisir l’élève —</option>` + noms.map(n => `<option value="${esc(n)}"${dejaSuivi(n) ? " disabled" : ""}>${esc(n)}${dejaSuivi(n) ? " — déjà suivi" : ""}</option>`).join("") + `<option value="__autre__">Autre élève (nom à taper ensuite)</option>`, libelle: "Élève", valider: v => !v ? "Choisissez l’élève dans la liste (ou « Autre élève » en bas de la liste)." : v !== "__autre__" && dejaSuivi(v) ? `${v} a déjà un suivi individuel : ouvrez-le plutôt (un seul suivi par élève).` : "" } : { valeur: "", exemple: "NOM Prénom" }, { ok: "Créer" });
    if (nom === null) return;
    if (nom !== "__autre__" && nom.trim() && dejaSuivi(nom)) { informer("Déjà suivi", `${nom.trim()} a déjà un suivi individuel : ouvrez-le plutôt (un seul suivi par élève).`); return; }
    if (nom === "__autre__") nom = "";
    const ind = { id: nouvelId(), nom: nom || "", objectifs: ["", "", ""], debut: "", fin: "", remise: 0, courriel: "", saisies: {}, bilans: {} };
    S.individuels.push(ind); commit(false); location.hash = "#indiv/" + ind.id;
    setTimeout(() => { const c = document.querySelector(`input[data-path="individuels.${S.individuels.length - 1}.${nom ? "objectifs.0" : "nom"}"]`); if (c) c.focus(); }, 100);
    return;
  }
  const ind = indivParId(t.dataset.ind); if (!ind) return;
  const cy = cyclesIndiv(ind), c = cy.find(x => x.fin === t.dataset.w);
  if (t.dataset.act === "copier-objet" || t.dataset.act === "copier-message") {
    const m = S.courrielIndiv || COURRIEL_INDIV_DEFAUT, objet = t.dataset.act === "copier-objet";
    const ok = await copierRiche(objet ? "" : texteCourriel(m.texte, ind, c, true), texteCourriel(objet ? m.objet : m.texte, ind, c));
    toast(ok ? (objet ? "Objet copié : collez-le dans l’objet du message (Ctrl+V)." : "Message copié, mis en forme : collez-le dans le message (Ctrl+V).") : "La copie n’a pas fonctionné : ouvrez « Voir le message » et copiez-le à la main.", 5000);
    return;
  }
  if (t.dataset.act === "print-bmi") { const s = serieIndiv(ind); if (s.length) printPages([bilanMatiereIndivHTML(ind, c, true)], nomPdfIndiv(ind, [s[0].c, s[s.length - 1].c], "Bilan par matière")); return; }
  if (t.dataset.act === "print-evol") { const s = serieIndiv(ind); if (s.length) printPages([evolutionIndivHTML(ind, c, true), bilanMatiereIndivHTML(ind, c, true)], nomPdfIndiv(ind, [s[0].c, s[s.length - 1].c], "Évolution")); return; }
  if (t.dataset.act === "print-ind") printPages([indivHTML(ind, c, false)], nomPdfIndiv(ind, [c]));
  else if (t.dataset.act === "print-famille") printPages([bilanFamilleHTML(ind, c), indivHTML(ind, c, false, true)], nomPdfIndiv(ind, [c], "Bilan pour la famille"));
  else { if (cy.length > 12 && !(await demander("Imprimer toutes les fiches ?", `${cy.length} fiches, une par période du suivi.`, { ok: `Imprimer ${cy.length} pages` }))) return; printPages(cy.map(x => indivHTML(ind, x, false)), nomPdfIndiv(ind, cy)); }
});
document.addEventListener("keydown", e => {
  if (!S || current.view !== "indiv") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const rq = e.target.closest && e.target.closest("input[data-ir]");
  if (rq && (e.key === "Enter" || e.key === "Escape")) {      // remarque : Entrée → 1re case encore vide du cours, sinon cours suivant ; Échap → cases du cours
    e.preventDefault(); const [ii, d, p] = rq.dataset.ir.split("."), ordre = ordreIndiv(), ici = ordre.filter(k => k.startsWith(`${ii}.${d}.${p}.`));
    const s = S.individuels[ii].saisies[`${d}.${p}`], vide = ici.find(k => { const x = s && s.c[k.split(".")[3]]; return x === null || x === undefined; });
    if (e.key === "Escape") { focusIndiv(vide || ici[0]); return; }
    const k = ordre.indexOf(ici[ici.length - 1]); focusIndiv(vide || ordre[k + 1] || ici[0]); return;
  }
  const td = e.target.closest && e.target.closest("td[data-ic]"); if (!td) return;
  const cle = td.dataset.ic, ordre = ordreIndiv(), k = ordre.indexOf(cle), [ii, d, p, o] = cle.split("."), lettre = lettresIndiv()[sansAccent(e.key).toUpperCase()];
  const avantSaisie = derniereSaisieIndiv; derniereSaisieIndiv = (lettre !== undefined || /^[0-4]$/.test(e.key)) && !e.ctrlKey && !e.metaKey && !e.altKey ? cle : null;   // case où l'on vient de taper un code
  const niv = niveauTouche(e.key);      // 1 (le plus faible) à 4 (le meilleur), 0 : non évalué ; aussi sans Maj sur un clavier AZERTY
  if (niv !== undefined || (e.key.length === 1 && lettre !== undefined)) { e.preventDefault(); saisirIndiv(cle, niv !== undefined ? niv : lettre, 1); }
  else if (e.key === " ") { e.preventDefault(); focusIndiv(ordre[k + 1] || cle); }
  else if (e.key === "Delete") { e.preventDefault(); saisirIndiv(cle, null); }
  else if (e.key === "Backspace") { e.preventDefault(); const v = S.individuels[ii].saisies[`${d}.${p}`], ici = v && v.c[o] !== null && v.c[o] !== undefined;
    if (ici || !k) saisirIndiv(cle, null); else saisirIndiv(ordre[k - 1], null); }
  else if (e.key === "Enter") {         // Entrée : remarque de ce cours ; Maj+Entrée : remarque du cours précédent (celui qu'on vient de remplir)
    e.preventDefault(); let cible = `${ii}.${d}.${p}`;
    // juste après avoir tapé le dernier code d'un cours (la case suivante est dans un autre cours), Entrée vise le cours qu'on vient de remplir
    const vient = avantSaisie && !avantSaisie.startsWith(cible + ".") && ordre.indexOf(avantSaisie) === k - 1;
    if (e.shiftKey || vient) { const prec = ordre.slice(0, k).reverse().find(x => !x.startsWith(cible + ".")); if (prec) cible = prec.split(".").slice(0, 3).join("."); }
    const r = document.querySelector(`input[data-ir="${cible}"]`); if (r) { r.focus(); r.scrollIntoView({ block: "nearest", inline: "nearest" }); } }
  else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault(); const rang = [...td.parentElement.querySelectorAll("td[data-ic]")], i = rang.indexOf(td), n = rang[i + (e.key === "ArrowRight" ? 1 : -1)]; if (n) focusIndiv(n.dataset.ic); }
  else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault(); const pas = e.key === "ArrowDown" ? 1 : -1;
    const ord = creneauxActifs(S);     // dans l'ordre de la journée (M5 après M4)
    for (let k = ord.indexOf(Number(p)) + pas; k >= 0 && k < ord.length; k += pas) { const q = ord[k]; if (caseIndiv(`${ii}.${d}.${q}.${o}`)) { focusIndiv(`${ii}.${d}.${q}.${o}`); break; } } }
}, true);
document.addEventListener("input", e => {
  const t = e.target; if (!S) return;
  if (t.dataset.ir) { const [ii, d, p] = t.dataset.ir.split("."), ind = S.individuels[ii], k = `${d}.${p}`;
    const s = ind.saisies[k] || (ind.saisies[k] = { c: ind.objectifs.map(() => null), r: "" }); s.r = t.value;
    if (s.c.every(v => v === null || v === undefined) && !s.r.trim()) delete ind.saisies[k]; commit(false, true); }
  else if (t.dataset.ib) { const [ii, l] = t.dataset.ib.split("."), ind = S.individuels[ii]; if (t.value.trim()) ind.bilans[l] = t.value; else delete ind.bilans[l]; commit(false, true); }
});
document.addEventListener("change", e => { const t = e.target; if (S && t.dataset.semi) location.hash = `#indiv/${t.dataset.semi}:${t.value}`; });

/* ---------- totaux : récapitulatif des incidents de la semaine (fiche de classe) ---------- */
const SEUILS_INC = { orange: 3, rouge: 6 };       // incidents dans la semaine : pastille orange, puis rouge
/** Comptes d'un élève de la classe sur une liste de jours : incidents par jour et par code, encouragements, créneaux d'absence. */
/* ---------- synthèse : fiche d'un élève (toutes fiches confondues) et synthèse pour le conseil de classe ---------- */
let synthPer = null;                 // [première, dernière semaine] des synthèses ; null = tout le suivi
/* par défaut : le trimestre ou le semestre de la dernière semaine commencée ; pendant les 3 premières semaines d'une période,
   la précédente (c'est le moment de son conseil de classe) ; avant le début du suivi : tout le suivi */
function periodeSynthDefaut(sems) {
  const today = aujourdhui(), der = sems.map(w => w.lundi <= today).lastIndexOf(true); if (der < 0) return null;
  const l = periodesDecoupage(S, sems, today), k = l.findIndex(([, [a, b]]) => der >= a && der <= b); if (k < 0) return null;
  return (der - l[k][1][0] < 3 && k > 0 ? l[k - 1] : l[k])[1];
}
const bornesSynth = sems => { const n = sems.length - 1, [a, b] = synthPer || periodeSynthDefaut(sems) || [0, n]; return [Math.min(Math.max(0, a), n), Math.min(Math.max(0, b), n)].sort((x, y) => x - y); };
/** Choix de la période des synthèses : périodes toutes prêtes (comme le bilan), ou de telle semaine à telle semaine. */
function choixPeriodeSynth(sems) {
  const [a, b] = bornesSynth(sems), opts = sel => sems.map((w, i) => `<option value="${i}"${i === sel ? " selected" : ""}>S${w.num} (${fmtDM(w.lundi)})</option>`).join("");
  return `<div class="periodes no-print" role="group" aria-label="Période"><b>Période :</b>${periodesBilan(sems).map(([lib, [x, y]]) => `<button data-synth-per="${x}.${y}" aria-pressed="${x === a && y === b}" class="${x === a && y === b ? "on" : ""}">${lib}</button>`).join("")}
    <label class="row small" style="gap:4px">de <select id="synth-de" aria-label="Première semaine">${opts(a)}</select> à <select id="synth-a" aria-label="Dernière semaine">${opts(b)}</select></label></div>`;
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-synth-per]"); if (!b || !S) return; synthPer = b.dataset.synthPer.split(".").map(Number); render(); });
document.addEventListener("change", e => { if (!S || (e.target.id !== "synth-de" && e.target.id !== "synth-a")) return; synthPer = [Number($("#synth-de").value), Number($("#synth-a").value)]; render(); });
const libPeriode = (sems, a, b) => (a === b ? `semaine ${sems[a].num} (du ${fmtDM(sems[a].lundi)} au ${fmtDM(sems[a].jours.at(-1))})` : `semaines ${sems[a].num} à ${sems[b].num} (du ${fmtDM(sems[a].lundi)} au ${fmtDM(sems[b].jours.at(-1))})`);
/** Tous les élèves connus (classe, suivi collectif, suivis individuels), sans doublon, par ordre alphabétique. */
function nomsEleves() { const vus = new Map();
  for (const n of [...S.classeEleves.map(e => e.nom), ...S.eleves.map(e => e.nom), ...S.individuels.map(i => i.nom)]) { const k = cleNom(n); if (k && !vus.has(k)) vus.set(k, n.trim()); }
  return [...vus.values()].sort((x, y) => x.localeCompare(y, "fr")); }
/** Ce que chaque famille de fiches dit d'un élève sur les semaines a à b. */
function donneesSynthEleve(nom, sems, a, b) {
  const k = cleNom(nom), sCl = S.classeEleves.findIndex(e => cleNom(e.nom) === k), sCo = S.eleves.findIndex(e => cleNom(e.nom) === k), inds = S.individuels.filter(i => cleNom(i.nom) === k);
  const ws = sems.slice(a, b + 1), wis = ws.map((_, i) => a + i), r = { nom, sCl, sCo, inds, ws, wis };
  if (sCl >= 0) {
    const sem = ws.map(w => bilanSemaineClasse(w)[sCl]), codes = S.codesClasse.filter(c => c.code);
    const par = Object.fromEntries(codes.map(c => [c.code, sem.reduce((x, y) => x + (y.par[c.code] || 0), 0)]));
    const bm = bilanMatiereClasse(sCl), wset = new Set(wis);
    const mats = bm.mats.map(m => { let n = 0, k2 = 0; for (const wi of wset) { n += m.parSem.get(wi) || 0; k2 += (m.coursSem.get(wi) || new Set()).size; } return { mat: m.mat, n, k: k2, t: k2 ? 10 * n / k2 : 0 }; }).filter(m => m.k);
    const n = mats.reduce((x, m) => x + m.n, 0), kTot = mats.reduce((x, m) => x + m.k, 0);
    r.classe = { sem, par, codes, neg: sem.reduce((x, y) => x + y.neg, 0), pos: sem.reduce((x, y) => x + y.pos, 0), ret: sem.reduce((x, y) => x + y.retenue, 0), abs: sem.reduce((x, y) => x + y.abs, 0),
      taux: kTot ? 10 * n / kTot : 0, cours: kTot, mats: mats.filter(m => m.n && m.k >= 3).sort((x, y) => y.t - x.t).slice(0, 3),
      tend: (v => { if (v.length < 3) return null; const q = Math.min(2, Math.floor(v.length / 2)), m = l => l.reduce((x, y) => x + y, 0) / l.length; return m(v.slice(-q)) - m(v.slice(-2 * q, -q)); })(sem.map(x => x.total)),
      rems: ws.flatMap(w => remarquesClasse(w, sCl)) };
  }
  if (sCo >= 0) {
    const st = wis.map(i => statsSemaine(S, sems, i).el[sCo]);
    const vals = st.map(e => (e && e.actifSemaine ? e.pct : null)), nIs = st.map(e => (e && e.actifSemaine ? nbIde(e.obj) : 0));
    const comp = st.reduce((x, e) => { if (!e || !e.actifSemaine) return x; for (const o of e.obj) for (let l = 0; l < 4; l++) x[l] += o.sem[l]; return x; }, [0, 0, 0, 0]);
    r.coll = { vals, nIs, moy: ratio(comp[0] + comp[1], comp.reduce((x, y) => x + y, 0)), nI: comp[3], abs: st.reduce((x, e) => x + (e ? e.absences : 0), 0), tend: tendanceIndiv(vals.filter(v => v !== null)), coms: st.flatMap((e, i) => (e ? e.commentaires.map(c => `S${ws[i].num} ${c}`) : [])) };
  }
  r.indiv = inds.map(ind => { const serie = serieIndiv(ind).filter(f => f.c.fin >= ws[0].lundi && f.c.debut <= ws.at(-1).jours.at(-1));
    const comp = serie.reduce((x, f) => { for (const t of f.st) { x[0] += t[0]; x[1] += t[1]; } return x; }, [0, 0]);
    return { ind, serie, avis: avisMaintien(ind), moy: ratio(comp[0], comp[1]), bilans: serie.map(f => [f.c, bilanCycle(ind, f.c)]).filter(([, t]) => t) }; });
  return r;
}
const nomCourt = n => esc(n);
function ficheEleveHTML(nom, imprime) {
  const sems = semaines(S), [a, b] = bornesSynth(sems), d = donneesSynthEleve(nom, sems, a, b), codes = S.codage.map(c => esc(c.code)), u = famillesUtilisees(sems, a, b);
  if (!u.classe) d.classe = null; if (!u.coll || (d.coll && d.coll.vals.every(v => v === null) && !d.coll.coms.length)) d.coll = null;   // familles non utilisées : pas de rubrique vide
  d.indiv = d.indiv.filter(x => x.serie.length || x.bilans.length);
  const grpE = d.sCl >= 0 ? (S.classeEleves[d.sCl].groupes || []) : [], e = d.sCl >= 0 ? S.classeEleves[d.sCl] : null;
  const chips = [], blocs = [];
  const chCl = [], blCl = [], chCo = [], blCo = [];     // affichés dans l'ordre individuel, collectif, classe
  if (d.classe) { const c = d.classe;
    chCl.push(`<span class="chip${c.ret ? " warn" : ""}">Classe : ${c.neg} incident${c.neg > 1 ? "s" : ""}${c.ret ? ` · ${c.ret} h de retenue` : ""}</span>`);
    blCl.push(`<section class="el-bloc"><h3>Classe entière <small class="muted">fiches de classe</small></h3>
      <div class="el-kpis"><div><b>${c.neg}</b><span>incident${c.neg > 1 ? "s" : ""}${c.pos ? ` · ${c.pos} positif${c.pos > 1 ? "s" : ""}` : ""}</span></div><div><b>${c.cours ? f1x(c.taux) : "—"}</b><span>pour 10 cours (${c.cours} cours)</span></div><div><b>${c.ret} h</b><span>de retenue</span></div><div><b>${c.abs}</b><span>cours d’absence</span></div></div>
      <p>${c.codes.filter(x => c.par[x.code]).map(x => `${codePositif(x.code) ? "<span class=\"pn bon\">" : "<span class=\"pn\">"}${c.par[x.code]} × ${esc(x.code)}</span> ${esc(x.sens)}`).join(" · ") || "Aucun code."}</p>
      ${c.mats.length ? `<p><b>Matières où il y a le plus d’incidents</b> (pour 10 cours) : ${c.mats.map(m => `${esc(m.mat)} <b>${f1x(m.t)}</b> <small class="muted">(${m.n} en ${m.k} cours)</small>`).join(" · ")}</p>` : ""}
      <div class="evol-defil"><table class="evol el-sem"><thead><tr><th class="l">Semaine</th>${d.ws.map(w => `<th>S${w.num}</th>`).join("")}<th>Tendance</th></tr></thead><tbody><tr><th class="l">Remarques (après les positifs)</th>${c.sem.map(x => `<td>${x.total || ""}${x.retenue ? ` <small class="ret">${x.retenue} h</small>` : ""}</td>`).join("")}<td>${c.tend === null ? "" : c.tend >= 1 ? "↑ en hausse" : c.tend <= -1 ? "↓ en baisse" : "= stable"}</td></tr></tbody></table></div>
      ${c.rems.length ? `<p><b>Remarques des enseignants :</b></p><ul>${c.rems.map(r => `<li>${quandRem(r)} : ${esc(r.txt)}</li>`).join("")}</ul>` : ""}</section>`); }
  if (d.coll) { const c = d.coll;
    chCo.push(`<span class="chip">Suivi collectif : ${c.moy === null ? "—" : pctTxt(c.moy)}</span>`);
    blCo.push(`<section class="el-bloc"><h3>Suivi collectif <small class="muted">fiches collectives</small></h3>
      <div class="el-kpis"><div><b>${c.moy === null ? "—" : pctTxt(c.moy)}</b><span>réussite (${codes[0]} + ${codes[1]})</span></div><div><b>${c.nI}</b><span>« ${codes[3]} »</span></div><div><b>${c.abs}</b><span>cours d’absence</span></div><div><b>${c.tend === null ? "—" : `${flecheTendance(c.tend)} ${ptsTxt(c.tend)}`}</b><span>tendance</span></div></div>
      <div class="evol-defil"><table class="evol el-sem"><thead><tr><th class="l">Semaine</th>${d.ws.map(w => `<th>S${w.num}</th>`).join("")}</tr></thead><tbody><tr><th class="l">Réussite</th>${c.vals.map((v, i) => `<td>${v === null ? "" : `<span class="pn${pnColl(v, c.nIs[i])}">${pctTxt(v)}</span>`}</td>`).join("")}</tr></tbody></table></div>
      ${c.coms.length ? `<p><b>Commentaires :</b></p><ul>${c.coms.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</section>`); }
  for (const x of d.indiv) {
    chips.push(`<span class="chip avis-chip ${x.avis.niv}">Suivi individuel : ${esc(x.avis.titre)}</span>`);
    blocs.push(`<section class="el-bloc"><h3>Suivi individuel <small class="muted">${x.ind.objectifs.length} objectif${x.ind.objectifs.length > 1 ? "s" : ""}</small>${imprime ? "" : ` <a class="small" href="#indiv/${esc(x.ind.id)}">ouvrir</a>`}</h3>
      <div class="el-kpis"><div><b>${x.moy === null ? "—" : pctTxt(x.moy)}</b><span>réussite sur la période</span></div><div><b>${x.serie.length}</b><span>fiche${x.serie.length > 1 ? "s" : ""}</span></div><div><b class="avis-chip ${x.avis.niv}">${esc(x.avis.titre)}</b><span>${esc(x.avis.sous || "")}</span></div></div>
      <ol class="el-objs">${x.ind.objectifs.map((o, k) => `<li>${esc(o)} — ${x.serie.length ? x.serie.map(f => f.v[k] === null ? "—" : pctTxt(f.v[k])).join(" → ") : "rien de noté"}</li>`).join("")}</ol>
      ${x.bilans.length ? `<p><b>Bilans du professeur principal :</b></p><ul>${x.bilans.map(([c, t]) => `<li>${fmtDM(c.debut)} au ${fmtDM(c.fin)} : ${esc(t)}</li>`).join("")}</ul>` : ""}</section>`); }
  chips.push(...chCo, ...chCl); blocs.push(...blCo, ...blCl);
  if (!blocs.length) blocs.push(`<p class="hint">Aucune fiche remplie pour cet élève sur cette période.</p>`);
  const tete = `<div class="el-tete"><h2>${esc(nom)}${S.classe ? ` <small>– ${esc(S.classe)}</small>` : ""}</h2>
    <p>${grpE.length ? `Groupes et options : ${grpE.map(esc).join(", ")} · ` : ""}${e && e.debut ? `arrivé(e) le ${fmtDM(e.debut)} · ` : ""}${e && e.fin ? `parti(e) le ${fmtDM(e.fin)} · ` : ""}${libPeriode(sems, a, b)}</p><div class="row">${chips.join("")}</div></div>`;
  return `<div class="fiche-eleve${imprime ? " synth-imp portrait" : ""}">${imprime ? `${enteteEtab()}<div class="f-head"><div class="f-title" role="heading" aria-level="2">Fiche élève – toutes les fiches de suivi</div></div>` : ""}${tete}${blocs.join("")}</div>`;
}
const f1x = x => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
let eleveVu = "";
function viewEleve(arg) {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  const noms = nomsEleves(); if (!noms.length) return `<div class="card"><h2>Aucun élève</h2><p>Ajoutez la liste de la classe dans <a href="#reglages/classeEntiere">Réglages › Élèves et groupes</a>.</p></div>`;
  let nom = arg ? decodeURIComponent(arg) : eleveVu; if (!noms.some(n => cleNom(n) === cleNom(nom))) nom = noms[0]; eleveVu = nom;
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Synthèse · toutes les fiches d’un élève</span><h1 data-titre>Fiche élève</h1></div>
    <div class="actions"><label class="champ row" style="gap:8px">Élève <select id="el-choix" aria-label="Élève">${noms.map(n => `<option value="${esc(n)}"${n === nom ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <button data-act="print-eleve" title="Imprimer la fiche de l’élève\nPour une équipe éducative, un rendez-vous avec la famille, la CPE."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div></div>
    ${choixPeriodeSynth(sems)}
    <div class="card">${ficheEleveHTML(nom, false)}</div>`;
}
document.addEventListener("change", e => { if (S && e.target.id === "el-choix") location.hash = "#eleve/" + encodeURIComponent(e.target.value); });
/** Synthèse pour le conseil de classe : un élève par ligne, les trois familles de fiches côte à côte. */
/** Familles de fiches réellement remplies sur les semaines a à b : on ne montre pas celles qui ne servent pas
    (en général, fiches individuelles OU suivi collectif, souvent avec la fiche de classe). */
function famillesUtilisees(sems, a, b) {
  const jours = sems.slice(a, b + 1).flatMap(w => w.jours), j = d => S.jours[d] || {}, du = sems[a].lundi, au = sems[b].jours.at(-1);
  return { classe: jours.some(d => Object.keys(j(d).cl || {}).length || Object.keys(j(d).clr || {}).length),
    coll: jours.some(d => Object.keys(j(d).x || {}).length || Object.keys(j(d).com || {}).length),
    indiv: S.individuels.some(ind => Object.keys(ind.saisies).some(k => { const d = k.split(".")[0]; return d >= du && d <= au; })) };
}
function conseilHTML(imprime) {
  const sems = semaines(S), [a, b] = bornesSynth(sems), noms = S.classeEleves.some(e => e.nom.trim()) ? S.classeEleves.map(e => e.nom).filter(n => n.trim()) : nomsEleves();
  const u = famillesUtilisees(sems, a, b);
  const donnees = noms.map(nom => donneesSynthEleve(nom, sems, a, b));
  const avecRem = donnees.some(d => (d.classe && u.classe ? d.classe.rems.length : 0) + (d.coll && u.coll ? d.coll.coms.length : 0));
  const lignes = donnees.map(d => { const c = u.classe ? d.classe : null, co = u.coll ? d.coll : null, nom = d.nom;
    const lien = t => (imprime ? t : `<a href="#eleve/${encodeURIComponent(nom)}">${t}</a>`);
    return `<tr><th class="l" scope="row">${lien(esc(nom))}</th>
      ${u.indiv ? `<td class="sep l">${d.indiv.filter(x => x.serie.length).map(x => `<span class="avis-chip ${x.avis.niv}">${esc(x.avis.titre)}</span>${x.moy === null ? "" : ` <small>${pctTxt(x.moy)}</small>`}`).join("<br>")}</td>` : ""}
      ${u.coll ? `<td class="sep">${co && co.moy !== null ? `<span class="pn${pnColl(co.moy, co.nI)}">${pctTxt(co.moy)}</span>` : ""}</td>` : ""}
      ${u.classe ? `<td class="sep">${c ? c.neg || "" : "—"}</td><td>${c ? (c.cours ? f1x(c.taux) : "") : "—"}</td><td>${c && c.ret ? `<b class="ret">${c.ret} h</b>` : ""}</td><td>${c && c.tend !== null ? (c.tend >= 1 ? `<span class="dn">↑ hausse</span>` : c.tend <= -1 ? `<span class="up">↓ baisse</span>` : "=") : ""}</td>
      <td class="l">${c && c.mats.length ? `${esc(c.mats[0].mat)} <small class="muted">${f1x(c.mats[0].t)}</small>` : ""}</td><td>${c && c.abs ? c.abs : ""}</td>` : ""}
      ${avecRem ? `<td>${(c ? c.rems.length : 0) + (co ? co.coms.length : 0) || ""}</td>` : ""}</tr>`; }).join("");
  const sel = sems.slice(a, b + 1), parSem = sel.map(w => bilanSemaineClasse(w).reduce((x, y) => x + y.neg, 0)), hRet = sel.reduce((x, w) => x + bilanSemaineClasse(w).reduce((y, z) => y + z.retenue, 0), 0);
  const rien = !u.classe && !u.coll && !u.indiv;
  return `<div class="conseil${imprime ? " synth-imp" : ""}${noms.length > 26 ? " serre" : ""}">${imprime ? `<div class="f-head"><div class="f-title" role="heading" aria-level="2">Synthèse pour le conseil de classe${S.classe ? " – " + esc(S.classe) : ""}</div></div>` : ""}
    <p class="synth-sous"><b>${libPeriode(sems, a, b).replace(/^s/, "S")}</b>${S.referent ? ` · Professeur principal : ${esc(S.referent)}` : ""}${u.classe ? ` · Classe : ${parSem.reduce((x, y) => x + y, 0)} incidents<span class="no-print"> (par semaine : ${parSem.join(", ")})</span>${S.retenueClasse.remarques && hRet ? ` · ${hRet} h de retenue` : ""}` : ""}</p>
    ${rien ? `<p class="hint">Aucune fiche remplie sur cette période (ni fiche individuelle, ni fiche collective, ni fiche de classe).</p>` : `
    <table class="evol conseil-t"><thead><tr><th class="l" rowspan="2">Élève</th>${u.indiv ? `<th class="sep">Suivi individuel</th>` : ""}${u.coll ? `<th class="sep">Suivi collectif</th>` : ""}${u.classe ? `<th class="sep" colspan="6">Classe entière (fiches de classe)</th>` : ""}${avecRem ? `<th rowspan="2" title="Remarques des enseignants et commentaires">Rem.</th>` : ""}</tr>
      <tr>${u.indiv ? `<th class="sep l" title="Avis sur le suivi individuel\nSuivi de la réussite sur la période.">Avis</th>` : ""}${u.coll ? `<th class="sep">Réussite</th>` : ""}${u.classe ? `<th class="sep" title="Incidents notés">Incid.</th><th title="Incidents pour 10 cours">/10 cours</th><th title="Heures de retenue sur la période">Retenues</th><th title="Tendance des incidents\n2 dernières semaines comparées aux 2 précédentes\n• ↑ hausse : plus d’incidents\n• ↓ baisse : moins d’incidents">Tend.</th><th class="l" title="Matière la plus signalée\nPour 10 cours.">Matière</th><th title="Cours d’absence">Abs.</th>` : ""}</tr></thead>
      <tbody>${lignes}</tbody></table>
    <p class="petit muted">${[(u.coll || u.indiv) && `Réussite : part des ${esc(S.codage[0].code)} + ${esc(S.codage[1].code)} (le pourcentage après l’avis du suivi individuel est sa réussite).`, u.classe && "Incidents : codes non positifs des fiches de classe ; tendance ↑ hausse = plus d’incidents ; « pour 10 cours » : ramenés à 10 heures de cours de l’élève ; les absences ne comptent pas comme incidents.", "Seules les fiches remplies sur la période sont présentées."].filter(Boolean).join(" ")}</p>`}</div>`;
}
function viewConseil() {
  const sems = semaines(S); if (!sems.length) return viewSommaire();
  if (!nomsEleves().length) return `<div class="card"><h2>Aucun élève</h2><p>Ajoutez la liste de la classe dans <a href="#reglages/classeEntiere">Réglages › Élèves et groupes</a>.</p></div>`;
  return `<div class="page-tete"><div class="titres"><span class="surtitre">Synthèse · pour le conseil de classe</span><h1 data-titre>Conseil de classe</h1></div>
    <div class="actions"><button data-act="print-conseil" title="Imprimer la synthèse\nA4 paysage, un élève par ligne."><svg class="ic" aria-hidden="true"><use href="#i-print"/></svg>Imprimer</button></div></div>
    ${choixPeriodeSynth(sems)}
    <div class="card"><div class="conseil-defil">${conseilHTML(false)}</div></div>`;
}
/** Impressions des synthèses (bouton ou Ctrl+P). */
function pagesSynthese() {
  const sems = semaines(S); if (!sems.length) return { pages: [] }; const [a, b] = bornesSynth(sems), dc = periodesDecoupage(S, sems, "9999-12-31").find(([, r]) => r[0] === a && r[1] === b);
  const per = (dc ? dc[0] + " - " : "") + (a === b ? periodeSemaine(sems[a]) : `semaines ${sems[a].num} à ${sems[b].num} du ${dateNom(sems[a].lundi)} au ${dateNom(sems[b].jours.at(-1))}`);   // « 1er semestre - semaines 36 à 4 du … »
  if (current.view === "eleve") return { pages: [ficheEleveHTML(eleveVu, true)], nom: nomPdf("Synthèse", eleveVu, "Fiche élève", per) };
  return { pages: [conseilHTML(true)], nom: nomPdf("Synthèse", "Conseil de classe", per) };
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-act="print-eleve"], [data-act="print-conseil"]'); if (!b || !S) return; const p = pagesSynthese(); printPages(p.pages, p.nom); });

/* ---------- fiches individuelles : impression groupée (tous les élèves suivis, une semaine) ---------- */
/** Fiche de chaque suivi pour la semaine w : celle qui commence cette semaine-là, sinon celle en cours au début de la semaine. */
function fichesIndivSemaine(w, inds) {
  return inds.map(ind => { const cy = cyclesIndiv(ind); const c = cy.find(x => x.debut >= w.lundi && x.debut <= w.jours.at(-1)) || cy.find(x => x.debut <= w.lundi && x.fin >= w.lundi); return c ? [ind, c] : null; }).filter(Boolean);
}
document.addEventListener("click", async e => { const b = e.target.closest && e.target.closest('[data-act="print-ind-semaine"]'); if (!b || !S) return;
  const sems = semaines(S); if (!sems.length) return; const wc = Math.max(0, sems.findIndex(w => w.lundi === (semaineCourante(sems) || {}).lundi));
  const wi0 = [...sems.keys()].slice(wc).concat([...sems.keys()].slice(0, wc).reverse()).find(i => fichesIndivSemaine(sems[i], S.individuels).length) ?? wc;   // une semaine qui a des fiches
  const html = `<label class="champ">Semaine <select id="pis-sem">${sems.map((w, i) => `<option value="${i}"${i === wi0 ? " selected" : ""}>Semaine ${w.num} (du ${fmtDM(w.lundi)} au ${fmtDM(w.jours.at(-1))})</option>`).join("")}</select></label>
    <p class="hint">Élèves :</p>${S.individuels.map((ind, i) => `<label class="na-case"><input type="checkbox" data-pis="${i}" checked> ${esc(ind.nom || "élève à indiquer")}</label>`).join("")}
    <p class="hint">Pour chaque élève : la fiche qui commence cette semaine-là (selon son jour de remise), sinon celle en cours.</p>`;
  const r = await saisir("Imprimer les fiches individuelles", "Une page par élève, en un seul PDF.", { html, lire: d => ({ wi: Number(d.querySelector("#pis-sem").value), qui: [...d.querySelectorAll("[data-pis]")].filter(x => x.checked).map(x => Number(x.dataset.pis)) }) }, { ok: "Imprimer" });
  if (!r || !r.qui.length) return;
  const w = sems[r.wi], l = fichesIndivSemaine(w, r.qui.map(i => S.individuels[i]));
  if (!l.length) { informer("Rien à imprimer", "Aucun des élèves choisis n’a de fiche cette semaine-là (suivi pas commencé ou terminé)."); return; }
  printPages(l.map(([ind, c]) => indivHTML(ind, c, false)), nomPdf("Suivi individuel", ...(l.length === 1 ? [l[0][0].nom || "élève", "Fiche"] : [r.qui.length === S.individuels.length && l.length === r.qui.length ? "Fiches de tous les élèves" : `Fiches de ${l.length} élèves`]), periodeSemaine(w)));
});
