// Heures de vie de classe — le journal de la CLASSE : thème, décisions, thèmes à venir.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(app.__TESTEVAL(c)));

const FIXTURE = `S = _emptyState(); postLoadHook(); S.prefs.periodMode = 'semestre';
  S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1'], ord:0 }; S.cur = '5C';
  S.eleves = { s1:{id:'s1',nom:'DURAND',prenom:'Léa',classe_id:'5C',tags:[]} };
  postLoadHook();`;

test('hvcAdd / hvcSet / hvcRemove : date valide et thème obligatoires, texte libre ; tri du plus récent', () => {
  ev(FIXTURE);
  assert.strictEqual(evObj(`hvcAdd(S.classes['5C'], { date:'2025-09-31', titre:'x' })`), null);
  assert.strictEqual(evObj(`hvcAdd(S.classes['5C'], { date:'2025-09-05', titre:'  ' })`), null);
  const a = evObj(`hvcAdd(S.classes['5C'], { date:'2025-09-05', titre:' Règles de vie ', texte:' Décision : … ' })`);
  assert.deepStrictEqual([a.titre, a.texte], ['Règles de vie', 'Décision : …']);
  ev(`hvcAdd(S.classes['5C'], { date:'2026-01-16', titre:'Bilan S1' }); hvcAdd(S.classes['5C'], { date:'2025-11-14', titre:'Bruit' });`);
  assert.deepStrictEqual(evObj(`_hvcOf(S.classes['5C']).map(e => e.titre)`), ['Bilan S1', 'Bruit', 'Règles de vie']);
  assert.strictEqual(evObj(`hvcSet(S.classes['5C'], '${a.id}', { date:'2025-09-06', titre:'Accueil', texte:'' })`), true);
  assert.strictEqual(evObj(`hvcSet(S.classes['5C'], '${a.id}', { date:'2025-09-06', titre:'' })`), false);
  assert.deepStrictEqual(evObj(`S.classes['5C'].vieClasse.find(e => e.id === '${a.id}')`).titre, 'Accueil');
  assert.strictEqual(evObj(`hvcRemove(S.classes['5C'], '${a.id}')`), true);
  assert.strictEqual(evObj(`hvcRemove(S.classes['5C'], '${a.id}')`), false);
  assert.strictEqual(evObj(`_hvcOf(S.classes['5C']).length`), 2);
});

test('_hvcPeriode : les heures DE la période, en ordre chronologique ; postLoadHook crée la section', () => {
  ev(FIXTURE);
  ev(`hvcAdd(S.classes['5C'], { date:'2026-01-16', titre:'Bilan S1' }); hvcAdd(S.classes['5C'], { date:'2025-09-05', titre:'Accueil' });
      hvcAdd(S.classes['5C'], { date:'2026-02-01', titre:'Premier jour S2' }); hvcAdd(S.classes['5C'], { date:'2026-01-31', titre:'Dernier jour S1' });`);
  assert.deepStrictEqual(evObj(`_hvcPeriode(S.classes['5C'], 0).map(e => e.titre)`), ['Accueil', 'Bilan S1', 'Dernier jour S1']);
  assert.deepStrictEqual(evObj(`_hvcPeriode(S.classes['5C'], 1).map(e => e.titre)`), ['Premier jour S2']);
  assert.deepStrictEqual(evObj(`_hvcPeriode(S.classes['5C'], 9)`), []);
  ev(`S.classes['5C'].vieClasse = ['zut', { id:'h1', date:'2025-09-05', ts:1, titre:'ok', texte:'' }]; S.classes['5D'] = { id:'5D', nom:'5D', eleves:[] }; postLoadHook();`);
  assert.deepStrictEqual(evObj(`[S.classes['5C'].vieClasse.length, S.classes['5D'].vieClasse]`), [1, []]);
});

test('la synthèse de période imprime les heures de la période quand le bloc est coché — pas par défaut', () => {
  ev(FIXTURE);
  ev(`hvcAdd(S.classes['5C'], { date:'2025-11-14', titre:'Bruit <b>', texte:'Décision : places' }); hvcAdd(S.classes['5C'], { date:'2026-03-20', titre:'Harcèlement' });`);
  const avec = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs','hvc'], type:'conseil', forme:'tableau' })`).html;
  assert.ok(avec.includes('Heures de vie de classe S1') && avec.includes('Bruit &lt;b&gt;') && avec.includes('Décision : places'));
  assert.ok(!avec.includes('Harcèlement'), 'celle du S2 n’y est pas');
  const sans = evObj(`_periodePrintHTML(S.classes['5C'], 0, { blocs:['obs'], type:'conseil', forme:'tableau' })`).html;
  assert.ok(!sans.includes('Heures de vie de classe'));
  assert.ok(!evObj(`_periodePrintOpts.blocs`).includes('hvc'), 'hors de la sélection par défaut : la feuille ne s’allonge pas sans qu’on le demande');
});

test('_hvcHTML : « à venir » pour une date future, formulaire à la demande', () => {
  ev(FIXTURE);
  ev(`hvcAdd(S.classes['5C'], { date:'2025-09-05', titre:'Passée' }); hvcAdd(S.classes['5C'], { date:'2099-01-01', titre:'Future' }); _hvcEdit = null;`);
  const html = ev(`_hvcHTML(S.classes['5C'])`);
  assert.ok(/à venir/.test(html) && html.indexOf('Future') < html.indexOf('Passée'), 'les thèmes à venir en tête, marqués');
  assert.ok(!html.includes('id="hvc-form"'));
  ev(`_hvcEdit = 'new'`);
  assert.ok(ev(`_hvcHTML(S.classes['5C'])`).includes('id="hvc-form"'));
  ev(`_hvcEdit = null`);
});
