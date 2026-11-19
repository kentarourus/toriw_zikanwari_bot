import {translationEndpoint} from './config.js';

const find = selector => document.querySelector(selector);
const chinese = 'zh-TW';
const japanese = 'ja';
const copy = {
  [chinese]: {
    source: '輸入', result: '翻譯結果', empty: '請說話或打字', waiting: '翻譯將顯示在這裡',
    translating: '翻譯中…', edit: '輸入繁體中文', save: '使用這段文字',
    listening: '聆聽中…', stop: '停止錄音', mic: '語音輸入',
    noMic: '無法使用語音輸入，請改用打字。', noVoice: '無法朗讀，請查看畫面上的文字。',
  },
  [japanese]: {
    source: '入力', result: '翻訳結果', empty: '話すか文字を入力', waiting: 'ここに翻訳結果が表示されます',
    translating: '翻訳中…', edit: '日本語を入力', save: 'この文章を使う',
    listening: '聞き取り中…', stop: '録音停止', mic: '音声入力',
    noMic: '音声入力を利用できません。文字入力をお使いください。', noVoice: '読み上げを利用できません。',
  },
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speech = window.speechSynthesis;
const panels = Object.fromEntries([...document.querySelectorAll('.panel')].map(panel => {
  const buttons = Object.fromEntries([...panel.querySelectorAll('button')].map(button => [button.dataset.action, button]));
  return [panel.dataset.language, {
    panel, buttons, phrase: panel.querySelector('[data-phrase]'),
    attribution: panel.querySelector('[data-attribution]'),
    role: panel.querySelector('[data-role]'), feedback: panel.querySelector('[data-feedback]'),
  }];
}));
const editor = find('#editor');
const draft = find('#draft');
const access = find('#access');
const accessInput = find('#access-code');
const sentences = {[chinese]: '', [japanese]: ''};
const translated = new Set();
const resultLanguage = () => source === japanese ? chinese : japanese;
let source = japanese;
let request;
let recognition;
let utterance;
let accessCode = '';

function paint() {
  find('.conversation').classList.toggle('reverse', source === chinese);
  find('#direction-label').textContent = source === japanese ? '日本語 → 繁體中文' : '繁體中文 → 日本語';
  for (const [language, side] of Object.entries(panels)) {
    const input = source === language;
    const words = copy[language];
    side.panel.toggleAttribute('data-input', input);
    side.role.textContent = input ? words.source : words.result;
    side.attribution.hidden = !translated.has(language);
    const phrase = sentences[language] || (input ? words.empty : words.waiting);
    if (side.phrase.textContent !== phrase) side.phrase.textContent = phrase;
    side.phrase.classList.toggle('empty', !sentences[language]);
    side.buttons.edit.disabled = !input;
    side.buttons.mic.disabled = !input || !SpeechRecognition;
    side.buttons.mic.textContent = input && recognition ? words.stop : words.mic;
    side.buttons.read.disabled = !speech || !sentences[language];
    side.panel.setAttribute('aria-busy', String(Boolean(request && !input)));
  }
  find('#translate').disabled = Boolean(request || recognition || !sentences[source].trim());
}

function showStatus(message = '', retry = false) {
  const status = find('#status');
  status.hidden = !message;
  status.textContent = message;
  find('#retry').hidden = !retry;
}

function stopSpeech() {
  utterance = undefined;
  speech?.cancel();
}

function cancelRequest() {
  if (!request) return;
  request.abort();
  request = undefined;
  panels[resultLanguage()].feedback.textContent = '';
}

function cancelRecognition() {
  if (!recognition) return;
  const previous = recognition;
  recognition = undefined;
  panels[source].feedback.textContent = '';
  previous.abort();
}

function animate(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function setSourceText(text) {
  cancelRequest();
  stopSpeech();
  panels[source].feedback.textContent = '';
  showStatus();
  translated.delete(source);
  sentences[source] = text.slice(0, 1000);
  paint();
}

find('#flip').addEventListener('click', () => {
  cancelRequest();
  cancelRecognition();
  stopSpeech();
  panels[source].feedback.textContent = '';
  source = resultLanguage();
  panels[source].feedback.textContent = '';
  showStatus();
  paint();
  animate(panels[source].panel, 'changed');
});

find('#clear').addEventListener('click', () => {
  cancelRequest();
  cancelRecognition();
  stopSpeech();
  translated.clear();
  for (const [language, side] of Object.entries(panels)) {
    sentences[language] = '';
    side.feedback.textContent = '';
  }
  showStatus();
  paint();
});

find('#show-info').addEventListener('click', () => find('#info').showModal());

find('#larger').addEventListener('click', event => {
  const large = find('.conversation').classList.toggle('large');
  event.currentTarget.setAttribute('aria-pressed', String(large));
  event.currentTarget.textContent = large ? '文字を戻す' : '文字を拡大';
});

function openEditor(language) {
  cancelRecognition();
  stopSpeech();
  paint();
  editor.lang = language;
  const title = copy[language].edit;
  find('#editor-title').textContent = title;
  find('#save-text').textContent = copy[language].save;
  draft.setAttribute('aria-label', title);
  draft.value = sentences[language];
  editor.showModal();
  draft.focus();
}

find('#edit-form').addEventListener('submit', event => {
  event.preventDefault();
  setSourceText(draft.value);
  editor.close();
});
editor.addEventListener('close', () => { draft.value = ''; });
access.addEventListener('close', () => { accessInput.value = ''; });
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}

function startMic(language) {
  if (recognition) {
    recognition.stop();
    return;
  }
  cancelRequest();
  stopSpeech();
  showStatus();
  const side = panels[language];
  const words = copy[language];
  const active = new SpeechRecognition();
  active.lang = language === japanese ? 'ja-JP' : chinese;
  active.onresult = event => {
    if (recognition === active) setSourceText(event.results[0][0].transcript);
  };
  active.onerror = () => {
    if (recognition === active) side.feedback.textContent = words.noMic;
  };
  active.onend = () => {
    if (recognition !== active) return;
    recognition = undefined;
    if (side.feedback.textContent === words.listening) side.feedback.textContent = '';
    paint();
  };
  try {
    active.start();
    recognition = active;
    side.feedback.textContent = words.listening;
  } catch {
    side.feedback.textContent = words.noMic;
  }
  paint();
}

function read(language) {
  stopSpeech();
  const side = panels[language];
  const locale = language === japanese ? 'ja-JP' : chinese;
  const voices = speech.getVoices();
  const voice = voices.find(candidate => candidate.lang.toLowerCase().replace('_', '-') === locale.toLowerCase())
    || (language === japanese && voices.find(candidate => /^ja([-_]|$)/i.test(candidate.lang)));
  if (voices.length && !voice) {
    side.feedback.textContent = copy[language].noVoice;
    return;
  }
  const line = new SpeechSynthesisUtterance(sentences[language]);
  line.lang = locale;
  if (voice) line.voice = voice;
  line.onerror = () => {
    if (utterance === line) side.feedback.textContent = copy[language].noVoice;
  };
  utterance = line;
  if (side.feedback.textContent === copy[language].noVoice) side.feedback.textContent = '';
  speech.speak(line);
}

for (const [language, side] of Object.entries(panels)) {
  side.buttons.edit.addEventListener('click', () => openEditor(language));
  side.buttons.mic.addEventListener('click', () => startMic(language));
  side.buttons.read.addEventListener('click', () => read(language));
  if (!SpeechRecognition) side.buttons.mic.title = copy[language].noMic;
}

async function translate() {
  const text = sentences[source].trim();
  if (!text || request || recognition) return;
  if (!translationEndpoint) {
    showStatus('翻訳サービスは準備中です。');
    return;
  }
  if (!accessCode) {
    access.showModal();
    accessInput.focus();
    return;
  }

  const to = resultLanguage();
  const side = panels[to];
  const active = new AbortController();
  request = active;
  const timeout = setTimeout(() => active.abort(), 15000);
  stopSpeech();
  showStatus();
  side.feedback.textContent = copy[to].translating;
  paint();

  try {
    const response = await fetch(translationEndpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + accessCode},
      body: JSON.stringify({text, source, target: to}),
      signal: active.signal,
    });
    if (request !== active) return;
    if (response.status === 401) {
      accessCode = '';
      showStatus('利用コードを確認して再試行してください。', true);
      return;
    }
    if (response.status === 456) {
      showStatus('DeepL の翻訳文字数の上限に達しました。');
      return;
    }
    if (response.status === 429) {
      showStatus('翻訳リクエストが集中しています。時間をおいて再試行してください。', true);
      return;
    }
    if (response.status === 503) {
      showStatus('翻訳サービスは準備中です。', true);
      return;
    }
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (request !== active) return;
    if (typeof result.translation !== 'string' || !result.translation.trim()) throw new Error();
    sentences[to] = result.translation;
    translated.add(to);
    animate(side.phrase, 'updated');
  } catch {
    if (request === active) showStatus('翻訳できませんでした。通信を確認して再試行してください。', true);
  } finally {
    clearTimeout(timeout);
    if (request === active) {
      request = undefined;
      side.feedback.textContent = '';
      paint();
    }
  }
}

find('#access-form').addEventListener('submit', event => {
  event.preventDefault();
  accessCode = accessInput.value.trim();
  accessInput.value = '';
  access.close();
  if (accessCode) void translate();
});
find('#translate').addEventListener('click', translate);
find('#retry').addEventListener('click', translate);
window.addEventListener('pagehide', () => {
  cancelRequest();
  cancelRecognition();
  stopSpeech();
  paint();
});
navigator.serviceWorker?.register(new URL('../../sw.js', import.meta.url)).catch(() => {});
paint();
