// Dossier mémorisé qui ne répond plus (v1.92.4, repris de Plan de classe v2.166.1, commit aad3bed).
// Depuis Chrome 158, un handle de dossier restauré d'IndexedDB peut être « mort » : toutes ses méthodes restent en attente
// pour toujours, sans erreur. L'app ne doit plus rester bloquée : elle oublie le handle EN MÉMOIRE, prévient une fois par
// dossier et par session, et le bouton 📂 Dossier ouvre le sélecteur pour le choisir de nouveau.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const sb = loadApp();
const ev = c => sb.__TESTEVAL(c);

test('dossier mémorisé mort : démarrage, photos et bouton 📂 Dossier ne restent pas bloqués', async () => {
  const r = JSON.parse(await ev(`(async () => {
    const mort = { name: 'Suivi PP json', kind: 'directory' };
    for (const k of ['queryPermission', 'requestPermission', 'getDirectoryHandle', 'getFileHandle', 'entries', 'values', 'isSameEntry'])
      mort[k] = () => new Promise(() => {});
    const vrai = { fsa: _fsaWithin, idb: idbLoadHandle, alerte: appAlert, sdp: window.showDirectoryPicker, toast: toast };
    const alertes = [], toasts = []; let picker = 0;
    _fsaWithin = (p, ms) => vrai.fsa(p, 10);   /* 10 ms au lieu de 1,5 à 5 s */
    appAlert = (t, m) => { alertes.push([t, m]); return Promise.resolve(true); };
    toast = m => { toasts.push(m); };
    window.showDirectoryPicker = () => { picker++; return Promise.reject(Object.assign(new Error('annulé'), { name: 'AbortError' })); };
    idbLoadHandle = async () => mort;
    _dirStalledNoticed.sync = false; _dirStalledNoticed.pj = false;
    try {
      // 1. démarrage : le dossier de sync est oublié en mémoire, une fenêtre, pas d'autoReloadCheck
      await tryRestoreDirHandle();
      const demarrage = dirHandle === null;
      // 2. photos : _photosDir rend null et oublie le dossier des pièces jointes ; une seule fenêtre même si on recommence
      pjDirHandle = mort; const photos = await _photosDir(false, false); const pjOublie = pjDirHandle === null;
      pjDirHandle = mort; await _photosDir(false, false);
      // 3. bouton 📂 Dossier : pas de fenêtre de plus, un toast, et le sélecteur s'ouvre (choisir de nouveau)
      dirHandle = mort; _dirStalledNoticed.sync = false;
      await openFilePicker();
      // 4. un clic qui demande le dossier des PDF (_pjReady) : false, sans rester bloqué
      pjDirHandle = mort; _dirStalledNoticed.pj = false; const pjPret = await _pjReady('read');
      return JSON.stringify({ demarrage, photos, pjOublie, alertes: alertes.map(a => a[0]), nomEchappe: alertes.every(a => a[1].includes('Suivi PP json')),
        toasts, picker, dirApresBouton: dirHandle, pjPret });
    } finally {
      _fsaWithin = vrai.fsa; idbLoadHandle = vrai.idb; appAlert = vrai.alerte; window.showDirectoryPicker = vrai.sdp; toast = vrai.toast;
      dirHandle = null; pjDirHandle = null;
    }
  })()`));
  assert.strictEqual(r.demarrage, true, 'au démarrage, le dossier de sync mort est oublié en mémoire');
  assert.strictEqual(r.photos, null, '_photosDir rend null');
  assert.strictEqual(r.pjOublie, true, 'le dossier des pièces jointes mort est oublié en mémoire');
  assert.deepStrictEqual(r.alertes, ['Dossier de synchronisation : Chrome ne répond plus', 'Dossier des pièces jointes : Chrome ne répond plus'],
    'une fenêtre par dossier et par session, pas une de plus pour le bouton ni pour une 2e lecture des photos');
  assert.ok(r.nomEchappe, 'la fenêtre nomme le dossier');
  assert.strictEqual(r.picker, 1, 'le bouton 📂 Dossier ouvre le sélecteur pour choisir de nouveau le dossier');
  assert.strictEqual(r.dirApresBouton, null);
  assert.ok(r.toasts.some(t => /ne répond plus sur le dossier « Suivi PP json »/.test(t)), 'le bouton le dit par un toast');
  assert.strictEqual(r.pjPret, false, '_pjReady rend false sans rester bloqué');
});

test('dossier mémorisé : _fsaWithin rend la valeur quand la promesse répond, le repère sinon', async () => {
  assert.strictEqual(await ev(`_fsaWithin(Promise.resolve('granted'), 50)`), 'granted');
  assert.strictEqual(await ev(`_fsaWithin(new Promise(() => {}), 10)`), '__stalled');
});

test('dossier mémorisé : requestPermission n\'est jamais borné (il attend la réponse de l\'utilisateur)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
  assert.ok(!/_fsaWithin\([^)]*requestPermission/.test(src), 'aucun requestPermission dans _fsaWithin');
});
