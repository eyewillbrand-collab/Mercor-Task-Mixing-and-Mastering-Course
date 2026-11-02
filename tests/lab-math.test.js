const test=require("node:test");const assert=require("node:assert/strict");const m=require("../lab-math.js");
test("below threshold no reduction",()=>assert.deepEqual(m.compressor(-8,-6,-12,4),{pre:-14,reduction:0,post:-14,preClipped:false}));
test("4:1 hard knee",()=>{const r=m.compressor(-8,10,-18,4);assert.equal(r.pre,2);assert.equal(r.reduction,15);assert.equal(r.post,-13);assert.equal(r.preClipped,true)});
test("unity ratio",()=>assert.equal(m.compressor(-8,0,-20,1).reduction,0));
test("0 dBFS has no headroom but does not exceed full scale",()=>{const at=m.compressor(-8,8,-18,4);assert.equal(at.pre,0);assert.equal(at.preClipped,false);assert.equal(m.compressor(-8,9,-18,4).preClipped,true)});
test("invalid inputs fail closed",()=>{assert.throws(()=>m.compressor(-8,0,-18,0));assert.throws(()=>m.compressor(NaN,0,-18,4));assert.throws(()=>m.compressor(-8,0,-18,Infinity));assert.throws(()=>m.percent(4,0));assert.throws(()=>m.percent(6,5));assert.throws(()=>m.linearToDb(0));assert.throws(()=>m.compressor(1e308,1e308,0,4))});
test("dB conversion",()=>assert.ok(Math.abs(m.linearToDb(m.dbToLinear(-6))+6)<1e-10));
test("CTR",()=>assert.equal(m.percent(120,4000),3));
