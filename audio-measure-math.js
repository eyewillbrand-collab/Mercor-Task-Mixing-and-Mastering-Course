(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AudioMeasure=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const MAX_BYTES=10*1024*1024,MAX_SECONDS=30;
function fail(s){throw new RangeError(s)}
function measure(buffer){
 if(!(buffer instanceof ArrayBuffer))throw new TypeError("Expected ArrayBuffer");
 const n=buffer.byteLength;if(n>MAX_BYTES)fail("WAV exceeds 10 MiB limit");if(n<44)fail("Truncated WAV");
 const v=new DataView(buffer),tag=p=>String.fromCharCode(...new Uint8Array(buffer,p,4));
 if(tag(0)!=="RIFF"||tag(8)!=="WAVE")fail("Only RIFF/WAVE supported");
 if(v.getUint32(4,true)!==n-8)fail("Inconsistent RIFF length");
 let pos=12,fmt=null,data=null;
 while(pos<n){
  if(n-pos<8)fail("Truncated chunk header");
  const name=tag(pos),size=v.getUint32(pos+4,true),start=pos+8;
  if(size>n-start)fail("Chunk exceeds RIFF bounds");
  const end=start+size,padded=end+(size%2);if(padded>n)fail("Missing RIFF padding");
  if(name==="fmt "){
   if(fmt)fail("Duplicate fmt chunk");if(size!==16)fail("Only standard PCM16 fmt supported");
   fmt={format:v.getUint16(start,true),channels:v.getUint16(start+2,true),rate:v.getUint32(start+4,true),byteRate:v.getUint32(start+8,true),align:v.getUint16(start+12,true),bits:v.getUint16(start+14,true)};
  }else if(name==="data"){if(data)fail("Duplicate data chunk");data={start,size}}
  pos=padded;
 }
 if(!fmt||!data||pos!==n)fail("Missing WAV chunks");
 if(fmt.format!==1||fmt.bits!==16)fail("Only uncompressed signed PCM16 supported");
 if(fmt.channels!==1&&fmt.channels!==2)fail("Only mono or stereo supported");
 if(fmt.rate<8000||fmt.rate>96000)fail("Sample rate outside 8–96 kHz");
 if(fmt.align!==fmt.channels*2||fmt.byteRate!==fmt.rate*fmt.align)fail("Invalid alignment or byte rate");
 if(!data.size||data.size%fmt.align)fail("Empty or incomplete PCM frames");
 const frames=data.size/fmt.align,duration=frames/fmt.rate;if(duration>MAX_SECONDS)fail("Audio exceeds 30 seconds");
 let peak=0,sum=0;
 for(let p=data.start;p<data.start+data.size;p+=2){const x=v.getInt16(p,true)/32768,a=Math.abs(x);peak=Math.max(peak,a);sum+=x*x}
 const rms=Math.sqrt(sum/(frames*fmt.channels)),db=x=>x===0?null:20*Math.log10(x);
 return {sampleRate:fmt.rate,channels:fmt.channels,frames,durationSeconds:duration,silence:peak===0,peakDbFS:db(peak),rmsDbFS:db(rms),headroomDb:peak===0?null:-db(peak)};
}
return {measure,MAX_BYTES,MAX_SECONDS};
});