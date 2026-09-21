"use strict";
const crypto=require("crypto");
const {getFirestore}=require("../services/firebase/admin");
const {readCookie,verifyMemberSession}=require("../services/line/member-session");
const {expandFormalPersonIds}=require("../services/work-schedule/staff-person-links");
const domain=require("../shared/work-schedule/staff-assignment-confirmation");
const text=v=>String(v||"").trim();
const send=(res,status,data)=>{res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data))};
const add=(set,v)=>{const id=text(v);if(id)set.add(id)};
function membershipId(studio,personId){return crypto.createHash("sha256").update(`${studio}:${personId}`).digest("hex").slice(0,40)}
async function candidates(db,session){const ids=new Set();add(ids,session.profileId);add(ids,session.identityId);if(session.lineUserId){const s=await db.collection("players").where("lineUserId","==",session.lineUserId).limit(10).get();for(const d of s.docs){add(ids,d.id);const x=d.data()||{};["identityId","playerId","personId","canonicalPersonId","profileId"].forEach(k=>add(ids,x[k]));(x.linkedPlayerIds||[]).forEach(v=>add(ids,v))}}return expandFormalPersonIds(db,ids)}
async function member(db,studio,ids){for(const id of ids){const d=await db.collection("studioMemberships").doc(membershipId(studio,id)).get();if(d.exists&&text((d.data()||{}).status||"active")==="active")return d.data()||{}}return null}
async function assignment(db,shiftId,personId){const id=crypto.createHash("sha256").update(`${shiftId}:${personId}`).digest("hex").slice(0,40),ref=db.collection("workScheduleStaffConfirmations").doc(id),doc=await ref.get();return{id,ref,doc}}
module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return send(res,405,{success:false,error:"method_not_allowed"})}
 const verified=verifyMemberSession(readCookie(req),text(process.env.LINE_CHANNEL_SECRET));if(!verified.valid)return send(res,401,{success:false,error:"line_login_required"});
 const body=req.method==="POST"?(req.body||{}):(req.query||{}),studio=text(body.studio),shiftId=text(body.shiftId);if(!studio||!shiftId)return send(res,400,{success:false,error:"studio_and_shift_required"});
 try{const db=getFirestore(),ids=await candidates(db,verified.data||{});if(!ids.size)return send(res,403,{success:false,error:"person_link_required"});if(!await member(db,studio,ids))return send(res,403,{success:false,error:"not_studio_member"});
 const shiftDoc=await db.collection("workShifts").doc(shiftId).get();if(!shiftDoc.exists)return send(res,404,{success:false,error:"shift_not_found"});const shift={id:shiftDoc.id,...shiftDoc.data()},assigned=new Set((shift.assignedPersonIds||shift.personIds||[]).map(String)),personId=[...ids].find(id=>assigned.has(String(id)));if(!personId)return send(res,403,{success:false,error:"shift_not_assigned_to_person"});
 const a=await assignment(db,shiftId,personId);if(req.method==="GET"){if(!a.doc.exists)return send(res,200,{success:true,status:"unconfirmed",shiftId,personId});const d=a.doc.data()||{},current=domain.invalidateIfChanged(d,shift);return send(res,200,{success:true,status:current.status,shiftId,personId,invalidatedReason:text(current.invalidatedReason)})}
 const action=text(body.action);let current=a.doc.exists?a.doc.data():domain.createTentative({shiftId,personId,studioId:studio,sourceMatchingId:shift.sourceMatchingId,sourceSlotId:shift.sourceSlotId,shift});if(action==="confirm")current=domain.confirm(current,shift);else if(action==="decline")current=domain.decline(current);else return send(res,400,{success:false,error:"invalid_action"});
 await a.ref.set({...current,updatedAt:new Date().toISOString()},{merge:true});return send(res,200,{success:true,status:current.status,shiftId,personId});
 }catch(e){console.error("staff confirmation failed",e);return send(res,500,{success:false,error:e.message||"staff_confirmation_failed"})}
};
