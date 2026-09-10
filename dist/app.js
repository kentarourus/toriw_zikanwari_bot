const SHEET_ID='1ING0f5O2q2ijcmGuUUL-gZP33CKKEUtc1NH2-kuYu-k';
const $=id=>document.getElementById(id);
let data=null,selectedKey=null,loading=false;
const cell=(rows,r,c)=>String(rows[r]?.[c]??'').trim();
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
export function parseDays(rows){const out=[];let month='';for(let c=3;c<(rows[2]?.length??0);c++){const raw=cell(rows,2,c),match=raw.match(/(?:(\d+)月)?(\d+)日/);if(!match)continue;if(match[1])month=match[1];const day=match[2],date=`${month?month+'月':''}${day}日`;out.push({key:date,date,day,weekday:cell(rows,4,c),week:cell(rows,3,c),lessons:Array.from({length:8},(_,i)=>({period:i+1,subject:cell(rows,5+i,c)}))});}return out;}
function render(){const days=parseDays(data.sheets['時間割']);$('days').replaceChildren();if(!days.length){$('lessons').replaceChildren(el('li','時間割の日付を読み取れませんでした。元のシートをご確認ください。','empty'));return;}
if(!days.some(d=>d.key===selectedKey)){const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).formatToParts(new Date());const today=`${parts.find(p=>p.type==='month').value}月${parts.find(p=>p.type==='day').value}日`;selectedKey=(days.find(d=>d.date===today)||days[0]).key;}
for(const d of days){const b=el('button');b.type='button';b.setAttribute('aria-label',`${d.date}（${d.weekday}）`);b.setAttribute('aria-pressed',String(d.key===selectedKey));b.append(el('strong',d.day),el('span',d.weekday+'曜日'));b.onclick=()=>{selectedKey=d.key;render();};$('days').append(b);}
const chosen=days.find(d=>d.key===selectedKey);$('week').textContent=chosen.week;$('selected-date').textContent=`${chosen.date}（${chosen.weekday}）`;
const count=chosen.lessons.filter(l=>l.subject).length;$('count').textContent=count?`${count}コマ`:'';$('lessons').replaceChildren();
if(!count)$('lessons').append(el('li','この日の授業はシートに登録されていません。','empty'));
else{const last=chosen.lessons.findLastIndex(l=>l.subject);for(const l of chosen.lessons.slice(0,last+1)){const item=el('li',undefined,l.subject?'':'blank');item.append(el('span',`${l.period}限`,'period'),el('span',l.subject||'未登録','subject'));$('lessons').append(item);}}
renderNotices(data.sheets['連絡']??[]);}
function renderNotices(rows){$('notice-date').textContent=cell(rows,0,1)?`${cell(rows,0,1)} の連絡`: '連絡の日付は未記入';const root=$('notice-content');root.replaceChildren();
const add=(title,texts)=>{const entries=texts.filter(Boolean);if(!entries.length)return;const block=el('section',undefined,'notice-block');block.append(el('h3',title));for(const t of entries)block.append(el('p',t));root.append(block);};
add('本日の予定',[cell(rows,3,2)]);
add('クラスの連絡',rows.slice(3).map(r=>String(r[11]??'').trim()).filter(v=>v&&!/^[\s・提出物入力行事等]+$/.test(v)));
add('学年の連絡',rows.slice(3).map(r=>[r[5],r[6]].filter(Boolean).join('　')));
add('学校からのお知らせ',rows.slice(4).map(r=>r[2]?[r[2],r[3]?`（${r[3]}）`:''].join(''):''));
if(!root.children.length)root.append(el('p','連絡事項はありません。'));}
let sequence=0;
function loadSheet(name){return new Promise((resolve,reject)=>{const callback=`sheetCallback${++sequence}`,script=document.createElement('script');const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};const timer=setTimeout(()=>{cleanup();reject(new Error('timeout'));},15000);window[callback]=result=>{cleanup();if(result.status!=='ok'||!result.table)return reject(new Error('sheet unavailable'));resolve(result.table.rows.map(r=>r.c.map(v=>v?.f??v?.v??'')));};script.onerror=()=>{cleanup();reject(new Error('network'));};const url=new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);url.search=new URLSearchParams({sheet:name,headers:'0',tqx:`out:json;responseHandler:${callback}`,tq:'select *',_:`${Date.now()}`});script.src=url.href;document.head.append(script);});}
async function refresh(){if(loading)return;loading=true;$('refresh').disabled=true;$('sync').textContent='最新のシートを確認しています…';$('sync').classList.remove('error');try{const [t,n]=await Promise.all([loadSheet('時間割'),loadSheet('連絡')]);if(!parseDays(t).length)throw new Error('layout changed');data={sheets:{'時間割':t,'連絡':n},capturedAt:new Date().toISOString()};render();$('sync').textContent=`最終取得 ${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date())} · シートから取得`;}catch{$('sync').classList.add('error');$('sync').textContent=data?`最新データを取得できません。${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short'}).format(new Date(data.capturedAt))} 取得の内容を表示しています。元のシートもご確認ください。`:'読み込みに失敗しました。「更新」で再試行するか、元のシートをご確認ください。';}finally{loading=false;$('refresh').disabled=false;}}
async function start(){try{const r=await fetch('./snapshot.json');if(!r.ok)throw new Error('snapshot');data=await r.json();render();}catch{}await refresh();}
if(typeof document!=='undefined'){$('refresh').onclick=refresh;start();}
