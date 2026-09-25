import {allowedURL, parsePlaylist} from './hls.mjs';
export async function fetchBytes(url, {signal, limit = 64*1024*1024} = {}) {
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
export async function getPlaylist(url, signal) {
  return parsePlaylist(new TextDecoder().decode(await fetchBytes(url,{signal,limit:2*1024*1024})), url);
}
