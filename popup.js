import {parsePlaylist} from './hls.mjs';
import {getPlaylist} from './network.mjs';
import {selectFHD,currentCandidates,pageKey,resolutionFromURL} from './selection.mjs';
import {ACTIVE} from './engine.mjs';
const $=id=>document.getElementById(id);
let tab=null,entries=[],ready=null,variants=[],job={status:'idle'},preparing=false,readController=null,revision=0,debounce,lastSignature='',nameRoute='',nameEdited=false,starting=false;
function error(text=''){ $('error').hidden=!text;$('error').textContent=String(text).replace(/https?:\/\/\S+/g,'[URL đã ẩn]'); }
function busy(){return ACTIVE.includes(job.status);}
function draw(){
  $('download').disabled=busy()||preparing||starting||!ready;
  $('download').textContent=starting?'Đang xác nhận bài…':busy()?'Đang tải nền…':preparing?'Đang đọc playlist…':ready?`Tải ${ready.resolution==='1920x1080'?'Full HD':ready.resolution||'video'}`:'Chưa nhận diện video';
}
function drawJob(state){
  job=state||{status:'idle'};$('job').hidden=job.status==='idle';
  $('jobTitle').textContent=job.filename||'Tiến độ tải';$('jobStatus').textContent=job.message||'';
  $('progress').value=job.progress||0;$('cancel').hidden=!busy();draw();
}
async function bg(type,payload={}){
  const response=await chrome.runtime.sendMessage({target:'background',type,...payload});
  if(!response?.ok)throw new Error(response?.error||'Không liên lạc được bộ tải nền.');return response.result;
}

async function syncLessonName(live,strict=false){
  const route=pageKey(live.url);
  const meta=await chrome.tabs.sendMessage(live.id,{type:'GET_CURRENT_LESSON'}).catch(()=>null);
  if(meta&&(meta.pageKey!==route||meta.status==='transition')){
    $('nameSource').textContent='Trang đang chuyển bài. Chờ tên bài cập nhật rồi bấm Làm mới.';
    if(strict)throw new Error('Tên bài và URL chưa khớp. Chờ trang chuyển bài xong rồi bấm Làm mới.');
    return;
  }
  if(route!==nameRoute){nameRoute=route;nameEdited=false;}
  const fromLesson=meta?.status==='ok';
  const title=fromLesson?meta.title:(live.title||'bai-hoc').replace(/\s*[|–-]\s*Udemy.*$/i,'');
  $('title').textContent=title;
  $('nameSource').textContent=fromLesson?'Tên lấy từ bài đang chọn trong danh sách.':'Chưa đọc được tên bài; đang dùng tiêu đề tab. Tải lại trang Udemy hoặc sửa tên trong Tùy chọn.';
  if(!nameEdited)$('filename').value=title.slice(0,120);
}
$('filename').addEventListener('input',()=>{nameEdited=true;});

function summary(p,resolution){
  const seconds=Math.round(p.duration),note=resolution&&resolution!=='1920x1080'?' · Không có FHD trong lựa chọn này':'';
  $('qualityBadge').textContent=resolution==='1920x1080'?'Full HD · 1920×1080':resolution?resolution:'Media playlist';
  $('info').textContent=`${p.segments.length} đoạn · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}${note}`;
}
async function setVariant(v,signal,rev){
  const sourceRoute=pageKey(tab?.url);
  const p=await getPlaylist(v.url,signal);if(rev!==revision)return;
  if(p.kind!=='media')throw new Error('Playlist lồng nhiều cấp chưa được hỗ trợ.');
  ready={url:v.url,resolution:v.resolution,sourceRoute};summary(p,v.resolution);
}
async function accept(p,{url,text,base},signal,rev){
  variants=[];$('quality').replaceChildren();
  if(p.kind==='master'){
    variants=p.variants;
    variants.forEach((v,i)=>$('quality').add(new Option(v.resolution,String(i))));
    const best=selectFHD(variants);$('quality').value=String(variants.indexOf(best));$('quality').disabled=false;
    await setVariant(best,signal,rev);
  }else{
    const resolution=resolutionFromURL(url||p.segments[0].url);
    $('quality').add(new Option(resolution||'Theo media playlist','0'));$('quality').disabled=true;
    ready=text?{text,base,resolution,sourceRoute:pageKey(tab?.url)}:{url,resolution,sourceRoute:pageKey(tab?.url)};summary(p,resolution);
  }
}
async function read(load){
  const rev=++revision;readController?.abort();readController=new AbortController();const signal=readController.signal;
  preparing=true;ready=null;error();draw();
  try{await load(signal,rev);}catch(e){if(rev===revision){ready=null;error(e.message||e);}}
  finally{if(rev===revision){preparing=false;draw();}}
}
async function reload(force=false){
  if(!tab)return;
  const live=await chrome.tabs.get(tab.id).catch(()=>null);if(!live)return;
  if(pageKey(live.url)!==pageKey(tab.url)){++revision;readController?.abort();ready=null;preparing=false;draw();}
  tab=live;
  await syncLessonName(live);
  const data=await chrome.storage.session.get(`tab_${tab.id}`);
  entries=(data[`tab_${tab.id}`]||[]).filter(e=>!e.pageKey||e.pageKey===pageKey(tab.url));
  const old=$('captures').value;$('captures').replaceChildren();
  if(!entries.length)$('captures').add(new Option('Chưa có playlist — tải lại Udemy và phát bài',''));
  entries.forEach((e,i)=>$('captures').add(new Option(`${new Date(e.time).toLocaleTimeString('vi-VN')} · ${resolutionFromURL(e.url)||'Playlist tổng'}`,String(i))));
  if(entries[Number(old)]&&old!=='')$('captures').value=old;
  const signature=JSON.stringify(entries.map(e=>e.url));
  if(!force&&signature===lastSignature)return;lastSignature=signature;
  if(!entries.length){++revision;readController?.abort();preparing=false;ready=null;$('info').textContent='Tải lại tab Udemy và phát bài để nhận diện video.';draw();return;}
  await read(async(signal,rev)=>{
    const candidates=currentCandidates(entries,pageKey(tab.url));let lastError;
    for(const candidate of candidates){
      try{
        const p=await getPlaylist(candidate.url,signal);if(rev!==revision)return;
        await accept(p,{url:candidate.url},signal,rev);if(rev!==revision)return;
        $('captures').value=String(entries.indexOf(candidate));return;
      }catch(e){if(signal.aborted)throw e;lastError=e;}
    }
    throw lastError||new Error('Chưa nhận diện được bài hiện tại.');
  });
}
$('refresh').onclick=()=>reload(true).catch(e=>error(e.message));
$('quality').onchange=()=>{
  const v=variants[Number($('quality').value)];if(v)read((signal,rev)=>setVariant(v,signal,rev));
};
$('captures').onchange=()=>{
  const e=entries[Number($('captures').value)];if(!e)return;
  read(async(signal,rev)=>{const p=await getPlaylist(e.url,signal);if(rev===revision)await accept(p,{url:e.url},signal,rev);});
};
$('import').onclick=()=>read(async(signal,rev)=>{
  const f=$('file').files[0],base=$('manualUrl').value.trim();
  if(f){if(f.size>2*1024*1024)throw new Error('File playlist vượt 2 MiB.');const text=await f.text();if(rev===revision)await accept(parsePlaylist(text,base||undefined),{text,base:base||undefined},signal,rev);}
  else{if(!base)throw new Error('Chọn file hoặc nhập URL.');const p=await getPlaylist(base,signal);if(rev===revision)await accept(p,{url:base},signal,rev);}
});
$('download').onclick=async()=>{
  if(!ready||busy()||preparing||starting)return;
  const snapshot=ready;
  starting=true;draw();error();
  try{
    const live=tab?await chrome.tabs.get(tab.id):null;
    if(live){
      if(pageKey(live.url)!==snapshot.sourceRoute)throw new Error('Bạn đã chuyển bài. Bấm Làm mới để nhận diện playlist và tên bài mới.');
      await syncLessonName(live,true);
      const check=await chrome.tabs.get(live.id);
      if(pageKey(check.url)!==snapshot.sourceRoute||snapshot!==ready)throw new Error('Bài học vừa thay đổi. Bấm Làm mới rồi tải lại.');
    }
    const request={...snapshot,filename:$('filename').value,tabId:tab?.id,label:snapshot.resolution};
    drawJob({status:'preparing',message:'Bắt đầu tải nền…',progress:0});
    drawJob(await bg('START',{request}));
  }catch(e){error(e.message);drawJob(await bg('GET_STATE').catch(()=>({status:'idle'})));}
  finally{starting=false;draw();}
};
$('cancel').onclick=async()=>{try{drawJob(await bg('CANCEL'));}catch(e){error(e.message);}};
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='session')return;
  if(changes.job)drawJob(changes.job.newValue);
  if(tab&&changes[`tab_${tab.id}`]){clearTimeout(debounce);debounce=setTimeout(()=>reload().catch(e=>error(e.message)),250);}
});
window.addEventListener('pagehide',()=>readController?.abort());
try{
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  $('title').textContent=tab?.title||'Mở popup trên tab Udemy';
  if(tab)$('filename').value=(tab.title||'bai-hoc').replace(/\s*[|–-]\s*Udemy.*$/i,'').slice(0,120);
  // The worker and offscreen document own the download after START is accepted.
  await Promise.all([bg('GET_STATE').then(drawJob),reload(true)]);
}catch(e){error(e.message);draw();}
