import {test} from 'node:test';import assert from 'node:assert/strict';
import {handle,readGuidePages,readGuide,readGuides} from '../private-taiwan-cli/runner/guide-mcp.mjs';
import {webModeFor,selectGuideTopics,guidePolicyFor} from '../private-taiwan-cli/runner/context-policy.mjs';
test('guide tool returns only requested hotel section, not all itinerary',()=>{
 const data=readGuide('hotel');assert.deepEqual(Object.keys(data.sections),['hotel']);assert.match(data.sections.hotel,/ミッドタウン/);assert.ok(!JSON.stringify(data).includes('06:30'));
 assert.throws(()=>readGuide('../../auth/auth.json'));
});

test('hotel floor movement questions prefetch the actual school restrictions',()=>{
 for(const content of ['ホテル内の階をまたぐ移動は可能？','別の階に行ってもいい？','館内のフロア移動について','他の部屋に遊びに行っていい？','ホテルのエレベーターは使える？']){
  const policy=guidePolicyFor([{role:'user',content}]);
  assert.ok(policy.topics.includes('hotel_rules'),content);
  assert.equal(policy.needGuideTool,true);
  assert.equal(policy.webMode,'disabled');
  const text=JSON.stringify(readGuides(policy.topics));
  assert.match(text,/別階のフロア/);
  assert.match(text,/非常時を除き使用/);
 }
});

test('prefetch never prevents additional Markdown lookup, including follow-up corrections',()=>{
 for(const content of ['ホテル名は？','本当に記載がない？','こんにちは','今回の決まりについて確認して'])assert.equal(guidePolicyFor([{role:'user',content}]).needGuideTool,true);
 const policy=guidePolicyFor([{role:'user',content:'ホテルの階をまたぐ移動は可能？'},{role:'assistant',content:'資料に記載はありません。'},{role:'user',content:'本当に？しおりを確認して'}]);
 assert.ok(policy.topics.includes('hotel_rules'));
 assert.match(JSON.stringify(readGuides(policy.topics)),/別階のフロア/);
});
test('MCP discovery and calls work without exposing arbitrary file access',()=>{
 const tools=handle({id:1,method:'tools/list'}).result.tools;assert.equal(tools.length,3);assert.equal(tools[0].name,'read_trip_guide');
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

test('Hydrogen gets the page text and matching source links before answering',()=>{
 const question='しおりの「5,000円単位」って何？';
 const selected=selectGuideTopics([{role:'user',content:question}]);
 const context=readGuidePages(selected,question);
 const exchange=context.pages.find(page=>page.pdf===6);
 assert.match(exchange.text,/5,000円単位/);
 assert.match(exchange.url,/#source-page-6$/);
 const hotel=readGuidePages(['hotel_rules'],'別の階に行っていい？');
 assert.match(hotel.pages.find(page=>page.pdf===11).text,/別階のフロア/);
 assert.equal(readGuidePages([],'こんにちは'),null);
 assert.equal(readGuidePages(['all'],'しおり全体を見せて').pages.length,34);
});
