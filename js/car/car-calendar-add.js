(function(){
"use strict";
const t=x=>String(x==null?"":x).trim(),$=id=>document.getElementById(id);
const carId=t(new URLSearchParams(location.search).get("id"));let event=null,working=false;
function status(v){$("status").textContent=v;}
function time(iso){return new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));}
async function init(){
 if(!carId){$("loading").textContent="車團連結缺少 ID。";return;}
 try{
  const response=await fetch("/api/car-calendar-event?id="+encodeURIComponent(carId),{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.error==="calendar_schedule_unavailable"?"本場缺少可靠的日期或結束時間，暫時無法加入。":"無法取得車團資訊，請稍後重試。");
  event=data.event;
  $("title").textContent=event.title;
  $("times").textContent=time(event.start)+" ～ "+time(event.end);
  $("location").textContent=event.location||"尚未提供，以 LINE 群組公告為準";
  $("ics").href="/api/car-calendar-event?id="+encodeURIComponent(carId)+"&format=ics";
  $("fallback").href=event.googleUrl;
  $("loading").hidden=true;$("details").hidden=false;$("actions").hidden=false;
 }catch(e){$("loading").textContent=e.message||"載入失敗";}
}
async function api(token,path,options={}){
 const headers={Authorization:"Bearer "+token};if���q�^