"use strict";
const {getFirestore}=require("../services/firebase/admin");
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
   const token=(deps.newToken||newSubscriptionToken)();
   const digest=hashSubscriptionToken(token);
   await db.collection("calendarSubscriptions").doc(digest).create({playerId,status:"active",createdAt:new Date().toISOString(),kind:"personal_ics"});
   const origin=process.env.JLY_PUBLIC_ORIGIN||"https://jly-host-system-eeso.vercel.app/";
   return json(res,201,{success:true,url:buildSubscriptionUrl(origin,token)});
  }catch(error){
   console.error("calendar subscription issuance failed",error.code||error.name||"error");
   return json(res,503,{success:false,error:"calendar_subscription_unavailable"});
  }
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
