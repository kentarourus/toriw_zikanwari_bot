import {test} from 'node:test';import assert from 'node:assert/strict';
import {normaliseUsage,sumUsage} from '../dist/taiwan-chat/usage.js';
test('cached and reasoning tokens are subsets, not added a second time',()=>{
 const usage={input_tokens:100,output_tokens:40,cached_input_tokens:80,reasoning_output_tokens:20};
 assert.equal(sumUsage([{role:'assistant',usage}]).total,140);
 assert.equal(sumUsage([{role:'assistant',usage},{role:'assistant',usage}]).cached,160);
});
test('missing and invalid usage stays unknown rather than a made-up zero',()=>{
 assert.equal(normaliseUsage(null),null);assert.equal(normaliseUsage({input_tokens:-1,output_tokens:0}),null);
 assert.deepEqual(sumUsage([{role:'assistant',content:'old'}]),{count:0,unknown:1,input:0,output:0,cached:null,total:0});
});
