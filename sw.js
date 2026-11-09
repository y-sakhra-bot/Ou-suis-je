// Service worker minimal : met l'interface en cache pour un lancement rapide / hors ligne.
const CACHE = 'ousuisje-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // tuiles de carte : toujours en ligne
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
