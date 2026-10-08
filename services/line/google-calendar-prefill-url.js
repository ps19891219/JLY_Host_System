"use strict";

// Pure URL builder: no Firestore reads or Google OAuth writes.
const EDITOR_URL="https://calendar.google.com/calendar/r/eventedit";
const TIMEZONE="Asia/Taipei";
function text(value){return typeof value==="string"?value.trim():"";}
function firstText(...values){return values.map(text).find(Boolean)||"";}
function parseDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const d=new Date(0);
  d.setUTCFullYear(year,month-1,day);d.setUTCHours(0,0,0,0);
  if(year<1900||year>9999||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
  return {year,month,day};
}
function parseTime(value){
  const match=/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(text(value));
  if(!match)return null;
  const hours=Number(match[1]);
  if(hours>23)return null;
  return {hours,minutes:Number(match[2]),seconds:Number(match[3]||0)};
}
function utcMs(date,time){
  const d=new Date(0);
  d.setUTCFullYear(date.year,date.month-1,date.day);
  d.setUTCHours(time.hours-8,time.minutes,time.seconds,0);
  return d.getTime();
}
function stamp(ms){return new Date(ms).toISOString().slice(0,19).replace(/[-:]/g,"")+"Z";}
function durationMinutes(car){
  const calendar=car.calendar&&typeof car.calendar==="object"?car.calendar:{};
  const values=[car.durationMinutes,car.eventDurationMinutes,calendar.eventDurationMinutes];
  const value=values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=="");
  const amount=Number(value);
  return Number.isInteger(amount)&&amount>0&&amount<=10080?amount:null;
}
function buildGoogleCalendarPrefillUrl(car){
  if(!car||typeof car!=="object")return null;
  const name=firstText(car.scriptName,car.activityName,car.name,car.label);
  const date=parseDate(firstText(car.gameDate,car.date,car.startDate));
  const time=parseTime(firstText(car.gameTime,car.time,car.startTime));
  if(!name||!date||!time)return null;
  const begin=utcMs(date,time);
  const explicitEnd=firstText(car.gameEndTime,car.endTime,car.finishTime);
  let end;
  if(explicitEnd){
    const endTime=parseTime(explicitEnd);
    const endDate=parseDate(firstText(car.gameEndDate,car.endDate)||firstText(car.gameDate,car.date,car.startDate));
    if(!endTime||!endDate)return null;
    end=utcMs(endDate,endTime);
  }else{
    const minutes=durationMinutes(car);
    if(!minutes)return null;
    end=begin+minutes*60000;
  }
  if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||end-begin>10080*60000)return null;
  const studio=firstText(car.studioName,car.organizerName,car.organizer);
  const address=firstText(car.locationName,car.location,car.address,car.storeAddress);
  const location=[studio,address].filter((v,i,a)=>v&&a.indexOf(v)===i).join("｜");
  function makeUrl(includeNote){
    const details=[
      "🎭 劇本："+name,
      studio?"🏠 工作室："+studio:"",
      address?"📍 地點："+address:"",
      includeNote?text(car.publicNote):"",
      "請以 LINE 群組最新公告為準。"
    ].filter(Boolean).join("\n");
    const params=new URLSearchParams({
      action:"TEMPLATE",text:"劇本－"+name,dates:stamp(begin)+"/"+stamp(end),
      stz:TIMEZONE,etz:TIMEZONE,details,location
    });
    return EDITOR_URL+"?"+params.toString();
  }
  // LINE URI actions have a 1000-character limit; drop optional note first.
  let uri=makeUrl(true);
  if(uri.length>1000&&text(car.publicNote))uri=makeUrl(false);
  return uri.length<=1000?uri:null;
}
module.exports={buildGoogleCalendarPrefillUrl};
