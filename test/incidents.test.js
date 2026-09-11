// Incidents et instances — le catalogue, les entrées sur l'élève, la référence du PDF.
// Calcul pur, testé avant l'écran : ce qu'on relit avant une commission éducative ne
// supporte ni une date floue ni une entrée sans objet.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook();
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0 };
  S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'ALPHA',prenom:'Ana',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'BETA', prenom:'Bo', classe_id:'5C',tags:[]},
  };`;

// ─────────────────────────── Catalogue ───────────────────────────

test('postLoadHook sème le catalogue complet des instances d\'office, toutes actives', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  const ids = evObj(`_instancesAll().map(i => i.id)`);
  assert.deepStrictEqual(ids, evObj(`INSTANCES_DEFAUT.map(d => d[0])`));
  assert.ok(ids.includes('fiche_incident') && ids.includes('commission_educative') && ids.includes('conseil_discipline') && ids.includes('autre'));
  assert.strictEqual(evObj(`_instancesActives().length`), ids.length);
  assert.ok(evObj(`_instancesAll().every(i => i.builtin === true && typeof i.description === 'string')`));
});

test('le semis ne touche pas aux réglages de l\'utilisateur, et complète ce qui manque', () => {
  // Un fichier où l'utilisateur a renommé, décrit et décoché — puis une version qui ajoute une instance.
  ev(`S = _emptyState(); S.instances = {
    fiche_incident: { id:'fiche_incident', label:'Rapport', description:'À ma sauce', actif:false, ord:0, builtin:true },
    perso: { id:'perso', label:'Tutorat', actif:true, ord:50 },
  }; postLoadHook();`);
  const fi = evObj(`S.instances.fiche_incident`);
  assert.strictEqual(fi.label, 'Rapport');
  assert.strictEqual(fi.description, 'À ma sauce');
  assert.strictEqual(fi.actif, false);
  assert.ok(evObj(`!!S.instances.commission_educative`), 'les instances absentes sont ajoutées');
  const perso = evObj(`S.instances.perso`);
  assert.deepStrictEqual([perso.builtin, perso.description, perso.actif], [false, '', true]);
  // Un fichier ANTÉRIEUR à la section, sans `instances` du tout, arrive avec le catalogue.
  ev(`S = _emptyState(); delete S.instances; postLoadHook();`);
  assert.ok(evObj(`Object.keys(S.instances).length`) >= 13);
});

test('instanceAdd / instanceSet / instanceRemove : on ajoute, on règle, on ne supprime que ce qui est libre', () => {
  ev(FIXTURE);
  const id = ev(`instanceAdd('  Tutorat ', 'Suivi hebdomadaire').id`);
  assert.deepStrictEqual(evObj(`[S.instances['${id}'].label, S.instances['${id}'].description, S.instances['${id}'].builtin]`), ['Tutorat', 'Suivi hebdomadaire', false]);
  assert.ok(evObj(`S.instances['${id}'].ord > INSTANCES_DEFAUT.length - 1`), 'ajoutée en fin de liste');
  assert.strictEqual(ev(`instanceAdd('   ')`), null);
  assert.strictEqual(ev(`instanceSet('fiche_incident', { label: 'Rapport', actif: false })`), true);
  assert.deepStrictEqual(evObj(`[S.instances.fiche_incident.label, S.instances.fiche_incident.actif]`), ['Rapport', false]);
  assert.ok(!evObj(`_instancesActives().some(i => i.id === 'fiche_incident')`), 'décochée = plus proposée');
  assert.strictEqual(ev(`instanceSet('fiche_incident', { label: '  ' }); S.instances.fiche_incident.label`), 'Rapport', 'un nom vide est ignoré');
  // D'office : jamais supprimée. Ajoutée : supprimée si libre, gardée si une entrée s'en sert.
  assert.strictEqual(ev(`instanceRemove('fiche_incident')`), false);
  ev(`incidentAdd('s1', { date: '2025-10-03', type: '${id}', objet: 'Séance 1' })`);
  assert.strictEqual(ev(`instanceRemove('${id}')`), false);
  ev(`incidentRemove('s1', _incidentsOf('s1')[0].id)`);
  assert.strictEqual(ev(`instanceRemove('${id}')`), true);
});

test('_instanceOf ne perd jamais un libellé : instance inconnue → repère minimal, inactive', () => {
  ev(FIXTURE);
  assert.deepStrictEqual(evObj(`[_instanceOf('zz').label, _instanceOf('zz').actif, _instanceOf('blame').label]`), ['zz', false, 'Blâme']);
});

// ─────────────────────────── Entrées ───────────────────────────

test('incidentAdd : refuse date illisible et objet vide, replie un type inconnu sur « autre »', () => {
  ev(FIXTURE);
  assert.strictEqual(ev(`incidentAdd('s1', { date: '2025-13-40', type: 'fiche_incident', objet: 'x' })`), null);
  assert.strictEqual(ev(`incidentAdd('s1', { date: '2025-10-03', type: 'fiche_incident', objet: '   ' })`), null);
  assert.strictEqual(ev(`incidentAdd('fantome', { date: '2025-10-03', type: 'fiche_incident', objet: 'x' })`), null);
  const e = evObj(`incidentAdd('s1', { date: '2025-10-03', type: 'inconnu', objet: ' Bagarre ', texte: ' Mot au carnet ' })`);
  assert.deepStrictEqual([e.type, e.objet, e.texte, e.pdf], ['autre', 'Bagarre', 'Mot au carnet', null]);
  assert.strictEqual(evObj(`S.eleves.s1.incidents.length`), 1);
});

test('_incidentsOf : du plus récent au plus ancien, ts en départage', () => {
  ev(FIXTURE);
  ev(`incidentAdd('s1', { date: '2025-10-03', type: 'fiche_incident', objet: 'A' });
      incidentAdd('s1', { date: '2026-02-05', type: 'commission_educative', objet: 'C' });
      incidentAdd('s1', { date: '2025-10-03', type: 'punition', objet: 'B' });
      S.eleves.s1.incidents[2].ts = S.eleves.s1.incidents[0].ts + 1;`);
  assert.deepStrictEqual(evObj(`_incidentsOf('s1').map(e => e.objet)`), ['C', 'B', 'A']);
  assert.strictEqual(evObj(`_incidentLast('s1').objet`), 'C');
  assert.deepStrictEqual(evObj(`_incidentsOf('s2')`), []);
});

test('incidentSet : modifie champ par champ, refuse ce qui viderait l\'entrée', () => {
  ev(FIXTURE);
  const id = ev(`incidentAdd('s1', { date: '2025-10-03', type: 'fiche_incident', objet: 'A' }).id`);
  assert.strictEqual(ev(`incidentSet('s1', '${id}', { objet: '  ' })`), false);
  assert.strictEqual(ev(`incidentSet('s1', '${id}', { date: 'hier' })`), false);
  assert.strictEqual(ev(`incidentSet('s1', '${id}', { date: '2025-10-04', type: 'zz', texte: ' Décision : contrat ' })`), true);
  assert.deepStrictEqual(evObj(`(({date, type, texte, objet}) => [date, type, texte, objet])(S.eleves.s1.incidents[0])`), ['2025-10-04', 'autre', 'Décision : contrat', 'A']);
  assert.strictEqual(ev(`incidentSet('s1', 'fantome', { objet: 'x' })`), false);
});

test('incidentSetPdf / incidentRemove : la référence du PDF, jamais le fichier', () => {
  ev(FIXTURE);
  const id = ev(`incidentAdd('s1', { date: '2025-10-03', type: 'fiche_incident', objet: 'A' }).id`);
  assert.strictEqual(ev(`incidentSetPdf('s1', '${id}', { nom: 'fiche incident.pdf', fichier: '${id}-fiche_incident.pdf', taille: 23456 })`), true);
  assert.deepStrictEqual(evObj(`S.eleves.s1.incidents[0].pdf`), { nom: 'fiche incident.pdf', fichier: `${id}-fiche_incident.pdf`, taille: 23456 });
  assert.deepStrictEqual(evObj(`[..._pjReferences()]`), [`${id}-fiche_incident.pdf`]);
  assert.strictEqual(ev(`incidentSetPdf('s1', '${id}', { nom: 'x' })`), true, 'sans nom de fichier : détaché');
  assert.strictEqual(evObj(`S.eleves.s1.incidents[0].pdf`), null);
  assert.strictEqual(ev(`incidentRemove('s1', '${id}')`), true);
  assert.deepStrictEqual(evObj(`S.eleves.s1.incidents`), []);
  assert.strictEqual(ev(`incidentRemove('s1', '${id}')`), false);
});

test('_pjSafeName : sans chemin ni caractères interdits, accents et espaces gardés, en .pdf', () => {
  assert.strictEqual(ev(`_pjSafeName('C:\\\\scans\\\\fiche incident élève.PDF')`), 'fiche incident élève.pdf');
  assert.strictEqual(ev(`_pjSafeName('../../x/y.pdf')`), 'y.pdf');
  assert.strictEqual(ev(`_pjSafeName('')`), 'document.pdf');
  assert.strictEqual(ev(`_pjSafeName('a:b*c?d"e<f>g|h')`), 'a_b_c_d_e_f_g_h.pdf');
  assert.strictEqual(ev(`_pjSafeName('  .. espace   double . ')`), 'espace double.pdf');
  assert.ok(ev(`_pjSafeName('x'.repeat(200) + '.pdf')`).length <= 104);
});

test('_pjAutoNom : type, qui, puis la date en AAAA-MM-JJ — lisible et triable dans le dossier', () => {
  assert.strictEqual(ev(`_pjAutoNom('incident', { date: '2026-02-05', instance: 'Commission éducative', nom: 'GUÉRIN', prenom: 'Nathan' })`), 'Commission éducative — GUÉRIN Nathan — 2026-02-05.pdf');
  assert.strictEqual(ev(`_pjAutoNom('pv', { date: '2025-10-03', classe: '5e C' })`), 'PV élection délégués — 5e C — 2025-10-03.pdf');
  assert.strictEqual(ev(`_pjAutoNom('pvdd', { date: '2025-10-03', classe: '5e C' })`), 'PV délégués — 5e C — 2025-10-03.pdf');
  assert.match(ev(`_pjAutoNom('incident', { date: 'hier', instance: 'X', nom: 'A', prenom: 'B' })`), /^X — A B — \d{4}-\d{2}-\d{2}\.pdf$/, "date illisible → aujourd'hui");
});

test('_sanitizeCoreSections : incidents absents ou invalides recréés, entrées non-objet écartées', () => {
  ev(`S = _emptyState(); S.eleves.s1 = { id:'s1', nom:'A', prenom:'B', classe_id:'5C', incidents: 'nope' };
      S.eleves.s2 = { id:'s2', nom:'C', prenom:'D', classe_id:'5C', incidents: [ 42, null, { id:'inc_1', date:'2025-10-03', type:'autre', objet:'x' } ] };
      S.instances = [];
      postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.eleves.s1.incidents`), []);
  assert.strictEqual(evObj(`S.eleves.s2.incidents.length`), 1);
  assert.ok(evObj(`_isPlainObj(S.instances) && Object.keys(S.instances).length > 0`));
});

test('_validateImport accepte la section instances et refuse une clé empoisonnée dedans', () => {
  assert.strictEqual(ev(`_validateImport({ instances: { fiche_incident: { id:'fiche_incident' }, inst_1: {} } })`), null);
  // ⚠️ Par JSON.parse : dans un littéral, '__proto__' pose le prototype au lieu d'une clé propre.
  assert.match(ev(`_validateImport(JSON.parse('{"instances":{"__proto__":{}}}')) || ''`), /interdite/);
  assert.match(ev(`_validateImport({ instances: { 'a b': {} } }) || ''`), /invalide/i);
});

// ─────────────────────────── Synthèse ───────────────────────────

test('_syntheseRow porte le nombre d\'incidents et le dernier', () => {
  ev(FIXTURE);
  ev(`incidentAdd('s1', { date: '2025-10-03', type: 'fiche_incident', objet: 'A' });
      incidentAdd('s1', { date: '2026-02-05', type: 'commission_educative', objet: 'Convocation' });`);
  const r = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s1)`);
  assert.strictEqual(r.nbIncidents, 2);
  assert.deepStrictEqual(r.incident, { date: '2026-02-05', type: 'commission_educative', objet: 'Convocation' });
  const r2 = evObj(`_syntheseRow(S.classes['5C'], S.eleves.s2)`);
  assert.deepStrictEqual([r2.nbIncidents, r2.incident], [0, null]);
  // Tri « par incidents » : le plus chargé d'abord, puis le plus récent, puis le nom.
  ev(`eleveSort = { col: 'incidents', dir: 1 };`);
  assert.deepStrictEqual(evObj(`_elevesRows(S.classes['5C']).map(x => x.s.id)`), ['s1', 's2']);
  ev(`eleveSort = { col: 'nom', dir: 1 };`);
});

test('la démo porte des incidents de plusieurs instances, aux ids déterministes', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true, today: '2026-09-09' });`);
  const l = evObj(`Object.values(S.eleves).flatMap(e => e.incidents || [])`);
  assert.ok(l.length >= 4);
  assert.ok(new Set(l.map(e => e.type)).size >= 4, 'plusieurs instances rencontrées');
  assert.ok(l.every(e => /^demo_i\d{2}$/.test(e.id) && e.pdf === null));
});

test('le catalogue porte les noms réels, rangés par famille, dans l\'ordre du texte', () => {
  ev(`S = _emptyState(); postLoadHook();`);
  const fam = evObj(`_instancesParFamille(_instancesAll()).map(g => [g.cat, g.items.map(i => i.id)])`);
  assert.deepStrictEqual(fam.map(g => g[0]), ['signalement', 'punition', 'sanction', 'mesure', 'instance', 'protection', 'autre']);
  // R511-13 : l'échelle des sanctions, exhaustive et dans l'ordre.
  assert.deepStrictEqual(fam.find(g => g[0] === 'sanction')[1], ['avertissement', 'blame', 'responsabilisation', 'exclusion_classe', 'exclusion_temp', 'exclusion_def']);
  // Circulaire 2014-059 : la liste indicative des punitions.
  assert.deepStrictEqual(fam.find(g => g[0] === 'punition')[1], ['excuse', 'devoir_supp', 'retenue', 'exclusion_cours', 'punition']);
  assert.strictEqual(evObj(`S.instances.fiche_incident.label`), 'Rapport d’incident');
  assert.strictEqual(evObj(`S.instances.exclusion_temp.label`), 'Exclusion temporaire de l’établissement');
  assert.ok(evObj(`_instancesAll().every(i => INSTANCES_FAMILLES[i.cat])`), 'chaque instance a une famille connue');
});

test('migration des libellés : l\'ancien défaut suit le nouveau, un libellé de l\'utilisateur est respecté', () => {
  ev(`S = _emptyState(); S.instances = {
    fiche_incident: { id:'fiche_incident', label:'Fiche incident', description:'Signalement écrit d’un incident (rapport à la vie scolaire ou au chef d’établissement).', actif:true, ord:0, builtin:true },
    exclusion_temp: { id:'exclusion_temp', label:'Mise à pied', description:'À ma sauce', actif:false, ord:6, builtin:true },
    punition:       { id:'punition', label:'Punition scolaire', description:'Ma description', actif:true, ord:1, builtin:true },
    perso:          { id:'perso', label:'Tutorat maison', actif:true, ord:50 },
  }; postLoadHook();`);
  assert.deepStrictEqual(evObj(`[S.instances.fiche_incident.label, S.instances.fiche_incident.description.slice(0, 20)]`), ['Rapport d’incident', 'Signalement écrit d’']);
  assert.deepStrictEqual(evObj(`[S.instances.exclusion_temp.label, S.instances.exclusion_temp.description, S.instances.exclusion_temp.actif]`), ['Mise à pied', 'À ma sauce', false]);
  assert.deepStrictEqual(evObj(`[S.instances.punition.label, S.instances.punition.description]`), ['Autre punition', 'Ma description'], 'libellé migré, description de l\'utilisateur gardée');
  // L'ordre des instances d'office suit le tableau, même pour un fichier ancien.
  assert.ok(evObj(`S.instances.exclusion_temp.ord > S.instances.exclusion_classe.ord`));
  assert.deepStrictEqual(evObj(`[S.instances.perso.cat, S.instances.perso.builtin]`), ['autre', false]);
  assert.strictEqual(evObj(`_instancesParFamille(_instancesAll()).find(g => g.cat === 'autre').items.map(i => i.id).join()`), 'autre,perso');
});
