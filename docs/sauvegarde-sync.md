# Sauvegarde, sync, stockage

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Sauvegarde, sync, stockage

Reprendre l'architecture de Plan de classe **sans la simplifier** — chaque pièce répond à un incident vécu :

- `localStorage` pour les données (`suiviPP_v1`), écrit à chaque `save()`, **synchrone** (un `beforeunload` doit persister les dernières frappes).
- **Sync auto** vers un dossier Nextcloud académique (`nuage03.apps.education.fr`) via File System Access API, debounce 5 s, handle persisté en IndexedDB.
- **Horloge vectorielle** (`S.clock`) classe la version disque : `equal` / `ahead` / `behind` / `diverged`. ⚠️ **Jamais de comparaison de `lastModified`** : Nextcloud retouche le mtime sans changer le contenu (flot de faux conflits).
- **Résolution de conflit non destructive** : les deux issues archivent l'autre version dans un fichier avant d'écrire. ⚠️ **Si l'archivage échoue, la résolution est annulée** : jamais d'écrasement sans copie.
- **Backups horodatés** à rotation par paliers (10 min < 1 h, 1 h < 48 h, 1 j < 14 j, 1 sem < 120 j) + dédup par empreinte de contenu ; **checkpoints nommés** avant une opération risquée.
- **Copie du dernier fichier chargé dans IndexedDB, pas dans `localStorage`** : elle y doublait l'occupation (1,07 Mo + 1,07 Mo mesurés, plafond du navigateur atteint en fin d'année).
- **Jauge d'occupation** (modale ⓘ) : capacité **mesurée** par sonde dichotomique, pas supposée. ⚠️ `navigator.storage.estimate().usage` **ne compte pas `localStorage`** (affichait « 2 Ko » pour un mégaoctet réel).
- ⚠️ **Compression écartée sciemment** : `CompressionStream` est asynchrone alors que `beforeunload` appelle `save()` de façon synchrone, et un octet altéré détruit un gzip entier là où un JSON en clair reste réparable à la main.

**Volume très faible** (25 élèves, une dizaine de relevés et de documents : quelques dizaines de ko). Le dispositif complet reste justifié : c'est le filet de sécurité, des retours de fiches d'orientation perdus ne se reconstituent pas.

### Dossier mémorisé qui ne répond plus (v1.92.4, repris de Plan de classe v2.166.1)

- **Symptôme** (Chrome 158 sous Linux, depuis le 18/11/2026, en ligne comme en `file://`) : 📂 Dossier n'ouvre rien, sans message ;
  les photos ne s'affichent plus. Le handle restauré d'IndexedDB est « mort » : `queryPermission`, `requestPermission`,
  `entries()`, `getDirectoryHandle`, même `isSameEntry` restent en attente POUR TOUJOURS, sans erreur ; redémarrer Chrome n'y
  change rien ; l'OPFS répond. Seul remède : choisir le dossier de nouveau (un handle neuf marche). Cf. nutstore/eo2weave#348.
- **Correction** : `_fsaWithin(p, ms)` borne les appels qui ne demandent rien à l'utilisateur (repère `_FSA_STALL`) ;
  `requestPermission` n'est JAMAIS borné (il attend la réponse à la bulle de Chrome ; test statique).
  - démarrage (`tryRestoreDirHandle`) : `queryPermission` borné à 4 s ; dépassé → `_dirMarkStalled` + `_dirStalledNotice('sync')`,
    puis retour AVANT tout `autoReloadCheck` ;
  - photos (`_photosDir`) : `queryPermission` 2,5 s, `getDirectoryHandle` 5 s ; dépassé → oubli + fenêtre `'pj'`, `null` ;
  - 📂 Dossier (`openFilePicker`) et un clic qui demande le dossier des PDF (`_pjReady`) : 1,5 s seulement (le sélecteur qui
    suit exige un clic de moins de 5 s) ; dépassé → oubli, toast, pas de fenêtre de plus ; 📂 Dossier ouvre alors le sélecteur.
- `_dirMarkStalled(h)` oublie le handle EN MÉMOIRE seulement (`dirHandle` / `pjDirHandle` à `null`) : l'IndexedDB garde l'ancien,
  que le nouveau choix remplace. `_dirStalledNotice(kind, nom)` : une fenêtre de l'app par dossier et par session (nom échappé,
  où le choisir de nouveau, « vos données ne sont pas touchées »). Après un nouveau choix du dossier des pièces jointes
  (`choosePjDir`), les photos sont relues.
- Les autorisations de Chrome vont au site (`belenos-toutatis.github.io`, commun avec Plan de classe) : la bulle liste les
  dossiers des deux apps, c'est normal ; les IndexedDB restent distinctes (`SuiviPP_v1`, `PlanDeClasse_v1`).
- Après la sync rétablie, une fenêtre de conflit est possible si un autre poste a écrit pendant le blocage.
- Test : `test/dossier-mort.test.js` (faux handle dont toutes les méthodes ne répondent jamais, `_fsaWithin` à 10 ms).
