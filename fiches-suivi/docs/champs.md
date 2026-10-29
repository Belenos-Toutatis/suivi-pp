# Champs disciplinaires

> Extrait de `fiches-suivi/CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `fiches-suivi/CLAUDE.md`.

## Champs disciplinaires

`CHAMPS` (core.js) = les domaines de Suivi PP (`langues`, `lettres`, `sciences`, `arts`, `eps`, `autre`, mêmes libellés).
`S.matieres[i].champ` n'est écrit que s'il est CHOISI (réglages › Matières, menu « Champ » ; ou reçu de Suivi PP), sinon
`champDefaut(nom)` le déduit du nom (motifs ; ⚠️ l'EPS avant les sciences : « Éd. physique » contient PHYSIQUE).
`matieresParChamp(st)` range (ordre des champs, puis de la liste), `ordreMatieres(st)` en donne les noms. Suivent ce rangement : la
palette de l'emploi du temps (un paquet par champ), les réglages (un intertitre par champ ; les `data-path` gardent l'index du
tableau), les menus de matière (`optgroupsMatieres`), le menu du créneau, les trois bilans par matière (`tr.nv-champ` : un trait entre
deux champs, sans ligne de plus — les tests comptent les lignes). ⚠️ Les COULEURS des matières ne changent pas (rang dans la liste).
Test : `e2e_champs.js`.
