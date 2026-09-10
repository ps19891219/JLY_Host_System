(function(){
'use strict';
if(window.JLYWorkScheduleLifecycle)return;
const db=window.db||firebase.firestore();
const P=window.JLYWorkScheduleChangePolicy;
const changeEvents=db.collection('workScheduleChangeEvents');
const ids=v=>[...new Set((v||[]).map(String).filter(Boolean))];
const assigned=row=>ids(row?.assignedPersonIds||row?.personIds||[]);
const isFormalPerson=id=>id&&!String(id).startsWith('temp:');
const ts=()=>firebase.firestore.FieldValue.serverTimestamp();
function studioIdOf(row){return String(row?.studioId||row?.organizationId||'')}
function endDateOf(row){return row?.endDate||row?.date||''}
function asDate(date,time){const d=new Date(`${date||''}T${time||'00:00'}:00`);return Number.isNaN(d.getTime())?null:d}
function rangeOf(row){const start=asDate(row?.date,row?.startTime),end=asDate(endDateOf(row),row?.endTime);return {start,end}}
function overlaps(a,b){const ar=rangeOf(a),br=rangeOf(b);return !!(ar.start&&ar.end&&br.start&&br.end&&ar.start<br.end&&ar.end>br.start)}
function sameShift(a,b){return a?.id&&b?.id&&String(a.id)===String(b.id)}
function findConflicts({personIds,candidate,rows=[],ignoreShiftIds=[]}={}){
 const wanted=new Set(ids(personIds).filter(isFormalPerson)),ignore=new Set(ids(ignoreShiftIds)),viewerStudioId=studioIdOf(candidate),out=[];
 if(!wanted.size)return out;
 for(const row of rows){
  if(!row||row.status==='cancelled'||sameShift(candidate,row)||ignore.has(String(row.id||''))||!overlaps(candidate,row))continue;
  const hit=assigned(row).filter(id=>wanted.has(id));
  if(!hit.length)continue;
  const conflictStudioId=studioIdOf(row),sameWork=String(candidate?.workId||'')&&String(candidate?.workId||'')===String(row.workId||'');
  const disclosure=sameWork?'same-studio-detail':(P?.conflictDisclosure?.({viewerStudioId,conflictStudioId,source:'jly'})||'busy-only');
  hit.forEach(personId=>out.push({personId,row,disclosure,source:'jly'}));
 }
 return out;
}
function conflictMessage(conflicts,{personLabel=id=>id}={}){
 if(!conflicts.length)return '';
 const byPerson=new Map();
 conflicts.forEach(c=>{if(!byPerson.has(c.personId))byPerson.set(c.personId,[]);byPerson.get(c.personId).push(c)});
 const lines=['⚠️ 發現排班時間衝突'];
 for(const [personId,list] of byPerson){
  lines.push(`\n${personLabel(personId)}：`);
  const detailed=list.filter(x=>x.disclosure==='same-studio-detail');
  const hidden=list.length-detailed.length;
  detailed.slice(0,4).forEach(x=>lines.push(`本店已有 ${x.row.date||''} ${x.row.startTime||''}–${x.row.endTime||''} ${x.row.workName||'其他工作'}${x.row.roleName?'｜'+x.row.roleName:''}`));
  if(hidden)lines.push(`另有 ${hidden} 筆其他安排，內容不公開。`);
 }
 lines.push('\n是否仍要排入？');
 return lines.join('\n');
}
function summarize(before,after){
 const c=P.classify(before,after),delta=P.assignmentDelta(before,after);
 const notificationPlan=P.notificationPlan(before,after).filter(x=>isFormalPerson(x.personId));
 const cp=P.calendarPlan(before,after),calendarPlan={reason:cp.reason,create:(cp.create||[]).filter(isFormalPerson),update:(cp.update||[]).filter(isFormalPerson),remove:(cp.remove||[]).filter(isFormalPerson)};
 return {classification:c,assignmentDelta:delta,affectedPersonIds:P.affected(before,after).filter(isFormalPerson),calendarPlan,notificationPlan};
}
function appendToBatch(batch,shiftRef,before,after,context={}){
 if(!P)throw new Error('Work Schedule Change Policy 尚未載入');
 const summary=summarize(before,after),shiftId=String(shiftRef?.id||after?.id||before?.id||''),studioId=studioIdOf(after)||studioIdOf(before),workId=String(after?.workId||before?.workId||'');
 const hasCalendar=summary.calendarPlan.create.length||summary.calendarPlan.update.length||summary.calendarPlan.remove.length;
 const eventRef=changeEvents.doc();
 batch.set(eventRef,{shiftId,workId,studioId,workName:after?.workName||before?.workName||'',roleName:after?.roleName||before?.roleName||'',date:after?.date||before?.date||'',startTime:after?.startTime||before?.startTime||'',endTime:after?.endTime||before?.endTime||'',classification:summary.classification,affectedPersonIds:summary.affectedPersonIds,assignmentDelta:summary.assignmentDelta,calendarPlan:summary.calendarPlan,notificationPlan:summary.notificationPlan,notificationStatus:summary.notificationPlan.length?'pending':'none',personalCalendarStatus:hasCalendar?'waiting_person_calendar':'none',source:context.source||'work_schedule',actorPersonId:String(context.actorPersonId||''),conflictAcknowledged:Boolean(context.conflictAcknowledged),conflictCount:Number(context.conflictCount||0),createdAt:ts(),lastError:''});
 return {...summary,changeEventId:eventRef.id};
}
function buildAfter(row,payload){return {...row,...payload,updatedAt:undefined}}
window.JLYWorkScheduleLifecycle={studioIdOf,rangeOf,overlaps,findConflicts,conflictMessage,summarize,appendToBatch,buildAfter};
})();
