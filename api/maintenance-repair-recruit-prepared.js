"use strict";
const { getFirestore } = require("../services/firebase/admin");
const CONFIRM = "REPAIR_SELECTED_PREPARED_VIEW";
const FIELDS = ["scriptName","gameDate","gameTime","status","visibility","players","playerIds","slots","peopleMode","maleSlots","femaleSlots","flexibleSlots","totalPeople","capacity","applications","staffSlots","updatedAt"];
const text=v=>String(v==null?"":v).trim();
function norm(v){if(v&&typeof v.toDate==="function")return v.toDate().toISOString();if(Array.isArray(v))return v.map(norm);if(v&&typeof v==="object"){const o={};Object.keys(v).sort().forEach(k=>o[k]=norm(v[k]));return o;}return v===undefined?null:v;}
function pick(c){const o={};FIELDS.forEach(k=>o[k]=norm(c&&c[k]));return o;}
function compare(a,b){const x=pick(a),y=pick(b),changedFields=FIELDS.filter(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]));return {stale:changedFields.length>0,changedFields,core:x,prepared:y};}
function send(res,s,b){res.statusCode=s;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(b));}
async function state(db,id){const [a,b]=await Promise.all([db.collection("cars").doc(id).get(),db.collection("carDetailViews").doc(id).get()]);const core=a.exists?{id:a.id,...(a.data()||{})}:null;const v=b.exists?(b.data()||{}):null;const prepared=v&&v.car?{...v.car,id:text(v.car.id||v.carId||id)}:null;return {core,prepared,comparison:core?compare(core,prepared):{stale:false,changedFields:[]}};}
async function writeView(db,car){const id=text(car.id);await db.collection("carDetailViews").doc(id).set({schemaVersion:1,viewType:"car_detail",carId:id,ownerId:text(car.ownerId),sourceUpdatedAt:car.updatedAt||null,builtAt:new Date().toISOString(),car:{...car,id}},{merge:false});}
module.exports=async function(req,res){
 if(!["GET","POST"].includes(req.method))return send(res,405,{ok:false,error:"method_not_allowed"});
 const input=req.method==="POST"?(req.body||{}):(req.query||{}),token=text(input.token),mode=text(input.mode)||"preview";
 if(!token)return send(res,400,{ok:false,error:"token_required"});
 const db=getFirestore(),snap=await db.collection("recruitPages").doc(token).get();
 if(!snap.exists)return send(res,404,{ok:false,error:"share_token_not_found"});
 const share=snap.data()||{},carIds=[...new Set((Array.isArray(share.carIds)?share.carIds:[]).map(text).filter(Boolean))];
 if(text(share.scope)!=="selected"||share.temporary!==true||!carIds.length||carIds.length>50)return send(res,400,{ok:false,error:"selected_temporary_share_required"});
 const before=[];for(const carId of carIds)before.push({carId,...await state(db,carId)});
 if(mode==="preview")return send(res,200,{ok:true,mode,showPlayers:share.showPlayers===true,carIds,results:before});
 if(mode!=="repair"||text(input.confirm)!==CONFIRM)return send(res,400,{ok:false,error:"repair_confirmation_required"});
 const repaired=[];for(const item of before){if(item.core&&item.comparison.stale){await writeView(db,item.core);repaired.push(item.carId);}}
 const after=[];for(const carId of carIds)after.push({carId,...await state(db,carId)});
 return send(res,200,{ok:true,mode,showPlayers:share.showPlayers===true,carIds,repaired,before,after});
};