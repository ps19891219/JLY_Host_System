"use strict";
const {buildGoogleCalendarPrefillUrl}=require("./google-calendar-prefill-url");
const text=x=>String(x==null?"":x).trim();
function parseStamp(value) {
 if(!/^\d{8}T\d{6}Z$/.test(value))return "";
 const iso=value.slice(0,4)+"-"+value.slice(4,6)+"-"+value.slice(6,8)+"T"+value.slice(9,11)+":"+value.slice(11,13)+":"+value.slice(13,15)+".000Z";
 const date=new Date(iso);
 return Number.isFinite(date.getTime())?date.toISOString():"";
}
function buildMobileCalendarDraft(car,id){
 if(!car||typeof car!=="object"||!text(id))return null;
 const title=text(car.scriptName||car.activityName||car.name||car.label)||"本場活動";
 const date=text(car.gameDate||car.date||car.startDate);
 const clock=text(car.gameTime||car.time||car.startTime);
 const dateMatch=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 const timeMatch=/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(clock);
 let start=null;
 if(dateMatch&&timeMatch&&Number(timeMatch[1])<=23){
  const [_,year,month,day]=dateMatch;
  const validated=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  if(Number(year)>=1900&&Number(year)<=9999&&validated.getUTCFullYear()===Number(year)
    &&validated.getUTCMonth()===Number(month)-1&&validated.getUTCDate()===Number(day)){
   start=new Date(validated.getTime()+(Number(timeMatch[1])-8)*3600000+Number(timeMatch[2])*60000).toISOString();
  }
 }
 const studio=text(car.studioName||car.organizerName||car.organizer);
 const place=text(car.locationName||car.location||car.address||car.storeAddress);
 return {carId:text(id),title:"劇本－"+title,location:[studio,place].filter((x,i,a)=>x&&a.indexOf(x)===i).join("｜"),
  start,canChooseEnd:!!start,timeZone:"Asia/Taipei"};
}
function buildMobileCalendarEventWithEnd(car,id,manualEnd){
 const official=buildMobileCalendarEvent(car,id);
 if(official)return official;
 const draft=buildMobileCalendarDraft(car,id);
 if(!draft?.start||typeof manualEnd!=="string"||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(manualEnd))return null;
 const [endDate,endTime]=manualEnd.split("T");
 const endMs=new Date(endDate+"T"+endTime+":00+08:00").getTime();
 const startMs=Date.parse(draft.start);
 if(!Number.isFinite(endMs)||endMs<=startMs||endMs-startMs>10080*60000)return null;
 const event=buildMobileCalendarEvent({...car,gameEndDate:endDate,gameEndTime:endTime},id);
 if(!event||Date.parse(event.end)!==endMs)return null;
 return {...event,manualEnd:true};
}
function buildMobileCalendarEvent(car,id){
 const uri=buildGoogleCalendarPrefillUrl(car);
 if(!uri||!text(id))return null;
 const p=new URL(uri).searchParams, times=text(p.get("dates")).split("/");
 if(times.length!==2)return null;
 const start=parseStamp(times[0]),end=parseStamp(times[1]);
 if(!start||!end||Date.parse(start)>=Date.parse(end))return null;
 return {carId:text(id),title:text(p.get("text")),description:text(p.get("details")),location:text(p.get("location")),start,end,timeZone:"Asia/Taipei",googleUrl:uri};
}
function escapeIcs(value){
 return text(value).replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
}
function fold(s){
 let result=[],line="";
 for(const char of s){
  if(Buffer.byteLength(line+char,"utf8")>75){result.push(line);line=" "+char;}else line+=char;
 }
 result.push(line);return result.join("\r\n");
}
function buildIcs(event){
 if(!event||!event.carId||!event.start||!event.end)return null;
 const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const uid=Buffer.from(event.carId,"utf8").toString("hex").slice(0,128);
 const data=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//JLY Host System//LINE Calendar//ZH-TW",
 "CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT","UID:jly-car-"+uid+"@jly-host-system",
 "DTSTAMP:"+stamp(Date.now()),"DTSTART:"+stamp(event.start),"DTEND:"+stamp(event.end),
 "SUMMARY:"+escapeIcs(event.title),"DESCRIPTION:"+escapeIcs(event.description),
 "LOCATION:"+escapeIcs(event.location),"END:VEVENT","END:VCALENDAR"];
 return data.map(fold).join("\r\n")+"\r\n";
}
module.exports={buildMobileCalendarEvent,buildMobileCalendarDraft,buildMobileCalendarEventWithEnd,buildIcs};
