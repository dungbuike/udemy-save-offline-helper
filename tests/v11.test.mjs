import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFHD,currentCandidates,assetKey,pageKey} from '../selection.mjs';
import {DownloadEngine} from '../engine.mjs';
const variants=[{resolution:'3840x2160',bandwidth:8000},{resolution:'1920x1080',bandwidth:4000},{resolution:'1920x1080',bandwidth:4500},{resolution:'1280x720',bandwidth:2000}];
test('always prefer actual 1920x1080, best bitrate; explicit fallback when no FHD',()=>{
 assert.equal(selectFHD(variants),variants[2]);assert.equal(selectFHD([variants[3]]),variants[3]);
});
test('choose master for newest asset only; exclude earlier lecture route',()=>{
 const route='https://www.udemy.com/course/a/learn/lecture/2';
 const entry=(path,time,page=route)=>({url:'https://hls-c.udemycdn.com/'+path,time,pageKey:page});
 const old=entry('old/2/hls/main.m3u8',1),master=entry('new/2/hls/main.m3u8',2),media=entry('new/2/hls/AVC_1280x720_2k/index.m3u8',3),other=entry('other/2/hls/main.m3u8',4,'https://www.udemy.com/course/a/learn/lecture/1');
 assert.deepEqual(currentCandidates([other,media,old,master],route),[master,media]);
 assert.equal(assetKey('https://www.udemy.com/assets/123/files/new/2/hls/main.m3u8'),assetKey(media.url));
 assert.equal(pageKey(route+'#overview'),route);
});
const packet=()=>{const a=new Uint8Array(564);a[0]=a[188]=a[376]=71;return a;};
const playlist=async()=>({kind:'media',duration:2,segments:[{url:'https://hls-c.udemycdn.com/a.ts'},{url:'https://hls-c.udemycdn.com/b.ts'}]});
function fixture(overrides={}){
 const states=[],saved=[],revoked=[],cancelled=[];
 const engine=new DownloadEngine({emit:async s=>states.push(s),save:async d=>{saved.push(d);return {id:42,state:'in_progress'};},cancelDisk:async id=>cancelled.push(id),playlist,bytes:async()=>packet(),createURL:()=> 'blob:test',revokeURL:u=>revoked.push(u),...overrides});
 return {engine,states,saved,revoked,cancelled};
}
test('download lives outside popup; state returns immediately; save finishes later',async()=>{
 const f=fixture();const initial=f.engine.start({url:'https://hls-c.udemycdn.com/a.m3u8',filename:'Bai 1',tabId:3});
 assert.equal(initial.status,'preparing');assert.throws(()=>f.engine.start({}),/Đang tải/);
 await f.engine.task;assert.equal(f.engine.snapshot().status,'saving');assert.equal(f.saved.length,1);assert.equal(f.saved[0].filename,'Bai 1.ts');assert.equal(f.revoked.length,0);
 await f.engine.finish('complete');assert.equal(f.engine.snapshot().status,'complete');assert.deepEqual(f.revoked,['blob:test']);
 assert.equal(f.states.at(-1).status,'complete');
});
test('cancel during segment fetch creates no file',async()=>{
 let resume;const waiting=new Promise(r=>resume=r);
 const f=fixture({bytes:async()=>{await waiting;return packet();}});
 f.engine.start({url:'https://hls-c.udemycdn.com/a.m3u8'});
 await new Promise(r=>setTimeout(r,0));await f.engine.cancel();resume();await f.engine.task;
 assert.equal(f.engine.snapshot().status,'cancelled');assert.equal(f.saved.length,0);
});
test('cancel saving calls download API and releases blob',async()=>{
 const f=fixture();f.engine.start({url:'https://hls-c.udemycdn.com/a.m3u8'});await f.engine.task;
 await f.engine.cancel();assert.equal(f.engine.snapshot().status,'cancelled');assert.deepEqual(f.cancelled,[42]);assert.deepEqual(f.revoked,['blob:test']);
});
test('HTTP failure and encrypted imported media never save a video',async()=>{
 const f=fixture({bytes:async()=>{throw Error('HTTP 403');}});f.engine.start({url:'https://hls-c.udemycdn.com/a.m3u8'});await f.engine.task;assert.equal(f.engine.snapshot().status,'error');assert.equal(f.saved.length,0);
 const g=fixture();g.engine.start({text:'#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:1,\nhttps://hls-c.udemycdn.com/a.ts\n#EXT-X-ENDLIST'});await g.engine.task;assert.equal(g.engine.snapshot().status,'error');assert.equal(g.saved.length,0);
});
test('immediate disk completion also releases URL',async()=>{
 const f=fixture({save:async()=>({id:42,state:'complete'})});f.engine.start({url:'https://hls-c.udemycdn.com/a.m3u8'});await f.engine.task;assert.equal(f.engine.snapshot().status,'complete');assert.deepEqual(f.revoked,['blob:test']);
});
