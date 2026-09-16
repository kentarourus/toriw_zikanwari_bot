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
  const sections=links.map(link=>document.querySelector(link.hash)).filter(Boolean);
  function updateNav(){
    let current=sections[0];
    for(const section of sections){if(section.getBoundingClientRect().top<=window.innerHeight*0.45)current=section;}
    for(const link of links){if(link.hash==='#'+current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  }
  window.addEventListener('scroll',updateNav,{passive:true});updateNav();
}
