import {defaults} from './packing-data.js';
const storageKey='taiwan-packing-items-2026-v2',status=document.getElementById('packing-status'),editButton=document.getElementById('edit-packing');
let legacy={};try{legacy=JSON.parse(localStorage.getItem('taiwan-packing-2026')||'{}')||{}}catch{}
function initialItems(previousChecks={}){
 return Object.fromEntries(Object.entries(defaults).map(([group,list])=>[group,list.map((text,i)=>({id:group+'-'+i,text,checked:previousChecks[group+'-'+i]===true}))]));
}
let items=initialItems(legacy);
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Object.keys(defaults).every(g=>Array.isArray(saved[g])&&saved[g].every(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.checked==='boolean')))items=saved}catch{}
function restoreDefaults(){let added=0;for(const [group,list] of Object.entries(defaults)){for(const [i,text] of list.entries()){if(items[group].some(item=>item.text===text))continue;const originalId=group+'-'+i;items[group].push({id:items[group].some(item=>item.id===originalId)?group+'-restored-'+i:originalId,text,checked:legacy[originalId]===true});added++;}}return added;}
// Restore any missing original entries once, while preserving edits and checks.
try{if(localStorage.getItem('taiwan-packing-defaults-restored-v1')!=='yes'){restoreDefaults();localStorage.setItem(storageKey,JSON.stringify(items));localStorage.setItem('taiwan-packing-defaults-restored-v1','yes');}}catch{}
let editing=false;
function updateProgress(){
 const entries=Object.values(items).flat();
 const checked=entries.filter(item=>item.checked).length;
 const summary=`${checked} / ${entries.length} 件チェック済み`;
 const bar=document.getElementById('packing-progress');
 const label=document.getElementById('packing-progress-label');
 if(bar&&label){
  bar.max=Math.max(1,entries.length);
  bar.value=checked;
  label.textContent=summary;
  bar.parentElement.hidden=false;
 }
}
function save(){updateProgress();try{localStorage.setItem(storageKey,JSON.stringify(items));status.textContent='';}catch{status.textContent='この端末には保存できませんでした。';}}
function render(){updateProgress();for(const group of Object.keys(defaults)){
 const root=document.getElementById(group);root.replaceChildren();
 for(const item of items[group]){
  const row=document.createElement('div');row.className='packing-item';
  if(editing){const name=document.createElement('input');name.type='text';name.className='packing-name';name.value=item.text;name.maxLength=80;name.setAttribute('aria-label',`${item.text}の名前`);name.addEventListener('change',()=>{const text=name.value.trim();if(text){item.text=text;save();}else name.value=item.text;});const remove=document.createElement('button');remove.type='button';remove.className='packing-remove';remove.textContent='削除';remove.setAttribute('aria-label',`${item.text}を削除`);remove.addEventListener('click',()=>{items[group]=items[group].filter(x=>x.id!==item.id);save();render();});row.append(name,remove);
  }else{const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.checked=item.checked;text.textContent=item.text;check.addEventListener('change',()=>{item.checked=check.checked;save();});label.append(check,text);row.append(label);}root.append(row);
 }
 if(editing){const form=document.createElement('form');form.className='packing-add';const input=document.createElement('input');input.type='text';input.maxLength=80;input.required=true;input.placeholder='追加する持ち物';input.setAttribute('aria-label',group==='carry'?'手荷物に追加':'預入荷物に追加');const add=document.createElement('button');add.type='submit';add.textContent='追加';form.append(input,add);form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text)return;items[group].push({id:group+'-'+Date.now()+'-'+Math.random().toString(36).slice(2),text,checked:false});save();render();document.querySelector(`#${group} .packing-add input`)?.focus();});root.append(form);}
}}
const csvControls=document.getElementById('packing-csv-controls'),fileInput=document.getElementById('packing-file');
editButton.addEventListener('click',()=>{editing=!editing;csvControls.hidden=!editing;editButton.textContent=editing?'編集を終える':'持ち物を編集';editButton.setAttribute('aria-pressed',String(editing));render();});render();

document.getElementById('packing-export').addEventListener('click',async()=>{try{const {exportCsv}=await import('./packing-csv.js?v=2');const blob=new Blob([exportCsv(items)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='台湾研修旅行-持ち物.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{status.textContent='CSVを書き出せませんでした。通信を確認して再度お試しください。';}});
document.getElementById('packing-import').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('ファイルが大きすぎます（1MBまで）。');const {importCsv}=await import('./packing-csv.js?v=2');const text=typeof file.text==='function'?await file.text():await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('ファイルを読み取れませんでした。'));reader.readAsText(file,'UTF-8');});const rows=importCsv(text);for(const row of rows){const existing=items[row.group].find(item=>item.text===row.text);if(existing)existing.checked=row.checked;else items[row.group].push({id:row.group+'-'+Date.now()+'-'+Math.random().toString(36).slice(2),text:row.text,checked:row.checked});}save();render();if(!status.textContent)status.textContent=`${rows.length}件を読み込みました。`;}catch(error){status.textContent=`読み込めませんでした：${error.message}`;}finally{fileInput.value='';}});

globalThis.addEventListener?.('storage',event=>{if(event.key!==storageKey)return;try{const data=JSON.parse(event.newValue||'null');if(data&&Object.keys(defaults).every(g=>Array.isArray(data[g])&&data[g].every(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.checked==='boolean'))){items=data;render();status.textContent='別の画面で変更された持ち物を反映しました。';}}catch{}});
