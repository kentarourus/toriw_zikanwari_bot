import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchStats} from './stats-api.mjs';

test('recovers from temporary 404 and network errors',async()=>{
  let calls=0;const delays=[];
  const result=await fetchStats('https://example.test','test-token',{
    request:async()=>{calls++;if(calls===1)return new Response('Not found',{status:404});if(calls===2)throw new Error('network');return Response.json({hits:[]});},
    wait:async ms=>delays.push(ms)
  });
  assert.deepEqual(result,{hits:[]});assert.equal(calls,3);assert.deepEqual(delays,[10000,20000]);
});
test('authentication failures stop immediately without leaking credentials',async()=>{
  let calls=0;
  await assert.rejects(fetchStats('https://example.test','private-key',{
    request:async()=>{calls++;return new Response('private-key',{status:401});},wait:async()=>assert.fail('must not retry')
  }),/^Error: GoatCounter returned 401\. Existing counts were preserved\.$/);
  assert.equal(calls,1);
});
test('persistent service failure stops after four attempts',async()=>{
  let calls=0;
  await assert.rejects(fetchStats('https://example.test','test-token',{
    request:async()=>{calls++;return new Response('',{status:503});},wait:async()=>{}
  }),/503/);
  assert.equal(calls,4);
});
