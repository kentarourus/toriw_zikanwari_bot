self.addEventListener('message', async ({data: {text}}) => {
  try {
    const {default: createEngine} = await import('https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/espeak-ng.js');
    const engine = await createEngine({
      arguments: ['-b', '1', '-v', 'cmn', '-s', '145', '-w', '/speech.wav', '--', text],
    });
    const wave = engine.FS.readFile('/speech.wav');
    self.postMessage({wave: wave.buffer}, [wave.buffer]);
  } catch {
    self.postMessage({error: true});
  }
});
