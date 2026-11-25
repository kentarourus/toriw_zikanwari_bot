import {directionsSpec,mapDirections,mapSearchSpec,mapSearch} from './directions.mjs';
import fs from 'node:fs/promises';import {createInterface} from 'node:readline';
let source;try{source=await fs.readFile(new URL('./trip-guide.md',import.meta.url),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;source=await fs.readFile(new URL('../../dist/taiwan/guide.md',import.meta.url),'utf8');}
const pages=new Map([...source.matchAll(/<!-- source-page:(\d+) -->\s*([\s\S]*?)(?=<!-- source-page:|$)/g)].map(m=>[Number(m[1]),m[2].replace(/<a id="source-page-\d+"><\/a>\s*/g,'').replace(/\n---\s*$/,'').trim()]));
const pageSets={overview:[3],preface:[3],buses:[4],itinerary:[5,14,15,16,18,20,21,22,23,25,26],departure:[14],day1:[14,15,16],day2:[18],day3:[20,21,22,23],day4:[25,26],daily_routine:[16,18,20,23,25],meals:[5],packing:[6,7,8],preparation:[6,7,8],baggage:[7,8],clothing:[7,9],devices:[7,8,10,11],rules:[9,11,12,31],hotel:[3],hotel_rules:[11,12,31],health:[10,12],emergency:[21,28],shopping:[22,23],contacts:[28],language:[31,32],planning:[27],transport:[29],maps:[30],all:Array.from({length:34},(_,i)=>i+1)};
const topics=Object.keys(pageSets),base='https://kentarourus.github.io/toriw_zikanwari_bot/taiwan/guide/';
const guideDate='2026-11-13';
const pageLink=number=>base+'#source-page-'+number;
const linkImages=text=>text.replace(/!\[([^\]]+)\]\(guide-assets\/([^\)]+)\)/g,(_m,label,file)=>`[${label}（原本の図。本文中の文字情報からは未確認）](https://kentarourus.github.io/toriw_zikanwari_bot/taiwan/guide-assets/${file})`);
function between(text,start,end){const a=text.indexOf(start);if(a<0)return text;const b=end?text.indexOf(end,a+start.length):-1;return text.slice(a,b<0?undefined:b).trim();}
export function readGuide(topic){
 if(!Object.hasOwn(pageSets,topic))throw Error('Unknown guide topic');const numbers=pageSets[topic];let text=numbers.map(n=>pages.get(n)).join('\n\n');
 if(topic==='hotel')text=between(text,'#### （４）','#### （５）');
 if(topic==='overview')text=between(text,'### ２ 概要',null);
 if(topic==='preface')text=between(text,'### １ はじめに','### ２ 概要');
 // Keep source images as links: their contents are not guessed from filenames.
 text=linkImages(text);
 return {source:'しおり暫定版の詳細Markdown（個人情報のみ非掲載）。原本の記述を保持し、推測・創作しない。',asOf:'2026-11-13',url:base+'#source-page-'+numbers[0],originalUrl:'https://drive.google.com/file/d/12cX17qVX1fxJbOhnS4W9hcOlcfBWP1nx/view',sourcePages:numbers.map(n=>({pdf:n,printed:n===1?null:n-1,url:base+'#source-page-'+n})),sections:{[topic]:text},notice:'●・後日連絡は未確定の原文表記。記載同士が異なる場合は両方を伝え、勝手に調整しない。個人情報の非掲載箇所は原本で確認する。'};
}
export function readGuidePages(selected, question) {
 const numbers=new Set(selected.flatMap(topic=>pageSets[topic]??[]));
 const quotedPages=new Set();
 const quotedTerms=[...question.matchAll(/「([^」]{2,36})」|『([^』]{2,36})』/g)].slice(0,3);
 const normalise=text=>text.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
 for(const [,japanese,alternate] of quotedTerms){
  const term=normalise(japanese??alternate);
  if(term.length<2)continue;
  const matches=[...pages].filter(([,text])=>normalise(text).includes(term)).slice(0,4);
  for(const [number] of matches){numbers.add(number);quotedPages.add(number);}
 }
 if(!numbers.size)return null;
 const onlyHotel=selected.includes('hotel')&&selected.every(topic=>topic==='hotel'||topic==='hotel_rules')&&!/日程|期間|何日|概要|目的|いつ|何泊/.test(question)&&!quotedPages.has(3);
 return {
  asOf:guideDate,
  pages:[...numbers].sort((a,b)=>a-b).map(pdf=>({
   pdf,
   url:pageLink(pdf),
   text:pdf===3&&onlyHotel?readGuide('hotel').sections.hotel:linkImages(pages.get(pdf))
  }))
 };
}
export function readGuides(selected){
 if(selected.length===1)return readGuide(selected[0]);
 const entries=selected.map(topic=>readGuide(topic)),numbers=[...new Set(entries.flatMap(entry=>entry.sourcePages.map(page=>page.pdf)))].sort((a,b)=>a-b);
 return {...entries[0],topics:selected,url:base+'#source-page-'+numbers[0],sourcePages:numbers.map(n=>({pdf:n,printed:n===1?null:n-1,url:base+'#source-page-'+n})),sections:Object.fromEntries(numbers.map(n=>['source-page-'+n,pages.get(n).replace(/!\[([^\]]+)\]\(guide-assets\/([^\)]+)\)/g,(_m,label,file)=>`[${label}（原本の図。本文中の文字情報からは未確認）](https://kentarourus.github.io/toriw_zikanwari_bot/taiwan/guide-assets/${file})`)]))};
}
export function readDirections(arguments_){
 const hotel=readGuide('hotel').sections.hotel.match(/所在地[^\S\r\n]+([^\r\n]+)/)?.[1]?.trim();
 return mapDirections(arguments_,hotel);
}
export function handle(message){
 const {id,method,params}=message;if(id==null)return null;
 if(method==='initialize')return {id,jsonrpc:'2.0',result:{protocolVersion:params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'trip-guide',version:'2.0.0'}}};
 if(method==='ping')return {id,jsonrpc:'2.0',result:{}};
 if(method==='tools/list')return {id,jsonrpc:'2.0',result:{tools:[{name:'read_trip_guide',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},description:'全34ページのしおりMarkdownから必要な項目だけ参照する。departure=学校出発、day1〜4=12月1〜4日、daily_routine=朝食/点呼/起床/就寝、meals=食事会場、packing=携行品、baggage=荷物/液体/電池、clothing=服装、devices=スマホ/SNS、hotel=宿泊先の名前・住所のみ、hotel_rules=階やフロアの移動/客室の行き来/エレベーター/階段/宿舎の生活ルール、health=健康、emergency=緊急、shopping=買物、contacts=連絡、language=会話、planning=班計画、transport=MRT図、maps=ホテル図。全体が必要な場合だけallを使う。図の内容や未定箇所を推測しない。',inputSchema:{type:'object',properties:{topic:{type:'string',enum:topics}},required:['topic'],additionalProperties:false}},directionsSpec,mapSearchSpec]}};
 if(method==='tools/call'&&params?.name==='get_map_search_link'){try{return {id,jsonrpc:'2.0',result:{content:[{type:'text',text:JSON.stringify(mapSearch(params.arguments??{}))}]}};}catch{return {id,jsonrpc:'2.0',result:{isError:true,content:[{type:'text',text:'検索する場所を確認してください。'}]}};}}
 if(method==='tools/call'&&params?.name==='get_map_directions'){
  try{return {id,jsonrpc:'2.0',result:{content:[{type:'text',text:JSON.stringify(readDirections(params.arguments??{}))}]}};}catch{return {id,jsonrpc:'2.0',result:{isError:true,content:[{type:'text',text:'出発地・目的地・移動手段を確認してください。'}]}};}
 }
 if(method==='tools/call'&&params?.name==='read_trip_guide'){
  try{return {id,jsonrpc:'2.0',result:{content:[{type:'text',text:JSON.stringify(readGuide(params.arguments?.topic))}]}};}catch{return {id,jsonrpc:'2.0',result:{isError:true,content:[{type:'text',text:'指定された項目はありません。利用できるtopicを指定してください。'}]}};}
 }
 return {id,jsonrpc:'2.0',error:{code:-32601,message:'Method not found'}};
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\','/').split('/').at(-1)))createInterface({input:process.stdin}).on('line',line=>{try{const response=handle(JSON.parse(line));if(response)process.stdout.write(JSON.stringify(response)+'\n');}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');}});
