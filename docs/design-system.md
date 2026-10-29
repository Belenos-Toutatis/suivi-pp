# Design system, polices, infobulles, audit de contraste

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Design system

**Polices : Andika à l'écran, Latin Modern Roman au papier — chacune au choix** (arbitré par l'utilisateur : Latin Modern au papier par défaut, Andika à l'écran avec Latin Modern possible dans les réglages, même choix pour l'impression).
- Deux familles embarquées en base64, quatre variantes chacune, sous-ensemble latin (Andika 72 Ko, Latin Modern 84 Ko), **régénérées par `scripts/gen_fonts.py`** (entre les marqueurs `/* ANDIKA-DEBUT */…` et `/* LM-DEBUT */…`). Licences : Andika SIL OFL 1.1, Latin Modern GUST Font License.
- Tokens : `--font-andika`, `--font-lm`, `--font-ui` (écran, Andika), `--font-print` (papier, Latin Modern). `--font-sans` et `--font-serif` — les noms que tout le CSS emploie — **suivent `--font-ui`**, titres compris. Le choix est posé sur `<html>` par `_applyPolices()` (`data-police="lm"`, `data-police-papier="andika"`) depuis `S.prefs.policeEcran` / `policePapier` ; appelée en fin de `postLoadHook` (donc après chargement, undo, sync) et par `setPref`. Valeur inconnue → défaut.
- ⚠️ **Fraunces et IBM Plex Sans RETIRÉES** (inutilisées, 430 Ko). **JetBrains Mono reste** pour les chiffres des grilles (chasse fixe).
- `.print-area *` et le PV prennent `--font-print` en `!important` (les cellules portent des styles en ligne à l'écran).
- ⚠️ Les polices doivent être **chargées avant toute mesure** (`_printFontLoad`, qui charge les DEUX familles : au démarrage, à l'ouverture des modales d'impression, avant `window.print`) : une police `swap` ne se charge qu'au premier usage et une mesure avec la police de repli choisirait une taille fausse. Changer la police du papier change la taille calculée des feuilles « une page ».
- Andika étant plus large qu'IBM Plex, c'est le débordement qu'il faut surveiller aux audits.

**Les infobulles sont dessinées par l'app** (v1.72.0, bloc « Infobulles dessinées par l'app ») : les bulles NATIVES (`title`, `<title>` d'un SVG) sont dessinées par le navigateur et le système, et sous Linux (Wayland) leur fond sortait transparent — texte blanc sur page claire, illisible ; rien dans la page n'y change rien. Au survol À LA SOURIS (`pointerover`, `pointerType === 'mouse'`), le texte passe le temps du survol dans `data-bulle` (ou le `<title>` SVG est vidé), `#bulle` l'affiche après 450 ms (`_bulleMontrer`, position pure `_bullePlace` : sous le curseur, au-dessus près du bas ou quand la photo d'un élève occupe le dessous), et le texte revient à la sortie (`_bulleRendre` — sans écraser un `title` posé entre-temps par le code). Clic, touche, molette, défilement masquent seulement. Tokens `--bulle-bg/-fg/-bd` aux trois endroits (sombre sur la page claire, clair sur la page sombre), z-index au-dessus de toute fenêtre. ⚠️ Rien à changer dans le code : on continue d'écrire des `title`. L'auditeur accepte `data-bulle` comme infobulle. La fiche de suivi (cadre `srcdoc` de 📋 Suivis) a SES bulles dessinées, plus riches (titre, puces, gras : `#bulle` de `fiches-suivi/app/ui.js`) ; depuis la v1.72.2, les `<title>` de ses graphiques y passent aussi (cf. `fiches-suivi/CLAUDE.md`).

**Tous les tableaux imprimés ont le même visuel** : `.print-t` (retours d'un document, grille élèves × documents, bilans en pied, ancienne feuille) reprend celui de `.pp-t` — en-tête grisé souligné de noir et **répété à chaque page**, filets horizontaux, une rangée sur deux grisée (`print-color-adjust: exact`, sinon le navigateur retire les fonds), aucune rangée coupée. Le **PV** garde son quadrillage complet (pièce signée) avec en-tête gris et rangées alternées. Test statique `test/polices.test.js`, avec méta-test.

Reprendre le design « carnet du prof » **à l'identique** : tokens, polices embarquées, filet rouge de marge, lignes Seyès, thème sombre, bloc de neutralisation à l'impression.

⚠️ **Les quatre règles les plus coûteuses du projet de référence :**

1. **Tout token de couleur se déclare à TROIS endroits** : `:root`, `html[data-theme="dark"]`, et `@media print { html[data-theme="dark"] { … } }`. Oublié au troisième, il s'imprime en couleurs de nuit sur papier blanc.
2. **Un fond clair posé pour le mode clair a besoin d'une variante sombre**, pas seulement d'une encre adaptée (un pastel fait un trou de lumière dans le bleu nuit).
3. **Un accent utilisé en FOND et en TEXTE a besoin de deux valeurs** (`--x-bg` et `--x-fg`) : l'arbitrage s'inverse avec le thème.
4. **Jamais `color:#fff` en dur sur un fond coloré**, surtout pas sur une couleur choisie par l'utilisateur (couleurs d'options de documents). Toujours `_contrastTextColor(bg)`, qui tranche par contraste WCAG réel via `_wcagContrast`.

**Méthode d'audit du contraste** (à rejouer après toute retouche de couleur) : injecter un auditeur qui parcourt le DOM, calcule le fond effectif en remontant les parents transparents et l'opacité cumulée, puis le contraste de chaque nœud portant du texte propre. Seuil 4,5:1 (3,0 pour le grand texte). Quatre conditions sans lesquelles la mesure ne vaut rien :
- **des données partout** (un onglet vide passe pour propre) ;
- **les sous-états** autant que les onglets ;
- **les modales**, statiques (forcer la classe `on`) comme dynamiques (par leur vrai ouvreur) ;
- **transitions neutralisées** (`*{transition:none!important;animation:none!important}`) : une puce saisie à mi-parcours produit de faux écarts.
