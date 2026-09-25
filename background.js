import {pageKey} from './selection.mjs';
let queue=Promise.resolve(),creating=null;
const trusted=sender=>sender.id===chrome.runtime.id&&sender.url?.startsWith(chrome.runtime.getURL(''));
chrome.webRequest.onCompleted.addListener(d=>{
  if(d.tabId<0||d.statusCode>=400)return;
  const u=new URL(d.url);if(!u.pathname.toLowerCase().endsWith('.m3u8'))return;
  queue=queue.then(async()=>{
    const tab=await chrome.tabs.get(d.tabId),key=`tab_${d.tabId}`,identity=u.origin+u.pathname;
    const route=pageKey(tab.url),data=await chrome.storage.session.get(key);
    const entries=(data[key]||[]).filter(e=>e.identity!==identity&&e.pageKey===route);
    entries.unshift({url:d.url,identity,time:Date.now(),pageKey:route});
    await chrome.storage.session.set({[key]:entries.slice(0,40)});
  }).catch(()=>{});
},{urls:['https://*.udemy.com/*','https://*.udemycdn.com/*']});
chrome.tabs.onRemoved.addListener(id=>{queue=queue.then(()=>chrome.storage.session.remove(`tab_${id}`)).catch(()=>{});});
async function ensureEngine(){
  if(creating)return creating;
  creating=(async()=>{
    const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]});
    if(!contexts.length)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Assemble and retain video Blob until the download finishes, even after the popup closes.'});
  })();
  try{await creating;}finally{creating=null;}
}
async function engine(type,data={}){
  await ensureEngine();
  const r=await chrome.runtime.sendMessage({target:'engine',type,...data});
  if(!r?.ok)throw new Error(r?.error||'Không liên lạc được bộ tải nền.');return r.result;
}
async function setState(state){
  await chrome.storage.session.set({job:state});
  const busy=['preparing','downloading','saving'].includes(state.status);
  await chrome.action.setBadgeText({text:busy?`${Math.floor(state.progress||0)}%`:state.status==='complete'?'✓':state.status==='error'?'!':''});
  await chrome.action.setBadgeBackgroundColor({color:state.status==='error'?'#a83e3e':'#17765c'});
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m.target!=='background'||!trusted(sender))return;
  (async()=>{
    const fromEngine=sender.url===chrome.runtime.getURL('offscreen.html');
    if(m.type==='ENGINE_STATE'&&fromEngine){await setState(m.state);return;}
    if(m.type==='SAVE_FILE'&&fromEngine){
      if(!m.data.url.startsWith(`blob:${chrome.runtime.getURL('')}`))throw new Error('Blob không hợp lệ.');
      const id=await chrome.downloads.download({url:m.data.url,filename:`Udemy/${m.data.filename}`,saveAs:false,conflictAction:'uniquify'});
      await chrome.storage.session.set({[`download_${id}`]:m.data.id});
      const [item]=await chrome.downloads.search({id});
      if(item?.state!=='in_progress')await chrome.storage.session.remove(`download_${id}`);
      return {id,state:item?.state};
    }
    if(m.type==='CANCEL_DISK'&&fromEngine){await chrome.downloads.cancel(m.id).catch(()=>{});return;}
    if(m.type==='GET_STATE'){
      const state=await engine('GET_STATE');
      await setState(state);return state;
    }
    if(m.type==='START')return engine('START',{request:m.request});
    if(m.type==='CANCEL')return engine('CANCEL');
    throw new Error('Yêu cầu không hợp lệ.');
  })().then(result=>reply({ok:true,result}),e=>reply({ok:false,error:String(e.message||e).replace(/https?:\/\/\S+/g,'[URL đã ẩn]')}));return true;
});
chrome.downloads.onChanged.addListener(delta=>{
  if(!delta.state||!['complete','interrupted'].includes(delta.state.current))return;
  (async()=>{
    const key=`download_${delta.id}`,data=await chrome.storage.session.get(key);
    if(!data[key])return;
    await engine('FINISH',{jobId:data[key],state:delta.state.current});await chrome.storage.session.remove(key);
  })().catch(()=>{});
});
