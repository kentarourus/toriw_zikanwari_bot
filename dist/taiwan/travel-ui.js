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
