/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Bergamot bindings adapted from runonweb 0.1.0 and bergamot-translator.
 */
const gemm = {
  int8_prepare_a: 'int8PrepareAFallback',
  int8_prepare_b: 'int8PrepareBFallback',
  int8_prepare_b_from_transposed: 'int8PrepareBFromTransposedFallback',
  int8_prepare_b_from_quantized_transposed: 'int8PrepareBFromQuantizedTransposedFallback',
  int8_prepare_bias: 'int8PrepareBiasFallback',
  int8_multiply_and_add_bias: 'int8MultiplyAndAddBiasFallback',
  int8_select_columns_of_b: 'int8SelectColumnsOfBFallback',
};

let initialized;
let queue = Promise.resolve();

async function readAsset(cache, {url}) {
  const response = await cache.match(url);
  if (!response) throw new Error('Missing saved translation asset');
  return response;
}

async function startEngine(cache, engineFiles) {
  const [script, wasm] = await Promise.all(engineFiles.map(file => readAsset(cache, file)));
  // The generated Emscripten bindings expect a classic worker global.
  const imports = {
    locateFile: () => '',
    instantiateWasm(info, accept) {
      const wasm_gemm = Object.fromEntries(Object.entries(gemm).map(
        ([name, method]) => [name, (...args) => imports.asm[method](...args)],
      ));
      wasm.arrayBuffer()
        .then(bytes => WebAssembly.instantiate(bytes, {...info, wasm_gemm}))
        .then(({instance}) => accept(instance))
        .catch(imports.onAbort);
      return {};
    },
  };
  const initialized = new Promise((resolve, reject) => {
    imports.onRuntimeInitialized = resolve;
    imports.onAbort = reason => reject(new Error(String(reason)));
  });
  self.Module = imports;
  const url = URL.createObjectURL(await script.blob());
  try {
    importScripts(url);
    await initialized;
    return imports;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function aligned(engine, buffer, alignment) {
  const data = new engine.AlignedMemory(buffer.byteLength, alignment);
  data.getByteArrayView().set(new Uint8Array(buffer));
  return data;
}

async function loadModel(engine, cache, files) {
  const [weights, lexicon, ...vocabs] = await Promise.all(files.map(async file =>
    (await readAsset(cache, file)).arrayBuffer()));
  const vocab = new engine.AlignedMemoryList();
  for (const buffer of vocabs) vocab.push_back(aligned(engine, buffer, 64));
  const config = [
    'beam-size: 3',
    'normalize: 1.0',
    'word-penalty: 0',
    'cpu-threads: 0',
    'gemm-precision: int8shiftAlphaAll',
    'skip-cost: true',
    'alignment: soft',
    'quiet: true',
    'quiet-translation: true',
    'max-length-break: 128',
    'mini-batch-words: 512',
    'workspace: 128',
    'max-length-factor: 2.0',
    '',
  ].join('\n');
  return new engine.TranslationModel(config, aligned(engine, weights, 256), aligned(engine, lexicon, 64), vocab, null);
}

async function load(source) {
  const {cacheName, engineFiles, routes} = await import('./translation-pack.js?v=1');
  const cache = await caches.open(cacheName);
  const engine = await startEngine(cache, engineFiles);
  const first = await loadModel(engine, cache, routes[source][0]);
  const second = await loadModel(engine, cache, routes[source][1]);
  return {engine, service: new engine.BlockingService({cacheSize: 0}), first, second};
}

self.addEventListener('message', ({data: {id, text, source}}) => {
  queue = queue.then(async () => {
    try {
      const {engine, service, first, second} = await (initialized ||= load(source));
      const input = new engine.VectorString();
      const options = new engine.VectorResponseOptions();
      let responses;
      try {
        input.push_back(text);
        options.push_back({alignment: false, html: false, qualityScores: false});
        responses = service.translateViaPivoting(first, second, input, options);
        const result = responses.get(0);
        try {
          self.postMessage({id, translation: result.getTranslatedText().trim()});
        } finally {
          result.delete?.();
        }
      } finally {
        responses?.delete();
        input.delete();
        options.delete();
      }
    } catch (error) {
      self.postMessage({id, error: error.message});
    }
  });
});
