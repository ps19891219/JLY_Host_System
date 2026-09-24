"use strict";
const {getFirestore}=require("../services/firebase/admin");

const TOKEN="player-collab-import-20260925-v1";
const SOURCE_SCRIPT="向生而死";
const IMPORT_ID="player-collab-apr-sep-20260925";

const ITEMS=[
 {key:"2027-04-16-1000-liejing",scriptName:"裂鏡重圓",gameDate:"2027-04-16",gameTime:"10:00",endTime:"14:00",durationText:"4小時",durationMinutes:240,totalPeople:6,price:400},
 {key:"2027-04-16-1430-yuelu",scriptName:"岳麓山下",gameDate:"2027-04-16",gameTime:"14:30",endTime:"19:00",durationText:"4.5小時",durationMinutes:270,totalPeople:6,price:450},
 {key:"2027-04-16-1930-zhangdong",scriptName:"章東鎮謎案",gameDate:"2027-04-16",gameTime:"19:30",endTime:"23:30",durationText:"4小時",durationMinutes:240,totalPeople:6,price:400},
 {key:"2027-05-07-1000-exi",scriptName:"鄂西山靈",gameDate:"2027-05-07",gameTime:"10:00",endTime:"17:00",durationText:"7小時",durationMinutes:420,totalPeople:6,price:500},
 {key:"2027-05-07-1800-yueluowa",scriptName:"月落窪",gameDate:"2027-05-07",gameTime:"18:00",endTime:"23:00",durationText:"5小時",durationMinutes:300,totalPeople:5,price:450},
 {key:"2027-05-14-1000-daiyue",scriptName:"待月弒殺",gameDate:"2027-05-14",gameTime:"10:00",endTime:"15:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-05-14-1530-jueyadiao",scriptName:"絕崖雕",gameDate:"2027-05-14",gameTime:"15:30",endTime:"20:30",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-05-17-1000-shizhen",scriptName:"失真的旋律",gameDate:"2027-05-17",gameTime:"10:00",endTime:"14:00",durationText:"4小時",durationMinutes:240,totalPeople:6,price:400},
 {key:"2027-05-17-1500-yehu",scriptName:"野狐悠談",gameDate:"2027-05-17",gameTime:"15:00",endTime:"22:00",durationText:"7小時",durationMinutes:420,totalPeople:6,price:500}
 ,
 {key:"2027-06-04-1300-wuqifuyun",scriptName:"霧起浮雲",gameDate:"2027-06-04",gameTime:"13:00",endTime:"18:00",durationText:"5小時",durationMinutes:300,totalPeople:5,price:450},
 {key:"2027-06-18-0900-qixunaizhi",scriptName:"期須乃至",gameDate:"2027-06-18",gameTime:"09:00",endTime:"14:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-06-18-1430-quanzhiguan",scriptName:"泉之館",gameDate:"2027-06-18",gameTime:"14:30",endTime:"19:00",durationText:"4.5小時",durationMinutes:270,totalPeople:6,price:450},
 {key:"2027-06-18-1930-fuquanlou",scriptName:"復泉樓",gameDate:"2027-06-18",gameTime:"19:30",endTime:"00:00",durationText:"4.5小時",durationMinutes:270,totalPeople:6,price:450},
 {key:"2027-06-25-1000-wanghaici",scriptName:"望海祠",gameDate:"2027-06-25",gameTime:"10:00",endTime:"17:00",durationText:"7小時",durationMinutes:420,totalPeople:6,price:500},
 {key:"2027-06-25-1730-yishizhimen",scriptName:"儀式之門",gameDate:"2027-06-25",gameTime:"17:30",endTime:"22:00",durationText:"4.5小時",durationMinutes:270,totalPeople:5,price:400},
 {key:"2027-07-20-1000-wangchixin",scriptName:"枉癡心",gameDate:"2027-07-20",gameTime:"10:00",endTime:"17:00",durationText:"7小時",durationMinutes:420,totalPeople:6,price:500},
 {key:"2027-07-20-1730-guzhouying",scriptName:"孤舟螢",gameDate:"2027-07-20",gameTime:"17:30",endTime:"22:00",durationText:"4.5小時",durationMinutes:270,totalPeople:5,price:450},
 {key:"2027-07-22-1000-manna",scriptName:"曼娜",gameDate:"2027-07-22",gameTime:"10:00",endTime:"15:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-07-22-1530-minghaizhuiyou",scriptName:"冥海縋幽",gameDate:"2027-07-22",gameTime:"15:30",endTime:"20:00",durationText:"4.5小時",durationMinutes:270,totalPeople:5,price:400},
 {key:"2027-07-27-1300-zuijiazhuang",scriptName:"詛家莊",gameDate:"2027-07-27",gameTime:"13:00",endTime:"18:30",durationText:"5.5小時",durationMinutes:330,totalPeople:6,price:450},
 {key:"2027-07-27-1900-chunweishe",scriptName:"春味社",gameDate:"2027-07-27",gameTime:"19:00",endTime:"00:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-07-28-1000-wangliangta",scriptName:"魍魎塔",gameDate:"2027-07-28",gameTime:"10:00",endTime:"15:30",durationText:"5.5小時",durationMinutes:330,totalPeople:6,price:450},
 {key:"2027-07-28-1600-yuyiyan",scriptName:"雨異妍",gameDate:"2027-07-28",gameTime:"16:00",endTime:"21:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-08-20-1000-xianlingji",scriptName:"先靈祭",gameDate:"2027-08-20",gameTime:"10:00",endTime:"15:00",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-08-20-1530-duchong",scriptName:"蠹蟲",gameDate:"2027-08-20",gameTime:"15:30",endTime:"20:30",durationText:"5小時",durationMinutes:300,totalPeople:6,price:450},
 {key:"2027-08-25-1000-zhuyingehuang",scriptName:"燭影額妝",gameDate:"2027-08-25",gameTime:"10:00",endTime:"17:30",durationText:"7.5小時",durationMinutes:450,totalPeople:6,price:500},
 {key:"2027-08-25-1730-maodaxia",scriptName:"貓大俠",gameDate:"2027-08-25",gameTime:"17:30",endTime:"23:30",durationText:"5小時",durationMinutes:300,totalPeople:5,price:500},
 {key:"2027-09-10-1000-shanguimu",scriptName:"山鬼母",gameDate:"2027-09-10",gameTime:"10:00",endTime:"17:00",durationText:"7小時",durationMinutes:420,totalPeople:5,price:600},
 {key:"2027-09-10-1730-yingxiehuapu",scriptName:"應邪化僕",gameDate:"2027-09-10",gameTime:"17:30",endTime:"23:30",durationText:"6小時",durationMinutes:360,totalPeople:5,price:500},
 {key:"2027-09-17-1000-anboya",scriptName:"暗波崖",gameDate:"2027-09-17",gameTime:"10:00",endTime:"17:30",durationText:"7.5小時",durationMinutes:450,totalPeople:6,price:500},
 {key:"2027-09-17-1800-shepin",scriptName:"蛇聘",gameDate:"2027-09-17",gameTime:"18:00",endTime:"00:00",durationText:"6小時",durationMinutes:360,totalPeople:5,price:500}
];

function t(v){return String(v==null?"":v).trim()}
function send(res,s,d){res.statusCode=s;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))}
function makeSlots(total){return Array.from({length:total},(_,i)=>({id:"slot-"+(i+1),slotId:"slot-"+(i+1),slotType:"flexible",type:"flexible",originalType:"flexible",position:i+1,playerId:""}))}
function compactCar(car,viewerId){
 return {
  id:car.id,scriptName:car.scriptName,gameDate:car.gameDate,gameTime:car.gameTime,status:car.status,planningStatus:car.planningStatus,
  visibility:car.visibility,studioName:"",organizerName:"",locationName:"",location:"",dmName:"",coverImageUrl:"",scriptCoverUrl:"",scriptImageUrl:"",
  price:Number(car.price||0),totalPeople:Number(car.totalPeople||0),maleSlots:0,femaleSlots:0,flexibleSlots:Number(car.flexibleSlots||0),
  seatSummary:{totalSeatCount:Number(car.totalPeople||0),occupiedSeatCount:0,maleTotal:0,maleOccupied:0,femaleTotal:0,femaleOccupied:0,flexibleTotal:Number(car.totalPeople||0),flexibleOccupied:0,waitingCount:0},
  players:[],tags:["待確認成團"],scriptTags:[],ownerId:viewerId,myRole:"player",isHost:false,isPlayer:true,role:"player",ownerType:"",
  updatedAt:car.updatedAt,createdAt:car.createdAt
 }
}
function sortCars(cars){return [...cars].sort((a,b)=>String(a.gameDate||"9999-12-31").localeCompare(String(b.gameDate||"9999-12-31"))||String(a.gameTime||"23:59").localeCompare(String(b.gameTime||"23:59")))}

module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(t(req.query&&req.query.token)!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 const mode=t(req.query&&req.query.mode)||"dry-run";
 try{
  const db=getFirestore();
  const anchors=await db.collection("cars").where("scriptName","==",SOURCE_SCRIPT).limit(10).get();
  if(anchors.empty)return send(res,409,{success:false,error:"anchor_car_not_found"});
  const ownerIds=[...new Set(anchors.docs.map(d=>t((d.data()||{}).ownerId)).filter(Boolean))];
  if(ownerIds.length!==1)return send(res,409,{success:false,error:"anchor_owner_ambiguous",ownerCount:ownerIds.length});
  const ownerId=ownerIds[0];

  let viewerId=ownerId;
  const alias=await db.collection("myCarViewAliases").doc(ownerId).get();
  if(alias.exists&&t((alias.data()||{}).viewerId))viewerId=t((alias.data()||{}).viewerId);
  const viewRef=db.collection("myCarViews").doc(viewerId),viewSnap=await viewRef.get();
  if(!viewSnap.exists)return send(res,409,{success:false,error:"mycar_view_missing"});
  const view=viewSnap.data()||{};
  const identityIds=[...new Set([ownerId,viewerId,...(Array.isArray(view.identityIds)?view.identityIds:[])].map(t).filter(Boolean))];

  const activeProfileIds=[];
  for(const id of identityIds){
   const p=await db.collection("recruitProfiles").doc(id).get();
   if(p.exists&&t((p.data()||{}).activeToken))activeProfileIds.push(id);
  }
  const relationTargets=[...new Set([ownerId,...activeProfileIds])];

  const existing=[];
  for(const item of ITEMS){
   const id="playercollab-"+item.key;
   const snap=await db.collection("cars").doc(id).get();
   if(snap.exists)existing.push(id);
  }

  if(mode!=="commit")return send(res,200,{success:true,mode:"dry-run",requested:ITEMS.length,existing:existing.length,wouldCreate:ITEMS.length-existing.length,ownerId,viewerId,identityIds,activeProfileIds,relationTargets,willWriteRelations:(ITEMS.length-existing.length)*relationTargets.length});

  const now=new Date().toISOString(),batch=db.batch(),createdCars=[];
  for(const item of ITEMS){
   const id="playercollab-"+item.key,ref=db.collection("cars").doc(id),snap=await ref.get();
   if(snap.exists)continue;
   const car={
    id,ownerId,activityType:"劇本",activityName:item.scriptName,scriptName:item.scriptName,
    gameDate:item.gameDate,gameTime:item.gameTime,endTime:item.endTime,durationText:item.durationText,
    location:"",locationName:"",organizer:"",organizerName:"",studioName:"",dmName:"",
    price:item.price,note:"是否成團｜時長："+item.durationText+"｜人數："+item.totalPeople+"人",
    formationStatus:"pending",durationMinutes:item.durationMinutes,peopleText:item.totalPeople+"人",
    peopleMode:"total",maleSlots:0,femaleSlots:0,flexibleSlots:item.totalPeople,totalPeople:item.totalPeople,slots:makeSlots(item.totalPeople),
    showFlexibleSlotSource:false,dataVersion:1,seatSystemVersion:1,myRole:"player",isHost:false,isPlayer:true,isFavoriteCar:false,
    visibility:"public",guestListVisibility:"approved_only",players:[],applications:[],staffSlots:[],
    history:[{type:"建立車團",text:"批次建立｜我是玩家｜協作｜是否成團待確認",time:now}],
    conflictStatus:"none",conflictWithCarIds:[],conflictNote:"",
    calendar:{provider:"google",syncEnabled:false,calendarId:"primary",eventId:"",eventUrl:"",eventDurationMinutes:item.durationMinutes,syncStatus:"not_synced",lastSyncAt:"",lastError:""},
    calendarStatus:"not_added",calendarEventId:null,status:"招募中",planningStatus:"scheduled",
    importId:IMPORT_ID,importKey:item.key,createdAt:now,updatedAt:now
   };
   batch.set(ref,car,{merge:false});
   batch.set(db.collection("carDetailViews").doc(id),{schemaVersion:1,viewType:"car_detail",carId:id,ownerId,sourceUpdatedAt:now,builtAt:now,car:{...car,id}},{merge:false});
   for(const playerId of relationTargets){
    batch.set(db.collection("players").doc(playerId).collection("carRelations").doc(id),{playerId,carId:id,assistRecruiting:true,collaborationSource:IMPORT_ID,updatedAt:now},{merge:true});
   }
   createdCars.push(car);
  }

  const currentCars=Array.isArray(view.cars)?view.cars.slice():[],byId=new Map(currentCars.map(c=>[t(c&&c.id),c]));
  createdCars.forEach(car=>byId.set(car.id,compactCar(car,viewerId)));
  const nextCars=sortCars([...byId.values()]);
  batch.set(viewRef,{...view,schemaVersion:Number(view.schemaVersion||6),viewType:"mycar_index",viewerId,identityIds:Array.isArray(view.identityIds)?view.identityIds:[viewerId],cars:nextCars,counts:{all:nextCars.length,host:nextCars.filter(c=>c&&c.isHost===true).length,player:nextCars.filter(c=>c&&c.isPlayer===true).length},builtAt:now},{merge:false});
  await batch.commit();

  let verified=0,detailCount=0,relationCount=0;
  for(const item of ITEMS){
   const id="playercollab-"+item.key;
   const cs=await db.collection("cars").doc(id).get(); if(cs.exists)verified++;
   const ds=await db.collection("carDetailViews").doc(id).get(); if(ds.exists)detailCount++;
   for(const playerId of relationTargets){
    const rs=await db.collection("players").doc(playerId).collection("carRelations").doc(id).get();
    if(rs.exists&&(rs.data()||{}).assistRecruiting===true)relationCount++;
   }
  }
  return send(res,200,{success:true,mode:"commit",requested:ITEMS.length,created:createdCars.length,verified,detailCount,relationCount,expectedRelations:createdCars.length*relationTargets.length,myCarViewUpdated:true,viewerId,relationTargets});
 }catch(e){console.error(e);return send(res,500,{success:false,error:String(e&&e.message||e)})}
};
