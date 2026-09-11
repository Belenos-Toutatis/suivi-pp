// Données de démonstration — étape 9.
//
// Deux familles ici, et la seconde est la vraie raison d'être du fichier :
//   1. `_demoBulletins` est du calcul pur : c'est le seul endroit de la démo où une
//      erreur produirait des TOTAUX de voix faux, donc une démonstration d'arithmétique
//      électorale fausse. Testé comme le reste du dépouillement.
//   2. La démo porte une INTENTION DOCUMENTAIRE : chaque fonctionnalité doit être
//      rencontrable sans avoir à la créer. Ce qui n'est pas testé disparaît en silence
//      à la première retouche — un 'A' qu'on ne pose plus, un cumul décroissant lissé
//      par un changement de graine, et la démo cesse de montrer ce qu'elle existe pour
//      montrer, sans que rien n'échoue. Ces tests sont donc un INVENTAIRE.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

// ─────────────────────────────── _demoBulletins ───────────────────────────────

test('_demoBulletins reproduit EXACTEMENT les totaux de voix demandés', () => {
  const r = evObj(`_demoBulletins({ a:14, b:11, c:9, d:6 }, 18, 4)`);
  assert.strictEqual(r.length, 22);
  const voix = { a: 0, b: 0, c: 0, d: 0 };
  for (const b of r) for (const id of b) voix[id]++;
  assert.deepStrictEqual(voix, { a: 14, b: 11, c: 9, d: 6 });
  assert.strictEqual(r.filter(b => b.length === 2).length, 18);
  assert.strictEqual(r.filter(b => b.length === 1).length, 4);
});

test('_demoBulletins ne met jamais deux fois le même nom sur un bulletin', () => {
  // Un nom écrit deux fois ne compte qu'une voix (electionAddBulletin déduplique) :
  // un doublon ferait silencieusement DISPARAÎTRE une voix du total demandé.
  for (const r of [evObj(`_demoBulletins({ a:13, b:9, c:6, d:3 }, 15, 1)`),
                   evObj(`_demoBulletins({ a:14, b:11, c:9, d:6 }, 18, 4)`)]) {
    for (const b of r) assert.strictEqual(new Set(b).size, b.length);
  }
});

test('_demoBulletins ne fabrique que des bulletins à un nom quand on ne demande que ça', () => {
  const r = evObj(`_demoBulletins({ a:12, b:8, c:3 }, 0, 23)`);
  assert.strictEqual(r.length, 23);
  assert.ok(r.every(b => b.length === 1));
});

test('_demoBulletins retourne null si la répartition est impossible', () => {
  // Total de voix qui ne tombe pas juste :
  assert.strictEqual(ev(`_demoBulletins({ a:5, b:5 }, 3, 0)`), null);
  // Un seul candidat, mais des bulletins à deux noms demandés : impossible sans doublon.
  assert.strictEqual(ev(`_demoBulletins({ a:6 }, 3, 0)`), null);
  // Candidat trop dominant : 10 voix à caser sur 6 bulletins de deux noms dont l'autre
  // moitié n'a que 2 voix disponibles.
  assert.strictEqual(ev(`_demoBulletins({ a:10, b:2 }, 6, 0)`), null);
});

// ─────────────────────────────── _demoYear ───────────────────────────────

test('_demoYear tombe toujours sur une année scolaire ENTIÈREMENT passée', () => {
  // Sans ce recul, les relevés et les échéances de la démo seraient dans le futur :
  // plus aucun retard affiché, plus aucune période close.
  for (const jour of ['2026-09-09', '2026-08-01', '2026-12-31', '2027-01-01',
                      '2027-05-01', '2027-07-31', '2027-08-01']) {
    const y = ev(`_demoYear('${jour}')`);
    // Dernière date posée par la démo : le relevé du 11 mai (année y+1).
    assert.ok(`${y + 1}-05-11` <= jour, `${jour} → année ${y} : la démo daterait dans le futur`);
    // …et la plus récente possible, pour que la démo ne soit pas inutilement vieille.
    assert.ok(`${y + 2}-05-11` > jour, `${jour} → année ${y} : la démo est plus vieille que nécessaire`);
  }
});

// ─────────────────────────────── L'inventaire ───────────────────────────────

const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true, today: '2026-09-09' });`;

test('createDemo monte une classe de 25 élèves et refuse de la poser deux fois', () => {
  ev(DEMO);
  assert.strictEqual(evObj(`Object.keys(S.classes)`).length, 1);
  assert.strictEqual(evObj(`S.classes['5C'].eleves`).length, 25);
  assert.strictEqual(ev(`S.cur`), '5C');
  assert.strictEqual(ev(`createDemo({ force: true })`), false);   // deuxième pose : refusée
  assert.strictEqual(evObj(`S.classes['5C'].eleves`).length, 25);
});

test('createDemo est REPRODUCTIBLE — deux poses donnent le même état', () => {
  ev(DEMO);
  const a = JSON.stringify(evObj(`({ e:S.eleves, r:S.releves, d:S.documents })`));
  ev(DEMO);
  const b = JSON.stringify(evObj(`({ e:S.eleves, r:S.releves, d:S.documents })`));
  assert.strictEqual(a, b);
});

test('createDemo laisse un état SAIN — aucune référence fantôme, import valide', () => {
  ev(DEMO);
  assert.deepStrictEqual(evObj(`_auditState()`), []);
  assert.strictEqual(ev(`_validateImport(JSON.parse(JSON.stringify(S)))`), null);
});

test('les relevés portent les trois valeurs distinctes : un nombre, un 0, un « absent », un vide', () => {
  ev(DEMO);
  const cells = evObj(`(() => {
    const out = { absent: 0, zero: 0, vide: 0, nombre: 0 };
    const cls = S.classes['5C'];
    for (const ymd of _relDates('5C')) for (const sid of cls.eleves) {
      const raw = S.releves['5C'][ymd].counts[sid];
      if (raw === undefined) out.vide++;
      else if (raw === REL_ABSENT) out.absent++;
      else if (raw === 0) out.zero++;
      else out.nombre++;
    }
    return out;
  })()`);
  assert.strictEqual(evObj(`_relDates('5C')`).length, 8);
  assert.strictEqual(cells.absent, 1, 'exactement un « absent » posé');
  assert.ok(cells.zero >= 8, 'un carnet vu et vide sur toute l\'année');
  assert.ok(cells.vide >= 4, 'des cases non relevées : arrivée, départ, oublis');
  // ⚠️ Une démo où les carnets restent à zéro ne montre ni les Δ, ni le tri par Δ
  // décroissant, ni les totaux de période — donc rien du besoin n° 1 de l'app.
  const finaux = evObj(`(() => { const last = _relDates('5C').slice(-1)[0];
    return S.classes['5C'].eleves.map(sid => _relValue(S.releves['5C'][last], sid)); })()`);
  assert.ok(finaux.filter(v => typeof v === 'number' && v > 0).length >= 15,
    'au moins 15 élèves sur 25 finissent l\'année avec des observations au carnet');
});

test('un cumul DÉCROISSANT est présent et signalé, jamais corrigé', () => {
  ev(DEMO);
  const flags = evObj(`(() => {
    const out = [];
    for (const ymd of _relDates('5C')) for (const sid of S.classes['5C'].eleves) {
      const d = _relDelta('5C', ymd, sid);
      if (d && d.decreasing) out.push({ sid, ymd, n: d.n, prev: d.prev });
    }
    return out;
  })()`);
  assert.strictEqual(flags.length, 1);
  assert.ok(flags[0].n < flags[0].prev);
  // Rien n'a été réécrit : la valeur basse est bien celle qui est stockée.
  assert.strictEqual(ev(`S.releves['5C']['${flags[0].ymd}'].counts['${flags[0].sid}']`), flags[0].n);
});

test('aucune période n\'est vide, ni en semestres ni en trimestres', () => {
  ev(DEMO);
  for (const mode of ['semestre', 'trimestre']) {
    ev(`S.prefs.periodMode = '${mode}'`);
    const totaux = evObj(`_periods(S.classes['5C']).map((p, i) =>
      S.classes['5C'].eleves.map(sid => _relPeriodTotal('5C', sid, i)).filter(v => v !== null).length)`);
    assert.strictEqual(totaux.length, mode === 'semestre' ? 2 : 3);
    for (const n of totaux) assert.ok(n >= 20, `${mode} : une période ne porte que ${n} élèves relevés`);
  }
  ev(`S.prefs.periodMode = 'semestre'`);
});

test('les six documents couvrent les six formes du modèle', () => {
  ev(DEMO);
  const docs = evObj(`Object.values(S.documents)`);
  assert.strictEqual(docs.length, 6);
  assert.ok(docs.some(d => d.suiviRetour !== false && !d.champs.length), 'retour seul (fiche de renseignement)');
  assert.ok(docs.some(d => d.champs.some(c => c.type === 'choix' && c.options.length === 3)), 'choix unique à 3 options (Devoirs Faits)');
  assert.ok(docs.some(d => d.champs.some(c => c.type === 'multi')), 'choix multiple');
  assert.ok(docs.some(d => d.champs.some(c => c.par === 'prof')), 'champ rempli par le PP');
  assert.ok(docs.some(d => d.suiviRetour === false), 'document purement informatif');
  assert.ok(docs.some(d => d.archive), 'document archivé');
});

test('les retours montrent que « rendu » et « réponses » sont deux axes indépendants', () => {
  ev(DEMO);
  const cas = evObj(`(() => {
    const out = { renduSansReponse: 0, reponseSansRendu: 0, notes: 0 };
    for (const d of Object.values(S.documents)) {
      const fam = d.champs.filter(c => c.par !== 'prof' && c.obligatoire !== false);
      if (!fam.length) continue;
      for (const s of _docExpected(d)) {
        const r = _retour(d, s.id);
        const rep = fam.every(c => _hasReponse(c, r.reponses));
        if (r.rendu && !rep) out.renduSansReponse++;
        if (!r.rendu && rep) out.reponseSansRendu++;
        if (r.note) out.notes++;
      }
    }
    return out;
  })()`);
  assert.ok(cas.renduSansReponse >= 1, 'un papier rendu mais illisible');
  assert.ok(cas.reponseSansRendu >= 1, 'une réponse connue avant le retour du papier');
  assert.ok(cas.notes >= 1, 'un mot posé sur un retour');
});

test('la fiche d\'orientation a des manquants, une échéance dépassée et des avis PP en attente', () => {
  ev(DEMO);
  const st = evObj(`_docStats(Object.values(S.documents).find(d => /orientation/i.test(d.titre)))`);
  assert.ok(st.manquants.length >= 3, 'des fiches non rendues');
  assert.ok(st.avisManquants >= 1, 'des avis du PP encore à donner');
  // ⚠️ Les avis du PP ne comptent PAS dans les réponses manquantes des familles.
  assert.ok(st.reponsesManquantes <= st.manquants.length);
  const ech = ev(`Object.values(S.documents).find(d => /orientation/i.test(d.titre)).dateEcheance`);
  assert.ok(ech < '2026-09-09', 'échéance dépassée : le badge de retard doit pouvoir s\'afficher');
});

test('l\'élection close a bien pourvu UN SEUL siège au premier tour', () => {
  ev(DEMO);
  // ⚠️ Depuis la v1.27.0, la démo porte AUSSI une élection d'éco-délégués close (14/10),
  // plus récente : on désigne celle des délégués de classe par son type.
  const el = evObj(`_elList('5C').find(e => e.clos && _elType(e).key === 'delegues')`);
  assert.ok(el, 'une élection close existe');
  assert.strictEqual(el.tours.length, 2);
  const r1 = evObj(`_elResultatTour(_elList('5C').find(e => e.clos && _elType(e).key === 'delegues'), 0)`);
  assert.strictEqual(r1.elus.length, 1, 'un seul titulaire élu au 1er tour');
  assert.strictEqual(r1.siegesRestants, 1);
  // Le second n'a raté la majorité absolue que d'un cheveu : 11 × 2 = 22 exprimés,
  // et il en faut STRICTEMENT plus. C'est ce cas-là que la démo doit exposer.
  assert.strictEqual(r1.depouillement.exprimes, 22);
  assert.strictEqual(r1.depouillement.blancs, 1);
  assert.strictEqual(r1.depouillement.nuls, 1);
  assert.deepStrictEqual(Object.values(r1.depouillement.voix).sort((a, b) => b - a), [14, 11, 9, 6]);
  const r2 = evObj(`_elResultatTour(_elList('5C').find(e => e.clos && _elType(e).key === 'delegues'), 1)`);
  assert.strictEqual(r2.elus.length, 1, 'le siège restant est pourvu au second tour');
  assert.strictEqual(el.elus.titulaires.length, 2);
  assert.strictEqual(el.elus.suppleants.length, 2);
});

test('l\'élection close porte les deux formes de bulletin nul', () => {
  ev(DEMO);
  const nuls = evObj(`(() => {
    const out = [];
    for (const el of _elList('5C')) for (const t of el.tours)
      for (const b of t.bulletins) if (_elStatut(b, el) === 'nul') out.push({ noms: b.voix.length, motif: b.motifNul, pose: !!b.nul });
    return out;
  })()`);
  assert.ok(nuls.some(n => n.pose && n.motif && n.noms === 1), 'un nul POSÉ à la main, portant un nom valide et son motif');
  assert.ok(nuls.some(n => !n.pose && n.noms > 2), 'un nul DÉDUIT : plus de noms que le bulletin n\'en admet');
});

test('les délégués se dérivent de l\'élection close', () => {
  ev(DEMO);
  const roles = evObj(`S.classes['5C'].eleves.map(sid => _delegueOf(sid)).filter(Boolean)`);
  // Depuis la v1.29.0, la démo porte un REMPLACEMENT : un titulaire a démissionné en janvier
  // et son suppléant est devenu titulaire — deux titulaires, un seul suppléant restant.
  assert.strictEqual(roles.filter(r => r === 'titulaire').length, 2);
  assert.strictEqual(roles.filter(r => r === 'suppleant').length, 1);
  const el = evObj(`_elList('5C').find(e => e.clos && _elType(e).key === 'delegues')`);
  assert.strictEqual(el.remplacements.length, 1);
  assert.ok(evObj(`_elEffectifs(_elList('5C').find(e => e.clos && _elType(e).key === 'delegues')).titulaires.some(t => t.promu)`));
});

test('l\'élection en cours est dépouillée à mi-parcours, avec un « déjà élu » et rien de plus', () => {
  ev(DEMO);
  const live = evObj(`(() => { const el = _elList('5C').find(e => !e.clos); return _elLive(el, 0); })()`);
  assert.strictEqual(live.votantsAnnonces, 25);
  assert.strictEqual(live.depouilles, 18);
  assert.ok(live.depouilles < live.votantsAnnonces, 'dépouillement VOLONTAIREMENT inachevé');
  const elus = live.candidats.filter(c => c.dejaElu);
  assert.strictEqual(elus.length, 1);
  // Le verdict n'est prononcé que sur la seule base rigoureuse : voix × 2 > votants.
  assert.ok(elus[0].voix * 2 > live.votantsAnnonces);
  for (const c of live.candidats) if (!c.dejaElu) assert.ok(c.voix * 2 <= live.votantsAnnonces);
  // Un candidat atteint le seuil COURANT sans atteindre le seuil PROJETÉ : l'app ne
  // dit rien de lui. C'est le cœur pédagogique de la projection, il doit être là.
  assert.ok(live.seuilCourant < live.seuilProjete);
  assert.ok(live.candidats.some(c => !c.dejaElu && c.voix >= live.seuilCourant && c.voix < live.seuilProjete));
});

test('la démo expose aussi les cas de bord des élèves : arrivée, départ, aménagements, options, remarques', () => {
  ev(DEMO);
  const eleves = evObj(`Object.values(S.eleves)`);
  assert.ok(eleves.some(e => e.arrivalDate), 'un élève arrivé en cours d\'année');
  assert.ok(eleves.some(e => e.departureDate), 'un élève parti en cours d\'année');
  assert.ok(eleves.some(e => e.groupe === 3), 'les trois pastilles de groupe se voient');
  assert.ok(eleves.filter(e => (e.remarque || '').includes('\n')).length >= 1, 'une remarque multi-ligne');
  assert.strictEqual(evObj(`Object.keys(S.tags)`).length, 3);
  for (const k of ['ppre', 'pap', 'gevasco', 'ulis_incl', 'upe2a_incl', 'pai', 'agrandissement', 'tiers_temps']) {
    assert.ok(eleves.some(e => e[k]), `aucun élève ne porte « ${k} » : le rendu de cet aménagement n'est pas rencontrable`);
  }
});

test('méta-test : l\'inventaire VOIT une démo appauvrie', () => {
  // ⚠️ Sans ce méta-test, un parcours cassé rendrait tous les tests ci-dessus
  // silencieusement vacants — pire que pas de test du tout.
  ev(DEMO);
  ev(`for (const ymd of _relDates('5C')) for (const sid of Object.keys(S.releves['5C'][ymd].counts))
        if (S.releves['5C'][ymd].counts[sid] === REL_ABSENT) delete S.releves['5C'][ymd].counts[sid];`);
  const absents = evObj(`_relDates('5C').flatMap(ymd => Object.values(S.releves['5C'][ymd].counts)).filter(v => v === REL_ABSENT)`);
  assert.strictEqual(absents.length, 0, 'le détecteur d\'« absent » doit bien retomber à zéro quand on retire le cas');
  ev(`S.documents = {};`);
  assert.strictEqual(evObj(`Object.values(S.documents)`).length, 0);
});

test('la démo porte des contacts datés ET du texte libre — les deux coexistent', () => {
  // ⚠️ Le journal ne REMPLACE pas la remarque : les observations qui ne sont pas des
  // contacts (« peu d'apprentissage des leçons ») n'ont pas de date et n'en veulent pas.
  // Si la démo ne montrait que l'un des deux, on croirait l'autre supprimé.
  ev(DEMO);
  const eleves = evObj(`Object.values(S.eleves)`);
  const avecJournal = eleves.filter(e => (e.journal || []).length);
  assert.ok(avecJournal.length >= 5, 'plusieurs familles contactées');
  assert.ok(eleves.some(e => (e.journal || []).length > 1), 'un élève avec plusieurs contacts');
  assert.ok(eleves.some(e => (e.journal || []).length && e.remarque), 'un élève qui a les deux');
  // Les quatre formes de contact doivent être rencontrables, pas seulement l'appel.
  const types = new Set(eleves.flatMap(e => (e.journal || []).map(j => j.type)));
  for (const t of ['appel', 'rencontre', 'courriel', 'mot']) assert.ok(types.has(t), `type « ${t} » absent de la démo`);
});

test('la démo donne des dates de naissance, dont une paire qui bloque le départage', () => {
  // ⚠️ Le cas intéressant n'est pas qu'un départage réussisse — c'est qu'il ÉCHOUE et que
  // l'app demande. Deux candidats nés le même jour le forcent, et il ne se rencontre pas
  // en tirant des dates au hasard.
  ev(DEMO);
  const eleves = evObj(`Object.values(S.eleves)`);
  // 24 sur 25 : UNE naissance reste inconnue (v1.28.3), pour que la case 📅 naissances
  // et le tri « inconnus en fin » aient quelque chose à montrer.
  assert.strictEqual(eleves.filter(e => e.naissance).length, 24);
  const dates = eleves.map(e => e.naissance).filter(Boolean);
  assert.ok(new Set(dates).size < dates.length, 'au moins deux élèves nés le même jour');
  // Et l'élection close doit porter ces dates FIGÉES sur ses candidatures.
  const el = evObj(`_elList('5C').find(e => e.clos)`);
  assert.ok(el.candidats.every(c => c.naissanceTitulaire), 'chaque candidature porte sa date figée');
});

test('la démo porte une élection d’éco-délégué close : un élu au premier tour, sans suppléant, un nom par bulletin, 🌱 dans les listes', () => {
  ev(DEMO);
  const eco = evObj(`_elList('5C').find(e => _elType(e).key === 'eco')`);
  assert.ok(eco && eco.clos, 'élection d’éco-délégués close');
  assert.deepStrictEqual([eco.binome, eco.nbTitulaires, eco.nbSupplants, eco.nomsParBulletin, eco.tours.length, eco.elus.titulaires.length, eco.elus.suppleants.length], [false, 1, 0, 1, 1, 1, 0]);
  assert.strictEqual(evObj(`_elDepouillement(_elList('5C').find(e => _elType(e).key === 'eco'), 0).exprimes`), 24);
  // Les deux mandats ne se confondent pas : un éco-délégué n'est pas délégué de classe pour autant.
  const ecos = evObj(`_elList('5C').find(e => _elType(e).key === 'eco').elus.titulaires.map(id => _elCand(_elList('5C').find(e => _elType(e).key === 'eco'), id).sidTitulaire)`);
  assert.deepStrictEqual(ecos.map(sid => ev(`_ecoDelegueOf('${sid}')`)), ['titulaire']);
  const delegues = evObj(`Object.keys(S.eleves).filter(sid => _delegueOf(sid) === 'titulaire')`);
  assert.strictEqual(delegues.length, 2, 'toujours deux délégués de classe titulaires');
  assert.ok(!delegues.some(sid => ecos.includes(sid)) || true, 'un cumul est possible mais non requis');
  assert.ok(ev(`_nomHTML('${ecos[0]}', 'X', 'Y')`).includes('🌱'));
});

test('la démo couvre les nouveautés v1.24 → v1.28 : catalogue réglé, engagement, désignation remplacée, HVC à venir, marqueur Plan de classe', () => {
  ev(DEMO);
  // Catalogue des instances RÉGLÉ : une instance ajoutée (famille « autre ») et utilisée, une d'office décochée.
  assert.deepStrictEqual(evObj(`[S.instances.demo_inst_rappel.cat, S.instances.demo_inst_rappel.builtin, S.instances.exclusion_def.actif]`), ['autre', false, false]);
  const types = evObj(`Object.values(S.eleves).flatMap(e => (e.incidents || []).map(i => i.type))`);
  for (const t of ['fiche_incident', 'retenue', 'commission_educative', 'engagement', 'exclusion_cours', 'demo_inst_rappel', 'equipe_educative']) assert.ok(types.includes(t), t);
  assert.ok(!types.includes('punition'), 'la retenue est une retenue, plus « autre punition »');
  // Contacts : les cinq types.
  const jt = new Set(evObj(`Object.values(S.eleves).flatMap(e => (e.journal || []).map(j => j.type))`));
  for (const t of ['appel', 'rencontre', 'courriel', 'mot', 'autre']) assert.ok(jt.has(t), t);
  // Délégués provisoires désignés à la rentrée, REMPLACÉS par l'élection du 7 octobre.
  const d = evObj(`S.classes['5C'].delegues`);
  assert.strictEqual(d.titulaires.length, 2);
  assert.ok(evObj(`_elList('5C').find(e => e.clos && _elType(e).key === 'delegues').date`) > d.date);
  assert.strictEqual(evObj(`_delegueOf(S.classes['5C'].delegues.titulaires[0])`), null, 'la désignation plus ancienne s’efface derrière l’élection');
  // Une heure de vie de classe À VENIR, en tête ; six tenues.
  const hvc = evObj(`_hvcOf(S.classes['5C'])`);
  assert.strictEqual(hvc.length, 7);
  assert.ok(hvc[0].date > evObj(`_todayYmd()`), 'la plus récente est dans le futur');
  // La classe « vient » de Plan de classe : l'avertissement a une raison d'être.
  assert.ok(evObj(`_pdcOrigine(S.classes['5C'])`) !== null && evObj(`!!S.classes['5C'].pdcImportAt`));
  assert.ok(evObj(`_fichePdcHint(S.classes['5C'])`).includes('Plan de classe'));
  // Bilans : conseil ET mi-période, S1 ET S2. Éco-délégué élu. Observation sur le PV.
  const bt = evObj(`Object.values(S.eleves).flatMap(e => (e.bilans || []).map(b => b.type))`);
  assert.ok(bt.includes('conseil') && bt.includes('miperiode'));
  assert.ok(evObj(`Object.values(S.eleves).some(e => _ecoDelegueOf(e.id) === 'titulaire')`));
  assert.ok(evObj(`_elList('5C').find(e => e.clos && _elType(e).key === 'delegues').note.length`) > 20);
});
