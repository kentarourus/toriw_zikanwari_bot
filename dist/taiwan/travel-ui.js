import {initCurrencyTool} from './currency.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
}

function openLinkedDay() {
  const hash = location.hash;
  if (!/^#day-[1-4]$/.test(hash)) return;
  const day = document.getElementById(hash.slice(1));
  if (!day) return;
  day.open = true;
  day.scrollIntoView({block: 'start'});
}

document.querySelector('.day-links')?.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link && link.hash === location.hash) openLinkedDay();
});
window.addEventListener('hashchange', openLinkedDay);
openLinkedDay();

const toolFolder = document.getElementById('open-travel-tools');
const folderDialog = document.getElementById('travel-tools');
const toolDialog = document.getElementById('travel-tool');
const toolContent = document.getElementById('travel-tool-content');
const launch = toolDialog.querySelector('.tool-launch');
const sections = {
  '#prepare': document.getElementById('prepare'),
  '#packing': document.getElementById('packing'),
  '#weather': document.getElementById('weather')
};
const embeds = {
  map: 'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sTaipei,+Taiwan',
  chat: '../taiwan-chat/'
};
const mounted = new Map();
let restoreSection;
let returnFocus;
let animation;

function getPanel(key, title, fallback) {
  if (mounted.has(key)) return mounted.get(key);
  const panel = document.createElement('div');
  if (key === 'currency') {
    panel.append(document.getElementById('currency-tool').content.cloneNode(true));
    panel.refresh = initCurrencyTool(panel);
  } else {
    const frame = document.createElement('iframe');
    frame.title = title;
    const link = document.createElement('a');
    link.href = fallback;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = key === 'map' ? 'Google マップで開く ↗' : '別のタブで開く ↗';
    const offline = document.createElement('div');
    if (key === 'map') {
      const image = document.createElement('img');
      image.src = 'guide-assets/mrt-map.png';
      image.alt = 'しおりに掲載されている台北MRT路線図';
      image.className = 'tool-offline-map';
      offline.append(image);
    } else {
      offline.textContent = '丹陽さんに質問するには通信が必要です。';
      const guide = document.createElement('a');
      guide.href = 'guide/';
      guide.textContent = '保存済みのしおりを読む';
      offline.append(document.createElement('br'), guide);
    }
    panel.refresh = () => {
      const online = navigator.onLine;
      if (online && !frame.hasAttribute('src')) frame.src = embeds[key];
      frame.hidden = link.hidden = !online;
      offline.hidden = online;
    };
    panel.className = 'tool-embed';
    panel.append(frame, offline, link);
  }
  mounted.set(key, panel);
  toolContent.append(panel);
  return panel;
}

function animateLaunch(trigger, origin) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const icon = trigger.querySelector('.tool-icon').cloneNode(true);
  launch.replaceChildren(icon);
  launch.hidden = false;
  toolDialog.classList.add('is-launching');
  toolContent.inert = true;
  const center = launch.getBoundingClientRect();
  const x = origin.left + (origin.width - center.width) / 2 - center.left;
  const y = origin.top + (origin.height - center.height) / 2 - center.top;
  animation = launch.animate([
    {transform: `translate(${x}px, ${y}px) scale(.72)`, opacity: 1},
    {transform: 'translate(0, 0) scale(1)', opacity: 1, offset: .57},
    {transform: 'translate(0, 0) scale(1)', opacity: 1, offset: .72},
    {transform: 'translate(0, 0) scale(1.15)', opacity: 0}
  ], {duration: 470, easing: 'ease-out'});
  animation.onfinish = finishLaunch;
}

function finishLaunch() {
  animation?.cancel();
  animation = undefined;
  launch.hidden = true;
  toolDialog.classList.remove('is-launching');
  toolContent.inert = false;
}

function openTool(trigger) {
  const href = trigger.getAttribute('href');
  const section = sections[href];
  const key = trigger.dataset.openTool || (href?.startsWith('https:') ? 'map' : 'chat');
  const title = trigger.lastElementChild.textContent;
  const origin = trigger.querySelector('.tool-icon').getBoundingClientRect();
  returnFocus = folderDialog.open ? toolFolder : trigger;
  if (folderDialog.open) folderDialog.close();
  document.getElementById('travel-tool-title').textContent =
    section?.querySelector('h2').textContent || (key === 'currency' ? '日本円・台湾ドル換算' : title);
  for (const panel of mounted.values()) panel.hidden = true;
  if (section) {
    const placeholder = document.createElement('div');
    placeholder.style.height = `${section.getBoundingClientRect().height}px`;
    placeholder.style.marginBlockEnd = getComputedStyle(section).marginBlockEnd;
    section.before(placeholder);
    toolContent.append(section);
    const heading = section.querySelector('h2');
    heading.classList.add('tool-section-heading');
    restoreSection = () => {
      heading.classList.remove('tool-section-heading');
      placeholder.replaceWith(section);
    };
  } else {
    const panel = getPanel(key, title, href);
    panel.hidden = false;
    panel.refresh?.();
  }
  toolDialog.showModal();
  toolContent.scrollTop = 0;
  animateLaunch(trigger, origin);
}

if (typeof toolDialog.showModal === 'function') {
  toolFolder.hidden = false;
  toolFolder.addEventListener('click', () => folderDialog.showModal());
  for (const trigger of document.querySelectorAll('.tool-icons a, .tool-icons button')) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openTool(trigger);
    });
  }
  for (const dialog of [folderDialog, toolDialog]) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  }
  toolDialog.addEventListener('close', () => {
    finishLaunch();
    restoreSection?.();
    restoreSection = undefined;
    returnFocus?.focus({preventScroll: true});
  });
}
