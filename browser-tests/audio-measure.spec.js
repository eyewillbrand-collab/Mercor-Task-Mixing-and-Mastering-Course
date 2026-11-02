const {test,expect}=require("@playwright/test");
function pcm16({bad=false,silence=false}={}){const frames=480,buf=Buffer.alloc(44+frames*2);buf.write("RIFF",0);buf.writeUInt32LE(buf.length-8,4);buf.write("WAVEfmt ",8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(bad?3:1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(48000,24);buf.writeUInt32LE(96000,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(frames*2,40);for(let i=0;i<frames;i++)buf.writeInt16LE(silence?0:Math.round(16384*Math.sin(2*Math.PI*1000*i/48000)),44+i*2);return buf}
test("local audio measured without upload or storage",async({page})=>{const requests=[];page.on("request",r=>{if(r.method()!=="GET")requests.push(r.method())});await page.goto("/audio-measure.html");await page.locator("#audio-file").setInputFiles({name:"fixture.wav",mimeType:"audio/wav",buffer:pcm16()});await expect(page.locator("#status")).toContainText("Measurement complete");await expect(page.locator("#peak")).toContainText("-6.02");await expect(page.locator("#rms")).toContainText("-9.03");expect(requests).toEqual([]);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([])});
test("invalid selection clears results and recovery works",async({page})=>{await page.goto("/audio-measure.html");await page.locator("#audio-file").setInputFiles({name:"good.wav",mimeType:"audio/wav",buffer:pcm16()});await expect(page.locator("#results")).toBeVisible();await page.locator("#audio-file").setInputFiles({name:"bad.wav",mimeType:"audio/wav",buffer:pcm16({bad:true})});await expect(page.locator("#results")).toBeHidden();await expect(page.locator("#error")).toContainText("Only uncompressed signed PCM16");await page.locator("#audio-file").setInputFiles({name:"silence.wav",mimeType:"audio/wav",buffer:pcm16({silence:true})});await expect(page.locator("#status")).toContainText("Digital silence")});
test("keyboard and 320px mobile",async({page})=>{await page.setViewportSize({width:320,height:700});await page.goto("/audio-measure.html");await page.locator("#audio-file").focus();expect(await page.evaluate(()=>document.activeElement.id)).toBe("audio-file");await page.locator("#audio-file").setInputFiles({name:"fixture.wav",mimeType:"audio/wav",buffer:pcm16()});await expect(page.locator("#results")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)});

test("full-scale negative sample displays zero headroom",async({page})=>{
 await page.goto("/audio-measure.html");
 const b=pcm16({silence:true});b.writeInt16LE(-32768,44);
 await page.locator("#audio-file").setInputFiles({name:"full-scale.wav",mimeType:"audio/wav",buffer:b});
 await expect(page.locator("#peak")).toHaveText("0.00 dBFS");
 await expect(page.locator("#headroom")).toContainText("no sample-peak headroom");
});
test("worst-case allowed 10 MiB PCM16 is measured within main-thread budget",async({page})=>{
 await page.goto("/audio-measure.html");
 const result=await page.evaluate(()=>{
  const n=AudioMeasure.MAX_BYTES,b=new ArrayBuffer(n),v=new DataView(b),u=new Uint8Array(b);
  function tag(p,s){for(let i=0;i<s.length;i++)u[p+i]=s.charCodeAt(i)}
  tag(0,"RIFF");v.setUint32(4,n-8,true);tag(8,"WAVE");tag(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,96000,true);v.setUint32(28,384000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);
  tag(36,"data");v.setUint32(40,n-44,true);
  const start=performance.now(),d=AudioMeasure.measure(b),elapsedMs=performance.now()-start;
  return {elapsedMs,frames:d.frames,silence:d.silence,durationSeconds:d.durationSeconds};
 });
 console.log("PCM16 10 MiB measurement: "+result.elapsedMs.toFixed(2)+" ms in Chromium CI");
 expect(result.frames).toBe((10*1024*1024-44)/4);
 expect(result.silence).toBe(true);
 expect(result.durationSeconds).toBeLessThan(30);
 expect(result.elapsedMs).toBeLessThan(250);
});
test("390px mobile result layout fits viewport",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/audio-measure.html");
 await page.locator("#audio-file").setInputFiles({name:"fixture.wav",mimeType:"audio/wav",buffer:pcm16()});
 await expect(page.locator("#results")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("oversized WAV is refused before any file bytes are read",async({page})=>{
 await page.addInitScript(()=>{
  window.__fileReads=0;
  const native=File.prototype.arrayBuffer;
  File.prototype.arrayBuffer=function(){window.__fileReads++;return native.call(this)};
 });
 await page.goto("/audio-measure.html");
 await page.locator("#audio-file").setInputFiles({name:"oversize.wav",mimeType:"audio/wav",buffer:Buffer.alloc(10*1024*1024+1)});
 await expect(page.locator("#error")).toContainText("10 MiB");
 await expect(page.locator("#results")).toBeHidden();
 expect(await page.evaluate(()=>window.__fileReads)).toBe(0);
});
