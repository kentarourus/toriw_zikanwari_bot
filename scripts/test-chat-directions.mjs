import {useGeneratedMapLinks} from '../private-taiwan-cli/runner/directions.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readDirections,handle,readGuide} from '../private-taiwan-cli/runner/guide-mcp.mjs';
import {guidePolicyFor} from '../private-taiwan-cli/runner/context-policy.mjs';
import {copilotPermission} from '../private-taiwan-cli/daemon/copilot-provider.mjs';

test('hotel routes use the address in the Markdown and encode destination safely',()=>{
 const route=readDirections({destination:'台北101 台北市 & test=1',originType:'hotel',mode:'transit'}),url=new URL(route.url);
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/maps/dir/');assert.equal(url.searchParams.get('api'),'1');
 assert.equal(url.searchParams.get('origin'),'台北市中正区秀山街 4号');assert.equal(url.searchParams.get('travelmode'),'transit');
 assert.equal(url.searchParams.get('destination'),'台北101 台北市 & test=1');assert.equal(url.searchParams.has('test'),false);
 assert.equal(route.routeComputed,false);assert.match(route.notice,/所要時間/);
});
test('current location is resolved by Maps instead of inventing or automatically sharing coordinates',()=>{
 const route=readDirections({destination:'台北駅 台湾',originType:'current',origin:'imagined coordinates',mode:'walking'});
 assert.equal(new URL(route.url).searchParams.has('origin'),false);
 assert.match(route.origin,/端末の現在地/);
});
test('explicit origins and invalid input are handled without executing commands or fetching URLs',()=>{
 const route=readDirections({destination:'西門駅 台北',originType:'place',origin:'台北駅 台湾',mode:'walking'});
 assert.equal(new URL(route.url).searchParams.get('origin'),'台北駅 台湾');
 for(const args of [{destination:'',originType:'current',mode:'walking'},{destination:'台北駅',originType:'place',mode:'transit'},{destination:'台北駅',originType:'current',mode:'flying'}])assert.throws(()=>readDirections(args));
 const result=handle({id:3,method:'tools/call',params:{name:'get_map_directions',arguments:{destination:'台北101 台湾',originType:'hotel',mode:'transit'}}});
 assert.equal(JSON.parse(result.result.content[0].text).routeComputed,false);
 assert.equal(copilotPermission({kind:'custom-tool',toolName:'get_map_directions'}).kind,'approved');
 assert.equal(copilotPermission({kind:'custom-tool',toolName:'anything_else'}).kind,'denied-by-rules');
});
test('route tools are available for route questions and school citations point at each source page',()=>{
 assert.equal(guidePolicyFor([{role:'user',content:'ホテルから台北101まで公共交通で行きたい'}]).needDirections,true);
 assert.equal(guidePolicyFor([{role:'user',content:'ここから徒歩でホテルへ帰る経路を教えて'}]).needDirections,true);
 assert.equal(guidePolicyFor([{role:'user',content:'こんにちは'}]).needDirections,false);
 const page=readGuide('hotel_rules').sourcePages.find(page=>page.pdf===11);
 assert.match(page.url,/#source-page-11$/);
});

test('model-altered map parameters are replaced by the exact generated URL',()=>{
 const link=readDirections({destination:'台北101 台湾',originType:'hotel',mode:'transit'});
 const altered=link.url+'&origin=wrong&mode=walking';
 assert.equal(useGeneratedMapLinks('[地図]('+altered+')',[link]),'[地図]('+link.url+')');
 assert.ok(useGeneratedMapLinks('地図で確認してください。',[link]).includes(link.url));
});
import {mapSearch} from '../private-taiwan-cli/runner/directions.mjs';
test('Maps search links safely encode place queries without claiming fetched results',()=>{const r=mapSearch({query:'台北 西門町 カフェ & test=1'}),u=new URL(r.url);assert.equal(u.pathname,'/maps/search/');assert.equal(u.searchParams.get('query'),'台北 西門町 カフェ & test=1');assert.equal(u.searchParams.has('test'),false);assert.equal(r.resultsFetched,false);assert.throws(()=>mapSearch({query:''}));});
