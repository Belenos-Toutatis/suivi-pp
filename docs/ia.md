# Synthèses par une IA, envoi direct à Claude

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

### 🤖 Synthèse par une IA (v1.69.0)

**Désactiver les fonctions d'IA** (v1.79.0, l'utilisateur : *« un réglage qui désactive les fonctions liées à l'IA et
n'affiche plus les résultats obtenus, sans les effacer »*) : `S.prefs.iaActive` (d'office `true`, suit la sync, un cran
d'undo par `setPref`), interrupteur en tête de la rubrique **🤖 Intelligence artificielle** de 💾 Données (ex-*Envoi à
une IA* ; désactivées, la rubrique ne montre que l'interrupteur, pastille « désactivées »). Lu par **`_iaOn()`**
(⚠️ pas `_iaActif` : c'est l'état de la fenêtre IA ouverte). Désactivées : boutons 🤖 (classe `ia-only` +
`html[data-ia="off"]` posé par `_applyPolices` pour le HTML statique), synthèse IA de la fiche (`_ficheSynthIAHTML`),
repère « Dans la conversation » (`_iaRepereHTML`), section *🤖 Synthèses de la classe* de Vie de classe et son bloc
imprimé, bloc 🎨 du ton des avis, couleurs du ton partout (`_tonsVus` rend faux) et leur palette ; les ouvreurs
(`openSynthIA`, `openSynthIAClasse`, `openSynthClasse`, `iaCorrFenetreUI`) refusent par `_iaRefuse()`. **Rien n'est
effacé** (`stu.synthIA`, `cls.synthClasse`, `camp.tons` intacts) ; les BILANS, même retravaillés avec une IA, restent
affichés. **Synthèses de la classe** (v1.79.1, l'utilisateur : *« je dois encore pouvoir rédiger moi-même la synthèse de
la classe »*) : la section reste, sans 🤖 ni +, avec ✏️ Écrire ; seules les synthèses **marquées `ia: true`** (rangées
depuis la fenêtre `mias` : `synthClasseSet(…, true)`) sont masquées, à l'écran comme sur le papier (`_synthClasseVue`,
`_scCibleVue`). ⚠️ Celles rangées avant la v1.79.1 n'ont pas la marque : elles passent pour écrites à la main (cacher un
texte de l'utilisateur serait pire). Écrire pour un moment dont la synthèse d'IA est masquée : le formulaire le dit, un
champ vide ne l'efface pas, un texte la remplace et perd la marque (`synthClasseSet(…, false)`, Ctrl+Z la rend) ; une
correction (✏️ Modifier, IA active) garde la marque. Tout nouvel affichage d'IA se branche sur `_iaOn()`. Test :
`ia-api.test.js`.

Demandé par l'utilisateur : « on sélectionne les données à extraire, elles sont extraites de manière anonyme, une IA fait une synthèse sur l'élève, et on réimporte le résultat ». **Aucun réseau** : l'app prépare un texte qu'on COPIE dans l'assistant de son choix, puis on COLLE sa réponse — ou, depuis la v1.73.0, qu'on ENVOIE directement à Claude après une dernière relecture (cf. *Envoi direct à Claude*). Bloc « 🤖 SYNTHÈSE PAR UNE IA » du script, fenêtre `mia`, ouverte depuis la rédaction de la fiche (trois vues) : *🤖 Synthèse par une IA…* (`openSynthIA`).

- **Cadre (vérifié le 2026-10-21)** : le *cadre d'usage de l'IA en éducation* (juin 2025) tolère les outils grand public pour les enseignants **sans aucune donnée personnelle ni sensible** ; l'*Assistant IA interministériel* (assistant.numerique.gouv.fr, ProConnect) se dit capable de traiter des données personnelles sans entraînement — à confirmer auprès du DPO pour des données d'élèves. D'où un circuit par copier-coller, indépendant de l'outil, et la phrase de la fenêtre (« l'assistant que votre académie autorise »).
- **Trois étapes** : 1. les données du MOMENT choisi dans la fiche (`IA_BLOCS`, cases de séance `_iaBlocsSel` ; **âge, options et aménagements décochés d'office** — PAI, PPS : santé ; un bloc vide pour cet élève est grisé « (rien) », `_iaBlocsVides`) ; 2. le texte qui partira, **modifiable**, avec la vérification ; 3. la réponse collée, noms remis, rangée.
  - Données : `_iaDonnees(cls, stu, col, blocs)` → `{ texte, ok }`, bornées par `_ficheBornes` (début au 1er septembre), vrais noms dans les textes libres (le moteur passe ensuite). L'en-tête écrit `[Élève]`, jamais le nom ; le niveau (« en 5e ») reste ; le demandeur MBN n'est pas écrit. Papiers du moment : `_ficheNonRendus` (extraite de `_ficheFaits`, partagée).
  - Consigne : `IA_CONSIGNE`, réécrite = `S.prefs.iaConsigne` (seule une consigne RÉÉCRITE est gardée ; `iaConsigneUI`, un cran d'undo, rien si rien ne change, ↺). Elle demande de relever le positif (les données de l'app notent surtout des difficultés) et de garder les repères.
- **Le moteur (pur, testé)** :
  - `_iaPseudo(texte, { personnes, ignores }, avant)` remplace les formes connues — **la plus longue d'abord**, entre deux non-lettres, sans casse ni accents (`_iaPlie` plie SANS changer la longueur : les positions valent dans le texte d'origine) —, puis **civilité + nom à majuscule** (« Mme [Adulte 1] »), téléphones, courriels. Un repère déjà présent n'est jamais touché ; `avant` garde les numéros (second passage).
  - Personnes (`_iaPersonnes`) : l'élève (`[Élève]`, prénom ; son nom seul `[Nom de l'élève]`, la mère « Mme [Nom de l'élève] »), **tous les élèves de l'app** (`[Camarade n]`), le PP (`prefs.avisNom`), les professeurs (`_discProfs`, imports de moyennes, feuilles d'avis : `[Professeur de SVT]`, numéroté s'ils sont deux), les demandeurs MBN, l'établissement, les classes (« 5C », « 5e C »… → `[Classe]`).
  - ⚠️ **Arbitré : pas de liste de prénoms extérieure** (INSEE proposée, refusée) — « les prénoms des élèves de la classe suffisent, il n'y a pas de raison qu'il y en ait d'autres ».
  - Le reste : `_iaSuspects` signale **une majuscule en milieu de phrase** (en français, presque toujours un nom propre) ou un mot en CAPITALES, hors repères, `IA_MOTS_OK` (civilités, mois, sigles, matières, S1, TD…) et les mots des libellés que l'app écrit elle-même (`ok` de `_iaDonnees`, mots composés entiers : « Physique-Chimie »). *masquer* → `[Nom n]` (`iaMasquerUI`), *laisser* → écarté pour la séance.
  - `_iaFuites` : un nom connu revenu dans le texte (correction à la main) est signalé à part (*Remplacer*, `iaFuitesUI`, ou *ce n'est pas un nom*), jamais aussi « à vérifier » ; **Copier le redemande** (`iaCopierUI` : « Remplacer et copier »).
  - ⚠️ **Pseudonymisé, pas anonyme** : un prénom INCONNU de l'app en début de phrase n'est pas repéré (la majuscule y est normale). La fenêtre le dit ; la relecture est l'étape qui compte.
- **Copier** (`_iaCopier`) : consigne + texte relu, `navigator.clipboard.writeText`, repli `execCommand('copy')` sur un champ caché.
- **Retour** : `_iaRestaureParts` / `_iaRestaure` remettent les noms (tolérant : « [élève] », « [ Eleve ] » ; un repère inconnu reste) — `[Élève]` → le prénom, `[Camarade n]` → son prénom, les autres → la forme **lue dans le texte** (« Guérin », pas « GUÉRIN » ; `defaut` sinon). `_iaNettoie` retire blocs de code, gras, titres. Aperçu surligné (`mia-rest`) seulement s'il remet des noms.
  - ⚠️ **La table repère → nom ne quitte jamais l'app** et ne vit que pour la séance (`_iaEtats`, par élève et moment ; rien dans `S`). À la réouverture, le texte est refait à neuf, sauf texte corrigé à la main ou réponse collée qui porte encore des repères (la table doit rester celle de ce texte). Les fiches de suivi se lisent dans leur cadre : la fenêtre l'attend (`_suivisPretAttendre`) puis refait un texte non touché.
- **Rangée à part** (arbitré) : `stu.synthIA = [{ id, ts, date, type, texte }]`, une par MOMENT comme les décisions (`_synthIACible`, `synthIASet` : vide = retirée ; `ts` = le jour où elle a été rangée), `iaRangerUI` (un cran d'undo, rien si la même). Dans la fiche, au-dessus du bilan (`_ficheSynthIAHTML`, liseré pointillé, « à relire, pas à recopier ») : *＋ insérer dans le bilan* — tout, ou **le passage sélectionné** (lu au `mousedown`, `ficheSynthIASel`) —, *Refaire…*, *🗑 Retirer* (Ctrl+Z la rend). `_sanitizeCoreSections` / `_sanitizeImbrique` écartent les entrées illisibles ; rien à purger à part (sur l'élève).
- **RGPD** : le bandeau ne dit plus « rien ne sort » sans nuance — seul ce que l'utilisateur copie lui-même sort, pseudonymisé et relu, à ne coller que dans un outil autorisé.
- **Démo** : une synthèse rangée au conseil du S1 du premier élève (`demo_ia01`) ; le contact du 11/10 cite la mère (« Mme Guérin ») et le rappel à l'ordre du 06/11 un camarade : la fenêtre a des remplacements à montrer.
- Tests : `test/synthese-ia.test.js` — dont un balayage de TOUTE la démo (tous les élèves × tous les moments, tout coché) par un détecteur indépendant du moteur, avec méta-test, et « rien de ce que l'app écrit n'est à vérifier ».
- ⚠️ Non vérifié : un vrai assistant (format de sa réponse), le presse-papiers réel (testé sur un témoin).

#### Toute la classe d'un coup (v1.70.0)

Demandé : « une solution pour faire toute la classe en une seule fois — avec un JSON anonymisé ». Bouton *🤖 Synthèses par une IA…* de la barre de 👥 Élèves (`openSynthIAClasse`), et *Toute la classe d'un coup…* dans la fenêtre d'un élève (`iaVersClasseUI`). Fenêtre `miac`, mêmes trois étapes ; **la relecture est COMMUNE** aux deux fenêtres : `_iaActif` = l'état de la fenêtre ouverte (`_ia` ou `_iaLot`), qui porte `ids` (son texte, sa vérification), `personnes()` et `apres()` — `iaTexteSaisi`, `_iaVerifRender`, `iaFuitesUI`, `iaMasquerUI`, `iaIgnorerUI` servent aux deux.

- **Repères tirés au hasard** : `_iaLotCodes` (Fisher-Yates) donne 1…N dans un ordre MÉLANGÉ — ⚠️ jamais l'ordre de la liste, qui se décoderait avec elle. `_iaPersonnes(cls, stu, codes)` : chaque élève du lot a SON repère `[Élève n]` (et `[Nom de l'élève n]`), **le même partout**, dans sa section comme quand un camarade le cite ; l'élève de la section passe devant (deux « Lucas »).
- **Élèves** : présents pendant la période, ordre de la liste (`_iaLotEleves` sur `_fichePrintEleves`) ; *Seulement les élèves sans synthèse pour ce moment* pour redemander les oubliés (nouveaux repères). Moment au choix (local à la fenêtre, ne touche pas `_ficheMoment`) ; blocs partagés avec la fenêtre d'un élève.
- **Un texte relu** (`_iaLotTexte`) : le moment une fois en tête, puis une section `### [Élève n]` par élève, dans l'ordre des repères (`_iaDonnees(…, repere)` écrit le repère et tait le moment). Correspondances repère → élève dans un volet, sur ce poste seulement (un clic mène à la section, `iaLotAllerUI`).
- **Le JSON est bâti À LA SORTIE** (`_iaLotSections` → `_iaLotJSON`) : `{ consigne, commun, eleves: [{ eleve, donnees: [lignes] }], reponse_attendue: { syntheses: [{ eleve, synthese }] } }` — rien d'autre que le texte relu. *📋 Copier le JSON* / *💾 Télécharger le JSON* (`synthese-ia-<moment>.json`, à supprimer ensuite), après la même question qu'en individuel si un nom connu est encore là ; une ligne « ### » effacée est signalée. Consigne propre (`IA_CONSIGNE_CLASSE`, réécrite = `S.prefs.iaConsigneClasse`, même `iaConsigneUI(v, true)`) : chaque élève pour lui-même, sans comparaison, réponse en JSON.
- **La réponse** (`_iaLotLire`, pur) : JSON (`{ syntheses: […] }`, un tableau, ou `{ "[Élève 3]": "…" }` ; clés tolérées : eleve/code/id/repère, synthese/texte/résumé ; préambule et bloc de code ignorés), sinon du texte avec un TITRE par élève (« ### [Élève 3] », « **[Élève 7]** : … », « Élève 8 : ») — ⚠️ une phrase qui COMMENCE par le repère (« [Élève 3] progresse ») n'est pas un titre. Collée ou ouverte depuis un fichier (`iaLotFichierUI`).
- **Revue** (`_iaLotRevue`) : par élève, nouvelle / remplace celle rangée le … / déjà rangée telle quelle (non cochable), noms remis ; oubliés nommés (et comment les redemander), repères inconnus laissés de côté, doublons (la dernière retenue). *Ranger n synthèses* (`iaLotRangerUI`) : **un seul cran d'undo** pour tout le lot.
- ⚠️ **La table repère → élève est gardée sur CE poste** (`localStorage` `suiviPP_iaLot`, le dernier lot : classe, moment, repères, table ; `_iaLotGarder` / `_iaLotSauve`) : un rechargement entre l'envoi et la réponse ne perd rien — les repères sont repris tant qu'ils couvrent les mêmes élèves, avec les repères posés à la main. Jamais dans `S`, jamais dans la sync.
- Tests : `test/synthese-ia-classe.test.js` (repères, texte et JSON sans aucun nom connu avec méta-test, formes de réponse, revue et rangement, rechargement, relecture commune).
- Pièces communes aux fenêtres de lot : `_iaPret(construire, suite)` (relire, demander pour un nom connu, puis le JSON), `_iaTelecharger`, `_iaCorrRender(id)` / `iaAllerUI(n)` (correspondances, saut à une section), `_iaTexteRemplir` (texte posé curseur au début).

#### La synthèse DE la classe (v1.71.0)

Demandé : « un autre export en JSON, pour une période ou un bilan de mi-période, qui extrait de manière anonyme tous les bilans des élèves de ce moment, et une synthèse de la classe — synthétique : l'ambiance de travail, la situation des élèves, l'esprit de la classe, pas trop longue ». Fenêtre `mias` (`openSynthClasse`), ouverte par le **+** de la section *🤖 Synthèses de la classe* de 🏫 Vie de classe et par *Une synthèse de la classe…* de la fenêtre `miac` (`iaVersSynthClasseUI`). Même moteur, même relecture (`_iaActif`).

- **Ce qui part** (`_iaClasseTexte`, cases `IA_BLOCS_CLASSE`, de séance) : en tête la classe — moment, effectif, nombre de bilans rédigés ; **chiffres de la classe** (`_iaClasseChiffres` : moyenne générale de la classe, écart, sous 10 ; moyennes de la classe par matière ; observations du carnet et MBN ; incidents par instance ; absences et retards — des totaux, aucun élève nommé) ; **heures de vie de classe** tenues sur le moment — puis une section `### [Élève n]` par élève qui a quelque chose : **son bilan** de ce moment, ses **décisions**, et en option sa synthèse IA rangée et les avis des collègues (décochés : du texte long). Repères tirés au hasard (`_iaLotCodes`), relus, JSON à la sortie (`_iaClasseJSON` : `{ consigne, classe, eleves, reponse_attendue: { synthese } }`).
- **Consigne** (`IA_CONSIGNE_SYNTH_CLASSE`, réécrite = `S.prefs.iaConsigneSynthClasse`, `iaConsigneUI(v, 'synthese')`) : **cinq à huit lignes**, un ou deux paragraphes, l'ambiance de travail, la situation d'ensemble, l'esprit de la classe, ce qui va bien d'abord ; **ne citer aucun élève**.
- **La réponse** (`_iaClasseLire` : un texte, ou un JSON qui en porte un) : aperçu avec sa longueur, les élèves cités malgré la consigne surlignés (noms remis), « plus long que demandé » au-delà de douze lignes ou 1 500 caractères — on peut la raccourcir avant de ranger. La table des repères ne vit que pour la séance (`_iaClEtats`).
- **Rangée sur la classe** : `cls.synthClasse = [{ id, ts, date, type, texte }]`, une par MOMENT (`_synthClasseCible`, `synthClasseSet` : vide = retirée), `iaClRangerUI` (un cran d'undo, rien si la même). Lue dans 🏫 Vie de classe (`_synthClasseSecHTML`, après les heures de vie de classe : moment, date où elle a été rangée, *📋 Copier* — pour l'appréciation générale du bulletin —, 🗑, Ctrl+Z la rend) et **imprimée en tête de la synthèse de période** (bloc `classe` de `_PERIODE_BLOCS`, coché d'office car court ; rien s'il n'y en a pas pour ce moment ; pas sur les fiches). Normalisée au chargement avec les classes ; part avec la classe.
- **À la main, sans IA** (v1.76.2, l'utilisateur : *« ajoute les boutons Modifier et Écrire »*) : *✏️ Écrire* dans le titre
  de la section (`synthClasseEcrireUI` : un moment — la liste de « Synthèse pour », d'office le moment courant —, un
  champ ; une synthèse déjà rangée pour ce moment y revient, et l'enregistrer la remplace ; changer de moment garde un
  texte tapé) et *✏️ Modifier* sur chaque synthèse (`synthClasseModifierUI`, sur place). Ctrl+Entrée enregistre, Échap
  annule ; un cran d'undo, rien si rien ne change ; vider le texte la retire (Ctrl+Z la rend). `_scEdit` (de séance,
  oublié au rechargement de la sync).
- Démo : une synthèse de la classe au conseil du S1 (`demo_sc01`). Tests : `test/synthese-ia-classe-synthese.test.js`.

#### 📤 Envoi direct à Claude, par l'API (v1.73.0)

Demandé le 2026-10-23 : *« prévoir d'envoyer directement les données anonymées vers l'API de Claude ; l'utilisateur
peut choisir de faire des copier-coller vers un chat ou d'envoyer directement vers une API, avec toujours un contrôle
manuel final afin de vérifier que les données envoyées sont bien anonymées »* ; puis *« un lien pour créer sa clé
d'API, un pour voir où on en est dans son usage — et savoir à chaque fois ce que ça a pris dans le crédit »*. Bloc
« 📤 ENVOI DIRECT À UNE IA » du script, après les synthèses de la classe.

- **Budget** (vérifié avec l'utilisateur) : l'abonnement Max 5x donne **100 $ de crédit d'API par mois**, sans
  report, une fois l'organisation de la Console reliée à l'abonnement (fait). Mesuré sur la démo : le JSON de toute
  la classe, tout coché, fait ~25 000 caractères (~7 000 à 9 000 jetons) ; ≈ 0,25 à 0,50 $ avec Opus 5.5, quelques
  dollars par an.
- **Deux voies, au choix, dans les trois fenêtres** (`mia`, `miac`, `mias`) : *📋 Copier* (inchangé) ou *📤 Envoyer
  à Claude* (`iaEnvoyerUI`, `iaLotEnvoyerUI`, `iaClEnvoyerUI`), après la MÊME préparation (`_iaPret` / la question
  sur un nom connu). ⚠️ **Ce qui part est exactement ce que Copier aurait copié** (`_iaContenuEleve`, `_iaLotConstruire`,
  `_iaClasseJSON`) — un seul message `user`, rien d'autre : ni système, ni table des repères, ni nom.
- **Le contrôle final** : fenêtre `miaenv` (`_iaEnvoiOuvrir`) — le texte EXACT en lecture seule, le modèle, la clé
  masquée, le coût ESTIMÉ (`_iaEstime` : ~3,2 caractères par jeton, une réponse moyenne réflexion comprise), et la
  case *« J'ai relu ce texte : rien ne permet de reconnaître un élève, sa famille ou un collègue »* sans laquelle
  le bouton reste éteint (`iaEnvoiGoUI` refuse aussi). Pour corriger, on annule et on revient à l'étape 2. Pendant
  l'envoi : l'avancée (« Claude réfléchit… », caractères reçus, secondes), *⏹ Arrêter* ; fermer la fenêtre arrête.
- **La réponse** arrive à l'étape 3 de la fenêtre d'origine, comme collée (`_iaReponseVers`) : même revue, mêmes
  noms remis, **rien n'est rangé tout seul**. Pour toute la classe, la forme est IMPOSÉE (`output_config.format`,
  `IA_SCHEMA_LOT` = `{ syntheses: [{ eleve, synthese }] }`, ce que `_iaLotLire` lit déjà). Coupée (`max_tokens`),
  refusée (`refusal`), vide, en erreur : dit, rien n'est posé.
- **La requête** (`_iaRequete`, pure) : `POST https://api.anthropic.com/v1/messages`, `x-api-key`,
  `anthropic-version: 2026-10-21`, ⚠️ `anthropic-dangerous-direct-browser-access: true` (sans lui, le navigateur refuse
  l'appel — CORS), `stream: true`, `output_config.effort: 'medium'`, `max_tokens` 32 000 (classe) / 16 000. ⚠️ **Ni
  `temperature` ni `thinking`** : la version 2026-10-21 refuse les paramètres d'échantillonnage, et la réflexion
  d'Opus 5.5 ne se coupe pas (400). `fallbacks: "default"` + bêta `server-side-fallback-2026-07-01` sauf Haiku (qui
  n'en a pas) : un refus de sécurité est rejoué par l'API sur un autre modèle. `anthropic-workspace-id` seulement si
  un espace est réglé (clé non limitée à un espace : sinon 400).
- **Le flux** (`_iaSSE`, `_iaFlux`, purs) : événements découpés n'importe où (un `\r` de fin de morceau attend son
  `\n`), seul le texte compte, un bloc `fallback` efface ce que le modèle qui a refusé avait écrit ; `usage` lu dans
  `message_start` et `message_delta`. Erreurs en clair : `_iaErreurTexte` (clé refusée, espace de travail, crédit
  épuisé, modèle introuvable, trop de demandes, surcharge).
- ⚠️ **La clé ne vit que dans ce navigateur** (`suiviPP_iaCle`) : jamais dans `S`, donc ni dans la sync ni dans
  l'export (testé), et jamais réécrite dans la page (masquée « sk-ant-…ABCD »). Une clé d'administration
  (`sk-ant-admin…`) est refusée. Modèle et espace : réglages du POSTE aussi (`suiviPP_iaApi`). Rubrique **🤖 Intelligence
  artificielle** de 💾 Données (`_iaReglagesHTML`, entre Apparence et Importer) : clé, *🔑 Créer une clé dans la Console*
  (`platform.claude.com/settings/keys`), modèle (`IA_MODELES` : Opus 5.5 par défaut, Sonnet 5.5, Haiku 5.5, Fable 5.1,
  avec leurs tarifs relevés le 2026-10-06), espace de travail, fournisseur. Conseil écrit : une clé limitée à un espace
  « Suivi PP » avec un plafond de dépense.
- **Le pas-à-pas pour obtenir une clé** (v1.73.1, l'utilisateur : *« ce n'est pas indiqué dans le logiciel, ce serait
  bien que ce soit fait et expliqué »*) : en tête de la rubrique, `_iaGuideHTML` — **ouvert tant qu'aucune clé n'est
  enregistrée**, replié ensuite. Six étapes, dans CET ordre : la Console (et le crédit mensuel de l'abonnement Max,
  lien vers l'article d'aide), ⚠️ **l'espace de travail « Suivi PP » D'ABORD** (la fenêtre « Créer une clé API » de la
  Console demande une *Portée*, et c'est l'espace qui porte le plafond), son plafond de dépense mensuel (5 $), la clé
  (Nom, Expire : la fin de l'année scolaire proposée, Compte lié : vous, Portée : l'espace — intitulés de la Console
  en français, relevés sur une capture de l'utilisateur), la copier tout de suite et la coller, essayer avec un élève.
  La question « Aucune clé d'API » des fenêtres 🤖 y renvoie. Fond `--paper` : sur `--paper-warm`, les liens
  tombaient à 4,45:1 en clair.
- ⚠️ **Le sommaire de 💾 Données n'est collé qu'à partir de 1 060 px** (v1.73.1 ; avant : 700 px) : entre les deux, il
  passe AU-DESSUS de la rubrique (270 + 28 + 640 px ne tiennent pas), et collé il recouvrait le texte qu'on faisait
  défiler — depuis la v1.65.0, vu à 1 024 px sur la longue rubrique 🤖.
- **Le coût de chaque envoi** : calculé des jetons que l'API renvoie (`_iaCout` : entrée, sortie, cache), noté dans
  un journal du POSTE (`suiviPP_iaJournal`, 300 entrées, **des chiffres, aucune donnée d'élève** — testé), dit dans le
  toast (« Cet envoi : 9 123 jetons envoyés, 4 321 rendus ≈ 0,12 $ · ce mois-ci sur ce poste : 0,12 $ »), sous les
  boutons des trois fenêtres (`_iaApiLigneHTML`) et dans la rubrique (total du mois, douze derniers envois,
  *💳 Crédit restant* → `settings/billing`, *📊 Utilisation* → `usage`). ⚠️ **Le solde exact n'est pas lu** : il
  faudrait une clé d'administration, qu'on ne met pas dans un navigateur ; le journal ne voit pas les autres postes.
- **Un seul fournisseur** : la CSP (`connect-src`) n'ouvre que `https://api.anthropic.com` en plus de GitHub (testé) ;
  un autre fournisseur s'ajoute dans le code et la CSP, jamais par une adresse saisie.
- Textes : bandeau RGPD, *Vie privée* de ⓘ et les fenêtres 🤖 ne disent plus « rien ne part vers un serveur » sans
  nuance.
- Tests : `test/ia-api.test.js` (requête, flux coupé n'importe où et repris par un autre modèle, coût et mois, erreurs,
  clé hors de `S`, CSP, un envoi complet et un envoi refusé sur un `fetch` simulé). Vérifié dans le navigateur : un
  appel RÉEL avec une fausse clé rend un 401 lisible (CSP, en-tête et CORS passent) ; un envoi complet sur un flux
  simulé (réponse à l'étape 3, revue, coût) ; audit 12 états × 2 thèmes et 320 px, 0 défaut.
- ✅ **Vérifié en vrai par l'utilisateur le 2026-10-23** : espace de travail et clé créés en suivant le pas-à-pas,
  un envoi réel pour un élève, puis pour toute la classe (forme imposée `IA_SCHEMA_LOT`) : les deux marchent.
  ⚠️ Reste à voir : les liens `settings/billing` et `usage` de la Console.

#### Longueur, chiffres, plein écran, cases d'office (v1.73.2)

Demandé le 2026-10-23, après l'essai réel de toute la classe :
- **Les cases cochées d'office** (`IA_BLOCS[].on`, choisies par l'utilisateur) : fille ou garçon, observations,
  absences et retards, moyennes, incidents, avis des collègues, bilans d'avant. Décochées : âge, groupe et options,
  aménagements, délégué, papiers à rendre, contacts avec la famille, remarque, fiches de suivi. ⚠️ Les tests qui
  exercent le remplacement de « Mme Guérin » (un contact) cochent eux-mêmes tous les blocs (`_iaBlocsSel`).
- **La longueur de la synthèse** (*« des fois une ou deux lignes au maximum, d'autres fois plus développée »*) : un
  menu sous les données, dans les trois fenêtres (`IA_LONGUEURS` : très courte — une ou deux lignes, courte — trois
  ou quatre, moyenne — cinq à huit (d'office), développée — huit à douze). Les consignes proposées ne disent plus de
  longueur (« de la longueur demandée à la fin ») ; ⚠️ la longueur est une phrase AJOUTÉE après la consigne, même
  réécrite (`_iaAvecForme`, « cette longueur prime sur toute autre indiquée plus haut »), dans ce qui est copié,
  téléchargé et envoyé (`_iaContenuEleve`, `_iaLotConstruire`, `_iaClConstruire`). L'avertissement « plus long que
  demandé » de la synthèse de la classe suit la longueur choisie (`max`).
- **Pas de valeurs chiffrées** (*« il a tendance à mettre des valeurs chiffrées des notes ; on les a dans un tableau à
  part ; il peut parler du niveau atteint, de la progression, de résultats satisfaisants, très bons, médiocres, d'un
  élève en grande difficulté »*) : case *Sans notes ni chiffres — le niveau et la progression, en mots*, cochée
  d'office, qui ajoute la phrase correspondante (`_iaFormeTexte`). Les DONNÉES envoyées gardent leurs chiffres : c'est
  la rédaction qui n'en met pas.
- Longueur et chiffres : réglages du POSTE, par fenêtre (`suiviPP_iaForme` : `{ eleve, lot, synthese }`), rien dans `S`.
- **Plein écran pour relire** (*« pour que la vérification que les données envoyées sont bien anonymes soit plus
  facile »*) : *⛶ Plein écran* à l'étape 2 des trois fenêtres et dans la dernière vérification (`iaPleinUI`, classe
  `.mo.plein`) — la fenêtre prend tout l'écran, le texte à relire (`textarea.ia-lit`) presque toute la hauteur, l'étape
  remonte en haut pour que *🗗 Réduire* reste visible ; dans `miaenv`, le coût, la case « J'ai relu » et les boutons
  restent à l'écran. Retenu sur le poste (`suiviPP_iaPlein`), pour les quatre fenêtres.
- Tests : `test/ia-api.test.js` (cases d'office, forme dans la consigne, une consigne réécrite la garde à la fin,
  plein écran). Audit : `mia`, `miac`, `mias`, `miaenv`, plein écran ou non, deux thèmes : 0 défaut.
