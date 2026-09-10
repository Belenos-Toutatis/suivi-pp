const CACHE = 'suivi-pp-v2';
// ⚠️ Les ICÔNES sont préchargées comme le reste. Une app installée dont l'icône
// n'est pas en cache perd son icône au premier lancement hors-ligne : l'OS ne va
// pas la rechercher plus tard, il garde le carré vide. C'est aussi ce que sert
// l'écran de démarrage (background_color + icône) pendant que l'app se charge.
const FILES = [
  'suivi pp.html',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png',
];

// ⚠️ Fichier par fichier, PAS `addAll` : celui-ci rejette EN BLOC dès qu'une seule
// ressource répond 404, et l'installation entière échoue — le service worker ne
// s'active jamais et l'app perd le hors-ligne sans que rien ne le signale. Un
// fichier renommé et oublié ici ne doit coûter que sa propre absence, pas tout le
// cache. L'échec est donc toléré, mais JAMAIS silencieux.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    FILES.map(f => c.add(f).catch(err => {
      console.warn('[sw] préchargement impossible :', f, err && err.message);
    }))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Stratégie : réseau en premier, cache en repli (hors-ligne uniquement).
// On ne met en cache QUE :
//   - les requêtes GET (cache.put rejette les autres méthodes)
//   - la même origine (sinon api.github.com serait figée et checkForUpdate
//     resterait bloqué sur l'ancienne réponse)
//   - les schémas http(s) (évite chrome-extension://, data:, blob:…)
//   - les réponses OK (2xx) (ne pas cacher les 4xx/5xx)
self.addEventListener('fetch', e => {
  const req = e.request;
  let cacheable = false;
  try {
    const url = new URL(req.url);
    cacheable = req.method === 'GET'
      && url.origin === self.location.origin
      && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch (_) { /* URL invalide → pas cacheable */ }

  e.respondWith(
    fetch(req)
      .then(response => {
        if (cacheable && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(req).then(hit => {
        if (hit) return hit;
        // Hors-ligne ET ressource jamais mise en cache. Pour une navigation, on sert
        // l'app ; sinon une réponse 503 lisible plutôt qu'une erreur réseau brute.
        if (req.mode === 'navigate') {
          return caches.match('suivi pp.html').then(app =>
            app || new Response('Hors-ligne — application non encore mise en cache.',
              { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
        }
        return new Response('Hors-ligne — ressource non disponible.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }))
  );
});
