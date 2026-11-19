import {translationEndpoint} from './config.js';
const embedded = location.hash === '#embedded' && self !== parent;

const find = selector => document.querySelector(selector);
const conversation = find('.conversation');
const chinese = 'zh-TW';
const japanese = 'ja';
const copy = {
  [chinese]: {
    source: '輸入', result: '翻譯結果', waiting: '翻譯將顯示在這裡',
    translating: '翻譯中…', placeholder: '點這裡輸入文字',
    controls: ['切換方向', '清除全部', '放大文字', '全螢幕', '還原視窗', '關閉'], send: '送出翻譯', retry: '重試',
    listening: '聆聽中…', stop: '停止錄音', mic: '語音輸入',
    noMic: '無法使用語音輸入，請改用打字。', noVoice: '無法朗讀，請查看畫面上的文字。',
  },
  [japanese]: {
    source: '入力', result: '翻訳結果', waiting: 'ここに翻訳結果が表示されます',
    translating: '翻訳中…', placeholder: 'タップして文字を入力',
    controls: ['方向切替', '全消去', '文字を拡大', '最大化', '元の大きさに戻す', '閉じる'], send: '翻訳する', retry: '再試行',
    listening: '聞き取り中…', stop: '録音停止', mic: '音声入力',
    noMic: '音声入力を利用できません。文字入力をお使いください。', noVoice: '読み上げを利用できません。',
  },
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speech = window.speechSynthesis;
const AudioContext = window.AudioContext || window.webkitAudioContext;
speech?.getVoices();
const panels = Object.fromEntries([...document.querySelectorAll('.panel')].map(panel => {
  const buttons = Object.fromEntries([...panel.querySelectorAll('button[data-action]')].map(button => [button.dataset.action, button]));
  return [panel.dataset.language, {
    panel, buttons, phrase: panel.querySelector('[data-phrase]'),
    draft: panel.querySelector('textarea'),
    attribution: panel.querySelector('[data-attribution]'),
    role: panel.querySelector('[data-role]'), feedback: panel.querySelector('[data-feedback]'),
  }];
}));
const sentences = {[chinese]: '', [japanese]: ''};
const translated = new Set();
const resultLanguage = () => source === japanese ? chinese : japanese;
let source = japanese;
let request;
let recognition;
let utterance;
let speechContext;
let fallbackSpeech;
let retryAvailable = false;
let viewportMaximized = embedded;
document.documentElement.classList.toggle('full-layout', viewportMaximized);
let typing;
let turning = false;

function stopTyping() {
  if (!typing) return;
  typing.events.abort();
  typing = undefined;
  conversation.classList.remove('is-typing');
  conversation.style.removeProperty('--typing-top');
  conversation.style.removeProperty('--typing-height');
}

function startTyping(draft) {
  if (typing) return;
  const frames = [];
  let view = window;
  while (view !== view.parent && view.frameElement) {
    frames.push(view.frameElement);
    view = view.parent;
  }

  const events = new AbortController();
  const options = {signal: events.signal};
  const viewport = view.visualViewport;
  const initialHeight = viewport?.height ?? view.innerHeight;
  let keyboardWasVisible = false;
  function fit() {
    const height = viewport?.height ?? view.innerHeight;
    const top = viewport?.offsetTop ?? 0;
    if (height < initialHeight - 70) keyboardWasVisible = true;
    if (keyboardWasVisible && height >= initialHeight - 24) {
      draft.blur();
      stopTyping();
      return;
    }
    const frameTop = frames.reduce((offset, frame) => offset + frame.getBoundingClientRect().top + frame.clientTop, 0);
    const visibleTop = Math.max(0, top - frameTop);
    const visibleBottom = Math.min(innerHeight, top + height - frameTop);
    conversation.style.setProperty('--typing-top', `${visibleTop}px`);
    conversation.style.setProperty('--typing-height', `${Math.max(0, visibleBottom - visibleTop)}px`);
  }

  typing = {events};
  fit();
  conversation.classList.add('is-typing');
  viewport?.addEventListener('resize', fit, options);
  viewport?.addEventListener('scroll', fit, options);
  view.addEventListener('resize', fit, options);
  if (view !== window) window.addEventListener('resize', fit, options);
}

conversation.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !typing) return;
  event.preventDefault();
  panels[source].draft.blur();
  stopTyping();
});
conversation.addEventListener('focusout', event => {
  if (!typing || conversation.contains(event.relatedTarget)) return;
  const activeTyping = typing;
  setTimeout(() => {
    if (typing === activeTyping && !conversation.contains(document.activeElement)) stopTyping();
  }, 180);
});

function labelControl(control, name) {
  control.setAttribute('aria-label', name);
  control.title = name;
}

function paintSend() {
  const button = panels[source].buttons.send;
  const {send, retry} = copy[source];
  labelControl(button, retryAvailable ? retry : send);
  button.querySelector('use').setAttribute('href', retryAvailable ? '#translate-icon-retry' : '#translate-icon-send');
  button.disabled = Boolean(request || recognition || !sentences[source].trim());
}

function paintControls() {
  const [flip, clear, size, expand, restore, close] = copy[source].controls;
  const expanded = viewportMaximized || Boolean(document.fullscreenElement);
  labelControl(find('#flip'), flip);
  labelControl(find('#clear'), clear);
  labelControl(find('#larger'), size);
  labelControl(find('#maximize'), expanded ? restore : expand);
  labelControl(find('#close-translation'), close);
  find('#maximize').setAttribute('aria-pressed', String(expanded));
  find('#maximize use').setAttribute('href', expanded ? '#translate-icon-min' : '#translate-icon-max');
}

function paint() {
  find('.conversation').classList.toggle('reverse', source === chinese);
  find('.controls').lang = source;
  find('#direction-label').textContent = source === japanese ? '日本語 → 繁體中文' : '繁體中文 → 日本語';
  for (const [language, side] of Object.entries(panels)) {
    const input = source === language;
    const words = copy[language];
    side.panel.toggleAttribute('data-input', input);
    side.role.textContent = input ? words.source : words.result;
    if (side.attribution) side.attribution.hidden = !translated.has(language);
    side.phrase.hidden = input;
    side.draft.hidden = !input;
    side.draft.placeholder = words.placeholder;
    if (side.draft.value !== sentences[language]) side.draft.value = sentences[language];
    const phrase = sentences[language] || words.waiting;
    if (side.phrase.textContent !== phrase) side.phrase.textContent = phrase;
    side.phrase.classList.toggle('empty', !sentences[language]);
    side.buttons.mic.hidden = side.buttons.send.hidden = !input;
    side.buttons.mic.disabled = !SpeechRecognition;
    labelControl(side.buttons.mic, !SpeechRecognition ? words.noMic : input && recognition ? words.stop : words.mic);
    side.buttons.mic.querySelector('use').setAttribute('href', input && recognition ? '#translate-icon-stop' : '#translate-icon-mic');
    side.buttons.read.disabled = !sentences[language] || (!speech && !(language === chinese && AudioContext));
    side.panel.setAttribute('aria-busy', String(Boolean(request && !input)));
  }
  paintSend();
  paintControls();
}

function showStatus(message = '', retry = false) {
  const status = find('#status');
  status.hidden = !message;
  status.textContent = message;
  retryAvailable = retry;
  paintSend();
}

function stopSpeech() {
  utterance = undefined;
  speech?.cancel();
  fallbackSpeech?.();
  fallbackSpeech = undefined;
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

function flipDirection() {
  panels[source].feedback.textContent = '';
  source = resultLanguage();
  panels[source].feedback.textContent = '';
  showStatus();
  paint();
  animate(panels[source].panel, 'changed');
}

find('#flip').addEventListener('click', async () => {
  if (turning) return;
  panels[source].draft.blur();
  stopTyping();
  cancelRequest();
  cancelRecognition();
  stopSpeech();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    flipDirection();
    return;
  }

  const previous = source;
  turning = true;
  try {
    if (document.startViewTransition) {
      await document.startViewTransition(flipDirection).finished;
    } else {
      const outgoing = conversation.animate(
        [{rotate: '0deg', opacity: 1}, {rotate: '90deg', opacity: 0}],
        {duration: 150, easing: 'ease-in', fill: 'forwards'}
      );
      await outgoing.finished;
      flipDirection();
      outgoing.cancel();
      await conversation.animate(
        [{rotate: '-90deg', opacity: 0}, {rotate: '0deg', opacity: 1}],
        {duration: 150, easing: 'ease-out'}
      ).finished;
    }
  } catch {
    if (source === previous) flipDirection();
  } finally {
    turning = false;
  }
});

find('#clear').addEventListener('click', () => {
  if (typing) panels[source].draft.focus({preventScroll: true});
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
find('#close-translation').addEventListener('click', event => {
  if (!embedded) return;
  event.preventDefault();
  parent.postMessage('taiwan-translate:close', location.origin);
});

find('#maximize').addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    return;
  }
  if (!viewportMaximized && document.fullscreenEnabled) {
    try {
      await document.documentElement.requestFullscreen();
      return;
    } catch {}
  }
  viewportMaximized = !viewportMaximized;
  document.documentElement.classList.toggle('full-layout', viewportMaximized);
  if (embedded) parent.postMessage(viewportMaximized ? 'taiwan-translate:maximize' : 'taiwan-translate:restore', location.origin);
  paintControls();
});
document.addEventListener('fullscreenchange', paintControls);

find('#larger').addEventListener('click', event => {
  const large = find('.conversation').classList.toggle('large');
  event.currentTarget.setAttribute('aria-pressed', String(large));
});

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

function readMandarin(text, side) {
  if (!AudioContext) {
    side.feedback.textContent = copy[chinese].noVoice;
    return;
  }

  // Unlock audio while handling the tap, before the synthesizer loads.
  let worker;
  try {
    speechContext ??= new AudioContext();
    worker = new Worker(new URL('./mandarin-worker.js?v=2', import.meta.url), {type: 'module'});
  } catch {
    side.feedback.textContent = copy[chinese].noVoice;
    return;
  }
  const audioReady = speechContext.resume().catch(() => {});
  const pendingMessage = '正在準備中文語音…';
  side.feedback.textContent = pendingMessage;
  let node;
  const timer = setTimeout(failed, 38000);
  const cancel = () => {
    clearTimeout(timer);
    worker.terminate();
    if (node) node.stop();
    if (side.feedback.textContent === pendingMessage) side.feedback.textContent = '';
  };
  function failed() {
    if (fallbackSpeech !== cancel) return;
    cancel();
    fallbackSpeech = undefined;
    side.feedback.textContent = '無法朗讀。請連線後再試一次。';
  }
  fallbackSpeech = cancel;
  worker.onerror = failed;
  worker.onmessage = async ({data}) => {
    worker.terminate();
    try {
      if (!data.wave) throw new Error('No audio');
      await audioReady;
      const buffer = await speechContext.decodeAudioData(data.wave);
      if (fallbackSpeech !== cancel) return;
      if (speechContext.state !== 'running') throw new Error('Audio is blocked');
      clearTimeout(timer);
      side.feedback.textContent = '';
      const player = speechContext.createBufferSource();
      player.buffer = buffer;
      player.connect(speechContext.destination);
      player.onended = () => { if (fallbackSpeech === cancel) fallbackSpeech = undefined; };
      player.start();
      node = player;
    } catch {
      failed();
    }
  };
  worker.postMessage({text});
}

function read(language) {
  stopSpeech();
  const side = panels[language];
  const text = sentences[language];
  const locale = language === japanese ? 'ja-JP' : chinese;
  const voices = speech?.getVoices() ?? [];
  const tag = voice => voice.lang.toLowerCase().replaceAll('_', '-');
  const best = candidates => candidates.find(candidate => /natural|premium|enhanced|neural/i.test(candidate.name)) || candidates[0];
  const preferred = voices.filter(candidate => language === japanese
    ? /^ja(-|$)/.test(tag(candidate))
    : /^(zh|cmn)(-hant)?-tw$|^zh-hant$/.test(tag(candidate)));
  const otherMandarin = voices.filter(candidate => /^(zh|cmn)(-hans)?(-cn|-sg)?$/.test(tag(candidate)));
  const voice = best(preferred) || (language === chinese ? best(otherMandarin) : undefined);
  if (language === chinese && !voice) {
    readMandarin(text, side);
    return;
  }
  if (voices.length && !voice) {
    side.feedback.textContent = copy[language].noVoice;
    return;
  }
  const line = new SpeechSynthesisUtterance(text);
  line.lang = voice?.lang ?? locale;
  line.rate = language === chinese ? .94 : .97;
  if (voice) line.voice = voice;
  line.onerror = () => {
    if (utterance !== line) return;
    if (language === chinese) readMandarin(text, side);
    else side.feedback.textContent = copy[language].noVoice;
  };
  utterance = line;
  if (side.feedback.textContent === copy[language].noVoice) side.feedback.textContent = '';
  speech.speak(line);
}

for (const [language, side] of Object.entries(panels)) {
  side.draft.addEventListener('focus', () => startTyping(side.draft));
  side.draft.addEventListener('input', () => {
    if (source !== language) return;
    cancelRecognition();
    setSourceText(side.draft.value);
  });
  side.buttons.mic.addEventListener('click', () => startMic(language));
  side.buttons.read.addEventListener('click', () => read(language));
  side.buttons.send.addEventListener('click', translate);
}

async function translate() {
  const text = sentences[source].trim();
  if (!text || request || recognition) return;
  panels[source].draft.blur();
  stopTyping();
  if (!translationEndpoint) {
    showStatus('翻訳サービスは準備中です。');
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
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text, source, target: to}),
      signal: active.signal,
    });
    if (request !== active) return;
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

window.addEventListener('pagehide', () => {
  stopTyping();
  cancelRequest();
  cancelRecognition();
  stopSpeech();
  paint();
});
navigator.serviceWorker?.register(new URL('../../sw.js', import.meta.url)).catch(() => {});
paint();
if (embedded) parent.postMessage('taiwan-translate:ready', location.origin);
