import {test} from 'node:test';import assert from 'node:assert/strict';
import {labels,stageFor} from '../dist/taiwan-chat/progress.js';
test('one short status follows the real stage instead of elapsed time or dashboard steps',()=>{
 assert.equal(labels.queued,'接続中…');assert.equal(labels.reading,'しおりを確認中…');assert.equal(labels.answering,'回答中…');
 assert.equal(stageFor({stage:'searching'}),'searching');assert.equal(stageFor({stage:'reading'}),'reading');assert.equal(stageFor({status:'in_progress'}),'preparing');
});
