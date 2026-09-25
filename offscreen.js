import {DownloadEngine} from './engine.mjs';
async function bg(type,payload={}) {
  const r=await chrome.runtime.sendMessage({target:'background',type,...payload});
  if(!r?.ok)throw new Error(r?.error||'Không liên lạc được bộ tải nền.');return r.result;
}
const engine=new DownloadEngine({
  emit:state=>bg('ENGINE_STATE',{state}),
  save:data=>bg('SAVE_FILE',{data}),
  cancelDisk:id=>bg('CANCEL_DISK',{id})
});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m.target!=='engine'||sender.id!==chrome.runtime.id)return;
  Promise.resolve().then(async()=>{
    if(m.type==='GET_STATE')return engine.snapshot();
    if(m.type==='START')return engine.start(m.request);
    if(m.type==='CANCEL'){await engine.cancel();return engine.snapshot();}
    if(m.type==='FINISH'&&m.jobId===engine.state.id){await engine.finish(m.state);return engine.snapshot();}
  }).then(result=>reply({ok:true,result}),e=>reply({ok:false,error:String(e.message)}));return true;
});
