// La petite courbe devant chaque moyenne du tableau (v1.83.0). L'utilisateur : « devant chaque note du relevé des
// moyennes, il pourrait y avoir une mini courbe qui permet de voir l'évolution, avec affichage de la note en cas de
// survol ». Les imports de la période jusqu'à celui affiché ; au survol, la bulle des courbes de la fiche (#bulle-fi).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);

function monter() {
  ev(`(() => {
    S = _emptyState(); postLoadHook();
    S.classes = { c1: { id: 'c1', nom: '5C', annee: '2026-27', eleves: ['s1', 's2'] } };
    S.eleves = { s1: { id: 's1', nom: 'Martin', prenom: 'Léa', classe_id: 'c1' }, s2: { id: 's2', nom: '<b>Roy</b>', prenom: 'Tom', classe_id: 'c1' } };
    S.matieres = { ma: { id: 'ma', nom: 'Mathématiques', norm: 'mathematiques', ord: 0 }, es: { id: 'es', nom: 'Espagnol LV2', norm: 'espagnol lv2', ord: 1 } };
    const r = (id, date, periode, matieres, notes, generale, label) => ({ id, date, periode, ts: 1, matieres, notes, generale, label });
    S.moyennes = { c1: {
      a: r('a', '2026-10-06', 'S1', ['ma'], { s1: { ma: 12 }, s2: { ma: 9 } }, { s1: 12, s2: 9 }),
      b: r('b', '2026-10-20', 'S1', ['ma'], { s1: { ma: 'Abs' }, s2: { ma: 9.5 } }, { s1: 11.5, s2: 9.5 }),
      c: r('c', '2026-11-03', 'S1', ['ma', 'es'], { s1: { ma: 8, es: 14 }, s2: { ma: 11 } }, { s1: 10.5, s2: 11 }, 'avant le conseil'),
      d: r('d', '2027-02-10', 'S2', ['ma'], { s1: { ma: 13 }, s2: { ma: 12 } }, { s1: 13, s2: 12 }) } };
    S.cur = 'c1';
    _moyVue = 'tableau'; _moyPeriodeSel = null; _moyRidSel = null; moySort = 'nom';
  })()`);
}
const rel = id => `S.moyennes.c1.${id}`;
const L = `_moyReleves('c1', 'S1')`;
const cell = (id, sid, mid) => ev(`_moyCellHTML(S.classes.c1, ${rel(id)}, '${sid}', ${mid === null ? 'null' : `'${mid}'`}, '', ${L})`);

test('la série : les imports de la période jusqu’à celui affiché, codes et vides compris', () => {
  monter();
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_moySerie(${rel('c')}, ${L}, 's1', 'ma'))`)), [12, 'Abs', 8]);
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_moySerie(${rel('b')}, ${L}, 's2', 'ma'))`)), [9, 9.5], 'rien après l’import affiché');
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_moySerie(${rel('c')}, ${L}, 's1', 'es'))`)), [null, null, 14]);
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_moySerie(${rel('c')}, ${L}, 's1', null))`)), [12, 11.5, 10.5], 'moyenne générale');
  assert.deepStrictEqual(JSON.parse(ev(`JSON.stringify(_moySerie(${rel('d')}, ${L}, 's1', 'ma'))`)), [], 'import d’une autre période : rien');
});

test('la courbe : deux notes au moins, un code coupe le trait, le dernier point plus gros, même abscisse partout', () => {
  monter();
  const sp = v => ev(`_moySparkHTML(${JSON.stringify(v)}, 's1', 'ma')`);
  assert.strictEqual(sp([null, null, 14]), '', 'une seule note : pas d’évolution à montrer');
  let h = sp([12, 'Abs', 8]);
  assert.strictEqual((h.match(/<circle /g) || []).length, 2);
  assert.doesNotMatch(h, /<polyline /, '12, Abs, 8 : deux points isolés, pas de trait par-dessus le code');
  assert.match(h, /class="dix"/, 'traverse 10 : le seuil en pointillé');
  assert.match(h, /data-i="2" cx="23.5" cy="[\d.]+" r="2"/, 'la note affichée : plus grosse, au bout');
  assert.match(h, /data-i="0" cx="2.5" cy="[\d.]+" r="1.3"/);
  assert.match(h, /^<svg class="moy-spk" viewBox="0 0 26 14" width="26" height="14" data-s="s1" data-m="ma" data-bulle="" aria-hidden="true">/);
  h = sp([13, 13.5, 14]);
  assert.strictEqual((h.match(/<polyline /g) || []).length, 1);
  assert.doesNotMatch(h, /class="dix"/);
  assert.doesNotMatch(h, /<title>/, 'pas d’infobulle par point : la bulle de la courbe dit tout');
  const cx = x => [...x.matchAll(/cx="([\d.]+)"/g)].map(m => +m[1]);
  assert.deepStrictEqual(cx(sp([null, 13, 14])), cx(sp([12, 13, 14])).slice(1), 'une note arrivée tard commence à droite');
  assert.match(ev(`_moySparkHTML([12, 13], 's1', null)`), /data-m=""/, 'moyenne générale : data-m vide');
});

test('la case : la courbe devant la note, sa place gardée sans courbe, rien au premier import ni sur une colonne nouvelle', () => {
  monter();
  const c = cell('c', 's2', 'ma');
  assert.match(c, /^<td class="moy-c spk" title="11 · \+1,5 depuis le 20\/10\/2026 \(9,5\)"><svg class="moy-spk"[^]*<\/svg><span class="moy-vd"><span class="moy-v">11<\/span><span class="moy-d up">\+1,5<\/span><\/span><\/td>$/);
  assert.match(cell('c', 's1', 'ma'), /<td class="moy-c low spk"[^>]*><svg class="moy-spk"/, '12, Abs, 8 : deux notes, une courbe');
  assert.doesNotMatch(cell('a', 's1', 'ma'), /moy-spk|moy-vd/, 'premier import : la case d’avant, telle quelle');
  assert.doesNotMatch(cell('c', 's1', 'es'), /moy-spk|moy-vd/, 'colonne nouvelle : rien à aligner, la note reste centrée');
  ev(`S.moyennes.c1.b.notes.s1.ma = null; S.moyennes.c1.a.notes.s1.ma = null`);
  assert.match(cell('c', 's1', 'ma'), /<span class="moy-spk-vide"><\/span><span class="moy-vd">/, 'une seule note dans une colonne ancienne : la place gardée');
  assert.match(cell('c', 's1', null), /<svg class="moy-spk"[^>]*data-m=""/);
  assert.match(ev(`_moyCellHTML(S.classes.c1, ${rel('c')}, 's2', 'ma')`), /moy-spk/, 'sans la liste : calculée');
});

test('la bulle : la matière et l’élève (échappés), chaque import jusqu’à l’affiché, écart avec la note chiffrée précédente', () => {
  monter();
  const h = ev(`_moyBulleHTML('Mathématiques', '<b>Roy</b> Tom', ${L}, [12, 'Abs', 8], 2)`);
  assert.match(h, /^<div class="bm-t">Mathématiques <span class="bm-p">· &lt;b&gt;Roy&lt;\/b&gt; Tom<\/span><\/div>/);
  assert.match(h, /<tr><td>06\/10\/2026<\/td><td class="v"><span class="pf-mv">12<\/span><\/td><td class="d"><\/td><\/tr>/);
  assert.match(h, /<tr><td>20\/10\/2026<\/td><td class="v"><em>Abs<\/em><\/td><td class="d"><\/td><\/tr>/);
  assert.match(h, /<tr class="on"><td>▸ 03\/11\/2026 <span class="bm-p">avant le conseil<\/span><\/td><td class="v"><span class="pf-mv lo">8<\/span><\/td><td class="d">−4<\/td><\/tr>/, 'l’écart saute le code, comme celui de la case');
  assert.doesNotMatch(ev(`_moyBulleHTML('M', 'x', ${L}, [12, 12.5], 0)`), /class="on"[^]*class="on"/);
  // L'utilisateur, à la première livraison : « mets la note la plus récente en haut et la plus ancienne en bas ».
  assert.deepStrictEqual([...h.matchAll(/(\d\d)\/10\/2026|03\/11\/2026/g)].map(m => m[0]), ['03/11/2026', '20/10/2026', '06/10/2026']);
});

test('le tableau porte les gestionnaires ; la fermeture de la bulle nettoie aussi les petites courbes', () => {
  monter();
  const h = ev(`(() => { const C = _moyCourant(S.classes.c1); _moyRidSel = 'c'; _moyPeriodeSel = 'S1'; const D = _moyCourant(S.classes.c1);
    return _moyTableauHTML(S.classes.c1, D.rel, D.list, Object.values(S.eleves), _moyColsOf([D.rel]), true)[0]; })()`);
  assert.match(h, /<table class="dt rel-table moy-table" onpointermove="moyCourbeBulle\(event\)" onpointerleave="ficheBulleFin\(\)">/);
  assert.ok((h.match(/<svg class="moy-spk"/g) || []).length >= 3);
  assert.match(ev(`ficheBulleFin.toString()`), /\.moy-spk\.survol/);
});
