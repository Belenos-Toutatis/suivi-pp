# Fiches de suivi — intégration dans Suivi PP

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Fiches de suivi

Application « Fiches de suivi » (comportement cours par cours : fiches individuelles avec bilan pour la famille, suivi collectif de quelques élèves, fiches de classe), reprise d'une autre session. Ses sources vivent dans **`fiches-suivi/`** (dépôt public : le nom réel du collège y est remplacé par « Collège Les Tilleuls »). Elle n'évolue plus qu'ici. Détail : `fiches-suivi/CLAUDE.md`.

**Une seule source, deux livraisons** (arbitré) :
1. **Autonome**, pour les collègues : un seul fichier HTML **vierge**, qui s'enregistre dans sa propre page ; la classe se saisit, se colle, s'importe d'un tableur ou **d'une sauvegarde de Plan de classe (.json)**.
2. **Intégrée** à Suivi PP : onglet **📋 Suivis** (après Avis des collègues) qui affiche la fiche dans un cadre ; son état est rangé dans les données de Suivi PP (sync, sauvegardes, Ctrl+Z), les élèves viennent de la classe.

**Télécharger la fiche de suivi autonome** (vierge, pour un collègue) : 💾 Données ▸ Importer · exporter, et menu Fichier de la
fiche dans 📋 Suivis (message `autonome`) → `suivisTelechargerAutonome`. Pas de second exemplaire embarqué : `_suivisAutonomeDepuis`
reconstruit la version autonome depuis la page intégrée (`_suivisPageIntegree`) en retirant `data-hote` / `class="integree"` et en
posant nos polices — identique à `fiches-suivi/app/Fiche de suivi collective.html` (testé). ⚠️ Refusée (rien n'est téléchargé) si
le bloc de données de la page n'est pas vide, ou si la page n'a pas la forme attendue. ⚠️ Ne jamais écrire en toutes lettres une
balise de fin de script dans une chaîne du script de l'app : elle le fermerait (tout le fichier tombe) — la couper (`'</' + 'script>'`).

**L'onglet 📋 Suivis** (bloc « 📋 FICHES DE SUIVI » du script) :
- La fiche est rangée **compressée** dans `suivi pp.html` (`<script type="application/octet-stream" id="fiches-suivi-app">`, entre `<!-- FICHES-SUIVI-DEBUT` et `<!-- FICHES-SUIVI-FIN -->`, ≈ 300 Ko), **écrite par `fiches-suivi/app/assemble.py`**, jamais à la main (`test/fiches-suivi.test.js` vérifie son empreinte).
  - ⚠️ Placée avant le script de l'application : le harnais des tests prend le DERNIER script.
  - ⚠️ Toute évolution de la fiche change `suivi pp.html` : version et date à avancer.
- `renderSuivis` la décompresse une fois (`DecompressionStream('deflate-raw')`), y pose **nos polices** (`_suivisPolicesCSS` : JetBrains Mono, puis ce qui est entre `/* ANDIKA-DEBUT */` et `/* LM-FIN */` ; d'où le sous-ensemble élargi des polices de Suivi PP, `UNI_LARGE` de `scripts/gen_fonts.py`, lancé avec `--html`) et la charge dans un cadre par **`srcdoc`**, gardé vivant d'un onglet à l'autre.
  - ⚠️ Pas une URL de blob : en `file://`, son origine « null » refuse les changements d'ancre, donc toute la navigation de la fiche (cf. `fiches-suivi/docs/integration.md`).
- **`S.fichesSuivi[classId] = { etat: { app, format, savedAt, S }, noms: { sid: 'NOM Prénom' }, demo? }`** : l'état de la fiche est OPAQUE ici (elle le normalise à la lecture) ; `noms` = les noms envoyés la dernière fois (un renommage d'ici suit là-bas) ; `demo: true` = la fiche y fabrique sa démonstration (posé par `createDemo`). Section dans `_emptyState`, `_sanitizeCoreSections`, `_validateImport` ; `_purgeClassRefs` l'emporte, `_purgeStudentRefs` retire `noms[sid]` (dans la fiche l'élève n'est qu'un NOM : sa ligne y reste, signalée « pas dans Suivi PP »).
- **Messages** (`_suivisEnvoyer`, `_suivisRecevoir`, écouteur `message` vérifié par sa source) : `charger` n'est envoyé que si le suivi, la liste de la classe ou la classe affichée a changé (Ctrl+Z, sync, changement de classe, élève renommé…), sinon la pile seule. La classe envoyée (`_suivisClasse`) : « NOM Prénom » par ordre alphabétique, « Groupe N », options par leur CODE (court, affiché dans l'emploi du temps de la fiche), arrivée, départ ramené au dernier jour présent.
- ⚠️ **Le suivi renvoyé se range sous la classe QUE LA FICHE AVAIT** (`m.cle`), pas sous `S.cur` : une frappe en attente part au moment où l'on change de classe.
- ⚠️ **Un suivi fondé sur un état remplacé depuis n'est pas rangé** (Ctrl+Z, import, sync pendant que la fiche, cachée, n'en savait rien ; frappe partie pendant un `charger`) : chaque `charger` porte un numéro (`version`) que la fiche répète dans `etat` ; `_suivisBase[cid] = { v, json, noms }` = ce qu'elle tient. Rangé seulement si c'est le dernier numéro envoyé pour cette classe ET si notre suivi est encore `json` ; sinon rien, et `charger` repart si elle a notre dernier envoi. `e.noms` = les noms de CE `charger` (pas ceux d'aujourd'hui : le renommage ne partirait plus).
- `commun` n'est envoyé qu'à une fiche à jour (même classe, même suivi, même liste que le dernier `charger`), sinon `_suivisCommunMaj` passe par `_suivisEnvoyer` : elle l'appliquerait à un suivi périmé et le renverrait.
- ⚠️ **Ctrl+Z est le nôtre** : `etape` → `pushUndo()` avant de ranger ; `retirer` → `_undoAnnulerRefus` si le cran est encore le dernier et contient ce suivi.
  - ⚠️ Comparer le SUIVI, pas l'enveloppe (la fiche date chaque envoi), sinon un cran vide.
  - Une frappe groupée ne pose pas de cran mais avance l'horloge (`_clockBumpSelf`).
  - Ctrl+Z demandé par la fiche : `undoLast(true)` (silencieux : la fiche dit ce qui a été annulé).
  - ↶ / Ctrl+Z / Ctrl+Y de Suivi PP rangent d'abord la frappe en attente de la fiche (`_suivisRecupererFrappe`), comme son propre Ctrl+Z.
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
  - ⚠️ Le découpage que NOUS avons envoyé, appliqué là-bas, n'est pas une modification : nos dates y arrivent normalisées (« 02-30 » → 28/02), et sans dates envoyées la fiche recalcule les siennes au changement de mode ; repris seulement si le mode diffère du nôtre ou si elle a touché ses dates.
  - ⚠️ **Sans suivi d'avant, rien n'est « modifié »** : la démonstration des fiches (fabriquée avant d'avoir reçu les enseignants) écrasait ceux des moyennes par ses noms fictifs.
- ⚠️ Changer l'enseignant d'une matière change celui de TOUTES les fiches, passées comprises ; un remplaçant pour un temps se dit dans la fiche (« changements d'enseignant », « absences longues »), qui ne sont pas communs.
- Dans la fiche, les champs communs portent un trait bleu et l'infobulle le dit (`marquerCommunsHote`).

**Apparence de Suivi PP pour les deux** (`fiches-suivi/app/theme.css`) et **ses polices** embarquées (`python3 scripts/gen_fonts.py --fiches` → `fiches-suivi/app/polices.css`, mêmes familles, sous-ensemble élargi) : Andika à l'écran, Latin Modern au papier, réglables ; les feuilles affichées à l'écran prennent la police d'impression, un bouton **Aa** les bascule (arbitré). Dans Suivi PP, l'onglet suit les réglages de police de Données (pas de second réglage).

### Circulation d'une fiche individuelle (v1.84.0)

Le jour de remise (réglage commun ou propre à un suivi) existait ; la **consigne** imprimée (qui garde la fiche, qui la dépose, quand) était commune à tous les suivis. Désormais :

- **Consigne propre à un suivi** : `ind.consigne` = n° du modèle (à partir de 1), `0` = celle des réglages (même convention que `ind.remise`). Supprimer un modèle décale les numéros ou renvoie à la consigne des réglages ; « Revenir aux modèles proposés » retrouve la consigne d'un suivi par son intitulé. `normalizeState` ramène un numéro hors liste à `0`.
- **Trois modèles ajoutés** (`CONSIGNES_INDIV_V2`) : *Dernier enseignant, le jour de remise* (l'élève qui fait disparaître ses documents ne repart pas avec la fiche), *Dernier enseignant, chaque soir* (vie scolaire, la fiche ne quitte pas le collège), *Chaque soir à la maison* (signée par les parents, rapportée le lendemain). Proposés **une fois** aux suivis plus anciens (marqueur `consignesIndivV: 2`) : supprimés ensuite, ils ne reviennent pas ; un modèle du même intitulé n'est pas doublé.
- **Mots remplacés** `[premier enseignant]` (premier cours du jour où la fiche suivante commence) et `[dernier enseignant]` (dernier cours du jour de remise) : « Mme Carpe (Allemand, premier cours) », à défaut « l’enseignant du premier cours (Allemand) ». Lus dans l'emploi du temps par `coursBordIndiv` : groupe de l'élève (`coursPour`), cours annulés, enseignant absent ce jour-là (cours suivant), remplaçant d'un jour ou d'une absence longue, changement d'enseignant daté.
- **Rappel au PP** (écran seulement, `relaisIndivHTML`) : sur la page du suivi, « D’une fiche à la suivante » — qui a l'élève au dernier cours du jour de remise, et dans quel casier déposer la nouvelle fiche la veille (« c’est vous » si le premier cours est celui du référent) ; sur chaque carte, une ligne « 📥 nouvelle fiche → … ».
- Démonstration : MOSTOWSKI (remise le jeudi) a la consigne *Dernier enseignant, le jour de remise*. Test : `fiches-suivi/e2e_relais.js`.

### Retenue des fiches individuelles (v1.85.0)

Sur le modèle de la règle de la fiche de classe. **Sans règle par défaut** (`RETENUE_INDIV_DEFAUT` : `i: 0`, `nonRendue: 0`) : un suivi existant ne change pas de règle sans qu'on le décide.

- `S.retenueIndiv = { i, heures, nonRendue }` : `i` « I » sur la fiche, tous objectifs confondus = `heures` de retenue par palier (`floor(nI / i) × heures`) ; fiche non rendue le jour de remise = `nonRendue` heures. Seuls les « I » comptent (un « À » n'est pas une faute) et seulement pour des cours qui ont eu lieu (`statsIndiv`). `0` = pas de règle. Bornes : `retenueNormale`.
- **Plafond par fiche** (v1.86.0) : `max` heures au plus, « I » et fiche non rendue comprises (`0` = pas de plafond ; `2` par défaut, et pour une règle v1.85.0 qui n'en avait pas) : à 90 cases par semaine, une règle de 3 « I » donnait 8 à 10 heures sur une mauvaise semaine. La phrase dit le plafond atteint et ce que la règle aurait donné.
- **Règle propre à un suivi** : `ind.retenue` (`null` = celle des réglages ; cochée, elle part de celle des réglages).
- **Fiche non rendue** : `ind.nonRendues = { [fin de la fiche]: true }`, case sur la page du suivi ; la marque suit sa fiche quand le jour de remise change (`recalerBilans`).
- **Où elle se dit** : une ligne « Attention : … » sous la consigne de la fiche imprimée (vérifié : 4 objectifs, consigne de 3 lignes, tous les créneaux = 1 page) ; page du suivi (« Retenue », écran seulement) ; carte (« ⚠ retenue n h », dernière fiche remise) ; bilan pour la famille et courriel, seulement s'il y a une retenue. L'application n'en pose aucune : elle l'annonce, la vie scolaire la pose.
- Démonstration : 3 « I » = 1 heure, fiche non rendue = 1 heure ; PODEANU, fiche du 20/11 non rendue. Test : `fiches-suivi/e2e_retenue_indiv.js`.

### Codes des niveaux proposés (v1.87.0)

`DEFAULTS.codage` passe de **TB · S · À · I** à **TB Très bien · B Bien · I Insuffisant · TI Très insuffisant** : des parents lisaient « À améliorer » comme un encouragement, alors que ce niveau est hors de la « réussite ». Les deux niveaux du bas sont maintenant tous deux nettement négatifs.

- Un suivi existant **garde son codage** (`normalizeState` ne remplace que ce qui manque). Bouton **« Revenir au codage proposé »** (Réglages › Codes et pastilles) : la confirmation montre l'ancien et le nouveau codage, dit que les saisies (rangées par niveau, 0-3) s'affichent sous les nouveaux noms et que les seuils ne bougent pas ; Ctrl+Z ; grisé quand le codage proposé est en place.
- La retenue des fiches individuelles compte le niveau le plus bas : « TI » avec ce codage. Raccourcis en lettres perdus (TB et TI commencent par T) : les chiffres 1 à 4 restent.
- Test : `fiches-suivi/e2e_codage_defaut.js`.

### Retenue : critère de réussite, « fiche perdue » (v1.88.0)

- **Troisième critère** : réussite de la fiche (part des cases notées dans les deux niveaux du haut, tous objectifs, cours qui ont eu lieu) **strictement sous** `reussite` % = `hReussite` heures. Seuil **75 %** par défaut (au plus un avis négatif sur quatre ; 50 % a été jugé inadmissible), critère désactivé tant que `hReussite` vaut 0 : une règle existante ne se met pas à donner des retenues d'elle-même. Comparaison sur la réussite **arrondie**, celle qui s'affiche (`pctArrondi`). Une fiche sans aucun code (perdue) n'a pas de réussite. Les trois critères se cumulent dans la limite du plafond.
- **« Fiche perdue »** remplace « fiche non rendue » à l'affichage : perdue en route ou pas rendue le jour de remise ; le professeur principal peut redonner un exemplaire en cours de semaine (« Imprimer la fiche »). Le champ garde son nom (`nonRendue`, `nonRendues`) : on ne renomme pas un champ enregistré.
- Démonstration : réussite sous 75 % = 1 heure ; la fiche perdue de PODEANU est vidée de ses codes en toute fin de `demo.js` (les cours de latin en ajoutaient après coup).

### Page d'ouverture de l'onglet 📋 Suivis (v1.89.0)

F5 (ou un changement de classe) rouvrait toujours le sommaire du suivi collectif. L'onglet rouvre maintenant la **première page de la famille où l'on était** : liste des suivis individuels (`#indiv`), sommaire du suivi collectif (`#sommaire`) ou fiche de classe de la semaine (`#classesem`). Suivi PP retient la famille par classe dans `suiviPP_suivisFamille` (préférence du poste, hors de `S`) ; sans mémoire, la famille la plus récemment saisie. Les pages communes (élève, conseil, emploi du temps, réglages) ne changent pas la famille retenue. Détail : `fiches-suivi/docs/integration.md`. Test : `fiches-suivi/e2e_integre.js` (§ 6).

### Pertes datées (v1.90.0)

La case « Fiche perdue » devient la **liste des jours de perte** : `ind.pertes = ["AAAA-MM-JJ", …]` (triée, sans doublon ; un jour = une perte). Sur la page du suivi : les pertes de la fiche (« le mardi 17/11 ✕ »), un choix parmi les jours de cours de la fiche pour en ajouter une (pas de champ date à taper), et le cumul depuis le début du suivi (« 2 pertes — 17/11, 19/11 ») pour garder la trace. **Une retenue par perte** (arbitré par l'utilisateur) : `nonRendue` heures × nombre de pertes de la fiche, dans la limite du plafond. La phrase cite les jours (« fiche perdue 2 fois : mardi 17/11 et jeudi 19/11 »). Les pertes, datées, retombent d'elles-mêmes dans la bonne fiche quand le jour de remise change. Conversion : l'ancienne case (`nonRendues`, v1.85.0-v1.89.0) devient une perte datée du dernier jour de sa fiche, puis disparaît. Démonstration : PODEANU, perdue le mardi 17 et le jeudi 19/11 (les codes des exemplaires perdus disparaissent avec eux).

### Fiche individuelle imprimée : toujours une page (v1.90.1)

Les lignes du tableau avaient une hauteur fixe (`--rhi`, 16 mm au plus) : un en-tête long (consigne de 4 lignes, règle de retenue complète, objectifs sur 2 lignes) envoyait le cadre « Bilan du professeur principal » sur une 2e page. À l'impression, la page d'une fiche individuelle fait maintenant la hauteur utile du papier (192 mm sur 194 : paysage, marges de 8 mm) en colonne flex : en-tête et pied gardent leur taille, le tableau prend le reste (`flex: 1 1 0`) et ses lignes se le partagent, 5 mm au moins. Test : `fiches-suivi/e2e_impr2.js` (consigne « casier » de 4 lignes, 1, 3 et 4 objectifs, tous les créneaux, fiches de la semaine, bilan pour la famille).

### La retenue en tête du bilan du professeur principal (v1.91.0)

Une **ligne automatique** (`ligneRetenue`) ouvre le cadre « Bilan du professeur principal » : sur la fiche (écran et papier), dans le bilan pour la famille (en tête du bilan, à la place de l'ancienne partie « Retenue ») et dans le courriel. Elle est **calculée, jamais écrite dans `ind.bilans`** : recalculée à chaque code (`commit()` redessine), elle ne s'efface pas par erreur et ne devient pas fausse. Avant le jour de remise : « … En cours : la retenue sera fixée le jeudi 26 novembre. » ; à partir du jour de remise, sans mention. Sans retenue mais avec une règle : « Pas de retenue : … » ; sans règle ni perte : pas de ligne. La fiche imprimée tient toujours sur une page avec elle.

### Carte du suivi et touche Échap (v1.91.1)

- **Carte** : la pastille « ⚠ retenue n h » porte sur la fiche **affichée** sur la carte (celle du pourcentage, la dernière commencée et remplie), avec « (en cours) » avant son jour de remise. Avant, elle ne regardait que la dernière fiche déjà remise : une retenue de la fiche en cours n'y apparaissait pas.
- **Échap** sur la page d'un suivi individuel ramène à la liste des suivis (`#indiv`) — sauf quand Échap a déjà servi (menu fermé : `preventDefault` posé par le gestionnaire commun ; fenêtre ouverte ; tutoriel) ou pendant la frappe (remarque, bilan, champ). Test : `fiches-suivi/e2e_echap_indiv.js`.

### Critère de retenue désactivé (v1.91.2)

- Dans **Réglages › Fiches individuelles** et dans la **règle propre à un suivi**, un critère réglé à 0 porte la marque
  « désactivé » sur la ligne de son libellé : nombre de « TI » à 0, heures pour la réussite à 0, heures par perte à 0. Un
  plafond à 0 porte « sans plafond ». La durée par palier (1 à 4 h) et le seuil de réussite n'en ont jamais : ils ne
  désactivent rien.
- Raison : un seuil de réussite réglé (75 %) avec « = heures » à 0 ne donnait aucune retenue, sans que rien ne le signale
  (cas rencontré avec une règle propre copiée des réglages). `retOff` (sections.js), style `label.champ em.ret-off`.
  Test `e2e_ret_off`.

### Codes de la réussite sur la fiche (v1.91.2)

- La fiche individuelle (écran et papier) dit, après les codes que l'enseignant écrit : « Réussite = cases **TB** ou **B**. »
  (les deux niveaux du haut de `S.codage`, quel que soit le codage choisi). Le seuil de la règle de retenue (« réussite de la
  fiche sous 75 % ») se lit ainsi sur la même feuille. Le bilan pour la famille avait déjà sa légende
  (« Réussite = part des cours notés … »). Test : `e2e_codage_defaut` (nouveau et ancien codage).

### Bilan du professeur principal imprimé ou non (v1.91.3)

- Sur la page d'un suivi individuel, à côté de « Imprimer la fiche », la case **« Avec le bilan du professeur principal »** dit si
  la fiche imprimée porte, dans le cadre du bas, la ligne de retenue et le bilan. Elle est **cochée d'office à partir du jour de
  remise** (dernier jour de la fiche, celui où le professeur principal récupère la fiche remplie), décochée avant : une fiche à
  distribuer, ou réimprimée après une perte, a un cadre vide. On peut toujours la décocher ou la cocher à la main.
- Le choix vaut pour la fiche affichée et pour la session : ni dans les données, ni dans le stockage du navigateur
  (`impBilanChoix`, clé `id|fin`). Les autres impressions (toutes les fiches d'un suivi, fiches de la semaine, Ctrl+P) suivent
  la même règle, fiche par fiche (`bilanImprime(ind, c)`). L'écran garde toujours la ligne de retenue et le bilan, à jour à
  chaque code ; le bilan pour la famille aussi. Test : `e2e_retenue_indiv` (veille et jour de remise en PDF, case cochée,
  décochée, cochée à la main sur une fiche à venir).

### Fiches de la semaine : bilan imprimé ou non (v1.91.4)

- La fenêtre **Fiches de la semaine…** (liste des suivis individuels) a la même case **« Avec le bilan du professeur
  principal »**, sous la liste des élèves. Cochée d'office quand **toutes** les fiches de la semaine choisie ont atteint leur jour
  de remise ; elle suit la semaine choisie tant qu'on n'y a pas touché ; cochée ou décochée à la main, elle impose son choix à
  toutes les fiches imprimées (`indivHTML(…, avecBilanImpose)`). Elle ne change pas la case de chaque suivi
  (`impBilanChoix`) et n'est enregistrée nulle part.
- ⚠ La fenêtre prend, pour chaque élève, la fiche qui **commence** la semaine choisie. Avec une remise le jeudi, le jeudi, la
  semaine en cours propose la nouvelle fiche (du vendredi) : la fiche finie est celle de la semaine précédente.
  Test : `e2e_imp_semaine`.

### Règle de retenue écrite pour l'élève (v1.91.5)

- La ligne « Attention : » de la fiche imprimée (et l'aperçu « Imprimé sur la fiche » des réglages) est écrite pour l'élève, en
  phrases courtes : « 5 TI sur la fiche = 1 heure de retenue. Moins de 8 cases sur 10 en TB ou B = 1 heure de retenue. Fiche
  perdue = 1 heure de retenue à chaque fois. Jamais plus de 2 heures par fiche. » (`regleRetenueEleve`).
- Le seuil de réussite se dit en cases quand c'est **exact** : multiple de 10 → « n cases sur 10 », 50 % → « 1 case sur 2 »,
  25 % et 75 % → « 1 / 3 cases sur 4 » ; sinon le pourcentage reste (« moins de 65 % des cases en TB ou B ») ; 100 % → « une
  case qui n'est ni TB ni B » (`seuilCasesEleve`). Jamais d'approximation (« environ 2 sur 3 ») : la retenue se décide sur le
  chiffre exact. Le calcul ne change pas (réussite arrondie comparée au seuil).
- **Partout en phrases courtes depuis la v1.92.3** (demandé) : fiche imprimée, aperçu « Imprimé sur la fiche », liste des suivis à
  règle propre (Réglages › Fiches individuelles, un suivi par ligne), page du suivi (« Règle propre à ce suivi : … ») et ses
  réglages (« Règle des réglages : … », infobulle). `regleRetenueIndiv` (forme courte) ne sert plus qu'à savoir s'il y a une
  règle. La phrase du résultat (« Retenue prévue : 2 heures (6 « TI » sur la fiche ; …) ») n'est pas la règle et ne change pas.

### Salles des cours (v1.91.6)

- La fiche individuelle (écran et papier) donne la **salle** de chaque cours, en petit sous la matière, dans la case « Matière »
  (`td.mat .sal`) : celle de l'emploi du temps, du groupe de l'élève pour un cours en demi-groupes, ou celle changée pour ce jour.
  Pas de salle saisie : rien sous la matière.
- **La consigne imprimée ne la donne pas** (arbitré v1.91.7 : la salle est dans le tableau ; « [premier enseignant] » reste
  « M. Carpe (Allemand, premier cours) »). À l'écran, la page du suivi (« D'une fiche à la suivante ») et la carte
  (« 📥 nouvelle fiche → ») donnent la salle du premier cours, là où déposer la fiche (`salleTxt` : « salle 104 », une salle
  déjà nommée « Salle polyvalente » garde son nom). `coursBordIndiv` rend `salle`. Tests : `e2e_relais`, `e2e_creneau`.

### Noms des PDF (v1.92.0)

- Modèle arbitré : **« date - classe - type de fiche - élèves »**, la date en AAAA-MM-JJ pour que les fichiers d'un dossier se
  rangent seuls dans l'ordre. Ex. « 2026-11-20 - 5E - Fiche individuelle - BRIDGE Michael », « 2026-11-20 - 5E - Fiches
  individuelles - BRIDGE, MOSTOWSKI, PODEANU » (plusieurs élèves : noms de famille), « 2026-11-20 - 5E - Bilan famille - … »,
  « 2026-11-16 - 5E - Fiche collective », « 2026-11-16 - 5E - Fiche de classe », « 2026-11-30 - 5E - Suivi collectif -
  Totaux », « 2026-10-12 au 2026-12-18 - 5E - Conseil de classe 1er semestre ».
- Dans Suivi PP, le nom passe par le titre de la page de Suivi PP le temps de l'impression (Chrome ne lit que celui-là) :
  messages `titre` / `titrePose`, `_suivisTitrePdf` (cf. `fiches-suivi/docs/integration.md`).

### Un PDF par élève (v1.92.1)

- La fenêtre **Fiches de la semaine…** a une case **« Un PDF par élève »** (décochée d'office) : la fenêtre d'impression s'ouvre
  une fois par élève, l'une après l'autre, chacune avec le nom de l'élève (« 2026-11-20 - 5E - Fiche individuelle - BRIDGE
  Michael ») ; « Enregistrer » à chaque fois. La case « Avec le bilan » vaut pour chaque PDF. Décochée : un seul PDF, comme avant.
- Un navigateur ne peut pas enregistrer plusieurs PDF sans sa fenêtre d'impression (sauf bibliothèque extérieure, pages en
  image) : une validation par fichier. `printPages` rend une promesse tenue à la fermeture de la fenêtre (dans Suivi PP, après
  le message `titrePose`) : les impressions s'enchaînent. Tests : `e2e_imp_semaine`, `e2e_integre` § 6.

### Bordure droite des feuilles imprimées (v1.92.2)

- Les tableaux imprimés prennent toute la largeur de la page ; en bordures fusionnées, la moitié extérieure de leur bordure droite
  tombait hors de la zone imprimable et Chrome la rognait : ligne de droite très fine, ou absente selon l'imprimante ou le PDF
  (constaté sur une fiche du vendredi au jeudi, vrai de toutes les feuilles). `#print-area .page` a 1 px de marge intérieure à
  gauche et à droite (fiche individuelle : 1 px tout autour). Test : `e2e_impr2` (tableau et cadre du bilan à l'intérieur de la page).

### Audit du 2026-11-22 : fiche chargée, réglages, élève parti, arrondi

- ⚠️ **La fiche individuelle imprimée ne perd plus son bilan** : la page a une hauteur MINIMALE (192 mm), plus une hauteur fixe à
  contenu rogné — le tableau part de sa hauteur naturelle et grandit pour remplir (`flex: 1 0 auto`). Une ligne ne rétrécit pas sous
  son contenu : avec dix créneaux et des salles au nom long (« Labo physique-chimie » sur trois lignes, v1.91.6), le cadre « Bilan du
  professeur principal » et le visa sortaient de la page et disparaissaient, sans 2e page ni avertissement. Sur le papier, la salle
  tient en **deux lignes au plus**, et en **une seule** (coupée par « … ») quand la fiche a neuf créneaux ou plus (classe `serre`,
  posée par `indivHTML`) ; l'heure du créneau ne se replie plus. Si une fiche ne tient vraiment pas, le bilan passe sur une seconde
  feuille. Test : `fiches-suivi/e2e_impr_chargee.js` (six fiches chargées, par le vrai bouton d'impression).
- **Résumé du menu des réglages** (`resumeRetenueIndiv`) : tous les critères actifs (« 3 TI = 1 h · réussite < 75 % = 1 h · perte =
  1 h »), plus seulement les « TI ». **Réglages › Fiches individuelles** : un critère et son « = heures » ne se séparent plus à la
  ligne (`.champs .paire`). Test : `fiches-suivi/e2e_audit7.js`.
- **Élève parti de la classe** (arbitré le 2026-11-22) : son suivi n'est PAS clos (une date de départ se corrige), mais ses fiches
  s'arrêtent à son dernier jour dans la liste de la classe (`departDe`, `finIndiv`, lus par `cyclesIndiv`) — « Fiches de la semaine »
  proposait encore la sienne. La page du suivi le dit au-dessus des réglages. Date de départ retirée : les fiches reviennent.
- ⚠️ **Arbitré le 2026-11-22 : la réussite ARRONDIE fait foi** pour le critère de retenue. 35 cases sur 44 (79,5 %) s'affichent
  80 % et ne donnent PAS de retenue sous un seuil de 80 % (« moins de 8 cases sur 10 ») : ce que la fiche affiche est ce qui
  compte (`retenueFiche`, `pctArrondi`). Ne pas « corriger » vers le rapport exact.
