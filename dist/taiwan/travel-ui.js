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
const toolDialog = document.getElementById('travel-tools');

if (toolFolder && typeof toolDialog?.showModal === 'function') {
  toolFolder.hidden = false;
  toolFolder.addEventListener('click', () => toolDialog.showModal());
  toolDialog.addEventListener('click', event => {
    if (event.target.closest('a')) {
      toolDialog.close();
      return;
    }
    if (event.target !== toolDialog) return;
    const bounds = toolDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      toolDialog.close();
    }
  });
}
