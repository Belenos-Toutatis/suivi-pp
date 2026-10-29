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
- `docs/` — la documentation détaillée par domaine (cf. table ci-dessous)
- `fiches-suivi/` — **l'application des fiches de suivi** (individuelles · collectives · classe), reprise le 2026-10-10 (cf. *Fiches de suivi*), avec ses sources, ses tests de bout en bout et son propre `fiches-suivi/CLAUDE.md` — à lire avant d'y toucher
- `test/harness.js`, `test/*.test.js`, `test/fixtures/` (dont `trombi/fake-trombi.pdf`, faux trombinoscope), `package.json` (`npm test` → `node --test "test/*.test.js"`)
  ⚠️ Le glob, pas `node --test test/` : sous Node 22 l'argument-répertoire échoue en `MODULE_NOT_FOUND` ; le glob n'exécute en plus que les `*.test.js` (pas `harness.js`).

Dépôt : **`suivi-pp`** sous `Belenos-Toutatis` → `belenos-toutatis.github.io/suivi-pp/`.

Clés `localStorage` préfixées **`suiviPP`** (`suiviPP_v1` données, `suiviPP_theme`, `suiviPP_deviceId`, `suiviPP_autoSync`…). ⚠️ Préfixe **différent** de `planClasse`, et `_isAppLsKey` adaptée.
Fichiers de sync : `suivi-pp-auto.json`, `suivi-pp-bk-*.json`, `suivi-pp-checkpoint-*.json`, `suivi-pp-conflit-{mienne|autre}-*.json`.

## Documentation détaillée — `docs/` (à lire AVANT de toucher au domaine)

Ce fichier ne garde que le cœur (décisions, modèle, conventions, invariants, publication). Le détail de chaque domaine — pièges, arbitrages, fonctions — est dans `docs/`, **non chargé d'office** : ouvrir le fichier du domaine avant d'y concevoir ou d'y corriger quoi que ce soit. Un renvoi « cf. *Section* » désigne une section de l'un de ces fichiers.

| Fichier | Sections |
|---|---|
| `docs/carnet.md` | Relevés de carnet (cumul, `'A'`, paliers, impression) · Remarque, journal des contacts (fichiers joints), naissance · Observations notées dans MBN · Récapitulatif vie scolaire de MBN (PDF) |
| `docs/documents.md` | Documents (un papier, plusieurs réponses ; options d'un champ) · Écran 📄 Retours : ramassage, impression d'un document et de la grille |
| `docs/moyennes.md` | Moyennes par matière : import, statistiques, affichage, impression · Écran 📈 Moyennes |
| `docs/elections.md` | Élection des délégués : cadre réglementaire, modèle, bureau de vote, accord en genre, un siège après l'autre, saisie bulletin par bulletin, **arithmétique**, projection en direct, PV, après l'élection (remplacements, éco-délégués) · Écran 🏫 Vie de classe (heures de vie de classe) |
| `docs/bilans.md` | Bilans de période · Décisions d'un moment · Synthèse de période imprimable · Bouton « 🖨 Imprimer… » · Fiche élève imprimée |
| `docs/ia.md` | Synthèse par une IA (un élève, toute la classe, la synthèse DE la classe) · Désactiver l'IA · Envoi direct à Claude par l'API · Longueur, chiffres, plein écran |
| `docs/avis.md` | Avis des collègues (circuit Nuage, colonnes, objectif, message, disciplines et matières, revue, lecture/écriture, module .ods et Andika, onglet 🗣) · 🎨 Ton des avis · 📄 Bulletins (import, retour dans le bilan) · Vers MBN (favori) |
| `docs/fiches-suivi.md` | Onglet 📋 Suivis : messages, Ctrl+Z, carte de la fiche, carte de chaleur, réglages communs (le reste : `fiches-suivi/CLAUDE.md`) |
| `docs/photos.md` | 📷 Photos des élèves, trombinoscope |
| `docs/incidents.md` | Incidents et instances, PDF joints, lecteur |
| `docs/ecrans.md` | 👥 Élèves (indicateurs, carte de chaleur, filtres, vues, colonnes, bilans, régimes, import MBN) · Fiche élève (vues, crayon ✎, fenêtre ✏️) · 📓 Observations · 💾 Données et réglages (rubriques, salles et placements) · Impression · Tri (nom, place, ramassage) · Grilles figées |
| `docs/import-eleves.md` | Import CSV / tableur · Import JSON de Plan de classe |
| `docs/sauvegarde-sync.md` | Sauvegarde, sync, stockage |
| `docs/design-system.md` | Polices, infobulles dessinées, tableaux imprimés, règles de couleur, méthode d'audit du contraste |
| `docs/audits.md` | Outils d'audit (`scripts/`), pièges de l'outil, derniers états mesurés, leçons des défauts numérotés |
| `docs/postes-pwa.md` | Exclusion Nextcloud (où, comment vérifier), identité git, fins de ligne, installation PWA |

⚠️ **Toute retouche de couleur** : chaque token se déclare à TROIS endroits (`:root`, `html[data-theme="dark"]`, `@media print { html[data-theme="dark"] }`), jamais `color:#fff` en dur sur un fond coloré (`_contrastTextColor`) — détail et audit dans `docs/design-system.md`.

⚠️ **Documenter** : une fonctionnalité nouvelle se décrit dans le fichier `docs/` de son domaine (ou un nouveau fichier, ajouté à cette table) ; ici, seulement ce qui vaut pour tout le projet.

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

## Conventions de développement

- **L'app VOUVOIE l'utilisateur** (« Choisissez », « votre bilan », « Cochez » ; les tournures en « on » restent). Le code repris de Plan de classe tutoyait : tout texte affiché nouveau ou repris se met au vouvoiement.
- **Tout dans un seul fichier HTML** : CSS dans le `<style>` de tête, JS dans le `<script>` de fin de body. **Aucune dépendance externe**, aucun CDN : hors-ligne, en `file://` comme en HTTPS.
- **`pushUndo()` AVANT toute mutation**, jamais après (l'undo capturerait le mauvais état). Pour une **saisie continue** (cumul de relevé tapé, cases de ramassage cochées), le motif `_evalArmUndo()` de la référence : un snapshot par salve, verrou libéré 2 s après la dernière mutation, sinon la pile d'undo sature.
  - ⚠️ **Tout verrou de salve se désarme dans `_applyReloadedData`.** Un verrou encore armé après un rechargement de sync fait SAUTER le `pushUndo()` de la mutation suivante (état fraîchement rechargé jamais capturé, Ctrl+Z ne remonte plus). `_relUndoArmed` y était, `_ramUndoArmed` (ajouté plus tard) avait été oublié : ce n'est pas une précaution décorative. Tous les verrous sont dans `_salvesDesarmer`, appelée aussi par Ctrl+Z / Ctrl+Y (une saisie juste après un Ctrl+Z n'avait pas de cran).
  - ⚠️ **Armer la salve seulement une fois la mutation certaine** : armer puis renoncer pose un snapshot sans mutation, et le premier Ctrl+Z ne fait rien de visible. Une saisie qui ne change rien (« 08 » retapé sur 8, touche « inchangé ») n'arme rien (`relCellChange` compare avant) ; les autres gestes sans effet (espace ajouté à un nom, même couleur, élève déjà demandé…) retirent leur cran par `_undoSiRien()`.
  - ⚠️ **Un refus après `pushUndo()` se défait par `_undoAnnulerRefus()`, jamais par `undoLast()`** : `undoLast` affichait « Annulation effectuée », activait Ctrl+Y pour une action qui n'a pas eu lieu et, pile pleine, perdait le plus ancien niveau. Les enveloppes qui poussent avant leur mutation (`_withStudent`, `_docMut`, `_elMut`) passent le retour à `_undoSiRien` : refusé (`false`) ou sans effet, le cran est retiré.
  - ⚠️ **Le contenu d'un fichier chargé est normalisé** (`_sanitizeImbrique`, juste après `_sanitizeCoreSections`) : un nombre attendu qui n'en est pas un s'injectait tel quel dans le HTML et dans des gestionnaires (groupe, numéro de bulletin, rangs d'une salle). Tout nouveau champ numérique affiché s'y normalise ; nombre écrit en texte converti, illisible retiré. Garde-fou : ne RIEN changer à des données saines (diff vide sur la démo). `nom` / `prenom` toujours des chaînes (`''` à défaut) ; l'`id` suit sa clé (élèves, classes, documents, élections, salles, tags, matières, disciplines, instances).
  - ⚠️ **Une référence par id écrite en VALEUR désigne une entrée PROPRE** (`_sanitizeRefs`, fin de `_sanitizeImbrique`) : `_validateImport` ne voit que les clés, et `S.cur`, un roster ou un `classe_id` valant « constructor » / « __proto__ » trouvait une propriété HÉRITÉE (onglets qui tombent, `Object.prototype` écrit par `_withStudent`). Roster, places, `classIds` : retirés ; `S.cur` → première classe ; `classe_id` → la classe dont le roster le porte, sinon retiré ; ce qui peut désigner un disparu (PV, tags, instance d'un incident, domaine `_domaineOk`) ne perd que le nom hérité. `getCls` et `_withStudent` testent `hasOwnProperty` ; `_auditState` signale un `S.cur` inconnu. Fuzz à graine fixe avec méta-test : `test/audit-1014-donnees.test.js`.
- **Zéro dialogue natif** : ni `alert`, ni `confirm`, ni `prompt` (l'anti-popup les bloque en silence, le bouton paraît cassé). Utiliser `_uiConfirm`, `_uiPrompt`, `appAlert`, ou `toast(msg, 'warn')` pour une précondition non bloquante. ⚠️ `_uiConfirm` **n'est pas bloquant au sens JS** : tout ce qui suivait le `confirm()` va dans `onOk` / `onCancel`.
- **Échappement au rendu**, systématique : `_escName` / `_escAttr` pour toute donnée utilisateur en `innerHTML` ; `_escJsAttr` pour un texte passé à un handler inline (le navigateur HTML-décode l'attribut **avant** de parser le JS, `_escAttr` seul laisse un breakout) ; `_csvCellGuard` avant tout quoting de cellule exportée (une cellule commençant par `=` `+` `-` `@` est une formule à l'import tableur). Template balisé `_html` pour le code neuf.
- **CSP en `<meta>`** dès le premier commit : `connect-src 'self' https://api.github.com` (et, depuis la v1.73.0, `https://api.anthropic.com` pour l'envoi direct d'une synthèse), `img-src 'self' data: blob:`, et ⚠️ **`font-src 'self' data:`** (sans lui, `default-src 'self'` bloque les polices base64 et l'app retombe en silence sur les polices système) ; **`frame-src blob:`** (et non `'none'`) : le lecteur de PDF intégré encadre un blob créé par la page, lié à son origine, rien d'extérieur ne peut être encadré.
- **États vides actionnables** : un état vide dit QUOI faire (`_emptyStateHTML(icon, titre, hint)`).
- **Retour de modale** : `_modalReturnTo[id]` pour qu'un panneau ouvert en parenthèse (réglages d'un document depuis son tableau) revienne d'où il vient, sur les trois voies de fermeture (bouton, fond, Échap).
- **Auto-focus et Entrée** : chaque modale à formulaire porte `data-autofocus` sur son premier champ utile et valide à `Entrée`. Sans `data-autofocus`, `openMod` focalise la boîte `.mb` elle-même, sinon le focus reste **derrière** la modale et le piège à focus ne s'enclenche jamais.
- **Pas de conception 100 % clavier**, mais les **raccourcis existants ne se cassent pas** : `Échap`, `Ctrl+Z` / `Ctrl+Y`, `Ctrl+P`, validation à `Entrée`. ⚠️ Le garde de `Ctrl+Z` teste la **saisie de texte** (`_isTextEntryTarget`), pas `tag === 'INPUT'` : une case à cocher garde le focus sans undo natif, le raccourci y devenait muet.
- Développement long : travailler sur une copie `suivi pp new.html`, puis remplacer une fois validé.

### ⚠️ Champs `<input type="date">` — l'année telle que tapée

Un champ date livre l'année **exactement comme saisie** : « 21 / 05 / 13 » donne `0013-05-21`, pas `2013-05-21`. La date est rejetée comme illisible juste après une saisie correcte du jour et du mois (25 fois sur une saisie en série de naissances).

- ⚠️ **La correction est aussi dans le MOMENT.** Un champ date est « complet » dès le premier chiffre d'année tapé et `change` part avec l'an 0001 ; normaliser et réécrire le champ à cet instant **remet le segment année à zéro** (taper « 1 » puis « 3 » donnait 2001 puis 2003, pas 2013). On attend donc que le champ soit **quitté** pour normaliser, enregistrer et réafficher. Un test de `_ymdCompleteAnnee` seul ne garantit rien : celui qui compte pilote `document.activeElement`.
- ⚠️ **Un `change` ne dit PAS que le champ est quitté** (mesuré dans Chrome) : à chaque segment complété (jour, puis mois), `change` part avec `document.activeElement` = BODY, et le champ reprend le focus juste après. La garde « `change` reçu alors qu'il n'a plus le focus » laissait donc partir des écritures en pleine frappe, et un re-rendu remplaçait le champ (« 15/01 » donnait « 02-15 », « 31/10 » sur une date de septembre remettait l'ancienne). **Arbitré : une date (clavier ou calendrier) s'écrit à la SORTIE du champ.** Détection partagée **`_dateChamp(event, ecrire)`**, sur `onchange` ET `onblur` de tout champ date qui écrit : `blur` écrit (sauf si le champ a toujours le focus : la fenêtre seule l'a perdu) ; `change` n'est cru qu'une tâche plus tard (`setTimeout 0`), si le champ n'a toujours pas le focus et est encore dans la page. Le focus visé par Tab est rendu après un re-rendu (`_focusSignature` / `_focusRetrouver`). `beforeunload` enregistre d'abord le champ date focalisé (`_dateChampFermeture`). Test statique (avec méta-test) : tout `onchange` de champ date passe par `_dateChamp`, sauf un champ de formulaire lu au bouton dont le `onchange` ne fait qu'afficher (`data-date-affichage`).
- ⚠️ **Une date PARTIELLE (`validity.badInput`, se lit `''`) n'efface jamais** une date enregistrée : toast et ancienne date remise dans le champ (`_dateChampLire`, `ficheSetDate`, `eleveNaisCommit`, `journalDateUI`, `periodeDebutUI`, `avisEcheanceUI`). Vider le champ volontairement efface.
- ⚠️ **On n'ouvre JAMAIS le sélecteur natif (`showPicker`) en arrivant sur le champ suivant** : au tactile il ne sert à rien (toucher un champ date l'ouvre déjà) et il affichait le calendrier par-dessus le clavier, exigeant une frappe d'Entrée de plus (25 frappes perdues par classe). Un test de source l'interdit.
- `_ymdCompleteAnnee(v)` complète les années à **deux** chiffres : `20xx`, ou `19xx` si `20xx` tombait dans le futur. ⚠️ **Trois chiffres ne se devinent pas** (« 202 » = 2020 trop vite, 1202 ou 0202) : deviner écrirait une date fausse sans signal. Appelé sur toute date saisie à la main (naissance dans la liste et la fiche, date de relevé, date de contact) ; **tout nouveau champ date s'y branche**.
- Branchés aussi (audit du 2026-10-14) : arrivée et départ de la fenêtre ✏️ (`saveEdit`, refus d'une date illisible), distribution et échéance d'un document (`docModalOk`), date de retour (`docSetDateRetourUI`, `ficheDocDate`) et date du ramassage (`ramSetDate`) via `_dateChampLire` (écrit à la SORTIE du champ ; une date illisible n'efface RIEN et le champ revient à la valeur enregistrée, un champ vidé exprès efface le retour mais pas la date du ramassage).
- **Dates proposées par défaut = `_dateParDefaut(cls)`**, jamais `_todayYmd()` nu : ramassage, `docSetRendu` (`_dateRetourDefaut(sid)`, classe de l'élève), contact de la fiche, distribution d'un nouveau document.
- `_periods` ramène un début `MM-JJ` inexistant (« 02-30 », « 02-29 » hors bissextile, « 04-31 ») au dernier jour du mois (`_ymdJourValide`). `_obsFenetre` : « n mois » = même quantième n mois plus tôt + 1 jour, ramené au dernier jour du mois (fin 31/03, 1 mois → début 01/03). `_obsMbnDate` : une heure impossible (« 25:99 ») vaut l'heure vide ; un nombre de série à 23:59:30 ou plus reste à 23:59, jamais « 00:00 » le même jour.

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

Outils, pièges de l'outil, derniers états mesurés et leçons des défauts : `docs/audits.md`.

### Quand auditer (arbitré le 2026-10-14)

Chaque audit trouve du nouveau : il échantillonne (d'autres scénarios, d'autres domaines, d'autres méthodes), il ne prouve pas l'absence de défauts. Le signal qui compte est la **gravité** de ce qu'il trouve, pas le nombre : premier audit, des défauts bloquants dans l'usage normal ; second audit, surtout des régressions des corrections et des cas limites (fichiers forgés, valeurs aberrantes).

- **Plus d'audits complets en série.** Les tests `audit-1014-*` et `audit2-*` gardent tout ce qui a été trouvé ; un troisième audit complet coûterait cher pour des cas limites, et chaque correction rapporte un risque de régression.
- **L'usage réel est l'audit qui compte** : noter ce qui ne va pas en classe, un défaut rencontré vaut dix scénarios imaginés. Restent à essayer à la main : récapitulatif PDF réel de MBN, feuille d'avis dans Collabora, signature Outlook collée, calendrier natif d'un champ date, enchaînement Suivis ↔ Données, vidéoprojecteur.
- **Après une fonctionnalité nouvelle** : audit fonctionnel CIBLÉ sur son domaine, puis vérification de régression sur ses voisins (rejouer les scénarios d'avant) — pas un audit de toute l'application.
- **Corriger en lots petits et SÉQUENTIELS** quand ils touchent des zones qui se croisent : six lots en parallèle ont produit les régressions du second audit.
- **Un audit complet par trimestre au plus**, ou avant un moment à fort enjeu (élection des délégués, conseils de classe).
- Un geste au clavier ou à la souris se vérifie dans un **vrai navigateur** (Puppeteer, panneau navigateur), pas seulement par le harnais Node.

## Deux machines, un seul transport

⚠️ **Premier geste de toute session : `git pull`** (un onglet entier avait été construit sur une copie en retard de quarante commits). Le dépôt ne passe plus par Nextcloud : seul git met ce poste à jour.

⚠️ **Ce dossier vit dans une arborescence Nextcloud mais ne doit PAS être synchronisé par Nextcloud.** C'est un dépôt git ; git assure le transport entre postes via `github.com/Belenos-Toutatis/suivi-pp`. Deux mécanismes qui recopient les mêmes fichiers font des conflits dans `.git` (cinq fichiers internes le 2026-06-19 dans le projet voisin).

Détail (exclusion `.sync-exclude.lst`, comment la vérifier par une sonde et son témoin, identité git, `.gitattributes`) : `docs/postes-pwa.md`. ⚠️ Le dossier n'étant plus sauvegardé par Nextcloud, **le travail non commité n'est protégé par rien** : commiter est le geste de sauvegarde.

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

