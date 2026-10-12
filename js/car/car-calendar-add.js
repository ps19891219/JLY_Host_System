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
 const headers={Authorization:"Bearer "+token};if(options.body)headers["Content-Type"]="application/json";
 const res=await fetch("https://www.googleapis.com/calendar/v3"+path,{...options,headers});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(body.error&&body.error.message||"Google 日曆操作失敗");
 return body;
}
async function google(){
 if(!event||working)return;working=true;$("google").disabled=true;
 status("正在確認 Google 授權與現有行程…");
 try{
  if(!window.JLYCalendarAuth)throw new Error("Google 授權模組尚未載入");
  const token=await window.JLYCalendarAuth.requestAccessToken();
  const params=new URLSearchParams({privateExtendedProperty:"carId="+event.carId,maxResults:"20",showDeleted:"false"});
  const result=await api(token,"/calendars/primary/events?"+params);
  const found=(result.items||[]).some(e=>e.status!=="cancelled"&&e.extendedProperties&&e.extendedProperties.private&&e.extendedProperties.private.carId===event.carId);
  if(found){status("這台車已在這本 Google 日曆內，沒有重複建立。");return;}
  if(!confirm("確定加入 Google 主要行事曆？\n"+event.title+"\n"+time(event.start)+" ～ "+time(event.end))){status("已取消，沒有建立行程。");return;}
  const payload={summary:event.title,description:event.description,location:event.location,
    start:{dateTime:event.start,timeZone:"Asia/Taipei"},end:{dateTime:event.end,timeZone:"Asia/Taipei"},
    extendedProperties:{private:{source:"JLY",carId:event.carId,jlySource:"line_calendar_mobile"}}};
  const saved=await api(token,"/calendars/primary/events",{method:"POST",body:JSON.stringify(payload)});
  if(!saved.id)throw new Error("Google 未回傳事件 ID，請確認是否建立成功，避免重複操作");
  status("✅ 成功加入 Google 行事曆！");
 }catch(e){
  console.error("LINE Google Calendar 加入失敗",e);
  status("Google 尚未加入："+(e.message||"授權未完成")+"。LINE 若阻擋授權，請改用手機瀏覽器或 .ics。");
 }finally{working=false;$("google").disabled=false;}
}
$("google").addEventListener("click",google);
init();
})();
