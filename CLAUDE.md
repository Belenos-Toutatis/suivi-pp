# Suivi PP — Contexte projet

## Application

PWA **mono-fichier** de suivi des élèves dont l'utilisateur est **professeur principal** (enseignant de physique-chimie au collège, PP d'une classe de cycle 4, auteur et unique utilisateur). Besoins, par ordre d'importance :

1. **Relevés de carnet** — combien d'observations chaque élève a dans son carnet, à différentes dates.
2. **Documents administratifs** — qui a rendu quoi, et quand.
3. **Réponses portées sur ces documents** — choix de la famille (Devoirs Faits, options d'orientation…), avec un **avis du PP** quand il y en a un.
4. **Élection des délégués de classe** — candidatures, dépouillement, procès-verbal.
5. **Moyennes par matière** — l'export du bureau numérique, réimporté au fil de la période pour en suivre l'évolution (cf. *Moyennes par matière*).

### Ce que l'app remplace — à lire AVANT de concevoir quoi que ce soit

Le suivi existe en tableur, dans `../PP/`. **Ces fichiers sont la spécification réelle** :

- **`../PP/5C PP.xlsx`**, feuille `Papiers_2` — source principale : `Position · Nom · Prénom · DF · Observation 01/10/2024 · Observation 15/10/2024 · … (8 dates) · Remarque · Colonne1`, plus `Fiche de renseignement` et `Fiche d'orientation` marquées `X`.
- **`../PP/DF 5C.ods`** — `Classe · Nom · Prénom · DF`, valeurs **`OUI` / `NON` / `ULYSS`**.
- **`../PP/élection délégués.xlsx`** — dépouillement : 4 feuilles (`1er tour` · `Résultats 1er tour` · `2nd tour` · `Résultats 2nd tour`), **une ligne par bulletin numéroté**, **une colonne par binôme** (titulaire en ligne 1, suppléant en ligne 2), on coche.
- **`../PP/délégué election.md`** (+ `.html`, `délégué role.md`, `5c délégué.pdf`, `5e élections délégués 2025.pdf`) — présentation Marp projetée avant le vote : **la procédure exacte de l'utilisateur**, spécification de l'onglet Délégués.
- **`../PP/options rentrée 2026.xlsx`**, feuille `demandes options` — `DIV · NOM · PRENOM · option 1 demandée · Avis PP option 1 · option 2 demandée · Avis PP option 2 · OPT1 actuelle · OPT2 actuelle`. Options : `LATIN`, `BILINGUE`, `CATHO F`, `DNL`…

Quatre enseignements structurants :

1. ⚠️ **Le nombre d'observations relevé est un CUMUL, pas un incrément** (valeurs monotones non décroissantes par élève, ex. `7 · 8 · 8 · 10 · 11 · 14 · 16 · 18`). L'utilisateur lit un total dans le carnet ou Pronote et le recopie. Toute la conception du modèle en découle (cf. *Relevés de carnet*).
2. ⚠️ **Le tableur ne calcule PAS l'évolution** : c'est ce que l'app apporte (« combien depuis le dernier relevé »).
3. Certaines cellules valent **`A`** = élève absent au relevé. À distinguer d'un zéro et d'un vide.
4. La colonne `Remarque` est du **texte libre multi-ligne**, y compris le journal des contacts (« Appel à la mère le 11/10/2024 »). Le besoin d'un mot libre par élève est réel, indépendamment des documents.

### Décisions déjà arbitrées avec l'utilisateur

| Question | Réponse |
|---|---|
| Origine des élèves (2026-09-09) | **Import CSV/Pronote autonome** (module repris de Plan de classe) **+** lecture d'un export JSON de Plan de classe |
| Modèle des observations | **Compteur par date** (pas une entrée par observation) |
| Réponses des documents | **Rendu / pas rendu + date de retour**, **choix unique** dans une liste paramétrable, **choix multiple** |
| Hébergement | **Nouveau dépôt GitHub séparé** : origine distincte, donc `localStorage` et service worker propres |
| Périodes | **Au choix** : `prefs.periodMode` = `'semestre'` (défaut) ou `'trimestre'`, réglable dans Données. Rien n'est stocké par période, tout se recalcule. |
| Bornes de période | `prefs.periodStarts = { semestre: ['02-01'], trimestre: ['12-01','03-15'] }` (début des périodes 2 et 3, `MM-DD`, défauts à confirmer avec l'établissement). Année scolaire : 1er août → 31 juillet. |
| Ramassage | On ramasse plusieurs documents **à la fois** : grille élèves × documents dans l'onglet Documents, une case par croisement. ⚠️ **Trois** états : rendu, pas rendu, **sans objet** (élève absent à la date du document). Seul le retour se coche ici ; les réponses restent dans le tableau du document. |
| Données de démo | Posées **au premier lancement** (aucune sauvegarde locale, pas seulement « aucune classe » : sinon la démo reviendrait après chaque effacement), rechargeables et effaçables depuis 💾 Données. Année scolaire = celle d'« aujourd'hui − 10 mois », donc **toujours entièrement passée** (sinon relevés et échéances tomberaient dans le futur). |
| Branches et versions | **Un seul projet, une seule version** : le travail atterrit sur `main`, pas de branche ni de PR. `APP_VERSION` avance à chaque livraison. ⚠️ Pas de sas de relecture : tenir la barre **avant** de pousser (tests verts, audit de contraste rejoué). ⚠️ **« Tests verts » se VÉRIFIE, il ne se lit pas dans un tuyau** : `npm test 2>&1 \| grep -E "pass\|fail" && git commit … && git push` a poussé un test cassé (`cf69ee7`), car `grep` trouvait « fail 1 » et réussissait. Le commit se fait dans une commande SÉPARÉE, après lecture du résultat. |
| Postes de travail | **Plusieurs machines, jamais en même temps** : pas d'écriture concurrente, écarté par l'usage, pas par un verrou. ⚠️ Reste le cas asynchrone (portable refermé avant la fin d'un téléversement, reprise ailleurs) : d'où la sortie du dépôt de la sync Nextcloud. |
| Sessions distantes | **Écartées** : un nuage ferait code, tests et doc, mais pas les audits qui demandent de REGARDER l'écran (contraste 20 états × 2 thèmes, responsive 320→1920), qui ont trouvé les défauts 4 et 6, invisibles à tout test. |
| Moyennes | **Demandé** : lève « notes et moyennes » du hors-périmètre, mais seulement pour les **LIRE** (l'app importe l'export du bureau numérique, ne saisit aucune note, ne recalcule aucune moyenne d'élève). Un import = une photographie datée, gardée ; évolution calculée d'un import au suivant ; les colonnes nouvelles s'alignent seules. Statistiques : moyenne, médiane, écart type, nombre sous 10, nombre au-dessus de 10. |
| Import Plan de classe | **On ne reprend PAS toutes les classes du fichier** (PP d'une seule) : l'app liste les divisions (classes virtuelles exclues), l'utilisateur coche la sienne. |
| Une seule classe | **PP d'UNE classe.** Le modèle reste multi-classes (une par année, sélecteur en tête), mais tout ce qui met des élèves en lignes (ramassage, grille imprimée) ne connaît que la classe courante : un document partagé avec une autre division n'y fait pas entrer ses élèves. Garde unique dans `_ramRows`. |

Pas de texte libre comme *champ de document* : le mot libre vit sur l'élève (`stu.remarque`).

## Projet de référence — `plan de classe.html`

Chemin : `/home/ewenner/Nextcloud/gestion élèves/Plan de classe/plan de classe.html` (49 253 lignes, v2.48.0, commit `9956b6b`). Son `CLAUDE.md` voisin documente ~80 pièges payés au prix fort : **le lire pour toute question de convention**.

⚠️ **Règle n° 1 : on COPIE le code de référence, on ne le réécrit pas** (modules audités : contraste, fuzz, rétrocompatibilité, XSS, sync deux postes). Copier, renommer les clés `localStorage`, adapter les sections de `S`, garder les commentaires.

⚠️ Chercher par **nom de fonction** (`grep -n "function _impAnalyze"`), jamais par numéro de ligne (qui dérive).

### À reprendre tel quel

| Module | Fonctions |
|---|---|
| **Import d'élèves** | `_IMP_FIELDS`, `_impNormHeader`, `_impGuessField`, `_impNormGroupe/Civ/Amen/Date/Tags`, `_impSplitCodes`, `_impStripClassPrefix`, `_impDefaultCodeInterp`, `_impSplitFullName`, `_impSplitLine`, `_impDetect`, `_impGuessFieldFromValues`, `_impAnalyze`, `_impRefresh`, `_impRenderMapping/Codes/Preview`, `_impFileSelected`, `importStudents` |
| **Sauvegarde & horloge vectorielle** | `save`, `load`, `pushUndo`, `undoLast`, `redoLast`, `_clockBumpSelf`, `_clockBumpForward`, `_clockMergeMax`, `_clockOnLoad`, `_clockCompare` |
| **Sync auto + conflits** | `autoSaveSchedule`, `autoSaveDoIt`, `autoReloadCheck`, `_versionRelation`, `_contentFingerprint`, `_openConflictModal`, `_conflictKeepMine`, `_conflictTakeOther`, `_stashVersionToFile`, `_applyReloadedData` |
| **Versions & historique** | `listAndShowFiles`, `loadFromHandle`, `_makeNamedCheckpoint`, `_fileKind`, `_versionSummary`, `_fmtBytes`, rotation des backups |
| **Dernier fichier chargé (IndexedDB)** | `_idbPut`, `saveLastFile`, `_getLastFileRecord`, `_migrateLastFileToIdb`, `idbSaveHandleKey`, `idbLoadHandleKey` |
| **Jauge de mémoire locale** | `_byteLen`, `_probeLsHeadroom`, `_lsCapacity`, `_lsKeyBreakdown`, `_isAppLsKey`, `_storageBreakdown`, `_purgeLegacyStorage`, `_renderStorageGauge` |
| **Validation & robustesse** | `_validateImport`, `_sanitizeCoreSections`, `_auditState`, `_logRuntimeError` |
| **UI sans dialogue natif** | `toast`, `openMod`, `closeMod`, `appAlert`, `_uiConfirm`, `_uiPrompt`, `_modalReturnTo` / `_afterModalClose` |
| **Échappement & couleur** | `_escAttr`, `_escName`, `_escJsAttr`, `_html`, `_csvCellGuard`, `_safeColor`, `_contrastTextColor`, `_wcagContrast` |
| **Design system** | tout le bloc `<style>` de tête : `@font-face` base64 ×3, tokens `:root`, bloc `html[data-theme="dark"]`, bloc `@media print { html[data-theme="dark"] }`, filet rouge `body::before`, lignes Seyès, `--sp-*`, `--radius-*` |
| **Mise à jour** | `APP_VERSION` / `APP_BUILD_DATE` / `checkForUpdate` / `_passiveUpdateCheck` / modale `mabout` |
| **Harnais de tests** | `test/harness.js` + structure de `test/*.test.js` |

### À NE PAS reprendre

Plans de salle, placement, glisser-déposer, AESH, tablettes, QCMCam/ArUco, sonomètre, minuteur, évaluations, bulletins, mentions de conseil, disciplines, classes recomposées. Rien de tout cela n'a de place ici (à l'origine : l'app ne connaît ni salle ni note).

💡 À conserver du module d'import : **`stu.tags`** (codes Pronote type `4B-LATIN`, `3B-BIL-LCE`), matière des choix d'options ; le panneau « Codes de groupes rencontrés » sait les reconnaître.

## Fichiers du projet

- `suivi pp.html` — l'application entière (HTML + CSS + JS)
- `index.html` — redirection depuis la racine GitHub Pages (meta refresh + `location.replace`), pour éviter l'URL avec `%20`
- `.nojekyll` — **indispensable**, sinon Jekyll prend `README.md` comme index et ignore `index.html`
- `manifest.json`, `sw.js` (network-first)
- `icons/` — 5 PNG (192 et 512 en `any` et `maskable`, icône iOS 180)
- `README.md`, `LICENSE` (MIT), `CLAUDE.md`
- `.gitignore` — `suivi-pp-*.json`, `*.bak`, `*.tmp`
- `scripts/audit_static.js`, `scripts/audit_browser.js` (les deux auditeurs, cf. *Audits : méthode et leçons*), `scripts/audit_parcours.js` (parcours des états et feuilles imprimées, à charger après `audit_browser.js`), `scripts/gen_icons.py`, `scripts/gen_recap_fixture.py` (faux récapitulatif MBN des tests)
- `fiches-suivi/` — **l'application des fiches de suivi** (individuelles · collectives · classe), reprise le 2026-10-10 (cf. *Fiches de suivi*), avec ses sources, ses tests de bout en bout et son propre `fiches-suivi/CLAUDE.md` — à lire avant d'y toucher
- `test/harness.js`, `test/*.test.js`, `test/fixtures/` (dont `trombi/fake-trombi.pdf`, faux trombinoscope), `package.json` (`npm test` → `node --test "test/*.test.js"`)
  ⚠️ Le glob, pas `node --test test/` : sous Node 22 l'argument-répertoire échoue en `MODULE_NOT_FOUND` ; le glob n'exécute en plus que les `*.test.js` (pas `harness.js`).

Dépôt : **`suivi-pp`** sous `Belenos-Toutatis` → `belenos-toutatis.github.io/suivi-pp/`.

Clés `localStorage` préfixées **`suiviPP`** (`suiviPP_v1` données, `suiviPP_theme`, `suiviPP_deviceId`, `suiviPP_autoSync`…). ⚠️ Préfixe **différent** de `planClasse`, et `_isAppLsKey` adaptée.
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
  fichesSuivi:{ [classId]: { etat, noms, demo? } },     // 📋 Suivis : l'état (opaque) de l'app des fiches de suivi
  disciplines:{ [did]: { id, nom, onglet, actif, ord, builtin, code? } },   // les onglets de cette feuille ; code = l'option (v1.62.0)
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
  // Délégués DÉSIGNÉS sans vote dans l'app — élection sur papier, classe reprise :
  delegues: { date: 'YYYY-MM-DD', titulaires: [sid], suppleants: [sid], note },
  ecoDelegues: { … même forme … },   // éco-délégués désignés sans vote (v1.27.0)
  // Heures de vie de classe (v1.28.0) — journal de la CLASSE ; date future = thème « à venir ». Aucun sid.
  vieClasse: [ { id, date: 'YYYY-MM-DD', ts, titre, texte } ],
}

salle = {
  id,                      // PRÉFIXÉ 'pdc_…' à l'import
  nom, rows, cols,
  patterns: [ { id, nom, order: [ 'r,c', … ] } ],   // ordres de ramassage DESSINÉS dans Plan de classe
}

stu = {
  id, nom, prenom, classe_id,
  naissance,               // 'YYYY-MM-DD' | null — départage d'une égalité aux délégués
  civilite,                // 'M' | 'F' | null
  groupe,                  // 1 | 2 | 3 | null   (repris de l'import)
  tags: [ ...tagIds ],     // codes Pronote : LATIN, BILINGUE, DNL…
  // aménagements, repris du même import que Plan de classe (mêmes noms de champs, un JSON de l'une est lisible par l'autre) :
  ppre, pap, gevasco, ulis, ulis_incl, upe2a, upe2a_incl, pai,
  agrandissement, tiers_temps,
  arrivalDate, departureDate,   // 'YYYY-MM-DD' | null — départ = 1er jour d'absence
  remarque,                // texte libre du PP (colonne « Remarque » du tableur)
  regime,                  // 'DP' | 'EXT' | 'INT' | absent — demi-pensionnaire, externe, interne (v1.45.1)
  joursDP,                 // ['lun', 'mar', …] | absent — jours de demi-pension (v1.45.2, DP seulement)
  entree,                  // code du régime d'ENTRÉE ('A1', 'A2') | absent (v1.45.2)
  sortie,                  // code du régime de SORTIE ('D1', 'D2', 'D3') | absent (v1.45.1, révisé v1.45.2)
  // Observations notées dans Mon Bureau Numérique (v1.46.0) — des ÉVÉNEMENTS, pas un cumul.
  obsMbn: [ { id, ts, date: 'YYYY-MM-DD', heure: 'HH:MM' | '', type, motif, par, info } ],   // absent = aucune
  // Absences et retards lus dans le récapitulatif vie scolaire de MBN (v1.58.0) — des ÉVÉNEMENTS.
  absMbn: [ { id, ts, kind: 'absence'|'retard', debut, hDebut, fin, hFin, motif, regul, valable, seances, duree /* min */, compte } ],
  // Journal des contacts avec la famille — DATÉ et qualifié, à côté du texte libre.
  journal: [ { id, date: 'YYYY-MM-DD', ts, type: 'appel'|'rencontre'|'courriel'|'mot'|'autre', texte } ],
  // Incidents et instances : `type` pointe le catalogue S.instances ; `pdf` n'est qu'une RÉFÉRENCE vers le dossier des pièces jointes, jamais le fichier.
  incidents: [ { id, date: 'YYYY-MM-DD', ts, type: instanceId, objet, texte, pdf: null | { nom, fichier, taille } } ],
  // Bilans de période : la PÉRIODE se déduit de la date (cf. *Bilans de période*).
  bilans: [ { id, date: 'YYYY-MM-DD', ts, type: 'conseil' | 'miperiode', texte } ],
  // Décisions prises en réunion pour un moment de bilan (v1.46.13) — une par moment, à côté du bilan (même règle de moment que `_bilanCible`). Absent = aucune.
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
  suiviRetour: true,       // faut-il suivre le retour du papier ? (certains documents sont informatifs)
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

⚠️ **`counts[sid]` est le TOTAL lu dans le carnet, jamais un incrément** (un delta obligerait à soustraire de tête, et une saisie oubliée deviendrait indétectable).

- **L'évolution est CALCULÉE, jamais stockée** : `delta = n − dernier cumul connu strictement antérieur`, en **sautant les `'A'`** et les vides. Premier relevé d'un élève → le delta vaut le cumul.
- ⚠️ **Un cumul qui DIMINUE est signalé, jamais corrigé** (faute de frappe probable, mais ce peut être un carnet remplacé) : repère sur la cellule, infobulle de l'attendu, rien n'est réécrit.
- **`'A'` n'est ni `0` ni le vide** : `0` = carnet vu, rien noté ; `''` = pas relevé ; `'A'` = élève absent. Trois affichages et traitements distincts dans le delta. Convention `codeAbsent` de Plan de classe : code **paramétrable**, aucun texte visible ne l'écrit en dur (cf. `_codeA()` là-bas).
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
- **Date de naissance** (`stu.naissance`) : saisie à la main, reconnue à l'import CSV et reprise de Plan de classe ; elle permet le départage automatique par l'âge aux élections. ⚠️ Donnée personnelle de plus : citée dans le texte RGPD ; champ **facultatif** — sans elle, l'app demande de trancher.

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
- **Où l'on voit les absences** : colonne **Absences** des Indicateurs (période courante, « 🕒 2 abs. · 5 h · 1 ret. », rouge s'il y a du non valable ; clic → `absencesUI` ; seulement si la classe en a), vues *Préparer le conseil* et *Appeler les familles* (« abs » ne compte pas pour reconnaître une vue enregistrée), carte *Absences et retards* de la fiche (bornée au moment), synthèse de période, fiche imprimée, **carte de chaleur** (groupe *Absences et retards*, un mois par case + Total, rouge si non valable, case remplie → liste, case vide inerte). Calcul pur `_absMbnResume` : un événement compte dans la période où il commence ; demi-journées NON calculées (non déductibles). « non valable » gardé dans le texte court (`_absMbnTexte(e, true)`). Démo : dix absences et retards.
- Fixture `test/fixtures/recap-mbn-invente.pdf` (`scripts/gen_recap_fixture.py`, noms inventés). ⚠️ **Vérifié sur la seule fixture** : le vrai fichier est à essayer par l'utilisateur (la revue montre tout avant d'appliquer).

### Documents — un même papier porte plusieurs réponses

Devoirs Faits : `suiviRetour: true` + un champ `choix` à trois options `OUI / NON / ULYSS`. ⚠️ **Trois, pas deux** (le tableur porte `ULYSS`, dispositif alternatif) : un booléen aurait été trop étroit. Orientation : plusieurs champs dont des champs **`par: 'prof'`** (« Avis PP option 1 »). ⚠️ Le compteur « réponses manquantes » ne compte que ce qu'on **attend des familles**, sinon le document reste incomplet tant que le PP n'a pas rendu son avis.

- **`rendu` et `reponses` sont deux axes indépendants** : papier rendu sans réponse cochée (illisible, à relancer), ou réponse connue avant le papier (dite à l'oral). Ne pas dériver l'un de l'autre.
- **Ordre des documents** réglé par la **poignée ⋮** (`docReorder`) ; flèches ↑ ↓ au CLAVIER sur la poignée focalisée (`docMove`) ; `Échap` annule le glisser.
  - ⚠️ **Ne rien déplacer dans le DOM pendant le glisser** : la poignée est DANS la ligne ; déplacer la ligne (`insertBefore`) reparente l'élément qui détient la capture du pointeur, les `pointermove` cessent et le glisser se fige après un saut. On DESSINE l'insertion (trait rouge) et on ne touche à l'ordre qu'au relâchement.
  - ⚠️ **Recalculer la cible sur le `pointerup`**, pas sur le dernier `pointermove` (geste rapide, stylet).
  - `touch-action: none` sur la poignée rend le glisser possible au DOIGT (sinon le navigateur lit un défilement) ; le glisser natif HTML5 (`draggable`) est écarté pour la même raison.
- ⚠️ `docReorder` **renumérote tous les `ord` avant de repositionner** (dupliqués après import, duplication, démo : réordonner des valeurs identiques ne changerait rien), puis **redistribue les mêmes places** entre les seuls documents affichés (archivés masqués et autres classes gardent la leur). Sémantique **retirer-puis-réinsérer**, pas échanger.
- **Dupliquer un document** : geste central de la rentrée suivante — mêmes champs et options, retours vides (miroir de `_evalDuplicate`).
- Les **modèles** de la démo couvrent les trois formes réelles : Devoirs Faits (choix à 3), fiche de renseignement (retour seul, aucun champ), fiche d'orientation (choix multiple d'options + avis PP).

## Fiches de suivi

Application « Fiches de suivi » (comportement cours par cours : fiches individuelles avec bilan pour la famille, suivi collectif de quelques élèves, fiches de classe), reprise d'une autre session. Ses sources vivent dans **`fiches-suivi/`** (dépôt public : le nom réel du collège y est remplacé par « Collège Les Tilleuls »). Elle n'évolue plus qu'ici. Détail : `fiches-suivi/CLAUDE.md`.

**Une seule source, deux livraisons** (arbitré) :
1. **Autonome**, pour les collègues : un seul fichier HTML **vierge**, qui s'enregistre dans sa propre page ; la classe se saisit, se colle, s'importe d'un tableur ou **d'une sauvegarde de Plan de classe (.json)**.
2. **Intégrée** à Suivi PP : onglet **📋 Suivis** (après Avis des collègues) qui affiche la fiche dans un cadre ; son état est rangé dans les données de Suivi PP (sync, sauvegardes, Ctrl+Z), les élèves viennent de la classe.

**L'onglet 📋 Suivis** (bloc « 📋 FICHES DE SUIVI » du script) :
- La fiche est rangée **compressée** dans `suivi pp.html` (`<script type="application/octet-stream" id="fiches-suivi-app">`, entre `<!-- FICHES-SUIVI-DEBUT` et `<!-- FICHES-SUIVI-FIN -->`, ≈ 300 Ko), **écrite par `fiches-suivi/app/assemble.py`**, jamais à la main (`test/fiches-suivi.test.js` vérifie son empreinte).
  - ⚠️ Placée avant le script de l'application : le harnais des tests prend le DERNIER script.
  - ⚠️ Toute évolution de la fiche change `suivi pp.html` : version et date à avancer.
- `renderSuivis` la décompresse une fois (`DecompressionStream('deflate-raw')`), y pose **nos polices** (`_suivisPolicesCSS` : JetBrains Mono, puis ce qui est entre `/* ANDIKA-DEBUT */` et `/* LM-FIN */` ; d'où le sous-ensemble élargi des polices de Suivi PP, `UNI_LARGE` de `scripts/gen_fonts.py`, lancé avec `--html`) et la charge dans un cadre par **`srcdoc`**, gardé vivant d'un onglet à l'autre.
  - ⚠️ Pas une URL de blob : en `file://`, son origine « null » refuse les changements d'ancre, donc toute la navigation de la fiche (cf. `fiches-suivi/CLAUDE.md`, *Version intégrée*).
- **`S.fichesSuivi[classId] = { etat: { app, format, savedAt, S }, noms: { sid: 'NOM Prénom' }, demo? }`** : l'état de la fiche est OPAQUE ici (elle le normalise à la lecture) ; `noms` = les noms envoyés la dernière fois (un renommage d'ici suit là-bas) ; `demo: true` = la fiche y fabrique sa démonstration (posé par `createDemo`). Section dans `_emptyState`, `_sanitizeCoreSections`, `_validateImport` ; `_purgeClassRefs` l'emporte, `_purgeStudentRefs` retire `noms[sid]` (dans la fiche l'élève n'est qu'un NOM : sa ligne y reste, signalée « pas dans Suivi PP »).
- **Messages** (`_suivisEnvoyer`, `_suivisRecevoir`, écouteur `message` vérifié par sa source) : `charger` n'est envoyé que si le suivi, la liste de la classe ou la classe affichée a changé (Ctrl+Z, sync, changement de classe, élève renommé…), sinon la pile seule. La classe envoyée (`_suivisClasse`) : « NOM Prénom » par ordre alphabétique, « Groupe N », options par leur CODE (court, affiché dans l'emploi du temps de la fiche), arrivée, départ ramené au dernier jour présent.
- ⚠️ **Le suivi renvoyé se range sous la classe QUE LA FICHE AVAIT** (`m.cle`), pas sous `S.cur` : une frappe en attente part au moment où l'on change de classe.
- ⚠️ **Ctrl+Z est le nôtre** : `etape` → `pushUndo()` avant de ranger ; `retirer` → `_undoAnnulerRefus` si le cran est encore le dernier et contient ce suivi.
  - ⚠️ Comparer le SUIVI, pas l'enveloppe (la fiche date chaque envoi), sinon un cran vide.
  - Une frappe groupée ne pose pas de cran mais avance l'horloge (`_clockBumpSelf`).
  - Ctrl+Z demandé par la fiche : `undoLast(true)` (silencieux : la fiche dit ce qui a été annulé).
- ⚠️ **Page qui se ferme** : la fiche n'envoie la frappe d'un commentaire qu'après 0,4 s ; un message posté pendant la fermeture n'arriverait pas. `beforeunload` appelle `_suivisRecupererFrappe`, qui la reprend de façon SYNCHRONE (`__ficheEnAttente` du cadre, même origine grâce au `srcdoc`) avant `save()`. Testé non vacant (sans elle, `e2e_integre` perd le commentaire).
- Thème et polices de Données suivent (`_suivisApparenceMaj`, appelée par `toggleAppTheme` et `_applyPolices`) ; Ctrl+P sur l'onglet → l'impression de la fiche. État en `var` : `_applyPolices` peut tourner avant que le bloc soit évalué.
- RGPD : le bandeau cite les fiches de suivi. Démo : la fiche de la 5e C se fabrique à la première ouverture de l'onglet.

**Dans la fiche élève** : carte **📋 Fiches de suivi** du tableau de bord (après Incidents), des **faits** (vue Faits et rédaction, insérables dans le bilan) et une partie **Fiches de suivi** de la fiche imprimée (`FICHE_PRINT_PARTS`, cochée d'office). Contenu : suivi individuel (avis, réussite, chaque objectif fiche après fiche, bilans), suivi collectif (réussite, « I », absences, tendance, semaine par semaine, commentaires), fiches de classe (incidents, pour 10 cours, retenues, codes, matières, remarques des enseignants), **bornés au moment** choisi (`_ficheBornes`).
- ⚠️ **Les chiffres sont calculés par l'APPLICATION DES FICHES**, jamais ici : `__ficheResumeEleve(etat, nom, du, au)` du cadre (même origine) prend le suivi de la classe, échange un instant son état courant et appelle SA fiche élève (`donneesSynthEleve`, `famillesUtilisees`, crans de réussite `niveauReussite`) ; il rend des données simples que `_suivisCorpsHTML` met en forme et échappe. Refaire ces calculs ici ferait deux vérités.
- Il faut donc le cadre : `openFiche` le prépare (caché, dans l'onglet) quand la classe a un suivi. Tant qu'il n'est pas prêt, la carte dit « Lecture… » et `_suivisCarteMaj` la complète ensuite **sans redessiner la fiche** (un bilan en cours de frappe n'est pas touché). L'impression l'attend (`_suivisPretAttendre`). Mémo par suivi (`_suivisResumeMemo` : le même objet `etat`, remplacé à chaque modification, rend le même résumé).
- Pas de carte sans suivi pour la classe ni pour un élève absent du suivi ; « rien sur ce moment » hors de la période du suivi.
- **↗ Ouvrir** (`ficheVersSuivis`) : l'onglet 📋 Suivis, sur la fiche élève de l'appli (`aller` → `#eleve/NOM Prénom`).
- Tokens `--i-suivi` (la carte) et `--suivi-o-bg/-fg` (réussite « orange »), aux trois endroits.
- **Calcul groupé** : `_suivisResumes(cls, b)` demande toute la classe d'un coup (`__ficheResumeEleves`) et le mémorise par classe et bornes ; `_suivisResume` y prend un élève. Pas encore de suivi (démonstration à fabriquer) : la classe est renvoyée à la fiche (`_suivisEnvoyer`), même si les données ont été remplacées depuis (démo rechargée, import, sync).

**Dans la carte de chaleur** : groupe **📋 Fiches de suivi**, sur le moment : *Indiv.* (réussite du suivi individuel), *Collectif* (réussite), *Classe* (incidents des fiches de classe). Une colonne n'existe que si un élève de la classe y a quelque chose ; crans de l'appli des fiches (rouge `ch-lo`, orange `ch-mi`), détail en infobulle ; clic → `suivisAllerUI(sid, hash)` (le suivi individuel, sinon la fiche élève de l'appli). Replié : la case la plus préoccupante. « … » tant que le cadre lit le suivi ; la carte se redessine quand il est prêt.

**Les réglages COMMUNS aux deux applications** (arbitré : les parties communes communiquent) : `_suivisCommun` (→ fiche, dans `charger` puis par le message `commun` dès qu'ils changent) et `_suivisCommunRetour` (← fiche, à chaque suivi reçu) :

| Fiche | Suivi PP |
|---|---|
| `classe` | `cls.nom` |
| `etablissement.nom` | `prefs.etablissement` (celui du PV) |
| `referent` | `prefs.avisNom` (« Votre nom », signature des avis) |
| `decoupage` (mode, fins) | `prefs.periodMode`, `prefs.periodStarts` (fin d'une période = veille du début de la suivante) |
| `matieres[i].prof` | l'enseignant de la discipline : `_discProfs` (tapé dans Données, sinon le dernier import de moyennes) |
| (pinceau de l'emploi du temps) | le code d'option de la discipline : la matière se peint d'office pour le groupe de l'option |
| `matieres[i].champ` | le domaine de la discipline, `_discDomaine` (langues, lettres, sciences, arts, EPS, autre : mêmes clés des deux côtés) |

- Une matière de la fiche est rattachée à une discipline par **`_ficheMatDisc`** : le choix fait dans 💾 Données, sinon `_matiereDiscAuto` (mêmes motifs que pour les moyennes ; « Hist.-Géo. » par l'onglet de la discipline). « Vie de classe », « Devoirs faits », une langue non reconnue restent à la fiche.
- **Rattachement manuel** (Données, sous celui des matières des moyennes) : tableau *Matière (fiches de suivi) · Discipline · Enseignant envoyé à la fiche* (`_ficheMatieresClasse` : matières de l'emploi du temps du suivi de la classe, une ligne par nom) ; choix : automatique, une discipline, ou **aucune** (propre à la fiche).
  - `S.prefs.matieresFiche = { [nom normalisé]: did | '' }`, **par NOM, pour toutes les classes** (renommée dans la fiche, la matière redevient automatique) ; remplacé, jamais modifié en place ; une discipline supprimée → automatique.
  - `ficheMatSetDisc` (pur), `ficheMatDiscUI` (un cran d'undo, rien si rien ne change, puis `_suivisCommunMaj`). Sans suivi pour la classe, le tableau le dit. Démo : « Vie de classe » et « Devoirs faits » en « aucune ».
- **Suivi PP → fiche** : une valeur vide ne remplace rien ; les dates du découpage ne sont envoyées que si elles ne sont plus celles d'office (sinon la fiche garde les siennes, calées sur les vacances).
- **Fiche → Suivi PP** : une valeur est reprise si Suivi PP n'en avait pas, ou si elle vient d'être MODIFIÉE dans la fiche (elle diffère de celle du suivi d'avant, qui l'avait déjà), dans le cran d'annulation du geste. Un enseignant ramené à celui des moyennes redevient automatique (la saisie est retirée).
  - ⚠️ **Sans suivi d'avant, rien n'est « modifié »** : la démonstration des fiches (fabriquée avant d'avoir reçu les enseignants) écrasait ceux des moyennes par ses noms fictifs.
- ⚠️ Changer l'enseignant d'une matière change celui de TOUTES les fiches, passées comprises ; un remplaçant pour un temps se dit dans la fiche (« changements d'enseignant », « absences longues »), qui ne sont pas communs.
- Dans la fiche, les champs communs portent un trait bleu et l'infobulle le dit (`marquerCommunsHote`).

**Apparence de Suivi PP pour les deux** (`fiches-suivi/app/theme.css`) et **ses polices** embarquées (`python3 scripts/gen_fonts.py --fiches` → `fiches-suivi/app/polices.css`, mêmes familles, sous-ensemble élargi) : Andika à l'écran, Latin Modern au papier, réglables ; les feuilles affichées à l'écran prennent la police d'impression, un bouton **Aa** les bascule (arbitré). Dans Suivi PP, l'onglet suit les réglages de police de Données (pas de second réglage).

## Moyennes par matière

L'utilisateur exporte les moyennes du bureau numérique en CSV (export réel : `moyennes_5e_premier_semestre_6eme_5eme_4eme_20260929.csv`) :

```
Nom et prénom de l'élève;Périodes;ANGLAIS LV2(Mme X);…;MATHEMATIQUES(M. Y, Mme Z);…;Moy.
MARTIN Noé;Premier semestre 6ème 5ème 4ème;11;12;15;9;14;12,2
```

Point-virgule, virgule décimale, UTF-8 (repli Windows-1252 gardé), une matière par colonne avec ses professeurs entre parenthèses, la moyenne générale en dernier, des cases VIDES quand un collègue n'a pas encore noté. Il **réimporte au fil de la période** pour voir l'évolution, et **des colonnes apparaissent** d'un fichier à l'autre.

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

- **Un import est une PHOTOGRAPHIE, jamais réécrite.** L'évolution se calcule entre deux imports ; rien n'est stocké en delta (même logique qu'au carnet : on stocke ce qu'on a lu).
- ⚠️ **Une matière est reconnue par son NOM normalisé** (`_moyNorm` : sans accents, casse ni ponctuation), via le catalogue `S.matieres`, **jamais par sa position** dans le fichier : une colonne nouvelle s'insère n'importe où sans décaler les autres. L'ordre des colonnes à l'écran est celui du catalogue (première apparition), pas celui du fichier du jour.
- ⚠️ **Une colonne ENTIÈREMENT vide ne crée pas la matière** dans cet import (« aucune note saisie », pas une matière) : sinon chaque export ferait naître des colonnes mortes. Elle apparaît au premier import où un collègue a noté, signalée `nouvelle` (`_moyColNouvelle`) par rapport à l'import précédent de la période.
- **Trois états d'une case, comme au carnet** : un nombre (⚠️ **0 compris, c'est une note**), un **code** du bureau numérique (`Abs`, `Disp`, `NN`…) conservé tel quel, l'**absence de clé** = pas de note. Seuls les nombres entrent dans les statistiques ; un code s'affiche en italique, un vide en tiret.
- ⚠️ **L'évolution ne traverse pas les périodes** : les moyennes repartent de zéro à chaque période, comparer S2 à S1 donnerait un Δ sans sens. `_moyPrev` ne cherche que dans les imports de la **même** `periode`, et remonte au dernier import où la case était un NOMBRE (un code ou un vide ne se soustrait pas).
- **Même date + même période = REMPLACEMENT**, pas empilement (réexport après une saisie). L'aperçu le dit avant l'import ; changer la date garde les deux.
- **Plusieurs périodes dans un même fichier** (export annuel) → un import par période.
- **Rapprochement des élèves** (`_moyMatch`) : clé = mots du nom complet sans accents ni casse, **triés** (l'export écrit « NOM Prénom », la classe connaît nom et prénom à part ; les prénoms composés perdent leur trait d'union d'un côté ou de l'autre).
  - ⚠️ Deux homonymes parfaits dans la classe → **rien n'est deviné**, la ligne passe au rattachement manuel.
  - Une ligne non reconnue n'est jamais importée d'office : l'aperçu propose un sélecteur, par défaut « ignorer ». Les élèves de la classe **absents du fichier** sont nommés dans l'aperçu.
- L'import ne crée **aucun élève** : le roster vient de l'onglet Élèves.

### Statistiques — deux choix à ne pas « corriger »

- ⚠️ **Écart type de POPULATION (σ, divisé par n)** : la classe n'est pas un échantillon, c'est la population entière. C'est `ÉCARTYPE.P` du tableur, pas `ÉCARTYPE` (n − 1). Un écart avec un tableur vient de là.
- ⚠️ **« Sous 10 » = strictement moins de 10 ; 10 pile compte dans « 10 et plus »** : la moyenne est atteinte. Les deux compteurs somment toujours à `n` (testé).
- Les statistiques du tableau portent sur les **lignes affichées** (élèves présents, plus les partis qui figurent dans l'import) ; celles de la vue Évolution, sur tout l'import.
- La ligne « Moyenne » porte l'évolution de la **moyenne de classe** depuis l'import précédent ; la vue 📈 Évolution déroule n'importe laquelle des huit statistiques, import après import.

### Affichage

- **Intitulés abrégés** (`_moyAbbr` : SVT, EPS, Maths, Hist.-géo.…), nom complet et professeurs en infobulle. Seul ce qu'on sait abréger l'est ; une matière inconnue garde son intitulé (les intitulés complets, coupés en plein mot sur onze colonnes, rendaient la grille illisible).
- Cases **sous 10 sur fond d'alerte** (`--alert-bg` / `--alert-fg`), Δ en `--ok-fg` / `--danger-fg`, et dans une case d'alerte le Δ reprend l'encre de la case.
- Tri par moyenne générale, par évolution, par nombre de matières sous 10, ou par une matière (clic sur l'en-tête) : **toujours la plus basse d'abord** (on trie pour voir qui décroche).
- **Fiche élève** : section 📈 en lecture seule (la source est l'import), une table par période, **transposée** (matières en lignes, imports en colonnes : beaucoup plus de matières que d'imports). **Liste des élèves** : colonne « Moy. » (dernière moyenne générale, Δ, nombre de matières sous 10), triable par l'en-tête (la plus basse d'abord au premier clic, les élèves sans moyenne au bout dans les deux sens), reprise à l'impression de la liste.
- **Cadre figé** (`.rel-wrap.frozen`, cf. *Grilles*) : les deux vues rendent `[tableau, légende]` et c'est `renderMoyennes` qui pose le cadre entre `_wrapScrollKeep` et `keep()` : changer d'import ou de tri ne renvoie pas la grille en haut à gauche.
- **Statistiques retenues** : `S.prefs.moyStats`, UN réglage pour l'écran (volet *Σ Statistiques en pied* de la barre) et pour le papier (modale d'impression), décochables. `_moyStatsShown()` filtre et remet dans l'ordre canonique ; `setMoyStat` pose un `pushUndo` comme `setPref`, et n'empile rien si rien ne change. ⚠️ Le tableau est toujours **remplacé**, jamais modifié en place : `DEFAULT_PREFS.moyStats` est la même référence que celle posée par `postLoadHook` (testé).
- **Impression** (bouton 🖨 et Ctrl+P ouvrent la modale `mmoyprint`, jamais l'impression directe) : la vue affichée (même import, même tri) sur **une page paysage A4 ou A3**, taille de texte calculée par `_printFitMeasure` (cf. *Synthèse de période imprimable*), annoncée dans la modale avant d'imprimer. Feuille `.pp-t.pp-moy` : colonnes fixes (nom 17 %, matières à parts égales, Moy. 7 % séparée d'un filet, « < 10 » 4 %), chiffres centrés, rangées alternées, statistiques en pied sur fond gris.
  - ⚠️ Sur le papier, « sous 10 » se marque en **gras**, pas en couleur : la feuille sort souvent en noir et blanc.
  - ⚠️ En-têtes **en casse normale** : en capitales, « FRANÇAIS » se cassait en « FRANÇAI / S ».
  - Mesure de référence (27 élèves, démo à onze matières) : 7,75 pt en A4 avec les huit statistiques, 8,5 pt avec quatre, 11,75 pt en A3.
  - **L'évolution se décoche pour le papier** : case dans la fenêtre (`_moyPrintDelta`, de séance comme le Δ de la feuille du carnet, cochée par défaut ; cachée au premier import d'une période et en vue Évolution). Décochée : ni « +1 » sous les moyennes ni « évolution depuis le … » au sous-titre, et la taille est recalculée. L'écran garde toujours l'évolution.

## Élection des délégués de classe

### Cadre réglementaire

Vérifié sur les textes le 2026-09-11. Les références sont portées dans le code (`_EL_TYPES[…].textes`), liées dans la modale de création et en tête de chaque élection, et citées au pied du PV.

- **Deux délégués par classe, chacun avec son suppléant** — Code de l'éducation, **art. R421-28** (décret n° 2016-1228 du 16-9-2016) : *« Deux délégués d'élèves sont élus au scrutin uninominal à deux tours dans chaque classe […]. Le nom de chaque candidat est accompagné de celui de son suppléant. Tous les élèves sont électeurs et éligibles. »* → le **binôme** titulaire + suppléant est la lettre du texte. Il dit **scrutin uninominal** : un nom par bulletin ; si un seul candidat atteint la majorité absolue, un second tour pour le second siège.
- **Avant la fin de la septième semaine de l'année scolaire** — **art. R421-30** (la circulaire de 2004 disait la sixième ; le code, plus récent, prime). Toujours cité dans l'état vide de l'onglet.
- **Circulaire n° 2004-114 du 15-7-2004, § 6.1** (BO n° 29 du 22-7-2004), relu le 2026-10-03 sur le texte fourni par l'utilisateur : *« Les candidatures sont individuelles »* ; majorité absolue au 1er tour, relative au 2nd, le plus jeune à égalité ; *« Un élève qui n'a pas présenté sa candidature peut néanmoins être élu si les voix de ses camarades se sont portées sur lui en nombre suffisant et s'il accepte son élection »* ; remplaçant élu *« au maximum deux fois dans l'année scolaire »*.
  - ⚠️ Le titulaire **indissociable** de son suppléant figure au § 6.2 — élection des représentants au CONSEIL D'ADMINISTRATION —, pas pour les délégués de classe. Pour ceux-ci, le binôme vient de **R421-28 (2016)**, plus récent et supérieur : la circulaire n'a pas été réécrite, et rien ne dit qui supplée un élu non candidat **en binôme** (hors binôme, candidatures individuelles, la circulaire suffit).
  - La fiche service-public F1370 reprend la phrase de 2004 (*« … et s'il accepte son mandat »*).
- **Éco-délégués** :
  - **Circulaire n° 2019-121 du 27-8-2019, § 1.2** (*EDD 2030*, BO n° 31 du 29-8-2019) : *« chaque établissement est incité à organiser l'élection, dans chaque classe, d'un éco-délégué […]. Cette élection peut utilement intervenir concomitamment aux élections des délégués d'élèves et selon les mêmes modalités. »* Le « binôme paritaire d'éco-délégués » de la même circulaire est **par établissement** (élu parmi les volontaires du CVC / CVL), pas par classe.
  - **Circulaire du 24-9-2020, § 3.1** (*Agenda 2030*, BO n° 36) : *« L'élection des éco-délégués de classe est désormais obligatoire au collège et au lycée et peut être organisée simultanément avec celle des délégués de classes. Elle peut également être proposée aux élèves de CM1 et CM2. Les mêmes élèves peuvent, le cas échéant, être à la fois délégués de classe et éco-délégués. »*
  - → **UN éco-délégué par classe, AUCUN suppléant, un nom par bulletin, uninominal à deux tours** (par renvoi aux modalités des délégués). Aucun texte n'impose deux éco-délégués ni la parité par classe : choix d'établissement, fréquent, à régler dans la modale.
- **Liens** (fournis par l'utilisateur) :
  - R421-28 : la section du code sur Légifrance avec un fragment `#:~:text=` qui surligne le passage sur le type de scrutin. ⚠️ Ne pas le « simplifier » en lien d'article nu : le surlignage rend la lecture immédiate.
  - Éco-délégués : les deux circulaires, mêmes pages du BO avec fragment `#:~:text=` (2019 : *« Au-delà, chaque établissement est incité… »* ; 2020 : *« L'élection des éco-délégués de classe est désormais obligatoire… »*).
  - **Deux liens seulement pour les délégués de classe** : R421-28 (Légifrance) et la fiche **service-public.gouv.fr F1370** (procédure en clair ; lien **sans** fragment `#:~:text=`, la structure du site n'affiche pas la zone surlignée). Les liens vers R421-30 et la circulaire 2004-114 sont retirés de `_EL_TYPES.delegues.textes` ; les règles ci-dessus restent celles qu'ils énoncent. Le test accepte le domaine `service-public.gouv.fr`.
  - ⚠️ `education.gouv.fr` et `legifrance.gouv.fr` refusent les robots (403 Cloudflare) : URL vérifiées par les moteurs de recherche, contenu par les PDF du BO ; à ouvrir à la main si un lien casse.
- L'élection est organisée par l'établissement, en pratique par le **professeur principal**, après une information sur le rôle des délégués (heure de vie de classe). Les délégués siègent au **conseil de classe** et forment l'**assemblée générale des délégués**, qui élit les représentants au conseil d'administration et au CVC / CVL.

⚠️ **La pratique de l'utilisateur s'écarte de la lettre du texte, et c'est légitime — ne pas la « corriger ».** Sa présentation `../PP/délégué election.md` décrit :

- des **candidatures en binôme** : chaque titulaire se présente **avec son suppléant**, affichés ensemble avant le vote ;
- un bulletin portant **0, 1 ou 2 noms** — scrutin **plurinominal** (les deux titulaires d'un seul vote), là où le texte dit « uninominal » ;
- **bulletin vierge = blanc** ; **trop de noms, marques ou inscriptions inappropriées = nul** ;
- **second tour avec les mêmes candidats** si personne n'atteint la majorité absolue ;
- **égalité de voix → le plus jeune est élu** ;
- **deux assesseurs**, élèves volontaires, qui surveillent le vote, ramassent et comptent les bulletins, puis **signent le procès-verbal** (un CANDIDAT peut l'être : cf. *Bureau de vote*).

**Les modalités sont des RÉGLAGES de l'élection, pas des constantes du code** (uninominal ou plurinominal, binôme ou suppléants élus à part, départage par le plus jeune ou le plus âgé : cela varie d'un établissement à l'autre).
- **Arbitré par l'utilisateur : le DÉFAUT est celui des textes liés — scrutin UNINOMINAL, un nom par bulletin.** Les autres défauts : deux titulaires, binômes, majorité absolue au 1er tour, le plus jeune. Le plurinominal de sa présentation reste au menu de la modale (« 2 (plurinominal) »).
- **La modale le DIT** : sous « Modalités », `_elDefautsHint(ty)` décrit les défauts du mandat en clair (*« Par défaut, ce que disent les textes : 2 titulaires, chacun avec son suppléant, 1 nom par bulletin (uninominal)… »*), dérivé de `ty.defaults` pour ne jamais décrire autre chose que ce que le bouton **↺ Défauts des textes** (`_elDefautsReset`, inerte quand le dépouillement a commencé) remet.
- ⚠️ **Les fixtures de tests et l'élection EN COURS de la démo restent plurinominales À DESSEIN** (`nomsParBulletin: 2` explicite, commenté) : c'est le cas arithmétiquement piégeux (exprimés en bulletins, pas en voix), et « déjà élu » + « un autre au seuil courant » ne coexistent qu'à deux noms par bulletin. L'élection CLOSE de la démo est uninominale (12 · 7 · 2 · 1 sur 22 exprimés : un siège au 1er tour, le second au 2nd), testée dans les deux sens.
- `_elStatut` garde `|| 2` en repli : les fichiers d'avant le champ ont été créés quand 2 était le défaut.

### Modèle

```js
election = {
  id, classId,
  type: 'delegues' | 'eco', // le MANDAT — absent = délégués de classe
  date,                    // 'YYYY-MM-DD'
  titre,                   // « Élection des délégués — 5C — 2025-26 »
  // modalités, figées à la création et rappelées sur le PV :
  nbTitulaires: 2,
  nbSupplants: 2,          // 0 est une valeur (éco-délégués) ; absent = autant que de titulaires (`_elNbSup`)
  binome: true,            // un candidat titulaire se présente avec son suppléant
  nomsParBulletin: 1,      // nombre max de noms qu'un bulletin peut porter — 1 = uninominal (défaut)
  majoriteAbsolueT1: true, // majorité absolue au 1er tour, relative au 2nd
  departage: 'plusJeune',  // 'plusJeune' | 'plusAge' | 'manuel'
  parSiege: true,          // un siège après l'autre (défaut) — absent = ensemble ; ne vaut qu'en uninominal à plusieurs sièges
  secondTour: { mode: 'tous' | 'seuil' | 'premiers', pct, n },   // qui passe au 2nd tour — absent = tous
  nonCandidat: 'compte' | 'nul',   // nom d'un élève non candidat — absent = compte
  president: { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction },   // président du bureau — absent = PP
  supDe: { elId, candId, nom },    // scrutin du SUPPLÉANT d'un élu non candidat, jamais « l'élection des délégués »
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

### Bureau de vote : assesseurs et président

Les assesseurs ne sont pas dans les modalités (`mel-a1`, `mel-a2` supprimés) mais saisis dans l'écran de l'élection, entre les candidatures et le dépouillement : bloc **🧑‍⚖️ Bureau de vote** (`_elAssesseursHTML`) — président puis deux élèves volontaires, leur rôle rappelé.
- `electionSetAssesseur(el, i, sid)` refuse : élection close (le PV est fait : affichage seul), élève hors classe, déjà l'autre assesseur, ou président du bureau. Noms FIGÉS. Le scrutin d'un suppléant n'hérite pas des assesseurs.
- ⚠️ **Un CANDIDAT peut être assesseur** (arbitré par l'utilisateur). Aucun texte national ne règle le bureau de vote, donc rien ne réserve la fonction aux non-candidats ; et dans une classe où presque tout le monde se présente, il ne resterait personne. **La règle vaut dans les DEUX sens** : un assesseur est aussi proposable comme candidat (ni filtre dans `_elRenderCandidats`, ni refus de *+ Candidature*) — l'interdire d'un seul côté ne ferait qu'imposer un ordre de saisie. Le modèle (`electionAddCandidat`) était déjà permissif ; fixture de `fiche.test.js` qui cumule les rôles.
  - ⚠️ **Signaler, pas écarter.** `_elRoleLabel(el, sid, sansAss)` écrit le rôle déjà tenu après le nom, accordé en genre (« — candidate titulaire », « — candidat suppléant », « — assesseur », « — président du bureau »), dans les DEUX menus ; le bandeau du bloc le dit en clair. Un menu muet rendrait le cumul accidentel. `sansAss` : dans son propre menu, l'assesseur déjà choisi n'a pas à s'entendre redire qu'il est assesseur (son rôle de candidat, lui, reste écrit).
  - Le menu **« ✍️ nom écrit » signale aussi** (arbitré) : président et assesseurs y restent proposés, rôle écrit après le nom — on ne peut pas refuser de compter un bulletin qui porte leur nom.
  - **Reste écarté des assesseurs : l'élève président du bureau** (il tient déjà l'autre siège) ; le président élève reste non candidat et non assesseur.
  - Démo : l'assesseur de l'élection EN COURS est la suppléante du deuxième binôme (menus à l'écran, étiquette rencontrable sans la créer).
- **Président du bureau au choix** : `el.president = { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction }`, absent = le professeur principal ; `_elPresident`, `electionSetPresident` (élève : non candidat, non assesseur, nom figé ; refus une fois close). ⚠️ Aucun texte national ne règle le bureau (usage d'établissement, documents des académies, cf. CPE de Versailles). Au PV, la signature « Le président du bureau » porte sa fonction et son nom ; la fiche de l'élève dit « président du bureau de vote ». Candidatures et assesseurs écartent l'élève président.

### Accord en genre

Tout texte d'élection s'accorde au genre du candidat. Aides : `_civOf(sid)`, `_civCand(c, sup)` — la civilité est **FIGÉE sur la candidature** (`civiliteTitulaire`, `civiliteSuppleant`, posées par `electionAddCandidat` et `electionSuppleantNC`), la fiche vivante en repli pour les candidatures plus anciennes —, `_acc(civ, m, f, x)` (civilité inconnue : forme inclusive `x`, « élu(e) »), `_accPl(civs, m, f)` (féminin seulement si TOUTES), `_civNom(nom)` (« Mme Durand » pour un adulte), `_delMot`, `_supMot`, `_maj`.
- Accordés : élu/élue (graphique, résultats, projection, PV), né/née (départage), candidat/candidate, retiré/retirée, suppléant/suppléante, il/elle accepte, Délégué(e)s élu(e)s (titres), assesseur/assesseure, président/présidente (PV, fiche), délégué/déléguée et éco-déléguée partout (infobulle du nom, fiche, synthèse, liste imprimée, fiche imprimée).
- ⚠️ **Restent au masculin générique** : les RÈGLES (« le plus jeune est élu », « le suppléant est élu avec son titulaire ») et les titres de colonnes. La projection d'un **scrutin de suppléant** titre « Suppléant(e) élu(e) — de X ».

### Un siège après l'autre, et qui passe au second tour

Les sources divergent : **R421-28** dit « scrutin uninominal à deux tours » — un scrutin élit UNE personne, donc un scrutin par délégué (lecture défendue par un enseignant, Mathemathieu) ; la fiche **justice.fr** décrit une seule élection pour les deux sièges. **Arbitré : un siège après l'autre par défaut**, réglable (*Plusieurs sièges, un nom par bulletin*).
- `_elParSiege(el)` = `parSiege` ET uninominal ET plusieurs sièges (deux noms par bulletin : forcément ensemble) ; absent = ensemble (les élections déjà tenues gardent leur arithmétique).
- Chaque tour porte `siege`. À la clôture (`electionCloreTour`) : siège pourvu → scrutin du siège suivant (tour 1, **sans les élus**, recompter l'urne) ; non pourvu au 1er tour → son 2nd tour ; vacant au 2nd → le suivant.
- Libellés par `_elTourLabel` (« siège 2 · tour 1 ») dans le dépouillement, le graphique, les résultats, la projection (« élu au premier tour (siège 2) »), le PV. Départage manuel indexé par `_elTourCle` (deux tours portent le même numéro). `electionRouvrir` retire tout tour ajouté encore vide.
- **Second tour** : `el.secondTour` (tous les candidats, ceux au-dessus d'un pourcentage — à défaut les x premiers —, ou les x premiers), `_elQualifies` — calculé sur le 1er tour, en % des **exprimés** ; une égalité à la dernière place qualifiante garde tous les ex æquo ; il reste toujours au moins autant de candidats que de sièges. Dit au PV.
- Démo : l'élection close passe en un siège après l'autre (siège 1 puis siège 2, chacun au 1er tour).

### Les sources citées sont liées

`EL_SOURCES` (R421-28 sur Légifrance, circulaire n° 2004-114 au BO, fiche justice.fr, fiche service-public F1370, dossier des CPE de l'académie de Versailles) et `_elSrc(k, libellé)` (https, nouvel onglet, `noopener noreferrer`) : une ligne de sources sous les réglages de ⚙ Modalités (`#mel-sources` : un siège après l'autre, les sièges ensemble, le nom d'un non-candidat), dans la question d'acceptation (la circulaire) et dans le bloc Bureau de vote (usage d'établissement, exemple d'académie). ⚠️ Toute nouvelle explication qui s'appuie sur une source hors Légifrance passe par `EL_SOURCES` + `_elSrc`.

### La saisie se fait bulletin par bulletin

C'est la méthode de l'utilisateur (une ligne par bulletin numéroté, une colonne par binôme, on coche) : c'est ce qu'il fait pendant que les assesseurs annoncent, et cela laisse une **trace vérifiable** — si un total est contesté, on remonte au bulletin.

- Grille de dépouillement **candidats en colonnes × bulletins en lignes**, un nouveau bulletin ajouté à chaque validation, navigation au clavier.
- **Les totaux sont CALCULÉS, jamais saisis.** Aucun champ « nombre de voix » : il se désynchroniserait du dépouillement au premier bulletin corrigé.
- Le **statut est déduit puis corrigeable** : 0 nom → blanc, plus de `nomsParBulletin` noms → nul. ⚠️ Un bulletin nul pour inscription inappropriée porte 1 ou 2 noms valides et ne peut pas être déduit — d'où `statut` inscriptible à la main et `motifNul`.
- **Nom écrit sur un bulletin** (les élèves peuvent écrire un nom sur une feuille blanche) : *✍️ + Nouveau nom* sous la grille → `electionAddEcrit`. L'élève (de la classe, présent, ni candidat ni suppléant) devient une colonne du tour EN COURS (0 voix sur les bulletins déjà lus), **sans suppléant**, `ecrit: true` ; dit dans les candidatures et au PV (« non candidat, nom écrit sur un bulletin ») ; retirable (`electionRemoveEcrit`) tant qu'aucun bulletin ne le porte. Sans suppléant, élu en binôme : siège sans suppléant ; s'il part, le siège est vacant. ⚠️ Les textes divergent sur ce cas (R421-28 veut un suppléant pour chaque candidat ; service-public et la circulaire de 2004 admettent l'élu non candidat).
  - **Modalité `el.nonCandidat`** (⚙ Modalités, figée dès le premier bulletin comme l'arithmétique, rappelée au PV), arbitrée : `compte` (défaut, absent = compte — circulaire § 6.1, service-public) ou `nul` (lecture stricte de R421-28) — `_elStatut` rend alors NUL tout bulletin où un nom écrit est coché.
  - **Acceptation** (*« … et s'il accepte son élection »*) : `electionCloreTour` refuse de clore (`{ bloque, accepter: candId }`) tant qu'un élu `ecrit` n'a pas répondu ; `electionCloreUI` pose la question devant la classe (*✓ Il accepte* / *✗ Il refuse*), `cand.accepte = true | false`. Un refus l'écarte de l'attribution (`_elResultatTour`) : le siège va au suivant selon la règle du tour, ou à un second tour. Dit dans les candidatures et au PV.
  - ⚠️ **Le suppléant d'un élu non candidat en binôme : AUCUN texte ne le désigne.** Sous les élus d'une élection close, un bloc par élu non candidat (`_elSupNcHTML`) offre trois cas : **aucun** (siège sans suppléant, défaut), **élu ensuite par un scrutin**, **désigné par l'élu** (avec l'accord du chef d'établissement) ; élève et date. `electionSuppleantNC` pose `sidSuppleant` / `nomSuppleant` (figé) et `supNc = { mode, date }` : mandats en exercice, délégué surligné, PV, remplacement suivent ; revenir à « aucun » le retire. Refus : élection non close, hors binôme, date avant le scrutin, élève hors classe ou déjà élu. Dit au PV (`_elSupNcTexte`) et annoncé dans la question d'acceptation. Le bloc guide (une ligne dit quoi faire selon le choix coché ; *✓ Enregistrer* grisé tant qu'il manque l'élève, `_elSupNcMaj`).
  - **Scrutin du suppléant tenu dans l'app** : *🗳 Organiser ce scrutin dans l'app* → `electionCreerScrutinSuppleant` crée une élection RATTACHÉE (`supDe = { elId, candId, nom }`, un siège, sans suppléant, un nom par bulletin, majorité et départage de l'élection d'origine) — candidatures, bulletins préparés, projection, fenêtre détachée, PV (« Procès-verbal de l'élection d'un suppléant », « 1 siège à pourvoir : le suppléant »). À sa **clôture**, `_elSupDeAppliquer` reporte l'élu comme suppléant (`supNc.scrutinId`) et le PV d'origine cite le scrutin avec ses chiffres (« 6 votants, 5 exprimés, 4 voix »). La liste des élections le dit (« ↳ scrutin du suppléant de … »), son en-tête a *↩ Élection d'origine*.
    - ⚠️ **Un scrutin de suppléant n'est JAMAIS « l'élection des délégués »** : `_delegueOf` et la désignation sans vote l'écartent (`!e.supDe`) — sans cela, le plus récent des scrutins clos aurait fait de son élu le seul délégué.
    - `_elSupDeExclus(el)` — titulaires (l'élu non candidat compris) et suppléants de l'élection d'origine — retire ces élèves des candidatures et du *nom écrit* du scrutin, et `electionAddCandidat` / `electionAddEcrit` les refusent. L'état vide le dit (« sauf les 3 déjà élus »). Le suppléant posé par ce scrutin ne s'exclut pas lui-même (rouvrir, reclore).
    - ⚠️ Un suppléant posé APRÈS le vote (`supNc`) n'était pas sur le bulletin : `_elCandNomSupBulletin` le tait dans la liste des candidats, les tableaux de voix du PV, les candidatures de l'onglet et le graphique (un PV signé qui laisserait croire à une candidature en binôme est faux) ; il est dit sous les élus et dans le bloc du suppléant. Le titre du PV s'accorde (« Est élue » pour un seul élu, « Sont élues »).

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
- **Majorité absolue = strictement supérieure à la moitié.** Sur 24 exprimés il faut 13 voix, pas 12. Écrire le test en entiers (`voix * 2 > exprimes`), pas en flottants.
- Sont élus titulaires les `nbTitulaires` candidats en tête **qui satisfont la règle du tour** — majorité absolue au premier, relative au second. ⚠️ Un tour peut n'élire **qu'un seul** titulaire sur deux ; le second tour ne porte alors que sur le siège restant. **Ne pas supposer que les deux sièges se pourvoient au même tour.**
- ⚠️ **`votantsAnnonces` n'est pas `bulletins.length`.** Le premier est le comptage de l'urne par les assesseurs avant ouverture, le second l'avancement du dépouillement. Les confondre rend l'axe de la projection élastique et supprime le contrôle contre le bourrage. **Un écart entre les deux à la clôture est signalé** — c'est l'anomalie que ce double comptage existe pour détecter.
- **Le compte de l'urne PRÉPARE les lignes** : `electionPreparerBulletins` (champ *Bulletins dans l'urne*, `electionUrneUI`) pose `votantsAnnonces` et complète la grille par des lignes **« à lire »** (`lu: false`).
  - ⚠️ **Une ligne à lire n'est ni un votant ni un blanc** (`_elStatut` → `alire`, `_elDepouillement` l'ignore) : sans cela, la projection afficherait « 25 dépouillés » et 25 blancs avant le premier bulletin.
  - Cocher un nom, « nul », **Entrée** ou le bouton **Blanc** la marque lue (`electionSetBulletin` efface alors le champ : un bulletin lu n'a pas de `lu`, les fichiers d'avant sont inchangés).
  - Un compte plus bas ne retire QUE des lignes à lire, en fin de grille — jamais un bulletin lu. On ne clôt pas un tour qui a des lignes à lire. *+ Bulletin* mène d'abord à la ligne à lire suivante. Démo : 18 lus sur 25 préparés.
- **Vérité disponible en cours de dépouillement** : `voix × 2 > votantsAnnonces` ⇒ le candidat est **définitivement** au-dessus de la majorité absolue, puisque `exprimés ≤ votants`. C'est le seul verdict anticipé que l'app s'autorise (cf. *Projection en direct*).
- **Départage** : appliqué seulement si l'égalité porte sur le dernier siège attribuable. `_elDepartageAge` tranche automatiquement en `plusJeune` / `plusAge` d'après `stu.naissance`.
  - ⚠️ La date est **FIGÉE sur la candidature** (`cand.naissanceTitulaire`), comme le nom : les élections sont l'exception assumée à la purge, et un PV signé doit rester relisible — motif de départage compris — après le départ de l'élève. La date figée PRIME sur celle de l'élève vivant.
  - ⚠️ `_elDepartageAge` retourne **null** — « je ne sais pas » — dès qu'une date manque, que deux candidats partagent la même date sur le dernier siège disputé, ou que le mode est `manuel`. **null n'est pas un échec, c'est un refus délibéré de trancher** : l'app rend la main et demande. Un élu que personne ne peut justifier devant la classe est contestable.
  - La décision MANUELLE de l'utilisateur passe avant la règle automatique.
  - **La justification est AFFICHÉE** : `_elResultatTour` rend `departages` (`{ candIds, elus, voix }`), `_elDepartagesHTML` en fait une phrase par égalité — « Égalité à 2 voix, départagée par l'âge (le plus jeune est élu) : X, né(e) le …; Y, né(e) le … — élu » — au **PV** (sous le tableau du tour, sans emoji), à l'**écran de résultat projeté** et dans les résultats de l'onglet. Date = celle FIGÉE. Un départage MANUEL n'affiche pas de date.
- Si `binome`, le suppléant est élu **avec** son titulaire — pas de calcul séparé.

### Projection en direct du dépouillement

**Le dépouillement se fait devant la classe, et les élèves voient les résultats évoluer graphiquement bulletin par bulletin.** C'est l'usage principal de l'onglet : la publicité du dépouillement rend le résultat incontestable, et voir la courbe monter fait comprendre le vote à des élèves de cycle 4.

#### Deux surfaces simultanées

L'enseignant saisit, la classe regarde ; les deux vues affichent le même état au même instant.

- **Par défaut, une seule page en deux volets** : grille à gauche, graphique à droite, lisible du fond de la salle. ⚠️ **C'est le mode à construire en premier, parce qu'il n'a aucun mode de défaillance** — il marche que le vidéoprojecteur duplique ou étende l'écran. Bouton 📽 Projeter : écran de projection (graphique seul).
- **Fenêtre détachée** (bouton **🖥 Fenêtre détachée** à côté de 📽 Projeter, `elProjectionFenetre`, aussi sur une élection close) : une fenêtre ordinaire (`window.open`) qu'on glisse sur le second écran puis **⛶ Plein écran** (F11 en repli). ⚠️ Pas de Picture-in-Picture (`documentPictureInPicture.requestWindow`, reprise de `_timerFillWindow` / `_noiseFillWindow` : l'incrustation reste petite et ne passe pas en plein écran).
  - Ses styles sont COPIÉS de la page (les `<style>`, polices comprises), avec thème et police ; elle n'affiche que `_elRenderChart` en mode `.el-right.big` — **jamais le numéro des bulletins**.
  - Le calcul et l'état vivent **dans la fenêtre principale** ; la fenêtre est un pur affichage (comme `_timerRender` pour la popup du minuteur) : `renderDelegues()` = `_renderDeleguesCore()` + `_elWinMaj()`, donc chaque bulletin, correction et Ctrl+Z la rafraîchissent. **Ctrl+Z / Ctrl+Y marchent aussi depuis la fenêtre projetée.** Revenir à la liste des élections garde la dernière élection montrée (`_elWinId`). Fermée avec la page (`pagehide`).
  - ⚠️ **Le `window.open` peut être bloqué par le navigateur** : un toast renvoie à 📽 Projeter, qui marche toujours — la fenêtre détachée est un confort, jamais le seul chemin.
  - ⚠️ Non vérifié avec un vrai second écran (le navigateur de test bloque les fenêtres surgissantes ; vérifié avec un cadre de même origine) : **à essayer avant le jour J**.
  - **Résultat final** : sur une élection close, la fenêtre montre `_elWinResultatHTML` — élus en grand (titulaire, suppléant, « élu au premier / second tour »), puis chaque tour (votants, blancs, nuls, exprimés, *majorité absolue : n* au premier tour seulement, *majorité relative* ensuite ; voix ; élus du tour marqués). Clore fait passer la fenêtre ouverte du graphique au résultat, rouvrir la ramène au graphique. ⚠️ **Jamais les remplacements en cours d'année** (arbitré), ni numéro de bulletin.
- **En-têtes qui collent au défilement** : la barre de l'élection (`.el-head`) colle sous le bandeau ; une grille des bulletins qui tient en largeur ne défile plus dans son cadre (`.bul-plat`, posé par `_elEnteteColle`, écran ≥ 700 × 480) et sa ligne de candidats colle sous la barre (`--el-head-h`, mesurée) ; le graphique colle aussi (`.el-split > .el-right { align-self: stretch }`). Pas de **filet rouge de marge** sur l'écran projeté (📽 et fenêtre détachée).

#### ⚠️ Un pourcentage en cours de dépouillement est trompeur

Le dénominateur (les suffrages exprimés) **grandit à mesure qu'on dépouille** :

- un candidat à « 100 % » après trois bulletins n'a rien gagné ;
- **le pourcentage d'un candidat peut BAISSER alors que ses voix montent** — arithmétiquement normal, mais devant une classe cela passe pour une erreur de comptage et ouvre la contestation (à figer par un test, sinon quelqu'un le « corrigera ») ;
- le seuil de majorité exprimé **en voix** n'est connu qu'à la fin, puisqu'il dépend des blancs et nuls encore à découvrir.

**Conséquences de conception, à ne pas contourner :**

1. **La grandeur principale affichée est le nombre de VOIX, pas le pourcentage.** Les barres ont pour longueur des voix. Le pourcentage est secondaire et **toujours accompagné de son dénominateur** : « 7 voix — 58 % des 12 bulletins dépouillés ». Un pourcentage nu est un chiffre faux.
2. **L'axe est fixe, gradué sur le nombre de VOTANTS**, connu avant d'ouvrir le premier bulletin (les assesseurs comptent l'urne avant de lire : contrôle d'usage contre le bourrage). Un axe qui se redimensionne rend la progression illisible.
3. **Un indicateur « dépouillés X / Y »** en permanence, et la part restante visible sur l'axe.
4. **La ligne de majorité absolue est mobile et ne peut que DESCENDRE** : elle vaut la moitié des exprimés ; chaque blanc et chaque nul la fait baisser. La dessiner comme un repère qui se déplace, avec son étiquette — un excellent support d'explication.

#### « Déjà élu » — le seul verdict que l'arithmétique autorise en cours de route

Un candidat est **définitivement au-dessus de la majorité absolue** dès que `voix × 2 > votants`, quoi que contiennent les bulletins restants (les exprimés ne dépassent jamais les votants, le seuil final ne peut qu'être plus bas). Rigoureux, calculable à chaque bulletin, spectaculaire à projeter.

⚠️ **Ne PAS afficher de candidat « éliminé » en cours de dépouillement.** L'énoncé symétrique est bien plus fragile — un bulletin plurinominal ajoute une voix à deux candidats à la fois, et le nombre d'exprimés final reste inconnu. Annoncer devant la classe une élimination qui se démentirait au bulletin suivant serait humiliant pour l'élève et ruinerait la crédibilité du décompte. **En cas de doute, l'app ne dit rien** : elle affiche des voix, elle ne prophétise pas.

#### Lisibilité et déroulement

- **Ordre d'affichage figé** (`election.affichage.ordre`), par défaut l'ordre du tirage ou alphabétique — **pas le classement** : des barres qui se réordonnent à chaque bulletin font perdre le fil de « sa » barre. Le classement reste un réglage (effet podium).
- **Transitions douces** sur la croissance des barres (~250 ms). ⚠️ Neutralisables (`*{transition:none!important}`) pour l'audit de contraste, sinon une barre saisie à mi-parcours produit de faux écarts.
- **Taille bornée en `vw` ET en `vh`** : sur un vidéoprojecteur large, c'est la largeur qui contraint, et des caractères dimensionnés en `vh` seul débordent sans prévenir. À vérifier du 1920 × 1080 au 1024 × 768. Noms jamais tronqués en projection (ils reviennent à la ligne).
- **Couleur par binôme** (`candidat.color`, palette par défaut, modifiable), encre dérivée par `_contrastTextColor` : aucun blanc figé sur les barres.
- **Blancs et nuls affichés à part**, dans un bloc discret — jamais comme des barres en concurrence avec les candidats.
- **Correction instantanée d'un bulletin mal lu**, devant la classe, sans casser le graphique. `pushUndo()` **par bulletin** (pas le motif de salve `_evalArmUndo`) : chaque bulletin est un acte délibéré qui doit s'annuler seul. `Ctrl+Z` doit fonctionner depuis la vue de projection.
- À cette charge (une trentaine de bulletins, quelques candidats), **reconstruire tout le graphique à chaque bulletin suffit** : pas de machinerie d'animation incrémentale.

#### ⚠️ Secret du vote — deux règles qui touchent l'affichage

- **Ne jamais projeter le numéro de bulletin.** La numérotation existe pour l'audit, pas pour l'écran : projetée, elle rend le dépouillement traçable bulletin par bulletin.
- **Rappeler de mêler les bulletins avant de dépouiller.** Lus dans l'ordre de dépôt, et des élèves se souvenant de leur ordre de passage, les votes redeviennent attribuables. Rappel affiché à l'ouverture du dépouillement, plutôt que dans une documentation que personne ne relira.

### Procès-verbal imprimable

Le livrable de l'onglet. Une page portrait, sans thème sombre (neutralisation `@media print`), portant : établissement et classe, date, modalités appliquées (les réglages, en clair), liste des candidats, inscrits / votants / blancs / nuls / exprimés, tableau des voix par candidat et par tour, élus, **assesseurs et président du bureau avec lignes de signature**, textes cités au pied.

- **Tient sur une page** : les règles `.pv*` sont hors `@media print` et en `em` ; `_pvFitPt` mesure le PV hors champ, à la largeur imprimable d'une A4 portrait, et `_printFitSize` choisit la plus grande taille qui tient (7 à 11 pt ; l'espace de signature ne descend jamais sous 9 mm). Si ça déborde même à 7 pt, un toast le dit.
- **Les élus signent** (`_pvElusSignHTML`, section *Les élus — acceptation du mandat* : une case par titulaire et par suppléant élu) — aucun texte ne l'impose, mais leur signature atteste l'acceptation que la circulaire de 2004 exige d'un élu non candidat. En binôme, un CADRE par binôme (`.pv-binome`, titulaire et suppléant côte à côte, deux cadres par rangée) ; un élu non candidat sans suppléant a son cadre avec « Suppléant : aucun ». Hors binôme, titulaires puis suppléants.
- ⚠️ **Le PV n'est imprimable que `clos: true`.** Un PV signé qui ne correspond plus au dépouillement affiché est un faux ; clore verrouille la saisie, et rouvrir demande une confirmation explicite.

### Après l'élection

- Les élus sont reportés sur l'élève (`stu.delegue = 'titulaire' | 'suppleant' | null`, dérivé de l'élection close la plus récente de sa classe) pour être visibles dans la **Synthèse** et la liste des élèves. ⚠️ **Ne pas le stocker en dur** : le dériver de `S.elections`, sinon une correction du dépouillement laisse un ancien délégué marqué. Si un cache est nécessaire, le recalculer dans `postLoadHook`.
- **Le PV signé, en PDF** : une fois l'élection close, bloc « 📎 Joindre le PV signé » sous le résumé des élus → `election.pv = { nom, fichier, taille }` ; même bloc sur la désignation sans vote (`cls.delegues.pv`, qui survit à une correction des noms). Même dossier et mêmes règles que les fiches incident (`_pjRef`, `_pvBlocHTML`, `pvAttachUI` / `pvOpenUI` / `pvRemoveUI`), nom automatique `PV élection délégués — 5e C — AAAA-MM-JJ.pdf`. `_pjReferences` les compte, donc le nettoyage des orphelins les épargne.
- **Délégués désignés sans vote dans l'app** (le PP peut avoir voté sur papier, ou reprendre une classe en cours d'année) : bloc *« ✍️ Délégués désignés sans vote dans l'app »* en bas de l'onglet 🗳 : date, deux titulaires, deux suppléants, un mot → `cls.delegues` (`deleguesSet` / `deleguesClear`, roster seulement, un rôle par élève).
  - ⚠️ **`_delegueOf` arbitre par la DATE** : la désignation prime si elle est plus récente que la dernière élection close (ou s'il n'y en a pas), sinon l'élection fait foi — et l'écran le dit (« remplacée par l'élection du … »). Cela permet aussi de noter une démission après une élection tenue dans l'app. À date égale, la désignation gagne (`>=`) : c'est le geste le plus délibéré.
  - ⚠️ Contrairement aux élections (PV historique, exception de purge), **c'est un état courant** : `_purgeStudentRefs` retire l'élève parti, et une désignation vidée disparaît. Dans l'état maximal du test de balayage.
- **Éco-délégués : la même mécanique, un autre mandat.** `election.type` (`_EL_TYPES` : `delegues` 🗳 · `eco` 🌱 — libellé, titre par défaut, intitulé du PV, défauts), choisi dans la modale de création (le mandat pose titre, binôme, suppléants, noms par bulletin — sur une élection en cours de création seulement). Défauts éco **= les textes** : **un élu, sans suppléant ni binôme, un nom par bulletin**, majorité absolue au 1er tour ; « deux si l'établissement le décide » se règle dans la modale. Chaque mandat porte ses `textes` (`{ ref, quoi, url }`), rendus par `_elTextesHTML` (liens `target=_blank rel=noopener`, échappés) dans la modale, en tête de l'élection ouverte, et cités au pied du PV.
  - ⚠️ **`nbSupplants` = 0 est une valeur.** `rest.slice(0, el.nbSupplants || el.nbTitulaires)` aurait fait deux suppléants d'une élection qui n'en veut pas ; `_elNbSup(el)` distingue 0 (aucun) de absent (fichier antérieur : autant que de titulaires).
  - Le sélecteur *Suppléants* de la modale reste réglable même en binôme (arbitré). Le binôme signifie « chaque titulaire élu avec SON suppléant », donc autant de l'un que de l'autre : cocher le binôme aligne les suppléants, changer les titulaires en binôme les fait suivre (`_elNbtChange`), et choisir un AUTRE nombre de suppléants **défait le binôme en le disant** (`_elNbsChange`, toast) plutôt que d'être refusé en silence. Testé par événements sur des éléments persistants (le stub du harnais en rend un neuf par appel).
  - ⚠️ **Deux mandats qui ne se confondent JAMAIS** : `_delegueOf(sid)` ne regarde que les élections `delegues` et `cls.delegues` ; `_ecoDelegueOf(sid)` (= `_delegueOf(sid, 'eco')`) que les élections `eco` et `cls.ecoDelegues`. Même arbitrage par la date. Clore l'une ne fait rien à l'autre ; un élève peut cumuler.
  - **Affichage** : l'éco-délégué n'est pas surligné (vert et jaune sont pris) — il porte **🌱 après le nom** (`.eco-bdg`, dans `_nomHTML`, donc dans les cinq grilles), une ligne *Éco-délégué* sur la fiche, `(éco-délégué)` sur la liste imprimée et la synthèse de période, `r.eco` dans `_syntheseRow`. PV : titre, modalités (« sans suppléant », « candidatures individuelles »), tableau des élus à une colonne.
  - **Désignation sans vote** : le même bloc une seconde fois (`_deleguesDirectHTML(cls, list, kind)`, ids `de-*`, `deleguesSet(cls, data, 'eco')`, `_delDirectOpen` par mandat, cible PV `'de'`). `_purgeStudentRefs` purge `cls.ecoDelegues` comme `cls.delegues` ; dans l'état maximal du test de balayage.
  - Démo : une élection d'éco-délégués close (14/10), trois candidats, un tour, 18 bulletins à deux noms (13 voix sur 24). ⚠️ Plus récente que celle des délégués : un `find(e => e.clos)` tombe dessus — les tests désignent l'élection par son type.
- **Démission ou départ d'un délégué en cours d'année** (option arbitrée par l'utilisateur) : ce n'est PAS une nouvelle élection — circulaire n° 2004-114 § 6.1, « le chef d'établissement fait procéder […] à l'élection d'un remplaçant ». Une **trace datée sur l'élection close** : `election.remplacements = [{ id, ts, date, candId, qui: 'titulaire'|'suppleant', motif: 'demission'|'depart'|'autre', texte, remplacantCandId, nomParti, nomRemplacant }]`. Le dépouillement et le PV d'origine ne bougent pas ; le PV gagne une section *« Remplacements en cours d'année (postérieurs au scrutin) »*.
  - **Les mandats se DÉRIVENT** : `_elEffectifs(el)` → `{ titulaires: [{ sid, nom, candId, promu }], suppleants, vacants }`, et `_delegueOf` s'appuie dessus. Un titulaire parti en binôme est remplacé par **son** suppléant (promu) ; hors binôme, par le suppléant élu **choisi** (`remplacantCandId`, une seule fois par suppléant) ; sans suppléant (éco-délégué), le siège est **vacant** — l'écran et le PV le disent, l'app n'invente personne. Un suppléant qui part n'a pas de successeur.
  - `electionRemplacer` refuse : élection non close, mandat non élu, date illisible, doublon (un mandat ne se remplace qu'une fois), successeur non suppléant ou déjà promu. Noms FIGÉS (`nomParti`, `nomRemplacant`) comme sur les candidatures.
  - ⚠️ `_delegueOf` doit tester « est parti » AVANT « est titulaire » (sinon un titulaire démissionnaire reste surligné en vert). Testé en binôme, hors binôme, sans suppléant, et sur la démo (le titulaire élu au second tour démissionne le 12 janvier, son suppléant devient titulaire : deux titulaires, un suppléant).
  - **Écran** : bloc *🔁 Remplacements en cours d'année* dans les résultats de l'élection close (`_elRemplacementsHTML`) — liste (🗑, Ctrl+Z), *« En exercice : … (ex-suppléant) · siège vacant »*, formulaire en place (qui part · date · motif · successeur hors binôme · mot). Un remplacement ne peut pas précéder le scrutin. La désignation sans vote plus récente prime toujours.
  - Rouvrir l'élection ne touche pas aux remplacements (ils portent des `candId`) ; une élection rouverte n'est plus close, donc `_elEffectifs` ne rend rien tant qu'elle ne l'est pas à nouveau. Rien à purger : aucun sid.

## Bilans de période — préparer le conseil de classe, faire le point à mi-période

Entrée **datée et qualifiée** par élève : `stu.bilans`, `_BILAN_TYPES` = `conseil` 🎓 · `miperiode` 📝 (+ `mois`, cf. *Avis des collègues*). **La période se DÉDUIT de la date** (`_periodOf`) : rien n'est stocké par période, changer semestre ↔ trimestre ne perd rien. Sans note ni moyenne (elles sont dans Pronote) : brouillon du PP.

- Modèle pur et testé : `bilanAdd/Set/Remove` (refus d'une date illisible ou d'un texte vide — *un bilan vide se supprime, il ne se vide pas*), `_bilansOf` (récent d'abord), **`_bilanPeriode(cls, sid, pIdx, type)`** : le plus récent DE la période, du type demandé d'abord, l'autre à défaut. `_syntheseRow.bilan` = celui de la période courante.
- **Liste des élèves** : colonne *Conseil S1* (bouton 🎓 / 📝 coloré s'il y en a un, texte tronqué dessous), triable « rédigé d'abord », imprimée. **Fiche** : section 🎓 (toutes les entrées, ✏️ 🗑, pastille `+`).
- **La modale `mbilan` ENCHAÎNE les élèves** (`openBilan`, `bilanNav(±1)`, Ctrl+Entrée) dans l'ordre de la liste à l'écran, tri et filtre compris (`_bilanOrdre` = `_elevesRows`). Ouverte sans id, elle **reprend** le bilan de la période courante s'il existe ; depuis la fiche, `+` force une entrée vierge. `_bilanCommit` n'empile un undo que si quelque chose a changé ; « Suivant » garde le moment choisi.
- ⚠️ **La date par défaut est ramenée dans l'année scolaire de la classe** (`_ymdClampAnnee`) : en septembre on relit la classe de l'an dernier, et un bilan daté d'aujourd'hui tomberait hors de toutes ses périodes.
- `postLoadHook` crée la section et écarte les entrées non-objets ; état maximal du test de balayage. Démo : cinq bilans au S1, trois au S2.

### Décisions d'un moment de bilan

**À côté du bilan, pas dedans** : le bilan est ce que dit le PP, la décision ce que l'équipe a arrêté (avertissement, PPRE, tutorat…).

- `stu.decisions`, une entrée par MOMENT : `_decisionCible(cls, sid, { type, date })` (même type, même période, même mois pour un point du mois, comme `_bilanCible`). `decisionSet` crée, modifie, ou **retire quand le texte est vide** (→ `'ajout' | 'modif' | 'suppr' | null`) ; contrairement au bilan, vider retire (Ctrl+Z la rend).
- **Fiche** : sous le bilan du moment, dans les trois vues (`_ficheRedacHTML`), champ *Décisions · à mettre en place*, enregistré en quittant le champ (`ficheDecisionSave`, un cran d'undo, sans re-rendu — aussi avant ◀ ▶ ou changement de moment au clavier). Les autres moments montrent leurs décisions sous leur bilan ; la chronologie les date.
- **Synthèse de période** : `row.decisions`, « **Décisions :** … » sous le bilan.
- **Fenêtre `mbilan`** : champ `mbilan-dec` (`_bilanDecCharge` à l'ouverture et à ◀ ▶), enregistré par `_bilanCommit` avec le bilan — **un seul cran d'undo pour les deux**, décisions sans bilan acceptées. Signalées : second anneau autour du point de la colonne Bilans (`.el-bd.d`), case **◉** de la carte de chaleur, texte en infobulle.
- Les deux champs grandissent avec leur texte (`field-sizing: content`, `_autoTaille` ; minimum 120 px bilan, 90 px décisions).
- `postLoadHook` écarte les entrées illisibles ; rien à purger à part (sur l'élève). Démo : quatre décisions.

### Synthèse de période imprimable

La fenêtre `mperiode` demande **un MOMENT** (ceux de « Synthèse pour » : conseil, mi-période, point du mois, par période). La feuille est **bornée au moment** (`_ficheBornes` : période entière pour un conseil, **du début au milieu pour la mi-période** — arbitré —, le mois pour un point du mois), porte le bilan et les décisions de CE moment ; titre = le moment (« Point de septembre — 5e C »). `_periodeSynthese(cls, idx, { type, col })` (ou `(cls, pIdx, {type})`) : sans `col`, la période entière. Blocs `_PERIODE_BLOCS` (observations · moyennes · non rendus · incidents · contacts · bilan), forme `tableau` (paysage) ou `fiches` (portrait). Le résumé dit combien d'élèves sont **sans bilan rédigé**. Choix retenus pour la session (`_periodePrintOpts`).

- ⚠️ **Tout est BORNÉ À LA PÉRIODE** (c'est ce qui la distingue de la liste, « où en est-on aujourd'hui ») : cumul en **fin de période** et total de la période, relevés où l'élève était absent, incidents et contacts **de** la période (bornes incluses, testé au 31/01 et au 01/02), papiers distribués **jusqu'à sa fin** et pas rendus (`suiviRetour: false` n'y entre jamais), bilan de la période.
- **Le tableau tient sur UNE page**, A4 ou A3 (`_periodePrintOpts.format`, A4 défaut). Taille **calculée** : `_printFitMeasure` rend la feuille hors champ à la largeur imprimable, `_printFitSize` (pur) cherche par dichotomie la plus grande taille (quart de point, marge 4 %). Plafond 10,5 pt A4 / 13 A3 ; plancher **6 pt** — en dessous on ne triche pas : résumé et toast disent « ≈ N pages, passe en A3 ou décoche un bloc ». La taille est annoncée AVANT d'imprimer. (Mesure en Latin Modern : démo à six blocs ≈ 2 pages à 6 pt en A4, 8,5 pt en A3.)
  - ⚠️ **Les règles `.pp-*` sont HORS `@media print`, tout en `em`** : la mesure se fait à l'écran. Elles ne touchent que ce qui vit dans une `.print-area`. Titre en `div.pp-titre`, pas `h1` (la règle papier `.print-area h1` aurait divergé de la mesure).
  - ⚠️ **`table-layout: fixed` + `<colgroup>` pondéré** (le bilan a la plus large colonne) : sans largeurs fixes la mesure ne prédit plus le papier.
  - ⚠️ **Tout ce qui peut tenir sur une ligne y tient** : une cellule sur deux lignes double la hauteur de la rangée.
  - Rangées alternées (`print-color-adjust: exact`), en-têtes soulignés, dates en jj/mm, évolution des moyennes datée une fois au sous-titre.
  - ⚠️ **A3 : la page nommée `landscape` imposerait l'A4** — `.print-area.a3 { page: auto }`, c'est le `@page` anonyme (`_setPageOrientation(kind, format)`) qui décide.
  - Les fiches portrait ne sont pas ajustées (un bloc par élève, jamais coupé) ; A3 s'y applique.
- **Moyennes** : générale du dernier import, son évolution depuis le premier import de la période (ou le premier où l'élève avait une générale chiffrée), matières — toutes sur les fiches, seulement **sous 10** dans le tableau (**gras** sur papier).
  - ⚠️ **Exception à la borne par date d'import, réservée au CONSEIL** (arbitré) : il se tient souvent après la fin de période, l'export de la veille porte les moyennes définitives. Mi-période / point du mois : dernier import d'avant la fin du moment, comme fiche et carte de chaleur.
  - `_moyPourPeriode` retient la période du bureau numérique (colonne « Périodes ») dont le **premier** import tombe dans la période de l'app, et en prend le **dernier** import, où qu'il tombe. ⚠️ **Aucun repli** sur « importée pendant la période » : l'export de février du S1 garnirait la feuille du S2 (testé dans les deux sens). Sans import, la feuille le **dit** au sous-titre.
- ⚠️ **Les élèves PRÉSENTS pendant la période**, pas ceux d'aujourd'hui (parti en septembre → feuille du S1 avec « parti le … », pas S2 ; arrivé en mars → l'inverse). Ordre de la liste à l'écran, **sans le filtre de recherche**.
- `_periodePrintHTML` rend `{ kind, html }` ; tout échappé (testé avec nom et bilan piégés). ⚠️ Papier réel non vérifié (règles d'impression injectées à l'écran seulement).

### Un seul bouton « 🖨 Imprimer… »

La barre de 👥 Élèves n'a que **🖨 Imprimer…** (et Ctrl+P sur Élèves) → `mperiode`, qui demande d'abord **Quoi** (`_periodePrintOpts.quoi`, de séance) : **le trombinoscope** (cf. *📷 Photos des élèves*) ; **la liste telle qu'à l'écran** (défaut ; `printEleves({ format })` ; A4 en 8,5 pt, **A3 en 12 pt**, `_elevesPrintPt`, taille toujours FIXE) ; **la synthèse d'un moment** (tableau une page, ou fiches = fiche élève imprimée, une page par élève).

⚠️ **Les « résumés » (ancienne forme courte par élève) sont SUPPRIMÉS** (rendu, CSS `.print-fiche*`, option) ; leurs tests portent sur `_fichePrintHTML`. Fiche ouverte, Ctrl+P ouvre l'impression de la fiche.

### La fiche élève imprimée

- **`_fichePrintHTML(cls, sid, col, opts, photo)`** : la fiche du tableau de bord sur papier, bornée au moment (`_ficheBornes`), **une page par élève** (`.fp-page`, `break-after: page`) — en-tête (photo, nom, classe · âge · groupe · options · aménagements · délégué, moment), bilan et décisions du moment sur toute la largeur (**vides : lignes pointillées à remplir au stylo**), deux colonnes (identité, remarque, observations avec courbe, moyennes — sous 10 en gras —, incidents avec décision, contacts, papiers avec choix portés), puis avis des collègues et, au choix, les autres moments. Parties : `FICHE_PRINT_PARTS` (*Autres bilans* décoché par défaut). Paragraphes gardés (`.fp-pl`). CSS `.fp-*` dans `@media print` ; pas de mesure « une page » (une fiche trop longue continue sur la suivante).
- **Bouton *🖨 Imprimer* dans la barre de la fiche**, et **Ctrl+P fiche ouverte** (sans autre fenêtre par-dessus) → `mficheprint` (`openFichePrint`) : moment (`_momentsOptionsHTML`, partagée avec la synthèse), parties, photo, **cet élève ou toute la classe** (`_fichePrintEleves` : présents de la période, ordre de la liste), A4 / A3. Réglages de séance (`_fichePrintOpts`), rien dans `S`.
- **Synthèse de période, forme *fiches*** = la même fiche par élève ; les blocs cochés deviennent ses parties (identité et remarque toujours, courbe avec les observations).
- `_fichePrintGo` lit les photos d'abord ; `_printHTML` **décode les images** avant d'imprimer. ⚠️ Papier réel non vérifié.

## Avis des collègues

Demande d'avis aux collègues sur certains élèves avant les bilans, via un lien de réponse dont l'app récupère les réponses.

### Le circuit, et pourquoi

**Feuille de calcul du Nuage** (Nextcloud académique, Collabora, **.ods**), **un onglet par discipline**, partagée par **lien public en modification** (collègues sans compte). Le client Nextcloud la recopie sur le poste (`~/Nextcloud/…`, nuage03) ; l'app la **prépare** (onglets, élèves, titres) et la **relit** dans ce fichier local par File System Access (un handle par campagne, IndexedDB `avis_<id>`, propre au poste).

- ⚠️ **Pourquoi pas plus direct** : page statique sans serveur, le navigateur lui interdit de parler au Nuage (CORS, CSP). **Formulaires n'est PAS activé** sur le Nuage (`…/apps/forms` → erreur, vérifié par l'utilisateur). Google Forms, Framaforms : écartés, un avis sur le comportement d'un élève ne sort pas des services de l'Éducation nationale.
- ⚠️ **Réponses LIBRES**, aucune échelle, aucun calcul (arbitré).
- **Sans File System Access** (Firefox) : télécharger la feuille, la déposer dans le Nuage, relire par « Lire la feuille… ».

### Colonnes et modèles

- **Trois colonnes d'origine** (`AVIS_CRITERES`, arbitrées) : **Travail** · **Participation** · **Comportement**, chacune avec sa **consigne** (`aide`) écrite sous l'en-tête et dans le message. ⚠️ **Pas de colonne « à dire au conseil »** (refusée). Migration : `AVIS_CLES_ANCIENNES` (au chargement) et `alias` (anciens en-têtes toujours lus).
- **Colonnes réglables par feuille** : `camp.colonnes = [{ key, label, aide, alias? }]`, figées avec la feuille ; **absentes = les trois d'origine** (`_avisCols`). Modèles `AVIS_MODELES` : *Travail · Participation · Comportement* (conseil), *Appréciation de bulletin* (une colonne), *Une remarque libre* (une colonne, d'office pour le point du mois, `_avisModeleDefaut`), *Points forts · À travailler* ; ou personnalisées, 1 à `AVIS_COLS_MAX` = 5. Réglées à la création (le modèle suit l'objectif tant qu'on n'y a pas touché) et dans le volet *🧱 Colonnes de la feuille* (puis *Mettre la feuille à jour*).
  - `avisColonnesSet` (pur) : ⚠️ **la CLÉ d'une colonne ne change jamais** (les avis sont rangés dessous) ; renommer garde la clé, l'ancien titre passe en `alias` ; colonne neuve : clé de son modèle ou `c_<titre>` ; **refus** d'une colonne retirée qui porte des avis, d'un titre vide, en double ou « Élève », de zéro ou plus de cinq colonnes.
  - Tout suit les colonnes : l'.ods (trois colonnes d'origine = 21,6 cm partagés, une seule 14 cm ; « Écrivez dans la colonne de droite »), la lecture (⚠️ un onglet dont AUCUN en-tête n'est reconnu n'est pas lu : vide, il ferait foi et proposerait d'effacer), revue, compte, message (repère `{colonnes}`), fiche, bilan, synthèse de période. Démo : un **point de mars** à une colonne *Remarque* (`demo_av2`).
- **Élèves demandés en particulier** (`camp.cibles`, ⭐ dans la modale) : nom **surligné en jaune** (style `vif`) dans chaque onglet, dit dans le mode d'emploi et le message ; purgés avec l'élève. ⚠️ Changer la liste d'une feuille préparée demande *Mettre la feuille à jour*.

### Objectif de la feuille

Conseil de classe · conseil de mi-période (« mi-semestre » / « mi-trimestre ») · point du mois. Choisi à la création, réglable en tête (rangé dans `camp.msg.moment` / `mois`). `_avisObjectif` → `{ court, long }`, DIT partout (titre, liste, message `{objectif}`, bilan, fiche). ⚠️ `_avisEleve(cls, sid, pIdx, prefere)` lit d'abord la feuille du MÊME objectif (bilan de mi-période ← avis de mi-semestre, conseil ← conseil, synthèse comprise, par `o.type`). Démo : deux feuilles au S1.

- **Mes bilans pour l'objectif de la feuille** : bouton *✍️ Noter mes bilans pour …* → `mbilan` en **mode feuille** (`_bilanMode = { type, date, campId }`, `_avisBilanMode`) : type de bilan = objectif (type `mois` de `_BILAN_TYPES`, « Point de septembre » par `_bilanLabel`), date de la feuille si dans la période (sinon aujourd'hui ramené dedans), élèves dans l'ordre de la feuille, avis de CETTE feuille au-dessus. ⚠️ `_bilanCible` **reprend** le bilan du même type et de la même période (même mois pour un point du mois) au lieu d'en créer un second.

### Le message aux collègues

- **En PARTIES** : `AVIS_MSG_PARTIES` (salutation · le moment · la demande · **seulement si besoin** — « ne compléter que pour les élèves dont vous en ressentez le besoin », partie à part — · colonnes · élèves en particulier · échéance · formule finale), `AVIS_MOMENTS`. Chaque partie se coche (`camp.msg.off`) ; une partie sans objet se retire d'elle-même. Les **textes** sont des modèles partagés : `S.prefs.avisMsg` ne garde que ce que l'utilisateur a RÉÉCRIT (↺ revient au texte proposé) — remplacé, jamais modifié en place. Repères (`_avisMessage`, pur) : `{classe} {periode} {mois} {lien} {eleves} {echeance}`.
- **Texte riche** : `_avisMsgParties` (pur) assemble les parties en morceaux ; `_avisMessage` → brut, `_avisMessageRiche` → HTML (paragraphes, `**gras**`, puces « – », élèves en liste, lien cliquable **seulement https** `_avisLienSur`, tout échappé, styles EN LIGNE car un client de messagerie jette les feuilles de style). ⚠️ Les repères simples sont remplacés DANS le texte avant le découpage (« **avant le {echeance}** » reste en gras d'un bout à l'autre). Aperçu `#mavis-msg` ; **📋 Copier le message mis en forme** écrit `text/html` ET `text/plain` (`ClipboardItem`, repli sélection + `execCommand('copy')`) ; **Copier en texte brut** à côté.
- **Objet du courriel** : `AVIS_MSG_OBJET` (« Votre avis sur les élèves de la {classe} pour {objectif} »), réécrit = gardé dans `S.prefs.avisMsg.objet`, rendu par `_avisObjetMail` (pur : une ligne, sans gras, sans `{lien}` ni `{eleves}`), bouton 📋 à part — pas dans le message.
- **Formule et signature** : partie `fin` (« Merci d'avance pour votre aide. / Bien cordialement, ») puis `signature` (`{nom}` · « Professeur principal de la {classe} » · `{etablissement}`) ; une ligne aux repères vides disparaît. `S.prefs.avisNom` (« Votre nom »), `S.prefs.etablissement` (celui du PV), par `avisSignatureUI`.
- **Signature HTML de la messagerie** (`S.prefs.avisSignatureHtml`) : REMPLACE la partie signature — telle quelle dans le riche, par `_htmlTexte` dans le brut. ⚠️ Elle finit dans `innerHTML` et dans un courriel : **filtrée par `_htmlSur`** (pur, sans DOMParser) à l'enregistrement ET au rendu — liste blanche de balises/attributs, contenu script/style/svg retiré, style refusé s'il contient `url(`, `expression`, `javascript:`, `@import`, entité numérique ou barre oblique inverse, liens https/mailto seulement, AUCUNE image (traceur, CSP), balises **équilibrées** (une table ouverte avalerait la modale).
  - ⚠️ La signature réelle de l'utilisateur ne va ni dans le code ni dans les tests (dépôt public) ; les tests en utilisent une inventée.
  - ⚠️ L'aperçu est sur une surface **courriel blanche dans les deux thèmes** (`--mail-bg/-fg/-link/-rule`, mêmes valeurs aux trois endroits) : une signature collée porte ses propres encres sombres.

### Disciplines et matières

- **Disciplines** (`S.disciplines`, `_disciplinesSeed`, comme les instances : d'office décochables, pas supprimables) : allemand (ALLEMAND et ALLEMAND BILINGUE s'y rangent, la LCE non — l'app demande ; un « Allemand » créé à la main est gardé sans doublon), anglais, arts plastiques, éducation musicale, EPS, enseignement des religions, français, histoire-géographie, mathématiques, physique-chimie, SVT, technologie. Réglables dans 💾 Données (nom, nom d'onglet ≤ 31 caractères sans `[]*?:/\`, actif), complétables (Latin…).
- **Code d'option** : `S.disciplines[did].code` (absent = toute la classe suit ; plusieurs codes par virgules, rangés par `_discCodesTexte` : majuscules, sans doublon, six au plus), colonne *Option (code)* de Données (`datalist#disc-codes` ; « n élèves en 5e C » ou « ⚠ aucun élève »). `_discSuit(did, sid)` : l'élève porte une option dont le CODE ou le NOM (normalisés) est l'un des codes. Effets : l'onglet de la feuille ne liste que ces élèves (`_avisFeuilles`) ; une discipline non suivie n'est ni « sans réponse » ni comptée (résumé, lecture, fiche) ; case « — » dans la grille « Qui a écrit sur qui » (légende *non concerné (option)*) et la carte de chaleur ; dans 📋 Suivis la matière part avec ses `codes` (`_suivisCommun`) et le pinceau de l'emploi du temps prend d'office le groupe de l'option (cf. `fiches-suivi/CLAUDE.md`). ⚠️ Un avis déjà écrit sur un élève qui ne suit pas la discipline reste compté et affiché. Démo : *Latin*, code LATIN, deux avis.
- **Domaines et couleurs d'onglets** : `DOMAINES` (langues bleu · lettres et humanités brique · sciences vert · arts violet · EPS orange · autre gris), `S.disciplines[did].domaine` (d'office `DISCIPLINES_DOMAINE`, réglable ; ajoutée → « autre »), `_discCouleur` (teinte du domaine éclaircie selon le rang). Catalogue et onglets **rangés par domaine** (`_disciplinesAll`, `_avisDidsOrdonnes`). Dans l'.ods la couleur s'écrit deux fois : `tableooo:tab-color` (style de la table) et `TabColor` (`settings.xml`). ⚠️ Vérifier sous LibreOffice/Xvfb (`SAL_USE_VCLPLUGIN=gen`) avec `env -u WAYLAND_DISPLAY`, sinon il s'ouvre sur l'écran de l'utilisateur.
- **Matières des moyennes → disciplines** : `_matiereDisc(mid)` — `m.disc` posé à la main (un id, ou `''` = ignorée), sinon motifs de `DISCIPLINES_DEFAUT` sur le nom normalisé (relevés sur de vrais exports : « ÉD.PHYSIQUE & SPORT. », « SCIENCES VIE & TERRE », « SVT BILINGUE », « ANGLAIS LV2 », « HISTOIRE-GEOGRAPHIE EMC »), sinon discipline ajoutée de même nom. ⚠️ L'EPS se teste AVANT la physique-chimie (« ÉD. PHYSIQUE » contient PHYSIQUE). ⚠️ **Rien n'est deviné** (allemand, LCE, espagnol…) : la modale **pose la question** (« à rattacher », nouvelle discipline, ignorer) ; Données corrige tout.
- **Professeur** de l'onglet : DERNIER import de moyennes de ses matières (`_discProfsAuto` — LV1 et LV2 réunies, co-enseignants tous, sans doublon) ; ⚠️ **un nom TAPÉ passe avant** (`S.disciplines[did].profs`, champ dans la modale et dans Données) ; vidé, ou égal à celui des moyennes, il redevient automatique.

### Campagne et revue avant/après

- **Campagne** (`S.avis[classId][campId]`) : `{ id, date, cible, label, fichier, lien, lu, disciplines: [{ id, nom, onglet, profs }] (onglets de LA feuille, figés), avis: { sid: { did: { travail, participation, comportement } } }, cibles: [sid], msg }`. ⚠️ **`cible` = la fin de la période visée**, choisie à la création (le conseil du S1 préparé en février reste « pour le S1 »). Élèves de la feuille : **présents pendant la période**, **ordre alphabétique**.
- ⚠️ **RIEN n'est repris d'office** (arbitré : montrer avant-après, laisser cocher, pour ne pas écraser par accident). `_avisChangements` liste chaque case qui diffère (élève × discipline × critère : `ajout` · `modif` · `suppr`), la **revue** (`_avisRevueHTML`) montre « dans l'app » / « dans la feuille », `_avisAvecChoix` applique les seuls choisis. Cochés d'office (`_avisCochesDefaut`) : ajouts et modifications, **jamais un effacement**. Trois moments : **relire** (non coché = reste dans la feuille, reproposé), **mettre à jour** la feuille (non coché = remplacé par la version de l'app, l'écran le dit), **nouvelle feuille dans un fichier qui contient déjà des avis** (feuille du S1 réutilisée au S2) : **rien n'est coché**, ce qui n'est pas repris est effacé du fichier.

### Lecture et écriture

- **Lecture** (`_avisLire`, pur) : onglet par son nom (ou, renommé, par la discipline en titre), colonnes par leur **en-tête** (un collègue peut en déplacer une), élève par la clé de nom des moyennes. ⚠️ **Rien n'est rangé au hasard** : homonymes parfaits, nom retouché, onglet inconnu sont **rapportés**. **Fusion** (`_avisFusion`) : un onglet lu fait foi (un avis effacé par son auteur disparaît), un onglet ABSENT du fichier garde ses avis (une mauvaise feuille n'efface rien). Un undo seulement si quelque chose change. Relecture silencieuse à l'ouverture si la permission est restée accordée — elle n'ouvre que la revue.
- **Écriture** (`_avisEcrireFeuille` → `_avisEcrireMaintenant`) : relit d'abord le fichier ; s'il diffère de l'app, la revue passe avant ; un fichier qui contient AUTRE chose qu'une feuille d'avis n'est écrasé qu'après confirmation. ⚠️ Mettre à jour pendant qu'un collègue écrit peut créer un conflit dans le Nuage (la modale prévient).

### Module .ods et police Andika incluse

Module (`_zipStore`, `_zipRead`, `_odsBuild`, `_odsRead`) : ZIP « stored » à l'écriture (le `mimetype` premier, sans champ extra : règle ODF), deflate à la lecture par `DecompressionStream('deflate-raw')` (ajouté au bac à sable du harnais), parseur XML maison (pas de DOMParser dans le harnais).

- ⚠️ Collabora et LibreOffice écrivent des **répétitions énormes** de cases vides (1 048 576 lignes) : ne développer que ce qui a du contenu, et borner.
- ⚠️ Sans `xmlns:ooo` sur `settings.xml`, LibreOffice ignore le gel des volets en silence.
- **Quadrillage masqué** (`ShowGrid` à `false`, vue ET onglet ; arbitré : les bordures des cellules dessinent le tableau). Ligne des consignes **encadrée** (style `consigne`). Le mode d'emploi rappelle **Ctrl+Entrée** (nouveau paragraphe dans la même case ; Entrée seule change de case). **Gras** (option de cellule `gras`, `**…**` → span `T1`, réservée aux textes de l'app) : « rien à signaler », « Nouveau paragraphe dans la même case : Ctrl+Entrée », « SURLIGNÉS EN JAUNE ».
- **Onglets verrouillés** : `table:protected="true"`, seul le style `saisie` porte `style:cell-protect="none"`. Sans mot de passe (protection contre les fausses manœuvres) ; conservé par un réenregistrement LibreOffice. ⚠️ Comportement dans Collabora Online à voir une fois en vrai.
- **Colonne des noms à la largeur du plus long** (`_avisLargeurNoms`) : estimée caractère par caractère en gras 10 pt, entre 4,6 et 12 cm — un tableur ne recalcule pas une largeur « optimale » à l'ouverture.
- **Andika INCLUSE** : `_ODS_ANDIKA` — quatre variantes en **TrueType** (pas woff2 : ce que lisent LibreOffice et Collabora), sous-ensemble latin, déjà deflate avec CRC et taille (`scripts/gen_fonts.py --ods` ; `_zipStore` les pose telles quelles en méthode 8), ≈ 90 Ko. Dans l'archive : `Fonts/*.ttf` déclarées dans le manifeste, `office:font-face-decls` (content et styles, `loext:font-style` / `font-weight`), style `Default` en Andika, et `EmbedFonts` dans `settings.xml`.
  - ⚠️ Sans `EmbedFonts`, le premier enregistrement par Collabora (un collègue qui écrit) jette la police.
  - ⚠️ **Métriques verticales resserrées** dans les TTF inclus (ligne 1,61 em → 1,24 em, `hhea`/`OS/2`) : la hauteur optimale des lignes est calculée AVANT d'activer la police incluse, avec une police de repli ; avec les métriques d'origine les noms sortaient rognés (retirer le `row-height` fixe ne suffisait pas).
  - ⚠️ `--ods` : la sortie woff2 varie d'une version de fontTools à l'autre, ne pas régénérer les blocs CSS sans raison.
- **Hauteurs de lignes** (arbitré : fixes pour les quatre premières lignes, automatiques ensuite) : titre, mode d'emploi, consignes, en-têtes à hauteur FIXE (`sh.rowHeightsCm` → styles `rohN`, `use-optimal-row-height="false"`), calculée par `_odsLignes` / `_odsHauteurCm` sur les **chasses réelles** d'Andika (`_ODS_ANDIKA_LARGEURS`, exportées par `gen_fonts.py --ods`, gras/italique compris, `**…**` mesurés en gras) ; lignes d'élèves automatiques (`ro1`). La largeur de la colonne des noms se mesure de même.
- ⚠️ La police incluse s'appelle **« Andika SuiviPP »** (nom réécrit dans la table `name` des TTF) : avec Andika installée, le tableur préférait la police du système, aux métriques d'origine, et les hauteurs fixées ne collaient plus.
- ⚠️ **LibreOffice signale « Andika SuiviPP » comme manquante** (« La police active n'est pas disponible et va être substituée »). **Faux signal, à ne pas « corriger » en renommant** : la case ne connaît que les polices INSTALLÉES ; le texte est bien dessiné avec la police incluse (export PDF sous LibreOffice 26.2 : quatre variantes `AndikaSuiviPP` incluses), et la contre-épreuve (renommée « Andika », Andika désinstallée) donne le même avertissement. **Arbitré : on garde « Andika SuiviPP ».** Dans le Nuage (Collabora) la feuille s'affiche bien.
- Limites : une ligne d'élève qui CONTIENT déjà un long texte à l'ouverture peut être mal dimensionnée ; ⚠️ **non vérifié dans Collabora Online**, à regarder une fois dans le Nuage. Validé par LibreOffice (réenregistrement, export CSV, gel sous python-uno) ; fixture d'une feuille réenregistrée : `test/fixtures/avis-libreoffice.ods` (noms inventés).

### Créer la feuille depuis l'app

- *📄 Créer la feuille et la préparer…* (`avisPreparerUI(false, true)`, `_avisCreerHandle` → `showSaveFilePicker`) : on l'enregistre dans un dossier synchronisé par Nextcloud, puis on la partage dans le Nuage par lien public en modification. *📂 Choisir une feuille existante…* reste pour une feuille vide créée dans le Nuage. Sans `showSaveFilePicker`, pas de bouton Créer ; le téléchargement (Firefox) prend le même nom. ⚠️ La vraie boîte « Enregistrer sous » et l'arrivée dans le Nuage : à essayer à la main.
- **Nom** : champ `mavis-nom`, proposé par `_avisNomFichier` (pur : « Avis des collègues — 5e C — conseil S1 — 2025-26.ods », « mi-S1 », « point de mars »), suit période, objectif et mois (`_avisNomMaj`) tant qu'on ne l'a pas réécrit (`_avisNomDraft`, de séance, oublié au changement de classe ; vidé, il redevient proposé) ; `_avisNomPropre` retire ce que les systèmes de fichiers refusent et assure le `.ods`.
- **Le lien de partage vient APRÈS** la création (on ne le connaît pas avant) : tant que la feuille n'a pas de lien, son panneau commence par l'encadré **🔗 Étape suivante : partager la feuille** (`_avisPartageHTML` : dossier d'arrivée, ＋ *Lien de partage* réglé pour que ceux qui ont le lien puissent modifier, champ `mavis-lien-etape` → `avisLienUI`), amené à l'écran après la création. Collé (https seulement), l'encadré disparaît et le lien se corrige dans *✉️ Le message aux collègues*.
- ⚠️ **Le formulaire de création se redessine en cours de saisie** (⭐, colonne, matière rattachée) : période, objectif, mois et disciplines ne vivent que dans ses champs et repartaient à leur défaut. `_avisRender` les lit (`_avisNouvelleEtat`) avant de redessiner et les repose après (`_avisNouvelleRemettre`). Tout nouveau champ de ce formulaire sans brouillon à lui s'ajoute là.

### Onglet 🗣 Avis des collègues et lecture des avis

- **Onglet** à lui, après Vie de classe (`renderAvisTab`, ids `mavis-*` des champs, `_avisOnglet()` ; l'ancienne fenêtre `mavis` a disparu). À gauche, les **récoltes** (`_avisListeHTML` : objectif · période, date, fichier, un trait par discipline qui a répondu, n avis, ⭐, colonnes) et *＋ Nouvelle feuille d'avis* ; à droite, la feuille choisie puis la grille **« Qui a écrit sur qui »** (`_avisGrilleHTML` : élèves × disciplines, case pleine / pâle selon les colonnes remplies, avis en infobulle, totaux en bout de ligne et en pied). `openAvis(campId)` bascule sur l'onglet ; le bouton de 💾 Données y mène aussi.
- **Lire les avis** : fenêtre `mavislire`, `openAvisLire(vue)` — `{ did }` (un élève par ligne, élèves sans avis nommés dessous), `{ sid }` (une discipline par ligne avec son professeur, disciplines sans réponse nommées, lien vers la fiche), `{ did, sid }` (une colonne par ligne). Rendu par `_avisLectureHTML` (pur : `{ titre, html, prev, next }`) ; ◀ ▶ (`avisLireNav`) : discipline voisine, élève suivant qui a un avis, ou descente de la colonne ; les noms basculent d'une vue à l'autre. Cliquables (`role="button"`, Entrée) : en-tête et pied d'une discipline, case remplie, total d'une ligne, nom d'une discipline qui a répondu. Lecture seule ; paragraphes gardés (`.pf-mx`). ⚠️ `_avisLire` est déjà la LECTURE du fichier .ods : l'état de la fenêtre s'appelle `_avisLireVue`.
- **Où on les lit** : fenêtre de bilan (avis de la période sous les yeux, `_bilanHint`, suit la date), fiche (section 🗣, lecture seule : la source est la feuille), synthèse de période (bloc *Avis des collègues*, **décoché par défaut** : texte long). Le message aux collègues (lien `https` seulement) se copie depuis la modale.

### Purge, validation, démo

`camp.avis[sid]` dans `_purgeStudentRefs`, `S.avis[classId]` dans `_purgeClassRefs` ; liste blanche de `_validateImport` (deux niveaux) ; état maximal du balayage. RGPD : le bandeau dit que la feuille (noms compris) vit dans le Nuage, ouverte à qui a le lien. Démo : une feuille du S1 relue (13 avis, 7 disciplines), « ESPAGNOL LV2 » laissée sans discipline pour que la question se voie.

## 📷 Photos des élèves (v1.48.0)

**Code COPIÉ de Plan de classe** (v2.64.0 → v2.64.2, commit `ace7234`, section *📷 Photos des élèves* de son CLAUDE.md) : lecteur PDF minimal (`_pdfOpen`, `_PdfLexer`, `_pdfStreamBytes`, `_pdfFont`, `_pdfScanPage`), lecture du trombinoscope (`_trombiParsePdf`, `_trombiParseHeader`, `_trombiDedupNames`), appariement (`_trombiSplitName`, `_trombiScore`, `_trombiMatch` — rien n'est deviné à égalité —, `_trombiResolveClass`). Les pièges de format MBN et d'appariement sont documentés là-bas ; à relire avant d'y toucher.

- **Stockage : `<dossier des pièces jointes>/photos/<sid>.jpg`** (`PHOTOS_SUBDIR`, `pjDirHandle`).
  - ⚠️ **Le dossier des PDF, PAS celui de la sync** (arbitré par l'utilisateur : la sync fait tourner ses JSON, on n'y mêle pas de documents ; Plan de classe, lui, prend son dossier de sauvegarde).
  - Ni dans `S`, ni dans `localStorage`. Cache `_photos` (sids lus au démarrage par `_photosRefresh(false)` après `tryRestorePjDir`, URL `blob:` à la demande). La fiche demande une fois l'autorisation de lire si des photos sont connues (`suiviPP_photosKnown`).
- **Import** (`openTrombiImport`, modale `mtrombi`) : *📥 Importer des photos* dans la barre de 👥 Élèves et dans 💾 Données ▸ Imports. Classe lue dans l'en-tête, modifiable ; une carte par photo (nom lu, élève proposé, « ignorer », « 🔁 remplace ») ; élèves présents sans photo nommés. Pas de professeur principal repris (Suivi PP n'a pas ce champ).
- **Une photo à la fois depuis la fiche** : case dans la carte *Identité et repères* (`#fiche-photo`, `_fichePhotoFill`, appelée en fin de `_ficheRender`). Sans photo : « 📷 Ajouter une photo · ou Ctrl+V » et *📋 Coller* ; avec : *📷 Changer*, *📋 Coller*, *🗑 Retirer* (boutons nommés). Sources : fichier, **image glissée**, **Ctrl+V** (écouteur `paste`, fiche ouverte sans autre fenêtre par-dessus, hors champ de texte) ou `navigator.clipboard.read`. `_photoFileToJpeg` : JPEG d'au plus 400 px, fond blanc. Retrait confirmé (« Ctrl+Z ne le ramène pas »). Vignette 44 px dans l'en-tête de la fiche (`#mfiche-ph`), dans les trois vues.
- **Survol d'un nom** : tout nom qui ouvre la fiche porte `data-photo-sid` (`_nomFicheHTML`, liste, carte de chaleur) → `#photo-pop` après 250 ms. ⚠️ Toute nouvelle grille passe déjà par `_nomFicheHTML` : elle a la photo au survol sans rien faire.
- **Trombinoscope** : **troisième affichage** de 👥 Élèves, *📷 Trombinoscope* (`_ELEVES_AFFS`, retenu sur le poste comme les deux autres) — les élèves de la liste (tri, recherche, filtres), une carte chacun (`_trombiCarteHTML` : photo posée après coup par `_trombiPhotosPoser`, initiales en pointillés sans photo, nom surligné du délégué, groupe et options), clic → la fiche. Bandeau (`_trombiVueBandeauHTML`) quand il n'y a pas de dossier, pas d'autorisation (le bouton la demande) ou pas de photo.
  - **Papier** : troisième choix de *🖨 Imprimer…* (`quoi: 'trombi'`, présélectionné depuis cette vue) — 4, 5 ou 6 photos par rangée, groupe et options en option, A4 / A3 portrait (`_trombiPrintHTML`, `printTrombi`) ; 25 élèves à 5 par rangée tiennent sur une page A4.
- **Carte de chaleur** : vignette de 26 px devant chaque nom (`.ch-ph`, posée par `_trombiPhotosPoser`), dans un lien vers la fiche portant `data-photo-sid` ; case pointillée vide pour un élève sans photo ; **rien du tout** tant qu'aucun élève de la classe n'en a.
- **Indicateurs** : même vignette (`_vignetteHTML(sid, avecPh)`, partagée avec la carte de chaleur) ; ligne de 43 à 46 px.
- **Grilles des observations et des moyennes** : même vignette devant chaque nom (ligne + 3 px) ; `_trombiPhotosPoser` après chaque rendu (Entrée passe toujours à l'élève suivant malgré le re-rendu).
- Les trois affichages de la liste, la carte de chaleur et les grilles ont donc les photos. Un clic sur l'onglet Élèves, Observations ou Moyennes (`showTab`), ou le passage à la carte de chaleur / au trombinoscope, demande l'accès au dossier s'il manque ; `_photosChanged` redessine l'onglet ouvert.
- ⚠️ **Supprimer un élève ne supprime PAS sa photo** (écart assumé avec Plan de classe) : Ctrl+Z rend l'élève, jamais un fichier — même règle que les PDF. *🧹 Orphelins…* (Données) liste aussi les `photos/<sid>.jpg` dont l'élève n'existe plus (`_photosOrphelines`) et les supprime sur confirmation.
- RGPD : le bandeau cite les photos et leur dossier. La démo n'en porte pas (ce sont des fichiers).
- Tests : `test/photos.test.js` sur `test/fixtures/trombi/fake-trombi.pdf` (copie de la fixture de Plan de classe : noms inventés, carrés de couleur), dossier simulé en mémoire. ⚠️ Dépôt public : jamais un vrai trombinoscope. ⚠️ Non vérifié : `navigator.clipboard.read` (bouton 📋) et un vrai dossier Nextcloud — à essayer à la main.

## Incidents et instances

Ce qui se passe quand ça se passe mal, et ce qui en découle : fiche incident (éventuellement avec le PDF du scan), retenue, commission éducative, conseil de discipline… L'app propose toutes les instances officielles, l'utilisateur les règle ou les décoche, et note la décision prise.

- **Catalogue pré-rempli et réglable** (`INSTANCES_DEFAUT`, semé par `_instancesSeed` dans `postLoadHook`), aux noms réels (éduscol *Les procédures disciplinaires*, circulaire n° 2014-059, R511-13 / R511-19-1), rangé par famille :
  - **Signalement** — rapport d'incident (la « fiche incident » de l'établissement) ;
  - **Punitions scolaires** (circulaire 2014-059, liste indicative, jamais au dossier) — excuse orale ou écrite · devoir supplémentaire · retenue · exclusion ponctuelle de cours · autre punition ;
  - **Sanctions disciplinaires** (R511-13, échelle EXHAUSTIVE : six, aucun règlement intérieur ne peut en ajouter) — avertissement · blâme · mesure de responsabilisation · exclusion temporaire de la classe · exclusion temporaire de l'établissement · exclusion définitive ;
  - **Mesures de prévention et d'accompagnement** — fiche de suivi · engagement écrit (contrat) · tutorat ;
  - **Instances et réunions** — commission éducative · conseil de discipline · équipe éducative · équipe de suivi de la scolarisation (ESS) · cellule de veille / GPDS ;
  - **Protection de l'enfance** — information préoccupante ; **Autre**.
  - Chaque instance porte sa famille (`cat`, `INSTANCES_FAMILLES`) : le sélecteur de la modale les groupe en `<optgroup>`, le tableau de Données en lignes d'en-tête. Renommer, décrire, décocher, ajouter — dans 💾 Données et réglages (une instance ajoutée va dans *Autre*).
  - ⚠️ **Migration des libellés** : un libellé resté à son ancienne valeur par défaut suit le nouveau (« Fiche incident » → « Rapport d'incident », « Exclusion temporaire » → « … de l'établissement », « Punition scolaire » → « Autre punition »), un libellé modifié par l'utilisateur est respecté — le cinquième champ de `INSTANCES_DEFAUT` porte l'ancien défaut. L'ordre des instances d'office suit TOUJOURS le tableau (une insertion au milieu s'y place). Testé dans les deux sens.
  - ⚠️ **Le semis complète sans écraser** : un réglage de l'utilisateur survit, une instance ajoutée par une version ultérieure apparaît d'elle-même, un fichier antérieur à la section arrive avec le catalogue complet. Testé dans les trois sens.
  - ⚠️ **Une instance d'office se DÉCOCHE, ne se supprime pas** ; une instance ajoutée se supprime si rien ne l'utilise. Une entrée dont l'instance a disparu garde un libellé (`_instanceOf`) : on ne perd jamais la lecture d'un incident pour une question de catalogue.
  - ⚠️ Les descriptions sont des **repères**, pas le texte réglementaire — elles s'éditent, et le règlement intérieur prime. Ne rien imprimer qui les cite comme droit.
- **Les entrées vivent sur l'élève** (`stu.incidents`) : date · instance · objet (obligatoire — « commission éducative » sans dire pourquoi ne sert à rien au conseil) · texte libre (décision prise, points dits) · PDF facultatif. Saisie dans la modale `mincident`, ouverte :
  - depuis la **fiche** (section ⚖️, boutons ✏️ 🗑 et « + Noter »), qui y revient (`ficheVersIncident` + `_modalReturnTo`) ;
  - depuis la **liste des élèves** : la case Incidents est un bouton ⚖️ (nombre d'entrées, coloré s'il y en a) qui ouvre la saisie d'une NOUVELLE entrée ; la dernière entrée s'affiche dessous et s'ouvre en modification au clic (`_syntheseRow` porte `incident.id`) — même geste que le bouton 📋 de la remarque.
  - `saveIncident` re-rend la liste. `pushUndo()` avant chaque mutation.
- **Le PDF ne va JAMAIS dans la sauvegarde JSON** : un scan pèse 200 Ko à 2 Mo, localStorage plafonne à quelques Mo (le projet voisin a touché ce plafond). Il est **copié** dans un dossier **choisi par l'utilisateur** (`pjDirHandle`, persisté en IndexedDB sous `pjdir`, distinct du dossier de sync), et l'entrée n'en garde que `{ nom, fichier, taille }`. L'utilisateur place ce dossier sous Nextcloud, qui transporte les fichiers ; sur l'autre poste, il choisit le même dossier une fois.
  - ⚠️ **Séparé du dossier de sync** : celui-ci porte des JSON à rotation (backups, conflits), et mêler des scans à cette mécanique ferait courir le nettoyage sur des documents officiels.
  - ⚠️ **L'app n'efface JAMAIS un PDF d'elle-même.** Retirer la pièce ou supprimer l'entrée laisse le fichier ; « 🧹 Orphelins… » (Données) liste puis supprime, sur confirmation, ce que plus aucune entrée ne référence. Un scan de document officiel ne se détruit pas sur un clic malheureux — et Ctrl+Z ne rend pas un fichier.
  - ⚠️ **Le nom du fichier se choisit AVANT la copie** : modale `mpjnom` → garder le nom d'origine, **nom automatique** proposé par défaut (`_pjAutoNom` : **type · qui · date AAAA-MM-JJ**, ex. `Commission éducative — GUÉRIN Nathan — 2026-02-05.pdf` ; ordre arbitré par l'utilisateur : on cherche par le type et la personne, la date trie le reste), ou nom tapé. `_pjSafeName` ne retire que ce que les systèmes de fichiers refusent (`\ / : * ? " < > |`) — **accents et espaces restent** (dossier que l'utilisateur ouvre lui-même). Pas de préfixe d'id : l'unicité se règle dans le dossier (`_pjUnique` → « (2) », « (3) »). Renoncer dans la modale laisse le formulaire tel quel.
  - ⚠️ La copie vient APRÈS l'entrée, et son échec ne la retire pas : mieux vaut un incident noté sans son scan qu'un scan sans incident — on rejoint par ✏️.
  - La permission d'un handle restauré est « à confirmer » jusqu'à un geste de l'utilisateur : `_pjReady(mode)` la redemande depuis le clic, jamais au chargement. Un handle sans `queryPermission` (OPFS, tests) passe pour accordé — ce qui permet de tester copie, lecture et orphelins sans dialogue natif.
- **Lecture dans l'app** (`pjOpen`) : modale `mpdf` avec un `<iframe>` sur une URL de blob (le lecteur du navigateur fait le reste) ; « ↗ Onglet » pour imprimer ou agrandir. ⚠️ Un nouvel onglet seul dépendait de l'anti-popup et, en application installée, sortait de la fenêtre. D'où la CSP **`frame-src blob:`** (et non `'none'`) : une URL de blob est liée à son origine, rien d'extérieur ne peut y être encadré. L'URL est révoquée à la fermeture (`_modalReturnTo['mpdf']`).
- **Synthèse** : colonne Incidents (nombre + dernier), tri « par incidents », à l'impression aussi. **RGPD** : le bandeau cite les incidents et sanctions — donnée sensible — et dit où vont les PDF.
- **Purge** : les entrées partent avec l'élève ; le catalogue ne connaît aucun sid. L'état maximal du test de balayage porte un incident avec PDF et une instance, pour que le balayage le constate plutôt que le supposer.

## Écrans

**8 onglets** : 👥 Élèves · 📓 Observations · 📈 Moyennes · 📄 Retours · 🏫 Vie de classe · 🗣 Avis des collègues (cf. *Avis des collègues*, « Où on l'ouvre ») · 📋 Suivis (cf. *Fiches de suivi*) · 💾 Données et réglages. Navigation à un seul niveau, pas de `.tab-group` à deux étages. La Synthèse n'existe plus comme onglet (fusionnée dans Élèves, cf. 5.).

### Principes communs à tous les onglets

- ⚠️ **Pas de grand titre d'onglet** : le `.sh` de chaque onglet est retiré de l'écran (gardé pour les lecteurs d'écran) ; l'onglet actif dit où l'on est.
- ⚠️ **Seule la grille défile** dans Élèves, Observations, Moyennes, 📄 Retours (tableau d'un document et ramassage) et dans la grille des bulletins d'une élection (`.rel-wrap.frozen.bul-wrap`, un peu moins haute que l'écran). Classe `.tab.fige` : `#main` prend exactement la hauteur sous le bandeau, en colonne flex ; barres d'outils et légendes gardent leur taille, le cadre figé prend le reste et défile seul. Le reste de 🏫 Vie de classe est une page qui défile normalement, bandeau en place. Écran ≥ 700 × 480 seulement, jamais sur le papier. ⚠️ Le bloc CSS est APRÈS la règle `.rel-wrap.frozen` de base (il lève son `max-height`).
- ⚠️ **Les libellés nomment ce qu'on FAIT, pas l'objet qu'on manipule** (arbitré par l'utilisateur) : onglet **📓 Observations** (titre *Observations du carnet*, bouton *+ Relever les carnets*, colonne *Observations* dans la liste et la fiche), onglet **📄 Retours** (titre *Retours de documents*, bouton *🧺 Ramasser · vérifier…*, retour arrière *← Liste*), colonne *Remarque · contacts* (le dernier contact avant la remarque). Les identifiants du code (`tab-carnets`, `documents-body`, `S.releves`, `renderCarnets`…) ne bougent pas : on renomme l'écran, pas le modèle. Les noms ci-dessous sont ceux du code.
- ⚠️ **Le nom d'un élève ouvre la fiche dans toutes les grilles** : `_nomFicheHTML` (Élèves, carte de chaleur, Observations, Moyennes, tableau d'un document, ramassage, grille des avis), même allure partout (`.el-nom`, nom en gras).
- ⚠️ **Le nom d'un délégué est SURLIGNÉ** (vert titulaire, jaune suppléant) dans les cinq grilles, par `_nomHTML(sid, nom, prenom)` qui interroge `_delegueOf` ; tokens `--del-t-*` / `--del-s-*` aux trois endroits ; l'infobulle dit le mandat. Toute NOUVELLE grille à noms passe par `_nomHTML`, sinon elle est la seule où le délégué n'apparaît pas.
- ⚠️ **Quand l'utilisateur valide un prototype, on le reproduit à l'identique, on ne l'adapte pas à l'existant** (leçon des tableaux de la liste et de la fiche, refaits d'après le prototype).
- ⚠️ `--chip-on-fg` (token, aux trois endroits) : l'encre d'une puce active était `--paper`, qui s'assombrit la nuit (2,5:1) ; corrige aussi les touches du carnet (`.rel-sug-kbd.on`).

### 1. 👥 Élèves

Liste triable, import, ajout/édition, remarque libre, aménagements, arrivée/départ, **et le suivi** (ex-Synthèse) : observations (total, date), +n sur la période, non rendus (pastille), incidents, remarque · contacts. **C'est l'écran de préparation du conseil de classe et des appels aux parents.**

- Une seule fonction, `_elevesRows(cls)`, filtre et trie les lignes `{ s, r: _syntheseRow(cls, s) }` pour l'écran ET l'impression (`printEleves`, paysage). Les colonnes de suivi se trient par en-tête, en décroissant au premier clic (le plus chargé d'abord), inconnus en fin.
- **Tri par les en-têtes** : l'en-tête porte **Nom · Prénom**, deux tris réversibles (`_elevesThNomHTML`). Pas de ligne « Trier » : les ordres de place et de ramassage servent aux SAISIES (carnet, signatures), pas à cette liste ; un mode resté d'une autre grille retombe sur le nom.
- Barre du haut : Ajouter, Importer, *🎓 Synthèse de période…*, *🖨 Imprimer…* (cf. *Un seul bouton « 🖨 Imprimer… »*). Puces : *📅 Naissances* (saisie en série ; la colonne Naissance est masquée par défaut), *🍽 Régimes*, *📥 Depuis MBN…*, *🗓 Moments*, **Vue** en boutons, **Colonnes** en puces.
- **Un clic sur la ligne ouvre la fiche** (`_elevesLigneClic`) ; les cases qui ont un geste le gardent : ⚖ et la date → l'incident, ☎ → les contacts, un point de bilan → la rédaction de CE moment, la remarque → la remarque, la case entourée d'une pastille → son action. Modifier et **supprimer** un élève passent par la fiche (🗑 en tête de la carte Identité) ; plus de colonne d'actions.
- **Aménagements en LECTURE** dans la liste : seuls les actifs, en texte coloré (`_amenBadgesHTML`, encres `--st-*-fg` comme les cases de la modale ✏️). Ils se règlent dans ✏️ (réglage qui vient de l'import, corrigé une fois par an).

#### Deux affichages (propres au POSTE : `localStorage` `suiviPP_elevesAffichage`) : indicateurs, carte de chaleur (et trombinoscope, cf. *📷 Photos des élèves*)

**▦ Indicateurs** (`_elevesIndicHTML`, tableau du prototype validé) : **une ligne par élève**, le **genre** (♂ ♀ coloré) devant le nom, âge et options sur la ligne du nom, remarque et bilans sur UNE ligne (texte entier au survol). Colonnes `ELEVES_COLS` :
- Groupe · options (groupe, options ET aménagements) ;
- **Carnet** → **Observations** : TOTAL de l'année, carnet + observations MBN, à la couleur du palier, puis « carnet n · MBN n » (sans MBN dans la classe, rien ne change) ; « **+n S2** » = ce que l'élève a pris sur la période courante, carnet ET MBN ; ▼ pour un cumul en baisse ; petite courbe `_elevesSpark(cls, sid)` = miniature de celle de la fiche (total carnet + MBN, du 1er septembre à aujourd'hui, à l'échelle du temps). Tri et papier suivent le total (« 14 (11 + 3 MBN) ») ;
- 📅 dans l'en-tête (`_obsFenetrePickHTML`, `OBS_FENETRES`) : depuis QUAND compter le « +n » (une/deux semaines, un/deux mois, début de la période) ; réglage du POSTE (`suiviPP_obsDepuis`, défaut : début de la période). `_obsFenetre(cls, cle, auj)` (pur) : fin = aujourd'hui ramené dans l'année scolaire (une année passée, comme la démo, finit au 31 juillet), début selon la durée, jamais avant la rentrée ; `_obsGagnees` = carnet sur la fenêtre (`_obsEntre`) + MBN. Le « +n 2 sem. », le filtre « Observations +3 ou plus » et la colonne « +n » de la liste imprimée suivent la même durée. ⚠️ La période « en cours » est celle du DERNIER RELEVÉ du carnet (arbitré) ;
- Moy. (moyenne et « n < 10 » côte à côte) ;
- Papiers (« n à rendre ») ;
- Incidents (« ⚖ n » + date du dernier, « jj/mm · type ») ;
- **Contacts** (« ☎ n » + date, colonne à part) ;
- **Avis** (`_avisCelluleHTML`) : feuille la plus récente de la période courante (`_avisDeLaPeriode`), un trait par discipline (plein : toutes les colonnes remplies ; pâle : une partie ; gris : rien), « n/N », ⭐ demandé en particulier ; triable (demandés d'abord), imprimée (« 3/11 ★ », pas de colonne sans feuille). La feuille d'un autre moment est DITE (« pas de feuille pour Conseil S2 »), la feuille nommée dans l'en-tête ;
- **Bilans** : UN point par moment, plein = écrit, séparés par période ; un second anneau (`.el-bd.d`) signale des décisions ;
- Remarque (une ligne).

Clés de `elevesColsOff` : `cumul` → `carnet`, les autres anciennes ignorées. Le papier garde son détail (Δ, total, une colonne de texte par moment) et suit les puces (`_elevesPrintVue`).

**Gestes des compteurs** (tous passent par la fenêtre de dialogue générique, `_appDialogValeur(v)` = un élément de son message qui rend une valeur) :
- ⚖ n (toutes les entrées de l'élève) et les cases d'incidents de la carte de chaleur appellent `chaleurIncidentsUI(sid, début, fin, libellé)` : case vide ou élève sans incident → la saisie directement ; sinon la liste des incidents QUE LA CASE COMPTE (`_chaleurIncidentsListe`, chacun s'ouvre en modification) avec *＋ Noter un nouvel incident* ; `clic.fn` reçoit les dates de la case. La date du dernier ouvre toujours celui-ci.
- *n à rendre* est un bouton → `elevesPapiersUI(sid)` : liste de `_papiersARendre(cls, sid)` (⚠️ le MÊME filtre que `_syntheseRow.nonRendus`, testé) avec dates de distribution et d'échéance ; *✓ Rendu* (`elevesPapierRenduUI`) passe par `_docMut` + `docSetRendu` (date du jour, un cran d'undo), redessine la liste et la fenêtre, qui reste ouverte jusqu'à « tout est rendu ». La date se corrige dans la fiche ou dans Retours.
- ☎ n et les cases *Contacts* de la carte de chaleur (le mois, le Total) appellent `chaleurContactsUI(sid, début, fin, libellé)` : liste lisible (`_contactsListe`, texte entier) ; un contact s'ouvre dans la fenêtre des contacts (`openContacts(sid, focusId)` : ligne `data-jid` marquée `jl-cible`, texte au focus) ; *＋ Noter un nouveau contact* ; case vide ou élève sans contact : la saisie directement. Dans la fenêtre des contacts, chaque texte est une zone `textarea.jl-txt` (`field-sizing: content`, `_autoTaille` après rendu et à la frappe), limite 2 000 caractères ; saisie d'un nouveau contact : Entrée = nouvelle ligne, **Ctrl+Entrée = noter**.
- Une case d'**avis** (carte de chaleur) ouvre la lecture de cet avis (`openAvisLire({ did, sid }, campId)`), la case repliée tous ses avis ; le compteur *n/N* des Indicateurs aussi (la fiche s'il n'y a aucun avis). `openAvisLire` prend la feuille en second argument hors de l'onglet Avis ; ses liens et ◀ ▶ restent sur la feuille déjà ouverte.

**▥ Carte de chaleur** (`_chaleurGroupes(cls, bcols, col)`, `_elevesChaleurHTML`) :
- Une case par relevé (Δ coloré aux couleurs des paliers, `chob-N`), par matière du dernier import de la période (sous 10 en alerte), par discipline de la feuille d'avis (trois niveaux `--av-1/2/3-bg/fg`, aux trois endroits), par papier (✓ ☐ —), par MOIS pour les incidents et les contacts, par colonne de bilan (● ○, ◉ si décisions ; le bilan du moment est marqué ▶). Contenu en infobulle, fiche au clic sur le nom (ligne cliquable), genre devant le nom. Deux lignes d'en-tête figées (la seconde à `top: 30px`), en-têtes verticaux assez hauts, papiers et disciplines abrégés.
- **Groupes** : *Observations du carnet* (les relevés), *Observations MBN* (les mois), **Total des observations** (`obstot`, case *Carnet + MBN* depuis la rentrée au dernier jour du moment, `_obsTotalAn(cls, sid, fin)` ; sans MBN, un seul groupe) ; *Absences et retards* (par mois + Total, rouge s'il y a du non valable, case remplie → la liste, case vide inerte) ; *Contacts* (finit par un **Total** du moment ; chaque case s'ouvre sur la fenêtre des contacts : `parMois(…, clic)`, 4e élément d'une case = son `onclick`, rendu par `td` en `role="button"`, sans ouvrir la fiche) ; *Incidents* (avec un Total, cases cliquables) ; *Bilans* (cases cliquables) ; *📋 Fiches de suivi* (cf. *Fiches de suivi*). Chaque groupe se **replie** en une case de synthèse (`chaleurPliToggle`, retenu sur le poste) ; replié, le groupe du carnet redevient le cumul et l'évolution du carnet seul.
- ⚠️ **Bornée au MOMENT du bilan** : barre *Synthèse pour* (moments de la fiche, `chaleurMomentSet`), **même choix que la fiche** (`_ficheMoment`, partagé dans les deux sens). `_chaleurGroupes` borne tout par `_ficheBornes` : relevés, mois (MBN, incidents, contacts), moyennes (au conseil le dernier import de la période, sinon le dernier avant la fin du moment), feuille d'avis de CET objectif, papiers distribués avant la fin. Par défaut le conseil de la période courante (période entière). Août a sa colonne s'il porte un événement.
- **Moments de la barre, indépendants de 🗓 Moments** : `_chaleurMomentsTous` (pur) = conseil, mi-période et chaque mois de chaque période jusqu'à la courante (ni août ni juillet) ; d'office conseil, mi-période et les mois qui ont un bilan ; le titre *Synthèse pour ▾* ouvre la liste à cocher (`chaleurMomentVu`, `S.prefs.chaleurMoments = { plus, moins }`, remplacé jamais modifié en place, un cran d'undo). Le moment choisi reste partagé avec la fiche (`_chaleurMomentCourant`). Le compte d'élèves est à droite des filtres (plus de ligne « 25 élèves sur 25 »).

**Filtres d'un clic** (`ELEVES_FILTRES`, session) : moyenne sous 10 · incident dans la période · observations +3 ou plus · papier à rendre · famille contactée · avis demandés ⭐ · sans bilan du conseil. Ils se **cumulent** (et), avec la recherche, le nombre d'élèves concernés sur chaque puce ; ils valent dans les deux affichages, sur le papier (dit au sous-titre) et pour l'enchaînement des bilans (on prépare ceux qu'on voit). La synthèse de période garde tous les présents (les filtrés au bout).

**Vues** toutes faites (`ELEVES_VUES` : *Préparer le conseil*, *Appeler les familles*, *Papiers*, *Tout*) : elles écrivent `S.prefs.elevesColsOff` (même réglage que les puces Colonnes, un cran d'undo, rien si rien ne change) ; « personnalisée » dès qu'on retouche. *Préparer le conseil* montre aussi les **Contacts** ; `postLoadHook` remet la vue à qui avait exactement l'ancienne (masquées : groupe, papiers, contacts). Les vues *Préparer le conseil* et *Appeler les familles* montrent la colonne **Absences** (« abs » ne compte pas pour reconnaître une vue enregistrée).

#### Colonnes à masquer

Puces **Colonnes** (`ELEVES_COLS`, `_elevesColsPickHTML`) qui **disent** lesquelles sont vides (`_elevesColVide`), avec *Masquer les colonnes vides* et *Tout afficher*. `S.prefs.elevesColsOff` (des clés, remplacé jamais modifié en place, un cran d'undo par geste, rien si rien ne change) : préférence DURABLE, valable **pour le papier aussi** (`_elevesPrintHTML` bâtit ses colonnes de la même liste). Le nom ne se masque pas. Le volet reste ouvert pendant qu'on coche (`_elColsOpen`) et se ferme au clic ailleurs — ⚠️ une cible DÉTACHÉE (bouton du volet qui vient de re-rendre la liste) n'est pas « ailleurs ». ⚠️ Sous 520 px le volet s'ouvre dans la barre (en surimpression il sortait de l'écran à 320 px), et son `<select>` est borné (il prend sinon la largeur de sa plus longue option).

#### Colonnes de bilan : une par MOMENT

- `_bilanColonnes(cls, pIdx, ajout)` (pur) : le **conseil** de la période courante toujours, la **mi-période** et chaque **point du mois** dès qu'un élève en a un ; ordre chronologique, conseil au bout ; en-têtes courts (*Point sept.*, *Mi-S1*, *Conseil S1*), libellé long en infobulle (« Point d'avril » : `_deMois`, et repère `{demois}` du message aux collègues). Une case ne montre QUE son moment (`_bilanDeColonne` = `_bilanCible`). Cliquer la case ouvre la rédaction de CE moment (`elevesBilanOuvrir` → `openBilan` en mode `{ type, date }`) ; ◀ ▶ remplit la colonne d'un élève à l'autre. Tri par en-tête « rédigé d'abord » (l'ancien tri `bilan` désigne la colonne du conseil). Les colonnes se masquent comme les autres et s'impriment une par une.
- **Périodes précédentes** (`_bilanColonnesListe`, pur) : colonnes de la période courante, précédées de celles des périodes passées **qui ont au moins un bilan** (le conseil du S1 vide n'a pas de colonne au S2) ; le volet les range sous *Bilans S1*, *Bilans S2*. On n'ajoute une colonne vide qu'à la période courante.
- **Puce 🗓 Moments** (`_elevesMomentsHTML`, `_elevesMoments` pur) : volet qui liste TOUS les moments, période par période, avec **−** (ceux de la colonne, et leur nombre de bilans écrits) ou **+** (ceux qu'on peut ajouter) ; reste ouvert pendant qu'on clique (`_elMomOpen`), se ferme au clic ailleurs. Ajouter une colonne vide : pour la séance (`_bilanColsAjout`, rien dans `S`), elle reste d'elle-même dès le premier bilan écrit ; ni août ni juillet proposés. Retirer : vide → disparaît ; avec des bilans → MASQUÉ (`S.prefs.bilansMasques`, un cran d'undo), les bilans restent dans les fiches, **+** le remet (« (retiré) »). `_bilanColsVues` = la liste, la carte de chaleur, le tri, le papier. Aucun moment retenu → **pas de colonne Bilans**. ⚠️ Un conseil remis par **+** ne doit pas passer dans l'ajout de la séance (il fallait cliquer deux fois **−**) : `elevesBilanColRetirer` masque tout moment qui resterait affiché. 🗓 Moments ne règle QUE la colonne Bilans de la liste (indépendant de « Synthèse pour »).

#### Régimes (entrée, sortie, demi-pension)

- `stu.regime` (`REGIMES` : DP · Ext. · Int.), `stu.joursDP` (cases à cocher dans ✏️, « DP (4 j) » dans la liste si ce n'est pas la semaine entière), **deux catalogues de codes de l'ÉTABLISSEMENT** : `stu.entree` / `prefs.regimesEntree` (A1 A2) et `stu.sortie` / `S.prefs.regimesSortie` (D1 D2 D3), `[{ code, label }]`, d'office sans signification, réglés dans 💾 Données (« D1 = … », une ligne par code, `regimesCodesUI` ; `regimesSortieUI` historique). Un code inconnu du catalogue reste affiché tel quel. ⚠️ DEUX régimes, pas un (l'export MBN les distingue) ; **migration** : le catalogue unique antérieur resté au défaut se sépare, et un code d'entrée rangé en « sortie » passe dans `entree`.
- Affichés en petites étiquettes dans la colonne Groupe · options (code de sortie en pointillés, signification en infobulle), dans la fiche (Identité, en-tête) et sur la liste imprimée. Saisis dans ✏️, ou **en série** par la puce *🍽 Régimes* (trois colonnes de menus, une salve d'undo comme les naissances).
- **Import d'élèves** : colonnes « Régime », « Autorisation de sortie » / « Régime de sortie », « Régime de ½ pension », « Jours de ½ pension », « Régime d'entrée » reconnues (`_impNormRegime` lit DEMI-PENSIONNAIRE, DP4, Externe…) ; un code lu et inconnu entre au catalogue. ⚠️ « Date de sortie » reste la date de DÉPART. L'import accepte aussi .xlsx et .ods (collés en tabulations). ⚠️ L'import **complète les élèves déjà présents** (lignes écartées comme doublons) : naissance, régime, sortie VIDES chez eux sont remplis, rien n'est remplacé (`_impACompleter`, `_impCompleter`). Corrigé : la colonne « Date de naissance » était reconnue mais jamais lue.
- **Import de l'export MBN** (`openMbnImport`, modale `mmbn`, bouton *📥 Depuis MBN…* et 💾 Données) : `_mbnLire` reconnaît les colonnes par leur EN-TÊTE (`Élève · Classe · Régime de ½ pension · Jours de ½ pension · Régime de sortie · Régime d'entrée`), « NOM Prénom (M.) / (Mme) » donne aussi la civilité (remplie seulement si vide) ; `_mbnRapprocher` rattache par la clé de nom des moyennes ; `_mbnChangements` liste chaque champ qui change, avant / après. ⚠️ Rien n'est deviné (nom inconnu, homonymes → rattachement manuel, « ignorer » par défaut) ; **rien n'est appliqué sans le bouton** (un cran d'undo) ; MBN est la source (une valeur différente remplace celle de l'app) mais ⚠️ une case VIDE de l'export ne vide rien. Les élèves de la classe absents de l'export sont nommés. Les tests fabriquent leur propre classeur aux noms inventés.
- **Lecture .xlsx** (`_xlsxRead`, `_xlsxParse`) : module ZIP et parseur XML de la feuille d'avis réutilisés (chaînes partagées, `inlineStr`, ordre des feuilles par workbook.xml et ses relations). `_tableurLire(file)` rend les lignes d'un .xlsx, .ods ou .csv.

### Fiche élève (clic sur le NOM)

Ouvre tout ce que l'app sait de l'élève. ⚠️ C'est un **dossier**, pas une vue courante : elle montre les documents archivés et les relevés où l'élève n'a rien (une case vide au 8 décembre est une information).

- ⚠️ **La fiche corrige sur place ce qui se corrige d'un geste, sans dupliquer aucune logique** : elle passe par les mêmes fonctions que les autres écrans (`_withStudent`, `_setStudentStatusExclusive`, `journalAdd`, `docSetRendu`, la modale `mincident`), sinon on duplique les gardes-fous. Un cran d'undo par geste.
- ⚠️ **Ce que la fiche corrige (groupe, options, aménagements — `_PDC_STU_FIELDS` + tags) est ce qu'un import depuis Plan de classe RÉÉCRIT.** L'éditeur le DIT (`_fichePdcHint`) quand la classe en vient : `cls.pdcImportAt`, posé par `_pdcImport` ; à défaut, la présence d'une salle `pdc_*` sert d'indice.
- ⚠️ Un document `suiviRetour: false` s'affiche « rien à rendre », **jamais « non rendu »**.

#### Barre et trois vues

En-tête sur une rangée, comme le prototype : nom, âge · groupe · options · aménagements · délégué (♂ ♀), vignette 44 px (`#mfiche-ph`), **Synthèse pour** (boutons, un par moment), vues *1 · Tableau de bord · 2 · Chronologie · 3 · Faits et rédaction* (la vue se retient sur le poste : `suiviPP_ficheVue`, et le choix n'est QUE dans cette barre), ◀ n/N ▶, bouton d'ouverture, ✕ ; plus de pied de modale. Classes `pf-*` du prototype, tokens `--pf-card` et `--i-obs/moy/incid/contact/avis/bilan` aux trois endroits. ◀ ▶ (et les flèches du clavier hors saisie) suivent la liste à l'écran, tri et filtres compris (`_ficheOrdre`).

- **Synthèse pour** : un MOMENT, avec la même liste et le même titre *Synthèse pour ▾* que la carte de chaleur (`_ficheMoments` = `_chaleurMoments`, `_ficheMomentCourant` = `_chaleurMomentCourant`, `_chaleurMomentsPickHTML(cls, 'fi')`, ouvert ou non par endroit : `_momPickOpen`). Il borne la chronologie et les faits (`_ficheBornes` : la période pour un conseil ; **du début de la période à son milieu** pour la mi-période ; le mois pour un point du mois) et choisit le bilan qu'on écrit. Moyennes : au conseil le dernier import de la période même daté après sa fin, sinon le dernier avant la fin du moment. La feuille d'avis lue est celle DU MOMENT, même vide.
- **▦ Tableau de bord** (`_ficheTableauHTML`) : des CARTES en colonnes (`columns: 400px`), bornées au moment — Identité et repères (+ remarque ✎), Bilans (rédaction + autres moments), Carnet (courbe, « n sur la période »), Moyennes (matières × imports, Δ), Avis des collègues (un onglet par feuille de la période, `ficheFeuilleUI`), Incidents (+), Contacts (+), **📋 Fiches de suivi** (cf. *Fiches de suivi*), Papiers (cochables d'un clic). Carte Identité : boutons nommés *✏️ Tout modifier*, *🗑 Supprimer*.
- **🕑 Chronologie** : chiffres clés, **frise** (une ligne par sujet, un repère par événement, cliquable vers le journal — `ficheSaut`), journal daté (`_ficheEvenements`). Frise et courbe commencent au 1er septembre (`_debutUtile`). ⚠️ La classe `.mo` du prototype (mois de la frise) est celle des FENÊTRES de l'app (`display: none`) : renommée `pf-mois` ; toute classe reprise d'un prototype se vérifie contre les classes de l'app.
- **✍️ Faits et rédaction** : les faits en phrases (`_ficheFaits`, chacun avec *＋ insérer* ; « n observations dans MBN : 2 travail non fait, 1 bavardage » insérable), la courbe, les **avis en tableau** (disciplines × colonnes de la feuille) avec les **mots qui reviennent** (`_avisMotsFrequents`, comptés par discipline, mots vides écartés, un clic les surligne), un **brouillon** assemblé (`_ficheBrouillon`) — l'app rassemble, elle ne juge pas : à réécrire.
- **La rédaction est dans les trois vues** (`_ficheRedacHTML`) : bilan du moment écrit EN PLACE, enregistré **en quittant le champ** (`ficheBilanSave` : reprend le bilan existant par `_bilanCible`, un cran d'undo par changement, un texte vidé ne supprime rien). ⚠️ **Pas de re-rendu à l'enregistrement** : un clic sur *insérer* ou ▶ fait quitter le champ, et une fiche redessinée remplacerait le bouton sous le doigt. Dessous, un champ *Décisions · à mettre en place* (`ficheDecisionSave`, un cran d'undo, sans re-rendu, aussi avant ◀ ▶ ou un changement de moment). Les autres moments montrent leurs décisions sous leur bilan.
- **Courbe du carnet** (carte *Observations*, ou *Carnet* sans MBN) : `_ficheCourbePoints` (pur) = à chaque relevé chiffré et chaque jour d'observation MBN, le cumul du carnet (0 avant le premier relevé) + les MBN depuis le début de l'année, selon les sources cochées (`_ficheCourbeSrc`, `ficheCourbeSrcUI`, pour la séance, toutes fiches) ; légende dite (« carnet + MBN · jusqu'au 20/01 (bilan) »). Dessous : *Relevés du carnet* (cumul, Δ, libellé) et *Notées dans MBN*, chacune avec sa coche. S'arrête à `_ficheCourbeFin` (pur) : date du bilan écrit pour le moment, sinon aujourd'hui, bornée à la période ; axe, mois, zone du moment et repère de mi-période s'arrêtent là.
- **Ouverture** : `_ficheOuverture` — `auto` (défaut) = **à côté de la liste** dès `FICHE_COTE_MIN` = 1 700 px CSS, **plein écran** en dessous ; réappliqué au redimensionnement. Bouton (*⛶ Plein écran* / *◧ À côté de la liste*, `ficheOuvertureBascule`), choix valable pour la SESSION (`_ficheOuvForce`), rien retenu sur le poste. À côté : `#mfiche.cote` ancrée à droite sous le bandeau (`--fiche-cote-w` = 58vw), sans voile, `aria-modal="false"`, `body.fiche-cote` donne à l'onglet une marge à droite ; la liste reste utilisable, un clic sur un nom change de fiche, la ligne ouverte est surlignée (`tr.el-cur`).
- **La fiche se ferme en quittant Élèves, Observations ou Moyennes** (`FICHE_ONGLETS`, dans `showTab`).
- **Textes libres** : remarque, bilans et avis gardent leurs retours à la ligne (`pre-line` sur `.pf-p`, `.pf-bil`, `.pf-cr > span`, `.pf-mx td`, `.pf-avd`) — ⚠️ ces gabarits ne doivent pas porter de retour à la ligne entre leurs balises. Sur le papier : `.pp-t .pp-rem`, `.print-rem`, `.pp-pl` (avis de la synthèse, hors `@media print` pour que la mesure « une page » en tienne compte).

#### Corrections sur place : le crayon ✎

Plus de « dossier complet » : ce que seul il montrait est rattaché à sa carte derrière un **✎** (`pen(k)` → `ficheEdit(k)`, un seul éditeur ouvert, refermé par le même ✎ ; éditeurs fournis par `_ficheRender` via l'objet `ed`; `_ficheEdit` historique). Les cartes sont bornées au moment ; ✎ ouvre l'année entière.
- **Identité** : *Nom* en première ligne (`edNom`, champs `fi-nom` / `fi-prn`, `ficheSaveNom` ; le titre de la fiche ne s'édite pas), classe (**le NOM et l'année de LA classe**, `ficheSaveClasse` — on est PP d'une seule classe ; le déplacement d'élève reste dans la modale ✏️ via `moveStudentToClass`), naissance (+ âge) / arrivée / départ (champs date en place, écrits **une fois le champ quitté** : `ficheSetDate`, mêmes gardes-fous que la modale), civilité (clic cycle), valeurs cliquables `.fi-val` (groupe, options, aménagements : pastilles à bascule sous la ligne ; `ficheToggleStatus`, `ficheCycleUlis`, `ficheCycleUpe2a`), régime (✎ → la fenêtre de l'élève), **place** dans chaque salle (un sélecteur par salle, positions occupées désactivées → `seatSet`), délégué, éco-délégué, **élections**. Restent dérivés, donc non modifiables : délégué et élections.
- **Observations** : ✎ *Relevés du carnet* : chaque cumul de l'année corrigeable (`releveSetCount`, mêmes règles que la grille, refus = valeur rétablie).
- **Bilans** : ✎ tous les bilans, ✏️ 🗑. **Incidents** : 📎 du PDF sur l'entrée, ✎ toute l'année, ✏️ 🗑 (la saisie ouvre `mincident` par-dessus la fiche, qui s'y redessine : `_ficheRedessine`). **Contacts** : *+* et ✎ ouvrent la fenêtre des contacts par-dessus la fiche (`ficheVersContacts`) ; texte et suppression via `journalSetTexte` / `journalRemove`. Remarque : pastille `+` (`✎` quand elle existe), éditeur en place (textarea).
- **Papiers** : l'état est un bouton (`☐ non rendu` / `✓ rendu le …`) — `ficheToggleRendu` passe par `_docMut` + `docSetRendu` (date du jour, onglet Documents rafraîchi), réservé aux documents suivis ET attendus (« rien à rendre » et « non concerné » restent du texte). Les **choix portés** sont lus sous chaque papier (« Participation : ULYSS ») ; ✎ : réponses, date de retour, note, documents archivés compris (`docSetReponse` / `docToggleReponse` / `docSetDateRetour` / `docSetNote` via `_docMut`). La section Documents est repliable ; ⚠️ les choix portés restent visibles repliés (c'est souvent la seule chose qu'on y cherche). Le pli se souvient d'une fiche à l'autre.
- ⚠️ Responsive de l'éditeur de place : `dd` de grille sans `min-width: 0` + éditeur flex **en colonne avec `flex-wrap: wrap`** (en colonne, une ligne qui replie se dimensionne sur ses items) débordait de 120 px à 320 px → `nowrap` sur l'éditeur en colonne.

#### Fenêtre ✏️ « Modifier l'élève » (sert aussi à l'ajout)

S'ouvre **par-dessus la fiche** (`ficheVersEdition` ne ferme plus `mfiche` ; empilement d'`openMod` ; la fiche se redessine à la fermeture). Cinq blocs en deux colonnes (une sous 700 px) : *Identité* (nom, prénom, civilité, naissance), *Scolarité* (classe, groupe, options), *Restauration et sorties* (demi-pension, jours — seulement pour un DP —, entrée, sortie), *Présence* (arrivée, départ), *Aménagements* sur toute la largeur en puces rangées par exclusivité ; le titre est le nom de l'élève. Civilité, groupe, demi-pension en **boutons** (`_esSeg`, `esSegUI`) qui écrivent un champ caché : ids `es-civ`, `es-grp`, `es-regime`… et `saveEdit` inchangés. Une option cochée prend sa couleur tout de suite (`_esTagCouleur`) ; ⚠️ la puce d'option garde son encre dérivée (la règle « puce cochée » des aménagements l'écrasait). **Ajout** : `openAddStudent` → `openEdit(null)` (élève vierge de la classe courante, `es-id` vide, titre *+ Nouvel élève*, bouton *✓ Ajouter*) ; `saveEdit` crée l'élève dans la classe choisie puis le remplit comme une modification (un cran d'undo). L'ancienne fenêtre `ms` est supprimée. Les deux boutons de pied (édition complète, remarque et contacts) **reviennent** à la fiche (`_modalReturnTo`).

### 2. 📓 Observations (Carnets)

Grille **élèves × relevés** : une colonne par date, saisie du cumul au clavier (`Tab`/`Entrée` comme le tableur d'éval), colonne **Δ depuis le relevé précédent**, colonne **total de la période**, en-tête `+ Nouveau relevé`, colonne *MBN* par période et *Carnet + MBN* (cf. *Observations notées dans MBN*). Tri par Δ décroissant = les élèves à voir en priorité. Tri par en-têtes ; menu **« Ordre de passage »** (place, ordres de ramassage, salle) pour relever en marchant dans les rangs.

**Touches de saisie** sous la cellule active : les six valeurs probables (inchangé, +1 … +5), plus « absent » et « vide ». Toucher une touche écrit et passe à l'élève suivant — saisie au doigt plus rapide qu'au clavier.
- ⚠️ La **première** proposition est la valeur INCHANGÉE : « rien de neuf dans ce carnet » est le cas le plus fréquent.
- ⚠️ `_carnetSuggestions` ne regarde JAMAIS la valeur déjà dans la cellule : on peut corriger une faute de frappe, et proposer des incréments à partir d'elle la propagerait.
- ⚠️ Le bandeau **suit** la cellule au défilement, il ne se referme pas (le cacher sur tout `scroll` le faisait disparaître à l'instant où le focus faisait défiler la cellule dans la vue).
- ⚠️ Huit touches à 42 px font 376 px, plus qu'un écran de téléphone : elles passent à la ligne (`flex-wrap` + `max-width: calc(100vw - 10px)`).
- ⚠️ **Entrée passe à l'élève suivant — même quand la valeur a changé.** `relCellKey` capturait l'élément suivant PUIS appelait `blur()`, qui déclenche le `onchange`, qui re-rend toute la grille : l'élément capturé était détaché, `focus()` ne faisait rien. La cellule suivante se retrouve **par ses données** (`data-ymd` + `data-sid`) dans la grille telle qu'elle est après le re-rendu. Règle : après tout `blur()` ou mutation qui peut re-rendre, ne jamais réutiliser une référence d'élément prise avant.
- ⚠️ **Au doigt, les touches SONT le clavier — le clavier virtuel ne doit pas surgir.** Les cellules portent `inputmode="none"` quand `_relKbdOff` est vrai (d'office si le pointeur principal est le doigt, `matchMedia('(pointer: coarse)')`, jamais à la souris) : le focus reste (donc le bandeau) sans appeler le clavier. Une neuvième touche **⌨** bascule le réglage pour taper une valeur que les touches ne proposent pas ; ⚠️ changer `inputmode` sur un champ déjà focalisé ne fait rien, il faut `blur()` puis `focus()`. Sans effet sur un clavier physique. ⚠️ **Non vérifié sur une vraie tablette** (le navigateur de test n'a pas de clavier virtuel).

### 2 bis. 📈 Moyennes

Tableau élèves × matières d'un import, statistiques en pied, évolution depuis l'import précédent de la même période dans chaque case ; vue **📈 Évolution** (une ligne par import, une statistique au choix) ; vue « ▦ Tableau » ; import par fichier ou copier-coller avec aperçu ; impression paysage. Détail et pièges : *Moyennes par matière*.

### 3. 📄 Documents (Retours)

Liste des documents (compteurs `rendus / attendus` et `réponses manquantes`), puis un tableau par document : élèves × (`Rendu` · `Date` · un groupe de colonnes par champ). Boutons nommés : Retours · Réglages · Dupliquer · Archiver · Supprimer. Bouton « liste des manquants » (modale 📋 : à copier ou imprimer pour la vie scolaire).
- ⚠️ **Un document ne se « ramasse » pas toujours** : très souvent on VÉRIFIE qu'une signature est là, carnet par carnet, en passant dans les rangs. Le tableau d'un document porte donc le menu **Ordre de passage** (place, ordre de ramassage compris).

#### 🧺 Ramassage

Troisième vue de l'onglet : une grille **élèves × documents** où l'on coche les retours de plusieurs documents en une passe (le geste réel : trois papiers à récupérer en même temps). Colonnes choisies à la volée, date du ramassage réglable (on saisit souvent le soir), compteurs vivants par colonne et par élève, « tout cocher » par colonne, flèches pour descendre une colonne.
- ⚠️ **Une case a TROIS états** : rendu, pas rendu, **sans objet** (l'élève arrivé en novembre n'a jamais eu la fiche de rentrée). Un tiret, pas une case vide : confondre les deux, c'est réclamer un papier à quelqu'un qui ne l'a jamais reçu. `ramSetRendu` **refuse** d'écrire pour un élève non attendu.
- ⚠️ **Une ligne par élève DE LA CLASSE**, pas par élève attendu sur le document : `_ramRows` est **bornée au roster de `classId`**. `_docExpected` couvre TOUTES les classes d'un document ; un papier partagé avec une autre division ferait entrer ses élèves dans la grille et « tout cocher » leur attribuerait un retour. Garde unique, à la source (les impressions n'en ajoutent pas de seconde).
- Élèves **partis** masqués par défaut (on ne ramasse rien auprès d'eux) mais comptés dans les manquants du document.
- ⚠️ **Salve d'undo** (`_ramArmUndo`, motif `_relArmUndo`) : cocher vingt-cinq cases est UN geste. « Tout cocher une colonne » est un acte massif → son propre `pushUndo()`, et **rien n'est empilé si la colonne était déjà dans l'état demandé**.
- ⚠️ **Pas de re-rendu à chaque case** (la grille se reconstruirait sous le curseur) : seuls les compteurs sont rafraîchis (`_ramRefreshCounters`).
- ⚠️ **Un bouton de masse n'agit que sur ce qui est AFFICHÉ.** « Tous » itérait aussi les élèves partis masqués, déclarant « recueilli » un papier auprès de quelqu'un d'absent. `ramSetColonne` prend une liste explicite d'élèves, et le toast **dit** combien sont restés hors de vue.
- **Les réponses se relèvent DANS la grille** : pastilles plutôt que menu déroulant (un appui au lieu de deux, debout dans une allée) ; un second appui sur la même option l'efface. Seuls les champs `par: 'famille'` descendent dans les rangs (l'avis du PP se donne au bureau) ; le compteur « à lire » ne prend que les champs **obligatoires** des familles.
  - ⚠️ **Relever un choix VAUT constat de retour** (arbitrage de l'utilisateur) : le retour se coche tout seul, **à la date du ramassage** — sans la changer si le papier était déjà daté. Bornes : **retirer** une réponse ne décoche RIEN, et la règle ne vaut **que dans les rangs** (le tableau du document garde les deux axes séparés : on y note une réponse donnée à l'oral avant que le papier revienne).
  - ⚠️ **Repli par colonne**, et repli d'office des documents à plusieurs champs de famille (deux champs de quatre options = lignes de 130 px, trois mille pixels de défilement pour vingt-cinq élèves).
- La sélection ne vit **que pour la passe en cours** : rien dans `S`, donc rien à purger ni dans `_validateImport`. Filtrée sur la **classe courante** (changer de classe avec le ramassage ouvert laissait des colonnes de l'autre classe).

#### Imprimer un document (ou l'enregistrer en PDF)

Le tableau des retours part sur le papier avec **les colonnes qu'on choisit**. ⚠️ Aucune bibliothèque PDF (app mono-fichier sans dépendance) : le PDF sort de la fenêtre d'impression du navigateur (« Enregistrer au format PDF »), et la modale le DIT.
- ⚠️ Le choix des colonnes n'est pas un confort (la fiche d'orientation fait huit colonnes). `Ctrl+P` sur un document ouvert ouvre **le choix des colonnes**, pas l'impression directe.
- **Portrait par DÉFAUT** (arbitré) ; paysage et « automatique » (`_docPrintOrientation` : paysage dès six colonnes) au menu. Le résumé **prévient** quand le portrait va serrer (« 8 colonnes en portrait : ce sera serré ») sans corriger à la place de l'utilisateur.
- ⚠️ « Élève » ne se décoche pas : elle porte `fixe`, `_docPrintKeys` la **rétablit** même absente de la sélection (une feuille anonyme est un déchet).
- ⚠️ Le retour s'imprime `☐` / `✓`, jamais « oui » / « non » (la feuille sort souvent AVANT le ramassage et se coche au stylo).
- ⚠️ **Un filtre indisponible replie sur « tous »**, jamais sur une page vide (un document sans suivi de retour a une liste de manquants vide par construction) ; `_docPrintFiltres` n'offre que ce que le document permet.
- Colonnes retenues **pour la session**, par document (`_docPrintSel`), rien dans `S` ; une clé morte est écartée à la relecture.
- **Bilan au pied** : `_docPrintBilan(doc, sids, keys)` (pur), rendu par `_docPrintBilanHTML` : « Rendus 19 / 24 », puis par champ **imprimé** le compte de chaque option et les « sans réponse ». ⚠️ Compté sur les **lignes imprimées** (filtre compris), comme `_gridPrintTotals`, et seulement pour les champs dont la colonne est sur la feuille (le rendu se compte dès que le document le suit) ; un choix multiple le **dit** (ses comptes dépassent l'effectif) ; une option retirée du champ ne compte plus (l'élève passe « sans réponse »).

#### Imprimer la grille élèves × documents

Impression de la **vue globale** (accessible de la liste des documents et du 🧺 Ramassage, qui présélectionne ce qu'on a en main) : une colonne par document retenu, une ligne par élève, un pied qui totalise `rendus / attendus`.
- ⚠️ **Les TROIS états sur le papier aussi** : `✓` rendu · `☐` attendu et pas rendu · `—` sans objet.
- ⚠️ **Bâtie sur `_ramRows`, pas réécrite** (elle sait déjà qui est attendu sur quoi ; borne au roster déjà dedans).
- ⚠️ Les élèves partis sont masqués et **le sous-titre le DIT** (un décompte qui rétrécit sans raison fait chercher une panne). Le pied compte sur les **lignes imprimées**.
- **Bilan par document** : `_gridPrintBilan(rows, docIds)` appelle `_docPrintBilan` sur les élèves imprimés **et attendus** de chaque colonne (un « sans objet » sort du dénominateur), champs des **familles seulement**, rendu partagé `_docPrintBilanRows(b, prefix)`.
- Option « porter les réponses des familles sous les coches » (feuille de ramassage = récapitulatif). ⚠️ Les champs `par: 'prof'` n'y descendent pas.

### 4. 🏫 Vie de classe

Onglet renommé (identifiants du code inchangés : `tab-delegues`, `renderDelegues`). En tête les **heures de vie de classe**, puis les élections : candidatures (binômes), **dépouillement projeté en direct** (grille de saisie à gauche, graphique lisible du fond de la salle à droite), résultats calculés, procès-verbal imprimable. Un bloc par élection, historisé (on garde celle de l'an dernier). **C'est l'écran le plus exigeant du projet** : utilisé une fois par an, devant 25 témoins, sans reprise possible. Détail : *Élection des délégués de classe*.

- **Heures de vie de classe** : `cls.vieClasse`, modèle pur et testé (`hvcAdd/Set/Remove` — date valide et thème obligatoires —, `_hvcOf` récent d'abord, `_hvcPeriode` chronologique). Section 🕐 en tête de l'onglet (`_hvcHTML`, pastille `+`, formulaire en place date · thème · texte, ✏️ 🗑, `_hvcEdit` de session). **Une date future suffit pour un thème à venir** (pas de champ d'état : la liste les met en tête avec la pastille « à venir »). La **synthèse de période** peut les porter en tête de feuille (bloc *Heures de vie de classe*, **décoché par défaut**). `postLoadHook` crée la section ; la purge d'une classe l'emporte. Démo : six heures.

### 5. 📊 Synthèse — retirée

Fusionnée dans Élèves (arbitré par l'utilisateur : doublon). Subsistent le calcul pur `_syntheseRow` (nom conservé, testé) et `_syntheseRows`, la pastille des non-rendus (`_synthOpen`, détail au survol ou au clic : la liste des titres en clair élargissait la colonne), les classes CSS `.synth-*`. **Colonne Réponses retirée** (les choix portés se lisent dans la fiche). Supprimés : `renderSynthese`, `_synthSorted`, `syntheseSort`, `_synthFilter`, l'onglet et sa zone ; `printSynthese` → `printEleves` ; `Ctrl+P` sur Élèves imprime. Un onglet mémorisé « synthese » retombe sur Élèves (`init` vérifie que `tab-<id>` existe).

### 6. 💾 Données et réglages

Sauf mention : options, salles, sync auto, dossier des PDF et orphelins, catalogue des instances, versions & backups, jauge de mémoire locale, export/import JSON, RGPD, à propos.

#### Sommaire à gauche, une rubrique à la fois (maquette A choisie par l'utilisateur)

`DON_RUBS` : *Réglages* — 🏫 Classe et élèves (classes → la fenêtre 🏫, options suivies, régimes) · 🗓 Année et périodes (découpage, **débuts de période**, code absent, couleurs du carnet) · 📚 Disciplines et matières · 🪑 Salles et placements · ⚖️ Incidents et instances · 🎨 Apparence (polices, thème) ; *Données* — 📥 Importer · exporter (export, les onze imports, démo, tout effacer ; la barre d'outils d'en haut est retirée) · 🔄 Sauvegarde et synchronisation · 📎 Fichiers joints et photos · 💾 Mémoire et contenu.
- Chaque entrée porte une **pastille** (`_donChip`) qui dit l'état sans ouvrir : orange (`--don-warn-*`) quand une action est attendue (matières à rattacher, aucun dossier de sauvegarde ou de PDF, sync coupée), vert (`--don-ok-*`) pour la sync active ; tokens aux trois endroits.
- **Chercher un réglage** filtre le sommaire par mots (`mots` de chaque rubrique, sans accents), Entrée ouvre la première. Rubrique retenue sur le poste (`suiviPP_donRub`) ; `openDonnees(k)` y mène depuis un autre écran. Sous 700 px, le sommaire passe au-dessus et le choix fait défiler jusqu'au titre.
- **📚 Disciplines et matières** (`_disciplinesTableHTML`) : disciplines **par champ** (un intertitre par domaine, sa couleur) — Actif · Discipline · Option (code) · Professeur(s) · Matières rattachées (moyennes et fiches) ; un clic sur le nom ouvre le **détail** sous la ligne (nom, domaine, onglet de la feuille d'avis, suppression — `donDiscUI`). Puis **À rattacher** (`_donARattacher`) : les matières des moyennes et des fiches de suivi que rien ne range, *Vient de* 📈 / 📋, menu groupé par domaine ; rangées sur demande (« Voir aussi les n matières déjà rattachées », `donMatToutUI`). Le bouton « Ouvrir les avis des collègues » est retiré (l'onglet existe) ; le message « matières sans discipline » de l'onglet Avis y mène.
- **Débuts de période** (`periodeDebutUI`) : `prefs.periodStarts` — un champ date par période 2 et 3 (MM-JJ stocké, l'année affichée est celle de la classe), refus d'août et du désordre, « valeur d'office » dite, ↺ pour y revenir ; remplacé jamais modifié en place, un cran d'undo.

#### Options

Même tableau que la modale 🏷 de l'onglet Élèves (`_tagsTableHTML`, `_tagsFormHTML(prefix)` — deux formulaires, deux préfixes d'ids, sinon la modale et l'onglet se disputeraient `mtags-abbr`). ⚠️ Le bandeau DIT ce qu'un import fait : depuis Plan de classe, **les options de chaque élève sont réécrites** (le catalogue n'est que complété) ; une option cochée à la main est à cocher aussi là-bas.

#### Salles et placements

`_sallesEditorHTML` : sélecteur de salle, nom, rangs × colonnes, grille de la classe courante en deux modes — **Placer** et **Ordre de ramassage** (clic sur les tables dans l'ordre où l'on passe, recliquer retire ; ordres nommés, ↺ pour refaire). Modèle pur et testé : `salleAdd/Set/Remove`, `seatSet`, `patternAdd/SetNom/Toggle/Clear/Remove`. État de l'éditeur (`_salleEd` : salle, mode, case sélectionnée, ordre) de session, rien dans `S`.
- ⚠️ **Rétrécir refuse** tant qu'une place ou une table d'un ordre serait dehors.
- ⚠️ **Supprimer une salle** emporte son placement dans CHAQUE classe et rebascule `salleCur` (sinon le tri « par place » pointerait dans le vide).
- ⚠️ **Tout cela est PRÉCISÉMENT ce qu'un import depuis Plan de classe réécrit** (salle homonyme, placement, ordres) : le bandeau en tête de section le dit quand les salles en viennent (`_pdcOrigine` : `cls.pdcImportAt` ou une salle `pdc_*`), avec la date du dernier import.
- **Glisser-déposer** : la liste des élèves **sans place** est à droite de la grille ; tirer une pastille sur une case place, un élève de la grille sur un autre **échange** (`seatSwap` — vers une case vide, un déplacement), sur la liste **libère** sa place. Même école que la poignée des documents : événements pointeur + capture, `touch-action: none` **seulement sur ce qui se tire** (les cases vides restent pannables au doigt), rien ne bouge dans le DOM pendant le geste (fantôme + cible dessinée), cible **recalculée au relâchement** par `elementFromPoint`, `Échap` annule, un relâchement sans mouvement (< 5 px) ne fait rien. Le sélecteur au clic sur une case a été **retiré** (arbitré : une seule façon de faire une chose).
- **Ordre au glisser** : en mode ordre, le clic table par table reste, et **glisser d'une table à la suivante les enchaîne** (`ordrePaintStart/Move/End`) — chaque table survolée pour la première fois s'ajoute en fin d'ordre, celles déjà dans l'ordre sont sautées, un seul cran d'undo pour la traînée. ⚠️ **Pas de re-rendu pendant le geste** (la case qui détient la capture serait remplacée, leçon de `docReorder`) : le numéro est posé à la main, la grille redessinée au relâchement. `touch-action: none` sur les cases cliquables en mode ordre.
- ⚠️ **VUE DU BUREAU** (« c'est le prof qui regarde ») : le bureau est dessiné en bas, le rang 1 juste au-dessus, la place 1 à droite — grille tournée de 180° par rapport au plan « vu du fond ». Les données ne bougent pas (`r,c` reste ce que Plan de classe exporte) ; seules les boucles de rendu descendent. Test de source : une boucle qui « a l'air à l'envers » se corrige trop facilement.

### Impression (`@media print`)

Orientation imposée avant `window.print()` : liste des élèves et synthèse de période en paysage (ou fiches portrait), liste des manquants d'un document en portrait, PV d'élection en portrait. ⚠️ Reprendre le bloc `@media print { html[data-theme="dark"] { … } }` : sans lui, imprimer en thème sombre pose de l'ambre sur blanc.

## Trier les élèves : nom, prénom, place, ordre de ramassage

- **Toutes les grilles trient par leurs EN-TÊTES** (Nom · Prénom et colonnes chiffrées ; re-cliquer inverse) : pas de menu « Trier » (`_sortPickerHTML` est l'ancien sélecteur). Aides : `_TRIS` (un état par grille : `carnet`, `doc`, `ram`, `moy`), `triTete`, `_triTeteHTML`, `_triNomHTML`, `_triDir`, `_triInverse` (un ordre de passage ne s'inverse jamais).
- **Là où l'on marche dans les rangs — Observations (relever les carnets), Retours (vérifier les signatures, ramasser) —** un menu **« Ordre de passage »** (`_ordrePassageHTML`, `ordrePassageSet`) garde la place dans la salle, les ordres de ramassage et le choix de la salle (arbitré par l'utilisateur : conserver un tri par motif ou par position). Rien sans placement. **Pas dans Moyennes** (un mode de place resté y retombe sur le nom).
- Le moteur reste `_sortStudents` / `_sortModes`, commun aux grilles ; chaque écran y ajoute ses modes propres (Δ, cumul, non rendus…), les modes de place et de ramassage venant du placement importé.
- **« Par place » se CALCULE** de la géométrie : rang par rang, de gauche à droite. ⚠️ Comparaison **numérique** sur le rang puis la colonne (en lexical, `'10,0'` passerait avant `'9,0'`).
- **« Ramassage » ne se calcule PAS** : séquence de tables dessinée à la main dans Plan de classe, propre à chaque salle, plusieurs possibles (serpentin, deux allées, paillasses). C'est un choix pédagogique, pas une géométrie.
- ⚠️ **Un tri ne perd JAMAIS un élève.** Ceux que la salle ou le pattern ne couvrent pas sont rejetés en fin de liste, alphabétiquement, jamais retirés (un élève absent de la grille de ramassage est un papier qu'on ne réclamera pas). Invariant central, testé sur tous les modes.
- Tout repli est alphabétique et silencieux (salle inconnue, sans placement, pattern ou mode inconnu) : un tri n'est jamais une impasse.
- Les modes de place n'apparaissent au menu **que si la salle courante porte de quoi les calculer**.
- ⚠️ **Un mode de tri devient CADUC quand la salle change** (le pattern de la 102 n'existe pas au labo) : le sélecteur affiche alors « par nom », ce que le tri fait réellement (sinon l'écran ment). Le mode reste mémorisé : revenir dans la salle le fait reprendre. ⚠️ Le test porte sur le **HTML produit**, pas sur le helper : `_sortModeOk` avait été écrit puis jamais branché.
- ⚠️ **Le sélecteur de salle n'est pas un ornement** : un élève n'a pas la même place d'une pièce à l'autre. `cls.salleCur` est la salle où l'on est entré, et c'est elle qui décide.
- ⚠️ **`_purgeStudentRefs` doit vider les places** : un élève supprimé resté assis réapparaît en tête de la grille triée par place, sous forme d'un id que plus rien ne nomme. Le test balayant le voit.

## Grilles : première ligne et première colonne figées

Les quatre grilles à élèves en lignes (Élèves, Observations, tableau d'un document, Ramassage) défilent dans leur **propre cadre** (`.rel-wrap.frozen`), borné à la hauteur sous le bandeau : en-tête en haut, colonne des noms à gauche, comme dans le tableur remplacé.

- ⚠️ **`table.dt` portait `overflow: hidden`** (pour rogner ses coins) : tout `overflow` autre que `visible` fait un conteneur de défilement, donc le `sticky` des cellules collait au TABLEAU (qui ne défile jamais) et non au cadre ; la colonne de noms « collante » ne collait pas (invisible quand la grille tient sans défiler). → `.rel-wrap table.dt { overflow: visible }` ; coins non rognés, prix d'une colonne qui colle. Un `sticky` se vérifie en faisant défiler.
- ⚠️ **Un `sticky; top: 0` ne suffit pas** : `overflow-x: auto` fait de `.rel-wrap` un conteneur de défilement dans les DEUX axes ; il faut **borner la hauteur** (`max-height` calculé sur `--topbar-h`) pour que la ligne figée soit réelle.
- ⚠️ **Un cadre neuf repart en haut à gauche** : chaque saisie re-rend la grille et remplace le cadre. `_wrapScrollKeep(el)` mémorise la position avant `innerHTML` et la repose après, **si le cadre neuf porte le même tableau** (Documents en rend trois dans le même conteneur). Test statique : tout `rel-wrap frozen` est encadré par `_wrapScrollKeep` / `keep()`, avec méta-test.
- `--topbar-h` est **mesurée** (`_topbarMeasure`, `ResizeObserver` sur `#topbar`) : le bandeau varie (≈ 101 px à 1200 de large, 184 à 700, 303 à 320). Déclarée dans `:root` en repli, sans variante sombre ni impression (pas une couleur).
- `scroll-margin` sur les champs : une cellule amenée au focus (Entrée, flèches) ne doit pas atterrir SOUS la ligne ou la colonne figée.
- Sur le papier, le cadre ne borne rien (`max-height: none` dans `@media print`).

## Import des élèves — deux voies

### 1. CSV / tableur (voie principale)

Module repris intégralement. À adapter :
- **Retirer** de `_IMP_FIELDS` ce qui n'a pas de sens ici (rien d'urgent : tous les champs importés existent dans `stu`).
- **Retirer** le volet « salle des nouvelles classes » (`_impRoomChoiceHTML`, `_impDefaultRoomChoice`, `_impSetRoom`) : pas de salle à l'import.
- **Garder** le panneau « Codes de groupes rencontrés » : il transforme `4B-LATIN` en tag `LATIN`.
- **Garder** le décodage **UTF-8 strict puis repli Windows-1252** (`_impFileSelected`) : les exports Pronote/SIECLE sont en 1252, « Léa » devient « LÃ©a » sans ce repli.
- **Garder** la création des classes inconnues (`_impClassIdFromLabel` : « 5ème C » → `5C`, libellé complet conservé comme nom).

### 2. Export JSON de Plan de classe

`importFromPlanDeClasse(json)` lit un `plan-classe-*.json`, ne prend que `classes` (id, nom, année, roster) et `eleves` (identité, civilité, groupe, tags, aménagements, dates d'arrivée/départ) et **ignore tout le reste** (salles, sièges, tablettes, évaluations, appels…).

- ⚠️ **Lecture seule et à sens unique** : aucune écriture vers Plan de classe, aucun couplage de format (les deux apps évoluent séparément). Passer par une **liste blanche explicite** des champs, pas par une copie d'objet.
- ⚠️ **Les ids d'élèves sont conservés** : c'est ce qui permet de réimporter sans doublons et de reconnaître un élève présent. La détection de doublon garde le filet nom+prénom+classe (sans accents ni casse) du module CSV.
- Les tags de Plan de classe (`S.tags`, `{id, abbr, name, color}`) se reprennent avec `stu.tags`, sinon ils arrivent sans libellé.
- **Salles, places et patterns** : liste blanche `{nom, rows, cols, collectPatterns}` — ni cases vides, ni îlots, ni emplois du temps, ni tablettes (un champ repris « au cas où » est un champ dont plus personne ne sait s'il est à jour).
  - ⚠️ **Ids de salle PRÉFIXÉS `pdc_`** : Plan de classe les nomme `s1`, `s2` (compteurs locaux, sans unicité entre fichiers) ; sans préfixe, la « Salle 102 » d'un collègue écraserait la nôtre.
  - ⚠️ Le placement vit dans `cls.rooms[salleId].seating`. `cls.seating`, là-bas, est un **accesseur non énumérable** redirigé vers la salle active : absent du JSON.
  - Une place occupée par un élève non repris est **écartée** (sinon `_auditState` signale un élève fantôme assis).
  - Réimporter **met à jour** : salle homonyme et placement sont remplacés, pas empilés. C'est LE chemin de mise à jour des places (💾 Données et réglages → 🪑 Depuis Plan de classe) ; l'éditeur de salles permet aussi de corriger sur place, et l'import écrase alors la correction — l'écran le dit.
  - ⚠️ **Une case VIDE dans Plan de classe ne vide PAS celle d'ici** (défaut v1.41.1 : la liste blanche écrivait `null` quand la source n'avait pas la valeur, effaçant des naissances saisies à la main). Pour `naissance`, `arrivalDate`, `departureDate` et `civilite` : valeur de la source si elle existe, sinon celle d'ici est gardée et comptée (`stats.gardes`, dit au compte rendu). Groupe, options et aménagements restent RÉÉCRITS (documenté, l'écran le dit).
  - **Un point nommé** (`avant-import-plan-de-classe`) est écrit avant chaque import quand un dossier de sync est choisi ; s'il échoue, rien n'est importé.
  - **Réparer** : 💾 Données → *🩹 Récupérer des dates…* relit une ancienne sauvegarde (export, `suivi-pp-bk-*`, point nommé) et ne remplit QUE les champs vides aujourd'hui (`_recupChamps`, pur : élève par id, sinon classe + nom + prénom sans accents), après confirmation listant ce qui sera rempli ; un cran d'undo.
  - ⚠️ L'écran de choix **annonce le placement AVANT l'import** (« 🪑 25 places · 1 ordre de ramassage » ou « aucun placement ») et le compte rendu le confirme ; sans ce repère, un export sans placement donne un import qui ne change rien et on cherche pourquoi.

## Sauvegarde, sync, stockage

Reprendre l'architecture de Plan de classe **sans la simplifier** — chaque pièce répond à un incident vécu :

- `localStorage` pour les données (`suiviPP_v1`), écrit à chaque `save()`, **synchrone** (un `beforeunload` doit persister les dernières frappes).
- **Sync auto** vers un dossier Nextcloud académique (`nuage03.apps.education.fr`) via File System Access API, debounce 5 s, handle persisté en IndexedDB.
- **Horloge vectorielle** (`S.clock`) classe la version disque : `equal` / `ahead` / `behind` / `diverged`. ⚠️ **Jamais de comparaison de `lastModified`** : Nextcloud retouche le mtime sans changer le contenu (flot de faux conflits).
- **Résolution de conflit non destructive** : les deux issues archivent l'autre version dans un fichier avant d'écrire. ⚠️ **Si l'archivage échoue, la résolution est annulée** : jamais d'écrasement sans copie.
- **Backups horodatés** à rotation par paliers (10 min < 1 h, 1 h < 48 h, 1 j < 14 j, 1 sem < 120 j) + dédup par empreinte de contenu ; **checkpoints nommés** avant une opération risquée.
- **Copie du dernier fichier chargé dans IndexedDB, pas dans `localStorage`** : elle y doublait l'occupation (1,07 Mo + 1,07 Mo mesurés, plafond du navigateur atteint en fin d'année).
- **Jauge d'occupation** (modale ⓘ) : capacité **mesurée** par sonde dichotomique, pas supposée. ⚠️ `navigator.storage.estimate().usage` **ne compte pas `localStorage`** (affichait « 2 Ko » pour un mégaoctet réel).
- ⚠️ **Compression écartée sciemment** : `CompressionStream` est asynchrone alors que `beforeunload` appelle `save()` de façon synchrone, et un octet altéré détruit un gzip entier là où un JSON en clair reste réparable à la main.

**Volume très faible** (25 élèves, une dizaine de relevés et de documents : quelques dizaines de ko). Le dispositif complet reste justifié : c'est le filet de sécurité, des retours de fiches d'orientation perdus ne se reconstituent pas.

## Design system

**Polices : Andika à l'écran, Latin Modern Roman au papier — chacune au choix** (arbitré par l'utilisateur : Latin Modern au papier par défaut, Andika à l'écran avec Latin Modern possible dans les réglages, même choix pour l'impression).
- Deux familles embarquées en base64, quatre variantes chacune, sous-ensemble latin (Andika 72 Ko, Latin Modern 84 Ko), **régénérées par `scripts/gen_fonts.py`** (entre les marqueurs `/* ANDIKA-DEBUT */…` et `/* LM-DEBUT */…`). Licences : Andika SIL OFL 1.1, Latin Modern GUST Font License.
- Tokens : `--font-andika`, `--font-lm`, `--font-ui` (écran, Andika), `--font-print` (papier, Latin Modern). `--font-sans` et `--font-serif` — les noms que tout le CSS emploie — **suivent `--font-ui`**, titres compris. Le choix est posé sur `<html>` par `_applyPolices()` (`data-police="lm"`, `data-police-papier="andika"`) depuis `S.prefs.policeEcran` / `policePapier` ; appelée en fin de `postLoadHook` (donc après chargement, undo, sync) et par `setPref`. Valeur inconnue → défaut.
- ⚠️ **Fraunces et IBM Plex Sans RETIRÉES** (inutilisées, 430 Ko). **JetBrains Mono reste** pour les chiffres des grilles (chasse fixe).
- `.print-area *` et le PV prennent `--font-print` en `!important` (les cellules portent des styles en ligne à l'écran).
- ⚠️ Les polices doivent être **chargées avant toute mesure** (`_printFontLoad`, qui charge les DEUX familles : au démarrage, à l'ouverture des modales d'impression, avant `window.print`) : une police `swap` ne se charge qu'au premier usage et une mesure avec la police de repli choisirait une taille fausse. Changer la police du papier change la taille calculée des feuilles « une page ».
- Andika étant plus large qu'IBM Plex, c'est le débordement qu'il faut surveiller aux audits.

**Tous les tableaux imprimés ont le même visuel** : `.print-t` (retours d'un document, grille élèves × documents, bilans en pied, ancienne feuille) reprend celui de `.pp-t` — en-tête grisé souligné de noir et **répété à chaque page**, filets horizontaux, une rangée sur deux grisée (`print-color-adjust: exact`, sinon le navigateur retire les fonds), aucune rangée coupée. Le **PV** garde son quadrillage complet (pièce signée) avec en-tête gris et rangées alternées. Test statique `test/polices.test.js`, avec méta-test.

Reprendre le design « carnet du prof » **à l'identique** : tokens, polices embarquées, filet rouge de marge, lignes Seyès, thème sombre, bloc de neutralisation à l'impression.

⚠️ **Les quatre règles les plus coûteuses du projet de référence :**

1. **Tout token de couleur se déclare à TROIS endroits** : `:root`, `html[data-theme="dark"]`, et `@media print { html[data-theme="dark"] { … } }`. Oublié au troisième, il s'imprime en couleurs de nuit sur papier blanc.
2. **Un fond clair posé pour le mode clair a besoin d'une variante sombre**, pas seulement d'une encre adaptée (un pastel fait un trou de lumière dans le bleu nuit).
3. **Un accent utilisé en FOND et en TEXTE a besoin de deux valeurs** (`--x-bg` et `--x-fg`) : l'arbitrage s'inverse avec le thème.
4. **Jamais `color:#fff` en dur sur un fond coloré**, surtout pas sur une couleur choisie par l'utilisateur (couleurs d'options de documents). Toujours `_contrastTextColor(bg)`, qui tranche par contraste WCAG réel via `_wcagContrast`.

**Méthode d'audit du contraste** (à rejouer après toute retouche de couleur) : injecter un auditeur qui parcourt le DOM, calcule le fond effectif en remontant les parents transparents et l'opacité cumulée, puis le contraste de chaque nœud portant du texte propre. Seuil 4,5:1 (3,0 pour le grand texte). Quatre conditions sans lesquelles la mesure ne vaut rien :
- **des données partout** (un onglet vide passe pour propre) ;
- **les sous-états** autant que les onglets ;
- **les modales**, statiques (forcer la classe `on`) comme dynamiques (par leur vrai ouvreur) ;
- **transitions neutralisées** (`*{transition:none!important;animation:none!important}`) : une puce saisie à mi-parcours produit de faux écarts.

## Conventions de développement

- **L'app VOUVOIE l'utilisateur** (« Choisissez », « votre bilan », « Cochez » ; les tournures en « on » restent). Le code repris de Plan de classe tutoyait : tout texte affiché nouveau ou repris se met au vouvoiement.
- **Tout dans un seul fichier HTML** : CSS dans le `<style>` de tête, JS dans le `<script>` de fin de body. **Aucune dépendance externe**, aucun CDN : hors-ligne, en `file://` comme en HTTPS.
- **`pushUndo()` AVANT toute mutation**, jamais après (l'undo capturerait le mauvais état). Pour une **saisie continue** (cumul de relevé tapé, cases de ramassage cochées), le motif `_evalArmUndo()` de la référence : un snapshot par salve, verrou libéré 2 s après la dernière mutation, sinon la pile d'undo sature.
  - ⚠️ **Tout verrou de salve se désarme dans `_applyReloadedData`.** Un verrou encore armé après un rechargement de sync fait SAUTER le `pushUndo()` de la mutation suivante (état fraîchement rechargé jamais capturé, Ctrl+Z ne remonte plus). `_relUndoArmed` y était, `_ramUndoArmed` (ajouté plus tard) avait été oublié : ce n'est pas une précaution décorative. Tous les verrous sont dans `_salvesDesarmer`, appelée aussi par Ctrl+Z / Ctrl+Y (une saisie juste après un Ctrl+Z n'avait pas de cran).
  - ⚠️ **Armer la salve seulement une fois la mutation certaine** : armer puis renoncer pose un snapshot sans mutation, et le premier Ctrl+Z ne fait rien de visible.
  - ⚠️ **Un refus après `pushUndo()` se défait par `_undoAnnulerRefus()`, jamais par `undoLast()`** : `undoLast` affichait « Annulation effectuée », activait Ctrl+Y pour une action qui n'a pas eu lieu et, pile pleine, perdait le plus ancien niveau. Les enveloppes qui poussent avant leur mutation (`_withStudent`, `_docMut`, `_elMut`) passent le retour à `_undoSiRien` : refusé (`false`) ou sans effet, le cran est retiré.
  - ⚠️ **Le contenu d'un fichier chargé est normalisé** (`_sanitizeImbrique`, juste après `_sanitizeCoreSections`) : un nombre attendu qui n'en est pas un s'injectait tel quel dans le HTML et dans des gestionnaires (groupe, numéro de bulletin, rangs d'une salle). Tout nouveau champ numérique affiché s'y normalise ; nombre écrit en texte converti, illisible retiré. Garde-fou : ne RIEN changer à des données saines (diff vide sur la démo).
- **Zéro dialogue natif** : ni `alert`, ni `confirm`, ni `prompt` (l'anti-popup les bloque en silence, le bouton paraît cassé). Utiliser `_uiConfirm`, `_uiPrompt`, `appAlert`, ou `toast(msg, 'warn')` pour une précondition non bloquante. ⚠️ `_uiConfirm` **n'est pas bloquant au sens JS** : tout ce qui suivait le `confirm()` va dans `onOk` / `onCancel`.
- **Échappement au rendu**, systématique : `_escName` / `_escAttr` pour toute donnée utilisateur en `innerHTML` ; `_escJsAttr` pour un texte passé à un handler inline (le navigateur HTML-décode l'attribut **avant** de parser le JS, `_escAttr` seul laisse un breakout) ; `_csvCellGuard` avant tout quoting de cellule exportée (une cellule commençant par `=` `+` `-` `@` est une formule à l'import tableur). Template balisé `_html` pour le code neuf.
- **CSP en `<meta>`** dès le premier commit : `connect-src 'self' https://api.github.com`, `img-src 'self' data: blob:`, et ⚠️ **`font-src 'self' data:`** (sans lui, `default-src 'self'` bloque les polices base64 et l'app retombe en silence sur les polices système) ; **`frame-src blob:`** (et non `'none'`) : le lecteur de PDF intégré encadre un blob créé par la page, lié à son origine, rien d'extérieur ne peut être encadré.
- **États vides actionnables** : un état vide dit QUOI faire (`_emptyStateHTML(icon, titre, hint)`).
- **Retour de modale** : `_modalReturnTo[id]` pour qu'un panneau ouvert en parenthèse (réglages d'un document depuis son tableau) revienne d'où il vient, sur les trois voies de fermeture (bouton, fond, Échap).
- **Auto-focus et Entrée** : chaque modale à formulaire porte `data-autofocus` sur son premier champ utile et valide à `Entrée`. Sans `data-autofocus`, `openMod` focalise la boîte `.mb` elle-même, sinon le focus reste **derrière** la modale et le piège à focus ne s'enclenche jamais.
- **Pas de conception 100 % clavier**, mais les **raccourcis existants ne se cassent pas** : `Échap`, `Ctrl+Z` / `Ctrl+Y`, `Ctrl+P`, validation à `Entrée`. ⚠️ Le garde de `Ctrl+Z` teste la **saisie de texte** (`_isTextEntryTarget`), pas `tag === 'INPUT'` : une case à cocher garde le focus sans undo natif, le raccourci y devenait muet.
- Développement long : travailler sur une copie `suivi pp new.html`, puis remplacer une fois validé.

### ⚠️ Champs `<input type="date">` — l'année telle que tapée

Un champ date livre l'année **exactement comme saisie** : « 21 / 05 / 13 » donne `0013-05-21`, pas `2013-05-21`. La date est rejetée comme illisible juste après une saisie correcte du jour et du mois (25 fois sur une saisie en série de naissances).

- ⚠️ **La correction est aussi dans le MOMENT.** Un champ date est « complet » dès le premier chiffre d'année tapé et `change` part avec l'an 0001 ; normaliser et réécrire le champ à cet instant **remet le segment année à zéro** (taper « 1 » puis « 3 » donnait 2001 puis 2003, pas 2013). On attend donc que le champ soit **quitté** (`blur`, ou `change` reçu alors qu'il n'a plus le focus) pour normaliser, enregistrer et réafficher. Un test de `_ymdCompleteAnnee` seul ne garantit rien : celui qui compte pilote `document.activeElement`.
- ⚠️ **On n'ouvre JAMAIS le sélecteur natif (`showPicker`) en arrivant sur le champ suivant** : au tactile il ne sert à rien (toucher un champ date l'ouvre déjà) et il affichait le calendrier par-dessus le clavier, exigeant une frappe d'Entrée de plus (25 frappes perdues par classe). Un test de source l'interdit.
- `_ymdCompleteAnnee(v)` complète les années à **deux** chiffres : `20xx`, ou `19xx` si `20xx` tombait dans le futur. ⚠️ **Trois chiffres ne se devinent pas** (« 202 » = 2020 trop vite, 1202 ou 0202) : deviner écrirait une date fausse sans signal. Appelé sur toute date saisie à la main (naissance dans la liste et la fiche, date de relevé, date de contact) ; **tout nouveau champ date s'y branche**.

### Invariants de fiabilité

- **Suppression d'un élève = `_purgeStudentRefs(sid)`, source unique de vérité** : roster de sa classe, `releve.counts[sid]` de tous les relevés, `doc.retours[sid]` de tous les documents, et `notes[sid]` / `generale[sid]` de **chaque import de moyennes** (les statistiques des imports passés changent, voulu : on SUPPRIME un élève qui n'aurait jamais dû être là ; un élève PARTI n'est pas supprimé et garde ses moyennes). Les incidents (`stu.incidents`) partent avec l'élève ; leurs PDF restent dans le dossier des pièces jointes (l'app n'efface jamais un fichier d'elle-même ; 🧹 Orphelins… dans Données les liste).
  - ⚠️ **Les élections sont une EXCEPTION assumée** (comme les appels de Plan de classe) : un PV signé est un document historique. `election.candidats[].sidTitulaire` et `assesseurs` survivent donc — à déclarer dans les exceptions du test de balayage avec cette justification. Corollaire : l'élection porte l'**identité minimale** (nom, prénom) de ses candidats et assesseurs, sinon le PV devient illisible après suppression (même raisonnement que `attRecord.eleves` là-bas).
  - ⚠️ **Tout nouveau champ indexé par sid se purge LÀ**, ou s'ajoute aux exceptions du test de balayage avec sa justification écrite.
- **Suppression d'une classe = `_purgeClassRefs(classId)`** : `S.releves[classId]`, `S.elections[classId]`, `S.moyennes[classId]`, retrait de `doc.classIds` (et suppression du document s'il ne concerne plus aucune classe vivante), suppression de ses élèves.
- **`_validateImport`** : liste blanche des sections de `S`, rejet explicite de `__proto__` / `constructor` / `prototype` par scan récursif des clés. ⚠️ Ajouter une section à `S` impose de l'ajouter à cette liste.
- **`_sanitizeCoreSections()` en tête de `postLoadHook`** : section absente ou du mauvais type recréée, entrée non-objet supprimée avec `console.warn`. ⚠️ Une exception dans `postLoadHook` interrompt le chargement et laisse un état à moitié migré, **sans message** : toute migration suppose que sa section peut manquer.
- **Gestionnaire d'erreurs global** (`window.onerror` + `unhandledrejection`) → toast discret + journal `window.__suiviPPErrors` (rend visibles les pannes que les `catch {}` avalent).

### Tests (`test/`, `npm test`)

Reprendre `test/harness.js` : il extrait le gros `<script>` inline, le charge dans un contexte `vm` avec un DOM stubé, neutralise `init()` et expose `__TESTEVAL(code)` pour exécuter du code dans la portée lexicale du script. **Aucune dépendance**, Node ≥ 18.

Familles à couvrir dès le début :
- **Calcul des deltas et des totaux de période** (cœur métier) : cumuls, `'A'` intercalé, vides, cumul décroissant, premier relevé, changement de période.
- **Dépouillement et attribution des sièges** (le plus piégeux) : exprimés comptés en bulletins et non en voix, majorité absolue strictement supérieure à la moitié (13 sur 24, pas 12), un seul siège pourvu au premier tour, égalité sur le dernier siège, blancs et nuls hors dénominateur, bulletin nul portant des noms valides. **Écrire ces tests avant la grille.**
- **État intermédiaire de la projection** (calcul pur, testable sans DOM) : `voix × 2 > votantsAnnonces` déclenche « déjà élu » et rien d'autre ne le déclenche · le pourcentage porte sur les bulletins dépouillés, pas sur `votantsAnnonces` · **un cas où le pourcentage d'un candidat baisse pendant que ses voix montent** (figé par un test, sinon quelqu'un le « corrigera ») · seuil de majorité qui descend à l'arrivée d'un blanc · aucun « éliminé » émis en cours de route.
- **Purge en cascade** : la liste énumérative, **et** un test *balayant* qui monte un état maximal, supprime, puis cherche le moindre reste dans `JSON.stringify(S)` (le seul qui voit un champ **nouveau**).
- **Rétrocompatibilité** : une fixture JSON par changement de modèle, rejouée par le chemin d'import complet. ⚠️ **Ne jamais régénérer une fixture existante** : elle fige un état historique.
- **Fuzz** : mutations reproductibles (graine fixe) d'une fixture réelle ; le chemin d'import doit **refuser ou aboutir**, jamais lever.
- **Sync deux postes** : deux sandboxes, deux `localStorage`, deux `_DEVICE_ID`, classification vérifiée à chaque étape jusqu'à la résolution de conflit.
- **Lint anti-XSS** : échec si un champ de donnée utilisateur (`nom`, `prenom`, `titre`, `label`, `remarque`…) est interpolé en clair dans une ligne contenant un fragment HTML.
- ⚠️ **Chaque test balayant porte un méta-test** qui injecte un cas volontairement fautif et vérifie que le détecteur le voit ; sans lui, une régression du parcours rend la suite silencieusement vacante (pire que pas de test).

⚠️ `node --test` exécute **tout** `.js` sous `test/` : un utilitaire y passerait pour un test en échec. Les scripts vont dans `scripts/`.

## Historique

- L'historique des versions est dans `git log` (pas de tableau ici).
- Chaque livraison avance `APP_VERSION` et `APP_BUILD_DATE` (cf. *Version & publication*).
- On n'ajoute plus de ligne par version dans ce fichier : une fonctionnalité nouvelle se documente dans la section de son sujet.

## Audits : méthode et leçons

### Outils (dans `scripts/`)

- **`scripts/audit_static.js`** (Node, sur le harnais) : chaque fonction appelée par un handler inline existe ; chaque id passé à `getElementById` existe dans le HTML statique (quelques ids dynamiques connus) ; fonctions définies mais jamais référencées ; fonctions définies deux fois. Un test détecte aussi le code mort (avec méta-test).
- **`scripts/audit_browser.js`** : à charger par `<script src>` (la CSP interdit `eval`). Mesure le contraste (fond effectif par remontée des parents transparents, opacité cumulée, seuil 4,5:1 — 3,0 pour le grand texte —, contrôles désactivés exclus, deux fonds translucides empilés ne font pas un fond opaque, un dégradé est mesuré par sa pire couleur), le débordement horizontal (comparé à `documentElement.clientWidth`), le texte tronqué sans infobulle (un texte « sr-only » n'est pas « tronqué ») et `window.__suiviPPErrors`. Mode `run(label, true)` : mesure aussi `#pa` (feuille imprimée), avec les règles `@media print` réinjectées à l'écran et `window.print` remplacé.
- **`scripts/audit_parcours.js`**, à charger après `audit_browser.js` : parcours des états d'écran et des feuilles imprimées. Lancer `__parcours.demo()` puis `__parcours.run({ themes, papier })`, puis lire `__audit.report()`.
- Méthode : des données partout (la démo exhaustive est un instrument d'audit), les sous-états autant que les onglets, les modales par leur vrai ouvreur, transitions neutralisées (`*{transition:none!important;animation:none!important}`), deux thèmes, largeurs 1 570 et 320 px (+ 1 009 px), papier simulé depuis le thème sombre.
- ⚠️ Pièges de l'outil :
  - un service worker resté d'une session précédente peut servir un 503 sur tout fichier hors cache : le désinscrire d'abord ;
  - un onglet caché plus de cinq minutes voit ses `setTimeout` limités à un par minute : le parcours ne doit rien attendre (rendus synchrones), et il faut `tabs_select` sur l'onglet de test avant de lancer `run()` ;
  - un appel de l'outil de navigateur est coupé à 45 s : lancer `run()` sans l'attendre et relire `__audit.report()` ensuite ;
  - `scripts/audit_browser.js` comparait avant à `innerWidth` : en émulation mobile la fenêtre s'élargit d'elle-même, donc les audits à 320 px d'avant le 2026-10-02 sont à relire avec prudence pour le débordement (pas pour le contraste) ;
  - sur le poste Windows, `.claude/launch.json` (local, ignoré par git) lance `C:/Python313/python.exe -m http.server 8731 --bind 127.0.0.1` : `npx` y échoue.
- ⚠️ La mesure vaut pour ce qui existe : à rejouer à chaque étape sur des écrans pleins ; ce qui n'existe nulle part n'est jamais mesuré (les défauts 9 et 10 dormaient depuis les étapes 2 et 5).
- Exemption assumée : les contrôles `disabled` (`opacity: .55`) sont écartés de la mesure de contraste (WCAG 1.4.3 exclut les composants inactifs, et la pâleur DIT « indisponible ») ; si un bouton grisé devient illisible à l'usage, l'opacité est le réglage à revoir.
- Tests statiques du design system (`test/design-system.test.js`, avec méta-tests) : symétrie des tokens entre les trois blocs dans les deux sens, tout token *utilisé* a une valeur en thème clair, aucune encre figée derrière un fond dynamique, pose ET retrait des orientations d'impression, boîte focalisable dans chaque modale, règles responsive.
- ⚠️ Rendu papier non vérifié sur du vrai papier : `window.print` est mocké. Orientation : `@page` anonyme injecté le temps de l'impression puis retiré à `afterprint` (les pages nommées sont ignorées par Firefox) ; une page de chaque est à vérifier à la main sur Chromium et Firefox.
- ⚠️ Non vérifiés à la main : vidéoprojecteur réel (1024 × 768 et 1920 × 1080, lisibilité du fond de la salle), clavier virtuel d'une vraie tablette, dossier Nextcloud réel pour les PDF.
- **Dernier état mesuré** (v1.65.0, 2026-10-11) : parcours de 180 états, 2 thèmes, 1 400/1 570 et 320 px, feuilles imprimées comprises, 0 défaut de contraste, débordement, texte tronqué ou erreur JS.

### Leçons des défauts trouvés (numérotés)

1. Bandeau RGPD à 1,63:1 en sombre : un fond clair posé pour le mode clair a besoin de son propre couple de tokens (`--rgpd-bg` / `--rgpd-fg`…), pas d'une encre qui s'inverse.
2. Boutons imprimés en thème sombre : les fonds de bouton sont en dur et le bloc de neutralisation n'agit que sur les tokens → `.tb, button, .btn { display:none }` dans `@media print` (aucun contrôle sur le papier).
3. Pastilles de groupe invisibles : `--g1/2/3` vivaient hors du bloc design system repris ; tokens rétablis avec encre nommée `--gN-on` (identiques dans les deux thèmes : une seule déclaration dans `:root`).
4. Cellules blanches en sombre : `input:not([type])` oublié dans la règle générique ; invisible à la mesure (noir sur blanc passe), vu seulement à l'écran → REGARDER, pas seulement mesurer.
5. Badge neutre `.badge.z` à 4,12:1 : `--pencil` est calibré sur le papier, pas sur `--paper-deep` ; utiliser `--ink-blue-soft` (une encre secondaire sur une surface plus foncée se remesure).
6. Mode projection à moitié d'écran : `.el-split.proj { grid-template-columns: 1fr }` ; à revérifier sur le vrai vidéoprojecteur.
7. Un second tour vide laissait l'élection « en cours » pour toujours : second tour seulement s'il reste des sièges ET des candidats ; les fixtures se ressemblent trop (quatre candidats partout cachaient le cas à un seul).
8. Un `<button>` n'hérite pas de `color` : `button { color: inherit; font-family: inherit }` avant les classes de bouton.
9. Pastille PAI à 4,41:1 : un accent posé en fond doit être choisi pour qu'une encre réelle passe (`#c2185b`) ; `_contrastTextColor` ne rattrape pas une couleur trop claire.
10. `avisManquants` comptait les champs `prof` facultatifs : filtrer sur `obligatoire` des deux côtés (comme `reponsesManquantes`).
11. Tableaux larges sans conteneur de défilement : `.rel-wrap` sur tous les tableaux larges (sinon la barre d'onglets sort de l'écran sur téléphone).
12. Les volets de l'élection refusaient de rétrécir : un enfant de grille vaut `min-width: auto` → `min-width: 0` et `minmax(0, 1fr)`.
13. Un `<select>` se dimensionne sur son option la plus longue, et le `<label>` flex qui l'enveloppe a le même `min-width: auto` : il faut les deux pour que `max-width` morde.
14. Noms tronqués en projection : en projection le nom revient à la ligne (pas d'ellipse, il y a de la hauteur, pas de largeur) ; l'ellipse reste en vue à deux volets avec infobulle.
15. Le focus n'était pas rendu à la fermeture d'une modale : l'ouvreur est mémorisé et refocalisé s'il existe encore et est visible.
16. Libellé de colonne fixe à 3,01:1 : l'opacité dit « indisponible », jamais « obligatoire » (cadenas 🔒 et contraste plein).
17. 44 px de débordement à 320 px : un `<span>` en `display:flex` sans `flex-wrap` pousse la page ; un bouton de plus dans une barre flex est un test à 320 px à refaire.
18. Un document partagé entre deux classes faisait entrer les élèves de l'autre : garde à la source (`_ramRows`) ; une fixture sans le cas ne voit pas le défaut.
19. La colonne de noms « collante » ne collait pas : `overflow: hidden` sur `table.dt` en faisait un conteneur de défilement (cf. *Grilles figées*) ; un `sticky` se vérifie en faisant défiler.
20. « Une erreur est survenue » à chaque redimensionnement : écriture de `--topbar-h` dans le rappel du `ResizeObserver` → écriture différée par `setTimeout` (pas `requestAnimationFrame`) et seulement si la valeur change ; tout style écrit depuis un observateur de taille s'écrit à la tâche suivante.
21. 343 px pour 320 à l'ouverture de Données : cellule de grille `.prefs` avec champ + bouton → `min-width: 0`, ligne `.prefs-row` en flex qui replie.
22. Éditeur de place de la fiche : `dd` de grille sans `min-width: 0` + éditeur flex en colonne avec `flex-wrap: wrap` (en colonne, la ligne replie sur ses items) → `nowrap`.
23. Élèves partis à 2,99:1 : `opacity` s'applique à tout ce que la ligne contient, y compris ce qui était déjà en `--pencil` → l'encre passe à `--pencil` + italique.
24. L'infobulle du nom tronqué du graphique n'avait jamais été posée : `title` sur `.el-name`.
25. Le pourcentage du graphique se tronquait à 320 px : `.el-pct` sort de la règle d'ellipse (un pourcentage sans son dénominateur est interdit).
26. Ctrl+Z avec la fiche ouverte la laissait périmée : `_MODAL_RERENDER` (table des modales à redessiner après undo/redo/rechargement) était vide → `mfiche`, `mrem`, `mtags`, `mclasses` ; pas les modales de formulaire (saisie en cours) ; `_applyReloadedData` appelle `_refreshOpenConsultModals`.
27. « Suivant » du bilan sautait un élève après un tri « rédigé d'abord » : ordre figé à l'ouverture (`_bilanOrdreFige`).
28. `_elUndoArmed` non désarmé par `_applyReloadedData` : tout verrou de salve s'y désarme (cf. `_salvesDesarmer`).
29. Réglages débordant de 39 px à 375 px (`.prefs` en `max-content 1fr`) : une colonne sous 520 px (`!important`, certaines grilles portent leur gabarit en ligne) ; l'auditeur ne le voyait pas (cf. pièges).
30. Δ du carnet imprimé à 2,16:1 : `.pp-t small` imposait `#333` → `td[class*="ob-"] small { color: inherit }`.
31. Tiret « sans objet » imprimé à 4,48:1 : `#777` → `#666`.
32. Suppléant d'un élu non candidat posé APRÈS le vote affiché comme s'il était sur le bulletin (PV, candidatures, graphique) : `_elCandNomSupBulletin` ; trouvé en LISANT le PV d'un scénario, la démo ne porte pas ce cas → d'où les scénarios de bout en bout.
33. « Sont élus » au-dessus d'un seul élu : accord du titre du PV.
34. Les listes de la fenêtre de dialogue ne se redessinaient pas après Ctrl+Z : `_appDialogShow({ redessin })` → `_appDialogRedessin`, appelé par `_MODAL_RERENDER`, oublié à la fermeture ; tout nouveau contenu listé dans la fenêtre de dialogue passe un `redessin`.
35. Incident noté depuis une case vide de la carte de chaleur daté d'aujourd'hui, hors du mois et de l'année : toute nouvelle saisie datée propose `_dateParDefaut`, jamais `_todayYmd()` nu.
36. Le focus restait dans une fenêtre fermée : `_modalOuvreur` reprend le remplaçant de l'ouvreur redessiné, sinon le focus sort de la fenêtre.
37. Compteur et fenêtre de lecture divergeaient dans une feuille d'avis : `_avisCompte(camp, sids)` ne compte que les élèves de la feuille.
38. Le nom tapé d'une nouvelle feuille survivait au changement de classe : oublié dans `switchClass`.

## Deux machines, un seul transport

⚠️ **Premier geste de toute session : `git pull`** (un onglet entier avait été construit sur une copie en retard de quarante commits). Le dépôt ne passe plus par Nextcloud : seul git met ce poste à jour.

⚠️ **Ce dossier vit dans une arborescence Nextcloud mais ne doit PAS être synchronisé par Nextcloud.** C'est un dépôt git ; git assure le transport entre postes via `github.com/Belenos-Toutatis/suivi-pp`. Deux mécanismes qui recopient les mêmes fichiers font des conflits dans `.git` (cinq fichiers internes le 2026-06-19 dans le projet voisin).

### Où se pose l'exclusion — et où elle ne sert à RIEN

- ⚠️ Le client ne lit qu'UN fichier d'exclusion dans l'arbre : `~/Nextcloud/.sync-exclude.lst`, à la RACINE du dossier synchronisé. Dans un sous-dossier, il est inerte (synchronisé comme un fichier ordinaire). Le nom d'un fichier dans un binaire dit qu'il est connu, pas où il est cherché.
- Règle (chemin relatif) : `gestion élèves/PP/Suivi PP`.
- Ce fichier est lui-même synchronisé par Nextcloud (il atteint les autres machines tout seul) et relu sans redémarrage (en moins de 12 s).
- ⚠️ Les dossiers de DONNÉES ne sont pas visés : `gestion élèves/PP/Suivi PP json/` est un dossier voisin, sa synchronisation continue. Le code par git, les données par Nextcloud, ils ne se croisent jamais.

### Comment le VÉRIFIER — deux pièges de mesure

- ⚠️ Compter les entrées du journal de sync ne prouve RIEN : la table `metadata` est un registre historique qui ne se vide pas quand on exclut.
- ⚠️ Lire ce journal avec `immutable=1` renvoie un instantané PÉRIMÉ (le WAL est ignoré) : copier les trois fichiers (`.db`, `-wal`, `-shm`) et interroger la copie.
- Seul test valable : une SONDE avec son TÉMOIN — un fichier dans le dossier censé être exclu et un autre dans un dossier certainement synchronisé ; voir lequel arrive. Sans témoin, « rien n'est arrivé » peut vouloir dire que le client ne tournait pas.
- ⚠️ Corollaire : le dossier n'est plus sauvegardé par Nextcloud, le filet est GitHub — **le travail non commité n'est protégé par rien** ; commiter est le geste de sauvegarde.

### Identité git — à poser sur chaque poste

⚠️ Un poste neuf n'a pas d'identité git et `git commit` y échoue (« Author identity unknown ») ; configuration par machine, qui ne voyage ni par git ni par Nextcloud. Commits signés `Belenos Toutatis <emmanuel.wenner@gmail.com>` :

```
git config --global user.name "Belenos Toutatis"
git config --global user.email "emmanuel.wenner@gmail.com"
```

Dépannage sans rien écrire dans la configuration : `git -c user.name=… -c user.email=… commit`.

### Fins de ligne — `LF` partout, imposé par `.gitattributes`

- ⚠️ Git for Windows pose `core.autocrlf=true` : la copie de travail passe en `CRLF` alors que le dépôt est en `LF`. L'app s'en moque, mais les tests qui lisent `suivi pp.html` comme du texte avec un motif contenant `\n` échouent (3 échecs sur ce poste seulement).
- ⚠️ Le vrai danger est le bruit : un `npm test` jamais vert cesse d'être lu, et la règle « tests verts se VÉRIFIE » devient inapplicable.
- Corrigé à la cause : `.gitattributes` = `* text=auto eol=lf`, plus `binary` pour png/pdf/ods. Il voyage avec le dépôt (tout clone, quel que soit le réglage de la machine). Le proxy de l'employeur ne peut pas en être la cause : git vérifie le SHA-1 de chaque objet reçu.
- ⚠️ Après une réécriture de la copie de travail, `git update-index --refresh` ne suffit pas à faire taire le `M` de `git status` (la taille a changé) : `git diff` vide est la bonne mesure, et `git add` remet les choses d'aplomb.

## Installation comme application (PWA)

- ⚠️ Chrome REFUSE d'installer une PWA sans icône PNG d'au moins 192 px déclarée dans le manifeste (un favicon SVG en `data:` ne suffit pas, le menu « Installer » n'apparaît pas, sans message) : de VRAIS PNG en 192 **et** 512.
- ⚠️ `purpose: "maskable"` n'est pas un doublon : Android rogne l'icône dans un cercle de 80 % ; la version maskable porte le même dessin, plus petit, centré, sur un fond bord à bord. Les deux `purpose` (`any` + `maskable`) coexistent, sinon les surfaces qui ne masquent pas affichent l'icône rétrécie.
- ⚠️ iOS IGNORE les icônes du manifeste : sans `<link rel="apple-touch-icon">` (180 px), une capture de la page sert d'icône. Ce fichier est un carré plein (iOS applique son masque).
- ⚠️ Les icônes se préchargent dans `sw.js` (une app installée dont l'icône n'est pas en cache la perd au premier lancement hors-ligne).
- ⚠️ `cache.addAll` est écarté au profit d'un `add` par fichier : `addAll` rejette EN BLOC sur un 404 et l'installation du service worker échoue en silence. L'échec est toléré mais jamais silencieux (`console.warn`).
- Le dessin reprend le favicon (page claire, filet rouge de marge, lignes Seyès), lignes assombries à `#64768d` (le `#c8d2e0` disparaît à 48 px). Icônes générées par `scripts/gen_icons.py` (PIL, supersampling ×4), pas à la main.
- ⚠️ `test/pwa.test.js` lit les dimensions RÉELLES dans le chunk IHDR de chaque PNG et les compare à `sizes` (un manifeste qui annonce 512×512 pour une image de 48 px passe toute vérification textuelle et échoue à l'installation en silence).

## Version & publication

- Dépôt public `Belenos-Toutatis/suivi-pp`, GitHub Pages servi depuis `main` à la racine ; URL : `https://belenos-toutatis.github.io/suivi-pp/suivi%20pp.html`. En ligne, vérifié : les trois polices embarquées se chargent (CSP `font-src 'self' data:`), le service worker s'enregistre (impossible en `file://`), la détection de mise à jour répond 200 depuis `github.io`.
- ⚠️ **`.gitignore` est la seule barrière entre un dépôt PUBLIC et des données d'élèves.** `suivi-pp-*.json` y est ; un fichier exporté à la main sous un autre nom (`5C.json`, `classe.json`) passerait la barrière : vérifier `git status --short` avant chaque commit.

```js
const APP_VERSION    = '0.1.0';                 // semver affiché
const APP_BUILD_DATE = '2026-09-09T00:00:00Z';  // sert UNIQUEMENT à la détection de MAJ
const APP_UPDATE_TOLERANCE_MS = 10 * 60 * 1000;
const APP_REPO_USER  = 'Belenos-Toutatis';
const APP_REPO_NAME  = 'suivi-pp';
```

- ⚠️ **À bumper avant CHAQUE push** : `APP_BUILD_DATE` toujours, à l'heure UTC **réelle** (`date -u +"%Y-%m-%dT%H:%M:%SZ"`, jamais une estimation : une date en avance fait s'annoncer l'app périmée à elle-même), et `APP_VERSION` quand la livraison le mérite.
- ⚠️ La détection interroge les commits **qui touchent le fichier de l'app** (`?path=<fichier>&sha=main&per_page=1`), pas le dernier commit du dépôt (sinon un commit de documentation déclenche une fausse alerte).
- Commits en français, à l'impératif ou au constat, terminés par :

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

- ⚠️ **Une fonctionnalité nouvelle entre dans la démo dans la même version** (sinon elle n'est ni auditée ni découverte ; seuls les PDF joints et un handle de dossier ne peuvent pas y être). ⚠️ **La démo ne porte aucun cumul décroissant** (le repère ▼ reste dans l'app pour la faute de frappe, testé dans `carnets.test.js` ; `demo.test.js` vérifie qu'aucun cumul de la démo ne baisse).

## Hors périmètre, volontairement

- ⚠️ **Les PLACES rentrent dans le périmètre, pas les plans de salle** : on reprend de Plan de classe la position de chaque élève et les patterns de ramassage, pour TRIER des listes (*savoir dans quel ordre passer* n'est pas *afficher une salle*).
- ⚠️ **Le RÉGLAGE rentre aussi** (cf. *Données et réglages*) : nom de la salle, dimensions, qui est assis où, ordre de ramassage — une grille, pas un plan (ni îlots, ni tablettes, ni cases vides dessinées, ni emplois du temps). L'écran rappelle qu'un import depuis Plan de classe réécrit tout cela.
- Hors périmètre : la **saisie** de notes et le **calcul** de moyennes d'élèves (Plan de classe et Pronote ; l'onglet 📈 Moyennes ne fait que LIRE l'export du bureau numérique), les plans de salle dessinés, appel/absences saisis à la main, bulletins et remarques de bulletin, mentions de conseil, élections autres que celle des délégués de la division (CVC, conseil d'administration — le PP ne les organise pas), export XLSX/ODS (le CSV suffit ; le module `_NotesExport` de la référence reste disponible si besoin).

## Questions encore ouvertes

1. **Modalités exactes de l'établissement** : uninominal ou plurinominal, suppléants élus avec les titulaires ou séparément, départage — les défauts viennent des textes liés (cf. *Élection des délégués*), mais le règlement intérieur prime ; à vérifier une fois avant la première élection réelle.
2. **Alerte d'échéance** : un document a une `dateEcheance` ; faut-il un signalement à l'ouverture (« 3 fiches d'orientation manquantes, échéance dans 2 jours ») ?
3. **Besoins listés le 2026-09-11 et non retenus** : rappels / choses à faire (journal à deux temps), signaux positifs (famille « Valorisation »), compteur d'absences relevé comme le carnet, contacts familiaux minimum sur la fiche, alerte d'échéance, courrier type aux familles, synthèse de fin d'année pour le PP suivant. (Le remplacement d'un délégué : option 1 livrée ; l'élection partielle pour un siège sans suppléant n'est à construire que si le cas se présente — le siège est marqué vacant.)

