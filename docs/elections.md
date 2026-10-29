# Élection des délégués — Vie de classe

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

## Élection des délégués de classe

### Cadre réglementaire

Vérifié sur les textes le 2026-09-11. Les références sont portées dans le code (`_EL_TYPES[…].textes`), liées dans la modale de création et en tête de chaque élection, et citées au pied du PV.

- **Deux délégués par classe, chacun avec son suppléant** — Code de l'éducation, **art. R421-28** (décret n° 2016-1228 du 16-9-2016) : *« Deux délégués d'élèves sont élus au scrutin uninominal à deux tours dans chaque classe […]. Le nom de chaque candidat est accompagné de celui de son suppléant. Tous les élèves sont électeurs et éligibles. »* → le **binôme** titulaire + suppléant est la lettre du texte. Il dit **scrutin uninominal** : un nom par bulletin ; si un seul candidat atteint la majorité absolue, un second tour pour le second siège.
- **Avant la fin de la septième semaine de l'année scolaire** — **art. R421-30** (la circulaire de 2004 disait la sixième ; le code, plus récent, prime). Toujours cité dans l'état vide de l'onglet.
- **Circulaire n° 2004-114 du 15-7-2004, § 6.1** (BO n° 29 du 22-7-2004), relu le 2026-10-03 sur le texte fourni par l'utilisateur : *« Les candidatures sont individuelles »* ; majorité absolue au 1er tour, relative au 2nd, le plus jeune à égalité ; *« Un élève qui n'a pas présenté sa candidature peut néanmoins être élu si les voix de ses camarades se sont portées sur lui en nombre suffisant et s'il accepte son élection »* ; remplaçant élu *« au maximum deux fois dans l'année scolaire »*.
  - ⚠️ Le titulaire **indissociable** de son suppléant figure au § 6.2 — élection des représentants au CONSEIL D'ADMINISTRATION —, pas pour les délégués de classe. Pour ceux-ci, le binôme vient de **R421-28 (2016)**, plus récent et supérieur : la circulaire n'a pas été réécrite, et rien ne dit qui supplée un élu non candidat **en binôme** (hors binôme, candidatures individuelles, la circulaire suffit).
  - La fiche service-public F1370 reprend la phrase de 2004 (*« … et s'il accepte son mandat »*).
- **Éco-délégués** :
  - **Circulaire n° 2019-121 du 27-8-2019, § 1.2** (*EDD 2030*, BO n° 31 du 29-8-2019) : *« chaque établissement est incité à organiser l'élection, dans chaque classe, d'un éco-délégué […]. Cette élection peut utilement intervenir concomitamment aux élections des délégués d'élèves et selon les mêmes modalités. »* Le « binôme paritaire d'éco-délégués » de la même circulaire est **par établissement** (élu parmi les volontaires du CVC / CVL), pas par classe.
  - **Circulaire du 24-9-2020, § 3.1** (*Agenda 2030*, BO n° 36) : *« L'élection des éco-délégués de classe est désormais obligatoire au collège et au lycée et peut être organisée simultanément avec celle des délégués de classes. Elle peut également être proposée aux élèves de CM1 et CM2. Les mêmes élèves peuvent, le cas échéant, être à la fois délégués de classe et éco-délégués. »*
  - → **UN éco-délégué par classe, AUCUN suppléant, un nom par bulletin, uninominal à deux tours** (par renvoi aux modalités des délégués). Aucun texte n'impose deux éco-délégués ni la parité par classe : choix d'établissement, fréquent, à régler dans la modale.
- **Liens** (fournis par l'utilisateur) :
  - R421-28 : la section du code sur Légifrance avec un fragment `#:~:text=` qui surligne le passage sur le type de scrutin. ⚠️ Ne pas le « simplifier » en lien d'article nu : le surlignage rend la lecture immédiate.
  - Éco-délégués : les deux circulaires, mêmes pages du BO avec fragment `#:~:text=` (2019 : *« Au-delà, chaque établissement est incité… »* ; 2020 : *« L'élection des éco-délégués de classe est désormais obligatoire… »*).
  - **Deux liens seulement pour les délégués de classe** : R421-28 (Légifrance) et la fiche **service-public.gouv.fr F1370** (procédure en clair ; lien **sans** fragment `#:~:text=`, la structure du site n'affiche pas la zone surlignée). Les liens vers R421-30 et la circulaire 2004-114 sont retirés de `_EL_TYPES.delegues.textes` ; les règles ci-dessus restent celles qu'ils énoncent. Le test accepte le domaine `service-public.gouv.fr`.
  - ⚠️ `education.gouv.fr` et `legifrance.gouv.fr` refusent les robots (403 Cloudflare) : URL vérifiées par les moteurs de recherche, contenu par les PDF du BO ; à ouvrir à la main si un lien casse.
- L'élection est organisée par l'établissement, en pratique par le **professeur principal**, après une information sur le rôle des délégués (heure de vie de classe). Les délégués siègent au **conseil de classe** et forment l'**assemblée générale des délégués**, qui élit les représentants au conseil d'administration et au CVC / CVL.

⚠️ **La pratique de l'utilisateur s'écarte de la lettre du texte, et c'est légitime — ne pas la « corriger ».** Sa présentation `../PP/délégué election.md` décrit :

- des **candidatures en binôme** : chaque titulaire se présente **avec son suppléant**, affichés ensemble avant le vote ;
- un bulletin portant **0, 1 ou 2 noms** — scrutin **plurinominal** (les deux titulaires d'un seul vote), là où le texte dit « uninominal » ;
- **bulletin vierge = blanc** ; **trop de noms, marques ou inscriptions inappropriées = nul** ;
- **second tour avec les mêmes candidats** si personne n'atteint la majorité absolue ;
- **égalité de voix → le plus jeune est élu** ;
- **deux assesseurs**, élèves volontaires, qui surveillent le vote, ramassent et comptent les bulletins, puis **signent le procès-verbal** (un CANDIDAT peut l'être : cf. *Bureau de vote*).

**Les modalités sont des RÉGLAGES de l'élection, pas des constantes du code** (uninominal ou plurinominal, binôme ou suppléants élus à part, départage par le plus jeune ou le plus âgé : cela varie d'un établissement à l'autre).
- ⚠️ Le **binôme** (et le nombre de suppléants) se fige dès qu'une candidature porte un suppléant (`mel-binlock` le dit) : décoché ensuite, le PV disait « suppléants élus séparément » au-dessus de binômes. Le reste de l'arithmétique se fige au premier bulletin.
- Date d'une nouvelle élection, d'un remplacement (jamais avant le scrutin) et d'une désignation sans vote proposées par `_dateParDefaut` (dans l'année scolaire de la classe) ; une année tapée sur deux chiffres se complète (`_ymdCompleteAnnee`).
- **Arbitré par l'utilisateur : le DÉFAUT est celui des textes liés — scrutin UNINOMINAL, un nom par bulletin.** Les autres défauts : deux titulaires, binômes, majorité absolue au 1er tour, le plus jeune. Le plurinominal de sa présentation reste au menu de la modale (« 2 (plurinominal) »).
- **La modale le DIT** : sous « Modalités », `_elDefautsHint(ty)` décrit les défauts du mandat en clair (*« Par défaut, ce que disent les textes : 2 titulaires, chacun avec son suppléant, 1 nom par bulletin (uninominal)… »*), dérivé de `ty.defaults` pour ne jamais décrire autre chose que ce que le bouton **↺ Défauts des textes** (`_elDefautsReset`, inerte quand le dépouillement a commencé) remet.
- ⚠️ **Les fixtures de tests et l'élection EN COURS de la démo restent plurinominales À DESSEIN** (`nomsParBulletin: 2` explicite, commenté) : c'est le cas arithmétiquement piégeux (exprimés en bulletins, pas en voix), et « déjà élu » + « un autre au seuil courant » ne coexistent qu'à deux noms par bulletin. L'élection CLOSE de la démo est uninominale (12 · 7 · 2 · 1 sur 22 exprimés : un siège au 1er tour, le second au 2nd), testée dans les deux sens.
- `_elStatut` garde `|| 2` en repli : les fichiers d'avant le champ ont été créés quand 2 était le défaut.

### Modèle

```js
election = {
  id, classId,
  type: 'delegues' | 'eco', // le MANDAT — absent = délégués de classe
  date,                    // 'YYYY-MM-DD'
  titre,                   // « Élection des délégués — 5C — 2025-26 »
  // modalités, figées à la création et rappelées sur le PV :
  nbTitulaires: 2,
  nbSupplants: 2,          // 0 est une valeur (éco-délégués) ; absent = autant que de titulaires (`_elNbSup`)
  binome: true,            // un candidat titulaire se présente avec son suppléant
  nomsParBulletin: 1,      // nombre max de noms qu'un bulletin peut porter — 1 = uninominal (défaut)
  majoriteAbsolueT1: true, // majorité absolue au 1er tour, relative au 2nd
  departage: 'plusJeune',  // 'plusJeune' | 'plusAge' | 'manuel'
  parSiege: true,          // un siège après l'autre (défaut) — absent = ensemble ; ne vaut qu'en uninominal à plusieurs sièges
  secondTour: { mode: 'tous' | 'seuil' | 'premiers', pct, n },   // qui passe au 2nd tour — absent = tous
  nonCandidat: 'compte' | 'nul',   // nom d'un élève non candidat — absent = compte
  president: { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction },   // président du bureau — absent = PP
  supDe: { elId, candId, nom },    // scrutin du SUPPLÉANT d'un élu non candidat, jamais « l'élection des délégués »
  assesseurs: [ sid, sid ],
  inscrits: 25,            // effectif de la division (calculé, corrigible)
  tours: [ tour ],         // 1 ou 2 tours
  elus: { titulaires: [candId, …], suppleants: [candId, …] },
  clos: bool,              // verrouille la saisie et autorise le PV
  note: '',
  affichage: {             // projection en direct
    ordre: 'tirage',       // 'tirage' | 'alpha' | 'score'  — 'score' réordonne les barres, non recommandé
    pourcentages: true,    // afficher le % à côté des voix (toujours avec son dénominateur)
    ligneMajorite: true,
  },
}

candidat = {
  id,
  sidTitulaire,            // un élève de la classe
  sidSuppleant,            // null si binome === false
  nomTitulaire, nomSuppleant,   // identité minimale figée, pour que le PV survive à une suppression d'élève
  color,                   // couleur de sa barre à la projection (palette par défaut, modifiable)
  ordre,                   // rang d'affichage figé (tirage au sort ou alphabétique)
  retire: bool,            // candidature retirée entre les deux tours
}

tour = {
  n: 1 | 2,
  siege,                        // en un siège après l'autre : le siège que ce tour pourvoit (1, 2…) — absent sinon
  candidats: [ candidat ],      // au 2nd tour : les mêmes, moins les retraits
  bulletins: [ bulletin ],      // dépouillement bulletin par bulletin
  votantsAnnonces,              // bulletins comptés dans l'urne AVANT ouverture — saisi, sert d'axe à la projection
  siegesAPourvoir,              // 2 au 1er tour, moins ceux déjà pourvus au 2nd
  clos: bool,
}

bulletin = {
  n,                            // numéro d'ordre, comme la colonne A de son classeur
  voix: [ candId, … ],          // 0 à nomsParBulletin entrées
  statut: 'valide' | 'blanc' | 'nul',
  motifNul: '',                 // « trois noms », « inscription inappropriée »
}
```

### Bureau de vote : assesseurs et président

Les assesseurs ne sont pas dans les modalités (`mel-a1`, `mel-a2` supprimés) mais saisis dans l'écran de l'élection, entre les candidatures et le dépouillement : bloc **🧑‍⚖️ Bureau de vote** (`_elAssesseursHTML`) — président puis deux élèves volontaires, leur rôle rappelé.
- `electionSetAssesseur(el, i, sid)` refuse : élection close (le PV est fait : affichage seul), élève hors classe, déjà l'autre assesseur, ou président du bureau. Noms FIGÉS. Le scrutin d'un suppléant n'hérite pas des assesseurs.
- ⚠️ **Un CANDIDAT peut être assesseur** (arbitré par l'utilisateur). Aucun texte national ne règle le bureau de vote, donc rien ne réserve la fonction aux non-candidats ; et dans une classe où presque tout le monde se présente, il ne resterait personne. **La règle vaut dans les DEUX sens** : un assesseur est aussi proposable comme candidat (ni filtre dans `_elRenderCandidats`, ni refus de *+ Candidature*) — l'interdire d'un seul côté ne ferait qu'imposer un ordre de saisie. Le modèle (`electionAddCandidat`) était déjà permissif ; fixture de `fiche.test.js` qui cumule les rôles.
  - ⚠️ **Signaler, pas écarter.** `_elRoleLabel(el, sid, sansAss)` écrit le rôle déjà tenu après le nom, accordé en genre (« — candidate titulaire », « — candidat suppléant », « — assesseur », « — président du bureau »), dans les DEUX menus ; le bandeau du bloc le dit en clair. Un menu muet rendrait le cumul accidentel. `sansAss` : dans son propre menu, l'assesseur déjà choisi n'a pas à s'entendre redire qu'il est assesseur (son rôle de candidat, lui, reste écrit).
  - Le menu **« ✍️ nom écrit » signale aussi** (arbitré) : président et assesseurs y restent proposés, rôle écrit après le nom — on ne peut pas refuser de compter un bulletin qui porte leur nom.
  - **Reste écarté des assesseurs : l'élève président du bureau** (il tient déjà l'autre siège) ; le président élève reste non candidat et non assesseur.
  - Démo : l'assesseur de l'élection EN COURS est la suppléante du deuxième binôme (menus à l'écran, étiquette rencontrable sans la créer).
- **Président du bureau au choix** : `el.president = { qui: 'pp' | 'cpe' | 'eleve' | 'autre', sid, nom, fonction }`, absent = le professeur principal ; `_elPresident`, `electionSetPresident` (élève : non candidat, non assesseur, nom figé ; refus une fois close). ⚠️ Aucun texte national ne règle le bureau (usage d'établissement, documents des académies, cf. CPE de Versailles). Au PV, la signature « Le président du bureau » porte sa fonction et son nom ; la fiche de l'élève dit « président du bureau de vote ». Candidatures et assesseurs écartent l'élève président.

### Accord en genre

Tout texte d'élection s'accorde au genre du candidat. Aides : `_civOf(sid)`, `_civCand(c, sup)` — la civilité est **FIGÉE sur la candidature** (`civiliteTitulaire`, `civiliteSuppleant`, posées par `electionAddCandidat` et `electionSuppleantNC`), la fiche vivante en repli pour les candidatures plus anciennes —, `_acc(civ, m, f, x)` (civilité inconnue : forme inclusive `x`, « élu(e) »), `_accPl(civs, m, f)` (féminin seulement si TOUTES), `_civNom(nom)` (« Mme Durand » pour un adulte), `_delMot`, `_supMot`, `_maj`.
- Accordés : élu/élue (graphique, résultats, projection, PV), né/née (départage), candidat/candidate, retiré/retirée, suppléant/suppléante, il/elle accepte, Délégué(e)s élu(e)s (titres), assesseur/assesseure, président/présidente (PV, fiche), délégué/déléguée et éco-déléguée partout (infobulle du nom, fiche, synthèse, liste imprimée, fiche imprimée).
- ⚠️ **Restent au masculin générique** : les RÈGLES (« le plus jeune est élu », « le suppléant est élu avec son titulaire ») et les titres de colonnes. La projection d'un **scrutin de suppléant** titre « Suppléant(e) élu(e) — de X ».

### Un siège après l'autre, et qui passe au second tour

Les sources divergent : **R421-28** dit « scrutin uninominal à deux tours » — un scrutin élit UNE personne, donc un scrutin par délégué (lecture défendue par un enseignant, Mathemathieu) ; la fiche **justice.fr** décrit une seule élection pour les deux sièges. **Arbitré : un siège après l'autre par défaut**, réglable (*Plusieurs sièges, un nom par bulletin*).
- `_elParSiege(el)` = `parSiege` ET uninominal ET plusieurs sièges (deux noms par bulletin : forcément ensemble) ; absent = ensemble (les élections déjà tenues gardent leur arithmétique).
- Chaque tour porte `siege`. À la clôture (`electionCloreTour`) : siège pourvu → scrutin du siège suivant (tour 1, **sans les élus**, recompter l'urne) ; non pourvu au 1er tour → son 2nd tour ; vacant au 2nd → le suivant. `_elSuite` (pur, partagé avec la fenêtre de clôture) dit ce qui s'ouvrira.
  - ⚠️ Le scrutin du siège suivant repart de **TOUS les candidats du siège** (1er tour compris), moins les élus et les hors course — pas des seuls qualifiés de son second tour.
  - ⚠️ **Un tour clos fige les candidatures** : ni ✕ ni ajout ni ↑ au scrutin du siège 2 (`canEdit`), `electionRemoveCandidat` refuse dès qu'un tour est clos ou qu'un bulletin est saisi, 🚫 n'est pas proposé à un élu ; `electionRemoveEcrit` ne touche jamais un tour clos. Un tour clos n'est jamais modifié.
- Libellés par `_elTourLabel` (« siège 2 · tour 1 ») dans le dépouillement, le graphique, les résultats, la projection (« élu au premier tour (siège 2) »), le PV. Départage manuel indexé par `_elTourCle` (deux tours portent le même numéro). `electionRouvrir` retire tout tour ajouté encore vide.
- **Second tour** : `el.secondTour` (tous les candidats, ceux au-dessus d'un pourcentage — à défaut les x premiers —, ou les x premiers), `_elQualifies` — calculé sur le 1er tour, en % des **exprimés** ; une égalité à la dernière place qualifiante garde tous les ex æquo ; il reste toujours au moins autant de candidats que de sièges. Dit au PV.
- Démo : l'élection close passe en un siège après l'autre (siège 1 puis siège 2, chacun au 1er tour).

### Les sources citées sont liées

`EL_SOURCES` (R421-28 sur Légifrance, circulaire n° 2004-114 au BO, fiche justice.fr, fiche service-public F1370, dossier des CPE de l'académie de Versailles) et `_elSrc(k, libellé)` (https, nouvel onglet, `noopener noreferrer`) : une ligne de sources sous les réglages de ⚙ Modalités (`#mel-sources` : un siège après l'autre, les sièges ensemble, le nom d'un non-candidat), dans la question d'acceptation (la circulaire) et dans le bloc Bureau de vote (usage d'établissement, exemple d'académie). ⚠️ Toute nouvelle explication qui s'appuie sur une source hors Légifrance passe par `EL_SOURCES` + `_elSrc`.

### La saisie se fait bulletin par bulletin

C'est la méthode de l'utilisateur (une ligne par bulletin numéroté, une colonne par binôme, on coche) : c'est ce qu'il fait pendant que les assesseurs annoncent, et cela laisse une **trace vérifiable** — si un total est contesté, on remonte au bulletin.

- Grille de dépouillement **candidats en colonnes × bulletins en lignes**, un nouveau bulletin ajouté à chaque validation, navigation au clavier.
- **Les totaux sont CALCULÉS, jamais saisis.** Aucun champ « nombre de voix » : il se désynchroniserait du dépouillement au premier bulletin corrigé.
- Le **statut est déduit puis corrigeable** : 0 nom → blanc, plus de `nomsParBulletin` noms → nul. ⚠️ Un bulletin nul pour inscription inappropriée porte 1 ou 2 noms valides et ne peut pas être déduit — d'où `statut` inscriptible à la main et `motifNul`.
- **Nom écrit sur un bulletin** (les élèves peuvent écrire un nom sur une feuille blanche) : *✍️ + Nouveau nom* sous la grille → `electionAddEcrit`. L'élève (de la classe, présent, ni candidat ni suppléant) devient une colonne du tour EN COURS (0 voix sur les bulletins déjà lus), **sans suppléant**, `ecrit: true` ; dit dans les candidatures et au PV (« non candidat, nom écrit sur un bulletin ») ; retirable (`electionRemoveEcrit`) tant qu'aucun bulletin ne le porte. Sans suppléant, élu en binôme : siège sans suppléant ; s'il part, le siège est vacant. ⚠️ Les textes divergent sur ce cas (R421-28 veut un suppléant pour chaque candidat ; service-public et la circulaire de 2004 admettent l'élu non candidat).
  - **Modalité `el.nonCandidat`** (⚙ Modalités, figée dès le premier bulletin comme l'arithmétique, rappelée au PV), arbitrée : `compte` (défaut, absent = compte — circulaire § 6.1, service-public) ou `nul` (lecture stricte de R421-28) — `_elStatut` rend alors NUL tout bulletin où un nom écrit est coché.
  - **Acceptation** (*« … et s'il accepte son élection »*) : `electionCloreTour` refuse de clore (`{ bloque, accepter: candId }`) tant qu'un élu `ecrit` n'a pas répondu ; `electionCloreUI` pose la question devant la classe (*✓ Il accepte* / *✗ Il refuse*), `cand.accepte = true | false`. Un refus l'écarte de l'attribution (`_elResultatTour`) : le siège va au suivant selon la règle du tour, ou à un second tour. Dit dans les candidatures, au PV, et « (nom écrit, a refusé son élection) » dans le tableau de chaque tour (résultats, fenêtre détachée : `_elRefusHTML`).
    - ⚠️ Qui a refusé est **hors course** (`_elHorsCourse` : retrait ou refus) : ni au second tour, ni qualifié (`_elQualifies`), ni au siège suivant, ni « ✓ élu », ni suppléant.
    - Hors binôme, un nom écrit n'est **suppléant** que s'il accepte : la clôture pose la même question (`{ bloque, accepter, suppleant: true }`, `_elAccepterUI`).
  - ⚠️ **Le suppléant d'un élu non candidat en binôme : AUCUN texte ne le désigne.** Sous les élus d'une élection close, un bloc par élu non candidat (`_elSupNcHTML`) offre trois cas : **aucun** (siège sans suppléant, défaut), **élu ensuite par un scrutin**, **désigné par l'élu** (avec l'accord du chef d'établissement) ; élève et date. `electionSuppleantNC` pose `sidSuppleant` / `nomSuppleant` (figé) et `supNc = { mode, date }` : mandats en exercice, délégué surligné, PV, remplacement suivent ; revenir à « aucun » le retire. Refus : élection non close, hors binôme, date avant le scrutin, élève hors classe ou déjà élu. Dit au PV (`_elSupNcTexte`) et annoncé dans la question d'acceptation. Le bloc guide (une ligne dit quoi faire selon le choix coché ; *✓ Enregistrer* grisé tant qu'il manque l'élève, `_elSupNcMaj`).
  - **Scrutin du suppléant tenu dans l'app** : *🗳 Organiser ce scrutin dans l'app* (⚠️ refusé quand un suppléant est déjà enregistré : revenir d'abord à « aucun » ; un scrutin supprimé avant d'avoir élu laisse « siège sans suppléant » au PV) → `electionCreerScrutinSuppleant` crée une élection RATTACHÉE, datée par `_dateParDefaut(cls, el.date)` comme le champ date du bloc (`supDe = { elId, candId, nom }`, un siège, sans suppléant, un nom par bulletin, majorité et départage de l'élection d'origine) — candidatures, bulletins préparés, projection, fenêtre détachée, PV (« Procès-verbal de l'élection d'un suppléant », « 1 siège à pourvoir : le suppléant »). À sa **clôture**, `_elSupDeAppliquer` reporte l'élu comme suppléant (`supNc.scrutinId`) et le PV d'origine cite le scrutin avec ses chiffres (« 6 votants, 5 exprimés, 4 voix »). La liste des élections le dit (« ↳ scrutin du suppléant de … »), son en-tête a *↩ Élection d'origine*.
    - ⚠️ **Un scrutin de suppléant n'est JAMAIS « l'élection des délégués »** : `_delegueOf` et la désignation sans vote l'écartent (`!e.supDe`) — sans cela, le plus récent des scrutins clos aurait fait de son élu le seul délégué.
    - `_elSupDeExclus(el)` — titulaires (l'élu non candidat compris) et suppléants de l'élection d'origine — retire ces élèves des candidatures et du *nom écrit* du scrutin, et `electionAddCandidat` / `electionAddEcrit` les refusent. L'état vide le dit (« sauf les 3 déjà élus »). Le suppléant posé par ce scrutin ne s'exclut pas lui-même (rouvrir, reclore).
    - ⚠️ Un suppléant posé APRÈS le vote (`supNc`) n'était pas sur le bulletin : `_elCandNomSupBulletin` le tait dans la liste des candidats, les tableaux de voix du PV, les candidatures de l'onglet et le graphique (un PV signé qui laisserait croire à une candidature en binôme est faux) ; il est dit sous les élus et dans le bloc du suppléant. Le titre du PV s'accorde (« Est élue » pour un seul élu, « Sont élues »).

### ⚠️ L'arithmétique — le piège à ne pas manquer

**Les suffrages exprimés se comptent en BULLETINS, pas en voix.** Avec deux noms par bulletin, le total des voix vaut presque le double du nombre de votants : calculer la majorité absolue sur les voix diviserait tous les pourcentages par deux et **personne ne serait jamais élu au premier tour**. C'est l'erreur silencieuse la plus probable de tout ce projet.

```
inscrits            = effectif de la division
votants             = bulletins déposés
blancs              = bulletins sans aucun nom
nuls                = bulletins invalides
suffrages exprimés  = votants − blancs − nuls          ← le dénominateur
voix d'un candidat  = bulletins valides portant son nom
majorité absolue    = strictement plus de la moitié des suffrages exprimés
                      soit  voix > exprimés / 2   (jamais « ≥ 50 % », jamais d'arrondi)
```

- **Blancs et nuls sont décomptés séparément et n'entrent PAS dans les suffrages exprimés.** Ils apparaissent quand même sur le PV : c'est une information politique, pas du bruit.
- **Majorité absolue = strictement supérieure à la moitié.** Sur 24 exprimés il faut 13 voix, pas 12. Écrire le test en entiers (`voix * 2 > exprimes`), pas en flottants.
- Sont élus titulaires les `nbTitulaires` candidats en tête **qui satisfont la règle du tour** — majorité absolue au premier, relative au second. ⚠️ Un tour peut n'élire **qu'un seul** titulaire sur deux ; le second tour ne porte alors que sur le siège restant. **Ne pas supposer que les deux sièges se pourvoient au même tour.**
- ⚠️ **`votantsAnnonces` n'est pas `bulletins.length`.** Le premier est le comptage de l'urne par les assesseurs avant ouverture, le second l'avancement du dépouillement. Les confondre rend l'axe de la projection élastique et supprime le contrôle contre le bourrage. **Un écart entre les deux à la clôture est signalé** — c'est l'anomalie que ce double comptage existe pour détecter.
- **Le compte de l'urne PRÉPARE les lignes** : `electionPreparerBulletins` (champ *Bulletins dans l'urne*, `electionUrneUI`) pose `votantsAnnonces` et complète la grille par des lignes **« à lire »** (`lu: false`).
  - ⚠️ **Une ligne à lire n'est ni un votant ni un blanc** (`_elStatut` → `alire`, `_elDepouillement` l'ignore) : sans cela, la projection afficherait « 25 dépouillés » et 25 blancs avant le premier bulletin.
  - Cocher un nom, « nul », **Entrée** ou le bouton **Blanc** la marque lue (`electionSetBulletin` efface alors le champ : un bulletin lu n'a pas de `lu`, les fichiers d'avant sont inchangés).
  - Un compte plus bas ne retire QUE des lignes à lire, en fin de grille — jamais un bulletin lu. On ne clôt pas un tour qui a des lignes à lire. *+ Bulletin* mène d'abord à la ligne à lire suivante. Démo : 18 lus sur 25 préparés.
- **Vérité disponible en cours de dépouillement** : `voix × 2 > votantsAnnonces` ⇒ le candidat est **définitivement** au-dessus de la majorité absolue, puisque `exprimés ≤ votants`. C'est le seul verdict anticipé que l'app s'autorise, et seulement s'il est aussi certain d'avoir un siège (cf. *« Déjà élu »*).
- **Départage** : appliqué seulement si l'égalité porte sur le dernier siège attribuable. `_elDepartageAge` tranche automatiquement en `plusJeune` / `plusAge` d'après `stu.naissance`.
  - ⚠️ La date est **FIGÉE sur la candidature** (`cand.naissanceTitulaire`), comme le nom : les élections sont l'exception assumée à la purge, et un PV signé doit rester relisible — motif de départage compris — après le départ de l'élève. La date figée PRIME sur celle de l'élève vivant.
  - ⚠️ `_elDepartageAge` retourne **null** — « je ne sais pas » — dès qu'une date manque, que deux candidats partagent la même date sur le dernier siège disputé, ou que le mode est `manuel`. **null n'est pas un échec, c'est un refus délibéré de trancher** : l'app rend la main et demande. Un élu que personne ne peut justifier devant la classe est contestable.
  - La décision MANUELLE de l'utilisateur passe avant la règle automatique. La fenêtre (`_elDepartageUI`) offre **autant de cases à cocher que de sièges restants** (trois ex æquo pour deux sièges : on en coche deux, bouton actif au bon compte, `_elDepCoche`) → `departageManuel[clé] = [ids]`.
    - ⚠️ La décision reste **en attente** (`_elDepAttente`, hors de `S`) jusqu'à la clôture confirmée et entre dans son cran d'undo : annuler la clôture n'en laisse rien.
    - ⚠️ Elle ne vaut que pour l'égalité qu'elle a tranchée : `electionRouvrir` retire les décisions du tour rouvert (titulaires et `_elSupCle`) ; reclore redemande.
  - **La justification est AFFICHÉE** : `_elResultatTour` rend `departages` (`{ candIds, elus, voix }`), `_elDepartagesHTML` en fait une phrase par égalité — « Égalité à 2 voix, départagée par l'âge (le plus jeune est élu) : X, né(e) le …; Y, né(e) le … — élu » — au **PV** (sous le tableau du tour, sans emoji), à l'**écran de résultat projeté** et dans les résultats de l'onglet. Date = celle FIGÉE. Un départage MANUEL se dit aussi (`manuel: true` : « départagée à la main par le bureau »), sans date.
    - ⚠️ La phrase est recalculée : elle ne s'écrit que si ses élus sont ceux ENREGISTRÉS (`el.elus`) — une élection close avant la v1.67 (suppléants hors binôme à égalité pris dans l'ordre de saisie) n'a pas de phrase, les élus enregistrés font foi.
- Si `binome`, le suppléant est élu **avec** son titulaire — pas de calcul séparé.
- Hors binôme, les suppléants sont les mieux placés du dernier tour après les titulaires (`_elSuppleantsHors`, même attribution `_elAttribuer` que les titulaires) : une égalité pour la dernière place suit la **règle de départage** (âge, sinon la fenêtre à la main, clé `_elSupCle`), justifiée au PV (« pour la place de suppléant »).

### Projection en direct du dépouillement

**Le dépouillement se fait devant la classe, et les élèves voient les résultats évoluer graphiquement bulletin par bulletin.** C'est l'usage principal de l'onglet : la publicité du dépouillement rend le résultat incontestable, et voir la courbe monter fait comprendre le vote à des élèves de cycle 4.

#### Deux surfaces simultanées

L'enseignant saisit, la classe regarde ; les deux vues affichent le même état au même instant.

- **Par défaut, une seule page en deux volets** : grille à gauche, graphique à droite, lisible du fond de la salle. ⚠️ **C'est le mode à construire en premier, parce qu'il n'a aucun mode de défaillance** — il marche que le vidéoprojecteur duplique ou étende l'écran. Bouton 📽 Projeter : écran de projection (graphique seul).
- **Fenêtre détachée** (bouton **🖥 Fenêtre détachée** à côté de 📽 Projeter, `elProjectionFenetre`, aussi sur une élection close) : une fenêtre ordinaire (`window.open`) qu'on glisse sur le second écran puis **⛶ Plein écran** (F11 en repli). ⚠️ Pas de Picture-in-Picture (`documentPictureInPicture.requestWindow`, reprise de `_timerFillWindow` / `_noiseFillWindow` : l'incrustation reste petite et ne passe pas en plein écran).
  - Ses styles sont COPIÉS de la page (les `<style>`, polices comprises), avec thème et police ; elle n'affiche que `_elRenderChart` en mode `.el-right.big` — **jamais le numéro des bulletins**.
  - Le calcul et l'état vivent **dans la fenêtre principale** ; la fenêtre est un pur affichage (comme `_timerRender` pour la popup du minuteur) : `renderDelegues()` = `_renderDeleguesCore()` + `_elWinMaj()`, donc chaque bulletin, correction et Ctrl+Z la rafraîchissent. **Ctrl+Z / Ctrl+Y marchent aussi depuis la fenêtre projetée.** Revenir à la liste des élections garde la dernière élection montrée (`_elWinId`). Fermée avec la page (`pagehide`).
  - ⚠️ **Le `window.open` peut être bloqué par le navigateur** : un toast renvoie à 📽 Projeter, qui marche toujours — la fenêtre détachée est un confort, jamais le seul chemin.
  - ⚠️ Non vérifié avec un vrai second écran (le navigateur de test bloque les fenêtres surgissantes ; vérifié avec un cadre de même origine) : **à essayer avant le jour J**.
  - **Résultat final** : sur une élection close, la fenêtre montre `_elWinResultatHTML` — élus en grand (titulaire, suppléant, « élu au premier / second tour »), puis chaque tour (votants, blancs, nuls, exprimés, *majorité absolue : n* au premier tour seulement, *majorité relative* ensuite ; voix ; élus du tour marqués). Clore fait passer la fenêtre ouverte du graphique au résultat, rouvrir la ramène au graphique. ⚠️ **Jamais les remplacements en cours d'année** (arbitré), ni numéro de bulletin.
- **En-têtes qui collent au défilement** : la barre de l'élection (`.el-head`) colle sous le bandeau ; une grille des bulletins qui tient en largeur ne défile plus dans son cadre (`.bul-plat`, posé par `_elEnteteColle`, écran ≥ 700 × 480) et sa ligne de candidats colle sous la barre (`--el-head-h`, mesurée) ; le graphique colle aussi (`.el-split > .el-right { align-self: stretch }`). Pas de **filet rouge de marge** sur l'écran projeté (📽 et fenêtre détachée).

#### ⚠️ Un pourcentage en cours de dépouillement est trompeur

Le dénominateur (les suffrages exprimés) **grandit à mesure qu'on dépouille** :

- un candidat à « 100 % » après trois bulletins n'a rien gagné ;
- **le pourcentage d'un candidat peut BAISSER alors que ses voix montent** — arithmétiquement normal, mais devant une classe cela passe pour une erreur de comptage et ouvre la contestation (à figer par un test, sinon quelqu'un le « corrigera ») ;
- le seuil de majorité exprimé **en voix** n'est connu qu'à la fin, puisqu'il dépend des blancs et nuls encore à découvrir.

**Conséquences de conception, à ne pas contourner :**

1. **La grandeur principale affichée est le nombre de VOIX, pas le pourcentage.** Les barres ont pour longueur des voix. Le pourcentage est secondaire et **toujours accompagné de son dénominateur** : « 7 voix — 58 % des 12 bulletins dépouillés ». Un pourcentage nu est un chiffre faux.
2. **L'axe est fixe, gradué sur le nombre de VOTANTS**, connu avant d'ouvrir le premier bulletin (les assesseurs comptent l'urne avant de lire : contrôle d'usage contre le bourrage). Un axe qui se redimensionne rend la progression illisible.
3. **Un indicateur « dépouillés X / Y »** en permanence, et la part restante visible sur l'axe.
4. **La ligne de majorité absolue est mobile et ne peut que DESCENDRE** : elle vaut la moitié des exprimés ; chaque blanc et chaque nul la fait baisser. La dessiner comme un repère qui se déplace, avec son étiquette — un excellent support d'explication. ⚠️ Seulement à un tour à la majorité ABSOLUE : au second tour (ou au premier réglé en relative), ni ligne ni seuil, et les résultats de l'onglet disent « majorité relative » comme le PV.

#### « Déjà élu » — le seul verdict que l'arithmétique autorise en cours de route

Un candidat est **définitivement au-dessus de la majorité absolue** dès que `voix × 2 > votants`, quoi que contiennent les bulletins restants (les exprimés ne dépassent jamais les votants, le seuil final ne peut qu'être plus bas). Rigoureux, calculable à chaque bulletin, spectaculaire à projeter.

**Arbitré par l'utilisateur : « ✓ élu » ne s'affiche que si le candidat est CERTAIN d'être élu** (`_elLive`) :
- `voix × 2 > borne`, avec **borne = max(votants annoncés, bulletins dépouillés)** — un dépouillement qui dépasse le compte de l'urne ne laisse pas « élu » un candidat que l'arithmétique finale n'élit pas ;
- ET moins d'autres candidats en course capables de l'égaler ou de le dépasser avec les bulletins restants (`voix + restants ≥ les siennes`) qu'il n'y a de sièges à pourvoir dans ce tour (en plurinominal, trois candidats peuvent dépasser la moitié pour deux sièges). En cas de doute, rien.

⚠️ **Ne PAS afficher de candidat « éliminé » en cours de dépouillement.** L'énoncé symétrique est bien plus fragile — un bulletin plurinominal ajoute une voix à deux candidats à la fois, et le nombre d'exprimés final reste inconnu. Annoncer devant la classe une élimination qui se démentirait au bulletin suivant serait humiliant pour l'élève et ruinerait la crédibilité du décompte. **En cas de doute, l'app ne dit rien** : elle affiche des voix, elle ne prophétise pas.

#### Lisibilité et déroulement

- **Ordre d'affichage figé** (`election.affichage.ordre`), par défaut l'ordre du tirage ou alphabétique — **pas le classement** : des barres qui se réordonnent à chaque bulletin font perdre le fil de « sa » barre. Le classement reste un réglage (effet podium).
- **Transitions douces** sur la croissance des barres (~250 ms). ⚠️ Neutralisables (`*{transition:none!important}`) pour l'audit de contraste, sinon une barre saisie à mi-parcours produit de faux écarts.
- **Taille bornée en `vw` ET en `vh`** : sur un vidéoprojecteur large, c'est la largeur qui contraint, et des caractères dimensionnés en `vh` seul débordent sans prévenir. À vérifier du 1920 × 1080 au 1024 × 768. Noms jamais tronqués en projection (ils reviennent à la ligne).
- **Couleur par binôme** (`candidat.color`, palette par défaut, modifiable), encre dérivée par `_contrastTextColor` : aucun blanc figé sur les barres.
- **Blancs et nuls affichés à part**, dans un bloc discret — jamais comme des barres en concurrence avec les candidats.
- **Correction instantanée d'un bulletin mal lu**, devant la classe, sans casser le graphique. `pushUndo()` **par bulletin** (pas le motif de salve `_evalArmUndo`) : chaque bulletin est un acte délibéré qui doit s'annuler seul. `Ctrl+Z` doit fonctionner depuis la vue de projection.
- À cette charge (une trentaine de bulletins, quelques candidats), **reconstruire tout le graphique à chaque bulletin suffit** : pas de machinerie d'animation incrémentale.

#### ⚠️ Secret du vote — deux règles qui touchent l'affichage

- **Ne jamais projeter le numéro de bulletin.** La numérotation existe pour l'audit, pas pour l'écran : projetée, elle rend le dépouillement traçable bulletin par bulletin.
- **Rappeler de mêler les bulletins avant de dépouiller.** Lus dans l'ordre de dépôt, et des élèves se souvenant de leur ordre de passage, les votes redeviennent attribuables. Rappel affiché à l'ouverture du dépouillement, plutôt que dans une documentation que personne ne relira.

### Procès-verbal imprimable

Le livrable de l'onglet. Une page portrait, sans thème sombre (neutralisation `@media print`), portant : établissement et classe, date, modalités appliquées (les réglages, en clair), liste des candidats, inscrits / votants / blancs / nuls / exprimés, tableau des voix par candidat et par tour, élus, **assesseurs et président du bureau avec lignes de signature**, textes cités au pied.

- **Tient sur une page** : les règles `.pv*` sont hors `@media print` et en `em` ; `_pvFitPt` mesure le PV hors champ, à la largeur imprimable d'une A4 portrait, et `_printFitSize` choisit la plus grande taille qui tient (7 à 11 pt ; l'espace de signature ne descend jamais sous 9 mm). Si ça déborde même à 7 pt, un toast le dit.
- **Les élus signent** (`_pvElusSignHTML`, section *Les élus — acceptation du mandat* : une case par titulaire et par suppléant élu) — aucun texte ne l'impose, mais leur signature atteste l'acceptation que la circulaire de 2004 exige d'un élu non candidat. En binôme, un CADRE par binôme (`.pv-binome`, titulaire et suppléant côte à côte, deux cadres par rangée) ; un élu non candidat sans suppléant a son cadre avec « Suppléant : aucun ». Hors binôme, titulaires puis suppléants.
- ⚠️ **Le PV n'est imprimable que `clos: true`.** Un PV signé qui ne correspond plus au dépouillement affiché est un faux ; clore verrouille la saisie, et rouvrir demande une confirmation explicite.

### Après l'élection

- Les élus sont reportés sur l'élève (`stu.delegue = 'titulaire' | 'suppleant' | null`, dérivé de l'élection close la plus récente de sa classe) pour être visibles dans la **Synthèse** et la liste des élèves. ⚠️ **Ne pas le stocker en dur** : le dériver de `S.elections`, sinon une correction du dépouillement laisse un ancien délégué marqué. Si un cache est nécessaire, le recalculer dans `postLoadHook`.
- **Le PV signé, en PDF** : une fois l'élection close, bloc « 📎 Joindre le PV signé » sous le résumé des élus → `election.pv = { nom, fichier, taille }` ; même bloc sur la désignation sans vote (`cls.delegues.pv`, qui survit à une correction des noms). Même dossier et mêmes règles que les fiches incident (`_pjRef`, `_pvBlocHTML`, `pvAttachUI` / `pvOpenUI` / `pvRemoveUI`), nom automatique `PV élection délégués — 5e C — AAAA-MM-JJ.pdf`. `_pjReferences` les compte, donc le nettoyage des orphelins les épargne.
- **Délégués désignés sans vote dans l'app** (le PP peut avoir voté sur papier, ou reprendre une classe en cours d'année) : bloc *« ✍️ Délégués désignés sans vote dans l'app »* en bas de l'onglet 🗳 : date, deux titulaires, deux suppléants, un mot → `cls.delegues` (`deleguesSet` / `deleguesClear`, roster seulement, un rôle par élève).
  - ⚠️ **`_delegueOf` arbitre par la DATE** : la désignation prime si elle est plus récente que la dernière élection close (ou s'il n'y en a pas), sinon l'élection fait foi — et l'écran le dit (« remplacée par l'élection du … »). Cela permet aussi de noter une démission après une élection tenue dans l'app. À date égale, la désignation gagne (`>=`) : c'est le geste le plus délibéré.
  - ⚠️ Contrairement aux élections (PV historique, exception de purge), **c'est un état courant** : `_purgeStudentRefs` retire l'élève parti, et une désignation vidée disparaît. Dans l'état maximal du test de balayage.
- **Éco-délégués : la même mécanique, un autre mandat.** `election.type` (`_EL_TYPES` : `delegues` 🗳 · `eco` 🌱 — libellé, titre par défaut, intitulé du PV, défauts), choisi dans la modale de création (le mandat pose titre, binôme, suppléants, noms par bulletin — sur une élection en cours de création seulement). Défauts éco **= les textes** : **un élu, sans suppléant ni binôme, un nom par bulletin**, majorité absolue au 1er tour ; « deux si l'établissement le décide » se règle dans la modale. Chaque mandat porte ses `textes` (`{ ref, quoi, url }`), rendus par `_elTextesHTML` (liens `target=_blank rel=noopener`, échappés) dans la modale, en tête de l'élection ouverte, et cités au pied du PV.
  - ⚠️ **`nbSupplants` = 0 est une valeur.** `rest.slice(0, el.nbSupplants || el.nbTitulaires)` aurait fait deux suppléants d'une élection qui n'en veut pas ; `_elNbSup(el)` distingue 0 (aucun) de absent (fichier antérieur : autant que de titulaires).
  - Le sélecteur *Suppléants* de la modale reste réglable même en binôme (arbitré). Le binôme signifie « chaque titulaire élu avec SON suppléant », donc autant de l'un que de l'autre : cocher le binôme aligne les suppléants, changer les titulaires en binôme les fait suivre (`_elNbtChange`), et choisir un AUTRE nombre de suppléants **défait le binôme en le disant** (`_elNbsChange`, toast) plutôt que d'être refusé en silence. Testé par événements sur des éléments persistants (le stub du harnais en rend un neuf par appel).
  - ⚠️ **Deux mandats qui ne se confondent JAMAIS** : `_delegueOf(sid)` ne regarde que les élections `delegues` et `cls.delegues` ; `_ecoDelegueOf(sid)` (= `_delegueOf(sid, 'eco')`) que les élections `eco` et `cls.ecoDelegues`. Même arbitrage par la date. Clore l'une ne fait rien à l'autre ; un élève peut cumuler.
  - **Affichage** : l'éco-délégué n'est pas surligné (vert et jaune sont pris) — il porte **une pousse après le nom** (`_ecoIconeHTML`, `.eco-bdg`, dans `_nomHTML`, donc dans les cinq grilles, et sur la ligne de la fiche) — **verte pour le titulaire, jaune pour le suppléant** (v1.72.1, demandé : comme le surlignage des délégués). Dessinée en SVG (un émoji ne se recolore pas), tokens `--eco-t-fill/-line`, `--eco-s-fill/-line` aux trois endroits, contour sombre pour que le jaune se voie sur la page claire ; le mandat en infobulle et en `aria-label`. Démo : un éco-délégué suppléant désigné sans vote en novembre (`cls.ecoDelegues`), à côté de la titulaire élue, une ligne *Éco-délégué* sur la fiche, `(éco-délégué)` sur la liste imprimée et la synthèse de période, `r.eco` dans `_syntheseRow`. PV : titre, modalités (« sans suppléant », « candidatures individuelles »), tableau des élus à une colonne.
  - **Désignation sans vote** : le même bloc une seconde fois (`_deleguesDirectHTML(cls, list, kind)`, ids `de-*`, `deleguesSet(cls, data, 'eco')`, `_delDirectOpen` par mandat, cible PV `'de'`). `_purgeStudentRefs` purge `cls.ecoDelegues` comme `cls.delegues` ; dans l'état maximal du test de balayage.
  - Démo : une élection d'éco-délégués close (14/10), trois candidats, un tour, 18 bulletins à deux noms (13 voix sur 24). ⚠️ Plus récente que celle des délégués : un `find(e => e.clos)` tombe dessus — les tests désignent l'élection par son type.
- **Démission ou départ d'un délégué en cours d'année** (option arbitrée par l'utilisateur) : ce n'est PAS une nouvelle élection — circulaire n° 2004-114 § 6.1, « le chef d'établissement fait procéder […] à l'élection d'un remplaçant ». Une **trace datée sur l'élection close** : `election.remplacements = [{ id, ts, date, candId, qui: 'titulaire'|'suppleant', motif: 'demission'|'depart'|'autre', texte, remplacantCandId, nomParti, nomRemplacant }]`. Le dépouillement et le PV d'origine ne bougent pas ; le PV gagne une section *« Remplacements en cours d'année (postérieurs au scrutin) »*.
  - **Les mandats se DÉRIVENT** : `_elEffectifs(el)` → `{ titulaires: [{ sid, nom, candId, promu }], suppleants, vacants }`, et `_delegueOf` s'appuie dessus. Un titulaire parti en binôme est remplacé par **son** suppléant (promu) ; hors binôme, par le suppléant élu **choisi** (`remplacantCandId`, une seule fois par suppléant) ; sans suppléant (éco-délégué), le siège est **vacant** — l'écran et le PV le disent, l'app n'invente personne. Un suppléant qui part n'a pas de successeur — ⚠️ y compris un suppléant **promu** titulaire qui part à son tour (noté `qui: 'suppleant'`) : son siège devient vacant (`_elRemplPromu` le dit à l'écran et au PV).
  - `electionRemplacer` refuse : élection non close, mandat non élu, date illisible, doublon (un mandat ne se remplace qu'une fois), successeur non suppléant ou déjà promu. Noms FIGÉS (`nomParti`, `nomRemplacant`) comme sur les candidatures.
  - ⚠️ `_delegueOf` doit tester « est parti » AVANT « est titulaire » (sinon un titulaire démissionnaire reste surligné en vert). Testé en binôme, hors binôme, sans suppléant, et sur la démo (le titulaire élu au second tour démissionne le 12 janvier, son suppléant devient titulaire : deux titulaires, un suppléant).
  - **Écran** : bloc *🔁 Remplacements en cours d'année* dans les résultats de l'élection close (`_elRemplacementsHTML`) — liste (🗑, Ctrl+Z), *« En exercice : … (ex-suppléant) · siège vacant »*, formulaire en place (qui part · date · motif · successeur hors binôme · mot). Un remplacement ne peut pas précéder le scrutin. La désignation sans vote plus récente prime toujours.
  - Rouvrir l'élection ne touche pas aux remplacements (ils portent des `candId`) ; une élection rouverte n'est plus close, donc `_elEffectifs` ne rend rien tant qu'elle ne l'est pas à nouveau. Rien à purger : aucun sid.

### 4. 🏫 Vie de classe

Onglet renommé (identifiants du code inchangés : `tab-delegues`, `renderDelegues`). En tête les **heures de vie de classe**, puis les élections : candidatures (binômes), **dépouillement projeté en direct** (grille de saisie à gauche, graphique lisible du fond de la salle à droite), résultats calculés, procès-verbal imprimable. Un bloc par élection, historisé (on garde celle de l'an dernier). **C'est l'écran le plus exigeant du projet** : utilisé une fois par an, devant 25 témoins, sans reprise possible. Détail : *Élection des délégués de classe*.

- **Heures de vie de classe** : `cls.vieClasse`, modèle pur et testé (`hvcAdd/Set/Remove` — date valide et thème obligatoires ; `hvcSet` rend `null` si rien ne change, et « ✓ Enregistrer » ne pose alors aucun cran (`_undoSiRien`) —, `_hvcOf` récent d'abord, `_hvcPeriode` chronologique). Section 🕐 en tête de l'onglet (`_hvcHTML`, pastille `+`, formulaire en place date · thème · texte, ✏️ 🗑, `_hvcEdit` de session). **Une date future suffit pour un thème à venir** (pas de champ d'état : la liste les met en tête avec la pastille « à venir »). La **synthèse de période** peut les porter en tête de feuille (bloc *Heures de vie de classe*, **décoché par défaut**). `postLoadHook` crée la section ; la purge d'une classe l'emporte. Démo : six heures.
