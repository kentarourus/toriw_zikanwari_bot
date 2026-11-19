import {cacheName, files, packSize} from './translation-pack.js?v=1';

const preferenceKey = 'taiwan-local-translation-enabled';

export function setupLocalTranslation(dialog) {
  const toggle = dialog.querySelector('#local-translation-toggle');
  const status = dialog.querySelector('#local-translation-status');
  const progress = dialog.querySelector('#local-translation-progress');
  const bar = progress.querySelector('progress');
  const detail = progress.querySelector('small');
  bar.max = packSize;
  let enabled = false;
  let preparing = false;
  let worker;
  let workerSource;
  let sequence = 0;

  const ready = (async () => {
    try {
      if (!window.caches || !window.Worker || !window.WebAssembly) throw new Error('Local translation is unavailable');
      enabled = localStorage.getItem(preferenceKey) === 'yes';
      toggle.checked = enabled;
      if (enabled) {
        const cache = await caches.open(cacheName);
        const saved = new Set((await cache.keys()).map(key => key.url));
        status.textContent = files.every(file => saved.has(file.url))
          ? '準備完了。オフラインで翻訳できます。'
          : 'モデルが見つかりません。通信できる場所で設定を入れ直してください。';
      }
    } catch {
      toggle.disabled = true;
      status.textContent = 'このブラウザではモデルを端末に保存できません。';
    }
  })();

  function stop() {
    worker?.terminate();
    worker = undefined;
    workerSource = undefined;
  }

  function updateProgress(bytes) {
    bar.value = bytes;
    detail.textContent = `${Math.floor(bytes / packSize * 100)}% · ${(bytes / 1e6).toFixed(1)} / ${(packSize / 1e6).toFixed(1)} MB`;
  }

  toggle.addEventListener('change', async () => {
    const next = toggle.checked;
    preparing = next;
    toggle.disabled = true;
    await ready;
    try {
      if (next) {
        status.textContent = '翻訳モデルをダウンロード中…';
        progress.hidden = false;
        updateProgress(0);
        await savePack(updateProgress);
        localStorage.setItem(preferenceKey, 'yes');
        status.textContent = '準備完了。オフラインで翻訳できます。';
      } else {
        localStorage.removeItem(preferenceKey);
        status.textContent = 'オフ';
      }
      enabled = next;
    } catch {
      status.textContent = '保存できませんでした。通信と空き容量を確認して、もう一度お試しください。';
    } finally {
      preparing = false;
      toggle.checked = enabled;
      toggle.disabled = false;
      progress.hidden = true;
    }
  });

  return {
    async mode() {
      await ready;
      return preparing ? 'preparing' : enabled ? 'local' : 'online';
    },
    stop,
    translate(text, source, signal) {
      signal.throwIfAborted();
      if (!worker || workerSource !== source) {
        stop();
        worker = new Worker(new URL('./translation-worker.js?v=1', import.meta.url));
        workerSource = source;
      }
      const active = worker;
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const events = new AbortController();
        const options = {signal: events.signal};
        const cancel = () => {
          events.abort();
          reject(signal.reason);
        };
        signal.addEventListener('abort', cancel, options);
        active.addEventListener('message', ({data}) => {
          if (data.id !== id) return;
          events.abort();
          if (data.error) {
            stop();
            reject(new Error(data.error));
          } else {
            resolve(data.translation);
          }
        }, options);
        active.addEventListener('error', () => {
          events.abort();
          stop();
          reject(new Error('Translation worker failed'));
        }, options);
        active.postMessage({id, text, source});
      });
    },
  };
}

async function savePack(onProgress) {
  const cache = await caches.open(cacheName);
  let saved = 0;
  // Sequential downloads keep memory bounded and let retries reuse completed files.
  for (const {url, bytes, integrity} of files) {
    if (!await cache.match(url)) {
      const response = await fetch(url, {credentials: 'omit', integrity, signal: AbortSignal.timeout(180000)});
      if (!response.ok || !response.body) throw new Error('Translation asset download failed');
      let loaded = 0;
      const stream = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          onProgress(saved + loaded);
          controller.enqueue(chunk);
        },
        flush() {
          if (loaded !== bytes) throw new Error('Incomplete translation asset');
        },
      }));
      await cache.put(url, new Response(stream, {headers: {'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'}}));
    }
    saved += bytes;
    onProgress(saved);
  }
}
