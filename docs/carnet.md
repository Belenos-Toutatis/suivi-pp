# Observations : carnet, remarque, contacts, MBN

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

### Relevés de carnet — le cumul est la seule vérité stockée

⚠️ **`counts[sid]` est le TOTAL lu dans le carnet, jamais un incrément** (un delta obligerait à soustraire de tête, et une saisie oubliée deviendrait indétectable).

- **L'évolution est CALCULÉE, jamais stockée** : `delta = n − dernier cumul connu strictement antérieur`, en **sautant les `'A'`** et les vides. Premier relevé d'un élève → le delta vaut le cumul.
- ⚠️ **Un cumul qui DIMINUE est signalé, jamais corrigé** (faute de frappe probable, mais ce peut être un carnet remplacé) : repère sur la cellule, infobulle de l'attendu, rien n'est réécrit.
- **`'A'` n'est ni `0` ni le vide** : `0` = carnet vu, rien noté ; `''` = pas relevé ; `'A'` = élève absent. Trois affichages et traitements distincts dans le delta. Convention `codeAbsent` de Plan de classe : code **paramétrable**, aucun texte visible ne l'écrit en dur (cf. `_codeA()` là-bas).
  - ⚠️ Un code « absent » **numérique** (« 5 ») est refusé par `setPref` (saisir le cumul 5 noterait absent) : toast, le code d'avant reste.
- La clé est **la date** : pas de doublon, tri gratuit. Corriger une date = déplacer l'entrée via `releveSetDate`, qui refuse d'écraser une date existante.
- **Paliers de couleur** : `S.prefs.obsPalier` (5 par défaut, 0 à 100, **0 = sans couleurs**, réglé dans 💾 Données). `_obsBande(n)` = `floor(n / palier)`, plafonné à `OBS_BANDES` = 8 (« 40 et + ») ; 0 sous le premier palier = pas de couleur ; seul un NOMBRE a un cran. Tokens `--obs-1…8` / `--obs-N-fg` aux trois endroits, jaune pâle → prune, **luminance décroissante** (l'ordre survit au noir et blanc), encre blanche aux deux derniers crans. Couleur posée sur le **champ** (`.ob-N .rel-inp`), pas la case (le Δ garde son encre). Affichée dans la grille (légende `_obsLegendeHTML`), la feuille imprimée, la colonne *Observations* de la liste (`.ob-chip`), la fiche, et le cumul de fin de période de la synthèse de période (tableau, fiches, légende au sous-titre).
- **Impression** (🖨, Ctrl+P → modale `mcarprint`, jamais directe) : année ou période, couleurs des paliers, évolution à côté du cumul, colonne Δ dernier, totaux de période, paysage / portrait, A4 / A3. Feuille `.pp-t.pp-car` (`_carnetFeuilleHTML`), mêmes lignes et tri que l'écran (`_carnetRows`, extrait de `renderCarnets`), taille calculée pour UNE page (`_printFitMeasure`). Réglages de session `_carPrintOpts`, rien dans `S`. Δ dernier d'une feuille d'une période borné à ses dates (`_carnetLastDelta(classId, sid, dates)`).
  - ⚠️ **Un Δ nul ne s'imprime pas** : « 3 0 » se lit « 30 ».
  - ⚠️ La couleur de palier doit battre la rangée grisée : `.pp-t.pp-car tbody td.ob-N` (0,3,2) contre `.pp-t tbody tr:nth-child(even) td` (0,2,3).
- **Total de période** = `cumul(dernier relevé de la période) − cumul(dernier relevé d'avant la période)`. ⚠️ Ne PAS additionner les cumuls (chaque observation serait comptée autant de fois qu'il y a eu de relevés).

### Remarque, journal des contacts, date de naissance

- **Remarque** (`stu.remarque`) : texte libre multi-ligne, sans date (la colonne « Remarque » du tableur), fenêtre `mrem` (*Remarque — texte libre*, Ctrl+Entrée enregistre). « Observations » reste un synonyme d'en-tête reconnu à l'import pour cette colonne, jamais un libellé affiché.
- **Journal des contacts** (`stu.journal = [{ id, date, ts, type, texte }]`, types `appel · rencontre · courriel · mot · autre`) : sa propre fenêtre `mcontacts` (`openContacts`), ouverte par la colonne **Contacts** de la liste (☎ n) et par la fiche ; ajouter, corriger date, type (`journalSet`) et texte (`journalEditUI` — un texte inchangé à des espaces près n'empile pas de Ctrl+Z), 🗑. `_MODAL_RERENDER` redessine `mcontacts`.
  - ⚠️ **Le journal ne REMPLACE pas `stu.remarque`** : une observation qui n'est pas un contact (« peu d'apprentissage des leçons ») n'a pas de date et n'en veut pas. Deux fenêtres séparées (arbitré par l'utilisateur).
  - Le dernier contact remonte dans la liste des élèves et sur son impression (« ai-je déjà appelé, et quand ? »).
  - **Fichiers joints** (v1.78.0, demandé : *« joindre un fichier ou deux — la retranscription d'une conversation téléphonique, d'un échange de mails »*) : `e.pj = [{ nom, fichier, taille }]` (absent = aucun, `PJ_CT_MAX` = 5), **copiés** dans le sous-dossier **`contacts/`** du dossier des pièces jointes (`CONTACTS_SUBDIR`, `_pjCtDir`), jamais dans le JSON. Comme les PDF des incidents : nom choisi avant la copie (`pjChooseName(original, auto, ext)` : *type · qui · date*, l'extension du fichier gardée — `_pjSafeName(nom, origine, ext)`), un échec de copie ne retire pas l'entrée, **l'app n'efface jamais un fichier** (détacher ou supprimer le contact le laisse ; 🧹 Orphelins… regarde aussi `contacts/`, `_pjCtReferences` — tout ce sous-dossier est à l'app, donc rien d'autre n'y est proposé à la suppression).
    - Joindre : *📎 Fichiers…* dans la barre de saisie (joints par *+ Noter*, `_journalAddAvecPj`) ou *📎 Joindre* sous le texte d'un contact (`journalPjAjouterUI`) ; ✕ détache (`journalPjRetirerUI`, Ctrl+Z le rattache). Modèle pur : `journalPjAdd` (sans doublon, borné), `journalPjRemove`, `_journalPj` ; `postLoadHook` écarte les références illisibles.
    - **Tout format** ; lecture (`pjOpen(ref, 'contacts')`, `_pjSorte`) : PDF et image dans le lecteur, texte (.txt, .md, .eml…) en `<pre>` dans un cadre `sandbox` (`srcdoc`, UTF-8 puis 1252), page HTML dans le même cadre SANS script, le reste (Word, ODT…) : *⬇ Enregistrer* (`pjEnregistrer`, aussi pour les PDF). ⚠️ Un HTML ou un SVG ouvert par une URL de blob de l'app tournerait avec SON origine et lirait ses données : jamais d'onglet pour eux, le SVG n'est pas une image ici (vérifié dans Chrome : le script d'une page jointe ne s'exécute pas).
    - Vus aussi dans la fiche (carte Contacts, chronologie : liens `_journalPjLiensHTML`), la liste de la carte de chaleur (« 📎 n ») et la fiche imprimée (« joint : … »). Pas dans la démo (ce sont des fichiers). Tests : `test/contacts-pj.test.js`.
- **Date de naissance** (`stu.naissance`) : saisie à la main, reconnue à l'import CSV et reprise de Plan de classe ; elle permet le départage automatique par l'âge aux élections. ⚠️ Donnée personnelle de plus : citée dans le texte RGPD ; champ **facultatif** — sans elle, l'app demande de trancher.

#### Remarque mise en forme (v1.80.2)

Demandé le 2026-10-30 : *« mettre des choses en gras, décaler un paragraphe, faire des listes — la solution la plus
simple »*. **Markdown réduit, pas de texte riche** : `stu.remarque` reste une chaîne (rien à migrer, rien de neuf dans
`S`, sync et exports inchangés, pas de HTML stocké donc rien à assainir), mise en forme à l'AFFICHAGE par `_mdMini`
(tout passe par `_escName` d'abord) : `**gras**`, ligne « - » / « * » / « • » = puces, « 1. » / « 1) » = numérotée,
« > » en tête (répétable), une tabulation ou deux espaces = un cran de décalage (4 au plus, `.md-r1…4`), ligne vide =
nouveau paragraphe. Barre d'outils au-dessus des deux éditeurs (fiche ✎ et fenêtre `mrem`, `_mdBarreHTML` /
`mdOutil` / `_mdAppliquer` pur : G, •, 1., ⇥, ⇤ ; un même bouton retire la liste ; Ctrl+B = gras, `mdTouche`).
Rendue dans la fiche (trois vues), l'ancienne fiche et la fiche imprimée ; en une ligne (`_mdTexte` : marques
retirées, « • » devant les puces) dans la cellule de la liste, son infobulle et la grille imprimée. ⚠️ Vers l'IA, la
remarque part en `_mdTexte` : « **Changé » ou « > Idée » passaient pour des majuscules en milieu de phrase (noms
suspects). Démo : la remarque du dixième élève. Tests : `test/remarque-md.test.js`.

**Le compte rendu d'un contact** (v1.80.3, *« la même chose pour le compte rendu d'un contact avec la famille »*) :
même markdown. Fenêtre des contacts : UNE barre au-dessus de la saisie, qui agit sur le champ où est le curseur
(`_mdBarreHTML('@')`, nouveau contact ou contact de la liste ; les boutons ne prennent pas le focus) ; Ctrl+B dans chaque
champ. ⚠️ Un champ qui s'enregistre en le quittant (`onchange`) : le navigateur ne compte pas un changement fait par le
script, d'où `data-md-touche` et un `change` relancé au `focusout`. Rendu par `_mdMini(texte, true)` : un seul
paragraphe sans décalage reste EN LIGNE après « appel téléphonique · » (`.md-l`), une liste ou un décalage fait un bloc
— carte de la fiche, chronologie, fiche imprimée ; en une ligne (`_mdTexte`) dans les infobulles, la liste des contacts
d'une case, et vers l'IA. Démo : la rencontre du 12/03 du premier élève.

**Les champs grandissent avec leur texte** (v1.80.3, *« la fenêtre d'édition est des fois un peu petite, elle ne
s'allonge pas avec le texte »*) : classe `ta-auto` (`field-sizing: content`, au moins ~6 lignes, `ta-court` ~3) +
`_autoTaille` à la frappe et à l'ouverture (mesurée une fois la fenêtre visible) — remarque (fiche et fenêtre), bilan et
décisions de la fenêtre du bilan, texte d'un incident. Les contacts (`jl-txt`) et le bilan de la fiche (`pf-ta`) le
faisaient déjà ; les champs des fenêtres 🤖 gardent leur grande taille fixe (texte à relire).

**Décisions, incidents, heures de vie de classe** (v1.80.4, *« ajoute-la aux trois endroits »*) : même markdown.
Barre et Ctrl+B dans chaque éditeur — décisions de la fiche (`fi-dec`) et de la fenêtre du bilan (`mbilan-dec`, barre
posée par `_bilanDecCharge`), texte d'un incident (`minc-txt`, barre posée par `openIncident`), compte rendu d'une heure
de vie de classe (`hvc-txt`, qui grandit aussi : `ta-auto ta-court`). Rendu : `_mdMini(…, true)` là où le texte suit un
libellé sur la même ligne (décisions sous les autres moments, chronologie, synthèse de période, impression d'une heure
de vie de classe), `_mdMini` en bloc ailleurs (« Décisions · à mettre en place » imprimé, texte d'un incident, liste des
heures de vie de classe) ; `_mdTexte` dans les infobulles, l'aperçu d'une partie repliée et tout ce qui part vers l'IA
(élève et classe). L'infobulle de la frise met un espace entre les blocs (sinon « comportement.rendez-vous »). Le
détecteur de noms de l'IA (`_iaSuspects`) tient « / » pour un début de phrase : c'est ainsi que `ligne()` met à plat un
saut de ligne. Démo : décision du conseil S1 du onzième élève, commission éducative du 05/02, heure de vie de classe du
05/09.

### Observations notées dans MBN — la seconde source

Les observations sont notées à deux endroits (carnet de correspondance et MBN, saisies par des collègues) ; l'app tient le compte des deux. Export MBN : `Élève · Civilité · Classe · Type · Motif · Demandeur · Donnée le · Informations complémentaires`, une ligne par observation, « Donnée le » en **nombre de série** Excel dans le .xlsx.

- ⚠️ **Deux modèles SÉPARÉS** : carnet = cumul relevé (`S.releves`), MBN = événements datés (`stu.obsMbn`) qu'on **compte** sur une période (`_obsMbnEntre`). Affichés côte à côte, jamais fondus (une même observation peut être notée aux deux endroits). Seule la grille donne leur somme (colonne *Carnet + MBN* de la période courante).
- **Import** (`openObsMbnImport`, modale `mobsmbn` ; bouton *📥 Observations MBN…* de l'onglet Observations et 💾 Données) : `_tableurLire` → `_obsMbnLire` (colonnes par EN-TÊTE ; `_obsMbnDate` lit nombre de série, « jj/mm/aaaa hh:mm » et ISO ; ligne sans date lisible écartée et nommée) → `_mbnRapprocher` (rien n'est deviné, rattachement manuel **par nom**, « ignorer » par défaut) → `_obsMbnBilan` (pur) → `_obsMbnAppliquer` (un cran d'undo).
  - ⚠️ **Réimporter n'ajoute que le nouveau** : reconnaissance par `date · heure · type · motif · demandeur · texte` (normalisés), en **multiensemble** (deux identiques à la même minute restent deux).
  - ⚠️ **Une observation de l'app absente de l'export** (dans ses dates) est proposée au retrait, **jamais cochée d'office**. Retrait manuel possible (✎ de « Notées dans MBN », `obsMbnRemove`).
- **Où on les voit** :
  - onglet Observations : colonne *MBN S1* par période (cliquable vers la fiche, détail en infobulle), *Carnet + MBN*, tri « par observations MBN » ;
  - liste des élèves : colonne **Observations** = TOTAL de l'année (carnet + MBN, `_syntheseRow` : `mbnAn`, `obsTotal`) à la couleur du palier, puis « carnet n · MBN n » ; tri et papier (« 14 (11 + 3 MBN) ») suivent le total ; sans MBN rien ne change. « **+n S2** » = gain sur la période courante, carnet ET MBN ; ▼ pour un cumul du carnet en baisse ; courbe `_elevesSpark(cls, sid)` = miniature de celle de la fiche (carnet + MBN, du 1er septembre à aujourd'hui, à l'échelle du temps) ;
  - **📅 « depuis quand »** dans l'en-tête Observations (`_obsFenetrePickHTML`, `OBS_FENETRES` : 1 ou 2 semaines, 1 ou 2 mois, début de période), propre au POSTE (`localStorage` `suiviPP_obsDepuis`) ; `_obsFenetre(cls, cle, auj)` (pur) : fin = aujourd'hui ramené dans l'année scolaire (une année passée comme la démo finit au 31 juillet), début selon la durée, jamais avant la rentrée ; `_obsGagnees` = carnet sur la fenêtre (`_obsEntre`) + MBN. Le « +n », le filtre **« Observations +3 ou plus »** et la colonne « +n » imprimée suivent cette durée ;
  - carte de chaleur : groupes *Observations du carnet*, *Observations MBN* (une case par mois), *Total des observations* ; fiche (carte Carnet, *Notées dans MBN*, fait insérable dans le bilan, chronologie, chiffre clé) ; synthèse de période (« · MBN n ») ;
  - feuille imprimée du carnet : case *Observations MBN par période* de `mcarprint` (`_carPrintOpts.mbn`) : Carnet · MBN · Carnet + MBN (somme seulement avec les totaux), dit au sous-titre.
- **Carte Observations de la fiche** (Carnet seul si la classe n'a rien dans MBN) : `_ficheCourbePoints` (pur) trace, à chaque relevé chiffré et chaque jour d'observation MBN, cumul du carnet (0 avant le premier relevé) + MBN depuis le début de l'année, selon les sources cochées ; la courbe dit ce qu'elle additionne. Dessous, *Relevés du carnet* et *Notées dans MBN*, chacun avec sa coche (`_ficheCourbeSrc`, de séance, toutes fiches ; `ficheCourbeSrcUI`).
  - La courbe s'arrête à `_ficheCourbeFin` (pur) : date du bilan écrit pour le moment choisi, sinon aujourd'hui, bornée à la période (axe, mois, zone du moment, repère de mi-période, légende « jusqu'au 20/01 (bilan) »).
  - Elle commence au 1er septembre (`_debutUtile`, aussi pour la frise de la chronologie et les mois de la carte de chaleur) : rien ne se passe en août.
- `postLoadHook` écarte les entrées illisibles et retire un champ qui n'est pas un tableau (jamais créé d'office). Rien à purger à part. Démo : onze observations MBN sur cinq élèves.

#### Récapitulatif vie scolaire de MBN (PDF)

⚠️ **L'export .xlsx MBN exige des droits d'administrateur** que l'utilisateur va perdre. La session ordinaire donne un tableau *Observations* par fiche élève et un **récapitulatif PDF** de la classe (absences, retards, observations, punitions) : c'est la source de l'import PDF.

- **🔍 Décrire un fichier sans ses données** (💾 Données ▸ Importer · exporter) sert à écrire un lecteur SANS voir de données d'élèves.
  - ⚠️ Un choix « lisible » ne se propage aux autres pages qu'au **MÊME texte** (par la position, l'en-tête « Motif » rendait lisible un motif d'absence d'une autre page) ; masquer ou nommer le contenu se propagent par la position. Les mots laissés en clair d'office n'ont ni particules ni lettres isolées (elles trahissaient « DE LA » ou une initiale).
  - ⚠️ **Ne jamais demander le fichier lui-même, ni une capture** : la description masquée suffit ; une fixture INVENTÉE (même mise en page, noms fictifs) sert aux tests.
- **Mise en page** : UNE page par élève (pied « Page n sur n »), A4, une photo ; nom en 12 pt à x = 33 mm (« Prénom NOM »), « nn ans - jj/mm/aaaa », Classe, Groupes (codes Pronote), Régime de ½ pension, Régime de sortie ; « Évènements du … au … » (période choisie à l'édition : elle borne ce que l'import peut retirer) ; résumé (absences · retards · observations · punitions · dispenses, à 46, 86, 126, 166 mm) ; « Motifs d'observation » (« Motif (n) » ou « Aucune observation »), semaine type, puis un tableau par sorte d'événement (« Retards », « Absences » : Période · Régularisé · Motif · Valable · Séances impactées · Durée · Comptabilisé ; « Le jj/mm/aaaa, de hh:mm à hh:mm », « Du … au … » sur deux lignes). *Observations* = Date (« 9 sept. 2025 ») · Motif · Type (« Négatif », « Positif ») · Demandeur — **ni heure ni informations complémentaires** ; *Punitions* = Date de l'évènement · Conséquence · Motifs · État · Demandeur.
- **📄 Import du récapitulatif** (`openRecapImport`, fenêtre `mrecap` ; depuis la fenêtre des observations MBN — *Sans accès à cet export ?* — et 💾 Données ▸ Importer · exporter). Arbitré : observations, punitions → incidents, absences et retards, complément de fiche ; **PAS les dispenses**. Lecture pure : `_recapPages` (lecteur PDF de l'app, `_trombiLines(…, 0.6)`) → `_recapLire` :
  - positions en mm depuis le haut ; un élève par page à en-tête (nom ≥ 10,5 pt dans les 16 premiers mm) ; une page sans en-tête est la SUITE du précédent ; une page dont l'en-tête REDIT le même nom aussi (on saute identité, résumé et semaine répétés, jusqu'à un titre de section, une ligne d'en-têtes de colonnes — lignes juste au-dessus comprises, « Séances » sur « impactées » — ou une rangée qui commence par une date) ;
  - une section = un titre SEUL sur sa ligne en 8 pt ; rangées groupées en événements par l'écart vertical : **< 4,2 mm = le même événement** (case sur deux lignes), ≥ 5 mm entre deux ; le premier paquet sans chiffre = en-têtes, leurs positions font les colonnes ;
  - dates : `_recapDateFr` (mois abrégés), `_recapPeriode`, `_recapDuree`.
  - Puis `_recapBilan` (revue) et `_recapAppliquer` (un cran d'undo) :
    - **observations** → `stu.obsMbn`, type « Observation négative / positive » ; ⚠️ reconnues par **date + motif** seulement (ni heure ni texte dans le PDF) : une observation de l'export .xlsx n'est pas reprise deux fois ;
    - **punitions** → incidents (`_recapInstance` : Retenue, Exclusion ponctuelle de cours, Devoir supplémentaire…, sinon « Autre punition » ; objet = motif ; texte = état, demandeur, source), cochées une par une, « déjà dans l'app » si même date, instance et objet (deux identiques = deux cases) ;
    - **absences et retards** → `stu.absMbn`, reconnus par sorte + bornes ; un réimport **met à jour** le reste (une absence se régularise) ; fin illisible ramenée au début ;
    - **fiche** : naissance, demi-pension, régime de sortie, groupe (code GPn), options (autres codes, créées au catalogue si besoin) — **seulement les champs VIDES**, un par un.
  - ⚠️ Un retrait (observation ou absence absente du PDF) n'est proposé que DANS la période du récapitulatif et pour un élève qui y figure, jamais coché d'office. Noms non reconnus : rattachement manuel (« ignorer » par défaut).
  - ⚠️ **Homonymes** : `_mbnRapprocher` départage deux homonymes de la classe par la date de naissance quand la ligne en porte une (celle du PDF) et qu'elle désigne UN SEUL élève ; sinon rien n'est deviné. Le rattachement manuel du récapitulatif est indexé par la **PAGE** (`l.page`), jamais par le nom.
  - ⚠️ Deux HOMONYMES sur deux pages consécutives sont deux élèves si les dates de naissance des en-têtes diffèrent (sans date d'un côté : la suite). `_recapInstance` borne le mot « colle » (« collectif », « collégien » ne sont pas des retenues).
- **Où l'on voit les absences** : colonne **Absences** des Indicateurs (période courante, « 🕒 2 abs. · 5 h · 1 ret. », rouge s'il y a du non valable ; clic → `absencesUI` ; seulement si la classe en a), vues *Préparer le conseil* et *Appeler les familles* (« abs » ne compte pas pour reconnaître une vue enregistrée), carte *Absences et retards* de la fiche (bornée au moment), synthèse de période, fiche imprimée, **carte de chaleur** (groupe *Absences et retards*, un mois par case + Total, rouge si non valable, case remplie → liste, case vide inerte). Calcul pur `_absMbnResume` : un événement compte dans la période où il commence ; demi-journées NON calculées (non déductibles). « non valable » gardé dans le texte court (`_absMbnTexte(e, true)`). Démo : dix absences et retards.
- Fixture `test/fixtures/recap-mbn-invente.pdf` (`scripts/gen_recap_fixture.py`, noms inventés). ⚠️ **Vérifié sur la seule fixture** : le vrai fichier est à essayer par l'utilisateur (la revue montre tout avant d'appliquer).
