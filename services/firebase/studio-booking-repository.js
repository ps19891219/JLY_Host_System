"use strict";
const {getFirestore}=require("./admin");
const txt=v=>String(v==null?"":v).trim();
const COLLECTION="studioBookingRequests";
const inboxId=studioId=>txt(studioId);
function ref(id){const v=txt(id);if(!v)throw new Error("booking_id_required");return getFirestore().collection(COLLECTION).doc(v)}
async function getBooking(id){const s=await ref(id).get();return s.exists?{id:s.id,...s.data()}:null}
async function createBooking(data={}){
 const db=getFirestore(),r=db.collection(COLLECTION).doc();const now=new Date().toISOString();
 const row={activityId:txt(data.activityId)||null,studioId:txt(data.studioId),branchId:txt(data.branchId)||null,scriptId:txt(data.scriptId)||null,scriptName:txt(data.scriptName)||null,date:txt(data.date)||null,time:txt(data.time)||null,hostPersonId:txt(data.hostPersonId),status:"pending",createdAt:now,updatedAt:now};
 if(!row.studioId||!row.hostPersonId)throw new Error("booking_scope_required");
 await db.runTransaction(async tx=>{tx.set(r,row);const vr=db.collection("studioBookingInboxViews").doc(inboxId(row.studioId));const vs=await tx.get(vr);const view=vs.exists?vs.data()||{}:{};const bookings=Array.isArray(view.bookings)?view.bookings.filter(x=>txt(x.id)!==r.id):[];bookings.push({id:r.id,...row});tx.set(vr,{schemaVersion:1,viewType:"studio_booking_inbox",studioId:row.studioId,bookings,count:bookings.length,builtAt:now},{merge:false})});
 return {id:r.id,...row};
}
async function updateStatus(id,status,patch={}){
 const db=getFirestore(),r=ref(id),now=new Date().toISOString();let result=null;
 await db.runTransaction(async tx=>{const s=await tx.get(r);if(!s.exists)throw new Error("booking_not_found");const before={id:s.id,...s.data()};const next={...before,...patch,status:txt(status),updatedAt:now};tx.set(r,{...patch,status:next.status,updatedAt:now},{merge:true});const vr=db.collection("studioBookingInboxViews").doc(txt(before.studioId));const vs=await tx.get(vr);if(vs.exists){const view=vs.data()||{};const active=new Set(["pending","adjustment_proposed"]);const rows=(Array.isArray(view.bookings)?view.bookings:[]).filter(x=>txt(x.id)!==id);if(active.has(next.status))rows.push(next);tx.set(vr,{...view,bookings:rows,count:rows.length,builtAt:now},{merge:false})}result=next});
 return result;
}
module.exports={COLLECTION,getBooking,createBooking,updateStatus};