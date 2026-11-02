"use strict";const $=id=>document.getElementById(id);const canvas=$("plot"),ctx=canvas.getContext("2d");
function draw(){const f=Number($("frequency").value),q=Number($("q").value),gain=Number($("gain").value),sr=48000;
$("frequencyValue").textContent=f;$("qValue").textContent=q.toFixed(1);$("gainValue").textContent=gain;
const c=EqMath.peaking(sr,f,q,gain),w=canvas.width,h=canvas.height;
ctx.clearRect(0,0,w,h);ctx.strokeStyle="#60738b";ctx.lineWidth=1;
for(const db of [-18,-12,-6,0,6,12,18]){const y=h/2-db*h/40;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
ctx.strokeStyle="#8ce7d8";ctx.lineWidth=3;ctx.beginPath();
for(let i=0;i<w;i++){const hz=20*Math.pow(1000,i/(w-1)),db=EqMath.response(c,sr,hz).gainDb;const y=h/2-db*h/40;if(i===0)ctx.moveTo(i,y);else ctx.lineTo(i,y)}ctx.stroke();
const center=EqMath.response(c,sr,f);$("summary").textContent="Calculated center response: "+center.gainDb.toFixed(2)+" dB; phase: "+center.phaseDegrees.toFixed(2)+"°. Frequency axis: logarithmic, 20 Hz to 20 kHz. Vertical range: approximately ±20 dB.";
canvas.setAttribute("aria-label","Calculated peaking EQ response. Center "+f+" Hz, Q "+q+", gain "+gain+" dB; center response "+center.gainDb.toFixed(2)+" dB.");}
["frequency","q","gain"].forEach(id=>$(id).addEventListener("input",draw));
$("check").addEventListener("click",()=>{const raw=$("answer").value.trim();$("feedback").textContent=raw!==""&&Number.isFinite(Number(raw))&&Math.abs(Number(raw)-6)<0.1?"Correct. The ideal center gain is approximately +6 dB.":"Try again. The question assumes a +6 dB filter at its center frequency.";});draw();