// Parcours d'audit : les états de l'app et les feuilles imprimées, à charger APRÈS
// audit_browser.js (par `<script src>` : la CSP interdit eval). Ajouté en v1.55.9 après l'audit
// du 2026-10-06, qui l'avait écrit à la main.
//
// Usage, depuis la console du navigateur de test (servir le dossier en HTTP) :
//   await __parcours.demo();                        // la démo, rechargée proprement
//   await __parcours.run({ themes: ['light', 'dark'], papier: true });   // → __audit.report()
// La LARGEUR se règle de l'extérieur (fenêtre, émulation) : relancer run() à chaque largeur.
//
// Pièges notés à l'écrire :
// - `localStorage.clear()` + rechargement ne suffit pas à effacer les données : `beforeunload`
//   réenregistre l'état en mémoire. On recharge la démo par `_demoReplaceState`.
// - La synthèse d'un moment, dans #mperiode, a la valeur « moment » (radio `mper-quoi`).
// - `openDocMissing` lit le document OUVERT : `openDoc` d'abord.
// - Les feuilles : `window.print` neutralisé, les règles @media print réinjectées à l'écran
//   (c'est la feuille que l'on mesure), puis `afterprint` pour que l'app range #pa.
// - Le service worker d'une session précédente peut servir une vieille copie : le désinscrire
//   et recharger avant tout.
(() => {
  if (!window.__audit) throw new Error('Charger scripts/audit_browser.js d\'abord.');
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const fermer = () => { for (const m of [...document.querySelectorAll('.mo.on')].reverse()) { try { closeMod2(m.id); } catch (_) { } } };
  const cls = () => getCls();
  const eleves = () => cls().eleves.filter(id => S.eleves[id]);
  const sid0 = () => eleves().find(id => (S.eleves[id].incidents || []).length) || eleves()[0];
  const elections = () => Object.values(S.elections[cls().id] || {});
  const elEnCours = () => elections().find(e => !e.clos);
  const elClose = type => elections().filter(e => e.clos && (e.type || 'delegues') === type && !e.supDe).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const docs = () => _docsOfCurrent().filter(d => !d.archive && (d.classIds || []).includes(cls().id));
  const docMulti = () => docs().find(d => (d.champs || []).length >= 2) || docs()[0];
  const camps = () => Object.values(_avisMap(cls().id) || {}).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const theme = t => { if ((document.documentElement.dataset.theme || 'light') !== t) toggleAppTheme(); };
  const onglet = id => { fermer(); _elView = null; _elProject = false; showTab(id); };

  // [libellé, préparation] — chaque préparation part d'un état fermé (fenêtres refermées avant).
  const ETATS = [
    // 👥 Élèves
    ['élèves · indicateurs', () => { onglet('eleves'); elevesAffichageSet('indic'); }],
    ['élèves · carte de chaleur', () => { onglet('eleves'); elevesAffichageSet('chaleur'); }],
    ['élèves · trombinoscope', () => { onglet('eleves'); elevesAffichageSet('trombi'); }],
    ['élèves · filtres actifs', () => { onglet('eleves'); elevesAffichageSet('indic'); _elevesFiltres = new Set(ELEVES_FILTRES.slice(0, 2).map(f => f.key)); renderStudents(); }],
    ['élèves · moments ouverts', () => { onglet('eleves'); _elevesFiltres = new Set(); _elMomOpen = true; renderStudents(); }],
    // Fiche : trois vues, quelques éditeurs
    ['fiche · tableau de bord', () => { onglet('eleves'); _elMomOpen = false; openFiche(sid0()); ficheVueSet('dossier'); }],
    ['fiche · chronologie', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('chrono'); }],
    ['fiche · faits et rédaction', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('faits'); }],
    ['fiche · ✎ place', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('dossier'); ficheEdit('place'); }],
    ['fiche · ✎ bilans', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('dossier'); ficheEdit('bilans'); }],
    ['fiche · ✎ incidents', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('dossier'); ficheEdit('incidents'); }],
    ['fiche · ✎ papiers', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('dossier'); ficheEdit('papiers'); }],
    ['fiche · ✎ relevés', () => { onglet('eleves'); openFiche(sid0()); ficheVueSet('dossier'); ficheEdit('releves'); }],
    // Fenêtres ouvertes depuis Élèves
    ['fenêtre · modifier l\'élève', () => { onglet('eleves'); openEdit(sid0()); }],
    ['fenêtre · nouvel élève', () => { onglet('eleves'); openEdit(null); }],
    ['fenêtre · remarque', () => { onglet('eleves'); openRemarque(sid0()); }],
    ['fenêtre · contacts', () => { onglet('eleves'); openContacts(sid0()); }],
    ['fenêtre · incident (nouveau)', () => { onglet('eleves'); openIncident(sid0()); }],
    ['fenêtre · incident (modifier)', () => { onglet('eleves'); const s = sid0(); openIncident(s, (S.eleves[s].incidents || [])[0]?.id); }],
    ['fenêtre · bilan', () => { onglet('eleves'); openBilan(sid0()); }],
    ['fenêtre · liste des incidents', () => { onglet('eleves'); chaleurIncidentsUI(sid0(), '0000-01-01', '9999-12-31', 'toute l\'année'); }],
    ['fenêtre · liste des contacts', () => { onglet('eleves'); const s = eleves().find(id => _contactsListe(id, '0000-01-01', '9999-12-31').length); chaleurContactsUI(s, '0000-01-01', '9999-12-31', 'toute l\'année'); }],
    ['fenêtre · papiers à rendre', () => { onglet('eleves'); elevesPapiersUI(eleves().find(id => _papiersARendre(cls(), id).length)); }],
    ['fenêtre · options', () => { onglet('eleves'); openTagsModal(); }],
    ['fenêtre · classes', () => { onglet('eleves'); openClassesModal(); }],
    ['fenêtre · import d\'élèves', () => { onglet('eleves'); openImportStudents(); }],
    ['fenêtre · import MBN (régimes)', () => { onglet('eleves'); openMbnImport(); }],
    ['fenêtre · import trombinoscope', () => { onglet('eleves'); openTrombiImport(); }],
    ['fenêtre · imprimer (liste / moment)', () => { onglet('eleves'); openPeriodePrint(); }],
    ['fenêtre · imprimer la fiche', () => { onglet('eleves'); openFiche(sid0()); openFichePrint(); }],
    // 📓 Observations
    ['observations · grille', () => { onglet('carnets'); }],
    ['observations · touches de saisie', () => { onglet('carnets'); const i = document.querySelector('#tab-carnets input.rel-inp'); if (i) { i.focus(); _relSugShow(i); } }],
    ['fenêtre · nouveau relevé', () => { onglet('carnets'); openReleveNew(); }],
    ['fenêtre · imprimer le carnet', () => { onglet('carnets'); openCarnetPrint(); }],
    ['fenêtre · observations MBN', () => { onglet('carnets'); openObsMbnImport(); }],
    // 📈 Moyennes
    ['moyennes · tableau', () => { onglet('moyennes'); setMoyVue('tableau'); }],
    ['moyennes · évolution', () => { onglet('moyennes'); setMoyVue('evolution'); }],
    ['fenêtre · import des moyennes', () => { onglet('moyennes'); setMoyVue('tableau'); openMoyImport(); }],
    ['fenêtre · imprimer les moyennes', () => { onglet('moyennes'); openMoyPrint(); }],
    ['fenêtre · modifier un import', () => { onglet('moyennes'); const r = Object.keys(_moyMap(cls().id) || {})[0]; if (r) openMoyEdit(r); }],
    // 📄 Retours
    ['retours · liste', () => { onglet('documents'); _docView = null; _ramSel = null; renderTab('documents'); }],
    ['retours · document à plusieurs champs', () => { onglet('documents'); openDoc(docMulti().id); }],
    ['retours · ramassage', () => { onglet('documents'); _docView = null; openRamassage(); }],
    ['fenêtre · définition du document', () => { onglet('documents'); openDocEdit(docMulti().id); }],
    ['fenêtre · liste des manquants', () => { onglet('documents'); openDoc(docMulti().id); openDocMissing(docMulti().id); }],
    ['fenêtre · imprimer le document', () => { onglet('documents'); openDoc(docMulti().id); openDocPrint(docMulti().id); }],
    ['fenêtre · imprimer la grille', () => { onglet('documents'); _docView = null; renderTab('documents'); openGridPrint(); }],
    // 🏫 Vie de classe
    ['vie de classe · liste', () => { onglet('delegues'); }],
    ['vie de classe · élection en cours', () => { onglet('delegues'); const e = elEnCours(); if (e) { _elView = e.id; renderDelegues(); } }],
    ['vie de classe · projection', () => { onglet('delegues'); const e = elEnCours(); if (e) { _elView = e.id; _elProject = true; renderDelegues(); } }],
    ['vie de classe · élection close', () => { onglet('delegues'); const e = elClose('delegues'); if (e) { _elView = e.id; renderDelegues(); } }],
    ['vie de classe · éco-délégués clos', () => { onglet('delegues'); const e = elClose('eco'); if (e) { _elView = e.id; renderDelegues(); } }],
    ['fenêtre · nouvelle élection', () => { onglet('delegues'); openElectionNew(); }],
    ['fenêtre · modalités', () => { onglet('delegues'); const e = elEnCours(); if (e) { _elView = e.id; renderDelegues(); openElectionSettings(); } }],
    // 🗣 Avis
    ['avis · dernière feuille', () => { onglet('avis'); const c = camps()[0]; if (c) avisChoisirFeuille(c.id); }],
    ['avis · autre feuille', () => { onglet('avis'); const c = camps()[1] || camps()[0]; if (c) avisChoisirFeuille(c.id); }],
    ['avis · nouvelle feuille', () => { onglet('avis'); avisChoisirFeuille(null); }],
    ['fenêtre · lire une discipline', () => { onglet('avis'); const c = camps()[0]; avisChoisirFeuille(c.id); const d = c.disciplines.find(x => Object.values(c.avis || {}).some(a => a && a[x.id])); if (d) openAvisLire({ did: d.id }, c.id); }],
    ['fenêtre · lire un élève', () => { onglet('avis'); const c = camps()[0]; avisChoisirFeuille(c.id); const s = Object.keys(c.avis || {})[0]; if (s) openAvisLire({ sid: s }, c.id); }],
    // 💾 Données
    ['données', () => { onglet('donnees'); }],
    ['fenêtre · stratégie de sauvegarde', () => { onglet('donnees'); openBackupSettings(); }],
    ['fenêtre · à propos', () => { onglet('donnees'); openAbout(); }],
    ['fenêtre · mise à jour', () => { onglet('donnees'); openMod('mupdate'); }],
    ['fenêtre · confirmation', () => { onglet('donnees'); _uiConfirm({ title: 'Confirmer ?', message: 'Texte de confirmation.', okLabel: 'OK' }); }],
    ['fenêtre · saisie', () => { onglet('donnees'); _uiPrompt({ title: 'Nom ?', message: 'Texte.', value: 'valeur' }); }],
    ['fenêtre · dialogue', () => { onglet('donnees'); appAlert('Titre', 'Un message.', 'warn'); }],
    ['fenêtre · import Plan de classe', () => { onglet('donnees'); _pdcOpenChooser({ classes: { [cls().id]: { id: cls().id, nom: cls().nom, annee: cls().annee, eleves: eleves() } }, eleves: Object.fromEntries(eleves().map(id => [id, { ...S.eleves[id] }])) }); }],
  ];

  // [libellé, impression] — 12 feuilles.
  const FEUILLES = [
    ['papier · liste des élèves', () => { onglet('eleves'); elevesAffichageSet('indic'); printEleves({ format: 'A4' }); }],
    ['papier · synthèse (tableau)', () => { onglet('eleves'); openPeriodePrint(); document.querySelector('input[name="mper-quoi"][value="moment"]').checked = true; document.getElementById('mper-forme').value = 'tableau'; _periodePrintRefresh(); periodePrintOk(); }],
    ['papier · synthèse (fiches)', () => { onglet('eleves'); openPeriodePrint(); document.querySelector('input[name="mper-quoi"][value="moment"]').checked = true; document.getElementById('mper-forme').value = 'complete'; _periodePrintRefresh(); periodePrintOk(); }],
    ['papier · trombinoscope', () => { onglet('eleves'); printTrombi({ cols: 5, details: true, format: 'A4' }); }],
    ['papier · fiche élève', () => { onglet('eleves'); openFiche(sid0()); openFichePrint(); fichePrintOk(); }],
    ['papier · carnet', () => { onglet('carnets'); openCarnetPrint(); carPrintOk(); }],
    ['papier · moyennes', () => { onglet('moyennes'); setMoyVue('tableau'); openMoyPrint(); moyPrintOk(); }],
    ['papier · document', () => { onglet('documents'); openDoc(docMulti().id); printDoc(docMulti().id); }],
    ['papier · grille élèves × documents', () => { onglet('documents'); printDocsGrid(cls().id, docs().map(d => d.id), { reponses: true }); }],
    ['papier · liste des manquants', () => { onglet('documents'); openDoc(docMulti().id); printDocMissing(docMulti().id); }],
    ['papier · PV des délégués', () => { onglet('delegues'); _elView = elClose('delegues')?.id || null; renderDelegues(); electionPrintPV(); }],
    ['papier · PV des éco-délégués', () => { onglet('delegues'); _elView = elClose('eco')?.id || null; renderDelegues(); electionPrintPV(); }],
  ];

  // Les règles @media print appliquées à l'écran, le temps de mesurer la feuille.
  const simulerPapier = on => {
    document.getElementById('__printsim')?.remove();
    if (!on) return;
    const css = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (_) { continue; }
      for (const r of rules) if (r instanceof CSSMediaRule && /\bprint\b/.test(r.conditionText || r.media.mediaText)) for (const x of r.cssRules) css.push(x.cssText);
    }
    const st = document.createElement('style'); st.id = '__printsim'; st.textContent = css.join('\n'); document.head.appendChild(st);
  };

  async function run(opts) {
    const o = { themes: ['light', 'dark'], papier: true, filtre: null, ...(opts || {}) };
    const largeur = document.documentElement.clientWidth;
    const imprimer = window.print;
    const vus = [];
    try {
      for (const t of o.themes) {
        theme(t);
        for (const [lab, go] of ETATS) {
          if (o.filtre && !o.filtre.test(lab)) continue;
          try { fermer(); await go(); await pause(80); __audit.run(`${lab} · ${t} · ${largeur}px`); vus.push(lab); }
          catch (e) { (window.__suiviPPErrors = window.__suiviPPErrors || []).push({ message: `parcours « ${lab} » : ${e.message}` }); }
        }
        if (!o.papier) continue;
        window.print = () => { };
        for (const [lab, go] of FEUILLES) {
          if (o.filtre && !o.filtre.test(lab)) continue;
          try {
            fermer(); await go(); await pause(700);
            if (!document.getElementById('pa')?.innerHTML.trim()) throw new Error('rien dans #pa');
            simulerPapier(true); await pause(50);
            __audit.run(`${lab} · ${t}`, true);
          } catch (e) { (window.__suiviPPErrors = window.__suiviPPErrors || []).push({ message: `parcours « ${lab} » : ${e.message}` }); }
          finally { simulerPapier(false); window.dispatchEvent(new Event('afterprint')); }
        }
      }
    } finally { window.print = imprimer; fermer(); theme('light'); onglet('eleves'); }
    return __audit.report();
  }
  // La démo, rechargée proprement (cf. les pièges en tête).
  async function demo() {
    await _demoReplaceState('avant-audit', () => createDemo({ force: true }), 'Démo rechargée pour l\'audit.');
    undoStack.length = 0;
    return Object.keys(S.eleves).length;
  }
  window.__parcours = { ETATS, FEUILLES, run, demo, fermer };
  return `parcours prêt : ${ETATS.length} états, ${FEUILLES.length} feuilles`;
})();
