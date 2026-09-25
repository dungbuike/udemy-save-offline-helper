export function pageKey(value) {
  try { const u=new URL(value);return u.origin+u.pathname; } catch {return '';}
}
export function assetKey(value) {
  const p=new URL(value).pathname.replace(/^\/assets\/\d+\/files\//,'/');
  return p.includes('/hls/')?p.split('/hls/')[0]:p;
}
export function resolutionFromURL(url) {
  return new URL(url).pathname.match(/(?:AVC|HEVC)_(\d+x\d+)/)?.[1] || '';
}
export function selectFHD(variants) {
  const ranked=[...variants].sort((a,b)=>{
    const [aw,ah]=a.resolution.split('x').map(Number),[bw,bh]=b.resolution.split('x').map(Number);
    const af=aw===1920&&ah===1080,bf=bw===1920&&bh===1080;
    return Number(bf)-Number(af)||(bh||0)-(ah||0)||(b.bandwidth||0)-(a.bandwidth||0);
  });
  return ranked[0];
}
export function currentCandidates(entries, route) {
  const current=entries.filter(e=>!e.pageKey || e.pageKey===route);
  if(!current.length) return [];
  const newest=[...current].sort((a,b)=>b.time-a.time)[0];
  return current.filter(e=>assetKey(e.url)===assetKey(newest.url)).sort((a,b)=>{
    const ar=resolutionFromURL(a.url),br=resolutionFromURL(b.url);
    if(!ar!==!br) return !ar?-1:1; // Prefer master for this same asset, never an older lesson.
    const af=ar==='1920x1080',bf=br==='1920x1080';
    return Number(bf)-Number(af)||(Number(br.split('x')[1])||0)-(Number(ar.split('x')[1])||0)||b.time-a.time;
  });
}
