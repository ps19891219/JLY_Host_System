"use strict";
const {getFirestore}=require("../services/firebase/admin");
const {verifyMemberSession,readCookie}=require("../services/line/member-session");
const {hashSubscriptionToken}=require("../services/calendar/subscription-token");
function reply(res,status,body){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(body));}
function createHandler(deps={}){
 return async(req,res)=>{
  if(req.method!=="POST")return reply(res,405,{success:false,error:"method_not_allowed"});
  const session=(deps.verifySession||verifyMemberSession)((deps.readCookie||readCookie)(req));
  if(!session.valid||session.data.provisional||!session.data.profileId||!session.data.lineUserId)return reply(res,401,{success:false,error:"line_login_required"});
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const token=String(body.token||"");
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return reply(res,400,{success:false,error:"invalid_token"});
  try{
   const db=deps.db||getFirestore();
   const profile=await db.collection("players").doc(session.data.profileId).get();
   if(!profile.exists||profile.data()?.lineUserId!==session.data.lineUserId)return reply(res,403,{success:false,error:"identity_not_linked"});
   const ref=db.collection("calendarSubscriptions").doc(hashSubscriptionToken(token));
   const existing=await ref.get();
   if(!existing.exists||existing.data()?.playerId!==session.data.profileId)return reply(res,404,{success:false,error:"subscription_not_found"});
   await ref.update({status:"revoked",revokedAt:new Date().toISOString()});
   return reply(res,200,{success:true});
  }catch(error){
   console.error("calendar subscription revoke failed",error.code||error.name||"error");
   return reply(res,503,{success:false,error:"calendar_subscription_unavailable"});
  }
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
