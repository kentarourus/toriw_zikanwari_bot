import fs from 'node:fs/promises';import path from 'node:path';
export class SiwcClient{
 constructor(root){this.root=root;}
 async credentials(){
  if(this.refreshing)return this.refreshing;
  const c=JSON.parse(await fs.readFile(path.join(this.root,'credentials.json'),'utf8'));
  if(Date.now()<Date.parse(c.saved_at)+(c.expires_in-120)*1000)return c;
  this.refreshing=(async()=>{const r=await fetch('https://auth.openai.com/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:c.client_id,refresh_token:c.refresh_token,resource:'https://api.openai.com/v1'}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('ChatGPTへの再ログインが必要です。');const t=await r.json(),next={...c,...t,saved_at:new Date().toISOString()};if(t.scope)next.scopes=t.scope.split(' ');if(!next.scopes.includes('chatgpt.tokens.use.direct'))throw Error('契約枠の利用許可がありません。');const file=path.join(this.root,'credentials.json');await fs.writeFile(file+'.tmp',JSON.stringify(next),{mode:0o600});await fs.rename(file+'.tmp',file);return next;})().finally(()=>{this.refreshing=null;});return this.refreshing;
 }
 async answer(input,{model='gpt-6-luna',instructions='',signal,onDelta=()=>{}}={}){
  const c=await this.credentials();const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+c.access_token,'Content-Type':'application/json'},body:JSON.stringify({model,input,instructions,store:false,stream:true}),signal:signal||AbortSignal.timeout(120000)});
  if(!r.ok)throw Error('ChatGPTへの接続に失敗しました。');let buffer='',text='',usage=null,completed=false;const decoder=new TextDecoder();
  for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line.startsWith('data: '))continue;let e;try{e=JSON.parse(line.slice(6));}catch{continue;}if(e.type==='response.output_text.delta'){text+=e.delta;onDelta(e.delta);}if(['response.failed','response.incomplete','error'].includes(e.type))throw Error('ChatGPTの応答が完了しませんでした。利用枠をご確認ください。');if(e.type==='response.completed'){completed=true;usage=e.response?.usage||null;}}}
  if(!completed||!text.trim())throw Error('ChatGPTの応答が途中で終了しました。');return {answer:text,usage,provider:'chatgpt-plan',model};
 }
}
