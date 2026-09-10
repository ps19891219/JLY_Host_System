(function(){
'use strict';
if(window.JLYWorkScheduleLifecycle)return;
const db=window.db||firebase.firestore();
const P=window.JLYWorkScheduleChangePolicy;
const changeEvents=db.collection('workScheduleChangeEvents');
const notificationOutbox=db.collection('workScheduleNotificationOutbox');
const calendarOutbox=db.collection('workScheduleCalendarOutbox');
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
  const conflictStudioId=studioIdOf(row),disclosure=P?.conflictDisclosure?.({viewerStudioId,conflictStudioId,source:'jly'})||'busy-only';
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
 return {classification:c,assignmentDelta:delta,affectedPersonIds:P.affected(before,after),calendarPlan:P.calendarPlan(before,after),notificationPlan:P.notificationPlan(before,after)};
}
function appendToBatch(batch,shiftRef,before,after,context={}){
 if(!P)throw new Error('Work Schedule Change Policy 尚未載入');
 const summary=summarize(before,after),shiftId=String(shiftRef?.id||after?.id||before?.id||''),studioId=studioIdOf(after)||studioIdOf(before),workId=String(after?.workId||before?.workId||'');
 const eventRef=changeEvents.doc();
 batch.set(eventRef,{shiftId,workId,studioId,workName:after?.workName||before?.workName||'',date:after?.date||before?.date||'',startTime:after?.startTime||before?.startTime||'',endTime:after?.endTime||before?.endTime||'',classification:summary.classification,affectedPersonIds:summary.affectedPersonIds,calendarPlan:summary.calendarPlan,source:context.source||'work_schedule',actorPersonId:String(context.actorPersonId||''),createdAt:ts()});
 for(const n of summary.notificationPlan){
  if(!isFormalPerson(n.personId))continue;
  const ref=notificationOutbox.doc();
  batch.set(ref,{changeEventId:eventRef.id,shiftId,workId,studioId,personId:String(n.personId),type:n.type,status:'pending',channel:'future_notification_core',calendar:n.calendar!==false,workName:after?.workName||before?.workName||'',roleName:after?.roleName||before?.roleName||'',date:after?.date||before?.date||'',startTime:after?.startTime||before?.startTime||'',endTime:after?.endTime||before?.endTime||'',createdAt:ts()});
 }
 const cp=summary.calendarPlan;
 for(const action of ['create','update','remove']){
  for(const personId of cp[action]||[]){
   if(!isFormalPerson(personId))continue;
   const ref=calendarOutbox.doc();
   batch.set(ref,{changeEventId:eventRef.id,shiftId,workId,studioId,personId:String(personId),action,status:'waiting_person_calendar',reason:cp.reason,workName:after?.workName||before?.workName||'',roleName:after?.roleName||before?.roleName||'',date:after?.date||before?.date||'',startTime:after?.startTime||before?.startTime||'',endTime:after?.endTime||before?.endTime||'',createdAt:ts(),lastError:''});
  }
 }
 return summary;
}
function buildAfter(row,payload){return {...row,...payload,updatedAt:undefined}}
window.JLYWorkScheduleLifecycle={studioIdOf,rangeOf,overlaps,findConflicts,conflictMessage,summarize,appendToBatch,buildAfter};
})();
