# 📓 Suivi PP

Application web autonome (un seul fichier HTML) pour suivre les élèves dont on est
**professeur principal** : relevés de carnet, documents administratifs et réponses des
familles, élection des délégués de classe.

Écrite pour un usage réel, en collège, par l'enseignant qui s'en sert. Aucun serveur,
aucun compte, aucune télémétrie : les données restent dans le navigateur et dans les
fichiers que vous exportez vous-même.

👉 **[Lancer l'application](https://belenos-toutatis.github.io/suivi-pp/suivi%20pp.html)**

### L'installer comme une application

Elle s'installe sur le téléphone, la tablette ou l'ordinateur : elle s'ouvre alors en
plein écran, sans barre d'adresse, avec sa propre icône, et **fonctionne sans connexion**
— utile en salle où le wifi ne porte pas.

| Appareil | Geste |
|---|---|
| **Android** (Chrome, Edge) | Ouvrir le lien, puis le menu **⋮** → *Installer l'application* — ou la bannière « Installer » qui s'affiche d'elle-même. |
| **iPhone / iPad** | ⚠️ **Safari obligatoire** (Chrome sur iOS ne sait pas le faire). Bouton **Partager** ⬆️ → *Sur l'écran d'accueil*. |
| **Ordinateur** (Chrome, Edge) | L'icône **⊕** dans la barre d'adresse, ou le menu **⋮** → *Installer*. |
| **Firefox** | Pas d'installation possible : Firefox ne l'implémente pas sur ordinateur. L'app reste parfaitement utilisable dans un onglet. |

Les données restent **dans le navigateur de l'appareil**. Installer l'app ne les envoie
nulle part, et ne les synchronise pas non plus entre appareils : pour cela, il y a la
sauvegarde dans un dossier Nextcloud (onglet 💾 Données et réglages).

---

## Ce que l'app fait

1. **📓 Relevés de carnet** — combien d'observations chaque élève a dans son carnet, à
   différentes dates de l'année. On saisit le **cumul** qu'on lit dans le carnet ou dans
   Pronote ; l'app calcule l'**évolution depuis le relevé précédent** — c'est-à-dire la
   seule chose qui dit qui est à voir en priorité. Un cumul de 38 ne veut rien dire sans
   savoir qu'il était à 27 il y a trois semaines.
2. **📄 Documents administratifs** — qui a rendu quoi, et quand.
3. **Réponses portées sur ces documents** — le choix de la famille (participation à
   Devoirs Faits, options d'orientation…), avec un **avis du PP** quand il y en a un.
4. **🗳 Élection des délégués** — candidatures en binôme, dépouillement bulletin par
   bulletin **projeté en direct devant la classe**, procès-verbal imprimable.

Plus une **📊 Synthèse** — une ligne par élève, tout ce qui est connu : c'est l'écran de
préparation du conseil de classe et des appels aux familles.

## Ce que l'app ne fait pas, volontairement

Notes et moyennes, plans de salle, appel et absences, bulletins, mentions de conseil de
classe, élections autres que celle des délégués de la division. Pour le placement et
l'évaluation, voir le projet frère
[Plan de classe](https://github.com/Belenos-Toutatis/plan-de-classe), dont Suivi PP
reprend le design, le moteur de sauvegarde et le harnais de tests.

---

## État d'avancement

L'app se construit par étapes. Ce qui suit est l'état réel, pas une feuille de route
optimiste.

| # | Étape | État |
|---|---|---|
| 1 | Squelette : design system, CSP, sauvegarde locale, undo, modales, nav 6 onglets | ✅ fait |
| 2 | Onglet Élèves + import CSV / Pronote | ✅ fait |
| 3 | Import depuis un export JSON de *Plan de classe* | ✅ fait |
| 4 | Onglet Carnets : relevés, cumuls, deltas, totaux de période | ✅ fait |
| 5 | Onglet Documents : champs, tableau de retours, duplication | ✅ fait |
| 6 | Onglet Délégués : calcul, dépouillement, projection, PV | ✅ fait |
| 7 | Onglet Synthèse + impressions | ✅ fait |
| 8 | Sync auto, horloge vectorielle, conflits, backups, jauge de mémoire | ✅ fait |
| 9 | Données de démonstration | ✅ fait |
| 10 | Audits : contraste, impression, responsive, clavier | ✅ fait |

**Saisir vite.** Les **dates de naissance** se tapent directement dans la liste des élèves,
d'un élève au suivant par `Entrée`. Et taper « 13 » pour l'année suffit : l'app comprend
2013 et affiche la date entière.

Dans les **carnets**, la cellule active fait apparaître les valeurs probables — inchangé,
+1, +2… jusqu'à +5, plus « absent » et « vide ». Un doigt sur la bonne valeur l'écrit et
passe à l'élève suivant : sur vingt-cinq carnets en main, on ne tape presque plus.

**La fiche d'un élève.** Cliquez son nom dans la liste : tout ce que l'app sait de lui
tient sur un écran — identité et âge, place dans chaque salle, l'histoire complète de son
carnet avec ses totaux de période, tous les documents et ce qui y a été coché, les
élections où il apparaît, sa remarque, son journal de contacts et ses incidents en entier.
Et ce qui se corrige d'un geste s'y corrige sur place : une pastille **`+`** à côté de
Remarque, Contacts et Incidents pour ajouter ; un clic sur le groupe, les options ou les
aménagements pour les changer (la fiche prévient si la classe se met à jour depuis
*Plan de classe* — la correction est alors à reporter là-bas aussi) ; un clic sur l'état
d'un document pour le cocher rendu — et, dans le même esprit, les dates, la civilité, la
classe, la place, chaque cumul du carnet, les réponses et la note de chaque document, le
texte de chaque contact se corrigent directement dans la fiche. Les deux boutons du bas
mènent à l'édition complète, et y ramènent.

**Le journal des contacts.** À côté du texte libre, chaque élève porte la liste **datée**
de ce qui s'est dit avec la famille : appel, rencontre, courriel, mot dans le carnet. Le
dernier contact remonte sur la liste des élèves et dans la Synthèse — « ai-je déjà appelé
cette famille, et quand ? » est la question qu'on se pose en préparant un conseil, et le
texte libre ne permettait ni de la compter ni de la retrouver.

**Incidents et instances.** Sur la fiche, une section ⚖️ pour noter ce qui s'est passé et
ce qui en a découlé : fiche incident, retenue, commission éducative, conseil de discipline…
Chaque entrée porte une date, l'instance, un objet, la décision prise ou les points dits,
et — si vous le voulez — **le PDF de la fiche scannée**. Le catalogue des instances est
pré-rempli des instances officielles du collège ; dans 💾 Données et réglages, renommez-les,
décrivez-les, décochez celles que votre établissement n'utilise pas, ajoutez les vôtres.
⚠️ Les PDF ne vont **pas** dans la sauvegarde (trop lourds pour la mémoire du navigateur) :
ils sont copiés dans un **dossier que vous choisissez** — placez-le sous Nextcloud, il
suivra sur l'autre poste, où il suffira de choisir le même dossier. L'app n'y efface rien
d'elle-même ; un bouton liste les PDF orphelins quand vous voulez faire le ménage.

**Salles et placements.** Dans 💾 Données et réglages, une grille par salle, vue depuis
votre bureau (dessiné en bas, le rang 1 juste devant vous) : le nom, les rangs × colonnes,
qui est assis où (les élèves sans place attendent à droite : glissez-en un sur une case,
glissez un élève sur un autre pour les échanger, ou sur la liste pour libérer sa place),
et les
ordres de ramassage (un clic sur chaque table dans l'ordre où vous passez — ou un glisser
d'une table à la suivante, qui les enchaîne). C'est ce qui
alimente les tris *par place* et *ramassage* des grilles. ⚠️ Si vos salles viennent de
*Plan de classe*, l'écran vous le rappelle : un nouvel import remplace la salle, son
placement et ses ordres — une correction faite ici est à reporter là-bas, ou à ne plus
importer. Même chose pour les options des élèves.

**Le procès-verbal signé.** Une fois l'élection close (ou les délégués désignés), joignez
le PDF du PV scanné : il se range dans le dossier des PDF, comme les fiches incident. À
chaque PDF joint, l'app propose de garder le nom du fichier, de le nommer automatiquement
(date, type, qui — `2025-10-07 PV élection délégués — 5e C.pdf`), ou de le renommer.

**Pas d'élection dans l'app ?** Si le vote s'est tenu sur papier, ou si vous reprenez une
classe en cours d'année, l'onglet 🗳 Délégués vous laisse **désigner** directement les deux
titulaires et les deux suppléants, avec la date et un mot : la Synthèse, la fiche et la liste
des élèves les afficheront comme s'ils avaient été élus ici. Si une élection close dans l'app
est plus récente, c'est elle qui fait foi.

**La date de naissance** se saisit (ou arrive de l'import) et sert au départage d'une
égalité à l'élection des délégués. ⚠️ Quand une date manque, ou que deux candidats sont
nés le même jour, **l'app ne tranche pas** : elle le dit et vous laisse décider. Elle ne
tire jamais au sort.

**Trier les élèves comme on marche dans la salle.** Les quatre grilles — Élèves, Carnets,
Ramassage, Synthèse, et le tableau d'un document — se trient par **nom**, par **prénom**, par **place dans la salle**,
ou selon un **ordre de ramassage** : la séquence de tables que vous suivez pour récupérer
les copies. Places et ordres sont repris de *Plan de classe*, jamais redessinés ici ; un
ré-import les met à jour. Et comme un élève n'a pas la même place d'une pièce à l'autre,
on **choisit la salle** où l'on est entré. Un tri ne perd jamais personne : qui n'est pas
couvert par le plan passe en fin de liste, jamais à la trappe.

**Après le plan — le ramassage.** On ne ramasse pas les papiers un document à la fois : on
passe dans les rangs avec trois formulaires différents dans les mains. L'onglet Documents a
donc une vue **🧺 Ramassage** : une grille élèves × documents où l'on coche tout en une seule
passe, avec la date du ramassage (on saisit souvent le soir), les compteurs qui bougent à
chaque case, un « tous » par colonne et les flèches pour descendre. Une case y a **trois**
états et non deux — rendu, pas rendu, et *sans objet* pour l'élève qui n'était pas là à la
date du document : un tiret, jamais une case vide, sinon on réclame un papier à quelqu'un
qui ne l'a jamais reçu. Cocher vingt-cinq cases ne compte que pour **un** Ctrl+Z.

Quand le papier porte un **choix** — Devoirs Faits : OUI / NON / ULYSS — on le relève dans
la même grille, en tapant la pastille : le papier est dans la main, la case est lue, c'est
maintenant qu'on l'enregistre. Un second appui sur la même pastille l'efface, pour corriger
une lecture erronée sans viser une croix. Les documents qui portent plusieurs champs sont
repliés d'office et se déplient d'un clic — sinon la grille ferait 130 px par ligne.

Et puisqu'on relève le choix pendant qu'on ramasse, **cocher un choix vaut constat de
retour** : le papier est dans la main, inutile de cocher deux fois. Retirer la réponse, en
revanche, ne décoche rien — on corrige une lecture, on ne rend pas le papier.

L'**ordre des documents** se règle en tirant la **poignée ⋮** de la ligne : un trait rouge
montre en direct où elle atterrira, et elle se pose là où on relâche. Les flèches ↑ ↓
fonctionnent au clavier sur la poignée, pour qui n'a ni souris ni écran tactile.

À l'étape 10, les quatre audits. **Contraste** : 0 écart sur 20 états × 2 thèmes, plus
un rendu **papier simulé** (les règles `@media print` réinjectées à l'écran) qui montre
qu'imprimer en thème sombre donne bien du noir sur blanc. **Impression** : l'orientation
ne repose plus sur les seules pages nommées, que Firefox ignore — un `@page` universel
est posé le temps de l'impression puis retiré. **Responsive** : plus aucun débordement
horizontal de 320 à 1920 px ; les tableaux larges défilent dans leur propre cadre au lieu
de pousser la page, et la marge du cahier se resserre sur téléphone. **Clavier** : les 19
modales vérifiées une à une — le focus arrive dedans, Tab y tourne en rond, Échap ferme,
et le focus **revient là où on l'avait pris**.

À l'étape 9, l'app **s'ouvre pleine au premier lancement** : une classe fictive de 5e,
25 élèves, huit relevés de carnet, six documents et deux élections. Ce n'est pas du
remplissage — l'intention est documentaire, et ce sont les cas TORDUS qui y sont posés :
un élève absent au moment d'un relevé, un cumul qui **diminue** parce que le carnet a été
remplacé (signalé, jamais corrigé), un papier rendu mais illisible, une réponse connue
avant le retour du papier, un bulletin nul portant des noms valides, une élection dont le
**premier tour n'a pourvu qu'un siège**, et une seconde laissée **en cours de dépouillement**
pour régler la projection sans ressaisir des bulletins. Rien de tout cela ne se devine : il
faut l'avoir sous les yeux une fois. Deux boutons dans 💾 Données et réglages permettent de recharger la
démo ou de **tout effacer** — les deux passent par un point nommé dans le dossier de sync,
et restent annulables par Ctrl+Z. La démo effacée ne revient pas d'elle-même.

À l'étape 8, le filet de sécurité est en place : on choisit un **dossier synchronisé**
(Nextcloud académique, Drive…), l'app y écrit `suivi-pp-auto.json` cinq secondes après
chaque modification, plus des **backups horodatés** dont la rotation s'espace avec l'âge.
Deux postes qui pointent le même dossier se synchronisent ; une **divergence** est détectée
par horloge vectorielle (jamais par la date du fichier, que Nextcloud retouche) et résolue
sans rien perdre — la version qu'on n'active pas est archivée avant tout écrasement. La
modale **Versions & historique** liste tout, avec un résumé du contenu de chaque version,
et permet de poser un **point nommé** avant une opération risquée. Une **jauge de mémoire
locale** mesure la place réellement disponible sur ce navigateur, au lieu de la supposer.

À l'étape 7, la **Synthèse** rassemble tout ce qui est connu de chaque élève sur une ligne :
dernier cumul d'observations et son Δ, total de la période, documents non rendus, réponses
portées (et avis du PP), délégué ou suppléant, aménagements, remarque. Tri par Δ, par non
rendus… et **impression en paysage** ; la liste des manquants et le procès-verbal s'impriment
en portrait. Ctrl+P fait ce qui a du sens dans l'onglet courant.

À l'étape 6, l'élection des délégués se tient dans l'app : candidatures en binôme, urne
comptée avant ouverture, dépouillement **bulletin par bulletin** (on coche les noms lus, le
statut blanc/nul se déduit et se corrige), et à droite le **graphique projeté en direct** —
des barres en voix sur un axe fixe, la ligne de majorité qui descend à chaque blanc ou nul,
« déjà élu » dès que l'arithmétique l'autorise, jamais d'« éliminé ». Un mode projection
masque la grille. Clôture avec attribution des sièges (un tour peut n'en pourvoir qu'un),
second tour automatique, égalité départagée à la main, et **procès-verbal** imprimable une
fois l'élection close.

À l'étape 5, les documents administratifs sont là : un papier distribué, ses classes, ses
dates, et 0, 1 ou plusieurs **réponses** à porter dessus — choix unique ou multiple, par la
famille ou par le PP. Le tableau des retours croise élèves × (rendu · date · réponses · note),
la liste des manquants se copie en un clic pour la vie scolaire, et **dupliquer** un document
prépare la rentrée suivante. Trois modèles sont fournis : Devoirs Faits (OUI / NON / ULYSS),
fiche de renseignement, fiche d'orientation avec avis du PP.

À l'étape 4, l'app fait ce pour quoi elle existe : une grille élèves × relevés où l'on
tape le **cumul** lu dans chaque carnet (Entrée descend la colonne), et qui calcule
l'évolution depuis le relevé précédent, le Δ du dernier relevé, et les totaux par
semestre ou trimestre. Un cumul qui baisse est signalé, jamais corrigé. Le tri « par Δ »
donne la liste des élèves à voir en priorité.

À l'étape 3, l'app lit aussi un export JSON de *Plan de classe* : elle liste les
divisions du fichier, on coche **la sienne**, et seuls l'identité, le groupe, les options
et les aménagements de ses élèves sont repris — ids conservés, donc réimportable sans
doublon. Le réglage **semestres / trimestres** vit dans l'onglet Données.

À l'étape 2, l'app charge une vraie classe : on colle un export Pronote (ou on ouvre le
fichier — l'encodage Windows est reconnu), on vérifie dans l'aperçu ce qui a été compris,
on corrige les colonnes et l'interprétation des codes de groupes, puis on importe. Les
classes manquantes et les options (<code>LATIN</code>, <code>BIL</code>…) se créent au
passage. Les élèves se modifient, se filtrent, portent leurs aménagements et la remarque
libre du PP. Les quatre autres onglets n'affichent encore qu'un état vide disant ce qu'ils
accueilleront.

---

## Installation

**En ligne** : ouvrir le lien ci-dessus. Le navigateur propose de l'installer comme
application (PWA) ; elle fonctionne ensuite hors-ligne.

**En local** : télécharger le dépôt et ouvrir `suivi pp.html`. Aucune dépendance, aucun
serveur — le fichier fonctionne aussi bien en `file://` qu'en HTTPS.

## 🔒 Vie privée & RGPD

L'app manipule des **données personnelles d'élèves** : noms, prénoms, dates de naissance,
aménagements pédagogiques, journal des contacts avec les familles, relevés
d'observations, retours de documents, réponses des familles, et les incidents et
instances (sanctions comprises) avec, si vous les joignez, les PDF des fiches.

- Tout est stocké dans le **`localStorage` de votre navigateur** et dans les fichiers
  JSON que vous exportez. Rien ne part sur un serveur.
- La **seule** requête réseau est la vérification de mise à jour, qui interroge
  `api.github.com` et n'envoie **aucune donnée**. Elle est désactivable en coupant
  simplement la connexion : l'app fonctionne intégralement hors-ligne.
- Une politique de sécurité du contenu (CSP) restreint l'app à sa propre origine :
  même une faille d'injection résiduelle ne pourrait pas exfiltrer de données.
- En cadre professionnel, **déclarez l'outil au DPO de votre établissement**
  (souvent `dpo@ac-<votre-académie>.fr`).

## Développement

Tout tient dans `suivi pp.html` : CSS dans le `<style>` de tête, JS dans le `<script>`
de fin de body. Pas de build, pas de CDN, pas de dépendance.

```bash
npm test
```

Les tests tournent sous Node ≥ 18, sans aucune dépendance : le harnais extrait le
`<script>` de l'app, le charge dans un contexte `vm` avec un DOM stubé, et expose un
pont pour appeler les fonctions dans leur portée d'origine.

Les conventions du projet — et surtout les pièges déjà payés — sont dans `CLAUDE.md`.

## Crédits

Design system, moteur de sauvegarde, résolution de conflits et harnais de tests repris de
[Plan de classe](https://github.com/Belenos-Toutatis/plan-de-classe) (MIT, même auteur).

Polices embarquées, toutes sous SIL Open Font License 1.1 :
[Fraunces](https://github.com/undercasetype/Fraunces),
[IBM Plex Sans](https://github.com/IBM/plex),
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono).

## Licence

MIT — voir [LICENSE](LICENSE).
