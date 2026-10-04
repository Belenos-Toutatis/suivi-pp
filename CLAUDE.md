# Suivi PP — Contexte projet

## Application

PWA **mono-fichier** de suivi des élèves dont l'utilisateur est **professeur principal**.
Quatre besoins, dans cet ordre d'importance :

1. **Relevés de carnet** — combien d'observations chaque élève a dans son carnet, à différentes dates de l'année.
2. **Documents administratifs** — qui m'a rendu quoi, et quand.
3. **Réponses portées sur ces documents** — le choix de la famille (participation à Devoirs Faits, options d'orientation…), avec un **avis du PP** quand il y en a un.
4. **Élection des délégués de classe** — candidatures, dépouillement, procès-verbal.

Plus, depuis le 2026-09-29 : **5. Moyennes par matière** — l'export du bureau numérique,
réimporté au fil de la période pour en suivre l'évolution (cf. *Moyennes par matière*).

L'utilisateur est enseignant de physique-chimie au collège, PP d'une classe de cycle 4. Il est l'auteur et l'unique utilisateur de l'app.

### Ce que l'app remplace — à lire AVANT de concevoir quoi que ce soit

Le suivi existe déjà, en tableur, dans `../PP/`. **Ces fichiers sont la spécification réelle** ; les lire vaut mieux que toute supposition :

- **`../PP/5C PP.xlsx`**, feuille `Papiers_2` — la source principale. Colonnes :
  `Position · Nom · Prénom · DF · Observation 01/10/2024 · Observation 15/10/2024 · … (8 dates) · Remarque · Colonne1`,
  plus `Fiche de renseignement` et `Fiche d'orientation` marquées `X`.
- **`../PP/DF 5C.ods`** — `Classe · Nom · Prénom · DF` avec les valeurs **`OUI` / `NON` / `ULYSS`**.
- **`../PP/élection délégués.xlsx`** — le dépouillement : 4 feuilles (`1er tour` · `Résultats 1er tour` · `2nd tour` · `Résultats 2nd tour`), **une ligne par bulletin numéroté**, **une colonne par binôme** (titulaire en ligne 1, suppléant en ligne 2), et on coche.
- **`../PP/délégué election.md`** (+ `.html`, `délégué role.md`, `5c délégué.pdf`, `5e élections délégués 2025.pdf`) — la présentation Marp projetée à la classe avant le vote. **Elle énonce la procédure exacte de l'utilisateur** : c'est la spécification de l'onglet Délégués.
- **`../PP/options rentrée 2026.xlsx`**, feuille `demandes options` — `DIV · NOM · PRENOM · option 1 demandée · Avis PP option 1 · option 2 demandée · Avis PP option 2 · OPT1 actuelle · OPT2 actuelle`. Options observées : `LATIN`, `BILINGUE`, `CATHO F`, `DNL`…

Quatre enseignements tirés de ces fichiers, tous structurants :

1. ⚠️ **Le nombre d'observations relevé est un CUMUL, pas un incrément.** Vérifié colonne par colonne : les valeurs d'un même élève sont monotones non décroissantes (`7 · 8 · 8 · 10 · 11 · 14 · 16 · 18`, `10 · 13 · 14 · 14 · 15 · 20 · 27 · 38`). L'utilisateur lit un total dans le carnet ou dans Pronote et le recopie. **Toute la conception du modèle en découle** (cf. *Relevés de carnet*).
2. ⚠️ **Le tableur ne calcule PAS l'évolution** — c'est précisément ce que l'app doit apporter : « combien depuis le dernier relevé ». Un cumul de 38 ne dit rien sans savoir qu'il était à 27 il y a trois semaines.
3. Certaines cellules d'observation valent **`A`** = élève absent au moment du relevé, donc rien à relever. À distinguer d'un zéro et d'un vide.
4. La colonne `Remarque` contient du **texte libre multi-ligne**, et notamment le journal des contacts : *« Peu d'apprentissage… Appel à la mère le 11/10/2024 et le 29/11/2024 »*. Le besoin d'un mot libre par élève est donc réel, indépendamment des documents.

### Décisions déjà arbitrées avec l'utilisateur (2026-09-09)

| Question | Réponse |
|---|---|
| Origine des élèves | **Import CSV/Pronote autonome** (module repris de Plan de classe) **+** lecture d'un export JSON de Plan de classe |
| Modèle des observations | **Compteur par date** (pas une entrée par observation) |
| Réponses des documents | **Rendu / pas rendu + date de retour**, **choix unique** dans une liste paramétrable, **choix multiple** |
| Hébergement | **Nouveau dépôt GitHub séparé** — origine distincte, donc `localStorage` et service worker propres |
| Périodes (2026-09-09) | **Au choix de l'utilisateur** : `prefs.periodMode` = `'semestre'` (défaut) ou `'trimestre'`, réglable dans Données. Rien n'est stocké par période, tout se recalcule. |
| Bornes de période (2026-09-09) | `prefs.periodStarts = { semestre: ['02-01'], trimestre: ['12-01','03-15'] }` — début des périodes 2 et 3 en `MM-DD`, défauts à confirmer avec le calendrier de l'établissement. L'année scolaire va du 1er août au 31 juillet. |
| Ramassage (2026-09-09) | On ramasse plusieurs documents **en même temps**, donc on doit pouvoir valider les retours **sur un seul écran**. Grille élèves × documents dans l'onglet Documents, une case par croisement. ⚠️ La case a **trois** états, pas deux : rendu, pas rendu, et **sans objet** (l'élève n'était pas là à la date du document). Seul le retour se coche ici — les réponses portées sur le papier restent dans le tableau du document. |
| Données de démo (2026-09-09) | Posées **au premier lancement** (aucune sauvegarde locale — pas seulement « aucune classe » : sinon la démo reviendrait après chaque effacement), rechargeables et effaçables depuis 💾 Données. Année scolaire = celle d'« aujourd'hui − 10 mois », donc **toujours entièrement passée** : sans ce recul, relevés et échéances tomberaient dans le futur et la moitié des signalements ne se verrait jamais. |
| Branches et versions (2026-09-10) | **Un seul projet, une seule version.** Le travail atterrit sur `main`, qui est la version — pas de branche de fonctionnalité qui vit à côté, pas de PR à fusionner plus tard. `APP_VERSION` avance à chaque livraison. ⚠️ Corollaire : la barre de qualité est à tenir **avant** de pousser (tests verts, audit de contraste rejoué), puisqu'il n'y a pas de sas de relecture. ⚠️ **Et « tests verts » se VÉRIFIE, il ne se lit pas dans un tuyau** : le 2026-09-11, `npm test 2>&1 \| grep -E "pass\|fail" && git commit … && git push` a poussé un fichier de test cassé (`cf69ee7`) — `grep` trouvait la ligne « fail 1 », donc réussissait, et le commit s'enchaînait. Le commit se fait dans une commande SÉPARÉE, après avoir lu le résultat. |
| Postes de travail (2026-09-10) | **Plusieurs machines, jamais en même temps** — elles ne sont pas au même endroit, donc travailler sur l'une signifie ne pas travailler sur l'autre. Le risque d'écriture concurrente est donc écarté par l'usage, pas par un verrou. ⚠️ Reste le cas asynchrone : refermer un portable avant la fin d'un téléversement, puis reprendre ailleurs. C'est pourquoi le dépôt sort de la sync (ci-dessous). |
| Sessions distantes (2026-09-10) | **Écartées.** Une session dans le nuage ferait très bien le code, les tests et la documentation — mais pas les audits qui demandent de REGARDER l'écran (contraste sur 20 états × 2 thèmes, responsive 320→1920). Or ce sont eux qui ont trouvé les défauts 4 et 6, invisibles à tout test. Arbitré par l'utilisateur : *« si tu ne peux plus faire les vérifications qui demandent de regarder l'écran, ça ne m'intéresse pas »*. |
| Moyennes (2026-09-29) | **Demandé par l'utilisateur**, qui lève ainsi « notes et moyennes » du hors-périmètre — mais seulement pour les **LIRE** : l'app importe l'export du bureau numérique, elle ne saisit aucune note et ne recalcule aucune moyenne d'élève. Un import = une photographie datée, gardée ; l'évolution se calcule d'un import au suivant ; les colonnes qui apparaissent s'alignent seules. Statistiques demandées : moyenne, médiane, écart type, nombre sous 10, nombre au-dessus de 10. |
| Import Plan de classe (2026-09-09) | **On ne reprend PAS toutes les classes du fichier** — on est PP d'une seule. L'app liste les divisions (classes virtuelles exclues) et l'utilisateur coche la sienne. |
| Une seule classe (2026-09-11) | **On est professeur principal d'UNE classe.** Le modèle reste multi-classes (une par année, le sélecteur en tête), mais tout ce qui met des élèves en lignes — ramassage, grille imprimée — ne connaît que la classe courante : un document partagé avec une autre division n'y fait pas entrer ses élèves. La garde est dans `_ramRows`, une seule fois. |

Pas de texte libre comme *champ de document* : le mot libre vit sur l'élève (`stu.remarque`), pas sur le formulaire.

## Projet de référence — `plan de classe.html`

Chemin absolu : `/home/ewenner/Nextcloud/gestion élèves/Plan de classe/plan de classe.html` (49 253 lignes, v2.48.0, commit `9956b6b`).
Son `CLAUDE.md` voisin est une mine : il documente ~80 pièges payés au prix fort. **Le lire pour toute question de convention plutôt que de réinventer.**

⚠️ **Règle n° 1 : on COPIE le code de référence, on ne le réécrit pas.** Ces modules ont été audités (contraste, fuzz, rétrocompatibilité, XSS, sync deux postes). Une réécriture « propre » repart de zéro sur tous ces fronts. Copier, renommer les clés `localStorage`, adapter les sections de `S`, garder les commentaires en place.

⚠️ **Les numéros de ligne ci-dessous datent du commit `9956b6b`** et dériveront. Ce sont des repères de départ : chercher par **nom de fonction** (`grep -n "function _impAnalyze"`), jamais par ligne seule.

### À reprendre tel quel

| Module | Fonctions | Lignes (indicatif) |
|---|---|---|
| **Import d'élèves** | `_IMP_FIELDS`, `_impNormHeader`, `_impGuessField`, `_impNormGroupe/Civ/Amen/Date/Tags`, `_impSplitCodes`, `_impStripClassPrefix`, `_impDefaultCodeInterp`, `_impSplitFullName`, `_impSplitLine`, `_impDetect`, `_impGuessFieldFromValues`, `_impAnalyze`, `_impRefresh`, `_impRenderMapping/Codes/Preview`, `_impFileSelected`, `importStudents` | **14612 – 15355** |
| **Sauvegarde & horloge vectorielle** | `save`, `load`, `pushUndo`, `undoLast`, `redoLast`, `_clockBumpSelf`, `_clockBumpForward`, `_clockMergeMax`, `_clockOnLoad`, `_clockCompare` | 9053 – 9300 |
| **Sync auto + conflits** | `autoSaveSchedule`, `autoSaveDoIt`, `autoReloadCheck`, `_versionRelation`, `_contentFingerprint`, `_openConflictModal`, `_conflictKeepMine`, `_conflictTakeOther`, `_stashVersionToFile`, `_applyReloadedData` | 28171 – 28700 |
| **Versions & historique** | `listAndShowFiles`, `loadFromHandle`, `_makeNamedCheckpoint`, `_fileKind`, `_versionSummary`, `_fmtBytes`, rotation des backups | 28865 – 29130 |
| **Dernier fichier chargé (IndexedDB)** | `_idbPut`, `saveLastFile`, `_getLastFileRecord`, `_migrateLastFileToIdb`, `idbSaveHandleKey`, `idbLoadHandleKey` | 28735 – 29210 |
| **Jauge de mémoire locale** | `_byteLen`, `_probeLsHeadroom`, `_lsCapacity`, `_lsKeyBreakdown`, `_isAppLsKey`, `_storageBreakdown`, `_purgeLegacyStorage`, `_renderStorageGauge` | 33614 – 33900 |
| **Validation & robustesse** | `_validateImport`, `_sanitizeCoreSections`, `_auditState`, `_logRuntimeError` | 7259, 15457, 29314 |
| **UI sans dialogue natif** | `toast`, `openMod`, `closeMod`, `appAlert`, `_uiConfirm`, `_uiPrompt`, `_modalReturnTo` / `_afterModalClose` | 13517, 13656, 13835, 19067, 19104 |
| **Échappement & couleur** | `_escAttr`, `_escName`, `_escJsAttr`, `_html`, `_csvCellGuard`, `_safeColor`, `_contrastTextColor`, `_wcagContrast` | 9649 – 9720, 40969, 41013 |
| **Design system** | tout le bloc `<style>` de tête : `@font-face` base64 ×3, tokens `:root`, bloc `html[data-theme="dark"]`, bloc `@media print { html[data-theme="dark"] }`, filet rouge `body::before`, lignes Seyès, `--sp-*`, `--radius-*` | début du `<style>` |
| **Mise à jour** | `APP_VERSION` / `APP_BUILD_DATE` / `checkForUpdate` / `_passiveUpdateCheck` / modale `mabout` | en tête du `<script>` |
| **Harnais de tests** | `test/harness.js` + la structure de `test/*.test.js` | dépôt de référence |

### À NE PAS reprendre

Plans de salle, placement, glisser-déposer, AESH, tablettes, QCMCam/ArUco, sonomètre, minuteur, évaluations, bulletins, mentions de conseil, disciplines, classes recomposées. Rien de tout cela n'a de place ici — l'app ne connaît ni salle ni note.

💡 En revanche, **`stu.tags`** (les codes Pronote type `4B-LATIN`, `3B-BIL-LCE`) mérite d'être conservé du module d'import : c'est exactement la matière des choix d'options, et le panneau « Codes de groupes rencontrés » sait déjà les reconnaître.

## Fichiers du projet

- `suivi pp.html` — l'application entière (HTML + CSS + JS dans un seul fichier)
- `index.html` — redirection depuis la racine GitHub Pages (meta refresh + `location.replace`), pour éviter l'URL avec `%20`
- `.nojekyll` — **indispensable**, sinon Jekyll prend `README.md` comme index et ignore `index.html`
- `manifest.json`, `sw.js` (network-first)
- `icons/` — les 5 PNG d'installation (192 et 512 en `any` et `maskable`, plus l'icône iOS 180)
- `README.md`, `LICENSE` (MIT), `CLAUDE.md`
- `.gitignore` — `suivi-pp-*.json`, `*.bak`, `*.tmp`
- `scripts/audit_static.js`, `scripts/audit_browser.js` — les deux auditeurs (cf. *Scores de référence*, v1.28.2) ; `scripts/gen_icons.py`
- `test/harness.js`, `test/*.test.js`, `test/fixtures/` (dont `trombi/fake-trombi.pdf`, un faux trombinoscope), `package.json` (`npm test` → `node --test "test/*.test.js"`)
  ⚠️ Le glob, pas `node --test test/` : sous Node 22, l'argument-répertoire `test` échoue en `MODULE_NOT_FOUND`. Le glob a en prime l'avantage de n'exécuter que les `*.test.js`, donc `harness.js` n'est plus compté comme un test.

Nom de dépôt proposé : **`suivi-pp`** sous `Belenos-Toutatis` → `belenos-toutatis.github.io/suivi-pp/`.

Clés `localStorage` préfixées **`suiviPP`** (`suiviPP_v1` pour les données, `suiviPP_theme`, `suiviPP_deviceId`, `suiviPP_autoSync`…). ⚠️ Le préfixe doit être **différent** de `planClasse`, et `_isAppLsKey` doit être adapté en conséquence.
Fichiers de sync : `suivi-pp-auto.json`, `suivi-pp-bk-*.json`, `suivi-pp-checkpoint-*.json`, `suivi-pp-conflit-{mienne|autre}-*.json`.

## Modèle de données

```js
S = {
  version, savedAt,
  clock:      { [deviceId]: compteur },          // horloge vectorielle (cf. Plan de classe)
  salles:     { [salleId]: salle },              // repris de Plan de classe, pour TRIER seulement
  classes:    { [classId]: cls },
  eleves:     { [sid]: stu },
  releves:    { [classId]: { [ymd]: releve } },  // relevés de carnet
  documents:  { [docId]: doc },
  elections:  { [classId]: { [electionId]: election } },
  moyennes:   { [classId]: { [importId]: releveMoy } },   // un import = une photographie
  matieres:   { [mid]: { id, nom, norm, ord, disc? } },   // catalogue qui réaligne les colonnes ; disc = discipline (avis)
  avis:       { [classId]: { [campId]: campagne } },     // avis des collègues : une feuille du Nuage par période
  disciplines:{ [did]: { id, nom, onglet, actif, ord, builtin } },   // les onglets de cette feuille
  prefs:      { periodMode: 'semestre'|'trimestre', … },
  instances:  { [instanceId]: instance },          // catalogue des instances (incidents)
  cur:        classId,
}

cls = {
  id, nom,                 // '5C'
  annee,                   // '2025-26'
  eleves: [ ...sids ],
  ord,                     // ordre d'affichage
  // Placement repris de Plan de classe — une place DIFFÉRENTE par salle :
  rooms:    { [salleId]: { seating: { 'r,c': sid } } },   // clé = PLACE, valeur = élève
  salleCur, // salle où l'on est entré : c'est elle qui décide de l'ordre
  pdcImportAt,             // 'YYYY-MM-DD' — dernier import depuis Plan de classe (la fiche et Données préviennent)
  // Délégués DÉSIGNÉS sans vote dans l'app (2026-09-11) — élection sur papier, classe reprise :
  delegues: { date: 'YYYY-MM-DD', titulaires: [sid], suppleants: [sid], note },
  ecoDelegues: { … même forme … },   // les éco-délégués désignés sans vote (v1.27.0)
  // Heures de vie de classe (v1.28.0) — le journal de la CLASSE : thème, décisions ; une
  // date future = un thème « à venir ». Aucun sid : rien à purger avec un élève.
  vieClasse: [ { id, date: 'YYYY-MM-DD', ts, titre, texte } ],
}

salle = {
  id,                      // PRÉFIXÉ 'pdc_…' à l'import (cf. plus bas)
  nom, rows, cols,
  patterns: [ { id, nom, order: [ 'r,c', … ] } ],   // ordres de ramassage DESSINÉS là-bas
}

stu = {
  id, nom, prenom, classe_id,
  naissance,               // 'YYYY-MM-DD' | null — départage d'une égalité aux délégués
  civilite,                // 'M' | 'F' | null
  groupe,                  // 1 | 2 | 3 | null   (repris de l'import)
  tags: [ ...tagIds ],     // codes Pronote : LATIN, BILINGUE, DNL…
  // aménagements, repris du même import que Plan de classe (mêmes noms de champs
  // pour qu'un JSON de l'une soit lisible par l'autre) :
  ppre, pap, gevasco, ulis, ulis_incl, upe2a, upe2a_incl, pai,
  agrandissement, tiers_temps,
  arrivalDate, departureDate,   // 'YYYY-MM-DD' | null — départ = 1er jour d'absence
  remarque,                // texte libre du PP (la colonne « Remarque » du tableur)
  regime,                  // 'DP' | 'EXT' | 'INT' | absent — demi-pensionnaire, externe, interne (v1.45.1)
  joursDP,                 // ['lun', 'mar', …] | absent — jours de demi-pension (v1.45.2, DP seulement)
  entree,                  // code du régime d'ENTRÉE de l'établissement ('A1', 'A2') | absent (v1.45.2)
  sortie,                  // code du régime de SORTIE ('D1', 'D2', 'D3') | absent (v1.45.1, révisé v1.45.2)
  // Observations notées dans Mon Bureau Numérique (v1.46.0) — des ÉVÉNEMENTS, pas un cumul.
  obsMbn: [ { id, ts, date: 'YYYY-MM-DD', heure: 'HH:MM' | '', type, motif, par, info } ],   // absent = aucune
  // Journal des contacts avec la famille — DATÉ et qualifié, à côté du texte libre.
  journal: [ { id, date: 'YYYY-MM-DD', ts, type: 'appel'|'rencontre'|'courriel'|'mot'|'autre', texte } ],
  // Incidents et instances (2026-09-11) : fiche incident, punition, commission éducative…
  // `type` pointe le catalogue S.instances ; `pdf` n'est qu'une RÉFÉRENCE vers le dossier
  // des pièces jointes (cf. *Incidents et instances*), jamais le fichier.
  incidents: [ { id, date: 'YYYY-MM-DD', ts, type: instanceId, objet, texte, pdf: null | { nom, fichier, taille } } ],
  // Bilans de période (2026-09-11) : ce que je dirai au conseil, ce que je retiens à
  // mi-période. La PÉRIODE se déduit de la date (cf. *Bilans de période*).
  bilans: [ { id, date: 'YYYY-MM-DD', ts, type: 'conseil' | 'miperiode', texte } ],
  // Décisions prises en réunion pour un moment de bilan (v1.46.13) — une par moment, à côté
  // du bilan (même règle de moment que `_bilanCible`). Absent = aucune.
  decisions: [ { id, date: 'YYYY-MM-DD', ts, type: 'conseil' | 'miperiode' | 'mois', texte } ],
}

// Catalogue des instances — pré-rempli (INSTANCES_DEFAUT, `builtin: true`), renommable,
// désactivable (`actif`), complétable. Une instance d'office ne se supprime pas.
instance = { id, label, description, actif, ord, builtin }

releve = {
  date: 'YYYY-MM-DD',      // = la clé dans S.releves[classId]
  label,                   // optionnel : « avant conseil S1 »
  ts,                      // horodatage de création
  counts: { [sid]: n | 'A' },   // CUMUL relevé, ou 'A' (absent : rien à relever)
}

doc = {
  id, titre, description,
  classIds: [ ...classIds ],
  dateDistribution, dateEcheance,   // 'YYYY-MM-DD' | null
  suiviRetour: true,       // faut-il suivre le retour du papier ? (certains documents sont purement informatifs)
  champs: [ champ ],       // 0, 1 ou plusieurs réponses à porter
  retours: { [sid]: retour },
  archive: false,          // rangé hors de la vue courante sans être supprimé
  ord,
}

champ = {
  id, label,
  type: 'choix' | 'multi',
  par: 'famille' | 'prof',           // « Avis PP option 1 » est un champ 'prof'
  options: [ { id, label, color } ],
  obligatoire: bool,
}

retour = {
  rendu: bool,
  dateRetour: 'YYYY-MM-DD' | null,
  reponses: { [champId]: optionId | [ ...optionIds ] },   // string si 'choix', tableau si 'multi'
  note: '',                           // mot sur CE retour (« manque la signature du père »)
}
```

### Relevés de carnet — le cumul est la seule vérité stockée

⚠️ **`counts[sid]` est le TOTAL lu dans le carnet à cette date, jamais un incrément.** C'est ce que l'utilisateur a sous les yeux quand il saisit. Stocker un delta l'obligerait à soustraire de tête à chaque relevé, et une saisie oubliée deviendrait indétectable.

- **L'évolution est CALCULÉE, jamais stockée** : `delta = n − dernier cumul connu strictement antérieur`, en **sautant les `'A'`** et les vides (un élève absent au relevé du 15/10 se compare au 01/10, pas à rien). Premier relevé d'un élève → le delta vaut le cumul lui-même.
- ⚠️ **Un cumul qui DIMINUE est signalé, jamais corrigé.** C'est presque toujours une faute de frappe, mais ce peut aussi être un carnet remplacé en cours d'année. La cellule porte un repère, l'infobulle dit ce qui est attendu, et **rien n'est réécrit** — le même arbitrage que la note hors barème de Plan de classe.
- **`'A'` n'est ni `0` ni le vide.** `0` = carnet vu, aucune observation (une information). `''` = pas relevé (une absence d'information). `'A'` = élève absent, le relevé ne le concerne pas. Les trois s'affichent différemment et se traitent différemment dans le calcul du delta. Réutiliser la convention `codeAbsent` de Plan de classe : le code est **paramétrable**, donc aucun texte visible ne l'écrit en dur (cf. `_codeA()` là-bas).
- La clé est **la date**, pas un id : on ne relève pas les carnets deux fois le même jour, et la clé date rend le tri chronologique gratuit et les doublons impossibles. Corollaire : corriger une date = déplacer l'entrée, à faire dans une seule fonction (`releveSetDate`) qui refuse d'écraser une date existante.
- **Paliers de couleur** (v1.38.0, demande de l'utilisateur : *« un changement de couleur de
  fond à chaque fois que ça franchit un multiple de 5 observations — et dans les réglages,
  une autre valeur que 5 »*) : `S.prefs.obsPalier` (5 par défaut, entier de 0 à 100, **0 =
  sans couleurs**, réglé dans 💾 Données). `_obsBande(n)` = `floor(n / palier)`, plafonné à
  `OBS_BANDES` = 8 (au-delà, « 40 et + ») ; 0 sous le premier palier = pas de couleur ; seul un
  NOMBRE a un cran (l'absent et le vide n'en ont pas). Tokens `--obs-1…8` / `--obs-N-fg` aux
  trois endroits : jaune pâle → prune, **luminance décroissante** pour que l'ordre survive à
  une impression en noir et blanc, encre blanche aux deux derniers crans. La couleur est
  posée sur le **champ** (`.ob-N .rel-inp`), pas sur la case : le Δ en dessous garde son
  encre. Partout où un cumul s'affiche : grille (avec légende `_obsLegendeHTML` sous la
  barre), feuille imprimée, colonne *Observations* de la liste (`.ob-chip`), fiche, et
  (v1.38.1) le cumul de fin de période de la **synthèse de période**, tableau et fiches,
  légende au sous-titre quand le bloc Observations est coché.
- **Impression** (v1.38.0 — l'onglet n'en avait AUCUNE) : bouton 🖨 et Ctrl+P → modale
  `mcarprint` (jamais l'impression directe) : relevés de toute l'année ou d'une période,
  couleurs des paliers, évolution à côté de chaque cumul, colonne Δ dernier, totaux de
  période, paysage / portrait, A4 / A3. Feuille `.pp-t.pp-car` (`_carnetFeuilleHTML`) aux
  mêmes lignes et au même tri que l'écran (`_carnetRows`, extrait de `renderCarnets`),
  taille calculée pour UNE page (`_printFitMeasure`) — 10 pt en A4 paysage pour la démo.
  Réglages de session (`_carPrintOpts`), rien dans `S`. Le Δ dernier d'une feuille d'une
  seule période est borné à ses dates (`_carnetLastDelta(classId, sid, dates)`).
  ⚠️ **Un Δ nul ne s'imprime pas** : « 3 0 » se lit « 30 » sur le papier (vu en simulation).
  ⚠️ La couleur de palier doit battre la rangée grisée : `.pp-t.pp-car tbody td.ob-N`
  (0,3,2) contre `.pp-t tbody tr:nth-child(even) td` (0,2,3).
- **Total de période** : somme des deltas des relevés dont la date tombe dans la période — c'est-à-dire `cumul(dernier relevé de la période) − cumul(dernier relevé d'avant la période)`. ⚠️ Ne PAS additionner les cumuls, faute classique qui compte chaque observation autant de fois qu'il y a eu de relevés depuis.

### Observations notées dans MBN — la seconde source (v1.46.0)

Demandé le 2026-10-03 : *« tant qu'on ne s'est pas mis d'accord, on note les observations à
deux endroits : le carnet de correspondance (je relève en passant dans les rangs) et, depuis
cette année, MBN, où des enseignants en saisissent. Il faut que je puisse tenir le compte des
deux. »* L'export MBN (vu sur un export anonymisé fourni par l'utilisateur, hors du dépôt) :
`Élève · Civilité · Classe · Type · Motif · Demandeur · Donnée le · Informations complémentaires`,
une ligne par observation, « Donnée le » en **nombre de série** Excel dans le .xlsx.

- ⚠️ **Deux modèles différents, gardés SÉPARÉS** : le carnet est un cumul relevé
  (`S.releves`), MBN une liste d'événements datés (`stu.obsMbn`) qu'on **compte** sur une
  période (`_obsMbnEntre`). Partout, les deux s'affichent côte à côte, jamais fondus : un
  collègue peut noter la même observation aux deux endroits. Seule la grille donne leur somme,
  dans une colonne à part *Carnet + MBN* de la période courante, dont l'infobulle le dit.
- **Import** (`openObsMbnImport`, modale `mobsmbn` — bouton *📥 Observations MBN…* de l'onglet
  Observations, et dans 💾 Données) : `_tableurLire` → `_obsMbnLire` (colonnes par leur
  EN-TÊTE ; `_obsMbnDate` lit le nombre de série, « jj/mm/aaaa hh:mm » et l'ISO ; une ligne
  sans date lisible est écartée et nommée) → `_mbnRapprocher` (le même rattachement que les
  régimes : rien n'est deviné, rattachement manuel **par nom**, « ignorer » par défaut) →
  `_obsMbnBilan` (pur) → `_obsMbnAppliquer`, un cran d'undo.
  - ⚠️ **Réimporter n'ajoute que le nouveau** : l'export couvre l'année, on le reprend
    plusieurs fois. Une observation se reconnaît à `date · heure · type · motif · demandeur ·
    texte` (normalisés), en **multiensemble** : deux observations identiques à la même minute
    restent deux.
  - ⚠️ **Une observation de l'app absente de l'export** (dans les dates qu'il couvre) est
    proposée au retrait — effacée dans MBN ? — mais **jamais cochée d'office**.
- **Où on les voit** : onglet Observations (une colonne *MBN S1* par période, cliquable vers la
  fiche, détail en infobulle ; *Carnet + MBN* ; tri « par observations MBN »), liste des élèves
  (~~pastille *MBN n* de la période dans la case Carnet~~ — **révisé en v1.46.3**, l'utilisateur :
  *« la colonne Carnet devrait s'appeler Observations et afficher la somme des deux, mais on doit
  encore voir le détail »* : la colonne **Observations** montre le TOTAL de l'année, cumul du
  carnet + observations MBN depuis le début de l'année (`_syntheseRow` : `mbnAn`, `obsTotal`),
  à la couleur du palier, puis « carnet n · MBN n » ; le Δ et la courbe restent ceux du carnet ;
  le tri par l'en-tête et le papier (« 14 (11 + 3 MBN) ») suivent le total ; sans MBN dans la
  classe, rien ne change. **v1.46.4** : ~~le Δ du dernier relevé~~ → « **+n S2** », ce que l'élève
  a pris sur la période courante, carnet ET MBN (l'utilisateur : *« que ce soit plus quelque
  chose sur une période, carnet et MBN confondus, ou ne pas le mettre »*) ; ▼ reste pour un
  cumul en baisse ; la petite courbe (`_elevesSpark(cls, sid)`) est la **miniature** de celle de
  la fiche — total carnet + MBN, du 1er septembre à aujourd'hui, à l'échelle du temps (avant :
  le seul carnet, un point par relevé à intervalles égaux)). **v1.46.5 — depuis QUAND** (l'utilisateur :
  *« choisir depuis quelle durée — une icône calendrier à côté du titre Observations : une
  semaine, deux semaines, un mois, deux mois, le début du semestre ou du trimestre »*) : 📅 dans
  l'en-tête (`_obsFenetrePickHTML`, `OBS_FENETRES`), réglage propre au POSTE (`localStorage`
  `suiviPP_obsDepuis`, défaut : début de la période) ; `_obsFenetre(cls, cle, auj)` (pur) — fin =
  aujourd'hui ramené dans l'année scolaire (une année passée, comme la démo, finit donc au 31
  juillet : « 1 semaine » y est vide), début selon la durée, jamais avant la rentrée ;
  `_obsGagnees` = carnet sur la fenêtre (`_obsEntre`) + MBN de la fenêtre. Le « +n 2 sem. »,
  le filtre **« Observations +3 ou plus »** (~~« Carnet en hausse (Δ ≥ 3) »~~, demandé aussi) et
  la colonne « +n » de la liste imprimée (ex-Δ) suivent la même durée. carte de chaleur (groupe *Observations
  MBN*, une case par mois, après le carnet), fiche (carte Carnet : *Notées dans MBN*, la liste ;
  un fait « n observations dans MBN : 2 travail non fait, 1 bavardage » insérable dans le bilan ;
  la chronologie les date ; chiffre clé), synthèse de période (« · MBN n » à côté du carnet,
  tableau et fiches). ~~Pas sur la feuille imprimée de la grille du carnet.~~ **Depuis la
  v1.46.1, aussi sur la feuille imprimée** (case *Observations MBN par période* de `mcarprint`,
  `_carPrintOpts.mbn`) : par période, Carnet · MBN · Carnet + MBN (la somme seulement avec les
  totaux), dit au sous-titre.
- **La carte de la fiche** (v1.46.1, l'utilisateur : *« que le graphique représente d'origine le
  cumul des deux ; en dessous, une partie notée dans MBN et une autre avec le détail des relevés
  faits dans le carnet ; à côté de chaque titre une coche pour confirmer qu'elles sont
  additionnées dans le graphique — on peut choisir de n'en afficher qu'une »*) : la carte
  *Observations* (Carnet quand la classe n'a rien dans MBN) trace `_ficheCourbePoints` (pur) —
  à chaque relevé chiffré et chaque jour d'observation MBN, le cumul du carnet à cette date
  (0 avant le premier relevé) + les observations MBN depuis le début de l'année, selon les
  sources cochées ; la courbe dit ce qu'elle additionne (« carnet + MBN »). Dessous, *Relevés du
  carnet* (chaque relevé du moment : cumul, Δ, libellé) et *Notées dans MBN*, chacune avec sa
  coche (`_ficheCourbeSrc`, pour la séance, toutes fiches ; `ficheCourbeSrcUI`).
  **La courbe s'arrête** (v1.46.2, l'utilisateur : *« à la date du bilan marqué, ou à la date
  actuelle »*) : `_ficheCourbeFin` (pur) — la date du bilan écrit pour le moment choisi, sinon
  aujourd'hui, bornée à la période ; l'axe, les mois, la zone du moment et le repère de
  mi-période s'arrêtent là, et la légende au-dessus le dit (« carnet + MBN · jusqu'au 20/01
  (bilan) »). Rien n'est dit quand c'est la fin de la période. **Et commence au 1er
  septembre** (v1.46.4 — l'année de l'app part du 1er août, mais rien ne se passe en août) :
  `_debutUtile`, appliqué à la courbe, à la frise de la chronologie et aux mois de la carte de
  chaleur.
- `postLoadHook` écarte les entrées illisibles et retire un champ qui n'est pas un tableau ;
  le champ n'est jamais créé d'office. Rien à purger à part : il part avec l'élève.
  Démo : onze observations MBN sur cinq élèves.

### Documents — un même papier porte plusieurs réponses

Le cas Devoirs Faits est le plus simple : `suiviRetour: true` + un champ `choix` à trois options `OUI / NON / ULYSS`. ⚠️ **Trois, pas deux** : le tableur réel porte cette troisième valeur (dispositif alternatif). Un booléen « participe » aurait été trop étroit — d'où le choix unique paramétrable dès la v1.

Le cas orientation est le plus riche : plusieurs champs sur le même document, dont des champs **`par: 'prof'`** (« Avis PP option 1 »). Cette distinction n'est pas cosmétique : le compteur « réponses manquantes » ne doit compter que ce qu'on **attend des familles**, sinon un document est éternellement incomplet parce que le PP n'a pas encore rendu son avis.

- **`rendu` et `reponses` sont deux axes indépendants.** Un papier peut être rendu sans réponse cochée (illisible, à relancer), et une réponse peut être connue avant le papier (dit à l'oral au rendez-vous). Ne pas dériver l'un de l'autre.
- **L'ordre des documents se règle à la main**, en tirant la **poignée ⋮** de la ligne (`docReorder`) ; les flèches ↑ ↓ restent au CLAVIER sur la poignée focalisée (`docMove`), parce qu'un glisser n'existe pas pour qui n'a ni souris ni écran tactile.
  - ⚠️ **Ne rien déplacer dans le DOM pendant le glisser.** Première version : la ligne suivait le curseur par `insertBefore`. Mais la poignée est DANS cette ligne, et déplacer la ligne **reparente l'élément qui détient la capture du pointeur** : la capture saute, les `pointermove` cessent d'arriver, et le glisser se fige après un seul saut. Symptôme remonté à l'usage : « on ne peut le déplacer que d'une position ». On DESSINE donc l'insertion (trait rouge sur la ligne cible) et on ne touche à l'ordre qu'au relâchement.
  - ⚠️ **Recalculer la cible sur le `pointerup`**, pas se fier au dernier `pointermove` : un relâchement peut tomber là où rien n'a été survolé (geste rapide, stylet), et la ligne atterrirait ailleurs que sous le doigt.
  - `touch-action: none` sur la poignée est ce qui rend le glisser possible au DOIGT : sans lui, le navigateur lit le mouvement comme un défilement et n'envoie jamais de `pointermove`. Le glisser natif HTML5 (`draggable`) est écarté pour la même raison — il ne marche pas au tactile.
  - `Échap` pendant le glisser annule, comme partout ailleurs.
- ⚠️ `docReorder` **renumérote tous les `ord` avant de repositionner** : ils sont posés à la création avec la taille du catalogue et finissent dupliqués (import, duplication, données de démo), et réordonner des valeurs identiques ne changerait rien — la poignée paraîtrait cassée. Puis il **redistribue les mêmes places** entre les seuls documents affichés : les archivés masqués et ceux des autres classes gardent la leur. Sémantique **retirer-puis-réinsérer**, pas échanger : un glisser traverse plusieurs lignes d'un coup.
- **Dupliquer un document** est le geste central de la rentrée suivante : mêmes champs, mêmes options, retours vides. Prévoir le bouton dès la v1 (miroir de `_evalDuplicate`).
- Les **modèles** livrés dans les données de démo doivent couvrir les trois formes réelles : Devoirs Faits (choix à 3), fiche de renseignement (retour seul, aucun champ), fiche d'orientation (choix multiple d'options + avis PP).

## Moyennes par matière

L'utilisateur exporte les moyennes depuis le bureau numérique et obtient un CSV de cette
forme (vérifiée sur un export réel, `moyennes_5e_premier_semestre_6eme_5eme_4eme_20260929.csv`) :

```
Nom et prénom de l'élève;Périodes;ANGLAIS LV2(Mme X);…;MATHEMATIQUES(M. Y, Mme Z);…;Moy.
MARTIN Noé;Premier semestre 6ème 5ème 4ème;11;12;15;9;14;12,2
```

Point-virgule, virgule décimale, UTF-8 (repli Windows-1252 gardé), une matière par colonne
avec ses professeurs entre parenthèses, la moyenne générale en dernier, des cases VIDES
quand un collègue n'a pas encore noté. Il **réimporte au fil de la période** pour voir
l'évolution, et **des colonnes apparaissent** d'un fichier à l'autre.

```js
releveMoy = {
  id, date: 'YYYY-MM-DD',   // date d'extraction — lue dans le nom du fichier (…_20260929.csv)
  periode,                  // la colonne « Périodes » telle quelle ; sinon S1/T1 déduit de la date
  label, ts, fichier,
  matieres: [ mid, … ],     // colonnes PRÉSENTES dans ce fichier
  profs:    { [mid]: 'M. Y, Mme Z' },   // par import : un remplaçant change le nom, pas la matière
  notes:    { [sid]: { [mid]: nombre | 'code' } },
  generale: { [sid]: nombre | 'code' }, // la colonne « Moy. » du fichier, jamais recalculée
}
```

- **Un import est une PHOTOGRAPHIE, jamais réécrite.** L'évolution se calcule entre deux
  imports ; rien n'est stocké en delta. Même raisonnement qu'au carnet : ce qu'on stocke est
  ce qu'on a lu.
- ⚠️ **Une matière est reconnue par son NOM normalisé** (`_moyNorm` : sans accents, casse ni
  ponctuation), via le catalogue `S.matieres` — **jamais par sa position** dans le fichier.
  C'est ce qui permet à une colonne nouvelle de s'insérer n'importe où sans décaler les
  autres : l'ordre des colonnes à l'écran est celui du catalogue (première apparition), pas
  celui du fichier du jour.
- ⚠️ **Une colonne ENTIÈREMENT vide ne crée pas la matière** dans cet import : c'est
  « aucune note saisie », pas une matière. Sans cette règle, chaque export ferait naître
  des colonnes mortes. Elle apparaîtra au premier import où un collègue aura noté — signalée
  `nouvelle` (`_moyColNouvelle`) par rapport à l'import précédent de la période.
- **Trois états d'une case, comme au carnet** : un nombre (⚠️ **0 compris — c'est une
  note**, l'export réel en porte un), un **code** du bureau numérique (`Abs`, `Disp`, `NN`…)
  conservé tel quel, et l'**absence de clé** = pas de note. Seuls les nombres entrent dans
  les statistiques ; un code s'affiche en italique, un vide en tiret.
- ⚠️ **L'évolution ne traverse pas les périodes.** Les moyennes repartent de zéro à chaque
  période : comparer le S2 au S1 donnerait un Δ sans aucun sens. `_moyPrev` ne cherche que
  dans les imports de la **même** `periode`, et remonte au dernier import où la case était
  un NOMBRE (un code ou un vide ne se soustrait pas).
- **Même date + même période = REMPLACEMENT**, pas empilement : on a réexporté après une
  saisie. L'aperçu le dit avant l'import ; changer la date garde les deux.
- **Plusieurs périodes dans un même fichier** (un export annuel) → un import par période.
- **Rapprochement des élèves** (`_moyMatch`) : clé = mots du nom complet sans accents ni
  casse, **triés** (l'export écrit « NOM Prénom », la classe connaît nom et prénom à part ;
  les prénoms composés perdent leur trait d'union d'un côté ou de l'autre). ⚠️ Deux
  homonymes parfaits dans la classe → **rien n'est deviné**, la ligne passe au rattachement
  manuel. Une ligne non reconnue n'est jamais importée d'office : l'aperçu propose un
  sélecteur, par défaut « ignorer ». Les élèves de la classe **absents du fichier** sont
  nommés dans l'aperçu.
- L'import ne crée **aucun élève** : le roster vient de l'onglet Élèves.

### Statistiques — deux choix à ne pas « corriger »

- ⚠️ **Écart type de POPULATION (σ, divisé par n)** : la classe n'est pas un échantillon,
  c'est la population entière. C'est `ÉCARTYPE.P` du tableur, pas `ÉCARTYPE` (n − 1). Si
  l'utilisateur compare à un tableur et trouve un écart, c'est là.
- ⚠️ **« Sous 10 » = strictement moins de 10 ; 10 pile compte dans « 10 et plus »** : la
  moyenne est atteinte. Les deux compteurs somment toujours à `n` (testé).
- Les statistiques du tableau portent sur les **lignes affichées** (élèves présents, plus
  les partis qui figurent dans l'import) ; celles de la vue Évolution, sur tout l'import.
- La ligne « Moyenne » porte l'évolution de la **moyenne de classe** depuis l'import
  précédent ; la vue 📈 Évolution déroule n'importe laquelle des huit statistiques, import
  après import.

### Affichage

- **Intitulés abrégés** (`_moyAbbr` : SVT, EPS, Maths, Hist.-géo.…), nom complet et
  professeurs en infobulle. Les intitulés du bureau numérique coupés en plein mot sur onze
  colonnes rendaient la grille illisible (vu à l'écran, pas en test). Seul ce qu'on sait
  abréger l'est ; une matière inconnue garde son intitulé.
- Cases **sous 10 sur fond d'alerte** (`--alert-bg` / `--alert-fg`), Δ en `--ok-fg` /
  `--danger-fg`, et dans une case d'alerte le Δ reprend l'encre de la case.
- Tri par moyenne générale, par évolution, par nombre de matières sous 10, ou par une
  matière (clic sur l'en-tête) — **toujours la plus basse d'abord** : on trie pour voir
  qui décroche.
- **Fiche élève** : une section 📈 en lecture seule (la source est l'import), une table par
  période, **transposée** (matières en lignes, imports en colonnes) — on lit l'histoire
  d'un seul élève, et il y a bien plus de matières que d'imports. **Liste des élèves** :
  colonne « Moy. » (dernière moyenne générale, Δ, nombre de matières sous 10), triable par
  l'en-tête — la plus basse d'abord au premier clic, les élèves sans moyenne au bout dans
  les deux sens — et reprise à l'impression de la liste.
- **Cadre figé** (`.rel-wrap.frozen`, cf. *Grilles*) : les deux vues rendent `[tableau,
  légende]` et c'est `renderMoyennes` qui pose le cadre entre `_wrapScrollKeep` et `keep()`
  — changer d'import ou de tri ne renvoie pas la grille en haut à gauche.
- **Statistiques retenues** (v1.35.0, demande de l'utilisateur : *« toutes ne sont pas
  forcément nécessaires, je dois pouvoir en décocher »*) : `S.prefs.moyStats`, UN réglage
  pour l'écran (volet *Σ Statistiques en pied* de la barre) et pour le papier (la modale
  d'impression). `_moyStatsShown()` filtre et remet dans l'ordre canonique ; `setMoyStat`
  pose un `pushUndo` comme `setPref`, et n'empile rien si rien ne change. ⚠️ Le tableau est
  toujours **remplacé**, jamais modifié en place : `DEFAULT_PREFS.moyStats` est la même
  référence que celle posée par `postLoadHook` (testé).
- **Impression** (bouton 🖨 et Ctrl+P ouvrent la modale `mmoyprint`, jamais l'impression
  directe) : la vue affichée — même import, même tri — sur **une page paysage A4 ou A3**,
  taille de texte calculée par `_printFitMeasure` (cf. *Synthèse de période imprimable*),
  annoncée dans la modale avant d'imprimer. Feuille `.pp-t.pp-moy` : colonnes fixes (nom
  17 %, matières à parts égales, Moy. 7 % séparée d'un filet, « < 10 » 4 %), chiffres
  centrés, rangées alternées, statistiques en pied sur fond gris. ⚠️ Sur le papier, « sous
  10 » se marque en **gras**, pas en couleur : la feuille sort souvent en noir et blanc.
  ⚠️ En-têtes **en casse normale** : en capitales, « FRANÇAIS » se cassait en « FRANÇAI / S »
  dans une colonne de matière. Mesuré sur le cas réel de l'utilisateur (27 élèves) avec la
  démo à onze matières : 7,75 pt en A4 avec les huit statistiques, 8,5 pt avec quatre,
  11,75 pt en A3.

## Élection des délégués de classe

### Cadre réglementaire

**Vérifié sur les textes le 2026-09-11** (demande de l'utilisateur : *« recherche avec précision »*). Les références sont portées dans le code (`_EL_TYPES[…].textes`), liées dans la modale de création et en tête de chaque élection, et citées au pied du PV — plus de « à vérifier avant impression ».

- **Deux délégués par classe, chacun avec son suppléant** — Code de l'éducation, **art. R421-28** (décret n° 2016-1228 du 16-9-2016) : *« Deux délégués d'élèves sont élus au scrutin uninominal à deux tours dans chaque classe […]. Le nom de chaque candidat est accompagné de celui de son suppléant. Tous les élèves sont électeurs et éligibles. »* → le **binôme** titulaire + suppléant est la lettre du texte.
- **Avant la fin de la septième semaine de l'année scolaire** — **art. R421-30** (la circulaire de 2004 disait la sixième ; le code, plus récent, prime).
- **Majorité absolue au premier tour, relative au second, le plus jeune en cas d'égalité**, candidatures individuelles, un élève non candidat peut être élu s'il accepte, remplaçant élu en cours d'année (deux fois au plus) — **circulaire n° 2004-114 du 15-7-2004, § 6.1** (BO n° 29 du 22-7-2004).
- Le texte dit **scrutin uninominal** : un nom par bulletin, et si un seul candidat atteint la majorité absolue, un second tour pour le second siège.
- **Le § 6.1 de la circulaire n° 2004-114, relu le 2026-10-03** (texte fourni par l'utilisateur :
  le site du ministère refuse les robots) : *« Les candidatures sont individuelles »* ; *« Un élève
  qui n'a pas présenté sa candidature peut néanmoins être élu si les voix de ses camarades se sont
  portées sur lui en nombre suffisant et s'il accepte son élection »* ; majorité absolue au 1er
  tour, relative au 2nd, le plus jeune à égalité ; remplaçant élu *« au maximum deux fois dans
  l'année scolaire »*. ⚠️ Le titulaire **indissociable** de son suppléant y figure au § 6.2 —
  l'élection des représentants au CONSEIL D'ADMINISTRATION —, pas pour les délégués de classe.
  Pour ceux-ci, le binôme vient de **R421-28 (2016)**, plus récent et supérieur : la circulaire
  n'a pas été réécrite, et rien ne dit qui supplée un élu non candidat **en binôme** (hors binôme,
  candidatures individuelles, la circulaire suffit). La fiche service-public F1370 reprend la phrase
  de 2004 (*« … et s'il accepte son mandat »*). Cf. *Nom écrit sur un bulletin* (v1.52.2).
- **Éco-délégués** — **circulaire n° 2019-121 du 27-8-2019, § 1.2** (*EDD 2030*, BO n° 31 du 29-8-2019) : *« chaque établissement est incité à organiser l'élection, dans chaque classe, d'un éco-délégué […]. Cette élection peut utilement intervenir concomitamment aux élections des délégués d'élèves et selon les mêmes modalités. »* Et le « binôme paritaire d'éco-délégués » de la même circulaire est **par établissement** (élu parmi les volontaires du CVC / CVL), pas par classe. **Circulaire du 24-9-2020, § 3.1** (*Agenda 2030*, BO n° 36) : *« L'élection des éco-délégués de classe est désormais obligatoire au collège et au lycée et peut être organisée simultanément avec celle des délégués de classes. Elle peut également être proposée aux élèves de CM1 et CM2. Les mêmes élèves peuvent, le cas échéant, être à la fois délégués de classe et éco-délégués. »* → **UN éco-délégué par classe, AUCUN suppléant, un nom par bulletin, uninominal à deux tours** (par renvoi aux modalités des délégués). Aucun texte n'impose deux éco-délégués ni la parité par classe : c'est un choix d'établissement, fréquent, à régler dans la modale.
- Le lien de R421-28 est **celui fourni par l'utilisateur** (2026-09-12, v1.29.1) : la section du code sur Légifrance avec un fragment `#:~:text=` qui surligne le passage sur le type de scrutin à l'ouverture. Ne pas le « simplifier » en lien d'article nu : le surlignage est ce qui rend la lecture immédiate.
- **Éco-délégués** (2026-09-12, v1.30.2) : les deux circulaires restent, mais par les liens **fournis par l'utilisateur** — les mêmes pages du BO avec un fragment `#:~:text=` qui surligne le passage sur les éco-délégués de classe (2019 : *« Au-delà, chaque établissement est incité… »* ; 2020 : *« L'élection des éco-délégués de classe est désormais obligatoire… »*).
- **Deux liens seulement pour les délégués de classe** (2026-09-12, v1.29.2, à la demande de l'utilisateur) : R421-28 (Légifrance) et la fiche **service-public.gouv.fr F1370** (la procédure en clair : majorité absolue au 1er tour, relative au 2nd, le plus jeune en cas d'égalité — lien **sans** fragment `#:~:text=` depuis la v1.30.0 : la structure du site n'affiche pas la zone surlignée). Les liens vers R421-30 et la circulaire n° 2004-114 ont été **retirés** de `_EL_TYPES.delegues.textes` — les règles ci-dessus restent celles qu'ils énoncent, et R421-30 est toujours cité dans l'état vide de l'onglet. Le test accepte désormais le domaine `service-public.gouv.fr`.
- ⚠️ Les pages `education.gouv.fr` et `legifrance.gouv.fr` refusent les robots (403 Cloudflare) : les URL ont été vérifiées par les moteurs de recherche et le contenu par les PDF du BO ; à ouvrir à la main si un lien casse.
- L'élection est organisée par l'établissement, en pratique par le **professeur principal**, après une information sur le rôle des délégués (heure de vie de classe).
- Les délégués siègent au **conseil de classe** et forment l'**assemblée générale des délégués**, qui élit les représentants au conseil d'administration et au CVC / CVL.

⚠️ **La pratique de l'utilisateur s'écarte de la lettre du texte, et c'est légitime — ne pas la « corriger ».** Sa présentation `../PP/délégué election.md` décrit :

- des **candidatures en binôme** : chaque candidat titulaire se présente **avec son suppléant**, affichés ensemble avant le vote ;
- un bulletin où l'élève inscrit **0, 1 ou 2 noms** de candidats — donc un scrutin **plurinominal** (on élit les deux titulaires d'un seul vote), là où le texte dit « uninominal » ;
- **bulletin vierge = blanc**, bulletin avec **trop de noms, des marques ou des inscriptions inappropriées = nul** ;
- **second tour avec les mêmes candidats** si personne n'atteint la majorité absolue ;
- **égalité de voix → le candidat le plus jeune est élu** ;
- **deux assesseurs**, élèves volontaires non candidats, qui surveillent le vote, ramassent et comptent les bulletins, puis **signent le procès-verbal**.

Ces variantes (uninominal ou plurinominal, binôme ou suppléants élus à part, départage par le plus jeune ou par le plus âgé) diffèrent d'un établissement à l'autre. **Conséquence de conception : les modalités sont des RÉGLAGES de l'élection, pas des constantes du code.** ~~Les valeurs par défaut sont celles de sa présentation.~~ **Révisé le 2026-09-12 (v1.30.0), arbitré par l'utilisateur : le DÉFAUT est celui des textes liés — scrutin UNINOMINAL, un nom par bulletin** (*« c'est ce qui est indiqué dans les textes officiels qui sont liés »*). Le reste des défauts ne bouge pas (deux titulaires, binômes, majorité absolue au 1er tour, le plus jeune). Le plurinominal de sa présentation reste au menu de la modale (« 2 (plurinominal) »). **La modale le DIT** (v1.30.1) : sous « Modalités », `_elDefautsHint(ty)` décrit les défauts du mandat en clair — *« Par défaut, ce que disent les textes : 2 titulaires, chacun avec son suppléant, 1 nom par bulletin (uninominal)… »* —, dérivé de `ty.defaults` pour ne jamais décrire autre chose que ce que le bouton **↺ Défauts des textes** (`_elDefautsReset`, inerte quand le dépouillement a commencé) remet.
  - ⚠️ **Les fixtures de tests et l'élection EN COURS de la démo restent plurinominales À DESSEIN** (`nomsParBulletin: 2` explicite, commenté) : c'est le cas arithmétiquement piégeux (exprimés en bulletins, pas en voix), et « déjà élu » + « un autre au seuil courant » ne coexistent qu'à deux noms par bulletin — en uninominal, celui qui a plus de la moitié des voix n'en laisse pas assez aux autres. L'élection CLOSE de la démo, elle, est uninominale (12 · 7 · 2 · 1 sur 22 exprimés : un seul siège pourvu au 1er tour, le second au 2nd), et le test le vérifie dans les deux sens.
  - `_elStatut` garde `|| 2` en repli : les fichiers d'avant le champ ont été créés quand 2 était le défaut.

### Modèle

```js
election = {
  id, classId,
  type: 'delegues' | 'eco', // le MANDAT (v1.27.0) — absent = délégués de classe
  date,                    // 'YYYY-MM-DD'
  titre,                   // « Élection des délégués — 5C — 2025-26 »
  // modalités, figées à la création et rappelées sur le PV :
  nbTitulaires: 2,
  nbSupplants: 2,          // 0 est une valeur (éco-délégués) ; absent = autant que de titulaires (`_elNbSup`)
  binome: true,            // un candidat titulaire se présente avec son suppléant
  nomsParBulletin: 1,      // nombre max de noms qu'un bulletin peut porter — 1 = uninominal (défaut depuis la v1.30.0)
  majoriteAbsolueT1: true, // majorité absolue au 1er tour, relative au 2nd
  departage: 'plusJeune',  // 'plusJeune' | 'plusAge' | 'manuel'
  parSiege: true,          // un siège après l'autre (v1.52.14, défaut) — absent = ensemble ; ne vaut qu'en uninominal à plusieurs sièges
  secondTour: { mode: 'tous' | 'seuil' | 'premiers', pct, n },   // qui passe au 2nd tour (v1.52.14) — absent = tous
  nonCandidat: 'compte' | 'nul',   // nom d'un élève non candidat (v1.52.3) — absent = compte
  president: { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction },   // président du bureau (v1.52.12) — absent = PP
  supDe: { elId, candId, nom },    // scrutin du SUPPLÉANT d'un élu non candidat (v1.52.6), jamais « l'élection des délégués »
  assesseurs: [ sid, sid ],
  inscrits: 25,            // effectif de la division (calculé, corrigible)
  tours: [ tour ],         // 1 ou 2 tours
  elus: { titulaires: [candId, …], suppleants: [candId, …] },
  clos: bool,              // verrouille la saisie et autorise le PV
  note: '',
  affichage: {             // projection en direct
    ordre: 'tirage',       // 'tirage' | 'alpha' | 'score'  — 'score' réordonne les barres, non recommandé
    pourcentages: true,    // afficher le % à côté des voix (toujours avec son dénominateur)
    ligneMajorite: true,
  },
}

candidat = {
  id,
  sidTitulaire,            // un élève de la classe
  sidSuppleant,            // null si binome === false
  nomTitulaire, nomSuppleant,   // identité minimale figée, pour que le PV survive à une suppression d'élève
  color,                   // couleur de sa barre à la projection (palette par défaut, modifiable)
  ordre,                   // rang d'affichage figé (tirage au sort ou alphabétique)
  retire: bool,            // candidature retirée entre les deux tours
}

tour = {
  n: 1 | 2,
  siege,                        // en un siège après l'autre : le siège que ce tour pourvoit (1, 2…) — absent sinon
  candidats: [ candidat ],      // au 2nd tour : les mêmes, moins les retraits
  bulletins: [ bulletin ],      // dépouillement bulletin par bulletin
  votantsAnnonces,              // bulletins comptés dans l'urne AVANT ouverture — saisi, sert d'axe à la projection
  siegesAPourvoir,              // 2 au 1er tour, moins ceux déjà pourvus au 2nd
  clos: bool,
}

bulletin = {
  n,                            // numéro d'ordre, comme la colonne A de son classeur
  voix: [ candId, … ],          // 0 à nomsParBulletin entrées
  statut: 'valide' | 'blanc' | 'nul',
  motifNul: '',                 // « trois noms », « inscription inappropriée »
}
```

### Les assesseurs, saisis après les candidatures (v1.52.11)

L'utilisateur : *« que les assesseurs ne soient pas dans les modalités, mais saisis juste après les
candidats »*. Les deux menus ont quitté la fenêtre ⚙ Modalités (`mel-a1`, `mel-a2` supprimés) ;
le bloc **🧑‍⚖️ Assesseurs** (`_elAssesseursHTML`) est dans l'écran de l'élection, entre les
candidatures et le dépouillement : deux élèves volontaires **non candidats** (leur rôle rappelé),
`electionSetAssesseur(el, i, sid)` — refus : élection close (le PV est fait : affichage seul),
élève hors classe, candidat, ou déjà l'autre assesseur ; noms FIGÉS. Dans l'autre sens, un assesseur
n'est plus proposé comme candidat, et *+ Candidature* le refuse ; ⚠️ le MODÈLE (`electionAddCandidat`)
reste permissif — d'anciens fichiers peuvent avoir un élève dans les deux rôles (fixture de
`fiche.test.js`, cumul de rôles). Le scrutin d'un suppléant n'hérite plus des assesseurs.

**Le président du bureau** (v1.52.12, l'utilisateur : *« ajoute le président du bureau au choix —
le bureau pourrait aussi être présidé par le CPE »*). ⚠️ Aucun texte national ne règle le bureau de
vote (président, assesseurs) : usage d'établissement, documents des académies (cf. CPE de
Versailles). `el.president = { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction }`, absent
= le professeur principal (comportement d'avant) ; `_elPresident`, `electionSetPresident` (élève :
non candidat, non assesseur, nom figé ; refus une fois close). Le bloc s'appelle **🧑‍⚖️ Bureau de
vote** (président puis assesseurs) ; au PV, la signature « Le président du bureau » porte sa
fonction et son nom (avant : « Le professeur principal », sans nom). La fiche de l'élève dit
« président du bureau de vote ». Les candidatures et les assesseurs écartent l'élève président.

### Accord en genre (v1.52.13)

L'utilisateur : *« accorde, en fonction du genre du candidat, tout ce que tu écris dans les
élections »*. Aides : `_civOf(sid)`, `_civCand(c, sup)` — la civilité est **FIGÉE sur la
candidature** (`civiliteTitulaire`, `civiliteSuppleant`, posées par `electionAddCandidat` et par
`electionSuppleantNC`), la fiche vivante en repli pour les candidatures plus anciennes —, `_acc(civ,
m, f, x)` (civilité inconnue : la forme inclusive `x`, « élu(e) »), `_accPl(civs, m, f)` (féminin
seulement si TOUTES), `_civNom(nom)` (« Mme Durand » pour un adulte), `_delMot`, `_supMot`, `_maj`.
Accordés : élu/élue (graphique, résultats, projection, PV), né/née (départage), candidat/candidate,
retiré/retirée, suppléant/suppléante, il/elle accepte (question d'acceptation), Délégué(e)s élu(e)s
(titres), assesseur/assesseure et président/présidente (PV, fiche), délégué/déléguée et
éco-déléguée partout (infobulle du nom, fiche, synthèse, liste imprimée, fiche imprimée).
⚠️ **Restent au masculin générique** : les RÈGLES (« le plus jeune est élu », « le suppléant est
élu avec son titulaire ») et les titres de colonnes. La projection d'un **scrutin de suppléant**
titre « Suppléant(e) élu(e) — de X » (remontée de l'utilisateur : elle disait « Délégué élu »).

### Un siège après l'autre, et qui passe au second tour (v1.52.14)

L'utilisateur : *« il me semblait qu'on élisait d'abord le premier délégué, avec un premier tour et
éventuellement un second, puis le deuxième — pas les deux d'un coup »*. Les sources divergent :
**R421-28** dit « scrutin uninominal à deux tours » — un scrutin élit UNE personne, donc un scrutin
par délégué (lecture défendue par un enseignant, Mathemathieu) ; la fiche **justice.fr** décrit une
seule élection pour les deux sièges (ce que faisait l'app). **Arbitré : un siège après l'autre par
défaut**, réglable (*Plusieurs sièges, un nom par bulletin*). `_elParSiege(el)` = `parSiege` ET
uninominal ET plusieurs sièges (deux noms par bulletin : forcément ensemble) ; absent = ensemble
(les élections déjà tenues gardent leur arithmétique). Chaque tour porte `siege` ; à la clôture
(`electionCloreTour`) : siège pourvu → le scrutin du siège suivant (tour 1, **sans les élus**,
recompter l'urne) ; non pourvu au 1er tour → son 2nd tour ; vacant au 2nd → le suivant. Libellés par
`_elTourLabel` (« siège 2 · tour 1 ») dans le dépouillement, le graphique, les résultats, la
projection (« élu au premier tour (siège 2) »), le PV ; départage manuel indexé par `_elTourCle`
(deux tours portent le même numéro) ; `electionRouvrir` retire tout tour ajouté encore vide.
**Second tour** (*« reprendre tous les candidats, ou ceux au-dessus d'un pourcentage — à défaut les x
premiers —, ou les x premiers »*) : `el.secondTour`, `_elQualifies` — calculé sur le 1er tour, en %
des **exprimés** ; une égalité à la dernière place qualifiante garde tous les ex æquo, et il reste
toujours au moins autant de candidats que de sièges. Dit au PV. Démo : l'élection close passe en
un siège après l'autre (siège 1 puis siège 2, chacun au 1er tour).

### Les sources citées sont liées (v1.53.1)

L'utilisateur : *« lorsque tu cites une note de service ou le ministère de la Justice, qui ne sont
pas les textes officiels de Légifrance, mets le lien »*. `EL_SOURCES` (R421-28 sur Légifrance,
circulaire n° 2004-114 au BO, fiche justice.fr, fiche service-public F1370, dossier des CPE de
l'académie de Versailles) et `_elSrc(k, libellé)` (https, nouvel onglet, `noopener noreferrer`) :
une ligne de sources sous les réglages de ⚙ Modalités (`#mel-sources` : un siège après l'autre,
les sièges ensemble, le nom d'un non-candidat), la question d'acceptation (la circulaire), le bloc
Bureau de vote (l'usage d'établissement, exemple d'académie). ⚠️ Toute nouvelle explication qui
s'appuie sur une source hors Légifrance passe par `EL_SOURCES` + `_elSrc`.

### La saisie se fait bulletin par bulletin

C'est déjà sa méthode (une ligne par bulletin numéroté, une colonne par binôme, on coche), et il faut la garder pour deux raisons : c'est ce qu'il fait pendant que les assesseurs annoncent, et cela laisse une **trace vérifiable** — si un total est contesté, on remonte au bulletin.

- La grille de dépouillement est **élèves-candidats en colonnes × bulletins en lignes**, un nouveau bulletin ajouté à chaque validation, navigation au clavier.
- **Les totaux sont CALCULÉS, jamais saisis.** Aucun champ « nombre de voix » : il se désynchroniserait du dépouillement au premier bulletin corrigé.
- Le **statut est déduit puis corrigeable** : 0 nom → blanc, plus de `nomsParBulletin` noms → nul. ⚠️ Un bulletin nul pour cause d'inscription inappropriée porte 1 ou 2 noms valides et ne peut donc pas être déduit — d'où `statut` inscriptible à la main et `motifNul`.

### ⚠️ L'arithmétique — le piège à ne pas manquer

**Les suffrages exprimés se comptent en BULLETINS, pas en voix.** Avec deux noms par bulletin, le total des voix vaut presque le double du nombre de votants : calculer la majorité absolue sur les voix diviserait tous les pourcentages par deux et **personne ne serait jamais élu au premier tour**. C'est l'erreur silencieuse la plus probable de tout ce projet.

```
inscrits            = effectif de la division
votants             = bulletins déposés
blancs              = bulletins sans aucun nom
nuls                = bulletins invalides
suffrages exprimés  = votants − blancs − nuls          ← le dénominateur
voix d'un candidat  = bulletins valides portant son nom
majorité absolue    = strictement plus de la moitié des suffrages exprimés
                      soit  voix > exprimés / 2   (jamais « ≥ 50 % », jamais d'arrondi)
```

- **Blancs et nuls sont décomptés séparément et n'entrent PAS dans les suffrages exprimés.** Ils apparaissent quand même sur le PV : c'est une information politique, pas du bruit.
- **Majorité absolue = strictement supérieure à la moitié.** Sur 24 exprimés il faut 13 voix, pas 12. Écrire le test en entiers (`voix * 2 > exprimes`) plutôt qu'en flottants.
- Sont élus titulaires les `nbTitulaires` candidats en tête **qui satisfont la règle du tour** — majorité absolue au premier, majorité relative au second. ⚠️ Un tour peut n'élire **qu'un seul** titulaire sur deux : un candidat atteint la majorité absolue, l'autre non. Le second tour ne porte alors que sur le siège restant. **Ne pas supposer que les deux sièges se pourvoient au même tour.**
- ⚠️ **`votantsAnnonces` n'est pas `bulletins.length`.** Le premier est le comptage de l'urne par les assesseurs avant ouverture, le second l'avancement du dépouillement. Les confondre rend l'axe de la projection élastique et supprime le contrôle contre le bourrage. **Un écart entre les deux à la clôture est signalé** — c'est précisément l'anomalie que ce double comptage existe pour détecter.
- **Le compte de l'urne PRÉPARE les lignes** (v1.52.5, l'utilisateur : *« prévois tout de suite un
  nombre de bulletins équivalent à celui renseigné par le nombre des bulletins dans l'urne »*) :
  `electionPreparerBulletins` (champ *Bulletins dans l'urne*, `electionUrneUI`) pose
  `votantsAnnonces` et complète la grille par des lignes **« à lire »** (`lu: false`). ⚠️ **Une ligne
  à lire n'est ni un votant ni un blanc** (`_elStatut` → `alire`, `_elDepouillement` l'ignore) :
  sans cela, la projection afficherait « 25 dépouillés » et 25 blancs avant le premier bulletin.
  Cocher un nom, « nul », **Entrée** ou le bouton **Blanc** la marque lue (`electionSetBulletin`
  efface alors le champ : un bulletin lu n'a pas de `lu`, les fichiers d'avant sont inchangés).
  Un compte plus bas ne retire QUE des lignes à lire, en fin de grille — jamais un bulletin lu.
  On ne clôt pas un tour qui a des lignes à lire. *+ Bulletin* mène d'abord à la ligne à lire
  suivante. Démo : 18 lus sur 25 préparés.
- **Vérité disponible en cours de dépouillement** : `voix × 2 > votantsAnnonces` ⇒ le candidat est **définitivement** au-dessus de la majorité absolue, puisque `exprimés ≤ votants`. C'est le seul verdict anticipé que l'app s'autorise (cf. *Projection en direct*).
- **Départage** : appliqué seulement si l'égalité porte sur le dernier siège attribuable. Depuis le 2026-09-09, `stu.naissance` existe et `_elDepartageAge` tranche automatiquement en `plusJeune` / `plusAge`.
  - ⚠️ La date est **FIGÉE sur la candidature** (`cand.naissanceTitulaire`), comme l'est déjà le nom : les élections sont l'exception assumée à la purge, et un PV signé doit rester relisible — motif de départage compris — après le départ de l'élève. La date figée PRIME sur celle de l'élève vivant.
  - ⚠️ `_elDepartageAge` retourne **null** — « je ne sais pas » — dès qu'une date manque, que deux candidats partagent la même date sur le dernier siège disputé, ou que le mode est `manuel`. **null n'est pas un échec, c'est un refus délibéré de trancher** : l'app rend la main et demande. Un élu que personne ne peut justifier devant la classe est contestable, et vaut moins que rien.
  - La décision MANUELLE de l'utilisateur passe avant la règle automatique : s'il a tranché, c'est qu'il a écarté la règle en connaissance de cause.
  - **La justification est AFFICHÉE** (v1.52.8, l'utilisateur : *« si des candidats ont été départagés par leur âge, indique leur date de naissance dans le PV et sur la projection des résultats »*) : `_elResultatTour` rend `departages` (`{ candIds, elus, voix }`), `_elDepartagesHTML` en fait une phrase par égalité — « Égalité à 2 voix, départagée par l'âge (le plus jeune est élu) : X, né(e) le …; Y, né(e) le … — élu » — au **PV** (sous le tableau du tour, sans emoji), à l'**écran de résultat projeté** et dans les résultats de l'onglet. Date = celle FIGÉE sur la candidature. Un départage MANUEL n'affiche pas de date (ce n'est pas l'âge qui a tranché).
- Si `binome`, le suppléant est élu **avec** son titulaire — pas de calcul séparé.

### Projection en direct du dépouillement

**Le dépouillement se fait devant la classe, et les élèves voient les résultats évoluer graphiquement bulletin par bulletin.** C'est l'usage principal de l'onglet, pas un ornement : la publicité du dépouillement est ce qui rend le résultat incontestable, et voir la courbe monter est ce qui fait comprendre le vote à des élèves de cycle 4.

#### Deux surfaces simultanées

L'enseignant saisit, la classe regarde. Les deux vues affichent le même état au même instant.

- **Par défaut, une seule page en deux volets** : grille de dépouillement à gauche, graphique à droite, le graphique dimensionné pour être lisible du fond de la salle. ⚠️ **C'est le mode à construire en premier, parce qu'il n'a aucun mode de défaillance** — il marche que le vidéoprojecteur duplique l'écran ou qu'il l'étende, et rien ne peut le bloquer.
- **En option, une fenêtre flottante projetable**, reprise de `_timerFillWindow` / `_noiseFillWindow` : Picture-in-Picture (`documentPictureInPicture.requestWindow`, toujours au premier plan) avec repli `window.open`. L'enseignant garde sa grille sur le portable, la classe voit le graphique en plein écran sur le second. ⚠️ **Le repli `window.open` peut être bloqué par le navigateur** (constaté dans le projet de référence) : la fenêtre flottante est un confort, jamais le seul chemin.
- Le calcul et l'état vivent **dans la fenêtre principale** ; la fenêtre projetée est un pur affichage rafraîchi à chaque bulletin, comme `_timerRender` pousse dans le document de la popup.

#### Fenêtre détachée (v1.52.0)

L'utilisateur, le 2026-10-03 : *« le bouton Projeter m'affiche très bien la fenêtre qu'il me
faut, mais il faudrait que ce soit une fenêtre détachée, que je puisse la mettre sur un deuxième
écran »*. Bouton **🖥 Fenêtre détachée** à côté de 📽 Projeter (`elProjectionFenetre`) : une
fenêtre ordinaire (`window.open`, ~~Picture-in-Picture~~ — l'incrustation reste petite et ne
passe pas en plein écran), qu'on fait glisser sur le vidéoprojecteur, puis **⛶ Plein écran**
(F11 en repli). Ses styles sont COPIÉS de la page (les `<style>`, polices comprises), avec le
thème et la police ; elle n'affiche que `_elRenderChart` en mode `.el-right.big` — **jamais le
numéro des bulletins**. Le calcul reste dans la fenêtre principale : `renderDelegues()` =
`_renderDeleguesCore()` + `_elWinMaj()`, donc chaque bulletin, chaque correction et chaque
Ctrl+Z la rafraîchissent. **Ctrl+Z / Ctrl+Y marchent aussi depuis la fenêtre projetée.**
Revenir à la liste des élections garde à l'écran la dernière élection montrée (`_elWinId`).
Bloquée par le navigateur : un toast renvoie à 📽 Projeter, qui marche toujours. Fermée avec la
page (`pagehide`). ⚠️ Le navigateur intégré de test bloque toute fenêtre surgissante : vérifié
en lui substituant un cadre de même origine (graphique, suivi d'un bulletin, Ctrl+Z depuis la
fenêtre) ; **à essayer avec le vrai second écran avant le jour J**.

**Le résultat final** (v1.52.1, l'utilisateur : *« la fenêtre détachée pour le résultat final,
sans les remplacements »*) : le bouton existe aussi sur une élection close, et la fenêtre montre
alors `_elWinResultatHTML` — les élus en grand (titulaire, suppléant, « élu au premier / second
tour »), puis chaque tour (votants, blancs, nuls, exprimés, *majorité absolue : n* au premier tour
seulement, *majorité relative* ensuite ; les voix ; les élus du tour marqués). Clore fait passer
la fenêtre déjà ouverte du graphique au résultat, rouvrir la ramène au graphique. ⚠️ **Jamais
les remplacements en cours d'année** (arbitré) ni bouton ni numéro de bulletin.

**v1.52.2** — *« quand on fait coulisser la liste des votes ou tout ce qui pourrait coulisser,
que l'entête reste visible »* : mesuré, la page défilait et la ligne des candidats passait SOUS
le bandeau. La barre de l'élection (`.el-head`) colle sous le bandeau ; une grille des bulletins
qui tient en largeur ne défile plus dans son cadre (`.bul-plat`, posé par `_elEnteteColle`, écran
≥ 700 × 480) et sa ligne de candidats colle sous la barre (`--el-head-h`, mesurée) ; le graphique
colle aussi (`.el-split > .el-right { align-self: stretch }` — il n'avait pas de place pour
coller). Plus de **filet rouge de marge** sur l'écran projeté (📽 et fenêtre détachée).
**Nom écrit sur un bulletin** (*« les élèves peuvent utiliser une feuille blanche et ajouter un
nom »*) : *✍️ + Nouveau nom* sous la grille → `electionAddEcrit` — l'élève (de la classe,
présent, pas déjà candidat ni suppléant) devient une colonne du tour EN COURS (0 voix sur les
bulletins déjà lus), **sans suppléant**, `ecrit: true` ; dit dans les candidatures et au PV
(« non candidat, nom écrit sur un bulletin ») ; retirable (`electionRemoveEcrit`) tant qu'aucun
bulletin ne le porte. Sans suppléant, élu en binôme : un siège sans suppléant ; s'il part, le siège
est vacant. ⚠️ **Les textes divergent sur ce cas** (cf. *Cadre réglementaire* : R421-28 veut un
suppléant pour chaque candidat ; la fiche service-public et la circulaire de 2004 admettent l'élu
non candidat) — question posée à l'utilisateur le 2026-10-03.
**v1.52.3, arbitré par l'utilisateur (*« fais les deux, avec compte par défaut »*)** :
- **Modalité `el.nonCandidat`** (⚙ Modalités, figée dès le premier bulletin comme l'arithmétique,
  rappelée au PV) : `compte` (défaut, absent = compte — circulaire § 6.1, service-public) ou `nul`
  (lecture stricte de R421-28) — `_elStatut` rend alors NUL tout bulletin où un nom écrit est coché.
- **Acceptation** (*« … et s'il accepte son élection »*) : `electionCloreTour` refuse de clore
  (`{ bloque, accepter: candId }`) tant qu'un élu `ecrit` n'a pas répondu ; `electionCloreUI` pose
  la question devant la classe (*✓ Il accepte* / *✗ Il refuse*), `cand.accepte = true | false`.
  Un refus l'écarte de l'attribution (`_elResultatTour`) : le siège va au suivant selon la règle
  du tour, ou à un second tour. Dit dans les candidatures et au PV.
- ⚠️ **Le suppléant d'un élu non candidat en binôme : AUCUN texte ne le désigne.** ~~L'app ne
  l'invente pas : siège sans suppléant.~~ **v1.52.4** (*« prévois les trois cas »*) : sous les élus
  d'une élection close, un bloc par élu non candidat (`_elSupNcHTML`) — **aucun** (siège sans
  suppléant, défaut), **élu ensuite par un scrutin** (sur le modèle du remplaçant), **désigné par
  l'élu** (avec l'accord du chef d'établissement) ; élève et date. `electionSuppleantNC` pose
  `sidSuppleant` / `nomSuppleant` (figé) et `supNc = { mode, date }` : mandats en exercice, délégué
  surligné, PV, remplacement suivent sans rien de plus ; revenir à « aucun » le retire. Refus :
  élection non close, hors binôme, date avant le scrutin, élève hors classe ou déjà élu. Le PV le
  dit (`_elSupNcTexte`). La question d'acceptation l'annonce.
  **v1.52.6** (l'utilisateur : *« si je coche « élu ensuite par un scrutin », comment faire
  après ? »* puis *« fais les deux »*) : (1) **le bloc guide** — une ligne dit quoi faire selon le
  choix coché, *✓ Enregistrer* reste grisé tant qu'il manque l'élève (`_elSupNcMaj`) ; (2) **le
  scrutin tenu dans l'app** : *🗳 Organiser ce scrutin dans l'app* →
  `electionCreerScrutinSuppleant` crée une élection RATTACHÉE (`supDe = { elId, candId, nom }`,
  un siège, sans suppléant, un nom par bulletin, majorité et départage de l'élection d'origine) —
  candidatures, bulletins préparés, projection, fenêtre détachée, PV (« Procès-verbal de l'élection
  d'un suppléant », « 1 siège à pourvoir : le suppléant »). À sa **clôture**, `_elSupDeAppliquer`
  reporte l'élu comme suppléant (`supNc.scrutinId`) et le PV d'origine cite le scrutin avec ses
  chiffres (« 6 votants, 5 exprimés, 4 voix »). ⚠️ **Un scrutin de suppléant n'est JAMAIS
  « l'élection des délégués »** : `_delegueOf` et la désignation sans vote l'écartent (`!e.supDe`) —
  sans cela, le plus récent des scrutins clos aurait fait de son élu le seul délégué. La liste des
  élections le dit (« ↳ scrutin du suppléant de … »), son en-tête a *↩ Élection d'origine*.
  **v1.52.7** (remontée de l'utilisateur : *« dans la liste des candidats, ils me proposent ceux
  qui ont déjà été élus »*) : `_elSupDeExclus(el)` — titulaires (l'élu non candidat compris) et
  suppléants de l'élection d'origine — retire ces élèves des candidatures et du *nom écrit* du
  scrutin, et `electionAddCandidat` / `electionAddEcrit` les refusent. L'état vide le dit (« sauf
  les 3 déjà élus »). Le suppléant posé par ce scrutin ne s'exclut pas lui-même (rouvrir, reclore).
  **v1.53.2 (audit)** : un suppléant posé APRÈS le vote (`supNc`) n'était pas sur le bulletin —
  `_elCandNomSupBulletin` le tait dans la liste des candidats et les tableaux de voix du PV, les
  candidatures de l'onglet et le graphique ; il est dit sous les élus et dans le bloc du suppléant.
  Le titre du PV s'accorde (« Est élue » pour un seul élu, « Sont élues »).

#### ⚠️ Un pourcentage en cours de dépouillement est trompeur

C'est le vrai piège, et il est pédagogique autant que technique. Le dénominateur (les suffrages exprimés) **grandit à mesure qu'on dépouille** :

- un candidat à « 100 % » après trois bulletins n'a rien gagné ;
- **le pourcentage d'un candidat peut BAISSER alors que ses voix montent** — arithmétiquement normal, mais devant une classe cela passe pour une erreur de comptage et ouvre la contestation ;
- le seuil de majorité exprimé **en voix** n'est connu qu'à la fin, puisqu'il dépend du nombre de blancs et de nuls encore à découvrir.

**Conséquences de conception, à ne pas contourner :**

1. **La grandeur principale affichée est le nombre de VOIX, pas le pourcentage.** Les barres ont pour longueur des voix. Le pourcentage est une mention secondaire, et **toujours accompagnée de son dénominateur** : « 7 voix — 58 % des 12 bulletins dépouillés ». Un pourcentage nu, sans dire sur quoi il porte, est un chiffre faux.
2. **L'axe est fixe, gradué sur le nombre de VOTANTS**, connu avant d'ouvrir le premier bulletin : les assesseurs comptent les bulletins de l'urne avant de les lire, c'est le contrôle d'usage contre le bourrage. Un axe qui se redimensionne à chaque bulletin rend la progression illisible et efface justement ce qu'on veut montrer.
3. **Un indicateur « dépouillés X / Y »** en permanence, et la part restante visible sur l'axe. Sans lui, personne dans la salle ne sait où en est le décompte.
4. **La ligne de majorité absolue est mobile et ne peut que DESCENDRE** : elle vaut la moitié des exprimés, or les exprimés ne sont que les bulletins valides. Chaque blanc et chaque nul la fait baisser. À dessiner comme un repère qui se déplace, avec son étiquette — c'est un excellent support d'explication, pas un défaut.

#### « Déjà élu » — le seul verdict que l'arithmétique autorise en cours de route

Un candidat est **définitivement au-dessus de la majorité absolue** dès que `voix × 2 > votants`, quoi que contiennent les bulletins restants : les exprimés ne peuvent jamais dépasser les votants, donc le seuil final ne peut qu'être plus bas. C'est rigoureux, calculable à chaque bulletin, et spectaculaire à projeter.

⚠️ **Ne PAS afficher de candidat « éliminé » en cours de dépouillement.** L'énoncé symétrique est bien plus fragile — un bulletin plurinominal ajoute une voix à deux candidats à la fois, et le nombre d'exprimés final reste inconnu. Annoncer devant la classe une élimination qui se démentirait au bulletin suivant serait humiliant pour l'élève concerné et ruinerait la crédibilité du décompte. **En cas de doute, l'app ne dit rien** : elle affiche des voix, elle ne prophétise pas.

#### Lisibilité et déroulement

- **Ordre d'affichage figé** (`election.affichage.ordre`), par défaut l'ordre du tirage ou l'ordre alphabétique — **pas le classement**. Des barres qui se réordonnent à chaque bulletin sont impossibles à suivre du regard : on perd le fil de « sa » barre. Le classement reste disponible en réglage pour qui veut l'effet podium, mais ce n'est pas le défaut.
- **Transitions douces** sur la croissance des barres (~250 ms) : c'est ce qui rend la progression perceptible d'un bulletin au suivant. ⚠️ Elles doivent être neutralisables (`*{transition:none!important}`) pour l'audit de contraste, sinon une barre saisie à mi-parcours produit de faux écarts.
- **Taille bornée en `vw` ET en `vh`.** Leçon payée dans le projet de référence sur le minuteur : sur un vidéoprojecteur large, c'est la largeur qui contraint, et des caractères dimensionnés en `vh` seul débordent de l'écran sans prévenir. Vérifier sur plusieurs géométries, du 1920 × 1080 au 1024 × 768.
- **Couleur par binôme** (`candidat.color`, palette par défaut, modifiable) avec l'encre dérivée par `_contrastTextColor` : les couleurs sont éditables, donc aucun blanc figé sur les barres.
- **Blancs et nuls affichés à part**, dans un bloc discret — jamais comme des barres en concurrence avec les candidats, ce ne sont pas des prétendants aux sièges.
- **Correction instantanée d'un bulletin mal lu**, devant la classe, sans casser le graphique. `pushUndo()` **par bulletin** ici — pas le motif de salve `_evalArmUndo` : chaque bulletin est un acte délibéré et distinct, et il doit s'annuler seul. `Ctrl+Z` doit fonctionner depuis la vue de projection.
- Au niveau de charge en jeu (une trentaine de bulletins, quelques candidats), **reconstruire tout le graphique à chaque bulletin suffit**. Ne pas bâtir de machinerie d'animation incrémentale pour ça.

#### ⚠️ Secret du vote — deux règles qui touchent l'affichage

- **Ne jamais projeter le numéro de bulletin.** La numérotation existe pour l'audit (remonter à un bulletin si un total est contesté), pas pour l'écran. Projetée, elle rend le dépouillement traçable bulletin par bulletin.
- **Rappeler de mêler les bulletins avant de dépouiller.** Lus dans l'ordre de dépôt dans l'urne, et des élèves se souvenant de l'ordre dans lequel ils sont passés, les votes redeviennent attribuables. C'est le seul point de la procédure où l'app peut aider par un simple rappel affiché à l'ouverture du dépouillement — à mettre là plutôt que dans une documentation que personne ne relira.

### Procès-verbal imprimable

Le livrable de l'onglet. Une page portrait, sans thème sombre (cf. neutralisation `@media print`), portant : établissement et classe, date, modalités appliquées (les réglages de l'élection, en clair), la liste des candidats, inscrits / votants / blancs / nuls / exprimés, le tableau des voix par candidat et par tour, les élus, les **deux assesseurs et le professeur principal avec des lignes de signature**.

**Une page, et la signature des élus** (v1.52.9, l'utilisateur : *« le procès-verbal imprimé doit
tenir sur une page ; et prévoir la signature des élus dessus aussi »*) : les règles `.pv*` sont
sorties de `@media print` et passées en `em` ; `_pvFitPt` mesure le PV hors champ, à la largeur
imprimable d'une A4 portrait, et `_printFitSize` choisit la plus grande taille qui tient (7 à
11 pt ; l'espace de signature ne descend jamais sous 9 mm). Démo, élection à deux tours avec un
remplacement : 333 mm à 11 pt (deux pages) → 255 mm en 8,25 pt. S'il déborde même à 7 pt, un toast
le dit. **Les élus signent** (`_pvElusSignHTML`, section *Les élus — acceptation du mandat* : une
case par titulaire et par suppléant élu) — aucun texte ne l'impose, mais leur signature atteste
l'acceptation que la circulaire de 2004 exige d'un élu non candidat. **v1.52.10** (*« groupe bien
le titulaire avec son suppléant »*) : en binôme, un CADRE par binôme (`.pv-binome`, titulaire et
suppléant côte à côte, deux cadres par rangée) ; un élu non candidat sans suppléant a son cadre
avec « Suppléant : aucun ». Hors binôme, titulaires puis suppléants. Démo : 8,75 pt, une page.

⚠️ **Le PV n'est imprimable que `clos: true`.** Un PV signé qui ne correspond plus au dépouillement affiché est un faux ; clore verrouille la saisie, et rouvrir demande une confirmation explicite.

### Après l'élection

- Les élus sont reportés sur l'élève (`stu.delegue = 'titulaire' | 'suppleant' | null`, dérivé de l'élection close la plus récente de sa classe) pour être visibles dans la **Synthèse** et dans la liste des élèves — un PP a besoin de savoir qui sont ses délégués sans rouvrir l'élection.
- **Le PV signé, en PDF** (v1.20.0) : une fois l'élection close, bloc « 📎 Joindre le PV signé » sous le résumé des élus → `election.pv = { nom, fichier, taille }` ; le même bloc sur la désignation sans vote (`cls.delegues.pv`, qui survit à une correction des noms). Même dossier et mêmes règles que les fiches incident (`_pjRef`, `_pvBlocHTML`, `pvAttachUI` / `pvOpenUI` / `pvRemoveUI`), nom automatique `PV élection délégués — 5e C — AAAA-MM-JJ.pdf`. `_pjReferences` les compte, donc le nettoyage des orphelins les épargne.
- **Sans élection dans l'app** (v1.19.0, demande de l'utilisateur) : le PP peut avoir voté sur papier, ou reprendre une classe en cours d'année — il doit quand même pouvoir dire qui sont les délégués. Bloc *« ✍️ Délégués désignés sans vote dans l'app »* en bas de l'onglet 🗳 : date, deux titulaires, deux suppléants, un mot → `cls.delegues` (`deleguesSet` / `deleguesClear`, roster seulement, un rôle par élève).
  - ⚠️ **`_delegueOf` arbitre par la DATE** : la désignation prime si elle est plus récente que la dernière élection close (ou s'il n'y en a pas), sinon l'élection fait foi — et l'écran le dit (« remplacée par l'élection du … »). C'est ce qui permet aussi de noter une démission après une élection tenue dans l'app : une désignation plus récente reprend la main. À date égale, la désignation gagne (`>=`) : c'est le geste le plus délibéré.
  - ⚠️ Contrairement aux élections (PV historique, exception de purge), **c'est un état courant** : `_purgeStudentRefs` retire l'élève parti, et une désignation vidée disparaît. Dans l'état maximal du test de balayage.
- ⚠️ **Ne pas stocker `stu.delegue` en dur** : le dériver de `S.elections`, sinon une correction du dépouillement laisse un ancien délégué marqué. Si un cache est nécessaire, le recalculer dans `postLoadHook`.
- **Éco-délégués** (v1.27.0, demande de l'utilisateur — la question 6 ci-dessous est
  tranchée) : **la même mécanique, un autre mandat**. `election.type` (`_EL_TYPES` :
  `delegues` 🗳 · `eco` 🌱 — libellé, titre par défaut, intitulé du PV, défauts), choisi
  dans la modale de création (le mandat pose titre, binôme, suppléants, noms par bulletin
  — sur une élection en cours de création seulement). Défauts éco **= les textes** (v1.28.1,
  après vérification — la v1.27.0 mettait deux élus et deux noms par bulletin, de mémoire) :
  **un élu, sans suppléant ni binôme, un nom par bulletin**, majorité absolue au 1er tour ;
  « deux si l'établissement le décide » se règle dans la modale. Chaque mandat porte ses
  `textes` (`{ ref, quoi, url }`), rendus par `_elTextesHTML` (liens `target=_blank
  rel=noopener`, échappés, testés) dans la modale, en tête de l'élection ouverte, et cités
  au pied du PV. Démo : un éco-délégué élu au premier tour (13 voix sur 24).
  - ⚠️ **`nbSupplants` = 0 est une valeur.** `rest.slice(0, el.nbSupplants || el.nbTitulaires)`
    aurait fait deux suppléants d'une élection qui n'en veut pas ; `_elNbSup(el)` distingue
    0 (aucun) de absent (fichier antérieur : autant que de titulaires). ~~Hors binôme, le
    sélecteur *Suppléants* de la modale est libre (2 titulaires + 1 suppléant, c'est
    possible) ; en binôme il suit les titulaires.~~ **Révisé en v1.30.1 (demande de
    l'utilisateur : *« laisser le nombre de suppléants réglable pour les délégués »*) : le
    sélecteur n'est plus grisé en binôme.** Le binôme signifie « chaque titulaire élu avec
    SON suppléant », donc autant de l'un que de l'autre : cocher le binôme aligne les
    suppléants, changer les titulaires en binôme les fait suivre (`_elNbtChange`), et
    choisir un AUTRE nombre de suppléants **défait le binôme en le disant** (`_elNbsChange`,
    toast) plutôt que d'être refusé en silence. Testé par événements sur des éléments
    persistants (le stub du harnais en rend un neuf par appel).
  - ⚠️ **Deux mandats qui ne se confondent JAMAIS** : `_delegueOf(sid)` ne regarde que les
    élections `delegues` et `cls.delegues` ; `_ecoDelegueOf(sid)` (= `_delegueOf(sid,
    'eco')`) que les élections `eco` et `cls.ecoDelegues`. Même arbitrage par la date entre
    désignation et élection close. Testé dans les deux sens (clore l'une ne fait rien à
    l'autre). Un élève peut cumuler.
  - **Affichage** : l'éco-délégué n'est pas surligné (le vert et le jaune sont pris) — il
    porte **🌱 après le nom** (`.eco-bdg`, dans `_nomHTML`, donc dans les cinq grilles),
    une ligne *Éco-délégué* sur la fiche, `(éco-délégué)` sur la liste imprimée et la
    synthèse de période, `r.eco` dans `_syntheseRow`. PV : titre, modalités (« sans
    suppléant », « candidatures individuelles »), tableau des élus à une colonne.
  - **Désignation sans vote** : le même bloc, une seconde fois (`_deleguesDirectHTML(cls,
    list, kind)`, ids `de-*`, `deleguesSet(cls, data, 'eco')`, `_delDirectOpen` par mandat,
    cible PV `'de'`). `_purgeStudentRefs` purge `cls.ecoDelegues` comme `cls.delegues` ;
    dans l'état maximal du test de balayage.
  - Démo : une élection d'éco-délégués close (14/10), trois candidats, un tour, 18 bulletins
    à deux noms. ⚠️ Elle est plus récente que celle des délégués : un `find(e => e.clos)`
    tombe dessus — les tests désignent l'élection par son type.
- **Démission ou départ d'un délégué en cours d'année** (v1.29.0, option 1 arbitrée par l'utilisateur le 2026-09-11) : ce n'est PAS une nouvelle élection — circulaire n° 2004-114 § 6.1, « le chef d'établissement fait procéder […] à l'élection d'un remplaçant ». Une **trace datée sur l'élection close** : `election.remplacements = [{ id, ts, date, candId, qui: 'titulaire'|'suppleant', motif: 'demission'|'depart'|'autre', texte, remplacantCandId, nomParti, nomRemplacant }]`. Le dépouillement et le PV d'origine ne bougent pas ; le PV gagne une section *« Remplacements en cours d'année (postérieurs au scrutin) »*.
  - **Les mandats se DÉRIVENT** : `_elEffectifs(el)` → `{ titulaires: [{ sid, nom, candId, promu }], suppleants, vacants }`, et `_delegueOf` s'appuie dessus. Un titulaire parti en binôme est remplacé par **son** suppléant (promu) ; hors binôme, par le suppléant élu **choisi** (`remplacantCandId`, une seule fois par suppléant) ; sans suppléant (éco-délégué), le siège est **vacant** — l'écran et le PV le disent, l'app n'invente personne. Un suppléant qui part n'a pas de successeur. `electionRemplacer` refuse : élection non close, mandat non élu, date illisible, doublon (un mandat ne se remplace qu'une fois), successeur non suppléant ou déjà promu. Noms FIGÉS (`nomParti`, `nomRemplacant`) comme sur les candidatures.
  - ⚠️ **Bug corrigé au passage** : avant la v1.29.0, `_delegueOf` testait « est titulaire » AVANT « est parti » — un titulaire démissionnaire serait resté surligné en vert. Le champ existait depuis l'étape 6 sans écran ; personne ne l'avait donc exercé. Testé dans les trois configurations (binôme, hors binôme, sans suppléant) et sur la démo (le titulaire élu au second tour démissionne le 12 janvier, son suppléant devient titulaire : deux titulaires, un suppléant).
  - **Écran** : bloc *🔁 Remplacements en cours d'année* dans les résultats de l'élection close (`_elRemplacementsHTML`) — la liste (🗑, Ctrl+Z), *« En exercice : … (ex-suppléant) · siège vacant »*, et le formulaire en place (qui part · date · motif · successeur hors binôme · mot). Un remplacement ne peut pas précéder le scrutin. La désignation sans vote plus récente prime toujours, comme avant.
  - Rouvrir l'élection ne touche pas aux remplacements (ils portent des `candId`) ; une élection rouverte n'est plus close, donc `_elEffectifs` ne rend rien tant qu'elle ne l'est pas à nouveau. Rien à purger : aucun sid.

## Bilans de période — préparer le conseil de classe, faire le point à mi-période

Demandé le 2026-09-11 (*« préparation du conseil de classe », « bilan de mi-période »*).
La remarque libre servait à ça par défaut, mais elle n'est pas datée : au S2 on écrasait
le S1. D'où une entrée **datée et qualifiée** par élève — `stu.bilans`, `_BILAN_TYPES` =
`conseil` 🎓 · `miperiode` 📝 — dont **la période se DÉDUIT de la date** (`_periodOf`),
comme tout le reste : rien n'est stocké par période, changer semestre ↔ trimestre ne perd
rien. Sans note ni moyenne : elles sont dans Pronote, ceci est le brouillon du PP.

- Modèle pur et testé : `bilanAdd/Set/Remove` (refus d'une date illisible ou d'un texte
  vide — *un bilan vide se supprime, il ne se vide pas*), `_bilansOf` (récent d'abord),
  **`_bilanPeriode(cls, sid, pIdx, type)`** : le plus récent DE la période, du type demandé
  d'abord, l'autre type à défaut (un bilan de mi-période vaut mieux que rien quand on
  prépare le conseil). `_syntheseRow.bilan` = celui de la **période courante**.
- **La liste des élèves** porte une colonne *Conseil S1* (bouton 🎓 / 📝 coloré s'il y en a
  un — 6,94:1 —, texte tronqué dessous comme la remarque), triable « rédigé d'abord », et
  **imprimée** avec la liste. **La fiche** a sa section 🎓 (toutes les entrées, période
  en clair, ✏️ 🗑, pastille `+`).
- **La modale `mbilan` ENCHAÎNE les élèves** (`openBilan`, `bilanNav(±1)`, Ctrl+Entrée) dans
  l'ordre de la liste à l'écran, tri et filtre compris (`_bilanOrdre` = `_elevesRows`) :
  préparer un conseil, c'est passer sur les vingt-cinq, pas rouvrir vingt-cinq fiches.
  Ouverte sans id depuis la liste, elle **reprend** le bilan de la période courante s'il
  existe (on le complète, on n'en crée pas un second) ; depuis la fiche, `+` force une
  entrée vierge. `_bilanCommit` n'empile un undo que si quelque chose a changé ; « Suivant »
  garde le moment choisi (conseil / mi-période) d'un élève à l'autre.
- ⚠️ **La date par défaut est ramenée dans l'année scolaire de la classe**
  (`_ymdClampAnnee`) : en septembre on relit encore la classe de l'an dernier, et un bilan
  daté d'aujourd'hui tomberait hors de toutes ses périodes — donc nulle part.
- Démo : cinq bilans au S1, trois au S2 (la colonne de la liste n'est pas vide en fin
  d'année). `postLoadHook` crée la section et écarte les entrées non-objets. Dans l'état
  maximal du test de balayage.

### Décisions d'un moment de bilan (v1.46.13)

Demandé le 2026-10-03 : *« lors des bilans de mi-semestre ou de fin de semestre, quand on se
réunit, on prend des fois des décisions ou on veut mettre des choses en place ; juste en dessous
du bilan sur la fiche, de quoi le noter »*. **À côté du bilan, pas dedans** : le bilan est ce que
le PP dit, la décision ce que l'équipe a arrêté (avertissement, PPRE, tutorat, rendez-vous…).

- `stu.decisions`, une entrée par MOMENT : `_decisionCible(cls, sid, { type, date })` — même
  type, même période (même mois pour un point du mois), comme `_bilanCible`. `decisionSet` (pur
  sauf l'écriture) crée, modifie, ou **retire quand le texte est vide** (→ `'ajout' | 'modif' |
  'suppr' | null`) ; contrairement au bilan, vider retire : Ctrl+Z la rend.
- **Fiche** : sous le bilan du moment choisi, dans les trois vues (`_ficheRedacHTML`), un champ
  *Décisions · à mettre en place*, enregistré en quittant le champ (`ficheDecisionSave`, un cran
  d'undo, sans re-rendu — et aussi avant ◀ ▶ ou un changement de moment au clavier). Les autres
  moments montrent leurs décisions sous leur bilan ; la chronologie les date.
- **Synthèse de période** : `row.decisions` (le moment de la feuille), « **Décisions :** … »
  sous le bilan, tableau et fiches.
- `postLoadHook` écarte les entrées illisibles ; rien à purger à part (sur l'élève). Démo :
  quatre décisions (avertissement, PAP et tutorat, changement de place, félicitations).
- **La fenêtre de bilan aussi** (v1.47.0, audit C1 — on enchaîne les élèves en réunion par
  la fenêtre `mbilan`, ouverte par les points de la liste ou par ✍️ de l'onglet Avis) : champ
  *Décisions* sous le bilan (`mbilan-dec`, `_bilanDecCharge` à l'ouverture et à ◀ ▶),
  enregistré par `_bilanCommit` avec le bilan — **un seul cran d'undo pour les deux**, des
  décisions sans bilan acceptées. **Signalées** : point de la colonne Bilans entouré d'un second
  anneau (`.el-bd.d`), case **◉** dans la carte de chaleur, le texte en infobulle.
- **Les deux champs grandissent avec leur texte** (v1.46.14, l'utilisateur : *« la fenêtre de
  décision un peu plus grande ; bilan et décision qui s'adaptent tout seuls à la taille du
  texte »*) : `field-sizing: content` et `_autoTaille` (à l'ouverture et à la frappe) ; hauteur
  minimale 120 px pour le bilan, 90 px pour les décisions.

### Synthèse de période imprimable (v1.26.0)

⚠️ **Révisé en v1.47.3 (second audit, D3)** : la fenêtre ne demande plus « Période » puis « Moment
(conseil / mi-période) » mais **un MOMENT** — ceux de « Synthèse pour » (carte de chaleur, fiche) :
conseil, mi-période, point du mois, rangés par période. La feuille est **bornée au moment**
(`_ficheBornes` : la période pour un conseil, du début au milieu pour la mi-période, le mois pour
un point du mois — ⚠️ **arbitré par l'utilisateur le 2026-10-03 : une feuille de mi-période
couvre bien du début de la période à son milieu**, comme la fiche, et non plus la période
entière), et porte le bilan et les décisions de CE moment ; titre = le moment
(« Point de septembre — 5e C »). `_periodeSynthese(cls, idx, { type, col })` : sans `col`, la
période entière, comme ci-dessous (les tests d'origine passent ainsi). Les moyennes gardent leur
règle (période du bureau numérique de la période de l'app).

### Un seul bouton « 🖨 Imprimer… » (v1.50.0)

L'utilisateur, le 2026-10-03 : *« je ne vois pas vraiment la différence entre synthèse de
période et imprimer la liste, c'est très similaire »* — puis *« regroupe-les et supprime les
résumés »*. La barre de 👥 Élèves n'a plus qu'**🖨 Imprimer…** (et Ctrl+P sur Élèves) → la
fenêtre `mperiode`, qui demande d'abord **Quoi** (`_periodePrintOpts.quoi`, de séance) :
- **Le trombinoscope** (v1.51.0, cf. *📷 Photos des élèves*) ;
- **La liste telle qu'à l'écran** (défaut) — l'état du jour : colonnes, tri et filtres affichés
  (`printEleves({ format })`, l'ex-« 🖨 Imprimer la liste ») ; A4 en 8,5 pt, **A3 en 12 pt**
  (`_elevesPrintPt`), taille toujours FIXE ;
- **La synthèse d'un moment** — moment, blocs, forme : **tableau** (une page) ou **fiches** (la
  fiche élève imprimée, une page par élève).
⚠️ **Les « résumés » (forme `fiches` de la v1.26, un bloc court par élève) sont SUPPRIMÉS** :
rendu, CSS `.print-fiche*`, option. Leurs tests portent désormais sur `_fichePrintHTML`.
Avec une fiche ouverte, Ctrl+P ouvre toujours l'impression de la fiche.

### La fiche élève imprimée (v1.49.0)

Demandé le 2026-10-03 : *« ajoute le bouton Imprimer dans la fiche »* — et *« quand j'imprime la
synthèse de période, j'ai une liste de tous les élèves, je n'ai pas la fiche élève »* : la forme
« fiches » ci-dessous est un bloc COURT par élève, à la suite (renommée *résumés*), pas la fiche.

- **`_fichePrintHTML(cls, sid, col, opts, photo)`** : la fiche du tableau de bord sur le papier,
  bornée au moment (`_ficheBornes`), **une page par élève** (`.fp-page`, `break-after: page`) —
  en-tête (photo, nom, classe · âge · groupe · options · aménagements · délégué, moment et dates),
  bilan et décisions du moment sur toute la largeur (**vides : des lignes pointillées à remplir
  au stylo**, la feuille sert pendant la réunion), puis deux colonnes (identité, remarque,
  observations avec la courbe, moyennes — sous 10 en gras —, incidents avec la décision,
  contacts, papiers avec les choix portés), puis les avis des collègues et, au choix, les autres
  moments de l'année. Parties : `FICHE_PRINT_PARTS` ; *Autres bilans* décoché par défaut.
  Paragraphes gardés (`.fp-pl`). CSS `.fp-*` dans `@media print` (pas de mesure « une page » :
  une fiche trop longue continue sur la page suivante — 2 sur 25 dans la démo, toutes parties
  cochées).
- **Bouton *🖨 Imprimer* dans la barre de la fiche**, et **Ctrl+P fiche ouverte** (sans autre
  fenêtre par-dessus — avant, Ctrl+P imprimait la liste derrière) → fenêtre `mficheprint`
  (`openFichePrint`) : moment (la liste de « Synthèse pour », `_momentsOptionsHTML`, partagée avec
  la synthèse de période), parties, photo, **cet élève ou toute la classe** (`_fichePrintEleves` :
  les présents de la période, dans l'ordre de la liste), A4 / A3. Réglages de séance
  (`_fichePrintOpts`), rien dans `S`.
- **Synthèse de période, forme *fiche complète*** (*fiches* depuis la v1.50.0) : la même fiche pour chaque élève ; les blocs
  cochés deviennent ses parties (identité et remarque toujours, la courbe avec les observations).
- `_fichePrintGo` lit les photos d'abord ; `_printHTML` **décode les images** avant d'ouvrir
  l'impression. Rendu papier vérifié par injection des règles d'impression, depuis les deux
  thèmes ; ⚠️ le vrai papier, non.

**La feuille qu'on emporte au conseil** — bouton *🎓 Synthèse de période…* dans la barre de
la liste, modale `mperiode` : période (défaut : la courante), moment (conseil / mi-période —
titre et type de bilan), blocs (`_PERIODE_BLOCS` : observations · moyennes · non rendus ·
incidents · contacts · bilan), forme (**tableau** paysage, une ligne par élève / **fiches** portrait, un
bloc par élève jamais coupé — ce qu'on lit pendant que le conseil parle de lui). Le résumé
dit combien d'élèves sont **sans bilan rédigé**. Les choix se retiennent pour la session
(`_periodePrintOpts`).

- ⚠️ **Tout est BORNÉ À LA PÉRIODE** (`_periodeSynthese(cls, pIdx, {type})`, pur, testé) —
  c'est ce qui la distingue de la liste des élèves (« où en est-on aujourd'hui ») : cumul
  en **fin de période** et total de la période (pas le dernier relevé de l'année), relevés
  où l'élève était absent, incidents et contacts **de** la période (bornes incluses, testé
  au 31/01 et au 01/02), papiers distribués **jusqu'à sa fin** et pas rendus (un papier de
  février n'est pas un manquant du S1 ; `suiviRetour: false` n'y entre jamais), bilan de
  la période (type demandé d'abord, l'autre à défaut).
- **Le tableau tient sur UNE page** (v1.34.0, demande de l'utilisateur : *« plus lisible, en
  une page — si c'est petit, je l'imprime en A3 »*). Choix **A4 / A3** dans la modale
  (`_periodePrintOpts.format`, A4 par défaut). La taille de texte n'est pas fixée : elle
  est **calculée** — `_printFitMeasure` rend la feuille hors champ à la largeur
  imprimable, et `_printFitSize` (pur, testé) cherche par dichotomie la plus grande taille,
  au quart de point, qui tient dans la hauteur (marge de sécurité 4 %). Plafond 10,5 pt en
  A4, 13 en A3 ; plancher **6 pt** — en dessous, on ne triche pas : le résumé et un toast
  disent « ≈ N pages, passe en A3 ou décoche un bloc ». Le résumé de la modale annonce la
  taille AVANT d'imprimer (« tient sur une page A4, texte en 6 pt — petit : l'A3 le rendra
  plus lisible »). Démo complète : 6 pt en A4, 9 pt en A3. ⚠️ Remesuré le 2026-09-30 en
  Latin Modern, plus large que la police d'avant : avec les six blocs, la démo ne tient
  plus en A4 (≈ 2 pages à 6 pt) — l'A3 passe à 8,5 pt ; avec trois blocs, 8,25 pt en A4.
  - ⚠️ **Les règles `.pp-*` sont HORS `@media print`, et tout y est en `em`.** La mesure se
    fait à l'écran : des règles cantonnées au papier ne s'appliqueraient pas à la boîte de
    mesure, et la taille calculée serait fausse. Elles ne touchent que ce qui vit dans une
    `.print-area` (invisible à l'écran). Titre en `div.pp-titre`, pas en `h1` : la règle
    papier `.print-area h1` (en pt, plus spécifique) aurait divergé de la mesure.
  - ⚠️ **`table-layout: fixed` + `<colgroup>` pondéré** (le bilan a la plus large colonne) :
    sans largeurs fixes, la hauteur dépend de ce que le navigateur devine, et une mesure
    faite à l'écran ne prédit plus le papier.
  - ⚠️ **Tout ce qui peut tenir sur une ligne y tient** : une cellule sur deux lignes double
    la hauteur de toute la rangée. Première version mesurée : 1 018 px à 7 pt pour 703
    disponibles — « trop long même en 6 pt » ; après condensation, 646 px à 6 pt.
  - Une ligne sur deux grisée (`print-color-adjust: exact`), en-têtes soulignés, dates en
    jj/mm (l'année est au sous-titre), évolution des moyennes datée une fois au sous-titre.
  - ⚠️ **A3 : la page nommée `landscape` imposerait l'A4** — `.print-area.a3 { page: auto }`,
    et c'est le `@page` anonyme (`_setPageOrientation(kind, format)`) qui décide.
  - Les fiches portrait ne sont pas ajustées : un bloc par élève sur plusieurs pages, c'est
    leur forme. Le format A3 s'y applique quand même.
- **Moyennes** (v1.33.0, demande de l'utilisateur) : générale du dernier import, son
  évolution depuis le premier import de la période (ou depuis le premier où l'élève avait
  une générale chiffrée, s'il est arrivé en route), et les matières — toutes sur les
  fiches, seulement celles **sous 10** dans le tableau. Sur le papier, sous 10 = **gras**.
  ⚠️ **Ici, on ne borne PAS par la date d'import** — c'est l'unique exception à la règle
  ci-dessus, et elle est voulue : le conseil du S1 se tient souvent **après** la fin du S1,
  et c'est l'export de la veille, daté de février, qui porte les moyennes définitives.
  `_moyPourPeriode` retient la période du bureau numérique (colonne « Périodes ») dont le
  **premier** import tombe dans la période de l'app, et en prend le **dernier** import, où
  qu'il tombe. ⚠️ **Aucun repli** sur « importée pendant la période » : l'export de février
  du S1 aurait alors garni la feuille du S2 tant que le S2 n'a pas son premier import
  (testé dans les deux sens). Sans import pour la période, la feuille le **dit** au sous-titre.
- ⚠️ **Les élèves PRÉSENTS pendant la période**, pas ceux d'aujourd'hui : parti en
  septembre → sur la feuille du S1 (avec « parti le … »), pas sur celle du S2 ; arrivé en
  mars → l'inverse. Ordre : celui de la liste à l'écran (tri courant), mais **sans le filtre
  de recherche** — une feuille de conseil ne se filtre pas.
- `_periodePrintHTML` rend `{ kind, html }` ; tout est échappé (testé avec un nom et un bilan
  piégés). CSS `.print-fiche*` dans le bloc `@media print`. Vérifié à l'écran par injection
  des règles d'impression (tableau paysage et fiches portrait) ; ⚠️ le papier réel, non.

## Avis des collègues (v1.39.0)

Demandé le 2026-10-02 : *« à l'approche des bilans, je demande l'avis des collègues sur
certains élèves — investissement, comportement, implication — avec un lien de réponse qui
enregistre leur réponse là où le logiciel pourra la récupérer »*.

**Le circuit** : une **feuille de calcul du Nuage** (Nextcloud académique, Collabora,
format **.ods**), **un onglet par discipline**, partagée par **lien public en modification**
— les collègues écrivent sans compte. Le client Nextcloud recopie la feuille sur le poste
(`~/Nextcloud/…`, c'est nuage03) ; l'app la **prépare** (écrit les onglets, les élèves, les
titres) et la **relit**, dans ce fichier local, par File System Access (un handle par
campagne, IndexedDB `avis_<id>` — propre au poste, comme le dossier des PDF).

- ⚠️ **Pourquoi pas plus direct** : l'app est une page statique sans serveur, et le
  navigateur lui interdit de parler au Nuage (CORS, CSP). **Formulaires n'est PAS activé**
  sur le Nuage (vérifié par l'utilisateur : `…/apps/forms` → erreur). Google Forms,
  Framaforms : écartés, un avis sur le comportement d'un élève ne sort pas des services de
  l'Éducation nationale.
- ⚠️ **Réponses LIBRES**, trois par discipline (`AVIS_CRITERES`) — arbitré : *« une réponse
  libre, pas un commentaire fermé »*. Aucune échelle, aucun calcul.
- **Les trois colonnes** (v1.40.0, arbitrées par l'utilisateur) : **Travail** (travail
  personnel, devoirs, régularité, résultats) · **Participation** (oral, activité, groupe —
  l'implication en classe) · **Comportement** (attitude, règles, relations). Les premières,
  « investissement » et « implication », se recouvraient. Chaque colonne porte sa
  **consigne** (`aide`), écrite sous l'en-tête dans la feuille et dans le message. ⚠️ **Pas de
  colonne « à dire au conseil »** (refusée par l'utilisateur). Migration : `AVIS_CLES_ANCIENNES`
  (au chargement) et `alias` (les anciens en-têtes restent lus dans une feuille déjà préparée).
- **Colonnes réglables par feuille** (v1.42.0, demande de l'utilisateur : *« pour la synthèse
  des bulletins, je me servirais des appréciations de bulletin, qui ne sont pas en plusieurs
  colonnes — chaque élève n'a qu'une remarque ; gérer depuis l'app le nombre de colonnes et
  leurs titres, avec des choix préréglés selon les situations »*) : `camp.colonnes = [{ key,
  label, aide, alias? }]`, figées avec la feuille comme ses disciplines ; **absentes = les
  trois d'origine** (`_avisCols`, les feuilles d'avant n'ont rien à migrer). Modèles
  (`AVIS_MODELES`) : *Travail · Participation · Comportement* (conseil), *Appréciation de
  bulletin* (une colonne), *Une remarque libre* (une colonne — proposé d'office pour le point
  du mois, `_avisModeleDefaut`), *Points forts · À travailler* (rencontre avec une famille) ;
  ou personnalisées, de 1 à `AVIS_COLS_MAX` = 5. Réglées dans la modale : à la création
  (le modèle suit l'objectif tant qu'on n'y a pas touché) et dans le volet *🧱 Colonnes de la
  feuille* d'une feuille existante (puis *Mettre la feuille à jour*). `avisColonnesSet` (pur)
  : ⚠️ **la CLÉ d'une colonne ne change jamais** — c'est sous elle que les avis sont rangés ;
  renommer garde la clé et l'ancien titre passe en `alias` (une feuille déjà préparée se
  relit) ; une colonne neuve reçoit la clé de son modèle ou `c_<titre>` ; **refus** d'une
  colonne retirée qui porte des avis (on ne perd rien sans le dire), d'un titre vide, en
  double ou « Élève », de zéro ou plus de cinq colonnes. Tout suit les colonnes de la feuille :
  l'.ods (la largeur des trois colonnes d'origine, 21,6 cm, se partage — une colonne seule
  fait 14 cm ; « Écrivez dans la colonne de droite »), la lecture (⚠️ un onglet dont AUCUN
  en-tête n'est reconnu n'est pas lu : vide, il ferait foi et proposerait d'effacer), la
  revue, le compte, le message (repère `{colonnes}` — « Une seule colonne, **Appréciation** :
  … »), la fiche, le bilan, la synthèse de période (titres de la feuille, une colonne seule ne
  s'annonce pas). Démo : un **point de mars** à une seule colonne *Remarque* (`demo_av2`).
  Vue dans LibreOffice.
- **Élèves demandés en particulier** (`camp.cibles`, v1.40.0 — *« je compte en discuter avec
  leurs parents prochainement »*) : leur nom est **surligné en jaune** (style `vif`) dans chaque
  onglet, le mode d'emploi le dit, le message les cite. Choisis dans la modale (⭐), purgés
  avec l'élève (`_purgeStudentRefs`). ⚠️ Changer la liste d'une feuille déjà préparée demande
  *Mettre la feuille à jour* pour que le surlignage y arrive.
- **L'OBJECTIF de la feuille** (v1.40.6 — *« ce n'est pas forcément pour le conseil du S1,
  ça peut être pour le conseil de mi-semestre, et je ne vois rien d'indiqué pour ça »*) :
  conseil de classe (fin de période) · conseil de mi-période (« mi-semestre » ou
  « mi-trimestre » selon le réglage) · point du mois. Choisi à la création, réglable en tête
  d'une feuille existante (rangé dans `camp.msg.moment` / `mois`). `_avisObjectif` →
  `{ court, long }`, DIT partout : titre de la feuille (« avis pour le conseil de mi-semestre
  (S1) »), liste des feuilles, message (repère `{objectif}`), bilan, fiche. ⚠️
  `_avisEleve(cls, sid, pIdx, prefere)` lit d'abord la feuille du MÊME objectif : le bilan de
  mi-période lit l'avis de mi-semestre, le conseil celui du conseil (synthèse de période
  comprise, par `o.type`). Démo : deux feuilles au S1, mi-semestre (novembre) et conseil (janvier).
- **Mes bilans pour l'objectif de la feuille** (v1.40.8 — *« comment me noter un petit bilan
  de la période où j'ai collecté des avis ? le bilan du S1 n'est pas pour le mois de
  septembre ni pour le conseil de mi-semestre »*) : bouton *✍️ Noter mes bilans pour …* sur
  chaque feuille → la modale `mbilan` en **mode feuille** (`_bilanMode = { type, date, campId }`,
  `_avisBilanMode`) : le TYPE de bilan suit l'objectif (conseil · mi-période · **point du
  mois**, nouveau type `mois` de `_BILAN_TYPES`, libellé « Point de septembre » par
  `_bilanLabel`), la date est celle de la feuille si elle tombe dans la période (sinon
  aujourd'hui ramené dedans), les élèves défilent dans l'ordre de la feuille, et ce sont les
  avis de CETTE feuille qui s'affichent au-dessus. ⚠️ `_bilanCible` **reprend** le bilan du
  même type et de la même période (du même mois pour un point du mois) au lieu d'en créer
  un second. Démo : un point de septembre.
- **Le message aux collègues, en PARTIES** (v1.40.0 — *« pour différents moments de l'année :
  un mois, la fin du semestre ou du trimestre, les bilans intermédiaires ; des parties déjà
  écrites, faciles à remplacer, ou ne garder que la partie nécessaire »*) : `AVIS_MSG_PARTIES`
  (salutation · le moment · la demande · **seulement si besoin** · les colonnes · élèves en
  particulier · échéance · formule finale — la parenthèse « vous pouvez ne compléter que pour
  les élèves dont vous en ressentez le besoin » est une partie À PART depuis la v1.40.10,
  demande de l'utilisateur : on la garde ou non selon le moment), `AVIS_MOMENTS` (conseil · mi-période · point du mois, avec le mois). Chaque
  partie se coche ou non (`camp.msg.off`), une partie sans objet (pas d'élève choisi, pas
  d'échéance) se retire d'elle-même. Les **textes** sont des modèles partagés par toutes les
  feuilles : `S.prefs.avisMsg` ne garde que ce que l'utilisateur a RÉÉCRIT (↺ revient au texte
  proposé) — remplacé, jamais modifié en place. Repères remplacés à l'assemblage
  (`_avisMessage`, pur) : `{classe} {periode} {mois} {lien} {eleves} {echeance}`.
  **En texte riche** (v1.40.11, demande de l'utilisateur : *« copier-coller en gardant toute
  la mise en forme »*) : `_avisMsgParties` (pur) assemble une seule fois les parties en
  morceaux (texte · lien · liste d'élèves) ; `_avisMessage` en tire le texte brut,
  `_avisMessageRiche` le HTML — paragraphes, `**gras**` (même convention que la feuille ;
  les textes proposés mettent en gras « sans compte à créer », « rien à signaler », le nom
  des colonnes, « surlignés en jaune », l'échéance), lignes « – » en puces, élèves en liste,
  lien cliquable **seulement en https** (`_avisLienSur`), tout échappé, styles EN LIGNE (un
  client de messagerie jette les feuilles de style). ⚠️ Les repères simples sont remplacés
  DANS le texte avant le découpage : « **avant le {echeance}** » reste en gras d'un bout à
  l'autre. La modale montre l'aperçu riche (`#mavis-msg`, ce qui sera collé) ; **📋 Copier
  le message mis en forme** écrit `text/html` ET `text/plain` (`ClipboardItem`), repli par
  sélection de l'aperçu + `execCommand('copy')` ; **Copier en texte brut** à côté. Vérifié :
  les deux formats arrivent dans le presse-papiers du système (Chromium).
  **L'objet du courriel** (v1.40.12, demande de l'utilisateur) : `AVIS_MSG_OBJET` (« Votre
  avis sur les élèves de la {classe} pour {objectif} »), réécrit = gardé dans
  `S.prefs.avisMsg.objet` (même mécanique que les parties, ↺ pour revenir), rendu par
  `_avisObjetMail` (pur : une ligne, sans gras, sans {lien} ni {eleves}) et copié par son
  propre bouton 📋 — il n'entre pas dans le message.
  **Formule de politesse et signature** (v1.40.13, demande de l'utilisateur) : la partie
  `fin` devient « Merci d'avance pour votre aide. / Bien cordialement, », suivie d'une partie
  `signature` (`{nom}` · « Professeur principal de la {classe} » · `{etablissement}`) ; une
  ligne dont les repères sont vides disparaît. `S.prefs.avisNom` (champ « Votre nom » de la
  modale) et `S.prefs.etablissement` (déjà celui du PV des élections), par `avisSignatureUI`.
  **Signature HTML de la messagerie** : collée dans la modale (`S.prefs.avisSignatureHtml`),
  elle REMPLACE la partie signature — dans le riche telle quelle, dans le brut par
  `_htmlTexte` (une ligne par bloc, entités décodées). ⚠️ Elle finit dans `innerHTML` et
  dans un courriel : **filtrée par `_htmlSur`** (pur, sans DOMParser) à l'enregistrement ET
  au rendu — liste blanche de balises et d'attributs, contenu des script / style / svg
  retiré, style refusé s'il contient `url(`, `expression`, `javascript:`, `@import`, une
  entité numérique ou une barre oblique inverse, liens https / mailto seulement, AUCUNE image
  (traceur, et la CSP la bloquerait), balises **équilibrées** (une table restée ouverte
  avalerait la modale). ⚠️ La signature réelle de l'utilisateur ne va ni dans le code ni dans
  les tests (dépôt public) : elle vit dans ses données ; les tests en utilisent une inventée.
  ⚠️ L'aperçu du message est sur une surface **courriel blanche dans les deux thèmes**
  (`--mail-bg/-fg/-link/-rule`, mêmes valeurs aux trois endroits) : une signature collée
  porte ses propres encres sombres, illisibles sur le bleu nuit.
- **Disciplines** (`S.disciplines`, `_disciplinesSeed`, comme les instances : d'office =
  décochables, pas supprimables) : la liste de l'utilisateur — **allemand** (ajouté en
  v1.39.2, oubli de la liste d'origine ; ALLEMAND et ALLEMAND BILINGUE s'y rangent, la LCE
  « LANGU.CULT EU ALLEM » non — l'app demande ; un « Allemand » déjà créé à la main est
  gardé, sans doublon), anglais, arts plastiques,
  éducation musicale, EPS, enseignement des religions, français, histoire-géographie,
  mathématiques, physique-chimie, SVT, technologie. Réglables dans 💾 Données (nom, nom
  d'onglet ≤ 31 caractères sans `[]*?:/\`, actif), complétables (Allemand, Latin…).
- **Domaines et couleurs d'onglets** (v1.39.3, demande de l'utilisateur : *« une couleur par
  domaine disciplinaire, des nuances pour chaque discipline »*) : `DOMAINES` (langues bleu ·
  lettres et humanités brique · sciences vert · arts violet · EPS orange · autre gris),
  `S.disciplines[did].domaine` (d'office par `DISCIPLINES_DOMAINE`, réglable dans 💾 Données ;
  une discipline ajoutée va dans « autre »), `_discCouleur` : la teinte du domaine éclaircie
  vers le blanc selon le rang dans le domaine (la première a la teinte franche). Le catalogue
  et les onglets sont **rangés par domaine** (`_disciplinesAll`, `_avisDidsOrdonnes`) : les
  nuances se suivent. Dans l'.ods, la couleur s'écrit deux fois — `tableooo:tab-color` dans le
  style de la table et `TabColor` dans `settings.xml`, comme LibreOffice — ; vérifiée dans un
  LibreOffice affiché (Xvfb, `SAL_USE_VCLPLUGIN=gen` : ⚠️ sans `env -u WAYLAND_DISPLAY`,
  LibreOffice s'ouvre sur l'écran de l'utilisateur et non dans Xvfb).
- **Matières des moyennes → disciplines** (*« tu les identifies en commun avec le relevé des
  moyennes ; si tu as un doute, le logiciel peut me demander »*) : `_matiereDisc(mid)` —
  `m.disc` posé à la main (un id, ou `''` = ignorée), sinon reconnaissance par les motifs de
  `DISCIPLINES_DEFAUT` sur le nom normalisé, relevés sur les VRAIS exports (« ÉD.PHYSIQUE &
  SPORT. », « SCIENCES VIE & TERRE », « SVT BILINGUE », « ANGLAIS LV2 », « HISTOIRE-GEOGRAPHIE
  EMC »…), sinon une discipline ajoutée de même nom. ⚠️ L'EPS se teste AVANT la
  physique-chimie, dont le motif exige CHIMIE — « ÉD. PHYSIQUE » contient PHYSIQUE. ⚠️ **Rien
  n'est deviné** (allemand, LCE, espagnol…) : la modale **pose la question** (« à rattacher »,
  nouvelle discipline, ignorer), et 💾 Données corrige tout. Le **professeur** de l'onglet
  vient du DERNIER import de moyennes de ses matières (`_discProfsAuto` — LV1 et LV2
  réunies, co-enseignants tous, sans doublon) ; ⚠️ **un nom TAPÉ passe avant**
  (`S.disciplines[did].profs`, v1.39.1 — *« comment je saisis le nom des professeurs si tu
  n'as pas réussi à les récupérer ? »*) : un champ par discipline dans la modale et dans
  💾 Données ; vidé, ou égal à celui des moyennes, il redevient automatique.
- **Campagne** (`S.avis[classId][campId]`) : `{ id, date, cible, label, fichier, lien, lu,
  disciplines: [{ id, nom, onglet, profs }] (les onglets de LA feuille, figés), avis: { sid:
  { did: { travail, participation, comportement } } }, cibles: [sid], msg }`. ⚠️ **`cible` = la fin de la
  période visée**, choisie à la création : la période se déduit de la date comme partout,
  et le conseil du S1, préparé en février, reste « pour le S1 ». Les élèves de la feuille :
  **présents pendant la période**, par **ordre alphabétique** (c'est par le nom qu'un
  collègue cherche).
- ⚠️ **RIEN n'est repris d'office** (v1.39.1, demande de l'utilisateur : *« montrer
  avant-après et laisser cocher, pour ne pas écraser à cause de modifications
  accidentelles »*). `_avisChangements` liste chaque case qui diffère (élève × discipline ×
  critère : `ajout` · `modif` · `suppr`), la **revue** (`_avisRevueHTML`) montre « dans
  l'app » / « dans la feuille », l'utilisateur coche, `_avisAvecChoix` applique les seuls
  choisis. Cochés d'office (`_avisCochesDefaut`) : ajouts et modifications, **jamais un
  effacement** (c'est l'accident qui coûte). Trois moments : **relire** (ce qui n'est pas
  coché reste dans la feuille et sera reproposé), **mettre à jour** la feuille (ce qui
  n'est pas coché y est remplacé par la version de l'app — l'écran le dit), et **nouvelle
  feuille dans un fichier qui contient déjà des avis** (une feuille du S1 réutilisée pour le
  S2) : **rien n'est coché**, ce qui n'est pas repris est effacé du fichier.
- **Lecture** (`_avisLire`, pur) : l'onglet par son nom (ou, renommé, par le nom de la
  discipline en titre), les colonnes par leur **en-tête** (un collègue peut en déplacer une),
  l'élève par la clé de nom des moyennes. ⚠️ **Rien n'est rangé au hasard** : homonymes
  parfaits, nom retouché, onglet inconnu sont **rapportés** dans la modale. **Fusion**
  (`_avisFusion`) : un onglet lu fait foi (un avis effacé par son auteur disparaît), un onglet
  ABSENT du fichier garde ses avis — une mauvaise feuille choisie n'efface rien. Un cran
  d'undo seulement si quelque chose change. Relecture silencieuse à l'ouverture de la modale
  si la permission est restée accordée — elle n'ouvre que la revue, elle ne range rien.
- **Écriture** (`_avisEcrireFeuille` → `_avisEcrireMaintenant`) : relit d'abord le fichier ;
  s'il diffère de l'app, la revue passe avant (cf. ci-dessus) ; un fichier qui contient
  AUTRE chose qu'une feuille d'avis n'est écrasé qu'après confirmation. ⚠️ La modale prévient : mettre
  à jour pendant qu'un collègue écrit peut créer un conflit dans le Nuage.
- **Module .ods** (`_zipStore`, `_zipRead`, `_odsBuild`, `_odsRead` — écrit par un agent,
  relu) : ZIP « stored » à l'écriture (le `mimetype` premier, sans champ extra : règle ODF),
  deflate à la lecture par `DecompressionStream('deflate-raw')` (ajouté au bac à sable du
  harnais), parseur XML maison (pas de DOMParser dans le harnais). ⚠️ Collabora et
  LibreOffice écrivent des **répétitions énormes** de cases vides (1 048 576 lignes) : on ne
  développe que ce qui a du contenu, et on borne. ⚠️ Sans `xmlns:ooo` sur `settings.xml`,
  LibreOffice ignore le gel des volets en silence. Le **quadrillage de l'écran est masqué**
  (`ShowGrid` à `false`, vue ET onglet — v1.40.2, arbitré par l'utilisateur : *« je ne veux
  pas afficher les lignes de la grille »*) : ce sont les bordures des cellules qui dessinent
  le tableau. (La v1.40.1 l'avait affiché par erreur d'interprétation.) La ligne des consignes est
  **encadrée** (style `consigne`) : sans bordure, elle flottait entre le mode d'emploi et les
  en-têtes. Le mode d'emploi de chaque onglet rappelle **Ctrl+Entrée** pour un nouveau
  paragraphe dans la même case (v1.40.3, demande de l'utilisateur) — Entrée seule change de
  case dans Collabora comme dans LibreOffice. **En gras** (v1.40.4) : « rien à signaler »,
  « Nouveau paragraphe dans la même case : Ctrl+Entrée », « SURLIGNÉS EN JAUNE » — option de
  cellule `gras` (passages entre `**…**` → span `T1`), réservée aux textes écrits par l'app.
  **Onglets verrouillés** (v1.40.4, demande de l'utilisateur) : `table:protected="true"`, et
  seul le style `saisie` porte `style:cell-protect="none"` — noms, titres, consignes et mode
  d'emploi ne se modifient plus par mégarde. Sans mot de passe : une protection contre les
  fausses manœuvres (Feuille > Protéger la feuille la lève). Conservé par un réenregistrement
  LibreOffice (vérifié) ; ⚠️ comportement dans Collabora Online à voir une fois en vrai. **Colonne
  des noms à la largeur du plus long** (`_avisLargeurNoms`, v1.40.5 — des noms dépassaient de
  la colonne fixe de 4,6 cm) : estimée caractère par caractère en gras 10 pt, entre 4,6 et
  12 cm — un tableur ne recalcule pas une largeur « optimale » à l'ouverture.
  **Andika INCLUSE dans le fichier** (v1.40.7, demande de l'utilisateur) : `_ODS_ANDIKA` —
  les quatre variantes en **TrueType** (pas woff2 : c'est ce que LibreOffice et Collabora
  lisent dans un .ods), sous-ensemble latin, déjà compressées en deflate avec CRC et taille
  (`scripts/gen_fonts.py --ods` ; `_zipStore` les pose telles quelles en méthode 8), ≈ 90 Ko.
  Dans l'archive : `Fonts/*.ttf`, déclarées dans le manifeste, `office:font-face-decls`
  (content et styles, `loext:font-style` / `font-weight` par fichier), style `Default` en
  Andika, et `EmbedFonts` dans `settings.xml` — ⚠️ sans lui, le premier enregistrement par
  Collabora (un collègue qui écrit) jetterait la police. Vérifié dans un LibreOffice
  **sans Andika installée** (fontconfig restreint à DejaVu et Liberation) : la feuille
  s'affiche en Andika. ⚠️ **Métriques verticales resserrées** dans les TTF inclus (ligne de
  1,61 em → 1,24 em, `hhea`/`OS/2`) : à l'ouverture, la hauteur optimale des lignes est
  calculée AVANT d'activer la police incluse, avec une police de repli ; avec les métriques
  d'origine, les noms sortaient rognés. Retirer le `row-height` fixe ne suffisait pas.
  ⚠️ `--ods` : la sortie woff2 varie d'une version de fontTools à l'autre, ne pas régénérer
  les blocs CSS sans raison. **Hauteurs de lignes** (v1.40.9, arbitré par l'utilisateur :
  *« des hauteurs fixes avec la police Andika pour les quatre premières lignes, et le calcul
  automatique pour les suivantes »*) : titre, mode d'emploi, consignes et en-têtes portent
  une hauteur FIXE (`sh.rowHeightsCm` → styles `rohN`, `use-optimal-row-height="false"`),
  calculée par `_odsLignes` / `_odsHauteurCm` sur les **chasses réelles** d'Andika
  (`_ODS_ANDIKA_LARGEURS`, exportées par `gen_fonts.py --ods`, gras et italique compris, les
  `**…**` mesurés en gras) ; les lignes d'élèves restent automatiques (`ro1`) et grandissent
  quand un collègue écrit. La largeur de la colonne des noms se mesure de même. ⚠️ La police
  incluse s'appelle **« Andika SuiviPP »** (nom réécrit dans la table `name` des TTF) : sur un
  poste où Andika est installée, le tableur préférait la police du système, aux métriques
  d'origine (1,61 em), et les hauteurs fixées ne collaient plus. Vu dans LibreOffice, avec et
  sans Andika installée. ⚠️ **LibreOffice signale « Andika SuiviPP » comme manquante** dans la
  case du nom de police (« La police active n'est pas disponible et va être substituée ») —
  remonté par l'utilisateur le 2026-10-04. **Faux signal, à ne pas « corriger » en renommant** :
  la case ne connaît que les polices INSTALLÉES ; le texte est bien dessiné avec la police
  incluse (vu sous LibreOffice 26.2, export PDF : les quatre variantes `AndikaSuiviPP` incluses),
  et la contre-épreuve — la police incluse renommée « Andika », Andika désinstallée — donne le
  même avertissement. **Arbitré : on garde « Andika SuiviPP ».** Dans le Nuage (Collabora), la
  feuille s'affiche bien (vu par l'utilisateur). Reste une limite : une ligne d'élève qui CONTIENT déjà un long texte
  à l'ouverture peut être mal dimensionnée (calcul fait avant la police) ; non vérifié
  dans Collabora Online. Non vérifié dans Collabora Online même. Validé par LibreOffice (réenregistrement,
  export CSV, gel vérifié sous python-uno) ; une feuille réenregistrée par LibreOffice est
  gardée en fixture (`test/fixtures/avis-libreoffice.ods`, noms inventés). ⚠️ **Non vérifié
  dans Collabora Online** même : à regarder une fois dans le Nuage.
- **Créer la feuille depuis l'app** (v1.55.0, l'utilisateur : *« tu ne pourrais pas aussi créer
  la feuille et la préparer ? et proposer un nom logique que l'on peut modifier »*) : *📄 Créer la
  feuille et la préparer…* (`avisPreparerUI(false, true)`, `_avisCreerHandle` →
  `showSaveFilePicker`, le nom déjà écrit) — on l'enregistre dans un dossier que Nextcloud
  synchronise, puis on la partage dans le Nuage par lien public en modification (le lien se colle
  ensuite dans la feuille). *📂 Choisir une feuille existante…* reste pour une feuille vide créée
  dans le Nuage. **Le nom** : champ `mavis-nom`, proposé par `_avisNomFichier` (pur :
  « Avis des collègues — 5e C — conseil S1 — 2025-26.ods », « mi-S1 », « point de mars »), qui
  suit période, objectif et mois (`_avisNomMaj`) tant qu'on ne l'a pas réécrit (`_avisNomDraft`,
  de séance ; vidé, il redevient proposé) ; `_avisNomPropre` retire ce que les systèmes de
  fichiers refusent et assure le `.ods`. Le téléchargement (Firefox) prend le même nom. Sans
  `showSaveFilePicker`, pas de bouton Créer : Choisir redevient le bouton principal. Vérifié dans
  le navigateur avec un fichier OPFS à la place de la boîte (écrit, relu : les onglets) ;
  ⚠️ la vraie boîte et l'arrivée dans le Nuage, à essayer à la main.
  **Le lien de partage vient APRÈS** (v1.55.1, l'utilisateur : *« je ne peux pas connaître le lien
  de partage avant que la feuille ne soit créée »*) : le champ a quitté le formulaire de création.
  Tant que la feuille n'a pas de lien, son panneau commence par l'encadré **🔗 Étape suivante :
  partager la feuille** (`_avisPartageHTML` : le dossier où elle arrive, ＋ *Lien de partage*
  réglé pour que ceux qui ont le lien puissent modifier, puis le champ `mavis-lien-etape` →
  `avisLienUI`) ; amené à l'écran après la création. Collé (https seulement), l'encadré disparaît
  et le lien se corrige dans *✉️ Le message aux collègues*.
  ⚠️ **Le formulaire de création se redessine en cours de saisie** (⭐ un élève, une colonne, une
  matière rattachée) : période, objectif, mois et disciplines ne vivent que dans ses champs, et
  repartaient à leur défaut (v1.55.2, remontée de l'utilisateur : *« je sélectionne point du mois,
  je coche les élèves, et l'objectif repasse en conseil de classe »*). `_avisRender` les lit
  (`_avisNouvelleEtat`) avant de redessiner et les repose après (`_avisNouvelleRemettre`). Tout
  nouveau champ de ce formulaire sans brouillon à lui s'ajoute là.
- **Sans File System Access** (Firefox) : télécharger la feuille, la déposer dans le Nuage,
  et relire par « Lire la feuille… » (choix de fichier).
- **Où on l'ouvre** : ~~👥 Élèves → *🗣 Avis des collègues…*~~ — **depuis la v1.45.0, un
  ONGLET à lui**, après Vie de classe (l'utilisateur : *« pour récolter et gérer la récolte
  des avis, un onglet serait utile ; on y verrait les différentes fois où on a récolté les
  avis »*). La fenêtre `mavis` a disparu : son contenu vit dans l'onglet (`renderAvisTab`,
  les ids `mavis-*` des champs inchangés, `_avisOnglet()` remplace « la modale est
  ouverte »). À gauche, les **récoltes** (`_avisListeHTML` : objectif · période, date,
  fichier, un trait par discipline qui a répondu, n avis, ⭐, les colonnes) et *＋ Nouvelle
  feuille d'avis* ; à droite, la feuille choisie (tout ce que faisait la modale) puis la
  grille **« Qui a écrit sur qui »** (`_avisGrilleHTML` : élèves × disciplines, case pleine /
  pâle selon les colonnes remplies, l'avis en infobulle, totaux en bout de ligne et en pied).
  `openAvis(campId)` bascule sur l'onglet. Le bouton de 💾 Données y mène toujours.
  **Lire les avis** (v1.54.0, l'utilisateur : *« si je clique sur la discipline, que je voie les
  avis qu'elle a laissés pour chaque élève ; dans Qui a écrit sur qui, un chiffre : les avis de
  cette discipline pour cette personne ; la dernière colonne : tous les avis sur cet élève »*) :
  fenêtre `mavislire`, `openAvisLire(vue)` — `{ did }` (un élève par ligne, les élèves sans avis
  nommés dessous), `{ sid }` (une discipline par ligne avec son professeur, les disciplines sans
  réponse nommées, lien vers la fiche), `{ did, sid }` (une colonne par ligne). Rendu par
  `_avisLectureHTML` (pur : `{ titre, html, prev, next }`) ; ◀ ▶ (`avisLireNav`) passe à la
  discipline voisine, à l'élève suivant qui a un avis, ou descend la colonne de la discipline ; les
  noms dans la fenêtre basculent d'une vue à l'autre. Cliquables (`role="button"`, Entrée) :
  l'en-tête et le pied d'une discipline, chaque case remplie, le total d'une ligne, et le nom d'une
  discipline qui a répondu dans le tableau de la feuille. Lecture seule ; paragraphes gardés
  (`.pf-mx`). ⚠️ `_avisLire` est déjà la LECTURE du fichier .ods : l'état de la fenêtre s'appelle
  `_avisLireVue`.
- **Où on les lit** : la **fenêtre de bilan** (les avis de la période sous les yeux pendant
  qu'on rédige — `_bilanHint`, qui suit aussi la date), la **fiche** (section 🗣, lecture
  seule : la source est la feuille), la **synthèse de période** (bloc *Avis des collègues*,
  **décoché par défaut** : du texte long, tableau ou fiches). Le **message aux collègues**
  (avec le lien de partage, `https` seulement) se copie depuis la modale.
- Purge : `camp.avis[sid]` dans `_purgeStudentRefs`, `S.avis[classId]` dans
  `_purgeClassRefs` ; liste blanche de `_validateImport` (deux niveaux) ; état maximal du
  balayage. RGPD : le bandeau dit que la feuille (noms compris) vit dans le Nuage, ouverte à
  qui a le lien. Démo : une feuille du S1 relue (13 avis, 7 disciplines), et « ESPAGNOL LV2 »
  laissée sans discipline pour que la question se voie.

## 📷 Photos des élèves (v1.48.0)

Demandé le 2026-10-03, par la session Plan de classe puis validé par l'utilisateur (*« vas-y,
fais tout ce que tu as prévu »*). **Code COPIÉ de Plan de classe** (v2.64.0 → v2.64.2, commit
`ace7234`, section *📷 Photos des élèves* de son CLAUDE.md) : lecteur PDF minimal (`_pdfOpen`,
`_PdfLexer`, `_pdfStreamBytes`, `_pdfFont`, `_pdfScanPage`), lecture du trombinoscope
(`_trombiParsePdf`, `_trombiParseHeader`, `_trombiDedupNames`), appariement (`_trombiSplitName`,
`_trombiScore`, `_trombiMatch` — rien n'est deviné à égalité —, `_trombiResolveClass`).
Les pièges de format MBN et de l'appariement sont documentés là-bas ; à relire avant d'y toucher.

- **Stockage : `<dossier des pièces jointes>/photos/<sid>.jpg`** (`PHOTOS_SUBDIR`, `pjDirHandle`)
  — ⚠️ **le dossier des PDF, PAS celui de la sync** (arbitré par l'utilisateur : la sync fait
  tourner ses JSON, on n'y mêle pas de documents ; Plan de classe, lui, prend son dossier de
  sauvegarde). Ni dans `S`, ni dans `localStorage`. Cache `_photos` (sids lus au démarrage par
  `_photosRefresh(false)` après `tryRestorePjDir`, URL `blob:` à la demande) ; la fiche, ouverte
  d'un clic, demande une fois l'autorisation de lire si des photos sont connues
  (`suiviPP_photosKnown`).
- **Import** (`openTrombiImport`, modale `mtrombi`) : *📥 Importer des photos* dans la barre de
  👥 Élèves et dans 💾 Données ▸ Imports. Classe lue dans l'en-tête, modifiable ; une carte par
  photo (nom lu, élève proposé, « ignorer », « 🔁 remplace ») ; élèves présents sans photo
  nommés. Pas de professeur principal repris (Suivi PP n'a pas ce champ).
- **Une photo à la fois depuis la fiche** : case dans la carte *Identité et repères*
  (`#fiche-photo`, `_fichePhotoFill`, appelée en fin de `_ficheRender`) — sans photo, « 📷 Ajouter
  une photo · ou Ctrl+V » et *📋 Coller* ; avec, *📷 Changer*, *📋 Coller*, *🗑 Retirer* (boutons
  nommés, règle du second audit). Fichier, **image glissée**, **Ctrl+V** (écouteur `paste`, fiche
  ouverte sans autre fenêtre par-dessus, hors champ de texte) ou `navigator.clipboard.read`.
  `_photoFileToJpeg` : JPEG d'au plus 400 px, fond blanc. Retrait confirmé (« Ctrl+Z ne le
  ramène pas »). Vignette 44 px dans l'en-tête de la fiche (`#mfiche-ph`), visible dans les
  trois vues.
- **Survol d'un nom** : tout nom qui ouvre la fiche porte `data-photo-sid` (`_nomFicheHTML`,
  liste, carte de chaleur) → `#photo-pop` après 250 ms. ⚠️ Toute nouvelle grille passe déjà par
  `_nomFicheHTML` : elle a la photo au survol sans rien faire.
- **Le trombinoscope** (v1.51.0, l'utilisateur : *« prévois un endroit pour afficher le
  trombinoscope et pouvoir l'imprimer »*) : **troisième affichage** de 👥 Élèves, *📷 Trombinoscope*
  (`_ELEVES_AFFS`, retenu sur le poste comme les deux autres) — les élèves de la liste (tri,
  recherche, filtres), une carte chacun (`_trombiCarteHTML` : photo posée après coup par
  `_trombiPhotosPoser`, initiales en pointillés sans photo, nom surligné du délégué, groupe et
  options), clic → la fiche. Bandeau (`_trombiVueBandeauHTML`) quand il n'y a pas de dossier, pas
  d'autorisation (le bouton la demande) ou pas de photo. **Sur le papier** : troisième choix de
  *🖨 Imprimer…* (`quoi: 'trombi'`, présélectionné depuis cette vue) — 4, 5 ou 6 photos par
  rangée, groupe et options en option, A4 / A3 portrait (`_trombiPrintHTML`, `printTrombi`) ; 25
  élèves à 5 par rangée tiennent sur une page A4.
- **Carte de chaleur** (v1.51.1, l'utilisateur : *« ajoute les photos dans la carte de chaleur
  aussi »*) : une vignette de 26 px devant chaque nom (`.ch-ph`, posée par `_trombiPhotosPoser`),
  dans un lien vers la fiche qui porte `data-photo-sid` (survol = la photo en grand) ; une case
  pointillée vide pour un élève sans photo ; **rien du tout** tant qu'aucun élève de la classe
  n'en a. Passer à la carte de chaleur demande, comme au trombinoscope, l'accès au dossier.
- **Indicateurs** (v1.51.2, *« ajoute aussi les photos dans la vue Indicateurs »*) : la même
  vignette (`_vignetteHTML(sid, avecPh)`, partagée avec la carte de chaleur) ; la ligne passe de
  43 à 46 px. Les trois affichages de la liste ont donc les photos ; ouvrir l'un d'eux demande
  l'accès au dossier quand il n'est pas encore accordé.
- **Grilles des observations et des moyennes** (v1.51.3, *« ajoute aussi les photos dans la
  grille des observations et des moyennes »*) : la même vignette devant chaque nom (ligne + 3 px) ;
  `_trombiPhotosPoser` après chaque rendu (une saisie au carnet re-rend la grille — vérifié :
  Entrée passe toujours à l'élève suivant). Un clic sur l'onglet Élèves, Observations ou Moyennes
  demande l'accès au dossier des photos s'il manque (`showTab`), et `_photosChanged` redessine
  l'onglet ouvert.
- ⚠️ **Supprimer un élève ne supprime PAS sa photo** (écart assumé avec Plan de classe) : Ctrl+Z
  rend l'élève, jamais un fichier — même règle que les PDF. *🧹 Orphelins…* (Données) liste aussi
  les `photos/<sid>.jpg` dont l'élève n'existe plus (`_photosOrphelines`) et les supprime sur
  confirmation.
- RGPD : le bandeau cite les photos et leur dossier. La démo n'en porte pas (ce sont des fichiers).
- Tests : `test/photos.test.js` sur `test/fixtures/trombi/fake-trombi.pdf` (copie de la fixture
  de Plan de classe : noms inventés, carrés de couleur ; ⚠️ dépôt public, jamais un vrai
  trombinoscope), dossier simulé en mémoire. Vérifié dans le navigateur avec l'OPFS : import de
  la fixture (6 photos écrites), collage d'un PNG 600 × 300 → JPEG 400 × 200, retrait, survol.
  ⚠️ `navigator.clipboard.read` (bouton 📋) et un vrai dossier Nextcloud : à essayer à la main.

## Incidents et instances

Ce qui se passe quand ça se passe mal, et ce qui en découle : une fiche incident, une
retenue, une commission éducative, un conseil de discipline. Demandé le 2026-09-11 :
*« des fiches incident à saisir, peut-être accompagnées d'un PDF de la fiche scannée, et
les commissions éducatives ou autres instances ; on propose toutes les instances
officielles, l'utilisateur les règle ou les décoche, et il note la décision prise. »*

- **Le catalogue est pré-rempli et réglable** (`INSTANCES_DEFAUT`, semé par `_instancesSeed`
  dans `postLoadHook`), **avec les noms réels et rangé par famille** (révisé le 2026-09-11 à
  la demande de l'utilisateur — *« des noms plus logiques, qui correspondent à ce que l'on fait
  réellement »* — après lecture d'éduscol *Les procédures disciplinaires*, de la circulaire
  n° 2014-059 et de R511-13 / R511-19-1) :
  - **Signalement** — rapport d'incident (la « fiche incident » de l'établissement) ;
  - **Punitions scolaires** (circulaire 2014-059, liste indicative, jamais au dossier) — excuse
    orale ou écrite · devoir supplémentaire · retenue · exclusion ponctuelle de cours · autre
    punition ;
  - **Sanctions disciplinaires** (R511-13, échelle EXHAUSTIVE : six, aucun règlement intérieur
    ne peut en ajouter) — avertissement · blâme · mesure de responsabilisation · exclusion
    temporaire de la classe · exclusion temporaire de l'établissement · exclusion définitive ;
  - **Mesures de prévention et d'accompagnement** — fiche de suivi · engagement écrit (contrat) ·
    tutorat ;
  - **Instances et réunions** — commission éducative · conseil de discipline · équipe éducative ·
    équipe de suivi de la scolarisation (ESS) · cellule de veille / GPDS ;
  - **Protection de l'enfance** — information préoccupante ; **Autre**.
  Chaque instance porte sa famille (`cat`, `INSTANCES_FAMILLES`) : le sélecteur de la modale
  les groupe en `<optgroup>`, le tableau de Données en lignes d'en-tête. Renommer, décrire,
  décocher, ajouter — dans 💾 Données et réglages (une instance ajoutée va dans *Autre*).
  ⚠️ **Migration des libellés** : un libellé resté à son ancienne valeur par défaut suit le
  nouveau (« Fiche incident » → « Rapport d'incident », « Exclusion temporaire » → « … de
  l'établissement », « Punition scolaire » → « Autre punition »), un libellé modifié par
  l'utilisateur est respecté — le cinquième champ de `INSTANCES_DEFAUT` porte l'ancien défaut.
  Et l'ordre des instances d'office suit TOUJOURS le tableau (une insertion au milieu s'y
  place). Testé dans les deux sens.
  ⚠️ **Le semis complète sans écraser** : un réglage de l'utilisateur survit, une instance
  ajoutée par une version ultérieure apparaît d'elle-même, un fichier antérieur à la section
  arrive avec le catalogue complet. Testé dans les trois sens.
  ⚠️ **Une instance d'office se DÉCOCHE, ne se supprime pas** ; une instance ajoutée se
  supprime si rien ne l'utilise. Une entrée dont l'instance a disparu garde un libellé
  (`_instanceOf`) : on ne perd jamais la lecture d'un incident pour une question de catalogue.
  ⚠️ Les descriptions sont des **repères**, pas le texte réglementaire — elles s'éditent, et
  le règlement intérieur prime. Ne rien imprimer qui les cite comme droit.
- **Les entrées vivent sur l'élève** (`stu.incidents`) : date · instance · objet (obligatoire —
  « commission éducative » sans dire pourquoi ne sert à rien au conseil) · texte libre (la
  décision prise, les points dits) · PDF facultatif. Saisie dans la modale `mincident`,
  ouverte depuis la **fiche** (section ⚖️, boutons ✏️ 🗑 et « + Noter »), qui y revient
  (`ficheVersIncident` + `_modalReturnTo`) — **et depuis la liste des élèves** (v1.24.0,
  demande de l'utilisateur : *« comme pour les remarques, je dois pouvoir cliquer sur la
  case incident pour en saisir un »*) : la case Incidents est un bouton ⚖️ (le nombre
  d'entrées dessus, coloré s'il y en a — 7,38:1 mesuré), qui ouvre la saisie d'une
  NOUVELLE entrée ; la dernière entrée s'affiche dessous et s'ouvre en modification au clic
  (`_syntheseRow` porte désormais `incident.id`). Même geste que le bouton 📋 de la
  remarque, à côté. `saveIncident` re-rend la liste. `pushUndo()` avant chaque mutation.
- **Le PDF ne va JAMAIS dans la sauvegarde JSON** : un scan pèse 200 Ko à 2 Mo, localStorage
  plafonne à quelques Mo (le projet voisin a touché ce plafond). Il est **copié** dans un
  dossier **choisi par l'utilisateur** (`pjDirHandle`, persisté en IndexedDB sous `pjdir`,
  distinct du dossier de sync), et l'entrée n'en garde que `{ nom, fichier, taille }`.
  L'utilisateur place ce dossier sous Nextcloud, qui transporte les fichiers ; sur l'autre
  poste, il choisit le même dossier une fois. Nom de fichier par `_pjSafeName` : sans
  chemin, sans accents ni caractères interdits, **préfixé de l'id de l'entrée** (deux
  « fiche incident.pdf » ne se heurtent pas).
  - ⚠️ **Séparé du dossier de sync** : celui-ci porte des JSON à rotation (backups,
    conflits), et mêler des scans à cette mécanique ferait courir le nettoyage sur des
    documents officiels.
  - ⚠️ **L'app n'efface JAMAIS un PDF d'elle-même.** Retirer la pièce ou supprimer l'entrée
    laisse le fichier ; « 🧹 Orphelins… » (Données) liste puis supprime, sur confirmation,
    ce que plus aucune entrée ne référence. Un scan de document officiel ne se détruit pas
    sur un clic malheureux — et Ctrl+Z ne rend pas un fichier.
  - **Le nom du fichier se choisit AVANT la copie** (v1.20.0, demande de l'utilisateur) : modale `mpjnom` → garder le nom d'origine, **nom automatique** (`_pjAutoNom` : **type · qui · date en AAAA-MM-JJ**, ex. `Commission éducative — GUÉRIN Nathan — 2026-02-05.pdf`, proposé par défaut — l'ordre est arbitré par l'utilisateur : on cherche par le type et la personne, la date trie le reste), ou un nom tapé. `_pjSafeName` ne retire que ce que les systèmes de fichiers refusent (`\ / : * ? " < > |`) — **accents et espaces restent**, c'est un dossier que l'utilisateur ouvre lui-même. Plus de préfixe d'id : l'unicité se règle dans le dossier (`_pjUnique` → « (2) », « (3) »). Renoncer dans la modale laisse le formulaire tel quel.
  - ⚠️ La copie vient APRÈS l'entrée, et son échec ne la retire pas : mieux vaut un incident
    noté sans son scan qu'un scan sans incident — on rejoint par ✏️.
  - La permission d'un handle restauré est « à confirmer » jusqu'à un geste de
    l'utilisateur : `_pjReady(mode)` la redemande depuis le clic, jamais au chargement. Un
    handle sans `queryPermission` (OPFS, tests) passe pour accordé — c'est ce qui a permis de
    vérifier copie, lecture et orphelins dans le navigateur de test sans dialogue natif.
- **Lecture dans l'app** (`pjOpen`) : modale `mpdf` avec un `<iframe>` sur une URL de blob —
  le lecteur du navigateur fait le reste ; « ↗ Onglet » pour imprimer ou agrandir. ⚠️ Un
  nouvel onglet seul dépendait de l'anti-popup et, dans une application installée, sortait
  de la fenêtre. Pour cela la CSP passe de `frame-src 'none'` à **`frame-src blob:`** : une
  URL de blob est liée à son origine, rien d'extérieur ne peut y être encadré. L'URL est
  révoquée à la fermeture (`_modalReturnTo['mpdf']`).
- **Synthèse** : colonne Incidents (nombre + dernier), tri « par incidents », à l'impression
  aussi. **RGPD** : le bandeau cite désormais les incidents et sanctions — donnée sensible —
  et dit où vont les PDF.
- **Purge** : les entrées partent avec l'élève ; le catalogue ne connaît aucun sid. L'état
  maximal du test de balayage porte un incident avec PDF et une instance, pour que le
  balayage le constate plutôt que le supposer.

## Écrans

**7 onglets depuis la v1.45.0** : 🗣 **Avis des collègues** s'ajoute après Vie de classe (cf.
*Avis des collègues*, « Où on l'ouvre »).

⚠️ **Pas de grand titre d'onglet** (v1.44.1, l'utilisateur : *« ça prend trop de place »*) :
le `.sh` de chaque onglet est retiré de l'écran (gardé pour les lecteurs d'écran) — l'onglet
actif dit où l'on est. **Seule la grille défile** dans Élèves, Observations et Moyennes
(`.tab.fige`, même version — *« quand on fait coulisser la liste, que l'en-tête ne bouge
pas »*) : `#main` prend exactement la hauteur sous le bandeau, en colonne flex ; barres
d'outils et légendes gardent leur taille, le cadre figé prend le reste et défile seul — et
**dans la grille des bulletins** d'une élection depuis la v1.45.3 (`.rel-wrap.frozen.bul-wrap`,
un peu moins haute que l'écran ; la ligne des candidats partait au défilement — le reste de
🏫 Vie de classe est une page qui défile normalement, bandeau en place), **dans 📄 Retours** depuis la v1.45.2 (remontée de l'utilisateur : le tableau d'un document et
le ramassage avaient encore l'en-tête qui partait), même classe `.fige` (avant,
il valait la hauteur de l'écran moins le bandeau, et les barres d'outils faisaient défiler la
page d'autant). Écran ≥ 700 × 480 seulement, jamais sur le papier. ⚠️ Le bloc CSS est APRÈS
la règle `.rel-wrap.frozen` de base (il lève son `max-height`).

Navigation à un seul niveau, **6 onglets** depuis la v1.32.0 (**📈 Moyennes** ajouté entre Observations et Retours — c'est un suivi scolaire, comme le carnet) ; 5 de la v1.23.0 à la v1.31 (la Synthèse a été fusionnée dans Élèves — cf. 5.) ; l'app reste petite, pas de `.tab-group` à deux étages ici.

⚠️ **Les libellés nomment ce qu'on FAIT, pas l'objet qu'on manipule** (arbitré le 2026-09-11 :
*« dans l'onglet carnet, en fait on fait le suivi des observations ; dans Documents, on
vérifie la signature ou on note qu'on a ramassé »*). D'où, depuis la v1.22.0 : l'onglet
**📓 Observations** (titre *Observations du carnet*, bouton *+ Relever les carnets*, colonne
*Observations* dans la Synthèse et la fiche), l'onglet **📄 Retours** (titre *Retours de
documents*, bouton *🧺 Ramasser · vérifier…*, retour arrière *← Liste*), et la colonne
*Remarque · contacts* (elle porte le dernier contact avant la remarque). Les identifiants du
code (`tab-carnets`, `documents-body`, `S.releves`, `renderCarnets`…) ne bougent pas : on
renomme l'écran, pas le modèle. Les noms ci-dessous sont ceux du code.

1. **👥 Élèves** — liste triable, import, ajout/édition, remarque libre, aménagements, arrivée/départ — **et, depuis la fusion de la Synthèse (v1.23.0), le suivi** : observations (dernier total + date), Δ, total de période, non rendus (pastille), incidents, remarque · contacts. **C'est l'écran de préparation du conseil de classe et des appels aux parents.** Une seule fonction, `_elevesRows(cls)`, filtre et trie les lignes `{ s, r: _syntheseRow(cls, s) }` pour l'écran ET l'impression (`printEleves`, paysage) ; les colonnes de suivi se trient par en-tête, en décroissant au premier clic (le plus chargé d'abord), inconnus en fin. La colonne **Naissance** est masquée par défaut (la ligne est longue) : case « 📅 naissances » dans la barre pour une saisie en série.
   - **Colonnes à masquer** (v1.41.0, demande de l'utilisateur : *« pas besoin de voir
     toujours toutes les colonnes, s'il n'y a pas d'actualité dedans — pouvoir en
     décocher »*) : bouton **☰ Colonnes** de la barre, un volet à cocher (`ELEVES_COLS`,
     `_elevesColsPickHTML`) qui **dit** lesquelles sont vides (`_elevesColVide`), avec
     *Masquer les colonnes vides* et *Tout afficher*. `S.prefs.elevesColsOff` (des clés,
     remplacé jamais modifié en place, un cran d'undo par geste, rien si rien ne change) :
     préférence DURABLE, et valable **pour le papier aussi** (`_elevesPrintHTML` bâtit ses
     colonnes de la même liste). Le nom et les actions ne se masquent pas. Le volet reste
     ouvert pendant qu'on coche (`_elColsOpen`) et se ferme au clic ailleurs — ⚠️ une cible
     DÉTACHÉE (bouton du volet qui vient de re-rendre la liste) n'est pas « ailleurs ».
     ⚠️ À 320 px le volet en surimpression sortait de l'écran : sous 520 px il s'ouvre dans
     la barre, et son `<select>` est borné (il prend sinon la largeur de sa plus longue option).
   - **Une colonne par MOMENT de bilan** (v1.41.0, même demande : *« une colonne par bilan,
     comme pour la moitié d'une période ou un bilan mensuel »*) : `_bilanColonnes(cls, pIdx,
     ajout)` (pur) — le **conseil** de la période courante toujours, la **mi-période** et
     chaque **point du mois** dès qu'un élève en a un ; ordre chronologique, conseil au bout ;
     en-têtes courts (*Point sept.*, *Mi-S1*, *Conseil S1*), libellé long en infobulle. Une
     case ne montre QUE son moment (`_bilanDeColonne` = `_bilanCible`) : le bilan de
     mi-période n'apparaît plus dans la colonne du conseil. Cliquer la case ouvre la
     rédaction de CE moment (`elevesBilanOuvrir` → `openBilan` en mode `{ type, date }`), et
     ◀ ▶ remplit la colonne d'un élève à l'autre. *＋ Ajouter une colonne de bilan…* (dans
     le volet) crée une colonne vide pour la séance (`_bilanColsAjout`, rien dans `S`) —
     elle reste d'elle-même dès le premier bilan écrit ; ni août ni juillet proposés. Tri par
     en-tête « rédigé d'abord » ; l'ancien tri `bilan` désigne la colonne du conseil. Les
     colonnes de bilan se masquent comme les autres, et s'impriment une par une. Démo : un
     point de mars au S2 (trois colonnes de bilan au S2 : mars, mi-S2, conseil).
     **Retirer un moment** (v1.45.3, l'utilisateur : *« on peut ajouter des moments mais on
     ne peut pas en enlever »*). ⚠️ Révisé en v1.45.4 (*« une liste qui s'appelle Moments, et à
     droite de chaque moment le symbole moins ou plus »*) : les deux menus ＋ / － sont devenus
     la puce **🗓 Moments** — un volet (`_elevesMomentsHTML`, `_elevesMoments` pur) qui liste
     TOUS les moments, période par période, dans l'ordre : ceux de la colonne avec **−** (et
     le nombre de bilans écrits), ceux qu'on peut ajouter avec **+**. Il reste ouvert pendant
     qu'on clique (`_elMomOpen`) et se ferme au clic ailleurs. Ajouté et encore vide : il disparaît (rien dans `S`).
     Avec des bilans : MASQUÉ (`S.prefs.bilansMasques`, un cran d'undo), les bilans restent
     dans les fiches, *＋* le remet (« (retiré) »). `_bilanColsVues` = la liste, la carte de
     chaleur, le tri, le papier. ~~La fiche garde tous les moments.~~ ~~**Révisé en v1.46.0**
     (l'utilisateur : *« dans la fiche, on peut aussi masquer un moment ? »*) : la fiche suit le
     même réglage — un moment retiré ne s'y propose plus dans *Synthèse pour* (`_ficheMoments`),
     ses bilans restent lus dans la carte Bilans parmi les autres ; tout retiré, la fiche garde
     la liste entière.~~ (**v1.46.8** : la fiche a désormais la sélection de la carte de chaleur,
     cf. *Carte de chaleur*.) **v1.46.1** : aucun moment retenu → **pas de colonne Bilans** dans la
     liste ; et ⚠️ un conseil remis par *+* passait dans l'ajout de la séance, et le premier *−*
     ne faisait que l'en sortir (un conseil existe toujours) : il fallait cliquer deux fois.
     `elevesBilanColRetirer` masque désormais tout moment qui resterait affiché. Au passage : « Point
     d'avril » (`_deMois`), et le repère `{demois}` dans le message aux collègues.
     **Périodes précédentes aussi** (v1.41.1, demande de l'utilisateur) : `_bilanColonnesListe`
     (pur) — les colonnes de la période courante, précédées de celles des périodes passées
     **qui ont au moins un bilan** (le conseil du S1 vide n'a pas de colonne au S2) ; le volet
     les range sous *Bilans S1*, *Bilans S2*. On n'ajoute une colonne vide qu'à la période
     courante. Démo au S2 : six colonnes (sept., mi-S1, conseil S1, mars, mi-S2, conseil S2).
   - **Régime et régime de sortie** (v1.45.1, demande de l'utilisateur : *« dans la colonne
     groupe · options, le régime d'entrée et de sortie — chez nous A1 A2 D1 D2 D3 — et s'ils
     sont demi-pensionnaires ou externes »*). `stu.regime` (`REGIMES` : DP · Ext. · Int.) et
     `stu.sortie` (un code). Les codes sont ceux de l'ÉTABLISSEMENT : catalogue
     `S.prefs.regimesSortie = [{ code, label }]`, d'office A1 A2 D1 D2 D3 sans signification,
     réglé dans 💾 Données (« D1 = … », une ligne par code, `regimesSortieUI`) ; un code
     inconnu du catalogue reste affiché tel quel. Affichés en petites étiquettes dans la
     colonne Groupe · options (le code de sortie en pointillés, sa signification en
     infobulle), dans la fiche (Identité, en-tête) et sur la liste imprimée. Saisis dans ✏️,
     ou **en série** par la puce *🍽 Régimes* (deux colonnes de menus, une salve d'undo comme
     les naissances). **Import** : colonnes « Régime » et « Autorisation de sortie » /
     « Régime de sortie » reconnues (`_impNormRegime` lit DEMI-PENSIONNAIRE, DP4, Externe…) ;
     ⚠️ « Date de sortie » reste la date de DÉPART. Un code lu et inconnu entre au catalogue.
     ⚠️ Et l'import **complète les élèves déjà présents** (lignes écartées comme doublons) :
     naissance, régime, sortie VIDES chez eux sont remplis, rien n'est remplacé
     (`_impACompleter`, `_impCompleter`) — sans cela, une classe déjà importée n'aurait jamais
     reçu ces champs. ⚠️ Corrigé au passage : la colonne « Date de naissance » de l'import
     était reconnue mais **jamais lue** (aucun `rec.naissance`) — la documentation l'annonçait
     depuis le 2026-09-09. Démo : demi-pensionnaires et externes, codes de sortie.
   - ⚠️ **Révisé en v1.45.2 — DEUX régimes, pas un** : l'export de Mon Bureau Numérique (MBN)
     de l'utilisateur a montré `Élève · Classe · Régime de ½ pension · Jours de ½ pension ·
     Régime de sortie · Régime d'entrée` — A1 A2 sont des codes d'**entrée**, D1 D2 D3 de
     **sortie**. La v1.45.1 les avait mis dans un seul catalogue. Désormais `stu.entree` et
     `stu.sortie`, deux catalogues (`prefs.regimesEntree`, `prefs.regimesSortie`, deux
     zones dans 💾 Données, `regimesCodesUI`), `stu.joursDP` (cases à cocher dans ✏️, « DP
     (4 j) » dans la liste quand ce n'est pas la semaine entière). **Migration** : le
     catalogue unique de la v1.45.1 resté au défaut se sépare, et un code d'entrée rangé en
     « sortie » passe dans `entree`. La saisie en série (🍽 Régimes) a trois colonnes.
     **Import de l'export MBN** (`openMbnImport`, modale `mmbn` — bouton *📥 Depuis MBN…*
     à côté de 🍽 Régimes, et dans 💾 Données) : `_mbnLire` reconnaît les colonnes par leur
     EN-TÊTE, « NOM Prénom (M.) / (Mme) » donne aussi la civilité (remplie seulement si vide)
     ; `_mbnRapprocher` rattache par la clé de nom des moyennes, ⚠️ rien n'est deviné (nom
     inconnu, homonymes → rattachement manuel, « ignorer » par défaut) ; `_mbnChangements`
     liste chaque champ qui change, avant / après, et **rien n'est appliqué sans le bouton**
     (un cran d'undo). MBN est la source : une valeur différente remplace celle de l'app ;
     ⚠️ une case VIDE de l'export ne vide rien. Les élèves de la classe absents de l'export
     sont nommés. Vérifié sur le vrai fichier de l'utilisateur, hors du dépôt (27 élèves, six
     colonnes) ; les tests fabriquent leur propre classeur aux noms inventés.
     **Lecture .xlsx** (`_xlsxRead`, `_xlsxParse`) : l'app n'en lisait pas — le module ZIP
     et le parseur XML de la feuille d'avis suffisent (chaînes partagées, `inlineStr`,
     ordre des feuilles par workbook.xml et ses relations). `_tableurLire(file)` rend les
     lignes d'un .xlsx, .ods ou .csv ; l'**import d'élèves** accepte désormais aussi .xlsx
     et .ods (collés en tabulations), et reconnaît « Régime de ½ pension », « Jours de ½
     pension », « Régime d'entrée ».
   - **Plus de ligne « Trier »** (v1.45.0, l'utilisateur : *« on clique maintenant sur le
     titre de colonne pour trier »*) : l'en-tête des élèves porte **Nom · Prénom**, deux tris
     réversibles (`_elevesThNomHTML`) ; les ordres de place et de ramassage n'ont pas d'usage
     dans cette liste (ils servent aux SAISIES : carnet, signatures) — un mode resté d'une
     autre grille retombe sur le nom. Les naissances : une puce *📅 Naissances* avec les
     colonnes. *🎓 Synthèse de période…* et *🖨 Imprimer la liste* montent dans la barre du
     haut, à côté d'Ajouter et Importer.
   - **Deux AFFICHAGES, des filtres, des vues** (v1.43.0 — demande de l'utilisateur : *« mieux
     voir les informations essentielles et pouvoir les sélectionner ; voir quand des choses
     sont renseignées, même sans le contenu ; un nombre quand des collègues ont donné leur
     avis »*). Trois prototypes comparés (page publiée à part) : il garde les **indicateurs**
     et la **carte de chaleur**, écarte les cartes par élève. L'affichage est propre au POSTE
     (`localStorage` `suiviPP_elevesAffichage`) : chaleur sur l'écran 21:9 de la maison,
     indicateurs sur la Surface en conseil.
     - **▦ Indicateurs** : la liste d'avant, mais **une ligne par élève** — âge et options sur
       la ligne du nom, remarque et bilans sur UNE ligne (le texte entier au survol), moyenne
       et « n < 10 » côte à côte, dernier incident en « jj/mm · type ». Nouvelle colonne
       **Avis** (`_avisCelluleHTML`) : la feuille la plus récente de la période courante
       (`_avisDeLaPeriode`), un trait par discipline (plein : toutes les colonnes remplies,
       pâle : une partie, gris : rien), « n/N », ⭐ demandé en particulier ; triable (demandés
       d'abord), imprimée (« 3/11 ★ » — pas de colonne sur le papier sans feuille).
       **Vues** toutes faites (`ELEVES_VUES` : *Préparer le conseil*, *Appeler les familles*,
       *Papiers*, *Tout*) : elles écrivent `S.prefs.elevesColsOff` (le même réglage que ☰
       Colonnes, un cran d'undo, rien si rien ne change) ; « personnalisée » dès qu'on retouche.
       **v1.46.15** : *Préparer le conseil* montre aussi les **Contacts** ; `postLoadHook` remet
       la vue à qui avait exactement l'ancienne (masquées : groupe, papiers, contacts).
     - **▥ Carte de chaleur — bornée au MOMENT du bilan** (v1.46.4, l'utilisateur : *« il faudrait
       aussi indiquer pour quel moment on réalise le bilan »*) : une barre *Synthèse pour* au-dessus
       (les moments de la fiche, `chaleurMomentSet`), **le même choix que la fiche**
       (`_ficheMoment`, partagé dans les deux sens) ; `_chaleurGroupes(cls, bcols, col)` borne tout
       par `_ficheBornes` — relevés, mois (MBN, incidents, contacts), moyennes (au conseil le dernier
       import de la période, sinon le dernier avant la fin du moment), feuille d'avis de cet
       objectif, papiers distribués avant la fin ; le bilan du moment est marqué ▶. Avec des
       observations MBN, ~~le premier groupe s'appelle *Observations* et finit par une case
       Total~~ — **révisé en v1.46.6** (l'utilisateur : *« le total après la colonne du carnet et
       celle de MBN, et que le premier titre dise qu'il vient du carnet »*) : trois groupes,
       *Observations du carnet* (les relevés), *Observations MBN* (les mois), puis **Total des
       observations** (`obstot`, une case *Carnet + MBN* depuis la rentrée au dernier jour du
       moment — `_obsTotalAn(cls, sid, fin)`). Replié, le groupe du carnet redevient le cumul et
       l'évolution du carnet seul.
       **v1.46.7** (l'utilisateur : *« que les moments de la synthèse ne soient pas limités par
       ceux cochés dans les indicateurs ; en cliquant sur le titre Synthèse pour, la liste de ceux
       qui doivent être affichés »*) : la barre a SES moments (`_chaleurMomentsTous`, pur) —
       conseil, mi-période et chaque mois de chaque période jusqu'à la courante (ni août ni
       juillet) ; d'office conseil, mi-période et les mois qui ont un bilan ; le titre *Synthèse
       pour ▾* ouvre la liste à cocher (`chaleurMomentVu`, `S.prefs.chaleurMoments = { plus,
       moins }`, remplacé jamais modifié en place, un cran d'undo). **Indépendants de 🗓 Moments** ;
       le moment choisi reste partagé avec la fiche (`_chaleurMomentCourant`). **v1.46.8** (*« que
       la fiche ait le même mécanisme de choix et de sélection des moments que la carte de
       chaleur »*) : la fiche a la MÊME liste (`_ficheMoments` = `_chaleurMoments`,
       `_ficheMomentCourant` = `_chaleurMomentCourant`) et le même titre *Synthèse pour ▾*
       (`_chaleurMomentsPickHTML(cls, 'fi')`, ouvert ou non par endroit : `_momPickOpen`). 🗓
       Moments ne règle plus que la colonne Bilans de la liste. Et la ligne « 25 élèves sur 25 » sous les filtres a disparu de
       la carte de chaleur : le compte est à droite des filtres. Par défaut, le conseil de la période
       courante : la période entière, comme avant. **v1.46.16** (*« affiche aussi la colonne
       Contacts dans la carte de chaleur »* — le groupe existait, tout à droite, hors de l'écran) :
       le groupe **Contacts** finit par une case **Total** du moment, et chaque case s'ouvre d'un
       clic sur la fenêtre des contacts (`parMois(…, clic)` ; 4e élément d'une case = son
       `onclick`, rendu par `td` en `role="button"`, sans ouvrir la fiche de la ligne).
       **v1.55.3** (*« quand je clique sur un compteur d'incidents d'un mois, je devrais avoir le
       choix entre afficher les incidents déjà enregistrés ou en créer un nouveau »* — puis *« et
       quand je clique sur le compteur des avis, je devrais pouvoir les afficher directement »*) :
       une case d'**incidents** (mois borné au moment, ou Total) appelle `chaleurIncidentsUI(sid,
       début, fin, libellé)` — vide : la saisie ; sinon la fenêtre de dialogue liste les incidents
       QUE LA CASE COMPTE (`_chaleurIncidentsListe`, chacun s'ouvre en modification) avec
       *＋ Noter un nouvel incident* ; `clic.fn` reçoit désormais les dates de la case.
       `_appDialogValeur(v)` : un élément du message de la fenêtre de dialogue qui rend une valeur.
       Une case d'**avis** ouvre la lecture de cet avis (`openAvisLire({ did, sid }, campId)`), la
       case repliée tous ses avis ; dans les Indicateurs, le compteur *n/N* aussi (la fiche quand
       il n'y a aucun avis). `openAvisLire` prend la feuille en second argument hors de l'onglet
       Avis ; ses liens et ◀ ▶ restent sur la feuille déjà ouverte.
     - **▥ Carte de chaleur** (`_chaleurGroupes`, `_elevesChaleurHTML`) : une case par relevé
       (Δ coloré), par matière du dernier import de la période (sous 10 en alerte), par
       discipline de la feuille d'avis (pleine / partielle), par papier (✓ ☐ —), par MOIS
       pour les incidents et les contacts, par colonne de bilan (● ○) ; le contenu en
       infobulle, la fiche au clic sur le nom. Chaque groupe se **replie** en une case de
       synthèse (`chaleurPliToggle`, retenu sur le poste) : sur la Surface. Deux lignes
       d'en-tête figées (la seconde à `top: 30px`). Tout ce qui est de la période COURANTE.
     - **Filtres d'un clic** (`ELEVES_FILTRES`, session) : moyenne sous 10 · incident dans la
       période · carnet en hausse (Δ ≥ 3) · papier à rendre · famille contactée · avis
       demandés ⭐ · sans bilan du conseil. Ils se **cumulent** (et), avec la recherche, le
       nombre d'élèves concernés sur chaque puce ; ils valent dans les deux affichages, sur
       le papier (dit au sous-titre) et pour l'enchaînement des bilans — on prépare ceux
       qu'on voit. La synthèse de période garde tous les présents (les filtrés au bout).
     - ⚠️ `--chip-on-fg` (nouveau token, aux trois endroits) : l'encre d'une puce active
       était `--paper`, qui s'assombrit la nuit — 2,5:1 mesuré. Corrige aussi les touches
       du carnet (`.rel-sug-kbd.on`), qui avaient le même défaut.
   - ⚠️ **Révisé en v1.44.2 — le tableau EST celui du prototype** (l'utilisateur : *« j'aimais
     bien ton tableau, mais vraiment le même — comment ça se fait que tu ne m'as pas remis
     les mêmes ? »*). La v1.43.0 avait greffé les indicateurs sur l'ancienne liste au lieu de
     reprendre le prototype choisi : **quand l'utilisateur valide un prototype, on le
     reproduit, on ne l'adapte pas**. Désormais (`_elevesIndicHTML`) : colonnes `ELEVES_COLS`
     = Groupe · options (groupe, options ET aménagements) · **Carnet** (cumul à la couleur du
     palier, Δ, courbe de l'année `_elevesSpark`) · Moy. · Papiers (« n à rendre ») ·
     Incidents (« ⚖ n » + date du dernier) · **Contacts** (« ☎ n » + date, colonne à part) ·
     Avis coll. · **Bilans** (UN point par moment, plein = écrit, séparés par période) ·
     Remarque (une ligne) ; et le **genre** (♂ ♀ coloré) devant le nom, demandé en plus.
     **Vue** en boutons et **Colonnes** en puces, visibles dans la barre (le volet ☰ est
     retiré). Un clic sur la ligne ouvre la fiche (`_elevesLigneClic`) ; les cases qui ont un
     geste le gardent : ⚖ et la date → l'incident, ☎ → les contacts, un point → la
     rédaction de CE moment, la remarque → la remarque. La colonne d'actions est retirée :
     modifier et **supprimer** (🗑 ajouté au pied de la fiche) passent par la fiche.
     Anciennes clés de `elevesColsOff` : `cumul` → `carnet`, les autres ignorées. Le papier
     garde son détail (Δ, total, une colonne de texte par moment) et suit les puces
     (`_elevesPrintVue`). Carte de chaleur alignée aussi : Δ du relevé aux couleurs des
     paliers (`chob-N`), avis sur trois niveaux (`--av-1/2/3-bg/fg`, aux trois endroits),
     le genre devant le nom, la ligne cliquable.
   - **Aménagements en LECTURE dans la liste** (2026-09-11) : seuls les actifs, en texte
     coloré (`_amenBadgesHTML`, mêmes encres `--st-*-fg` que les cases de la modale ✏️).
     Les huit boutons-bascules d'origine faisaient de cette colonne la plus large du tableau
     (≈ 480 px, contre 133 désormais) pour un réglage qui **vient de l'import** et se corrige
     une fois par an. Ils se règlent dans ✏️ — la case elle-même ouvre la modale au clic.
   - **Le nom d'un délégué est SURLIGNÉ** (2026-09-11) — vert titulaire, jaune suppléant —
     dans les cinq grilles, par `_nomHTML(sid, nom, prenom)` qui interroge `_delegueOf`.
     Remplace la pastille 🏅 : on repère ses délégués en balayant une colonne de noms, sans
     lire. Tokens `--del-t-*` / `--del-s-*` aux trois endroits ; l'infobulle dit le mandat.
     ⚠️ Toute NOUVELLE grille à noms passe par `_nomHTML`, sinon elle est la seule où le
     délégué n'apparaît pas — et c'est là qu'on le cherchera.
   **Fiche complète** — cliquer le NOM d'un élève ouvre tout ce que l'app sait de lui sur un écran : identité et âge, options, aménagements, présence, place dans chaque salle, délégué ; l'histoire complète du carnet (trous compris) et les totaux de période ; tous les documents avec leurs réponses en clair ; les élections où il apparaît ; sa remarque, son journal de contacts et ses incidents et instances en entier.
   - ~~⚠️ **Écran de LECTURE.**~~ **Révisé le 2026-09-11 : la fiche corrige sur place ce qui se corrige d'un geste.** Demande de l'utilisateur : *« ajouter simplement depuis la fiche des remarques, des contacts, des incidents en cliquant sur une pastille `+` à côté du titre ; modifier aménagements, options, groupe en cliquant dessus ; cocher un document rendu sans aller dans Documents »*. Ce qui reste vrai : **la fiche ne duplique aucune logique** — elle passe par les mêmes fonctions que les autres écrans (`_withStudent`, `_setStudentStatusExclusive`, `journalAdd`, `docSetRendu`, la modale `mincident`), sinon on duplique les gardes-fous et on n'en corrige qu'un seul un jour. Testé : exclusivité des statuts, date de retour, un cran d'undo par geste.
     - **Pastille `+`** à côté de Remarque (`✎` quand elle existe), Contacts, Incidents : éditeur en place pour la remarque (textarea) et le contact (date · type · texte, `Entrée` valide) ; modale pour l'incident, qui revient à la fiche.
     - **Valeur cliquable** (`.fi-val`) sur Groupe, Options, Aménagements : ouvre des pastilles à bascule sous la ligne (`_ficheEdit`, un seul éditeur à la fois, refermé à l'ouverture d'une autre fiche). Les aménagements reprennent les bascules de l'ancienne liste (`ficheToggleStatus`, `ficheCycleUlis`, `ficheCycleUpe2a`).
     - ⚠️ **Ce que la fiche corrige est ce qu'un import depuis Plan de classe RÉÉCRIT** (groupe, options, aménagements — `_PDC_STU_FIELDS` + tags). L'éditeur le DIT (`_fichePdcHint`) quand la classe en vient : `cls.pdcImportAt`, posé par `_pdcImport` ; à défaut, la présence d'une salle `pdc_*` sert d'indice pour les données antérieures au marqueur. Sans cet avertissement, la correction disparaît au prochain import sans que rien ne l'explique.
     - **Documents** : l'état est un bouton (`☐ non rendu` / `✓ rendu le …`) — `ficheToggleRendu` passe par `_docMut` + `docSetRendu`, donc la date du jour se pose et l'onglet Documents se rafraîchit. Réservé aux documents suivis ET attendus : « rien à rendre » et « non concerné » restent du texte.
     - Les deux boutons de pied (édition complète, remarque et contacts) restent, et **reviennent** à la fiche (`_modalReturnTo`).
     - **Tout le reste aussi** (v1.17.0, *« il y a toujours des données qu'on ne peut pas modifier sans aller ailleurs »*) : nom et prénom (✎ sur le titre), naissance / arrivée / départ (champs date en place, écrits **une fois le champ quitté** — `ficheSetDate`, mêmes gardes-fous que la modale), civilité (clic cycle), classe — **c'est-à-dire le NOM et l'année de LA classe** (`ficheSaveClasse`, v1.18.0 : on est PP d'une seule classe, « modifier la classe » ne peut pas vouloir dire déplacer l'élève ; le déplacement reste dans la modale ✏️, par `moveStudentToClass`, extrait pour être partagé), place (un sélecteur par salle, positions occupées désactivées → `seatSet`), **chaque cumul du carnet** (`releveSetCount`, mêmes règles que la grille, refus = valeur rétablie), **réponses, date de retour et note de chaque document** (`docSetReponse` / `docToggleReponse` / `docSetDateRetour` / `docSetNote` via `_docMut`), **texte et suppression de chaque contact** (`journalSetTexte` / `journalRemove`). Restent dérivés, donc non modifiables ici : délégué (l'élection) et élections. Testé : déplacement de classe, réponses / date / note, contact, place.
     - ⚠️ Défaut 22 (responsive) trouvé sur l'éditeur de place : `dd` de grille sans `min-width: 0` + éditeur flex **en colonne avec `flex-wrap: wrap`** — en colonne, une ligne flex qui replie se dimensionne sur ses items, pas sur le conteneur, et le label débordait de 120 px à 320 px. `nowrap` sur l'éditeur en colonne.
   - **Refonte de la fiche (v1.44.0)** — demande de l'utilisateur : *« une fiche qui prenne
     plus de place, pour quasiment tout voir en même temps ; faire une synthèse sur l'élève
     à un moment donné : avis des collègues, résultats, ce qui s'est passé, l'évolution de
     ses observations »*. Les trois vues du prototype sont gardées, choisies dans la **barre
     de la fiche** (et seulement là — en haut de page, le choix aurait figuré deux fois
     quand la fiche est à côté de la liste) ; la vue se retient sur le poste
     (`suiviPP_ficheVue`) :
     - **▦ Tableau de bord** : les sections d'avant (toutes éditables comme avant), en
       **colonnes** (`columns: 400px` — trois sur la Surface, davantage à côté de la liste
       sur l'écran large) ;
     - **🕑 Chronologie** : chiffres clés, **frise** (une ligne par sujet, un repère par
       événement, cliquable vers le journal — `ficheSaut`), journal daté (`_ficheEvenements`) ;
     - **✍️ Faits et rédaction** : les faits en phrases (`_ficheFaits`, chacun avec
       *＋ insérer*), la courbe du carnet, les **avis en tableau** (disciplines × colonnes de
       la feuille) avec les **mots qui reviennent** (`_avisMotsFrequents`, comptés par
       discipline, mots vides écartés — un clic les surligne), et un **brouillon** assemblé
       des faits (`_ficheBrouillon`) — l'app rassemble, elle ne juge pas : à réécrire.
     - **Synthèse pour** : un MOMENT — les colonnes de bilan (conseil, mi-période, points du
       mois) de chaque période jusqu'à la courante (`_ficheMoments`). Il borne la chronologie
       et les faits (`_ficheBornes` : la période pour un conseil, du début au milieu pour la
       mi-période, le mois pour un point du mois) et choisit le bilan qu'on écrit. Moyennes :
       la même exception que la synthèse de période (au conseil, le dernier import, même
       daté après la fin).
     - **La rédaction est dans les trois vues** (`_ficheRedacHTML`) : le bilan de ce moment,
       écrit EN PLACE, enregistré **en quittant le champ** (`ficheBilanSave` : reprend le bilan
       existant par `_bilanCible`, un cran d'undo par changement, un texte vidé ne supprime
       rien). ⚠️ **Pas de re-rendu à l'enregistrement** : un clic sur *insérer* ou ▶ fait
       quitter le champ, et la fiche redessinée remplaçait le bouton sous le doigt.
     - **Ouverture** (arbitrée par l'utilisateur : *« à côté de la liste sur un écran large,
       plein écran sinon ; proposer ces choix par défaut selon la largeur, mais laisser le
       choix »*) : `_ficheOuverture` — `auto` (défaut) = **à côté** dès `FICHE_COTE_MIN` =
       1 700 px CSS (son 21:9), **plein écran** en dessous (la Surface Pro 9, 1 440 px) ;
       réappliqué au redimensionnement. ⚠️ Révisé en v1.44.1 : le menu « Ouverture » de la
       v1.44.0 est devenu un **bouton** (*⛶ Plein écran* / *◧ À côté de la liste*,
       `ficheOuvertureBascule`) — l'utilisateur ne l'avait pas vu comme un choix. Le choix
       vaut pour la SESSION (`_ficheOuvForce`) : rien n'est retenu sur le poste, au prochain
       lancement la largeur de l'écran décide de nouveau. À côté : `#mfiche.cote` est ancrée à droite sous le bandeau
       (`--fiche-cote-w` = 58vw), sans voile, `aria-modal="false"`, et `body.fiche-cote`
       donne à l'onglet une marge à droite — la liste reste utilisable, un clic sur un nom
       change de fiche, la ligne ouverte est surlignée (`tr.el-cur`).
     - **◀ ▶** (et les flèches du clavier hors saisie) suivent la liste à l'écran, tri et
       filtres compris (`_ficheOrdre`).
   - ⚠️ **Révisé en v1.44.3 — la fiche EST celle du prototype** (l'utilisateur : *« remets
     aussi la fiche exactement comme dans le prototype »*). En-tête sur une rangée : nom,
     âge · groupe · options · aménagements · délégué, **Synthèse pour** en BOUTONS (un par
     moment), les vues *1 · Tableau de bord · 2 · Chronologie · 3 · Faits et rédaction*,
     ◀ n/N ▶, le bouton d'ouverture (demandé en plus) et ✕ ; plus de pied de modale. Classes
     `pf-*` copiées du prototype, tokens `--pf-card` (la carte blanche) et `--i-obs/moy/incid/
     contact/avis/bilan` (une couleur par sujet), aux trois endroits.
     - **Tableau de bord** (`_ficheTableauHTML`) : des CARTES en colonnes, bornées au moment —
       Identité et repères (+ remarque ✎), Bilans (la rédaction et les autres moments),
       Carnet (courbe, « n sur la période »), Moyennes (matières × imports, Δ), Avis des
       collègues (un onglet par feuille de la période, `ficheFeuilleUI`), Incidents (+),
       Contacts (+), Papiers (cochables d'un clic). Ce que le prototype n'avait pas et qu'il
       ne faut pas perdre se RATTACHE sans changer l'allure : ✏️ et 🗑 dans l'en-tête de la
       carte Identité (l'édition complète et la suppression), et ~~le **dossier d'avant**
       (réponses aux documents, places, élections, chaque relevé modifiable) dans un volet
       *📁 Dossier complet* replié au pied (`_ficheDossierOpen`)~~.
     - ⚠️ **Révisé en v1.46.9 — plus de dossier complet** (l'utilisateur : *« pourquoi ne pas
       inclure dans la première partie les éléments qui n'y figuraient pas, et le supprimer ?
       Ajoute le petit crayon pour les corrections faites sur place »*). Ce que seul le dossier
       montrait est rattaché à sa carte, derrière un **✎** (`pen(k)` → `ficheEdit(k)`, un seul
       éditeur ouvert, refermé par le même ✎ ; les éditeurs viennent de `_ficheRender` par
       l'objet `ed`) : **Identité** — classe, naissance (+ âge), civilité (✎ cycle), groupe,
       options, aménagements, régime (✎ → la fenêtre de l'élève), présence (arrivée, départ),
       **place** dans chaque salle, délégué, éco-délégué, **élections** ; **Observations** —
       ✎ *Relevés du carnet* : chaque cumul de l'année corrigeable ; **Bilans** — ✎ : tous les
       bilans, ✏️ 🗑 ; **Incidents** — 📎 du PDF sur l'entrée, ✎ : toute l'année, ✏️ 🗑 ;
       **Contacts** — ✎ : texte corrigeable, 🗑 ; **Papiers** — les **choix portés** lus sous
       chaque papier (« Participation : ULYSS »), ✎ : réponses, date de retour, note, documents
       archivés compris. Ce qui faisait doublon (identité, remarque, moyennes, avis) n'est plus
       qu'une fois. Les cartes restent bornées au moment ; ✎ ouvre l'année entière.
       **v1.46.10** (*« dans la remarque, on ne voit pas s'il y a plusieurs paragraphes »*) :
       remarque, bilans et avis des collègues gardent leurs retours à la ligne (`pre-line` sur
       `.pf-p`, `.pf-bil`, `.pf-cr > span`, `.pf-mx td`, `.pf-avd`) — ⚠️ ces gabarits ne doivent
       donc pas porter de retour à la ligne entre leurs balises. **v1.46.11** (*« mets aussi les
       paragraphes sur les feuilles imprimées »*) : remarque et bilans les avaient déjà
       (`.pp-t .pp-rem`, `.print-rem`) ; les **avis des collègues** de la synthèse de période
       aussi désormais (`.pp-pl`, hors `@media print` pour que la mesure « une page » en tienne
       compte).
     - **La fenêtre ✏️ « Modifier l'élève » refaite** (v1.46.11, l'utilisateur : *« quand elle
       s'affiche, l'endroit où on était change — le fond n'est plus la fiche ; la présentation
       est fouillis, on ne voit pas tout d'un coup ; la repenser complètement »*) : elle
       s'ouvre **par-dessus la fiche** (`ficheVersEdition` ne ferme plus `mfiche` ; l'empilement
       d'`openMod` ; la fiche se redessine à la fermeture). Cinq blocs en deux colonnes (une sous
       700 px) — *Identité* (nom, prénom, civilité, naissance), *Scolarité* (classe, groupe,
       options), *Restauration et sorties* (demi-pension, jours — seulement pour un DP —, entrée,
       sortie), *Présence* (arrivée, départ), *Aménagements* sur toute la largeur, en puces
       rangées par exclusivité — ; le titre est le nom de l'élève. Civilité, groupe et
       demi-pension en **boutons** (`_esSeg`, `esSegUI`) qui écrivent un champ caché : les ids
       (`es-civ`, `es-grp`, `es-regime`…) et `saveEdit` n'ont pas changé. Une option cochée prend
       sa couleur tout de suite (`_esTagCouleur`) ; ⚠️ la puce d'option garde son encre dérivée
       — la règle « puce cochée » des aménagements l'écrasait (3,03:1, vu par l'audit).
       **v1.46.12** (*« refais la fenêtre d'ajout sur le même modèle »*) : **la même fenêtre sert
       à l'ajout** — `openAddStudent` → `openEdit(null)` (élève vierge de la classe courante,
       `es-id` vide, titre *+ Nouvel élève*, bouton *✓ Ajouter*), `saveEdit` crée l'élève dans la
       classe choisie puis le remplit comme une modification (un cran d'undo). L'ancienne
       fenêtre `ms` (nom, prénom, civilité, groupe) est supprimée.
     - **Contacts dans la fiche** (v1.47.0, audit C5) : *+* et ✎ de la carte Contacts ouvrent la
       fenêtre des contacts par-dessus la fiche (`ficheVersContacts`) — la même que depuis la
       liste (date, type, texte) ; le formulaire en place et la liste ✎ (texte seul) sont retirés.
     - **Le nom ouvre la fiche dans toutes les grilles d'élèves** (v1.47.0, audit C2) :
       `_nomFicheHTML` — Élèves, carte de chaleur, Observations, Moyennes, tableau d'un document,
       ramassage, grille des avis ; même allure partout (`.el-nom`, nom en gras).
     - **Le titre de la fiche ne s'édite plus** (v1.47.1, l'utilisateur : *« le titre n'est pas un
       endroit habituel pour éditer ce genre d'informations »*) : *Nom* est la première ligne de
       la carte Identité, avec son ✎ (`edNom`, mêmes champs `fi-nom` / `fi-prn`, `ficheSaveNom`).
       En tête de la carte, des boutons nommés : *✏️ Tout modifier*, *🗑 Supprimer*.
     - **La fiche se ferme quand on quitte Élèves, Observations ou Moyennes** (v1.46.12,
       l'utilisateur : *« vers Retours, Vie de classe, Avis des collègues… ça ne sert à rien
       qu'elle reste affichée, au contraire »*) : `FICHE_ONGLETS`, dans `showTab`.
     - ⚠️ La classe `.mo` du prototype (les mois de la frise) est celle des FENÊTRES de
       l'app (`display: none`) : les mois ne s'affichaient pas. Renommée `pf-mois`. Toute
       classe reprise d'un prototype se vérifie contre les classes de l'app.
   - ⚠️ La fiche est un **dossier**, pas une vue courante : elle montre les documents archivés et les relevés où l'élève n'a rien. Une case vide au 8 décembre est une information quand on prépare un rendez-vous.
   - ⚠️ Un document `suiviRetour: false` s'affiche « rien à rendre », **jamais « non rendu »** : sinon la fiche fait courir après un papier qui n'existe pas.
   - La section **Documents est repliable** (elle est la plus longue, et on ne l'ouvre pas à chaque consultation) — mais les **choix portés** sur les papiers restent visibles repliés : c'est souvent la seule chose qu'on vient y chercher, et la cacher derrière un clic reviendrait à cacher l'essentiel avec l'accessoire. Le pli se souvient d'une fiche à l'autre. Reprend la structure de l'onglet Élèves de Plan de classe, moins tout ce qui touche au placement.
2. **📓 Carnets** — grille **élèves × relevés**. **Touches de saisie** sous la cellule active : les six valeurs probables (inchangé, +1 … +5), plus « absent » et « vide ». Toucher une touche écrit et passe à l'élève suivant — la boucle qui rend la saisie au doigt plus rapide qu'au clavier.
   - ⚠️ La **première** proposition est la valeur INCHANGÉE : d'un relevé à l'autre, « rien de neuf dans ce carnet » est le cas le plus fréquent, il doit être le plus facile à atteindre.
   - ⚠️ `_carnetSuggestions` ne regarde JAMAIS la valeur déjà dans la cellule : on peut être en train de corriger une faute de frappe, et proposer des incréments à partir d'elle la propagerait.
   - ⚠️ Le bandeau **suit** la cellule au défilement, il ne se referme pas. Première version : il se cachait sur tout `scroll` — or donner le focus à une cellule la fait défiler dans la vue, donc il disparaissait à l'instant même où il s'ouvrait. Invisible en test unitaire, systématique à l'usage.
   - ⚠️ Huit touches à 42 px font 376 px : plus qu'un écran de téléphone, et c'est là qu'elles servent. Elles passent à la ligne (`flex-wrap` + `max-width: calc(100vw - 10px)`).
   - ⚠️ **Entrée passe à l'élève suivant — même quand la valeur a changé** (v1.23.2, remontée de l'utilisateur). `relCellKey` capturait l'élément suivant PUIS appelait `blur()`, qui déclenche le `onchange`, qui re-rend toute la grille : l'élément capturé était détaché, `focus()` ne faisait rien, et plus aucune cellule n'était sélectionnée après Entrée — précisément dans le cas normal, une valeur tapée. La cellule suivante se retrouve maintenant **par ses données** (`data-ymd` + `data-sid`) dans la grille telle qu'elle est après le re-rendu. Le bug ne se voyait pas quand on relisait sans rien changer (pas de re-rendu). ⚠️ Règle : après tout `blur()` ou mutation qui peut re-rendre, ne jamais réutiliser une référence d'élément prise avant.
   - ⚠️ **Au doigt, les touches SONT le clavier — le clavier virtuel ne doit pas surgir** (v1.23.1, remontée de l'utilisateur : chaque touche passait le focus à la cellule suivante, le clavier virtuel s'ouvrait et décalait la page, « extrêmement pénible »). Les cellules portent `inputmode="none"` quand `_relKbdOff` est vrai — d'office si le pointeur principal est le doigt (`matchMedia('(pointer: coarse)')`), jamais à la souris — ce qui garde le focus (donc le bandeau, qui suit la cellule) sans appeler le clavier. Une neuvième touche **⌨** bascule le réglage pour taper une valeur que les touches ne proposent pas ; ⚠️ changer `inputmode` sur un champ déjà focalisé ne fait rien, il faut `blur()` puis `focus()`. Sans effet sur un clavier physique. ⚠️ **Non vérifié sur une vraie tablette** — le navigateur de test n'a pas de clavier virtuel ; seuls les attributs et le focus ont été vérifiés.
 Une colonne par date, saisie du cumul au clavier (`Tab`/`Entrée` comme le tableur d'éval), colonne **Δ depuis le relevé précédent**, colonne **total de la période**, en-tête `+ Nouveau relevé`. Tri par Δ décroissant = la liste des élèves à voir en priorité.
2 bis. **📈 Moyennes** (v1.32.0) — le tableau élèves × matières d'un import, ses statistiques en pied, l'évolution depuis l'import précédent de la même période dans chaque case ; une vue **📈 Évolution** (une ligne par import, une statistique au choix) ; import par fichier ou copier-coller avec aperçu ; impression paysage. Détail et pièges : *Moyennes par matière*.
3. **📄 Documents** — liste des documents (avec compteurs `rendus / attendus` et `réponses manquantes`), puis un tableau par document : élèves × (`Rendu` · `Date` · un groupe de colonnes par champ). Bouton « liste des manquants » (à copier ou imprimer pour la vie scolaire).
   ⚠️ **Un document ne se « ramasse » pas toujours** : très souvent on VÉRIFIE qu'une signature est là, carnet par carnet, en passant dans les rangs. Le tableau d'un document porte donc le même sélecteur de tri que les autres grilles — place et ordre de ramassage compris.
   **🧺 Ramassage** — le geste réel n'est pas « un document à la fois » : on passe dans les rangs avec trois papiers différents à récupérer. D'où une troisième vue de l'onglet, une grille **élèves × documents** où l'on coche les retours de plusieurs documents en une seule passe. Colonnes choisies à la volée, date du ramassage réglable (on saisit souvent le soir), compteurs vivants par colonne et par élève, « tout cocher » par colonne, flèches pour descendre une colonne.
   - **Imprimer, ou enregistrer en PDF** (v1.9.0) — le tableau des retours part sur le papier
     avec **les colonnes qu'on choisit**. ⚠️ Il n'y a **aucune bibliothèque PDF** : l'app est
     mono-fichier et sans dépendance, le PDF sort de la fenêtre d'impression du navigateur
     (« Enregistrer au format PDF » comme destination). C'est **dit dans la modale**, sinon
     personne ne le devine — et « exporter un PDF » était la demande, pas « imprimer ».
     - ⚠️ **Le choix des colonnes n'est pas un confort** : la fiche d'orientation fait huit
       colonnes, et une feuille qui déborde n'est plus une feuille.
     - **Portrait par DÉFAUT** (arbitré avec l'utilisateur le 2026-09-10) : c'est l'orientation
       habituelle de ce genre de feuille — celle des classeurs et des bannettes de la vie
       scolaire. Le paysage et l'« automatique » (`_docPrintOrientation` : paysage dès six
       colonnes) restent au menu, parce qu'on ne sait qu'en essayant ce qui se présente le
       mieux. ⚠️ Le résumé **prévient** quand le portrait va serrer (« 8 colonnes en portrait :
       ce sera serré ») — il informe, il ne corrige pas à sa place : une colonne étroite reste
       souvent préférable à une page en travers dans un classeur.
     - ⚠️ **« Élève » ne se décoche pas.** Une ligne sans nom ne désigne personne, et une
       feuille de suivi anonyme est un déchet de papier. Elle porte `fixe`, et
       `_docPrintKeys` la **rétablit** même absente de la sélection.
     - ⚠️ **Le retour s'imprime `☐` / `✓`**, jamais « oui » / « non » : la feuille sort
       souvent AVANT le ramassage et se coche au stylo dans les rangs.
     - ⚠️ **Un filtre indisponible replie sur « tous »**, jamais sur une page vide : un
       document sans suivi de retour a une liste de manquants vide *par construction*, et
       prendre le filtre au mot ferait chercher la panne du côté de la classe.
       `_docPrintFiltres` n'offre d'ailleurs que ce que le document permet.
     - Les colonnes se retiennent **pour la session**, par document (`_docPrintSel`) — rien
       dans `S` : comme la sélection de ramassage, elles décrivent le geste, pas la classe.
       Une clé morte (champ supprimé entre deux impressions) est écartée à la relecture.
     - `Ctrl+P` sur un document ouvert ouvre **le choix des colonnes**, pas l'impression
       directe : une feuille de huit colonnes partie sans avoir été choisie est une feuille
       jetée. La liste des manquants reste dans sa propre modale 📋.
     - **Un bilan au pied de la feuille** (v1.31.0, demande de l'utilisateur : *« le nombre
       d'élèves qui ont rendu et le nombre qui correspond à chaque choix »*) —
       `_docPrintBilan(doc, sids, keys)`, pur et testé, rendu par `_docPrintBilanHTML` :
       « Rendus 19 / 24 », puis une ligne par champ **imprimé** avec le compte de chaque
       option et les « sans réponse ». ⚠️ Compté sur les **lignes imprimées** (filtre
       compris), comme `_gridPrintTotals`, et seulement pour les champs dont la colonne est
       sur la feuille — le rendu, lui, se compte dès que le document le suit, colonne ou
       pas. Un choix multiple le **dit** (ses comptes dépassent l'effectif). Une option
       retirée du champ ne compte plus : l'élève passe « sans réponse », comme sa ligne.
   - **Imprimer la grille élèves × documents** (v1.10.0) — l'impression de la **vue globale**,
     et ce n'est pas la même feuille que celle d'un document : on ne ramasse pas un papier à
     la fois. Une colonne par document retenu, une ligne par élève, un pied qui totalise
     `rendus / attendus`. Accessible de la liste des documents **et** du 🧺 Ramassage (qui
     présélectionne alors ce qu'on a dans les mains).
     - ⚠️ **Les TROIS états sur le papier aussi** : `✓` rendu · `☐` attendu et pas rendu ·
       `—` sans objet. Le tiret n'est pas une case vide — c'est toute la différence entre
       « il ne l'a pas rendu » et « il ne l'a jamais reçu ».
     - ⚠️ **Bâtie sur `_ramRows`, pas réécrite** : c'est elle qui sait déjà qui est attendu
       sur quoi. Une seconde implémentation aurait dérivé au premier document qui change de
       classe.
     - ⚠️ **Bornée au ROSTER de la classe — dans `_ramRows`, pas ici.** `_docExpected` couvre
       **toutes** les classes d'un document : un papier partagé 5C + 5D faisait entrer un élève
       de 5D sur une feuille titrée « 5C », et dans la grille à l'écran — quelqu'un qui n'est
       pas dans la salle où l'on passe dans les rangs. Trouvé par le test des totaux, jamais
       à l'œil. Corrigé à la SOURCE le 2026-09-11 (« on est PP d'une seule classe ») :
       une seule garde, là où les lignes naissent, et la grille imprimée n'en ajoute pas une
       seconde — une double garde ferait croire qu'on peut en oublier une.
     - ⚠️ **Les élèves partis sont masqués** (on ne ramasse rien auprès d'eux) **et le
       sous-titre le DIT** : un décompte qui rétrécit sans raison visible fait chercher une
       panne qui n'existe pas. Même leçon que le toast de `ramSetColonne`.
     - Le pied compte sur les **lignes imprimées**, pas sur le document entier : un total
       qu'on ne retrouve pas en comptant la colonne au-dessus fait douter de toute la feuille.
     - **Le même bilan qu'au pied d'un document, une fois PAR document** (v1.31.1, demande de
       l'utilisateur) : `_gridPrintBilan(rows, docIds)` appelle `_docPrintBilan` sur les
       élèves imprimés **et attendus** de chaque colonne (un « sans objet » sort du
       dénominateur, comme dans le pied), avec les champs des **familles seulement** — l'avis
       du PP ne descend pas dans les rangs, ni sous les coches ni au bilan. Rendu partagé
       (`_docPrintBilanRows(b, prefix)`, le titre du document en tête de ligne) : un seul
       rendu à relire pour les deux feuilles. Un élève parti masqué est hors bilan, comme il
       est hors feuille. Testé.
     - Option « porter les réponses des familles sous les coches » : la feuille de ramassage
       devient un récapitulatif. ⚠️ **Les champs `par: 'prof'` n'y descendent pas** — l'avis
       du PP se donne au bureau, pas dans une allée.
   - ⚠️ **Une case a TROIS états.** Rendu, pas rendu, et **sans objet** — l'élève arrivé en novembre n'a jamais eu la fiche de rentrée, celui parti en mars n'a pas eu la fiche d'orientation. Un tiret, pas une case vide : confondre les deux, c'est réclamer un papier à quelqu'un qui ne l'a jamais reçu. `ramSetRendu` **refuse** d'écrire pour un élève non attendu.
   - ⚠️ **Salve d'undo** (`_ramArmUndo`, motif `_relArmUndo`) : cocher vingt-cinq cases est UN geste. Sans elle, une seule passe viderait la pile de quinze niveaux. En revanche « tout cocher une colonne » est un acte délibéré et massif → son propre `pushUndo()`, et **rien n'est empilé si la colonne était déjà dans l'état demandé**.
   - ⚠️ **Pas de re-rendu à chaque case** : la grille se reconstruirait sous le curseur en pleine passe. Seuls les compteurs sont rafraîchis (`_ramRefreshCounters`).
   - ⚠️ **Une ligne par élève DE LA CLASSE**, pas par élève attendu sur le document : un papier partagé avec une autre division ferait sinon entrer ses élèves dans la grille — et « tout cocher » leur attribuerait un retour en mains propres. `_ramRows` est bornée au roster de `classId` (2026-09-11). Aucune fixture n'avait de papier partagé : le défaut a dormi de la v1.1.0 à la v1.10.0.
   - Les élèves **partis** sont masqués par défaut (on ne ramasse rien auprès d'eux) mais restent comptés dans les manquants du document, où l'information est juste.
   - **Les réponses se relèvent DANS la grille.** Le papier revient et on lit la case cochée dessus : rouvrir le document ensuite, élève par élève, c'est refaire une seconde fois le tour de la classe. Pastilles plutôt que menu déroulant — un appui au lieu de deux, ce qui compte debout dans une allée — et un second appui sur la même option l'efface, pour corriger une lecture erronée sans viser une croix.
     - Seuls les champs `par: 'famille'` descendent dans les rangs : l'avis du PP se donne au bureau, et le compter ici ferait clignoter une ligne pour un travail qui n'est pas le geste en cours. Idem pour le compteur « à lire », qui ne prend que les champs **obligatoires** des familles.
     - ⚠️ **Relever un choix VAUT constat de retour** (arbitrage de l'utilisateur, 2026-09-09) : si on lit la case cochée sur le papier, c'est qu'on l'a en main, et le cocher à part serait deux gestes pour un seul fait. Le retour se coche donc tout seul, **à la date du ramassage** — et si le papier était déjà daté, sa date ne bouge pas. Deux bornes : **retirer** une réponse ne décoche RIEN (on corrige une lecture, on ne rend pas le papier), et la règle ne vaut **que dans les rangs** — le tableau du document garde les deux axes séparés, parce que c'est là qu'on note une réponse donnée à l'oral avant que le papier revienne.
     - ⚠️ **Repli par colonne**, et repli d'office des documents à plusieurs champs de famille. Un champ à trois options tient sur une ligne ; deux champs de quatre options font des lignes de **130 px**, soit trois mille pixels de défilement pour vingt-cinq élèves — la grille devenait illisible avant d'avoir servi. Mesuré sur la fiche d'orientation des données de démo.
   - ⚠️ **Un bouton de masse n'agit que sur ce qui est AFFICHÉ.** « Tous » itérait tous les
     élèves attendus, partis compris — il marquait donc « rendu » pour quelqu'un dont la
     ligne est masquée : un papier déclaré recueilli en mains propres auprès d'une personne
     qui n'était pas dans la salle, sans rien à l'écran pour le montrer. `ramSetColonne`
     prend désormais une liste explicite d'élèves, et le toast **dit** combien sont restés
     hors de vue — sinon le compteur de la colonne stagnerait sous son total sans raison
     apparente. (Trouvé en relecture croisée, pas par les tests : mes fixtures d'origine
     couvraient le calcul, pas la politique d'affichage.)
   - La sélection ne vit **que pour la passe en cours** : rien n'est ajouté à `S`, donc rien à purger ni à déclarer dans `_validateImport`. Elle est filtrée sur la **classe courante** — changer de classe avec le ramassage ouvert laissait sinon des colonnes de l'autre classe, peuplées de ses élèves à elle.
4. **🏫 Vie de classe** (renommé en v1.28.0 : l'onglet porte désormais AUSSI les **heures de vie de classe**, en tête — cf. ci-dessous ; identifiants du code inchangés : `tab-delegues`, `renderDelegues`) — puis les élections : candidatures (binômes), **dépouillement projeté en direct** (grille de saisie à gauche, graphique lisible du fond de la salle à droite), résultats calculés, procès-verbal imprimable. Un bloc par élection, historisé : on garde celle de l'an dernier. **C'est l'écran le plus exigeant du projet** : il est utilisé une fois par an, devant 25 témoins, sans possibilité de reprendre plus tard.
5. ~~**📊 Synthèse**~~ — **fusionnée dans Élèves le 2026-09-11 (v1.23.0)**, arbitré par l'utilisateur : *« la synthèse fait un peu doublon avec Élèves »* — les deux tableaux partageaient nom, groupe · options et aménagements. Ce qui reste : le calcul pur `_syntheseRow` (nom conservé, testé) et `_syntheseRows`, la pastille des non-rendus (`_synthOpen`, détail au survol ou au clic — v1.22.1, parce que la liste des titres en clair élargissait la colonne à la moitié de l'écran), les classes CSS `.synth-*` (cellules). **Retirée : la colonne Réponses** (les choix portés sur les documents se lisent dans la fiche complète — arbitrage de l'utilisateur). Supprimés : `renderSynthese`, `_synthSorted`, `syntheseSort`, `_synthFilter`, l'onglet et sa zone ; `printSynthese` → `printEleves` ; `Ctrl+P` sur Élèves imprime. Un onglet mémorisé « synthese » retombe sur Élèves (`init` vérifie que `tab-<id>` existe).
6. **💾 Données et réglages** (renommé le 2026-09-11) — réglages, **catalogue des options**, **salles et placements**, sync auto, dossier des PDF et nettoyage des orphelins, catalogue des instances, versions & backups, jauge de mémoire locale, export/import JSON, RGPD, à propos.
   - **Options** : le même tableau que la modale 🏷 de l'onglet Élèves (`_tagsTableHTML`, `_tagsFormHTML(prefix)` — deux formulaires, deux préfixes d'ids, sinon la modale et l'onglet se disputeraient `mtags-abbr`). ⚠️ Le bandeau DIT ce qu'un import fait : depuis Plan de classe, **les options de chaque élève sont réécrites** (le catalogue n'est que complété) ; une option cochée à la main est à cocher aussi là-bas.
   - **Salles et placements** (`_sallesEditorHTML`) : sélecteur de salle, nom, rangs × colonnes, et une grille de la classe courante en deux modes — **Placer** (glisser-déposer, cf. ci-dessous) et **Ordre de ramassage** (clic sur les tables dans l'ordre où l'on passe, recliquer retire ; ordres nommés, ↺ pour refaire). Modèle pur et testé : `salleAdd/Set/Remove`, `seatSet`, `patternAdd/SetNom/Toggle/Clear/Remove`.
     - ⚠️ **Rétrécir refuse** tant qu'une place ou une table d'un ordre serait dehors : on ne perd pas un élève assis en changeant un nombre.
     - ⚠️ **Supprimer une salle** emporte son placement dans CHAQUE classe et rebascule `salleCur` — sinon le tri « par place » pointerait dans le vide (testé par balayage de `JSON.stringify(S)`).
     - ⚠️ **Tout cela est PRÉCISÉMENT ce qu'un import depuis Plan de classe réécrit** (salle homonyme, placement, ordres). Le bandeau en tête de section le dit quand les salles en viennent (`_pdcOrigine` : `cls.pdcImportAt` ou une salle `pdc_*`), avec la date du dernier import. Sans cet avertissement, une correction disparaît au prochain import sans que rien ne l'explique.
     - L'état de l'éditeur (`_salleEd` : salle, mode, case sélectionnée, ordre) est de session, rien dans `S`.
     - **Glisser-déposer** (v1.16.0) : la liste des élèves **sans place** est à droite de la grille ; on tire une pastille sur une case pour placer, un élève de la grille sur un autre pour **échanger** (`seatSwap` — vers une case vide, c'est un déplacement), un élève de la grille sur la liste pour **libérer** sa place. Même école que la poignée des documents : événements pointeur + capture, `touch-action: none` **seulement sur ce qui se tire** (les cases vides restent pannables au doigt), rien ne bouge dans le DOM pendant le geste (fantôme + cible dessinée), cible **recalculée au relâchement** par `elementFromPoint`, `Échap` annule. Un relâchement sans mouvement (< 5 px) ne fait rien. Vérifié par événements pointeur synthétiques dans le navigateur : les trois chemins, Échap. ⚠️ Le **sélecteur au clic** sur une case (v1.15.0) a été **retiré** en v1.16.1 — arbitré par l'utilisateur : *« à côté du glisser, ça ne sert plus à rien »*. Une seule façon de faire une chose vaut mieux que deux qui se marchent dessus (et le flag qui faisait taire le clic après un glisser est parti avec).
     - **Ordre au glisser** (v1.18.0) : en mode ordre, le clic table par table reste, et **glisser d'une table à la suivante les enchaîne** (`ordrePaintStart/Move/End`) — chaque table survolée pour la première fois s'ajoute en fin d'ordre, celles déjà dans l'ordre sont sautées, un seul cran d'undo pour la traînée. ⚠️ **Pas de re-rendu pendant le geste** (la case qui détient la capture serait remplacée, leçon de `docReorder`) : le numéro est posé dans la case à la main, la grille est redessinée au relâchement. `touch-action: none` sur les cases cliquables en mode ordre — c'est le prix du tracé au doigt.
     - ⚠️ **VUE DU BUREAU** (v1.15.1, demande de l'utilisateur : *« c'est le prof qui regarde »*) : le bureau est dessiné en bas, le rang 1 juste au-dessus, la place 1 à droite — la grille est tournée de 180° par rapport au plan « vu du fond ». Les données ne bougent pas (`r,c` reste ce que Plan de classe exporte) ; seules les boucles de rendu descendent. Test de source : une boucle qui « a l'air à l'envers » se corrige trop facilement.

   - **Heures de vie de classe** (v1.28.0, demande de l'utilisateur : *« ce qu'on y a traité, décisions prises, thèmes à venir »*) : `cls.vieClasse`, modèle pur et testé (`hvcAdd/Set/Remove` — date valide et thème obligatoires —, `_hvcOf` récent d'abord, `_hvcPeriode` chronologique). Section 🕐 en tête de l'onglet (`_hvcHTML`, pastille `+`, formulaire en place date · thème · texte, ✏️ 🗑, `_hvcEdit` de session) ; **une date future suffit pour un thème à venir** — pas de champ d'état, la liste les met en tête avec la pastille « à venir ». La **synthèse de période** peut les porter en tête de feuille (bloc *Heures de vie de classe*, **décoché par défaut** : la feuille ne s'allonge pas sans qu'on le demande). `postLoadHook` crée la section ; la purge d'une classe l'emporte. Démo : six heures, une par mois environ.

**Impression** (`@media print`, orientation imposée avant `window.print()`) : la liste des élèves et la synthèse de période en paysage (ou en fiches portrait), la liste des manquants d'un document en portrait, le procès-verbal d'élection en portrait. ⚠️ Reprendre le bloc `@media print { html[data-theme="dark"] { … } }` : sans lui, imprimer en thème sombre pose de l'ambre sur blanc (244 écarts mesurés dans le projet de référence).

## Trier les élèves : nom, prénom, place, ordre de ramassage

⚠️ **Révisé en v1.47.0 (audit ergonomique, point C4)** : plus de menu « Trier ». **Toutes les
grilles trient par leurs EN-TÊTES** (Nom · Prénom, et les colonnes chiffrées ; re-cliquer
inverse) — `_TRIS` (un état par grille : `carnet`, `doc`, `ram`, `moy`), `triTete`,
`_triTeteHTML`, `_triNomHTML`, `_triDir`, `_triInverse` (un ordre de passage ne s'inverse
jamais). **Là où l'on marche dans les rangs — Observations (relever les carnets), Retours
(vérifier les signatures, ramasser) —** un menu **« Ordre de passage »** (`_ordrePassageHTML`,
`ordrePassageSet`) garde la place dans la salle, les ordres de ramassage et le choix de la
salle ; arbitré par l'utilisateur : *« dans l'onglet Observations et dans l'onglet Retours, il
faut que je puisse conserver un tri par motif particulier ou par position »*. Rien sans
placement. **Pas dans Moyennes** (un mode de place resté y retombe sur le nom). Ce qui suit
reste vrai du moteur (`_sortStudents`, `_sortModes`) ; *« sélecteur Trier »* s'y lit *« Ordre de
passage »*.

~~Les trois grilles (Élèves, Observations, Ramassage) partagent un sélecteur « Trier »
(`_sortPickerHTML`) et un moteur commun (`_sortStudents`).~~ Chaque écran y ajoute ses modes
propres (Δ, cumul, non rendus…) ; les modes de place et de ramassage viennent, eux, du
placement importé.

- **« Par place » se CALCULE** de la géométrie : rang par rang, de gauche à droite.
  ⚠️ Comparaison **numérique** sur le rang puis la colonne — en lexical, `'10,0'` passerait
  avant `'9,0'`, ce qui reste invisible tant qu'une salle a moins de dix rangs.
- **« Ramassage » ne se calcule PAS** : c'est une séquence de tables dessinée à la main
  dans Plan de classe, propre à chaque salle, et il peut y en avoir plusieurs (serpentin,
  deux allées, par paillasses). Rien ne la déduit — c'est un choix pédagogique, pas une
  géométrie.
- ⚠️ **Un tri ne perd JAMAIS un élève.** Ceux que la salle ou le pattern ne couvrent pas
  sont rejetés en fin de liste, alphabétiquement — jamais retirés. Un élève absent de la
  grille de ramassage est un papier qu'on ne réclamera pas. C'est l'invariant central, et
  il est testé sur tous les modes.
- Tout repli est alphabétique et silencieux : salle inconnue, salle sans placement,
  pattern inconnu, mode inconnu. Un tri ne doit jamais être une impasse.
- Les modes de place n'apparaissent au menu **que si la salle courante porte de quoi les
  calculer** : un tri offert mais sans effet fait douter de l'import plus qu'il ne sert.
- ⚠️ **Un mode de tri devient CADUC quand la salle change** (le pattern de la 102 n'existe pas au labo). Le sélecteur affiche alors « par nom » — ce que le tri fait réellement. Sans cette normalisation, le menu annonçait un ordre de ramassage pendant que la liste était alphabétique : **l'écran mentait sur ce qu'il faisait**, et on ne cherche pas la cause d'un ordre qu'on croit avoir demandé. Le mode reste mémorisé : revenir dans la salle le fait reprendre.
  ⚠️ Le test de cette garantie porte sur le **HTML produit**, pas sur le helper : `_sortModeOk` avait d'abord été écrit puis jamais branché, et un helper que rien n'appelle certifie une garantie inexistante.
- ⚠️ **Le sélecteur de salle n'est pas un ornement** : un élève n'a pas la même place d'une
  pièce à l'autre. `cls.salleCur` est la salle où l'on est entré, et c'est elle qui décide.

⚠️ **`_purgeStudentRefs` doit vider les places.** Un élève supprimé qui reste assis
réapparaît en tête de la grille triée par place, sous forme d'un id que plus rien ne
nomme. Le test balayant le voit — vérifié en cassant la purge exprès.

## Grilles : première ligne et première colonne figées

Les quatre grilles à élèves en lignes (Élèves, Observations, tableau d'un document,
Ramassage) défilent dans leur **propre cadre** (`.rel-wrap.frozen`), borné à la hauteur qui
reste sous le bandeau : l'en-tête reste en haut, la colonne des noms reste à gauche, comme
dans le tableur qu'elles remplacent (demande de l'utilisateur, 2026-09-11).

- ⚠️ **`table.dt` portait `overflow: hidden`** (pour rogner ses coins arrondis) — et un
  `overflow` autre que `visible` fait d'un élément un conteneur de défilement, tableaux
  compris depuis que les navigateurs le leur appliquent. Un `sticky` posé sur une cellule
  collait donc au TABLEAU, qui ne défile jamais, et non au cadre : **la colonne de noms
  « collante » des carnets et du ramassage ne collait pas** — depuis la v1.1.0, sans que
  personne ne le voie, parce qu'à 1400 px de large les grilles tiennent sans défiler.
  Mesuré : en-tête à −198 px après 300 px de défilement. → `.rel-wrap table.dt { overflow:
  visible }` ; les coins ne sont plus rognés, c'est le prix d'une colonne qui colle vraiment.
- ⚠️ **Un `sticky; top: 0` ne suffit pas.** `overflow-x: auto` fait de `.rel-wrap` un
  conteneur de défilement dans les DEUX axes, hauteur bornée ou non : l'en-tête collait à un
  cadre qui ne défilait jamais verticalement, c'est-à-dire à rien. Borner la hauteur
  (`max-height` calculé sur `--topbar-h`) est ce qui rend la ligne figée réelle.
- ⚠️ **Un cadre neuf repart en haut à gauche.** Chaque saisie re-rend la grille, donc
  remplace le cadre — et la cellule qu'on vient de taper sortait de l'écran. `_wrapScrollKeep(el)`
  mémorise la position avant `innerHTML` et la repose après, **si le cadre neuf porte le
  même tableau** (l'onglet Documents en rend trois dans le même conteneur). Test statique :
  tout `rel-wrap frozen` est encadré par `_wrapScrollKeep` / `keep()`, avec son méta-test.
- `--topbar-h` est **mesurée** (`_topbarMeasure`, `ResizeObserver` sur `#topbar`) : le
  bandeau fait 101 px à 1200 px de large, 184 à 700, 303 à 320 — une valeur figée laissait
  soit un trou, soit un cadre qui déborde sous le pli. Déclarée dans `:root` en repli,
  sans variante sombre ni impression : ce n'est pas une couleur.
- `scroll-margin` sur les champs : une cellule amenée au focus par Entrée ou les flèches
  ne doit pas atterrir SOUS la ligne ou la colonne figée.
- Sur le papier, le cadre ne borne rien (`max-height: none` dans `@media print`).

## Import des élèves — deux voies

### 1. CSV / tableur (voie principale)

Module repris intégralement. À adapter :
- **Retirer** de `_IMP_FIELDS` ce qui n'a pas de sens ici (rien à retirer d'urgent : tous les champs importés existent dans `stu`).
- **Retirer** tout le volet « salle des nouvelles classes » (`_impRoomChoiceHTML`, `_impDefaultRoomChoice`, `_impSetRoom`) — il n'y a pas de salle.
- **Garder** le panneau « Codes de groupes rencontrés » : c'est lui qui transforme `4B-LATIN` en tag `LATIN`.
- **Garder** le décodage **UTF-8 strict puis repli Windows-1252** (`_impFileSelected`) : les exports Pronote/SIECLE sont en 1252 et « Léa » devient « LÃ©a » sans ce repli.
- **Garder** la création des classes inconnues (`_impClassIdFromLabel` : « 5ème C » → `5C`, libellé complet conservé comme nom).

### 2. Export JSON de Plan de classe

`importFromPlanDeClasse(json)` : lit un `plan-classe-*.json`, ne prend que `classes` (id, nom, année, roster) et `eleves` (identité, civilité, groupe, tags, aménagements, dates d'arrivée/départ), **ignore tout le reste** (salles, sièges, tablettes, évaluations, appels…).

- ⚠️ **Lecture seule et à sens unique.** Aucune écriture vers le fichier de Plan de classe, aucun couplage de format : les deux apps évoluent séparément, et la seconde ne doit jamais dépendre d'un champ interne de la première. Passer le JSON par une **liste blanche explicite** des champs repris, pas par une copie d'objet.
- ⚠️ **Les ids d'élèves sont conservés** quand on importe depuis Plan de classe — c'est ce qui permet de réimporter plus tard sans créer de doublons, et de reconnaître un élève déjà présent. La détection de doublon garde en plus le filet nom+prénom+classe (sans accents ni casse) du module CSV.
- Les tags de Plan de classe (`S.tags`) portent `{id, abbr, name, color}` : reprendre le catalogue en même temps que `stu.tags`, sinon les tags arrivent sans libellé.
- **Salles, places et patterns** (depuis le 2026-09-09) : liste blanche `{nom, rows, cols, collectPatterns}` — ni cases vides, ni îlots, ni emplois du temps, ni tablettes. Un champ repris « au cas où » est un champ dont personne ne sait plus, six mois après, s'il est à jour.
  - ⚠️ **Les ids de salle sont PRÉFIXÉS `pdc_`.** Plan de classe les nomme `s1`, `s2` — des compteurs locaux, sans unicité entre deux fichiers d'origines différentes. Sans préfixe, la « Salle 102 » d'un collègue écraserait la nôtre au premier import croisé.
  - ⚠️ Le placement vit dans `cls.rooms[salleId].seating`. `cls.seating`, là-bas, est un **accesseur non énumérable** qui redirige vers la salle active : il n'existe pas dans le JSON, et le chercher ne donnerait rien.
  - Une place occupée par un élève qu'on n'a pas repris est **écartée** — sinon `_auditState` signalerait à juste titre un élève fantôme assis.
  - Réimporter **met à jour** : la salle homonyme et le placement sont remplacés, pas empilés. C'est LE chemin de mise à jour des places — 💾 Données et réglages → 🪑 Depuis Plan de classe. Depuis la v1.15.0, on peut aussi corriger sur place (éditeur de salles) — l'import écrase alors la correction, et l'écran le dit.
  - ⚠️ **Une case VIDE dans Plan de classe ne vide PAS celle d'ici** (v1.41.1 — défaut remonté
    par l'utilisateur : *« un import depuis Plan de classe a-t-il pu effacer toutes les dates
    de naissance saisies à la main ? »* — oui : la liste blanche écrivait `null` quand la
    source n'avait pas la valeur). Pour `naissance`, `arrivalDate`, `departureDate` et
    `civilite` : la valeur de la source si elle en a une, sinon celle d'ici est gardée et
    comptée (`stats.gardes`, dit au compte rendu). Groupe, options et aménagements restent
    RÉÉCRITS (c'est documenté et l'écran le dit). **Un point nommé** (`avant-import-plan-de-classe`)
    est écrit avant chaque import quand un dossier de sync est choisi ; s'il échoue, rien n'est
    importé. **Pour réparer** : 💾 Données → *🩹 Récupérer des dates…* relit une ancienne
    sauvegarde (export, `suivi-pp-bk-*`, point nommé) et ne remplit QUE les champs vides
    aujourd'hui (`_recupChamps`, pur : élève par id, sinon classe + nom + prénom sans accents),
    après une confirmation qui liste ce qui sera rempli ; un cran d'undo.
  - ⚠️ L'écran de choix **annonce le placement AVANT l'import** (« 🪑 25 places · 1 ordre de ramassage », ou « aucun placement »), et le compte rendu le confirme après. Sans ce repère, un export fait sans avoir placé personne donne un import qui ne change rien, et on cherche pourquoi.

## Sauvegarde, sync, stockage

Reprendre l'architecture de Plan de classe **sans la simplifier** — chaque pièce répond à un incident vécu :

- `localStorage` pour les données (`suiviPP_v1`), écrit à chaque `save()`, **synchrone** (un `beforeunload` doit pouvoir persister les dernières frappes).
- **Sync auto** vers un dossier Nextcloud académique (`nuage03.apps.education.fr`) via File System Access API, debounce 5 s, handle persisté en IndexedDB.
- **Horloge vectorielle** (`S.clock`) pour classer la version disque : `equal` / `ahead` / `behind` / `diverged`. ⚠️ **Ne pas retomber sur une comparaison de `lastModified`** : Nextcloud retouche le mtime sans changer le contenu, ce qui produisait un flot de faux conflits.
- **Résolution de conflit non destructive** : les deux issues archivent l'autre version dans un fichier avant d'écrire. ⚠️ **Si l'archivage échoue, la résolution est annulée** — jamais d'écrasement sans copie.
- **Backups horodatés** avec rotation par paliers (10 min < 1 h, 1 h < 48 h, 1 j < 14 j, 1 sem < 120 j) + dédup par empreinte de contenu, et **checkpoints nommés** avant une opération risquée.
- **Copie du dernier fichier chargé dans IndexedDB, pas dans `localStorage`** : elle y doublait l'occupation (mesuré 1,07 Mo + 1,07 Mo chez l'utilisateur, soit le plafond de son navigateur atteint en fin d'année).
- **Jauge d'occupation** dans la modale ⓘ : capacité **mesurée** par sonde dichotomique, pas supposée. ⚠️ `navigator.storage.estimate().usage` **ne compte pas `localStorage`** — s'en servir affichait « 2 Ko » à côté d'un mégaoctet réel.
- ⚠️ **Compression écartée sciemment** : `CompressionStream` est asynchrone alors que `beforeunload` appelle `save()` de façon synchrone, et un seul octet altéré détruit un fichier gzip entier là où un JSON en clair reste réparable à la main.

**Volume attendu ici : très faible** — une classe de 25 élèves, une dizaine de relevés, une dizaine de documents. Quelques dizaines de kilo-octets. Le dispositif complet n'en est pas moins justifié : c'est le filet de sécurité, et une donnée de PP perdue (retours de fiches d'orientation) ne se reconstitue pas.

## Design system

**Polices : Andika à l'écran, Latin Modern Roman au papier — chacune au choix** (v1.35.0
pour le papier, v1.37.0 pour l'écran et les réglages ; demandes de l'utilisateur : *« j'aime
bien que les documents soient imprimés avec la police Latin Modern »*, puis *« la police
d'affichage du site sera Andika, avec possibilité de choisir Latin Modern dans les réglages
— et le même choix pour l'impression, Latin Modern par défaut »*).
- Deux familles embarquées en base64, quatre variantes chacune, sous-ensemble latin
  (Andika 72 Ko, Latin Modern 84 Ko), **régénérées par `scripts/gen_fonts.py`** (entre les
  marqueurs `/* ANDIKA-DEBUT */…` et `/* LM-DEBUT */…`). Andika : SIL OFL 1.1 ; Latin
  Modern : GUST Font License.
- Tokens : `--font-andika`, `--font-lm` ; `--font-ui` (écran, Andika) et `--font-print`
  (papier, Latin Modern). `--font-sans` et `--font-serif` — les noms que tout le CSS emploie
  — **suivent `--font-ui`**, titres compris. Le choix est posé sur `<html>` par
  `_applyPolices()` (`data-police="lm"`, `data-police-papier="andika"`) depuis
  `S.prefs.policeEcran` / `policePapier` ; appelée en fin de `postLoadHook` (donc après
  chargement, undo, sync) et par `setPref`. Une valeur inconnue retombe sur le défaut.
- ⚠️ **Fraunces et IBM Plex Sans ont été RETIRÉES** (v1.37.0) : les polices du design repris
  de Plan de classe, que plus rien n'utilisait, pesaient 430 Ko. **JetBrains Mono reste** pour
  les chiffres des grilles (chasse fixe : les colonnes de nombres s'alignent).
- `.print-area *` et le PV prennent `--font-print` en `!important` (les cellules portent des
  styles en ligne à l'écran).
- ⚠️ Les polices doivent être **chargées avant toute mesure** (`_printFontLoad`, qui charge
  les DEUX familles : au démarrage, à l'ouverture des modales d'impression, avant
  `window.print`) : une police `swap` ne se charge qu'au premier usage, et une mesure faite
  avec la police de repli choisirait une taille fausse. Changer la police du papier change
  la taille calculée des feuilles « une page ».
- Audit v1.37.0 : 44 états (6 onglets + 5 modales, 2 polices × 2 thèmes) à 1 400 px et 22 à
  320 px, **0 défaut** (contraste, débordement, texte tronqué, erreurs JS) — Andika est plus
  large qu'IBM Plex, et c'est le débordement qu'il fallait surveiller.

**Tous les tableaux imprimés ont le même visuel** (v1.37.0, *« fais pareil pour tous les
tableaux imprimés »*) : `.print-t` (retours d'un document, grille élèves × documents, bilans
en pied, ancienne feuille) reprend celui de `.pp-t` — en-tête grisé souligné de noir et
**répété à chaque page**, filets horizontaux, une rangée sur deux grisée
(`print-color-adjust: exact`, sans quoi le navigateur retire les fonds), aucune rangée
coupée. Le **PV** garde son quadrillage complet (pièce signée) et prend en-tête gris et
rangées alternées. Test statique `test/polices.test.js`, avec son méta-test.

Reprendre le design « carnet du prof » **à l'identique** : tokens, polices embarquées, filet rouge de marge, lignes Seyès, thème sombre, bloc de neutralisation à l'impression.

⚠️ **Les quatre règles qui ont coûté le plus cher dans le projet de référence :**

1. **Tout token de couleur se déclare à TROIS endroits** : `:root`, `html[data-theme="dark"]`, et le bloc `@media print { html[data-theme="dark"] { … } }`. Un token oublié dans le troisième s'imprime en couleurs de nuit sur papier blanc.
2. **Un fond clair posé pour le mode clair a besoin d'une variante sombre** — pas seulement d'une encre adaptée. Un pastel laissé tel quel fait un trou de lumière dans le bleu nuit.
3. **Un accent utilisé en FOND et en TEXTE a besoin de deux valeurs** (`--x-bg` et `--x-fg`) : l'arbitrage s'inverse avec le thème.
4. **Jamais `color:#fff` en dur sur un fond coloré** — surtout pas sur une couleur choisie par l'utilisateur (les couleurs d'options de documents le seront). Toujours `_contrastTextColor(bg)`, qui tranche par contraste WCAG réel via `_wcagContrast`.

**Méthode d'audit du contraste** (à rejouer après toute retouche de couleur) : injecter un auditeur qui parcourt le DOM, calcule le fond effectif en remontant les parents transparents et l'opacité cumulée, puis le contraste de chaque nœud portant du texte propre. Seuil 4,5:1 (3,0 pour le grand texte). Quatre conditions sans lesquelles la mesure ne vaut rien :
- **des données partout** — un onglet vide passe pour un onglet propre ;
- **les sous-états** autant que les onglets ;
- **les modales**, statiques (forcer la classe `on`) comme dynamiques (par leur vrai ouvreur) ;
- **transitions neutralisées** (`*{transition:none!important;animation:none!important}`) — une puce saisie à mi-parcours produit de faux écarts.

## Conventions de développement

- **L'app VOUVOIE l'utilisateur** (v1.47.2, audit ergonomique) : « Choisissez », « votre bilan »,
  « Cochez ». Les tournures en « on » restent. Le code repris de Plan de classe tutoyait : tout
  texte affiché nouveau ou repris se met au vouvoiement.

- **Tout dans un seul fichier HTML.** CSS dans le `<style>` de tête, JS dans le `<script>` de fin de body. **Aucune dépendance externe**, aucun CDN — l'app doit fonctionner hors-ligne, en `file://` comme en HTTPS.
- **`pushUndo()` AVANT toute mutation**, jamais après (sinon l'undo capture le mauvais état). Pour une **saisie continue** (cumul d'un relevé qu'on tape, cases d'un ramassage qu'on coche), utiliser le motif `_evalArmUndo()` de la référence : un snapshot par salve de frappe, verrou libéré 2 s après la dernière mutation, sinon la pile d'undo sature.
  ⚠️ **Tout verrou de salve se désarme dans `_applyReloadedData`.** Un verrou encore armé après un rechargement de sync fait SAUTER le `pushUndo()` de la mutation suivante — laquelle porte sur l'état fraîchement rechargé, jamais capturé, et le Ctrl+Z ne remonte plus. `_relUndoArmed` y était ; `_ramUndoArmed`, ajouté plus tard, avait été oublié. Le désarmement n'est pas une précaution décorative : c'est la condition pour que la règle ci-dessus tienne encore après une synchronisation.
  ⚠️ Et **armer la salve seulement une fois la mutation certaine** : armer puis renoncer pose un snapshot sans mutation, et le premier Ctrl+Z ne fait rien de visible.
- **Zéro dialogue natif.** Ni `alert`, ni `confirm`, ni `prompt` : l'anti-popup du navigateur les bloque silencieusement et le bouton paraît cassé. Utiliser `_uiConfirm`, `_uiPrompt`, `appAlert`, ou `toast(msg, 'warn')` pour une précondition non bloquante. ⚠️ `_uiConfirm` **n'est pas bloquant au sens JS** : tout ce qui suivait le `confirm()` va dans `onOk` / `onCancel`.
- **Échappement au rendu**, systématique : `_escName` / `_escAttr` pour toute donnée utilisateur injectée en `innerHTML`, `_escJsAttr` pour un texte passé à un handler inline (le navigateur HTML-décode l'attribut **avant** de parser le JS, donc `_escAttr` seul laisse un breakout), `_csvCellGuard` avant tout quoting de cellule exportée (une cellule commençant par `=` `+` `-` `@` est une formule à l'import tableur). Préférer le template balisé `_html` pour le code neuf.
- **CSP en `<meta>`** dès le premier commit : `connect-src 'self' https://api.github.com`, `img-src 'self' data: blob:`, et ⚠️ **`font-src 'self' data:`** — sans lui, `default-src 'self'` bloque les trois polices embarquées en base64 et l'app retombe en silence sur les polices système. Depuis la v1.13.0, **`frame-src blob:`** (et non plus `'none'`) : le lecteur de PDF intégré encadre un blob créé par la page elle-même — une URL de blob est liée à son origine, rien d'extérieur ne peut y être encadré.
- **États vides actionnables** : un état vide dit QUOI faire. Reprendre `_emptyStateHTML(icon, titre, hint)`.
- **Retour de modale** : `_modalReturnTo[id]` pour qu'un panneau ouvert en parenthèse (réglages d'un document depuis son tableau) revienne d'où il vient, sur les trois voies de fermeture (bouton, fond, Échap).
- **Auto-focus et Entrée** : chaque modale à formulaire porte `data-autofocus` sur son premier champ utile et valide à `Entrée`. Sans `data-autofocus`, `openMod` focalise la boîte `.mb` elle-même — sinon le focus reste **derrière** la modale et le piège à focus ne s'enclenche jamais.
- **Pas de conception 100 % clavier**, mais les **raccourcis existants ne se cassent pas** : `Échap`, `Ctrl+Z` / `Ctrl+Y`, `Ctrl+P`, validation à `Entrée`. ⚠️ Le garde de `Ctrl+Z` doit tester la **saisie de texte** (`_isTextEntryTarget`), pas `tag === 'INPUT'` : une case à cocher garde le focus sans avoir d'undo natif, et le raccourci y devenait muet.
- Pour un développement long : travailler sur une copie `suivi pp new.html`, puis remplacer une fois validé.

### ⚠️ Champs `<input type="date">` — l'année telle que tapée

Un champ date livre l'année **exactement comme elle est saisie** : taper « 21 / 05 / 13 »
produit `0013-05-21`, pas `2013-05-21`. La date est alors rejetée comme illisible — juste
après que l'utilisateur a correctement saisi le jour et le mois, et le message l'accuse
d'une faute qu'il n'a pas commise. Sur une saisie en série de vingt-cinq dates de
naissance, c'est vingt-cinq fois.

⚠️ **Et la correction n'est pas que dans le calcul : elle est dans le MOMENT.** Un champ
date devient « complet » dès le premier chiffre d'année tapé, et `change` part avec l'an
0001. Normaliser et réécrire le champ à cet instant **remet le segment année à zéro** :
taper « 1 » puis « 3 » donnait alors 2001 puis 2003 au lieu de 2013. On attend donc que le
champ soit **quitté** (`blur`, ou `change` reçu alors qu'il n'a plus le focus) pour
normaliser, enregistrer et réafficher. Un test qui ne vérifierait que `_ymdCompleteAnnee`
passerait sans rien garantir — celui qui compte pilote `document.activeElement`.

⚠️ **Et on n'ouvre JAMAIS le sélecteur natif (`showPicker`) en arrivant sur le champ
suivant.** Posé en croyant aider au tactile — où il ne sert à rien, toucher un champ date
ouvrant déjà le sélecteur — il affichait le calendrier par-dessus le clavier : il fallait
une seconde frappe d'Entrée pour le refermer avant de pouvoir taper. Vingt-cinq frappes
perdues sur une classe. Un test de source l'interdit pour qu'on ne le « répare » pas une
troisième fois.

`_ymdCompleteAnnee(v)` complète les années à **deux** chiffres : `20xx`, ou `19xx` si
`20xx` tombait dans le futur (personne n'est né l'an prochain). ⚠️ **Trois chiffres ne se
devinent pas** — « 202 » peut être 2020 saisi trop vite, 1202 ou 0202 : deviner écrirait
une date fausse sans que rien ne le signale. Appelé sur toute date saisie à la main
(naissance dans la liste et dans la fiche, date de relevé, date de contact) ; **tout
nouveau champ date se branche là**.

### Invariants de fiabilité

- **Suppression d'un élève = `_purgeStudentRefs(sid)`, source unique de vérité.** Ici : le roster de sa classe, `releve.counts[sid]` de tous les relevés, `doc.retours[sid]` de tous les documents. Les incidents (`stu.incidents`) partent avec l'élève ; leurs PDF restent dans le dossier des pièces jointes — l'app n'efface jamais un fichier d'elle-même, 🧹 Orphelins… dans Données les liste. ⚠️ **Les élections sont une EXCEPTION assumée**, comme les appels de Plan de classe : un procès-verbal signé est un document historique, on n'en retire pas un candidat parce qu'il a changé d'établissement en mars. `election.candidats[].sidTitulaire` et `assesseurs` survivent donc — à déclarer dans les exceptions du test de balayage, avec cette justification. Corollaire : l'élection doit porter l'**identité minimale** (nom, prénom) de ses candidats et assesseurs, sinon le PV devient illisible après suppression (même raisonnement que `attRecord.eleves` là-bas). ⚠️ **Tout nouveau champ indexé par sid se purge LÀ**, ou s'ajoute aux exceptions du test de balayage avec sa justification écrite.
  Depuis la v1.32.0, la purge retire aussi `notes[sid]` et `generale[sid]` de **chaque import de moyennes** — ce qui change les statistiques des imports passés, et c'est voulu : on SUPPRIME un élève qui n'aurait jamais dû être là (doublon, erreur d'import) ; un élève PARTI n'est pas supprimé et garde ses moyennes.
- **Suppression d'une classe = `_purgeClassRefs(classId)`** : `S.releves[classId]`, `S.elections[classId]`, `S.moyennes[classId]`, retrait de `doc.classIds` (et suppression du document s'il ne concerne plus aucune classe vivante), suppression de ses élèves.
- **`_validateImport`** : liste blanche des sections de `S`, rejet explicite de `__proto__` / `constructor` / `prototype` par un scan récursif des clés. ⚠️ Ajouter une section à `S` impose de l'ajouter à cette liste.
- **`_sanitizeCoreSections()` en tête de `postLoadHook`** : une section absente ou du mauvais type est recréée, une entrée non-objet est supprimée avec un `console.warn`. ⚠️ Une exception dans `postLoadHook` interrompt le chargement et laisse un état à moitié migré, **sans message** : toute migration doit supposer que sa section peut manquer.
- **Gestionnaire d'erreurs global** (`window.onerror` + `unhandledrejection`) → toast discret + journal `window.__suiviPPErrors`. Rend visibles les pannes que les `catch {}` avalent.

### Tests (`test/`, `npm test`)

Reprendre `test/harness.js` : il extrait le gros `<script>` inline, le charge dans un contexte `vm` avec un DOM stubé, neutralise `init()` et expose `__TESTEVAL(code)` pour exécuter du code dans la portée lexicale du script. **Aucune dépendance**, Node ≥ 18.

Familles à couvrir dès le début :
- **Calcul des deltas et des totaux de période** — le cœur métier : cumuls, `'A'` intercalé, vides, cumul décroissant, premier relevé, changement de période.
- **Dépouillement et attribution des sièges** — l'autre cœur métier, et le plus piégeux : exprimés comptés en bulletins et non en voix, majorité absolue strictement supérieure à la moitié (13 sur 24, pas 12), un seul siège pourvu au premier tour, égalité sur le dernier siège, blancs et nuls hors dénominateur, bulletin nul portant des noms valides. **Écrire ces tests avant la grille.**
- **État intermédiaire de la projection** — c'est du calcul pur, donc testable sans DOM, et personne ne le vérifiera à la main devant une classe : `voix × 2 > votantsAnnonces` déclenche « déjà élu » et rien d'autre ne le déclenche · le pourcentage porte bien sur les bulletins dépouillés et non sur `votantsAnnonces` · **un cas où le pourcentage d'un candidat baisse pendant que ses voix montent** (le comportement contre-intuitif doit être figé par un test, sinon quelqu'un le « corrigera » un jour) · seuil de majorité qui descend à l'arrivée d'un blanc · aucun « éliminé » émis en cours de route.
- **Purge en cascade** — deux versions : la liste énumérative, **et** un test *balayant* qui monte un état maximal, supprime, puis cherche le moindre reste dans `JSON.stringify(S)`. Le second est le seul qui voit un champ **nouveau**.
- **Rétrocompatibilité** — une fixture JSON par changement de modèle, rejouée par le chemin d'import complet. ⚠️ **Ne jamais régénérer une fixture existante** : elle fige un état historique, c'est sa valeur.
- **Fuzz** — mutations reproductibles (graine fixe) d'une fixture réelle : le chemin d'import doit **refuser ou aboutir**, jamais lever.
- **Sync deux postes** — deux sandboxes, deux `localStorage`, deux `_DEVICE_ID`, et la classification vérifiée à chaque étape jusqu'à la résolution de conflit.
- **Lint anti-XSS** — échec si un champ de donnée utilisateur (`nom`, `prenom`, `titre`, `label`, `remarque`…) est interpolé en clair dans une ligne contenant un fragment HTML.
- ⚠️ **Chaque test balayant porte un méta-test** qui injecte un cas volontairement fautif et vérifie que le détecteur le voit. Sans lui, une régression du parcours rend la suite silencieusement vacante — pire que pas de test.

⚠️ `node --test` exécute **tout** `.js` sous `test/` : un utilitaire y passerait pour un test en échec. Les scripts vont dans `scripts/`.

## État de la construction

| # | Étape | État |
|---|---|---|
| 1 | Squelette : design system, CSP, `S`, sauvegarde locale, horloge vectorielle, undo, modales, nav 6 onglets, export/import JSON, harnais + 27 tests | ✅ **fait** (2026-09-09, v0.1.0) |
| 2 | Onglet Élèves + import CSV / Pronote, gestion des classes et du catalogue d'options, 35 tests de plus | ✅ **fait** (2026-09-09, v0.2.0) |
| 3 | Import depuis un export JSON de Plan de classe, avec **choix de la classe** ; réglage semestre/trimestre + code absent dans Données | ✅ **fait** (2026-09-09, v0.3.0) |
| 4 | Onglet Carnets : calcul pur (`_relDelta`, `_relPeriodTotal`, `_periods` avec bornes réglables) testé AVANT la grille, grille avec saisie clavier, undo par salve, modale nouveau/modifier/supprimer | ✅ **fait** (2026-09-09, v0.4.0) |
| 5 | Onglet Documents : calcul pur (`_docStats`, `_docExpected`, `docDuplicate`, `_champParseOptions`) testé avant l'UI, liste + tableau des retours, éditeur de champs, liste des manquants, 3 modèles | ✅ **fait** (2026-09-09, v0.5.0) |
| 6 | Onglet Délégués : arithmétique testée avant tout (21 tests), grille de dépouillement, graphique deux volets + mode projection, clôture / second tour / départage manuel, PV imprimable, `_delegueOf` dérivé | ✅ **fait** (2026-09-09, v0.6.0) — fenêtre détachée faite en v1.52.0 (une fenêtre ordinaire, pas PiP) |
| 7 | Onglet Synthèse (`_syntheseRow` pur, testé) + impressions par pages nommées (synthèse paysage, manquants et PV portrait), Ctrl+P contextuel | ✅ **fait** (2026-09-09, v0.7.0) |
| 8 | Sync auto (debounce 5 s, mutex, reprise), horloge vectorielle en service, conflits non destructifs + snooze archivé, backups à rotation par paliers, checkpoints nommés, IndexedDB (handle + copie du dernier fichier), jauge de capacité mesurée | ✅ **fait** (2026-09-09, v0.8.0) |
| 9 | Données de démo : `createDemo()` posée au 1er lancement (25 élèves, 8 relevés, 6 documents, 2 élections), `_demoBulletins` pur et testé, boutons « charger la démo » / « tout effacer » avec point nommé + undo | ✅ **fait** (2026-09-09, v0.9.0) |
| 137 | **Carte de chaleur : une case d'incidents propose ses incidents ou un nouveau** (`chaleurIncidentsUI`, case vide = la saisie directement) · **une case d'avis, sa case repliée et le compteur n/N des Indicateurs ouvrent la lecture des avis** (`openAvisLire(vue, campId)`) ; 1 test, 1 test adapté. Vérifié dans le navigateur, audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-04, v1.55.3) |
| 136 | **Formulaire de nouvelle feuille : les choix restent** quand il se redessine (⭐ un élève, une colonne, une matière rattachée) — l'objectif repassait en « conseil de classe », la période, le mois et les disciplines décochées revenaient au défaut (`_avisNouvelleEtat` / `_avisNouvelleRemettre`) ; 1 test. Vérifié dans le navigateur | ✅ **fait** (2026-10-04, v1.55.2) |
| 135 | **Lien de partage demandé APRÈS la création** : plus de champ dans le formulaire de création ; encadré « 🔗 Étape suivante : partager la feuille » (comment faire dans le Nuage, champ du lien) tant que la feuille n'a pas de lien, amené à l'écran après la création ; 1 test. Vérifié dans le navigateur (création, lien refusé puis accepté, Ctrl+Z), audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-04, v1.55.1) |
| 134 | **Créer la feuille d'avis** depuis l'app (boîte « Enregistrer sous », `showSaveFilePicker`) avec un **nom logique** proposé (classe, objectif, période, année), qui suit les réglages tant qu'on ne l'a pas réécrit ; « Choisir une feuille existante » reste ; le téléchargement prend le même nom ; 1 test. Vérifié dans le navigateur (fichier OPFS écrit et relu), audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-04, v1.55.0) |
| 133 | **Lire les avis des collègues** : fenêtre `mavislire`, trois vues (une discipline, un élève, une case) ouvertes depuis la grille « Qui a écrit sur qui » (en-tête, case, total de la ligne, pied) et le tableau des disciplines, ◀ ▶ pour enchaîner ; 1 test, 1 test adapté. Audit 2 thèmes, 1 570 et 320 px, 0 défaut | ✅ **fait** (2026-10-04, v1.54.0) |
| 132 | **Audit complet après la salve des élections** : 56 états × 2 thèmes × 2 largeurs (1 570 et 320 px, ≈ 100 000 nœuds), dix feuilles imprimées depuis les deux thèmes, scénario d'élection de bout en bout (nom écrit, acceptation, deux sièges, second tour, scrutin du suppléant). Quatre défauts corrigés : Δ illisible sur les deux derniers paliers du carnet imprimé (2,2:1), tiret « sans objet » de la grille imprimée à 4,48:1, **suppléant posé après le vote affiché comme s'il était sur le bulletin** (PV, candidatures, graphique), « Sont élus » au-dessus d'un seul élu ; auditeur : mode `papier` ; 2 tests | ✅ **fait** (2026-10-04, v1.53.2) |
| 131 | **Sources hors Légifrance liées** (justice.fr, circulaire de 2004, service-public, académie de Versailles) dans les modalités, la question d'acceptation et le bureau de vote ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.53.1) |
| 130 | **Un siège après l'autre** (défaut, R421-28 ; « les sièges ensemble » au choix) · **candidats du second tour** au choix (tous, au-dessus d'un % des exprimés à défaut les x premiers, les x premiers) ; démo ; 2 tests, 2 tests adaptés. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.53.0) |
| 129 | **Accord en genre dans les élections** (civilité figée sur la candidature, forme inclusive sans civilité) · **projection d'un scrutin de suppléant : « Suppléant(e) élu(e) »** ; 2 tests, 5 tests adaptés | ✅ **fait** (2026-10-03, v1.52.13) |
| 128 | **Président du bureau au choix** (PP, CPE, élève non candidat, autre adulte) ; signe le PV à ce titre ; fiche de l'élève ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.52.12) |
| 127 | **Assesseurs saisis dans l'élection, après les candidatures** (plus dans ⚙ Modalités) ; non candidats ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.52.11) |
| 126 | **PV : titulaire et suppléant groupés** dans un cadre par binôme ; test étendu | ✅ **fait** (2026-10-03, v1.52.10) |
| 125 | **PV sur une page** (taille mesurée, 7 à 11 pt) **et signature des élus** (acceptation du mandat) ; 1 test, 1 test adapté. Mesuré sur la démo : 255 mm en 8,25 pt | ✅ **fait** (2026-10-03, v1.52.9) |
| 124 | **Départage par l'âge justifié** : dates de naissance des candidats à égalité au PV, à la projection du résultat et dans l'onglet ; 1 test. Audit dans la fenêtre projetée, 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.52.8) |
| 123 | **Scrutin du suppléant : les élus de l'élection d'origine ne sont plus proposés** (ni candidats, ni nom écrit ; refusés par le modèle) ; 1 test | ✅ **fait** (2026-10-03, v1.52.7) |
| 122 | **Suppléant élu par un scrutin** : guidage et bouton grisé ; **scrutin tenu dans l'app** (élection rattachée, élu reporté à la clôture, jamais prise pour l'élection des délégués, PV propre et cité dans celui d'origine) ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.52.6) |
| 121 | **Bulletins préparés d'après le compte de l'urne** (lignes « à lire », qui ne comptent qu'une fois lues ; Entrée ou Blanc = blanc ; clôture refusée tant qu'il en reste) ; démo ; 1 test, 2 tests adaptés. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.52.5) |
| 120 | **Suppléant d'un élu non candidat** : aucun, élu ensuite par un scrutin, ou désigné par l'élu ; dit au PV ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.52.4) |
| 119 | **Élu non candidat** : modalité « compte / bulletin nul » (compte par défaut), acceptation demandée à la clôture, refus = siège au suivant ; 2 tests. Audit de la question et des modalités, 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.52.3) |
| 118 | **Vie de classe : barre de l'élection, ligne des candidats et graphique collés au défilement** · **nom écrit sur un bulletin** (non candidat, sans suppléant) · **pas de filet rouge à l'écran projeté** ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.52.2) |
| 117 | **Résultat final dans la fenêtre détachée** (élus, tours, majorité relative au second tour ; sans les remplacements) ; 1 test. Audit dans la fenêtre, 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.52.1) |
| 116 | **🖥 Fenêtre détachée du dépouillement** (pour le second écran : plein écran, suit chaque bulletin, Ctrl+Z depuis elle, repli si bloquée) ; 2 tests (`test/projection-fenetre.test.js`) | ✅ **fait** (2026-10-03, v1.52.0) |
| 115 | **Photos dans les grilles des observations et des moyennes** ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut ; saisie au carnet vérifiée | ✅ **fait** (2026-10-03, v1.51.3) |
| 114 | **Photos dans la vue Indicateurs** (vignette partagée avec la carte de chaleur) ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.51.2) |
| 113 | **Photos dans la carte de chaleur** : une vignette devant chaque nom, case vide sans photo, rien sans aucune photo ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.51.1) |
| 112 | **📷 Trombinoscope** : troisième affichage de la liste des élèves (photos, initiales sans photo, clic vers la fiche) et troisième choix de 🖨 Imprimer… (4 à 6 par rangée, une page A4 pour 25 élèves) ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut ; papier simulé | ✅ **fait** (2026-10-03, v1.51.0) |
| 111 | **Un seul « 🖨 Imprimer… » dans Élèves** : la liste du jour ou la synthèse d'un moment (tableau ou fiches), A3 pour la liste ; **« résumés » supprimés** ; Ctrl+P ouvre la fenêtre ; tests portés sur la fiche imprimée. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.50.0) |
| 110 | **🖨 Fiche élève imprimée** : bouton dans la fiche et Ctrl+P (fenêtre `mficheprint` : moment, parties, photo, cet élève ou toute la classe, A4 / A3), une page par élève, bilan vide en lignes à remplir ; forme « fiche complète » dans la synthèse de période (« fiches » renommée « résumés ») ; 3 tests (`test/fiche-print.test.js`). Audit 2 thèmes, 1 440 et 320 px, 0 défaut ; papier simulé depuis les deux thèmes | ✅ **fait** (2026-10-03, v1.49.0) |
| 109 | **📷 Photos des élèves** (repris de Plan de classe) : import du trombinoscope PDF de MBN (lecteur PDF sans bibliothèque, appariement des noms, rattachement manuel), photos dans `photos/` du dossier des pièces jointes, case photo dans la carte Identité (fichier, glisser, Ctrl+V, 📋 Coller, retrait), vignette dans l'en-tête de la fiche, aperçu au survol des noms, orphelines dans 🧹 Orphelins… ; 7 tests (`test/photos.test.js`). Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.48.0) |
| 108 | **Second audit ergonomique (D1–D8)** : **incident et bilan s'ouvrent par-dessus la fiche** (`_ficheRedessine`) · groupe Bilans de la carte de chaleur = moments de « Synthèse pour » · **synthèse de période par MOMENT** (un menu `mper-moment` des moments de « Synthèse pour », feuille bornée à lui par `_ficheBornes`, son bilan et ses décisions ; `_periodeSynthese(…, { col })`, sans `col` la période entière comme avant ; dates à partir du 1er septembre ; consigne mise à jour) · 🗑 dans la fenêtre d'incident · imports en « 📥 Importer … », vue « ▦ Tableau » des moyennes · plus aucun ✏️ ni 🗑 sans texte (classes, options, salles, instances, disciplines, vie de classe, contacts…) · un seul style de ✎, ✎ sur Entrée et Sortie · « 1 blanc · 2 nuls » (`_pl`) · ♂ ♀ dans l'en-tête de la fiche ; 1 test. Audit 10 états × 2 thèmes à 1 440 px, 9 à 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.47.3) |
| 107 | **Audit ergonomique — points mineurs** : **vouvoiement partout** (≈ 85 textes affichés qui tutoyaient, hérités de Plan de classe — bandeau RGPD, toasts, infobulles, réglages, salles, sync ; commentaires et identifiants intacts) · **♂ ♀ devant le nom dans toutes les grilles** (`_civHTML` dans `_nomFicheHTML`) · « Ce que disent les faits » à partir du 1er septembre · en-têtes verticaux de la carte de chaleur plus hauts, papiers et disciplines abrégés (plus aucun tronqué) · onglet Avis sur la dernière feuille sauf si l'on a choisi « Nouvelle feuille » (`_avisNouvelleVoulue`) ; 1 test, 1 test mis à jour. Audit 11 écrans × 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.47.2) |
| 106 | **Audit ergonomique — points moyens** : nom corrigé dans « Identité et repères » (plus de ✎ dans le titre de la fiche) · les deux réglages de moments se disent indépendants (C6) · **observation MBN retirable à la main** (✎ de « Notées dans MBN », `obsMbnRemove`) (C7) · **section 📥 Imports** en tête de Données, les huit imports réunis (C8) · cases **Incidents** (avec un Total) et **Bilans** cliquables dans la carte de chaleur (C9) · une feuille d'avis d'un autre moment **dite** (« pas de feuille pour Conseil S2 »), la feuille nommée dans l'en-tête de la colonne Avis (C10) · le compte d'élèves à droite des filtres, Remarque plus étroite (C11) · **boutons nommés** (Retours : Retours · Réglages · Dupliquer · Archiver · Supprimer ; fiche : Tout modifier · Supprimer), plus de « — » parmi les pastilles (C12) ; 2 tests, 1 test mis à jour. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.47.1) |
| 105 | **Audit ergonomique — les cinq points majeurs** (rapport publié à part) : décisions dans la fenêtre de bilan et signalées (◉, anneau) · **le nom ouvre la fiche dans toutes les grilles** (`_nomFicheHTML` : Observations, document, ramassage, Moyennes) · **totaux nommés** dans l'en-tête (« total année », « au 31/01 », « Total S2 · carnet + MBN ») · **tri par les en-têtes partout**, « Ordre de passage » dans Observations et Retours seulement · **contacts de la fiche par la fenêtre des contacts** ; `test/ergonomie.test.js` (5 tests), 3 tests mis à jour. Audit 9 états × 2 thèmes à 1 440 px, 6 à 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.47.0) |
| 104 | **Carte de chaleur : Contacts avec un Total, cases cliquables** vers la fenêtre des contacts ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.46.16) |
| 103 | **Vue « Préparer le conseil » avec la colonne Contacts** (et reprise de l'ancienne vue) ; 1 test | ✅ **fait** (2026-10-03, v1.46.15) |
| 102 | **Remarque et contacts séparés** (fenêtre `mcontacts` ouverte par la colonne Contacts : date, type, texte corrigeables ; libellé « Remarque » au lieu d'« Observations ») · **bilan et décisions à la hauteur de leur texte** ; 1 test, 1 test mis à jour. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.14) |
| 101 | **Décisions d'un moment de bilan** (`stu.decisions`, `decisionSet`, `_decisionCible`) : champ sous le bilan dans la fiche, autres moments, chronologie, synthèse de période ; démo ; 1 test. Audit 3 vues × 2 moments × 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.13) |
| 100 | **Ajout d'un élève par la même fenêtre que la modification** (ancienne fenêtre supprimée) · **la fiche se ferme en quittant Élèves, Observations, Moyennes** ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.12) |
| 99 | **Fenêtre « Modifier l'élève » refaite** (par-dessus la fiche, cinq blocs sur deux colonnes, choix courts en boutons, aménagements en puces) · **avis des collègues avec leurs paragraphes sur le papier** ; 1 test, 2 tests mis à jour. Audit 2 thèmes, 1 440 et 320 px, 0 défaut (un contraste trouvé et corrigé) | ✅ **fait** (2026-10-03, v1.46.11) |
| 98 | **Fiche : les paragraphes des textes libres se voient** (remarque, bilans, avis des collègues — `white-space: pre-line`) ; 1 test | ✅ **fait** (2026-10-03, v1.46.10) |
| 97 | **Fiche : plus de « Dossier complet »** — classe, naissance, civilité, présence, place, élections dans Identité ; relevés, bilans, incidents (📎), contacts, papiers (choix lus, réponses corrigeables) dans leurs cartes, derrière **✎** ; 1 test. Audit 13 états d'édition, 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.9) |
| 96 | **La fiche a la sélection de moments de la carte de chaleur** (même liste, même titre *Synthèse pour ▾*) ; 🗓 Moments ne règle plus que la colonne Bilans ; tests mis à jour. Audit 3 vues, 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.8) |
| 95 | **Carte de chaleur : moments de « Synthèse pour » à elle** (tous les mois proposables, liste à cocher sous le titre, indépendante de 🗓 Moments) · **compte d'élèves à droite des filtres** (une ligne de moins) ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.7) |
| 94 | **Carte de chaleur : Observations du carnet, puis MBN, puis Total des observations** (trois groupes) ; tests mis à jour. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.6) |
| 93 | **« +n » depuis une durée choisie** (📅 dans l'en-tête Observations : 1 ou 2 semaines, 1 ou 2 mois, début de la période ; propre au poste), carnet + MBN ; filtre « Observations +3 ou plus » et colonne imprimée sur la même durée ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut (un débordement à 320 px trouvé et corrigé : la puce du filtre) | ✅ **fait** (2026-10-03, v1.46.5) |
| 92 | **Carte de chaleur bornée au moment du bilan** (barre *Synthèse pour*, partagée avec la fiche) avec un **Total carnet + MBN** · liste : **« +n » de la période, carnet et MBN**, petite courbe = miniature de la fiche · dessins à partir du **1er septembre** ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.4) |
| 91 | **Liste : colonne Observations = total carnet + MBN de l'année**, détail des deux dessous, tri et papier sur le total ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.3) |
| 90 | **Courbe de la fiche arrêtée à la date du bilan du moment, sinon aujourd'hui** (`_ficheCourbeFin`), légende au-dessus du dessin ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-03, v1.46.2) |
| 89 | **Fiche : courbe carnet + MBN** avec une coche par source, détail des relevés du carnet · **observations MBN sur la feuille imprimée du carnet** · colonne Bilans retirée quand aucun moment n'y est · un seul clic sur − pour un conseil remis ; 1 test, 1 test étendu. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.1) |
| 88 | **Observations notées dans MBN** : import de l'export (.xlsx, dates en nombre de série, réimport sans doublon, retrait seulement coché), comptées à côté du carnet dans la grille (MBN par période, *Carnet + MBN*), la liste, la carte de chaleur, la fiche et la synthèse de période ; démo · **la fiche suit les moments retirés** ; 3 tests (`test/obs-mbn.test.js`). Vérifié sur l'export fourni (hors dépôt, 7 observations). Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.46.0) |
| 87 | **Liste « 🗓 Moments »** à la place des menus ＋ / − : chaque moment de bilan avec − (dans la colonne) ou + (à ajouter) ; 1 test. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-03, v1.45.4) |
| 86 | **Grille des bulletins figée** (ligne des candidats en place, position gardée) ; **retirer un moment de bilan** (vide : disparaît ; écrit : masqué, retenu) ; « Point d'avril » ; test du cadre figé étendu aux renderers qui délèguent la garde ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.45.3) |
| 85 | **Régimes d'entrée ET de sortie** séparés (catalogues, migration), jours de ½ pension ; **import de l'export MBN** (.xlsx, avant / après, rattachement manuel) ; **lecture .xlsx** (`_xlsxRead`), import d'élèves en .xlsx / .ods ; **Retours** : seule la grille défile ; 3 tests. Vérifié sur le vrai export (hors dépôt). Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.45.2) |
| 84 | **Régime** (demi-pensionnaire, externe, interne) et **régime de sortie** (codes de l'établissement, réglables) : colonne Groupe · options, fiche, ✏️, saisie en série (🍽 Régimes), papier, import (qui complète aussi les élèves déjà présents) ; naissance enfin lue à l'import ; démo ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.45.1) |
| 83 | **Onglet 🗣 Avis des collègues** (les récoltes à gauche, la feuille à droite, grille « qui a écrit sur qui ») à la place de la fenêtre · **liste des élèves** : plus de ligne de tri (Nom · Prénom en en-tête), puce *Naissances*, impression dans la barre du haut ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.45.0) |
| 82 | **Fiche = celle du prototype** : en-tête sur une rangée (moments en boutons), tableau de bord en cartes bornées au moment, chronologie et faits au style du prototype ; ✏️ 🗑 dans la carte Identité, dossier complet replié au pied ; tokens `--pf-card`, `--i-*` ; test mis à jour. Audit 3 vues × 2 moments × 2 thèmes, 1 440 / 2 560 / 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.44.3) |
| 81 | **Liste = le tableau du prototype** (cases courtes, carnet avec courbe, contacts à part, bilans en points, remarque sur une ligne, genre devant le nom), **vues en boutons, colonnes en puces**, carte de chaleur alignée (couleurs des paliers, trois niveaux d'avis), suppression depuis la fiche ; tests mis à jour. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.44.2) |
| 80 | **Bouton** plein écran / à côté dans la fiche (la largeur de l'écran décide par défaut, le choix vaut pour la session) · **titres d'onglet retirés** · **seule la grille défile** dans Élèves, Observations, Moyennes ; test mis à jour. Audit 6 onglets + fiche, 2 thèmes, 1 440 / 2 560 / 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.44.1) |
| 79 | **Fiche élève refondue** : trois vues (tableau de bord en colonnes, chronologie avec frise et journal, faits et rédaction avec avis en tableau, mots qui reviennent et brouillon), synthèse bornée à un moment, bilan écrit en place, ouverture à côté de la liste sur écran large ou plein écran ; 6 tests (`test/fiche-synthese.test.js`). Audit 3 vues × 2 thèmes à 2 560, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.44.0) |
| 78 | **Liste des élèves : deux affichages** (indicateurs sur une ligne par élève, carte de chaleur repliable par groupe), **filtres d'un clic** cumulables, **vues** toutes faites, colonne **Avis** des collègues (traits par discipline, n/N, ⭐) ; token `--chip-on-fg` ; 2 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.43.0) |
| 77 | **Avis des collègues : colonnes réglables par feuille** (nombre et titres, modèles : conseil à trois colonnes, appréciation de bulletin, remarque libre, points forts / à travailler ; renommer garde les avis, retirer une colonne remplie est refusé), `{colonnes}` dans le message ; démo : point de mars à une colonne ; 5 tests. Audit 2 thèmes, 1 440 et 320 px, 0 défaut ; feuille vue dans LibreOffice | ✅ **fait** (2026-10-02, v1.42.0) |
| 76 | **Import Plan de classe : une case vide là-bas ne vide plus naissance, dates, civilité d'ici** (`stats.gardes`), point nommé avant l'import, outil *🩹 Récupérer des dates…* (`_recupChamps`) · **colonnes des bilans des périodes précédentes** (`_bilanColonnesListe`) ; 3 tests | ✅ **fait** (2026-10-02, v1.41.1) |
| 75 | **Liste des élèves : colonnes à masquer** (volet ☰ Colonnes, « vide » signalé, masquer les vides, écran et papier, `S.prefs.elevesColsOff`) · **une colonne par moment de bilan** (conseil, mi-période, point du mois ; ajout d'une colonne vide) ; démo : point de mars ; 2 tests. Audit 2 thèmes, 1 570 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.41.0) |
| 74 | **Formule de politesse et signature** du message aux collègues (nom, établissement, ou signature HTML de la messagerie collée et filtrée par `_htmlSur`), aperçu sur fond courriel blanc ; 2 tests. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-02, v1.40.13) |
| 73 | **Objet du courriel** proposé selon l'objectif, modifiable, copié à part (`_avisObjetMail`, `avisCopierObjet`) ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-02, v1.40.12) |
| 72 | **Message aux collègues en texte riche** : aperçu mis en forme, copie HTML + texte (gras, puces, lien cliquable), copie en texte brut à part, mots clés en gras dans les textes proposés ; 1 test. Audit 2 thèmes et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.40.11) |
| 71 | **Message aux collègues** : la parenthèse « ne compléter que pour les élèves dont vous en ressentez le besoin » devient une partie à part, cochable (`besoin`) ; test étendu | ✅ **fait** (2026-10-02, v1.40.10) |
| 70 | **Hauteurs des lignes de la feuille d'avis** : fixes et mesurées en Andika pour les quatre lignes de tête (`_odsLignes`, `_odsHauteurCm`, chasses exportées par `gen_fonts.py`), automatiques pour les élèves ; police incluse renommée « Andika SuiviPP » ; 1 test. Vu dans LibreOffice avec et sans Andika installée | ✅ **fait** (2026-10-02, v1.40.9) |
| 69 | **Bilans pour l'objectif d'une feuille d'avis** (bouton ✍️, mode feuille de la modale de bilan, type « Point du mois », reprise du bilan existant) ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-02, v1.40.8) |
| 68 | **Andika incluse dans la feuille .ods** (TTF déjà compressés, `EmbedFonts`, métriques resserrées) ; 1 test. Vu dans un LibreOffice sans Andika installée | ✅ **fait** (2026-10-02, v1.40.7) |
| 67 | **Objectif de la feuille** (conseil · mi-période · point du mois) choisi à la création, dit dans la feuille, la liste, le message, le bilan et la fiche ; le bilan lit la feuille de son objectif ; démo à deux feuilles ; 1 test. Audit 2 thèmes, 0 défaut | ✅ **fait** (2026-10-02, v1.40.6) |
| 66 | **Colonne des noms à la largeur du plus long** (`_avisLargeurNoms`) ; 1 test. Vu dans LibreOffice avec un nom de 43 caractères | ✅ **fait** (2026-10-02, v1.40.5) |
| 65 | **Mots clés en gras** dans le mode d'emploi (`gras`, span `T1`) · **onglets verrouillés** sauf les cases de saisie (`table:protected`, `cell-protect="none"`) ; test étendu. Vu dans LibreOffice | ✅ **fait** (2026-10-02, v1.40.4) |
| 64 | **Ctrl+Entrée rappelé** dans le mode d'emploi de chaque onglet ; test mis à jour | ✅ **fait** (2026-10-02, v1.40.3) |
| 63 | **Quadrillage masqué** (`ShowGrid` false) : le tableau n'est dessiné que par ses bordures ; test mis à jour | ✅ **fait** (2026-10-02, v1.40.2) |
| 62 | **Feuille plus lisible** : quadrillage affiché (`ShowGrid`), consignes des colonnes encadrées ; 1 test. Vu dans LibreOffice | ✅ **fait** (2026-10-02, v1.40.1) |
| 61 | **Colonnes Travail · Participation · Comportement** avec leur consigne (migration des anciennes) · **élèves demandés en particulier**, surlignés en jaune · **message en parties** (moment, mois, échéance, parties à garder, textes réécrits devenus modèles) ; 3 tests. Feuille vue dans LibreOffice ; audit 2 thèmes, 1 024 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.40.0) |
| 60 | **Onglets colorés** : une couleur par domaine disciplinaire, une nuance par discipline (`DOMAINES`, `_discCouleur`, `tableooo:tab-color`), domaine réglable dans Données, catalogue et onglets rangés par domaine ; tests mis à jour | ✅ **fait** (2026-10-02, v1.39.3) |
| 59 | **Allemand** parmi les disciplines d'office (en tête ; la LCE reste à rattacher) · bouton *Ouvrir les avis des collègues* dans 💾 Données ; tests mis à jour | ✅ **fait** (2026-10-02, v1.39.2) |
| 58 | **Avis des collègues : revue avant / après** (rien repris d'office, effacements jamais cochés, nouvelle feuille sur un fichier déjà rempli = rien coché) · **professeur tapé à la main** (modale et Données) ; 2 tests. Audit : revue, nouvelle feuille, Données, 2 thèmes, 710 et 320 px, 0 défaut | ✅ **fait** (2026-10-02, v1.39.1) |
| 57 | **Avis des collègues** : feuille .ods du Nuage préparée et relue par l'app (un onglet par discipline, réponses libres), catalogue des disciplines réglable, matières des moyennes rattachées (demande quand elle ne sait pas), professeur repris des moyennes ; bilan, fiche, synthèse de période ; module .ods sans dépendance ; démo ; 10 tests · **réglages en une colonne sur téléphone** (débordement de 39 px) et **auditeur corrigé** (cf. défaut 29) | ✅ **fait** (2026-10-02, v1.39.0) |
| 56 | **Couleurs de palier sur la synthèse de période** (cumul de fin de période, tableau et fiches, légende) · **démo sans cumul qui baisse** (rappel de l'utilisateur) ; 2 tests | ✅ **fait** (2026-09-30, v1.38.1) |
| 55 | **Observations du carnet : couleurs par palier** (`S.prefs.obsPalier`, 5 par défaut, réglable, `_obsBande`, 8 tokens × 2 aux trois endroits) dans la grille, la liste, la fiche et le papier · **impression de la grille** (modale `mcarprint`, période, colonnes, orientation, A4 / A3, une page) ; 6 tests. Audit : 14 états, 2 thèmes, 1 916 et 320 px, **0 défaut** | ✅ **fait** (2026-09-30, v1.38.0) |
| 54 | **Polices au choix** : Andika à l'écran par défaut, Latin Modern au papier par défaut, les deux réglables dans 💾 Données (`_applyPolices`, `scripts/gen_fonts.py`) ; Fraunces et IBM Plex retirées (−430 Ko) · **visuel commun à tous les tableaux imprimés** (`.print-t`, PV) ; 5 tests | ✅ **fait** (2026-09-30, v1.37.0) |
| 53 | **Liste des élèves imprimée plus lisible** : feuille `.pp-t.pp-el` (colonnes fixes pondérées vers le texte libre, rangées alternées, chiffres centrés, en-tête répété à chaque page, rangées jamais coupées, élève parti en italique), taille FIXE 8,5 pt en Latin Modern. ⚠️ **Pas d'ajustement à une page — arbitré par l'utilisateur** (*« j'y mets beaucoup d'informations »*) : elle court sur autant de pages qu'il faut (2 pour la démo), et un test vérifie que `printEleves` ne mesure pas ; 1 test | ✅ **fait** (2026-09-30, v1.36.0) |
| 52 | **Feuille des moyennes** : sur une page A4 / A3 (modale `mmoyprint`, taille calculée), statistiques en pied **au choix** (`S.prefs.moyStats`, écran et papier) · **Latin Modern** pour toutes les impressions (`--font-print`, `scripts/gen_print_font.py`, devenu `scripts/gen_fonts.py` en v1.37.0) ; 2 tests | ✅ **fait** (2026-09-30, v1.35.0) |
| 51 | **Synthèse de période en une page** : tableau refait (`.pp-t`, colonnes fixes, rangées grisées, contenu condensé), taille de texte calculée pour tenir sur une page (`_printFitSize`, `_printFitMeasure`), papier A4 / A3 ; 3 tests | ✅ **fait** (2026-09-29, v1.34.0) |
| 50 | **Moyennes sur la synthèse de période** : bloc *Moyennes* (`_moyPourPeriode`, `_moyPeriodeEleve`) — dernier import de la période du bureau numérique, évolution depuis le premier, sous 10 en gras ; 3 tests | ✅ **fait** (2026-09-29, v1.33.0) |
| 49 | **Onglet 📈 Moyennes** : lecture de l'export du bureau numérique (`_moyParse`, `_moyMatch`, `moyImport`), catalogue de matières qui réaligne les colonnes, statistiques (`_moyStats`, σ de population), évolution par période (`_moyDelta`, `_moyEvolution`), aperçu d'import avec rattachement manuel, vue Évolution, impression ; section de la fiche, colonne *Moy.* de la liste des élèves ; démo à 4 imports ; 38 tests de plus | ✅ **fait** (2026-09-29, v1.32.0) |
| 48 | **Le même bilan sur la grille élèves × documents imprimée**, une section par document, champs des familles seulement (`_gridPrintBilan`) ; 1 test | ✅ **fait** (2026-09-16, v1.31.1) |
| 47 | **Bilan au pied du document imprimé** : rendus et compte de chaque option, sur les lignes et colonnes imprimées (`_docPrintBilan`) ; 3 tests | ✅ **fait** (2026-09-16, v1.31.0) |
| 46 | **Modale d'élection** : les défauts des textes écrits en clair + bouton ↺, suppléants réglables même en binôme (le binôme se défait, ne refuse pas) ; 1 test | ✅ **fait** (2026-09-12, v1.30.1) |
| 45 | **Scrutin uninominal par défaut** (`nomsParBulletin: 1`, comme les textes liés), lien service-public sans fragment ; démo close uninominale, fixtures et démo en cours plurinominales à dessein | ✅ **fait** (2026-09-12, v1.30.0) |
| 44 | **Textes des délégués** : fiche service-public F1370 ajoutée, R421-30 et circulaire 2004-114 retirés | ✅ **fait** (2026-09-12, v1.29.2) |
| 43 | **Lien R421-28** : la section Légifrance avec fragment de texte, fournie par l'utilisateur | ✅ **fait** (2026-09-12, v1.29.1) |
| 42 | **Remplacement d'un délégué** : `election.remplacements` saisissable (bloc 🔁 sur l'élection close), mandats dérivés par `_elEffectifs` (promu, vacant), section sur le PV, démo ; bug du titulaire parti corrigé ; 3 tests | ✅ **fait** (2026-09-11, v1.29.0) |
| 41 | **Démo à jour des nouveautés** (v1.24 → v1.28) : catalogue des instances réglé (une ajoutée et utilisée, une décochée), retenue et engagement écrit, contact « autre », délégués provisoires désignés à la rentrée et **remplacés** par l'élection, heure de vie de classe **à venir** (la seule entrée datée par rapport à aujourd'hui), marqueur `pdcImportAt` (les avertissements Plan de classe apparaissent), une naissance inconnue, une observation sur le PV ; 1 test | ✅ **fait** (2026-09-11, v1.28.3) |
| 40 | **Audit complet** (contraste · débordement · texte tronqué · erreurs JS · handlers et ids · code mort) : 32 états × 2 thèmes × 2 largeurs + papier ; six défauts corrigés (23 → 28), outils dans `scripts/` ; 5 tests | ✅ **fait** (2026-09-11, v1.28.2) |
| 39 | **Textes officiels des élections** : cadre vérifié, `_EL_TYPES[…].textes` liés dans la modale et l'élection, cités au pied du PV ; défauts éco ramenés aux textes (un élu, un nom par bulletin) | ✅ **fait** (2026-09-11, v1.28.1) |
| 38 | **Heures de vie de classe** (`cls.vieClasse`, `_hvcOf`, `_hvcPeriode`) : onglet renommé 🏫 Vie de classe, journal en tête, bloc optionnel de la synthèse de période, démo ; 4 tests | ✅ **fait** (2026-09-11, v1.28.0) |
| 37 | **Éco-délégués** : `election.type`, défauts par mandat, `nbSupplants` à 0, `_ecoDelegueOf`, 🌱 dans les grilles, PV, désignation sans vote, purge, démo ; 4 tests | ✅ **fait** (2026-09-11, v1.27.0) |
| 36 | **Synthèse de période imprimable** (`_periodeSynthese`, `_periodePrintHTML`, modale `mperiode`) : conseil ou mi-période, blocs au choix, tableau paysage ou fiches portrait, tout borné à la période ; 2 tests | ✅ **fait** (2026-09-11, v1.26.0) |
| 35 | **Bilans de période** (`stu.bilans`, `_bilanPeriode`) : colonne *Conseil* dans la liste (triable, imprimée), section 🎓 de la fiche, modale qui enchaîne les élèves (◀ ▶, Ctrl+Entrée) ; 6 tests | ✅ **fait** (2026-09-11, v1.25.0) |
| 34 | **Incidents depuis la liste** : la case ⚖️ ouvre la saisie d'une entrée, la dernière s'ouvre en modification ; 1 test de plus | ✅ **fait** (2026-09-11, v1.24.0) |
| 33 | **Synthèse fusionnée dans Élèves** : une liste, identité + suivi, `_elevesRows` pour l'écran et l'impression, tri par en-tête sur les colonnes de suivi, naissances derrière une case ; colonne Réponses retirée ; 5 onglets | ✅ **fait** (2026-09-11, v1.23.0) |
| 32 | **Libellés qui nomment le geste** : 📓 Observations, 📄 Retours, *+ Relever les carnets*, *🧺 Ramasser · vérifier…*, *Remarque · contacts* ; identifiants du code inchangés | ✅ **fait** (2026-09-11, v1.22.0) |
| 31 | **Catalogue des instances aux noms réels**, rangé par famille (signalement · punitions · sanctions · mesures · instances · protection), migration des anciens libellés ; 2 tests | ✅ **fait** (2026-09-11, v1.21.0) |
| 30 | **PV signé en PDF** sur l'élection close et la désignation (`election.pv`, `cls.delegues.pv`) · **choix du nom** à la copie (`pjChooseName`, `_pjAutoNom`, `_pjUnique`, plus de préfixe d'id) ; 2 tests | ✅ **fait** (2026-09-11, v1.20.0) |
| 29 | **Délégués désignés sans vote** (`cls.delegues`, `deleguesSet`, arbitrage par la date dans `_delegueOf`, purge) ; 3 tests de plus | ✅ **fait** (2026-09-11, v1.19.0) |
| 28 | **Classe = son nom** dans la fiche (`ficheSaveClasse`) · **ordre de ramassage au glisser** (`ordrePaint*`, traînée sans re-rendu) | ✅ **fait** (2026-09-11, v1.18.0) |
| 27 | **La fiche corrige TOUT sur place** : nom, dates, civilité, classe (`moveStudentToClass` partagé avec la modale), place, cumuls du carnet, réponses / date / note des documents, contacts ; 4 tests de plus | ✅ **fait** (2026-09-11, v1.17.0) |
| 26 | **Glisser-déposer des places** : liste des sans-place à droite, placer / échanger (`seatSwap`) / libérer au glisser, clic conservé pour le sélecteur ; 1 test de plus | ✅ **fait** (2026-09-11, v1.16.0) |
| 25 | **Données et réglages** : onglet renommé ; catalogue des options dans l'onglet (tableau partagé avec la modale 🏷) ; **éditeur de salles et placements** (`salleAdd/Set/Remove`, `seatSet`, `pattern*`, grille en deux modes) avec avertissement Plan de classe (`_pdcOrigine`) ; 5 tests de plus | ✅ **fait** (2026-09-11, v1.15.0) |
| 24 | **La fiche corrige sur place** : pastilles `+` (remarque, contact, incident), valeurs cliquables (groupe, options, aménagements) avec avertissement Plan de classe (`cls.pdcImportAt`, `_fichePdcHint`), retour de document cochable ; 4 tests de plus | ✅ **fait** (2026-09-11, v1.14.0) |
| 23 | **Incidents et instances** : catalogue pré-rempli et réglable (`S.instances`, `_instancesSeed`), entrées datées sur l'élève (`stu.incidents`, `incidentAdd/Set/SetPdf/Remove`), modale depuis la fiche, **PDF copié dans un dossier choisi** (`pjStore`, `pjOpen` en lecteur intégré, `pjOrphelins`), Synthèse + impression, démo, RGPD, CSP `frame-src blob:` ; 13 tests de plus | ✅ **fait** (2026-09-11, v1.13.0) |
| 22 | **Liste des élèves allégée** : aménagements en lecture (`_amenBadgesHTML`, réglage par ✏️), nom des délégués **surligné** dans les cinq grilles (`_nomHTML`, tokens `--del-*`) à la place de la pastille 🏅 ; `_topbarMeasure` différée (boucle ResizeObserver remontée en toast) ; 2 tests de plus | ✅ **fait** (2026-09-11, v1.12.0) |
| 21 | **Grilles figées** : en-tête et colonne des noms collants dans les cinq grilles (`.rel-wrap.frozen`, `_wrapScrollKeep`, `_topbarMeasure`) · **âge sous le nom** (`_ageSubHTML`, mis à jour en place à la saisie) · pastilles « à rendre » / « à lire » du ramassage **empilées** (`_ramResteHTML`) ; 6 tests de plus | ✅ **fait** (2026-09-11, v1.11.0) |
| 20 | **Impression de la vue globale** : grille élèves × documents (`_gridPrintCell`, `_gridPrintRows`, `_gridPrintTotals`, `_gridPrintSubtitle`), trois états sur le papier, totaux en pied, réponses en option, depuis la liste **et** depuis le ramassage ; 9 tests de plus | ✅ **fait** (2026-09-10, v1.10.0) |
| 19 | **Impression d'un document** avec choix des colonnes : calcul pur (`_docPrintColumns`, `_docPrintKeys`, `_docPrintFiltres`, `_docPrintCell`, `_docPrintRows`, `_docPrintSubtitle`) testé avant l'UI (11 tests), modale de sélection, orientation déduite, PDF par la fenêtre d'impression | ✅ **fait** (2026-09-10, v1.9.0) |
| 18 | **Installable comme application** : 5 icônes PNG générées par script, manifeste complet (`id`, `icons` `any` + `maskable`), icône iOS liée, préchargement des icônes tolérant aux absences, 8 tests dont la mesure réelle des dimensions dans l'IHDR | ✅ **fait** (2026-09-10, v1.8.0) |
| 17 | Colonne **Naissance** saisissable en série · **touches de saisie** du carnet · fiche : Documents repliable avec les choix visibles · **années à deux chiffres** complétées | ✅ **fait** (2026-09-09, v1.7.0) |
| 16 | **Fiche élève complète** au clic sur le nom (`_ficheAge`, `_fichePlaces`, `_ficheCarnet`, `_ficheDocuments`, `_ficheElections`) | ✅ **fait** (2026-09-09, v1.6.0) |
| 15 | Tri aussi dans le **tableau d'un document** (vérifier des signatures dans les rangs) · **date de naissance** + départage automatique par l'âge · **journal des contacts** avec les familles | ✅ **fait** (2026-09-09, v1.5.0) |
| 14 | **Tri des élèves par nom / prénom / place / ordre de ramassage** dans les 4 grilles, sélecteur de salle, import des salles + placements + patterns depuis Plan de classe | ✅ **fait** (2026-09-09, v1.4.0) |
| 13 | Poignée ⋮ de réordonnancement (glisser souris/tactile, trait d'insertion, `Échap`, clavier) ; un choix relevé vaut constat de retour | ✅ **fait** (2026-09-09, v1.3.0) |
| 12 | **Réponses au ramassage** (pastilles dans la grille, repli par colonne) + **réordonnancement des documents** (`docReorder`) | ✅ **fait** (2026-09-09, v1.2.0) |
| 11 | **Ramassage** : grille élèves × documents pour cocher les retours de plusieurs papiers en une passe (`_ramRows` pur et testé, salve d'undo, colonne entière, clavier) | ✅ **fait** (2026-09-09, v1.1.0) |
| 10 | Audits complets : contraste (20 états × 2 thèmes + rendu papier simulé), impression (orientation rendue portable), responsive 320 → 1920 px, clavier des 19 modales ; 11 tests statiques du design system | ✅ **fait** (2026-09-09, v1.0.0) |

### Scores de référence — audit de contraste

**2026-09-09, v0.1.0 (squelette) : 0 écart**, en thème clair comme en thème sombre.
Parcours : les 6 onglets + les 5 modales (`mconfirm2`, `mprompt2`, `mAppDialog`, `mupdate`,
`mabout`) + le bandeau RGPD, avec des données injectées, contenus de modales peuplés
(les cinq variantes de bouton, les trois `.al`), et transitions neutralisées.
Seuil 4,5:1 (3,0 pour le grand texte).

Deux défauts trouvés et corrigés à cette passe, tous deux exemplaires des règles du design system :
1. **Bandeau RGPD à 1,63:1 en thème sombre.** Sa surface est un jaune de surligneur dans les
   deux thèmes (c'est un avertissement), mais son encre était `var(--ink-deep)`, qui s'inverse
   et devenait l'ambre de nuit sur l'or. → tokens dédiés `--rgpd-bg` / `--rgpd-fg` / `--rgpd-btn-*`,
   déclarés aux **trois** endroits. Illustration littérale de la règle 2 : *un fond clair posé
   pour le mode clair a besoin de sa propre encre, pas seulement d'un thème*.
2. **Boutons imprimés en thème sombre.** Les fonds de bouton de nuit (`#3b5a8c`, `#9c3529`…)
   sont posés en dur : le bloc de neutralisation d'impression, qui n'agit que sur les TOKENS,
   ne les ramenait pas au clair, et l'encre de papier rétablie tombait sur un fond de nuit.
   → `.tb, button, .btn { display:none }` dans `@media print`. Aucun contrôle n'a sa place sur
   le papier : fermer le piège par construction vaut mieux que d'énumérer des couleurs.

**2026-09-09, v0.2.0 (onglet Élèves + import) : 0 écart**, clair et sombre.
Parcours élargi : les 6 onglets avec une classe réelle importée (6 élèves, 2 classes,
3 options, aménagements, dates d'arrivée) + les 10 modales peuplées — dont l'import avec
son panneau de mappage, son panneau de codes et un aperçu portant des lignes en erreur.

Un défaut trouvé et corrigé, du même genre que les deux précédents :
3. **Pastilles de groupe invisibles.** `--g1` / `--g2` / `--g3` vivaient dans le `<style>`
   de la référence **hors** du bloc design system repris (ligne 602 contre 789-1019) : les
   pastilles tombaient sur un fond transparent avec une encre claire. Rétablis en tokens,
   avec leur encre nommée (`--gN-on`) — blanche pour les trois, mesuré 5,97 · 4,91 · 5,87:1,
   contre 4,28 · 3,52 · 4,20 pour l'encre ambre du thème sombre. ⚠️ Ces trois couleurs **ne
   varient pas** avec le thème (la couleur porte le sens du groupe) : une seule déclaration
   dans `:root`, et rien à faire dans le bloc d'impression — la règle des trois endroits ne
   s'applique qu'aux tokens qui, eux, changent.

**2026-09-09, v0.3.0 (import Plan de classe + réglages) : 0 écart**, clair et sombre — 6 onglets
avec une classe de 25 élèves importée du fixture `v2026-08-02.json` de la référence, bloc
Réglages, et la modale de choix des classes peuplée (6 divisions, mention « déjà connus »).

**2026-09-09, v0.4.0 (Carnets) : 0 écart**, clair et sombre — grille de 6 élèves × 9 relevés
(un `A`, des vides, un cumul décroissant, un élève parti, une colonne vide), modale de relevé
peuplée. Seule remontée : une case à cocher (`value="on"`) prise pour du texte par l'auditeur
élargi aux `<input>` — faux positif, pas un défaut.

Un défaut de rendu (pas de contraste) trouvé en route :
4. **Cellules blanches en thème sombre.** Les `<input>` sans attribut `type` sont des champs
   texte, mais `input[type="text"]` ne les sélectionne pas : ils gardaient le blanc du
   navigateur. → `input:not([type])` ajouté à la règle générique. L'audit de contraste ne
   pouvait pas le voir (noir sur blanc passe) : c'est la capture d'écran qui l'a montré —
   raison de plus pour REGARDER l'écran, pas seulement mesurer.

**2026-09-09, v0.5.0 (Documents) : 0 écart**, clair et sombre — liste (3 documents, badges
rendus / sans réponse / avis), tableau des retours de la fiche d'orientation (sélecteurs colorés
par option, encre dérivée), modale de définition peuplée du modèle orientation (4 champs,
pastilles), liste des manquants.

Un défaut trouvé et corrigé :
5. **Badge neutre `.badge.z` à 4,12:1 en clair** — `--pencil` sur `--paper-deep`. Passé à
   `--ink-blue-soft` : 9,12:1 en clair, 7,07:1 en sombre (mesuré). Leçon : `--pencil` est
   calibré sur le papier, pas sur `--paper-deep` ; une encre secondaire posée sur une surface
   plus foncée que le fond doit être remesurée.

**2026-09-09, v0.6.0 (Délégués) : 0 écart**, clair et sombre — liste des élections, élection
en cours (grille de 13 bulletins avec un blanc et un nul × 4 binômes + graphique), mode
projection, élection close (résultats), modale des modalités.

Un défaut de mise en page trouvé à l'écran (pas par la mesure) :
6. **Le mode projection ne prenait que la moitié de l'écran.** La grille `.el-split` restait
   à deux colonnes alors que le volet gauche n'était plus rendu : le graphique occupait la
   colonne 1 sur 2, noms tronqués, barres minuscules. → `.el-split.proj { grid-template-columns:
   1fr }` + noms et pourcentages en `nowrap` / ellipse. ⚠️ À revérifier sur le vrai
   vidéoprojecteur avant le jour J (1024 × 768 et 1920 × 1080) — les tailles sont bornées en
   `vw` ET `vh`, mais seule la salle dira si le fond lit.

**2026-09-09, v0.7.0 (Synthèse) : 0 écart**, clair et sombre — 25 élèves, relevés, trois
documents avec retours partiels, élection close (badges délégué), remarque multi-ligne.

Trouvé par le test de la synthèse, corrigé dans les élections :
7. **Un second tour VIDE laissait l'élection « en cours » pour toujours.** Un seul binôme pour
   deux sièges : le premier tour l'élisait, un siège restait, et `electionCloreTour` ouvrait
   un second tour sans candidat — jamais clôturable, donc `_delegueOf` ne trouvait rien.
   → second tour seulement s'il reste des sièges ET des candidats ; sinon l'élection se clôt,
   siège vacant signalé. Test ajouté. Leçon : un test d'un autre onglet a vu ce que les 21
   tests de l'arithmétique, tous écrits avec quatre candidats, ne pouvaient pas voir — les
   fixtures se ressemblent trop entre elles.

**2026-09-10, v1.9.0 (impression d'un document) : 0 écart**, clair et sombre — la modale de
choix des colonnes (huit colonnes de la fiche d'orientation, les trois filtres, les deux
sélecteurs) et le tableau derrière elle, plus la même passe en **320 px**.

Deux défauts trouvés, tous deux **des rappels des règles déjà écrites ici** :
16. **Le libellé de la colonne fixe à 3,01:1.** Je l'avais grisé à `opacity:.75` pour dire
   « verrouillée ». Or l'exemption WCAG des composants inactifs vaut pour la CASE — bien
   `disabled` — pas pour le mot qu'il faut lire à côté. → cadenas 🔒 et contraste plein.
   L'opacité dit « indisponible » ; elle ne doit jamais dire « obligatoire ».
17. **44 px de débordement horizontal à 320 px**, causés par le bouton ajouté : le `<span>`
   de fin de la barre du document est en `display:flex` **sans `flex-wrap`**, donc il pousse
   la page au lieu de passer à la ligne. Même famille que les défauts 11 à 13 — *un contenu
   qui pousse la page au lieu de défiler dans son cadre*. Mesuré : 364 px pour 320 de large,
   ramené à 320 après `flex-wrap:wrap`. ⚠️ **Un bouton de plus dans une barre en `flex` est
   un test responsive à refaire**, si petit soit-il.

**2026-09-10, v1.10.0 (grille élèves × documents imprimée) : 0 écart**, clair et sombre —
la modale de la grille, la liste des documents et le 🧺 Ramassage avec leur nouveau bouton,
en 1400 px **et** en 320 px (aucun débordement horizontal cette fois : la leçon 17 a servi).
Rendu papier vérifié à la largeur d'une A4 portrait.

Un défaut trouvé, et **par un test, pas à l'œil** :
18. **Un document partagé entre deux classes faisait entrer les élèves de l'autre** sur la
   feuille. `_ramRows` bâtit ses lignes à partir de `_docExpected`, qui couvre toutes les
   classes du document ; le fixture du ramassage n'a jamais eu de papier partagé, donc rien
   ne l'avait jamais exercé. → D'abord borné côté impression (v1.10.0), puis — l'utilisateur
   ayant tranché « on est PP d'une seule classe » — corrigé dans `_ramRows` même (v1.10.1),
   écran compris, et la garde côté impression retirée.
   ⚠️ Leçon : **une fixture qui ne contient pas le cas ne peut pas voir le défaut** — c'est
   le même constat qu'au défaut 7, où quatre candidats partout cachaient le cas à un seul.

**2026-09-11, v1.11.0 (grilles figées, âge, pastilles empilées) : 0 écart**, clair et
sombre — mesuré sur ce qui a changé : l'âge sous le nom dans les quatre grilles (5,21:1 en
clair, 6,22 en sombre), les en-têtes collants, la colonne de noms collante, les pastilles
empilées du ramassage (10,21 / 9,81). Défilement vérifié dans le navigateur en 1200, 700 et
320 px de large, thème sombre compris ; aucun débordement horizontal du body.

Un défaut trouvé, **dormant depuis la v1.1.0** :
19. **La colonne de noms « collante » ne collait pas.** `overflow: hidden` sur `table.dt`
   en faisait un conteneur de défilement, et le `sticky` s'y accrochait au lieu de
   s'accrocher au cadre (cf. *Grilles figées*). Invisible tant que la grille tient dans la
   fenêtre — c'est-à-dire sur tous les écrans où l'on développe. ⚠️ Leçon : **un `sticky`
   se vérifie en faisant défiler**, jamais en lisant le CSS.

**2026-09-11, v1.12.0 (liste allégée, délégués surlignés) : 0 écart**, clair et sombre —
mesuré sur les noms surlignés (11,36 / 11,2 en clair, 8,34 / 8,15 en sombre), sur les
aménagements en texte coloré au repos **et sous le survol** (4,85:1 au plus bas, sur
`--paper-warm`), dans les listes Élèves, Carnets et Synthèse.

Un défaut de la v1.11.0, corrigé ici :
20. **« Une erreur est survenue » à chaque changement de taille de fenêtre.** Le
   `ResizeObserver` de `_topbarMeasure` écrivait `--topbar-h` dans son propre rappel ; la
   variable change la hauteur des cadres, donc de la page, donc la barre de défilement,
   donc la largeur du bandeau — et l'observateur se redéclenchait dans la même frame. Le
   navigateur coupe court avec *ResizeObserver loop completed with undelivered
   notifications*, un avertissement bénin que `window.onerror` reçoit comme une erreur et
   que le gestionnaire global affichait en toast. → écriture différée par `setTimeout`, et
   seulement si la valeur change. ⚠️ Pas `requestAnimationFrame` : un onglet en
   arrière-plan ne reçoit aucune frame, et la variable restait à sa valeur de repli
   (constaté dans le navigateur de test, volet caché). Leçon : **tout ce qui écrit du
   style depuis un observateur de taille s'écrit à la tâche suivante.**

**2026-09-11, v1.13.0 (incidents et instances) : 0 écart**, clair et sombre — la section ⚖️
de la fiche (entrées, lien 📎, boutons), la modale de saisie, le tableau des instances et
le bloc Pièces jointes de Données, la colonne Incidents de la Synthèse. Minimum mesuré
4,71:1 (en-têtes de tableau, valeur connue). Aucun débordement à 320 px, fiche et modales
comprises. Copie, lecture (lecteur intégré) et détection des orphelins vérifiées dans le
navigateur avec l'OPFS en guise de dossier — le sélecteur natif, lui, ne s'exerce qu'à la
main : **à faire une fois sur chaque poste** avec un vrai dossier Nextcloud.

**2026-09-11, v1.14.0 (la fiche corrige sur place) : 0 écart**, clair et sombre — les cinq
éditeurs en place (aménagements, groupe, options, contact, remarque), les pastilles `+`,
les valeurs cliquables, l'avertissement Plan de classe, les boutons d'état des documents.
Minimum 4,71:1 (libellés du formulaire de contact sur `--paper-warm`). Aucun débordement
à 320 px, éditeurs ouverts.

**2026-09-11, v1.15.0 (Données et réglages) : 0 écart**, clair et sombre — le tableau des
options et son formulaire, l'éditeur de salles dans ses deux modes (cases vides, occupées,
sélectionnée, numéros d'ordre), les bandeaux d'avertissement. Minimum 5,08:1 (le point des
cases vides, `--pencil-soft` sur `--paper`).

Un défaut responsive trouvé et corrigé, de la famille des défauts 11 à 13 et 17 :
21. **343 px pour 320 à l'ouverture de l'onglet.** Les lignes « Nom » et « Rangs × colonnes »
   de la salle mettaient un champ et un bouton dans une cellule de grille `.prefs` — un
   enfant de grille vaut `min-width: auto`, et la cellule poussait la page. → `min-width: 0`
   sur les cellules, et une ligne `.prefs-row` en flex qui replie. ⚠️ Même leçon, quatrième
   fois : **un contrôle de plus sur une ligne est un test à 320 px à refaire.**

**2026-09-11, v1.16.0 → v1.20.1 (glisser-déposer, fiche complète, délégués désignés, PV
signé, nom des PDF)** — mesuré au fil des livraisons, pas en une passe : pastilles et
fantôme du glisser (5,21 / 6,22:1), cases de la grille en mode ordre (5,08 / 5,66), les
éditeurs en place de la fiche (≥ 4,71). ⚠️ **Non mesurés à part** : le bloc de désignation
sans vote, le bloc PV et la modale du nom de fichier — ils n'emploient que des classes déjà
mesurées (`.fi-form`, `.fi-sec`, `.tb-hint`, `.st-group`, `code`), mais la règle reste
qu'un écran nouveau se mesure ; à faire à la prochaine passe complète. Aucun débordement
à 320 px sur ces écrans (défaut 22 trouvé et corrigé sur l'éditeur de place).

**2026-09-11, v1.28.2 — AUDIT COMPLET après la salve v1.24 → v1.28.1** (demande de
l'utilisateur : *« fonction cassée, bug, graphique, texte caché, contraste, ajout qui en
casse une autre »*). Deux outils, gardés dans `scripts/` pour la prochaine fois :
- **`scripts/audit_static.js`** (Node, sur le harnais) : chaque nom de fonction appelé
  dans un handler inline existe (211 handlers) ; chaque id passé à `getElementById`
  existe dans le HTML statique (160, quatre dynamiques connus) ; fonctions définies mais
  jamais référencées ; fonctions **définies deux fois**.
- **`scripts/audit_browser.js`** (à charger par `<script src>` — la CSP interdit `eval`) :
  l'auditeur de contraste (fond effectif par remontée des parents, opacité cumulée, seuil
  4,5 / 3,0, contrôles désactivés exclus), le débordement horizontal du body, le **texte
  tronqué sans infobulle** (`overflow` caché et `scrollWidth > clientWidth`, sans `title`
  ni parent titré), et le compte de `window.__suiviPPErrors`. Piloté depuis la console
  par un parcours de **32 états** (5 onglets et leurs sous-états : touches du carnet,
  document ouvert, ramassage, formulaires de vie de classe, les trois élections, la
  projection ; 21 modales par leur vrai ouvreur) **× 2 thèmes × 2 largeurs (1400 et
  320 px)**, plus le rendu papier de sept feuilles en thème sombre — **≈ 10 000 nœuds
  mesurés par passe**. ⚠️ Deux pièges de l'outil : le service worker de la session
  précédente servait un 503 sur tout fichier hors cache (le désinscrire d'abord) ; et
  un onglet CACHÉ depuis plus de cinq minutes voit ses `setTimeout` limités à un par
  minute — le parcours ne doit rien attendre, tous les rendus sont synchrones.

**Résultat après correction : 0 écart** de contraste, 0 débordement, 0 texte tronqué sans
infobulle, 0 erreur JS, en clair comme en sombre, en 1400 comme en 320 px, papier compris.
Six défauts trouvés, tous corrigés dans la v1.28.2 :
23. **Les lignes des élèves PARTIS tombaient à 2,99:1** (3,84 en sombre) sur leur texte
   secondaire — la date sous le cumul, les Δ, le total de période. `tr.inactive` portait
   `opacity: .72`, dont le commentaire affirmait « mesuré à 4,9:1 » : vrai pour l'encre
   principale (6,7), faux pour tout ce qui était déjà en `--pencil`. Une opacité s'applique
   à tout ce que la ligne contient, y compris ce qui était au bord du seuil. → l'encre
   passe à `--pencil` (5,2 / 6,2:1), l'italique fait le reste, les éléments qui portent
   leur propre encre (délégué surligné, badges) la gardent. Test statique.
24. **Le nom tronqué du graphique n'avait PAS l'infobulle promise** par le défaut 14
   (« l'ellipse reste dans la vue à deux volets, où l'infobulle porte le nom entier ») :
   le `title` n'avait jamais été posé. → `title` sur `.el-name`.
25. **Le pourcentage du graphique se tronquait à 320 px** : « 72 % des 18 dépou… » — une
   règle `.el-name-t, .el-name-s, .el-pct { … ellipsis }` écrasait le `white-space: normal`
   posé trois lignes plus haut pour `.el-pct`. Un pourcentage sans son dénominateur est
   exactement ce que ce fichier interdit. → `.el-pct` sort de la règle d'ellipse.
26. **Ctrl+Z avec la fiche ouverte laissait la fiche périmée** : `_MODAL_RERENDER`, la table
   des modales à redessiner après undo / redo / rechargement, existait depuis l'étape 1
   et était **vide**. Tant que la fiche ne faisait que lire, personne ne le voyait ; depuis
   qu'elle corrige sur place (v1.14.0), on lisait G2 alors que S disait G1. → `mfiche`,
   `mrem` (sa liste de contacts), `mtags`, `mclasses` ; PAS les modales de formulaire, qui
   portent une saisie en cours. `_applyReloadedData` appelle aussi
   `_refreshOpenConsultModals` (il ne le faisait pas).
27. **« Suivant » de la modale de bilan sautait un élève** quand la liste est triée
   « rédigé d'abord » : enregistrer déplaçait l'élève en tête, et le suivant se calculait
   sur l'ordre NEUF. Ajout qui en cassait un autre — la colonne triable et l'enchaînement
   sont nés dans la même version. → l'ordre est **figé à l'ouverture** (`_bilanOrdreFige`),
   c'est celui qu'on avait sous les yeux. Testé.
28. **`_elUndoArmed` (naissances en série, v1.7.0) n'était pas désarmé par
   `_applyReloadedData`** — la leçon du verrou du ramassage, une troisième fois. Testé.
Et du code mort retiré : un `renderStudents()` de l'étape 1 défini une seconde fois (la
seconde définition gagnait, la première restait comme un piège), `_stubHTML`,
`_impNormTags` ; `reloadLastFile`, écrit à l'étape 8 et jamais branché, l'est désormais
(💾 Données → *↩ Dernier fichier chargé*) — la copie IndexedDB avait un écrivain et
aucun lecteur.

**2026-10-04, v1.53.2 — AUDIT COMPLET après la salve v1.48 → v1.53** (photos, impressions,
trombinoscope, fenêtre détachée, élections). Parcours de **56 états** (les 7 onglets et leurs
sous-états, les trois vues de la fiche et cinq de ses éditeurs, les trois affichages de la liste,
les élections et la projection, 30 fenêtres par leur vrai ouvreur) × 2 thèmes × 1 570 et 320 px :
≈ 100 000 nœuds, **0 écart, 0 débordement, 0 texte tronqué, 0 erreur JS**. Statique : 334
handlers, 0 fonction définie deux fois. **Papier** : dix feuilles (liste, synthèse tableau et
fiches, trombinoscope, fiche, carnet, moyennes, document, grille, PV) imprimées depuis les deux
thèmes — `scripts/audit_browser.js` a désormais un mode `run(label, true)` qui mesure aussi
`#pa`, avec les règles `@media print` réinjectées à l'écran et `window.print` remplacé. Puis un
**scénario d'élection de bout en bout** dans le navigateur (candidatures, bureau, nom écrit,
bulletins préparés, question d'acceptation, siège 1 au premier tour, siège 2 en deux tours, scrutin
du suppléant, report, deux PV). Quatre défauts, corrigés :
30. **Le Δ du carnet imprimé à 2,16:1** sur les deux derniers paliers : `.pp-t small` impose `#333`,
   qui l'emportait sur l'encre blanche de la case. → `td[class*="ob-"] small { color: inherit }`.
31. **Le tiret « sans objet » de la grille imprimée à 4,48:1** (`#777`) → `#666`.
32. **Le suppléant d'un élu non candidat, élu APRÈS le vote, figurait sur le PV comme s'il avait
   été sur le bulletin** (« Mathis ROUSSEAU / Clara BERNARD » dans les candidats et le tableau du
   siège 1). Un PV signé qui laisse croire à une candidature en binôme est faux. Invisible à tout
   audit d'affichage : trouvé en LISANT le PV du scénario. → `_elCandNomSupBulletin`.
33. **« Sont élus » au-dessus d'une seule élue** (PV du scrutin du suppléant) → accordé.
⚠️ Leçon : la démo ne porte ni nom écrit ni scrutin de suppléant, donc l'audit des états ne les
voyait pas — d'où le scénario. Et le parcours lui-même s'est trompé une fois (confirmation de
clôture fermée par le script) : relire un résultat surprenant avant d'accuser l'app.

**2026-10-02, v1.39.0 (Avis des collègues) : 0 écart**, clair et sombre — la liste des
élèves, la modale (feuille relue et nouvelle feuille avec sa question « à rattacher »), la
fiche, le bilan avec les avis, Données, la synthèse : 14 états à 1 024 px, 22 à 320 px
(les six onglets compris). Feuille rendue par LibreOffice (PDF) : un onglet tient en
largeur sur une A4 paysage. Fiches de la synthèse simulées sur papier depuis le thème sombre.

Un défaut trouvé, et l'outil réparé :
29. **Les réglages débordaient de 39 px à 375 px** (`.prefs` : `max-content 1fr`, la seconde
   colonne gardait la largeur naturelle des menus). **L'auditeur ne le voyait pas** : en
   émulation mobile, la fenêtre s'ÉLARGIT d'elle-même à la largeur du contenu (`innerWidth`
   414 pour 375), et le test `scrollWidth > innerWidth` passait. → `scripts/audit_browser.js`
   compare à `documentElement.clientWidth` ; les réglages passent en une colonne sous 520 px
   (`!important` : certaines grilles portent leur gabarit en ligne). ⚠️ Les audits à 320 px
   d'avant le 2026-10-02 sont donc à relire avec prudence pour le débordement (le contraste,
   lui, n'est pas concerné).

**2026-09-29, v1.32.0 (Moyennes) : 0 écart**, clair et sombre, par `scripts/audit_browser.js`
(contraste, débordement, texte tronqué, erreurs JS) — 8 états × 2 thèmes, 4 276 nœuds : le
tableau au 1er et au 3e import du S1 (onze colonnes, codes, Δ, colonnes nouvelles), le S2,
la vue Évolution, la liste des élèves avec sa colonne *Moy.*, la fiche, l'aperçu d'import
peuplé (ligne à rattacher, valeur hors barème, matière nouvelle), la modale d'édition ; plus
5 états à 320 px (2 834 nœuds), aucun débordement. Cadre figé vérifié à 1024 × 768 (en-tête
et noms en place après défilement, pied de statistiques compris). Impression : paysage posé
puis retiré, rendu papier noir sur blanc depuis le thème sombre. Le vrai fichier de
l'utilisateur relu hors de l'app — 27 élèves, 5 matières, période et moyenne générale
reconnues — sans qu'il entre dans le dépôt.

⚠️ **Leçon de méthode, payée ce jour-là** : l'onglet a d'abord été construit sur une copie
restée à la **v1.10.0**, alors que `main` était à la v1.31.1 — **quarante commits** de
l'autre poste jamais tirés. Le push a été refusé, rien n'a été écrasé, mais tout a dû être
reporté à la main (la Synthèse n'existait plus, le cadre figé et la correction de la
colonne collante avaient été faits entre-temps — la même panne trouvée deux fois). **Premier
geste d'une session : `git pull`.** Avec deux postes et pas de verrou, c'est la seule
chose qui garantit qu'on travaille sur la version.

**Impression — orientation.** Les pages NOMMÉES (`@page landscape` + `page: landscape` sur
la zone `#pa`) sont conservées, mais elles ne suffisent pas : Firefox les ignore, et la
synthèse serait sortie en portrait sans que rien ne le signale. Depuis l'étape 10, un
`@page` ANONYME (`{ size: A4 landscape }`), lui universel, est injecté le temps de
l'impression puis **retiré à `afterprint`** — sans ce retrait il imposerait son orientation
à l'impression suivante, qui n'a pas la même. Vérifié dans le navigateur sur les trois
chemins (synthèse paysage, manquants portrait, PV portrait) : bonne orientation posée,
bonne classe de zone, tout nettoyé ensuite. ⚠️ **L'orientation sur du VRAI papier reste
non vérifiée** — `window.print` est mocké, aucune imprimante ici. C'est le seul point de
l'étape 10 qui demande une vérification humaine : une page de chaque, sur Chromium et sur
Firefox.

**2026-09-09, v0.8.0 (Sauvegarde & sync) : 0 écart**, clair et sombre — 6 onglets, plus les
modales Versions & historique (5 sortes de fichiers, panneau de résumé déplié), Versions
divergentes et Stratégie de sauvegarde.

Un défaut STRUCTUREL trouvé, qui dépasse cette étape :
8. **Un `<button>` n'hérite pas de `color`.** Sans classe `.btn`, il prend la couleur système
   `buttontext` (noire) : les boutons ℹ️ de la liste des versions tombaient à **1,18:1** sur le
   fond de nuit. Corrigé une fois pour toutes par `button { color: inherit; font-family: inherit }`
   placé AVANT les classes de bouton (qui posent leur propre encre et gagnent par spécificité).
   ⚠️ Ici l'emoji restait visible — le prochain bouton nu à libellé texte, lui, aurait été
   invisible. À garder en tête pour tout bouton sans classe.

**2026-09-09, v0.9.0 (données de démo) : 0 écart**, clair et sombre — le parcours le plus
large jusqu'ici, parce que c'est la démo qui le permet : les 6 onglets peuplés, le détail
d'un document à choix unique **et** d'un document à choix multiple, l'élection en cours,
son mode projection, l'élection close, plus 8 modales peuplées (édition d'élève, remarque
multi-ligne, options, définition de document, liste des manquants, modalités d'élection,
les deux confirmations de remplacement d'état, à propos).

Deux défauts trouvés — et tous deux **seulement parce que la démo existe** :
9. **Pastille PAI à 4,41:1.** Aucun élève des fixtures précédentes ne portait `pai` : la
   couleur n'avait jamais été mesurée. Le défaut n'était pas dans le choix de l'encre —
   `_contrastTextColor` faisait déjà de son mieux — mais dans le FOND : sur le rose vif
   `#ec4899`, la meilleure encre possible plafonne à 4,41. Passé au rose foncé `#c2185b`
   (5,87:1 en encre claire). ⚠️ Leçon : un accent posé en fond doit être choisi pour
   qu'une encre réelle passe ; `_contrastTextColor` ne rattrape pas une couleur trop claire.
10. **`avisManquants` comptait les champs PROF facultatifs.** Asymétrie avec
   `reponsesManquantes`, qui filtre sur `obligatoire`. Conséquence sur la fiche
   d'orientation de la démo : « 21 avis » en attente sur 24 élèves, parce que « Avis PP
   option 2 » est compté pour tout élève n'ayant demandé qu'une option — un compteur
   devenu du bruit. Filtré des deux côtés : 11 avis, qui veulent dire quelque chose.

**2026-09-09, v1.0.0 (audits complets) : 0 écart.** Le parcours le plus large du projet :
**20 états × 2 thèmes** (les 6 onglets, le détail d'un document à choix unique et d'un à
choix multiple, la liste et le détail des élections, la projection, l'élection close, et
9 modales peuplées) en 1864 px, **puis les mêmes 17 états × 2 thèmes en 320 px** — les
seuils de mise en page changent, donc les fonds aussi, donc la mesure doit être refaite.

Trois audits de plus, tous nouveaux :

**Rendu papier — MESURÉ, enfin.** On ne peut pas émuler le média `print` depuis la page,
mais on peut extraire les blocs `@media print` de la feuille de style et les réinjecter
hors media query : le rendu papier s'affiche alors à l'écran et l'auditeur le mesure.
**0 écart, en thème sombre comme en clair**, sur la synthèse (378 nœuds) et le PV (110) —
et la capture d'écran confirme du noir sur blanc. C'est la vérification que le bloc de
neutralisation d'impression fait ce qu'il promet ; jusqu'ici on le croyait sur parole.

**Responsive — 320 · 375 · 768 · 1024 · 1920 px.** Trois défauts structurels, tous du même
genre : *un contenu qui pousse la page au lieu de défiler dans son cadre*.
11. **Quatre tableaux larges sans conteneur de défilement** (élèves, documents, élections,
   candidatures) : 653 px de débordement de la liste des élèves à 375 px. Sur téléphone,
   c'est la barre du haut et les ONGLETS qui glissent hors de l'écran — on ne peut plus
   changer d'onglet. → `.rel-wrap` sur les six tableaux concernés (les listes de classes
   et d'options ont suivi, par uniformité).
12. **Les volets de l'élection refusaient de rétrécir.** La grille passait bien à une
   colonne sous 1000 px, mais un enfant de grille vaut `min-width: auto` : il ne descend
   pas sous la largeur mini de son contenu, et le `overflow-x` du tableau à l'intérieur
   ne peut alors JAMAIS s'enclencher. C'est le volet qui poussait la page, pas le tableau.
   → `min-width: 0` sur `.el-left` et `.el-right`, et `minmax(0, 1fr)` partout.
13. **Un `<select>` se dimensionne sur son option la plus longue**, sans regarder son
   conteneur — et le `<label>` flex qui l'enveloppe a le même `min-width: auto`. Il
   fallait les deux pour que le `max-width` morde.
Et un défaut de LISIBILITÉ, sur l'écran qui ne pardonne pas :
14. **Les noms tronqués en projection.** « Aaliyah LAMB… » projeté devant la classe désigne
   un élève à moitié. L'ellipse posée à l'étape 6 réglait la mise en page au détriment du
   texte — inversion des priorités sur le seul écran public de l'app. → le nom revient à
   la ligne en projection (il y a de la hauteur, pas de la largeur) ; l'ellipse reste dans
   la vue à deux volets, où l'infobulle porte le nom entier. Vérifié en 1024 × 768 et
   1920 × 1080, les deux géométries de vidéoprojecteur.

**Clavier — les 19 modales, une par une**, sur cinq critères : le focus arrive à
l'intérieur, `Tab` y tourne en rond dans les deux sens, `Échap` ferme, `Entrée` valide
là où c'est prévu (élève, relevé, option — avec l'undo qui rattrape), et le focus
**revient à l'élément qui a ouvert**. Ce dernier point manquait :
15. **Le focus n'était pas rendu à la fermeture.** Il retombait sur `<body>`, donc `Tab`
   repartait du haut de la page : ouvrir une modale depuis la 20e ligne d'un tableau de
   25 élèves et la refermer faisait perdre sa place. → l'ouvreur est mémorisé à
   l'ouverture et refocalisé à la fermeture, s'il existe encore (un rendu a pu le
   remplacer) et s'il est visible.

**Exemption assumée : les contrôles DÉSACTIVÉS.** Un bouton `disabled` porte
`opacity: .55`, ce qui fait tomber le rapport mesuré (2,31:1 sur le bouton « Importer »
de la modale d'import, à vide). WCAG 1.4.3 exclut explicitement les composants inactifs,
et c'est cette pâleur qui DIT « indisponible ». L'auditeur les écarte désormais — mais
c'est un choix, pas un oubli : si un bouton grisé devient illisible à l'usage, l'opacité
est le réglage à revoir.

**Onze tests statiques du design system** (`test/design-system.test.js`) tiennent
désormais ce qu'aucun audit à l'écran ne peut voir : la symétrie des tokens entre les
trois blocs (83 · 83 · 83) dans les deux sens, l'exigence qu'un token *utilisé* ait une
valeur en thème clair (les tokens hérités inutilisés dorment jusqu'au jour où quelqu'un
s'en sert), l'absence d'encre figée derrière un fond dynamique, la pose ET le retrait des
orientations d'impression, la présence d'une boîte focalisable dans chaque modale, et les
trois règles responsive ci-dessus. Avec leur méta-test : trois ensembles vides sont
« symétriques », une découpe cassée rendrait tout le fichier vacant.

⚠️ La mesure vaut pour ce qui existe. Elle est à rejouer à chaque étape, sur des écrans pleins.
⚠️ Et ce qui n'existe nulle part n'est jamais mesuré : les deux défauts ci-dessus dormaient
depuis les étapes 2 et 5. **Une donnée de démo exhaustive est un instrument d'audit**, pas
seulement une commodité d'accueil.

## Deux machines, un seul transport

⚠️ **Premier geste de toute session : `git pull`** (constaté le 2026-09-29 : un onglet
entier construit sur une copie en retard de quarante commits, cf. scores v1.32.0). Le
dépôt ne passe plus par Nextcloud : rien d'autre que git ne met ce poste à jour.

⚠️ **Ce dossier vit dans une arborescence Nextcloud, mais il ne doit PAS être synchronisé
par Nextcloud.** Il est un dépôt git, et git assure déjà le transport entre les postes via
`github.com/Belenos-Toutatis/suivi-pp`. Deux mécanismes qui recopient les mêmes fichiers
sans rien savoir l'un de l'autre, c'est une panne qui attend son heure : le 2026-06-19,
cinq fichiers **internes de `.git`** sont entrés en conflit dans le projet voisin.

### Où se pose l'exclusion — et où elle ne sert à RIEN

⚠️ **Le client ne lit qu'UN fichier d'exclusion « dans l'arbre » : `~/Nextcloud/.sync-exclude.lst`,
à la RACINE du dossier synchronisé.** Un `.sync-exclude.lst` déposé dans un sous-dossier est
**inerte** — il n'est même pas lu, il est synchronisé comme un fichier ordinaire.

C'est l'erreur commise le 2026-09-10 : le nom `.sync-exclude.lst` apparaît dans le binaire du
client, j'en ai conclu qu'il marchait partout. **Le nom d'un fichier dans un binaire dit qu'il
est connu, pas où il est cherché.** Corrigé après que l'utilisateur a signalé que la
vérification ne renvoyait pas zéro.

La règle est donc, à la racine (`~/Nextcloud/.sync-exclude.lst`), un chemin relatif :

```
gestion élèves/PP/Suivi PP
```

💡 **Ce fichier est lui-même synchronisé par Nextcloud** : il atteint donc les autres machines
tout seul, sans git et sans geste. Et le client l'a relu **sans redémarrage** (constaté :
exclusion effective en moins de 12 s).

⚠️ **Les dossiers de DONNÉES ne sont pas visés.** `gestion élèves/PP/Suivi PP json/`
(9 fichiers) est un dossier VOISIN, pas un sous-dossier : le motif ne l'atteint pas, et sa
synchronisation continue. C'est le partage à garder en tête — **le code par git, les données
par Nextcloud**, et les deux ne se croisent jamais.

### Comment le VÉRIFIER — deux pièges de mesure

⚠️ **Compter les entrées du journal de sync ne prouve RIEN.** La table `metadata` est un
registre de ce qui a été synchronisé par le passé ; elle ne se vide pas quand on exclut. Le
compte est resté à 222 alors que l'exclusion était en place.

⚠️ **Et lire ce journal avec `immutable=1` renvoie un instantané PÉRIMÉ** : SQLite ignore
alors le WAL, où sont justement les écritures récentes. Il faut copier les trois fichiers
(`.db`, `-wal`, `-shm`) et interroger la copie.

**Le seul test valable est une SONDE, avec son TÉMOIN** : déposer un fichier dans le dossier
censé être exclu *et* un autre dans un dossier certainement synchronisé, puis regarder lequel
arrive. Sans le témoin, « rien n'est arrivé » peut simplement vouloir dire que le client ne
tournait pas — c'est exactement ce qui s'est produit à la première tentative.

⚠️ **Corollaire à ne pas perdre de vue** : le dossier n'est plus sauvegardé par Nextcloud.
Le filet, c'est GitHub — donc **le travail non commité n'est protégé par rien**. Commiter
devient le geste de sauvegarde, pas une formalité de fin de tâche.

### Identité git — à poser sur chaque poste

⚠️ **Un poste neuf n'a pas d'identité git**, et `git commit` y échoue avec *« Author identity
unknown »* — au moment précis où l'on veut sauvegarder (constaté le 2026-09-11 sur le
portable Windows : `user.email` auto-détecté en `emman@CMONSURFACE.(none)`). L'identité est
une configuration **par machine**, elle ne voyage ni par git ni par Nextcloud. Les commits du
dépôt sont signés `Belenos Toutatis <emmanuel.wenner@gmail.com>` ; sur un poste où elle
manque, la poser une fois :

```
git config --global user.name "Belenos Toutatis"
git config --global user.email "emmanuel.wenner@gmail.com"
```

En attendant, `git -c user.name=… -c user.email=… commit` dépanne pour un commit, sans
rien écrire dans la configuration — c'est ce qui a servi pour `3c5d959`.

## Installation comme application (PWA)

Installable depuis la v1.8.0. Tout le reste était en place depuis l'étape 1 — manifeste,
service worker, métas iOS : **il ne manquait que les icônes**, et c'est justement le seul
critère qui bloque tout.

- ⚠️ **Chrome REFUSE d'installer une PWA sans icône PNG d'au moins 192 px déclarée dans le
  manifeste.** Un favicon SVG en `data:`, même parfait, ne satisfait pas ce critère : le
  menu « Installer » n'apparaît simplement pas, sans le moindre message. Il faut de VRAIS
  fichiers PNG, en 192 **et** 512.
- ⚠️ **`purpose: "maskable"` n'est pas un doublon décoratif.** Android rogne l'icône dans un
  cercle de 80 % du côté : une icône dessinée bord à bord perd ses coins. La version
  maskable porte donc le même dessin, plus petit, centré dans ce cercle, sur un fond qui va
  bord à bord. Les deux `purpose` coexistent — sans `any`, les surfaces qui ne masquent pas
  afficheraient l'icône rétrécie au milieu de son fond.
- ⚠️ **iOS IGNORE totalement les icônes du manifeste.** Sans `<link rel="apple-touch-icon">`,
  « Ajouter à l'écran d'accueil » sur iPhone pose une **capture de la page** comme icône.
  Et ce fichier-là est un **carré plein** : iOS applique son propre masque arrondi, donc des
  coins transparents fournis par nous s'afficheraient en noir.
- ⚠️ **Les icônes se préchargent dans `sw.js`.** Une app installée dont l'icône n'est pas en
  cache la perd au premier lancement hors-ligne, et l'OS ne va pas la rechercher plus tard :
  il garde le carré vide.
- ⚠️ **`cache.addAll` est écarté au profit d'un `add` par fichier.** `addAll` rejette EN BLOC
  dès qu'une ressource répond 404 : l'installation du service worker échoue entièrement et
  l'app perd le hors-ligne **sans que rien ne le signale**. Un fichier renommé et oublié dans
  `FILES` ne doit coûter que sa propre absence. L'échec est toléré, jamais silencieux
  (`console.warn`).
- Le dessin reprend **littéralement le favicon** (page claire, filet rouge de marge, lignes
  Seyès) : une icône qui ne ressemble pas à l'écran qu'elle ouvre ne se reconnaît pas dans une
  grille de trente. Seules les lignes ont été assombries — le `#c8d2e0` du favicon, calibré
  pour un onglet de navigateur, disparaît à 48 px sur un écran d'accueil ; l'icône utilise
  `#64768d`.
- Les icônes sont **générées par script** (`scripts/gen_icons.py`, PIL, supersampling ×4),
  pas dessinées à la main : refaire les cinq tailles après une retouche de couleur doit être
  une commande, pas une séance.

⚠️ **Le test qui compte** (`test/pwa.test.js`) lit les dimensions RÉELLES dans le chunk IHDR
de chaque PNG et les compare à ce que `sizes` déclare. Un manifeste qui annonce 512×512 en
pointant une image de 48 px passe toute vérification textuelle et fait échouer l'installation
en silence. Vérifié non vacant : icône réduite à 48 px → test 264 tombe ; lien iOS retiré →
265 ; icône sortie du préchargement → 266.

## Version & publication

**Publié le 2026-09-10** : dépôt public `Belenos-Toutatis/suivi-pp`, commit initial `640c64f`
(v1.7.2, 30 fichiers, 315 tests), GitHub Pages servi depuis `main` à la racine.
URL de l'app : `https://belenos-toutatis.github.io/suivi-pp/suivi%20pp.html`.

Trois choses n'ont pu être vérifiées qu'une fois en ligne, et le sont désormais :
les **trois polices embarquées se chargent** en HTTPS (la CSP `font-src 'self' data:`
tient — c'était le point où `default-src 'self'` aurait fait retomber l'app sur les
polices système, en silence), le **service worker s'enregistre** (impossible en
`file://`, donc jamais exercé jusque-là), et la **détection de mise à jour** répond 200
depuis l'origine `github.io` sans que la CSP la bloque.

⚠️ **`.gitignore` est la seule barrière entre un dépôt PUBLIC et des données d'élèves.**
`suivi-pp-*.json` y est, donc les sauvegardes de sync n'y vont pas. Vérifier
`git status --short` avant chaque commit reste le geste : un fichier exporté à la main
sous un autre nom (`5C.json`, `classe.json`) passerait la barrière.

```js
const APP_VERSION    = '0.1.0';                 // semver affiché
const APP_BUILD_DATE = '2026-09-09T00:00:00Z';  // sert UNIQUEMENT à la détection de MAJ
const APP_UPDATE_TOLERANCE_MS = 10 * 60 * 1000;
const APP_REPO_USER  = 'Belenos-Toutatis';
const APP_REPO_NAME  = 'suivi-pp';
```

⚠️ **À bumper avant CHAQUE push** : `APP_BUILD_DATE` toujours, à l'heure UTC **réelle** (`date -u +"%Y-%m-%dT%H:%M:%SZ"`, jamais une estimation — une date en avance fait s'annoncer l'app périmée à elle-même), et `APP_VERSION` quand la livraison le mérite.
⚠️ La détection interroge les commits **qui touchent le fichier de l'app** (`?path=<fichier>&sha=main&per_page=1`), pas le dernier commit du dépôt : sinon un commit de documentation déclenche une fausse alerte de mise à jour.

Commits en français, à l'impératif ou au constat, terminés par :
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Ordre de travail pour démarrer

1. **Squelette** : `suivi pp.html` avec le `<style>` complet copié de la référence (tokens + polices + filet + Seyès + thème sombre + neutralisation print), la CSP, `S` vide, `save`/`load`/`pushUndo`/`postLoadHook`/`_sanitizeCoreSections`/`_validateImport`, `toast`/`openMod`/`_uiConfirm`/`_uiPrompt`/`appAlert`, les helpers d'échappement et de contraste, la nav à 6 onglets. Plus `index.html`, `.nojekyll`, `manifest.json`, `sw.js`, `package.json`, `test/harness.js`.
2. **Onglet Élèves** + **module d'import CSV** (le plus gros bloc à copier). À la fin de cette étape, l'app sait charger une classe réelle.
3. **Import depuis un JSON de Plan de classe** — court, et il donne immédiatement de vraies données à manipuler.
4. **Onglet Carnets** : relevés, saisie du cumul, deltas, totaux de période. **Écrire les tests de calcul AVANT l'affichage** — c'est la logique la plus facile à se tromper et la plus coûteuse à déboguer dans une grille.
5. **Onglet Documents** : définition d'un document, champs, tableau de retours, duplication.
6. **Onglet Délégués**, dans cet ordre : le calcul et ses tests → la grille de dépouillement → le graphique en deux volets → le PV → (optionnel) la fenêtre projetable. Indépendant du reste — il ne lit que le roster, donc il peut se faire dès l'étape 3 s'il y a urgence de rentrée (l'élection tombe **avant la fin de la septième semaine**, soit mi-octobre). ⚠️ **À répéter en conditions réelles avant le jour J** : brancher un second écran, vérifier la lisibilité depuis le fond, et faire un dépouillement blanc avec correction d'un bulletin. Cet écran ne pardonne pas — il sert une fois par an, en public.
7. **Onglet Synthèse** + impressions.
8. **Sauvegarde/sync complète** : sync auto, horloge vectorielle, conflits, backups, checkpoints, jauge de mémoire, modale ⓘ.
9. **Données de démo** (`createDemo`) couvrant tout ce qui existe : une classe de 25 élèves fictifs, 8 relevés avec cumuls croissants, un `'A'`, ~~un cumul décroissant à signaler~~ (retiré le 2026-09-30, cf. ci-dessous), les trois documents modèles, des retours partiels, et une élection close à deux tours dont le premier n'a pourvu qu'un siège, plus une élection **en cours de dépouillement** (pour pouvoir régler la projection sans avoir à ressaisir des bulletins à chaque essai). ⚠️ **Révisé le 2026-09-30 (rappel de l'utilisateur : *« le nombre d'observations ne peut pas baisser au cours du temps »*) : la démo ne porte PLUS de cumul décroissant** — le repère ▼ reste dans l'app pour la faute de frappe (testé dans `carnets.test.js`), mais une donnée d'exemple qui descend montre une situation qui n'existe pas. `demo.test.js` vérifie qu'aucun cumul de la démo ne baisse. **Intention documentaire : chaque fonctionnalité doit être rencontrable sans avoir à la créer.** ⚠️ Corollaire tenu à chaque livraison (rappelé par l'utilisateur le 2026-09-11, v1.28.3) : **une fonctionnalité nouvelle entre dans la démo dans la même version**, sinon elle n'est ni auditée ni découverte. Ce que la démo ne PEUT pas porter : les PDF joints (ce sont des fichiers) et un handle de dossier.
10. **Audits** : contraste (les 4 conditions), impression, responsive téléphone/tablette, clavier des modales. Consigner les scores de référence dans ce fichier.

💡 Étapes 1 à 4 = l'app est déjà utile. Ne pas repousser l'utilisable derrière l'exhaustif.

## Hors périmètre, volontairement

⚠️ **Révision du 2026-09-09 — les PLACES rentrent dans le périmètre, pas les plans de salle.**
On reprend de Plan de classe la position de chaque élève et les **patterns de ramassage**
(la séquence de tables que l'enseignant marche pour récupérer les copies), **uniquement
pour trier des listes**. ~~On ne dessine aucun plan, on n'édite aucune place, on ne crée
aucun pattern : cela reste le métier de l'autre application.~~ La distinction tient en une
phrase — *savoir dans quel ordre passer* n'est pas *afficher une salle*.

⚠️ **Seconde révision, 2026-09-11 — le RÉGLAGE rentre aussi.** L'utilisateur veut corriger
sur place — nom de la salle, dimensions, qui est assis où, l'ordre de ramassage — sans
rouvrir l'autre application pour une chaise qui a changé (cf. *Données et réglages*). Le
périmètre reste étroit : **une grille, pas un plan** — ni îlots, ni tablettes, ni cases
vides dessinées, ni emplois du temps. Et l'écran rappelle qu'un import depuis Plan de
classe réécrit tout cela.

La **saisie** de notes et le **calcul** de moyennes d'élèves (c'est Plan de classe et Pronote — l'onglet 📈 Moyennes ne fait que LIRE l'export du bureau numérique), les plans de salle DESSINÉS (îlots, tablettes, cases vides), appel/absences, bulletins et remarques de bulletin, mentions de conseil de classe, élections autres que celle des délégués de la division (CVC, conseil d'administration, éco-délégués — le PP ne les organise pas), export XLSX/ODS (le CSV suffit à ce volume ; le module `_NotesExport` de la référence reste disponible si le besoin apparaît).

## Questions à poser à l'utilisateur avant de les décider seul

Aucune ne bloque le démarrage — les étapes 1 à 3 se font sans réponse — mais chacune change du code s'il faut y revenir après :

1. ~~**Plusieurs classes, ou une seule ?**~~ — **répondu le 2026-09-11 : une seule.** On est PP d'une classe ; le modèle reste multi-classes (une par année), une à la fois avec le sélecteur, et les grilles d'élèves ne connaissent que la classe courante (cf. table des arbitrages). *Le texte d'origine :* Le modèle est multi-classes (le PP peut suivre une classe par an, et les documents d'options observés couvrent 4 divisions). À confirmer : veut-il voir plusieurs classes en même temps, ou une seule à la fois avec un sélecteur ? *(Indice du 2026-09-09 : « on n'est PP que d'une seule » — une à la fois, avec le sélecteur.)*
2. ~~**Périodes**~~ — **répondu le 2026-09-09 : au choix**, réglage dans Données (cf. table des arbitrages).
3. ~~**Journal des contacts.**~~ — **répondu le 2026-09-09 : oui.** ⚠️ **Révisé en v1.46.14** (l'utilisateur : *« les contacts avec les parents, c'est un élément à part qui ne devrait pas être dans la même fenêtre »* ; et *« il y a encore marqué Observations — qu'il soit bien marqué Remarque »*) : la fenêtre `mrem` ne porte plus que la **remarque** (libellé *Remarque — texte libre*, Ctrl+Entrée enregistre) ; les contacts ont leur fenêtre **`mcontacts`** (`openContacts`), ouverte par la colonne **Contacts** de la liste (☎ n, ou ·) : ajouter, et corriger **date, type** (`journalSet`) et texte, 🗑. `_MODAL_RERENDER` redessine `mcontacts` (plus `mrem`, devenu un simple formulaire). « Observations » reste un synonyme d'en-tête reconnu à l'import pour la colonne Remarque d'un tableur — jamais un libellé affiché. `stu.journal = [{ id, date, ts, type, texte }]`, types `appel · rencontre · courriel · mot · autre`. ⚠️ **Il ne REMPLACE pas `stu.remarque`** : les observations qui ne sont pas des contacts (« peu d'apprentissage des leçons ») n'ont pas de date et n'en veulent pas. Les deux cohabitent dans la même modale. Le dernier contact remonte sur le bouton 📋 de la liste (« ai-je déjà appelé, et quand ? » est la question qu'on se pose en parcourant), dans la Synthèse et sur son impression.
4. ~~**Date de naissance des élèves.**~~ — **répondu le 2026-09-09 : ajoutée** (`stu.naissance`, saisie à la main, reconnue à l'import CSV et repris de Plan de classe). Elle débloque le départage automatique par l'âge. ⚠️ **Donnée personnelle de plus** : à mentionner dans le texte RGPD, et le champ reste facultatif — l'app fonctionne sans, elle demande alors de trancher.
5. **Modalités exactes de son établissement** : uninominal ou plurinominal, suppléants élus avec les titulaires ou séparément, départage. Les défauts viennent de sa propre présentation, mais le règlement intérieur de l'établissement prime — à vérifier une fois avant la première élection réelle.
6. ~~**Éco-délégués.**~~ — **répondu le 2026-09-11 : oui**, `election.type` (cf. *Après l'élection*). *Le texte d'origine :* Beaucoup d'établissements en élisent aussi, souvent par le même PP et selon la même procédure. Un simple champ « type d'élection » suffirait ; ne rien construire avant de savoir si le besoin existe.
7. **Alerte d'échéance.** Un document a une `dateEcheance` : faut-il un signalement à l'ouverture (« 3 fiches d'orientation manquantes, échéance dans 2 jours ») ?
8. ~~**Remplacement d'un délégué en cours d'année**~~ — **tranché le 2026-09-11 : option 1** (trace datée sur l'élection close, suppléant promu, PV d'origine intact), livrée en v1.29.0 — cf. *Après l'élection*. Les options écartées : la seule désignation sans vote (lien avec l'élection perdu), et l'élection partielle pour un siège sans suppléant (à ne construire que si le cas se présente — pour l'instant le siège est marqué vacant).
9. **Les autres besoins listés le 2026-09-11** et non retenus pour l'instant : rappels / choses à faire (journal à deux temps), signaux positifs (famille « Valorisation »), compteur d'absences relevé comme le carnet, contacts familiaux minimum sur la fiche, alerte d'échéance, courrier type aux familles, ~~photo trombinoscope~~ (livrée en v1.48.0, cf. *📷 Photos des élèves*), synthèse de fin d'année pour le PP suivant. L'utilisateur a choisi les cinq autres (bilans, synthèse de période, éco-délégués, heures de vie de classe) — livrés v1.25 → v1.28.
