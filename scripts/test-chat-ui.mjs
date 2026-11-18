import {createSmoothText} from '../dist/taiwan-chat/smooth-text.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {packingSnapshot,packingProposals,addPackingItems} from '../dist/taiwan-chat/packing.js';
import {locationAttachment} from '../dist/taiwan-chat/location.js';
import {renderMarkdown} from '../dist/taiwan-chat/markdown.js';
import * as storageModule from '../dist/taiwan-chat/chat-store.js';import * as progressModule from '../dist/taiwan-chat/progress.js';import * as usageModule from '../dist/taiwan-chat/usage.js';
class Element{
 remove(){} constructor(){this.style={};this.handlers={};this.scrollHeight=44;this.clientHeight=44;this.children=[];this.hidden=false;this.value='';this.attributes={};const values=new Set();this.classList={toggle:(key,flag)=>{if(flag??!values.has(key))values.add(key);else values.delete(key);},contains:key=>values.has(key)};}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(key,value){this.attributes[key]=value}removeAttribute(key){delete this.attributes[key]}focus(){}addEventListener(event,handler){this.handlers[event]=handler;}
}
test('a real chat submission saves usage and sidebar can be tucked away without losing history',async()=>{
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};const app=new Element();$('progress-steps').children=Array.from({length:4},()=>new Element());
 let geolocationCalls=0,fetchCalls=0,sentMessages;const navigator={geolocation:{getCurrentPosition:success=>{geolocationCalls++;success({coords:{latitude:25.03,longitude:121.56,accuracy:25},timestamp:1794800000000});}}};
 const values=new Map();const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const document={getElementById:$,querySelector:()=>app,querySelectorAll:()=>[],createElement:()=>new Element(),createTextNode:text=>({textContent:text}),addEventListener(){}};
 const context=vm.createContext({createSmoothText,...storageModule,...progressModule,...usageModule,renderMarkdown,locationAttachment,packingSnapshot,packingProposals,addPackingItems,navigator,document,localStorage:storage,sessionStorage:storage,window:{localStorage:storage,history:{replaceState(){}}},location:{hash:'',pathname:'/taiwan-chat/'},matchMedia:()=>({matches:false}),URL,URLSearchParams,AbortSignal,requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){},confirm:()=>true,
 fetch:async(_url,options)=>{if(String(_url).endsWith('/provider-status'))return Response.json({mode:'auto',label:'Luna medium · Copilot予備'});fetchCalls++;if(options.method==='POST')sentMessages=JSON.parse(options.body).messages;return Response.json(options.method==='POST'?{id:'job',provider:'codex'}:{status:'completed',provider:'copilot',model:'auto',answer:'参照 [公式](https://example.com/)\n```packing-suggestions\n[{"group":"carry","text":"折りたたみ傘"}]\n```',usage:{input_tokens:100,output_tokens:40,cached_input_tokens:80}});}
 });
 const source=(await fs.readFile('dist/taiwan-chat/chat.js','utf8')).replace(/^import .*;\r?\n/gm,'');vm.runInContext(source,context);
 assert.equal($('provider-label').textContent,'GPT-6 Luna');
 $('close-menu').onclick();assert.equal(app.classList.contains('history-collapsed'),true);assert.equal(storage.getItem('taiwan-chat-history-collapsed'),'true');
 $('open-menu').onclick();assert.equal(app.classList.contains('history-collapsed'),false);
 assert.equal(storage.getItem('taiwan-packing-items-2026-v2'),null);$('share-packing').onclick();assert.equal($('packing-preview').hidden,false);assert.equal(fetchCalls,0);$('remove-packing').onclick();assert.equal($('packing-preview').hidden,true);
 assert.equal(geolocationCalls,0);$('share-location').onclick();assert.equal(geolocationCalls,1);assert.equal(fetchCalls,0);assert.equal($('location-preview').hidden,false);$('remove-location').onclick();assert.equal($('location-preview').hidden,true);$('share-location').onclick();
 $('question').value='台北について';await $('chat-form').onsubmit({preventDefault(){}});
 assert.match(sentMessages[0].content,/共有した現在地/);assert.equal($('location-preview').hidden,true);
 assert.equal($('provider-label').textContent,'Copilot');
 const saved=JSON.parse(storage.getItem(storageModule.storageKey));assert.equal(saved.chats[0].messages.length,2);assert.equal(saved.chats[0].messages[1].usage.input_tokens,100);assert.equal(saved.chats[0].messages[1].provider,'copilot');
 assert.match($('usage-summary').textContent,/140/);assert.equal($('progress').hidden,true);assert.equal($('send').disabled,false);
 const assistant=$('messages').children.at(-1);assert.match(assistant.children[1].innerHTML,/<a href="https:\/\/example.com\/"/);assert.match(assistant.children[1].innerHTML,/rel="noopener noreferrer"/);const card=assistant.children.find(x=>x.className==='packing-proposals');assert.ok(card);assert.equal(storage.getItem('taiwan-packing-items-2026-v2'),null);card.children.at(-2).onclick();const packing=JSON.parse(storage.getItem('taiwan-packing-items-2026-v2'));assert.equal(packing.carry.find(x=>x.text==='折りたたみ傘').checked,false);
 $('scroll-area').scrollHeight=1000;$('scroll-area').clientHeight=100;$('scroll-area').scrollTop=100;$('scroll-area').handlers.scroll();vm.runInContext('scrollToLatest()',context);assert.equal($('scroll-area').scrollTop,100);assert.equal($('jump-latest').hidden,false);$('jump-latest').onclick();assert.equal($('scroll-area').scrollTop,1000);assert.equal($('jump-latest').hidden,true);
});
