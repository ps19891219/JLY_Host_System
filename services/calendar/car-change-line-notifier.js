"use strict";
const {getFirestore}=require("../firebase/admin");
const {getCarDetailViewById}=require("../firebase/car-detail-view-repository");
const {viewerState}=require("../car/car-view-access");
const {sendPushMessage}=require("../line/line-push");
const {buildMobileCalendarDraft}=require("../line/mobile-calendar-event");
const text=value=>String(value==null?"":value).trim();
function scheduleChanged(before,after){
 const fields=["gameDate","date","startDate","gameTime","time","startTime","gameEndDate","gameEndTime","endDate","endTime"];
 return !!before&&!!after&&fields.some(key=>text(before[key])!==text(after[key]));
}
function buildUpdateMessage(car,carId){
 const title=text(car.scriptName||car.activityName||car.name)||"JLY 車團";
 const draft=buildMobileCalendarDraft(car,carId);
 const when=draft&&draft.start?new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(draft.start)):"請查看車團公告";
 const base=new URL(process.env.JLY_PUBLIC_ORIGIN||"https://jly-host-system-eeso.vercel.app/").origin;
 return {type:"template",altText:"車團時間已更新，請確認行事曆",template:{type:"buttons",text:(title+"\n更新時間："+when).slice(0,160),actions:[{type:"uri",label:"更新行事曆",uri:base+"/pages/car-calendar-add.html?id="+encodeURIComponent(carId)}]}};
}
/**
 * Call only after a successful persisted car date/time update.
 * Reads only subscriptions explicitly containing this car, then checks
 * current prepared roster and the canonical LINE identity before pushing.
 */
async function notifySubscribedCarTimeChange(carId,before,after,deps={}){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(text(carId)))throw Error("invalid_car_id");
 if(!scheduleChanged(before,after))return {changed:false,sent:0};
 const db=deps.db||getFirestore();
 const read=deps.getCarDetailViewById||getCarDetailViewById;
 const car=await read(carId);
 if(!car)return {changed:true,sent:0,reason:"car_missing"};
 const snapshots=await db.collection("calendarSubscriptions").where("carIds","array-contains",carId).get();
 const send=deps.sendPushMessage||sendPushMessage;
 const seen=new Set();let sent=0,failed=0;
 for(const snap of snapshots.docs){
  const record=snap.data()||{};
  if(record.status!=="active"||!record.playerId||seen.has(record.playerId))continue;
  const profile=await db.collection("players").doc(record.playerId).get();
  if(!profile.exists||!text(profile.data()?.lineUserId))continue;
  const lineUserId=text(profile.data().lineUserId);
  const membership=viewerState(car,{profileId:record.playerId,identityId:text(profile.data().identityId),lineUserId,provisional:false});
  if(membership.playerStatus!=="joined"&&membership.dmStatus!=="joined")continue;
  seen.add(record.playerId);
  try{await send(lineUserId,[buildUpdateMessage(car,carId)]);sent++;}
  catch(error){failed++;console.error("Calendar update LINE push failed",error.code||error.name||"error");}
 }
 return {changed:true,sent,failed};
}
module.exports={scheduleChanged,buildUpdateMessage,notifySubscribedCarTimeChange};
