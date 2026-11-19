const audio = new Audio();
const status = document.getElementById('sound-status');
let current;
let playId = 0;

function reset() {
  current?.removeAttribute('data-playing');
  current = undefined;
}

audio.addEventListener('ended', () => {
  if (!audio.ended) return;
  reset();
  status.textContent = '再生が終わりました。';
});

document.querySelector('.sound-table').addEventListener('click', async event => {
  const button = event.target.closest('button[data-audio]');
  if (!button) return;
  const id = ++playId;
  audio.pause();
  reset();
  current = button;
  button.setAttribute('data-playing', '');
  const phrase = button.closest('li').querySelector('[lang]').textContent;
  const url = new URL(`audio/${button.dataset.audio}.mp3`, location.href).href;
  if (audio.src === url) audio.currentTime = 0;
  else audio.src = url;
  status.textContent = `再生中 · ${phrase}`;
  try {
    await audio.play();
  } catch {
    if (id !== playId) return;
    reset();
    status.textContent = '音声を再生できませんでした。もう一度押してください。';
  }
});

window.addEventListener('pagehide', () => {
  playId++;
  audio.pause();
  reset();
});

navigator.serviceWorker?.register(new URL('../../sw.js', import.meta.url)).catch(() => {});
