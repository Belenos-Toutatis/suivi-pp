// 🤖 Synthèses par une IA, toute la classe d'un coup (v1.70.0) : un repère tiré au hasard par élève, le même partout,
// un JSON sans aucun nom connu, une réponse lue (JSON ou texte) qui retrouve ses élèves, une revue, un cran d'undo.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null; localStorage.removeItem(LS_IA_LOT); for (const k in _iaLotEtats) delete _iaLotEtats[k];`;
const ELS = `window.__els = new Map(); window.__gid = document.getElementById;
  document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`;
const FIN_ELS = `document.getElementById = __gid;`;
const COL = `_ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0')`;

const PLIE = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function restes(texte, noms) {
  const t = PLIE(texte);
  return noms.filter(n => new RegExp(`(^|[^\\p{L}\\p{N}])${ESC(PLIE(n))}([^\\p{L}\\p{N}]|$)`, 'u').test(t));
}

test('les repères : 1…N, chacun une fois, dans un ordre mélangé (pas celui de la liste)', () => {
  ev(DEMO);
  const r = evObj(`(() => { const sids = _iaLotEleves(getCls(), ${COL}, false); let g = 7; const alea = () => (g = (g * 16807) % 2147483647) / 2147483647;
    const c = _iaLotCodes(sids, alea); return { n: sids.length, valeurs: sids.map(s => c[s]) }; })()`);
  assert.strictEqual(r.n, 25);
  assert.deepStrictEqual(r.valeurs.slice().sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.notDeepStrictEqual(r.valeurs, Array.from({ length: 25 }, (_, i) => i + 1), 'pas l’ordre de la liste');
});

test('le texte et le JSON : une section par élève, aucun nom connu, un camarade cité sous SON repère', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), col = ${COL}, sids = _iaLotEleves(cls, col, false), codes = _iaLotCodes(sids);
    const t = _iaLotTexte(cls, col, codes, new Set(IA_BLOCS.map(x => x.k))), j = _iaLotJSON(t.texte, _iaConsigneClasse());
    const noms = new Set(); Object.values(S.eleves).forEach(s => [s.nom, s.prenom].forEach(x => String(x).split(/[\\s-]+/).forEach(w => { if (w.length >= 3) noms.add(w); })));
    return { texte: t.texte, json: JSON.stringify(j), j, noms: [...noms], c9: codes[cls.eleves[9]], c1: codes[cls.eleves[1]], c0: codes[cls.eleves[0]],
      suspects: _iaSuspects(t.texte, new Set([...IA_MOTS_OK, ...t.ok])).map(s => s.mot) }; })()`);
  assert.strictEqual(r.j.eleves.length, 25);
  assert.ok(r.j.eleves.every(e => /^\[Élève \d+\]$/.test(e.eleve) && e.donnees.length && e.donnees[0].startsWith(`Élève : ${e.eleve}`)));
  assert.match(r.j.commun[0], /^Moment : Conseil de classe S1, du 01\/09 au 31\/01\. Classe de 5e, 25 élèves\.$/);
  assert.ok(r.j.consigne.includes('reponse_attendue') && r.j.reponse_attendue.syntheses.length === 2);
  assert.ok(restes(r.texte.replace(/\[[^\]]+\]/g, ''), r.noms).length === 0 && restes(r.json, r.noms).length === 0, 'aucun nom connu, ni dans le texte ni dans le JSON');
  // MÉTA-TEST : le détecteur voit un nom quand il y en a un.
  assert.deepStrictEqual(restes(r.json + ' ' + r.noms[0], r.noms), [r.noms[0]]);
  // Le rappel à l'ordre de l'élève 10 cite l'élève 2 : sous le repère de l'élève 2, dans la section de l'élève 10.
  const sec9 = r.j.eleves.find(e => e.eleve === `[Élève ${r.c9}]`).donnees.join('\n');
  assert.match(sec9, new RegExp(`avec la CPE, \\[Élève ${r.c1}\\] aussi`));
  // La mère de l'élève 1 : « Mme [Nom de l'élève n] » avec SON repère.
  assert.match(r.j.eleves.find(e => e.eleve === `[Élève ${r.c0}]`).donnees.join('\n'), new RegExp(`Mme \\[Nom de l'élève ${r.c0}\\]`));
  assert.deepStrictEqual(r.suspects, [], 'rien de ce que l’app écrit n’est « à vérifier »');
});

test('la réponse : JSON sous plusieurs formes, ou texte avec un titre par élève', () => {
  ev(DEMO);
  const lire = t => evObj(`_iaLotLire(${JSON.stringify(t)})`);
  assert.deepStrictEqual(lire('Voici :\n```json\n{ "syntheses": [ { "eleve": "[Élève 3]", "synthese": "Bien." }, { "élève": "Élève 12", "synthèse": "À suivre." } ] }\n```'),
    [{ n: 3, texte: 'Bien.' }, { n: 12, texte: 'À suivre.' }]);
  assert.deepStrictEqual(lire('[{"code":"[Élève 4]","texte":"Calme."}]'), [{ n: 4, texte: 'Calme.' }]);
  assert.deepStrictEqual(lire('{"[Élève 5]":"Bon trimestre.","[Élève 6]":""}'), [{ n: 5, texte: 'Bon trimestre.' }], 'une synthèse vide n’est pas une synthèse');
  assert.deepStrictEqual(lire('### [Élève 3]\n[Élève 3] progresse.\nSuite.\n\n**[Élève 7]** : Très bien.\nÉlève 8 :\nÀ revoir.'),
    [{ n: 3, texte: '[Élève 3] progresse.\nSuite.' }, { n: 7, texte: 'Très bien.' }, { n: 8, texte: 'À revoir.' }], 'une phrase qui commence par le repère n’est pas un titre');
  assert.deepStrictEqual(lire('rien de reconnaissable'), []);
});

test('fenêtre : repères gardés sur le poste (un rechargement ne perd rien), revue, rangement en un seul cran d’undo', () => {
  ev(DEMO);
  ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:conseil:0'; openSynthIAClasse();`);
    const codes = evObj(`_iaLot.codes`), cls = evObj(`(() => { const c = getCls(); return { e: c.eleves, p: c.eleves.map(s => S.eleves[s].prenom) }; })()`);
    assert.strictEqual(Object.keys(codes).length, 25);
    assert.match(ev(`__els.get('miac-txt').value`), /^Moment : Conseil de classe S1/);
    assert.deepStrictEqual(evObj(`JSON.parse(localStorage.getItem(LS_IA_LOT)).codes`), codes, 'gardés sur le poste');
    // « Rechargement » : la séance est perdue, les repères reviennent du poste.
    ev(`closeMod2('miac'); for (const k in _iaLotEtats) delete _iaLotEtats[k]; openSynthIAClasse();`);
    assert.deepStrictEqual(evObj(`_iaLot.codes`), codes);
    // Une réponse : deux élèves (dont l'un cite l'autre), un repère inconnu, un élève en double.
    const a = codes[cls.e[0]], b = codes[cls.e[1]];
    const rep = JSON.stringify({ syntheses: [
      { eleve: `[Élève ${a}]`, synthese: `[Élève ${a}] progresse ; il aide [Élève ${b}]. Mme [Nom de l'élève ${a}] appelle.` },
      { eleve: `[Élève ${b}]`, synthese: 'Premier jet.' }, { eleve: `[Élève ${b}]`, synthese: `**[Élève ${b}]** reste calme.` },
      { eleve: '[Élève 99]', synthese: 'Inconnu.' }] });
    ev(`__els.get('miac-rep').value = ${JSON.stringify(rep)}; iaLotReponseSaisie(); _iaLotRevueRender();`);
    const R = evObj(`_iaLot.revue`);
    const L = sid => R.lignes.find(l => l.sid === sid);
    assert.deepStrictEqual([R.lignes.length, L(cls.e[0]).etat, L(cls.e[1]).etat], [2, 'remplace', 'nouvelle'], 'l’élève 1 a déjà la synthèse de la démo');
    assert.strictEqual(L(cls.e[0]).texte, `${cls.p[0]} progresse ; il aide ${cls.p[1]}. Mme ${ev(`_maj(S.eleves[${JSON.stringify(cls.e[0])}].nom.toLowerCase())`)} appelle.`);
    assert.strictEqual(L(cls.e[1]).texte, `${cls.p[1]} reste calme.`, 'la dernière des deux, nettoyée');
    assert.deepStrictEqual([R.inconnus, R.doubles, R.manquants.length], [[99], [b], 23]);
    assert.match(ev(`__els.get('miac-revue').innerHTML`), /Pas de synthèse dans la réponse pour : /);
    // Décocher l'un, ranger l'autre : un seul cran d'undo.
    ev(`undoStack.length = 0; iaLotCocheUI(_iaLot.revue.lignes.findIndex(l => l.sid === ${JSON.stringify(cls.e[0])}), false); iaLotRangerUI();`);
    const mode = `{ type: 'conseil', date: _periods(getCls())[0].end }`;
    assert.strictEqual(ev(`_synthIACible(getCls(), ${JSON.stringify(cls.e[1])}, ${mode}).texte`), `${cls.p[1]} reste calme.`);
    assert.match(ev(`_synthIACible(getCls(), ${JSON.stringify(cls.e[0])}, ${mode}).texte`), /premier semestre difficile/, 'décochée : pas touchée');
    assert.strictEqual(ev(`undoStack.length`), 1);
    // Redemander les oubliés : de nouveaux repères, pour les seuls élèves sans synthèse.
    ev(`openSynthIAClasse(); iaLotSeulUI(true);`);
    const n2 = evObj(`Object.keys(_iaLot.codes)`);
    assert.strictEqual(n2.length, 23);
    assert.ok(!n2.includes(cls.e[0]) && !n2.includes(cls.e[1]));
    ev(`closeMod2('miac'); undoLast();`);
    assert.strictEqual(ev(`_synthIACible(getCls(), ${JSON.stringify(cls.e[1])}, ${mode})`), null, 'Ctrl+Z retire tout le lot');
  } finally { ev(FIN_ELS); }
});

test('la relecture sert aux deux fenêtres : un nom retapé dans le lot est signalé et remplacé par le repère de l’élève', () => {
  ev(DEMO);
  ev(ELS);
  try {
    ev(`_ficheMoment = 'bil:conseil:0'; openSynthIAClasse();`);
    const p2 = ev(`S.eleves[getCls().eleves[2]].prenom`), c2 = ev(`_iaLot.codes[getCls().eleves[2]]`);
    ev(`__els.get('miac-txt').value += '\\nVu avec ${p2}.'; iaTexteSaisi(); _iaVerifRender();`);
    assert.deepStrictEqual(evObj(`_iaLot.fuites.map(f => f.mot)`), [p2]);
    ev(`iaFuitesUI()`);
    assert.match(ev(`__els.get('miac-txt').value`), new RegExp(`Vu avec \\[Élève ${c2}\\]\\.$`));
    assert.strictEqual(ev(`_iaLot.modifie`), true);
  } finally { ev(FIN_ELS); }
});
