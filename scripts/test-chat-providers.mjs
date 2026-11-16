import {test} from 'node:test';import assert from 'node:assert/strict';
import {runWithFallback,isUsageExhausted} from '../private-taiwan-cli/daemon/provider-routing.mjs';
import {CopilotProvider,copilotPermission} from '../private-taiwan-cli/daemon/copilot-provider.mjs';
test('only confirmed subscription quota exhaustion triggers one fallback',async()=>{
 let calls=0,switches=0;const result=await runWithFallback({mode:'auto',codex:async()=>{throw {codexErrorInfo:'usageLimitExceeded'};},copilot:async()=>{calls++;return 'backup';},onSwitch:()=>switches++});assert.equal(result,'backup');assert.equal(calls,1);assert.equal(switches,1);
 for(const code of ['contextWindowExceeded','rateLimitExceeded','unauthorized','network_error']){
  assert.equal(isUsageExhausted({codexErrorInfo:code}),false);
  await assert.rejects(()=>runWithFallback({mode:'auto',codex:async()=>{throw Error(code);},copilot:()=>{throw Error('must not call backup');}}),new RegExp(code));
 }
});
test('temporary test mode goes straight to Copilot and normal success stays on Codex',async()=>{
 assert.equal(await runWithFallback({mode:'copilot-test',codex:()=>{throw Error('must not call primary');},copilot:async()=> 'test'}),'test');
 assert.equal(await runWithFallback({mode:'auto',codex:async()=> 'normal',copilot:()=>{throw Error('must not call backup');}}),'normal');
});
test('Copilot adapter allows selected tools only, preserves actual usage, and deletes only its own session',async()=>{
 let config,clientOptions,deleted,disconnected=false;const handlers=new Set();
 const session={sessionId:'taiwan-chat-pc-test',on:fn=>{handlers.add(fn);return()=>handlers.delete(fn);},sendAndWait:async()=>{
  const emit=event=>{for(const fn of handlers)fn(event)};
  emit({type:'assistant.message_delta',data:{messageId:'1',deltaContent:'回答'}});
  const usage={id:'usage-1',type:'assistant.usage',data:{model:'auto-selected',inputTokens:100,outputTokens:12,cacheReadTokens:50}};emit(usage);emit(usage);
  return {data:{content:'回答'}};
 },disconnect:async()=>{disconnected=true;},abort:async()=>{}};
 class Client{constructor(options){clientOptions=options;}async start(){}async getAuthStatus(){return {isAuthenticated:true}}async createSession(value){config=value;return session}async deleteSession(id){deleted=id}async stop(){}}
 const provider=new CopilotProvider({root:'/safe',sdkLoader:async()=>({CopilotClient:Client,defineTool:(name,body)=>({name,...body})})});
 const job={id:'pc-test',partial:'',guideReads:0,webSearches:0};const result=await provider.run(job,{needGuideTool:true,webMode:'disabled',instructions:'private prompt',prompt:'question'});
 assert.equal(config.model,'auto');assert.deepEqual(config.availableTools,['custom:read_trip_guide']);assert.equal(config.enableConfigDiscovery,false);assert.deepEqual(config.includedBuiltinAgents,[]);
 assert.equal(result.usage.input_tokens,100);assert.equal(result.usage.output_tokens,12);assert.equal(result.model,'auto-selected');assert.equal(disconnected,true);assert.equal(deleted,'taiwan-chat-pc-test');assert.equal(clientOptions.mode,'empty');
});
test('Copilot cannot execute commands, read files, or bypass managed approvals',()=>{
 assert.equal(copilotPermission({kind:'shell',command:'cat auth.json'}).kind,'denied-by-rules');
 assert.equal(copilotPermission({kind:'read',path:'/secrets'}).kind,'denied-by-rules');
 assert.equal(copilotPermission({kind:'custom-tool',toolName:'read_trip_guide',managedApprovalRequired:true}).kind,'denied-by-rules');
 assert.equal(copilotPermission({kind:'custom-tool',toolName:'read_trip_guide'}).kind,'approved');
 assert.equal(copilotPermission({kind:'url',url:'http://127.0.0.1:8793'}).kind,'denied-by-rules');
});
