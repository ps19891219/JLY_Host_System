"use strict";
const {getFirestore}=require("../services/firebase/admin");
const {getCarDetailViewById}=require("../services/firebase/car-detail-view-repository");
const {viewerState}=require("../services/car/car-view-access");
const {verifyMemberSession,readCookie}=require("../services/line/member-session");
const {newSubscriptionToken,hashSubscriptionToken,buildSubscriptionUrl}=require("../services/calendar/subscription-token");
function json(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.end(JSON.stringify(payload));}
function createHandler(deps={}){
 return async(req,res)=>{
  if(req.method!=="POST")return json(res,405,{success:false,error:"method_not_allowed"});
  const session=(deps.verifySession||verifyMemberSession)((deps.readCookie||readCookie)(req));
  if(!session.valid||session.data.provisional===true||!session.data.profileId||!session.data.lineUserId)return json(res,401,{success:false,error:"line_login_required"});
  try{
   const db=deps.db||getFirestore();
   const playerId=session.data.profileId;
   const profile=await db.collection("players").doc(playerId).get();
   if(!profile.exists||profile.data()?.lineUserId!==session.data.lineUserId)return json(res,403,{success:false,error:"identity_not_linked"});
   const body=req.body&&typeof req.body==="object"?req.body:{};
   const carId=String(body.carId||"").trim();
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(carId))return json(res,400,{success:false,error:"car_id_required"});
   const car=await (deps.getCarDetailViewById||getCarDetailViewById)(carId);
   if(!car)return json(res,404,{success:false,error:"car_not_found"});
   const membership=viewerState(car,{profileId:playerId,identityId:String(profile.data()?.identityId||""),lineUserId:session.data.lineUserId,provisional:false});
   if(membership.playerStatus!=="joined"&&membership.dmStatus!=="joined")return json(res,403,{success:false,error:"car_membership_required"});
   // A returning subscriber may authorize one additional car using the same private feed.
   // Never append a car without checking the current verified roster above.
   const existingToken=String(body.token||"");
   if(existingToken){
    let existingDigest;
    try{existingDigest=hashSubscriptionToken(existingToken);}catch(_){return json(res,400,{success:false,error:"invalid_token"});}
    const existingRef=db.collection("calendarSubscriptions").doc(existingDigest);
    const existing=await existingRef.get();
    if(!existing.exists||existing.data()?.playerId!==playerId||existing.data()?.status!=="active")return json(res,403,{success:false,error:"subscription_not_owned"});
    const ids=existing.data()?.carIds;
    if(!Array.isArray(ids)||ids.length>12||ids.some(id=>typeof id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(id)))return json(res,409,{success:false,error:"invalid_subscription_scope"});
    if(!ids.includes(carId)){
     if(ids.length>=12)return json(res,409,{success:false,error:"subscription_car_limit"});
     await existingRef.update({carIds:require("firebase-admin/firestore").FieldValue.arrayUnion(carId)});
    }
    return json(res,200,{success:true,url:buildSubscriptionUrl(new URL(process.env.JLY_PUBLIC_ORIGIN||"https://jly-host-system-eeso.vercel.app/").origin,existingToken)});
   }
   const token=(deps.newToken||newSubscriptionToken)();
   const digest=hashSubscriptionToken(token);
   await db.collection("calendarSubscriptions").doc(digest).create({playerId,status:"active",createdAt:new Date().toISOString(),kind:"personal_ics",carIds:[carId]});
   const origin=process.env.JLY_PUBLIC_ORIGIN||"https://jly-host-system-eeso.vercel.app/";
   return json(res,201,{success:true,url:buildSubscriptionUrl(origin,token)});
  }catch(error){
   console.error("calendar subscription issuance failed",error.code||error.name||"error");
   return json(res,503,{success:false,error:"calendar_subscription_unavailable"});
  }
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
