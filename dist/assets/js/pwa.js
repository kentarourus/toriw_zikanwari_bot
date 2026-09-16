if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url));
  });
}

const standalone=window.matchMedia('(display-mode: standalone)');
let installEvent;
const guide=document.createElement('details');
guide.className='install-guide';
guide.innerHTML='<summary>ホーム画面に追加</summary><p>クラス一覧をアプリとして開けます。</p><button type="button" hidden>アプリを追加する</button><div class="install-steps"><p><strong>iPhone・iPad（Safari）</strong><br>共有ボタン →「ホーム画面に追加」→「追加」</p><p><strong>Android（Chrome）</strong><br>右上のメニュー →「ホーム画面に追加」または「アプリをインストール」</p><p><strong>パソコン（Chrome・Edge）</strong><br>アドレスバーのインストールボタン、またはブラウザのメニューから追加できます。</p></div><p class="install-note">項目が見つからない場合は、SafariやChromeでこのページを開いてください。</p>';
document.querySelector('main').append(guide);
const installButton=guide.querySelector('button');
function updateGuide(){guide.hidden=standalone.matches||navigator.standalone===true;}
updateGuide();standalone.addEventListener('change',updateGuide);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;installButton.hidden=false;});
installButton.addEventListener('click',async()=>{if(!installEvent)return;const prompt=installEvent;installEvent=null;installButton.hidden=true;await prompt.prompt();});
window.addEventListener('appinstalled',()=>{guide.hidden=true;installEvent=null;});

const nav=document.querySelector('.mobile-nav');
if(nav){
  const links=[...nav.querySelectorAll('a')];
  const navIcons={
    '#timetable':'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 10h18m-12 4h1m4 0h1m-6 4h1m4 0h1"/>',
    '#announcements':'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    '#related-links':'<path d="M10.4 13.6l3.2-3.2M8.6 15.4l-1.1 1.1a4 4 0 01-5.7-5.7l3-3a4 4 0 015.7 0M15.4 8.6l1.1-1.1a4 4 0 015.7 5.7l-3 3a4 4 0 01-5.7 0"/>'
  };
  for(const link of links){
    const label=document.createElement('span');label.textContent=link.textContent;
    link.replaceChildren(label);
    if(navIcons[link.hash])link.insertAdjacentHTML('afterbegin',`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${navIcons[link.hash]}</svg>`);
  }
  const sections=links.map(link=>document.querySelector(link.hash)).filter(Boolean);
  function setActiveIndex(index){
    links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    const link=links[index],navRect=nav.getBoundingClientRect(),linkRect=link.getBoundingClientRect();
    nav.style.setProperty('--slider-x',`${linkRect.left-navRect.left}px`);
    nav.style.setProperty('--slider-width',`${linkRect.width}px`);
  }
  function updateNav(){
    let current=sections[0];
    for(const section of sections){if(section.getBoundingClientRect().top<=window.innerHeight*0.45)current=section;}
    setActiveIndex(Math.max(0,links.findIndex(link=>link.hash==='#'+current.id)));
  }
  let startPoint=null,lastSwipeAt=0,lockUntil=0;
  links.forEach((link,index)=>link.addEventListener('click',()=>setActiveIndex(index)));
  nav.addEventListener('pointerdown',event=>{
    const currentIndex=Math.max(0,links.findIndex(link=>link.getAttribute('aria-current')==='location'));
    startPoint={x:event.clientX,y:event.clientY,index:currentIndex};
  },{passive:true});
  nav.addEventListener('pointermove',event=>{
    if(!startPoint)return;
    const dx=event.clientX-startPoint.x,dy=event.clientY-startPoint.y;
    if(Math.abs(dx)<=Math.abs(dy))return;
    const step=links[0].getBoundingClientRect().width+7;
    const min=-startPoint.index*step,max=(links.length-1-startPoint.index)*step;
    nav.classList.add('is-dragging');
    nav.style.setProperty('--drag-x',`${Math.max(min,Math.min(max,dx))}px`);
  },{passive:true});
  nav.addEventListener('pointerup',event=>{
    if(!startPoint)return;
    const {x,y,index}=startPoint;startPoint=null;
    const dx=event.clientX-x,dy=event.clientY-y;
    nav.classList.remove('is-dragging');nav.style.removeProperty('--drag-x');
    if(Math.abs(dx)<36||Math.abs(dx)<=Math.abs(dy)){setActiveIndex(index);return;}
    const step=links[0].getBoundingClientRect().width+7;
    const movedTabs=Math.round(dx/step)||Math.sign(dx);
    const nextIndex=Math.max(0,Math.min(links.length-1,index+movedTabs));
    if(nextIndex===index){setActiveIndex(index);return;}
    lastSwipeAt=Date.now();
    lockUntil=Date.now()+500;setActiveIndex(nextIndex);
    document.querySelector(links[nextIndex].hash)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    setTimeout(updateNav,520);
  },{passive:true});
  nav.addEventListener('pointercancel',()=>{if(startPoint)setActiveIndex(startPoint.index);startPoint=null;nav.classList.remove('is-dragging');nav.style.removeProperty('--drag-x');});
  nav.addEventListener('click',event=>{if(Date.now()-lastSwipeAt<450){event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('scroll',()=>{if(Date.now()>=lockUntil)updateNav();},{passive:true});
  window.addEventListener('resize',()=>setActiveIndex(Math.max(0,links.findIndex(link=>link.getAttribute('aria-current')==='location'))),{passive:true});
  updateNav();
}
