const CACHE = 'timetable-v1';
const APP_FILES = [
  './',
  './index.html',
  './classes/1-5/',
  './classes/2-1/',
  './classes/2-3/',
  './classes/2-5/',
  './assets/styles/style.css',
  './assets/styles/colors.css',
  './assets/styles/ui.css',
  './assets/styles/portal.css',
  './assets/js/app.js',
  './assets/js/colors.js',
  './assets/js/workbook.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './data/1-5.json',
  './data/2-1.json',
  './data/2-3.json',
  './data/2-5.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(response => response || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
