/* =====================================================================
   Démonstration : élèves et enseignants fictifs, croix tirées au hasard (graine fixe)
   ===================================================================== */
const DEMO_EDT = /*EDT_DEMO*/null;
function demoState() {
  const st = newState();
  st.anneeScolaire = 2026; st.zone = "B"; st.vacances = vacancesAnnee(2026, "B"); st.joursSansCours = feriesAnnee(2026, true);   // la démo est datée de 2026-2027
  st.classe = "5E"; st.referent = "M. ROUGET"; st.consigneChoisie = 3;
  st.debut = "2026-10-12"; st.fin = "2026-12-31"; st.typeDebut = "A";
  // horaires calculés : 8 h, 13 h 30, cours de 55 min, récréations de 15 min après M2 et après S2
  st.horaires = PERIODS.map(() => ({ debut: "", fin: "" }));   // tout est calculé, récréations comprises
  // Noms fictifs : traductions et combinaisons du nom et du prénom de référence, jamais les mots d'origine
  [["DEL PONTE Michele"], ["BRIDGE Michael"], ["PUENTE Miguel"], ["BRÜCKNER Miquel", "", "2026-11-06"],
   ["MOSTOWSKI Michał"], ["DA PONTE Mikhaïl", "2026-11-09", ""]].forEach(([nom, debut = "", fin = ""], i) => { st.eleves[i] = { nom, debut, fin }; });
  // Enseignants : noms de poissons (dans la langue enseignée pour les langues)
  const profs = { "Français": "Mme SOLE", "Mathématiques": "M. BROCHET", "Hist.-Géo.": "Mme TANCHE", "Anglais": "Mme HADDOCK",
    "Allemand": "M. HECHT", "Espagnol": "Mme LUBINA", "SVT": "Mme DORADE", "Physique-Chimie": "M. ROUGET", "Technologie": "M. GOUJON",
    "Arts Plastiques": "Mme COLIN", "Éd. Musicale": "M. BARBEAU", "Éd. Religieuse": "M. MERLAN", "EPS": "M. MULET",
    "Latin": "Mme MURENA", "Vie de classe": "M. ROUGET", "Devoirs faits": "Mme VANDOISE" };
  st.matieres.forEach(m => { m.prof = profs[m.nom] || ""; });
  for (const t of ["A", "B"]) DEMO_EDT[t].forEach((day, d) => day.forEach(([mat, salle], p) => { st.edt[t][d][p] = { mat, salle }; }));

  let seed = 2026;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = w => { const r = rnd() * w.reduce((a, b) => a + b, 0); let acc = 0; for (let i = 0; i < w.length; i++) { acc += w[i]; if (r < acc) return i; } return w.length - 1; };
  const profil = (s, wk, mat, p, o) => {
    if (s === 0) return [0.62, 0.33, 0.04, 0.01];
    if (s === 1) { let q = (mat === "Mathématiques" || p >= 4) ? [0.05, 0.2, 0.45, 0.3] : [0.15, 0.35, 0.35, 0.15];
      if (o === 2) q = [q[0] * 0.5, q[1] * 0.7, q[2] + 0.1, q[3] + 0.15]; if (mat === "EPS") q = [0.4, 0.4, 0.15, 0.05];
      if (wk >= 5) q = [q[0] + 0.15, q[1] + 0.1, q[2], q[3] * 0.5]; return q; }
    if (s === 2) return [[0.15, 0.4, 0.35, 0.1], [0.25, 0.45, 0.24, 0.06], [0.45, 0.42, 0.11, 0.02], [0.55, 0.38, 0.06, 0.01]][Math.min(wk, 4) - 1];
    if (s === 3) return (o === 0 || o === 2) ? (mat === "Français" ? [0.05, 0.25, 0.5, 0.2] : [0.15, 0.35, 0.4, 0.1]) : [0.4, 0.45, 0.12, 0.03];
    if (s === 5) return [0.3, 0.5, 0.15, 0.05];
    return o === 1 ? [0.1, 0.3, 0.45, 0.15] : [0.35, 0.5, 0.12, 0.03];
  };
  const comments = { "0.0.1": "Maths : refuse de se mettre au travail (M. BROCHET).", "0.1.3": "Français : bavardages répétés, déplacé en début d’heure.",
    "0.3.1": "Après-midi difficile, s’est excusé auprès de Mme HADDOCK.", "0.4.2": "Manque de matériel en SVT.",
    "1.1.4": "N’a pas sorti ses affaires en Éd. Religieuse.", "1.1.1": "Mieux le matin. Vie de classe : point fait avec M. ROUGET.",
    "1.3.3": "Bavardages en anglais, mais travail rendu.", "2.0.2": "Très bonne participation en français.",
    "2.3.4": "Exercices non faits en maths.", "2.4.5": "Bonne intégration dans le groupe.", "3.1.1": "Exclu de cours en maths (insolence).",
    "5.2.1": "Nette amélioration cette semaine.", "7.4.0": "Aide spontanément ses camarades en maths.", "7.4.2": "Période très positive, félicitations !" };
  const sems = semaines(st);
  // Absences d'exemple : M. HECHT (allemand) absent le jeudi 19/11, PUENTE Miguel absent le 24/11, BRIDGE Michael absent l'après-midi du 03/12,
  // MOSTOWSKI Michał absent en M2 le 08/12
  { const date = "2026-11-19"; const j = jour(st, date, true);
    for (let p = 0; p < 7; p++) if (creneau(st, sems, date, p).mat === "Allemand") j.profAbs[p] = true; }
  jour(st, "2026-11-24", true).abs[2] = [0, 1, 2, 3, 4, 5, 6];
  jour(st, "2026-12-03", true).abs[1] = [4, 5, 6];
  jour(st, "2026-12-08", true).abs[4] = [1];          // MOSTOWSKI Michał absent sur un seul créneau (M2, rendez-vous)
  sems.forEach((w, wi) => w.jours.forEach((date, d) => {
    for (let p = 0; p < 7; p++) {
      const cr = creneau(st, sems, date, p), mat = cr.mat;
      if (!mat || cr.absent || rnd() < 0.05) continue;   // pas de cours, enseignant absent, ou créneau oublié
      for (let s = 0; s < st.eleves.length; s++) {
        if (!eleveActif(st, s, date) || eleveAbsent(st, date, s, p)) continue;
        for (let o = 0; o < nbObj(st); o++) setCroix(st, date, s, o, p, pick(profil(s, wi + 1, mat, p, o)));
      }
    }
    for (let s = 0; s < st.eleves.length; s++) { const c = comments[`${wi}.${d}.${s}`]; if (c && eleveActif(st, s, date)) jour(st, date, true).com[s] = c; }
  }));
  // ----- fiche de classe : toute la classe. Même principe que les élèves suivis : « du pont » traduit dans une autre langue pour le nom,
  // une forme étrangère du prénom de référence pour le prénom, jamais les mots d'origine -----
  st.classeEleves = ["AP PONT Mihangel", "BEN GESHER Mikhaela", "BRIDGE Michael", "BROGAARD Mikkel", "BROMAN Mikaela", "BRÜCKNER Miquel", "DA PONTE Mikhaïl",
    "DARAJANI Mikaeli", "DE LA PUENTE Micaela", "DEL PONTE Michele", "GEFYRAKIS Michalis", "HASHIMOTO Mika", "HIDASI Mihály", "KÖPRÜLÜ Mikail", "MOSTOVÁ Michaela",
    "MOSTOVENKO Mykhaïlo", "MOSTOWSKA Michalina", "MOSTOWSKI Michał", "PODEANU Mihaela", "PONTS Miquela", "PUENTE Miguel", "SILD Mihkel", "SILTALA Mikko",
    "TILTINYTĖ Mykolė", "VAN DER BRUG Michiel", "ZUBIRI Mikel"].map(nom => ({ nom }));
  let g2 = 46;
  const r2 = () => { g2 = (g2 + 0x6d2b79f5) | 0; let t = g2; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const suivis = new Set(st.eleves.map(e => e.nom)), dissipes = new Set(["KÖPRÜLÜ Mikail", "ZUBIRI Mikel", "SILTALA Mikko"]);
  sems.forEach(w => w.jours.forEach(date => {
    if (sansCours(st, date)) return;
    const j = jour(st, date, true);
    for (let p = 0; p < 7; p++) {
      const cr = creneau(st, sems, date, p); if (!cr.mat || cr.absent) continue;
      st.classeEleves.forEach((e, s) => {
        if (e.nom === "PUENTE Miguel" && date === "2026-11-24") { j.cl[`${s}.${p}`] = "A"; return; }
        const risque = suivis.has(e.nom) ? 0.1 : dissipes.has(e.nom) ? 0.08 : 0.015;
        let c = ""; if (r2() < risque) c += "BTMRC"[Math.floor(r2() * r2() * 5)]; if (r2() < risque / 3) c += "BTMC"[Math.floor(r2() * 4)]; if (r2() < 0.012) c += "+";
        c = [...new Set(c)].join(""); if (c) j.cl[`${s}.${p}`] = c;
      });
    }
  }));
  const rang = nom => st.classeEleves.findIndex(e => e.nom === nom);
  { const s = rang("BRIDGE Michael"), p = [0, 1, 2, 3, 4, 5, 6].find(p => coursPour(creneau(st, sems, "2026-11-16", p), st.classeEleves[s].groupes || []).mat === "Mathématiques");   // remarque avec l'heure : on sait la discipline
    jour(st, "2026-11-16", true).clr[p === undefined ? s : `${s}.${p}`] = "Exclu de cours, rapport à M. ROUGET."; }
  jour(st, "2026-11-30", true).clr[rang("KÖPRÜLÜ Mikail")] = "Oublis de matériel répétés : mot dans le carnet.";
  // ----- suivis individuels hebdomadaires : objectifs propres, résultats qui progressent -----
  const indiv = (nom, objectifs, debut, prof) => {
    const i = { id: "demo-" + nom.split(" ")[0].toLowerCase(), nom, objectifs, debut, fin: "", remise: 0, courriel: "", saisies: {}, bilans: {} };
    sems.forEach((w, wi) => { if (w.jours[4] < debut) return;
      w.jours.forEach(date => { if (sansCours(st, date)) return;
        for (let p = 0; p < 7; p++) { const cr = creneau(st, sems, date, p); if (!cr.mat || cr.absent || r2() < 0.08) continue;
          const k = Math.max(0, wi - sems.findIndex(x => x.jours[4] >= debut));
          const c = objectifs.map((_, o) => { const q = prof(k, o, cr.mat); const r = r2(); return r < q[0] ? 0 : r < q[0] + q[1] ? 1 : r < q[0] + q[1] + q[2] ? 2 : 3; });
          const r = c.includes(3) && r2() < 0.5 ? ["A refusé de travailler.", "Oubli de cahier.", "Bavardages, déplacé.", "Insolent quand on l’a repris."][Math.floor(r2() * 4)]
            : c.every(x => x === 0) && r2() < 0.25 ? ["Très bien !", "Belle participation.", "Bravo, continue."][Math.floor(r2() * 3)] : "";
          i.saisies[`${date}.${p}`] = { c, r }; } });
    });
    return i; };
  const b = indiv("BRIDGE Michael", ["Je commence le travail dès la consigne donnée.", "Je lève la main pour prendre la parole.", "J’ai mon matériel."], "2026-11-02",
    (k, o, mat) => { const base = [[0.1, 0.3, 0.4, 0.2], [0.2, 0.35, 0.35, 0.1], [0.3, 0.4, 0.25, 0.05], [0.4, 0.4, 0.17, 0.03]][Math.min(k, 3)]; return mat === "Mathématiques" ? [base[0] * 0.3, base[1] * 0.6, base[2] + base[0] * 0.4 + base[1] * 0.2, base[3] + base[0] * 0.3 + base[1] * 0.2] : base; });   // nettement moins bien en maths
  b.courriel = "famille.bridge@exemple.fr";
  b.bilans = { "2026-11-06": "Début difficile : beaucoup de refus de travail, surtout en maths.", "2026-11-13": "Un peu mieux ; le matériel reste à revoir.",
    "2026-11-20": "Progrès nets en prise de parole. Rencontre avec la famille le 20/11.", "2026-11-27": "Semaine encourageante, à poursuivre." };
  const m = indiv("MOSTOWSKI Michał", ["Je reste assis à ma place pendant le cours.", "Je parle poliment aux adultes."], "2026-11-16",
    (k) => [[0.25, 0.4, 0.25, 0.1], [0.45, 0.45, 0.08, 0.02], [0.66, 0.34, 0, 0], [0.66, 0.34, 0, 0]][Math.min(k, 3)]);   // objectifs atteints au bout de 3 fiches
  // exemple de jour propre à un suivi : fiche remise le jeudi, la suivante est donnée le vendredi matin
  m.remise = 4; m.courriel = "famille.mostowski@exemple.fr";
  m.bilans = { "2026-11-19": "Objectifs fixés avec l’élève et sa famille le 13/11. Bon départ.", "2026-11-26": "Reste assis plus souvent ; encore des écarts de langage." };
  // un 3e suivi qui se dégrade, pour comparer les évolutions en parallèle
  const pd = indiv("PODEANU Mihaela", ["Je fais le travail demandé en classe.", "Je laisse mes camarades travailler."], "2026-11-09",
    (k) => [[0.45, 0.4, 0.12, 0.03], [0.35, 0.4, 0.2, 0.05], [0.25, 0.35, 0.3, 0.1], [0.15, 0.3, 0.37, 0.18]][Math.min(k, 3)]);
  pd.courriel = "famille.podeanu@exemple.fr";
  pd.bilans = { "2026-11-13": "Plutôt bien partie.", "2026-11-27": "Décroche depuis deux semaines : à revoir avec la famille." };
  st.individuels = [b, m, pd];
  // ----- groupes et options : demi-groupes en sciences le lundi (semaine A), option latin le mercredi en M4 -----
  st.groupes = [{ nom: "Groupe 1" }, { nom: "Groupe 2" }, { nom: "Latin" }];
  const latinistes = ["BRIDGE Michael", "DEL PONTE Michele", "GEFYRAKIS Michalis", "HIDASI Mihály", "PODEANU Mihaela", "SILD Mihkel", "ZUBIRI Mikel"];
  st.classeEleves.forEach((e, s) => { e.groupes = [s % 2 ? "Groupe 2" : "Groupe 1", ...(latinistes.includes(e.nom) ? ["Latin"] : [])]; });
  st.edt.A[0][3] = { mat: "", salle: "", grp: [{ g: "Groupe 1", mat: "Physique-Chimie", salle: "S12" }, { g: "Groupe 2", mat: "SVT", salle: "S14" }] };
  st.edt.A[0][5] = { mat: "", salle: "", grp: [{ g: "Groupe 1", mat: "SVT", salle: "S14" }, { g: "Groupe 2", mat: "Physique-Chimie", salle: "S12" }] };
  for (const t of ["A", "B"]) st.edt[t][2][3] = { mat: "", salle: "", grp: [{ g: "Latin", mat: "Latin", salle: "105" }] };
  if (!st.matieres.some(x => x.nom === "Latin")) st.matieres.push({ nom: "Latin", prof: "Mme MURENA" });
  // saisies déjà tirées : on retire celles des élèves qui n'ont pas cours (autre groupe, pas latiniste), on en tire pour les latinistes
  const r3 = (() => { let x = 77; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
  for (const w of sems) for (const date of w.jours) { const j = st.jours[date]; if (!j || sansCours(st, date)) continue;
    for (let p = 0; p < 7; p++) { const cr = creneau(st, sems, date, p); if (!cr.divise) continue;
      st.eleves.forEach((e, s) => { const c = coursPour(cr, groupesDe(st, e.nom));
        for (let o = 0; o < nbObj(st); o++) { if (!c.mat) delete j.x[`${s}.${o}.${p}`]; else if (j.x[`${s}.${o}.${p}`] === undefined && eleveActif(st, s, date) && !cr.absent) j.x[`${s}.${o}.${p}`] = r3() < 0.5 ? 0 : r3() < 0.7 ? 1 : 2; } });
      st.classeEleves.forEach((e, s) => { if (!coursPour(cr, e.groupes || []).mat) delete (j.cl || {})[`${s}.${p}`]; });
      for (const i of st.individuels) { const c = coursPour(cr, groupesDe(st, i.nom)); if (!c.mat) delete i.saisies[`${date}.${p}`];
        else if (!i.saisies[`${date}.${p}`] && (!i.debut || date >= i.debut)) i.saisies[`${date}.${p}`] = { c: i.objectifs.map(() => r3() < 0.45 ? 0 : r3() < 0.6 ? 1 : 2), r: "" }; } } }
  return st;
}
