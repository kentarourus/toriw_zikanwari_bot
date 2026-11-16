import fs from 'node:fs/promises';import {createInterface} from 'node:readline';
const guide=JSON.parse((await fs.readFile(new URL('./trip-guide.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const topics=[...Object.keys(guide),'itinerary','all'];
export function readGuide(topic){
 if(!topics.includes(topic))throw Error('Unknown guide topic');
 const keys=topic==='all'?Object.keys(guide):topic==='itinerary'?['overview','day1','day2','day3','day4']:[topic];
 return {source:'公開用しおり要約・利用者からの補足。資料にない詳細は未確認。',asOf:'2026-11-13',url:'https://drive.google.com/file/d/12cX17qVX1fxJbOhnS4W9hcOlcfBWP1nx/view',sections:Object.fromEntries(keys.map(key=>[key,guide[key]]))};
}
export function handle(message){
 const {id,method,params}=message;if(id==null)return null;
 if(method==='initialize')return {id,jsonrpc:'2.0',result:{protocolVersion:params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'trip-guide',version:'1.0.0'}}};
 if(method==='ping')return {id,jsonrpc:'2.0',result:{}};
 if(method==='tools/list')return {id,jsonrpc:'2.0',result:{tools:[{name:'read_trip_guide',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},description:'学校の台湾研修旅行の日程、集合時刻、班別研修、準備、注意事項、宿泊ホテルを必要時だけ確認する。質問に関係するtopicだけ読む。day1〜4は12月1〜4日、hotelは宿泊先、rulesは行動規則。要約にない情報は未確認。',inputSchema:{type:'object',properties:{topic:{type:'string',enum:topics}},required:['topic'],additionalProperties:false}}]}};
 if(method==='tools/call'&&params?.name==='read_trip_guide'){
  try{return {id,jsonrpc:'2.0',result:{content:[{type:'text',text:JSON.stringify(readGuide(params.arguments?.topic))}]}};}catch{return {id,jsonrpc:'2.0',result:{isError:true,content:[{type:'text',text:'指定された項目はありません。利用できるtopicを指定してください。'}]}};}
 }
 return {id,jsonrpc:'2.0',error:{code:-32601,message:'Method not found'}};
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\','/').split('/').at(-1)))createInterface({input:process.stdin}).on('line',line=>{try{const response=handle(JSON.parse(line));if(response)process.stdout.write(JSON.stringify(response)+'\n');}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');}});
