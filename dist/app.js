import {legendFrom,labelsFor,applyColor,applyChangeColor} from './colors.js';
const SHEET_ID='1H4x9oAtptNot0MAiy-uahZb0Cp6czbAjat3g28bqP98';
const $=id=>document.getElementById(id);
let data=null,selectedKey=null,loading=false;
const cell=(rows,r,c)=>String(rows[r]?.[c]??'').trim();
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
export function parseDays(rows){const out=[];let month='';for(let c=3;c<(rows[2]?.length??0);c++){const raw=cell(rows,2,c),match=raw.match(/(?:(\d+)月)?(\d+)日/);if(!match)continue;if(match[1])month=match[1];const day=match[2],date=`${month?month+'月':''}${day}日`;out.push({key:date,date,day,weekday:cell(rows,4,c),week:cell(rows,3,c),lessons:Array.from({length:8},(_,i)=>({period:i+1,subject:cell(rows,5+i,c)}))});}return out;}
function render(){const days=parseDays(data.sheets['時間割']);$('days').replaceChildren();if(!days.length){$('lessons').replaceChildren(el('li','時間割の日付を読み取れませんでした。元のシートをご確認ください。','empty'));return;}
if(!days.some(d=>d.key===selectedKey)){const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).formatToParts(new Date());const today=`${parts.find(p=>p.type==='month').value}月${parts.find(p=>p.type==='day').value}日`;selectedKey=(days.find(d=>d.date===today)||days[0]).key;}
for(const d of days){const b=el('button');b.type='button';b.setAttribute('aria-label',`${d.date}（${d.weekday}）`);b.setAttribute('aria-pressed',String(d.key===selectedKey));b.append(el('span',d.date.split('月')[0]+'月','day-month'),el('strong',d.day),el('span',d.weekday+'曜日','day-weekday'));b.onclick=()=>{selectedKey=d.key;render();};$('days').append(b);}
const chosen=days.find(d=>d.key===selectedKey);$('week').textContent=chosen.week;$('selected-date').textContent=`${chosen.date}（${chosen.weekday}）`;
const count=chosen.lessons.filter(l=>l.subject).length;$('count').textContent=count?`${count}コマ`:'';$('lessons').replaceChildren();
if(!count)$('lessons').append(el('li','この日の授業はシートに登録されていません。','empty'));
else{const last=chosen.lessons.findLastIndex(l=>l.subject);const columnIndex=days.indexOf(chosen)+3;const column=String.fromCharCode(65+columnIndex);const legend=legendFrom(data);for(const l of chosen.lessons.slice(0,last+1)){const item=el('li',undefined,l.subject?'':'blank');const style=data.formats?.['時間割']?.[`${column}${l.period+5}`];const subject=el('span',l.subject||'未登録','subject');applyChangeColor(subject,style,legend);const details=el('div',undefined,'lesson-detail');details.append(subject);for(const entry of labelsFor(style,legend)){const label=el('span',entry.label,'change-label');applyColor(label,entry);details.append(label);}item.append(el('span',`${l.period}限`,'period'),details);$('lessons').append(item);}}
renderNotices(data.sheets['連絡']??[]);renderRelatedLinks();}
function renderRelatedLinks(){const label=cell(data.sheets['連絡']??[],1,3)||'授業時間変更';const href=data.links?.['連絡']?.D2;if(href)$('lesson-change-link').href=href;$('lesson-change-label').textContent=label;}
function renderNotices(rows){$('notice-date').textContent=cell(rows,0,1)?`${cell(rows,0,1)} の連絡`: '連絡の日付は未記入';const root=$('notice-content');root.replaceChildren();
const add=(title,texts)=>{const entries=texts.map(v=>String(v??'').trim()).filter(Boolean);const block=el('section',undefined,'notice-block');block.append(el('h3',title));if(entries.length)for(const t of entries)block.append(el('p',t));else{const empty=el('p',' ','notice-empty');empty.setAttribute('aria-label','現在、連絡はありません');block.append(empty);}root.append(block);};
add('本日の予定',[cell(rows,3,2)]);
add('クラスの連絡',rows.slice(3).map(r=>String(r[11]??'').trim()).filter(v=>v&&!/^[\s・提出物入力行事等]+$/.test(v)));
const grade=rows.slice(3).map(r=>String(r[5]??'').trim()).find(v=>/^\d+年生$/.test(v));
add(grade?`${grade}の連絡`:'学年の連絡',rows.slice(3).map(r=>String(r[6]??'').trim()));
add('学校からのお知らせ',rows.slice(4).map(r=>r[2]?[r[2],r[3]?`（${r[3]}）`:''].join(''):''));
}
async function refresh(){if(loading)return;loading=true;$('refresh').disabled=true;$('sync').textContent='最新のシートと色の情報を確認しています…';$('sync').classList.remove('error');try{const {readWorkbook}=await import('./workbook.js');const response=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&_=${Date.now()}`,{signal:AbortSignal.timeout(20000),credentials:'omit'});if(!response.ok)throw new Error('sheet unavailable');const next=readWorkbook(await response.arrayBuffer());if(!parseDays(next.sheets['時間割']).length)throw new Error('layout changed');data=next;render();$('sync').textContent=`最終取得 ${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date())} · 内容・色をシートから取得`;}catch{$('sync').classList.add('error');$('sync').textContent=data?`最新データを取得できません。${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short'}).format(new Date(data.capturedAt))} 取得の内容を表示しています。元のシートもご確認ください。`:'読み込みに失敗しました。「更新」で再試行するか、元のシートをご確認ください。';}finally{loading=false;$('refresh').disabled=false;}}
async function start(){try{const r=await fetch('./snapshot.json');if(!r.ok)throw new Error('snapshot');data=await r.json();render();}catch{}await refresh();}
if(typeof document!=='undefined'){$('refresh').onclick=refresh;start();}
