import {test} from 'node:test';import assert from 'node:assert/strict';
import {weatherContext} from '../private-taiwan-cli/runner/weather.mjs';
test('ordinary questions skip weather calls',async()=>{assert.equal(await weatherContext([{role:'user',content:'集合時間は？'}],()=>{throw Error('must not fetch')}),'');});
test('weather facts keep forecast dates, nulls, location and attribution',async()=>{
 let requested;const result=await weatherContext([{role:'user',content:'九份で明日は傘いる？'}],async url=>{requested=url;return Response.json({current:{time:'2026-11-16T13:00',temperature_2m:22},daily:{time:['2026-11-17'],temperature_2m_max:[23],temperature_2m_min:[19],precipitation_probability_max:[null]}});});
 assert.equal(requested.searchParams.get('timezone'),'Asia/Taipei');assert.equal(requested.searchParams.get('latitude'),'25.109');assert.match(result,/九份/);assert.match(result,/2026-11-17/);assert.match(result,/"rainPercent":null/);assert.match(result,/期間外/);assert.match(result,/Open-Meteo/);
});
test('weather outages are explicit instead of fabricating a forecast',async()=>{const result=await weatherContext([{role:'user',content:'台北の天気'}],async()=>{throw Error('offline')});assert.match(result,/取得できませんでした/);});
