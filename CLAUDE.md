# Suivi PP — Contexte projet

## Application

PWA **mono-fichier** de suivi des élèves dont l'utilisateur est **professeur principal**.
Quatre besoins, dans cet ordre d'importance :

1. **Relevés de carnet** — combien d'observations chaque élève a dans son carnet, à différentes dates de l'année.
2. **Documents administratifs** — qui m'a rendu quoi, et quand.
3. **Réponses portées sur ces documents** — le choix de la famille (participation à Devoirs Faits, options d'orientation…), avec un **avis du PP** quand il y en a un.
4. **Élection des délégués de classe** — candidatures, dépouillement, procès-verbal.

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
| Branches et versions (2026-09-10) | **Un seul projet, une seule version.** Le travail atterrit sur `main`, qui est la version — pas de branche de fonctionnalité qui vit à côté, pas de PR à fusionner plus tard. `APP_VERSION` avance à chaque livraison. ⚠️ Corollaire : la barre de qualité est à tenir **avant** de pousser (tests verts, audit de contraste rejoué), puisqu'il n'y a pas de sas de relecture. |
| Postes de travail (2026-09-10) | **Plusieurs machines, jamais en même temps** — elles ne sont pas au même endroit, donc travailler sur l'une signifie ne pas travailler sur l'autre. Le risque d'écriture concurrente est donc écarté par l'usage, pas par un verrou. ⚠️ Reste le cas asynchrone : refermer un portable avant la fin d'un téléversement, puis reprendre ailleurs. C'est pourquoi le dépôt sort de la sync (ci-dessous). |
| Sessions distantes (2026-09-10) | **Écartées.** Une session dans le nuage ferait très bien le code, les tests et la documentation — mais pas les audits qui demandent de REGARDER l'écran (contraste sur 20 états × 2 thèmes, responsive 320→1920). Or ce sont eux qui ont trouvé les défauts 4 et 6, invisibles à tout test. Arbitré par l'utilisateur : *« si tu ne peux plus faire les vérifications qui demandent de regarder l'écran, ça ne m'intéresse pas »*. |
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
- `test/harness.js`, `test/*.test.js`, `package.json` (`npm test` → `node --test "test/*.test.js"`)
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
  // Journal des contacts avec la famille — DATÉ et qualifié, à côté du texte libre.
  journal: [ { id, date: 'YYYY-MM-DD', ts, type: 'appel'|'rencontre'|'courriel'|'mot'|'autre', texte } ],
  // Incidents et instances (2026-09-11) : fiche incident, punition, commission éducative…
  // `type` pointe le catalogue S.instances ; `pdf` n'est qu'une RÉFÉRENCE vers le dossier
  // des pièces jointes (cf. *Incidents et instances*), jamais le fichier.
  incidents: [ { id, date: 'YYYY-MM-DD', ts, type: instanceId, objet, texte, pdf: null | { nom, fichier, taille } } ],
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
- **Total de période** : somme des deltas des relevés dont la date tombe dans la période — c'est-à-dire `cumul(dernier relevé de la période) − cumul(dernier relevé d'avant la période)`. ⚠️ Ne PAS additionner les cumuls, faute classique qui compte chaque observation autant de fois qu'il y a eu de relevés depuis.

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

## Élection des délégués de classe

### Cadre réglementaire

⚠️ **Les références d'articles ci-dessous sont données de mémoire et doivent être vérifiées sur Légifrance ou Éduscol avant d'être imprimées sur un procès-verbal.** Ce qui suit est fiable sur le fond, pas nécessairement sur la numérotation.

- **Deux délégués titulaires et deux suppléants par division**, au collège comme au lycée (Code de l'éducation, partie réglementaire, chapitre sur les représentants des élèves — art. R. 421-28 sauf erreur).
- **Mandat annuel**, élection **avant la fin de la septième semaine de l'année scolaire**.
- **Tous les élèves de la division sont électeurs et éligibles**, sans condition.
- Le texte prévoit un **scrutin uninominal à deux tours**. **Majorité absolue** des suffrages exprimés au premier tour, **majorité relative** au second.
- L'élection est organisée par l'établissement, en pratique par le **professeur principal**, après une information sur le rôle des délégués (heure de vie de classe).
- Les délégués siègent au **conseil de classe** et forment l'**assemblée générale des délégués**, qui élit les représentants au conseil d'administration et au CVC / CVL.

⚠️ **La pratique de l'utilisateur s'écarte de la lettre du texte, et c'est légitime — ne pas la « corriger ».** Sa présentation `../PP/délégué election.md` décrit :

- des **candidatures en binôme** : chaque candidat titulaire se présente **avec son suppléant**, affichés ensemble avant le vote ;
- un bulletin où l'élève inscrit **0, 1 ou 2 noms** de candidats — donc un scrutin **plurinominal** (on élit les deux titulaires d'un seul vote), là où le texte dit « uninominal » ;
- **bulletin vierge = blanc**, bulletin avec **trop de noms, des marques ou des inscriptions inappropriées = nul** ;
- **second tour avec les mêmes candidats** si personne n'atteint la majorité absolue ;
- **égalité de voix → le candidat le plus jeune est élu** ;
- **deux assesseurs**, élèves volontaires non candidats, qui surveillent le vote, ramassent et comptent les bulletins, puis **signent le procès-verbal**.

Ces variantes (uninominal ou plurinominal, binôme ou suppléants élus à part, départage par le plus jeune ou par le plus âgé) diffèrent d'un établissement à l'autre. **Conséquence de conception : les modalités sont des RÉGLAGES de l'élection, pas des constantes du code.** Les valeurs par défaut sont celles de sa présentation.

### Modèle

```js
election = {
  id, classId,
  date,                    // 'YYYY-MM-DD'
  titre,                   // « Élection des délégués — 5C — 2025-26 »
  // modalités, figées à la création et rappelées sur le PV :
  nbTitulaires: 2,
  nbSupplants: 2,
  binome: true,            // un candidat titulaire se présente avec son suppléant
  nomsParBulletin: 2,      // nombre max de noms qu'un bulletin peut porter
  majoriteAbsolueT1: true, // majorité absolue au 1er tour, relative au 2nd
  departage: 'plusJeune',  // 'plusJeune' | 'plusAge' | 'manuel'
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
- **Vérité disponible en cours de dépouillement** : `voix × 2 > votantsAnnonces` ⇒ le candidat est **définitivement** au-dessus de la majorité absolue, puisque `exprimés ≤ votants`. C'est le seul verdict anticipé que l'app s'autorise (cf. *Projection en direct*).
- **Départage** : appliqué seulement si l'égalité porte sur le dernier siège attribuable. Depuis le 2026-09-09, `stu.naissance` existe et `_elDepartageAge` tranche automatiquement en `plusJeune` / `plusAge`.
  - ⚠️ La date est **FIGÉE sur la candidature** (`cand.naissanceTitulaire`), comme l'est déjà le nom : les élections sont l'exception assumée à la purge, et un PV signé doit rester relisible — motif de départage compris — après le départ de l'élève. La date figée PRIME sur celle de l'élève vivant.
  - ⚠️ `_elDepartageAge` retourne **null** — « je ne sais pas » — dès qu'une date manque, que deux candidats partagent la même date sur le dernier siège disputé, ou que le mode est `manuel`. **null n'est pas un échec, c'est un refus délibéré de trancher** : l'app rend la main et demande. Un élu que personne ne peut justifier devant la classe est contestable, et vaut moins que rien.
  - La décision MANUELLE de l'utilisateur passe avant la règle automatique : s'il a tranché, c'est qu'il a écarté la règle en connaissance de cause.
- Si `binome`, le suppléant est élu **avec** son titulaire — pas de calcul séparé.

### Projection en direct du dépouillement

**Le dépouillement se fait devant la classe, et les élèves voient les résultats évoluer graphiquement bulletin par bulletin.** C'est l'usage principal de l'onglet, pas un ornement : la publicité du dépouillement est ce qui rend le résultat incontestable, et voir la courbe monter est ce qui fait comprendre le vote à des élèves de cycle 4.

#### Deux surfaces simultanées

L'enseignant saisit, la classe regarde. Les deux vues affichent le même état au même instant.

- **Par défaut, une seule page en deux volets** : grille de dépouillement à gauche, graphique à droite, le graphique dimensionné pour être lisible du fond de la salle. ⚠️ **C'est le mode à construire en premier, parce qu'il n'a aucun mode de défaillance** — il marche que le vidéoprojecteur duplique l'écran ou qu'il l'étende, et rien ne peut le bloquer.
- **En option, une fenêtre flottante projetable**, reprise de `_timerFillWindow` / `_noiseFillWindow` : Picture-in-Picture (`documentPictureInPicture.requestWindow`, toujours au premier plan) avec repli `window.open`. L'enseignant garde sa grille sur le portable, la classe voit le graphique en plein écran sur le second. ⚠️ **Le repli `window.open` peut être bloqué par le navigateur** (constaté dans le projet de référence) : la fenêtre flottante est un confort, jamais le seul chemin.
- Le calcul et l'état vivent **dans la fenêtre principale** ; la fenêtre projetée est un pur affichage rafraîchi à chaque bulletin, comme `_timerRender` pousse dans le document de la popup.

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

⚠️ **Le PV n'est imprimable que `clos: true`.** Un PV signé qui ne correspond plus au dépouillement affiché est un faux ; clore verrouille la saisie, et rouvrir demande une confirmation explicite.

### Après l'élection

- Les élus sont reportés sur l'élève (`stu.delegue = 'titulaire' | 'suppleant' | null`, dérivé de l'élection close la plus récente de sa classe) pour être visibles dans la **Synthèse** et dans la liste des élèves — un PP a besoin de savoir qui sont ses délégués sans rouvrir l'élection.
- **Le PV signé, en PDF** (v1.20.0) : une fois l'élection close, bloc « 📎 Joindre le PV signé » sous le résumé des élus → `election.pv = { nom, fichier, taille }` ; le même bloc sur la désignation sans vote (`cls.delegues.pv`, qui survit à une correction des noms). Même dossier et mêmes règles que les fiches incident (`_pjRef`, `_pvBlocHTML`, `pvAttachUI` / `pvOpenUI` / `pvRemoveUI`), nom automatique `PV élection délégués — 5e C — AAAA-MM-JJ.pdf`. `_pjReferences` les compte, donc le nettoyage des orphelins les épargne.
- **Sans élection dans l'app** (v1.19.0, demande de l'utilisateur) : le PP peut avoir voté sur papier, ou reprendre une classe en cours d'année — il doit quand même pouvoir dire qui sont les délégués. Bloc *« ✍️ Délégués désignés sans vote dans l'app »* en bas de l'onglet 🗳 : date, deux titulaires, deux suppléants, un mot → `cls.delegues` (`deleguesSet` / `deleguesClear`, roster seulement, un rôle par élève).
  - ⚠️ **`_delegueOf` arbitre par la DATE** : la désignation prime si elle est plus récente que la dernière élection close (ou s'il n'y en a pas), sinon l'élection fait foi — et l'écran le dit (« remplacée par l'élection du … »). C'est ce qui permet aussi de noter une démission après une élection tenue dans l'app : une désignation plus récente reprend la main. À date égale, la désignation gagne (`>=`) : c'est le geste le plus délibéré.
  - ⚠️ Contrairement aux élections (PV historique, exception de purge), **c'est un état courant** : `_purgeStudentRefs` retire l'élève parti, et une désignation vidée disparaît. Dans l'état maximal du test de balayage.
- ⚠️ **Ne pas stocker `stu.delegue` en dur** : le dériver de `S.elections`, sinon une correction du dépouillement laisse un ancien délégué marqué. Si un cache est nécessaire, le recalculer dans `postLoadHook`.
- Prévoir la **démission ou le départ d'un délégué** en cours d'année : le suppléant devient titulaire. Ce n'est pas une nouvelle élection — un champ `remplacements: [{ date, candId, motif }]` sur l'élection suffit, sans toucher au dépouillement.

## Incidents et instances

Ce qui se passe quand ça se passe mal, et ce qui en découle : une fiche incident, une
retenue, une commission éducative, un conseil de discipline. Demandé le 2026-09-11 :
*« des fiches incident à saisir, peut-être accompagnées d'un PDF de la fiche scannée, et
les commissions éducatives ou autres instances ; on propose toutes les instances
officielles, l'utilisateur les règle ou les décoche, et il note la décision prise. »*

- **Le catalogue est pré-rempli et réglable** (`INSTANCES_DEFAUT`, semé par `_instancesSeed`
  dans `postLoadHook`) : fiche incident · punition scolaire · exclusion ponctuelle de cours ·
  avertissement · blâme · mesure de responsabilisation · exclusion temporaire · commission
  éducative · conseil de discipline · équipe éducative · cellule de veille / GPDS ·
  information préoccupante · autre. Renommer, décrire, décocher, ajouter — dans 💾 Données.
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
  (`ficheVersIncident` + `_modalReturnTo`). `pushUndo()` avant chaque mutation.
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

Navigation à un seul niveau, 6 onglets (l'app reste petite ; pas de `.tab-group` à deux étages ici).

1. **👥 Élèves** — liste triable, import, ajout/édition, remarque libre, aménagements, arrivée/départ.
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
   - ⚠️ La fiche est un **dossier**, pas une vue courante : elle montre les documents archivés et les relevés où l'élève n'a rien. Une case vide au 8 décembre est une information quand on prépare un rendez-vous.
   - ⚠️ Un document `suiviRetour: false` s'affiche « rien à rendre », **jamais « non rendu »** : sinon la fiche fait courir après un papier qui n'existe pas.
   - La section **Documents est repliable** (elle est la plus longue, et on ne l'ouvre pas à chaque consultation) — mais les **choix portés** sur les papiers restent visibles repliés : c'est souvent la seule chose qu'on vient y chercher, et la cacher derrière un clic reviendrait à cacher l'essentiel avec l'accessoire. Le pli se souvient d'une fiche à l'autre. Reprend la structure de l'onglet Élèves de Plan de classe, moins tout ce qui touche au placement.
2. **📓 Carnets** — grille **élèves × relevés**. **Touches de saisie** sous la cellule active : les six valeurs probables (inchangé, +1 … +5), plus « absent » et « vide ». Toucher une touche écrit et passe à l'élève suivant — la boucle qui rend la saisie au doigt plus rapide qu'au clavier.
   - ⚠️ La **première** proposition est la valeur INCHANGÉE : d'un relevé à l'autre, « rien de neuf dans ce carnet » est le cas le plus fréquent, il doit être le plus facile à atteindre.
   - ⚠️ `_carnetSuggestions` ne regarde JAMAIS la valeur déjà dans la cellule : on peut être en train de corriger une faute de frappe, et proposer des incréments à partir d'elle la propagerait.
   - ⚠️ Le bandeau **suit** la cellule au défilement, il ne se referme pas. Première version : il se cachait sur tout `scroll` — or donner le focus à une cellule la fait défiler dans la vue, donc il disparaissait à l'instant même où il s'ouvrait. Invisible en test unitaire, systématique à l'usage.
   - ⚠️ Huit touches à 42 px font 376 px : plus qu'un écran de téléphone, et c'est là qu'elles servent. Elles passent à la ligne (`flex-wrap` + `max-width: calc(100vw - 10px)`).
 Une colonne par date, saisie du cumul au clavier (`Tab`/`Entrée` comme le tableur d'éval), colonne **Δ depuis le relevé précédent**, colonne **total de la période**, en-tête `+ Nouveau relevé`. Tri par Δ décroissant = la liste des élèves à voir en priorité.
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
4. **🗳 Délégués** — candidatures (binômes), **dépouillement projeté en direct** (grille de saisie à gauche, graphique lisible du fond de la salle à droite), résultats calculés, procès-verbal imprimable. Un bloc par élection, historisé : on garde celle de l'an dernier. **C'est l'écran le plus exigeant du projet** : il est utilisé une fois par an, devant 25 témoins, sans possibilité de reprendre plus tard.
5. **📊 Synthèse** — une ligne par élève, tout ce qui est connu : cumul d'observations, Δ récent, documents non rendus, réponses portées, délégué ou suppléant, remarque. **C'est l'écran de préparation du conseil de classe et des appels aux parents** — il est la raison d'être de l'app, pas un bonus.
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

**Impression** (`@media print`, orientation imposée avant `window.print()`) : la synthèse en paysage, la liste des manquants d'un document en portrait, le procès-verbal d'élection en portrait. ⚠️ Reprendre le bloc `@media print { html[data-theme="dark"] { … } }` : sans lui, imprimer en thème sombre pose de l'ambre sur blanc (244 écarts mesurés dans le projet de référence).

## Trier les élèves : nom, prénom, place, ordre de ramassage

Les quatre grilles (Élèves, Carnets, Ramassage, Synthèse) partagent un sélecteur « Trier »
(`_sortPickerHTML`) et un moteur commun (`_sortStudents`). Chaque écran y ajoute ses modes
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

Les cinq grilles à élèves en lignes (Élèves, Carnets, tableau d'un document, Ramassage,
Synthèse) défilent dans leur **propre cadre** (`.rel-wrap.frozen`), borné à la hauteur qui
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
- **Suppression d'une classe = `_purgeClassRefs(classId)`** : `S.releves[classId]`, `S.elections[classId]`, retrait de `doc.classIds` (et suppression du document s'il ne concerne plus aucune classe vivante), suppression de ses élèves.
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
| 6 | Onglet Délégués : arithmétique testée avant tout (21 tests), grille de dépouillement, graphique deux volets + mode projection, clôture / second tour / départage manuel, PV imprimable, `_delegueOf` dérivé | ✅ **fait** (2026-09-09, v0.6.0) — fenêtre flottante PiP non faite (optionnelle) |
| 7 | Onglet Synthèse (`_syntheseRow` pur, testé) + impressions par pages nommées (synthèse paysage, manquants et PV portrait), Ctrl+P contextuel | ✅ **fait** (2026-09-09, v0.7.0) |
| 8 | Sync auto (debounce 5 s, mutex, reprise), horloge vectorielle en service, conflits non destructifs + snooze archivé, backups à rotation par paliers, checkpoints nommés, IndexedDB (handle + copie du dernier fichier), jauge de capacité mesurée | ✅ **fait** (2026-09-09, v0.8.0) |
| 9 | Données de démo : `createDemo()` posée au 1er lancement (25 élèves, 8 relevés, 6 documents, 2 élections), `_demoBulletins` pur et testé, boutons « charger la démo » / « tout effacer » avec point nommé + undo | ✅ **fait** (2026-09-09, v0.9.0) |
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
9. **Données de démo** (`createDemo`) couvrant tout ce qui existe : une classe de 25 élèves fictifs, 8 relevés avec cumuls croissants, un `'A'`, un cumul décroissant à signaler, les trois documents modèles, des retours partiels, et une élection close à deux tours dont le premier n'a pourvu qu'un siège, plus une élection **en cours de dépouillement** (pour pouvoir régler la projection sans avoir à ressaisir des bulletins à chaque essai). **Intention documentaire : chaque fonctionnalité doit être rencontrable sans avoir à la créer.**
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

Notes et moyennes (c'est Plan de classe et Pronote), les plans de salle DESSINÉS (îlots, tablettes, cases vides), appel/absences, bulletins et remarques de bulletin, mentions de conseil de classe, élections autres que celle des délégués de la division (CVC, conseil d'administration, éco-délégués — le PP ne les organise pas), export XLSX/ODS (le CSV suffit à ce volume ; le module `_NotesExport` de la référence reste disponible si le besoin apparaît).

## Questions à poser à l'utilisateur avant de les décider seul

Aucune ne bloque le démarrage — les étapes 1 à 3 se font sans réponse — mais chacune change du code s'il faut y revenir après :

1. ~~**Plusieurs classes, ou une seule ?**~~ — **répondu le 2026-09-11 : une seule.** On est PP d'une classe ; le modèle reste multi-classes (une par année), une à la fois avec le sélecteur, et les grilles d'élèves ne connaissent que la classe courante (cf. table des arbitrages). *Le texte d'origine :* Le modèle est multi-classes (le PP peut suivre une classe par an, et les documents d'options observés couvrent 4 divisions). À confirmer : veut-il voir plusieurs classes en même temps, ou une seule à la fois avec un sélecteur ? *(Indice du 2026-09-09 : « on n'est PP que d'une seule » — une à la fois, avec le sélecteur.)*
2. ~~**Périodes**~~ — **répondu le 2026-09-09 : au choix**, réglage dans Données (cf. table des arbitrages).
3. ~~**Journal des contacts.**~~ — **répondu le 2026-09-09 : oui.** `stu.journal = [{ id, date, ts, type, texte }]`, types `appel · rencontre · courriel · mot · autre`. ⚠️ **Il ne REMPLACE pas `stu.remarque`** : les observations qui ne sont pas des contacts (« peu d'apprentissage des leçons ») n'ont pas de date et n'en veulent pas. Les deux cohabitent dans la même modale. Le dernier contact remonte sur le bouton 📋 de la liste (« ai-je déjà appelé, et quand ? » est la question qu'on se pose en parcourant), dans la Synthèse et sur son impression.
4. ~~**Date de naissance des élèves.**~~ — **répondu le 2026-09-09 : ajoutée** (`stu.naissance`, saisie à la main, reconnue à l'import CSV et repris de Plan de classe). Elle débloque le départage automatique par l'âge. ⚠️ **Donnée personnelle de plus** : à mentionner dans le texte RGPD, et le champ reste facultatif — l'app fonctionne sans, elle demande alors de trancher.
5. **Modalités exactes de son établissement** : uninominal ou plurinominal, suppléants élus avec les titulaires ou séparément, départage. Les défauts viennent de sa propre présentation, mais le règlement intérieur de l'établissement prime — à vérifier une fois avant la première élection réelle.
6. **Éco-délégués.** Beaucoup d'établissements en élisent aussi, souvent par le même PP et selon la même procédure. Un simple champ « type d'élection » suffirait ; ne rien construire avant de savoir si le besoin existe.
7. **Alerte d'échéance.** Un document a une `dateEcheance` : faut-il un signalement à l'ouverture (« 3 fiches d'orientation manquantes, échéance dans 2 jours ») ?
