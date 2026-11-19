let neural;
let basic;
let queue = Promise.resolve();
let latestId;
let previous;

function loadNeural(progress) {
  neural ??= Promise.all([
    import('https://esm.sh/@realtimex/piper-tts-web@1.1.1?deps=onnxruntime-web@1.22.0'),
    import('https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/esm/t2cn.js'),
  ]).then(async ([{TtsSession}, {Converter}]) => ({
    voice: await TtsSession.create({voiceId: 'zh_CN-huayan-medium', progress}),
    simplify: Converter({from: 'tw', to: 'cn'})
  })).catch(error => {
    neural = undefined;
    throw error;
  });
  return neural;
}

async function synthesizeNeural(text, progress) {
  const {voice, simplify} = await loadNeural(progress);
  return (await voice.predict(simplify(text))).arrayBuffer();
}

function loadBasic() {
  basic ??= import('https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/espeak-ng.js')
    .then(module => module.default);
  return basic;
}

async function synthesizeBasic(text, language) {
  const createEngine = await loadBasic();
  const engine = await createEngine({
    arguments: ['-b', '1', '-v', language === 'ja' ? 'ja' : 'cmn', '-s', '145', '-w', '/speech.wav', '--', text],
  });
  return engine.FS.readFile('/speech.wav').buffer;
}

async function processVoice({id, text, language, prepare, warm}) {
  if (warm) {
    await Promise.allSettled([loadNeural(), loadBasic()]);
    self.postMessage({warmed: true});
    return;
  }
  try {
    if (prepare) {
      self.postMessage({progress: {stage: 'model'}});
      let lastUpdate = 0;
      const mandarin = await synthesizeNeural('你好，請問車站在哪裡？', ({loaded, total}) => {
        const now = performance.now();
        if (now - lastUpdate < 120 && loaded !== total) return;
        lastUpdate = now;
        self.postMessage({progress: {stage: 'model', loaded, total}});
      });
      self.postMessage({progress: {stage: 'verify'}});
      const japanese = await synthesizeBasic('こんにちは。', 'ja');
      if (mandarin.byteLength <= 44 || japanese.byteLength <= 44) throw new Error('Voice sample is empty');
      self.postMessage({ready: true});
      return;
    }
    if (id !== latestId) return;
    if (previous?.text !== text || previous.language !== language) {
      const wave = language === 'ja' ? await synthesizeBasic(text, language)
        : await synthesizeNeural(text).catch(() => synthesizeBasic(text, language));
      previous = {text, language, wave};
    }
    if (id !== latestId) return;
    const wave = previous.wave.slice(0);
    self.postMessage({id, wave}, [wave]);
  } catch {
    self.postMessage({id, error: true});
  }
}

self.addEventListener('message', ({data}) => {
  if (data.id !== undefined) latestId = data.id;
  queue = queue.then(() => processVoice(data));
});
