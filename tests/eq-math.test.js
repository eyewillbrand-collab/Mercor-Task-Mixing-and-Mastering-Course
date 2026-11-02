const test=require("node:test");const assert=require("node:assert/strict");const m=require("../eq-math.js");
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol, a+" != "+b);
test("unity filter is flat",()=>{const c=m.peaking(48000,1000,1,0);for(const f of [20,100,1000,10000,20000])close(m.response(c,48000,f).gainDb,0)});
test("center boost and cut",()=>{for(const db of [-12,-6,6,12])close(m.response(m.peaking(48000,1000,1,db),48000,1000).gainDb,db)});
test("one sample delay phase",()=>close(m.response({b0:0,b1:1,b2:0,a1:0,a2:0},48000,6000).phaseDegrees,-45));
test("reject invalid requests",()=>{assert.throws(()=>m.peaking(48000,24000,1,6));assert.throws(()=>m.peaking(48000,1000,0,6));assert.throws(()=>m.response({b0:1,b1:0,b2:0,a1:-1,a2:0},48000,0));assert.throws(()=>m.response({b0:NaN,b1:0,b2:0,a1:0,a2:0},48000,1000))});
test("golden coverage deterministic bounded and distinct",()=>{const a=m.goldenFrequencies(64,20,20000),b=m.goldenFrequencies(64,20,20000);assert.deepEqual(a,b);assert.ok(a.every(f=>f>=20&&f<20000));assert.equal(new Set(a.map(v=>v.toFixed(8))).size,64)});
