# Avis des collègues, ton des avis, bulletins, vers MBN

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

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
  - ⚠️ **Un titre porté par une colonne n'est l'alias d'aucune autre** (titres échangés, ancien titre repris par une colonne neuve) : `avisColonnesSet` le retire de tous les `alias`, et `_avisLire` cherche les TITRES avant les alias, sans jamais attribuer un même en-tête à deux clés.
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
- **Signature HTML de la messagerie** (`S.prefs.avisSignatureHtml`) : REMPLACE la partie signature — telle quelle dans le riche, par `_htmlTexte` dans le brut. ⚠️ Elle finit dans `innerHTML` et dans un courriel : **filtrée par `_htmlSur`** (pur, sans DOMParser) à l'enregistrement ET au rendu — liste blanche de balises/attributs, contenu script/style/svg retiré, style (`_htmlSurStyle`) refusé en bloc s'il contient une entité quelconque (`&` suivi d'une lettre ou de `#` : « url&lpar; ») une fois décodés, en une passe, les seuls guillemets, apostrophes et `&amp;` (`&quot;`, `&#34;`, `&#39;`…), une barre oblique inverse, `url`, `image` (image-set, list-style-image), `src`, `expression`, `javascript`, `@import`, `behavior`, `binding` — vérifié dans Chrome : aucune requête ne part, liens https/mailto seulement, AUCUNE image (traceur, CSP), `position` seulement `static` ou `relative` (fixed / sticky recouvriraient l'app, absolute sortirait de l'aperçu), commentaires CSS retirés AVANT les contrôles (« position:/**/fixed »), balises **équilibrées** (une table ouverte avalerait la modale).
  - ⚠️ **IDEMPOTENT** (filtrer deux fois = filtrer une fois, testé sur des signatures Outlook, Word, Thunderbird, Gmail, Chrome) : la signature filtrée à l'enregistrement est refiltrée au rendu, et le filtre écrit lui-même les guillemets d'un style en `&quot;` — refuser `&quot;` effaçait toute police entre guillemets.
  - ⚠️ La signature réelle de l'utilisateur ne va ni dans le code ni dans les tests (dépôt public) ; les tests en utilisent une inventée.
  - ⚠️ L'aperçu est sur une surface **courriel blanche dans les deux thèmes** (`--mail-bg/-fg/-link/-rule`, mêmes valeurs aux trois endroits) : une signature collée porte ses propres encres sombres.

### Disciplines et matières

- **Disciplines** (`S.disciplines`, `_disciplinesSeed`, comme les instances : d'office décochables, pas supprimables) : allemand (ALLEMAND et ALLEMAND BILINGUE s'y rangent, la LCE non — l'app demande ; un « Allemand » créé à la main est gardé sans doublon), anglais, arts plastiques, éducation musicale, EPS, enseignement des religions, français, histoire-géographie, mathématiques, physique-chimie, SVT, technologie. Réglables dans 💾 Données (nom, nom d'onglet ≤ 31 caractères sans `[]*?:/\`, actif), complétables (Latin…).
- **Code d'option** : `S.disciplines[did].code` (absent = toute la classe suit ; plusieurs codes par virgules, rangés par `_discCodesTexte` : majuscules, sans doublon, six au plus), colonne *Option (code)* de Données (`datalist#disc-codes` ; « n élèves en 5e C » ou « ⚠ aucun élève »). `_discSuit(did, sid)` : l'élève porte une option dont le CODE ou le NOM (normalisés) est l'un des codes. Effets : l'onglet de la feuille ne liste que ces élèves (`_avisFeuilles`) ; une discipline non suivie n'est ni « sans réponse » ni comptée (résumé, lecture, fiche) ; case « — » dans la grille « Qui a écrit sur qui » (légende *non concerné (option)*) et la carte de chaleur ; dans 📋 Suivis la matière part avec ses `codes` (`_suivisCommun`) et le pinceau de l'emploi du temps prend d'office le groupe de l'option (cf. `fiches-suivi/CLAUDE.md`). ⚠️ Un avis déjà écrit sur un élève qui ne suit pas la discipline reste compté et affiché. Démo : *Latin*, code LATIN, deux avis.
- **Domaines et couleurs d'onglets** : `DOMAINES` (langues bleu · lettres et humanités brique · sciences vert · arts violet · EPS orange · autre gris), `S.disciplines[did].domaine` (d'office `DISCIPLINES_DOMAINE`, réglable ; ajoutée → « autre »), `_discCouleur` (teinte du domaine éclaircie selon le rang). Catalogue et onglets **rangés par domaine** (`_disciplinesAll`, `_avisDidsOrdonnes`). Dans l'.ods la couleur s'écrit deux fois : `tableooo:tab-color` (style de la table) et `TabColor` (`settings.xml`). ⚠️ Vérifier sous LibreOffice/Xvfb (`SAL_USE_VCLPLUGIN=gen`) avec `env -u WAYLAND_DISPLAY`, sinon il s'ouvre sur l'écran de l'utilisateur.
- **Matières des moyennes → disciplines** : `_matiereDisc(mid)` — `m.disc` posé à la main (un id, ou `''` = ignorée), sinon motifs de `DISCIPLINES_DEFAUT` sur le nom normalisé (relevés sur de vrais exports : « ÉD.PHYSIQUE & SPORT. », « SCIENCES VIE & TERRE », « SVT BILINGUE », « ANGLAIS LV2 », « HISTOIRE-GEOGRAPHIE EMC »), sinon discipline ajoutée de même nom. ⚠️ **La LCE n'est jamais rattachée par un motif** (« LCE ALLEMAND », « LANGU.CULT EU ALLEM ») : seule une discipline ajoutée de même nom la reconnaît. ⚠️ L'EPS se teste AVANT la physique-chimie (« ÉD. PHYSIQUE » contient PHYSIQUE). ⚠️ **Rien n'est deviné** (DNL, histoire des arts, association sportive, allemand, LCE, espagnol…) : la modale **pose la question** (« à rattacher », nouvelle discipline, ignorer) ; Données corrige tout.
- **Professeur** de l'onglet : DERNIER import de moyennes de ses matières (`_discProfsAuto` — LV1 et LV2 réunies, co-enseignants tous, sans doublon) ; ⚠️ **un nom TAPÉ passe avant** (`S.disciplines[did].profs`, champ dans la modale et dans Données) ; vidé, ou égal à celui des moyennes, il redevient automatique.

### Campagne et revue avant/après

- **Campagne** (`S.avis[classId][campId]`) : `{ id, date, cible, label, fichier, lien, lu, disciplines: [{ id, nom, onglet, profs }] (onglets de LA feuille, figés), avis: { sid: { did: { travail, participation, comportement } } }, cibles: [sid], msg }`. ⚠️ **`cible` = la fin de la période visée**, choisie à la création (le conseil du S1 préparé en février reste « pour le S1 »). Élèves de la feuille : **présents pendant la période**, **ordre alphabétique**.
- ⚠️ **RIEN n'est repris d'office** (arbitré : montrer avant-après, laisser cocher, pour ne pas écraser par accident). `_avisChangements` liste chaque case qui diffère (élève × discipline × critère : `ajout` · `modif` · `suppr`), la **revue** (`_avisRevueHTML`) montre « dans l'app » / « dans la feuille », `_avisAvecChoix` applique les seuls choisis. Cochés d'office (`_avisCochesDefaut`) : ajouts et modifications, **jamais un effacement**. Trois moments : **relire** (non coché = reste dans la feuille, reproposé), **mettre à jour** la feuille (non coché = remplacé par la version de l'app, l'écran le dit), **nouvelle feuille dans un fichier qui contient déjà des avis** (feuille du S1 réutilisée au S2) : **rien n'est coché**, ce qui n'est pas repris est effacé du fichier.

### Lecture et écriture

- **Lecture** (`_avisLire`, pur) : onglet par son nom (ou, renommé, par la discipline en titre — celle au nom le PLUS LONG qui convient : « Anglais euro — Mme Z » n'est pas Anglais ; deux au même nom, onglet rapporté inconnu), colonnes par leur **en-tête** (un collègue peut en déplacer une), élève par la clé de nom des moyennes. ⚠️ **Rien n'est rangé au hasard** : homonymes parfaits, nom retouché, onglet inconnu sont **rapportés**. ⚠️ **Plusieurs lignes remplies du MÊME élève dans un onglet** (`lec.repetes`, jamais « la dernière gagne ») : si elles se complètent (une colonne n'a qu'un texte, ou le même), réunies colonne par colonne ; si une colonne porte deux textes différents, RIEN n'est rangé pour cet élève dans cet onglet ni proposé (`_avisChangements` le saute), les lignes sont recopiées à la mise à jour (sauf celle identique à ce que l'app écrit) ; dit par la revue, le toast et le panneau (`_avisRepetesTexte`). **Fusion** (`_avisChangements` ne compare que les onglets LUS) : un onglet lu fait foi (un avis effacé par son auteur disparaît), un onglet ABSENT du fichier garde ses avis (une mauvaise feuille n'efface rien). Un undo seulement si quelque chose change. Relecture silencieuse à l'ouverture si la permission est restée accordée — elle n'ouvre que la revue.
- **Écriture** (`_avisEcrireFeuille` → `_avisEcrireMaintenant`) : relit d'abord le fichier ; s'il diffère de l'app, la revue passe avant ; un fichier qui contient AUTRE chose qu'une feuille d'avis n'est écrasé qu'après confirmation. ⚠️ **Rien ne s'efface en silence** (arbitré) : `_avisFeuillesGardees` recopie tel quel ce que l'app ne reconnaît pas — onglets inconnus (ajoutés, en-têtes modifiés, discipline retirée de la feuille ; renommés « (2) » si le nom est pris) à la suite, lignes d'élèves non reconnues (`lec.lignes`, remises dans l'ordre des colonnes) au bout de leur onglet — et le toast le dit. ⚠️ **Sauf pour une NOUVELLE feuille** (`nouvelle`, fichier d'une autre période) : rien n'est recopié, ce qui n'est pas repris est effacé, et la revue comme le toast le disent (`_avisNonLuTexte`). ⚠️ Mettre à jour pendant qu'un collègue écrit peut créer un conflit dans le Nuage (la modale prévient).

### Module .ods et police Andika incluse

Module (`_zipStore`, `_zipRead`, `_odsBuild`, `_odsRead`) : ZIP « stored » à l'écriture (le `mimetype` premier, sans champ extra : règle ODF), deflate à la lecture par `DecompressionStream('deflate-raw')` (ajouté au bac à sable du harnais), parseur XML maison (pas de DOMParser dans le harnais).

- ⚠️ `_odsEsc` retire, outre les caractères de contrôle, **U+FFFE et U+FFFF** (interdits en XML 1.0 : LibreOffice refusait le fichier entier).
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

### 🎨 Le ton des avis (v1.74.0)

Demandé le 2026-10-23 : *« surligner les parties des avis des collègues selon que c'est positif ou négatif, pour
repérer plus facilement quand on examine soi-même ; un code couleur selon l'intensité — dans une même remarque, il peut
y avoir du négatif et du positif »*. Arbitré : **Claude découpe et juge, par l'API** (plutôt qu'une liste de mots,
trop grossière pour « pas sérieux », « peu d'efforts »), et *« il faut un moyen de surligner à la main ou de corriger ce
qui a été mal interprété ou oublié »*. Partout : fiche (tableau de bord, chronologie, faits et rédaction), lecture des
avis, fenêtre de bilan, feuilles imprimées (synthèse de période et fiche). Bloc « 🎨 LE TON DES AVIS » du script.

- **Six tons** (`TONS`) : 3 très positif, 2 positif, 1 plutôt positif, −1 plutôt négatif, −2 négatif, −3 très négatif ;
  un fond par ton (`--ton-p1…3`, `--ton-n1…3`, encre `--ton-fg`, aux trois endroits) et un **trait dessous — plein
  pour le positif, tireté pour le négatif, plus épais avec l'intensité** (`--ton-p-line`, `--ton-n-line`) : le sens se
  lit sans les couleurs (papier en noir et blanc, daltonisme). Sur le papier, les fonds s'impriment
  (`print-color-adjust`), une légende accompagne les avis.
- **Rangé sur la feuille** : `camp.tons[sid][did][colonne] = { h, seg: [{ d, f, v, m? }] }` (positions dans le texte,
  ton, `m` = corrigé à la main). ⚠️ `h` = l'empreinte du texte (`_tonHash`) : un avis réécrit par son auteur (relecture de
  la feuille) n'a plus de ton et redevient « à analyser », plutôt qu'un surlignage décalé sur un autre texte
  (`_tonSegs` vérifie aussi chaque passage). Purgé avec l'élève (`_purgeStudentRefs`) ; une section illisible est
  écartée au chargement.
- **Le rendu** (`_tonHTML`, un seul pour tous les endroits) : `<span class="av-tx" data-ton-ref="cid|feuille|sid|did|
  colonne">` dont le contenu est EXACTEMENT le texte (la correction mesure la sélection en caractères) ; `o.esc` garde
  les mots surlignés de la fiche ; `o.papier` : sans de quoi corriger. *Afficher les couleurs* (onglet Avis) : réglage du
  poste (`suiviPP_tonsVus`), écran et papier.
- **L'analyse** : bloc *🎨 Le ton des avis* du panneau d'une feuille (onglet Avis) — combien d'avis surlignés, à
  analyser, corrigés à la main ; *🎨 Surligner avec Claude (n avis)…* (seulement les avis sans ton ou changés), *↺ Tout
  refaire…*. `_tonsPreparer` : les textes pseudonymisés (le moteur des synthèses, `_iaPseudo` avec tous les élèves en
  `[Camarade n]`), **mélangés**, sans élève ni discipline — `{ id, rubrique, texte }` seulement. Même fenêtre de dernière
  vérification (`miaenv`, sorte `tons`), avec en plus **« À vérifier »** : un mot à majuscule que l'app ne connaît pas,
  *masquer* (`[Nom n]`) ou *laisser* — le texte change, la case « J'ai relu » se décoche. Forme imposée (`IA_SCHEMA_TONS` :
  `{ resultats: [{ id, passages: [{ extrait, ton }] }] }`).
- **La réponse** (`_tonsAppliquer`, un cran d'undo) : chaque extrait, noms remis (`_iaRestaure`), est retrouvé dans le
  texte d'origine (`_tonTrouve` : exact, sinon souple sur les espaces, apostrophes et casse) ; un extrait introuvable est
  compté et dit ; ⚠️ **les passages corrigés à la main sont gardés**, l'analyse ne s'écrit pas dessus ; un avis réécrit
  entre l'envoi et la réponse est laissé de côté.
- **À la main** : sélectionner un passage d'un avis (souris ou doigt) — ou cliquer un passage coloré — ouvre la palette
  `#ton-pal` (`_tonSurSelection` sur `mouseup` / `touchend`) : six tons, *Neutre* / *Retirer* ; `tonPoserUI` (un cran
  d'undo, `_tonAvecPassage` coupe ce que le passage recouvre). Échap ferme la palette d'abord. ⚠️ La fenêtre de bilan
  n'est PAS dans `_MODAL_RERENDER` (règle des fenêtres de formulaire, testée) : après Ctrl+Z, ses avis se redessinent au
  prochain élève.
- Démo : sept avis surlignés sur la feuille du conseil du S1 (positif et négatif dans le même avis, un passage corrigé à
  la main), les autres « à analyser ».
- Tests : `test/tons.test.js` (découpe, rendu échappé et texte intact, empreinte, démo, ce qui part sans aucun nom,
  réponse rangée avec un extrait perdu et un passage à la main gardé, Ctrl+Z, palette, purge). Vérifié dans le navigateur :
  sélection réelle à la souris puis palette, clic sur un passage puis *Retirer*, Ctrl+Z, analyse sur un flux simulé ;
  audit lecture, palette, onglet, fiche (trois vues), deux thèmes, et fiche et synthèse imprimées : 0 défaut.
- ⚠️ **Arbitré le 2026-10-23 : pas d'appréciation de bulletin par l'API.** L'utilisateur les fignole dans une
  conversation avec Claude, par allers-retours, ce qu'un envoi unique ne permet pas. Proposés et refusés pour l'instant
  dans la même réponse : reformuler un bilan, brouillon de message aux familles, compte rendu de réunion. Écartés par
  principe : un repérage automatique d'« élèves à risque », la lecture des imports par une IA.
- 🗓 **Projet en attente (2026-10-23) : les bulletins.** Importer les bulletins de la période — chaque appréciation d'un
  collègue devient un avis de la discipline, sur une feuille d'avis « Appréciation du bulletin » (source : le bulletin),
  donc lue, surlignée et imprimée comme les autres ; exporter le JSON de toute la classe pour le projet de conversation
  de l'utilisateur (`directive.md`, `exemple de remarques.md`) ; la correspondance repère → élève RESTE dans l'app
  (fenêtre détachée à côté du chat, recherche par repère, jamais copiable) ; réimporter les appréciations retravaillées.
  ⚠️ **Arbitré par l'utilisateur : le bilan du conseil EST l'appréciation du bulletin** (*« sinon le bilan de la période
  ne servira à rien »*) — le réimport écrit dans le bilan du conseil de la période (revue avant / après, rien
  d'écrasé sans être coché, un cran d'undo), avec la limite de caractères du bulletin. En attente : le format des
  bulletins (à décrire par *🔍 Décrire un fichier sans ses données*) et la limite de caractères.
- ✅ Une vraie analyse par Claude vérifiée par l'utilisateur le 2026-10-23. ⚠️ Non vérifié : la sélection au doigt sur une tablette.

### 📄 Les bulletins (v1.75.0)

Demandé le 2026-10-23 : *« que Suivi PP puisse lui-même extraire les informations utiles du bulletin : chaque remarque
d'un collègue deviendrait un avis des collègues pour le bilan de la période, ce qui permettrait de faire l'analyse des
points positifs et négatifs avec les couleurs »*. **Un seul PDF pour la classe, exporté de MBN** ; les moyennes du
bulletin sont **ignorées** (arbitré : elles viennent de leur import) ; limite de l'appréciation générale : **600
caractères**. Bloc « 📄 LES BULLETINS » du script, fenêtre `mbull` (`openBullImport` : onglet Avis — *📄 Importer les
bulletins…* sous *＋ Nouvelle feuille d'avis* —, 💾 Données ▸ Importer, et *📥 Réimporter les bulletins…* du panneau).

- **Mise en page** (relevée par *🔍 Décrire un fichier sans ses données*, aucune donnée vue) : chaque page s'ouvre sur
  « NOM Prénom (5C) - Premier semestre (2025 - 2026) » (8 pt, à 8 mm) — **c'est lui qui dit l'élève**, d'une page à
  l'autre (`_bullEntete`) ; une page « Année scolaire » / « Suivi des acquis scolaires » commence un bulletin. Le
  tableau, sous « Acquisitions, progrès et difficultés éventuelles » : la matière en CAPITALES à 9 mm (8 pt), le
  professeur et sa classe dessous (6 pt, parfois sur deux lignes : « Mme A, Mme B, Mme » / « C (5C) »), l'appréciation
  à 95 mm (7 pt) sur plusieurs lignes, qui peut **continuer en haut de la page suivante** ; « Non renseigné » = vide ;
  « Pôle… » et « Autres matières » ne sont pas des matières ; le programme (52 mm) et les moyennes (au-delà de 175 mm)
  sont ignorés ; « Communication avec la famille » finit le tableau.
- **Lecture** (`_bullLire`, pur, sur `_recapPages`) : ⚠️ le nom de la matière = les mots en CAPITALES du début de la
  ligne (une case du programme collée à la ligne reste dehors) ; une moyenne collée au bout d'une ligne d'appréciation
  est retirée. **Deux exemplaires identiques** du même bulletin (un par responsable légal) sont fondus (`doublons`) ;
  deux bulletins DIFFÉRENTS sous le même nom restent deux (homonymes : le rattachement les demande).
- **Période** (`_bullPeriode`) : « Premier / Second semestre », « Premier / Deuxième / Troisième trimestre » → la
  période de l'app, réglable dans la fenêtre ; un découpage qui ne concorde pas, ou une autre année, est signalé.
- **La revue** (`_bullBilan`, pur sauf la lecture de S) : l'élève par son nom (`_mbnRapprocher`, rien de deviné,
  rattachement manuel, « ignorer » d'office) ; la matière par sa discipline (`_ficheMatDisc` — le MÊME réglage que les
  fiches de suivi, `prefs.matieresFiche` : une matière rattachée dans la fenêtre l'est pour les prochains imports et se
  corrige dans 💾 Données) ; ⚠️ **deux matières d'une discipline** (ALLEMAND, ALLEMAND BILINGUE) = UN avis, chaque
  appréciation sous son nom (« Allemand bilingue : … ») ; nouvelles, modifiées (avant / après, à cocher), déjà là,
  « Non renseigné » laissées de côté ; les élèves de la classe absents du fichier sont nommés.
- **Rangé** (`_bullAppliquer`, un cran d'undo) : UNE feuille d'avis par période, `camp.source = 'bulletin'`, colonne
  « Appréciation » (modèle *Appréciation de bulletin*), objectif **conseil** ; le professeur de chaque discipline vient du
  bulletin. Réimporter met à jour la même feuille, **ne retire rien**. Tout ce qui existe pour les avis s'applique :
  fiche, lecture des avis, fenêtre de bilan, synthèse imprimée, **🎨 le ton des avis** (un texte réimporté changé perd
  ses couleurs, cf. l'empreinte). Panneau propre dans l'onglet Avis (`_bullCampHTML` : pas de partage, de message ni de
  relecture du Nuage — `avisRelire` l'écarte) ; titre « 📄 Bulletin · S1 ».
- **Les synthèses par une IA** reçoivent **toutes les feuilles du moment** (`_avisFeuillesDuMoment`) : « Appréciations
  des professeurs au bulletin (…) » ET « Avis des collègues (…) ».
- Disciplines : « ENS.RELIG.CATHOLIQUE » (l'intitulé des bulletins) reconnu comme l'enseignement des religions.
- Tests : `test/bulletins.test.js` sur `test/fixtures/bulletin-mbn-invente.pdf` (`scripts/gen_bulletin_fixture.py`, un
  PDF minimal écrit à la main — pas de bibliothèque : noms inventés). Vérifié dans le navigateur : la fixture lue,
  revue, rangée, panneau et lecture ; audit deux thèmes : 0 défaut. ⚠️ Non vérifié : le vrai PDF de l'utilisateur.

#### Le retour : l'appréciation retravaillée dans le bilan du conseil (v1.76.0)

L'utilisateur retravaille ses appréciations dans une conversation (son projet claude.ai : `directive.md`,
`exemple de remarques.md`), à partir du JSON de *Toute la classe d'un coup* ; ⚠️ arbitré : **le bilan du conseil EST
l'appréciation du bulletin** (*« sinon le bilan de la période ne servira à rien »*).
- **La limite** : `S.prefs.appreciationMax` (600 d'office, 100 à 5 000, `setPref` la valide ; 💾 Données ▸ Année et
  périodes), `_appreciationMax()`. **Un compteur** sous le bilan d'un CONSEIL, dans la fiche (`fi-bil-n`, les trois vues)
  et la fenêtre de bilan (`mbilan-n`, suit le moment choisi) : « 523 / 600 caractères », en alerte au-delà
  (`_bilanCompte`, `.bil-n.trop`).
- **Ce qui part** : un bloc de plus, **« Mon bilan de ce moment »** (`brouillon`, coché d'office) — le bilan déjà écrit
  pour ce moment, « à retravailler (c'est l'appréciation du bulletin : 600 caractères au plus) » pour un conseil.
- **Le retour** (fenêtre `miac`, étape 3) : **« Ranger dans »** (`miac-dest`, `_iaLotDest`) — *le bilan de ce moment* (d'office
  pour un conseil) ou *la synthèse IA* (d'office ailleurs, le comportement d'avant). Vers le bilan, la revue dit « aucun
  bilan encore » / « remplace le bilan écrit » (le **bilan écrit est montré**, `avantTexte`) / « déjà le bilan » ; ⚠️ un
  texte **trop long pour le bulletin est décoché d'office** (`_iaLotCoche`, `trop`) — à raccourcir dans la conversation,
  ou à cocher quand même. Rangé : `bilanSet` (le même bilan, sa date gardée) ou `bilanAdd` (daté du moment), **un cran
  d'undo** ; la synthèse IA n'est pas touchée. La réponse peut porter « appreciation » au lieu de « synthese » (clés
  tolérées de `_iaLotLire`).
- **Savoir de qui on parle** : *🖥 Fenêtre des correspondances* (dans le titre de l'étape 2 des fenêtres `miac` et `mias`
  depuis la v1.76.1 — l'utilisateur ne la trouvait pas dans le volet replié —, et dans le volet ; `iaCorrFenetreUI`) — une fenêtre ordinaire à poser à côté de la conversation : repère en grand, photo (ou initiales),
  nom ; **recherche par numéro** ; un clic ouvre la fiche dans Suivi PP. ⚠️ **Rien à copier** (aucun bouton, texte non
  sélectionnable) : la table ne doit jamais finir collée dans la conversation. Elle suit le lot ouvert
  (`_iaCorrWinMaj`, appelée par `_iaCorrRender`), se ferme avec la page ; bloquée par le navigateur, elle le dit (le volet
  reste). **Dans la fiche**, sous la rédaction : « 🤖 Dans la conversation : [Élève 14] » (`_iaRepereHTML`, le dernier
  lot de ce moment, gardé sur le poste).
- Tests : `test/bulletin-retour.test.js` ; tests adaptés (le brouillon dans les cases d'office ; le test de la synthèse
  IA d'un conseil range explicitement en synthèse). Vérifié dans le navigateur : revue vers le bilan (trop long décoché),
  fenêtre des correspondances (dans un cadre : le navigateur de test bloque les fenêtres), recherche, clic → la bonne
  fiche ; audit fiche, fenêtre de bilan, `miac`, Données, deux thèmes : 0 défaut. ✅ La vraie fenêtre détachée,
  vérifiée par l'utilisateur le 2026-10-23.

#### Vers MBN : le bilan du conseil devient l'appréciation générale (v1.77.0)

Demandé le 2026-10-23 : *« comment Suivi PP peut saisir les remarques dans les bulletins sans que je t'y donne accès —
ça doit être similaire aux remarques disciplinaires »*. Réponse de la session Plan de classe : son favori
**« MBN · Bulletin »** (bloc `mbn-bul-src` de `plan de classe.html`), **COPIÉ et adapté** (bloc
`<script type="text/plain" id="mbn-cc-src">`, devant le bloc d'octets de la fiche de suivi autonome). ⚠️ **Suivi PP ne
parle jamais à MBN, et Claude n'y a aucun accès** : l'utilisateur copie un JSON (presse-papiers de ce poste), ouvre le
conseil de classe dans SA session MBN, clique sur le favori, colle, relit l'aperçu, ▶ Remplir.
- **La page** (rapports anonymisés de l'outil d'analyse de Plan de classe, fournis par l'utilisateur) : tableau YUI des
  élèves dans `#js-ongletCCEleves`, « NOM Prénom » dans `.bulletin-notes-eleve` (attribut `title`), cellule
  `td.yui-dt-col-appreciation` (vide : son `[class*=placeholderToComplete]`) → éditeur `.yui-dt-editor` (textarea +
  `button.yui-dt-default`) → UNE requête, cellule redessinée. Le reste est celui de Plan de classe : panneau, frappe
  imitée, suivi des requêtes (`XMLHttpRequest.prototype.send`), ligne retrouvée par le nom à chaque élève, relecture de
  la cellule après l'enregistrement, ⏹ Arrêter. ⚠️ MBN charge Prototype.js : aucune méthode d'Array sur une collection
  DOM, aucune sérialisation JSON dans le favori ; commentaires `/* */` seulement (une adresse `javascript:` tient sur
  une ligne).
- **La règle, arbitrée par l'utilisateur (« la même règle »)** : l'appréciation déjà dans MBN est **remplacée**, un
  texte identique n'est pas réécrit (« déjà identique »), un élève sans bilan ici ne touche pas à MBN, un élève de MBN
  non retrouvé (ou deux candidats) est laissé tel quel. ⚠️ **En plus de Plan de classe : un texte trop long n'est
  JAMAIS coupé** — signalé dans l'aperçu (au-delà de `max`, la limite de Suivi PP) et, si la case de MBN est plus
  courte (`maxlength` du textarea), à l'écriture : l'éditeur est annulé et l'élève passe dans « À vérifier ».
- **Côté Suivi PP** : *🏫 Vers MBN…* (barre de 👥 Élèves) et *🏫 Appréciations vers MBN…* (💾 Données ▸ Exporter) → fenêtre
  `mmbncc` (`openMbnConseil`, `_mbnCcRender`, dans `_MODAL_RERENDER`) : le **moment** (les conseils seulement,
  `_mbnCcMoments` ; d'office celui de la fiche ou de la période courante), les comptes, les élèves sans bilan (repliés),
  les bilans trop longs nommés ; le lien à glisser dans la barre de favoris (`_mbnCcCode`, `MBN_CC_NOM`), ⧉ Copier le
  code du favori, ⧉ Copier les appréciations. Charge utile (`_mbnCcPayload`) : `{ app: 'suivi-pp', type: 'mbn-conseil',
  v: 1, contexte: { classe, periode }, max, eleves: [{ nom, prenom, appr }] }` — les élèves présents pendant la période
  (`_fichePrintEleves`), `appr` = le bilan du conseil de ce moment (`_bilanCible`). Le favori refuse un JSON de Plan de
  classe, et réciproquement.
- ⚠️ **Pas de favori pour la synthèse de la CLASSE** (arbitré le 2026-10-23 : *« l'appréciation générale est pour moi,
  c'est pour la dire lors du conseil, il n'y a pas d'emplacement dans MBN »*) : elle reste dans 🏫 Vie de classe
  (*Synthèses de la classe*) et sur la synthèse de période imprimée. Ne pas la proposer vers MBN.
- Tests : `test/mbn-conseil.test.js` (syntaxe et contraintes du bloc, charge utile, fenêtre et Ctrl+Z). **Fausse page**
  `test/fixtures/mbn/fake-mbn-conseil.html` (noms inventés). Vérifié dans le navigateur : aperçu (nouvelle, remplace,
  identique, rien à écrire, trop long, introuvable), remplissage (2 écrits, retours à la ligne gardés, l'identique et le
  trop long intacts), case de MBN plus courte que la limite → annulé et signalé ; lien `javascript:` décodé = code
  valide ; audit `mmbncc` deux thèmes, 1 400 et 320 px, Données : 0 défaut. ⚠️ **À essayer sur le vrai MBN** : glisser le
  favori, puis un premier remplissage sur un conseil de classe ouvert.
