"use strict";
const {getFirestore}=require("../services/firebase/admin");
const TOKEN="haomen-collab-20260924-v1",IDS=["haomen-2027-01-04-0930-danshui","haomen-2027-01-04-1300-kuilei","haomen-2027-01-06-1300-youling","haomen-2027-01-12-0900-zuiyanglou","haomen-2027-01-12-1330-xiaoyi","haomen-2027-01-25-1300-meigui","haomen-2027-02-03-1400-zhulian","haomen-2027-02-22-1900-niedao","haomen-2027-03-09-0900-jinyuan","haomen-2027-03-15-1000-ziteng","haomen-2027-03-23-2000-shuixiu","haomen-2027-03-24-2000-shuiqiangwei"];
function t(v){return String(v==null?"":v).trim()}
function send(res,s,d){res.statusCode=s;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))}
module.exports=async function(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(t(req.query&&req.query.token)!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 const mode=t(req.query&&req.query.mode)||"dry-run";
 try{
  const db=getFirestore(),cars=[];
  for(const id of IDS){
   const s=await db.collection("cars").doc(id).get();
   if(!s.exists)return send(res,409,{success:false,error:"car_missing",carId:id});
   const d=s.data()||{};
   if(d.importId!=="haomen-series-20260924")return send(res,409,{success:false,error:"unexpected_import_source",carId:id});
   cars.push({id,...d});
  }
  const ownerIds=[...new Set(cars.map(c=>t(c.ownerId)).filter(Boolean))];
  if(ownerIds.length!==1)return send(res,409,{success:false,error:"owner_ambiguous",ownerCount:ownerIds.length});
  const ownerId=ownerIds[0];
  let viewerId=ownerId;
  const alias=await db.collection("myCarViewAliases").doc(ownerId).get();
  if(alias.exists&&t((alias.data()||{}).viewerId))viewerId=t((alias.data()||{}).viewerId);
  const viewRef=db.collection("myCarViews").doc(viewerId),viewSnap=await viewRef.get();
  if(!viewSnap.exists)return send(res,409,{success:false,error:"mycar_view_missing"});
  const view=viewSnap.data()||{},identityIds=[...new Set([ownerId,viewerId,...(Array.isArray(view.identityIds)?view.identityIds:[])].map(t).filter(Boolean))];
  const activeProfileIds=[];
  for(const id of identityIds){
   const p=await db.collection("recruitProfiles").doc(id).get();
   if(p.exists&&t((p.data()||{}).activeToken))activeProfileIds.push(id);
  }
  const relationTargets=[...new Set([ownerId,...activeProfileIds])];
  if(mode!=="commit"){
   return send(res,200,{success:true,mode:"dry-run",cars:cars.length,ownerId,viewerId,identityIds,activeProfileIds,relationTargets,willWriteCars:IDS.length,willWriteDetailViews:IDS.length,willWriteRelations:IDS.length*relationTargets.length,willWriteMyCarView:1});
  }
  const batch=db.batch(),now=new Date().toISOString();
  const patchedCars=[];
  for(const car of cars){
   const next={...car,visibility:"public",updatedAt:now};
   patchedCars.push(next);
   batch.update(db.collection("cars").doc(car.id),{visibility:"public",updatedAt:now});
   batch.set(db.collection("carDetailViews").doc(car.id),{
    schemaVersion:1,viewType:"car_detail",carId:car.id,ownerId:t(next.ownerId),sourceUpdatedAt:now,builtAt:now,car:{...next,id:car.id}
   },{merge:false});
   for(const playerId of relationTargets){
    batch.set(db.collection("players").doc(playerId).collection("carRelations").doc(car.id),{
      playerId,carId:car.id,assistRecruiting:true,collaborationSource:"haomen-series",updatedAt:now
    },{merge:true});
   }
  }
  const currentCars=Array.isArray(view.cars)?view.cars.map(c=>({...c})):[];
  const idSet=new Set(IDS);
  for(const card of currentCars){
   if(idSet.has(t(card&&card.id))){card.visibility="public";card.updatedAt=now;}
  }
  batch.set(viewRef,{...view,cars:currentCars,builtAt:now},{merge:false});
  await batch.commit();

  let publicCount=0,detailCount=0,relationCount=0;
  for(const id of IDS){
   const cs=await db.collection("cars").doc(id).get();
   if(cs.exists&&t((cs.data()||{}).visibility)==="public")publicCount++;
   const vs=await db.collection("carDetailViews").doc(id).get();
   if(vs.exists)detailCount++;
   for(const playerId of relationTargets){
    const rs=await db.collection("players").doc(playerId).collection("carRelations").doc(id).get();
    if(rs.exists&&(rs.data()||{}).assistRecruiting===true)relationCount++;
   }
  }
  return send(res,200,{success:true,mode:"commit",publicCount,detailCount,relationCount,expectedRelations:IDS.length*relationTargets.length,viewerId,relationTargets});
 }catch(e){console.error(e);return send(res,500,{success:false,error:String(e&&e.message||e)})}
};