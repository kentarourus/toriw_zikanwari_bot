async function synthesizeNeural(text) {
  const [{TtsSession}, {Converter}] = await Promise.all([
    import('https://esm.sh/@realtimex/piper-tts-web@1.1.1?deps=onnxruntime-web@1.22.0'),
    import('https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/esm/t2cn.js'),
  ]);
  const voice = await TtsSession.create({voiceId: 'zh_CN-huayan-medium'});
  const simplified = Converter({from: 'tw', to: 'cn'})(text);
  return (await voice.predict(simplified)).arrayBuffer();
}

async function synthesizeBasic(text, language) {
  const {default: createEngine} = await import('https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/espeak-ng.js');
  const engine = await createEngine({
    arguments: ['-b', '1', '-v', language === 'ja' ? 'ja' : 'cmn', '-s', '145', '-w', '/speech.wav', '--', text],
  });
  return engine.FS.readFile('/speech.wav').buffer;
}

self.addEventListener('message', async ({data: {text, language, prepare}}) => {
  try {
    if (prepare) {
      const mandarin = await synthesizeNeural('你好，請問車站在哪裡？');
      const japanese = await synthesizeBasic('こんにちは。', 'ja');
      if (mandarin.byteLength <= 44 || japanese.byteLength <= 44) throw new Error('Voice sample is empty');
      self.postMessage({ready: true});
      return;
    }
    const wave = language === 'ja' ? await synthesizeBasic(text, language)
      : await synthesizeNeural(text).catch(() => synthesizeBasic(text, language));
    self.postMessage({wave}, [wave]);
  } catch {
    self.postMessage({error: true});
  }
});
