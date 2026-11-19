const voiceCacheName = 'taiwan-local-voice-v1';
const readyKey = new URL('./voice-pack-ready', import.meta.url).href;
const preferenceKey = 'taiwan-local-voice-enabled';

export function createVoiceWorker() {
  return new Worker(new URL('./mandarin-worker.js?v=5', import.meta.url), {type: 'module'});
}

export function setupLocalVoice(dialog, trigger, onChange) {
  const toggle = dialog.querySelector('#local-voice-toggle');
  const status = dialog.querySelector('#voice-status');
  const progressBox = dialog.querySelector('#voice-progress');
  const bar = progressBox.querySelector('progress');
  const detail = progressBox.querySelector('small');
  let enabled = false;
  let saving = false;
  let failure = '';
  let progress = {stage: 'start'};
  const stages = {
    start: 'ダウンロードの準備中…',
    model: '中国語の音声モデルをダウンロード中…',
    verify: '補助音声データの取得と動作確認中…',
    save: '音声データを端末に保存中…'
  };

  function paint() {
    toggle.checked = enabled || saving;
    toggle.disabled = saving;
    const message = saving ? stages[progress.stage]
      : failure || (enabled ? '準備完了。音声をオフラインで再生できます。' : 'オフ');
    if (status.textContent !== message) status.textContent = message;
    progressBox.hidden = !saving;
    const {stage, loaded, total} = progress;
    if (stage === 'model' && total > 0) {
      bar.value = Math.min(100, Math.floor(loaded / total * 100));
      detail.textContent = `${bar.value}% · ${(loaded / 1e6).toFixed(1)} MB / ${(total / 1e6).toFixed(1)} MB`;
    } else {
      bar.removeAttribute('value');
      detail.textContent = stage === 'model' && loaded > 0 ? `${(loaded / 1e6).toFixed(1)} MB 取得済み` : '';
    }
  }

  const ready = (async () => {
    try {
      enabled = localStorage.getItem(preferenceKey) === 'yes'
        && Boolean(await caches.match(readyKey, {cacheName: voiceCacheName}));
    } catch {}
    paint();
  })();
  void ready.then(() => onChange(enabled));

  trigger.addEventListener('click', () => dialog.showModal());
  toggle.addEventListener('change', async () => {
    const next = toggle.checked;
    await ready;
    failure = '';
    if (!next) {
      enabled = false;
      onChange(false);
      try { localStorage.removeItem(preferenceKey); } catch {}
      paint();
      return;
    }
    saving = true;
    progress = {stage: 'start'};
    paint();
    let preparedWorker;
    try {
      if (!await caches.match(readyKey, {cacheName: voiceCacheName})) {
        preparedWorker = await prepareVoicePack(update => {
          progress = update;
          paint();
        });
      }
      localStorage.setItem(preferenceKey, 'yes');
      enabled = true;
    } catch {
      enabled = false;
      failure = '保存できませんでした。通信と端末の空き容量を確認して、もう一度オンにしてください。';
    } finally {
      if (!enabled) preparedWorker?.terminate();
      saving = false;
      paint();
      onChange(enabled, enabled ? preparedWorker : undefined);
    }
  });

  return {
    async isEnabled() {
      await ready;
      return enabled;
    },
    async requireEnabled() {
      await ready;
      if (enabled) return true;
      if (!dialog.open) dialog.showModal();
      return false;
    }
  };
}

async function prepareVoicePack(onProgress) {
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
  let keepWorker = false;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice download timed out')), 120000);
      worker.onmessage = ({data}) => {
        if (data.progress) {
          onProgress(data.progress);
          return;
        }
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
    onProgress({stage: 'save'});
    const assets = (await cache.keys()).map(request => request.url);
    if (!assets.some(url => url.includes('/piper-tts-web@')) ||
        !assets.some(url => url.includes('ort-wasm') && url.endsWith('.wasm')) ||
        !assets.some(url => url.endsWith('/espeak-ng.wasm'))) {
      throw new Error('Voice files were not saved');
    }
    await cache.put(readyKey, new Response('ready'));
    keepWorker = true;
    return worker;
  } finally {
    worker.onmessage = null;
    worker.onerror = null;
    if (!keepWorker) worker.terminate();
  }
}
