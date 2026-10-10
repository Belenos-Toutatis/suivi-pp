// Le rattachement MANUEL des matières des fiches de suivi à une discipline (v1.63.0, l'utilisateur : « ajoute le rattachement
// manuel dans Données »). `S.prefs.matieresFiche = { [nom normalisé]: did | '' }`, sinon la reconnaissance automatique.
// Noms inventés (dépôt public).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);
const evObj = c => JSON.parse(JSON.stringify(sb.__TESTEVAL(c)));
const ETAT = `S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook(); undoStack.length = 0; delete S.prefs.matieresFiche;
  S.fichesSuivi['5C'] = { etat: { app: 'fiche-suivi-collective', format: 1, savedAt: '', S: { matieres: [
    { nom: 'Français', prof: '' }, { nom: 'Espagnol', prof: '' }, { nom: 'Vie de classe', prof: '' }, { nom: 'Espagnol', prof: '' } ] } } };
  globalThis.__lv2 = disciplineAdd('Espagnol LV2').id; disciplineSet(__lv2, { profs: 'M. BROCHET' });`;

test('automatique par défaut ; un choix de Données passe avant ; « aucune » coupe le lien ; une discipline disparue redevient automatique', () => {
  ev(ETAT);
  const r = evObj(`(() => { const a = { fr: _ficheMatDisc('Français'), es: _ficheMatDisc('Espagnol'), vc: _ficheMatDisc('Vie de classe') };
    ficheMatSetDisc('espagnol', __lv2); ficheMatSetDisc('FRANÇAIS', '');
    const b = { fr: _ficheMatDisc('Français'), es: _ficheMatDisc(' Espagnol ') };
    disciplineRemove(__lv2); const c = _ficheMatDisc('Espagnol'); return { a, b, c, lv2: __lv2 }; })()`);
  assert.deepStrictEqual(r.a, { fr: 'francais', es: null, vc: null });
  assert.deepStrictEqual(r.b, { fr: '', es: r.lv2 });
  assert.strictEqual(r.c, null);
});

test('le réglage est remplacé, jamais modifié en place ; « automatique » le retire ; sans changement, rien', () => {
  ev(ETAT);
  const r = evObj(`(() => { const p0 = S.prefs.matieresFiche; const ok1 = ficheMatSetDisc('Espagnol', __lv2); const p1 = S.prefs.matieresFiche;
    const ok2 = ficheMatSetDisc('Espagnol', __lv2); const ok3 = ficheMatSetDisc('Espagnol', 'auto'); const bad = ficheMatSetDisc('Espagnol', 'nexistepas');
    return { ok1, ok2, ok3, bad, rempl: p0 !== p1, defaut: JSON.stringify(DEFAULT_PREFS.matieresFiche || null), fin: S.prefs.matieresFiche }; })()`);
  assert.deepStrictEqual([r.ok1, r.ok2, r.ok3, r.bad], [true, false, true, false]);
  assert.ok(r.rempl);
  assert.strictEqual(r.defaut, 'null');
  assert.deepStrictEqual(r.fin, {});
});

test('📋 Suivis : la matière rattachée à la main reçoit l’enseignant de sa discipline, une matière « aucune » rien', () => {
  ev(ETAT);
  const r = evObj(`(() => { const a = Object.keys(_suivisCommun('5C').profs);
    ficheMatSetDisc('Espagnol', __lv2); ficheMatSetDisc('Français', '');
    const c = _suivisCommun('5C').profs; return { a, es: c.Espagnol, fr: 'Français' in c }; })()`);
  assert.ok(r.a.includes('Français') && !r.a.includes('Espagnol'));
  assert.strictEqual(r.es.prof, 'M. BROCHET');
  assert.strictEqual(r.es.did, evObj('__lv2'));
  assert.strictEqual(r.fr, false);
});

test('fiche → Suivi PP : l’enseignant modifié dans la fiche revient à la discipline rattachée à la main, pas à une matière « aucune »', () => {
  ev(ETAT);
  const r = evObj(`(() => { ficheMatSetDisc('Espagnol', __lv2); ficheMatSetDisc('Français', '');
    const av = { matieres: [{ nom: 'Espagnol', prof: 'M. BROCHET' }, { nom: 'Français', prof: 'Mme X' }] };
    const ap = { matieres: [{ nom: 'Espagnol', prof: 'Mme TANCHE' }, { nom: 'Français', prof: 'Mme ABLETTE' }] };
    const fr0 = _discProfs('5C', 'francais'); _suivisCommunRetour('5C', av, ap);
    return { es: _discProfs('5C', __lv2), fr: _discProfs('5C', 'francais') === fr0 }; })()`);
  assert.strictEqual(r.es, 'Mme TANCHE');
  assert.ok(r.fr);
});

test('💾 Données ▸ Disciplines et matières : « À rattacher » (une ligne par nom), les autres sur demande, un cran d’undo par choix, tout échappé', () => {
  ev(ETAT);
  const h = ev(`(_donMatTout = false, _disciplinesTableHTML())`);
  assert.match(h, /<h3>À rattacher<\/h3>/);
  assert.strictEqual((h.match(/ficheMatDiscUI\('Espagnol'/g) || []).length, 1, 'une ligne par nom');
  assert.match(h, /📋 fiches de suivi/);
  assert.match(h, /— à choisir —/);
  assert.ok(!/ficheMatDiscUI\('Français'/.test(h), 'une matière rangée n’est pas « à rattacher »');
  const tout = ev(`(_donMatTout = true, _disciplinesTableHTML())`);
  assert.match(tout, /ficheMatDiscUI\('Français'[^]*?automatique → Français/);
  const r = evObj(`(() => { renderDonnees = () => {}; _donMatTout = false; ficheMatDiscUI('Espagnol', __lv2); const n1 = undoStack.length; ficheMatDiscUI('Espagnol', __lv2); const n2 = undoStack.length;
    const h2 = _disciplinesTableHTML(); undoLast(true); return { n1, n2, rangee: !h2.includes("ficheMatDiscUI('Espagnol'") && new RegExp('Espagnol LV2[^]*?[> ]Espagnol</td>').test(h2), apres: _ficheMatDisc('Espagnol') }; })()`);
  assert.deepStrictEqual(r, { n1: 1, n2: 1, rangee: true, apres: null });
  const x = ev(`(S.fichesSuivi['5C'].etat.S.matieres.push({ nom: '"><img src=x onerror=alert(1)>', prof: '' }), _disciplinesTableHTML())`);
  assert.ok(!x.includes('<img src=x'));
  const vide = ev(`(delete S.fichesSuivi['5C'].etat, _donMatTout = true, _disciplinesTableHTML())`);
  assert.ok(!/ficheMatDiscUI\(/.test(vide), 'sans suivi : aucune matière des fiches');
});

test('démo : « Vie de classe » et « Devoirs faits » rangées « aucune » (le choix se rencontre sans le créer)', () => {
  ev(`S = _emptyState(); postLoadHook(); createDemo({ force: true }); postLoadHook();`);
  assert.deepStrictEqual(evObj(`[_ficheMatDisc('Vie de classe'), _ficheMatDisc('Devoirs faits'), _ficheMatDisc('Français')]`), ['', '', 'francais']);
});

test('champ disciplinaire : envoyé avec la matière (le domaine de sa discipline) ; changé dans la fiche, il revient à la discipline', () => {
  ev(ETAT);
  const r = evObj(`(() => { const c = _suivisCommun('5C').profs;
    const av = { matieres: [{ nom: 'Français', prof: '' }, { nom: 'Mathématiques', prof: '' }] };
    const ap1 = { matieres: [{ nom: 'Français', prof: '', champ: 'lettres' }, { nom: 'Mathématiques', prof: '' }] };
    _suivisCommunRetour('5C', av, ap1); const inchange = _discDomaine('francais');
    const ap2 = { matieres: [{ nom: 'Français', prof: '', champ: 'langues' }, { nom: 'Mathématiques', prof: '', champ: 'constructor' }] };
    _suivisCommunRetour('5C', ap1, ap2);
    const sansAvant = (() => { const d0 = _discDomaine('maths'); _suivisCommunRetour('5C', null, { matieres: [{ nom: 'Mathématiques', prof: '', champ: 'arts' }] }); return _discDomaine('maths') === d0; })();
    return { fr: c['Français'].champ, inchange, apres: _discDomaine('francais'), maths: _discDomaine('maths'), sansAvant }; })()`);
  assert.deepStrictEqual(r, { fr: 'lettres', inchange: 'lettres', apres: 'langues', maths: 'sciences', sansAvant: true });
});
