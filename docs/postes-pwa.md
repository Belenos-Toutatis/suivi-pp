# Deux postes (Nextcloud, git, fins de ligne) et installation PWA

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

### Où se pose l'exclusion — et où elle ne sert à RIEN

- ⚠️ Le client ne lit qu'UN fichier d'exclusion dans l'arbre : `~/Nextcloud/.sync-exclude.lst`, à la RACINE du dossier synchronisé. Dans un sous-dossier, il est inerte (synchronisé comme un fichier ordinaire). Le nom d'un fichier dans un binaire dit qu'il est connu, pas où il est cherché.
- Règle (chemin relatif) : `gestion élèves/PP/Suivi PP`.
- Ce fichier est lui-même synchronisé par Nextcloud (il atteint les autres machines tout seul) et relu sans redémarrage (en moins de 12 s).
- ⚠️ Les dossiers de DONNÉES ne sont pas visés : `gestion élèves/PP/Suivi PP json/` est un dossier voisin, sa synchronisation continue. Le code par git, les données par Nextcloud, ils ne se croisent jamais.

### Comment le VÉRIFIER — deux pièges de mesure

- ⚠️ Compter les entrées du journal de sync ne prouve RIEN : la table `metadata` est un registre historique qui ne se vide pas quand on exclut.
- ⚠️ Lire ce journal avec `immutable=1` renvoie un instantané PÉRIMÉ (le WAL est ignoré) : copier les trois fichiers (`.db`, `-wal`, `-shm`) et interroger la copie.
- Seul test valable : une SONDE avec son TÉMOIN — un fichier dans le dossier censé être exclu et un autre dans un dossier certainement synchronisé ; voir lequel arrive. Sans témoin, « rien n'est arrivé » peut vouloir dire que le client ne tournait pas.
- ⚠️ Corollaire : le dossier n'est plus sauvegardé par Nextcloud, le filet est GitHub — **le travail non commité n'est protégé par rien** ; commiter est le geste de sauvegarde.

### Identité git — à poser sur chaque poste

⚠️ Un poste neuf n'a pas d'identité git et `git commit` y échoue (« Author identity unknown ») ; configuration par machine, qui ne voyage ni par git ni par Nextcloud. Commits signés `Belenos Toutatis <emmanuel.wenner@gmail.com>` :

```
git config --global user.name "Belenos Toutatis"
git config --global user.email "emmanuel.wenner@gmail.com"
```

Dépannage sans rien écrire dans la configuration : `git -c user.name=… -c user.email=… commit`.

### Fins de ligne — `LF` partout, imposé par `.gitattributes`

- ⚠️ Git for Windows pose `core.autocrlf=true` : la copie de travail passe en `CRLF` alors que le dépôt est en `LF`. L'app s'en moque, mais les tests qui lisent `suivi pp.html` comme du texte avec un motif contenant `\n` échouent (3 échecs sur ce poste seulement).
- ⚠️ Le vrai danger est le bruit : un `npm test` jamais vert cesse d'être lu, et la règle « tests verts se VÉRIFIE » devient inapplicable.
- Corrigé à la cause : `.gitattributes` = `* text=auto eol=lf`, plus `binary` pour png/pdf/ods. Il voyage avec le dépôt (tout clone, quel que soit le réglage de la machine). Le proxy de l'employeur ne peut pas en être la cause : git vérifie le SHA-1 de chaque objet reçu.
- ⚠️ Après une réécriture de la copie de travail, `git update-index --refresh` ne suffit pas à faire taire le `M` de `git status` (la taille a changé) : `git diff` vide est la bonne mesure, et `git add` remet les choses d'aplomb.

## Installation comme application (PWA)

- ⚠️ Chrome REFUSE d'installer une PWA sans icône PNG d'au moins 192 px déclarée dans le manifeste (un favicon SVG en `data:` ne suffit pas, le menu « Installer » n'apparaît pas, sans message) : de VRAIS PNG en 192 **et** 512.
- ⚠️ `purpose: "maskable"` n'est pas un doublon : Android rogne l'icône dans un cercle de 80 % ; la version maskable porte le même dessin, plus petit, centré, sur un fond bord à bord. Les deux `purpose` (`any` + `maskable`) coexistent, sinon les surfaces qui ne masquent pas affichent l'icône rétrécie.
- ⚠️ iOS IGNORE les icônes du manifeste : sans `<link rel="apple-touch-icon">` (180 px), une capture de la page sert d'icône. Ce fichier est un carré plein (iOS applique son masque).
- ⚠️ Les icônes se préchargent dans `sw.js` (une app installée dont l'icône n'est pas en cache la perd au premier lancement hors-ligne).
- ⚠️ `cache.addAll` est écarté au profit d'un `add` par fichier : `addAll` rejette EN BLOC sur un 404 et l'installation du service worker échoue en silence. L'échec est toléré mais jamais silencieux (`console.warn`).
- Le dessin reprend le favicon (page claire, filet rouge de marge, lignes Seyès), lignes assombries à `#64768d` (le `#c8d2e0` disparaît à 48 px). Icônes générées par `scripts/gen_icons.py` (PIL, supersampling ×4), pas à la main.
- ⚠️ `test/pwa.test.js` lit les dimensions RÉELLES dans le chunk IHDR de chaque PNG et les compare à `sizes` (un manifeste qui annonce 512×512 pour une image de 48 px passe toute vérification textuelle et échoue à l'installation en silence).
