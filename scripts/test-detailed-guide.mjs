import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {readGuide,readGuides} from '../private-taiwan-cli/runner/guide-mcp.mjs';
const markdown=await fs.readFile('dist/taiwan/guide.md','utf8');const html=await fs.readFile('dist/taiwan/guide/index.html','utf8');
const compact=s=>s.replace(/\s/g,'');
test('all 34 original PDF pages remain individually traceable',()=>{
 const pages=[...markdown.matchAll(/<!-- source-page:(\d+) -->/g)].map(m=>Number(m[1]));assert.deepEqual(pages,Array.from({length:34},(_,i)=>i+1));
 for(const page of pages)assert.ok(html.includes(`id="source-page-${page}"`));assert.equal(readGuide('all').sourcePages.length,34);
});
test('full packing list and exact baggage values are retained',()=>{
 const text=compact(readGuide('packing').sections.packing);
 for(const marker of [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑'])assert.ok(text.includes(marker),marker);
 for(const value of ['115cm','7kg','158cm','23kg','160Wh','100㎖','１ℓ'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes('オンライン入国カード'));
});
test('rules, uncertain fields and conflicting duty-free passages are not invented or silently corrected',()=>{
 assert.match(compact(readGuide('devices').sections.devices),/通信機能は使用不可/);
 assert.match(compact(readGuide('shopping').sections.shopping),/免税品.*購入を禁止する/s);
 assert.match(compact(readGuide('shopping').sections.shopping),/免税店で買い物可/);
 assert.match(readGuide('hotel_rules').sections.hotel_rules,/●階/);
 assert.match(markdown,/我相退掉这件商品/);
 assert.ok(!/0[789]0[-－][0-9０-９]{4}[-－][0-9０-９]{4}/.test(markdown));
});
test('source figures are preserved and their content is not guessed by the lookup tool',async()=>{
 const figures=[...markdown.matchAll(/!\[[^\]]*\]\((guide-assets\/[^)]+)\)/g)].map(m=>m[1]);assert.equal(figures.length,7);
 for(const file of figures)assert.ok((await fs.stat('dist/taiwan/'+file)).size>0);
 assert.match(readGuide('transport').sections.transport,/原本の図/);assert.match(readGuide('transport').url,/#source-page-29$/);
});

test('overlapping selected topics send each source page only once',()=>{
 const result=readGuides(['baggage','devices']);assert.deepEqual(result.sourcePages.map(p=>p.pdf),[7,8,10,11]);assert.equal(Object.keys(result.sections).length,4);
});
