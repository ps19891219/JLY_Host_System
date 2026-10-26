(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.JLYStudioScriptCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const text=v=>String(v==null?"":v).trim();
function normalizeStudioScript(input={}){
 const roles=(Array.isArray(input.roles)?input.roles:[]).map(role=>({
  roleId:text(role.roleId||role.id),name:text(role.name),type:text(role.type||"PC"),
  eligiblePersonIds:(Array.isArray(role.eligiblePersonIds)?role.eligiblePersonIds:[]).map(text).filter(Boolean)
 }));
 const booking=input.booking&&typeof input.booking==="object"?input.booking:{};
 return {
  scriptId:text(input.scriptId||input.id),studioId:text(input.studioId),branchId:text(input.branchId),
  enabled:input.enabled!==false,roles,
  booking:{
   enabled:booking.enabled!==false,
   allowHostRequest:booking.allowHostRequest===true,
   hostRequestMode:["preference","required"].includes(text(booking.hostRequestMode))?text(booking.hostRequestMode):"preference",
   depositRequired:booking.depositRequired===true,
   depositType:["fixed","per_person"].includes(text(booking.depositType))?text(booking.depositType):"fixed",
   depositAmount:Math.max(0,Number(booking.depositAmount||0)||0)
  }
 };
}
function eligibleHosts(config={}){
 const ids=new Set();
 (config.roles||[]).forEach(r=>{if(["GM","DM","HOST"].includes(text(r.type).toUpperCase()))(r.eligiblePersonIds||[]).forEach(id=>ids.add(text(id)));});
 return [...ids].filter(Boolean);
}
return {normalizeStudioScript,eligibleHosts};
});
