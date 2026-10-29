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

## Détail par sujet — `fiches-suivi/docs/` (lire le fichier AVANT de toucher au sujet)

| Fichier | Sections |
|---|---|
| `docs/integration.md` | *Version intégrée à Suivi PP (onglet 📋 Suivis)* : `srcdoc`, messages, pile d'annulation, liste de la classe, démonstration, résumés pour la fiche élève, réglages communs |
| `docs/apparence.md` | *Apparence et polices* : `theme.css`, polices, bouton **Aa**, contraste |
| `docs/import-enregistrement.md` | *Import d'une classe depuis Plan de classe* ; *Enregistrement (version autonome)* |
| `docs/champs.md` | *Champs disciplinaires* : `CHAMPS`, `champDefaut`, rangement par champ |

## Rétrocompatibilité (obligatoire depuis le 10/10/2026 ; les versions antérieures n'ont pas à être reprises)

- L'enveloppe ne change pas : `{ app: "fiche-suivi-collective", format, savedAt, S }`, rangée dans la balise script
  `id="donnees-suivi"` (type application/json) de la page, ou seule dans un `.json` (export).
  - ⚠️ **N'écrivez jamais cette balise complète dans le code ni dans un commentaire** : la page la prendrait pour le bloc de données
    (et, dans le script de Suivi PP, sa balise de fin fermerait le script).
- `normalizeState` (core.js) complète ce qui manque et convertit les anciennes formes ; on ne renomme ni ne supprime un champ sans
  conversion ; les champs inconnus sont gardés.
- `FORMAT_DONNEES` n'augmente que si l'enveloppe change ; chaque changement de format ajoute un fichier de référence dans `compat/`.
- `e2e_compat` rouvre les fichiers de `compat/` sans perdre ni changer une seule valeur.

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
  Elles sont dessinées par l'appli (`#bulle`, ui.js : le `title` passe dans `data-tip`), jamais par le navigateur — sous Linux
  (Wayland) sa bulle sort parfois sur fond transparent, illisible. Les `<title>` des graphiques SVG (barres, points de courbe) aussi :
  `cibleInfobulle` les trouve, `preparerBulle` les passe dans `data-tip` (le nom accessible devient `aria-label`). Test `e2e_bulles_graphes`.
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
