const CACHE = 'timetable-v57';
const VOICE_CACHE = 'taiwan-local-voice-v1';
const VOICE_READY = new URL('taiwan/translate/voice-pack-ready', self.registration.scope).href;
const VOICE_ASSETS = [
  'https://esm.sh/@realtimex/piper-tts-web@1.1.1',
  'https://esm.sh/onnxruntime-web@1.22.0',
  'https://esm.sh/node/',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/',
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/',
  'https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/',
  'https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/',
  'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/'
];
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
  './assets/js/pwa.js?v=23',
  './assets/styles/ui.css?v=26',
  './assets/styles/install.css?v=3',
  './assets/js/notices.js',
  './assets/js/timetable-dates.js?v=2',
  './assets/styles/install.css',
  './assets/js/colors.js',
  './assets/js/workbook.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './taiwan/',
  './taiwan/translate/',
  './taiwan/translate/style.css?v=11',
  './taiwan/translate/app.js?v=14',
  './taiwan/translate/local-voice.js?v=4',
  './taiwan/translate/local-translation.js?v=1',
  './taiwan/translate/translation-pack.js?v=1',
  './taiwan/translate/translation-worker.js?v=1',
  './taiwan/translate/mandarin-worker.js?v=5',
  './taiwan/translate/config.js',
  './taiwan/sounds/',
  './taiwan/sounds/app.js?v=2',
  './taiwan/sounds/style.css?v=3',
  './taiwan/sounds/audio/hello.mp3',
  './taiwan/sounds/audio/well.mp3',
  './taiwan/sounds/audio/bye.mp3',
  './taiwan/sounds/audio/thanks.mp3',
  './taiwan/sounds/audio/welcome.mp3',
  './taiwan/sounds/audio/yes.mp3',
  './taiwan/sounds/audio/no.mp3',
  './taiwan/sounds/audio/sorry.mp3',
  './taiwan/sounds/audio/please.mp3',
  './taiwan/sounds/audio/toilet.mp3',
  './taiwan/sounds/audio/station.mp3',
  './taiwan/sounds/audio/recommend.mp3',
  './taiwan/sounds/audio/tasty.mp3',
  './taiwan/sounds/audio/price.mp3',
  './taiwan/sounds/audio/discount.mp3',
  './taiwan/sounds/audio/return.mp3',
  ...['prepare','packing','weather','map','chat','currency','translate','sounds'].flatMap(tool =>
    [`${tool}.webmanifest`, `${tool}-192.png`, `${tool}-512.png`].map(file => './taiwan/apps/' + file)),
  './taiwan/style.css?v=33',
  './taiwan/app.js?v=packing-edit-6',
  './taiwan/travel-ui.js?v=11',
  './taiwan/weather.js?v=3',
  './taiwan/currency.js?v=2',
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

async function soundResponse(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (!saved) return fetch(request);
  const range = request.headers.get('Range');
  if (!range) return saved;
  const body = await saved.blob();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${body.size}`}});
  const start = match[1] ? Number(match[1]) : Math.max(0, body.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), body.size - 1) : body.size - 1;
  if (start > end) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${body.size}`}});
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${body.size}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

async function voiceAsset(event) {
  const request = event.request;
  if (!await caches.has(VOICE_CACHE)) return fetch(request);
  const cache = await caches.open(VOICE_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  if (await cache.match(VOICE_READY)) return Response.error();
  const response = await fetch(request);
  if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
  return response;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) {
    if (VOICE_ASSETS.some(prefix => url.href.startsWith(prefix))) event.respondWith(voiceAsset(event));
    return;
  }
  if (/\/taiwan\/sounds\/audio\/[\w-]+\.mp3$/.test(url.pathname)) {
    event.respondWith(soundResponse(event.request));
    return;
  }
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
