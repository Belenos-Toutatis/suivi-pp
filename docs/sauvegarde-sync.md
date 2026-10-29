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
