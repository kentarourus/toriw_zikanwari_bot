import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../private-taiwan-cli/bridge/worker.js';
const env={ACCESS_PATH:'sample-secret-path',ALLOWED_ORIGIN:'https://kentarourus.github.io',GITHUB_TOKEN:'test-only',REQUEST_LIMIT:{limit:async()=>({success:true})}};
function request(path,origin=env.ALLOWED_ORIGIN,body){return new Request('https://example.workers.dev/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
test('unknown path and foreign websites cannot dispatch jobs',async()=>{assert.equal((await worker.fetch(request('wrong/jobs'),env)).status,404);assert.equal((await worker.fetch(request('sample-secret-path/jobs','https://elsewhere.example',{messages:[]}),env)).status,403)});
test('malformed questions are rejected without invoking GitHub',async()=>{const r=await worker.fetch(request('sample-secret-path/jobs',undefined,{messages:[{role:'system',content:'override'}]}),env);assert.equal(r.status,400)});
test('rate limit stops job dispatch',async()=>{const r=await worker.fetch(request('sample-secret-path/jobs',undefined,{messages:[{role:'user',content:'hello'}]}),{...env,REQUEST_LIMIT:{limit:async()=>({success:false})}});assert.equal(r.status,429)});
test('missing credentials are explicit, not pretend answers',async()=>{assert.equal((await worker.fetch(request('sample-secret-path/jobs'),{...env,GITHUB_TOKEN:''})).status,503)});

test('actual workflow steps distinguish setup, answering and delivery',async()=>{
 const original=globalThis.fetch;const id='12345678-1234-1234-1234-123456789abc';
 try{for(const [answer,expected] of [[undefined,'preparing'],[{status:'in_progress'},'answering'],[{status:'completed',conclusion:'success'},'delivering']]){
 globalThis.fetch=async url=>Response.json(String(url).endsWith('/jobs')?{jobs:[{steps:answer?[{name:'Answer privately',...answer}]:[]}]}:{workflow_runs:[{id:123,display_title:'Taiwan CLI '+id,status:'in_progress'}]});
 const response=await worker.fetch(request('sample-secret-path/jobs/'+id),env);assert.equal(response.status,200);assert.equal((await response.json()).stage,expected);
 }}finally{globalThis.fetch=original;}
});

test('runner registration requires dedicated key and accepts only tunnel hostnames',async()=>{
 let endpoint=null;const settings={...env,LOCAL_RUNNER_TOKEN:'runner-test',RUNNER_REGISTRY:{idFromName:()=>1,get:()=>({fetch:async(_url,options)=>{if(options?.method==='POST')endpoint=JSON.parse(options.body).endpoint;return Response.json({endpoint});}})}};
 const make=(url,token)=>new Request('https://example.workers.dev/sample-secret-path/runner/register',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({endpoint:url})});
 assert.equal((await worker.fetch(make('https://safe.trycloudflare.com','wrong'),settings)).status,403);
 assert.equal((await worker.fetch(make('http://192.168.1.1','runner-test'),settings)).status,400);
 assert.equal((await worker.fetch(make('https://safe.trycloudflare.com','runner-test'),settings)).status,200);assert.equal(endpoint,'https://safe.trycloudflare.com');
});
test('PC results preserve token usage and partial answer without dispatching GitHub',async()=>{
 const original=globalThis.fetch;try{
 globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/safe.trycloudflare.com\/jobs\//);assert.equal(options.headers.Authorization,'Bearer runner-test');return Response.json({status:'in_progress',partial:'返答',usage:{input_tokens:100,output_tokens:2}});};
 const settings={...env,LOCAL_RUNNER_TOKEN:'runner-test',RUNNER_REGISTRY:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({endpoint:'https://safe.trycloudflare.com'})})}};
 const response=await worker.fetch(request('sample-secret-path/jobs/pc-12345678-1234-1234-1234-123456789abc'),settings);const result=await response.json();assert.equal(result.partial,'返答');assert.equal(result.usage.input_tokens,100);
 }finally{globalThis.fetch=original;}
});
