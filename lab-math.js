/* Pure, deterministic educational math. No actual audio processing. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.LabMath=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
function finite(value,name){if(typeof value!=="number"||!Number.isFinite(value))throw new TypeError(name+" must be a finite number");return value}
function compressor(sourcePeak,inputGain,threshold,ratio){
 [sourcePeak,inputGain,threshold,ratio].forEach((v,i)=>finite(v,["sourcePeak","inputGain","threshold","ratio"][i]));
 if(ratio<1)throw new RangeError("ratio must be >= 1");
 const pre=sourcePeak+inputGain;
 const over=Math.max(0,pre-threshold);
 const reduction=over*(1-1/ratio);
 return {pre,reduction,post:pre-reduction,preClipped:pre>0};
}
function dbToLinear(db){finite(db,"db");return Math.pow(10,db/20)}
function linearToDb(amplitude){finite(amplitude,"amplitude");if(amplitude<=0)throw new RangeError("amplitude must be > 0");return 20*Math.log10(amplitude)}
function percent(part,total){finite(part,"part");finite(total,"total");if(total<=0||part<0||part>total)throw new RangeError("invalid ratio");return 100*part/total}
return {compressor,dbToLinear,linearToDb,percent};
});