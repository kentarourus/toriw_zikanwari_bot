import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {weatherContext} from '../runner/weather.mjs';
import {assistantInstructions as instructions} from '../runner/assistant-instructions.mjs';
import {readGuides} from '../runner/guide-mcp.mjs';
import {webModeFor,selectGuideTopics} from '../runner/context-policy.mjs';
const root=path.resolve(process.env.TAIWAN_RUNNER_ROOT||'.');
const config=JSON.parse(await fs.readFile(path.join(root,'runtime.json'),'utf8'));
const jobs=new Map(),pending=new Map(),byThread=new Map();let sequence=0,child,ready,active=0;

function rpc(method,params){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CLI応答が時間切れになりました。'));},30000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
function onEvent(message){
 if(message.id!=null&&pending.has(message.id)){const entry=pending.get(message.id);pending.delete(message.id);clearTimeout(entry.timer);message.error?entry.reject(Error('CLIの準備に失敗しました。')):entry.resolve(message.result);return;}
 if(message.id!=null&&message.method){child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'Tools and approval requests are not available'}})+'\n');return;}
 const p=message.params||{},job=byThread.get(p.threadId);if(!job)return;
 if(message.method==='item/agentMessage/delta'){job.partial=(job.partial||'')+p.delta;if(!job.firstTokenAt)job.firstTokenAt=Date.now();}
 if(message.method==='item/completed'&&p.item?.type==='agentMessage'){job.answer=p.item.text;job.partial=p.item.text;}
 if(message.method==='item/started'&&p.item?.type==='mcpToolCall'&&p.item.tool==='read_trip_guide')job.stage='reading';
 if(message.method==='item/completed'&&p.item?.type==='mcpToolCall'&&p.item.tool==='read_trip_guide'){job.guideReads++;job.stage='answering';if(p.item.error)console.error('Guide tool error: '+JSON.stringify(p.item.error));if(p.item.result?.isError)console.error('Guide returned an error');}
 if(message.method==='item/started'&&p.item?.type==='webSearch')job.stage='searching';
 if(message.method==='item/completed'&&p.item?.type==='webSearch'){job.webSearches++;job.stage='answering';}
 if(message.method==='thread/tokenUsage/updated'){
  const u=p.tokenUsage?.total;if(u)job.usage={input_tokens:u.inputTokens,output_tokens:u.outputTokens,cached_input_tokens:u.cachedInputTokens,reasoning_output_tokens:u.reasoningOutputTokens};
 }
 if(message.method==='turn/completed'){
  clearTimeout(job.timer);setTimeout(()=>{job.answer=job.answer||job.partial||'';job.status=p.turn.status==='completed'&&job.answer?'completed':'failed';
  if(job.status==='failed')job.error='回答を作成できませんでした。もう一度お試しください。';job.completedAt=Date.now();active--;byThread.delete(p.threadId);rpc('thread/unload',{threadId:p.threadId}).catch(()=>{});},100);
 }
}
function startCLI(){
 const args=['app-server','-c','mcp_servers.trip_guide.command="/usr/bin/node"','-c','mcp_servers.trip_guide.args='+JSON.stringify([path.join(root,'runner/guide-mcp.mjs')]),'--listen','stdio://','-c','web_search="live"','--disable','apps','--disable','plugins','--disable','shell_tool','--disable','unified_exec','--disable','multi_agent','--disable','multi_agent_v2'];
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',CODEX_HOME:path.join(root,'auth')};
 child=spawn(path.join(root,'node_modules/.bin/codex'),args,{cwd:path.join(root,'workspace'),env,stdio:['pipe','pipe','ignore']});
 createInterface({input:child.stdout}).on('line',line=>{try{onEvent(JSON.parse(line));}catch{}});
 child.on('exit',()=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('CLIが再起動しました。'));}pending.clear();for(const job of byThread.values()){clearTimeout(job.timer);job.status='failed';job.error='処理が中断されました。もう一度送信してください。';}byThread.clear();active=0;setTimeout(()=>{ready=startCLI();ready.catch(()=>{});},1500);});
 child.on('error',()=>console.error('CLI could not start'));
 return rpc('initialize',{clientInfo:{name:'taiwan_chat',title:'Taiwan chat',version:'1.0.0'},capabilities:{experimentalApi:true}}).then(()=>{child.stdin.write(JSON.stringify({method:'initialized'})+'\n');console.log('CLI ready');});
}
ready=startCLI();ready.catch(()=>{});
async function answer(job,messages){
 try{await ready;job.stage='preparing';const webMode=webModeFor(messages),topics=selectGuideTopics(messages);let guideContext='';if(topics.length){job.stage='reading';guideContext=JSON.stringify(readGuides(topics));job.guideReads=topics.length;}const needGuideTool=(!topics.length||topics.every(t=>t==='overview'))&&/しおり|学校の|研修の|修学の/.test(messages.at(-1)?.content||'');const weather=await weatherContext(messages);const now=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',dateStyle:'full',timeStyle:'short'}).format(new Date());
  const result=await rpc('thread/start',{model:'gpt-6-luna',cwd:path.join(root,'workspace'),approvalPolicy:'never',sandbox:'read-only',ephemeral:true,baseInstructions:instructions,config:{web_search:webMode,'mcp_servers.trip_guide.enabled':needGuideTool}});
  job.threadId=result.thread.id;byThread.set(job.threadId,job);job.stage='answering';job.status='in_progress';
  job.timer=setTimeout(()=>{if(!['completed','failed'].includes(job.status)){job.status='failed';job.error='回答の作成が時間切れになりました。';active--;byThread.delete(job.threadId);rpc('thread/unload',{threadId:job.threadId}).catch(()=>{});}},180000);
  await rpc('turn/start',{threadId:job.threadId,effort:'medium',input:[{type:'text',text:`現在（台湾時間）: ${now}\n${guideContext?'質問に関係する項目を確認済みです。これだけで答えられる場合は追加参照しないでください。\n'+guideContext:needGuideTool?'旅行資料が必要な場合だけread_trip_guideを使ってください。':'この質問では旅行資料は参照していません。一般会話には資料は不要です。'}\n最新の天気資料:\n${weather||'この質問では取得を省略。必要時のみWeb検索してください。'}\n会話(JSON):\n${JSON.stringify(messages)}`,text_elements:[]}]});
 }catch{if(job.status!=='failed'){clearTimeout(job.timer);byThread.delete(job.threadId);job.status='failed';job.error='回答の準備に失敗しました。少し待って再度お試しください。';active--;}}
}
const server=http.createServer(async(req,res)=>{
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const auth=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+config.token);if(auth.length!==expected.length||!timingSafeEqual(auth,expected))return reply({error:'Not allowed'},403);
 try{
  if(req.method==='GET'&&req.url==='/models'){await ready;return reply(await rpc('model/list',{includeHidden:true}));}
  if(req.method==='GET'&&req.url==='/health')return reply({ready:!!child&&!child.killed,active});
  if(req.method==='POST'&&req.url==='/jobs'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>14000)return reply({error:'質問が長すぎます。'},400);}
   const {messages}=JSON.parse(raw);if(!Array.isArray(messages)||!messages.length||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))return reply({error:'質問を確認してください。'},400);
   if(active>=2)return reply({error:'処理中です。少し待って送信してください。'},429);
   const job={id:'pc-'+randomUUID(),status:'in_progress',stage:'preparing',createdAt:Date.now(),partial:'',usage:null,webSearches:0,guideReads:0};jobs.set(job.id,job);active++;reply({id:job.id,backend:'pc'});answer(job,messages);return;
  }
  if(req.method==='GET'&&/^\/jobs\/pc-[-a-f0-9]{36}$/.test(req.url)){
   const job=jobs.get(req.url.split('/').at(-1));if(!job)return reply({status:'failed',error:'PCの再起動などでこの実行は終了しました。もう一度送信してください。'});
   return reply({status:job.status,stage:job.stage,partial:job.partial,answer:job.status==='completed'?job.answer:undefined,error:job.error,usage:job.usage,webSearches:job.webSearches,guideReads:job.guideReads,firstTokenMs:job.firstTokenAt?job.firstTokenAt-job.createdAt:null,elapsedMs:(job.completedAt||Date.now())-job.createdAt});
  }
  return reply({error:'Not found'},404);
 }catch{reply({error:'処理できませんでした。'},500);}
});
server.listen(8793,'127.0.0.1',()=>console.log('Local chat service ready'));
setInterval(()=>{for(const [id,job] of jobs)if(Date.now()-job.createdAt>86400000)jobs.delete(id);},3600000).unref();
process.on('SIGTERM',()=>{child?.kill();server.close(()=>process.exit(0));});
