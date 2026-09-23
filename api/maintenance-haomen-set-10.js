"use strict";
const {getFirestore}=require("../services/firebase/admin");
const TOKEN="haomen-set-10-20260924-v1";
const IDS=["haomen-2027-01-04-0930-danshui","haomen-2027-01-04-1300-kuilei","haomen-2027-01-06-1300-youling","haomen-2027-01-12-0900-zuiyanglou","haomen-2027-01-12-1330-xiaoyi","haomen-2027-01-25-1300-meigui","haomen-2027-02-03-1400-zhulian","haomen-2027-02-22-1900-niedao","haomen-2027-03-09-0900-jinyuan","haomen-2027-03-15-1000-ziteng","haomen-2027-03-23-2000-shuixiu","haomen-2027-03-24-2000-shuiqiangwei"];
function text(v){return String(v==null?"":v).trim()}
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data))}
function makeSlots(){return Array.from({length:10},(_,i)=>({id:"slot-"+(i+1),slotId:"slot-"+(i+1),slotType:"flexible",type:"flexible",originalType:"flexible",position:i+1,playerId:""}))}
function updateNote(note){
  const parts=String(note||"").split("｜").filter(Boolean).map(x=>x.trim());
  const filtered=parts.filter(x=>!/^人數：/.test(x));
  filtered.push("人數：10人");
  return filtered.join("｜");
}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 const mode=String(req.query&&req.query.mode||"dry-run");
 try{
  const db=getFirestore(),docs=[];
  for(const id of IDS){
   const s=await db.collection("cars").doc(id).get();
   if(!s.exists)return send(res,409,{success:false,error:"car_missing",carId:id});
   const d=s.data()||{};
   if(d.importId!=="haomen-series-20260924")return send(res,409,{success:false,error:"unexpected_import_source",carId:id});
   docs.push({id,...d});
  }
  const ownerIds=[...new Set(docs.map(d=>text(d.ownerId)).filter(Boolean))];
  if(ownerIds.length!==1)return send(res,409,{success:false,error:"owner_ambiguous",ownerCount:ownerIds.length});
  const ownerId=ownerIds[0];
  let viewerId=ownerId;
  const alias=await db.collection("myCarViewAliases").doc(ownerId).get();
  if(alias.exists&&text((alias.data()||{}).viewerId))viewerId=text(alias.data().viewerId);
  const viewRef=db.collection("myCarViews").doc(viewerId),viewSnap=await viewRef.get();
  if(!viewSnap.exists)return send(res,409,{success:false,error:"mycar_view_missing"});
  const wouldChange=docs.filter(d=>Number(d.totalPeople)!==10||Number(d.flexibleSlots)!==10||String(d.peopleText||"")!=="10人").length;
  if(mode!=="commit")return send(res,200,{success:true,mode:"dry-run",found:docs.length,wouldChange,viewerResolved:true});
  const now=new Date().toISOString(),batch=db.batch();
  for(const car of docs){
    batch.update(db.collection("cars").doc(car.id),{
      totalPeople:10,flexibleSlots:10,maleSlots:0,femaleSlots:0,peopleMode:"total",peopleText:"10人",slots:makeSlots(),note:updateNote(car.note),updatedAt:now
    });
  }
  const current=viewSnap.data()||{},cars=Array.isArray(current.cars)?current.cars.map(c=>({...c})):[];
  const idSet=new Set(IDS);
  for(const c of cars){
    if(!idSet.has(text(c&&c.id)))continue;
    c.totalPeople=10;c.flexibleSlots=10;c.maleSlots=0;c.femaleSlots=0;
    c.seatSummary={totalSeatCount:10,occupiedSeatCount:0,maleTotal:0,maleOccupied:0,femaleTotal:0,femaleOccupied:0,flexibleTotal:10,flexibleOccupied:0,waitingCount:0};
    c.updatedAt=now;
  }
  batch.set(viewRef,{...current,cars,counts:{all:cars.length,host:cars.filter(c=>c&&c.isHost===true).length,player:cars.filter(c=>c&&c.isPlayer===true).length},builtAt:now},{merge:false});
  await batch.commit();
  let verified=0;
  for(const id of IDS){
    const s=await db.collection("cars").doc(id).get(),d=s.data()||{};
    if(s.exists&&Number(d.totalPeople)===10&&Number(d.flexibleSlots)===10&&String(d.peopleText||"")==="10人"&&Array.isArray(d.slots)&&d.slots.length===10)verified++;
  }
  return send(res,200,{success:true,mode:"commit",updated:IDS.length,verified,myCarViewUpdated:true});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};