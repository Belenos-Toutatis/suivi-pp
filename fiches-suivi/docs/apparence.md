# Apparence et polices

> Extrait de `fiches-suivi/CLAUDE.md` (lu à la demande, pas chargé d'office). Les renvois « cf. *Section* » se retrouvent par l'index de `fiches-suivi/CLAUDE.md`.

## Apparence et polices

- **`theme.css`** redéfinit les variables de `head.html` (`--bg`, `--paper`, `--ink`, `--accent`…) aux couleurs de Suivi PP
  (papier bleuté, encre bleu nuit, Seyès, filet rouge), thèmes `clair` et `sombre`, **à l'écran seulement** : l'impression garde
  la fiche papier classique.
- **Polices** de Suivi PP embarquées (`polices.css` : Andika, Latin Modern, JetBrains Mono — sous-ensemble élargi au latin étendu A,
  diacritiques, espace fine insécable). `--font-ui` (écran) et `--font-print` (papier) ; `--sans` suit la première, `--serif`
  (les feuilles) la seconde ; à l'impression tout prend `--font-print`.
  - Réglées dans **Fichier › Apparence**, enregistrées avec le suivi : `S.policeEcran = "lm"`, `S.policePapier = "andika"` ;
    absentes = les défauts (un ancien suivi ne reçoit aucun champ). `appliquerPolices()` pose `data-police` / `data-police-papier`.
  - Les feuilles affichées à l'écran prennent la police d'IMPRESSION ; le bouton **Aa** les bascule dans celle d'affichage
    (`html.feuilles-ecran`, réglage du navigateur ; absent quand les deux polices sont les mêmes). Arbitré par l'utilisateur.
  - La marge des impressions (`@top-left` : nom et logo de l'établissement) prend la police d'impression.
  - ⚠️ Andika est large : un test qui clique au MILIEU d'un champ date tombe sur un autre segment — viser le segment (`e2e_audit5`,
    fonction `jour`).
- **Contraste** : `e2e_contraste.js` passe l'auditeur de Suivi PP (`../scripts/audit_browser.js`) sur chaque vue et les réglages,
  2 thèmes × 2 polices × 1366 et 1024 px.
