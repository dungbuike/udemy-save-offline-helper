import {allowedURL, parsePlaylist, safeFilename, collectSegments} from './hls.mjs';
const $ = id => document.getElementById(id);
const sourceTab = Number(new URLSearchParams(location.search).get('sourceTab'));
let selected = null, busy = false, controller = null, blobURL = null, downloadId = null;
let captures = [], sourceTitle = 'bai-hoc';
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function lock(value) {
  busy = value;
  for (const id of ['inspect','import','captures','manualUrl','file','filename','clear']) $(id).disabled = value;
  $('quality').disabled = value || !selected || selected.kind !== 'master';
  $('download').disabled = value || !selected;
  $('cancel').disabled = !value;
}
function cleanError(error) {
  if (error?.name === 'AbortError') return 'Đã hủy tải.';
  // Never display signed URLs or browser fetch errors containing addresses.
  return String(error?.message || 'Có lỗi xảy ra.').replace(/https?:\/\/\S+/g, '[URL đã ẩn]');
}
async function fetchBytes(url, {signal, limit = 64*1024*1024} = {}) {
  url = allowedURL(url);
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = new AbortController();
    const abort = () => c.abort();
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');
    signal?.addEventListener('abort', abort, {once:true});
    const timeout = setTimeout(abort, 45000);
    let retry = false;
    try {
      const host = new URL(url).hostname;
      const r = await fetch(url, {credentials: host === 'udemy.com' || host.endsWith('.udemy.com') ? 'include' : 'omit', signal:c.signal, cache:'no-store'});
      allowedURL(r.url);
      if (r.status === 401 || r.status === 403) throw new Error('HTTP '+r.status+': link hết hạn hoặc thiếu quyền truy cập. Phát lại bài trên Udemy rồi lấy playlist mới; hoặc nhập file Response của media playlist.');
      if (!r.ok) {
        retry = r.status === 429 || r.status >= 500;
        throw new Error('Máy chủ trả HTTP '+r.status+'.');
      }
      if (!r.body) throw new Error('Response không có dữ liệu.');
      const reader = r.body.getReader(), parts = []; let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw new Error('Response quá lớn cho bộ nhớ giới hạn của extension.'); }
          parts.push(value);
        }
      } finally { reader.releaseLock(); }
      const data = new Uint8Array(size); let offset = 0;
      for (const part of parts) { data.set(part,offset); offset += part.length; }
      return data;
    } catch(e) {
      if (signal?.aborted) throw new DOMException('Aborted','AbortError');
      if (attempt < 2 && (retry || e.name === 'TypeError' || e.name === 'AbortError')) {
        await new Promise(r=>setTimeout(r, 600*(attempt+1)));
      } else if (e.name === 'TypeError') throw new Error('Không lấy được dữ liệu. Kiểm tra mạng và quyền truy cập site của extension; thử nhập file Response .m3u8 từ Network.');
      else if (e.name === 'AbortError') throw new Error('Máy chủ không phản hồi trong 45 giây. Hãy thử lại.');
      else throw e;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort',abort); }
  }
}
async function getPlaylist(url, signal) {
  return parsePlaylist(new TextDecoder().decode(await fetchBytes(url,{signal,limit:2*1024*1024})), url);
}
function duration(t) { return `${Math.floor(t/60)} phút ${Math.round(t%60)} giây`; }
function applyPlaylist(playlist) {
  selected = playlist;
  $('quality').replaceChildren();
  if (playlist.kind === 'master') {
    for (let i=0;i<playlist.variants.length;i++) {
      const v=playlist.variants[i]; $('quality').add(new Option(`${v.resolution} · tối đa ${(v.bandwidth/1000000).toFixed(2)} Mbps`,String(i)));
    }
    $('info').textContent = `${playlist.variants.length} lựa chọn. Chọn chất lượng rồi bấm tải.`;
  } else {
    $('quality').add(new Option('Chất lượng của media playlist đã chọn','0'));
    $('info').textContent = `${playlist.segments.length} đoạn · ${duration(playlist.duration)} · MPEG-TS không mã hóa theo playlist.`;
  }
}
async function refresh() {
  const old = $('captures').value;
  const data = await chrome.storage.session.get(`tab_${sourceTab}`);
  captures = data[`tab_${sourceTab}`] || [];
  $('captures').replaceChildren();
  if (!captures.length) $('captures').add(new Option('Chưa có playlist — tải lại tab Udemy và phát bài',''));
  for (const c of captures) {
    const u = new URL(c.url), m = u.pathname.match(/AVC_([^/]+)/);
    const asset = u.pathname.match(/\/assets\/(\d+)/)?.[1];
    const label = m ? m[1] : 'Playlist tổng / khác';
    $('captures').add(new Option(`${new Date(c.time).toLocaleTimeString('vi-VN')} · ${label}${asset?' · bài '+asset:''}`, c.identity));
  }
  if (captures.some(c=>c.identity === old)) $('captures').value=old;
}
async function inspect(load) {
  lock(true); selected=null; $('progress').value=0; status('Đang đọc playlist…'); controller=new AbortController();
  try { const p=await load(controller.signal); if(controller.signal.aborted) throw new DOMException('Aborted','AbortError'); applyPlaylist(p); status('Đã đọc playlist. Bạn có thể tải bài này.'); }
  catch(e) {status(cleanError(e),true);}
  finally {controller=null;lock(false);}
}
$('inspect').onclick=()=>inspect(async signal=>{
  const c=captures.find(c=>c.identity===$('captures').value);
  if(!c) throw new Error('Chưa chọn được playlist. Hãy tải lại tab Udemy và phát bài.');
  return getPlaylist(c.url,signal);
});
$('import').onclick=()=>inspect(async signal=>{
  const f=$('file').files[0], url=$('manualUrl').value.trim();
  if(f) {
    if(f.size>2*1024*1024) throw new Error('File playlist vượt 2 MiB.');
    return parsePlaylist(await f.text(),url || undefined);
  }
  if(!url) throw new Error('Chọn file playlist hoặc nhập URL .m3u8.');
  return getPlaylist(url,signal);
});
$('refresh').onclick=()=>refresh().catch(()=>status('Không đọc được danh sách.',true));
$('clear').onclick=async()=>{await chrome.storage.session.remove(`tab_${sourceTab}`);await refresh();};
$('back').onclick=async()=>{try {await chrome.tabs.update(sourceTab,{active:true});}catch {status('Tab Udemy đã đóng. Mở lại Udemy rồi bấm biểu tượng extension.',true);}};
function cleanupBlob(){if(blobURL) URL.revokeObjectURL(blobURL);blobURL=null;downloadId=null;}
function finishSave(item) {
  if(!['complete','interrupted'].includes(item.state)) return;
  cleanupBlob();lock(false);
  status(item.state==='complete'?'Đã lưu video. Mở bằng VLC và kiểm tra hình, tiếng trước khi mang đi học.':'Việc lưu file bị hủy hoặc gián đoạn. Hãy tải lại.', item.state!=='complete');
}
chrome.downloads.onChanged.addListener(async delta=>{
  if(delta.id===downloadId && delta.state) finishSave({state:delta.state.current});
});
$('download').onclick=async()=>{
  if(!selected||busy) return;
  const snapshot=selected, index=Number($('quality').value);
  lock(true);$('progress').value=0;status('Đang chuẩn bị tải…');controller=new AbortController();
  try {
    const p=snapshot.kind==='master'?await getPlaylist(snapshot.variants[index].url,controller.signal):snapshot;
    if(p.kind!=='media') throw new Error('Playlist lồng nhiều cấp chưa được hỗ trợ. Chọn media playlist.');
    $('info').textContent=`${p.segments.length} đoạn · ${duration(p.duration)} · giữ tab này mở.`;
    const parts=await collectSegments(p.segments,u=>fetchBytes(u,{signal:controller.signal}),{
      signal:controller.signal,
      onProgress:({completed,total,bytes})=>{ $('progress').value=completed/total*100;status(`Đang tải ${completed}/${total} đoạn · ${(bytes/1024/1024).toFixed(1)} MiB`); }
    });
    if(controller.signal.aborted) throw new DOMException('Aborted','AbortError');
    blobURL=URL.createObjectURL(new Blob(parts,{type:'video/mp2t'}));parts.length=0;
    status('Đã tải đủ đoạn. Chọn nơi lưu video…');
    // Cancellation during the native save dialog is handled in that dialog.
    $('cancel').disabled=true;
    downloadId=await chrome.downloads.download({url:blobURL,filename:safeFilename($('filename').value),saveAs:true});
    const [item]=await chrome.downloads.search({id:downloadId});if(item) finishSave(item);
    if(downloadId!==null) status('Đang ghi video ra file. Giữ tab này mở…');
  } catch(e) {cleanupBlob();lock(false);status(cleanError(e),true);}
  finally {controller=null;}
};
$('cancel').onclick=()=>{controller?.abort();status('Đang hủy tải…');};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes[`tab_${sourceTab}`]) refresh().catch(()=>{});});
try {
  const tab=await chrome.tabs.get(sourceTab);
  sourceTitle=tab.title?.replace(/\s*[|–-]\s*Udemy.*$/i,'') || 'bai-hoc';
  $('source').textContent=tab.title || 'Tab Udemy đã chọn';$('filename').value=sourceTitle.slice(0,120);
} catch {$('source').textContent='Tab nguồn không còn mở. Bạn vẫn có thể nhập file playlist.';}
await refresh();
