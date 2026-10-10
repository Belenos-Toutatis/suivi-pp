#!/bin/bash
# Suite de tests de l'application : bash suite.sh resultats.txt  (Chrome et Puppeteer installés ; environ 10 min)
# Un test qui s'arrête en route est marqué INTERROMPU. Reconstruit d'abord app/Fiche de suivi collective.html, puis lance chaque test ; les captures et PDF vont dans sorties/.
cd "$(dirname "$0")"
out=${1:-resultats.txt}; : > "$out"
python3 app/assemble.py > /dev/null || { echo "assemblage impossible" >> "$out"; exit 1; }
mkdir -p sorties/impr
for f in e2e_quatre e2e_compat e2e_autoenreg_html e2e_demandes e2e_audit3 e2e_audit4 e2e_retours5 e2e_audit5 e2e_audit6 e2e_nouvelle_annee_edt e2e_sections e2e_refonte e2e_saisie_indiv e2e_import e2e_reg_indiv e2e_courriel e2e_evol_indiv e2e_classe_sem e2e_groupes e2e_tuto e2e_tuto_choix e2e_classe_rapide e2e_sommaire e2e_parallele e2e_bilan_matiere_indiv e2e_creneau e2e_classe_bilan e2e_totaux_pastilles e2e_bulles_reglages e2e_audit2 e2e_objectifs e2e_abs e2e_ergo e2e_seuils e2e_menu_seuils e2e_boites e2e_accueil e2e_noms_pdf e2e_bulles e2e_bulles_fiche e2e_impr2 e2e_bilan_infobulles e2e_fleches e2e_fichier e2e_kpi_colonne e2e_glisser2 e2e_drag e2e_drag_abs e2e_menu_lateral e2e_impr_periode e2e_tactile e2e_bilan_periodes e2e_polices e2e_contraste; do
  [ -f $f.js ] || continue; t=180; [ $f = e2e_contraste ] && t=900   # 176 états mesurés : plus long
  o=$(timeout $t node $f.js 2>&1); rc=$?
  # un test interrompu (exception, délai dépassé) n'est PAS un succès, même avec « 0 échec » : ses vérifications suivantes n'ont pas tourné
  arret=""; [ $rc -ne 0 ] && arret=" · INTERROMPU (code $rc)"
  echo "== $f: $(echo "$o" | grep -c '^OK') ok, $(echo "$o" | grep -c '^ÉCHEC') échec(s)$arret | $(echo "$o" | grep -E '^ÉCHEC|ERREUR|Error' | head -3 | tr '\n' ' ')" >> "$out"
done
echo FINI >> "$out"
