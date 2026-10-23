// 🏫 Vers MBN (v1.77.0) : le bilan du conseil devient l'appréciation générale du conseil de classe de MBN, par un
// favori (repris de « MBN · Bulletin » de Plan de classe) que l'utilisateur lance dans SA session. Noms de la démo
// (inventés) ; la page MBN est imitée par test/fixtures/mbn/fake-mbn-conseil.html (essai dans un navigateur).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');
const SRC = (HTML.match(/<script type="text\/plain" id="mbn-cc-src">([\s\S]*?)<\/script>/) || [])[1] || '';
const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const DEMO = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; _ficheMoment = null;`;

test('le favori : un bloc qui se lit, et rien qui casse une fois devenu une adresse javascript:', () => {
  assert.ok(SRC.length > 5000, 'le bloc mbn-cc-src existe');
  assert.doesNotThrow(() => new Function(SRC), 'syntaxe valide');
  assert.ok(!/^\s*\/\//m.test(SRC), 'aucun commentaire // : une adresse javascript: est sur UNE ligne');
  assert.ok(!/<!--/.test(SRC), 'pas de <!-- dans un bloc de script');
  // MBN charge Prototype.js : une collection DOM n'a pas les méthodes d'Array, et JSON.stringify y est altéré.
  assert.ok(!/Array\.prototype\.\w+\.call/.test(SRC));
  assert.ok(!/JSON\.stringify/.test(SRC));
  assert.match(SRC, /d\.app !== 'suivi-pp' \|\| d\.type !== 'mbn-conseil'/, 'il ne prend que les appréciations de Suivi PP');
  assert.match(SRC, /td\.yui-dt-col-appreciation/);
  assert.match(SRC, /\.bulletin-notes-eleve/);
  // La règle de Plan de classe (remplacer, sauter l'identique, ignorer le vide) — et jamais couper.
  assert.match(SRC, /remplace l\\'appréciation de MBN/);
  assert.match(SRC, /déjà identique/);
  assert.match(SRC, /trop long \(/);
  assert.ok(!/\.slice\(0,\s*(mx|max)\)/.test(SRC), 'aucune coupe du texte à la limite');
});

test('ce qui est copié : les bilans du conseil du moment, élèves présents, la limite ; sans bilan = vide', () => {
  ev(DEMO);
  const r = evObj(`(() => { const cls = getCls(), col = _mbnCcMoments(cls).find(c => c.key === 'bil:conseil:0');
    const P = _mbnCcPayload(cls, col), mode = { type: col.type, date: col.date };
    const attendu = _fichePrintEleves(cls, col).map(sid => { const b = _bilanCible(cls, sid, mode); return b ? b.texte.trim() : ''; });
    return { P, attendu, n: _fichePrintEleves(cls, col).length }; })()`);
  assert.deepStrictEqual([r.P.app, r.P.type, r.P.v, r.P.max], ['suivi-pp', 'mbn-conseil', 1, 600]);
  assert.strictEqual(r.P.eleves.length, r.n);
  assert.deepStrictEqual(r.P.eleves.map(e => e.appr), r.attendu);
  assert.ok(r.P.eleves.some(e => e.appr) && r.P.eleves.some(e => !e.appr), 'la démo a des élèves avec et sans bilan du conseil du S1');
  assert.ok(r.P.eleves.every(e => e.nom && e.prenom));
  assert.ok(evObj(`_mbnCcMoments(getCls()).map(c => c.type)`).every(t => t === 'conseil'), 'seuls les conseils sont proposés');
});

test('la fenêtre : les comptes, les élèves sans bilan, un bilan trop long signalé ; Ctrl+Z la redessine', () => {
  ev(DEMO);
  ev(`window.__els = new Map(); window.__gid = document.getElementById;
    document.getElementById = id => { if (!__els.has(id)) __els.set(id, document.createElement('div')); return __els.get(id); };`);
  try {
    ev(`openMbnConseil('bil:conseil:0')`);
    assert.strictEqual(ev(`_mbnCcCol.key`), 'bil:conseil:0');
    assert.match(ev(`__els.get('mmbncc-bilan').innerHTML`), /appréciations? à copier sur \d+ élèves/);
    assert.match(ev(`__els.get('mmbncc-bilan').innerHTML`), /sans bilan du conseil : rien n/);
    assert.ok(ev(`__els.get('mmbncc-bm').href`).startsWith('javascript:'));
    const sid = ev(`(() => { const cls = getCls(), col = _mbnCcCol; return _fichePrintEleves(cls, col).find(s => _bilanCible(cls, s, { type: col.type, date: col.date })); })()`);
    ev(`pushUndo(); _bilanCible(getCls(), ${JSON.stringify(sid)}, { type: _mbnCcCol.type, date: _mbnCcCol.date }).texte = 'Trop long. '.repeat(80);`);
    ev(`_mbnCcRender()`);
    assert.match(ev(`__els.get('mmbncc-bilan').innerHTML`), /dépasse 600 caractères/);
    ev(`undoLast(); _MODAL_RERENDER.mmbncc();`);
    assert.doesNotMatch(ev(`__els.get('mmbncc-bilan').innerHTML`), /dépasse/);
  } finally { ev(`document.getElementById = __gid;`); }
});
