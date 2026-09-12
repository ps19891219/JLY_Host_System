(function(){
'use strict';
const txt=v=>String(v??'').trim();
function localDateTime(date,time){
  if(!date||!time)return null;
  const d=new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime())?null:d;
}
function readDuration(config={}){
  const direct=Number(config.durationMinutes||config.eventDurationMinutes||0);
  if(direct>0)return direct;
  const input=document.getElementById?.('calendarDurationMinutes');
  const value=Number(input?.value||0);
  return value>0?value:60;
}
function targetInterval(config={}){
  const date=txt(config.gameDate)||txt(document.getElementById?.('gameDate')?.value);
  const time=txt(config.gameTime)||txt(document.getElementById?.('gameTime')?.value);
  const start=localDateTime(date,time);
  if(!start)return null;
  const duration=readDuration(config);
  return {start,end:new Date(start.getTime()+duration*60000)};
}
function googleInterval(event){
  const startValue=event?.start?.dateTime||event?.start?.date;
  const endValue=event?.end?.dateTime||event?.end?.date;
  if(!startValue)return null;
  const start=new Date(startValue);
  let end=endValue?new Date(endValue):null;
  if(Number.isNaN(start.getTime()))return null;
  if(!end||Number.isNaN(end.getTime()))end=new Date(start.getTime()+60000);
  return {start,end};
}
function carInterval(car){
  const start=localDateTime(txt(car?.gameDate),txt(car?.gameTime));
  if(!start)return null;
  const duration=Number(car?.calendar?.eventDurationMinutes||car?.eventDurationMinutes||60)||60;
  return {start,end:new Date(start.getTime()+duration*60000)};
}
function overlaps(a,b){return !!(a&&b&&a.start<b.end&&a.end>b.start)}
function filterGoogleEventsByInterval(events,config){
  const target=targetInterval(config);
  if(!target)return Array.isArray(events)?events:[];
  return (Array.isArray(events)?events:[]).filter(event=>overlaps(target,googleInterval(event)));
}
function filterJlyCarsByInterval(cars,config){
  const target=targetInterval(config);
  if(!target)return Array.isArray(cars)?cars:[];
  return (Array.isArray(cars)?cars:[]).filter(car=>overlaps(target,carInterval(car)));
}
function formatGoogleEventTime(event){
  if(event?.start?.date&&!event?.start?.dateTime)return'全天';
  const range=googleInterval(event);
  if(!range)return'時間未提供';
  const f=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Taipei'});
  return `${f.format(range.start)}-${f.format(range.end)}`;
}
function buildMessage(config){
  const jlyCars=Array.isArray(config.jlyCars)?config.jlyCars:[];
  const googleEvents=Array.isArray(config.googleEvents)?config.googleEvents:[];
  const lines=['⚠️ 這個時段已有其他行程',''];
  if(jlyCars.length){
    lines.push('JLY 車團');
    jlyCars.forEach(car=>lines.push(`🎭 ${car.scriptName||'未命名劇本'}｜${car.gameTime||'時間未填'}`));
    lines.push('');
  }
  if(googleEvents.length){
    lines.push('Google Calendar');
    googleEvents.forEach(event=>lines.push(`📌 ${event.summary||'未命名活動'}｜${formatGoogleEventTime(event)}`));
    lines.push('');
  }
  lines.push('仍要建立這台新車嗎？');
  return lines.join('\n');
}
function buildUpdateMessage(config){
  return buildMessage(config).replace('仍要建立這台新車嗎？','仍要修改這台車嗎？').replace('⚠️ 這個時段已有其他行程','⚠️ 修改後的時段已有其他行程');
}
async function loadGoogle(config,currentEventId=''){
  if(config.checkGoogle!==true)return {events:[],error:null};
  try{
    let events=await window.JLYCalendarProviderGoogle.listEventsForDate(config.gameDate);
    events=filterGoogleEventsByInterval(events,config).filter(event=>txt(event.id)!==txt(currentEventId));
    return {events,error:null};
  }catch(error){return {events:[],error}}
}
function confirmWithoutGoogle(error,verb){
  return confirm(`⚠️ 無法確認 Google Calendar ${verb}時段。\n\n${error?.message||'未知錯誤'}\n\n是否仍要繼續${verb==='建立'?'建立':'修改'}？`);
}
async function checkBeforeCreate(config={}){
  const jlyCars=filterJlyCarsByInterval(config.jlyCars,config);
  const google=await loadGoogle(config);
  if(google.error&&!confirmWithoutGoogle(google.error,'建立'))return {proceed:false,googleEvents:[],googleCheckError:google.error};
  if(!jlyCars.length&&!google.events.length)return {proceed:true,googleEvents:google.events,googleCheckError:google.error};
  return {proceed:confirm(buildMessage({jlyCars,googleEvents:google.events})),googleEvents:google.events,googleCheckError:google.error};
}
async function checkBeforeUpdate(config={}){
  const currentCarId=txt(config.currentCarId);
  const source=(Array.isArray(config.jlyCars)?config.jlyCars:[]).filter(car=>txt(car.id)!==currentCarId);
  const jlyCars=filterJlyCarsByInterval(source,config);
  const google=await loadGoogle(config,config.currentEventId);
  if(google.error&&!confirmWithoutGoogle(google.error,'修改'))return {proceed:false,googleEvents:[],googleCheckError:google.error};
  if(!jlyCars.length&&!google.events.length)return {proceed:true,googleEvents:google.events,googleCheckError:google.error};
  return {proceed:confirm(buildUpdateMessage({jlyCars,googleEvents:google.events})),googleEvents:google.events,googleCheckError:google.error};
}
window.JLYCalendarScheduleCheck={checkBeforeCreate,checkBeforeUpdate,buildMessage,buildUpdateMessage,targetInterval,filterGoogleEventsByInterval,filterJlyCarsByInterval,overlaps};
})();