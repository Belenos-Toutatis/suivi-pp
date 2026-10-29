# Version intégrée à Suivi PP (onglet 📋 Suivis)

> Extrait de `fiches-suivi/CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `fiches-suivi/CLAUDE.md`.

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
  `etape`, `retirer`, `version`), `annuler` (`sens`) et `autonome`.
  - `charger` porte un numéro (`version`), retenu (`hoteVersion`) APRÈS la frappe en attente qu'il fait partir : chaque `etat` le
    répète, et Suivi PP écarte un suivi fondé sur un état qu'il a remplacé depuis.
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
