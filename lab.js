"use strict";
const $=id=>document.getElementById(id);
function update(){
 const gain=Number($("gain").value),threshold=Number($("threshold").value),ratio=Number($("ratio").value);
 const r=LabMath.compressor(-8,gain,threshold,ratio);
 $("gainValue").textContent=gain;$("thresholdValue").textContent=threshold;$("ratioValue").textContent=ratio;
 $("pre").textContent=r.pre.toFixed(2);$("reduction").textContent=r.reduction.toFixed(2);$("post").textContent=r.post.toFixed(2);
 $("clip").textContent=r.preClipped?"Warning: pre-compressor peak exceeds 0 dBFS.":r.pre===0?"Pre-compressor peak is at digital full scale (0 dBFS), with no headroom.":"Pre-compressor peak remains below digital full scale.";
}
["gain","threshold","ratio"].forEach(id=>$(id).addEventListener("input",update));
$("check").addEventListener("click",()=>{
 const expected=LabMath.compressor(-8,-6,-18,4).post;
 const raw=$("answer").value.trim();
 const passed=raw!==""&&Number.isFinite(Number(raw))&&Math.abs(Number(raw)-expected)<0.01;
 $("status").textContent=passed?"Correct: "+expected.toFixed(2)+" dBFS. This exercise is complete.":"Not yet. Calculate pre-peak, amount above threshold, reduction and output.";
});update();