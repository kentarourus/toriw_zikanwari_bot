import {noticeItems} from './notices.js';
import {legendFrom,labelsFor,applyColor,applyChangeColor} from './colors.js';
const page=typeof document==='undefined'?{}:document.body.dataset;
const SHEET_ID=page.sheetId??'1H4x9oAtptNot0MAiy-uahZb0Cp6czbAjat3g28bqP98';
const SNAPSHOT=page.snapshot??'data/2-3.json';
const $=id=>document.getElementById(id);
let data=null,selectedKey=null,loading=false;
const haptic=()=>{if(typeof navigator.vibrate!=='function')return;try{navigator.vibrate(12);}catch{/* Unsupported devices continue normally. */}};
const cell=(rows,r,c)=>String(rows[r]?.[c]??'').trim();
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
export function parseDays(rows){const out=[];let month='';for(let c=3;c<(rows[2]?.length??0);c++){const raw=cell(rows,2,c),match=raw.match(/(?:(\d+)月)?(\d+)日/);if(!match)continue;if(match[1])month=match[1];const day=match[2],date=`${month?month+'月':''}${day}日`;out.push({key:date,date,day,weekday:cell(rows,4,c),week:cell(rows,3,c),lessons:Array.from({length:8},(_,i)=>({period:i+1,subject:cell(rows,5+i,c)}))});}return out;}
function render(){const days=parseDays(data.sheets['時間割']);$('days').replaceChildren();if(!days.length){$('lessons').replaceChildren(el('li','時間割の日付を読み取れませんでした。元のシートをご確認ください。','empty'));return;}
const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).formatToParts(new Date());const today=`${parts.find(p=>p.type==='month').value}月${parts.find(p=>p.type==='day').value}日`;
if(!days.some(d=>d.key===selectedKey))selectedKey=(days.find(d=>d.date===today)||days[0]).key;
for(const d of days){const b=el('button');const isToday=d.date===today;b.type='button';b.classList.toggle('is-today',isToday);b.setAttribute('aria-label',`${d.date}（${d.weekday}）${isToday?'、今日':''}`);b.setAttribute('aria-pressed',String(d.key===selectedKey));if(d.key===selectedKey)b.setAttribute('aria-current','date');b.append(el('span',d.date.split('月')[0]+'月','day-month'),el('strong',d.day),el('span',isToday?'今日':d.weekday+'曜日','day-weekday'));b.onclick=event=>{if(event.isTrusted)haptic();selectedKey=d.key;render();};$('days').append(b);}
const chosen=days.find(d=>d.key===selectedKey);$('week').textContent=chosen.week;$('selected-date').textContent=`${chosen.date}（${chosen.weekday}）`;
const count=chosen.lessons.filter(l=>l.subject).length;$('count').textContent=count?`${count}コマ`:'';$('lessons').replaceChildren();
if(!count)$('lessons').append(el('li',/[土日]/.test(chosen.weekday)?'この日の授業はありません。':'この日の授業はシートに登録されていません。','empty'));
else{const last=chosen.lessons.findLastIndex(l=>l.subject);const columnIndex=days.indexOf(chosen)+3;const column=String.fromCharCode(65+columnIndex);const legend=legendFrom(data);for(const l of chosen.lessons.slice(0,last+1)){const item=el('li',undefined,l.subject?'':'blank');const style=data.formats?.['時間割']?.[`${column}${l.period+5}`];const subject=el('span',l.subject||'未登録','subject');applyChangeColor(subject,style,legend);const details=el('div',undefined,'lesson-detail');details.append(subject);for(const entry of labelsFor(style,legend)){const label=el('span',entry.label,'change-label');applyColor(label,entry);details.append(label);}item.append(el('span',`${l.period}限`,'period'),details);$('lessons').append(item);}}
renderNotices(data.sheets['連絡']??[]);renderRelatedLinks();}
function renderRelatedLinks(){const rows=data.sheets['連絡']??[],links=data.links?.['連絡']??{};const entries=[
 ['source-link',page.sheetUrl,'元のスプレッドシート'],
 ['lesson-change-link',links.D2,cell(rows,1,3)||'授業時間変更'],
 ['health-link',links.G2,cell(rows,1,6)||'健康観察フォーム'],
 ['feedback-link',links.B15,'電子版意見箱']
];let visible=0;for(const [id,href,label] of entries){const link=$(id);link.hidden=!href;if(href){link.href=href;link.firstElementChild.textContent=label;visible++;}}$('related-links').hidden=!visible;}
function renderNotices(rows){$('notice-date').textContent=cell(rows,0,1)?`${cell(rows,0,1)} の連絡`: '連絡の日付は未記入';const root=$('notice-content');root.replaceChildren();
const add=(title,texts)=>{const entries=texts.map(v=>String(v??'').trim()).filter(Boolean);const block=el('section',undefined,'notice-block');block.append(el('h3',title));if(entries.length){if(title==='本日の予定'){for(const t of entries)block.append(el('p',t));}else{const list=el('ul',undefined,'notice-items');for(const text of entries.flatMap(noticeItems)){const item=el('li');item.append(el('p',text));list.append(item);}block.append(list);}}else{const empty=el('p',' ','notice-empty');empty.setAttribute('aria-label','現在、連絡はありません');block.append(empty);}root.append(block);};
const sourceStatus=cell(rows,0,0);if(sourceStatus&&!/^\d+$/.test(sourceStatus))root.append(el('p',sourceStatus,'notice-status'));
add('本日の予定',[cell(rows,3,2)]);
add('クラスの連絡',rows.slice(3).map(r=>String(r[11]??'').trim()).filter(v=>v&&!/^[\s・提出物入力行事等]+$/.test(v)));
const grade=rows.slice(3).map(r=>String(r[5]??'').trim()).find(v=>/^\d+年生$/.test(v));
add(grade?`${grade}の連絡`:'学年の連絡',rows.slice(3).map(r=>String(r[6]??'').trim()));
add('学校からのお知らせ',rows.slice(4).map(r=>r[2]?[r[2],r[3]?`（${r[3]}）`:''].join(''):''));
}
async function refresh(){if(loading)return;loading=true;$('refresh').disabled=true;$('sync').textContent='最新の時間割を確認中…';$('sync').classList.remove('error','ready');try{const {readWorkbook}=await import('./workbook.js');const response=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&_=${Date.now()}`,{signal:AbortSignal.timeout(20000),credentials:'omit',cache:'no-store'});if(!response.ok)throw new Error('sheet unavailable');const next=readWorkbook(await response.arrayBuffer());if(!parseDays(next.sheets['時間割']).length)throw new Error('layout changed');next.capturedAt=new Date().toISOString();data=next;try{localStorage.setItem('timetable:'+SHEET_ID,JSON.stringify(next));}catch{}render();$('sync').classList.add('ready');$('sync').textContent=`${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date())} 更新済み`;$('sync').title='内容と色をGoogleスプレッドシートから取得しました';}catch{if(!data){try{const saved=localStorage.getItem('timetable:'+SHEET_ID);if(saved)data=JSON.parse(saved);}catch{}if(!data){try{const r=await fetch(SNAPSHOT,{cache:'no-store'});if(r.ok)data=await r.json();}catch{}}if(data)render();}$('sync').classList.add('error');$('sync').textContent=data?`最新データを取得できません。${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short'}).format(new Date(data.capturedAt))} 取得の内容を表示しています。元のシートもご確認ください。`:'読み込みに失敗しました。「更新」で再試行するか、元のシートをご確認ください。';}finally{loading=false;$('refresh').disabled=false;}}
async function start(){await refresh();}
if(typeof document!=='undefined'){$('refresh').onclick=refresh;$('source').href=page.sheetUrl;start();}
