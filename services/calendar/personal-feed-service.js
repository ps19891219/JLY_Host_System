"use strict";
const {getFirestore}=require("../firebase/admin");
const {hashSubscriptionToken}=require("./subscription-token");
const {getCarDetailViewById}=require("../firebase/car-detail-view-repository");
const {buildAuthorizedCarFeed}=require("./authorized-car-feed");
const safeId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
async function loadFeed(token,dependencies={}){
 const db=dependencies.db||getFirestore();
 const digest=hashSubscriptionToken(token);
 const doc=await db.collection("calendarSubscriptions").doc(digest).get();
 if(!doc.exists)return null;
 const record=doc.data()||{};
 if(record.status!=="active"||!safeId(record.playerId))return null;
 // The token identifies only a subscription. Membership must still be checked.
 const relations=await db.collection("players").doc(record.playerId).collection("carRelations").where("calendarSubscription","==",true).limit(13).get();
 if(relations.docs.length>12)throw new Error("calendar_subscription_too_many_cars");
 const read=dependencies.getCarDetailViewById||getCarDetailViewById;
 const rows=[];
 for(const relation of relations.docs){
  if(!safeId(relation.id))continue;
  const info=relation.data()||{};
  if(info.calendarSubscription!==true||info.calendarSubscriptionStatus!=="approved")continue;
  const car=await read(relation.id);
  if(!car)continue;
  rows.push({carId:relation.id,car,cancelled:["cancelled","canceled","已取消"].includes(String(car.status||"").toLowerCase()),sequence:Number(info.calendarSequence||0)});
 }
 return buildAuthorizedCarFeed(rows);
}
module.exports={loadFeed};
