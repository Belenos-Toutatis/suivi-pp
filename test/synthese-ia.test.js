// 🤖 Synthèse par une IA (v1.69.0) : le texte qu'on copie ne porte aucun nom que l'app connaît,
// la relecture signale le reste, et la réponse revient avec les vrais noms, rangée à côté du bilan.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;`;
// Des éléments qui durent (le stub du harnais en rend un neuf par appel).
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;

const CTX = `({ personnes: [
  { id: 'moi', jeton: '[Élève]', retour: 'Noé', formes: [..._iaFormesNom('Noé'), 'MARTIN Noé', 'Noé MARTIN'] },
  { id: 'moi:nom', jeton: "[Nom de l'élève]", retour: 'MARTIN', formes: _iaFormesNom('MARTIN') },
  { id: 's2', famille: '[Camarade {n}]', retour: 'Léa', formes: [..._iaFormesNom('Léa'), 'DUPONT Léa', ..._iaFormesNom('DUPONT')] },
  { id: 's3', famille: '[Camarade {n}]', retour: 'Marie-Lou', formes: [..._iaFormesNom('Marie-Lou'), ..._iaFormesNom('LE GALL')] },
  { id: 'p1', jeton: '[Professeur de SVT]', formes: _iaFormesAdulte('Mme ZOLA') },
  { id: 'p2', jeton: '[Professeur de SVT]', formes: _iaFormesAdulte('M. HUGO') },
  { id: 'etab', jeton: '[Établissement]', formes: ['Collège Les Tilleuls', 'Les Tilleuls'] },
] })`;

test('le pliage garde la longueur (les positions trouvées valent dans le texte d’origine)', () => {
  const r = evObj(`['Noé Lœtitia ÉLÉONORE', 'İstanbul 🙂'].map(t => [t.length, _iaPlie(t).length, _iaPlie(t)])`);
  assert.deepStrictEqual(r[0], [20, 20, 'noe lœtitia eleonore']);
  assert.strictEqual(r[1][0], r[1][1]);
});

test('noms connus remplacés : la forme la plus longue d’abord, sans casse ni accents, entre deux non-lettres', () => {
  const t = `Remarque : Noé bavarde avec Léa et Marie Lou en SVT. Appel à Mme Martin le 11/10 (06 12 34 56 78).
– Léandre et Noémie ne sont pas concernés ; noe écrit sans accent ; MARTIN Noé au complet.
Rencontre avec M. Bernard, Mme Zola et M. Hugo au Collège Les Tilleuls. Écrire à sandrine.x@exemple.fr.
Le Gall est absent. [Élève] reste tel quel.`;
  const r = evObj(`_iaPseudo(${JSON.stringify(t)}, ${CTX})`);
  const L = r.texte.split('\n');
  assert.strictEqual(L[0], 'Remarque : [Élève] bavarde avec [Camarade 1] et [Camarade 2] en SVT. Appel à Mme [Nom de l\'élève] le 11/10 ([téléphone]).');
  assert.strictEqual(L[1], '– Léandre et Noémie ne sont pas concernés ; [Élève] écrit sans accent ; [Élève] au complet.', 'Léandre ≠ Léa, Noémie ≠ Noé');
  assert.strictEqual(L[2], 'Rencontre avec M. [Adulte 1], [Professeur de SVT] et [Professeur de SVT 2] au [Établissement]. Écrire à [courriel].');
  assert.strictEqual(L[3], '[Camarade 2] est absent. [Élève] reste tel quel.', 'un nom de famille composé ; un repère déjà là n’est pas touché');
  assert.deepStrictEqual(r.table.jetons['[Élève]'].vus, { 'Noé': 1, noe: 1, 'MARTIN Noé': 1 });
  // Second passage (un nom revenu à la main) : mêmes numéros, le suivant pour un nouveau.
  const r2 = evObj(`(() => { const a = _iaPseudo(${JSON.stringify(t)}, ${CTX}); return _iaPseudo(a.texte + ' Puis Marie-Lou, Léa et Mme Durand.', ${CTX}, a.table); })()`);
  assert.match(r2.texte, /Puis \[Camarade 2\], \[Camarade 1\] et Mme \[Adulte 2\]\.$/);
  // Une forme écartée (« ce n'est pas un nom ») est laissée.
  assert.strictEqual(evObj(`_iaPseudo('Léa et Noé', { ...${CTX}, ignores: new Set(['lea']) }).texte`), 'Léa et [Élève]');
});

test('la réponse revient avec les vrais noms, repères tolérés tels qu’un assistant les réécrit', () => {
  const r = evObj(`(() => { const a = _iaPseudo('Noé et Léa ; M. Bernard ; Mme Zola.', ${CTX});
    return _iaRestaure("[élève] progresse ; [ Camarade 1 ] l'aide. [Adulte 1] a appelé, [Professeur de svt] aussi. [Inconnu] reste.", a.table); })()`);
  assert.strictEqual(r, "Noé progresse ; Léa l'aide. Bernard a appelé, Mme Zola aussi. [Inconnu] reste.");
  assert.strictEqual(ev(`_iaNettoie('\`\`\`text\\n## Synthèse\\n**Noé** progresse.\\n* point 1\\n\`\`\`')`), 'Synthèse\nNoé progresse.\n– point 1');
});

test('à vérifier : une majuscule en milieu de phrase ou un mot en capitales — pas un début de phrase, ni un mot connu de l’app', () => {
  const s = evObj(`_iaSuspects('Sandrine a appelé. Il voit Sophie à Lyon avec DURAND, en SVT et en LV2 au S1. – Bon travail. Elle : Très bien. [Camarade 1] aussi.', new Set([...IA_MOTS_OK, 's1']))`);
  assert.deepStrictEqual(s.map(x => x.mot), ['Sophie', 'Lyon', 'DURAND']);
  assert.deepStrictEqual(evObj(`_iaSuspects('Il voit Sophie, puis Sophie.', null, new Set(['sophie']))`), [], 'un mot laissé n’est plus signalé');
  assert.deepStrictEqual(evObj(`_iaFuites('Il voit Léa puis léa, et [Camarade 1].', ${CTX}.personnes)`), [{ mot: 'Léa', n: 2 }]);
});

// ── Sur la démo : AUCUN nom connu ne part, pour aucun élève ni aucun moment, toutes données cochées ──
// Détecteur INDÉPENDANT du moteur (regex sur le texte plié), avec son méta-test.
const PLIE = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PART = new Set(['de', 'du', 'des', 'le', 'la', 'les']);
function restes(texte, noms) {
  const t = PLIE(texte);
  return noms.filter(n => new RegExp(`(^|[^\\p{L}\\p{N}])${ESC(PLIE(n))}([^\\p{L}\\p{N}]|$)`, 'u').test(t));
}
function nomsConnus() {
  return evObj(`(() => { const N = new Set(), mots = s => String(s || '').trim().replace(/^(M\\.|Mme|Mlle)\\s+/i, '').split(/[\\s,;/-]+/).forEach(w => { if (w.length >= 3) N.add(w); });
    Object.values(S.eleves).forEach(s => { mots(s.nom); mots(s.prenom); });
    mots(S.prefs.avisNom); mots(String(S.prefs.etablissement || '').replace(/^Collège\\s+/, '').replace(/[()]/g, ''));
    const cls = getCls(); _disciplinesAll().forEach(d => String(_discProfs(cls.id, d.id)).split(',').forEach(mots));
    _moyReleves(cls.id).forEach(r => Object.values(r.profs || {}).forEach(p => String(p).split(',').forEach(mots)));
    return [...N]; })()`).filter(n => !PART.has(PLIE(n)) && PLIE(n) !== 'demo');
}

test('démo, tous les élèves, tous les moments, tout coché : aucun nom connu dans le texte à copier', () => {
  ev(DEMO);
  // Un nom de camarade et le nom de la mère sont bien dans les textes libres de la démo (sinon le test serait vacant).
  const brut = ev(`(() => { const cls = getCls(); return cls.eleves.map(sid => _ficheMoments(cls).map(col => _iaDonnees(cls, S.eleves[sid], col, new Set(IA_BLOCS.map(x => x.k))).texte).join('\\n')).join('\\n'); })()`);
  const noms = nomsConnus();
  assert.ok(noms.length > 40, 'des noms à chercher');
  assert.ok(restes(brut, noms).length >= 2, 'MÉTA-TEST : le détecteur voit les noms du texte brut');
  const fautes = evObj(`(() => { const cls = getCls(), out = [];
    for (const sid of cls.eleves) for (const col of _ficheMoments(cls)) {
      const stu = S.eleves[sid], d = _iaDonnees(cls, stu, col, new Set(IA_BLOCS.map(x => x.k)));
      out.push({ sid, col: col.key, texte: _iaPseudo(d.texte, { personnes: _iaPersonnes(cls, stu) }).texte });
    } return out; })()`);
  assert.ok(fautes.length >= 25 * 4);
  const vus = fautes.map(f => ({ ...f, r: restes(f.texte, noms) })).filter(f => f.r.length);
  assert.deepStrictEqual(vus.map(f => `${f.sid} ${f.col} : ${f.r.join(', ')}`), []);
  // Rien de ce que l'app écrit elle-même n'est « à vérifier » (matières composées, codes de moyenne, S1…).
  assert.deepStrictEqual(evObj(`(() => { const cls = getCls(), out = new Set();
    for (const sid of cls.eleves) for (const col of _ficheMoments(cls)) { const stu = S.eleves[sid], d = _iaDonnees(cls, stu, col, new Set(IA_BLOCS.map(x => x.k)));
      _iaSuspects(_iaPseudo(d.texte, { personnes: _iaPersonnes(cls, stu) }).texte, new Set([...IA_MOTS_OK, ...d.ok])).forEach(s => out.add(s.mot)); }
    return [...out]; })()`), []);
  // Et le moteur lui-même n'y voit plus de fuite.
  assert.strictEqual(ev(`(() => { const cls = getCls(), stu = S.eleves[cls.eleves[0]], col = _ficheMoments(cls)[2];
    const t = _iaPseudo(_iaDonnees(cls, stu, col, new Set(IA_BLOCS.map(x => x.k))).texte, { personnes: _iaPersonnes(cls, stu) }).texte;
    return _iaFuites(t, _iaPersonnes(cls, stu)).length; })()`), 0);
});

test('le texte suit les cases : âge, options et aménagements décochés d’office ; tout est borné au moment', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[0], stu = S.eleves[sid], col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0');
    stu.pap = true; stu.pai = true;
    // Sans le brouillon (v1.76.0 : le bilan déjà écrit pour ce moment, qui peut citer ce qu'il veut) : ce qui est borné au moment.
    const sansB = new Set([..._iaBlocs()].filter(k => k !== 'brouillon'));
    const def = _iaDonnees(cls, stu, col, sansB).texte, tout = _iaDonnees(cls, stu, col, new Set(IA_BLOCS.map(x => x.k))).texte;
    const avecB = _iaDonnees(cls, stu, col, _iaBlocs()).texte, bil = _bilanCible(cls, sid, { type: col.type, date: col.date });
    return { def, tout, avecB, bil: bil ? bil.texte : null, debut: _ficheBornes(cls, col).start }; })()`);
  assert.doesNotMatch(r.def, /PAP|PAI|\b\d+ ans\b|Groupe et options/);
  assert.match(r.tout, /Aménagements : PAP, PAI\./);
  assert.match(r.def, /^Élève : \[Élève\], un garçon, en 5e\.\nMoment : Conseil de classe S1, du 01\/09 au 31\/01\./);
  // La commission éducative de février est au S2 : pas dans la synthèse du conseil du S1.
  assert.match(r.def, /Incidents : 2\./);
  assert.doesNotMatch(r.def, /commission/i);
  // Le brouillon part d'office : le bilan du conseil (l'appréciation du bulletin), avec sa limite.
  assert.ok(r.bil, 'la démo a un bilan du conseil du S1 pour cet élève');
  assert.ok(r.avecB.includes(`Mon brouillon pour ce moment, à retravailler (c'est l'appréciation du bulletin : 600 caractères au plus) :\n${r.bil}`));
});

test('modèle : une synthèse par moment, à côté du bilan ; vidée = retirée ; chargement abîmé nettoyé', () => {
  ev(DEMO);
  const sid = ev(`getCls().eleves[3]`), J = JSON.stringify(sid);
  const r = evObj(`(() => { const cls = getCls(), p = _periods(cls)[0], m = { type: 'conseil', date: p.end }, o = [];
    o.push(synthIASet(cls, ${J}, m, '  Bonne période.  '));
    o.push(synthIASet(cls, ${J}, { type: 'conseil', date: p.start }, 'Bonne période.'));
    o.push(synthIASet(cls, ${J}, m, 'Très bonne période.'));
    o.push(_synthIAOf(${J}).length, _synthIACible(cls, ${J}, m).texte, _bilanCible(cls, ${J}, m) ? 'bilan' : 'pas de bilan');
    o.push(synthIASet(cls, ${J}, m, ''), _synthIAOf(${J}).length, synthIASet(cls, ${J}, m, ''));
    return o; })()`);
  assert.deepStrictEqual(r, ['ajout', null, 'modif', 1, 'Très bonne période.', 'pas de bilan', 'suppr', 0, null]);
  ev(`S.eleves[${J}].synthIA = ['x', { date: 'hier', texte: 'a' }, { date: '2025-10-01', texte: 12 }, { date: '2025-10-01', texte: 'ok', type: 'mois' }]; postLoadHook();`);
  assert.deepStrictEqual(evObj(`S.eleves[${J}].synthIA.map(x => x.texte)`), ['ok']);
  ev(`S.eleves[${J}].synthIA = 'texte'; postLoadHook();`);
  assert.strictEqual(ev(`'synthIA' in S.eleves[${J}]`), false);
  // La démo en porte une (au conseil du S1 du premier élève), toujours la même.
  assert.strictEqual(ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _synthIAOf(getCls().eleves[0])[0].id`), 'demo_ia01');
});

test('fiche : la synthèse du moment s’affiche au-dessus du bilan, échappée ; sans elle, le bouton', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), sid = cls.eleves[0], stu = S.eleves[sid];
    const col = _ficheMoments(cls).find(c => c.key === 'bil:conseil:0'), col2 = _ficheMoments(cls).find(c => c.key === 'bil:miperiode:0');
    synthIASet(cls, sid, { type: 'conseil', date: col.date }, '<img src=x onerror=alert(1)> & Cie');
    return { avec: _ficheRedacHTML(cls, stu, col), sans: _ficheRedacHTML(cls, stu, col2) }; })()`);
  assert.match(r.avec, /🤖 Synthèse par une IA · rangée le/);
  assert.match(r.avec, /&lt;img src=x onerror=alert\(1\)&gt; &amp; Cie/);
  assert.doesNotMatch(r.avec, /<img/);
  assert.ok(r.avec.indexOf('fi-ia-t') < r.avec.indexOf('id="fi-bil"'), 'au-dessus de la rédaction');
  assert.match(r.sans, /onclick="openSynthIA\(\)">🤖 Synthèse par une IA…/);
});

test('fenêtre : texte relu sans nom, nom revenu à la main signalé puis remplacé, réponse rangée avec les vrais noms (un cran d’undo)', () => {
  ev(DEMO);
  ev(ELS);
  try {
    const sid = ev(`getCls().eleves[0]`), J = JSON.stringify(sid);
    const prenom = ev(`S.eleves[${J}].prenom`), autre = ev(`S.eleves[getCls().eleves[1]].prenom`);
    // Les contacts (la mère, « Mme Guérin ») sont décochés d'office depuis la v1.73.2 : on les coche, c'est eux que ce test exerce.
    ev(`_iaBlocsSel = new Set(IA_BLOCS.map(x => x.k)); _ficheSid = ${J}; _ficheMoment = 'bil:conseil:0'; undoStack.length = 0; openSynthIA();`);
    const txt = ev(`__els.get('mia-txt').value`);
    assert.match(txt, /^Élève : \[Élève\]/);
    assert.match(txt, /Mère jointe \(Mme \[Nom de l'élève\]\)/);
    assert.ok(!txt.includes(prenom), 'pas le prénom de l’élève');
    assert.match(ev(`__els.get('mia-blocs').innerHTML`), /ia-bloc vide[^>]*><input type="checkbox"[^>]*>Délégué/, 'un bloc sans rien pour cet élève est grisé');
    // Le prénom d'un camarade retapé à la main : signalé, puis remplacé.
    ev(`__els.get('mia-txt').value += ' Il travaille avec ${autre}.'; iaTexteSaisi(); _iaVerifRender();`);
    assert.deepStrictEqual(evObj(`_ia.fuites.map(f => f.mot)`), [autre]);
    assert.ok(!evObj(`_ia.suspects.map(s => s.mot)`).includes(autre), 'un nom connu n’est dit qu’une fois (pas aussi « à vérifier »)');
    assert.match(ev(`__els.get('mia-verif').innerHTML`), /Noms connus encore là/);
    ev(`iaFuitesUI()`);
    assert.match(ev(`__els.get('mia-txt').value`), /Il travaille avec \[Camarade 1\]\.$/);
    assert.deepStrictEqual(evObj(`_ia.fuites`), []);
    // Un mot inconnu à majuscule : masqué par un repère qu'on sait rendre.
    ev(`__els.get('mia-txt').value += ' Il voit Zéphyrine.'; iaTexteSaisi(); _iaVerifRender();`);
    assert.deepStrictEqual(evObj(`_ia.suspects.map(s => s.mot)`), ['Zéphyrine']);
    ev(`iaMasquerUI(0)`);
    assert.match(ev(`__els.get('mia-txt').value`), /Il voit \[Nom 1\]\.$/);
    // La réponse : vrais noms remis, rangée à côté du bilan, un seul cran d'undo.
    ev(`__els.get('mia-rep').value = '**[Élève]** progresse ; [Camarade 1] l\\'aide, [Nom 1] aussi. Mme [Nom de l\\'élève] appelle.'; iaReponseSaisie();`);
    assert.match(ev(`__els.get('mia-rest').innerHTML`), new RegExp(`<mark title="\\[Élève\\]">${prenom}</mark> progresse`));
    ev(`iaRangerUI()`);
    const mode = `{ type: 'conseil', date: _periods(getCls())[0].end }`;
    const vu = ev(`_maj(S.eleves[${J}].nom.toLowerCase())`);   // la forme lue dans le texte (« Mme Guérin »), pas les capitales de la fiche
    assert.strictEqual(ev(`_synthIACible(getCls(), ${J}, ${mode}).texte`), `${prenom} progresse ; ${autre} l'aide, Zéphyrine aussi. Mme ${vu} appelle.`);
    assert.strictEqual(ev(`undoStack.length`), 1);
    ev(`openSynthIA(); iaRangerUI();`);
    assert.strictEqual(ev(`undoStack.length`), 1, 'la même réponse rangée deux fois : pas de second cran');
    ev(`undoLast()`);
    assert.match(ev(`_synthIACible(getCls(), ${J}, ${mode}).texte`), /premier semestre difficile/, 'Ctrl+Z rend la synthèse de la démo');
  } finally { ev(FIN_ELS); }
});

test('consigne : une consigne réécrite est gardée (un cran d’undo), la consigne proposée ne l’est pas', () => {
  ev(DEMO);
  ev(`undoStack.length = 0; iaConsigneUI('Résumez en trois lignes.')`);
  assert.strictEqual(ev(`_iaConsigne()`), 'Résumez en trois lignes.');
  ev(`iaConsigneUI('Résumez en trois lignes.')`);
  assert.strictEqual(ev(`undoStack.length`), 1, 'rien ne change : pas de cran');
  ev(`iaConsigneUI(IA_CONSIGNE)`);
  assert.strictEqual(ev(`S.prefs.iaConsigne`), '');
  assert.strictEqual(ev(`_iaConsigne() === IA_CONSIGNE`), true);
  ev(`iaConsigneUI('Autre.'); iaConsigneUI(null)`);
  assert.strictEqual(ev(`S.prefs.iaConsigne`), '');
});
