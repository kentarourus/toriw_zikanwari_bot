const CACHE = 'timetable-v32';
const APP_FILES = [
  './',
  './index.html',
  './exams/',
  './exams/exam.js',
  './exams/exam.css',
  './stats/',
  './stats/stats.css',
  './stats/stats.js',
  './assets/js/analytics.js',
  './assets/icons/taipei-feature.svg',
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
  './assets/js/app.js?v=18',
  './assets/js/pwa.js?v=10',
  './assets/js/pwa.js?v=21',
  './assets/js/pwa.js?v=22',
  './assets/styles/ui.css?v=26',
  './assets/styles/install.css?v=2',
  './assets/js/notices.js',
  './assets/js/timetable-dates.js?v=2',
  './assets/styles/install.css',
  './assets/js/colors.js',
  './assets/js/workbook.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './taiwan/',
  './taiwan/style.css?v=21',
  './taiwan/app.js?v=packing-edit-6',
  './taiwan/travel-ui.js?v=4',
  './taiwan/weather.js?v=3',
  './taiwan/currency.js',
  './taiwan/offline-data.js',
  './taiwan/packing-data.js',
  './taiwan/packing-csv.js?v=2',
  './taiwan/taipei-illustration.webp',
  './taiwan/guide/',
  './taiwan/guide/style.css?v=3',
  './taiwan/guide.md',
  './taiwan/guide-assets/cover.png',
  './taiwan/guide-assets/day1.png',
  './taiwan/guide-assets/day2.png',
  './taiwan/guide-assets/day3.png',
  './taiwan/guide-assets/day4.png',
  './taiwan/guide-assets/hotel-plan.png',
  './taiwan/guide-assets/mrt-map.png',
  './data/1-1.json',
  './data/1-5.json',
  './data/2-1.json',
  './data/2-3.json',
  './data/2-5.json',
  './data/3-1.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('timetable-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(event.request, {ignoreSearch: true}) || Response.error();
    }));
    return;
  }
  event.respondWith(fetch(event.request, {cache:'no-store'}).then(async response => {
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}
    return response;
  }).catch(async () => await caches.match(event.request) || Response.error()));
});
