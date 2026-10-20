(function(){
"use strict";
const t=x=>String(x==null?"":x).trim(),$=id=>document.getElementById(id);
const carId=t(new URLSearchParams(location.search).get("id"));let event=null,working=false;
function status(v){$("status").textContent=v;}
function time(iso){return new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));}
let draft=null,manualEndValue="";
function displayEvent(){
 $("title").textContent=event?.title||draft?.title||"本場活動";
 $("location").textContent=event?.location||draft?.location||"尚未提供，以 LINE 群組公告為準";
 $("loading").hidden=true;$("details").hidden=false;
 if(event){
  $("times").textContent=time(event.start)+" ～ "+time(event.end)+(event.manualEnd?"（自行確認的結束時間）":"");
  const query="?id="+encodeURIComponent(carId)+(manualEndValue?"&end="+encodeURIComponent(manualEndValue):"");
  $("ics").href="/api/car-calendar-event"+query+"&format=ics";
  $("fallback").href=event.googleUrl;
  $("actions").hidden=false;$("manual-panel").hidden=true;
 }else{
  $("times").textContent=draft?.start?time(draft.start)+" 起，結束時間待確認":"活動日期或開始時間尚未設定";
  $("actions").hidden=true;$("manual-panel").hidden=!draft?.canChooseEnd;
  if(!draft?.canChooseEnd)status("本場缺少可靠的日期或開始時間，請主揪先補齊車團資訊。");
 }
}
async function init(){
 if(!carId){$("loading").textContent="車團連結缺少 ID。";return;}
 try{
  const response=await fetch("/api/car-calendar-event?id="+encodeURIComponent(carId),{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.success)throw new Error("無法取得車團資訊，請稍後重試。");
  event=data.event||null;draft=data.draft||null;displayEvent();
 }catch(e){$("loading").textContent=e.message||"載入失敗";}
}
async function confirmManualEnd(){
 if(!draft?.canChooseEnd)return;
 const selected=t($("manual-end").value);
 if(!selected){status("請先依群組公告選擇結束日期與時間。");return;}
 $("manual-confirm").disabled=true;
 try{
  const response=await fetch("/api/car-calendar-event?id="+encodeURIComponent(carId)+"&end="+encodeURIComponent(selected),{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.success||!data.event)throw new Error("結束時間不正確，請確認晚於開始時間且相距不超過七天。");
  event=data.event;manualEndValue=event.manualEnd?selected:"";
  status(event.manualEnd?"已套用你確認的結束時間。這不會修改原車團資料。":"已取得正式活動結束時間。");
  displayEvent();
 }catch(e){status(e.message||"無法套用結束時間");}
 finally{$("manual-confirm").disabled=false;}
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

let subscriptionToken="",subscriptionUrl="";
async function subscribe(){
 const button=$("subscribe");if(button.disabled)return;button.disabled=true;
 status("正在驗證 LINE 身分並建立私人訂閱網址…");
 try{
  const response=await fetch("/api/personal-calendar-subscribe",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});
  const data=await response.json();
  if(response.status===401)throw new Error("請先從車團報名頁完成 LINE 登入及正式玩家身分綁定，再回來訂閱。");
  if(!response.ok||!data.success||!data.url)throw new Error("暫時無法建立訂閱網址，請稍後再試。");
  subscriptionUrl=data.url;subscriptionToken=new URL(data.url).searchParams.get("token")||"";
  $("subscription-link").href=data.url.replace(/^https:/,"webcal:");
  $("subscription-result").hidden=false;
  status("已建立私人訂閱網址。請妥善保管，任何持有網址的人都能讀取你的行程。");
 }catch(error){status(error.message||"訂閱失敗");}
 finally{button.disabled=false;}
}
async function revokeSubscription(){
 if(!subscriptionToken||!confirm("確定停用這個訂閱網址？原本的日曆訂閱將無法再取得更新。"))return;
 const response=await fetch("/api/personal-calendar-revoke",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:subscriptionToken})});
 if(!response.ok){status("停用失敗，請確認 LINE 登入狀態後重試。");return;}
 subscriptionToken="";subscriptionUrl="";$("subscription-result").hidden=true;
 status("訂閱網址已停用。已同步到裝置的舊行程，仍需在行事曆 App 內移除訂閱。");
}
$("subscribe").addEventListener("click",subscribe);
$("subscription-copy").addEventListener("click",()=>{if(subscriptionUrl&&navigator.clipboard)navigator.clipboard.writeText(subscriptionUrl).then(()=>status("已複製私人訂閱網址，請勿公開分享。")).catch(()=>status("複製失敗，請長按訂閱連結。"));});
$("subscription-revoke").addEventListener("click",revokeSubscription);
$("manual-confirm").addEventListener("click",confirmManualEnd);
$("google").addEventListener("click",google);
init();
})();
