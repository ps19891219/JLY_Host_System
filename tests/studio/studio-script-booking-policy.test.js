const assert=require("assert");
const m=require("../../js/studio/studio-script-catalog.js");
const x=m.normalizeStudioScript({scriptId:"s1",studioId:"st1",roles:[{id:"gm",type:"GM",eligiblePersonIds:["p1","p2"]}],booking:{allowHostRequest:true,depositRequired:true,depositAmount:1000}});
assert.equal(x.scriptId,"s1");assert.equal(x.booking.allowHostRequest,true);assert.equal(x.booking.depositAmount,1000);
assert.deepEqual(m.eligibleHosts(x),["p1","p2"]);
console.log("studio script booking policy contract ok");
