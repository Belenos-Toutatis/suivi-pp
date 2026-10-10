/* =====================================================================
   Tutoriel de prise en main : étapes guidées, affichées par-dessus l'application
   (l'endroit concerné est éclairé, une bulle dit à quoi il sert et quoi faire)
   ===================================================================== */
const premierSuivi = () => (S && S.individuels[0] ? "#indiv/" + S.individuels[0].id : "#indiv");
/** Chapitres et étapes. route : page à ouvrir ; cible : élément à éclairer (sinon bulle au centre) ; but : à quoi ça sert ; faire : quoi faire. */
const TUTO = [
  { id: "tour", titre: "Vue d’ensemble", sous: "Les trois sortes de fiches, la synthèse et ce qui leur est commun (2 min).", etapes: [
    { route: "#sommaire", cible: "#tabs", menuLarge: true, titre: "Bienvenue",
      but: "L’application prépare, imprime et exploite trois sortes de fiches de suivi du comportement : individuelles, collectives et de classe. Le menu de gauche les range dans cet ordre, puis la synthèse et ce qui leur est commun. Sur un petit écran, il est réduit à des icônes : passez la souris dessus pour l’ouvrir par-dessus la page.",
      faire: "Suivez les étapes avec « Suivant ». La bulle cache quelque chose ? Glissez-la par son bandeau. Vous pouvez quitter à tout moment et reprendre plus tard (menu Fichier › Tutoriel de prise en main)." },
    { route: "#sommaire", menuLarge: true, cible: '#tabs a[data-v="indiv"]', titre: "Fiches individuelles (suivis individuels)",
      but: "Un élève, ses propres objectifs, une fiche qu’il fait remplir à chaque cours jusqu’au jour de remise ; la famille reçoit le bilan.",
      faire: "Dans le menu de gauche : « Fiches individuelles ». Un suivi se crée en quelques clics, à partir d’objectifs types." },
    { route: "#sommaire", menuLarge: true, cible: '#tabs a[data-v="fiche"]', titre: "Fiches collectives (suivi collectif)",
      but: "Quelques élèves (12 au plus) suivis ensemble : une fiche par jour, une ligne par objectif, une croix par cours. Les totaux et le bilan par matière en sont tirés.",
      faire: "Dans le menu de gauche : « Fiches collectives » ; le Sommaire, les Totaux et le Bilan concernent aussi ce suivi collectif." },
    { route: "#sommaire", menuLarge: true, cible: '#tabs a[data-v="classe"]', titre: "Fiches de classe (classe entière)",
      but: "Toute la classe sur une fiche par semaine (une page), avec des codes d’incident : bavardage, travail non fait…",
      faire: "Dans le menu de gauche : « Fiches de classe ». Elle se remplit cours par cours, comme une feuille d’appel des incidents." },
    { route: "#sommaire", menuLarge: true, cible: '#tabs a[data-v="eleve"]', titre: "Synthèse : un élève, le conseil de classe",
      but: "La fiche élève réunit tout ce que disent les trois sortes de fiches sur un élève ; le conseil de classe les met côte à côte pour toute la classe, sur un trimestre ou un semestre.",
      faire: "Dans le menu de gauche : « Fiche élève » et « Conseil de classe ». Seules les familles de fiches utilisées sur la période y figurent." },
    { route: "#sommaire", menuLarge: true, cible: '#tabs a[data-v="reglages"]', titre: "Commun : emploi du temps et réglages",
      but: "L’emploi du temps, les matières, le calendrier et la liste de la classe servent à toutes les fiches : on les règle une seule fois.",
      faire: "Le chapitre « Mise en route » vous fait remplir ces réglages dans l’ordre." },
    { route: "#sommaire", cible: "#b-save", titre: "Enregistrer",
      but: "Le suivi s’enregistre dans ce fichier .html lui-même : pour le garder ou le transmettre, il suffit de copier ce fichier. Rien n’est envoyé sur Internet.",
      faire: "Cliquez sur « Enregistrer » (l’icône de disquette, ou Ctrl+S) régulièrement. La première fois, choisissez ce fichier-ci dans la fenêtre qui s’ouvre et acceptez de le remplacer. Une erreur ? Ctrl+Z annule la dernière modification (Ctrl+Y la rétablit)." }] },
  { id: "depart", titre: "Mise en route", sous: "Les réglages communs, dans l’ordre où les faire (10 à 15 min).", etapes: [
    { route: "#reglages/classe", cible: ".logo-zone", titre: "1. L’établissement",
      but: "Le nom et le logo de l’établissement figurent en haut de toutes les impressions (dans la marge, sans prendre de place). Sur les fiches que les enseignants cochent en classe, seulement s’il reste de la place.",
      faire: "Tapez le nom de l’établissement. Pour le logo : glissez une image (JPG, PNG, WebP ou SVG) dans le cadre, ou cliquez le cadre puis collez-la (Ctrl+V), ou « Choisir une image… ». Un logo qui contient déjà le nom (en-tête complet) : cochez « Le logo contient déjà le nom » (la case apparaît une fois le logo chargé), il s’imprime alors plus large." },
    { route: "#reglages/classe", cible: 'input[data-path="classe"]', titre: "2. La classe et le référent",
      but: "Le nom de la classe figure sur toutes les fiches et au début du nom des PDF ; le référent (souvent le professeur principal) est celui qui reçoit les fiches.",
      faire: "Indiquez la classe (ex. 5E), puis le référent dans le champ voisin." },
    { route: "#reglages/calendrier", cible: '[data-act="cal-preremplir"]', titre: "3. L’année scolaire et la zone",
      but: "Les vacances de votre zone (A, B ou C) et les jours fériés de l’année se préremplissent d’un clic ; en Alsace-Moselle, le Vendredi saint aussi.",
      faire: "Choisissez l’année scolaire et la zone (B par défaut), gardez Alsace-Moselle cochée ou décochez-la selon votre académie, puis « Préremplir les vacances et les jours fériés ». Après un changement d’année, de zone ou d’Alsace-Moselle, cliquez à nouveau sur ce bouton (l’appli vous le rappelle). Les sorties et journées banalisées déjà notées sont gardées." },
    { route: "#reglages/calendrier", cible: 'input[data-path="debut"]', titre: "4. La période du suivi",
      but: "Les fiches, les totaux et les bilans ne couvrent que cette période ; les semaines A et B alternent à partir de la première.",
      faire: "Indiquez le premier et le dernier jour du suivi, et le type (A ou B) de la première semaine. « Suivi sur toute l’année scolaire » règle les deux dates d’un coup. Plus bas, choisissez trimestres ou semestres (comme vos conseils de classe) et corrigez leurs dates de fin." },
    { route: "#reglages/calendrier", cible: ".annee", titre: "5. Vacances et jours sans cours",
      but: "Les semaines de vacances sont sautées ; un jour férié ou banalisé est marqué « pas de cours » sur les fiches, toute la journée ou seulement le matin ou l’après-midi.",
      faire: "Vérifiez les vacances, ajoutez les jours sans cours (sortie, conseil de classe…) en choisissant « journée », « matin » ou « après-midi ». Un clic sur une semaine du calendrier la force en A ou en B." },
    { route: "#reglages/matieres", cible: '[data-add="matieres"]', titre: "6. Matières et enseignants",
      but: "Chaque matière a son enseignant : son nom s’affiche tout seul sur les fiches, selon l’emploi du temps.",
      faire: "Complétez la liste et le nom des enseignants. Un champ « Enseignant » encadré en orange est à compléter : la matière est dans l’emploi du temps sans enseignant. Un nom mal tapé : corrigez-le ici, l’appli propose de le corriger aussi partout où il figure (absences longues, autres matières, changements, remplacements)." },
    { route: "#reglages/classeEntiere", cible: '[data-act="cl-fichier"]', titre: "7. La liste de la classe",
      but: "Elle sert à la fiche de classe, aux groupes et options, et à retrouver les élèves des autres suivis.",
      faire: "« Importer un fichier… » (CSV, tableur .ods ou .xlsx, colonnes Nom et Prénom ; un export Pronote de plusieurs classes est accepté : la classe réglée à l’étape 2 est choisie) ou « Coller une liste… » depuis un tableur ou Pronote. Un nom corrigé ensuite : l’appli propose de le corriger aussi dans les autres suivis." },
    { route: "#reglages/classeEntiere", cible: '[data-act="cl-fichier"]', titre: "8. Importer les groupes et les options",
      but: "Toute la classe n’a pas toujours le même cours : demi-groupes (groupe 1, groupe 2…), langues, options. Ils peuvent venir du même tableau que les noms : pas besoin de les cocher un à un.",
      faire: "Dans le fichier, une colonne « Groupe » ou « Options » (ex. « G1 », « Latin, Chorale »), ou une colonne par option marquée « X ». À l’import, choisissez pour chaque colonne : ignorer, « groupes / options écrits » ou « si case remplie ». Les groupes manquants sont créés ; un élève déjà dans la liste voit ses groupes complétés : on peut importer les groupes après la liste. Un élève n’est que dans un seul demi-groupe (groupe 1 ou groupe 2) ; les options se cumulent." },
    { route: "#reglages/classeEntiere", cible: ".lhead.lcl", titre: "9. Vérifier les groupes",
      but: "Un élève qui n’a pas le cours de son groupe a sa case hachurée sur toutes les fiches.",
      faire: "Vérifiez les cases cochées sur la ligne de chaque élève (un clic sur le nom d’un groupe le coche pour toute la classe), créez au besoin un groupe à la main. Ils serviront juste après, dans l’emploi du temps." },
    { route: "#edt", cible: ".creneaux-plus", titre: "10. Les créneaux de la semaine",
      but: "Par défaut, M1 à M4 le matin et S1 à S3 l’après-midi, du lundi au vendredi. Selon votre établissement : un créneau le midi (M5), des cours en fin d’après-midi (S4, puis S5), le samedi matin.",
      faire: "Cochez les créneaux et le jour dont vous avez besoin : ils apparaissent dans l’emploi du temps et sur toutes les fiches. S5 se coche après S4. Les décocher n’efface rien de ce qui y est saisi." },
    { route: "#edt", cible: ".palette-edt", titre: "11. L’emploi du temps : la palette",
      but: "L’emploi du temps remplit les fiches à votre place : matière, enseignant et salle de chaque créneau, semaines A et B.",
      faire: "Choisissez une matière dans la palette (c’est votre « pinceau »), et éventuellement sa salle." },
    { route: "#edt", cible: "table.edt2", titre: "12. Peindre les créneaux",
      but: "Un clic ou un cliquer-glisser pose la matière sur les créneaux, comme on coche une fiche.",
      faire: "Peignez la semaine A, puis l’onglet « Semaine B » (ou « Copier A → B » si elles sont presque pareilles). La gomme vide un créneau. Pour un cours en demi-groupe ou une option, choisissez d’abord « Pour : groupe » sous la palette." },
    { route: "#edt", cible: ".horaires-card .champs", titre: "13. Les horaires",
      but: "Les heures imprimées sur les fiches se calculent toutes seules : début du matin et de l’après-midi, durée d’un cours (55 min), interclasse, récréations du matin et de l’après-midi.",
      faire: "Réglez ces valeurs (une séance dure de 45 à 60 min) ; une heure corrigée à la main décale les suivantes, ↺ revient au calcul. Un cours de 1 h 50 ou de 2 h, ce sont deux séances : mettez la matière sur deux créneaux." },
    { route: "#edt", cible: ".hj-liste", titre: "14. Les journées aux horaires particuliers",
      but: "Un jour où les cours commencent plus tard (le mercredi matin décalé de 30 min, par exemple) ou ont des horaires à part.",
      faire: "Pour ce jour, choisissez « décalés de… » (en minutes, toute la journée ou le matin seulement) ou « horaires libres » (chaque créneau à la main). Le jour est repéré par ⏱ dans l’emploi du temps." },
    { route: "#reglages/pastilles", cible: ".codage", titre: "15. Codes et pastilles",
      but: "Les 4 niveaux (TB, S, À, I) servent aux fiches individuelles et au suivi collectif ; les seuils colorent les résultats (rouge, orange, vert). En noir et blanc, le rouge se reconnaît à son cadre plein, l’orange à son cadre pointillé.",
      faire: "Gardez les réglages proposés ou adaptez-les à votre établissement. Les seuils restent toujours dans l’ordre rouge, orange, vert clair, vert (le vert ne s’affiche que si « Pastilles vertes aussi » est coché) : un seuil tapé trop haut ou trop bas est corrigé, avec un message." }] },
  { id: "indiv", titre: "Suivis individuels", sous: "Créer un suivi, imprimer, saisir le jour de la remise, informer la famille.", etapes: [
    { route: "#indiv", cible: '[data-act="ind-ajout"]', titre: "1. Créer un suivi individuel",
      but: "Un suivi par élève, avec ses propres objectifs (1 à 4).",
      faire: "« + Nouveau suivi individuel », puis choisissez l’élève dans la liste de la classe." },
    { route: premierSuivi, cible: ".lrow.lo", titre: "2. Les objectifs de l’élève",
      but: "Formulés du point de vue de l’élève (« Je… ») : il sait exactement ce qu’on attend de lui.",
      faire: "Ils se règlent dans le menu « Réglages du suivi » en haut de la page (élève, objectifs, jour de remise, courriel). Le bouton ☰ propose des objectifs types, à adapter ensuite à l’élève." },
    { route: premierSuivi, cible: '[data-act="print-ind"]', titre: "3. Imprimer la fiche",
      but: "La fiche couvre les jours de cours jusqu’au jour de remise ; l’élève la présente à chaque enseignant en début de cours. Le haut de la page indique ses dates et le numéro de la semaine.",
      faire: "Imprimez-la et donnez-la à l’élève le jour où elle commence. Pour tous les élèves suivis d’un coup : le bouton « Fiches de la semaine… » de la page Fiches individuelles." },
    { route: premierSuivi, cible: ".pal-ind", titre: "4. Saisir la fiche rendue",
      but: "Le jour de la remise, vous recopiez les codes écrits par les enseignants, d’une traite.",
      faire: "Tapez le niveau, comme pour les compétences : 1 (le plus faible, I) à 4 (le meilleur, TB), 0 : non évalué — ou T, S, A, I. La case suivante est choisie toute seule. Entrée pour une remarque. À la souris : choisissez un code dans la palette, puis un clic (ou un cliquer-glisser) sur les cases le met ; un 2e clic sur ce code le désélectionne." },
    { route: premierSuivi, cible: ".nav-el", titre: "5. D’un élève à l’autre",
      but: "Le jour de la remise, on saisit souvent les fiches de tous les élèves suivis, l’une après l’autre.",
      faire: "Les flèches ‹ › à côté du nom (ou les touches ← → du clavier, hors de la grille de saisie) passent à l’élève précédent ou suivant, sur la même période." },
    { route: premierSuivi, cible: ".etapes-remise", titre: "6. Informer la famille",
      but: "Le bilan de la fiche (objectifs, réussite, remarques, votre bilan) part le jour même.",
      faire: "« Bilan pour la famille (PDF) », puis « Copier l’objet » et « Copier le message » pour les coller dans l’ENT." },
    { route: premierSuivi, cible: ".evol-indiv", titre: "7. Suivre l’évolution",
      but: "Les fiches côte à côte, les courbes par objectif et un avis : maintenir le suivi ou envisager d’y mettre fin.",
      faire: "Consultez-la avant une réunion d’équipe ; « Imprimer l’évolution » en fait une page." },
    { route: premierSuivi, cible: ".bmi-carte", titre: "8. Le bilan par matière",
      but: "Voir s’il y a une matière où l’élève se comporte moins bien que dans ses autres cours, et si cela évolue d’une fiche à l’autre.",
      faire: "Les matières à 10 points ou plus sous sa moyenne sont signalées en rouge. Choisissez un objectif pour affiner ; « Imprimer » en fait une page (elle accompagne aussi l’impression de l’évolution)." },
    { route: "#indivtous", cible: ".indiv-parallele", titre: "9. Tous les suivis côte à côte",
      but: "Comparer l’évolution de tous les élèves suivis, semaine par semaine : qui progresse, qui stagne, qui décroche, et l’avis sur le maintien de chacun.",
      faire: "Menu « Tous les suivis » : une courbe par élève et un tableau des fiches. Un clic sur une pastille ouvre la fiche ; « Imprimer » en fait une page pour une réunion d’équipe." },
    { route: "#reglages/suivisIndiv", cible: ".reg-contenu .card", titre: "10. Les réglages des suivis individuels",
      but: "Le jour de remise, la consigne imprimée, le courriel à la famille, les objectifs types et la règle de fin du suivi.",
      faire: "Adaptez-les à votre organisation (ex. remise le jeudi si vous ne travaillez pas le vendredi)." }] },
  { id: "coll", titre: "Suivi collectif", sous: "Élèves, objectifs, saisie des fiches collectives, totaux et bilan.", etapes: [
    { route: "#reglages/eleves", cible: '[data-act="el-coller"]', titre: "1. Les élèves du suivi collectif",
      but: "Les quelques élèves suivis ensemble (12 au plus) ; l’ordre est celui des fiches.",
      faire: "Ajoutez-les (ou collez la liste). Un élève qui arrive ou quitte le dispositif en cours d’année : réglez sa période de suivi." },
    { route: "#reglages/fiche", cible: ".obj-carte", titre: "2. Les objectifs et la consigne",
      but: "Les objectifs observables (1 à 8, 4 par défaut) forment les lignes de la fiche ; la consigne est imprimée en haut.",
      faire: "Écrivez un intitulé court et un descriptif concret pour chaque objectif ; choisissez une consigne." },
    { route: "#fiche", cible: "table.fiche", titre: "3. Remplir la fiche collective",
      but: "Chaque enseignant coche un niveau par objectif sur la fiche papier ; vous reportez ici ce qui est coché.",
      faire: "Cliquez une case (ou glissez sur plusieurs). Au clavier : 1 (I) à 4 (TB) met la croix du niveau puis descend à l’objectif suivant, 0 : non évalué. Un clic sur TB, S… en tête de colonne remplit tout le cours. Clic droit : absence." },
    { route: "#fiche", cible: ".frise", titre: "4. Passer d’un jour à l’autre",
      but: "La frise montre les jours de la semaine et leur état (rien de saisi, en partie, complet).",
      faire: "Cliquez un jour, ou utilisez les flèches ← → du clavier (hors de la grille de saisie, où elles déplacent la case)." },
    { route: "#fiche", cible: ".imprimer-groupe", titre: "5. Imprimer les fiches vierges",
      but: "Les fiches s’impriment avec l’emploi du temps, les enseignants et les objectifs déjà remplis.",
      faire: "« Imprimer » pour ce jour ; le menu ▾ pour toute la semaine ou une période." },
    { route: "#totaux", cible: "table.tot", titre: "6. Les totaux de la semaine",
      but: "Pour chaque élève et chaque objectif : les croix de la semaine, la réussite et son évolution ; les pastilles signalent ce qui va bien ou mal.",
      faire: "Survolez une case pour le détail du calcul. Le bouton « Seuils » règle les couleurs ; « Pastilles vertes aussi » ajoute le vert. Au-delà de 8 élèves, l’impression se fait sur deux pages équilibrées." },
    { route: "#bilan", cible: "table.bil", titre: "7. Le bilan par matière",
      but: "Repérer les cours où cela se passe moins bien, sur la période choisie.",
      faire: "Choisissez la période en haut ; cliquez une matière pour garder sa ligne surlignée." }] },
  { id: "classe", titre: "Fiche de classe", sous: "Codes d’incident, saisie rapide de la fiche de la semaine, impression, semaine après semaine.", etapes: [
    { route: "#reglages/ficheClasse", cible: 'input[data-path="codesClasse.0.code"]', titre: "1. Les codes d’incident",
      but: "Une lettre par type d’incident (B bavardage…) ; « + » pour un comportement positif ; « A » est réservé aux absences.",
      faire: "Adaptez les codes et la règle de la semaine (ex. 3 remarques = 1 heure de retenue)." },
    { route: "#classesem", cible: "table.cs", titre: "2. Remplir la fiche de classe",
      but: "Une fiche par semaine : un élève par colonne, les jours et les cours en lignes. Seuls les incidents sont notés : une case vide veut dire « rien à signaler ».",
      faire: "Saisie rapide : choisissez un code dans la palette, puis cliquez (ou cliquez-glissez) les cases ; un 2e clic sur ce code le désélectionne. Sans code choisi, un clic choisit la case, puis tapez la lettre du code. Au clavier : flèches, la lettre du code, Espace pour l’élève suivant. « ☰ Choisir » pour mettre plusieurs codes dans une case." },
    { route: "#classesem", cible: "td.cs-mat.crn-b", titre: "3. Enseignant absent ou remplacé",
      but: "Un collègue absent : pas de cours, rien à noter. Un collègue remplacé : par un collègue de la classe dans une autre matière, ou par quelqu’un qui n’a pas la classe.",
      faire: "Cliquez la matière du créneau (ici, ou la matière sur une fiche individuelle, ou le ✎ de la fiche collective) : « Enseignant absent » ou « Remplacé » avec l’enseignant et la matière, même s’ils ne sont pas dans les listes. Toutes les fiches en tiennent compte." },
    { route: "#classesem", cible: ".cs-resp", titre: "4. Le responsable du jour",
      but: "L’élève qui porte la fiche d’un cours à l’autre, imprimé en haut de la fiche.",
      faire: "Indiquez-le pour chaque jour (ou laissez vide pour l’écrire à la main)." },
    { route: "#classesem", cible: '[data-act="cl-rem"]', titre: "5. Les remarques au dos de la fiche",
      but: "Un enseignant écrit parfois une remarque au dos de la fiche (exclusion de cours, mot dans le carnet). Avec l’heure du cours, on sait de quelle matière et de quel enseignant elle vient.",
      faire: "« Remarque » : choisissez l’élève, le jour et l’heure (la matière s’en déduit), puis recopiez le texte. Les remarques s’affichent sous la fiche à l’écran (pas à l’impression : elles sont déjà au dos du papier) et reviennent dans la fiche élève." },
    { route: "#classesem", cible: '[data-act="print-cl-sem"]', titre: "6. Imprimer la fiche de la semaine",
      but: "Une page A4 : un élève par colonne, les totaux par code et les heures de retenue en bas.",
      faire: "Cliquez « Imprimer » puis « Enregistrer en PDF » ou votre imprimante." },
    { route: "#classesuivi", cible: ".cl-suivi", titre: "7. Semaine après semaine",
      but: "Voir ce qui se passe au fil des semaines : les incidents de la classe, et pour chaque élève son total de remarques, ses heures de retenue et la tendance.",
      faire: "Repérez les élèves qui accumulent (orange : à une remarque de la retenue, rouge : retenue). Un clic sur une barre ou une semaine ouvre sa fiche." },
    { route: "#classebilan", cible: "table.clb", titre: "8. Bilan par matière",
      but: "Dans quelles matières y a-t-il le plus d’incidents, pour 10 cours (pour comparer des matières qui n’ont pas le même horaire) ? Pour toute la classe, ou pour un élève en particulier.",
      faire: "Choisissez les semaines (2, 4 dernières… ou cliquer-glisser sur les colonnes ; glisser la sélection la déplace). Basculez entre « Nombre d’incidents » et « Pour 10 cours ». Survolez une case : quels élèves ont eu ces incidents. Choisissez un élève en haut à droite pour voir où lui se comporte moins bien." }] },
  { id: "synthese", titre: "Synthèse", sous: "Toutes les fiches d’un élève, et la synthèse pour le conseil de classe.", etapes: [
    { route: "#eleve", cible: "#el-choix", titre: "1. La fiche d’un élève",
      but: "Un élève peut être à la fois en suivi individuel, dans le suivi collectif et dans la classe : cette page réunit tout ce que disent les fiches, pour une équipe éducative, un rendez-vous avec la famille ou la CPE.",
      faire: "Choisissez l’élève ; « Imprimer » donne une page." },
    { route: "#eleve", cible: ".periodes", titre: "2. La période",
      but: "Les chiffres portent sur les semaines choisies : la semaine en cours ou la précédente, les 2, 4 ou 8 dernières, depuis les dernières vacances, un trimestre ou un semestre (Réglages › Période et calendrier), tout le suivi, ou de telle semaine à telle semaine.",
      faire: "Choisissez la période avant d’imprimer." },
    { route: "#conseil", cible: "table.conseil-t", titre: "3. Conseil de classe",
      but: "Un élève par ligne : avis (suivi individuel), réussite (suivi collectif), incidents et retenues (fiches de classe). Un clic sur un nom ouvre sa fiche élève.",
      faire: "Choisissez la période (le trimestre ou le semestre), puis « Imprimer » : une page A4 paysage." }] },
  { id: "annee", titre: "Au fil de l’année", sous: "Ce qui change en cours d’année : élèves, enseignants, emploi du temps, jours sans cours, année suivante.", etapes: [
    { route: "#reglages/classeEntiere", cible: '.lhead.lcl span[title^="Arrivée"]', titre: "1. Un élève arrive ou quitte la classe",
      but: "Avant son arrivée ou après son départ, sa colonne est hachurée sur la fiche de classe ; ce qui a été saisi est gardé.",
      faire: "Ajoutez l’élève à la liste, puis cliquez « dates » sur sa ligne : « Arrivé(e) le » ou « Parti(e) le ». Pour un départ, préférez la date au bouton ✕, qui efface ses codes." },
    { route: "#reglages/matieres", cible: '[data-add="changementsProf"]', titre: "2. Un nouvel enseignant",
      but: "Un collègue remplacé durablement (mutation, congé long) : son nom change sur les fiches à partir d’une date, les fiches d’avant gardent l’ancien.",
      faire: "« + Ajouter un changement » : la matière, la date et le nouvel enseignant." },
    { route: "#reglages/matieres", cible: '[data-add="absencesProf"]', titre: "3. Une absence de plusieurs jours",
      but: "Un enseignant absent plusieurs jours : ses cours sont annulés sur toutes les fiches (rien à noter), ou assurés par un remplaçant dont le nom s’imprime.",
      faire: "« + Ajouter une absence » : l’enseignant, les deux dates, et le remplaçant s’il y en a un (vide : cours annulés). Pour un seul cours, cliquez plutôt la matière du créneau sur la fiche." },
    { route: "#edt", cible: '[data-act="edt-nouveau"]', titre: "4. Un nouvel emploi du temps",
      but: "L’emploi du temps change en cours d’année (nouveau trimestre, emploi du temps refait) : les fiches passées gardent l’ancien.",
      faire: "« + Nouveau à partir du… » : choisissez la date, puis modifiez la copie proposée. Les onglets au-dessus de la palette passent d’une version à l’autre." },
    { route: "#reglages/calendrier", cible: '[data-add="joursSansCours"]', titre: "5. Une sortie, une journée banalisée",
      but: "Les fiches de ce jour (ou de cette demi-journée) sont marquées « pas de cours » ; les totaux et les bilans n’en tiennent pas compte.",
      faire: "« + Ajouter un jour » : le motif, la date, et « journée », « matin » ou « après-midi »." },
    { route: "#sommaire", menuLarge: true, cible: "#b-annee", titre: "6. L’année suivante",
      but: "Repartir sur une nouvelle année sans tout ressaisir : l’établissement, les matières, les codes, les consignes et les objectifs types sont gardés ; les fiches et les suivis individuels repartent de zéro.",
      faire: "Enregistrez d’abord le suivi de cette année, puis Fichier › « Nouvelle année scolaire… » : choisissez ce qui est gardé (emploi du temps, groupes, liste de la classe…). Les jours fériés de la nouvelle année sont préremplis, et les vacances si leur calendrier officiel est connu de l’application." }] }];

const CLE_TUTO = LS_KEY + "-tuto";
let tuto = null;                      // { ch, i } : chapitre et étape affichés
let tutoScroll = "";                  // étape déjà amenée à l'écran (on ne fait défiler qu'une fois)
let tutoMenu = false;                 // menu latéral ouvert le temps d'une étape qui le présente (écran étroit)
function menuTuto(ouvrir) {
  if (ouvrir && document.documentElement.classList.contains("rail")) { document.documentElement.classList.remove("rail"); tutoMenu = true; }
  else if (!ouvrir && tutoMenu) { tutoMenu = false; appliquerZoom(); }
}
const voileTuto = document.createElement("div"); voileTuto.id = "tuto-trou"; voileTuto.hidden = true; voileTuto.setAttribute("aria-hidden", "true");
const bulleTuto = document.createElement("div"); bulleTuto.id = "tuto-bulle"; bulleTuto.hidden = true; bulleTuto.setAttribute("role", "dialog"); bulleTuto.setAttribute("aria-live", "polite");
document.body.append(voileTuto, bulleTuto);
function memoTuto() { try { if (tuto) localStorage.setItem(CLE_TUTO, JSON.stringify(tuto)); else localStorage.removeItem(CLE_TUTO); } catch (e) { /* sans stockage */ } }
function tutoEnCours() { try { const t = JSON.parse(localStorage.getItem(CLE_TUTO) || "null"); return t && TUTO[t.ch] && TUTO[t.ch].etapes[t.i] ? t : null; } catch (e) { return null; } }
const etapeTuto = () => tuto && TUTO[tuto.ch] && TUTO[tuto.ch].etapes[tuto.i];
const routeTuto = et => (typeof et.route === "function" ? et.route() : et.route);
function allerEtape(ch, i) {
  if (!TUTO[ch] || !TUTO[ch].etapes[i]) { quitterTuto(true); return; }
  tuto = { ch, i }; memoTuto(); tutoScroll = "";
  const r = routeTuto(TUTO[ch].etapes[i]);
  const et0 = TUTO[ch].etapes[i];
  if (r && !(location.hash === r || (!et0.exact && location.hash.startsWith(r + "/") && !r.includes("/")))) location.hash = r;
  else placerTuto();
  setTimeout(placerTuto, 120);
}
/** Tutoriel retiré sans message (plus aucun suivi affiché) ; il reprendra à la même étape depuis le menu. */
function couperTuto() { if (!tuto) return; tuto = null; voileTuto.hidden = true; bulleTuto.hidden = true; document.body.classList.remove("tuto-actif"); menuTuto(false); }
function quitterTuto(fini) {
  tuto = null; voileTuto.hidden = true; bulleTuto.hidden = true; document.body.classList.remove("tuto-actif"); menuTuto(false);
  if (fini) { try { localStorage.removeItem(CLE_TUTO); } catch (e) { /* sans stockage */ } toast("Tutoriel terminé. Il reste dans le menu Fichier › Tutoriel de prise en main.", 6000); }
  else toast("Tutoriel interrompu : vous le reprendrez où vous en étiez (menu Fichier › Tutoriel de prise en main).", 6000);
}
/** Place l'éclairage autour de la cible et la bulle à côté (dessous, dessus, sinon dans un coin). */
function placerTuto() {
  const et = etapeTuto();
  if (!et || !S) { voileTuto.hidden = true; bulleTuto.hidden = true; return; }
  document.body.classList.add("tuto-actif"); menuTuto(!!et.menuLarge);
  const ch = TUTO[tuto.ch], n = ch.etapes.length, dernier = tuto.i === n - 1, suivantCh = TUTO[tuto.ch + 1];
  // une cible dans un menu replié (ex. réglages d'un suivi) : on le déplie
  const dansMenu = document.querySelector(et.cible); if (dansMenu) { const dt = dansMenu.closest("details:not([open])"); if (dt) dt.open = true; }
  const cible = [...document.querySelectorAll(et.cible)].find(e => e.getClientRects().length);
  const cle = tuto.ch + "." + tuto.i;
  if (cible && tutoScroll !== cle) {      // après le changement de page (qui remonte en haut), on amène la cible à l'écran
    tutoScroll = cle;
    requestAnimationFrame(() => { const c = [...document.querySelectorAll(et.cible)].find(e => e.getClientRects().length); if (c && etapeTuto() === et) { c.scrollIntoView({ block: "center", inline: "nearest" }); placerTuto(); } });
  }
  bulleTuto.innerHTML = `<div class="tb-tete" title="Déplacer la bulle\nGlissez-la par ce bandeau pour voir ce qu’elle cache."><span>${esc(ch.titre)} · étape ${tuto.i + 1} sur ${n}</span><button type="button" class="ghost" data-tuto="quitter" aria-label="Quitter le tutoriel" title="Quitter le tutoriel\nVous le reprendrez où vous en étiez.">✕</button></div>
    <div class="tb-points" aria-hidden="true">${ch.etapes.map((_, k) => `<i class="${k < tuto.i ? "fait" : k === tuto.i ? "ici" : ""}"></i>`).join("")}</div>
    <h3>${esc(et.titre)}</h3>
    <p><b>À quoi ça sert :</b> ${esc(et.but)}</p>
    <p class="tb-faire"><b>À faire :</b> ${esc(et.faire)}</p>
    ${cible ? "" : `<p class="tb-absent">Cet élément n’est pas affiché ici pour l’instant (liste vide, ou rien de créé) : lisez l’explication, puis passez à la suite.</p>`}
    <div class="tb-boutons"><button type="button" data-tuto="prec" ${tuto.i ? "" : "disabled"}>← Précédent</button><span class="spacer"></span>
      ${dernier ? (suivantCh ? `<button type="button" data-tuto="fin">Terminer</button><button type="button" class="primary" data-tuto="chap">Chapitre suivant : ${esc(suivantCh.titre)} →</button>` : `<button type="button" class="primary" data-tuto="fin">Terminer</button>`)
      : `<button type="button" class="primary" data-tuto="suiv">Suivant →</button>`}</div>`;
  typoNoeuds(bulleTuto); bulleTuto.hidden = false;
  const W = innerWidth, H = innerHeight, bw = Math.min(380, W - 24); bulleTuto.style.width = bw + "px";
  const bh = bulleTuto.offsetHeight;
  const garderPlace = () => { if (bulleBougee && bulleBougee.cle === cle) { bulleTuto.style.left = Math.min(Math.max(4, bulleBougee.x), W - bw - 4) + "px"; bulleTuto.style.top = Math.min(Math.max(4, bulleBougee.y), H - bh - 4) + "px"; return true; } return false; };
  if (!cible) { voileTuto.hidden = false; voileTuto.className = "plein"; voileTuto.style.cssText = ""; bulleTuto.style.left = (W - bw) / 2 + "px"; bulleTuto.style.top = Math.max(12, (H - bh) / 2) + "px"; garderPlace(); return; }
  const r = cible.getBoundingClientRect(), m = 6;
  const x = Math.max(4, r.left - m), y = Math.max(4, r.top - m), x2 = Math.min(W - 4, r.right + m), y2 = Math.min(H - 4, r.bottom + m);
  voileTuto.hidden = false; voileTuto.className = "";
  voileTuto.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, x2 - x)}px;height:${Math.max(0, y2 - y)}px`;
  let left, top;
  if (y2 + 12 + bh <= H) { top = y2 + 12; left = r.left; }
  else if (y - 12 - bh >= 0) { top = y - 12 - bh; left = r.left; }
  else if (x2 + 12 + bw <= W) { left = x2 + 12; top = r.top; }
  else if (x - 12 - bw >= 0) { left = x - 12 - bw; top = r.top; }
  else { left = W - bw - 16; top = H - bh - 16; }        // grande cible : bulle dans un coin
  bulleTuto.style.left = Math.min(Math.max(12, left), W - bw - 12) + "px";
  bulleTuto.style.top = Math.min(Math.max(12, top), H - bh - 12) + "px";
  garderPlace();
}
/* La bulle se déplace en la glissant par son bandeau ; elle garde cette place jusqu'à l'étape suivante. */
let bulleBougee = null, glisseBulle = null;
bulleTuto.addEventListener("pointerdown", e => { const t = e.target.closest(".tb-tete"); if (!t || e.target.closest("button") || !tuto) return;
  const r = bulleTuto.getBoundingClientRect(); glisseBulle = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bulleTuto.classList.add("glisse"); e.preventDefault(); });
addEventListener("pointermove", e => { if (!glisseBulle || !tuto) return; bulleBougee = { cle: tuto.ch + "." + tuto.i, x: e.clientX - glisseBulle.dx, y: e.clientY - glisseBulle.dy };
  bulleTuto.style.left = Math.min(Math.max(4, bulleBougee.x), innerWidth - bulleTuto.offsetWidth - 4) + "px"; bulleTuto.style.top = Math.min(Math.max(4, bulleBougee.y), innerHeight - bulleTuto.offsetHeight - 4) + "px"; });
addEventListener("pointerup", () => { if (glisseBulle) { glisseBulle = null; bulleTuto.classList.remove("glisse"); } });
apresRendu.push(() => { if (tuto) placerTuto(); });
addEventListener("resize", () => { if (tuto) placerTuto(); });
addEventListener("scroll", () => { if (tuto) placerTuto(); }, true);
bulleTuto.addEventListener("click", e => {
  const b = e.target.closest("[data-tuto]"); if (!b || !tuto) return;
  const a = b.dataset.tuto;
  if (a === "quitter") quitterTuto(false);
  else if (a === "prec") allerEtape(tuto.ch, tuto.i - 1);
  else if (a === "suiv") allerEtape(tuto.ch, tuto.i + 1);
  else if (a === "chap") allerEtape(tuto.ch + 1, 0);
  else if (a === "fin") quitterTuto(true);
});
document.addEventListener("keydown", e => { if (tuto && e.key === "Escape" && !e.defaultPrevented && !document.querySelector("#boite[open]") && !document.querySelector("details.menu[open]")) quitterTuto(false); });
/** Choix du chapitre (et, sans suivi ouvert, de la démonstration ou d'un suivi vierge), puis départ. */
async function lancerTuto() {
  const enCours = tutoEnCours();
  const html = `<div class="tuto-choix">
    ${enCours ? `<label class="tc"><input type="radio" name="tuto-ch" value="reprendre" checked><span><b>Reprendre où j’en étais</b><small>${esc(TUTO[enCours.ch].titre)}, étape ${enCours.i + 1} sur ${TUTO[enCours.ch].etapes.length}</small></span></label>` : ""}
    ${TUTO.map((c, k) => `<label class="tc"><input type="radio" name="tuto-ch" value="${k}" ${!enCours && k === 0 ? "checked" : ""}><span><b>${k + 1}. ${esc(c.titre)}</b><small>${esc(c.sous)} · ${c.etapes.length} étapes</small></span></label>`).join("")}
    ${S ? "" : `<div class="tc-base"><b>Sur quelles données ?</b><label><input type="radio" name="tuto-base" value="demo" checked> La démonstration (conseillé pour découvrir)</label><label><input type="radio" name="tuto-base" value="new"> Un nouveau suivi vierge (pour le préparer en suivant les étapes)</label></div>`}</div>`;
  const choix = await saisir("Tutoriel de prise en main", "Le tutoriel vous guide pas à pas : l’endroit concerné est éclairé, une bulle explique à quoi il sert et quoi faire. Les chapitres suivent l’ordre de prise en main.", {
    html, lire: d => ({ ch: (d.querySelector('input[name="tuto-ch"]:checked') || {}).value, base: (d.querySelector('input[name="tuto-base"]:checked') || {}).value }) }, { ok: "Commencer" });
  if (!choix || choix.ch === undefined) return;
  if (!S) { if (choix.base === "new") await doNew(); else await doDemo(); if (!S) return; }
  if (choix.ch === "reprendre" && enCours) allerEtape(enCours.ch, enCours.i); else allerEtape(Number(choix.ch), 0);
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-act="tuto"], #b-tuto'); if (!b) return; const m = document.querySelector("#m-file"); if (m) m.open = false; lancerTuto(); });
