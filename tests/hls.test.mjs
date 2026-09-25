import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaylist,allowedURL,collectSegments,safeFilename} from '../hls.mjs';
const base='https://hls-c.udemycdn.com/a/index.m3u8?token=EXAMPLE';
const media='#EXTM3U\n#EXTINF:6,\n0.ts?token=EXAMPLE\n#EXTINF:4.5,\n1.ts?token=EXAMPLE\n#EXT-X-ENDLIST';
const packet=n=>{const a=new Uint8Array(188*3);a[0]=a[188]=a[376]=0x47;a[1]=n;return a;};
test('parses VOD duration, order and relative segment URLs',()=>{
 const p=parsePlaylist(media,base);assert.equal(p.kind,'media');assert.equal(p.duration,10.5);assert.equal(p.segments[0].url,'https://hls-c.udemycdn.com/a/0.ts?token=EXAMPLE');
});
test('master CODECS commas and descending quality',()=>{
 const p=parsePlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=10,RESOLUTION=640x360,CODECS="avc1,mp4a"\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=20,RESOLUTION=1920x1080\nhigh.m3u8',base);
 assert.equal(p.variants[0].resolution,'1920x1080');assert.equal(p.variants.length,2);
});
test('reject encryption, fragmented MP4, incomplete VOD and separate audio',()=>{
 for(const tag of ['#EXT-X-KEY:METHOD=AES-128,URI="key"','#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"','#EXT-X-MAP:URI="init.mp4"','#EXT-X-BYTERANGE:100@0','#EXT-X-DISCONTINUITY']) assert.throws(()=>parsePlaylist(media.replace('#EXTM3U','#EXTM3U\n'+tag),base));
 assert.throws(()=>parsePlaylist(media.replace('#EXT-X-ENDLIST',''),base));
 assert.throws(()=>parsePlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=10,AUDIO="a"\nx.m3u8',base));
});
test('domain boundaries, credentials, non-HTTPS and filenames',()=>{
 for(const u of ['https://udemy.com.evil.test/x','https://eviludemy.com/x','http://udemy.com/x','https://user:pw@udemy.com/x','https://udemy.com:444/x']) assert.throws(()=>allowedURL(u));
 assert.equal(safeFilename('a/b:c'),'a_b_c.ts');assert.equal(safeFilename('CON'),'bai-hoc_CON.ts');
});
test('parallel fetch preserves playlist order',async()=>{
 const p=parsePlaylist(media,base);const out=await collectSegments(p.segments,async u=>{const i=u.includes('/0.ts')?0:1;await new Promise(r=>setTimeout(r,i?1:20));return packet(i);});
 assert.deepEqual(out.map(x=>x[1]),[0,1]);
});
test('failed segment, invalid bytes, cancellation, size cap never produce partial file',async()=>{
 const s=parsePlaylist(media,base).segments;
 await assert.rejects(collectSegments(s,async()=>{throw new Error('HTTP 403');}),/403/);
 await assert.rejects(collectSegments(s,async()=>new Uint8Array(10)),/MPEG-TS/);
 await assert.rejects(collectSegments(s,async()=>packet(0),{maxBytes:600}),/512 MiB/);
 const c=new AbortController();c.abort();await assert.rejects(collectSegments(s,async()=>packet(0),{signal:c.signal}),/hủy/);
});
