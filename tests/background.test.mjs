import test from 'node:test';
import assert from 'node:assert/strict';
// Mock Chrome transport only; run the actual worker, offscreen document and engine.
test('worker/offscreen integration saves after popup disconnect, restores status, never creates a tab',async()=>{
 const listeners=[],downloadListeners=[],store={},blobs=new Map(),created=[],downloads=[];let contexts=[];
 const prefix='chrome-extension://test-extension/';
 const packet=new Uint8Array(564);packet[0]=packet[188]=packet[376]=71;
 const oldFetch=globalThis.fetch,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
 URL.createObjectURL=blob=>{const u='blob:'+prefix+crypto.randomUUID();blobs.set(u,blob);return u;};URL.revokeObjectURL=u=>blobs.delete(u);
 globalThis.fetch=async url=>{
   const body=String(url).endsWith('.m3u8')?'#EXTM3U\n#EXTINF:1,\nhttps://hls-c.udemycdn.com/0.ts\n#EXTINF:1,\nhttps://hls-c.udemycdn.com/1.ts\n#EXT-X-ENDLIST':packet;
   const r=new Response(body);Object.defineProperty(r,'url',{value:url});return r;
 };
 globalThis.chrome={
  runtime:{id:'test-extension',getURL:s=>prefix+s,getContexts:async()=>contexts,onMessage:{addListener:f=>listeners.push(f)},
    sendMessage:m=>new Promise((resolve,reject)=>{
      const isEngine=['ENGINE_STATE','SAVE_FILE','CANCEL_DISK'].includes(m.type);
      const sender={id:'test-extension',url:prefix+(isEngine?'offscreen.html':'popup.html')};
      let handled=false;for(const f of listeners)if(f(m,sender,resolve)===true)handled=true;
      if(!handled)reject(Error('No receiver'));
    })},
  storage:{session:{get:async key=>({[key]:store[key]}),set:async obj=>Object.assign(store,obj),remove:async key=>{delete store[key];}}},
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  tabs:{onRemoved:{addListener:()=>{}},get:async()=>({url:'https://www.udemy.com/course/a/learn/lecture/1'}),create:()=>{throw Error('Must not create tab');}},
  webRequest:{onCompleted:{addListener:()=>{}}},
  offscreen:{createDocument:async options=>{created.push(options);contexts=[{documentUrl:prefix+'offscreen.html'}];await import('../offscreen.js');}},
  downloads:{onChanged:{addListener:f=>downloadListeners.push(f)},download:async options=>{downloads.push(options);assert(blobs.has(options.url));assert.equal((await blobs.get(options.url).arrayBuffer()).byteLength,1128);return 15;},search:async()=>[{id:15,state:'in_progress'}],cancel:async()=>{}}
 };
 try{
  await import('../background.js');
  let reply=await chrome.runtime.sendMessage({target:'background',type:'GET_STATE'});assert.equal(reply.result.status,'idle');assert.equal(created.length,1);
  reply=await chrome.runtime.sendMessage({target:'background',type:'START',request:{url:'https://hls-c.udemycdn.com/a.m3u8',filename:'lesson',tabId:1}});assert.equal(reply.ok,true);
  // No popup listener is kept alive here.
  for(let i=0;i<50&&!store.download_15;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(downloads.length,1);assert.equal(downloads[0].saveAs,false);assert.equal(downloads[0].filename,'Udemy/lesson.ts');assert.equal(store.job.status,'saving');
  for(const listener of downloadListeners)listener({id:15,state:{current:'complete'}});
  for(let i=0;i<50&&store.job.status!=='complete';i++)await new Promise(r=>setTimeout(r,5));
  reply=await chrome.runtime.sendMessage({target:'background',type:'GET_STATE'});assert.equal(reply.result.status,'complete');assert.equal(blobs.size,0);assert.equal(created.length,1);
 }finally{globalThis.fetch=oldFetch;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;delete globalThis.chrome;}
});
