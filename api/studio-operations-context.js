"use strict";
const crypto=require("crypto");
const {getFirestore}=require("../services/firebase/admin");
const {readCookie,verifyMemberSession}=require("../services/line/member-session");
const {expandFormalPersonIds}=require("../services/work-schedule/staff-person-links");
const txt=v=>String(v==null?"":v).trim();
const send=(res,code,body)=>{res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","private, no-store");res.end(JSON.stringify(body));};
const add=(set,v)=>{const id=txt(v);if(id)set.add(id);};
const membershipId=(studio,personId)=>crypto.createHash("sha256").update(`${studio}:${personId}`).digest("hex").slice(0,40);
async function candidateIds(db,session){
 const ids=new Set();add(ids,session.profileId);add(ids,session.identityId);
 if(session.profileId&&!String(session.profileId).startsWith("line:")){
  const d=await db.collection("players").doc(session.profileId).get();
  if(d.exists){const x=d.data()||{};add(ids,d.id);["identityId","playerId","personId","canonicalPersonId","profileId"].forEach(k=>add(ids,x[k]));(x.linkedPlayerIds||[]).forEach(v=>add(ids,v));}
 }
 if(![...ids].some(id=>!String(id).startsWith("line:"))&&session.lineUserId){
  const s=await db.collection("players").where("lineUserId","==",session.lineUserId).limit(5).get();
  for(const d of s.docs){const x=d.data()||{};add(ids,d.id);["identityId","playerId","personId","canonicalPersonId","profileId"].forEach(k=>add(ids,x[k]));(x.linkedPlayerIds||[]).forEach(v=>add(ids,v));}
 }
 return expandFormalPersonIds(db,ids);
}
async function membership(db,studio,ids,{maxReads=8}={}){
 let reads=0;
 for(const id of ids){if(reads>=maxReads)break;reads++;const d=await db.collection("studioMemberships").doc(membershipId(studio,id)).get();if(d.exists&&txt((d.data()||{}).status||"active")==="active")return{id:d.id,...d.data()};}
 return null;
}
module.exports=async function(req,res){
 if(!req||req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{success:false,error:"method_not_allowed"});}
 const studio=txt(req.query&&req.query.studio);if(!studio)return send(res,400,{success:false,error:"studio_required"});
 const verified=verifyMemberSession(readCookie(req),txt(process.env.LINE_CHANNEL_SECRET));if(!verified.valid)return send(res,401,{success:false,error:"line_login_required"});
 try{
  const db=getFirestore(),ids=await candidateIds(db,verified.data||{});if(!ids.size)return send(res,403,{success:false,error:"person_link_required"});
  const member=await membership(db,studio,ids);if(!member)return send(res,403,{success:false,error:"studio_membership_required"});
  const [booking,pending]=await Promise.all([db.collection("studioBookingInboxViews").doc(studio).get(),db.collection("pendingActionStudioViews").doc(studio).get()]);
  const bookingInbox=booking.exists?booking.data()||{}:{schemaVersion:1,studioId:studio,bookings:[],count:0};
  const pendingData=pending.exists?pending.data()||{}:{schemaVersion:1,studioId:studio,actions:[],count:0};
  return send(res,200,{success:true,studioId:studio,membership:{personId:txt(member.personId),studioId:studio,status:txt(member.status||"active"),roles:Array.isArray(member.roles)?member.roles:[],permissions:Array.isArray(member.permissions)?member.permissions:[],effectivePermissions:Array.isArray(member.effectivePermissions)?member.effectivePermissions:[]},bookingInbox,pendingActions:Array.isArray(pendingData.actions)?pendingData.actions:[],readSource:["studioBookingInboxViews","pendingActionStudioViews"],readBudget:{preparedViewReads:2,membershipReadsMax:8}});
 }catch(e){console.error("studio operations context failed",e);return send(res,500,{success:false,error:e.message||"studio_operations_context_failed"});}
};