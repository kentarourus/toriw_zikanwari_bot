import {initCurrencyTool} from './currency.js?v=3';

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
const externalToolLink = document.getElementById('travel-tool-external');
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
const tools = [...document.querySelectorAll('.bottom-tools .tool-icons > *')];
const requestedTool = new URLSearchParams(location.search).get('tool');
const appTrigger = tools.find(trigger => toolKey(trigger) === requestedTool);
let directApp = Boolean(appTrigger);
let restoreSection;
let returnFocus;
let animation;

function getPanel(key, title, fallback) {
  if (mounted.has(key)) return mounted.get(key);
  const panel = document.createElement('div');
  if (key === 'currency') {
    panel.className = 'currency-panel';
    panel.append(document.getElementById('currency-tool').content.cloneNode(true));
    panel.refresh = initCurrencyTool(panel);
  } else {
    const frame = document.createElement('iframe');
    frame.title = title;
    const offline = document.createElement('div');
    offline.className = 'tool-offline-content';
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
      frame.hidden = !online;
      offline.hidden = online;
      externalToolLink.href = fallback;
      externalToolLink.textContent = key === 'map' ? '地図で開く ↗' : '別タブで開く ↗';
      externalToolLink.hidden = !online;
    };
    panel.className = 'tool-embed';
    panel.append(frame, offline);
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

function resetTool() {
  toolDialog.classList.remove('translation-tool');
  finishLaunch();
  restoreSection?.();
  restoreSection = undefined;
}

function toolKey(trigger) {
  const href = trigger.getAttribute('href');
  return trigger.dataset.openTool || (sections[href] ? href.slice(1) : href?.startsWith('https:') ? 'map' : 'chat');
}

function openTool(trigger, direct = false) {
  if (toolDialog.open) return;
  resetTool();
  const href = trigger.getAttribute('href');
  const section = sections[href];
  const key = toolKey(trigger);
  const title = trigger.lastElementChild.textContent;
  const origin = trigger.querySelector('.tool-icon').getBoundingClientRect();
  returnFocus = folderDialog.open ? toolFolder : trigger;
  if (folderDialog.open) folderDialog.close();
  externalToolLink.hidden = true;
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
  } else if (key === 'translate' || key === 'sounds') {
    const frame = document.createElement('iframe');
    frame.src = `${href}#embedded`;
    frame.title = title;
    frame.className = 'local-tool-frame';
    if (key === 'translate') frame.allow = "microphone 'self'; fullscreen 'self'";
    toolContent.append(frame);
    restoreSection = () => frame.remove();
  } else {
    const panel = getPanel(key, title, href);
    panel.hidden = false;
    panel.refresh?.();
  }
  toolDialog.showModal();
  toolContent.scrollTop = 0;
  if (!direct) animateLaunch(trigger, origin);
}

if (typeof toolDialog.showModal === 'function') {
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !toolDialog.open) return;
    const frame = toolContent.querySelector('.local-tool-frame[src="translate/#embedded"]');
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data === 'taiwan-translate:ready') toolDialog.classList.add('translation-tool');
    if (event.data === 'taiwan-translate:close') toolDialog.close();
  });
  toolFolder.hidden = false;
  toolFolder.addEventListener('click', () => folderDialog.showModal());
  for (const trigger of document.querySelectorAll('.tool-icons a, .tool-icons button')) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openTool(trigger);
    });
  }
  folderDialog.addEventListener('click', event => {
    if (event.target !== folderDialog) return;
    const bounds = folderDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) folderDialog.close();
  });
  toolDialog.addEventListener('close', () => {
    if (toolDialog.open) return;
    resetTool();
    returnFocus?.focus({preventScroll: true});
    returnFocus = undefined;
    if (directApp) {
      directApp = false;
      document.getElementById('install-travel-app').hidden = true;
      document.querySelectorAll('[data-travel-app-link]').forEach(link => link.remove());
      document.title = '台湾研修旅行 2026';
      const url = new URL(location.href);
      url.searchParams.delete('tool');
      history.replaceState(history.state, '', url);
    }
  });

  const installList = document.getElementById('install-travel-apps');
  for (const trigger of tools) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `?tool=${toolKey(trigger)}`;
    link.textContent = trigger.lastElementChild.textContent;
    if (self !== top) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    item.append(link);
    installList.querySelector('ul').append(item);
  }
  installList.hidden = false;
  if (appTrigger) {
    document.title = appTrigger.lastElementChild.textContent;
    if (self === top) {
      for (const [rel, href] of [
        ['manifest', `apps/${requestedTool}.webmanifest`],
        ['apple-touch-icon', `apps/${requestedTool}-192.png`],
        ['icon', `apps/${requestedTool}-192.png`],
      ]) {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        link.dataset.travelAppLink = '';
        document.head.append(link);
      }
      const button = document.getElementById('install-travel-app');
      const standalone = matchMedia('(display-mode: standalone)');
      const update = () => { button.hidden = !directApp || !installPrompt || standalone.matches || navigator.standalone === true; };
      let installPrompt;
      addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        update();
      });
      addEventListener('appinstalled', () => {
        installPrompt = undefined;
        update();
      });
      standalone.addEventListener('change', update);
      button.addEventListener('click', async () => {
        const event = installPrompt;
        installPrompt = undefined;
        update();
        await event?.prompt();
      });
    }
    openTool(appTrigger, true);
  }
}
