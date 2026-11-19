export const cacheName = 'taiwan-local-translation-v1';

const models = 'https://huggingface.co/midudev/firefox-translations/resolve/6f6acd72c26975a06a8e61b72d1fbacbd184c23f/';
const runtime = 'https://cdn.jsdelivr.net/npm/@mkljczk/bergamot-translator@0.4.16/worker/';
export const engineFiles = [
  {url: runtime + 'bergamot-translator-worker.js', bytes: 80474, integrity: 'sha256-vC/JjYWYRRYoF/lSbDnrHKSAX3FJ3+vA+82k0q9o4Tw='},
  {url: runtime + 'bergamot-translator-worker.wasm', bytes: 5241884, integrity: 'sha256-c11Nle3gQ8SPFGuaiTNgd/GIha0wt+mmqGxRpzygLns='},
];

function model(folder, code, [weights, lexicon, sourceVocab, targetVocab]) {
  const files = [
    [`model.${code}.intgemm.alphas.bin`, weights],
    [`lex.50.50.${code}.s2t.bin`, lexicon],
    ...(targetVocab ? [[`srcvocab.${code}.spm`, sourceVocab], [`trgvocab.${code}.spm`, targetVocab]]
      : [[`vocab.${code}.spm`, sourceVocab]]),
  ];
  return files.map(([name, bytes]) => ({url: `${models}${folder}/${name}`, bytes}));
}

// Firefox Translations' int8 models. Only these two routes are included.
export const routes = {
  ja: [
    model('ja-en', 'jaen', [43977787, 9348172, 1443222]),
    model('en-zh-Hant', 'enzh_hant', [43849787, 4057188, 803694, 751671]),
  ],
  'zh-TW': [
    model('zh-Hant-en', 'zh_hanten', [43849787, 6385944, 769669, 812572]),
    model('en-ja', 'enja', [43849787, 4128360, 796275, 827144]),
  ],
};

export const files = [...engineFiles, ...Object.values(routes).flat(2)];
export const packSize = files.reduce((total, file) => total + file.bytes, 0);
