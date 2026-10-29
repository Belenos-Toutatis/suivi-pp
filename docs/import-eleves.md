# Import des élèves (CSV, Plan de classe)

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Import des élèves — deux voies

### 1. CSV / tableur (voie principale)

Module repris intégralement. À adapter :
- **Retirer** de `_IMP_FIELDS` ce qui n'a pas de sens ici (rien d'urgent : tous les champs importés existent dans `stu`).
- **Retirer** le volet « salle des nouvelles classes » (`_impRoomChoiceHTML`, `_impDefaultRoomChoice`, `_impSetRoom`) : pas de salle à l'import.
- **Garder** le panneau « Codes de groupes rencontrés » : il transforme `4B-LATIN` en tag `LATIN`.
- **Garder** le décodage **UTF-8 strict puis repli Windows-1252** (`_impFileSelected`) : les exports Pronote/SIECLE sont en 1252, « Léa » devient « LÃ©a » sans ce repli.
- **Garder** la création des classes inconnues (`_impClassIdFromLabel` : « 5ème C » → `5C`, libellé complet conservé comme nom).
  - ⚠️ « 3E » en MAJUSCULE est la classe E du niveau 3 (garde sa lettre) ; seul « 3e » minuscule, « 3ème », « 3EME » seuls donnent le niveau (décidé sur le libellé d'origine, avant la mise en majuscules).
- ⚠️ **Cellule CSV multiligne** (`_impSplitRecords`) : un enregistrement qui s'étend sur plusieurs lignes n'est gardé que s'il est bien formé (même nombre de champs que l'en-tête, guillemet fermant suivi d'un séparateur ou de la fin, `_impRecordBienForme`) ; sinon retour aux lignes physiques (un guillemet perdu n'avale plus les lignes suivantes).
  - Un niveau SEUL (« 3ème », « 5e ») donne `3`, `5`, pas `3ME`. Nom complet « MARTIN Noé (M.) » : la civilité entre parenthèses est lue (`_impSplitFullName`), jamais rangée dans le nom. Doublons : trait d'union = espace, espaces repliés (comme `_moyNameKey`). Dates impossibles (« 31/02/2013 ») = non reconnues (`_ymdValid`) ; un nombre de SÉRIE de tableur n'est converti que dans une colonne date (`_impNormDate(v, true)`). Une cellule entre guillemets peut contenir un retour à la ligne (`_impSplitRecords`, texte libre exclu).

### 2. Export JSON de Plan de classe

`importFromPlanDeClasse(json)` lit un `plan-classe-*.json`, ne prend que `classes` (id, nom, année, roster) et `eleves` (identité, civilité, groupe, tags, aménagements, dates d'arrivée/départ) et **ignore tout le reste** (salles, sièges, tablettes, évaluations, appels…).

- ⚠️ **Lecture seule et à sens unique** : aucune écriture vers Plan de classe, aucun couplage de format (les deux apps évoluent séparément). Passer par une **liste blanche explicite** des champs, pas par une copie d'objet.
- ⚠️ **Les ids d'élèves sont conservés** : c'est ce qui permet de réimporter sans doublons et de reconnaître un élève présent. La détection de doublon garde le filet nom+prénom+classe (sans accents ni casse) du module CSV.
  - ⚠️ Un élève retrouvé par NOM a un autre id local : ses places suivent la correspondance id source → id local (`idMap`). L'id d'une classe source en minuscules devient celui qu'`_createClassBare` crée (`_pdcLocalCid`) — élèves, rapprochement et `S.cur` inclus. Dates de la source validées par `_ymdValid` ; ids de tags jamais pris pour des clés d'objet (`tagMap` sans prototype, `hasOwnProperty`).
- Les tags de Plan de classe (`S.tags`, `{id, abbr, name, color}`) se reprennent avec `stu.tags`, sinon ils arrivent sans libellé.
- **Salles, places et patterns** : liste blanche `{nom, rows, cols, collectPatterns}` — ni cases vides, ni îlots, ni emplois du temps, ni tablettes (un champ repris « au cas où » est un champ dont plus personne ne sait s'il est à jour).
  - ⚠️ **Ids de salle PRÉFIXÉS `pdc_`** : Plan de classe les nomme `s1`, `s2` (compteurs locaux, sans unicité entre fichiers) ; sans préfixe, la « Salle 102 » d'un collègue écraserait la nôtre.
  - ⚠️ Id de classe ou d'élève source = propriété d'`Object.prototype` (« toString », « valueOf ») : les tests de « déjà connu » portent sur les entrées PROPRES (`_pdcHas`), comme `getCls` / `_withStudent`.
  - ⚠️ Le placement vit dans `cls.rooms[salleId].seating`. `cls.seating`, là-bas, est un **accesseur non énumérable** redirigé vers la salle active : absent du JSON.
  - Une place occupée par un élève non repris est **écartée** (sinon `_auditState` signale un élève fantôme assis).
  - Réimporter **met à jour** : salle homonyme et placement sont remplacés, pas empilés. C'est LE chemin de mise à jour des places (💾 Données et réglages → 🪑 Depuis Plan de classe) ; l'éditeur de salles permet aussi de corriger sur place, et l'import écrase alors la correction — l'écran le dit.
  - ⚠️ **Une case VIDE dans Plan de classe ne vide PAS celle d'ici** (défaut v1.41.1 : la liste blanche écrivait `null` quand la source n'avait pas la valeur, effaçant des naissances saisies à la main). Pour `naissance`, `arrivalDate`, `departureDate` et `civilite` : valeur de la source si elle existe, sinon celle d'ici est gardée et comptée (`stats.gardes`, dit au compte rendu). Groupe, options et aménagements restent RÉÉCRITS (documenté, l'écran le dit).
  - **Un point nommé** (`avant-import-plan-de-classe`) est écrit avant chaque import quand un dossier de sync est choisi ; s'il échoue, rien n'est importé.
  - **Réparer** : 💾 Données → *🩹 Récupérer des dates…* relit une ancienne sauvegarde (export, `suivi-pp-bk-*`, point nommé) et ne remplit QUE les champs vides aujourd'hui (`_recupChamps`, pur : élève par id, sinon classe + nom + prénom sans accents), après confirmation listant ce qui sera rempli ; un cran d'undo.
  - ⚠️ L'écran de choix **annonce le placement AVANT l'import** (« 🪑 25 places · 1 ordre de ramassage » ou « aucun placement ») et le compte rendu le confirme ; sans ce repère, un export sans placement donne un import qui ne change rien et on cherche pourquoi.
