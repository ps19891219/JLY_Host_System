"use strict";
const {getFirestore}=require("../services/firebase/admin");
const {readCookie,verifyMemberSession}=require("../services/line/member-session");
const {resolveCandidateIds}=require("../services/work-schedule/staff-person-links");
function respond(res,status,data){
 res.statusCode=status;
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","private, no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.end(JSON.stringify(data));
}
function createHandler(deps={}){
 const verify=deps.verifyMemberSession||verifyMemberSession;
 const read=deps.readCookie||readCookie;
 const db=deps.getFirestore||getFirestore;
 const resolve=deps.resolveCandidateIds||resolveCandidateIds;
 return async function handler(req,res){
  if(req.method!=="GET")return respond(res,405,{success:false,error:"method_not_allowed"});
  const signed=verify(read(req),String(process.env.LINE_CHANNEL_SECRET||""));
  if(!signed.valid)return respond(res,401,{success:false,error:"line_login_required"});
  const session=signed.data||{};
  if(session.provisional===true||!session.profileId)return respond(res,403,{success:false,error:"person_link_required"});
  try{
   const ids=await resolve(db(),session);
   if(!ids.size)return respond(res,403,{success:false,error:"person_link_required"});
   return respond(res,200,{success:true,candidatePersonIds:[...ids].filter(id=>!String(id).startsWith("line:"))});
  }catch(error){
   console.error("Work Schedule mine identity failed",error);
   return respond(res,500,{success:false,error:"identity_unavailable"});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
