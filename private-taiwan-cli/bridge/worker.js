import {unzipSync,strFromU8} from 'fflate';
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!env.ACCESS_PATH||!url.pathname.startsWith('/'+env.ACCESS_PATH+'/'))return reply({error:'Not found'},404);
 if(origin!==env.ALLOWED_ORIGIN)return reply({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!env.GITHUB_TOKEN)return reply({error:'接続設定が未完了です。'},503);
 const base=`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
 const github=async(path,options={})=>fetch(base+path,{...options,headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','User-Agent':'Taiwan-private-CLI','X-GitHub-Api-Version':'2022-11-28',...options.headers}});
 try{
  if(request.method==='POST'&&url.pathname.endsWith('/jobs')){
   if(!env.REQUEST_LIMIT||!(await env.REQUEST_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return reply({error:'少し待ってから送信してください。'},429);
   const raw=await request.text();if(raw.length>14000)return reply({error:'会話が長すぎます。新しい会話にしてください。'},400);
   const {messages}=JSON.parse(raw);if(!Array.isArray(messages)||!messages.length||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))return reply({error:'質問は1500文字以内で送ってください。'},400);
   const id=crypto.randomUUID();const r=await github('/actions/workflows/chat.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{request_id:id,messages:JSON.stringify(messages)}})});
   if(!r.ok)return reply({error:'GitHubで実行を開始できませんでした。'},502);
   return reply({id});
  }
  const id=url.pathname.split('/').at(-1);if(request.method!=='GET'||!/^[-a-f0-9]{36}$/.test(id))return reply({error:'Not found'},404);
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
