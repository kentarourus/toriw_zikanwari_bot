const dialog = document.getElementById('arrival-card-reminder');
const doneKey = 'taiwan-arrival-card-submitted-2026';
const expiresAt = Date.parse('2026-11-29T00:00:00+09:00');
let confirmed = false;

try {
  confirmed = localStorage.getItem(doneKey) === 'true';
} catch {}

function openReminder() {
  if (!confirmed && Date.now() < expiresAt && !dialog.open) dialog.showModal();
}

function expireReminder() {
  if (Date.now() >= expiresAt && dialog.open) dialog.close();
}

if (typeof dialog.showModal === 'function' && Date.now() < expiresAt && !confirmed) {
  document.getElementById('arrival-card-confirm').addEventListener('click', () => {
    confirmed = true;
    try { localStorage.setItem(doneKey, 'true'); } catch {}
    dialog.close();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) openReminder();
  });
  document.addEventListener('visibilitychange', expireReminder);
  setTimeout(expireReminder, expiresAt - Date.now());
  openReminder();
}
