// Second audit du 2026-10-14, lot « avis » : 🗣 Avis des collègues.
// Signature HTML filtrée de façon IDEMPOTENTE (guillemets en entité), commentaires CSS et
// `position` hors static / relative refusés, nouvelle feuille qui ne recopie rien du fichier
// d'une autre période, lignes en double d'un même élève jamais rangées au hasard.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));
const sur = h => ev(`_htmlSur(${JSON.stringify(h)})`);

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre'; undoStack.length = 0;
  S.classes['5C'] = { id:'5C', nom:'5e C', annee:'2025-26', eleves:['s1','s2','s4','s5'], ord:0 }; S.cur = '5C';
  S.eleves = {
    s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]},
    s2:{id:'s2',nom:'MARTIN',prenom:'Noé',classe_id:'5C',tags:[]},
    s4:{id:'s4',nom:'BERNARD',prenom:'Jean',classe_id:'5C',tags:[]},
    s5:{id:'s5',nom:'BERNARD',prenom:'Jean',classe_id:'5C',tags:[]},
  };`;
const H = ['Élève', 'Travail', 'Participation', 'Comportement'];
const tete = t => [[t], ['mode d\'emploi'], ['', 'a', 'b', 'c']];
const handle = `window.__toasts = []; window.__log = []; window.__ecrit = null;
  toast = m => { window.__toasts.push(m); };
  _uiConfirm = o => { window.__log.push('CONFIRMATION'); };
  _avisRevueOuvrir = r => { window.__log.push('REVUE:' + r.mode); r.coches = new Set(_avisCochesDefaut(r.mode, r.changes)); window.__rv = r; };
  window.__h = { name: 'avis.ods', getFile: async () => ({ arrayBuffer: async () => window.__fichier.buffer.slice(0) }),
    createWritable: async () => ({ write: async d => { window.__ecrit = d; }, close: async () => {} }) };`;
const ecrit = () => ev(`_odsRead(window.__ecrit).then(sh => JSON.parse(JSON.stringify(sh.map(s => ({ name: s.name, rows: s.rows })))))`);

// ── 1. _htmlSur idempotent : une signature réelle garde sa mise en forme ──
// Signatures INVENTÉES, à la forme de ce que produisent les messageries (dépôt public).
const SIGNATURES = {
  outlook: `<p class=MsoNormal><span style='font-size:10.0pt;font-family:"Arial",sans-serif;color:#1F3864;mso-fareast-language:FR'>Jean DUPONT<o:p></o:p></span></p>
<p class=MsoNormal><span style='font-size:9.0pt;font-family:"Calibri",sans-serif;
mso-ligatures:none'>Professeur de physique-chimie</span></p>`,
  word: `<p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Times New Roman",serif;mso-bidi-font-family:"Times New Roman"'>Jean</span></b></p>`,
  thunderbird: `<div class="moz-signature"><font face="Arial" size="2" color="#333333"><b>Jean DUPONT</b><br><span style="font-size: 9pt; color: rgb(102, 102, 102);">Collège Les Tilleuls</span></font></div>`,
  gmail: `<div dir="ltr" class="gmail_signature"><div style="font-family:arial,sans-serif;font-size:small;color:rgb(34,34,34)">Jean DUPONT<br><a href="https://www.ac-x.fr" style="color:rgb(17,85,204)" target="_blank">www.ac-x.fr</a></div></div>`,
  chrome: `<span style="color: rgb(0, 0, 128); font-family: &quot;Times New Roman&quot;, serif; font-size: 12px;">Jean</span>`,
  numerique: `<span style="font-family:&#34;Segoe UI&#34;,&#x27;Helvetica&#x27;;color:#000">Jean</span>`,
};
test('signature HTML : filtrer deux fois = filtrer une fois, et la mise en forme reste (Outlook, Word, Thunderbird, Gmail, Chrome)', () => {
  for (const [k, sig] of Object.entries(SIGNATURES)) {
    const a = sur(sig), b = sur(a);
    assert.strictEqual(b, a, `${k} : non idempotent\n 1: ${a}\n 2: ${b}`);
    assert.match(a, /style="[^"]*(font-family|font-size|color)/, `${k} : mise en forme perdue → ${a}`);
  }
  // Les polices entre guillemets passent, réécrites en &quot; et lues comme telles.
  assert.match(sur(SIGNATURES.outlook), /font-family:&quot;Arial&quot;,sans-serif/);
  assert.match(sur(SIGNATURES.chrome), /font-family: &quot;Times New Roman&quot;, serif/);
  assert.match(sur(SIGNATURES.numerique), /font-family:&quot;Segoe UI&quot;,'Helvetica'/);
  // Le chemin réel : enregistrée filtrée, refiltrée au rendu — le rendu garde le style.
  ev(`S = _emptyState(); postLoadHook(); S.prefs.avisSignatureHtml = _htmlSur(${JSON.stringify(SIGNATURES.outlook)});`);
  assert.strictEqual(ev('_avisSignatureHtml()'), ev('S.prefs.avisSignatureHtml'));
});
test('signature HTML : le décodage des guillemets ne rouvre aucun contournement', () => {
  const pieges = [
    '<div style="background:url&lpar;https://t/x.png&rpar;">a</div>',
    '<div style="background:&amp;lpar;">a</div>',                         // &amp; décodé → « &lpar; » : refusé
    '<div style="background:url&#40;https://t/x)">a</div>',
    '<div style="font-family:&quot;x&quot;;background:u&#114;l(https://t/x)">a</div>',
    '<div style="color:red&semi;background:red">a</div>',
    '<div style="font-family:&quot;a\\&quot;">a</div>',
  ];
  for (const p of pieges) {
    const o = sur(p);
    assert.ok(!/style=/.test(o), `style gardé : ${p} → ${o}`);
    assert.strictEqual(sur(o), o);
  }
  // Un guillemet décodé ne ferme pas l'attribut : il est réencodé.
  const o = sur(`<span style='font-family:"a" onmouseover="x"'>z</span>`);
  assert.strictEqual(o, '<span style="font-family:&quot;a&quot; onmouseover=&quot;x&quot;">z</span>');
});

// ── 2. Commentaires CSS et `position` ──
test('signature HTML : `position:/**/fixed` et `position:absolute` refusés ; static et relative passent', () => {
  for (const p of [
    '<div style="position:/**/fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999">x</div>',
    '<div style="position/**/:/**/sticky">x</div>',
    '<div style="pos/**/ition:fixed">x</div>',
    '<div style="position:absolute;top:-2000px;left:-2000px;width:5000px;height:5000px;z-index:99999">x</div>',
    '<div style="color:red;POSITION : Absolute !important">x</div>',
    '<div style="position:relative fixed">x</div>',
    '<div style="background:ur/**/l(https://t/x)">x</div>',
  ]) assert.strictEqual(sur(p), '<div>x</div>', p);
  assert.strictEqual(sur('<div style="position:relative;top:2px">x</div>'), '<div style="position:relative;top:2px">x</div>');
  assert.strictEqual(sur('<div style="position: static !important">x</div>'), '<div style="position: static !important">x</div>');
  // background-position n'est pas `position`.
  assert.strictEqual(sur('<td style="background-position:left top;color:#123">x</td>'), '<td style="background-position:left top;color:#123">x</td>');
  // Un commentaire inoffensif est retiré, le reste du style passe.
  assert.strictEqual(sur('<span style="color:/* bleu */#00f">x</span>'), '<span style="color:#00f">x</span>');
});

// ── 3. Nouvelle feuille dans un fichier d'une autre période : rien n'est recopié ──
test('nouvelle feuille : homonymes, nom mal tapé et onglets du fichier d\'avant effacés — et dit', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 1, disciplines: ['maths'] });`);
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify([
    { name: 'Maths', rows: [...tete('Mathématiques'), H, ['DURAND Léa', 'avis S1 de Léa'], ['BERNARD Jean', 'avis S1 sur un Jean'], ['DURANT Léa', 'avis S1 nom mal tapé']] },
    { name: 'Latin', rows: [...tete('Latin'), H, ['MARTIN Noé', 'avis S1 latin']] }])});`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h, { nouvelle: true })`);
  assert.deepStrictEqual(evObj('window.__log'), ['REVUE:nouvelle']);
  ev(`_avisRevue = window.__rv;`);
  assert.match(ev('_avisRevueHTML(getCls(), window.__c)'), /Aussi effacé du fichier[^<]*« Latin »/);
  await ev(`avisRevueValider()`);
  const sh = await ecrit();
  assert.deepStrictEqual(sh.map(s => s.name), ['Maths']);
  const tout = JSON.stringify(sh);
  for (const t of ['avis S1 de Léa', 'avis S1 sur un Jean', 'avis S1 nom mal tapé', 'avis S1 latin']) assert.ok(!tout.includes(t), `recopié : ${t}`);
  const toast = evObj('window.__toasts').join(' ');
  assert.match(toast, /Effacé du fichier/);
  assert.doesNotMatch(toast, /Gardé tel quel/);
  // Sans réponse à reprendre (aucune revue), rien n'est recopié non plus.
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify([
    { name: 'Maths', rows: [...tete('Mathématiques'), H, ['BERNARD Jean', 'homonyme']] }, { name: 'Notes', rows: [['perso']] }])});`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h, { nouvelle: true })`);
  assert.deepStrictEqual(evObj('window.__log'), []);
  assert.deepStrictEqual((await ecrit()).map(s => s.name), ['Maths']);
  assert.ok(!JSON.stringify(await ecrit()).includes('homonyme'));
  // Témoin : « Mettre la feuille à jour » recopie toujours (arbitré le 2026-10-14).
  ev(handle);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  assert.deepStrictEqual((await ecrit()).map(s => s.name), ['Maths', 'Notes']);
});

// ── 4. Deux lignes du MÊME élève dans un onglet ──
test('lignes en double d\'un élève : contradictoires → rien rangé, rapporté, recopié ; complémentaires → réunies', async () => {
  ev(FIXTURE);
  ev(`window.__c = avisCampagneCreer(getCls(), { pIdx: 0, disciplines: ['maths', 'anglais'] }); window.__c.avis = { s1: { maths: { travail: 'app' } } };`);
  const sheets = [
    { name: 'Maths', rows: [...tete('Mathématiques'), H, ['DURAND Léa', 'app + complété', 'participation écrite'], ['DURAND Léa', 'second avis']] },
    { name: 'Anglais', rows: [...tete('Anglais'), H, ['MARTIN Noé', 'travail'], ['MARTIN Noé', '', 'participe'], ['MARTIN Noé', 'travail']] }];
  const lec = evObj(`_avisLire(getCls(), window.__c, ${JSON.stringify(sheets)})`);
  // Contradictoires : aucune des deux n'est rangée — ni la dernière, ni la première.
  assert.strictEqual(lec.avis.s1, undefined);
  // Complémentaires (et une ligne répétée à l'identique) : réunies colonne par colonne.
  assert.deepStrictEqual(lec.avis.s2, { anglais: { travail: 'travail', participation: 'participe' } });
  assert.deepStrictEqual(lec.repetes.map(x => [x.sid, x.did, x.n, x.conflit]), [['s1', 'maths', 2, true], ['s2', 'anglais', 3, false]]);
  // Aucun changement proposé pour l'élève en conflit (pas d'effacement de « app »).
  assert.deepStrictEqual(evObj(`_avisChangements(getCls(), window.__c, ${JSON.stringify(lec)})`).map(c => c.sid), ['s2', 's2']);
  // Dit par la relecture (toast), par la revue et par le panneau de la feuille.
  ev(handle + `window.__fichier = _odsBuild(${JSON.stringify(sheets)});`);
  ev(`_avisAppliquer(getCls(), window.__c, ${JSON.stringify(sheets)}, false)`);
  assert.deepStrictEqual(evObj('window.__log'), ['REVUE:relire']);
  ev(`_avisRevue = window.__rv;`);
  const rv = ev('_avisRevueHTML(getCls(), window.__c)');
  assert.match(rv, /lignes aux avis différents pour DURAND Léa \(Maths\)/);
  assert.match(rv, /réunies en une seule : MARTIN Noé \(Anglais\)/);
  ev(`_avisRevue = null;`);
  assert.match(ev('_avisCampHTML(getCls(), window.__c)'), /aux avis différents pour DURAND Léa/);
  // Rien d'autre à reprendre : le toast le dit.
  ev(`window.__toasts = []; window.__c.avis.s2 = { anglais: { travail: 'travail', participation: 'participe' } };`);
  ev(`_avisAppliquer(getCls(), window.__c, ${JSON.stringify(sheets)}, false)`);
  assert.match(evObj('window.__toasts').join(' '), /Rien de nouveau.*aux avis différents pour DURAND Léa/);
  // Mise à jour de la feuille : les deux lignes contradictoires sont recopiées, rien ne se perd,
  // et rien ne s'accumule d'une mise à jour à l'autre.
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  const sh = await ecrit();
  const m = sh.find(s => s.name === 'Maths').rows;
  assert.ok(m.some(r => r[1] === 'app + complété' && r[2] === 'participation écrite'));
  assert.ok(m.some(r => r[1] === 'second avis'));
  assert.ok(m.some(r => r[0] === 'DURAND Léa' && r[1] === 'app'), 'la ligne de l\'app reste');
  assert.match(evObj('window.__toasts').join(' '), /2 lignes en double d'un même élève/);
  ev(`window.__fichier = window.__ecrit;`);
  await ev(`_avisEcrireFeuille(getCls(), window.__c, window.__h)`);
  assert.strictEqual((await ecrit()).find(s => s.name === 'Maths').rows.length, m.length, 'rien ne s\'accumule');
  // L'anglais réuni s'écrit sur une seule ligne.
  assert.strictEqual(sh.find(s => s.name === 'Anglais').rows.filter(r => r[0] === 'MARTIN Noé').length, 1);
});
