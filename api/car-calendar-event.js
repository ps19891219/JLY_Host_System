"use strict";
const {getCarDetailViewById}=require("../services/firebase/car-detail-view-repository");
const {buildMobileCalendarEvent,buildIcs}=require("../services/line/mobile-calendar-event");
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
   const event=buildMobileCalendarEvent(car,id);
   if(!event)return reply(res,422,{success:false,error:"calendar_schedule_unavailable"});
   if(req.query&&req.query.format==="ics"){
    res.statusCode=200;res.setHeader("Content-Type","text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="jly-car.ics"');
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    return res.end(buildIcs(event));
   }
   return reply(res,200,{success:true,event});
  }catch(error){console.error(¶»§q«^