import {ChatgptPlanProvider} from './chatgpt-plan-provider.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {weatherContext} from '../runner/weather.mjs';
import {assistantInstructions as instructions} from '../runner/assistant-instructions.mjs';
import {readGuides} from '../runner/guide-mcp.mjs';
import {guidePolicyFor} from '../runner/context-policy.mjs';
import {CodexProvider} from './codex-provider.mjs';
import {CopilotProvider} from './copilot-provider.mjs';
import {runWithFallback,providerLabel} from './provider-routing.mjs';
import {hydrogenExecutable,runHydrogen,stopHydrogen,warmHydrogen} from './hydrogen-provider.mjs';
const root=path.resolve(process.env.TAIWAN_RUNNER_ROOT||'.');
const config=JSON.parse(await fs.readFile(path.join(root,'runtime.json'),'utf8'));
const mode=process.env.TAIWAN_PROVIDER_MODE||config.providerMode||'auto';
const port=Number(process.env.TAIWAN_CHAT_PORT||8793);
const plan=new ChatgptPlanProvider({root});
const codex=new CodexProvider({root}),copilot=new CopilotProvider({root});
const hydrogenAvailable=await fs.access(hydrogenExecutable,constants.X_OK).then(()=>true,()=>false);
if(hydrogenAvailable)warmHydrogen();
const jobs=new Map();let active=0,providerReady=false;
(mode==='chatgpt-plan'?plan:mode==='copilot-test'?copilot:codex).start().then(()=>{providerReady=true;console.log('Chat provider ready');}).catch(()=>console.error('Chat provider is not ready'));

async function prepare(job,messages){
 const {webMode,topics,needGuideTool,needDirections}=guidePolicyFor(messages);
 let guideContext='';if(topics.length){job.stage='reading';guideContext=JSON.stringify(readGuides(topics));job.guideReads=topics.length;}
 const weather=await weatherContext(messages);
 const now=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',dateStyle:'full',timeStyle:'short'}).format(new Date());
 const usesHydrogen=job.provider==='hydrogen';
 let guideNote='この質問では旅行資料は参照していません。一般会話には資料は不要です。';
 if(needGuideTool&&!usesHydrogen)guideNote='旅行資料が必要な場合だけread_trip_guideを使ってください。';
 if(guideContext){
  const supplemental=usesHydrogen?'':'該当する記述が見つからなければread_trip_guideで関連項目を追加確認してください。';
  guideNote='以下は質問から事前に選んだしおりの一部です。しおり全文ではありません。'+supplemental+'\n'+guideContext;
 }
 const noWeather=usesHydrogen?'この質問では取得を省略。':'この質問では取得を省略。必要時のみWeb検索してください。';
 const prompt=`現在（台湾時間）: ${now}\n${guideNote}\n最新の天気資料:\n${weather||noWeather}\n会話(JSON):\n${JSON.stringify(messages)}`;
 return {webMode,needGuideTool,needDirections,prompt,instructions:usesHydrogen
  ? instructions+'\nHydrogenではツールを使わず、ここに提示された資料と会話を使って回答してください。実際に確認していない検索結果や情報を提示しないでください。'
  : instructions};
}
async function answer(job,messages){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),210000);
 try{
  const prepared=await prepare(job,messages);
  const result=job.provider==='hydrogen'?await runHydrogen(job,prepared,{signal:controller.signal}):mode==='chatgpt-plan'?await plan.run(job,prepared,{signal:controller.signal}).catch(async()=>{if(controller.signal.aborted)throw Error('Timeout');job.switchedFrom='chatgpt-plan';job.provider='copilot';job.partial='';job.answer='';job.usage=null;job.firstTokenAt=null;job.stage='switching';return copilot.run(job,prepared,{signal:controller.signal});}):await runWithFallback({mode,codex:()=>codex.run(job,prepared,{signal:controller.signal}),copilot:()=>copilot.run(job,prepared,{signal:controller.signal}),onSwitch:()=>{
   job.stage='switching';job.provider='copilot';job.switchedFrom='codex';job.partial='';job.answer='';job.usage=null;job.firstTokenAt=null;
  }});
  job.answer=result.answer;job.usage=result.usage;job.provider=result.provider;job.model=result.model;
  job.status='completed';job.completedAt=Date.now();
 }catch(error){
  job.status='failed';job.error=job.provider==='hydrogen'?'Hydrogenで回答できませんでした。再試行するか、標準モデルへ切り替えてください。':error.code==='COPILOT_AUTH_REQUIRED'?'Copilotへのログインが必要です。':job.provider==='copilot'?'Copilotで回答できませんでした。利用枠とログイン状態を確認してください。':'回答を作成できませんでした。もう一度お試しください。';
  job.completedAt=Date.now();
 }finally{clearTimeout(timer);active--;}
}
const server=http.createServer(async(req,res)=>{
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const auth=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+config.token);
 if(auth.length!==expected.length||!timingSafeEqual(auth,expected))return reply({error:'Not allowed'},403);
 try{
  if(req.method==='GET'&&req.url==='/health')return reply({ready:providerReady,active,mode});
  if(req.method==='GET'&&req.url==='/provider-status')return reply({mode,label:providerLabel(mode),hydrogenAvailable});
  if(req.method==='GET'&&req.url==='/models'){
   if(mode==='copilot-test'){await copilot.start();return reply({data:await copilot.client.listModels()});}
   await codex.start();return reply(await codex.rpc('model/list',{includeHidden:true}));
  }
  if(req.method==='POST'&&req.url==='/jobs'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>14000)return reply({error:'質問が長すぎます。'},400);}
   const {messages,provider}=JSON.parse(raw);
   if(!Array.isArray(messages)||!messages.length||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))return reply({error:'質問を確認してください。'},400);
   if(active>=2)return reply({error:'処理中です。少し待って送信してください。'},429);
   if(provider==='hydrogen'&&!hydrogenAvailable)return reply({error:'Hydrogenに接続できません。'},503);
   const job={id:'pc-'+randomUUID(),status:'in_progress',stage:'preparing',createdAt:Date.now(),partial:'',usage:null,webSearches:0,guideReads:0,provider:provider==='hydrogen'?'hydrogen':mode==='chatgpt-plan'?'chatgpt-plan':mode==='copilot-test'?'copilot':'codex'};
   jobs.set(job.id,job);active++;reply({id:job.id,backend:'pc',provider:job.provider});answer(job,messages);return;
  }
  if(req.method==='GET'&&/^\/jobs\/pc-[-a-f0-9]{36}$/.test(req.url)){
   const job=jobs.get(req.url.split('/').at(-1));
   if(!job)return reply({status:'failed',error:'PCの再起動などでこの実行は終了しました。もう一度送信してください。'});
   return reply({status:job.status,stage:job.stage,partial:job.partial,answer:job.status==='completed'?job.answer:undefined,error:job.error,usage:job.usage,webSearches:job.webSearches,guideReads:job.guideReads,directions:job.directions||0,provider:job.provider,model:job.model,switchedFrom:job.switchedFrom,firstTokenMs:job.firstTokenAt?job.firstTokenAt-job.createdAt:null,elapsedMs:(job.completedAt||Date.now())-job.createdAt});
  }
  return reply({error:'Not found'},404);
 }catch{reply({error:'処理できませんでした。'},500);}
});
server.listen(port,'127.0.0.1',()=>console.log('Local chat service ready'));
setInterval(()=>{for(const [id,job] of jobs)if(Date.now()-job.createdAt>86400000)jobs.delete(id);},3600000).unref();
process.on('SIGTERM',async()=>{stopHydrogen();await Promise.allSettled([codex.stop(),copilot.stop()]);server.close(()=>process.exit(0));});
