/* Original educational implementation of standard RBJ-style peaking EQ and biquad frequency response. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.EqMath=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
function valid(x){return typeof x==="number"&&Number.isFinite(x)}
function peaking(sampleRate,frequency,q,gainDb){
if(![sampleRate,frequency,q,gainDb].every(valid)||sampleRate<=0||frequency<=0||frequency>=sampleRate/2||q<=0||Math.abs(gainDb)>36)throw new RangeError("Invalid EQ parameters");
const A=Math.pow(10,gainDb/40),w=2*Math.PI*frequency/sampleRate,alpha=Math.sin(w)/(2*q),c=Math.cos(w);
const a0=1+alpha/A;
return {b0:(1+alpha*A)/a0,b1:(-2*c)/a0,b2:(1-alpha*A)/a0,a1:(-2*c)/a0,a2:(1-alpha/A)/a0};
}
function response(coeff,sampleRate,frequency){
if(!coeff||!valid(sampleRate)||sampleRate<=0||!valid(frequency)||frequency<0||frequency>sampleRate/2)throw new RangeError("Invalid response request");
const keys=["b0","b1","b2","a1","a2"];if(!keys.every(k=>valid(coeff[k])))throw new RangeError("Nonfinite coefficients");
// Jury stability test for normalized second-order denominator: 1 + a1*z^-1 + a2*z^-2.
if(Math.abs(coeff.a2)>=1||Math.abs(coeff.a1)>=1+coeff.a2)throw new RangeError("Unstable filter");
const w=2*Math.PI*frequency/sampleRate,c1=Math.cos(w),s1=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);
const nr=coeff.b0+coeff.b1*c1+coeff.b2*c2,ni=-coeff.b1*s1-coeff.b2*s2;
const dr=1+coeff.a1*c1+coeff.a2*c2,di=-coeff.a1*s1-coeff.a2*s2;
const den=dr*dr+di*di;if(!Number.isFinite(den)||den<=1e-24)throw new RangeError("Singular response");
const re=(nr*dr+ni*di)/den,im=(ni*dr-nr*di)/den,mag=Math.hypot(re,im);
if(!Number.isFinite(mag)||mag<=0)throw new RangeError("Invalid magnitude");
return {gainDb:20*Math.log10(mag),phaseDegrees:Math.atan2(im,re)*180/Math.PI};
}
function goldenFrequencies(count,min,max){
if(!Number.isInteger(count)||count<1||count>4096||![min,max].every(valid)||min<=0||max<=min)throw new RangeError("Invalid coverage");
const phi=(1+Math.sqrt(5))/2;
return Array.from({length:count},(_,i)=>min*Math.pow(max/min,((i+1)/phi)%1));
}
return {peaking,response,goldenFrequencies};
});