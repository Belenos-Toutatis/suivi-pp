"use strict";
/* =====================================================================
   Modèle de données et calculs (aucune dépendance au DOM)
   ===================================================================== */
const APP_VERSION = 2;
/* RÉTROCOMPATIBILITÉ, à partir de la version du 10/10/2026 (format 1) : toute version suivante doit rouvrir les suivis enregistrés par celle-ci et les suivantes
   (test e2e_compat : fichiers de référence dans compat/).
   • l'enveloppe des données ne change pas : { app: "fiche-suivi-collective", format, savedAt, S }, rangée dans le bloc « donnees-suivi » d'une page .html
     (balise script de type application/json ; ne jamais l'écrire telle quelle dans le code : elle serait prise pour le bloc), ou seule dans un .json ;
   • normalizeState complète ce qui manque et convertit les anciennes formes (jamais de champ renommé sans conversion) ;
   • les champs inconnus (venus d'une version plus récente) sont gardés tels quels ;
   • FORMAT_DONNEES n'augmente que si l'enveloppe change, et la lecture des anciens formats reste. */
const FORMAT_DONNEES = 1;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
/* Créneaux : le numéro d'un créneau ne change jamais (les saisies y sont rangées) ; M5 (7, le midi), S4 (8) et S5 (9) sont venus après,
   d'où un ordre d'affichage à part. Le samedi (s'il y a cours) n'a que le matin. */
const PERIODS = ["M1", "M2", "M3", "M4", "S1", "S2", "S3", "M5", "S4", "S5"];
const PERIODS_N = PERIODS;
const ORDRE_P = [0, 1, 2, 3, 7, 4, 5, 6, 8, 9];
const P_MATIN = [0, 1, 2, 3, 7], P_APREM = [4, 5, 6, 8, 9];
const NB_P = PERIODS.length;
/** Créneaux en service, dans l'ordre de la journée (réglages : M5 le midi, S4, S5 jusqu'à 18 h). */
const creneauxActifs = st => ORDRE_P.filter(p => p < 7 || (p === 7 && !!(st && st.creneauMidi)) || (p === 8 && !!(st && st.creneauS4)) || (p === 9 && !!(st && st.creneauS4 && st.creneauS5)));
const jourIdx = d => (parseD(d).getUTCDay() + 6) % 7;                   // 0 = lundi … 5 = samedi
/** Créneaux d'un jour : le samedi, seulement le matin. */
const creneauxDu = (st, date) => (jourIdx(date) === 5 ? creneauxActifs(st).filter(p => P_MATIN.includes(p) && p !== 7) : creneauxActifs(st));   // samedi : M1 à M4
/** Jours de cours de la semaine : du lundi au vendredi, ou au samedi. */
const nbJours = st => (st && st.samedi ? 6 : 5);
const DU_SOIR = p => P_APREM.includes(p);
/* ---------- horaires : calculés (début du matin, de l'après-midi, durée d'un cours, interclasse), ajustables créneau par créneau,
   et pour certains jours : décalés de quelques minutes ou entièrement libres ---------- */
const enMin = h => (/^\d\d:\d\d$/.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
const enHeure = m => (m === null || m === undefined || !isFinite(m) ? "" : `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`);
// récréations : durée (0 = aucune) et créneau après lequel elle a lieu (M2 le matin, S2 l'après-midi)
const HORAIRES_BASE = { matin: "08:00", aprem: "13:30", duree: 55, inter: 0, recreMatin: 15, recreMatinApres: 1, recreAprem: 15, recreApremApres: 5 };
/** Horaires de la semaine type : pour chaque créneau { debut, fin } ("HH:MM"), et si chacun est calculé (auto) ou tapé. */
function horairesType(st) {
  const b = st.horairesBase || HORAIRES_BASE, out = [];
  const chaine = (ps, depart, recre, apres) => { let fin = null; for (const p of ps) { const o = (st.horaires || [])[p] || {};
    const deb = o.debut ? enMin(o.debut) : fin === null ? enMin(depart) : fin + b.inter, f = o.fin ? enMin(o.fin) : deb === null ? null : deb + b.duree;
    out[p] = { debut: enHeure(deb), fin: enHeure(f), autoDebut: !o.debut, autoFin: !o.fin }; fin = f === null ? null : f + (p === apres ? recre - b.inter : 0); } };   // la récréation remplace l'interclasse
  chaine(P_MATIN, b.matin, b.recreMatin || 0, b.recreMatinApres); chaine(P_APREM, b.aprem, b.recreAprem || 0, b.recreApremApres);
  return out;
}
/** Horaires probables d'un collège : une séance dure de 45 à 60 min (un cours de 1 h 50 ou 2 h, ce sont deux séances),
    la journée tient entre 7 h et 18 h 30, les séances se suivent sans se chevaucher. */
const HORAIRES_LIMITES = { duree: [45, 60], inter: [0, 10], recre: [0, 30], decalage: [-60, 60], matin: ["07:00", "10:00"], aprem: ["11:30", "15:00"], seance: [40, 60], jour: ["07:00", "18:30"] };
function horairesIncoherents(st) {
  const L = HORAIRES_LIMITES, ps = creneauxActifs(st).filter(p => ORDRE_P.includes(p)), jours = [-1, ...[...Array(st.samedi ? 6 : 5).keys()]];
  for (const jd of jours) { const h = jd < 0 ? horairesType(st) : horairesJour(st, jd), qui = jd < 0 ? "" : DAYS[jd] + " ";
    let fin = null, finP = "";
    for (const p of ORDRE_P.filter(x => ps.includes(x))) { const o = h[p]; if (!o || !o.debut || !o.fin) continue;
      const d = enMin(o.debut), f = enMin(o.fin), n = PERIODS[p];
      if (f - d < L.seance[0] || f - d > L.seance[1]) return `${qui}${n} : une séance dure de ${L.seance[0]} à ${L.seance[1]} min (ici ${f - d} min). Un cours de 1 h 50 ou de 2 h, ce sont deux séances : mettez la matière sur deux créneaux.`;
      if (d < enMin(L.jour[0]) || f > enMin(L.jour[1])) return `${qui}${n} : les cours ont lieu entre 7 h et 18 h 30 (ici ${o.debut}–${o.fin}).`;
      if (fin !== null && d < fin) return `${qui}${n} commence avant la fin de ${finP} (${enHeure(fin)}) : les séances se chevauchent.`;
      fin = f; finP = n; } }
  return "";
}
/** Horaires d'un jour de la semaine (0 = lundi … 5 = samedi) : la semaine type, décalée de quelques minutes, ou libre. */
function horairesJour(st, jd) {
  const t = horairesType(st), j = jd >= 0 && (st.horairesJours || [])[jd];
  if (!j || !j.mode) return t;
  if (j.mode === "decale") return t.map((h, p) => (j.matinSeul && !P_MATIN.includes(p) ? h : { ...h, debut: enHeure(enMin(h.debut) + j.decalage), fin: enHeure(enMin(h.fin) + j.decalage) }));
  return t.map((h, p) => { const l = (j.libre || [])[p] || {}; return { ...h, debut: l.debut || h.debut, fin: l.fin || h.fin }; });
}
const NB_ELEVES_DEFAUT = 4, MAX_ELEVES = 12, NB_OBJ = 4, MAX_OBJ = 8, NB_NIV = 4, MAX_SEMAINES = 53;
/** Nombre d'objectifs observables du suivi (de 1 à MAX_OBJ, 4 par défaut). */
function nbObj(st) { return st.objectifs.length; }

/** Champs disciplinaires — les mêmes que Suivi PP (ses « domaines » : mêmes clés, mêmes libellés), pour que les deux applications
    rangent les matières de la même façon (2026-10-10, demande de l'utilisateur). Une matière porte `champ` seulement s'il a été
    CHOISI (réglages, ou reçu de Suivi PP) ; sinon il se déduit de son nom (`champDefaut`). */
const CHAMPS = [["langues", "Langues"], ["lettres", "Lettres et humanités"], ["sciences", "Sciences"], ["arts", "Arts"], ["eps", "EPS"], ["autre", "Autre"]];
const CHAMPS_CLES = CHAMPS.map(c => c[0]);
/* l'EPS avant les sciences : « Éd. physique » contient PHYSIQUE */
const CHAMPS_MOTIFS = [[/\bEPS\b|SPORT|\bED(UCATION)? PHYSIQUE\b/, "eps"],
  [/ALLEMAND|ANGLAIS|ESPAGNOL|ITALIEN|PORTUGAIS|ARABE|CHINOIS|RUSSE|HEBREU|BRETON|OCCITAN|ALSACIEN|\bLV ?\d|\bLCE\b|LANGUE|\bDNL\b|BILINGUE/, "langues"],
  [/FRANCAIS|\bHIST|\bGEO|\bEMC\b|RELIGI|CATECH|PASTORAL|CULTURE CHRETIENNE|LATIN|\bGREC|\bLCA\b|PHILO/, "lettres"],
  [/\bMATH|CHIMIE|PHYSIQUE|\bSVT\b|SCIENCE|TECHNO|BIOLOGIE|INFORMATIQUE|\bSNT\b/, "sciences"],
  [/\bARTS?\b|PLASTIQUE|MUSI|CHANT|CHORALE|THEATRE|CINEMA|DANSE/, "arts"]];
function champDefaut(nom) {
  const n = String(nom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  for (const [re, c] of CHAMPS_MOTIFS) if (re.test(n)) return c;
  return "autre";
}
/** Le champ d'une matière (objet de S.matieres) : choisi, sinon déduit du nom. */
function champDe(m) { return m && CHAMPS_CLES.includes(m.champ) ? m.champ : champDefaut(m && m.nom); }
function libChamp(c) { return (CHAMPS.find(x => x[0] === c) || CHAMPS[CHAMPS.length - 1])[1]; }
/** Les matières rangées par champ (dans l'ordre de CHAMPS), et dans l'ordre de la liste à l'intérieur d'un champ :
    [{ champ, label, items: [{ m, i }] }], champs vides omis. `i` = l'index dans st.matieres (les data-path s'y réfèrent). */
function matieresParChamp(st, filtre) {
  const g = CHAMPS.map(([champ, label]) => ({ champ, label, items: [] }));
  st.matieres.forEach((m, i) => { if (!filtre || filtre(m)) g[CHAMPS_CLES.indexOf(champDe(m))].items.push({ m, i }); });
  return g.filter(x => x.items.length);
}
/** Les noms des matières dans l'ordre d'affichage (par champ). */
function ordreMatieres(st) { return matieresParChamp(st).flatMap(g => g.items.map(x => x.m.nom)); }

const DEFAULTS = {
  matieres: ["Français", "Mathématiques", "Hist.-Géo.", "Anglais", "Allemand", "Espagnol", "SVT", "Physique-Chimie",
    "Technologie", "Arts Plastiques", "Éd. Musicale", "Éd. Religieuse", "EPS", "Latin", "Vie de classe", "Devoirs faits"],
  objectifs: [
    ["Rester concentré et calme", "écoute des consignes, pas de bavardage, posture de travail, pas de distractions volontaires."],
    ["Participer et s’impliquer", "réalise les tâches demandées, participe à l’oral, travail complet et soigné, efforts réguliers."],
    ["Ne pas perturber les autres", "contribue à une ambiance sereine, ne pas « faire le clown »."],
    ["Être respectueux", "pas d’insolence, ton correct, politesse."]],
  codage: [["TB", "Très bien"], ["S", "Satisfaisant"], ["À", "À améliorer"], ["I", "Insuffisant"]],
  consignes: [
    ["Élève responsable → référent, le soir", "L’élève responsable transporte la fiche entre les cours, la fait remplir par chaque enseignant, puis la remet à [référent] en fin de journée."],
    ["Délégué de classe → référent, le soir", "Le délégué de classe transporte la fiche entre les cours, la fait remplir par chaque enseignant, puis la remet à [référent] en fin de journée."],
    ["Vie scolaire matin et soir", "L’élève responsable récupère la fiche à la vie scolaire en début de journée, la fait remplir par chaque enseignant, puis la rapporte à la vie scolaire en fin de journée."],
    ["Casier du référent, le soir", "L’élève responsable fait remplir la fiche à la fin de chaque cours, puis la dépose dans le casier de [référent] en fin de journée."],
    ["Référent, le lendemain matin", "L’élève responsable fait remplir la fiche à chaque cours et la remet à [référent] le lendemain matin, avant la première heure."],
    ["Personnalisée", ""]],
  // Calendrier scolaire zone B 2026-2027 (académie de Strasbourg) + jours fériés (Alsace-Moselle)
  vacances: [["Toussaint", "2026-10-17", "2026-11-02"], ["Noël", "2026-12-19", "2027-01-04"],
    ["Hiver", "2027-02-20", "2027-03-08"], ["Printemps", "2027-04-17", "2027-05-03"]],
  joursSansCours: [["Armistice", "2026-11-11"], ["Vendredi saint (Alsace-Moselle)", "2027-03-26"],
    ["Lundi de Pâques", "2027-03-29"], ["Ascension", "2027-05-06"], ["Pont de l’Ascension", "2027-05-07"],
    ["Lundi de Pentecôte", "2027-05-17"]],
};

function emptyEdt() {
  return Object.fromEntries(["A", "B"].map(t => [t, DAYS.map(() => PERIODS.map(() => ({ mat: "", salle: "" })))]));   // 6 jours × 9 créneaux, même s'ils ne servent pas tous
}

/** Identifiant d'un suivi : sert à reconnaître le même suivi ouvert dans deux onglets. */
/* ---------- fiche de classe et suivis individuels ---------- */
const MAX_CLASSE = 40, MAX_IND_OBJ = 4;
/** Codes d'incident de la fiche de classe (un caractère) ; « A » = absent, toujours disponible. */
const CODES_CLASSE_DEFAUT = [["B", "bavardage"], ["T", "travail non fait"], ["M", "matériel oublié"], ["R", "retard"], ["C", "comportement"], ["+", "encouragement"]];
const CODE_ABSENT = "A";
/** Codes réellement utilisables (ceux des réglages, plus « A » absent). */
const codesClasse = st => [...st.codesClasse.map(c => c.code).filter(Boolean), CODE_ABSENT];
/** Code positif (encouragement, félicitations…) : réglé pour chaque code de la fiche de classe ; il ne compte pas comme incident. */
/** Niveaux au clavier, comme pour les compétences : 1 = le plus faible (I) … 4 = le meilleur (TB), 0 = non évalué (case vidée).
    Renvoie le rang du code (0 = TB … 3 = I), null pour 0, undefined si la touche n'est pas un niveau. AZERTY sans Maj : & é " ' et à. */
const AZERTY_NIV = { "&": 1, "é": 2, '"': 3, "'": 4, "à": 0 };
function niveauTouche(key) { const n = /^[0-4]$/.test(key) ? Number(key) : AZERTY_NIV[key]; return n === undefined ? undefined : n === 0 ? null : 4 - n; }
const toucheNiveau = i => 4 - i;           // touche du code de rang i : TB → 4, S → 3, À → 2, I → 1
/** Infobule : prévient quand un chiffre repose sur trop peu de données (la couleur est gardée, mais à lire avec prudence). */
const peuDe = (n, unite, mini = 5) => (n && n < mini ? `\n• ⚠ seulement ${n} ${unite} : peu de données, à lire avec prudence` : "");
/** Élève de la classe présent dans la classe ce jour-là (arrivée et départ en cours d'année). */
const presentClasse = (e, d) => !!e && (!e.debut || d >= e.debut) && (!e.fin || d <= e.fin);
const MAX_INDIV = 40;              // suivis individuels au plus (une classe entière)
const codePositif = c => { const l = typeof S !== "undefined" && S && S.codesClasse; const x = l && l.find(k => k.code === c); return x ? !!x.positif : c === "+"; };
/** Consigne imprimée sur les fiches individuelles : [référent] et [jour] (jour de remise) sont remplacés. */
/** Banque d'objectifs types pour les suivis individuels (formulés du point de vue de l'élève), à choisir puis adapter. */
const BANQUE_OBJ_DEFAUT = [
  ["Mise au travail", "Je commence le travail dès la consigne donnée."], ["Mise au travail", "Je termine le travail demandé en classe."],
  ["Mise au travail", "Je reste concentré(e) jusqu’à la fin de l’activité."], ["Mise au travail", "Je demande de l’aide quand je ne comprends pas."],
  ["Mise au travail", "Je note les devoirs dans mon agenda."],
  ["Matériel", "J’ai mon matériel (cahier, trousse, livre)."], ["Matériel", "Je sors mes affaires dès le début du cours."], ["Matériel", "Je fais signer les documents demandés."],
  ["Prise de parole", "Je lève la main pour prendre la parole."], ["Prise de parole", "J’attends mon tour pour parler."], ["Prise de parole", "Je participe à l’oral au moins une fois par cours."],
  ["Comportement en classe", "Je reste assis(e) à ma place pendant le cours."], ["Comportement en classe", "Je ne bavarde pas pendant les consignes."],
  ["Comportement en classe", "Je laisse mes camarades travailler."], ["Comportement en classe", "J’arrive à l’heure en cours."],
  ["Comportement en classe", "Mon téléphone reste éteint dans mon sac."],
  ["Respect", "Je parle poliment aux adultes."], ["Respect", "Je parle poliment à mes camarades."], ["Respect", "J’accepte une remarque d’un adulte sans contester."],
  ["Respect", "Je garde mon calme quand je suis contrarié(e)."], ["Respect", "Je respecte le matériel et les locaux."]];
/** Courriel à la famille : [élève], [période], [référent], [classe], [établissement] sont remplacés. */
const COURRIEL_INDIV_DEFAUT = { objet: "Suivi de [élève] – bilan [période]", texte: "Bonjour,\n\nVoici le bilan du suivi de [élève] pour la période [période].\n\n[bilan]\n\nBien cordialement,\n[référent]" };
/** Modèles de consigne des fiches individuelles : [intitulé, texte] ; une ligne par phrase sur la fiche. */
const CONSIGNES_INDIV_DEFAUT = [
  ["Présenter et récupérer, remise au professeur principal", "À présenter à chaque enseignant en début de cours et à récupérer auprès de lui à la fin du cours.\nÀ déposer chez [référent] le [jour] en fin de journée (casier ou vie scolaire) : la famille reçoit le bilan par courriel, une nouvelle fiche est donnée le [reprise] matin."],
  ["Sur le bureau de l’enseignant", "Je pose ma fiche sur le bureau de l’enseignant en début de cours et je la reprends à la fin du cours.\nJe la dépose chez [référent] le [jour] avant de partir ; je reçois une nouvelle fiche le [reprise] matin."],
  ["Remise à la vie scolaire", "À présenter à chaque enseignant en début de cours et à récupérer auprès de lui à la fin du cours.\nÀ remettre à la vie scolaire le [jour] en fin de journée ; [référent] envoie le bilan à la famille par courriel."],
  ["Signature des parents", "À présenter à chaque enseignant en début de cours et à récupérer auprès de lui à la fin du cours.\nÀ faire signer par mes parents chaque soir et à rendre à [référent] le [jour]."],
  ["Courte", "À présenter en début de cours, à récupérer en fin de cours. À rendre à [référent] le [jour]."]];
/* ---------- calendrier scolaire officiel (métropole) : vacances par zone, pont de l'Ascension ; [début (samedi), reprise] ----------
   Sources : arrêtés du calendrier scolaire (2025-2026, 2026-2027, 2027-2028). Année = celle de la rentrée. */
const CALENDRIERS = {
  2025: { rentree: "2025-09-01", ete: "2026-07-04", toussaint: ["2025-10-18", "2025-11-03"], noel: ["2025-12-20", "2026-01-05"], pont: ["2026-05-15"],
    hiver: { A: ["2026-02-07", "2026-02-23"], B: ["2026-02-14", "2026-03-02"], C: ["2026-02-21", "2026-03-09"] },
    printemps: { A: ["2026-04-04", "2026-04-20"], B: ["2026-04-11", "2026-04-27"], C: ["2026-04-18", "2026-05-04"] } },
  2026: { rentree: "2026-09-01", ete: "2027-07-03", toussaint: ["2026-10-17", "2026-11-02"], noel: ["2026-12-19", "2027-01-04"], pont: ["2027-05-07"],
    hiver: { A: ["2027-02-13", "2027-03-01"], B: ["2027-02-20", "2027-03-08"], C: ["2027-02-06", "2027-02-22"] },
    printemps: { A: ["2027-04-10", "2027-04-26"], B: ["2027-04-17", "2027-05-03"], C: ["2027-04-03", "2027-04-19"] } },
  2027: { rentree: "2027-09-02", ete: "2028-07-05", toussaint: ["2027-10-23", "2027-11-08"], noel: ["2027-12-18", "2028-01-03"], pont: ["2028-05-26"],
    hiver: { A: ["2028-02-19", "2028-03-06"], B: ["2028-02-05", "2028-02-21"], C: ["2028-02-12", "2028-02-28"] },
    printemps: { A: ["2028-04-22", "2028-05-09"], B: ["2028-04-08", "2028-04-24"], C: ["2028-04-15", "2028-05-02"] } } };
/** Année scolaire d'une date (année de la rentrée : à partir d'août). */
/** Écart en points : « +1 pt », « −12 pts », « 0 pt » (vrai signe moins). */
/** « 1 élève », « 3 élèves » (pluriel régulier en s, sinon donné). */
const nbMot = (n, s, p = s + "s") => `${n} ${Math.abs(n) > 1 ? p : s}`;
const ptsTxt = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} pt${Math.abs(n) > 1 ? "s" : ""}`;
/* ---------- trimestres ou semestres : découpage de l'année pour les synthèses et les bilans ---------- */
const DECOUPAGE = { trimestres: ["1er trimestre", "2e trimestre", "3e trimestre"], semestres: ["1er semestre", "2e semestre"] };
/** Fins proposées : trimestres avant les vacances de Noël et de printemps ; 1er semestre jusqu'au dernier vendredi de janvier. */
function finsDecoupageAuto(st) {
  const an = st.anneeScolaire || anneeScolaireDe(st.debut || aujourdhuiISO()), veille = v => v && v.debut ? addDays(v.debut, -1) : "";
  if ((st.decoupage || {}).mode === "trimestres") {
    const noel = st.vacances.find(v => v.debut && v.debut.slice(5, 7) === "12"), print = st.vacances.find(v => v.debut && v.debut.slice(5, 7) === "04" && v.debut.slice(0, 4) === String(an + 1));
    return [veille(noel) || `${an}-12-18`, veille(print) || `${an + 1}-04-03`]; }
  let d = `${an + 1}-01-31`; while (jourIdx(d) !== 4) d = addDays(d, -1); return [d];
}
/** Les trimestres ou semestres de l'année : [{ lib, du, au }] (le dernier va jusqu'à la fin du suivi). */
function periodesAnnee(st) {
  const libs = DECOUPAGE[(st.decoupage || {}).mode] || DECOUPAGE.semestres, auto = finsDecoupageAuto(st), fins = libs.slice(0, -1).map((_, k) => ((st.decoupage || {}).fins || [])[k] || auto[k]);
  return libs.map((lib, k) => ({ lib, du: k ? addDays(fins[k - 1], 1) : (st.debut || ""), au: k < fins.length ? fins[k] : (st.fin || "9999-12-31") }));
}
/** Semaines (indices) de chaque trimestre ou semestre qui a commencé : [lib, [a, b]]. */
function periodesDecoupage(st, sems, today = aujourdhui()) {
  const ref = sems.length && today < sems[0].lundi ? "9999-12-31" : today;      // suivi pas encore commencé (démonstration…) : toutes
  // chaque semaine appartient à une seule période : celle où tombe son lundi (la 1re période prend aussi les semaines d'avant)
  const pa = periodesAnnee(st), per = w => Math.max(0, pa.map(p => p.du <= w.lundi).lastIndexOf(true));
  return pa.map((p, k) => [p, k]).filter(([p]) => p.du <= ref && p.du <= p.au).map(([p, k]) => [p.lib, [sems.findIndex(w => per(w) === k), sems.map(w => per(w) === k).lastIndexOf(true)]]).filter(([, [a, b]]) => a >= 0 && b >= a);
}
const anneeScolaireDe = d => (Number(d.slice(5, 7)) >= 8 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1);
/** Vacances d'une année scolaire pour une zone (null si le calendrier officiel n'est pas connu de l'application). */
function vacancesAnnee(an, zone) { const c = CALENDRIERS[an]; if (!c) return null; const z = ["A", "B", "C"].includes(zone) ? zone : "B";
  return [["Toussaint", ...c.toussaint], ["Noël", ...c.noel], ["Hiver", ...c.hiver[z]], ["Printemps", ...c.printemps[z]]].map(([label, debut, reprise]) => ({ label, debut, reprise })); }
/** Pâques (calendrier grégorien). */
function paques(an) { const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
  i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${an}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`; }
/** Jours fériés et pont d'une année scolaire (de septembre an à juillet an+1), du lundi au vendredi ; Vendredi saint en Alsace-Moselle. */
function feriesAnnee(an, alsace = true) { const p = paques(an + 1), c = CALENDRIERS[an];
  return [["Armistice", `${an}-11-11`], ...(alsace ? [["Vendredi saint (Alsace-Moselle)", addDays(p, -2)]] : []), ["Lundi de Pâques", addDays(p, 1)], ["Fête du travail", `${an + 1}-05-01`], ["Victoire 1945", `${an + 1}-05-08`],
    ["Ascension", addDays(p, 39)], ...(c ? c.pont : [addDays(p, 40)]).map(d => ["Pont de l’Ascension", d]), ["Lundi de Pentecôte", addDays(p, 50)]]
    .filter(([, d]) => jourIdx(d) <= 4).map(([label, date]) => ({ label, date })); }
function nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/** Début : lundi de cette semaine (lundi suivant à partir du jeudi) ; fin : fin de l’année scolaire. */
function periodeParDefaut() {
  const n = new Date(), jour = (n.getDay() + 6) % 7;            // 0 = lundi
  const l = new Date(n.getFullYear(), n.getMonth(), n.getDate() - jour + (jour >= 3 ? 7 : 0));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const debut = iso(l), an = l.getFullYear();
  const as = l.getMonth() >= 7 ? an : an - 1, c = CALENDRIERS[as];
  return { debut, fin: c ? addDays(c.ete, -1) : `${as + 1}-07-03` };   // jusqu’aux vacances d’été : les fiches de classe et individuelles en dépendent aussi
}
/** Seuils des pastilles, en % de réussite (réglables, enregistrés avec le suivi) : rouge sous « rouge », orange sous « orange »,
    vert clair à partir de « vert », vert foncé à partir de « vertFonce ». Toujours rouge ≤ orange ≤ vert ≤ vert foncé. */
const SEUILS_DEFAUT = { rouge: 60, orange: 80, vert: 90, vertFonce: 95 };
function seuils(st) {
  const s = (st && st.seuils) || {}, ent = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== "" && v != null ? Math.min(100, Math.max(0, n)) : d; };
  const rouge = ent(s.rouge, SEUILS_DEFAUT.rouge), orange = Math.max(rouge, ent(s.orange, SEUILS_DEFAUT.orange));
  const vert = Math.max(orange, ent(s.vert, SEUILS_DEFAUT.vert));
  return { rouge, orange, vert, vertFonce: Math.max(vert, ent(s.vertFonce, SEUILS_DEFAUT.vertFonce)) };
}
/** Niveau d'affichage d'une réussite v (0 à 1) : "r" rouge, "o" orange, "" rien, "v" vert clair, "vf" vert foncé.
    Jamais de vert s'il y a au moins une croix « I » (niveau 4) : la gravité passe avant le pourcentage. */
function niveauReussite(st, v, nbI) {
  const a = pctArrondi(v);
  if (a == null) return "";
  const t = seuils(st);
  if (a < t.rouge) return "r";
  if (a < t.orange) return "o";
  if (nbI) return "";
  return a >= t.vertFonce ? "vf" : a >= t.vert ? "v" : "";
}
/** Nombre de croix « I » dans une liste de compteurs [TB, S, À, I] (objectifs d'un élève, du groupe…). */
const nbIde = obs => obs.reduce((a, ob) => a + ob.sem[3], 0);
function newState() {
  return {
    app: "fiche-suivi-collective", version: APP_VERSION, id: nouvelId(),
    classe: "", referent: "",
    ...periodeParDefaut(), typeDebut: "A", typesForces: {},
    vacances: vacancesAnnee(anneeScolaireDe(periodeParDefaut().debut), "B") || DEFAULTS.vacances.map(([label, debut, reprise]) => ({ label, debut, reprise })),
    zone: "B", alsaceMoselle: true, anneeScolaire: anneeScolaireDe(periodeParDefaut().debut), decoupage: { mode: "semestres", fins: [] },
    joursSansCours: feriesAnnee(anneeScolaireDe(periodeParDefaut().debut), true),
    eleves: Array.from({ length: NB_ELEVES_DEFAUT }, () => ({ nom: "", debut: "", fin: "" })),
    consignes: DEFAULTS.consignes.map(([label, texte]) => ({ label, texte })), consigneChoisie: 0,
    codage: DEFAULTS.codage.map(([code, sens]) => ({ code, sens })), seuils: { ...SEUILS_DEFAUT },
    horaires: PERIODS_N.map(() => ({ debut: "", fin: "" })),
    groupes: [], classeEleves: [], codesClasse: CODES_CLASSE_DEFAUT.map(([code, sens]) => ({ code, sens, positif: code === "+" })), individuels: [], consignesIndiv: CONSIGNES_INDIV_DEFAUT.map(([label, texte]) => ({ label, texte })), consigneIndivChoisie: 0, retenueClasse: { remarques: 3, heures: 1, positifAnnule: true }, seuilBilanClasse: 30, pastillesVertes: false, etablissement: { nom: "", logo: "" }, creneauMidi: false, creneauS4: false, creneauS5: false, samedi: false, horairesBase: { ...HORAIRES_BASE }, horairesJours: DAYS.map((_, d) => ({ mode: d === 2 ? "decale" : "", decalage: d === 2 ? 30 : 0, matinSeul: d === 2, libre: PERIODS.map(() => ({ debut: "", fin: "" })) })), /* comme au collège : le mercredi matin décalé de 30 min */ absencesProf: [], edtSuivants: [], changementsProf: [], remiseIndiv: 5, finSuiviIndiv: { seuil: 90, fiches: 3, sansI: true }, courrielIndiv: { ...COURRIEL_INDIV_DEFAUT }, banqueObjectifs: BANQUE_OBJ_DEFAUT.map(([groupe, texte]) => ({ groupe, texte })),
    objectifs: DEFAULTS.objectifs.map(([court, desc]) => ({ court, desc })),
    matieres: DEFAULTS.matieres.map(nom => ({ nom, prof: "" })),
    edt: emptyEdt(),
    jours: {},   // "AAAA-MM-JJ" -> { x: {"élève.objectif.créneau": niveau}, com: {élève: texte}, mat: {créneau: matière}, salle: {créneau: salle} }
  };
}

/** Complète et assainit un état chargé (fichier partiel ou modifié à la main) : types, bornes, valeurs par défaut. */
function normalizeState(st) {
  const def = newState();
  if (!st || typeof st !== "object" || Array.isArray(st)) st = {};
  const str = v => (v == null ? "" : String(v));
  const date = v => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(parseD(v)) && isoD(parseD(v)) === v ? v : "");   // pas de « 2026-13-45 »
  const ab = v => (v === "A" || v === "B" ? v : "");
  const arr = v => (Array.isArray(v) ? v : []);
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const out = def;
  out.classe = str(st.classe); out.referent = str(st.referent);
  { const dc = obj(st.decoupage); out.decoupage = { mode: dc.mode === "trimestres" ? "trimestres" : "semestres", fins: arr(dc.fins).slice(0, 2).map(x => date(x) || "") }; }   /* trimestres ou semestres */
  out.zone = ["A", "B", "C"].includes(st.zone) ? st.zone : "B"; out.alsaceMoselle = st.alsaceMoselle !== false;   // zone des vacances, jours fériés d'Alsace-Moselle
  out.anneeScolaire = Number.isInteger(st.anneeScolaire) && st.anneeScolaire > 2000 && st.anneeScolaire < 2100 ? st.anneeScolaire : anneeScolaireDe(date(st.debut) || periodeParDefaut().debut);
  out.creneauMidi = st.creneauMidi === true; out.creneauS4 = st.creneauS4 === true; out.creneauS5 = st.creneauS5 === true; out.samedi = st.samedi === true;   // créneaux et jours en plus
  { const b = obj(st.horairesBase), n = (v, a, z, d) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Math.min(z, Math.max(a, Math.round(Number(v)))) : d), t = v => (/^\d\d:\d\d$/.test(str(v)) ? str(v) : "");
    out.horairesBase = { matin: t(b.matin) || HORAIRES_BASE.matin, aprem: t(b.aprem) || HORAIRES_BASE.aprem, duree: n(b.duree, 45, 60, HORAIRES_BASE.duree), inter: n(b.inter, 0, 10, HORAIRES_BASE.inter),
      recreMatin: n(b.recreMatin, 0, 30, HORAIRES_BASE.recreMatin), recreMatinApres: P_MATIN.includes(Number(b.recreMatinApres)) ? Number(b.recreMatinApres) : HORAIRES_BASE.recreMatinApres,
      recreAprem: n(b.recreAprem, 0, 30, HORAIRES_BASE.recreAprem), recreApremApres: P_APREM.includes(Number(b.recreApremApres)) ? Number(b.recreApremApres) : HORAIRES_BASE.recreApremApres };
    out.horairesJours = DAYS.map((_, d) => { const j = obj(arr(st.horairesJours)[d]), m = ["decale", "libre"].includes(j.mode) ? j.mode : "";
      return { mode: m, decalage: n(j.decalage, -60, 60, 0), matinSeul: j.matinSeul === true, libre: PERIODS.map((_, p) => { const l = obj(arr(j.libre)[p]); return { debut: t(l.debut), fin: t(l.fin) }; }) }; }); }
  const nomProf = v => str(v).trim().replace(/\s+/g, " ").slice(0, 80);   /* « Mme  SOLE » = « Mme SOLE » : les absences sont reliées par le nom */
  out.absencesProf = arr(st.absencesProf).slice(0, 60).map(a0 => { const a = obj(a0), du = date(a.du), au = date(a.au), inv = du && au && au < du;   /* dates inversées (fichier) : remises dans l'ordre */
    return { prof: nomProf(a.prof), du: inv ? au : du, au: inv ? du : au, remplacant: nomProf(a.remplacant) }; });
  { const e = obj(st.etablissement), l = e.logo;          // nom et logo de l'établissement (image collée, en data URL)
    out.etablissement = { nom: str(e.nom).slice(0, 150), ...(e.sansNom === true ? { sansNom: true } : {}), logo: typeof l === "string" && l.length < 2500000 && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(l) ? l : "" }; }
  if (typeof st.id === "string" && /^[a-z0-9]{4,24}$/.test(st.id)) out.id = st.id;
  out.demo = st.demo === true;
  /* polices (2026-10-10, celles de Suivi PP) : absentes = les défauts (Andika à l'écran, Latin Modern au papier) — rien n'est ajouté à un ancien suivi */
  if (st.policeEcran === "lm") out.policeEcran = "lm";
  if (st.policePapier === "andika") out.policePapier = "andika";
  if ("debut" in st) out.debut = date(st.debut);
  if ("fin" in st) out.fin = date(st.fin);
  out.typeDebut = ab(st.typeDebut) || "A";
  if (Array.isArray(st.vacances)) out.vacances = st.vacances.map(v => ({ label: str(obj(v).label), debut: date(obj(v).debut), reprise: date(obj(v).reprise) }));
  if (Array.isArray(st.joursSansCours)) out.joursSansCours = st.joursSansCours.map(v => { const r = { label: str(obj(v).label), date: date(obj(v).date) }; if (["matin", "apresmidi"].includes(obj(v).moment)) r.moment = obj(v).moment; return r; });
  if (Array.isArray(st.consignes) && st.consignes.length) out.consignes = st.consignes.map(c => ({ label: str(obj(c).label), texte: str(obj(c).texte) }));
  out.consigneChoisie = Math.min(Math.max(0, Math.floor(Number(st.consigneChoisie) || 0)), out.consignes.length - 1);
  out.seuils = seuils(st);
  out.codage = def.codage.map((d, i) => { const c = obj(arr(st.codage)[i]); return { code: "code" in c ? str(c.code) : d.code, sens: "sens" in c ? str(c.sens) : d.sens }; });
  // objectifs : de 1 à MAX_OBJ ; une ancienne sauvegarde (4 objectifs) est complétée par les valeurs par défaut
  const srcObj = arr(st.objectifs).slice(0, MAX_OBJ);
  out.objectifs = (srcObj.length ? srcObj : def.objectifs).map((c0, i) => { const c = obj(c0), d = def.objectifs[i] || { court: "", desc: "" };
    return { court: "court" in c ? str(c.court) : d.court, desc: "desc" in c ? str(c.desc) : d.desc }; });
  if (Array.isArray(st.matieres)) out.matieres = st.matieres.map(m => ({ nom: str(obj(m).nom), prof: str(obj(m).prof).trim().replace(/\s+/g, " "), ...(CHAMPS_CLES.includes(obj(m).champ) ? { champ: obj(m).champ } : {}) }));
  let el = arr(st.eleves).map(e => ({ nom: str(obj(e).nom), debut: date(obj(e).debut), fin: date(obj(e).fin) }));
  out.eleves = el.length ? el.slice(0, MAX_ELEVES) : def.eleves;
  const normEdt = src => { const edt = emptyEdt();
    for (const t of ["A", "B"]) for (let d = 0; d < edt[t].length; d++) for (let p = 0; p < edt[t][d].length; p++) {
      const c = obj(arr(arr(src[t])[d])[p]); edt[t][d][p] = { mat: str(c.mat), salle: str(c.salle) };
      const g = arr(c.grp).map(x => ({ g: str(obj(x).g).trim(), mat: str(obj(x).mat), salle: str(obj(x).salle) })).filter((x, i, l) => x.g && x.mat && l.findIndex(y => y.g === x.g) === i);
      if (g.length) edt[t][d][p].grp = g;
    } return edt; };
  const edt = normEdt(obj(st.edt));
  // nouvel emploi du temps à partir d'une date (changement en cours d'année)
  out.edtSuivants = arr(st.edtSuivants).map(v => ({ depuis: date(obj(v).depuis), ...normEdt(obj(v)) })).filter((v, i, l) => v.depuis && l.findIndex(x => x.depuis === v.depuis) === i).sort((a, b) => (a.depuis < b.depuis ? -1 : 1)).slice(0, 20);
  // nouvel enseignant d'une matière à partir d'une date
  out.changementsProf = arr(st.changementsProf).slice(0, 60).map(c0 => { const c = obj(c0); return { mat: str(c.mat), depuis: date(c.depuis), prof: str(c.prof).trim().replace(/\s+/g, " ").slice(0, 80) }; });
  // groupes et options : demi-groupes, langues, options (un élève de la classe peut en avoir plusieurs)
  out.groupes = arr(st.groupes).map(x => ({ nom: str(typeof x === "string" ? x : obj(x).nom).trim() })).slice(0, 12);
  out.edt = edt;
  // horaires des créneaux M1…S3 : « HH:MM » ou vide
  const hh = v => (/^\d\d:\d\d$/.test(str(v)) ? str(v) : "");
  out.horaires = PERIODS_N.map((_, p) => { const h = obj(arr(st.horaires)[p]); return { debut: hh(h.debut), fin: hh(h.fin) }; });
  // fiche de classe : liste de toute la classe et codes d'incident
  const okP0 = p => /^[0-9]$/.test(p);   /* M1…S5, M5 compris */
  const nomsGr = new Set(out.groupes.map(g => g.nom).filter(Boolean));
  out.classeEleves = arr(st.classeEleves).slice(0, MAX_CLASSE).map(e => { const r = { nom: str(obj(e).nom) }, g = arr(obj(e).groupes).map(str).filter((x, i, l) => nomsGr.has(x) && l.indexOf(x) === i); if (g.length) r.groupes = g;
    const a = date(obj(e).debut), f = date(obj(e).fin); if (a) r.debut = a; if (f) r.fin = f; return r; });   // arrivée, départ en cours d'année
  const srcCodes = Array.isArray(st.codesClasse) ? st.codesClasse : CODES_CLASSE_DEFAUT.map(([code, sens]) => ({ code, sens }));
  out.codesClasse = srcCodes.map(c => { const code = str(obj(c).code).trim().slice(0, 1).toUpperCase(); return { code, sens: str(obj(c).sens), positif: obj(c).positif === undefined ? code === "+" : obj(c).positif === true }; }).filter((c, i, l) => c.code !== CODE_ABSENT && (!c.code || l.findIndex(x => x.code === c.code) === i)).slice(0, 10);
  const codesOk = new Set(codesClasse(out)), nbCl = out.classeEleves.length;
  // suivis individuels : objectifs propres, saisies par cours (« date.créneau » → codes 0-3 par objectif + remarque), bilan par semaine
  out.individuels = arr(st.individuels).slice(0, MAX_INDIV).map(i0 => { const i = obj(i0);
    const objectifs = arr(i.objectifs).map(str).slice(0, MAX_IND_OBJ); if (!objectifs.length) objectifs.push("");
    const saisies = {};
    for (const [k, v] of Object.entries(obj(i.saisies))) { const [d, p] = k.split("."); const e = obj(v);
      if (!date(d) || !okP0(p)) continue;
      const c = objectifs.map((_, o) => { const x = arr(e.c)[o]; return [0, 1, 2, 3].includes(x) ? x : null; });
      if (c.some(x => x !== null) || str(e.r).trim()) saisies[`${d}.${p}`] = { c, r: str(e.r) }; }
    const bilans = {}; for (const [l, t] of Object.entries(obj(i.bilans))) if (date(l) && str(t).trim()) bilans[l] = str(t);
    const remise = [1, 2, 3, 4, 5].includes(Number(i.remise)) ? Number(i.remise) : 0;     // jour de remise propre au suivi : 1 = lundi … 5 = vendredi ; 0 = celui des réglages
    return { id: str(i.id) || nouvelId(), nom: str(i.nom), objectifs, debut: date(i.debut), fin: date(i.fin), remise, courriel: str(i.courriel).trim(), saisies, bilans }; });
  out.consignesIndiv = (Array.isArray(st.consignesIndiv) && st.consignesIndiv.length ? st.consignesIndiv : CONSIGNES_INDIV_DEFAUT.map(([label, texte]) => ({ label, texte })))
    .slice(0, 20).map(c => ({ label: str(obj(c).label), texte: str(obj(c).texte) }));
  out.consigneIndivChoisie = Math.min(Math.max(0, Math.floor(Number(st.consigneIndivChoisie) || 0)), out.consignesIndiv.length - 1);
  { const r = obj(st.retenueClasse), n = (v, a, b, d) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Math.round(Number(v)))) : d;
    out.retenueClasse = { remarques: n(r.remarques, 0, 20, 3), heures: n(r.heures, 1, 4, 1), positifAnnule: r.positifAnnule !== false }; }
  // ancien réglage gardé dans le navigateur : repris une fois
  out.pastillesVertes = st.pastillesVertes === undefined ? (() => { try { return localStorage.getItem("fiche-suivi-collective-totaux-verts") === "1"; } catch (e) { return false; } })() : st.pastillesVertes === true;
  { const v = Number(st.seuilBilanClasse); out.seuilBilanClasse = st.seuilBilanClasse !== undefined && st.seuilBilanClasse !== "" && Number.isFinite(v) ? Math.min(300, Math.max(0, Math.round(v))) : 30; }
  out.remiseIndiv = [1, 2, 3, 4, 5].includes(Number(st.remiseIndiv)) ? Number(st.remiseIndiv) : 5;
  { const f = obj(st.finSuiviIndiv), n = (v, a, b, d) => Number.isFinite(Number(v)) && v !== "" && v !== null ? Math.min(b, Math.max(a, Math.round(Number(v)))) : d;
    out.finSuiviIndiv = { seuil: n(f.seuil, 50, 100, 90), fiches: n(f.fiches, 1, 10, 3), sansI: f.sansI !== false }; }
  out.banqueObjectifs = (Array.isArray(st.banqueObjectifs) ? st.banqueObjectifs : BANQUE_OBJ_DEFAUT.map(([groupe, texte]) => ({ groupe, texte })))
    .slice(0, 80).map(b => ({ groupe: str(obj(b).groupe), texte: str(obj(b).texte) }));
  const ci = obj(st.courrielIndiv);
  out.courrielIndiv = { objet: "objet" in ci ? str(ci.objet) : COURRIEL_INDIV_DEFAUT.objet, texte: "texte" in ci ? str(ci.texte) : COURRIEL_INDIV_DEFAUT.texte };
  // jours : chaque saisie est vérifiée (élève existant, objectif, créneau, niveau)
  const nb = out.eleves.length, okS = s => /^\d+$/.test(s) && Number(s) < nb, okP = p => /^[0-9]$/.test(p);
  out.jours = {};
  for (const [d, j0] of Object.entries(obj(st.jours))) {
    if (!date(d)) continue;
    const j = obj(j0), n = { x: {}, com: {}, mat: {}, salle: {}, prof: {}, abs: {}, profAbs: {}, cl: {}, clr: {} };
    if (str(j.clresp).trim()) n.clresp = str(j.clresp);
    for (const [k, v] of Object.entries(obj(j.cl))) { const [s, p] = k.split(".");
      if (!/^\d+$/.test(s) || Number(s) >= nbCl || !okP(p)) continue;
      const c = [...new Set([...str(v)].filter(x => codesOk.has(x)))].join(""); if (c) n.cl[`${Number(s)}.${p}`] = c; }
    for (const [k, v] of Object.entries(obj(j.clr))) { const m = /^(\d+)(?:\.([0-9]))?$/.exec(k);   // « élève » ou « élève.créneau »
      if (m && Number(m[1]) < nbCl && str(v).trim()) n.clr[m[2] === undefined ? Number(m[1]) : `${Number(m[1])}.${m[2]}`] = str(v); }
    for (const [k, v] of Object.entries(obj(j.x))) {
      const [s, o, p] = k.split(".");
      if (okS(s) && /^\d$/.test(o) && Number(o) < out.objectifs.length && okP(p) && [0, 1, 2, 3].includes(v)) n.x[`${Number(s)}.${o}.${p}`] = v;
    }
    for (const [s, v] of Object.entries(obj(j.com))) if (okS(s) && str(v).trim()) n.com[Number(s)] = str(v);
    for (const [p, v] of Object.entries(obj(j.mat))) if (okP(p)) n.mat[p] = str(v);
    for (const [p, v] of Object.entries(obj(j.salle))) if (okP(p)) n.salle[p] = str(v);
    for (const [p, v] of Object.entries(obj(j.prof))) if (okP(p) && str(v).trim()) n.prof[p] = str(v);
    for (const [p, v] of Object.entries(obj(j.profAbs))) if (okP(p) && v) n.profAbs[p] = true;
    for (const [s, v] of Object.entries(obj(j.abs))) {
      if (!okS(s)) continue;
      const l = (typeof v === "string" ? ABS_PRESETS[v] || [] : arr(v)).filter(p => Number.isInteger(p) && p >= 0 && p < NB_P);
      if (l.length) n.abs[Number(s)] = [...new Set(l)].sort((a, b) => a - b);
    }
    out.jours[d] = n;
  }
  // types de semaine forcés : indexés par le lundi
  out.typesForces = {};
  for (const [k, v] of Object.entries(obj(st.typesForces))) if (date(k) && ab(v)) out.typesForces[k] = v;
  // groupes : un seul par nom (« Groupe 1 » = « groupe 1 »), les élèves et l'emploi du temps suivent ; un élève dans un seul demi-groupe
  { const prem = new Map(), alias = new Map();
    out.groupes = out.groupes.filter(g => { if (!g.nom) return true; const k = cleNom(g.nom); if (prem.has(k)) { alias.set(g.nom, prem.get(k)); return false; } prem.set(k, g.nom); return true; });
    const a = n => alias.get(n) || n;
    for (const e of out.classeEleves) if (e.groupes) { const l = unSeulDemiGroupe([...new Set(e.groupes.map(a))]); if (l.length) e.groupes = l; else delete e.groupes; }
    if (alias.size) for (const E of toutesEdt(out)) for (const t of ["A", "B"]) for (const day of (E && E[t]) || []) for (const c of day || []) if (c && c.grp) c.grp = c.grp.map(x => ({ ...x, g: a(x.g) })); }
  out.version = APP_VERSION;
  for (const k of Object.keys(st)) if (!(k in out)) out[k] = st[k];   /* champ d'une version plus récente : gardé, pour ne rien perdre */
  return out;
}
/** Demi-groupe (« Groupe 1 », « Gr. 2 », « G3 », « groupe II ») : un élève n'est que dans un seul. Les options (latin, LV2…) se cumulent. */
const estDemiGroupe = n => /^(groupe|gr\.?|g)\s*(\d+|[ivx]+)$/i.test(String(n || "").trim());
const unSeulDemiGroupe = l => { let vu = false; return l.filter(g => !estDemiGroupe(g) || (!vu && (vu = true))); };

/* ---------- dates (chaînes ISO « AAAA-MM-JJ », calcul en UTC) ---------- */
function parseD(s) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function isoD(dt) { return dt.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return isoD(d); }
function isoWeek(s) {
  const d = parseD(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);          // jeudi de la semaine
  const t = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d - t) / (7 * 86400000));
}
const FMT_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });   // « lundi 2 novembre », « mardi 1er décembre »
const FMT_DM = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const FMT_DMY = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
function fmtLong(s) { return FMT_LONG.format(parseD(s)).replace(/^(\S+) 1 /, "$1 1er "); }
const memoDM = new Map();
function fmtDM(s) { let v = memoDM.get(s); if (v === undefined) { v = FMT_DM.format(parseD(s)); memoDM.set(s, v); } return v; }
const memoDMY = new Map();
function fmtDMY(s) { let v = memoDMY.get(s); if (v === undefined) { v = FMT_DMY.format(parseD(s)); memoDMY.set(s, v); } return v; }
function isMonday(s) { return parseD(s).getUTCDay() === 1; }

/* ---------- calendrier du suivi ---------- */
/** Vacances qui contiennent ce jour (le jour de reprise est un jour de classe). */
function vacancesDu(st, date) { return st.vacances.find(v => v.debut && v.reprise && v.debut <= date && date < v.reprise); }
/** Semaine sautée : ses cinq jours de classe sont tous dans des vacances. */
function enVacances(st, lundi) { return DAYS.slice(0, 5).every((_, d) => vacancesDu(st, addDays(lundi, d))); }
function horsPeriode(st, date) { return (st.debut && date < st.debut) || (st.fin && date > st.fin); }
/** Jour sans cours : férié ou banalisé, vacances (semaine partielle), avant le début ou après la fin du suivi. */
/** Créneaux du matin (M1…M4) et de l'après-midi (S1…). */
const DU_MATIN = p => P_MATIN.includes(p);
/** Demi-journée sans cours qui couvre ce créneau (sortie, conseil de classe…), sinon undefined. */
const demiJourneeOff = (st, date, p) => st.joursSansCours.find(j => j.date === date && (j.moment === "matin" ? DU_MATIN(p) : j.moment === "apresmidi" ? DU_SOIR(p) : false));
function sansCours(st, date) { return st.joursSansCours.some(j => j.date === date && !j.moment) || !!vacancesDu(st, date) || !!horsPeriode(st, date); }
function motifSansCours(st, date) {
  const j = st.joursSansCours.find(j => j.date === date && !j.moment); if (j) return j.label || "pas de cours";
  const v = vacancesDu(st, date); if (v) return "vacances" + (v.label ? " (" + v.label + ")" : "");
  return horsPeriode(st, date) ? "hors de la période du suivi" : "";
}

/** Semaines du suivi : lundis successifs, vacances sautées, types A/B en alternance (forçables). */
function semaines(st) {
  const out = [];
  if (!st.debut) return out;
  let lundi = st.debut;
  while (!isMonday(lundi)) lundi = addDays(lundi, -1);
  let prevType = null;
  const tf = st.typesForces || {};
  for (let i = 0; i < MAX_SEMAINES; i++) {
    if (i > 0) lundi = addDays(lundi, 7);
    let guard = 0; while (enVacances(st, lundi) && guard++ < 20) lundi = addDays(lundi, 7);
    if (st.fin && lundi > st.fin) break;
    const auto = i === 0 ? (st.typeDebut === "B" ? "B" : "A") : (prevType === "A" ? "B" : "A");
    let fixe = tf[lundi];
    if (fixe !== "A" && fixe !== "B") fixe = "";
    const type = fixe || auto;
    out.push({ i, lundi, type, num: isoWeek(lundi), forced: !!fixe,
      jours: DAYS.slice(0, nbJours(st)).map((_, d) => addDays(lundi, d)) });
    prevType = type;
  }
  return out;
}
function semaineDuJour(sems, date) { return sems.find(w => w.jours.includes(date)); }

/* ---------- élèves ---------- */
function nbBlocs(st) { return st.eleves.length; }

/** Ajout, suppression et déplacement d'élèves : les saisies (croix, commentaires, absences) suivent l'élève. */
function remapEleves(st, f) {          // f(ancien index) -> nouvel index, ou -1 pour supprimer
  for (const j of Object.values(st.jours)) {
    const x = {}; for (const [k, v] of Object.entries(j.x || {})) { const [s, o, p] = k.split("."); const n = f(Number(s)); if (n >= 0) x[`${n}.${o}.${p}`] = v; }
    j.x = x;
    for (const key of ["com", "abs"]) { const m = {}; for (const [s, v] of Object.entries(j[key] || {})) { const n = f(Number(s)); if (n >= 0) m[n] = v; } j[key] = m; }
  }
}
function donneesEleve(st, s) {
  return Object.values(st.jours).some(j => Object.keys(j.x || {}).some(k => k.startsWith(s + ".")) || (j.com && j.com[s]) || (j.abs && j.abs[s]));
}
function supprimerEleve(st, i) { st.eleves.splice(i, 1); remapEleves(st, s => (s === i ? -1 : s > i ? s - 1 : s)); }
/** Ajout, suppression et déplacement d'objectifs : les croix suivent leur objectif. */
function remapObjectifs(st, f) {      // f(ancien index) -> nouvel index, ou -1 pour supprimer
  for (const j of Object.values(st.jours)) {
    const x = {}; for (const [k, v] of Object.entries(j.x || {})) { const [s, o, p] = k.split("."); const n = f(Number(o)); if (n >= 0) x[`${s}.${n}.${p}`] = v; }
    j.x = x;
  }
}
function donneesObjectif(st, i) { return Object.values(st.jours).some(j => Object.keys(j.x || {}).some(k => k.split(".")[1] === String(i))); }
function supprimerObjectif(st, i) { st.objectifs.splice(i, 1); remapObjectifs(st, o => (o === i ? -1 : o > i ? o - 1 : o)); }
function deplacerObjectif(st, i, dir) {
  const k = i + dir; if (k < 0 || k >= st.objectifs.length) return;
  [st.objectifs[i], st.objectifs[k]] = [st.objectifs[k], st.objectifs[i]];
  remapObjectifs(st, o => (o === i ? k : o === k ? i : o));
}
function deplacerEleve(st, i, dir) {
  const k = i + dir; if (k < 0 || k >= st.eleves.length) return;
  [st.eleves[i], st.eleves[k]] = [st.eleves[k], st.eleves[i]];
  remapEleves(st, s => (s === i ? k : s === k ? i : s));
}

/* ---------- absences ---------- */
/* Absence d'un élève un jour donné : liste des créneaux (0 = M1 … 6 = S3). */
const ABS_PRESETS = { jour: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], matin: [0, 1, 2, 3, 7], aprem: [4, 5, 6, 8, 9] };
const ABS_LIBELLES = { jour: "absent(e) toute la journée", matin: "absent(e) le matin", aprem: "absent(e) l’après-midi" };
function absCreneaux(st, date, s) {
  const j = st.jours[date], a = j && j.abs && j.abs[s];
  return Array.isArray(a) ? a : typeof a === "string" ? (ABS_PRESETS[a] || []).slice() : [];
}
function absPreset(list) {           // "jour" | "matin" | "aprem" | "creneaux" | ""
  if (!list.length) return "";
  const k = list.slice().sort((a, b) => a - b).join(",");      // les anciennes listes (sans Midi ni S4) valent aussi
  return Object.keys(ABS_PRESETS).find(n => [ABS_PRESETS[n], ABS_PRESETS[n].filter(p => p < 7), ABS_PRESETS[n].filter(p => p < 9)].some(l => l.join(",") === k)) || "creneaux";
}
function absTexte(list, court) {
  const pr = absPreset(list);
  if (!pr) return "";
  if (pr !== "creneaux") return court ? { jour: "toute la journée", matin: "le matin (M1-M4)", aprem: "l’après-midi (S1-S3)" }[pr] : ABS_LIBELLES[pr];
  const per = list.slice().sort((a, b) => a - b).map(p => PERIODS[p]).join(", ");
  return court ? (list.length > 1 ? "créneaux " : "créneau ") + per : "absent(e) en " + per;
}
function eleveAbsent(st, date, s, p) { return absCreneaux(st, date, s).includes(p); }
/** Absence longue d'un enseignant (du … au …), avec un remplaçant éventuel ; undefined s'il n'est pas absent ce jour-là. */
const absenceLongue = (st, prof, date) => (prof ? (st.absencesProf || []).find(a => a.prof && a.prof.trim() === String(prof).trim() && a.du && a.au && date >= a.du && date <= a.au) : undefined);   // les deux dates sont nécessaires
function profAbsent(st, date, p) { const j = st.jours[date]; return !!(j && j.profAbs && j.profAbs[p]); }
function eleveActif(st, s, date) {
  const e = st.eleves[s]; if (!e || !e.nom.trim()) return false;
  return !(e.debut && date < e.debut) && !(e.fin && date > e.fin);
}
function etiquetteHors(st, s, date) {
  const e = st.eleves[s];
  if (e.debut && date < e.debut) return `(suivi à partir du ${fmtDM(e.debut)})`;
  if (e.fin && date > e.fin) return `(suivi terminé le ${fmtDM(e.fin)})`;
  return "";
}

/* ---------- emploi du temps et saisies ---------- */
function jour(st, date, create) {
  if (!st.jours[date] && create) st.jours[date] = { x: {}, com: {}, mat: {}, salle: {}, prof: {}, abs: {}, profAbs: {}, cl: {}, clr: {} };
  const j = st.jours[date];
  if (j) for (const k of ["x", "com", "mat", "salle", "prof", "abs", "profAbs", "cl", "clr"]) if (!j[k]) j[k] = {};
  return j;
}
function creneau(st, sems, date, p) {
  const w = semaineDuJour(sems, date); const d = (parseD(date).getUTCDay() + 6) % 7;
  const j = st.jours[date];
  const base = w && d < nbJours(st) && creneauxDu(st, date).includes(p) ? edtPour(st, date)[w.type][d][p] : { mat: "", salle: "" };
  const demi = demiJourneeOff(st, date, p), off = sansCours(st, date) || !!demi;     // jour ou demi-journée sans cours
  let mat = off ? "" : base.mat, salle = off ? "" : base.salle;
  const forced = !!(j && j.mat && p in j.mat) && !off;
  if (forced) mat = j.mat[p];
  if (j && j.salle && p in j.salle) salle = j.salle[p];
  const grp = !off && !forced && base.grp ? base.grp : [];
  let remplace = !!(j && j.prof && j.prof[p]) && (!!mat || grp.length > 0);     // enseignant remplaçant ce jour-là
  let prof = remplace ? j.prof[p] : profDe(st, mat, date);
  // absence longue de l'enseignant (plusieurs jours) : remplacé, ou cours annulé
  const absL = !remplace && mat ? absenceLongue(st, prof, date) : null;
  if (absL && absL.remplacant) { prof = absL.remplacant; remplace = true; }
  const r = { mat, salle, prof, remplace, forced, absent: !!mat && (profAbsent(st, date, p) || (!!absL && !absL.remplacant)), grp: [], divise: false, baseMat: mat, baseSalle: salle, baseProf: mat ? prof : "", demi: demi ? demi.label || (demi.moment === "matin" ? "matinée sans cours" : "après-midi sans cours") : "" };
  if (grp.length) {          // créneau partagé entre groupes ou options : libellé pour toute la classe, cours de chaque élève avec coursPour()
    r.divise = true; r.grp = grp.map(x => { let pr = remplace && j && j.prof && j.prof[p] ? j.prof[p] : profDe(st, x.mat, date); const a = !(j && j.prof && j.prof[p]) ? absenceLongue(st, pr, date) : null;
      if (a && a.remplacant) pr = a.remplacant; return { g: x.g, mat: x.mat, salle: x.salle, prof: pr, absent: !!a && !a.remplacant }; });
    r.mat = [...r.grp.map(x => x.g === x.mat ? x.mat : `${x.mat} (${x.g})`), ...(mat ? [`${mat} (les autres)`] : [])].join(" / ");
    r.prof = [...new Set([...r.grp.map(x => x.prof), ...(mat ? [prof] : [])].filter(Boolean))].join(" / ");
    r.salle = [...new Set([...r.grp.map(x => x.salle), salle].filter(Boolean))].join(" / ");
    r.absent = profAbsent(st, date, p); r.baseAbsent = !!absL && !absL.remplacant;   /* absence longue de l'enseignant des autres élèves : seulement leur cours */
  }
  return r;
}
/** Nom comparable (sans accents ni casse) pour retrouver un élève dans la liste de la classe. */
const cleNom = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
/** Groupes et options d'un élève, d'après la liste de la classe ; null si l'élève n'y est pas (il suit alors tous les cours). */
function groupesDe(st, nom) { const k = cleNom(nom); if (!k) return null; const e = st.classeEleves.find(x => cleNom(x.nom) === k); return e ? e.groupes || [] : null; }
/** Cours d'un élève sur un créneau partagé : celui de son groupe, sinon celui des autres élèves (ou rien). */
function coursPour(cr, grps) {
  if (!cr.divise) return cr;
  if (!grps) return cr.grp.every(g => g.absent) && (!cr.baseMat || cr.baseAbsent) ? { ...cr, absent: true } : cr;   /* élève hors de la liste de la classe : annulé si tous les cours du créneau le sont */
  const m = cr.grp.find(x => grps.includes(x.g));
  return m ? { ...cr, mat: m.mat, salle: m.salle || cr.baseSalle, prof: m.prof, groupe: m.g, absent: cr.absent || !!m.absent } : { ...cr, mat: cr.baseMat, salle: cr.baseSalle, prof: cr.baseProf, groupe: "", absent: cr.baseMat ? cr.absent || !!cr.baseAbsent : false };
}
/** Renomme une matière partout où elle sert (emploi du temps, cours remplacés). */
function renommerMatiere(st, ancien, nouveau) {
  if (!ancien || ancien === nouveau) return;
  for (const E of toutesEdt(st)) for (const t of ["A", "B"]) for (const day of E[t]) for (const c of day) { if (c.mat === ancien) c.mat = nouveau; for (const x of c.grp || []) if (x.mat === ancien) x.mat = nouveau; }
  for (const j of Object.values(st.jours)) for (const p of Object.keys(j.mat || {})) if (j.mat[p] === ancien) j.mat[p] = nouveau;
  for (const c of st.changementsProf || []) if (c.mat === ancien) c.mat = nouveau;
}
/** Nombre de créneaux de l'emploi du temps et de fiches qui utilisent une matière. */
function usageMatiere(st, nom) {
  if (!nom) return 0;
  let n = 0;
  for (const E of toutesEdt(st)) for (const t of ["A", "B"]) for (const day of E[t]) for (const c of day) { if (c.mat === nom) n++; for (const x of c.grp || []) if (x.mat === nom) n++; }
  for (const j of Object.values(st.jours)) for (const v of Object.values(j.mat || {})) if (v === nom) n++;
  return n;
}
/** Enseignant d'une matière (à une date : en tenant compte des changements « à partir du … » ; sans date : l'actuel). */
/** Enseignants successifs d'une matière sur une période (changements datés) : note(m, date) au fil des cours, puis de(m) → « M. A puis Mme B ». */
function profsPeriode(st) { const l = new Map();
  return { note(m, d) { const p = profDe(st, m, d); if (!l.has(m)) l.set(m, []); const t = l.get(m); if (p && !t.includes(p)) t.push(p); },
    de: m => (l.get(m) || []).join(" puis ") || profDe(st, m) }; }
function profDe(st, mat, date) { const m = st.matieres.find(m => m.nom === mat); let p = m ? m.prof : "";
  const ch = (st.changementsProf || []).filter(c => c.mat === mat && c.depuis && c.prof && (!date || c.depuis <= date)).sort((a, b) => (a.depuis < b.depuis ? -1 : 1));
  if (ch.length && (date || ch[ch.length - 1].depuis <= aujourdhuiISO())) p = ch[ch.length - 1].prof;
  return p; }
const aujourdhuiISO = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
/** Emplois du temps successifs : S.edt dès le début, puis S.edtSuivants [{ depuis, A, B }]. */
const toutesEdt = st => [st.edt, ...(st.edtSuivants || [])];
const edtPour = (st, date) => { let e = st.edt; for (const v of st.edtSuivants || []) if (date >= v.depuis) e = v; return e; };
function croix(st, date, s, o, p) { const j = st.jours[date]; const v = j && j.x && j.x[`${s}.${o}.${p}`]; return v === undefined ? -1 : v; }
/** Créneau où l'élève doit être évalué : un cours a lieu, l'enseignant et l'élève sont présents, l'élève est suivi ce jour-là. */
function creneauAttendu(st, date, s, p, cr) { cr = coursPour(cr, groupesDe(st, (st.eleves[s] || {}).nom)); return !!cr.mat && !cr.absent && eleveActif(st, s, date) && !eleveAbsent(st, date, s, p); }
function setCroix(st, date, s, o, p, lvl) {
  const j = jour(st, date, true), k = `${s}.${o}.${p}`;
  if (lvl < 0 || j.x[k] === lvl) delete j.x[k]; else j.x[k] = lvl;
}
function consigneTexte(st) {
  const c = st.consignes[st.consigneChoisie] || st.consignes[0];
  const ref = st.referent.trim();
  return (c && c.texte || "").replace(/à \[r[ée]f[ée]rent\]/gi, ref ? "à " + ref : "au professeur référent")
    .replace(/de \[r[ée]f[ée]rent\]/gi, ref ? "de " + ref : "du professeur référent")
    .replace(/\[r[ée]f[ée]rent\]/gi, ref || "le professeur référent");   /* [Référent], [referent]… */
}
function legendeCodage(st) { return st.codage.filter(c => c.code).map(c => c.code + (c.sens ? " = " + c.sens : "")).join(", "); }

/* ---------- statistiques ---------- */
const ratio = (a, b) => (b ? a / b : null);

/** Statistiques d'une semaine : par élève, objectif, jour et niveau ; remplissage ; groupe. */
function statsSemaine(st, sems, wi) {
  const w = sems[wi]; const nb = nbBlocs(st);
  const el = [];
  for (let s = 0; s < nb; s++) {
    const obj = [];
    let attendus = 0, remplis = 0, absences = 0, actifSemaine = false;
    for (let o = 0; o < nbObj(st); o++) obj.push({ jours: w.jours.map(() => [0, 0, 0, 0]), sem: [0, 0, 0, 0] });
    w.jours.forEach((date, d) => {
      if (!eleveActif(st, s, date)) return;
      actifSemaine = true;
      for (const p of creneauxDu(st, date)) {
        const cr = creneau(st, sems, date, p);
        const cE = coursPour(cr, groupesDe(st, (st.eleves[s] || {}).nom));   /* créneau partagé : le cours de l'élève */
        if (cE.mat && !cE.absent && eleveAbsent(st, date, s, p)) absences++;
        if (!creneauAttendu(st, date, s, p, cr)) continue;     // croix d'un créneau sans cours ou d'une absence : ignorées
        attendus++;
        let rempli = false;
        for (let o = 0; o < nbObj(st); o++) {
          const l = croix(st, date, s, o, p);
          if (l >= 0 && l < NB_NIV) { obj[o].jours[d][l]++; obj[o].sem[l]++; rempli = true; }
        }
        if (rempli) remplis++;
      }
    });
    for (const ob of obj) {
      ob.pctJours = ob.jours.map(n => ratio(n[0] + n[1], n[0] + n[1] + n[2] + n[3]));
      ob.pct = ratio(ob.sem[0] + ob.sem[1], ob.sem.reduce((a, b) => a + b, 0));
    }
    const tot = [0, 1, 2, 3].map(l => obj.reduce((a, ob) => a + ob.sem[l], 0));
    el.push({ obj, attendus, remplis, absences, actifSemaine, pct: ratio(tot[0] + tot[1], tot.reduce((a, b) => a + b, 0)),
      commentaires: w.jours.map((date, d) => { const j = st.jours[date]; const c = j && j.com && j.com[s]; return c ? `${DAYS[d].slice(0, 3)}. : ${c}` : ""; }).filter(Boolean) });
  }
  const grp = [];
  for (let o = 0; o < nbObj(st); o++) {
    const jours = w.jours.map((_, d) => [0, 1, 2, 3].map(l => el.reduce((a, e) => a + e.obj[o].jours[d][l], 0)));
    const sem = [0, 1, 2, 3].map(l => el.reduce((a, e) => a + e.obj[o].sem[l], 0));
    grp.push({ jours, sem, pctJours: jours.map(n => ratio(n[0] + n[1], n[0] + n[1] + n[2] + n[3])),
      pct: ratio(sem[0] + sem[1], sem.reduce((a, b) => a + b, 0)) });
  }
  const gt = [0, 1, 2, 3].map(l => grp.reduce((a, g) => a + g.sem[l], 0));
  return { w, el, grp, pctGroupe: ratio(gt[0] + gt[1], gt.reduce((a, b) => a + b, 0)) };
}
/** Évolution d'une semaine à l'autre, sur les pourcentages tels qu'ils sont affichés :
    ↑ au moins 10 points de plus, ↗ de 5 à 9 points de plus, = moins de 5 points d'écart, ↘ de 5 à 9 de moins, ↓ au moins 10 de moins. */
function evolution(cur, prev) {
  if (cur == null || prev == null) return "";
  const d = Math.round(cur * 100) - Math.round(prev * 100);
  return d >= 10 ? "↑" : d >= 5 ? "↗" : d <= -10 ? "↓" : d <= -5 ? "↘" : "=";
}
/** Pourcentage arrondi tel qu'affiché (0 à 100), pour que couleur et texte concordent aux seuils. */
function pctArrondi(v) { return v == null ? null : Math.round(v * 100); }
/** Remplissage d'un jour (pour le sommaire) : 'off' (pas de cours) | 'rien' (rien à saisir) | 'none' | 'part' | 'full'.
    « full » : chaque créneau attendu a tous ses objectifs renseignés. */
function etatJour(st, sems, date) {
  if (sansCours(st, date)) return "off";
  let attendus = 0, complets = 0, croixPosees = 0;
  for (let s = 0; s < nbBlocs(st); s++) for (const p of creneauxDu(st, date)) {
    const cr = creneau(st, sems, date, p);
    if (!creneauAttendu(st, date, s, p, cr)) continue;
    attendus++;
    let n = 0; for (let o = 0; o < nbObj(st); o++) if (croix(st, date, s, o, p) >= 0) n++;
    croixPosees += n; if (n === nbObj(st)) complets++;
  }
  if (!attendus) return "rien";
  if (!croixPosees) return "none";
  return complets >= attendus ? "full" : "part";
}
/** Bilan par matière sur tout le suivi : obs (croix) et neg (niveaux 3-4) par matière et par élève. */
function bilan(st, sems) {
  const nb = nbBlocs(st); const res = new Map(), pr = profsPeriode(st);
  const get = m => { if (!res.has(m)) res.set(m, Array.from({ length: nb }, () => ({ obs: 0, neg: 0, i: 0 }))); return res.get(m); };
  for (const w of sems) for (const date of w.jours) for (const p of creneauxDu(st, date)) {
    const cr = creneau(st, sems, date, p); if (!cr.mat) continue;
    for (let s = 0; s < nb; s++) for (let o = 0; o < nbObj(st); o++) {
      if (!creneauAttendu(st, date, s, p, cr)) break;      // mêmes règles que les totaux (élève suivi et présent)
      const l = croix(st, date, s, o, p); if (l < 0 || l >= NB_NIV) continue;
      const mt = coursPour(cr, groupesDe(st, st.eleves[s].nom)).mat; pr.note(mt, date); const c = get(mt)[s]; c.obs++; if (l >= 2) c.neg++; if (l === 3) c.i++;
    }
  }
  const ordre = ordreMatieres(st).filter(n => res.has(n));   // rangées par champ disciplinaire
  for (const m of res.keys()) if (!ordre.includes(m)) ordre.push(m);
  return ordre.map(m => ({ mat: m, prof: pr.de(m), el: res.get(m) }));
}
