import {test} from 'node:test';import assert from 'node:assert/strict';
import {handle,readGuide} from '../private-taiwan-cli/runner/guide-mcp.mjs';
import {webModeFor,selectGuideTopics} from '../private-taiwan-cli/runner/context-policy.mjs';
test('guide tool returns only requested hotel section, not all itinerary',()=>{
 const data=readGuide('hotel');assert.deepEqual(Object.keys(data.sections),['hotel']);assert.match(data.sections.hotel,/ミッドタウン/);assert.ok(!JSON.stringify(data).includes('06:30'));
 assert.throws(()=>readGuide('../../auth/auth.json'));
});
test('MCP discovery and calls work without exposing arbitrary file access',()=>{
 const tools=handle({id:1,method:'tools/list'}).result.tools;assert.equal(tools.length,1);assert.equal(tools[0].name,'read_trip_guide');
 const answer=handle({id:2,method:'tools/call',params:{name:'read_trip_guide',arguments:{topic:'day3'}}});assert.match(answer.result.content[0].text,/12:00～13:00/);
 assert.equal(handle({method:'notifications/initialized'}),null);
});
test('greetings and school facts omit web tools; current public facts retain search',()=>{
 for(const content of ['こんにちは','今回泊まるホテル名だけ教えて','班別研修の帰着は何時？'])assert.equal(webModeFor([{role:'user',content}]),'disabled');
 for(const content of ['ホテル周辺のおすすめを教えて','台北の最新の天気','営業時間を調べて'])assert.equal(webModeFor([{role:'user',content}]),'live');
});

test('only relevant school sections are selected and generic chat has none',()=>{
 assert.deepEqual(selectGuideTopics([{role:'user',content:'こんにちは'}]),[]);
 assert.deepEqual(selectGuideTopics([{role:'user',content:'今回泊まるホテル名だけ'}]),['hotel']);
 assert.deepEqual(selectGuideTopics([{role:'user',content:'出発前の準備は？'}]),['packing']);
 assert.deepEqual(selectGuideTopics([{role:'user',content:'班別研修の帰着は何時？'}]),['day3']);
 assert.equal(webModeFor([{role:'user',content:'ホテルのこと。検索はいりません'}]),'disabled');
});
