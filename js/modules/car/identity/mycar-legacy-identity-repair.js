(function(){
"use strict";
if(window.__JLYMyCarLegacyIdentityRepairLoaded)return;
window.__JLYMyCarLegacyIdentityRepairLoaded=true;
const REVISION=14;
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
async function collectCloudProfileAliases(db,candidateIds){
 const aliases=new Set(),profileDocIds=new Set(),checkedDirect=new Set(),checkedReverse=new Set(),queue=unique(candidateIds);
 const scalarFields=["identityId","personId","profileId","playerId","memberId","canonicalPersonId","canonicalProfileId","canonicalMemberId","mergedIntoPersonId","mergedIntoProfileId","mergedIntoMemberId"];
 function remember(value){const normalized=text(value);if(!normalized||normalized.toLowerCase().startsWith("line:"))return;const before=aliases.size;aliases.add(normalized);if(aliases.size>before)queue.push(normalized);}
 async function consumeDoc(doc){if(!doc||!doc.exists)return false;profileDocIds.add(text(doc.id));remember(doc.id);Array.from(formalIds(doc.data()||{})).forEach(remember);return true;}
 let rounds=0;
 while(queue.length&&rounds<120){
  const id=text(queue.shift());
  if(!id){rounds+=1;continue;}
  if(!checkedDirect.has(id)){
   checkedDirect.add(id);
   try{await consumeDoc(await db.collection("players").doc(id).get());}catch(error){console.warn("MyCar profile direct lookup skipped",id,error);}
  }
  if(!checkedReverse.has(id)){
   checkedReverse.add(id);
   for(const field of scalarFields){
    try{const snapshot=await db.collection("players").where(field,"==",id).limit(10).get();for(const doc of snapshot.docs)await consumeDoc(doc);}catch(error){console.warn("MyCar profile alias lookup skipped",field,id,error);}
   }
   try{const linkedSnapshot=await db.collection("players").where("linkedPlayerIds","array-contains",id).limit(10).get();for(const doc of linkedSnapshot.docs)await consumeDoc(doc);}catch(error){console.warn("MyCar reverse linkedPlayerIds lookup skipped",id,error);}
  }
  rounds+=1;
 }
 return {aliases:Array.from(aliases),profileDocIds:Array.from(profileDocIds)};
}
async function getIdentityContext(){
 const identity=window.JLYIdentity;if(!identity)throw new Error("JLY Identity 尚未載入");
 const viewerId=typeof identity.getCurrentPlayerId==="function"?text(identity.getCurrentPlayerId()):text(localStorage.getItem("currentPlayerId"));
 const profileId=typeof identity.getCurrentPlayerProfileId==="function"?text(identity.getCurrentPlayerProfileId()):text(localStorage.getItem("currentPlayerProfileId"));
 let profile=null;
 if(profileId&&window.db&&typeof identity.syncFromPlayerProfile==="function"){
  try{profile=await identity.syncFromPlayerProfile(window.db,profileId);}catch(error){console.warn("MyCar current profile sync skipped",error);}
 }
 const initialLocalIds=typeof identity.getAllPlayerIdentityIds==="function"?identity.getAllPlayerIdentityIds():[viewerId,profileId];
 const cloudFromCurrent=profile?Array.from(formalIds(profile)):[];
 let cloudAliases=[],cloudProfileIds=[];
 if(window.db){const resolved=await collectCloudProfileAliases(window.db,[profileId,viewerId,...initialLocalIds,...cloudFromCurrent]);cloudAliases=resolved.aliases;cloudProfileIds=resolved.profileDocIds;}
 const cloudIds=unique([...cloudFromCurrent,...cloudAliases,...cloudProfileIds]);
 if(cloudIds.length&&typeof identity.mergeLinkedPlayerIds==="function")identity.mergeLinkedPlayerIds(cloudIds);
 const localIds=typeof identity.getAllPlayerIdentityIds==="function"?identity.getAllPlayerIdentityIds():initialLocalIds;
 const identityIds=unique([viewerId,profileId,...localIds,...cloudIds]);
 if(!viewerId&&!profileId)throw new Error("尚未取得 JLY 使用者身分");
 console.log("🧩 MyCar resolved identity aliases V14",{viewerId,profileId,cloudProfileIds,identityIds});
 return {viewerId:viewerId||profileId,profileId:profileId||cloudProfileIds[0]||"",identityIds};
}
function normalizePlayer(player,set){if(!player||cancelled(player))return player;const matched=intersect(getPlayerIdentityIds(player),set);if(!matched)return player;const next={...player};const stable=text(next.playerId||next.id||next.profileId);if(!stable||!set.has(stable))next.playerId=matched;return next;}
function normalizeCar(car,set){car=car||{};const next={...car,players:(Array.isArray(car.players)?car.players:[]).map(p=>normalizePlayer(p,set))};const owner=intersect(getOwnerIdentityIds(car),set);if(owner&&!set.has(text(next.ownerId)))next.ownerId=owner;return next;}
function carMatchesViewerAsPlayer(car,set){return (Array.isArray(car&&car.players)?car.players:[]).some(p=>p&&!cancelled(p)&&Boolean(intersect(getPlayerIdentityIds(p),set)));}
async function collectHistoricalPreparedViews(context,mod){
 const viewerIds=new Set([context.viewerId]);
 const identityIds=new Set(context.identityIds);
 const preparedCars=new Map();
 if(!window.db||!mod||typeof mod.read!=="function")return {viewerIds:[context.viewerId],identityIds:Array.from(identityIds),cars:[]};

 // Forward alias lookup: known identity -> historical/current viewer.
 for(const aliasId of context.identityIds){
  try{
   const snap=await window.db.collection("myCarViewAliases").doc(aliasId).get();
   if(snap.exists){const data=snap.data()||{};add(viewerIds,data.viewerId);add(identityIds,snap.id);add(identityIds,data.aliasId);}
  }catch(error){console.warn("MyCar alias route lookup skipped",aliasId,error);}
 }

 // V2.83 registered every historical identity as aliasId -> viewerId.
 // V13 only walked the map forward from identities we still knew, which cannot
 // recover an alias that disappeared from local/profile state. Reverse-query the
 // registered alias rows for each discovered viewer so those historical IDs are
 // restored before player membership discovery.
 const reverseScanned=new Set();
 let pass=0;
 while(pass<3){
  const pending=Array.from(viewerIds).filter(id=>!reverseScanned.has(id));
  if(!pending.length)break;
  for(const viewerId of pending){
   reverseScanned.add(viewerId);
   try{
    const snapshot=await window.db.collection("myCarViewAliases").where("viewerId","==",viewerId).limit(200).get();
    snapshot.docs.forEach(doc=>{const data=doc.data()||{};add(identityIds,doc.id);add(identityIds,data.aliasId);add(viewerIds,data.viewerId);});
   }catch(error){console.warn("MyCar reverse alias registry lookup skipped",viewerId,error);}
  }
  pass+=1;
 }

 for(const viewerId of Array.from(viewerIds)){
  try{
   const view=await mod.read(viewerId);
   if(!view)continue;
   add(identityIds,viewerId);addMany(identityIds,view.identityIds);
   (Array.isArray(view.cars)?view.cars:[]).forEach(car=>{const id=text(car&&(car.id||car.carId));if(id)preparedCars.set(id,{...car});});
  }catch(error){console.warn("MyCar historical prepared view lookup skipped",viewerId,error);}
 }
 console.log("🧭 MyCar reverse alias view consolidation V14",{viewerIds:Array.from(viewerIds),legacyIdentityCount:identityIds.size,preparedCars:preparedCars.size});
 return {viewerIds:Array.from(viewerIds),identityIds:Array.from(identityIds),cars:Array.from(preparedCars.values())};
}
async function registerCanonicalAliases(context,aliasIds){
 if(!window.db)return;
 const aliases=unique([context.viewerId,...context.identityIds,...(aliasIds||[])]),now=new Date().toISOString();
 await Promise.all(aliases.map(aliasId=>window.db.collection("myCarViewAliases").doc(aliasId).set({schemaVersion:1,aliasId,viewerId:context.viewerId,updatedAt:now},{merge:false}).catch(error=>console.warn("MyCar alias consolidation write skipped",aliasId,error))));
}
async function mergeExistingPreparedCars(context,map,set,mod){
 try{
  const existing=await mod.read(context.viewerId);
  const ids=unique(Array.isArray(existing&&existing.cars)?existing.cars.map(car=>car&&(car.id||car.carId)):[]);
  if(!ids.length||!window.JLYCarData||typeof window.JLYCarData.getCarsByIds!=="function")return 0;
  const rows=await window.JLYCarData.getCarsByIds(ids);let merged=0;
  (rows||[]).forEach(car=>{if(!car||!car.id)return;const host=Boolean(intersect(getOwnerIdentityIds(car),set));const player=carMatchesViewerAsPlayer(car,set);if(host||player){map.set(car.id,normalizeCar(car,set));merged+=1;}});return merged;
 }catch(error){console.warn("MyCar prepared-view rehydrate skipped",error);return 0;}
}
async function recoverCoreCars(context,mod,seedCars){
 const set=new Set(context.identityIds),map=new Map();
 (Array.isArray(seedCars)?seedCars:[]).forEach(car=>{const id=text(car&&(car.id||car.carId));if(id)map.set(id,normalizeCar(car,set));});
 for(const id of context.identityIds){try{const rows=await window.JLYCarData.getCarsByOwner(id);(rows||[]).forEach(car=>map.set(car.id,normalizeCar(car,set)));}catch(error){console.warn("MyCar owner query skipped",id,error);}}
 for(const id of context.identityIds){try{const rows=await window.JLYCarData.getCarsByPlayerId(id);(rows||[]).forEach(car=>map.set(car.id,normalizeCar(car,set)));}catch(error){console.warn("MyCar player query skipped",id,error);}}
 if(mod)await mergeExistingPreparedCars(context,map,set,mod);
 try{const snapshot=await window.db.collection("cars").get();snapshot.docs.forEach(doc=>{const car={id:doc.id,...(doc.data()||{})};const host=Boolean(intersect(getOwnerIdentityIds(car),set));const player=carMatchesViewerAsPlayer(car,set);if(host||player)map.set(car.id,normalizeCar(car,set));});}catch(error){console.warn("MyCar full Core fallback scan unavailable; keeping prepared/indexed recovery results",error);}
 return Array.from(map.values());
}
async function rebuild(){
 if(!window.JLYCarData)throw new Error("Car Data 尚未載入");if(typeof window.ensureMyCarViewModule!=="function")throw new Error("MyCar View Runtime 尚未載入");
 const context=await getIdentityContext();const mod=await window.ensureMyCarViewModule();
 const historical=await collectHistoricalPreparedViews(context,mod);
 context.identityIds=unique([...context.identityIds,...historical.identityIds,...historical.viewerIds]);
 if(window.JLYIdentity&&typeof window.JLYIdentity.mergeLinkedPlayerIds==="function")window.JLYIdentity.mergeLinkedPlayerIds(context.identityIds);
 const cars=await recoverCoreCars(context,mod,historical.cars);
 const view=mod.buildView({viewerId:context.viewerId,identityIds:context.identityIds,cars});
 view.identityResolutionRevision=REVISION;view.identityResolvedAt=new Date().toISOString();view.identityRepairSource="reverse-registered-alias-view-consolidation";
 await mod.write(view);await registerCanonicalAliases(context,historical.viewerIds);return view;
}
let runPromise=null;
async function run(){if(runPromise)return runPromise;runPromise=(async()=>{try{const view=await rebuild();console.log("✅ MyCar canonical identity recovery V14",{host:view.counts&&view.counts.host||0,player:view.counts&&view.counts.player||0,all:view.counts&&view.counts.all||0});if(typeof window.resetMyCarPagination==="function")window.resetMyCarPagination();if(typeof window.renderMyCars==="function")await window.renderMyCars({restoreScroll:false});return view;}catch(error){console.error("MyCar canonical identity recovery failed",error);return null;}finally{runPromise=null;}})();return runPromise;}
window.JLYMyCarLegacyIdentityRepair={REVISION,getIdentityContext,collectCloudProfileAliases,collectHistoricalPreparedViews,getPlayerIdentityIds,getOwnerIdentityIds,carMatchesViewerAsPlayer,recoverCoreCars,rebuild,run};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(run,0));else setTimeout(run,0);
})();
