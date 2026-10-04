"use strict";
const { getFirestore } = require("../services/firebase/admin");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");
const text=v=>String(v==null?"":v).trim();
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
function idsOf(s){return [...new Set([text(s&&s.profileId),text(s&&s.identityId)].filter(Boolean))];}
function bodyOf(req){if(typeof req.body==="string"){try{return JSON.parse(req.body||"{}")}catch(_){return {}}}return req.body||{}}
module.exports=async function(req,res){
 if(req.method!=="POST")return send(res,405,{ok:false,error:"method_not_allowed"});
 try{
  const verified=verifyMemberSession(readCookie(req)); if(!verified.valid)return send(res,401,{ok:false,error:"member_session_required"});
  const ids=idsOf(verified.data); if(!ids.length)return send(res,403,{ok:false,error:"member_identity_required"});
  const body=bodyOf(req); if(body.confirm!=="REPAIR_XINYUE_MY_CAR")return send(res,400,{ok:false,error:"confirmation_required"});
  const db=getFirestore(),matches=new Map();
  for(const ownerId of ids){const snap=await db.collection("cars").where("ownerId","==",ownerId).where("scriptName","==","新月舊事").limit(2).get();snap.docs.forEach(d=>matches.set(d.id,{id:d.id,data:d.data()||{}}));}
  if(matches.size===0)return send(res,404,{ok:false,error:"xinyue_not_found"});
  if(matches.size!==1)return send(res,409,{ok:false,error:"xinyue_not_unique",matches:matches.size});
  const car=[...matches.values()][0],ownerId=text(car.data.ownerId);
  let viewerId="",viewSnap=null;
  for(const id of ids){const s=await db.collection("myCarViews").doc(id).get();if(s.exists){viewerId=id;viewSnap=s;break}}
  if(!viewSnap){for(const id of ids){const a=await db.collection("myCarViewAliases").doc(id).get();if(a.exists){const routed=text((a.data()||{}).viewerId);if(routed){const s=await db.collection("myCarViews").doc(routed).get();if(s.exists){viewerId=routed;viewSnap=s;break}}}}}
  if(!viewSnap)return send(res,409,{ok:false,error:"mycar_view_missing"});
  const view=viewSnap.data()||{},identityIds=[...new Set([viewerId,...(Array.isArray(view.identityIds)?view.identityIds:[]),...ids].map(text).filter(Boolean))];
  const mine=identityIds.includes(ownerId); if(!mine)return send(res,403,{ok:false,error:"owner_mismatch"});
  const d=car.data,compact={id:car.id,scriptName:text(d.scriptName||d.title||d.name),gameDate:text(d.gameDate||d.date),gameTime:text(d.gameTime||d.time),status:text(d.status),planningStatus:text(d.planningStatus),visibility:text(d.visibility),studioName:text(d.studioName||d.studio),organizerName:text(d.organizerName||d.groupName),locationName:text(d.locationName),location:text(d.location||d.address||d.placeName),dmName:text(d.dmName),coverImageUrl:text(d.coverImageUrl),scriptCoverUrl:text(d.scriptCoverUrl),scriptImageUrl:text(d.scriptImageUrl),price:Number(d.price||d.amount||0),totalPeople:Number(d.totalPeople||0),maleSlots:Number(d.maleSlots||0),femaleSlots:Number(d.femaleSlots||0),flexibleSlots:Number(d.flexibleSlots||d.flexSlots||0),seatSummary:d.seatSummary||null,players:Array.isArray(d.players)?d.players.map(p=>({playerId:text(p&&(p.playerId||p.id||p.profileId)),position:text(p&&(p.position||p.roleChoice||p.role)),status:text(p&&p.status)})):[],tags:Array.isArray(d.tags)?d.tags:[],scriptTags:Array.isArray(d.scriptTags)?d.scriptTags:[],ownerId,myRole:text(d.myRole).toLowerCase(),isHost:true,isPlayer:false,role:"host",ownerType:"self",updatedAt:d.updatedAt||null,createdAt:d.createdAt||null};
  const cars=(Array.isArray(view.cars)?view.cars:[]).filter(x=>text(x&&x.id)!==car.id);cars.push(compact);
  const next={...view,identityIds,cars,counts:{all:cars.length,host:cars.filter(x=>x&&x.isHost).length,player:cars.filter(x=>x&&x.isPlayer).length},builtAt:new Date().toISOString()};
  await db.collection("myCarViews").doc(viewerId).set(next,{merge:false});
  return send(res,200,{ok:true,scriptName:"新月舊事",carId:car.id,viewUpdated:true});
 }catch(e){console.error("repair xinyue mycar",e);return send(res,500,{ok:false,error:e.message||"repair_failed"});}
};