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
