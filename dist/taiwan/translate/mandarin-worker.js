async function synthesizeNeural(text) {
  const [{TtsSession}, {Converter}] = await Promise.all([
    import('https://esm.sh/@realtimex/piper-tts-web@1.1.1?deps=onnxruntime-web@1.22.0'),
    import('https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/esm/t2cn.js'),
  ]);
  const voice = await TtsSession.create({voiceId: 'zh_CN-huayan-medium'});
  const simplified = Converter({from: 'tw', to: 'cn'})(text);
  return (await voice.predict(simplified)).arrayBuffer();
}

async function synthesizeBasic(text) {
  const {default: createEngine} = await import('https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/espeak-ng.js');
  const engine = await createEngine({
    arguments: ['-b', '1', '-v', 'cmn', '-s', '145', '-w', '/speech.wav', '--', text],
  });
  return engine.FS.readFile('/speech.wav').buffer;
}

self.addEventListener('message', async ({data: {text}}) => {
  try {
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Neural voice load timed out')), 26000);
    });
    const wave = await Promise.race([synthesizeNeural(text), deadline])
      .finally(() => clearTimeout(timer))
      .catch(() => synthesizeBasic(text));
    self.postMessage({wave}, [wave]);
  } catch {
    self.postMessage({error: true});
  }
});
