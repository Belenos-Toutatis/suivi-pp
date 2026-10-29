# Import depuis Plan de classe, enregistrement de la version autonome

> Extrait de `fiches-suivi/CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `fiches-suivi/CLAUDE.md`.

## Import d'une classe depuis Plan de classe

`lignesPlanDeClasse(d)` (ui.js) lit une sauvegarde `.json` de Plan de classe et la rend comme un export (Nom · Prénom · Classe ·
Groupe · Options) ; l'aperçu habituel (`importerEleves`) fait le reste (choix de la classe, « Groupe 1 », options par le nom des
étiquettes). Liste blanche ; classes virtuelles écartées ; un suivi de cette appli n'est pas pris pour une sauvegarde de Plan de
classe. Par « Importer un fichier… » des listes d'élèves, et dans l'accueil par **« Classe depuis Plan de classe (.json)… »**
(nouveau suivi, puis import ; la classe nomme le suivi s'il n'a pas de nom).

## Enregistrement (version autonome)

- `MODE_ENREG = "html"` : Ctrl+S réécrit la page elle-même (`PAGE_SOURCE`, dont on remplace le bloc de données) ; `"hote"` en
  version intégrée.
- Chrome et Edge écrivent directement (File System Access ; le premier enregistrement demande ce fichier-ci) ; les autres
  navigateurs téléchargent une copie. Copie de secours dans le navigateur (`localStorage`, clé propre au chemin du fichier).
- « Reprendre un suivi » : un autre `.html` de l'appli ou un `.json`. « Exporter les données (.json) » : une sauvegarde à part.
