import {test} from 'node:test';
import assert from 'node:assert/strict';
import {elapsed,stageFor} from '../dist/taiwan-chat/progress.js';
test('elapsed time and real stages are shown without inventing progress percentages',()=>{
 assert.equal(elapsed(1000,65000),'1分4秒');assert.equal(elapsed(1000,0),'0秒');
 assert.equal(stageFor({stage:'answering'}),'answering');
 assert.equal(stageFor({status:'queued'}),'queued');
 assert.equal(stageFor({status:'in_progress'}),'preparing');
});
