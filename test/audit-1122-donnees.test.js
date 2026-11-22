// Audit du 2026-11-22 — données, réglages, dossiers : les défauts confirmés, corrigés. Chaque test a été vérifié
// en échec sur la version d'avant la correction.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness.js');

const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'suivi pp.html'), 'utf8');

test('deux dossiers qui ne répondent plus : la seconde fenêtre attend la fermeture de la première (elle l\'écrasait, et la première ne revenait jamais)', async () => {
  const r = JSON.parse(await ev(`(async () => {
    const vrai = appAlert, vues = [], fermer = [];
    appAlert = t => { vues.push(t); return new Promise(ok => fermer.push(ok)); };
    _dirStalledNoticed.sync = false; _dirStalledNoticed.pj = false;
    const tick = () => new Promise(r => setTimeout(r, 5));
    try {
      _dirStalledNotice('pj', 'Pièces'); _dirStalledNotice('sync', 'Sync');
      await tick(); const avant = vues.slice();
      fermer[0](true); await tick(); const apres = vues.slice();
      _dirStalledNotice('pj', 'Pièces'); await tick();          // déjà dite dans la session : pas une de plus
      fermer[1](true); await tick();
      return JSON.stringify({ avant, apres, fin: vues.length });
    } finally { appAlert = vrai; _dirStalledNoticed.sync = false; _dirStalledNoticed.pj = false; }
  })()`));
  assert.deepStrictEqual(r.avant, ['Dossier des pièces jointes : Chrome ne répond plus'], 'une seule fenêtre à la fois');
  assert.deepStrictEqual(r.apres, ['Dossier des pièces jointes : Chrome ne répond plus', 'Dossier de synchronisation : Chrome ne répond plus'], 'la seconde suit la fermeture de la première');
  assert.strictEqual(r.fin, 2);
});

test('aperçu d\'import des moyennes : une colonne entièrement vide n\'est annoncée ni comme matière ni comme « nouvelle »', () => {
  const r = JSON.parse(ev(`(() => { S = _emptyState(); postLoadHook();
    S.classes['5C'] = { id:'5C', nom:'5C', annee:'2025-26', eleves:['s1','s2'], ord:0, rooms:{} };
    S.eleves = { s1:{ id:'s1', nom:'DURAND', prenom:'Léa', classe_id:'5C', tags:[] }, s2:{ id:'s2', nom:'MARTIN', prenom:'Noé', classe_id:'5C', tags:[] } }; S.cur = '5C';
    const p = _moyParse("Nom et prénom de l'élève;MATHEMATIQUES(M. X);ARTS(Mme Vide);LATIN(Mme Z)\\nDURAND Léa;12;;14\\nMARTIN Noé;8;;\\nINCONNU Zoé;;17;");
    const m = _moyMatch(p, '5C', {});
    return JSON.stringify({ toutes: m.matieres.map(x => x.nom), utiles: _moyMatieresUtiles(m).map(x => x.nom) }); })()`));
  assert.strictEqual(r.toutes.length, 3);
  assert.deepStrictEqual(r.utiles.sort(), ['LATIN', 'MATHEMATIQUES'], 'ARTS n\'a de note que pour une ligne non reconnue : pas une matière de cet import');
});

test('réglages : la grille laisse rétrécir sa seconde colonne, et les menus de la rubrique 🤖 ne dépassent jamais leur case (débordement entre 540 et 710 px)', () => {
  assert.match((SRC.match(/^\.prefs \{[^}]*\}/m) || [''])[0], /grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  for (const id of ['ia-modele', 'ia-espace', 'ia-cle']) {
    const tag = (SRC.match(new RegExp('<(?:select|input)[^>]*id="' + id + '"[^>]*>')) || [''])[0];
    assert.match(tag, /max-width:min\(\d+px,\s*100%\)/, id);
  }
});

test('fenêtre « toute la classe » : le menu « Ranger dans » se plie à la largeur de la fenêtre (il sortait à 375 px)', () => {
  assert.match(SRC, /\.ia-bloc select \{[^}]*max-width:\s*100%/);
  assert.match((SRC.match(/^\.ia-bloc \{[^}]*\}/m) || [''])[0], /min-width:\s*0/);
});
