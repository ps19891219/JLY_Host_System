"use strict";

/**
 * JLY Calendar: RFC 5545 event serialization core.
 * Pure formatter only. No Firestore reads, public endpoint, tokens or provider writes.
 * Feed authentication and subscription authorization belong to the future route layer.
 */
const clean = value => String(value == null ? "" : value);
const pad = n => String(n).padStart(2, "0");
function escapeText(value) {
  return clean(value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function localStamp(date, time) {
  const d = clean(date).trim(), t = clean(time).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(t)) throw new Error("invalid_calendar_datetime");
  const [y,m,day] = d.split("-").map(Number), [h,min,sec=0] = t.split(":").map(Number);
  const dt = new Date(Date.UTC(y,m-1,day,h,min,sec));
  if (dt.getUTCFullYear()!==y || dt.getUTCMonth()!==m-1 || dt.getUTCDate()!==day || h>23 || min>59 || sec>59) throw new Error("invalid_calendar_datetime");
  return `${d.replace(/-/g,"")}T${pad(h)}${pad(min)}${pad(sec)}`;
}
function shiftLocalStamp(stamp, minutes) {
  const y=+stamp.slice(0,4),m=+stamp.slice(4,6),d=+stamp.slice(6,8),h=+stamp.slice(9,11),mi=+stamp.slice(11,13),s=+stamp.slice(13,15);
  const x=new Date(Date.UTC(y,m-1,d,h,mi+minutes,s));
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth()+1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}`;
}
function utcStamp(value) {
  const d=new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error("invalid_updated_at");
  return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
function fold(line) {
  const bytes=Buffer.from(line,"utf8");
  const chunks=[]; let offset=0;
  while(offset<bytes.length){
    let end=Math.min(offset+75,bytes.length);
    while(end<bytes.length && (bytes[end]&0xc0)===0x80) end--;
    if(end<=offset) end=Math.min(offset+75,bytes.length);
    chunks.push(bytes.subarray(offset,end).toString("utf8"));offset=end;
  }
  return chunks.join("\r\n ");
}
function buildCalendarFeed(events, options={}) {
  const now=utcStamp(options.generatedAt||new Date());
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//JLY Host System//Calendar//ZH-TW","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:"+escapeText(options.name||"JLY 我的車團"),"X-WR-TIMEZONE:Asia/Taipei"];
  for(const event of events){
    const id=clean(event.carId).trim();
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("invalid_car_id");
    const start=localStamp(event.gameDate,event.gameTime);
    const duration=Number(event.durationMinutes||60);
    if(!Number.isInteger(duration)||duration<1||duration>10080) throw new Error("invalid_duration");
    const sequence=Number(event.sequence||0);
    if(!Number.isInteger(sequence)||sequence<0) throw new Error("invalid_sequence");
    lines.push("BEGIN:VEVENT",
      "UID:"+id+"@calendar.jly-host-system",
      "DTSTAMP:"+now,
      "DTSTART;TZID=Asia/Taipei:"+start,
      "DTEND;TZID=Asia/Taipei:"+shiftLocalStamp(start,duration),
      "SEQUENCE:"+sequence,
      "SUMMARY:"+escapeText(event.title||event.scriptName||"JLY 車團"));
    if(event.location)lines.push("LOCATION:"+escapeText(event.location));
    if(event.description)lines.push("DESCRIPTION:"+escapeText(event.description));
    if(event.updatedAt)lines.push("LAST-MODIFIED:"+utcStamp(event.updatedAt));
    if(event.cancelled)lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n")+"\r\n";
}
module.exports={buildCalendarFeed,escapeText,localStamp};
