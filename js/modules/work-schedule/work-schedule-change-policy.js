(function(){
'use strict';
if(window.JLYWorkScheduleChangePolicy)return;
const ids=v=>[...new Set((v||[]).map(String).filter(Boolean))];
const assigned=row=>ids(row?.assignedPersonIds||row?.personIds||[]);
const TIME_FIELDS=['date','startTime','endTime','endDate','location','studioName'];
const ASSIGNMENT_FIELDS=['assignedPersonIds','personIds','people'];
const DUTY_FIELDS=['staffSlots','duty','dutyLabel','slotLabel'];
function stable(v){return JSON.stringify(v??null)}
function changed(before,after,fields){return fields.some(k=>stable(before?.[k])!==stable(after?.[k]))}
function classify(before,after){
 const shift=changed(before,after,TIME_FIELDS);
 const assignment=changed(before,after,ASSIGNMENT_FIELDS);
 const duty=changed(before,after,DUTY_FIELDS);
 return {shift,assignment,duty,calendarRequired:shift,calendarForbidden:!shift&&duty&&!assignment};
}
function assignmentDelta(before,after){
 const oldSet=new Set(assigned(before)),newSet=new Set(assigned(after));
 return {added:[...newSet].filter(x=>!oldSet.has(x)),removed:[...oldSet].filter(x=>!newSet.has(x)),retained:[...newSet].filter(x=>oldSet.has(x))};
}
function affected(before,after){
 const c=classify(before,after),d=assignmentDelta(before,after);
 if(c.shift)return ids([...assigned(before),...assigned(after)]);
 if(c.assignment)return ids([...d.added,...d.removed]);
 if(c.duty){
  const oldSlots=before?.staffSlots||[],newSlots=after?.staffSlots||[];
  const byKey=a=>new Map(a.map((s,i)=>[String(s.id||s.slotKey||i),s]));
  const a=byKey(oldSlots),b=byKey(newSlots),out=[];
  new Set([...a.keys(),...b.keys()]).forEach(k=>{if(stable(a.get(k))!==stable(b.get(k))){if(a.get(k)?.personId)out.push(a.get(k).personId);if(b.get(k)?.personId)out.push(b.get(k).personId)}});
  return ids(out);
 }
 return [];
}
function calendarPlan(before,after){
 const c=classify(before,after),d=assignmentDelta(before,after);
 if(c.shift)return {update:ids(assigned(after)),create:[],remove:d.removed,reason:'shift'};
 if(c.assignment)return {update:[],create:d.added,remove:d.removed,reason:'assignment'};
 return {update:[],create:[],remove:[],reason:c.duty?'duty':'none'};
}
function conflictDisclosure({viewerStudioId,conflictStudioId,viewerIsSelf=false,source='jly'}={}){
 if(viewerIsSelf)return 'full';
 if(source==='google-private')return 'busy-only';
 if(viewerStudioId&&conflictStudioId&&String(viewerStudioId)===String(conflictStudioId))return 'same-studio-detail';
 return 'busy-only';
}
function notificationPlan(before,after){
 const c=classify(before,after),d=assignmentDelta(before,after),out=[];
 d.added.forEach(personId=>out.push({personId,type:'shift_added'}));
 d.removed.forEach(personId=>out.push({personId,type:'shift_removed'}));
 if(c.shift)assigned(after).forEach(personId=>out.push({personId,type:'shift_changed'}));
 if(c.duty&&!c.shift&&!c.assignment)affected(before,after).forEach(personId=>out.push({personId,type:'duty_changed',calendar:false}));
 return out;
}
window.JLYWorkScheduleChangePolicy={classify,assignmentDelta,affected,calendarPlan,conflictDisclosure,notificationPlan};
})();
