"use strict";
const D=require("../../js/modules/studio/studio-booking-activity.js");
const {getFirestore}=require("../firebase/admin");
const bookingRepo=require("../firebase/studio-booking-repository");
const txt=v=>String(v==null?"":v).trim();
function carRef(db,id){const v=txt(id);if(!v)throw new Error("activity_id_required");return db.collection("cars").doc(v)}
function compactBookingActivity(b){return {scriptId:txt(b.scriptId)||null,scriptName:txt(b.scriptName)||null,studioId:txt(b.studioId),branchId:txt(b.branchId)||null,gameDate:txt(b.date)||null,gameTime:txt(b.time)||null,ownerId:txt(b.hostPersonId),status:"招募中",bookingStatus:"accepted",studioBookingId:txt(b.id),updatedAt:new Date().toISOString()}}
async function confirmBooking(bookingId,{confirmedBy}={}){
 const db=getFirestore();const booking=await bookingRepo.getBooking(bookingId);if(!booking)throw new Error("booking_not_found");
 let existing=null;if(txt(booking.activityId)){const s=await carRef(db,booking.activityId).get();if(!s.exists)throw new Error("existing_activity_required");existing={id:s.id,...s.data()}}
 const plan=D.bookingAcceptancePlan({booking,activity:existing});
 if(plan.action==="needs_human_confirmation")return {confirmed:false,...plan};
 let activityId=txt(booking.activityId),activity=null;
 if(plan.createActivity){const r=db.collection("cars").doc();activityId=r.id;activity={id:activityId,...compactBookingActivity(booking),createdAt:new Date().toISOString()};await r.set(activity)}
 else {activity={...existing,bookingStatus:"accepted",studioBookingId:txt(booking.id),studioId:txt(booking.studioId),branchId:txt(booking.branchId)||existing.branchId||null,updatedAt:new Date().toISOString()};await carRef(db,activityId).set({bookingStatus:activity.bookingStatus,studioBookingId:activity.studioBookingId,studioId:activity.studioId,branchId:activity.branchId,updatedAt:activity.updatedAt},{merge:true})}
 await bookingRepo.updateStatus(bookingId,"accepted",{activityId,confirmedBy:txt(confirmedBy)||null,confirmedAt:new Date().toISOString()});
 return {confirmed:true,activityId,createdActivity:plan.createActivity,activity};
}
function proposeStudioChange(activity,beforeAfter,{studioId,createdAt}={}){
 const before=beforeAfter&&beforeAfter.before||activity||{},after=beforeAfter&&beforeAfter.after||{};const plan=D.studioChangePlan(before,after);
 if(!plan.pendingActionRequired)return {applyImmediately:true,patch:after};
 return {applyImmediately:false,proposal:{type:"studio_activity_change",studioId:txt(studioId||activity&&activity.studioId),activityId:txt(activity&&activity.id),status:"pending",changedFields:plan.fields,before:plan.fields.reduce((o,k)=>(o[k]=before[k]??null,o),{}),after:plan.fields.reduce((o,k)=>(o[k]=after[k]??null,o),{}),createdAt:txt(createdAt)||new Date().toISOString()}};
}
module.exports={confirmBooking,proposeStudioChange,compactBookingActivity};