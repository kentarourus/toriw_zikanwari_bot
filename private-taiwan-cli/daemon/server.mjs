import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {weatherContext} from '../runner/weather.mjs';
import {assistantInstructions as instructions} from '../runner/assistant-instructions.mjs';
import {readGuides} from '../runner/guide-mcp.mjs';
import {webModeFor,selectGuideTopics} from '../runner/context-policy.mjs';
import {CodexProvider} from './codex-provider.mjs';
import {CopilotProvider} from './copilot-provider.mjs';
import {runWithFallback,providerLabel} from './provider-routing.mjs';
const root=path.resolve(process.env.TAIWAN_RUNNER_ROOT||'.');
const config=JSON.parse(await fs.readFile(path.join(root,'runtime.json'),'utf8'));
const mode=process.env.TAIWAN_PROVIDER_MODE||config.providerMode||'auto';
const port=Number(process.env.TAIWAN_CHAT_PORT||8793);
const codex=new CodexProvider({root}),copilot=new CopilotProvider({root});
const jobs=new Map();let active=0,providerReady=false;
(mode==='copilot-test'?copilot:codex).start().then(()=>{providerReady=true;console.log('Chat provider ready');}).catch(()=>console.error('Chat provider is not ready'));

async function prepare(job,messages){
 const webMode=webModeFor(messages),topics=selectGuideTopics(messages);
 let guideContext='';if(topics.length){job.stage='reading';guideContext=JSON.stringify(readGuides(topics));job.guideReads=topics.length;}
 const needGuideTool=(!topics.length||topics.every(t=>t==='overview'))&&/しおり|学校の|研修の|修学の/.test(messages.at(-1)?.content||'');
 const weather=await weatherContext(messages);
 const now=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',dateStyle:'full',timeStyle:'short'}).format(new Date());
 const prompt=`現在（台湾時間）: ${now}\n${guideContext?'質問に関係する項目を確認済みです。これだけで答えられる場合は追加参照しないでください。\n'+guideContext:needGuideTool?'旅行資料が必要な場合だけread_trip_guideを使ってください。':'この質問では旅行資料は参照していません。一般会話には資料は不要です。'}\n最新の天気資料:\n${weather||'この質問では取得を省略。必要時のみWeb検索してください。'}\n会話(JSON):\n${JSON.stringify(messages)}`;
 return {webMode,needGuideTool,prompt,instructions};
}
async function answer(job,messages){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),210000);
 try{
  const prepared=await prepare(job,messages);
  const result=await runWithFallback({mode,codex:()=>codex.run(job,prepared,{signal:controller.signal}),copilot:()=>copilot.run(job,prepared,{signal:controller.signal}),onSwitch:()=>{
   job.stage='switching';job.provider='copilot';job.switchedFrom='codex';job.partial='';job.answer='';job.usage=null;job.firstTokenAt=null;
  }});
  job.answer=result.answer;job.usage=result.usage;job.provider=result.provider;job.model=result.model;
  job.status='completed';job.completedAt=Date.now();
 }catch(error){
  job.status='failed';job.error=error.code==='COPILOT_AUTH_REQUIRED'?'Copilotへのログインが必要です。':job.provider==='copilot'?'Copilotで回答できませんでした。利用枠とログイン状態を確認してください。':'回答を作成できませんでした。もう一度お試しください。';
  job.completedAt=Date.now();
 }finally{clearTimeout(timer);active--;}
}
const server=http.createServer(async(req,res)=>{
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const auth=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+config.token);
 if(auth.length!==expected.length||!timingSafeEqual(auth,expected))return reply({error:'Not allowed'},403);
 try{
  if(req.method==='GET'&&req.url==='/health')return reply({ready:providerReady,active,mode});
  if(req.method==='GET'&&req.url==='/provider-status')return reply({mode,label:providerLabel(mode)});
  if(req.method==='GET'&&req.url==='/models'){
   if(mode==='copilot-test'){await copilot.start();return reply({data:await copilot.client.listModels()});}
   await codex.start();return reply(await codex.rpc('model/list',{includeHidden:true}));
  }
  if(req.method==='POST'&&req.url==='/jobs'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>14000)return reply({error:'質問が長すぎます。'},400);}
   const {messages}=JSON.parse(raw);
   if(!Array.isArray(messages)||!messages.length||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))return reply({error:'質問を確認してください。'},400);
   if(active>=2)return reply({error:'処理中です。少し待って送信してください。'},429);
   const job={id:'pc-'+randomUUID(),status:'in_progress',stage:'preparing',createdAt:Date.now(),partial:'',usage:null,webSearches:0,guideReads:0,provider:mode==='copilot-test'?'copilot':'codex'};
   jobs.set(job.id,job);active++;reply({id:job.id,backend:'pc',provider:job.provider});answer(job,messages);return;
  }
  if(req.method==='GET'&&/^\/jobs\/pc-[-a-f0-9]{36}$/.test(req.url)){
   const job=jobs.get(req.url.split('/').at(-1));
   if(!job)return reply({status:'failed',error:'PCの再起動などでこの実行は終了しました。もう一度送信してください。'});
   return reply({status:job.status,stage:job.stage,partial:job.partial,answer:job.status==='completed'?job.answer:undefined,error:job.error,usage:job.usage,webSearches:job.webSearches,guideReads:job.guideReads,provider:job.provider,model:job.model,switchedFrom:job.switchedFrom,firstTokenMs:job.firstTokenAt?job.firstTokenAt-job.createdAt:null,elapsedMs:(job.completedAt||Date.now())-job.createdAt});
  }
  return reply({error:'Not found'},404);
 }catch{reply({error:'処理できませんでした。'},500);}
});
server.listen(port,'127.0.0.1',()=>console.log('Local chat service ready'));
setInterval(()=>{for(const [id,job] of jobs)if(Date.now()-job.createdAt>86400000)jobs.delete(id);},3600000).unref();
process.on('SIGTERM',async()=>{await Promise.allSettled([codex.stop(),copilot.stop()]);server.close(()=>process.exit(0));});
