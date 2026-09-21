"use strict";
const D=require("../../js/modules/studio/studio-booking-activity.js");
const {getFirestore}=require("../firebase/admin");
const bookingRepo=require("../firebase/studio-booking-repository");
const recruitment=require("./studio-recruitment-view-service");
const txt=v=>String(v==null?"":v).trim();
function carRef(db,id){const v=txt(id);if(!v)throw new Error("activity_id_required");return db.collection("cars").doc(v)}
function compactBookingActivity(b){const now=new Date().toISOString(),scriptName=txt(b.scriptName),gameDate=txt(b.date),gameTime=txt(b.time),totalPeople=Number(b.totalPeople||b.capacity||0),maleSlots=Number(b.maleSlots||0),femaleSlots=Number(b.femaleSlots||0),flexibleSlots=Number(b.flexibleSlots||Math.max(0,totalPeople-maleSlots-femaleSlots));return {ownerId:txt(b.hostPersonId),activityType:"劇本",activityName:scriptName,scriptId:txt(b.scriptId)||null,scriptName,gameDate,gameTime,location:txt(b.locationName||b.location),locationName:txt(b.locationName||b.location),organizer:txt(b.studioName),organizerName:txt(b.studioName),studioName:txt(b.studioName),studioId:txt(b.studioId),branchId:txt(b.branchId)||null,dmName:txt(b.dmName),price:b.price==null?null:Number(b.price),note:txt(b.note),peopleMode:txt(b.peopleMode)||"total",maleSlots,femaleSlots,flexibleSlots,totalPeople,capacity:totalPeople,slots:Array.isArray(b.slots)?b.slots:[],showFlexibleSlotSource:false,dataVersion:1,seatSystemVersion:1,myRole:"host",isHost:true,isPlayer:false,isFavoriteCar:false,visibility:txt(b.visibility)||"private",publicRecruitmentPreference:b.publicRecruitmentPreference===true,guestListVisibility:txt(b.guestListVisibility)||"approved_only",players:[],applications:[],staffSlots:[],history:[{type:"建立車團",text:"Studio 預約確認後建立正式車團",time:now}],conflictStatus:"none",conflictWithCarIds:[],conflictNote:"",calendar:b.calendar||{syncEnabled:false,syncStatus:"not_synced"},calendarStatus:"not_added",calendarEventId:null,status:gameDate?"招募中":"規劃中",planningStatus:gameDate?"scheduled":"unscheduled",bookingStatus:"accepted",studioBookingId:txt(b.id),createdAt:now,updatedAt:now}}
async function confirmBooking(bookingId,{confirmedBy}={}){
 const db=getFirestore();const booking=await bookingRepo.getBooking(bookingId);if(!booking)throw new Error("booking_not_found");
 let existing=null;if(txt(booking.activityId)){const s=await carRef(db,booking.activityId).get();if(!s.exists)throw new Error("existing_activity_required");existing={id:s.id,...s.data()}}
 const plan=D.bookingAcceptancePlan({booking,activity:existing});
 if(plan.action==="needs_human_confirmation")return {confirmed:false,...plan};
 let activityId=txt(booking.activityId),activity=null;
 if(plan.createActivity){const r=db.collection("cars").doc();activityId=r.id;activity={id:activityId,...compactBookingActivity(booking),createdAt:new Date().toISOString()};await r.set(activity)}
 else {activity={...existing,bookingStatus:"accepted",studioBookingId:txt(booking.id),studioId:txt(booking.studioId),branchId:txt(booking.branchId)||existing.branchId||null,updatedAt:new Date().toISOString()};await carRef(db,activityId).set({bookingStatus:activity.bookingStatus,studioBookingId:activity.studioBookingId,studioId:activity.studioId,branchId:activity.branchId,updatedAt:activity.updatedAt},{merge:true})}
 await bookingRepo.updateStatus(bookingId,"accepted",{activityId,confirmedBy:txt(confirmedBy)||null,confirmedAt:new Date().toISOString()});
 await recruitment.syncActivity(activity);
 return {confirmed:true,activityId,createdActivity:plan.createActivity,activity,preparedViewsRequired:true,calendarSyncRequired:Boolean(activity.calendar&&activity.calendar.syncEnabled)};
}
function proposeStudioChange(activity,beforeAfter,{studioId,createdAt}={}){
 const before=beforeAfter&&beforeAfter.before||activity||{},after=beforeAfter&&beforeAfter.after||{};const plan=D.studioChangePlan(before,after);
 if(!plan.pendingActionRequired)return {applyImmediately:true,patch:after};
 return {applyImmediately:false,proposal:{type:"studio_activity_change",studioId:txt(studioId||activity&&activity.studioId),activityId:txt(activity&&activity.id),status:"pending",changedFields:plan.fields,before:plan.fields.reduce((o,k)=>(o[k]=before[k]??null,o),{}),after:plan.fields.reduce((o,k)=>(o[k]=after[k]??null,o),{}),createdAt:txt(createdAt)||new Date().toISOString()}};
}
module.exports={confirmBooking,proposeStudioChange,compactBookingActivity};