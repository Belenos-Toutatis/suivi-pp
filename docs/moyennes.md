# Moyennes par matière

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Moyennes par matière

L'utilisateur exporte les moyennes du bureau numérique en CSV (export réel : `moyennes_5e_premier_semestre_6eme_5eme_4eme_20260929.csv`) :

```
Nom et prénom de l'élève;Périodes;ANGLAIS LV2(Mme X);…;MATHEMATIQUES(M. Y, Mme Z);…;Moy.
MARTIN Noé;Premier semestre 6ème 5ème 4ème;11;12;15;9;14;12,2
```

Point-virgule, virgule décimale, UTF-8 (repli Windows-1252 gardé), une matière par colonne avec ses professeurs entre parenthèses, la moyenne générale en dernier, des cases VIDES quand un collègue n'a pas encore noté. Il **réimporte au fil de la période** pour voir l'évolution, et **des colonnes apparaissent** d'un fichier à l'autre.

```js
releveMoy = {
  id, date: 'YYYY-MM-DD',   // date d'extraction — lue dans le nom du fichier (…_20260929.csv)
  periode,                  // la colonne « Périodes » telle quelle ; sinon S1/T1 déduit de la date
  label, ts, fichier,
  matieres: [ mid, … ],     // colonnes PRÉSENTES dans ce fichier
  profs:    { [mid]: 'M. Y, Mme Z' },   // par import : un remplaçant change le nom, pas la matière
  notes:    { [sid]: { [mid]: nombre | 'code' } },
  generale: { [sid]: nombre | 'code' }, // la colonne « Moy. » du fichier, jamais recalculée
}
```

- **Un import est une PHOTOGRAPHIE, jamais réécrite.** L'évolution se calcule entre deux imports ; rien n'est stocké en delta (même logique qu'au carnet : on stocke ce qu'on a lu).
- ⚠️ **Une matière est reconnue par son NOM normalisé** (`_moyNorm` : sans accents, casse ni ponctuation), via le catalogue `S.matieres`, **jamais par sa position** dans le fichier : une colonne nouvelle s'insère n'importe où sans décaler les autres. L'ordre des colonnes à l'écran est celui du catalogue (première apparition), pas celui du fichier du jour.
- ⚠️ **Une colonne ENTIÈREMENT vide ne crée pas la matière** dans cet import (« aucune note saisie », pas une matière) : sinon chaque export ferait naître des colonnes mortes. Elle apparaît au premier import où un collègue a noté, signalée `nouvelle` (`_moyColNouvelle`) par rapport à l'import précédent de la période.
- **Trois états d'une case, comme au carnet** : un nombre (⚠️ **0 compris, c'est une note**), un **code** du bureau numérique (`Abs`, `Disp`, `NN`…) conservé tel quel, l'**absence de clé** = pas de note. Seuls les nombres entrent dans les statistiques ; un code s'affiche en italique, un vide en tiret.
- ⚠️ **L'évolution ne traverse pas les périodes** : les moyennes repartent de zéro à chaque période, comparer S2 à S1 donnerait un Δ sans sens. `_moyPrev` ne cherche que dans les imports de la **même** `periode`, et remonte au dernier import où la case était un NOMBRE (un code ou un vide ne se soustrait pas).
- **Même date + même période = REMPLACEMENT**, pas empilement (réexport après une saisie). L'aperçu le dit avant l'import ; changer la date garde les deux.
  - Modifier un import (`moyEditOk` / `moyReleveEdit`) : le refus « date prise » ne vaut que si la date ou la période CHANGE (un doublon hérité reste modifiable, libellé seul) ; OK sans rien changer ne pose aucun cran d'undo.
  - ⚠️ La période d'un fichier SANS colonne « Périodes » est celle que la date donne (`_periodOf`), dans l'aperçu (`_moyImpRefresh`) comme dans `moyImport` : sinon l'aperçu n'annonce pas le remplacement. ⚠️ Corriger la date d'un import vers celle d'un AUTRE import de la même période est refusé (`moyReleveEdit` rend `false`, `moyEditOk` le dit, aucune mutation ni cran d'undo) : cela ferait deux imports identiques.
- **Plusieurs périodes dans un même fichier** (export annuel) → un import par période.
- **Rapprochement des élèves** (`_moyMatch`) : clé = mots du nom complet sans accents ni casse, **triés** (l'export écrit « NOM Prénom », la classe connaît nom et prénom à part ; les prénoms composés perdent leur trait d'union d'un côté ou de l'autre).
  - ⚠️ Deux homonymes parfaits dans la classe → **rien n'est deviné**, la ligne passe au rattachement manuel.
  - Une ligne non reconnue n'est jamais importée d'office : l'aperçu propose un sélecteur, par défaut « ignorer ». Les élèves de la classe **absents du fichier** sont nommés dans l'aperçu.
- L'import ne crée **aucun élève** : le roster vient de l'onglet Élèves.

### Statistiques — deux choix à ne pas « corriger »

- ⚠️ **Écart type de POPULATION (σ, divisé par n)** : la classe n'est pas un échantillon, c'est la population entière. C'est `ÉCARTYPE.P` du tableur, pas `ÉCARTYPE` (n − 1). Un écart avec un tableur vient de là.
- ⚠️ **« Sous 10 » = strictement moins de 10 ; 10 pile compte dans « 10 et plus »** : la moyenne est atteinte. Les deux compteurs somment toujours à `n` (testé).
- Les statistiques du tableau portent sur les **lignes affichées** (élèves présents, plus les partis qui figurent dans l'import) ; celles de la vue Évolution, sur tout l'import.
- La ligne « Moyenne » porte l'évolution de la **moyenne de classe** depuis l'import précédent ; la vue 📈 Évolution déroule n'importe laquelle des huit statistiques, import après import.

### Affichage

- **Intitulés abrégés** (`_moyAbbr` : SVT, EPS, Maths, Hist.-géo.…), nom complet et professeurs en infobulle. Seul ce qu'on sait abréger l'est ; une matière inconnue garde son intitulé (les intitulés complets, coupés en plein mot sur onze colonnes, rendaient la grille illisible).
  - Les intitulés réels « SCIENCES VIE & TERRE » et « ÉD.PHYSIQUE & SPORT. » s'abrègent en SVT et EPS (forme normalisée, `_MOY_ABBR`).
- Cases **sous 10 sur fond d'alerte** (`--alert-bg` / `--alert-fg`), Δ en `--ok-fg` / `--danger-fg`, et dans une case d'alerte le Δ reprend l'encre de la case.
- Tri par moyenne générale, par évolution, par nombre de matières sous 10, ou par une matière (clic sur l'en-tête) : **toujours la plus basse d'abord** (on trie pour voir qui décroche).
- **Fiche élève** : section 📈 en lecture seule (la source est l'import), une table par période, **transposée** (matières en lignes, imports en colonnes : beaucoup plus de matières que d'imports). **Liste des élèves** : colonne « Moy. » (dernière moyenne générale, Δ, nombre de matières sous 10), triable par l'en-tête (la plus basse d'abord au premier clic, les élèves sans moyenne au bout dans les deux sens), reprise à l'impression de la liste.
- **Cadre figé** (`.rel-wrap.frozen`, cf. *Grilles*) : les deux vues rendent `[tableau, légende]` et c'est `renderMoyennes` qui pose le cadre entre `_wrapScrollKeep` et `keep()` : changer d'import ou de tri ne renvoie pas la grille en haut à gauche.
- **Statistiques retenues** : `S.prefs.moyStats`, UN réglage pour l'écran (volet *Σ Statistiques en pied* de la barre) et pour le papier (modale d'impression), décochables. `_moyStatsShown()` filtre et remet dans l'ordre canonique ; `setMoyStat` pose un `pushUndo` comme `setPref`, et n'empile rien si rien ne change. ⚠️ Le tableau est toujours **remplacé**, jamais modifié en place : `DEFAULT_PREFS.moyStats` est la même référence que celle posée par `postLoadHook` (testé).
- **Impression** (bouton 🖨 et Ctrl+P ouvrent la modale `mmoyprint`, jamais l'impression directe) : la vue affichée (même import, même tri) sur **une page paysage A4 ou A3**, taille de texte calculée par `_printFitMeasure` (cf. *Synthèse de période imprimable*), annoncée dans la modale avant d'imprimer. Feuille `.pp-t.pp-moy` : colonnes fixes (nom 17 %, matières à parts égales, Moy. 7 % séparée d'un filet, « < 10 » 4 %), chiffres centrés, rangées alternées, statistiques en pied sur fond gris.
  - ⚠️ Sur le papier, « sous 10 » se marque en **gras**, pas en couleur : la feuille sort souvent en noir et blanc.
  - ⚠️ En-têtes **en casse normale** : en capitales, « FRANÇAIS » se cassait en « FRANÇAI / S ».
  - Mesure de référence (27 élèves, démo à onze matières) : 7,75 pt en A4 avec les huit statistiques, 8,5 pt avec quatre, 11,75 pt en A3.
  - **L'évolution se décoche pour le papier** : case dans la fenêtre (`_moyPrintDelta`, de séance comme le Δ de la feuille du carnet, cochée par défaut ; cachée au premier import d'une période et en vue Évolution). Décochée : ni « +1 » sous les moyennes ni « évolution depuis le … » au sous-titre, et la taille est recalculée. L'écran garde toujours l'évolution.

### 2 bis. 📈 Moyennes

Tableau élèves × matières d'un import, statistiques en pied, évolution depuis l'import précédent de la même période dans chaque case ; vue **📈 Évolution** (une ligne par import, une statistique au choix) ; vue « ▦ Tableau » ; import par fichier ou copier-coller avec aperçu ; impression paysage. Détail et pièges : *Moyennes par matière*.
