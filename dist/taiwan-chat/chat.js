import {createSmoothText} from './smooth-text.js?v=1';
import {packingSnapshot,packingProposals,addPackingItems} from './packing.js';
import {locationAttachment} from './location.js';
import {renderMarkdown} from './markdown.js?v=math-1';
import {storageKey,readStore,contextFor,createChat} from './chat-store.js';
import {normaliseUsage,sumUsage} from './usage.js?v=copilot-1';
import {labels,stageFor} from './progress.js?v=copilot-1';
const $=id=>document.getElementById(id);let endpoint='https://taiwan-private-cli-bridge.ai-news-webhook-relay.workers.dev/chat',busy=false;
try{const initial=new URLSearchParams(location.hash.slice(1)).get('bridge');const saved=initial||localStorage.getItem('taiwan-cli-endpoint')||sessionStorage.getItem('taiwan-cli-endpoint');if(saved){const url=new URL(saved);if(url.protocol==='https:'&&url.hostname.endsWith('.workers.dev')){endpoint=url.href.replace(/\/$/,'');try{localStorage.setItem('taiwan-cli-endpoint',endpoint)}catch{}}}if(initial)window.history.replaceState(null,'',location.pathname);}catch{}
let storage;try{storage=window.localStorage}catch{}
let store=readStore(storage);if(!store.chats.length){const chat=createChat();store.chats.push(chat);store.active=chat.id;}
const active=()=>store.chats.find(c=>c.id===store.active);
let followLatest=true;
function scrollToLatest(force=false){requestAnimationFrame(()=>{if(force||followLatest){$('scroll-area').scrollTop=$('scroll-area').scrollHeight;$('jump-latest').hidden=true;}});}
$('scroll-area').addEventListener('scroll',()=>{const area=$('scroll-area');followLatest=area.scrollHeight-area.scrollTop-area.clientHeight<100;$('jump-latest').hidden=followLatest;});
$('jump-latest').onclick=()=>{followLatest=true;scrollToLatest(true);};
let attachedPacking=null;
function clearPacking(){attachedPacking=null;$('packing-preview').hidden=true;}
$('share-packing').onclick=()=>{attachmentMenu(false);try{attachedPacking=packingSnapshot(localStorage);$('packing-preview-label').textContent=`持ち物チェック ${attachedPacking.total}件（済 ${attachedPacking.checked} / 未 ${attachedPacking.unchecked}）`;$('packing-preview-text').textContent=attachedPacking.content;$('packing-preview').hidden=false;$('status').textContent='送信時に持ち物チェックを共有します。';}catch{$('status').textContent='持ち物チェックを読み込めませんでした。';}};
$('remove-packing').onclick=clearPacking;
function proposalCard(suggestions){const card=document.createElement('section');card.className='packing-proposals';const title=document.createElement('strong');title.textContent='持ち物に追加する候補';const help=document.createElement('p');help.className='proposal-help';help.textContent='選んだ項目だけをリストに追加します。';card.append(title,help);const choices=[];for(const item of suggestions){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.checked=true;const name=document.createElement('span'),category=document.createElement('small');name.textContent=item.text;category.textContent=item.group==='carry'?'機内持ち込み':'スーツケース';text.append(name,category);label.append(check,text);card.append(label);choices.push({check,item});}const button=document.createElement('button'),notice=document.createElement('p');button.type='button';button.textContent='選んだ持ち物を追加';notice.setAttribute('role','status');button.onclick=()=>{const selected=choices.filter(c=>c.check.checked).map(c=>c.item);if(!selected.length){notice.textContent='追加する項目を選んでください。';return;}try{const result=addPackingItems(localStorage,selected);notice.textContent=`${result.added}件を追加しました。`+(result.skipped?`重複${result.skipped}件は追加していません。`:'');button.disabled=true;}catch{notice.textContent='保存できませんでした。もう一度お試しください。';}};card.append(button,notice);return card;}
let attachedLocation=null,locationTicket=0,locating=false;
function attachmentMenu(open){$('attach-menu').hidden=!open;$('add-attachment').setAttribute('aria-expanded',String(open));}
function clearLocation(){locationTicket++;attachedLocation=null;locating=false;$('location-preview').hidden=true;$('add-attachment').disabled=busy;}
function resizeInput(){const input=$('question');input.style.height='44px';input.style.height=Math.min(180,Math.max(44,input.scrollHeight))+'px';}
$('add-attachment').onclick=()=>attachmentMenu($('attach-menu').hidden);
$('remove-location').onclick=()=>clearLocation();
$('share-location').onclick=()=>{
 attachmentMenu(false);if(!globalThis.navigator?.geolocation){$('status').textContent='このブラウザーでは位置情報を取得できません。';return;}
 const ticket=++locationTicket,chatId=store.active;locating=true;$('add-attachment').disabled=true;$('status').textContent='現在地を取得しています…';
 navigator.geolocation.getCurrentPosition(position=>{if(ticket!==locationTicket||chatId!==store.active)return;locating=false;$('add-attachment').disabled=busy;try{attachedLocation=locationAttachment(position);$('location-map').textContent=attachedLocation.label;$('location-map').href=attachedLocation.url;$('location-preview').hidden=false;$('status').textContent='現在地を添付しました。送信前に取り消せます。';}catch(error){$('status').textContent=error.message;}},error=>{if(ticket!==locationTicket)return;locating=false;$('add-attachment').disabled=busy;$('status').textContent=error.code===1?'位置情報が許可されませんでした。ブラウザーの設定から許可できます。':error.code===3?'現在地の取得が時間切れになりました。もう一度お試しください。':'現在地を取得できませんでした。';},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
};
$('question').addEventListener('input',resizeInput);
document.addEventListener('click',event=>{if(!$('attachment-tools').contains(event.target))attachmentMenu(false);});
function updateProgress(stage='queued'){$('progress').hidden=false;const label=labels[stage]||labels.preparing;if($('progress-label').textContent!==label)$('progress-label').textContent=label;}
function startProgress(){updateProgress('queued');}
function stopProgress(){$('progress').hidden=true;}
let storageError=false;function save(){try{localStorage.setItem(storageKey,JSON.stringify(store));storageError=false}catch{storageError=true;$('status').textContent='この端末に履歴を保存できません。画面を閉じると会話が失われる場合があります。';}}
const app=document.querySelector('.app');
const historyPanel=$('sidebar');
const historyToggle=$('open-menu');
const closeHistory=$('close-menu');
const historyViewport=matchMedia('(max-width:750px)');
try{app.classList.toggle('history-collapsed',localStorage.getItem('taiwan-chat-history-collapsed')==='true');}catch{}
function menu(open,explicit=false){
 const narrow=historyViewport.matches;
 const wasDrawerOpen=historyPanel.classList.contains('is-open');
 historyPanel.classList.toggle('is-open',narrow&&open);
 if(!narrow&&explicit){
  app.classList.toggle('history-collapsed',!open);
  try{localStorage.setItem('taiwan-chat-history-collapsed',String(!open));}catch{}
 }
 const expanded=narrow?open:!app.classList.contains('history-collapsed');
 historyPanel.inert=!expanded;
 historyToggle.setAttribute('aria-expanded',String(expanded));
 if(explicit&&open)closeHistory.focus();
 if(!expanded&&(explicit||wasDrawerOpen))historyToggle.focus();
}
historyViewport.addEventListener?.('change',()=>menu(false));
historyToggle.onclick=()=>menu(true,true);
closeHistory.onclick=()=>menu(false,true);
$('shade').onclick=()=>menu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu(false);attachmentMenu(false);}});
function renderUsage(chat){const sum=sumUsage(chat.messages);$('usage-total').hidden=!sum.count&&!sum.unknown;$('usage-detail').hidden=!sum.count;$('usage-summary').textContent=sum.count?'この会話：'+sum.total.toLocaleString('ja-JP')+' トークン':'過去の使用量：記録なし';$('usage-detail').textContent=`入力 ${sum.input.toLocaleString('ja-JP')} / 出力 ${sum.output.toLocaleString('ja-JP')}（キャッシュ報告値 ${sum.cached==null?'未取得':sum.cached.toLocaleString('ja-JP')}）`;$('usage-note').textContent=!sum.count?'過去の回答には使用量データが保存されていません。新しい回答から表示します。':`取得できた${sum.count}回答分の累計です。${sum.unknown?'過去の未取得分は含みません。':''}プランの残り利用枠や料金を示すものではありません。`;}
function renderList(){const holder=$('conversations');holder.replaceChildren();[...store.chats].sort((a,b)=>b.updatedAt-a.updatedAt).forEach(chat=>{const button=document.createElement('button');button.type='button';button.textContent=chat.title;button.title=chat.title;if(chat.id===store.active)button.setAttribute('aria-current','page');button.disabled=busy;button.onclick=()=>{clearLocation();clearPacking();followLatest=true;store.active=chat.id;save();render();menu(false);if(chat.pending?.id)resume(chat);};holder.append(button);});}
let defaultProvider='codex';
const modelSwitch=$('model-switch');
const modelPreferenceKey='taiwan-chat-use-hydrogen';
let hydrogenAvailable=false;
let useHydrogen=false;
try{useHydrogen=localStorage.getItem(modelPreferenceKey)==='true';}catch{}
function selectedProvider(){
 return hydrogenAvailable&&useHydrogen?'hydrogen':defaultProvider;
}
function updateProviderLabel(chat, provider){
 const lastAnswer=chat.messages.findLast(item=>item.role==='assistant');
 const selected=selectedProvider();
 const lastProvider=lastAnswer?.provider;
 const current=provider??chat.pending?.provider??(selected==='hydrogen'?'hydrogen':(lastProvider==='hydrogen'?selected:lastProvider??selected));
 $('provider-label').textContent=current==='hydrogen'?'Gemini 4 Hydrogen':current==='copilot'?'Copilot':'GPT-6 Luna';
 modelSwitch.hidden=!hydrogenAvailable;
 modelSwitch.disabled=busy;
 modelSwitch.setAttribute('aria-pressed',String(selected==='hydrogen'));
}
modelSwitch.onclick=()=>{
 if(busy||!hydrogenAvailable)return;
 useHydrogen=!useHydrogen;
 try{localStorage.setItem(modelPreferenceKey,String(useHydrogen));}catch{}
 updateProviderLabel(active(),selectedProvider());
};
function render(){const chat=active();updateProviderLabel(chat);document.title=chat.title+' · 丹陽さん';$('chat-title').textContent=chat.messages.length?chat.title:'丹陽さん';$('chat-title').title=chat.title;$('welcome').hidden=chat.messages.length>0;$('delete-chat').disabled=busy||!chat.messages.length;$('messages').replaceChildren();for(const item of chat.messages){const row=document.createElement('article');row.className='message '+item.role;const label=document.createElement('small');label.textContent=item.role==='user'?'あなた':'丹陽さん';const text=document.createElement('div');const proposal=item.role==='assistant'?packingProposals(item.content):{text:item.content,suggestions:[]};text.innerHTML=renderMarkdown(proposal.text);row.append(label,text);if(proposal.suggestions.length)row.append(proposalCard(proposal.suggestions));if(item.role==='assistant'){const usage=normaliseUsage(item.usage);const info=document.createElement('details');info.className='message-usage';info.hidden=!usage;const usageTitle=document.createElement('summary'),usageBody=document.createElement('p');usageTitle.textContent=usage?'使用量 '+(usage.input_tokens+usage.output_tokens).toLocaleString('ja-JP')+' トークン':'使用量';usageBody.textContent=usage?`入力 ${usage.input_tokens.toLocaleString('ja-JP')} / 出力 ${usage.output_tokens.toLocaleString('ja-JP')}${usage.cached_input_tokens!=null?' / キャッシュ報告値 '+usage.cached_input_tokens.toLocaleString('ja-JP'):''} トークン`:'';info.append(usageTitle,usageBody);row.append(info);}$('messages').append(row);}$('retry').hidden=!chat.error||busy;$('status').textContent=chat.error||(storageError?'この端末に履歴を保存できません。':!endpoint?'専用の起動リンクから開いてください。':'');renderUsage(chat);renderList();scrollToLatest();}
function setBusy(value){busy=value;$('add-attachment').disabled=value||locating;attachmentMenu(false);$('send').disabled=value;$('question').disabled=value;$('new-chat').disabled=value;$('delete-chat').disabled=value||!active().messages.length;$('retry').hidden=value||!active().error;renderList();}
async function api(path,options={}){const r=await fetch(endpoint+path,{...options,referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok||data.error)throw Error(data.error||'接続できませんでした。');return data;}
function showPartial(content){let row=document.getElementById('live-answer');if(!row){row=document.createElement('article');row.id='live-answer';row.className='message assistant';$('messages').append(row);}if(!row._streamBody){const label=document.createElement('small');label.textContent='丹陽さん';row._streamBody=document.createElement('div');row.append(label,row._streamBody);row.setAttribute('aria-busy','true');}let visible=packingProposals(content).text;const pendingFence=visible.indexOf('```packing-suggestions');if(pendingFence>=0)visible=visible.slice(0,pendingFence);row._streamBody.innerHTML=renderMarkdown(visible);scrollToLatest();}
const smoothText=createSmoothText({write:showPartial,reducedMotion:()=>Boolean(document.hidden)||matchMedia('(prefers-reduced-motion: reduce)').matches});
async function poll(chat){for(let attempt=0;attempt<720;attempt++){if(attempt)await new Promise(resolve=>setTimeout(resolve,chat.pending?.backend==='pc'?500:2500));const result=await api('/jobs/'+chat.pending.id);if(result.provider&&chat.pending.provider!==result.provider){smoothText.reset();document.getElementById('live-answer')?.remove();chat.pending.provider=result.provider;}updateProviderLabel(chat);if(result.status==='completed'){if(typeof result.answer!=='string'||!result.answer.trim())throw Error('回答を取得できませんでした。');await smoothText.finish(result.answer);chat.messages.push({role:'assistant',content:result.answer,usage:normaliseUsage(result.usage),provider:result.provider,model:result.model,requestId:chat.pending.id});chat.pending=null;chat.error='';chat.updatedAt=Date.now();save();render();$('status').textContent=storageError?'履歴を端末に保存できませんでした。':'';return}if(result.status==='failed'){chat.pending=null;throw Error(result.error||'実行に失敗しました。');}updateProgress(stageFor(result));if(result.partial)smoothText.update(result.partial);$('status').textContent='';}throw Error('まだ実行が終わっていません。「再試行」で回答の取得を再開できます。');}
async function resume(chat){
 if(busy||!endpoint)return;
 const selected=selectedProvider();
 setBusy(true);
 chat.error='';
 startProgress();
 updateProviderLabel(chat,chat.pending?.provider??selected);
 const progressStart=Date.now();
 try{
  if(!chat.pending?.id){
   $('status').textContent='';
   const payload={messages:contextFor(chat)};
   if(selected==='hydrogen'){
    if(!(await api('/provider-status')).hydrogenAvailable)throw Error('Hydrogenに接続できません。');
    payload.provider='hydrogen';
   }
   const {id,backend,provider}=await api('/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(selected==='hydrogen'&&provider!=='hydrogen')throw Error('Hydrogenに接続できませんでした。');
   chat.pending={id,backend,provider,startedAt:progressStart};
   updateProviderLabel(chat);
   save();
  }
  await poll(chat);
 }catch(error){chat.error=error.message;save();$('status').textContent=chat.error;}
 finally{smoothText.reset();stopProgress();setBusy(false);updateProviderLabel(chat);if(followLatest&&matchMedia('(pointer:fine)').matches)$('question').focus();}
}
$('new-chat').onclick=()=>{if(busy)return;clearLocation();clearPacking();followLatest=true;const current=active();if(!current.messages.length){menu(false);return;}const chat=createChat();store.chats.push(chat);store.active=chat.id;save();render();menu(false);$('question').focus();};
$('delete-chat').onclick=()=>{if(busy||!confirm('この端末から、この会話の履歴を削除しますか？'))return;clearLocation();clearPacking();followLatest=true;store.chats=store.chats.filter(c=>c.id!==store.active);if(!store.chats.length)store.chats.push(createChat());store.active=store.chats[0].id;save();render();};
$('retry').onclick=()=>resume(active());
$('chat-form').onsubmit=async event=>{event.preventDefault();if(busy)return;if(!endpoint){$('status').textContent='専用の起動リンクから開いてください。';return;}let text=$('question').value.trim();if(!text&&!attachedLocation&&!attachedPacking)return;if(attachedPacking)text=(text||'持ち物チェックを確認して、不足するものを提案してください。')+'\n\n'+attachedPacking.content;if(attachedLocation)text=(text||'この現在地を参考に案内してください。')+'\n\n'+attachedLocation.content;if(text.length>1500){$('status').textContent='添付情報を含めて1500文字以内になるよう、メッセージを短くしてください。';return;}const chat=active();if(chat.pending?.id){$('status').textContent='前の回答を「再試行」で取得してから送信してください。';return;}chat.error='';followLatest=true;chat.messages.push({role:'user',content:text});if(chat.messages.filter(m=>m.role==='user').length===1)chat.title=text.slice(0,32);chat.updatedAt=Date.now();save();clearLocation();clearPacking();$('question').value='';resizeInput();render();await resume(chat);};
for(const button of document.querySelectorAll('.suggestions button'))button.onclick=()=>{$('question').value=button.dataset.question||button.textContent;resizeInput();$('question').focus();};
$('question').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();$('chat-form').requestSubmit();}});
menu(false);render();if(active().pending?.id&&endpoint)resume(active());

api('/provider-status').then(result=>{defaultProvider=result.mode==='copilot-test'?'copilot':'codex';hydrogenAvailable=result.hydrogenAvailable===true;updateProviderLabel(active());}).catch(()=>{});
