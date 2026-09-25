export function allowedURL(value, base) {
  let u;
  try { u = new URL(value, base); } catch { throw new Error('URL không hợp lệ hoặc thiếu URL gốc cho đường dẫn tương đối.'); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
      !['udemy.com', 'udemycdn.com'].some(d => u.hostname === d || u.hostname.endsWith('.' + d))) {
    throw new Error('Chỉ hỗ trợ URL HTTPS trên Udemy và Udemy CDN.');
  }
  return u.href;
}
function attrs(line) {
  return Object.fromEntries([...line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)]
    .map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
}
export function parsePlaylist(text, base) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U') throw new Error('Response không phải playlist HLS. Có thể phiên đăng nhập đã hết hạn.');
  for (const l of lines) {
    if (/^#EXT-X-(?:SESSION-)?KEY:/.test(l) && attrs(l).METHOD !== 'NONE')
      throw new Error('Playlist có mã hóa. Bản này chỉ hỗ trợ HLS không mã hóa.');
    if (/^#EXT-X-(MAP:|BYTERANGE:|DISCONTINUITY(?:$|:)|GAP$)/.test(l))
      throw new Error('Playlist dùng fMP4, byte-range, đoạn thiếu hoặc discontinuity; bản này chưa hỗ trợ.');
  }
  const variants = [], segments = [];
  let variant = null, duration = null;
  for (const line of lines.slice(1)) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) variant = attrs(line);
    else if (line.startsWith('#EXTINF:')) {
      duration = Number(line.slice(8).split(',')[0]);
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Thời lượng đoạn không hợp lệ.');
    } else if (!line.startsWith('#')) {
      const url = allowedURL(line, base);
      if (variant) {
        if (variant.AUDIO || variant.VIDEO) throw new Error('Luồng có audio/video tách riêng chưa được hỗ trợ.');
        variants.push({url, resolution: variant.RESOLUTION || 'Không rõ độ phân giải', bandwidth: Number(variant.BANDWIDTH) || 0});
        variant = null;
      } else if (duration !== null) {
        segments.push({url, duration}); duration = null;
      } else throw new Error('Playlist có URL không gắn với đoạn video hoặc chất lượng.');
    }
  }
  if (variant || duration !== null) throw new Error('Playlist bị cắt thiếu URL cuối.');
  if (variants.length && segments.length) throw new Error('Playlist trộn master và media không hợp lệ.');
  if (variants.length) return {kind: 'master', variants: variants.sort((a,b) => b.bandwidth-a.bandwidth)};
  if (!segments.length) throw new Error('Không tìm thấy đoạn video.');
  if (!lines.includes('#EXT-X-ENDLIST')) throw new Error('Danh sách chưa đầy đủ hoặc là live stream. Hãy lấy playlist VOD có ENDLIST.');
  if (segments.length > 10000) throw new Error('Bài học có quá nhiều đoạn.');
  return {kind: 'media', segments, duration: segments.reduce((a,s) => a+s.duration,0)};
}
export function isTransportStream(bytes) {
  return bytes.length >= 564 && bytes.length % 188 === 0 && bytes[0] === 0x47 && bytes[188] === 0x47 && bytes[376] === 0x47;
}
export function safeFilename(s) {
  let name = String(s || 'bai-hoc').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0,120);
  if (!name || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = 'bai-hoc_' + name;
  return name.replace(/\.ts$/i, '') + '.ts';
}
export async function collectSegments(segments, fetchSegment, {signal, onProgress = () => {}, maxBytes = 512*1024*1024, concurrency = 3} = {}) {
  const parts = new Array(segments.length);
  let next = 0, completed = 0, bytes = 0, failure;
  async function worker() {
    while (!failure) {
      if (signal?.aborted) throw new Error('Đã hủy tải.');
      const index = next++;
      if (index >= segments.length) return;
      try {
        const data = await fetchSegment(segments[index].url);
        if (signal?.aborted) throw new Error('Đã hủy tải.');
        if (!isTransportStream(data)) throw new Error(`Đoạn ${index+1} không phải MPEG-TS hợp lệ; không xuất file lỗi.`);
        bytes += data.byteLength;
        if (bytes > maxBytes) throw new Error('Bài vượt giới hạn 512 MiB. Hãy chọn chất lượng thấp hơn.');
        parts[index] = data;
        onProgress({completed: ++completed, total: segments.length, bytes});
      } catch (e) { failure = e; throw e; }
    }
  }
  await Promise.allSettled(Array.from({length: Math.min(concurrency, segments.length)}, worker));
  if (failure) throw failure;
  if (signal?.aborted) throw new Error('Đã hủy tải.');
  if (completed !== segments.length) throw new Error('Tải thiếu đoạn; chưa tạo video.');
  return parts;
}
