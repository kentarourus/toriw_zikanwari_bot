import {test} from 'node:test';import assert from 'node:assert/strict';import {locationAttachment} from '../dist/taiwan-chat/location.js';
test('location attachment includes map, timestamp and accuracy only after explicit selection',()=>{
 const result=locationAttachment({coords:{latitude:25.03301,longitude:121.56541,accuracy:37},timestamp:1794800000000});
 assert.match(result.content,/緯度 25.03301, 経度 121.56541/);assert.match(result.url,/https:\/\/www.google.com\/maps\?q=25.03301,121.56541/);assert.match(result.content,/約37m/);
});
test('invalid coordinates are rejected',()=>{assert.throws(()=>locationAttachment({coords:{latitude:91,longitude:0}}));});
