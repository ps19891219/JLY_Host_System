(function(){
"use strict";
if(window.__JLYMyCarLegacyIdentityRepairLoaded)return;
window.__JLYMyCarLegacyIdentityRepairLoaded=true;
const REVISION=10;
const text=v=>String(v==null?"":v).trim();
const unique=v=>Array.from(new Set((Array.isArray(v)?v:[]).map(text).filter(Boolean)));
function add(set,v){v=text(v);if(v&&!v.toLowerCase().startsWith("line:"))set.add(v);}
function addMany(set,v){(Array.isArray(v)?v:[]).forEach(x=>add(set,x));}
function intersect(a,b){for(const v of a)if(b.has(v))return v;return "";}
function cancelled(p){return ["已取消","取消","cancelled","canceled"].includes(text(p&&p.status).toLowerCase());}
function formalIds(source){source=source&&typeof source==="object"?source:{};const ids=new Set();[
source.id,source.playerId,source.profileId,source.personId,source.identityId,source.memberId,
source.canonicalPersonId,source.canonicalProfileId,source.canonicalMemberId,
source.mergedIntoPersonId,source.mergedIntoProfileId,source.mergedIntoMemberId
].forEach(v=>add(ids,v));addMany(ids,source.linkedPlayerIds);return ids;}
function getPlayerIdentityIds(player){const ids=formalIds(player);add(ids,player&&player.applicationId);return ids;}
function getOwnerIdentityIds(car){car=car||{};const ids=new Set();[
car.ownerId,car.ownerPersonId,car.ownerProfileId,car.hostId,car.hostPersonId,car.hostProfileId,car.createdByPersonId
].forEach(v=>add(ids,v));return ids;}
async function getIdentityContext(){
 const identity=window.JLYIdentity;if(!identity)throw new Error("JLY Identity 尚未載入");
 const profileId=typeof identity.getCurrentPlayerProfileId==="function"?text(identity.getCurrentPlayerProfileId()):text(localStorage.getItem("currentPlayerProfileId"));
 let profile=null;
 if(profileId&&window.db&&typeof identity.syncFromPlayerProfile==="function")profile=await identity.syncFromPlayerProfile(window.db,profileId);
 const cloudIds=profile?Array.from(formalIds(profile)):[];
 if(cloudIds.length&&typeof identity.mergeLinkedPlayerIds==="function")identity.mergeLinkedPlayerIds(cloudIds);
 const viewerId=typeof identity.getCurrentPlayerId==="function"?text(identity.getCurrentPlayerId()):text(localStorage.getItem("currentPlayerId"));
 const localIds=typeof identity.getAllPlayerIdentityIds==="function"?identity.getAllPlayerIdentityIds():[viewerId,profileId];
 const identityIds=unique([viewerId,profileId,...localIds,...cloudIds]);
 if(!viewerId&&!profileId)throw new Error("尚未取得 JLY 使用者身分");
 return {viewerId:viewerId||profileId,profileId,identityIds};
}
function normalizePlayer(player,set){
 if(!player||cancelled(player))return player;
 const matched=intersect(getPlayerIdentityIds(player),set);
 if(!matched)return player;
 const next={...player};
 const stable=text(next.playerId||next.id||next.profileId);
 if(!stable||!set.has(stable))next.playerId=matched;
 return next;
}
function normalizeCar(car,set){car=car||{};const next={...car,players:(Array.isArray(car.players)?car.players:[]).map(p=>normalizePlayer(p,set))};const owner=intersect(getOwnerIdentityIds(car),set);if(owner&&!set.has(text(next.ownerId)))next.ownerId=owner;return next;}
function carMatchesViewerAsPlayer(car,set){return (Array.isArray(car&&car.players)?car.players:[]).some(p=>p&&!cancelled(p)&&Boolean(intersect(getPlayerIdentityIds(p),set)));}
async function mergeExistingPreparedCars(context,map,set,mod){
 try{
  const existing=await mod.read(context.viewerId);
  const ids=unique(Array.isArray(existing&&existing.cars)?existing.cars.map(car=>car&&(car.id||car.carId)):[]);
  if(!ids.length||!window.JLYCarData||typeof window.JLYCarData.getCarsByIds!=="function")return 0;
  const rows=await window.JLYCarData.getCarsByIds(ids);
  let merged=0;
  (rows||[]).forEach(car=>{if(!car||!car.id)return;const host=Boolean(intersect(getOwnerIdentityIds(car),set));const player=carMatchesViewerAsPlayer(car,set);if(host||player){map.set(car.id,normalizeCar(car,set));merged+=1;}});
  return merged;
 }catch(error){console.warn("MyCar prepared-view rehydrate skipped",error);return 0;}
}
async function recoverCoreCars(context,mod){
 const set=new Set(context.identityIds),map=new Map();
 for(const id of context.identityIds){try{const rows=await window.JLYCarData.getCarsByOwner(id);(rows||[]).forEach(car=>map.set(car.id,normalizeCar(car,set)));}catch(error){console.warn("MyCar owner query skipped",id,error);}}
 for(const id of context.identityIds){try{const rows=await window.JLYCarData.getCarsByPlayerId(id);(rows||[]).forEach(car=>map.set(car.id,normalizeCar(car,set)));}catch(error){console.warn("MyCar player query skipped",id,error);}}
 if(mod)await mergeExistingPreparedCars(context,map,set,mod);
 try{
  const snapshot=await window.db.collection("cars").get();
  snapshot.docs.forEach(doc=>{const car={id:doc.id,...(doc.data()||{})};const host=Boolean(intersect(getOwnerIdentityIds(car),set));const player=carMatchesViewerAsPlayer(car,set);if(host||player)map.set(car.id,normalizeCar(car,set));});
 }catch(error){console.warn("MyCar full Core fallback scan unavailable; keeping indexed recovery results",error);}
 return Array.from(map.values());
}
async function rebuild(){if(!window.JLYCarData)throw new Error("Car Data 尚未載入");if(typeof window.ensureMyCarViewModule!=="function")throw new Error("MyCar View Runtime 尚未載入");const context=await getIdentityContext();const mod=await window.ensureMyCarViewModule();const cars=await recoverCoreCars(context,mod);const view=mod.buildView({viewerId:context.viewerId,identityIds:context.identityIds,cars});view.identityResolutionRevision=REVISION;view.identityResolvedAt=new Date().toISOString();view.identityRepairSource="canonical-profile-stable-id-override-recovery";await mod.write(view);return view;}
let runPromise=null;
async function run(){
 if(runPromise)return runPromise;
 runPromise=(async()=>{try{const view=await rebuild();console.log("✅ MyCar canonical identity recovery V10",{host:view.counts&&view.counts.host||0,player:view.counts&&view.counts.player||0,all:view.counts&&view.counts.all||0});if(typeof window.resetMyCarPagination==="function")window.resetMyCarPagination();if(typeof window.renderMyCars==="function")await window.renderMyCars({restoreScroll:false});return view;}catch(error){console.error("MyCar canonical identity recovery failed",error);return null;}finally{runPromise=null;}})();
 return runPromise;
}
window.JLYMyCarLegacyIdentityRepair={REVISION,getIdentityContext,getPlayerIdentityIds,getOwnerIdentityIds,carMatchesViewerAsPlayer,recoverCoreCars,rebuild,run};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(run,0));else setTimeout(run,0);
})();
