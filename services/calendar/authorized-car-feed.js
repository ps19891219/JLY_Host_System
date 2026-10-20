"use strict";
const {buildMobileCalendarEvent}=require("../line/mobile-calendar-event");
const {buildCalendarFeed}=require("./ics-feed");

/**
 * Reuses the existing single-car calendar event resolver.
 * Do not read Firestore here: caller supplies authorized, prepared car rows.
 * Feed URL issuance, identity authorization and membership filtering MUST happen upstream.
 */
function buildAuthorizedCarFeed(rows, options={}) {
  if(!Array.isArray(rows)) throw new Error("invalid_calendar_rows");
  const events=[];
  for(const row of rows){
    const car=row && row.car;
    const carId=String(row && row.carId || "").trim();
    if(!car || !carId) throw new Error("invalid_calendar_row");
    const official=buildMobileCalendarEvent(car,carId);
    if(!official) continue; // Incomplete dates must never be guessed.
    const start=new Date(official.start),end=new Date(official.end);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())) continue;
    const taipei=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
    const parts=Object.fromEntries(taipei.formatToParts(start).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    const minutes=Math.round((end-start)/60000);
    if(minutes<=0) continue;
    events.push({
      carId,gameDate:`${parts.year}-${parts.month}-${parts.day}`,
      gameTime:`${parts.hour}:${parts.minute}`,durationMinutes:minutes,
      title:official.title,location:official.location,description:official.description,
      sequence:Number(row.sequence||0),updatedAt:row.updatedAt||undefined,
      cancelled:row.cancelled===true
    });
  }
  return buildCalendarFeed(events,options);
}
module.exports={buildAuthorizedCarFeed};
