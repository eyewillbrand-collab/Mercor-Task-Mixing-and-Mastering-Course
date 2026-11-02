const test=require("node:test"),assert=require("node:assert/strict"),{measure,MAX_BYTES}=require("../audio-measure-math.js");
function wav({rate=48000,channels=1,frames=48000,amplitude=.5,mutate}={}){const size=44+frames*channels*2,b=new ArrayBuffer(size),v=new DataView(b);function str(p,s){for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i))}str(0,"RIFF");v.setUint32(4,size-8,true);str(8,"WAVE");str(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,"data");v.setUint32(40,frames*channels*2,true);for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const value=amplitude*Math.sin(2*Math.PI*1000*i/rate)*(c===0?1:0);v.setInt16(44+(i*channels+c)*2,Math.max(-32768,Math.min(32767,Math.round(value*32768))),true)}if(mutate)mutate(v,b);return b}
const near=(a,b,tol=.05)=>assert.ok(Math.abs(a-b)<=tol,String(a)+" vs "+String(b));
test("independent sine reference",()=>{const d=measure(wav());near(d.peakDbFS,-6.020599913);near(d.rmsDbFS,-9.030899870);assert.equal(d.sampleRate,48000)});
test("stereo silent right channel pooled RMS",()=>{const d=measure(wav({channels:2}));near(d.peakDbFS,-6.020599913);near(d.rmsDbFS,-12.041199827)});
test("silence tagged not NaN",()=>{const d=measure(wav({frames:1,amplitude:0}));assert.equal(d.silence,true);assert.equal(d.peakDbFS,null);assert.equal(d.rmsDbFS,null)});
test("negative full scale and positive max",()=>{const b=wav({frames:1,amplitude:0}),v=new DataView(b);v.setInt16(44,-32768,true);assert.equal(measure(b).peakDbFS,0);assert.equal(measure(b).headroomDb,0);v.setInt16(44,32767,true);assert.ok(measure(b).peakDbFS<0)});
test("reject invalid RIFF codec alignment and bounds",()=>{const mutations=[v=>v.setUint8(0,0),v=>v.setUint32(4,0,true),v=>v.setUint32(40,0xffffffff,true),v=>v.setUint16(20,3,true),v=>v.setUint16(34,24,true),v=>v.setUint16(32,1,true),v=>v.setUint32(28,1,true),v=>v.setUint16(22,3,true),v=>v.setUint32(24,7999,true),v=>v.setUint32(24,96001,true),v=>v.setUint32(40,1,true)];for(const mutate of mutations)assert.throws(()=>measure(wav({frames:16,mutate})));assert.throws(()=>measure(new ArrayBuffer(0)));assert.throws(()=>measure(new ArrayBuffer(MAX_BYTES+1)))});
test("duration cap and duplicate chunks",()=>{assert.throws(()=>measure(wav({frames:48000*30+1})),/30 seconds/);const b=wav({frames:1}),dup=new ArrayBuffer(b.byteLength+8),out=new Uint8Array(dup);out.set(new Uint8Array(b));out.set([100,97,116,97,0,0,0,0],b.byteLength);new DataView(dup).setUint32(4,dup.byteLength-8,true);assert.throws(()=>measure(dup),/Duplicate data/)});
test("reject missing RIFF padding",()=>{const b=wav({frames:1}),out=new Uint8Array(b.byteLength+9);out.set(new Uint8Array(b));out.set([74,85,78,75,1,0,0,0,0],b.byteLength);new DataView(out.buffer).setUint32(4,out.length-8,true);assert.throws(()=>measure(out.buffer),/padding/)});

test("asymmetric positive and negative samples use absolute peak and pooled power",()=>{
 const b=wav({frames:4,amplitude:0}),v=new DataView(b);
 const values=[-16384,8192,0,4096];values.forEach((x,i)=>v.setInt16(44+2*i,x,true));
 const d=measure(b);
 near(d.peakDbFS,20*Math.log10(.5),1e-12);
 const expected=Math.sqrt(values.reduce((s,x)=>s+(x/32768)**2,0)/4);
 near(d.rmsDbFS,20*Math.log10(expected),1e-12);
});
test("maximum permitted 10 MiB stereo WAV is accepted and one byte more rejected",()=>{
 const b=new ArrayBuffer(MAX_BYTES),v=new DataView(b),head=new Uint8Array(wav({frames:1,channels:2,rate:96000,amplitude:0}),0,44);
 new Uint8Array(b).set(head);
 v.setUint32(4,MAX_BYTES-8,true);v.setUint32(40,MAX_BYTES-44,true);
 const d=measure(b);
 assert.equal(d.channels,2);assert.equal(d.sampleRate,96000);
 assert.equal(d.frames,(MAX_BYTES-44)/4);assert.ok(d.durationSeconds<30);
 assert.equal(d.silence,true);
 assert.throws(()=>measure(new ArrayBuffer(MAX_BYTES+1)),/10 MiB/);
});
test("valid odd-length ancillary chunk with RIFF pad is supported",()=>{
 const b=wav({frames:1,amplitude:0}),out=new Uint8Array(b.byteLength+10);
 out.set(new Uint8Array(b));out.set([74,85,78,75,1,0,0,0,7,0],b.byteLength);
 new DataView(out.buffer).setUint32(4,out.length-8,true);
 assert.equal(measure(out.buffer).silence,true);
});
test("duplicate fmt chunk, truncated chunk header and trailing garbage rejected",()=>{
 const b=wav({frames:1,amplitude:0}),out=new Uint8Array(b.byteLength+24);
 out.set(new Uint8Array(b));out.set(new Uint8Array(b,12,24),b.byteLength);
 new DataView(out.buffer).setUint32(4,out.length-8,true);
 assert.throws(()=>measure(out.buffer),/Duplicate fmt/);
 const tail=new Uint8Array(b.byteLength+1);tail.set(new Uint8Array(b));
 new DataView(tail.buffer).setUint32(4,tail.length-8,true);
 assert.throws(()=>measure(tail.buffer),/Truncated chunk header/);
});
test("unsupported floating point, RF64, big endian and zero frames fail closed",()=>{
 const b=wav({frames:1,amplitude:0}),v=new DataView(b);
 v.setUint16(20,3,true);assert.throws(()=>measure(b),/PCM16/);
 v.setUint16(20,1,true);v.setUint32(40,0,true);assert.throws(()=>measure(b));
 v.setUint32(40,2,true);new Uint8Array(b)[0]=82;new Uint8Array(b)[1]=70;new Uint8Array(b)[2]=54;new Uint8Array(b)[3]=52;
 assert.throws(()=>measure(b),/RIFF/);
});

test("empty data chunk and fully consistent out-of-range sample rates are rejected",()=>{
 assert.throws(()=>measure(wav({frames:0,amplitude:0})),/Empty/);
 assert.throws(()=>measure(wav({rate:96001,frames:1,amplitude:0})),/Sample rate/);
 assert.throws(()=>measure(wav({rate:7999,frames:1,amplitude:0})),/Sample rate/);
});
test("nonstandard extended fmt chunk is rejected even when all RIFF sizes agree",()=>{
 const b=wav({frames:1,amplitude:0}),out=new Uint8Array(b.byteLength+2);
 out.set(new Uint8Array(b,0,36),0);
 out.set(new Uint8Array(b,36),38);
 const v=new DataView(out.buffer);v.setUint32(4,out.byteLength-8,true);v.setUint32(16,18,true);
 assert.throws(()=>measure(out.buffer),/standard PCM16 fmt/);
});

test("RIFF chunk traversal is bounded even for tiny zero-length metadata chunks",()=>{
 const b=wav({frames:1,amplitude:0});
 function withJunk(count){
  const out=new Uint8Array(b.byteLength+count*8);out.set(new Uint8Array(b));
  for(let i=0;i<count;i++)out.set([74,85,78,75],b.byteLength+i*8);
  new DataView(out.buffer).setUint32(4,out.length-8,true);
  return out.buffer;
 }
 assert.equal(measure(withJunk(126)).silence,true);
 assert.throws(()=>measure(withJunk(127)),/Too many WAV chunks/);
});

test("exact 30 seconds accepted; one extra frame rejected (P07)",()=>{
 const exact=measure(wav({rate:8000,frames:8000*30,amplitude:0}));
 assert.equal(exact.durationSeconds,30);assert.equal(exact.frames,240000);
 assert.throws(()=>measure(wav({rate:8000,frames:8000*30+1,amplitude:0})),/30 seconds/);
});
test("consistent unsupported channel and rate metadata hit their own guards (P14 P22 P23)",()=>{
 assert.throws(()=>measure(wav({rate:7999,frames:16})),/Sample rate/);
 assert.throws(()=>measure(wav({rate:96001,frames:16})),/Sample rate/);
 assert.throws(()=>measure(wav({channels:3,frames:16})),/mono or stereo/);
});
test("partial stereo frame rejected with otherwise valid RIFF sizes (P13)",()=>{
 const b=wav({channels:2,frames:2,amplitude:0});
 new DataView(b).setUint32(40,7,true);
 assert.throws(()=>measure(b),/incomplete PCM frames/);
});
test("duplicate fmt chunk rejected by specific guard (P18)",()=>{
 const b=wav({frames:1,amplitude:0}),out=new Uint8Array(b.byteLength+24);
 out.set(new Uint8Array(b));out.set(new Uint8Array(b,12,24),b.byteLength);
 new DataView(out.buffer).setUint32(4,out.length-8,true);
 assert.throws(()=>measure(out.buffer),/Duplicate fmt/);
});
test("strict full-scale headroom is positive zero (B1-01)",()=>{
 const b=wav({frames:1,amplitude:0});new DataView(b).setInt16(44,-32768,true);
 assert.ok(Object.is(measure(b).headroomDb,0));
});

test("KIRC K20: headroom is positive and equals -peakDbFS for an ordinary signal",()=>{
 const d=measure(wav());
 near(d.headroomDb,6.020599913,1e-6);
 assert.ok(d.headroomDb>0);
 assert.ok(Math.abs(d.headroomDb+d.peakDbFS)<1e-12);
});
test("KIRC K19: digital silence reports null headroom, not zero",()=>{
 assert.equal(measure(wav({frames:1,amplitude:0})).headroomDb,null);
});
test("KIRC K23: mono file reports exactly one channel",()=>{
 assert.equal(measure(wav()).channels,1);
});
test("KIRC K01: RIFF container with a non-WAVE form type is rejected",()=>{
 const b=wav({frames:1,amplitude:0}),u=new Uint8Array(b);
 u.set([65,86,73,32],8); // "AVI "
 assert.throws(()=>measure(b),/RIFF\/WAVE/);
});
test("KIRC K07: byte limit is pinned to the advertised 10 MiB literal",()=>{
 assert.equal(MAX_BYTES,10485760);
});
