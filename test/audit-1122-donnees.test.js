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
