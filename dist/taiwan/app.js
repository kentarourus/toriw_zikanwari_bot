const defaults={carry:['パスポート','スマートフォン・充電に必要なもの','しおり','現金・貴重品','常備薬','モバイルバッテリー（手元に保管）'],luggage:['衣類・寝間着','洗面用具・歯ブラシ','衛生用品','帽子・雨具','充電器']};
const storageKey='taiwan-packing-items-2026-v2',status=document.getElementById('packing-status'),editButton=document.getElementById('edit-packing');
let legacy={};try{legacy=JSON.parse(localStorage.getItem('taiwan-packing-2026')||'{}')||{}}catch{}
let items=Object.fromEntries(Object.entries(defaults).map(([group,list])=>[group,list.map((text,i)=>({id:group+'-'+i,text,checked:legacy[group+'-'+i]===true}))]));
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Object.keys(defaults).every(g=>Array.isArray(saved[g])&&saved[g].every(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.checked==='boolean')))items=saved}catch{}
let editing=false;
function save(){try{localStorage.setItem(storageKey,JSON.stringify(items));status.textContent='';}catch{status.textContent='この端末には保存できませんでした。';}}
function render(){for(const group of Object.keys(defaults)){
 const root=document.getElementById(group);root.replaceChildren();
 for(const item of items[group]){
  const row=document.createElement('div');row.className='packing-item';
  if(editing){const name=document.createElement('input');name.type='text';name.className='packing-name';name.value=item.text;name.maxLength=80;name.setAttribute('aria-label',`${item.text}の名前`);name.addEventListener('change',()=>{const text=name.value.trim();if(text){item.text=text;save();}else name.value=item.text;});const remove=document.createElement('button');remove.type='button';remove.className='packing-remove';remove.textContent='削除';remove.setAttribute('aria-label',`${item.text}を削除`);remove.addEventListener('click',()=>{items[group]=items[group].filter(x=>x.id!==item.id);save();render();});row.append(name,remove);
  }else{const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.checked=item.checked;text.textContent=item.text;check.addEventListener('change',()=>{item.checked=check.checked;save();});label.append(check,text);row.append(label);}root.append(row);
 }
 if(editing){const form=document.createElement('form');form.className='packing-add';const input=document.createElement('input');input.type='text';input.maxLength=80;input.required=true;input.placeholder='追加する持ち物';input.setAttribute('aria-label',group==='carry'?'機内に持ち込む持ち物を追加':'スーツケースの持ち物を追加');const add=document.createElement('button');add.type='submit';add.textContent='追加';form.append(input,add);form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text)return;items[group].push({id:group+'-'+Date.now()+'-'+Math.random().toString(36).slice(2),text,checked:false});save();render();document.querySelector(`#${group} .packing-add input`)?.focus();});root.append(form);}
}}
editButton.addEventListener('click',()=>{editing=!editing;editButton.textContent=editing?'編集を終える':'持ち物を編集';editButton.setAttribute('aria-pressed',String(editing));render();});render();
