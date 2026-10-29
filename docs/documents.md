# Documents et retours

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

### Documents — un même papier porte plusieurs réponses

Devoirs Faits : `suiviRetour: true` + un champ `choix` à trois options `OUI / NON / ULYSS`. ⚠️ **Trois, pas deux** (le tableur porte `ULYSS`, dispositif alternatif) : un booléen aurait été trop étroit. Orientation : plusieurs champs dont des champs **`par: 'prof'`** (« Avis PP option 1 »). ⚠️ Le compteur « réponses manquantes » ne compte que ce qu'on **attend des familles**, sinon le document reste incomplet tant que le PP n'a pas rendu son avis.

- **`rendu` et `reponses` sont deux axes indépendants** : papier rendu sans réponse cochée (illisible, à relancer), ou réponse connue avant le papier (dite à l'oral). Ne pas dériver l'un de l'autre.
- **Ordre des documents** réglé par la **poignée ⋮** (`docReorder`) ; flèches ↑ ↓ au CLAVIER sur la poignée focalisée (`docMove`) ; `Échap` annule le glisser.
  - ⚠️ **Ne rien déplacer dans le DOM pendant le glisser** : la poignée est DANS la ligne ; déplacer la ligne (`insertBefore`) reparente l'élément qui détient la capture du pointeur, les `pointermove` cessent et le glisser se fige après un saut. On DESSINE l'insertion (trait rouge) et on ne touche à l'ordre qu'au relâchement.
  - ⚠️ **Recalculer la cible sur le `pointerup`**, pas sur le dernier `pointermove` (geste rapide, stylet).
  - `touch-action: none` sur la poignée rend le glisser possible au DOIGT (sinon le navigateur lit un défilement) ; le glisser natif HTML5 (`draggable`) est écarté pour la même raison.
- ⚠️ `docReorder` **renumérote tous les `ord` avant de repositionner** (dupliqués après import, duplication, démo : réordonner des valeurs identiques ne changerait rien), puis **redistribue les mêmes places** entre les seuls documents affichés (archivés masqués et autres classes gardent la leur). Sémantique **retirer-puis-réinsérer**, pas échanger.
- **Dupliquer un document** : geste central de la rentrée suivante — mêmes champs et options, retours vides (miroir de `_evalDuplicate`). ⚠️ La copie reçoit la date de distribution du jour (`_dateParDefaut`, comme un document créé) : sans date, elle passerait pour distribuée et réclamerait ses retours à toute la classe ; les anciens documents sans date restent « distribués ».
- ⚠️ **Un papier à distribution À VENIR n'est jamais « à rendre » ni « pas rendu »** (`_papierDistribue`), nulle part : liste, fenêtre des papiers, carte de chaleur (case neutre, compte), faits et carte Papiers de la fiche (« pas encore distribué »), fiche imprimée, synthèse de période ; au ramassage il n'est pas présélectionné « incomplet » (choisissable à la main).
- ⚠️ **Options d'un champ** (`_champParseOptions` / `_optProche`) : une faute de frappe ne porte jamais sur un chiffre (« Option 1 » → « Option 2 »), une lettre isolée (« Groupe A » → « B ») ni un préfixe de sens (« Favorable » → « Défavorable ») ; un libellé retrouvé EXACTEMENT garde son option avant qu'un autre ne la reprenne par son id ; et `docModalOk` AVERTIT (`_uiConfirm`, `_docReponsesPerdues`) quand une option qui porte des réponses disparaît. Une réponse orpheline n'est jamais affichée (`_ficheDocuments` filtre par `_repIds`).
- Les **modèles** de la démo couvrent les trois formes réelles : Devoirs Faits (choix à 3), fiche de renseignement (retour seul, aucun champ), fiche d'orientation (choix multiple d'options + avis PP).
- ⚠️ **Seule une option EXISTANTE du champ est une réponse** (`_repIds` / `_hasReponse`) : une réponse sur une option retirée ou renommée est orpheline (invisible, « sans réponse » comme au bilan imprimé), donc relancée. Les deux formes (chaîne, tableau) sont lues quel que soit le type du champ (un champ passé de choix unique à multiple, ou l'inverse, garde ses réponses d'avant). `_champParseOptions` : à nombre d'options égal, une option dont le libellé a disparu et qui ressemble de près (≥ 4 lettres, ≤ 1 d'écart par 4) à celui de la même position garde son id — corriger « LATTIN » en « LATIN » ne perd aucune réponse ; remplacer une option par une autre, si.

### 3. 📄 Documents (Retours)

Liste des documents (compteurs `rendus / attendus` et `réponses manquantes`), puis un tableau par document : élèves × (`Rendu` · `Date` · un groupe de colonnes par champ). Boutons nommés : Retours · Réglages · Dupliquer · Archiver · Supprimer. Bouton « liste des manquants » (modale 📋 : à copier ou imprimer pour la vie scolaire).
- ⚠️ **Un document ne se « ramasse » pas toujours** : très souvent on VÉRIFIE qu'une signature est là, carnet par carnet, en passant dans les rangs. Le tableau d'un document porte donc le menu **Ordre de passage** (place, ordre de ramassage compris).

#### 🧺 Ramassage

Troisième vue de l'onglet : une grille **élèves × documents** où l'on coche les retours de plusieurs documents en une passe (le geste réel : trois papiers à récupérer en même temps). Colonnes choisies à la volée, date du ramassage réglable (on saisit souvent le soir), compteurs vivants par colonne et par élève, « tout cocher » par colonne, flèches pour descendre une colonne.
- ⚠️ **Une case a TROIS états** : rendu, pas rendu, **sans objet** (l'élève arrivé en novembre n'a jamais eu la fiche de rentrée). Un tiret, pas une case vide : confondre les deux, c'est réclamer un papier à quelqu'un qui ne l'a jamais reçu. `ramSetRendu` **refuse** d'écrire pour un élève non attendu.
- ⚠️ **Une ligne par élève DE LA CLASSE**, pas par élève attendu sur le document : `_ramRows` est **bornée au roster de `classId`**. `_docExpected` couvre TOUTES les classes d'un document ; un papier partagé avec une autre division ferait entrer ses élèves dans la grille et « tout cocher » leur attribuerait un retour. Garde unique, à la source (les impressions n'en ajoutent pas de seconde).
- Élèves **partis** masqués par défaut (on ne ramasse rien auprès d'eux) mais comptés dans les manquants du document.
- ⚠️ **Les compteurs du ramassage aussi** : `_ramStats(doc, classId)` (rendus / attendus, « à lire », présélection « incomplet », état « Tous / Aucun », toast de `ramColonne`) se calcule sur `_ramRows`, pas sur `_docStats` (toutes les classes du document) ; les élèves d'une autre division ne sont jamais « partis ».
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
