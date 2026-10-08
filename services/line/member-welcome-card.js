"use strict";
const {buildGoogleCalendarPrefillUrl}=require("./google-calendar-prefill-url");
function normalizeText(value){return String(value||"").trim();}
function cleanBaseUrl(value){return normalizeText(value).replace(/\/$/,"");}
function getCarTitle(car){return normalizeText(car&&(car.scriptName||car.activityName||car.name||car.label))||"這場活動";}
function uriButton(label,uri,color){return {type:"button",style:"primary",color,margin:"md",action:{type:"uri",label,uri}};}
function buildMemberWelcomeCard(car,options={}){
 const baseUrl=cleanBaseUrl(options.baseUrl);
 const carId=encodeURIComponent(normalizeText(options.carId||(car&&(car.id||car.carId))));
 const title=getCarTitle(car);
 // source=line_group is presentation context only; LINE Identity and approval remain unchanged.
 const dmUrl=baseUrl+"/pages/car-view.html?id="+carId+"&entry=dm&source=line_group";
 const playerUrl=baseUrl+"/pages/car-view.html?id="+carId+"&entry=player&source=line_group";
 const calendarUrl=buildGoogleCalendarPrefillUrl(car);
 const buttons=[
   uriButton("🎭 我是本場 DM",dmUrl,"#806A9B"),
   uriButton("🎮 我要報名玩家",playerUrl,"#487A91")
 ];
 if(calendarUrl){
   buttons.push(uriButton("📅 加入我的 Google 行事曆",calendarUrl,"#6969B7"));
 }else{
   // Never guess missing dates, times, durations or an overdue car read.
   buttons.push({type:"text",text:"📅 行事曆資料待補齊，暫時無法新增行程",size:"sm",color:"#777777",wrap:true,margin:"md"});
 }
 return {type:"flex",altText:"歡迎加入《"+title+"》｜本場活動資訊與個人行事曆",contents:{
   type:"bubble",size:"mega",header:{type:"box",layout:"vertical",contents:[
     {type:"text",text:"🎭 歡迎加入《"+title+"》",weight:"bold",size:"lg",wrap:true},
     {type:"text",text:"本場活動資訊與個人行事曆",size:"sm",color:"#777777",margin:"sm",wrap:true}
   ]},body:{type:"box",layout:"vertical",contents:buttons}
 }};
}
module.exports={buildMemberWelcomeCard};
