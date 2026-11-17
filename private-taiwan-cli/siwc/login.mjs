import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID,createHash,createPublicKey,verify} from 'node:crypto';
const root=path.resolve(process.env.SIWC_HOME||'outputs/siwc-runtime');
await fs.mkdir(root,{recursive:true,mode:0o700});
const save=async(name,value)=>{const file=path.join(root,name),tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value),{mode:0o600});await fs.rename(tmp,file);};
let host;try{host=JSON.parse(await fs.readFile(path.join(root,'host.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;host={id:'urn:uuid:'+randomUUID()};await save('host.json',host);}
const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
const redirect='http://127.0.0.1:1456/auth/callback';let used=false;
const getJSON=async(url,options)=>{const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('認証先との通信に失敗しました。');return r.json();};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,redirect);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');
 if(u.pathname!=='/auth/callback'){res.writeHead(404);return res.end('Not found');}
 if(used||u.searchParams.get('state')!==state){res.writeHead(400);return res.end('認証要求を確認できません。');}
 used=true;
 try{
  if(u.searchParams.has('error'))throw Error('ログインまたは利用許可が完了していません。');
  const client=u.searchParams.get('client_id'),code=u.searchParams.get('code');if(!client||client==='dynamic_agent_client'||!code)throw Error('登録が未完了です。');
  const token=await getJSON('https://auth.openai.com/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client,code,code_verifier:verifier,redirect_uri:redirect,resource:'https://api.openai.com/v1'})});
  const [h,p,s]=String(token.id_token||'').split('.');const header=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(p,'base64url'));
  const discovery=await getJSON('https://auth.openai.com/.well-known/openid-configuration');const keys=await getJSON(discovery.jwks_uri);const key=keys.keys.find(k=>k.kid===header.kid);
  if(header.alg!=='RS256'||!key||!verify('RSA-SHA256',Buffer.from(h+'.'+p),createPublicKey({key,format:'jwk'}),Buffer.from(s,'base64url'))||claims.iss!=='https://auth.openai.com'||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(client)||claims.exp<=Date.now()/1000||claims.nonce!==nonce||!claims.sub)throw Error('ログイン情報の検証に失敗しました。');
  const scopes=String(token.scope||'').split(' ');if(!scopes.includes('chatgpt.tokens.use.direct'))throw Error('ChatGPT契約枠の利用が許可されていません。');
  await save('credentials.json',{...token,client_id:client,subject:claims.sub,ext_agent_host_id:host.id,scopes,saved_at:new Date().toISOString()});
  res.end('ログインの検証が完了しました。この画面を閉じてください。');console.log('ChatGPT login validated.');
 }catch(e){res.writeHead(400);res.end('ログインを完了できませんでした。新しい認証要求でやり直してください。');console.log('ChatGPT login was not completed.');}
 finally{server.close();}
});
server.listen(1456,'127.0.0.1',async()=>{
 const url=new URL('https://auth.openai.com/api/accounts/authorize');url.search=new URLSearchParams({client_id:'dynamic_agent_client',agent_name_hint:'丹陽さん',ext_agent_host_id:host.id,response_type:'code',redirect_uri:redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:'https://api.openai.com/v1',state,nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
 await fs.writeFile(path.join(root,'authorize-url.txt'),url.href,{mode:0o600});console.log('ChatGPT login listener ready on 127.0.0.1:1456');
});
setTimeout(()=>{server.close();process.exit(0);},15*60*1000).unref();
