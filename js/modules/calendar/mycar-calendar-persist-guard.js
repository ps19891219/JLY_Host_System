(function(){
"use strict";
const t=v=>String(v==null?"":v).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function verify(carId,eventId){
  const cfg=t(window.JLYCalendarConfig?.calendarId)||"primary";
  if(cfg!=="primary") throw new Error("MyCar 只允許同步 Google primary");
  const snap=await window.db.collection("cars").doc(carId).get();
  if(!snap.exists) throw new Error("找不到正式車團資料");
  const car=snap.data()||{};
  if(!car.gameDate) throw new Error("正式車團缺少日期");
  for(let i=0;i<5;i+=1){
    if(i) await wait(700*(i+1));
    const events=await window.JLYCalendarProviderGoogle.listEventsForDate(car.gameDate);
    const found=events.find(e=>t(e?.id)===t(eventId)&&t(e?.extendedProperties?.private?.carId)===t(carId));
    if(found) return found;
  }
  throw new Error("Google API 有回傳 eventId，但 primary Calendar 日期清單查不到這筆活動，因此不標記成功");
}
function install(){
  const data=window.JLYCalendarData;
  if(!data||data.__persistGuard)return;
  const original=data.updateCarCalendar.bind(data);
  data.updateCarCalendar=async function(carId,patch){
    if(patch?.syncStatus==="synced"&&patch?.eventId){
      await verify(carId,patch.eventId);
    }
    return original(carId,patch);
  };
  data.__persistGuard=true;
}
install();
})();
