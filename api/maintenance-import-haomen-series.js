"use strict";
const {getFirestore}=require("../services/firebase/admin");

const TOKEN="haomen-import-20260924-v1";
const SOURCE_SCRIPT="向生而死";
const IMPORT_ID="haomen-series-20260924";

const ITEMS=[
 {key:"2027-01-04-0930-danshui",scriptName:"丹水山莊",gameDate:"2027-01-04",gameTime:"09:30",endTime:"12:30",durationText:"3小時",durationMinutes:180,peopleText:"7人",totalPeople:7,price:400},
 {key:"2027-01-04-1300-kuilei",scriptName:"魁儡的記憶",gameDate:"2027-01-04",gameTime:"13:00",endTime:"16:30",durationText:"3小時",durationMinutes:180,peopleText:"6人",totalPeople:6,price:400},
 {key:"2027-01-06-1300-youling",scriptName:"幽靈復仇",gameDate:"2027-01-06",gameTime:"13:00",endTime:"17:00",durationText:"4小時",durationMinutes:240,peopleText:"7人",totalPeople:7,price:400},
 {key:"2027-01-12-0900-zuiyanglou",scriptName:"驚魂醉陽樓",gameDate:"2027-01-12",gameTime:"09:00",endTime:"13:00",durationText:"4.5小時",durationMinutes:270,peopleText:"8人",totalPeople:8,price:400},
 {key:"2027-01-12-1330-xiaoyi",scriptName:"孝衣新娘",gameDate:"2027-01-12",gameTime:"13:30",endTime:"17:30",durationText:"4小時",durationMinutes:240,peopleText:"10人",totalPeople:10,price:400},
 {key:"2027-01-25-1300-meigui",scriptName:"跌落的玫瑰",gameDate:"2027-01-25",gameTime:"13:00",endTime:"18:00",durationText:"5小時",durationMinutes:300,peopleText:"7人",totalPeople:7,price:400},
 {key:"2027-02-03-1400-zhulian",scriptName:"珠簾異夢",gameDate:"2027-02-03",gameTime:"14:00",endTime:"18:00",durationText:"4小時",durationMinutes:240,peopleText:"6人-5",totalPeople:6,price:400},
 {key:"2027-02-22-1900-niedao",scriptName:"孽島疑雲",gameDate:"2027-02-22",gameTime:"19:00",endTime:"00:00",durationText:"5小時",durationMinutes:300,peopleText:"5人-4",totalPeople:5,price:450},
 {key:"2027-03-09-0900-jinyuan",scriptName:"槿園孤花",gameDate:"2027-03-09",gameTime:"09:00",endTime:"12:30",durationText:"3.5小時",durationMinutes:210,peopleText:"6人-5",totalPeople:6,price:400},
 {key:"2027-03-15-1000-ziteng",scriptName:"紫藤夫人",gameDate:"2027-03-15",gameTime:"10:00",endTime:"17:00",durationText:"7小時",durationMinutes:420,peopleText:"6人-5",totalPeople:6,price:500},
 {key:"2027-03-23-2000-shuixiu",scriptName:"水袖情",gameDate:"2027-03-23",gameTime:"20:00",endTime:"00:30",durationText:"4.5小時",durationMinutes:270,peopleText:"6人-5",totalPeople:6,price:400},
 {key:"2027-03-24-2000-shuiqiangwei",scriptName:"嗜睡薔薇",gameDate:"2027-03-24",gameTime:"20:00",endTime:"00:30",durationText:"4.5小時",durationMinutes:270,peopleText:"6人-5",totalPeople:6,price:400}
];

function text(v){return String(v==null?"":v).trim()}
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data))}
function makeSlots(total){return Array.from({length:total},(_,i)=>({id:"slot-"+(i+1),slotId:"slot-"+(i+1),slotType:"flexible",type:"flexible",originalType:"flexible",position:i+1,playerId:""}))}
function compactCar(car,viewerId){
 return {
  id:car.id,scriptName:car.scriptName,gameDate:car.gameDate,gameTime:car.gameTime,status:car.status,planningStatus:car.planningStatus,
  visibility:car.visibility,studioName:"",organizerName:"",locationName:"",location:"",dmName:"",coverImageUrl:"",scriptCoverUrl:"",scriptImageUrl:"",
  price:Number(car.price||0),totalPeople:Number(car.totalPeople||0),maleSlots:0,femaleSlots:0,flexibleSlots:Number(car.flexibleSlots||0),
  seatSummary:{totalSeatCount:Number(car.totalPeople||0),occupiedSeatCount:0,maleTotal:0,maleOccupied:0,femaleTotal:0,femaleOccupied:0,flexibleTotal:Number(car.totalPeople||0),flexibleOccupied:0,waitingCount:0},
  players:[],tags:["豪門系列"],scriptTags:[],ownerId:viewerId,myRole:"player",isHost:false,isPlayer:true,role:"player",ownerType:"",
  updatedAt:car.updatedAt,createdAt:car.createdAt
 }
}
function sortCars(cars){return [...cars].sort((a,b)=>String(a.gameDate||"9999-12-31").localeCompare(String(b.gameDate||"9999-12-31"))||String(a.gameTime||"23:59").localeCompare(String(b.gameTime||"23:59")))}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 const mode=String(req.query&&req.query.mode||"dry-run");
 try{
  const db=getFirestore();
  const anchors=await db.collection("cars").where("scriptName","==",SOURCE_SCRIPT).limit(10).get();
  if(anchors.empty)return send(res,409,{success:false,error:"anchor_car_not_found"});
  const ownerIds=[...new Set(anchors.docs.map(d=>text((d.data()||{}).ownerId)).filter(Boolean))];
  if(ownerIds.length!==1)return send(res,409,{success:false,error:"anchor_owner_ambiguous",ownerCount:ownerIds.length});
  const ownerId=ownerIds[0];

  let viewerId=ownerId;
  const alias=await db.collection("myCarViewAliases").doc(ownerId).get();
  if(alias.exists&&text((alias.data()||{}).viewerId))viewerId=text(alias.data().viewerId);

  const viewRef=db.collection("myCarViews").doc(viewerId),viewSnap=await viewRef.get();
  if(!viewSnap.exists)return send(res,409,{success:false,error:"mycar_view_missing"});

  const existing=[];
  for(const item of ITEMS){
    const id="haomen-"+item.key;
    const snap=await db.collection("cars").doc(id).get();
    if(snap.exists)existing.push(id);
  }

  if(mode!=="commit")return send(res,200,{success:true,mode:"dry-run",anchorCount:anchors.size,ownerResolved:true,viewerResolved:true,requested:ITEMS.length,existing:existing.length,wouldCreate:ITEMS.length-existing.length});

  const now=new Date().toISOString();
  const batch=db.batch(),createdCars=[];
  for(const item of ITEMS){
    const id="haomen-"+item.key,ref=db.collection("cars").doc(id),snap=await ref.get();
    if(snap.exists)continue;
    const car={
      id,ownerId,activityType:"劇本",activityName:item.scriptName,scriptName:item.scriptName,
      gameDate:item.gameDate,gameTime:item.gameTime,location:"",locationName:"",organizer:"",organizerName:"",studioName:"",dmName:"",
      price:item.price,note:"豪門系列｜是否成團｜時長："+item.durationText+"｜人數："+item.peopleText,
      seriesName:"豪門系列",formationStatus:"pending",durationText:item.durationText,peopleText:item.peopleText,endTime:item.endTime,
      peopleMode:"total",maleSlots:0,femaleSlots:0,flexibleSlots:item.totalPeople,totalPeople:item.totalPeople,slots:makeSlots(item.totalPeople),
      showFlexibleSlotSource:false,dataVersion:1,seatSystemVersion:1,myRole:"player",isHost:false,isPlayer:true,isFavoriteCar:false,
      visibility:"private",guestListVisibility:"approved_only",players:[],applications:[],staffSlots:[],
      history:[{type:"建立車團",text:"豪門系列批次建立｜我是玩家｜是否成團待確認",time:now}],
      conflictStatus:"none",conflictWithCarIds:[],conflictNote:"",
      calendar:{provider:"google",syncEnabled:false,calendarId:"primary",eventId:"",eventUrl:"",eventDurationMinutes:item.durationMinutes,syncStatus:"not_synced",lastSyncAt:"",lastError:""},
      calendarStatus:"not_added",calendarEventId:null,status:"招募中",planningStatus:"scheduled",
      importId:IMPORT_ID,importKey:item.key,createdAt:now,updatedAt:now
    };
    batch.set(ref,car,{merge:false});
    createdCars.push(car);
  }

  const current=viewSnap.data()||{},cars=Array.isArray(current.cars)?current.cars.slice():[];
  const byId=new Map(cars.map(c=>[text(c&&c.id),c]));
  createdCars.forEach(car=>byId.set(car.id,compactCar(car,viewerId)));
  const nextCars=sortCars([...byId.values()]);
  batch.set(viewRef,{...current,schemaVersion:Number(current.schemaVersion||6),viewType:"mycar_index",viewerId,identityIds:Array.isArray(current.identityIds)?current.identityIds:[viewerId],cars:nextCars,counts:{all:nextCars.length,host:nextCars.filter(c=>c&&c.isHost===true).length,player:nextCars.filter(c=>c&&c.isPlayer===true).length},builtAt:now},{merge:false});
  await batch.commit();

  const verify=[];
  for(const item of ITEMS){const id="haomen-"+item.key,s=await db.collection("cars").doc(id).get();if(s.exists)verify.push(id)}
  return send(res,200,{success:true,mode:"commit",requested:ITEMS.length,created:createdCars.length,verified:verify.length,myCarViewUpdated:true});
 }catch(e){console.error(e);return send(res,500,{success:false,error:String(e&&e.message||e)})}
};