import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storageKey,readStore,contextFor,createChat} from '../dist/taiwan-chat/chat-store.js';

test('conversations, full replies and active conversation survive reload',()=>{
 const first=createChat(),second=createChat();
 first.messages=[{role:'user',content:'持ち物は？'},{role:'assistant',content:'回答'.repeat(3000)}];
 const data={chats:[first,second],active:first.id};
 const restored=readStore({getItem:key=>key===storageKey?JSON.stringify(data):null});
 assert.deepEqual(restored,data);
 assert.equal(restored.chats[0].messages[1].content.length,6000);
});
test('bounded AI context does not truncate stored conversation',()=>{
 const chat=createChat();chat.messages=Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:String(i).padEnd(2500,'文')}));
 const original=JSON.stringify(chat);
 const context=contextFor(chat);
 assert.equal(context.length,7);assert.ok(context.every(m=>m.content.length<=1500));
 assert.equal(context[0].content[0],'5');assert.equal(JSON.stringify(chat),original);
});
test('corrupt or inaccessible storage starts safely',()=>{
 for(const storage of [undefined,{getItem:()=>'{broken'},{getItem:()=>{throw Error('blocked')}}])assert.deepEqual(readStore(storage),{chats:[],active:null});
 const chat=createChat();const restored=readStore({getItem:()=>JSON.stringify({active:'deleted',chats:[{id:'invalid'},chat]})});
 assert.equal(restored.active,chat.id);assert.equal(restored.chats.length,1);
});
