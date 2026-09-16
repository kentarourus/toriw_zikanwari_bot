if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url));
  });
}

const standalone=window.matchMedia('(display-mode: standalone)');
let installEvent;
const guide=document.createElement('details');
guide.className='install-guide';
guide.innerHTML='<summary>ホーム画面に追加</summary><p>2–3のテスト版をアプリとして開けます。</p><button type="button" hidden>アプリを追加する</button><div class="install-steps"><p><strong>iPhone・iPad（Safari）</strong><br>共有ボタン →「ホーム画面に追加」→「追加」</p><p><strong>Android（Chrome）</strong><br>右上のメニュー →「ホーム画面に追加」または「アプリをインストール」</p><p><strong>パソコン（Chrome・Edge）</strong><br>アドレスバーのインストールボタン、またはブラウザのメニューから追加できます。</p></div><p class="install-note">項目が見つからない場合は、SafariやChromeでこのページを開いてください。</p>';
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
    link.addEventListener('click',event=>{
      if(!event.isTrusted||typeof navigator.vibrate!=='function')return;
      try{navigator.vibrate(12);}catch{/* Haptics must not interrupt navigation. */}
    });
    const label=document.createElement('span');label.textContent=link.textContent;
    link.replaceChildren(label);
    if(navIcons[link.hash])link.insertAdjacentHTML('afterbegin',`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${navIcons[link.hash]}</svg>`);
  }
  const sections=links.map(link=>document.querySelector(link.hash)).filter(Boolean);
  function updateNav(){
    let current=sections[0];
    for(const section of sections){if(section.getBoundingClientRect().top<=window.innerHeight*0.45)current=section;}
    for(const link of links){if(link.hash==='#'+current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  }
  window.addEventListener('scroll',updateNav,{passive:true});updateNav();
}
