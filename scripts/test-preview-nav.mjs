import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
 const make=()=>({handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)},fire(type,event={}){for(const fn of this.handlers[type]??[])fn(event)},style:{values:{},getPropertyValue(k){return this.values[k]??''},setProperty(k,v){this.values[k]=v},removeProperty(k){delete this.values[k]}},classList:{values:new Set,add(k){this.values.add(k)},remove(k){this.values.delete(k)}},dataset:{}});
 const nav=make();nav.clientLeft=1;nav.getBoundingClientRect=()=>({left:0});nav.captured=null;nav.setPointerCapture=id=>nav.captured=id;nav.hasPointerCapture=id=>nav.captured===id;nav.releasePointerCapture=()=>nav.captured=null;nav.contains=t=>t===nav;
 const hashes=['#timetable','#announcements','#related-links'];
 const sections=hashes.map((hash,i)=>({id:hash.slice(1),getBoundingClientRect:()=>({top:i*700}),scrollIntoView(){}}));
 const links=hashes.map((hash,i)=>Object.assign(make(),{hash,textContent:hash,offsetLeft:8+i*105,offsetWidth:100,attrs:{},getBoundingClientRect:()=>({left:9+i*105,width:100}),setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},removeAttribute(k){delete this.attrs[k]},replaceChildren(){},insertAdjacentHTML(){}}));
 nav.querySelectorAll=()=>links;
 const win=Object.assign(make(),{scrollY:0,innerHeight:700});
 const doc={querySelector:s=>s==='.mobile-nav'?nav:sections[hashes.indexOf(s)],createElement:()=>({}),documentElement:{scrollHeight:2400}};
 const context={document:doc,window:win,matchMedia:()=>({matches:true}),setTimeout:()=>1,clearTimeout(){},Date};
 const source=fs.readFileSync('dist/test/assets/js/pwa.js','utf8');vm.runInNewContext(source.slice(source.indexOf("const nav=document.querySelector")),context);
 const down=(x=30,id=1)=>nav.fire('pointerdown',{clientX:x,clientY:20,pointerId:id,isPrimary:true,button:0});
 const move=(x,id=1)=>nav.fire('pointermove',{clientX:x,clientY:20,pointerId:id});
 const up=(x,id=1)=>nav.fire('pointerup',{clientX:x,clientY:20,pointerId:id});
 return {nav,links,win,down,move,up};
}
test('tap stays selected during programmatic scrolling',()=>{const {links,win}=setup();links[2].fire('click');win.fire('scroll');assert.equal(links[2].attrs['aria-current'],'location');win.fire('wheel');win.fire('scroll');assert.equal(links[0].attrs['aria-current'],'location');});
test('short drag suppresses follow-up click and clears drag state',()=>{const {nav,down,move,up}=setup();down();move(45);up(45);let prevented=false;nav.fire('click',{preventDefault(){prevented=true},stopImmediatePropagation(){}});assert.equal(prevented,true);assert.equal(nav.classList.values.has('is-dragging'),false);assert.equal(nav.style.values['--drag-x'],undefined);});
test('foreign pointer is ignored and cancellation cleans up',()=>{const {nav,down,move}=setup();down();move(200,2);assert.equal(nav.captured,null);move(100);assert.equal(nav.captured,1);nav.fire('pointercancel');assert.equal(nav.style.values['--drag-x'],undefined);assert.equal(nav.classList.values.has('is-dragging'),false);});
test('full-width swipe reaches final tab using measured spacing',()=>{const {nav,links,down,move,up}=setup();down(30);move(240);up(240);assert.equal(links[2].attrs['aria-current'],'location');assert.equal(nav.style.values['--slider-x'],'218px');});
