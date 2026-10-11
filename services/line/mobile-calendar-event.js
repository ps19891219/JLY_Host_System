"use strict";
const {buildGoogleCalendarPrefillUrl}=require("./google-calendar-prefill-url");
const text=x=>String(x==null?"":x).trim();
function parseStamp(value) {
 if(!/^\d{8}T\d{6}Z$/.test(value))return "";
 const iso=value.slice(0,4)+"-"+value.slice(4,6)+"-"+value.slice(6,8)+"T"+value.slice(9,11)+":"+value.slice(11,13)+":"+value.slice(13,15)+".000Z";
 const date=new Date(iso);
 return Number.isFinite(date.getTime())?date.toISOString():"";
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
 const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,"").replace(/\¶»§q«^