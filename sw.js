// Service worker: menyimpan seluruh aplikasi di perangkat agar terbuka tanpa internet.
const CACHE = 'catatan-koas-v1';
const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'js/search.js',
  'js/zip.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache dulu (cepat & offline), lalu perbarui diam-diam di latar belakang bila ada internet.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      const res = await network;
      return res || (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }),
  );
});
