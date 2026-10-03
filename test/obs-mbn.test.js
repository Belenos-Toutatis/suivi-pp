// Observations notées dans Mon Bureau Numérique (v1.46.0) : des ÉVÉNEMENTS datés, importés
// de l'export MBN, comptés à côté du relevé du carnet (un cumul) et jamais confondus avec lui.
// Le classeur de test est FABRIQUÉ ici (noms inventés), avec la structure de l'export réel :
// Élève · Civilité · Classe · Type · Motif · Demandeur · Donnée le (nombre de série) · Informations complémentaires.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const CLASSE = `S = _emptyState(); postLoadHook();
  S.classes['5E'] = { id:'5E', nom:'5e E', annee:'2025-26', eleves:['a','b','c'], ord:0 }; S.cur = '5E';
  S.eleves.a = { id:'a', nom:'DURAND', prenom:'Léa', classe_id:'5E', tags:[] };
  S.eleves.b = { id:'b', nom:'MARTIN', prenom:'Noé', classe_id:'5E', tags:[] };
  S.eleves.c = { id:'c', nom:'PETIT', prenom:'Inès', classe_id:'5E', tags:[] };
  undoStack.length = 0;`;

function classeur(lignes) {
  const sst = [];
  const si = t => { let i = sst.indexOf(t); if (i < 0) { sst.push(t); i = sst.length - 1; } return i; };
  const cell = (ref, v) => v === null ? '' : typeof v === 'number' ? `<c r="${ref}" s="3"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${si(v)}</v></c>`;
  const row = (n, vals) => `<row r="${n}">${vals.map((v, i) => cell(String.fromCharCode(65 + i) + n, v)).join('')}</row>`;
  const tete = ['Élève', 'Civilité', 'Classe', 'Type', 'Motif', 'Demandeur', 'Donnée le', 'Informations complémentaires'];
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${
    [tete, ...lignes].map((r, i) => row(i + 1, r)).join('')}</sheetData></worksheet>`;
  const shared = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sst.map(t => `<si><t>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</t></si>`).join('')}</sst>`;
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return `_zipStore([{ name: 'xl/workbook.xml', data: ${JSON.stringify(wb)} }, { name: 'xl/_rels/workbook.xml.rels', data: ${JSON.stringify(rels)} },
      { name: 'xl/sharedStrings.xml', data: ${JSON.stringify(shared)} }, { name: 'xl/worksheets/sheet1.xml', data: ${JSON.stringify(sheet)} }])`;
}
// 46297.453472222223 = 02/10/2026 10:53 ; 46275.38055555556 = 10/09/2026 09:08.
const EXPORT = [
  ['DURAND Léa', 'Mme', '5E', 'Observation négative', 'Bavardage', 'GARNIER Paul', 46297.453472222223, null],
  ['DURAND Léa', 'Mme', '5E', 'Observation négative', 'Oubli de matériel', 'GARNIER Paul', 46275.38055555556, 'Oubli du TD'],
  ['MARTIN Noé', 'M.', '5E', 'Observation négative', 'Travail non fait', 'LEROY Anne', 46275.38055555556, null],
  ['INCONNU Zoé', 'Mme', '5E', 'Observation négative', 'Bavardage', 'LEROY Anne', 46297.4, null],
];

async function lire(lignes) {
  ev(`window.__x = ${classeur(lignes)}`);
  const rows = JSON.parse(JSON.stringify(await app.__TESTEVAL(`_xlsxRead(window.__x)`)))[0].rows;
  ev(`window.__rows = ${JSON.stringify(rows)}`);
  return evObj(`_obsMbnLire(window.__rows)`);
}

test('Observations MBN : dates de tableur (série, jj/mm/aaaa hh:mm, ISO), le reste refusé', () => {
  assert.deepStrictEqual(evObj(`_obsMbnDate('46297.453472222223')`), { date: '2026-10-02', heure: '10:53' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('46275')`), { date: '2026-09-10', heure: '' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('02/10/2026 10:53')`), { date: '2026-10-02', heure: '10:53' });
  assert.deepStrictEqual(evObj(`_obsMbnDate('2026-10-02T08:05')`), { date: '2026-10-02', heure: '08:05' });
  assert.strictEqual(ev(`_obsMbnDate('31/02/2026')`), null);
  assert.strictEqual(ev(`_obsMbnDate('hier')`), null);
  assert.strictEqual(ev(`_obsMbnDate('')`), null);
});

test('Observations MBN : lecture .xlsx, rattachement, ajout ; réimporter n\'ajoute rien ; une observation disparue ne se retire que cochée', async () => {
  ev(CLASSE);
  const lu = await lire(EXPORT);
  assert.ok(lu.ok);
  assert.deepStrictEqual(lu.lignes[1], { ligne: 3, nom: 'DURAND Léa', classe: '5E', type: 'Observation négative', motif: 'Oubli de matériel', par: 'GARNIER Paul', info: 'Oubli du TD', date: '2026-09-10', heure: '09:08' });
  ev(`window.__L = _mbnRapprocher(getCls(), _obsMbnLire(window.__rows).lignes)`);
  assert.deepStrictEqual(evObj(`window.__L.map(l => l.sid)`), ['a', 'a', 'b', null], 'Zoé n\'est pas de la classe : à rattacher, rien d\'importé d\'office');
  const b1 = evObj(`_obsMbnBilan(getCls(), window.__L)`);
  assert.strictEqual(b1.nouveaux.length, 3);
  assert.strictEqual(b1.connus, 0);
  assert.deepStrictEqual([b1.debut, b1.fin], ['2026-09-10', '2026-10-02']);
  ev(`pushUndo(); _obsMbnAppliquer(_obsMbnBilan(getCls(), window.__L).nouveaux, [])`);
  assert.deepStrictEqual(evObj(`_obsMbnOf('a').map(e => e.date + ' ' + e.motif)`), ['2026-09-10 Oubli de matériel', '2026-10-02 Bavardage'], 'rangées par date');
  assert.strictEqual(ev(`S.eleves.c.obsMbn`), undefined, 'Inès, absente de l\'export : rien');
  // Le même export une seconde fois : tout est connu.
  const b2 = evObj(`_obsMbnBilan(getCls(), window.__L)`);
  assert.deepStrictEqual([b2.nouveaux.length, b2.connus, b2.retirables.length], [0, 3, 0]);
  // L'export suivant : le bavardage de Léa a disparu (effacé dans MBN), un nouveau pour Noé.
  await lire([EXPORT[1], EXPORT[2], ['MARTIN Noé', 'M.', '5E', 'Observation négative', 'Bavardage', 'LEROY Anne', 46300.5, null]]);
  ev(`window.__L = _mbnRapprocher(getCls(), _obsMbnLire(window.__rows).lignes)`);
  const b3 = evObj(`_obsMbnBilan(getCls(), window.__L)`);
  assert.deepStrictEqual(b3.nouveaux.map(x => [x.sid, x.ev.motif, x.ev.date]), [['b', 'Bavardage', '2026-10-05']]);
  assert.deepStrictEqual(b3.retirables.map(x => [x.sid, x.ev.motif]), [['a', 'Bavardage']]);
  // Non coché : on ajoute sans rien retirer.
  ev(`_obsMbnAppliquer(_obsMbnBilan(getCls(), window.__L).nouveaux, [])`);
  assert.strictEqual(ev(`_obsMbnOf('a').length`), 2, 'rien n\'est retiré sans être coché');
  assert.strictEqual(ev(`_obsMbnOf('b').length`), 2);
  // Coché : retiré.
  ev(`_obsMbnAppliquer([], _obsMbnBilan(getCls(), window.__L).retirables.map(x => x.ev.id))`);
  assert.deepStrictEqual(evObj(`_obsMbnOf('a').map(e => e.motif)`), ['Oubli de matériel']);
  // Deux observations identiques à la même minute restent deux.
  ev(`window.__L2 = [{ nom:'X', sid:'c', date:'2026-10-01', heure:'10:00', type:'T', motif:'M', par:'P', info:'' }, { nom:'X', sid:'c', date:'2026-10-01', heure:'10:00', type:'T', motif:'M', par:'P', info:'' }]`);
  ev(`_obsMbnAppliquer(_obsMbnBilan(getCls(), window.__L2).nouveaux, [])`);
  assert.strictEqual(ev(`_obsMbnOf('c').length`), 2);
  assert.strictEqual(ev(`_obsMbnBilan(getCls(), window.__L2).nouveaux.length`), 0);
  // Un fichier qui n'est pas l'export : refusé avec un message, sans exception.
  assert.match(evObj(`_obsMbnLire([['Élève', 'Note'], ['X', '12']])`).err, /date|Motif/);
  assert.match(evObj(`_obsMbnLire([['Nom', 'Note']])`).err, /Élève/);
});

test('Observations MBN : à côté du carnet partout — grille, liste, carte de chaleur, fiche, synthèse de période — et échappées', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; carnetSort = 'nom';`);
  const cls = 'getCls()';
  assert.ok(ev(`_obsMbnClasseAny(${cls})`), 'la démo en porte');
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  assert.ok(sid);
  // Un motif piégé ne passe pas en clair.
  ev(`_obsMbnOf(${JSON.stringify(sid)}); S.eleves[${JSON.stringify(sid)}].obsMbn[0].motif = '<img src=x onerror=alert(1)>'`);
  // Grille des observations : colonnes MBN par période et « Carnet + MBN ».
  const grille = ev(`(() => { const z = document.createElement('div'); const o = document.getElementById; document.getElementById = x => x === 'carnets-body' ? z : o.call(document, x);
    try { renderCarnets(); return z.innerHTML; } finally { document.getElementById = o; } })()`);
  assert.match(grille, /MBN S1/);
  assert.match(grille, /Carnet \+ MBN/);
  assert.match(grille, /openObsMbnImport\(\)/);
  assert.ok(!grille.includes('<img src=x') && grille.includes('&lt;img'));
  // Carte de chaleur : le groupe juste après le carnet.
  assert.deepStrictEqual(evObj(`_chaleurGroupes(getCls(), []).map(g => g.key).slice(0, 2)`), ['carnet', 'mbn']);
  // Fiche : un fait MBN, distinct du carnet, avec ses motifs ; la chronologie le date.
  const p0 = `{ ..._ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0') }`;
  const faits = evObj(`_ficheFaits(getCls(), S.eleves[${JSON.stringify(sid)}], ${p0}).map(f => f.html)`).join('\n');
  assert.match(faits, /dans MBN/);
  assert.match(faits, /au carnet|Aucune observation au carnet/);
  assert.ok(evObj(`_ficheEvenements(getCls(), S.eleves[${JSON.stringify(sid)}], ${p0}).filter(e => /MBN/.test(e.html)).length`) >= 1);
  // Synthèse de période : le compte à part.
  const n = ev(`(() => { const p = _periods(getCls())[0]; return _obsMbnEntre(${JSON.stringify(sid)}, p.start, p.end).length; })()`);
  assert.strictEqual(ev(`_periodeSynthese(getCls(), 0).rows.find(r => r.sid === ${JSON.stringify(sid)}).mbn`), n);
  // Une entrée illisible au chargement est écartée ; un champ qui n'est pas un tableau, retiré.
  ev(`S.eleves[${JSON.stringify(sid)}].obsMbn.push('x', { date: 'hier' }); S.eleves[getCls().eleves[1]].obsMbn = 'x'; postLoadHook();`);
  assert.strictEqual(ev(`S.eleves[${JSON.stringify(sid)}].obsMbn.every(e => typeof e === 'object' && /^\\d{4}-/.test(e.date))`), true);
  assert.strictEqual(ev(`S.eleves[getCls().eleves[1]].obsMbn`), undefined);
});
