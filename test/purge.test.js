// Suppression en cascade. Deux formes, et il FAUT les deux :
//   - la version énumérative, qui dit précisément ce qui doit disparaître ;
//   - la version BALAYANTE, qui monte un état maximal, supprime, puis cherche le
//     moindre reste dans JSON.stringify(S). Seule la seconde voit un champ NOUVEAU.
// Chaque test balayant porte son méta-test : on injecte un cas volontairement fautif
// et on vérifie que le détecteur le voit. Sans lui, une régression du parcours rendrait
// la suite silencieusement vacante — pire que pas de test du tout.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);

// État maximal : chaque section de S porte au moins une référence à `s1` et à la
// classe « 5C ». ⚠️ Toute nouvelle section indexée par sid doit être ajoutée ICI.
const MAXIMAL = `S = {
  version: 1, clock: { dev_a: 3 },
  classes: {
    // ⚠️ La 5C porte un PLACEMENT : c'est une donnée indexée par sid qui ne vit ni dans
    // S.eleves ni dans une section de premier niveau, mais au fond de la classe. Le
    // balayage doit la voir, sinon un élève supprimé resterait assis et réapparaîtrait
    // en tête de la grille triée par place, sous forme d'un id que plus rien ne nomme.
    '5C': { id: '5C', nom: '5C', annee: '2025-26', eleves: ['s1','s2'], ord: 0,
            // Délégués désignés SANS vote : un état courant indexé par sid, à purger.
            delegues: { date: '2025-10-01', titulaires: ['s1'], suppleants: ['s2'], note: '' },
            salleCur: 'sa1',
            rooms: { sa1: { seating: { '0,0': 's1', '1,2': 's2' } },
                     sa2: { seating: { '2,1': 's1' } } } },
    '5D': { id: '5D', nom: '5D', annee: '2025-26', eleves: ['s3'],      ord: 1,
            salleCur: 'sa1', rooms: { sa1: { seating: { '0,3': 's3' } } } },
  },
  salles: {
    sa1: { id: 'sa1', nom: 'Salle 102', rows: 4, cols: 6,
           patterns: [{ id: 'pat_1', nom: 'Serpentin', order: ['0,0','1,2','0,3','2,1'] }] },
    sa2: { id: 'sa2', nom: 'Labo', rows: 3, cols: 4, patterns: [] },
  },
  eleves: {
    // ⚠️ Les incidents vivent SUR l'élève (ils partent avec lui) mais leur « type » pointe
    // le catalogue S.instances — qui, lui, ne connaît aucun sid : rien à purger, et le
    // balayage doit le constater plutôt que le supposer.
    s1: { id: 's1', nom: 'Durand', prenom: 'Léa',  classe_id: '5C', tags: ['tag_1'], remarque: 'Appel à la mère le 11/10',
          incidents: [ { id: 'inc_1', date: '2025-10-03', ts: 3, type: 'fiche_incident', objet: 'Insolence', texte: '', pdf: { nom: 'f.pdf', fichier: 'inc_1-f.pdf', taille: 1000 } } ] },
    s2: { id: 's2', nom: 'Martin', prenom: 'Noé',  classe_id: '5C', tags: [] },
    s3: { id: 's3', nom: 'Petit',  prenom: 'Inès', classe_id: '5D', tags: ['tag_1'] },
  },
  tags: { tag_1: { id: 'tag_1', abbr: 'LATIN', name: 'Latin', color: '#16a085' } },
  releves: {
    '5C': { '2025-10-01': { date: '2025-10-01', ts: 1, counts: { s1: 7,   s2: 10 } },
            '2025-10-15': { date: '2025-10-15', ts: 2, counts: { s1: 'A', s2: 13 } } },
    '5D': { '2025-10-01': { date: '2025-10-01', ts: 1, counts: { s3: 2 } } },
  },
  documents: {
    d1: { id: 'd1', titre: 'Devoirs Faits', classIds: ['5C','5D'], champs: [], retours: {
            s1: { rendu: true, dateRetour: '2025-09-20', reponses: {}, note: '' },
            s3: { rendu: false, dateRetour: null, reponses: {}, note: '' } } },
    d2: { id: 'd2', titre: 'Fiche 5C seule', classIds: ['5C'], champs: [], retours: {
            s2: { rendu: true, dateRetour: null, reponses: {}, note: '' } } },
  },
  elections: {
    '5C': { el1: { id: 'el1', classId: '5C', clos: true, assesseurs: ['s2'],
                   tours: [ { n: 1, candidats: [ { id: 'c1', sidTitulaire: 's1', sidSuppleant: 's2',
                                                   nomTitulaire: 'Léa Durand', nomSuppleant: 'Noé Martin' } ],
                              bulletins: [ { n: 1, voix: ['c1'], statut: 'valide' } ] } ] } },
  },
  prefs: { periodMode: 'semestre', codeAbsent: 'A' },
  instances: { fiche_incident: { id: 'fiche_incident', label: 'Fiche incident', description: '', actif: true, ord: 0, builtin: true } },
  cur: '5C',
};`;
// ⚠️ MAXIMAL doit citer CHAQUE section de S, sinon le balayage certifie une couverture
// qu'il n'a pas. Ce test le vérifie plutôt que de compter sur la relecture.
test('MÉTA-TEST : l\'état maximal touche bien toutes les sections de S', () => {
  ev(MAXIMAL);
  const vides = ev(`Object.entries(_emptyState())
    .filter(([k, v]) => v && typeof v === 'object' && !Array.isArray(v))
    .filter(([k]) => !Object.keys(S[k] || {}).length)
    .map(([k]) => k)`);
  assert.deepStrictEqual([...vides], [],
    'sections non couvertes par l\'état maximal : ' + [...vides].join(', '));
});

// Balaye tout S SAUF les exceptions déclarées, et renvoie les chemins où `needle`
// survit. Les élections sont l'exception assumée : un procès-verbal signé est un
// document historique, on n'en retire pas un candidat parce qu'il a déménagé en mars.
function sweep(needle, extraSection) {
  return ev(`(() => {
    const copy = JSON.parse(JSON.stringify(S));
    delete copy.elections;   // exception assumée (PV historique)
    const hits = [];
    const walk = (o, path) => {
      if (o === null || typeof o !== 'object') {
        if (String(o) === ${JSON.stringify(needle)}) hits.push(path);
        return;
      }
      for (const k of Object.keys(o)) {
        if (k === ${JSON.stringify(needle)}) hits.push(path + '.' + k);
        walk(o[k], path + '.' + k);
      }
    };
    walk(copy, 'S');
    return hits;
  })()`);
}

test('_purgeStudentRefs retire l\'élève de toutes les sections indexées par sid', () => {
  const r = ev(`(() => {
    ${MAXIMAL}
    _purgeStudentRefs('s1');
    return {
      eleve:   's1' in S.eleves,
      roster:  S.classes['5C'].eleves.slice(),
      releve1: Object.keys(S.releves['5C']['2025-10-01'].counts),
      releve2: Object.keys(S.releves['5C']['2025-10-15'].counts),
      retours: Object.keys(S.documents.d1.retours),
      // Exception assumée : l'élection garde son candidat, et son identité figée.
      cand:    S.elections['5C'].el1.tours[0].candidats[0].sidTitulaire,
      nom:     S.elections['5C'].el1.tours[0].candidats[0].nomTitulaire,
    };
  })()`);
  assert.strictEqual(r.eleve, false);
  assert.deepStrictEqual([...r.roster], ['s2']);
  assert.deepStrictEqual([...r.releve1], ['s2']);
  assert.deepStrictEqual([...r.releve2], ['s2']);
  assert.deepStrictEqual([...r.retours], ['s3']);
  assert.strictEqual(r.cand, 's1');
  assert.strictEqual(r.nom, 'Léa Durand');
});

test('BALAYAGE : plus aucune trace de l\'élève supprimé hors des élections', () => {
  ev(MAXIMAL);
  ev(`_purgeStudentRefs('s1')`);
  const hits = sweep('s1');
  assert.deepStrictEqual([...hits], [], 'restes trouvés : ' + [...hits].join(', '));
});

test('MÉTA-TEST : le balayage voit bien un champ que la purge a oublié', () => {
  // Sans ce test, une régression du parcours (mauvais chemin, mauvaise comparaison)
  // rendrait le balayage précédent vert et vide de sens.
  ev(MAXIMAL);
  ev(`S.sectionOubliee = { s1: { note: 'champ ajouté sans passer par _purgeStudentRefs' } }`);
  ev(`_purgeStudentRefs('s1')`);
  const hits = sweep('s1');
  assert.ok([...hits].length > 0, 'le balayage aurait dû repérer S.sectionOubliee.s1');
  assert.ok([...hits].some(h => h.includes('sectionOubliee')));
});

test('_purgeClassRefs emporte relevés, élections, élèves et documents orphelins', () => {
  const r = ev(`(() => {
    ${MAXIMAL}
    _purgeClassRefs('5C');
    return {
      classe:   '5C' in S.classes,
      releves:  '5C' in S.releves,
      elections:'5C' in S.elections,
      eleves:   Object.keys(S.eleves),
      // d1 concernait 5C ET 5D : il survit, amputé de 5C.
      d1:       S.documents.d1 ? S.documents.d1.classIds.slice() : null,
      // d2 ne concernait que 5C : plus aucune classe vivante, il disparaît.
      d2:       'd2' in S.documents,
      cur:      S.cur,
    };
  })()`);
  assert.strictEqual(r.classe, false);
  assert.strictEqual(r.releves, false);
  assert.strictEqual(r.elections, false);
  assert.deepStrictEqual([...r.eleves], ['s3']);
  assert.deepStrictEqual([...r.d1], ['5D']);
  assert.strictEqual(r.d2, false);
  assert.strictEqual(r.cur, '5D');
});

test('BALAYAGE : plus aucune trace de la classe supprimée', () => {
  ev(MAXIMAL);
  ev(`_purgeClassRefs('5C')`);
  const hits = sweep('5C');
  assert.deepStrictEqual([...hits], [], 'restes trouvés : ' + [...hits].join(', '));
});

test('_auditState repère les références fantômes, et se tait sur un état sain', () => {
  assert.deepStrictEqual([...ev(`(() => { ${MAXIMAL} return _auditState(); })()`)], []);
  const pb = ev(`(() => {
    ${MAXIMAL}
    delete S.eleves.s1;                       // retiré SANS passer par la purge
    S.releves['5X'] = { '2025-10-01': { counts: {} } };
    return _auditState();
  })()`);
  const txt = [...pb].join(' | ');
  assert.match(txt, /élève fantôme s1/);
  assert.match(txt, /classe inconnue 5X/);
});
