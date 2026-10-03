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
  assert.deepStrictEqual(evObj(`_chaleurGroupes(getCls(), []).map(g => g.key).slice(0, 3)`), ['carnet', 'mbn', 'obstot']);
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

test('Observations MBN : feuille imprimée du carnet (MBN et Carnet + MBN par période, au choix) ; courbe de la fiche = carnet + MBN, une source décochable', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; carnetSort = 'nom';`);
  const avec = ev(`_carnetFeuilleHTML(getCls(), { periode: 'all', totaux: true, mbn: true }).html`);
  assert.match(avec, /MBN S1/);
  assert.match(avec, /Carnet \+ MBN S2/);
  assert.match(avec, /Mon Bureau Numérique/);
  const sans = ev(`_carnetFeuilleHTML(getCls(), { periode: 'all', totaux: true, mbn: false }).html`);
  assert.ok(!/MBN/.test(sans));
  assert.ok(!/Carnet \+ MBN/.test(ev(`_carnetFeuilleHTML(getCls(), { periode: 'all', totaux: false, mbn: true }).html`)), 'la somme seulement avec les totaux');
  // La courbe : un point par relevé et par jour d'observation MBN ; la somme des deux.
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  const P = src => evObj(`_ficheCourbePoints(getCls(), ${JSON.stringify(sid)}, _periods(getCls())[0], ${JSON.stringify(src)})`);
  const tous = P({ carnet: true, mbn: true }), car = P({ carnet: true, mbn: false }), mb = P({ carnet: false, mbn: true });
  assert.ok(mb.length >= 1 && car.length >= 1);
  assert.strictEqual(tous.length, new Set([...car, ...mb].map(x => x[0])).size);
  const der = a => a[a.length - 1][1];
  assert.strictEqual(der(tous), ev(`_cumulAu(getCls().id, ${JSON.stringify(sid)}, _periods(getCls())[0].end) || 0`) + der(mb));
  assert.deepStrictEqual(P({ carnet: false, mbn: false }), []);
  // La carte : deux sections cochables, le détail des relevés.
  ev(`_ficheCourbeSrc = { carnet: true, mbn: true }; _ficheSid = ${JSON.stringify(sid)}`);
  const carte = ev(`_ficheTableauHTML(getCls(), S.eleves[${JSON.stringify(sid)}], _ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0'), {})`);
  assert.match(carte, /ficheCourbeSrcUI\('carnet'/);
  assert.match(carte, /ficheCourbeSrcUI\('mbn'/);
  assert.match(carte, /Relevés du carnet/);
  assert.match(carte, /carnet \+ MBN/);
  ev(`_ficheCourbeSrc = { carnet: true, mbn: true }`);
});

test('Fiche : la courbe s\'arrête à la date du bilan du moment, sinon aujourd\'hui, bornée à la période', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook();`);
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  const col = `_ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0')`;
  const p = evObj(`_periods(getCls())[0]`);
  ev(`(() => { const cls = getCls(), c = ${col}, b = _bilanCible(cls, ${JSON.stringify(sid)}, { type: c.type, date: c.date }); if (b) bilanRemove(${JSON.stringify(sid)}, b.id); })()`);
  // Sans bilan : aujourd'hui, borné.
  const mid = ev(`_ficheBornes(getCls(), { ...${col}, type: 'miperiode' }).end`);
  assert.deepStrictEqual(evObj(`_ficheCourbeFin(getCls(), ${JSON.stringify(sid)}, ${col}, ${JSON.stringify(mid)})`), { fin: mid, pourquoi: 'aujourdhui' });
  assert.deepStrictEqual(evObj(`_ficheCourbeFin(getCls(), ${JSON.stringify(sid)}, ${col}, '2099-01-01')`), { fin: p.end, pourquoi: 'periode' });
  // Avec un bilan : sa date.
  const d = ev(`_ymdAdd(${JSON.stringify(p.end)}, -20)`);
  ev(`bilanAdd(${JSON.stringify(sid)}, { date: ${JSON.stringify(d)}, type: 'conseil', texte: 'Bilan écrit.' })`);
  assert.deepStrictEqual(evObj(`_ficheCourbeFin(getCls(), ${JSON.stringify(sid)}, ${col})`), { fin: d, pourquoi: 'bilan' });
  const html = ev(`_ficheCourbeHTML(getCls(), S.eleves[${JSON.stringify(sid)}], ${col})`);
  assert.match(html, /jusqu'au .*\(bilan\)/);
  // Aucun point après la fin.
  const dates = [...html.matchAll(/<title>(\d\d)\/(\d\d)\/(\d{4})/g)].map(m => `${m[3]}-${m[2]}-${m[1]}`);
  assert.ok(dates.length && dates.every(x => x <= d));
});

test('Liste : la colonne Observations affiche le total carnet + MBN de l\'année, avec le détail des deux, et trie sur lui', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = '';`);
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  const r = evObj(`_syntheseRow(getCls(), S.eleves[${JSON.stringify(sid)}])`);
  assert.strictEqual(r.mbnAn, ev(`_obsMbnOf(${JSON.stringify(sid)}).length`));
  assert.strictEqual(r.obsTotal, r.cumul + r.mbnAn);
  const html = ev(`_elevesIndicHTML(getCls(), _elevesRows(getCls()), [], null)`);
  assert.match(html, />Observations <details class="el-cols el-fen"/);
  assert.ok(html.includes(`>${r.obsTotal}</span><span class="el-obd">carnet ${r.cumul} · MBN ${r.mbnAn}</span>`));
  ev(`eleveSort = { col: 'cumul', dir: 1 }`);
  const tot = evObj(`_elevesRows(getCls()).map(x => x.r.obsTotal).filter(v => v !== null)`);
  assert.deepStrictEqual(tot, [...tot].sort((a, b) => b - a), 'le plus chargé d\'abord, sur le total');
  assert.match(ev(`_elevesPrintHTML(getCls())`), new RegExp(`${r.obsTotal}</span> <small>\\(${r.cumul} \\+ ${r.mbnAn} MBN\\)`));
  ev(`eleveSort = { col: 'nom', dir: 1 }`);
});

test('Carte de chaleur : case Total carnet + MBN (et synthèse repliée) ; liste : « +n » de la période, les deux sources ; dessins à partir du 1er septembre', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = '';`);
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  const t = evObj(`_obsTotalAn(getCls(), ${JSON.stringify(sid)})`);
  assert.strictEqual(t.total, t.carnet + t.mbn);
  // Ordre : carnet, MBN, puis le total ; le premier titre dit qu'il vient du carnet.
  assert.deepStrictEqual(evObj(`_chaleurGroupes(getCls(), []).map(x => x.key).slice(0, 3)`), ['carnet', 'mbn', 'obstot']);
  assert.match(ev(`_chaleurGroupes(getCls(), []).find(x => x.key === 'carnet').label`), /^Observations du carnet /);
  assert.ok(!evObj(`_chaleurGroupes(getCls(), []).find(x => x.key === 'carnet').sub.map(x => x.id)`).includes('__tot'));
  const g = `_chaleurGroupes(getCls(), []).find(x => x.key === 'obstot')`;
  assert.strictEqual(ev(`${g}.sub.slice(-1)[0].id`), '__tot');
  assert.deepStrictEqual(evObj(`${g}.cell(${JSON.stringify(sid)}, '__tot').slice(1, 2)`), [String(t.total)]);
  assert.deepStrictEqual(evObj(`${g}.sum(${JSON.stringify(sid)}).slice(1, 2)`), [String(t.total)]);
  // « +n S2 » = total du carnet sur la période + MBN de la période.
  const n = ev(`(() => { const cls = getCls(), pI = _carnetCurrentPeriodIdx(cls), p = _periods(cls)[pI]; return (_relPeriodTotal(cls.id, ${JSON.stringify(sid)}, pI) || 0) + _obsMbnEntre(${JSON.stringify(sid)}, p.start, p.end).length; })()`);
  const lbl = ev(`_periods(getCls())[_carnetCurrentPeriodIdx(getCls())].label`);
  const html = ev(`_elevesIndicHTML(getCls(), _elevesRows(getCls()), [], null)`);
  if (n) assert.ok(html.includes(`>+${n} <small>${lbl}</small>`));
  // 1er septembre.
  assert.strictEqual(ev(`_debutUtile('2025-08-01')`), '2025-09-01');
  assert.strictEqual(ev(`_debutUtile('2026-02-01')`), '2026-02-01');
  const courbe = ev(`_ficheCourbeHTML(getCls(), S.eleves[${JSON.stringify(sid)}], _ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0'))`);
  assert.ok(!courbe.includes('>août<') && courbe.includes('>sept.<'));
  const frise = ev(`_ficheChronoHTML(getCls(), S.eleves[${JSON.stringify(sid)}], _ficheMoments(getCls()).find(c => c.key === 'bil:conseil:0'))`);
  assert.ok(!frise.includes('>août<'));
});

test('Carte de chaleur : bornée au moment choisi (le même que la fiche), dit dans la barre, le bilan du moment marqué', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; _ficheMoment = null;`);
  // Par défaut : le conseil de la période courante, donc la période entière.
  const def = ev(`_ficheMomentCourant(getCls()).key`);
  assert.match(def, /^bil:conseil:/);
  ev(`_ficheMoment = 'bil:miperiode:0'`);
  const b = evObj(`_ficheBornes(getCls(), _ficheMomentCourant(getCls()))`);
  const G = `_chaleurGroupes(getCls(), _bilanColsVues(getCls(), _carnetCurrentPeriodIdx(getCls())))`;
  const dates = evObj(`${G}.find(g => g.key === 'carnet').sub.map(x => x.id)`);
  assert.ok(dates.length && dates.every(d => d >= b.start && d <= b.end), 'seulement les relevés du moment');
  assert.match(ev(`${G}.find(g => g.key === 'carnet').label`), /Mi-S1/);
  assert.ok(evObj(`${G}.find(g => g.key === 'bil')?.sub.map(x => x.l) || []`).some(l => l === '▶ Mi-S1') || !ev(`_bilanColsVues(getCls(), _carnetCurrentPeriodIdx(getCls())).some(c => c.key === 'bil:miperiode:0')`));
  const html = evObj(`_elevesChaleurHTML(getCls(), _elevesRows(getCls()), [])`);
  assert.match(html.barre, /Synthèse pour/);
  assert.match(html.barre, /class="on"[^>]*>Mi-S1</);
  assert.match(html.barre, /chaleurMomentSet\('bil:conseil:0'\)/);
  ev(`_ficheMoment = null`);
});

test('« +n » : depuis une durée choisie (📅), carnet et MBN confondus ; le filtre « en hausse » suit la même durée', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = '';`);
  const cls = 'getCls()';
  const p2 = evObj(`_periods(getCls())[1]`);
  // Fenêtres : fin = aujourd'hui ramené dans l'année ; début selon la durée.
  assert.deepStrictEqual(evObj(`(f => [f.start, f.end, f.court])(_obsFenetre(${cls}, '1s', '2026-03-20'))`), ['2026-03-14', '2026-03-20', '1 sem.']);
  assert.deepStrictEqual(evObj(`(f => [f.start, f.end])(_obsFenetre(${cls}, '2s', '2026-03-20'))`), ['2026-03-07', '2026-03-20']);
  assert.deepStrictEqual(evObj(`(f => [f.start, f.end])(_obsFenetre(${cls}, '1m', '2026-03-20'))`), ['2026-02-21', '2026-03-20']);
  assert.deepStrictEqual(evObj(`(f => [f.start, f.end])(_obsFenetre(${cls}, '2m', '2026-03-20'))`), ['2026-01-21', '2026-03-20']);
  assert.deepStrictEqual(evObj(`(f => [f.start, f.court])(_obsFenetre(${cls}, 'per', '2026-03-20'))`), [p2.start, 'S2']);
  assert.match(ev(`_obsFenetre(${cls}, 'per', '2026-03-20').long`), /début du semestre/);
  assert.strictEqual(ev(`_obsFenetre(${cls}, '1s', '2099-01-01').end`), ev(`_periods(getCls()).slice(-1)[0].end`));
  // Gagnées = carnet sur la fenêtre + MBN de la fenêtre.
  const sid = ev(`getCls().eleves.find(id => _obsMbnOf(id).length >= 3)`);
  const F = `_obsFenetre(${cls}, 'per', '2026-07-31')`;
  const g = evObj(`_obsGagnees(${cls}, ${JSON.stringify(sid)}, ${F})`);
  assert.strictEqual(g.carnet, ev(`_obsEntre(getCls().id, ${JSON.stringify(sid)}, ${F}.start, ${F}.end) || 0`));
  assert.strictEqual(g.mbn, ev(`_obsMbnEntre(${JSON.stringify(sid)}, ${F}.start, ${F}.end).length`));
  assert.strictEqual(g.n, g.carnet + g.mbn);
  // Le filtre suit la fenêtre.
  ev(`_elevesFiltres = new Set(['carnet'])`);
  const gardes = evObj(`_elevesRows(getCls()).map(x => x.s.id)`);
  assert.ok(gardes.length && gardes.every(id => ev(`_obsGagnees(getCls(), ${JSON.stringify(id)}, _obsFenetre(getCls())).n`) >= 3));
  assert.match(ev(`ELEVES_FILTRES.find(f => f.key === 'carnet').label`), /\+3 ou plus \(S2\)/);
  ev(`_elevesFiltres = new Set()`);
  // L'en-tête porte le choix, les cinq durées.
  const html = ev(`_obsFenetrePickHTML(getCls())`);
  assert.strictEqual((html.match(/obsFenetreSet\('/g) || []).length, 5);
  assert.match(html, /Depuis le début du semestre/);
});

test('Carte de chaleur : ses moments ne dépendent pas de 🗓 Moments ; le titre « Synthèse pour » ouvre la liste à cocher ; le compte est à droite des filtres', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); _elevesFiltres = new Set(); _eleveFilter = ''; _ficheMoment = null; S.prefs.bilansMasques = []; S.prefs.chaleurMoments = undefined;`);
  const vus = () => evObj(`_chaleurMoments(getCls()).map(c => c.key)`);
  assert.ok(vus().includes('bil:miperiode:0') && vus().includes('bil:conseil:0'));
  // Retirée de la liste (🗓 Moments), la mi-période reste proposée dans la carte de chaleur.
  ev(`S.prefs.bilansMasques = ['bil:miperiode:0']`);
  assert.ok(vus().includes('bil:miperiode:0'));
  assert.ok(!evObj(`_ficheMoments(getCls()).map(c => c.key)`).includes('bil:miperiode:0'), 'la fiche, elle, suit la liste');
  // Tous les mois sont proposables (ni août ni juillet) ; on coche / décoche.
  const tous = evObj(`_chaleurMomentsTous(getCls()).map(c => c.key)`);
  assert.ok(tous.includes('bil:mois:2025-10') && !tous.some(k => /-0[78]$/.test(k)));
  assert.ok(!vus().includes('bil:mois:2025-10'));
  ev(`undoStack.length = 0; chaleurMomentVu('bil:mois:2025-10', true)`);
  assert.ok(vus().includes('bil:mois:2025-10'));
  assert.strictEqual(ev(`undoStack.length`), 1);
  ev(`chaleurMomentVu('bil:miperiode:0', false)`);
  assert.ok(!vus().includes('bil:miperiode:0'));
  // La liste à cocher est derrière le titre.
  const barre = evObj(`_elevesChaleurHTML(getCls(), _elevesRows(getCls()), [])`).barre;
  assert.match(barre, /<summary[^>]*>Synthèse pour ▾<\/summary>/);
  assert.match(barre, /chaleurMomentVu\('bil:mois:2025-10', this\.checked\)/);
  // Le compte : à droite des filtres, pas de seconde ligne.
  ev(`try { localStorage.setItem('suiviPP_elevesAffichage', 'chaleur'); } catch (_) {}`);
  const html = ev(`(() => { const z = document.createElement('div'); const o = document.getElementById; document.getElementById = x => x === 'eleves-body' ? z : o.call(document, x);
    try { renderStudents(); return z.innerHTML; } finally { document.getElementById = o; } })()`);
  assert.strictEqual(ev(`_elevesAffichage()`), 'chaleur');
  assert.ok(!html.includes('el-vues-tb'), 'pas de seconde ligne');
  assert.match(html, /margin-left:auto"><span class="tb-hint">\d+ élèves? sur \d+/);
  ev(`try { localStorage.removeItem('suiviPP_elevesAffichage'); } catch (_) {} S.prefs.chaleurMoments = undefined; S.prefs.bilansMasques = [];`);
});
