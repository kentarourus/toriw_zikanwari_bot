import {unzipSync,strFromU8} from 'fflate';
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 const privateRoute=!!env.ACCESS_PATH&&url.pathname.startsWith('/'+env.ACCESS_PATH+'/');
 const publicRoute=url.pathname.startsWith('/chat/');
 if(!privateRoute&&!publicRoute)return reply({error:'Not found'},404);
 const registry=()=>env.RUNNER_REGISTRY?.get(env.RUNNER_REGISTRY.idFromName('personal-runner'));
 if(request.method==='POST'&&url.pathname.endsWith('/runner/register')){
  if(!privateRoute)return reply({error:'Not found'},404);
  if(!env.LOCAL_RUNNER_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.LOCAL_RUNNER_TOKEN)return reply({error:'Not allowed'},403);
  const {endpoint}=await request.json();if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(endpoint))return reply({error:'Invalid endpoint'},400);
  if(!registry())return reply({error:'Registry unavailable'},503);
  await registry().fetch('https://registry/register',{method:'POST',body:JSON.stringify({endpoint})});return reply({registered:true});
 }
 const localURL=async()=>{if(!registry())return null;return (await (await registry().fetch('https://registry/url')).json()).endpoint;};
 const local=async(path,options={})=>{const endpoint=await localURL();if(!endpoint)return null;const response=await fetch(endpoint+path,{...options,headers:{Authorization:'Bearer '+env.LOCAL_RUNNER_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('local unavailable');return response.json();};
 if(origin!==env.ALLOWED_ORIGIN)return reply({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method==='GET'&&url.pathname.endsWith('/provider-status')){try{return reply(await local('/provider-status')||{mode:'legacy',label:'Luna medium'});}catch{return reply({error:'常駐PCに接続できません。'},503);}}
 if(request.method==='GET'&&/\/jobs\/pc-[-a-f0-9]{36}$/.test(url.pathname)){try{const result=await local('/jobs/'+url.pathname.split('/').at(-1));return result?reply(result):reply({error:'常駐PCに接続できません。'},503);}catch{return reply({error:'常駐PCに接続できません。電源とネットワークを確認してください。'},503);}}
 const base=`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
 const github=async(path,options={})=>fetch(base+path,{...options,headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','User-Agent':'Taiwan-private-CLI','X-GitHub-Api-Version':'2022-11-28',...options.headers}});
 try{
  if(request.method==='POST'&&url.pathname.endsWith('/jobs')){
   if(!env.REQUEST_LIMIT||!(await env.REQUEST_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return reply({error:'少し待ってから送信してください。'},429);
   const raw=await request.text();if(raw.length>14000)return reply({error:'会話が長すぎます。新しい会話にしてください。'},400);
   const {messages,provider}=JSON.parse(raw);if(!Array.isArray(messages)||!messages.length||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))return reply({error:'質問は1500文字以内で送ってください。'},400);
   if(provider!==undefined&&provider!=='hydrogen')return reply({error:'指定されたモデルは利用できません。'},400);
   if(await localURL()){try{return reply(await local('/jobs',{method:'POST',body:JSON.stringify({messages,provider})}));}catch{return reply({error:'常駐PCに接続できません。電源とネットワークを確認してください。'},503);}}
   if(provider==='hydrogen')return reply({error:'Hydrogenに接続できません。'},503);
   if(!env.GITHUB_TOKEN)return reply({error:'接続設定が未完了です。'},503);
   const id=crypto.randomUUID();const r=await github('/actions/workflows/chat.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{request_id:id,messages:JSON.stringify(messages)}})});
   if(!r.ok)return reply({error:'GitHubで実行を開始できませんでした。'},502);
   return reply({id});
  }
  const id=url.pathname.split('/').at(-1);if(request.method!=='GET'||!/^[-a-f0-9]{36}$/.test(id))return reply({error:'Not found'},404);
  if(!env.GITHUB_TOKEN)return reply({error:'接続設定が未完了です。'},503);
  const runs=await github('/actions/workflows/chat.yml/runs?event=workflow_dispatch&per_page=50');if(!runs.ok)throw Error();const run=(await runs.json()).workflow_runs.find(r=>r.display_title==='Taiwan CLI '+id);if(!run)return reply({status:'queued',stage:'queued'});
  if(run.status!=='completed'){
   let stage=run.status==='in_progress'?'preparing':'queued';
   if(run.status==='in_progress'){
    const jr=await github(`/actions/runs/${run.id}/jobs`);
    if(jr.ok){const job=(await jr.json()).jobs?.[0];const steps=job?.steps||[];const answer=steps.find(s=>s.name==='Answer privately');
     if(answer?.status==='in_progress')stage='answering';
     else if(answer?.status==='completed'&&answer.conclusion==='success')stage='delivering';
    }
   }
   return reply({status:run.status,stage});
  }
  if(run.conclusion!=='success')return reply({status:'failed',error:'CLI実行に失敗しました。GitHubの実行履歴とCLIのログイン状態を確認してください。'});
  const ar=await github(`/actions/runs/${run.id}/artifacts`);if(!ar.ok)throw Error();const artifact=(await ar.json()).artifacts.find(a=>a.name==='private-answer'&&!a.expired);if(!artifact)throw Error();
  const redirect=await github(`/actions/artifacts/${artifact.id}/zip`,{redirect:'manual'});const location=redirect.headers.get('Location');if(redirect.status!==302||!location||!location.startsWith('https://'))throw Error();const download=await fetch(location);if(!download.ok)throw Error();const files=unzipSync(new Uint8Array(await download.arrayBuffer()));if(!files['result.json'])throw Error();const result=JSON.parse(strFromU8(files['result.json']));return reply({status:'completed',answer:result.answer,webSearches:result.webSearches||0,usage:result.usage||null});
 }catch{return reply({error:'通信できませんでした。しばらくしてから再度お試しください。'},502);}
}};

export class RunnerRegistry{
 constructor(state){this.state=state;}
 async fetch(request){if(request.method==='POST'){const data=await request.json();await this.state.storage.put('endpoint',data.endpoint);return Response.json({ok:true});}return Response.json({endpoint:await this.state.storage.get('endpoint')||null});}
}
