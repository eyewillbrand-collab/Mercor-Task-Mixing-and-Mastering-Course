"use strict";
const { chromium } = require("@playwright/test");
const fs=require("node:fs"),crypto=require("node:crypto"),cp=require("node:child_process");
const EXPECTED="4fc91ea857f635e4d8babea1b40c51fd0e40740d";
function chromeRssKiB(){
 const s=cp.execFileSync("ps",["-eo","pid=,ppid=,rss=,args="],{encoding:"utf8"});
 const rows=s.split("\n").map(line=>line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m=>({pid:+m[1],ppid:+m[2],rss:+m[3],cmd:m[4]}));
 // Only include the launched Playwright browser process and its descendants.
 const roots=rows.filter(r=>r.cmd.includes("chromium")&&r.cmd.includes("--remote-debugging-pipe")&&!r.cmd.includes("ps -eo"));
 const ids=new Set(roots.map(r=>r.pid));
 let changed=true;while(changed){changed=false;for(const r of rows)if(ids.has(r.ppid)&&!ids.has(r.pid)){ids.add(r.pid);changed=true}}
 const members=rows.filter(r=>ids.has(r.pid));
 if(!roots.length||!members.length)throw Error("Chromium RSS unavailable: no matching browser process; process sample="+JSON.stringify(rows.filter(r=>/chrom|headless/i.test(r.cmd)).slice(0,8)));
 return {rssKiB:members.reduce((sum,r)=>sum+r.rss,0),processCount:members.length,rootPids:roots.map(r=>r.pid),processes:members.map(r=>({pid:r.pid,ppid:r.ppid,rssKiB:r.rss,role:(r.cmd.match(/--type=([^ ]+)/)||[])[1]||"browser"})).sort((a,b)=>b.rssKiB-a.rssKiB)};
}
function wav(nonSilent=false){const n=10485760,b=Buffer.alloc(n),v=new DataView(b.buffer,b.byteOffset,b.byteLength);b.write("RIFF",0);v.setUint32(4,n-8,true);b.write("WAVE",8);b.write("fmt ",12);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,96000,true);v.setUint32(28,384000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);b.write("data",36);v.setUint32(40,n-44,true);if(nonSilent){for(let p=44;p<n;p+=4){const frame=(p-44)/4;const sample=Math.round(12000*Math.sin(2*Math.PI*440*frame/96000));v.setInt16(p,sample,true);v.setInt16(p+2,sample,true)}}return b}
(async()=>{
 const sha=cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 const base=cp.execFileSync("git",["merge-base","HEAD",EXPECTED],{encoding:"utf8"}).trim();
 if(base!==EXPECTED)throw Error("Audit branch does not descend from frozen SHA");
 for(const p of ["audio-measure.html","audio-measure.js","audio-measure-math.js","tests/audio-measure-math.test.js","browser-tests/audio-measure.spec.js"]){
  const a=cp.execFileSync("git",["rev-parse","HEAD:"+p],{encoding:"utf8"}).trim();
  const b=cp.execFileSync("git",["rev-parse",EXPECTED+":"+p],{encoding:"utf8"}).trim();
  if(a!==b)throw Error("Frozen file changed: "+p);
 }
 const browser=await chromium.launch({headless:true,args:["--enable-precise-memory-info","--js-flags=--expose-gc"]});
 const page=await browser.newPage();const cdp=await page.context().newCDPSession(page);await cdp.send("Performance.enable");
 const snapshots=[],sample=async(label)=>{const metrics=await cdp.send("Performance.getMetrics");const vals=Object.fromEntries(metrics.metrics.map(x=>[x.name,x.value]));snapshots.push({label,time:new Date().toISOString(),jsHeapUsedBytes:vals.JSHeapUsedSize,jsHeapTotalBytes:vals.JSHeapTotalSize,chromeProcessRssKiB:chromeRssKiB().rssKiB,processes:chromeRssKiB().processes})};
 let peakRss=0,rssSampleCount=0,rssError=null;const timer=setInterval(()=>{try{const x=chromeRssKiB();peakRss=Math.max(peakRss,x.rssKiB);rssSampleCount++}catch(e){rssError=String(e.message)}},100);
 try{
  await page.goto("http://127.0.0.1:4173/audio-measure.html");
  await sample("baseline");
  const bytes=wav(),toneBytes=wav(true);const durations=[];
  for(let i=0;i<5;i++){
   const start=Date.now();
   await page.locator("#audio-file").setInputFiles({name:"max.wav",mimeType:"audio/wav",buffer:bytes});
   await page.waitForFunction(() => ["Measurement complete.", "Digital silence measured."].includes(document.querySelector("#status")?.textContent), null, {timeout:15000});
   const state=await page.locator("#status").textContent();if(state!=="Digital silence measured.")throw Error("Unexpected measurement status: "+state);if(!(await page.locator("#results").isVisible()))throw Error("Results not visible after measurement");durations.push(Date.now()-start);
   await sample("selection-"+(i+1));
   await page.locator("#audio-file").setInputFiles([]);
   await page.waitForTimeout(150);
   await page.evaluate(()=>{if(typeof gc==="function")gc()});
   await sample("after-clear-"+(i+1));
  }
  // A separate non-silent input checks that measurement completion is not specific to digital silence.
  const toneStart=Date.now();
  await page.locator("#audio-file").setInputFiles({name:"tone.wav",mimeType:"audio/wav",buffer:toneBytes});
  await page.waitForFunction(() => document.querySelector("#status")?.textContent==="Measurement complete.",null,{timeout:15000});
  if(!(await page.locator("#results").isVisible()))throw Error("Tone measurement results missing");
  await sample("non-silent-selection");
  const toneElapsedMs=Date.now()-toneStart;
  await page.locator("#audio-file").setInputFiles([]);
  await page.waitForTimeout(150);
  await page.evaluate(()=>{if(typeof gc==="function")gc()});
  await sample("after-non-silent-clear");
  for(const delayMs of [1000,3000,5000]){
   await page.waitForTimeout(delayMs);
   await page.evaluate(()=>{if(typeof gc==="function")gc()});
   await sample("settled-after-tone-"+delayMs+"ms");
  }
  // Compare settled input-clear state with a fresh document in the same renderer.
  const beforeNavigation=snapshots[snapshots.length-1];
  await page.goto("http://127.0.0.1:4173/audio-measure.html",{waitUntil:"load"});
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{if(typeof gc==="function")gc()});
  await sample("fresh-page-after-navigation");
  const afterNavigation=snapshots[snapshots.length-1];
  if(await page.locator("#audio-file").inputValue())throw Error("Fresh page still has selected input");
  if(await page.locator("#results").isVisible())throw Error("Fresh page unexpectedly retains measurement results");
  const navigationComparison={
   before:{jsHeapUsedBytes:beforeNavigation.jsHeapUsedBytes,rendererRssKiB:beforeNavigation.processes.filter(x=>x.role==="renderer").reduce((a,x)=>a+x.rssKiB,0),aggregateRssKiB:beforeNavigation.chromeProcessRssKiB},
   after:{jsHeapUsedBytes:afterNavigation.jsHeapUsedBytes,rendererRssKiB:afterNavigation.processes.filter(x=>x.role==="renderer").reduce((a,x)=>a+x.rssKiB,0),aggregateRssKiB:afterNavigation.chromeProcessRssKiB}
  };
  if(!navigationComparison.before.rendererRssKiB||!navigationComparison.after.rendererRssKiB)throw Error("Renderer RSS missing for navigation comparison");
  // Independent context control: fresh document with no audio selections.
  const controlContext=await browser.newContext();
  let contextComparison;
  try{
   const controlPage=await controlContext.newPage();
   const controlCdp=await controlContext.newCDPSession(controlPage);
   await controlCdp.send("Performance.enable");
   await controlPage.goto("http://127.0.0.1:4173/audio-measure.html",{waitUntil:"load"});
   await controlPage.waitForTimeout(1000);
   await controlPage.evaluate(()=>{if(typeof gc==="function")gc()});
   const controlMetrics=await controlCdp.send("Performance.getMetrics");
   const controlValues=Object.fromEntries(controlMetrics.metrics.map(x=>[x.name,x.value]));
   const controlProcess=chromeRssKiB();
   const controlRenderer=controlProcess.processes.filter(x=>x.role==="renderer");
   if(!Number.isFinite(controlValues.JSHeapUsedSize)||!controlRenderer.length)throw Error("Independent context metrics unavailable");
   if(await controlPage.locator("#audio-file").inputValue())throw Error("Control context has unexpected audio input");
   if(await controlPage.locator("#results").isVisible())throw Error("Control context has unexpected results");
   contextComparison={
    usedContextAfterNavigation:{jsHeapUsedBytes:afterNavigation.jsHeapUsedBytes,rendererRssKiB:navigationComparison.after.rendererRssKiB},
    freshContext:{jsHeapUsedBytes:controlValues.JSHeapUsedSize,rendererRssKiB:controlRenderer.reduce((a,x)=>a+x.rssKiB,0),rendererPids:controlRenderer.map(x=>x.pid)},
    note:"Fresh context and used context share a Chromium browser; aggregate process RSS and renderer RSS may overlap. Compare independent CDP heap targets, not summed RSS as an isolated per-context budget."
   };
   await sample("used-context-while-control-open");
  }finally{await controlContext.close()}
  const result={frozenSha:EXPECTED,auditCommit:sha,chromiumVersion:browser.version(),fileBytes:bytes.length,nonSilentToneHz:440,nonSilentElapsedMs:toneElapsedMs,navigationComparison,contextComparison,selectionElapsedMs:durations,peakAggregateChromiumRssKiB:peakRss,rssSampleCount,rssError,snapshots,disclaimer:"Aggregate Chromium RSS includes browser and child processes, not per-tab peak; CDP JS heap excludes ArrayBuffer backing stores. CI host-specific observations, not a universal memory budget."};
  if(!peakRss||rssSampleCount<3||rssError||snapshots.some(x=>!x.chromeProcessRssKiB||!x.processes?.length))throw Error("Invalid RSS instrumentation: "+JSON.stringify({peakRss,rssSampleCount,rssError,snapshots}));fs.mkdirSync("memory-evidence",{recursive:true});fs.writeFileSync("memory-evidence/results.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{clearInterval(timer);await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
