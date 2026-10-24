"use strict";
function normalizeText(value){return String(value||"").trim();}
function cleanBaseUrl(value){return normalizeText(value).replace(/\/$/,"");}
function getCarTitle(car){return normalizeText(car&&(car.scriptName||car.activityName||car.name||car.label))||"這場活動";}
function uriButton(label,uri,color){return {type:"button",style:"primary",color,margin:"md",action:{type:"uri",label,uri}};}
function buildMemberWelcomeCard(car,options={}){
 const baseUrl=cleanBaseUrl(options.baseUrl);
 const carId=encodeURIComponent(normalizeText(options.carId||(car&&(car.id||car.carId))));
 const title=getCarTitle(car);
 const customWelcome=normalizeText(options.welcomeText);
 // source=line_group is presentation context only; LINE Identity and approval remain unchanged.
 const dmUrl=baseUrl+"/pages/car-view.html?id="+carId+"&entry=dm&source=line_group";
 const playerUrl=baseUrl+"/pages/car-view.html?id="+carId+"&entry=player&source=line_group";
 const mobileCalendarUrl=baseUrl+"/pages/car-calendar-add.html?id="+carId;
 const buttons=[
   uriButton("🎭 我是本場 DM",dmUrl,"#806A9B"),
   uriButton("🎮 我要報名玩家",playerUrl,"#487A91")
 ];
 if(carId){
   buttons.push(uriButton("📅 加入我的行事曆",mobileCalendarUrl,"#6969B7"));
 }else{
   // If car metadata is late, let the user verify the latest Prepared View on the mobile page.
   buttons.push({type:"text",text:"📅 尚未連結車團，暫時無法開啟行事曆",size:"sm",color:"#777777",wrap:true,margin:"md"});
 }
 return {type:"flex",altText:"歡迎加入《"+title+"》｜本場活動資訊與個人行事曆",contents:{
   type:"bubble",size:"mega",header:{type:"box",layout:"vertical",contents:[
     {type:"text",text:customWelcome||("🎭 歡迎加入《"+title+"》"),weight:"bold",size:"lg",wrap:true},
     {type:"text",text:"本場活動資訊與個人行事曆",size:"sm",color:"#777777",margin:"sm",wrap:true}
   ]},body:{type:"box",layout:"vertical",contents:buttons}
 }};
}
module.exports={buildMemberWelcomeCard};
