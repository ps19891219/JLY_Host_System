"use strict";
const {getFirestore}=require("../firebase/admin");
const {hashSubscriptionToken}=require("./subscription-token");
const {getCarDetailViewById}=require("../firebase/car-detail-view-repository");
const {buildAuthorizedCarFeed}=require("./authorized-car-feed");
const {viewerState}=require("../car/car-view-access");
const safeId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
async function loadFeed(token,dependencies={}){
 const db=dependencies.db||getFirestore();
 const digest=hashSubscriptionToken(token);
 const doc=await db.collection("calendarSubscriptions").doc(digest).get();
 if(!doc.exists)return null;
 const record=doc.data()||{};
 if(record.status!=="active"||!safeId(record.playerId))return null;
 // Subscription IDs are an explicit allowlist, never a player-wide collection scan.
 const ids=record.carIds;
 if(!Array.isArray(ids)||ids.length===0||ids.length>12||new Set(ids).size!==ids.length||!ids.every(safeId))return null;
 const profile=await db.collection("players").doc(record.playerId).get();
 if(!profile.exists||!profile.data()?.lineUserId)return null;
 const session={profileId:record.playerId,identityId:String(profile.data()?.identityId||""),lineUserId:profile.data().lineUserId,provisional:false};
 const read=dependencies.getCarDetailViewById||getCarDetailViewById;
 const rows=[];
 for(const carId of ids){
  const car=await read(carId);
  if(!car)continue;
  const member=viewerState(car,session);
  if(member.playerStatus!=="joined"&&member.dmStatus!=="joined")continue;
  rows.push({carId,car,cancelled:["cancelled","canceled","已取消"].includes(String(car.status||"").toLowerCase()),updatedAt:car.updatedAt&&typeof car.updatedAt.toDate==="function"?car.updatedAt.toDate().toISOString():typeof car.updatedAt==="string"&&Number.isFinite(Date.parse(car.updatedAt))?car.updatedAt:undefined});
 }
 return buildAuthorizedCarFeed(rows);
}
module.exports={loadFeed};
