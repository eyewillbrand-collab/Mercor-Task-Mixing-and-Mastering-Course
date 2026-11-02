"use strict";
const { chromium } = require("@playwright/test");
const fs=require("node:fs"),crypto=require("node:crypto"),cp=require("node:child_process");
const EXPECTED="4fc91ea857f635e4d8babea1b40c51fd0e40740d";
function chromeRssKiB(){try{const s=cp.execFileSync("ps",["-eo","pid=,rss=,comm="],{encoding:"utf8"});return s.split("\n").reduce((a,line)=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);return a+(m&&/chrom(e|ium)/i.test(m[3])?Number(m[2]):0)},0)}catch{return null}}
function wav(){const n=10485760,b=Buffer.alloc(n),v=new DataView(b.buffer,b.byteOffset,b.byteLength);b.write("RIFF",0);v.setUint32(4,n-8,true);b.write("WAVE",8);b.write("fmt ",12);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,96000,true);v.setUint32(28,384000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);b.write("data",36);v.setUint32(40,n-44,true);return b}
(async()=>{
 const sha=cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 const base=cp.execFileSync("git",["rev-parse","HEAD^"],{encoding:"utf8"}).trim();
 if(base!==EXPECTED)throw Error("Audit branch must be directly based on frozen SHA");
 for(const p of ["audio-measure.html","audio-measure.js","audio-measure-math.js","tests/audio-measure-math.test.js","browser-tests/audio-measure.spec.js"]){
  const a=cp.execFileSync("git",["rev-parse","HEAD:"+p],{encoding:"utf8"}).trim();
  const b=cp.execFileSync("git",["rev-parse",EXPECTED+":"+p],{encoding:"utf8"}).trim();
  if(a!==b)throw Error("Frozen file changed: "+p);
 }
 const browser=await chromium.launch({headless:true,args:["--enable-precise-memory-info","--js-flags=--expose-gc"]});
 const page=await browser.newPage();const cdp=await page.context().newCDPSession(page);await cdp.send("Performance.enable");
 const snapshots=[],sample=async(label)=>{const metrics=await cdp.send("Performance.getMetrics");const vals=Object.fromEntries(metrics.metrics.map(x=>[x.name,x.value]));snapshots.push({label,time:new Date().toISOString(),jsHeapUsedBytes:vals.JSHeapUsedSize,jsHeapTotalBytes:vals.JSHeapTotalSize,chromeProcessRssKiB:chromeRssKiB()})};
 let peakRss=0;const timer=setInterval(()=>{const x=chromeRssKiB();if(x!==null)peakRss=Math.max(peakRss,x)},25);
 try{
  await page.goto("http://127.0.0.1:4173/audio-measure.html");await snapshots.push({label:"page-loaded"});
  await sample("baseline");
  const bytes=wav();const durations=[];
  for(let i=0;i<5;i++){
   const start=Date.now();
   await page.locator("#audio-file").setInputFiles({name:"max.wav",mimeType:"audio/wav",buffer:bytes});
   await page.locator("#status").getByText("Measurement complete.").waitFor({timeout:15000});
   durations.push(Date.now()-start);
   await sample("selection-"+(i+1));
   await page.locator("#audio-file").setInputFiles([]);
   await page.waitForTimeout(150);
   await page.evaluate(()=>{if(typeof gc==="function")gc()});
   await sample("after-clear-"+(i+1));
  }
  const result={frozenSha:EXPECTED,auditCommit:sha,chromiumVersion:browser.version(),fileBytes:bytes.length,selectionElapsedMs:durations,peakAggregateChromiumRssKiB:peakRss,snapshots,disclaimer:"Aggregate Chromium RSS includes browser and child processes, not per-tab peak; CDP JS heap excludes ArrayBuffer backing stores. CI host-specific observations, not a universal memory budget."};
  fs.mkdirSync("memory-evidence",{recursive:true});fs.writeFileSync("memory-evidence/results.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{clearInterval(timer);await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
