"use strict";

const crypto=require("crypto");
const {verifyGroupAssistantToken}=require("../services/line/group-assistant-link");
const {readCookie,verifyMemberSession}=require("../services/line/member-session");
const {getBindingByGroupId}=require("../services/firebase/line-group-binding-repository");
const {getCarById}=require("../services/firebase/line-accounting-authorization-repository");
const {getFirestore}=require("../services/firebase/admin");
const {collectMembers}=require("../services/line/quick-accounting-service");
const {buildActivityAccountingSummary}=require("../services/accounting/activity-accounting-summary");

const text=value=>String(value||"").trim();
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
function body(req){if(req.body&&typeof req.body==="object")return req.body;try{return JSON.parse(req.body||"{}");}catch(_){return{};}}
async function actorIds(session){const ids=new Set([session.profileId,session.identityId].map(text).filter(Boolean));if(session.profileId){const snapshot=await getFirestore().collection("players").doc(session.profileId).get();if(snapshot.exists){const profile=snapshot.data()||{};[snapshot.id,profile.identityId,profile.playerId,profile.personId,...(profile.linkedPlayerIds||[])].map(text).filter(Boolean).forEach(id=>ids.add(id));}}return ids;}

module.exports=async function handler(req,res){
  if(req.method!=="POST")return send(res,405,{success:false,error:"method_not_allowed"});
  try{
    const input=body(req),link=verifyGroupAssistantToken(input.token),session=verifyMemberSession(readCookie(req));
    if(!link.valid)return send(res,401,{success:false,error:"invalid_link"});if(!session.valid)return send(res,401,{success:false,error:"line_login_required"});
    const {groupId,carId}=link.data,[binding,car,ids]=await Promise.all([getBindingByGroupId(groupId),getCarById(carId),actorIds(session.data)]);
    if(!binding||binding.status!=="active"||text(binding.carId)!==text(carId))return send(res,403,{success:false,error:"binding_inactive"});if(!car)return send(res,404,{success:false,error:"car_not_found"});
    const member=collectMembers(car).find(item=>ids.has(text(item.personId)));if(!member)return send(res,403,{success:false,error:"car_member_required"});
    const actorPersonId=text(member.personId),db=getFirestore(),root=db.collection("cars").doc(carId),now=new Date().toISOString();
    if(input.action==="claim"){
      const from=text(input.fromPersonId),to=text(input.toPersonId),value=Math.round(Number(input.amount)||0);if(actorPersonId!==from||!to||value<=0)return send(res,403,{success:false,error:"settlement_not_allowed"});
      const [entries,settlements]=await Promise.all([root.collection("accountingEntries").get(),root.collection("accountingSettlements").get()]);const records=settlements.docs.map(doc=>({settlementId:doc.id,...doc.data()}));if(records.some(item=>item.status==="payment_claimed"&&text(item.fromPersonId)===from&&text(item.toPersonId)===to))return send(res,409,{success:false,error:"settlement_already_claimed"});const summary=buildActivityAccountingSummary(entries.docs.map(doc=>({transactionId:doc.id,...doc.data()})),records),available=(summary.settlementTransfers||[]).filter(item=>item.fromPersonId===from&&item.toPersonId===to).reduce((sum,item)=>sum+Number(item.amount||0),0);if(value>available)return send(res,409,{success:false,error:"settlement_amount_changed"});
      const settlementId=`line-${crypto.randomUUID()}`,settlement={settlementId,activityId:carId,carId,fromPersonId:from,toPersonId:to,debtorPersonId:from,receiverPersonId:to,paidBy:actorPersonId,amount:value,responsibilityModel:"pairwise_v1",status:"payment_claimed",paymentClaimedBy:actorPersonId,paymentClaimedAt:now,createdAt:now,updatedAt:now,source:"line_accounting_web",history:[{action:"payment_claimed",actorPersonId,at:now,source:"line_accounting_web"}]},pending={pendingActionId:`net_confirmation-${settlementId}`,actionType:"payment_confirmation",responsiblePersonId:to,settlementId,activityId:carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",actorPersonId,at:now}]};
      await db.runTransaction(async tx=>{tx.set(root.collection("accountingSettlements").doc(settlementId),settlement,{merge:false});tx.set(root.collection("accountingPendingActions").doc(pending.pendingActionId),pending,{merge:false});tx.set(root.collection("accountingViews").doc("activityCurrent"),{schemaVersion:0,summarySourceVersion:"",updatedAt:now},{merge:true});});return send(res,200,{success:true,settlementId,status:"payment_claimed"});
    }
    if(input.action==="confirm"){
      const settlementId=text(input.settlementId),ref=root.collection("accountingSettlements").doc(settlementId),pendingRef=root.collection("accountingPendingActions").doc(`net_confirmation-${settlementId}`);await db.runTransaction(async tx=>{const [snapshot,pendingSnapshot]=await Promise.all([tx.get(ref),tx.get(pendingRef)]);if(!snapshot.exists)throw new Error("settlement_not_found");const before=snapshot.data();if(before.status!=="payment_claimed"||text(before.toPersonId||before.receiverPersonId)!==actorPersonId)throw new Error("settlement_not_allowed");const after={...before,status:"settled",confirmedBy:actorPersonId,confirmedAt:now,updatedAt:now,history:[...(before.history||[]),{action:"settled",actorPersonId,at:now,source:"line_accounting_web"}]};tx.set(ref,after,{merge:false});if(pendingSnapshot.exists)tx.set(pendingRef,{...pendingSnapshot.data(),status:"completed",completedAt:now,updatedAt:now,history:[...(pendingSnapshot.data().history||[]),{status:"completed",actorPersonId,at:now}]},{merge:false});tx.set(root.collection("accountingViews").doc("activityCurrent"),{schemaVersion:0,summarySourceVersion:"",updatedAt:now},{merge:true});});return send(res,200,{success:true,settlementId,status:"settled"});
    }
    return send(res,400,{success:false,error:"unsupported_action"});
  }catch(error){console.error("LINE 帳務操作失敗",error);return send(res,error.message==="settlement_not_allowed"?403:500,{success:false,error:error.message||"accounting_action_failed"});}
};
