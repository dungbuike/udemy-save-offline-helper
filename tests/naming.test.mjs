import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as selection from '../selection.mjs';
import {ACTIVE} from '../engine.mjs';
const route='https://www.udemy.com/course/test/learn/lecture/35038620';
const content=readFileSync(new URL('../lesson-content.js',import.meta.url),'utf8');
function lesson(rows,url=route){
 let listener;
 const context={URL,location:{href:url},chrome:{runtime:{id:'test',onMessage:{addListener:f=>listener=f}}},document:{querySelectorAll:selector=>{
  assert.equal(selector,'li[aria-current="true"]');
  return rows.map(({title,id})=>({querySelector:s=>s==='[data-purpose="item-title"]'?{textContent:title}:id?{id:'item-completion-state-'+id}:null}));
 }}};
 vm.runInNewContext(content,context);let result;listener({type:'GET_CURRENT_LESSON'},{id:'test'},r=>result=r);return result;
}
test('user HTML fields: aria-current row / item-title produce numbered lesson title',()=>{
 const r=lesson([{title:'161. Rekognition Overview',id:'35038620'}]);
 assert.equal(r.status,'ok');assert.equal(r.title,'161. Rekognition Overview');assert.equal(r.lectureId,'35038620');
});
test('reject stale selected row while lecture URL has changed; accept duplicate same lesson',()=>{
 assert.equal(lesson([{title:'Old lesson',id:'42'}]).status,'transition');
 assert.equal(lesson([{title:'161. Rekognition Overview',id:'35038620'},{title:'161. Rekognition Overview',id:'35038620'}]).status,'ok');
 assert.equal(lesson([]).status,'missing');
 assert.equal(lesson([{title:'A'},{title:'B'}]).status,'transition');
});
async function popup(){
 const els=new Map();
 const elem=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',classList:{toggle(){}},options:[],files:[],events:{},addEventListener(t,f){this.events[t]=f;},replaceChildren(){this.options=[];this.value='';},add(o){this.options.push(o);if(this.options.length===1)this.value=o.value;}});return els.get(id);};
 let live={id:1,url:route,title:'Course title | Udemy'},meta={status:'ok',title:'161. Rekognition Overview',pageKey:route};const started=[];
 const entries=[{url:'https://hls-c.udemycdn.com/clip/2/hls/AVC_1920x1080_4800k/index.m3u8',pageKey:route,time:1}];
 const chrome={tabs:{query:async()=>[live],get:async()=>live,sendMessage:async()=>meta},storage:{session:{get:async()=>({tab_1:entries})},onChanged:{addListener(){}}},runtime:{sendMessage:async m=>{
  if(m.type==='START'){started.push(m.request);return {ok:true,result:{status:'downloading',filename:m.request.filename}};}
  return {ok:true,result:{status:'idle'}};
 }}};
 const source=readFileSync(new URL('../popup.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const ctx={...selection,ACTIVE,chrome,document:{getElementById:elem},window:{addEventListener(){}},AbortController,URL,setTimeout,clearTimeout,Option:class{constructor(text,value){this.text=text;this.value=value;}},getPlaylist:async()=>({kind:'media',duration:10,segments:[{url:'https://hls-c.udemycdn.com/clip/2/hls/AVC_1920x1080_4800k/0.ts'}]})};
 await vm.runInNewContext('(async()=>{'+source+'})()',ctx);
 return {elem,started,setLive:v=>live=v,setMeta:v=>meta=v};
}
test('popup displays actual lesson title and preserves manual filename at START',async()=>{
 const p=await popup();assert.equal(p.elem('title').textContent,'161. Rekognition Overview');assert.equal(p.elem('filename').value,'161. Rekognition Overview');
 p.elem('filename').value='Ten toi tu dat';p.elem('filename').events.input();await p.elem('download').onclick();
 assert.equal(p.started.length,1);assert.equal(p.started[0].filename,'Ten toi tu dat');
});
test('re-check lesson before START, freeze selected title; block after navigation',async()=>{
 const p=await popup();p.setMeta({status:'ok',title:'161. Rekognition Overview (updated)',pageKey:route});await p.elem('download').onclick();assert.equal(p.started[0].filename,'161. Rekognition Overview (updated)');
 p.setMeta({status:'ok',title:'Later title',pageKey:route});assert.equal(p.started[0].filename,'161. Rekognition Overview (updated)');
 const q=await popup();q.setLive({id:1,url:route.replace('35038620','35038621'),title:'New lesson'});await q.elem('download').onclick();assert.equal(q.started.length,0);assert.match(q.elem('error').textContent,/chuyển bài/);
});
