import {parsePlaylist,safeFilename,collectSegments} from './hls.mjs';
import {getPlaylist,fetchBytes} from './network.mjs';
export const ACTIVE=['preparing','downloading','saving'];
export class DownloadEngine {
  constructor({emit,save,cancelDisk,playlist=getPlaylist,bytes=fetchBytes,createURL=b=>URL.createObjectURL(b),revokeURL=u=>URL.revokeObjectURL(u)}) {
    Object.assign(this,{emit,save,cancelDisk,playlist,bytes,createURL,revokeURL});
    this.state={status:'idle',progress:0};this.controller=null;this.blob=null;this.downloadId=null;
  }
  snapshot(){return {...this.state};}
  async update(patch){Object.assign(this.state,patch);await this.emit(this.snapshot());}
  start(request) {
    if(ACTIVE.includes(this.state.status)) throw new Error('Đang tải một bài khác. Chờ tải xong hoặc hủy trước.');
    this.state={id:crypto.randomUUID(),status:'preparing',progress:0,tabId:request.tabId,filename:safeFilename(request.filename),label:request.label||'',message:'Đang chuẩn bị tải…'};
    this.controller=new AbortController();this.downloadId=null;
    this.task=this.run(request);return this.snapshot();
  }
  release(){if(this.blob)this.revokeURL(this.blob);this.blob=null;this.downloadId=null;this.controller=null;}
  async run(request) {
    try {
      await this.update({});
      const signal=this.controller.signal;
      const p=request.text?parsePlaylist(request.text,request.base):await this.playlist(request.url,signal);
      if(p.kind!=='media') throw new Error('Cần media playlist. Hãy đọc lại playlist trước khi tải.');
      if(signal.aborted)throw new Error('Đã hủy tải.');
      await this.update({status:'downloading',total:p.segments.length,duration:p.duration});
      let pending=Promise.resolve();
      const parts=await collectSegments(p.segments,u=>this.bytes(u,{signal}),{signal,onProgress:({completed,total,bytes})=>{
        // Serialize progress so an older update cannot replace completion state.
        pending=pending.then(()=>this.update({completed,bytes,progress:completed/total*100,message:`Đang tải ${completed}/${total} đoạn · ${(bytes/1048576).toFixed(1)} MiB`}));
      }}).finally(async()=>{await pending;});
      if(signal.aborted)throw new Error('Đã hủy tải.');
      this.blob=this.createURL(new Blob(parts,{type:'video/mp2t'}));parts.length=0;
      await this.update({status:'saving',message:'Đang lưu vào Downloads/Udemy…'});
      const result=await this.save({url:this.blob,filename:this.state.filename,id:this.state.id});
      this.downloadId=result.id;
      if(signal.aborted){await this.cancelDisk(result.id);await this.finish('interrupted',true);return;}
      if(['complete','interrupted'].includes(result.state))await this.finish(result.state);
    } catch(e) {
      const cancelled=this.controller?.signal.aborted;
      this.release();await this.update({status:cancelled?'cancelled':'error',message:cancelled?'Đã hủy tải.':String(e.message||e).replace(/https?:\/\/\S+/g,'[URL đã ẩn]')});
    }
  }
  async finish(state,cancelled=false) {
    if(!ACTIVE.includes(this.state.status))return;
    this.release();await this.update({status:cancelled?'cancelled':state==='complete'?'complete':'error',message:cancelled?'Đã hủy tải.':state==='complete'?'Đã lưu vào Downloads/Udemy.':'Việc lưu file bị gián đoạn hoặc bị hủy.'});
  }
  async cancel(){
    this.controller?.abort();
    if(this.downloadId!==null){await this.cancelDisk(this.downloadId);await this.finish('interrupted',true);}
  }
}
