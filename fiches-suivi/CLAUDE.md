# Fiches de suivi

Application hors ligne, en un seul fichier HTML, pour le suivi du comportement des élèves (enseignant, professeur principal).
**Toujours répondre en français.** Le projet vit ICI (`fiches-suivi/` du dépôt Suivi PP) et n'évolue que depuis la session
Suivi PP ; l'ancien dossier `~/test` n'est plus la source.

**Une seule source, deux livraisons :**
- **autonome** (`app/Fiche de suivi collective.html`), pour les collègues : **vierge**, s'enregistre dans sa propre page,
  démonstration à essayer, import d'une classe depuis un tableur ou une sauvegarde de Plan de classe ;
- **intégrée** à Suivi PP (onglet 📋 Suivis) : ne s'enregistre pas, transmet son état à Suivi PP (cf. *Version intégrée*).
Une seule apparence pour les deux, celle de Suivi PP (deux finiraient par diverger).

⚠️ **Dépôt PUBLIC** : aucune donnée réelle — ni établissement (l'exemple est « Collège Les Tilleuls »), ni élève, ni collègue.
Démonstration en noms fictifs (poissons pour les enseignants), jamais « Dupont » ni « Michel ».

## Contenu du dossier

| Élément | Rôle |
|---|---|
| `app/Fiche de suivi collective.html` | L'application assemblée (autonome), commitée : c'est la version à donner. Un suivi s'enregistre dans une COPIE, jamais dans celle du dépôt. |
| `app/` | Sources : `head.html` (HTML + CSS), `theme.css` (apparence de Suivi PP), `polices.css` (GÉNÉRÉ : `python3 scripts/gen_fonts.py --fiches` depuis la racine), `core.js` (données, calculs), `demo.js`, `ui.js`, `sections.js`, `tuto.js`, `edt_demo.min.json`, `assemble.py`. |
| `*.js`, `suite.sh` | Tests de bout en bout (Puppeteer) ; `boites.js` répond aux boîtes de dialogue internes. |
| `imp/` | Fichiers d'exemple pour l'import (csv, tsv, xlsx, ods, `plan-de-classe.json` aux noms inventés). |
| `compat/` | Fichiers de référence du format 1 (créés par `mk_compat.js`). |
| `sorties/` | Captures et PDF des tests (jetables, hors git ; profils Chrome `sorties/chrome-tmp-*`, effacés à la fin). |

## Construire, tester, livrer

- `python3 fiches-suivi/app/assemble.py` : écrit la version autonome ET la version intégrée, compressée, dans `../suivi pp.html`
  (entre `<!-- FICHES-SUIVI-DEBUT` et `<!-- FICHES-SUIVI-FIN -->`) ; `--autonome` : la première seulement. Ordre : head.html, bloc
  de données vide, core, demo, ui, sections, tuto.
  - ⚠️ Écrire dans `suivi pp.html` change Suivi PP : avancer `APP_VERSION` et `APP_BUILD_DATE`, documenter la nouveauté dans le
    CLAUDE.md de Suivi PP. `test/fiches-suivi.test.js` refuse un bloc retouché à la main (empreinte).
- Syntaxe : `cd fiches-suivi/app && cat core.js demo.js ui.js sections.js tuto.js > /tmp/tout.js && node --check /tmp/tout.js`.
- Suite complète, ~15 min, **poste Linux seulement** (Chrome `/opt/google/chrome/chrome`, Puppeteer global
  `/usr/local/lib/node_modules`) : `bash fiches-suivi/suite.sh /tmp/resultats.txt` — une ligne `N ok, M échec(s)` par test, tout à
  0 échec, `e2e_compat` compris ; un test arrêté en route est marqué **INTERROMPU**.
- ⚠️ Le chemin du dépôt contient des espaces : tout chemin passé à une commande (`pdfinfo`, `pdftotext`…) entre guillemets.
- Réassembler et relancer la suite avant tout commit qui touche `app/`.
- ⚠️ Un fichier qui CONTIENT un suivi ne s'écrase jamais : la nouvelle version se dépose à côté, puis « Reprendre un suivi » ›
  l'ancien `.html`, puis Ctrl+S (`grep -c '"app":"fiche-suivi-collective"'` dit s'il y a des données).
- **Donner la version autonome** : le fichier du dépôt, ou **📋 Télécharger la fiche de suivi autonome** dans Suivi PP (💾 Données ▸
  Importer · exporter, et menu Fichier de l'onglet 📋 Suivis : bouton `#b-autonome`, visible en version intégrée seulement, message
  `autonome`). Suivi PP la reconstruit depuis la page intégrée qu'il garde (`_suivisAutonomeDepuis` : retire `data-hote` et
  `class="integree"`, pose ses polices) : identique au fichier du dépôt, et refusée si le bloc de données n'est pas vide.

## Apparence et polices

- **`theme.css`** redéfinit les variables de `head.html` (`--bg`, `--paper`, `--ink`, `--accent`…) aux couleurs de Suivi PP
  (papier bleuté, encre bleu nuit, Seyès, filet rouge), thèmes `clair` et `sombre`, **à l'écran seulement** : l'impression garde
  la fiche papier classique.
- **Polices** de Suivi PP embarquées (`polices.css` : Andika, Latin Modern, JetBrains Mono — sous-ensemble élargi au latin étendu A,
  diacritiques, espace fine insécable). `--font-ui` (écran) et `--font-print` (papier) ; `--sans` suit la première, `--serif`
  (les feuilles) la seconde ; à l'impression tout prend `--font-print`.
  - Réglées dans **Fichier › Apparence**, enregistrées avec le suivi : `S.policeEcran = "lm"`, `S.policePapier = "andika"` ;
    absentes = les défauts (un ancien suivi ne reçoit aucun champ). `appliquerPolices()` pose `data-police` / `data-police-papier`.
  - Les feuilles affichées à l'écran prennent la police d'IMPRESSION ; le bouton **Aa** les bascule dans celle d'affichage
    (`html.feuilles-ecran`, réglage du navigateur ; absent quand les deux polices sont les mêmes). Arbitré par l'utilisateur.
  - La marge des impressions (`@top-left` : nom et logo de l'établissement) prend la police d'impression.
  - ⚠️ Andika est large : un test qui clique au MILIEU d'un champ date tombe sur un autre segment — viser le segment (`e2e_audit5`,
    fonction `jour`).
- **Contraste** : `e2e_contraste.js` passe l'auditeur de Suivi PP (`../scripts/audit_browser.js`) sur chaque vue et les réglages,
  2 thèmes × 2 polices × 1366 et 1024 px.

## Import d'une classe depuis Plan de classe

`lignesPlanDeClasse(d)` (ui.js) lit une sauvegarde `.json` de Plan de classe et la rend comme un export (Nom · Prénom · Classe ·
Groupe · Options) ; l'aperçu habituel (`importerEleves`) fait le reste (choix de la classe, « Groupe 1 », options par le nom des
étiquettes). Liste blanche ; classes virtuelles écartées ; un suivi de cette appli n'est pas pris pour une sauvegarde de Plan de
classe. Par « Importer un fichier… » des listes d'élèves, et dans l'accueil par **« Classe depuis Plan de classe (.json)… »**
(nouveau suivi, puis import ; la classe nomme le suivi s'il n'a pas de nom).

## Version intégrée à Suivi PP (onglet 📋 Suivis)

La même page, assemblée avec `<html data-hote="suivi-pp" class="integree">` et `/*POLICES-HOTE*/` à la place des polices (Suivi PP
y pose les siennes). Suivi PP la décompresse (`DecompressionStream('deflate-raw')`) et la charge par **`srcdoc`**. Tout ce qui lui
est propre passe par `HOTE` (ui.js, bloc « hôte »). Le côté Suivi PP est décrit dans son CLAUDE.md, *Fiches de suivi*.
- ⚠️ **`srcdoc`, pas une URL de blob** : en `file://`, un blob a l'origine « null » et refuse les changements d'ancre (toute la
  navigation). Mais en `srcdoc` la base est l'adresse de Suivi PP (un `href="#edt"` y chargerait Suivi PP) et `<base>` est refusé
  par sa politique (`base-uri 'self'`) : la fiche intercepte ses liens `#…` (écouteur `click` sur `window`, en dernier).
- **Messages** (postMessage, `app: "suivi-pp"` → fiche, `app: "fiche-suivi"` → Suivi PP, vérifiés par leur source). Suivi PP envoie
  `charger` (`cle` = la classe, `etat`, `classe` = la liste, `demo`, `theme`, `polices`, `pile`, `raison` : `annuler` / `retablir`),
  `apparence`, `pile`, `imprimer` (Ctrl+P), `commun`, `aller` (`#eleve/…`). La fiche envoie `pret`, `etat` (`cle`, l'enveloppe,
  `etape`, `retirer`), `annuler` (`sens`) et `autonome`.
- **Rien ne s'enregistre dans la fiche** : `persist()` envoie l'état (s'il a changé) ; aucune clé `localStorage` propre à la page
  (son adresse change à chaque ouverture : elles s'accumuleraient) ; ni `dirty`, ni Enregistrer, nouveau suivi, démonstration,
  nouvelle année, thème ou polices dans le menu.
- **Page fermée pendant une frappe** : un commentaire part après 0,4 s (`persistBientot`) ; `window.__ficheEnAttente()` rend de
  façon synchrone le message pas encore envoyé (Suivi PP l'appelle en se fermant, `_suivisRecupererFrappe`).
- **La pile d'annulation est celle de Suivi PP** : `memoriser()` décide où commence une étape (frappe continue = une étape) ;
  `hoteEtape` → Suivi PP pose un cran avec cet envoi ; saisie refusée après l'envoi → `retirer`. Ctrl+Z / Ctrl+Y / ↶ → `annuler` ;
  le suivi revient par `charger` avec la raison et la fiche dit ce qui a été annulé (`decrireChangement`).
- **La liste de la classe vient de Suivi PP** (`appliquerClasseHote`) : « NOM Prénom », « Groupe N », options par leur code,
  arrivée, départ (premier jour d'absence là-bas, dernier jour présent ici).
  - ⚠️ **Chaque élève garde SA ligne** : les codes de la fiche de classe sont rangés par POSITION (`j.cl["s.p"]`). Reconnu par son
    nom (ou ses mots dans un autre ordre), il est mis à jour ; nouveau, ajouté à la FIN ; parti, daté ; supprimé dans Suivi PP, sa
    ligne RESTE, signalée « pas dans Suivi PP », à retirer à la main dans Réglages.
  - Les renommages faits dans Suivi PP (d'après les noms envoyés la dernière fois) suivent partout (classe, suivi collectif, suivis
    individuels). Groupes venus de Suivi PP : pas renommables ici ; ceux créés ici se cochent dans la liste en lecture. Le nom de
    classe n'est posé que s'il est vide.
- **Accueil** d'une classe sans suivi : commencer, ou reprendre un suivi de la version autonome (`.html` ou `.json`, un cran
  d'annulation). Jamais la démonstration sur une vraie classe.
- **Démonstration** : seulement sur une classe de démonstration de Suivi PP (`demo: true`) : `demoHote` prend la démonstration de
  l'appli aux noms de la classe (rang pour rang), déplacée de semaines entières dans son année scolaire, calendrier de cette année.
- **Pour la fiche élève de Suivi PP** : `window.__ficheResumeEleve(etat, nom, du, au)` et `__ficheResumeEleves(etat, noms, du, au)`
  (carte de chaleur) rendent ce que les fiches disent d'un élève entre deux dates, par les calculs de la fiche élève de l'appli
  (`donneesSynthEleve`, `famillesUtilisees`, `niveauReussite`) sur un suivi passé en argument (état courant échangé le temps du
  calcul, caches vidés avant et après), en données simples. ⚠️ Toute évolution de ces calculs se voit dans Suivi PP : garder la
  forme du résultat (cf. `_suivisCorpsHTML`).
- **Réglages communs** (`appliquerCommunHote`, message `commun`) : classe, établissement, référent, découpage, et pour chaque matière
  rattachée à une discipline son enseignant, son champ disciplinaire et ses codes d'option. Reçus de Suivi PP (une valeur vide ne
  remplace rien) ; modifiés ici, ils repartent avec le suivi. Champs marqués d'un trait bleu (`marquerCommunsHote`).
  **Pinceau de l'emploi du temps** : une matière dont la discipline est une OPTION (`profs[mat].codes`) se peint d'office pour le
  groupe de même nom (`cleNom`), un toast le dit ; « Toute la classe » pour changer.
- Tests : `e2e_integre.js` (le vrai `suivi pp.html`, en `file://`) ; côté Suivi PP, `test/fiches-suivi.test.js`.

## Champs disciplinaires

`CHAMPS` (core.js) = les domaines de Suivi PP (`langues`, `lettres`, `sciences`, `arts`, `eps`, `autre`, mêmes libellés).
`S.matieres[i].champ` n'est écrit que s'il est CHOISI (réglages › Matières, menu « Champ » ; ou reçu de Suivi PP), sinon
`champDefaut(nom)` le déduit du nom (motifs ; ⚠️ l'EPS avant les sciences : « Éd. physique » contient PHYSIQUE).
`matieresParChamp(st)` range (ordre des champs, puis de la liste), `ordreMatieres(st)` en donne les noms. Suivent ce rangement : la
palette de l'emploi du temps (un paquet par champ), les réglages (un intertitre par champ ; les `data-path` gardent l'index du
tableau), les menus de matière (`optgroupsMatieres`), le menu du créneau, les trois bilans par matière (`tr.nv-champ` : un trait entre
deux champs, sans ligne de plus — les tests comptent les lignes). ⚠️ Les COULEURS des matières ne changent pas (rang dans la liste).
Test : `e2e_champs.js`.

## Rétrocompatibilité (obligatoire depuis le 10/10/2026 ; les versions antérieures n'ont pas à être reprises)

- L'enveloppe ne change pas : `{ app: "fiche-suivi-collective", format, savedAt, S }`, rangée dans la balise script
  `id="donnees-suivi"` (type application/json) de la page, ou seule dans un `.json` (export).
  - ⚠️ **N'écrivez jamais cette balise complète dans le code ni dans un commentaire** : la page la prendrait pour le bloc de données
    (et, dans le script de Suivi PP, sa balise de fin fermerait le script).
- `normalizeState` (core.js) complète ce qui manque et convertit les anciennes formes ; on ne renomme ni ne supprime un champ sans
  conversion ; les champs inconnus sont gardés.
- `FORMAT_DONNEES` n'augmente que si l'enveloppe change ; chaque changement de format ajoute un fichier de référence dans `compat/`.
- `e2e_compat` rouvre les fichiers de `compat/` sans perdre ni changer une seule valeur.

## Enregistrement (version autonome)

- `MODE_ENREG = "html"` : Ctrl+S réécrit la page elle-même (`PAGE_SOURCE`, dont on remplace le bloc de données) ; `"hote"` en
  version intégrée.
- Chrome et Edge écrivent directement (File System Access ; le premier enregistrement demande ce fichier-ci) ; les autres
  navigateurs téléchargent une copie. Copie de secours dans le navigateur (`localStorage`, clé propre au chemin du fichier).
- « Reprendre un suivi » : un autre `.html` de l'appli ou un `.json`. « Exporter les données (.json) » : une sauvegarde à part.

## Les familles de fiches (ordre toujours respecté : individuelles → collectives → classe)

1. **Fiches individuelles** : un élève, 1 à 4 objectifs, une fiche par période de remise ; un seul suivi par élève.
2. **Suivi collectif** : quelques élèves, une fiche par jour, totaux, bilan par matière.
3. **Fiches de classe** : toute la classe, codes d'incidents par créneau, une page par semaine.
4. **Synthèse** (fiche élève, conseil de classe) et **Commun** (emploi du temps, réglages).

Chaque texte (infobulle, titre, message) dit de quelle famille il parle.

## Conventions de code (pièges déjà rencontrés)

- ⚠️ **Pas de commentaire `//` en fin de ligne si du code suit** : `/* */` (un `//` a déjà « avalé » du code deux fois).
- **Infobulles** (`title`) : première ligne = titre ; `\n` sépare les lignes, `• ` fait une puce, `**gras**` met en gras ; jamais un
  paragraphe dense ; dans `head.html`, retour à la ligne = `&#10;`.
- **Typographie française** : espaces fines insécables ajoutées **à l'affichage seulement** (`typoFr`, `typoNoeuds`,
  MutationObserver), jamais dans les sources ni les données.
- **Pluriels** : `nbMot(n, "élève")`, `nbMot(n, "créneau", "créneaux")`, jamais « (s) ».
- **Boîtes de dialogue** internes : `demander`, `informer`, `saisir` (option `valider` : l'erreur s'affiche dans la boîte, qui
  reste ouverte ; `echap` : valeur rendue par Échap).
- **Ctrl+Z** : `commit()` mémorise l'état ; `decrireChangement` dit ce qui a été annulé.
- **Écran** : tout fonctionne à 1024×768 (et 1366×768), thèmes clair et sombre.
- **Impressions** A4 : logo et nom de l'établissement partout (marge `@page` + `@top-left`, ou dans la page sur les fiches à
  cocher s'il reste de la place) ; noms de PDF du plus général au plus précis (« Suivi 5E - famille - élève - type - période »).

## Décisions de l'utilisateur (à ne pas remettre en cause)

- **Interface** : menu latéral réduit, ouvert au survol par-dessus la page, jamais ouvert par défaut. Pastilles : rouge = cadre
  plein, orange = cadre pointillé (lisibles en noir et blanc) ; seuils rouge ≤ orange ≤ vert clair ≤ vert ; le vert seulement si
  « Pastilles vertes aussi » est coché, jamais avec une croix « I ».
- **Impressions** : totaux de plus de 8 élèves et fiche collective trop chargée (lignes < 3,4 mm) → pages équilibrées (1/N…) ; les
  remarques « au dos » de la fiche de classe ne s'impriment pas sur la fiche.
- **Calendrier et horaires** : semestres par défaut (trimestres possibles) ; mercredi matin décalé de 30 min par défaut ; horaires
  probables seulement (séance de 45 à 60 min — un cours de 2 h = deux séances —, journée entre 7 h et 18 h 30, pas de
  chevauchement).
- **Élèves et groupes** : nom de groupe unique (sans casse ni accents) ; un élève dans un seul demi-groupe (« Groupe 1 », « Gr. 2 »,
  « G3 »…), les options se cumulent ; deux élèves d'une liste ne portent pas le même nom (les fiches sont reliées par le nom).
- **Suivis individuels** : l'avis (« Maintien nécessaire »…) ne compte la fiche de la semaine qu'à partir de son jour de remise.

## Hors champ

Safari, Excel et Google Sheets ne sont pas pris en charge. Ne rien envoyer sur Internet sans accord explicite. Ne jamais
utiliser `pkill -f`.
