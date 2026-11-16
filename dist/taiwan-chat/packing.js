import {readPacking,addPackingItems} from '../taiwan/packing-data.js';
export {addPackingItems};
export function packingSnapshot(storage,maxChars=950){
 const data=readPacking(storage),rows=Object.entries(data).flatMap(([group,items])=>items.map(item=>({...item,group}))).sort((a,b)=>Number(a.checked)-Number(b.checked));
 const checked=rows.filter(x=>x.checked).length;const head=`自分の持ち物チェック（添付時点、全${rows.length}件・済${checked}件・未${rows.length-checked}件）。これは利用者のリストであり学校の必須項目ではありません。\n`;
 let content=head,count=0;for(const row of rows){const line=`${row.checked?'済':'未'}｜${row.group==='carry'?'機内':'荷物'}｜${row.text.replace(/[\r\n]/g,' ')}\n`;if(content.length+line.length>maxChars-45)break;content+=line;count++;}
 if(count<rows.length)content+=`ほか${rows.length-count}件は省略（未チェックを優先）。\n`;
 return {content,total:rows.length,checked,unchecked:rows.length-checked,included:count};
}
export function packingProposals(content){
 const pattern=/```packing-suggestions\s*\n([\s\S]*?)\n```/g;let suggestions=[];
 const text=content.replace(pattern,(block,json)=>{try{const rows=JSON.parse(json);if(!Array.isArray(rows)||rows.length>20||rows.some(x=>!x||!['carry','luggage'].includes(x.group)||typeof x.text!=='string'||!x.text.trim()||x.text.length>80))return block;suggestions.push(...rows.map(x=>({group:x.group,text:x.text.trim()})));return '';}catch{return block;}});
 return {text,suggestions:suggestions.slice(0,20)};
}
