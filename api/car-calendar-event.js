"use strict";
const {getCarDetailViewById}=require("../services/firebase/car-detail-view-repository");
const {buildMobileCalendarEvent,buildMobileCalendarDraft,buildMobileCalendarEventWithEnd,buildIcs}=require("../services/line/mobile-calendar-event");
function reply(res,code,body){
 res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","private, no-store");
 res.setHeader("X-Content-Type-Options","nosniff");res.end(JSON.stringify(body));
}
function createHandler(deps={}){
 const read=deps.getCarDetailViewById||getCarDetailViewById;
 return async function(req,res){
  if(!req||req.method!=="GET")return reply(res,405,{success:false,error:"method_not_allowed"});
  const id=String(req.query&&req.query.id||"").trim();
  if(!id||id.length>180)return reply(res,400,{success:false,error:"car_id_required"});
  try{
   const car=await read(id);
   if(!car)return reply(res,404,{success:false,error:"car_not_found"});
   const requestedEnd=String(req.query&&req.query.end||"").trim();
   const draft=buildMobileCalendarDraft(car,id);
   const event=requestedEnd?buildMobileCalendarEventWithEnd(car,id,requestedEnd):buildMobileCalendarEvent(car,id);
   if(req.query&&req.query.format==="ics"){
    if(!event)return reply(res,422,{success:false,error:"calendar_schedule_unavailable"});
    res.statusCode=200;res.setHeader("Content-Type","text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="jly-car.ics"');
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    return res.end(buildIcs(event));
   }
   return reply(res,200,{success:true,event,draft});
  }catch(error){console.error("JLY 行事曆單車讀取失敗",error);return reply(res,500,{success:false,error:"calendar_unavailable"});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
