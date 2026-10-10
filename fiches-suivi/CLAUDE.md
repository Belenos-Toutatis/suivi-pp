# Fiches de suivi

⚠️ **Depuis le 2026-10-10, ce projet vit ICI, dans le dépôt de Suivi PP (`fiches-suivi/`), et n'évolue plus que
depuis la session Suivi PP** (décision de l'utilisateur). L'ancien dossier `~/test` n'est plus la source.
**Une seule source, deux livraisons** :
- la version **autonome** (ce dossier, `app/`), qui s'enregistre dans sa propre page — celle qu'on donne aux collègues,
  **vierge** (avec la démonstration à essayer, et l'import d'une classe depuis la sauvegarde de Plan de classe) ;
- la version **intégrée** à Suivi PP (onglet 📋 Suivis), qui ne s'enregistre pas elle-même : elle transmet son état à
  Suivi PP, qui le range avec ses données (sync Nextcloud, sauvegardes, Ctrl+Z). *À construire.*
**Apparence** : celle de Suivi PP pour les deux (papier, Seyès, filet rouge, Andika à l'écran, Latin Modern au papier,
réglables comme dans Suivi PP ; les feuilles affichées à l'écran prennent la police d'impression, avec un bouton pour
basculer vers celle d'affichage). Une seule apparence : deux finiraient par diverger. Fait (cf. *Apparence et polices*).
⚠️ **Dépôt PUBLIC** : aucune donnée réelle, ni nom d'établissement (l'exemple est « Collège Les Tilleuls »), ni nom
d'élève ou de collègue. La démonstration est en noms fictifs (poissons pour les enseignants).


Application hors ligne, en un seul fichier HTML, pour le suivi du comportement des élèves.
Utilisateur : enseignant, professeur principal. **Toujours répondre en français.**

## Contenu du dossier

| Élément | Rôle |
|---|---|
| `app/Fiche de suivi collective.html` | L'application assemblée (version autonome). Un suivi s'enregistre **dans ce fichier** (Ctrl+S) — jamais celui du dépôt : on en donne une copie. |
| `app/` | Sources : `head.html` (HTML + CSS), `theme.css` (l'apparence de Suivi PP), `polices.css` (GÉNÉRÉ : `python3 scripts/gen_fonts.py --fiches`, depuis la racine du dépôt), `core.js` (données, calculs), `demo.js`, `ui.js`, `sections.js`, `tuto.js`, `edt_demo.min.json`, `assemble.py`. |
| `*.js`, `suite.sh` (à la racine de ce dossier) | Tests de bout en bout (Puppeteer). `boites.js` répond aux boîtes de dialogue internes. |
| `imp/` | Fichiers d'exemple pour l'import (csv, tsv, xlsx, ods, et `plan-de-classe.json`, une sauvegarde de Plan de classe aux noms inventés). |
| `compat/` | Fichiers de référence du format 1 (rétrocompatibilité), `mk_compat.js` les a créés. |
| `sorties/` | Captures et PDF produits par les tests (jetables, hors git). |

## Construire et tester

```bash
python3 fiches-suivi/app/assemble.py
```

- L'assemblage produit `app/Fiche de suivi collective.html`. Il concatène head.html, puis le bloc de données vide, puis core, demo, ui, sections et tuto.
- Vérification de syntaxe :
  ```bash
  cd fiches-suivi/app && cat core.js demo.js ui.js sections.js tuto.js > /tmp/tout.js && node --check /tmp/tout.js
  ```
- Suite complète (environ 10 min, Chrome dans `/opt/google/chrome/chrome`, Puppeteer global dans `/usr/local/lib/node_modules` —
  ⚠️ installés sur le poste Linux seulement) :
  ```bash
  bash fiches-suivi/suite.sh /tmp/resultats.txt
  ```
  - Chaque ligne indique `N ok, M échec(s)`.
  - Tout doit être à 0 échec, y compris `e2e_compat`.
- ⚠️ Le chemin du dépôt contient des espaces (« gestion élèves », « Suivi PP ») : tout chemin passé à une commande
  (`pdfinfo`, `pdftotext`…) se met entre guillemets. La suite marque **INTERROMPU** un test qui s'arrête en route
  (avant le 2026-10-10, un test planté comptait « 0 échec »).
- Un test qui écrit un fichier l'écrit dans `sorties/`. Les profils Chrome temporaires vont dans `sorties/chrome-tmp-*` et sont effacés à la fin.

## Livrer

- Le fichier assemblé `app/Fiche de suivi collective.html` est commité : c'est la version à donner (téléchargeable
  depuis GitHub). Le réassembler et relancer la suite avant chaque commit qui touche `app/`.
- Un fichier qui CONTIENT un suivi ne s'écrase jamais : la nouvelle version se dépose à côté, l'utilisateur fait
  « Reprendre un suivi » › l'ancien `.html`, puis Ctrl+S (`grep -c '"app":"fiche-suivi-collective"'` dit s'il y a des données).

## Apparence et polices (2026-10-10)

- **`theme.css`** donne les couleurs de Suivi PP (papier bleuté, encre bleu nuit, lignes Seyès, filet rouge de marge) en
  redéfinissant les variables que `head.html` emploie déjà (`--bg`, `--paper`, `--ink`, `--accent`…), dans les deux thèmes
  (`clair`, `sombre`), **à l'écran seulement** : l'impression garde la fiche papier classique. Changer d'apparence = toucher
  ce fichier. Les couleurs écrites en dur qui restaient (graphiques, calendrier) ont été ramenées au bleu.
- **Polices** : celles de Suivi PP, embarquées (`polices.css` : Andika, Latin Modern, JetBrains Mono — sous-ensemble ÉLARGI au
  latin étendu A, aux diacritiques et à l'espace fine insécable). Variables `--font-ui` (écran) et `--font-print` (papier) ;
  `--sans` suit la première, `--serif` (les feuilles) la seconde, et à l'impression tout prend `--font-print`.
  - Réglées dans **Fichier › Apparence** (« Police à l'écran », « Police à l'impression ») et **enregistrées avec le suivi** :
    `S.policeEcran = "lm"`, `S.policePapier = "andika"` ; ABSENTES = les défauts (Andika, Latin Modern) — un ancien suivi
    ne reçoit aucun champ, `e2e_compat` ne voit rien changer. `appliquerPolices()` pose `data-police` / `data-police-papier`.
  - **Les feuilles affichées à l'écran prennent la police d'impression** (on voit ce qui sortira) ; le bouton **Aa** d'une
    feuille les bascule dans la police d'affichage (`html.feuilles-ecran`, réglage de CE navigateur). Pas de bouton quand
    les deux polices sont les mêmes. Arbitré par l'utilisateur.
  - La marge des impressions (nom et logo de l'établissement, `@top-left`) prend la police d'impression.
  - ⚠️ Andika est plus large que la police système d'avant : un test qui clique au MILIEU d'un champ date tombe sur un autre
    segment. Cliquer sur le segment voulu (`e2e_audit5`, fonction `jour`).
- **Contraste** : `e2e_contraste.js` passe l'auditeur de Suivi PP (`../scripts/audit_browser.js`) sur chaque vue du menu et les
  réglages, 2 thèmes × 2 polices × 1366 et 1024 px.

## Import d'une classe depuis Plan de classe (2026-10-10)

`lignesPlanDeClasse(d)` (ui.js) lit une sauvegarde `.json` de Plan de classe et la rend sous la forme d'un export
(Nom · Prénom · Classe · Groupe · Options) : l'aperçu habituel (`importerEleves`) fait le reste — choix de la classe quand il
y en a plusieurs, groupe (« Groupe 1 »), options (le nom des étiquettes). Liste blanche ; classes virtuelles (recomposées)
écartées ; un suivi de cette appli n'est pas pris pour une sauvegarde de Plan de classe. Accessible par « Importer un
fichier… » des listes d'élèves, et dans l'accueil par **« Classe depuis Plan de classe (.json)… »** (nouveau suivi, puis
import ; la classe choisie nomme le suivi s'il n'a pas encore de nom).

## Rétrocompatibilité (obligatoire depuis la version du 10/10/2026)

Les versions antérieures au 10/10/2026 n'ont **pas** à être reprises, à la demande de l'utilisateur. Depuis cette date :

- L'enveloppe des données ne change pas : `{ app: "fiche-suivi-collective", format, savedAt, S }`.
  - Elle est rangée dans la balise script `id="donnees-suivi"` (type application/json) de la page, ou seule dans un `.json` (export).
  - **N'écrivez jamais cette balise complète dans le code ni dans un commentaire** : la page la prendrait pour le bloc de données.
- `normalizeState` (core.js) complète ce qui manque et convertit les anciennes formes. On ne renomme ni ne supprime jamais un champ sans conversion. Les champs inconnus sont gardés.
- `FORMAT_DONNEES` (core.js) n'augmente que si l'enveloppe change. À chaque changement de format, ajouter un fichier de référence dans `compat/`.
- `e2e_compat` doit rouvrir les fichiers de `compat/` sans perdre ni changer une seule valeur.

## Enregistrement

- `MODE_ENREG = "html"` : Ctrl+S réécrit la page elle-même, via `PAGE_SOURCE` dont on remplace le bloc de données.
- Chrome ou Edge écrivent directement (File System Access). Le premier enregistrement demande de choisir ce fichier-ci. Les autres navigateurs téléchargent une copie.
- Une copie de secours est gardée dans le navigateur (localStorage, clé propre au chemin du fichier).
- « Reprendre un suivi » accepte un autre `.html` de l'appli (par exemple une version précédente) ou un `.json`. « Exporter les données (.json) » fait une sauvegarde à part.

## Les familles de fiches (ordre toujours respecté : individuelles → collectives → classe)

1. **Fiches individuelles** : un élève, de 1 à 4 objectifs, une fiche par période de remise. Un seul suivi par élève.
2. **Suivi collectif** : quelques élèves, une fiche par jour, totaux, bilan par matière.
3. **Fiches de classe** : toute la classe, codes d'incidents par créneau, une page par semaine.
4. **Synthèse** (fiche élève, conseil de classe) et **Commun** (emploi du temps, réglages).

Chaque texte (infobulle, titre, message) dit de quelle famille il parle.

## Conventions de code (pièges déjà rencontrés)

- **Pas de commentaire `//` en fin de ligne si du code suit** : utiliser `/* */`. Un `//` a déjà « avalé » du code deux fois.
- **Infobulles** (attribut `title`) :
  - première ligne = titre ;
  - `\n` sépare les lignes, `• ` fait une puce, `**gras**` met en gras ;
  - jamais un paragraphe dense ;
  - dans `head.html`, le retour à la ligne s'écrit `&#10;`.
- **Typographie française** : les espaces fines insécables sont ajoutées **à l'affichage seulement** (`typoFr`, `typoNoeuds`, MutationObserver). Ne pas en mettre dans les sources ni dans les données.
- **Pluriels** : `nbMot(n, "élève")`, `nbMot(n, "créneau", "créneaux")`. Jamais de « (s) ».
- **Boîtes de dialogue** internes : `demander`, `informer`, `saisir`.
  - Option `valider` : l'erreur s'affiche dans la boîte, qui reste ouverte.
  - Option `echap` : valeur rendue par Échap.
- **Ctrl+Z** : `commit()` mémorise l'état ; `decrireChangement` dit ce qui a été annulé.
- **Écran** : tout doit fonctionner à **1024×768** (et 1366×768), en thème clair et sombre.
- **Impressions** : A4.
  - Logo et nom de l'établissement sur toutes les impressions. Dans la marge (`@page` + `@top-left`), ou dans la page sur les fiches à cocher s'il reste de la place.
  - Noms de PDF du plus général au plus précis : « Suivi 5E - famille - élève - type - période ».

## Décisions de l'utilisateur (à ne pas remettre en cause)

- **Interface**
  - Menu latéral réduit : il s'ouvre au survol, par-dessus la page, jamais ouvert par défaut.
  - Pastilles : rouge = cadre plein, orange = cadre pointillé (lisibles en noir et blanc). Seuils toujours dans l'ordre rouge ≤ orange ≤ vert clair ≤ vert. Le vert n'apparaît que si « Pastilles vertes aussi » est coché, et jamais avec une croix « I ».
- **Impressions**
  - Totaux de plus de 8 élèves et fiche collective trop chargée (lignes de moins de 3,4 mm) : pages équilibrées (1/N…).
  - Les remarques « au dos » de la fiche de classe ne s'impriment pas sur la fiche.
- **Calendrier et horaires**
  - Découpage par défaut : semestres (le collège de l'utilisateur). Les trimestres restent possibles.
  - Mercredi matin décalé de 30 min par défaut.
  - Horaires probables seulement : séance de 45 à 60 min (un cours de 1 h 50 ou 2 h, ce sont deux séances), journée entre 7 h et 18 h 30, pas de chevauchement.
- **Élèves et groupes**
  - Un nom de groupe est unique, sans tenir compte des majuscules ni des accents.
  - Un élève n'est que dans un seul demi-groupe (« Groupe 1 », « Gr. 2 », « G3 »…). Les options se cumulent.
  - Deux élèves d'une même liste ne peuvent pas avoir le même nom : les fiches sont reliées par le nom.
- **Suivis individuels** : l'avis (« Maintien nécessaire »…) ne compte la fiche de la semaine qu'à partir de son jour de remise.
- **Démonstration** : noms fictifs, jamais « Dupont » ni « Michel ».

## Hors champ

Safari, Excel et Google Sheets ne sont pas pris en charge. Ne rien envoyer sur Internet sans accord explicite. Ne jamais utiliser `pkill -f`.
