const voiceCacheName = 'taiwan-local-voice-v1';
const readyKey = new URL('./voice-pack-ready', import.meta.url).href;
const preferenceKey = 'taiwan-local-voice-enabled';

export function createVoiceWorker() {
  return new Worker(new URL('./mandarin-worker.js?v=3', import.meta.url), {type: 'module'});
}

export function setupLocalVoice(dialog, trigger, onDisable) {
  const toggle = dialog.querySelector('input');
  const status = dialog.querySelector('[role=status]');
  let enabled = false;
  let saving = false;
  let failure = '';

  function paint() {
    toggle.checked = enabled || saving;
    toggle.disabled = saving;
    status.textContent = saving ? '音声データをダウンロードしています…'
      : failure || (enabled ? '準備完了。音声をオフラインで再生できます。' : 'オフ');
  }

  const ready = (async () => {
    try {
      enabled = localStorage.getItem(preferenceKey) === 'yes'
        && Boolean(await caches.match(readyKey, {cacheName: voiceCacheName}));
    } catch {}
    paint();
  })();

  trigger.addEventListener('click', () => dialog.showModal());
  toggle.addEventListener('change', async () => {
    const next = toggle.checked;
    await ready;
    failure = '';
    if (!next) {
      enabled = false;
      onDisable();
      try { localStorage.removeItem(preferenceKey); } catch {}
      paint();
      return;
    }
    saving = true;
    paint();
    try {
      if (!await caches.match(readyKey, {cacheName: voiceCacheName})) {
        await prepareVoicePack();
      }
      localStorage.setItem(preferenceKey, 'yes');
      enabled = true;
    } catch {
      enabled = false;
      failure = '保存できませんでした。通信と端末の空き容量を確認して、もう一度オンにしてください。';
    } finally {
      saving = false;
      paint();
    }
  });

  return {
    async requireEnabled() {
      await ready;
      if (enabled) return true;
      if (!dialog.open) dialog.showModal();
      return false;
    }
  };
}

async function prepareVoicePack() {
  const registration = await navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url));
  await registration.update().catch(() => {});
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice storage is unavailable')), 12000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, {once: true});
    });
  }
  const cache = await caches.open(voiceCacheName);
  const worker = createVoiceWorker();
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice download timed out')), 120000);
      worker.onmessage = ({data}) => {
        clearTimeout(timer);
        if (data.ready) resolve();
        else reject(new Error('Voice download failed'));
      };
      worker.onerror = error => {
        clearTimeout(timer);
        reject(error);
      };
      worker.postMessage({prepare: true});
    });
    const assets = (await cache.keys()).map(request => request.url);
    if (!assets.some(url => url.includes('/piper-tts-web@')) ||
        !assets.some(url => url.includes('ort-wasm') && url.endsWith('.wasm')) ||
        !assets.some(url => url.endsWith('/espeak-ng.wasm'))) {
      throw new Error('Voice files were not saved');
    }
    await cache.put(readyKey, new Response('ready'));
  } finally {
    worker.terminate();
  }
}
