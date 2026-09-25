const CACHE = 'timetable-v13';
const APP_FILES = [
  './',
  './index.html',
  './classes/1-1/',
  './classes/1-1/manifest.webmanifest',
  './classes/1-5/',
  './classes/1-5/manifest.webmanifest',
  './classes/2-1/',
  './classes/2-1/manifest.webmanifest',
  './classes/2-3/',
  './classes/2-3/manifest.webmanifest',
  './classes/2-5/',
  './classes/2-5/manifest.webmanifest',
  './classes/3-1/',
  './classes/3-1/manifest.webmanifest',
  './assets/styles/style.css',
  './assets/styles/colors.css',
  './assets/styles/ui.css?v=13',
  './assets/styles/portal.css',
  './assets/js/app.js?v=14',
  './assets/js/pwa.js?v=10',
  './assets/js/notices.js',
  './assets/styles/install.css',
  './assets/js/colors.js',
  './assets/js/workbook.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './data/1-1.json',
  './data/1-5.json',
  './data/2-1.json',
  './data/2-3.json',
  './data/2-5.json',
  './data/3-1.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('timetable-') && key !== CACHE).map(key => caches.delete(key)))));
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
  event.respondWith(fetch(event.request, {cache:'no-store'}).then(async response => {
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}
    return response;
  }).catch(() => caches.match(event.request)));
});
