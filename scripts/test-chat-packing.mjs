import {test} from 'node:test';import assert from 'node:assert/strict';
import {packingKey,readPacking,addPackingItems} from '../dist/taiwan/packing-data.js';
import {packingSnapshot,packingProposals} from '../dist/taiwan-chat/packing.js';
function memory(value){const map=new Map(value?[[packingKey,JSON.stringify(value)]]:[]);return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
test('checklist sharing preserves custom names and checks and stays within input budget',()=>{
 const store=memory({carry:[{id:'passport',text:'パスポート確認済み',checked:true}],luggage:Array.from({length:80},(_,i)=>({id:'item'+i,text:'自分の持ち物'+i,checked:false}))});
 const snapshot=packingSnapshot(store);assert.ok(snapshot.content.length<=950);assert.equal(snapshot.checked,1);assert.equal(snapshot.unchecked,80);assert.match(snapshot.content,/省略/);assert.match(snapshot.content,/未｜荷物｜自分の持ち物/);
});
test('validated proposals are shown separately without writing to checklist',()=>{
 const result=packingProposals('提案です。\n```packing-suggestions\n[{"group":"carry","text":"折りたたみ傘"}]\n```');assert.equal(result.text.trim(),'提案です。');assert.deepEqual(result.suggestions,[{group:'carry',text:'折りたたみ傘'}]);
 assert.equal(packingProposals('```packing-suggestions\n[{"group":"bad","text":"x"}]\n```').suggestions.length,0);
});
test('explicit add preserves checked items, deduplicates, and adds proposals unchecked',()=>{
 const store=memory({carry:[{id:'passport',text:'パスポート',checked:true}],luggage:[]});
 assert.deepEqual(addPackingItems(store,[{group:'carry',text:'パスポート'},{group:'luggage',text:'折りたたみ傘'}]),{added:1,skipped:1});
 const items=readPacking(store);assert.equal(items.carry[0].checked,true);assert.equal(items.luggage[0].checked,false);
 assert.equal(addPackingItems(store,[{group:'carry',text:'折りたたみ傘'}]).added,0);
});
