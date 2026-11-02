const test=require("node:test");const assert=require("node:assert/strict");const m=require("../eq-math.js");
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol, a+" != "+b);
test("unity filter is flat",()=>{const c=m.peaking(48000,1000,1,0);for(const f of [20,100,1000,10000,20000])close(m.response(c,48000,f).gainDb,0)});
test("center boost and cut",()=>{for(const db of [-12,-6,6,12])close(m.response(m.peaking(48000,1000,1,db),48000,1000).gainDb,db)});
// Independent SciPy signal.freqz RBJ reference, 48 kHz, 1 kHz, +6 dB, off-center at 2 kHz.
test("off-center EQ bandwidth at three Q values matches SciPy",()=>{
 for(const [q,expected] of [[0.5,3.791219995926305],[1,1.8659910369475754],[4,0.17182904326470574]]){
  close(m.response(m.peaking(48000,1000,q,6),48000,2000).gainDb,expected,1e-6);
 }
});
test("one sample delay phase",()=>close(m.response({b0:0,b1:1,b2:0,a1:0,a2:0},48000,6000).phaseDegrees,-45));
test("reject invalid requests and unstable filters",()=>{
 assert.throws(()=>m.peaking(48000,24000,1,6));assert.throws(()=>m.peaking(48000,1000,0,6));assert.throws(()=>m.peaking(48000,1000,1,37));
 assert.throws(()=>m.response({b0:1,b1:0,b2:0,a1:-1,a2:0},48000,0));
 assert.throws(()=>m.response({b0:NaN,b1:0,b2:0,a1:0,a2:0},48000,1000));
 assert.throws(()=>m.response({b0:1,b1:0,b2:0,a1:-2.5,a2:1.5},48000,1000));
 assert.throws(()=>m.response({b0:1,b1:0,b2:0,a1:-1.999999999999,a2:0.9999999999995},48000,0));
});
test("golden coverage deterministic bounded and distinct",()=>{const a=m.goldenFrequencies(64,20,20000),b=m.goldenFrequencies(64,20,20000);assert.deepEqual(a,b);assert.ok(a.every(f=>f>=20&&f<20000));assert.equal(new Set(a.map(v=>v.toFixed(8))).size,64)});
// 64 frequency-response magnitudes computed independently with SciPy 1.17.0 signal.freqz,
// using normalized RBJ coefficients for fs=48000, f0=1000, Q=1.2, gain=+6 dB.
// Values are fixed fixtures, not computed from EqMath itself.
const scipyGolden=[3.368925896551,0.047439633091,0.073511790684,1.616297597046,0.006256279135,0.724790930193,0.169715564716,0.012701527295,5.971208324826,0.021828626461,0.177736248337,0.649895172454,0.002894546387,1.845318555195,0.076895333202,0.040695639998,2.940162090648,0.010078215616,0.420329526915,0.279882156448,0.004312661739,4.716867151532,0.035246960267,0.103693647012,1.129919345923,0.004660414476,1.026410897855,0.125178863629,0.0207823488,5.048380608469,0.016244433198,0.246781800489,0.468140380003,0.002156663695,2.68120117965,0.057028582196,0.059020336144,2.02826560462,0.007505610875,0.587317113477,0.205181711417,0.008899192002,5.85415823465,0.026207929368,0.144921263831,0.799903101776,0.003471980852,1.469805720065,0.09256898785,0.031890007115,3.677979566552,0.012093067711,0.342688390511,0.339963444397,0.002321551568,3.859234115839,0.042346230557,0.083951964108,1.407640617404,0.005590617523,0.826810026425,0.151034199128,0.015481995479,5.747600498629];
test("64 golden-ratio frequencies match independent SciPy response",()=>{
 const frequencies=m.goldenFrequencies(64,20,20000),coeff=m.peaking(48000,1000,1.2,6);
 assert.equal(frequencies.length,scipyGolden.length);
 frequencies.forEach((f,i)=>close(m.response(coeff,48000,f).gainDb,scipyGolden[i],1e-9));
});
