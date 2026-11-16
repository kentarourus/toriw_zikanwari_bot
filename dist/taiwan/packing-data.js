export const packingKey='taiwan-packing-items-2026-v2';
export const defaults={carry:['パスポート','スマートフォン・充電に必要なもの','しおり','現金・貴重品','常備薬','モバイルバッテリー（手元に保管）'],luggage:['衣類・寝間着','洗面用具・歯ブラシ','衛生用品','帽子・雨具','充電器']};
export function readPacking(storage){
 let legacy={};try{legacy=JSON.parse(storage.getItem('taiwan-packing-2026')||'{}')||{};}catch{}
 try{const data=JSON.parse(storage.getItem(packingKey)||'null');if(data&&['carry','luggage'].every(g=>Array.isArray(data[g])&&data[g].every(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.checked==='boolean')))return data;}catch{}
 return Object.fromEntries(Object.entries(defaults).map(([g,list])=>[g,list.map((text,i)=>({id:g+'-'+i,text,checked:legacy[g+'-'+i]===true}))]));
}
export function addPackingItems(storage,proposals){
 const data=readPacking(storage),normal=text=>text.normalize('NFKC').trim().toLocaleLowerCase();let added=0,skipped=0;
 for(const item of proposals){if(!['carry','luggage'].includes(item.group)||typeof item.text!=='string'||!item.text.trim()||item.text.length>80)continue;const text=item.text.trim();if(Object.values(data).flat().some(x=>normal(x.text)===normal(text))){skipped++;continue;}data[item.group].push({id:item.group+'-'+crypto.randomUUID(),text,checked:false});added++;}
 storage.setItem(packingKey,JSON.stringify(data));return {added,skipped};
}
