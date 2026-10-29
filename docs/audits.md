# Audits : outils et leçons des défauts

> Extrait de `CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `CLAUDE.md`.

### Outils (dans `scripts/`)

- **`scripts/audit_static.js`** (Node, sur le harnais) : chaque fonction appelée par un handler inline existe ; chaque id passé à `getElementById` existe dans le HTML statique (quelques ids dynamiques connus) ; fonctions définies mais jamais référencées ; fonctions définies deux fois. Un test détecte aussi le code mort (avec méta-test).
- **`scripts/audit_browser.js`** : à charger par `<script src>` (la CSP interdit `eval`). Mesure le contraste (fond effectif par remontée des parents transparents, opacité cumulée, seuil 4,5:1 — 3,0 pour le grand texte —, contrôles désactivés exclus, deux fonds translucides empilés ne font pas un fond opaque, un dégradé est mesuré par sa pire couleur), le débordement horizontal (comparé à `documentElement.clientWidth`), le texte tronqué sans infobulle (un texte « sr-only » n'est pas « tronqué ») et `window.__suiviPPErrors`. Mode `run(label, true)` : mesure aussi `#pa` (feuille imprimée), avec les règles `@media print` réinjectées à l'écran et `window.print` remplacé.
- **`scripts/audit_parcours.js`**, à charger après `audit_browser.js` : parcours des états d'écran et des feuilles imprimées. Lancer `__parcours.demo()` puis `__parcours.run({ themes, papier })`, puis lire `__audit.report()`.
- Méthode : des données partout (la démo exhaustive est un instrument d'audit), les sous-états autant que les onglets, les modales par leur vrai ouvreur, transitions neutralisées (`*{transition:none!important;animation:none!important}`), deux thèmes, largeurs 1 570 et 320 px (+ 1 009 px), papier simulé depuis le thème sombre.
- ⚠️ Pièges de l'outil :
  - un service worker resté d'une session précédente peut servir un 503 sur tout fichier hors cache : le désinscrire d'abord ;
  - un onglet caché plus de cinq minutes voit ses `setTimeout` limités à un par minute : le parcours ne doit rien attendre (rendus synchrones), et il faut `tabs_select` sur l'onglet de test avant de lancer `run()` ;
  - un appel de l'outil de navigateur est coupé à 45 s : lancer `run()` sans l'attendre et relire `__audit.report()` ensuite ;
  - `scripts/audit_browser.js` comparait avant à `innerWidth` : en émulation mobile la fenêtre s'élargit d'elle-même, donc les audits à 320 px d'avant le 2026-10-02 sont à relire avec prudence pour le débordement (pas pour le contraste) ;
  - sur le poste Windows, `.claude/launch.json` (local, ignoré par git) lance `C:/Python313/python.exe -m http.server 8731 --bind 127.0.0.1` : `npx` y échoue.
- ⚠️ La mesure vaut pour ce qui existe : à rejouer à chaque étape sur des écrans pleins ; ce qui n'existe nulle part n'est jamais mesuré (les défauts 9 et 10 dormaient depuis les étapes 2 et 5).
- Exemption assumée : les contrôles `disabled` (`opacity: .55`) sont écartés de la mesure de contraste (WCAG 1.4.3 exclut les composants inactifs, et la pâleur DIT « indisponible ») ; si un bouton grisé devient illisible à l'usage, l'opacité est le réglage à revoir.
- Tests statiques du design system (`test/design-system.test.js`, avec méta-tests) : symétrie des tokens entre les trois blocs dans les deux sens, tout token *utilisé* a une valeur en thème clair, aucune encre figée derrière un fond dynamique, pose ET retrait des orientations d'impression, boîte focalisable dans chaque modale, règles responsive.
- ⚠️ Rendu papier non vérifié sur du vrai papier : `window.print` est mocké. Orientation : `@page` anonyme injecté le temps de l'impression puis retiré à `afterprint` (les pages nommées sont ignorées par Firefox) ; une page de chaque est à vérifier à la main sur Chromium et Firefox.
- ⚠️ Non vérifiés à la main : vidéoprojecteur réel (1024 × 768 et 1920 × 1080, lisibilité du fond de la salle), clavier virtuel d'une vraie tablette, dossier Nextcloud réel pour les PDF.
- **Audit ciblé** (v1.73.1, 2026-10-23, pas-à-pas de la clé) : rubrique 🤖 guide ouvert (sans clé) et déplié avec clé, deux thèmes, 1 024 et 320 px : 0 défaut après correction (liens à 4,45:1 sur `--paper-warm`) ; sommaire de 💾 Données qui recouvrait le texte entre 700 et 1 060 px, corrigé.
- **Audit ciblé** (v1.73.0, 2026-10-23, envoi direct à Claude) : rubrique 🤖 de 💾 Données (avec et sans clé, journal rempli), fenêtres `miac` (ligne sous les boutons, avec et sans clé) et `miaenv` (vide, en erreur), deux thèmes, 1 400 et 320 px : 0 défaut ; envoi complet sur un flux simulé, appel réel avec une fausse clé (401 lisible) ; `npm test` 836/836.
- **Audit ciblé** (v1.71.0, 2026-10-22, synthèse de la classe) : 🏫 Vie de classe (états du parcours, section des synthèses), feuille imprimée de la synthèse de période (bloc en tête), fenêtre `mias` remplie, deux thèmes, grand écran et 320 px : 0 défaut après correction du défaut 40 ; gestes réels (+, réponse tapée, Ranger).
- **Audit ciblé** (v1.70.0, 2026-10-22, toute la classe d'un coup) : liste (nouveau bouton) et fenêtre `miac` remplie (vérification, revue, correspondances), deux thèmes, grand écran et 320 px : 0 défaut ; gestes réels (bouton, Copier, réponse tapée, décocher, Ranger).
- **Audit ciblé** (v1.69.0, 2026-10-21, synthèse par une IA) : fiche (trois vues, mot surligné compris) et fenêtre `mia` remplie (noms connus, à vérifier, remplacés, aperçu), deux thèmes, 1 024 et 320 px : 0 défaut après correction du défaut 39 ; gestes réels (clavier, clics, Ctrl+Z) ; `npm test` 817/817.
- **Dernier état mesuré** (v1.68.0, 2026-10-14) : parcours de 188 états (82 écrans + 12 feuilles, × 2 thèmes), 1 009 et 320 px, 0 défaut de contraste, débordement, texte tronqué ou erreur JS ; `npm test` 807/807. Deux audits FONCTIONNELS le même jour (v1.66 : six domaines, une cinquantaine de défauts ; v1.67.1 : huit domaines dont 👥 liste/fiche et 📋 Suivis, une trentaine de défauts dont des régressions de la v1.67), corrigés avec un test chacun (`test/audit-1014-*.test.js`, `test/audit2-*.test.js`).
  - ⚠️ Leçon : les mesures d'écran et les tests verts ne disaient rien de ces défauts (combinaisons de réglages, données forgées, gestes qui se suivent) : un audit fonctionnel par domaine, qui écrit SES scénarios contre CLAUDE.md, est à refaire de temps en temps.
  - ⚠️ Leçon du second audit : des corrections faites en parallèle se cassent entre elles et cassent leurs voisins (« 3E » devenu « 3 », signature Outlook vidée, PV d'avant la v1.67 contredit) — après un lot de corrections, un audit de RÉGRESSION qui rejoue les scénarios d'avant et cherche les cas voisins. Et un geste au clavier se vérifie dans un VRAI navigateur : le défaut des champs date (`change` envoyé avec le focus sur BODY entre deux segments) était invisible à tout test Node.
  - ⚠️ Les **feuilles imprimées se mesurent aux grandes largeurs** : à 320 px, une feuille A4 simulée « déborde » (324 à 666 px) sans que le papier en soit affecté. À 320 px, lancer `run({ papier: false })`.
  - ⚠️ Les tests e2e des fiches qui dépendent du jour **fixent `window.aujourdhui`** : la démo des fiches est datée (12/10 → 31/12/2026), un test qui lit la vraie date échoue une fois ces dates passées (`e2e_retours5`, le 2026-10-14).

### Leçons des défauts trouvés (numérotés)

1. Bandeau RGPD à 1,63:1 en sombre : un fond clair posé pour le mode clair a besoin de son propre couple de tokens (`--rgpd-bg` / `--rgpd-fg`…), pas d'une encre qui s'inverse.
2. Boutons imprimés en thème sombre : les fonds de bouton sont en dur et le bloc de neutralisation n'agit que sur les tokens → `.tb, button, .btn { display:none }` dans `@media print` (aucun contrôle sur le papier).
3. Pastilles de groupe invisibles : `--g1/2/3` vivaient hors du bloc design system repris ; tokens rétablis avec encre nommée `--gN-on` (identiques dans les deux thèmes : une seule déclaration dans `:root`).
4. Cellules blanches en sombre : `input:not([type])` oublié dans la règle générique ; invisible à la mesure (noir sur blanc passe), vu seulement à l'écran → REGARDER, pas seulement mesurer.
5. Badge neutre `.badge.z` à 4,12:1 : `--pencil` est calibré sur le papier, pas sur `--paper-deep` ; utiliser `--ink-blue-soft` (une encre secondaire sur une surface plus foncée se remesure).
6. Mode projection à moitié d'écran : `.el-split.proj { grid-template-columns: 1fr }` ; à revérifier sur le vrai vidéoprojecteur.
7. Un second tour vide laissait l'élection « en cours » pour toujours : second tour seulement s'il reste des sièges ET des candidats ; les fixtures se ressemblent trop (quatre candidats partout cachaient le cas à un seul).
8. Un `<button>` n'hérite pas de `color` : `button { color: inherit; font-family: inherit }` avant les classes de bouton.
9. Pastille PAI à 4,41:1 : un accent posé en fond doit être choisi pour qu'une encre réelle passe (`#c2185b`) ; `_contrastTextColor` ne rattrape pas une couleur trop claire.
10. `avisManquants` comptait les champs `prof` facultatifs : filtrer sur `obligatoire` des deux côtés (comme `reponsesManquantes`).
11. Tableaux larges sans conteneur de défilement : `.rel-wrap` sur tous les tableaux larges (sinon la barre d'onglets sort de l'écran sur téléphone).
12. Les volets de l'élection refusaient de rétrécir : un enfant de grille vaut `min-width: auto` → `min-width: 0` et `minmax(0, 1fr)`.
13. Un `<select>` se dimensionne sur son option la plus longue, et le `<label>` flex qui l'enveloppe a le même `min-width: auto` : il faut les deux pour que `max-width` morde.
14. Noms tronqués en projection : en projection le nom revient à la ligne (pas d'ellipse, il y a de la hauteur, pas de largeur) ; l'ellipse reste en vue à deux volets avec infobulle.
15. Le focus n'était pas rendu à la fermeture d'une modale : l'ouvreur est mémorisé et refocalisé s'il existe encore et est visible.
16. Libellé de colonne fixe à 3,01:1 : l'opacité dit « indisponible », jamais « obligatoire » (cadenas 🔒 et contraste plein).
17. 44 px de débordement à 320 px : un `<span>` en `display:flex` sans `flex-wrap` pousse la page ; un bouton de plus dans une barre flex est un test à 320 px à refaire.
18. Un document partagé entre deux classes faisait entrer les élèves de l'autre : garde à la source (`_ramRows`) ; une fixture sans le cas ne voit pas le défaut.
19. La colonne de noms « collante » ne collait pas : `overflow: hidden` sur `table.dt` en faisait un conteneur de défilement (cf. *Grilles figées*) ; un `sticky` se vérifie en faisant défiler.
20. « Une erreur est survenue » à chaque redimensionnement : écriture de `--topbar-h` dans le rappel du `ResizeObserver` → écriture différée par `setTimeout` (pas `requestAnimationFrame`) et seulement si la valeur change ; tout style écrit depuis un observateur de taille s'écrit à la tâche suivante.
21. 343 px pour 320 à l'ouverture de Données : cellule de grille `.prefs` avec champ + bouton → `min-width: 0`, ligne `.prefs-row` en flex qui replie.
22. Éditeur de place de la fiche : `dd` de grille sans `min-width: 0` + éditeur flex en colonne avec `flex-wrap: wrap` (en colonne, la ligne replie sur ses items) → `nowrap`.
23. Élèves partis à 2,99:1 : `opacity` s'applique à tout ce que la ligne contient, y compris ce qui était déjà en `--pencil` → l'encre passe à `--pencil` + italique.
24. L'infobulle du nom tronqué du graphique n'avait jamais été posée : `title` sur `.el-name`.
25. Le pourcentage du graphique se tronquait à 320 px : `.el-pct` sort de la règle d'ellipse (un pourcentage sans son dénominateur est interdit).
26. Ctrl+Z avec la fiche ouverte la laissait périmée : `_MODAL_RERENDER` (table des modales à redessiner après undo/redo/rechargement) était vide → `mfiche`, `mrem`, `mtags`, `mclasses` ; pas les modales de formulaire (saisie en cours) ; `_applyReloadedData` appelle `_refreshOpenConsultModals`.
27. « Suivant » du bilan sautait un élève après un tri « rédigé d'abord » : ordre figé à l'ouverture (`_bilanOrdreFige`).
28. `_elUndoArmed` non désarmé par `_applyReloadedData` : tout verrou de salve s'y désarme (cf. `_salvesDesarmer`).
29. Réglages débordant de 39 px à 375 px (`.prefs` en `max-content 1fr`) : une colonne sous 520 px (`!important`, certaines grilles portent leur gabarit en ligne) ; l'auditeur ne le voyait pas (cf. pièges).
30. Δ du carnet imprimé à 2,16:1 : `.pp-t small` imposait `#333` → `td[class*="ob-"] small { color: inherit }`.
31. Tiret « sans objet » imprimé à 4,48:1 : `#777` → `#666`.
32. Suppléant d'un élu non candidat posé APRÈS le vote affiché comme s'il était sur le bulletin (PV, candidatures, graphique) : `_elCandNomSupBulletin` ; trouvé en LISANT le PV d'un scénario, la démo ne porte pas ce cas → d'où les scénarios de bout en bout.
33. « Sont élus » au-dessus d'un seul élu : accord du titre du PV.
34. Les listes de la fenêtre de dialogue ne se redessinaient pas après Ctrl+Z : `_appDialogShow({ redessin })` → `_appDialogRedessin`, appelé par `_MODAL_RERENDER`, oublié à la fermeture ; tout nouveau contenu listé dans la fenêtre de dialogue passe un `redessin`.
35. Incident noté depuis une case vide de la carte de chaleur daté d'aujourd'hui, hors du mois et de l'année : toute nouvelle saisie datée propose `_dateParDefaut`, jamais `_todayYmd()` nu.
36. Le focus restait dans une fenêtre fermée : `_modalOuvreur` reprend le remplaçant de l'ouvreur redessiné, sinon le focus sort de la fenêtre.
37. Compteur et fenêtre de lecture divergeaient dans une feuille d'avis : `_avisCompte(camp, sids)` ne compte que les élèves de la feuille.
38. Le nom tapé d'une nouvelle feuille survivait au changement de classe : oublié dans `switchClass`.
41. Infobulles illisibles en thème clair (texte blanc sur fond transparent, signalé par l'utilisateur) : les bulles NATIVES ne se règlent pas depuis la page → dessinées par l'app (`#bulle`). Invisible à tout audit : l'auditeur mesure la page, jamais ce que dessine le navigateur.
40. Boutons principaux SURVOLÉS à 3,8:1 en thème sombre : `.btn-p:hover` éclaircissait le fond sous un texte clair → assombri (#2f4a75), la bordure claire garde l'effet. Vu parce que la souris était restée sur le bouton après un clic : l'état « survol » n'est jamais mesuré exprès.
39. Mots surlignés à 1,7:1 en thème sombre (avis de la fiche, aperçu de la synthèse IA) : `--ink-blue` s'éclaircit la nuit, le surligneur non → `--highlighter-fg`, sombre dans les deux thèmes. Latent depuis la v1.40 : aucun audit n'avait mesuré un mot SURLIGNÉ (état à créer : `ficheMotUI`).
