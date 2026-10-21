"use strict";
const {getFirestore}=require("../services/firebase/admin");
const {verifyMemberSession,readCookie}=require("../services/line/member-session");
const {notifySubscribedCarTimeChange,scheduleChanged}=require("../services/calendar/car-change-line-notifier");
const text=v=>String(v==null?"":v).trim();
const validId=v=>/^[A-Za-z0-9_-]{1,128}$/.test(text(v));
function reply(res,status,body){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(body));}
function createHandler(deps={}){
 return async(req,res)=>{
  if(req.method!=="POST")return reply(res,405,{success:false,error:"method_not_allowed"});
  const expected=new URL(process.env.JLY_PUBLIC_ORIGIN||"https://jly-host-system-eeso.vercel.app").origin;
  if(req.headers?.origin!==expected)return reply(res,403,{success:false,error:"origin_not_allowed"});
  const session=(deps.verifySession||verifyMemberSession)((deps.readCookie||readCookie)(req));
  if(!session.valid||session.data.provisional||!validId(session.data.profileId)||!session.data.lineUserId)return reply(res,401,{success:false,error:"line_login_required"});
  const {carId,auditId}=req.body||{};
  if(!validId(carId)||!validId(auditId))return reply(res,400,{success:false,error:"invalid_request"});
  try{
   const db=deps.db||getFirestore();
   const profile=await db.collection("players").doc(session.data.profileId).get();
   if(!profile.exists||text(profile.data()?.lineUserId)!==session.data.lineUserId)return reply(res,403,{success:false,error:"identity_not_linked"});
   const carRef=db.collection("cars").doc(carId),auditRef=carRef.collection("auditLogs").doc(auditId);
   const [carSnap,auditSnap]=await Promise.all([carRef.get(),auditRef.get()]);
   if(!carSnap.exists||!auditSnap.exists)return reply(res,404,{success:false,error:"mutation_not_found"});
   const car=carSnap.data()||{},audit=auditSnap.data()||{};
   const actorIds=[text(audit.actorId),text(audit.actorProfileId)];
   const identityIds=[text(session.data.profileId),text(session.data.identityId)].filter(Boolean);
   const ownerIds=[text(car.ownerId),text(car.hostId),text(car.createdBy)];
   if(!actorIds.some(id=>id&&identityIds.includes(id))||!ownerIds.some(id=>id&&identityIds.includes(id)))return reply(res,403,{success:false,error:"host_required"});
   if(audit.actionType!=="car_edit"||audit.source!=="editcar"||!scheduleChanged(audit.before,audit.after))return reply(res,200,{success:true,sent:0,reason:"no_schedule_change"});
   const changed=["gameDate","gameTime","gameEndDate","gameEndTime"].filter(k=>Object.prototype.hasOwnProperty.call(audit.after||{},k));
   if(!changed.length||changed.some(k=>text(car[k])!==text(audit.after[k])))return reply(res,409,{success:false,error:"mutation_superseded"});
   const created=Date.parse(audit.createdAt);
   if(!Number.isFinite(created)||Math.abs(Date.now()-created)>10*60*1000)return reply(res,409,{success:false,error:"mutation_expired"});
   const claimRef=carRef.collection("calendarNotificationClaims").doc(auditId);
   const claimed=await db.runTransaction(async tx=>{
    const old=await tx.get(claimRef);
    if(old.exists)return false;
    tx.create(claimRef,{createdAt:new Date().toISOString(),auditId,actorProfileId:session.data.profileId});
    return true;
   });
   if(!claimed)return reply(res,200,{success:true,sent:0,reason:"already_processed"});
   const result=await (deps.notify||notifySubscribedCarTimeChange)(carId,audit.before,audit.after,{db});
   return reply(res,result.failed>0?207:200,{success:result.failed===0,...result,reason:result.failed>0?"partial_line_delivery_failure":undefined});
  }catch(error){console.error("Calendar change notification failed",error.code||error.name||"error");return reply(res,503,{success:false,error:"notification_unavailable"});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
