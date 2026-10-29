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
