// Service worker: deja la app disponible sin señal.
// Estrategia: red primero para el código (así siempre agarrás la última versión),
// caché como respaldo cuando no hay internet.

const CACHE = 'zona-roller-v5';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/calc.js',
  './js/ui.js',
  './js/pdf.js',
  './js/candado.js',
  './js/dinero.js',
  './js/mensaje.js',
  './js/graficos.js',
  './js/vistas/editor.js',
  './js/vistas/cotizar.js',
  './js/vistas/presupuestos.js',
  './js/vistas/pedidos.js',
  './js/vistas/clientes.js',
  './js/vistas/caja.js',
  './js/vistas/agenda.js',
  './js/vistas/reportes.js',
  './js/vistas/config.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nunca cacheamos las llamadas a Supabase.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
