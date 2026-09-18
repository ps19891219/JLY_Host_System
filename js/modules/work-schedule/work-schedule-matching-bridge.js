(function(){
'use strict';
if(window.__JLYWorkScheduleMatchingBridgeInitialized)return;
window.__JLYWorkScheduleMatchingBridgeInitialized=true;
const txt=v=>String(v??'').trim();
const uniq=a=>[...new Set((a||[]).map(String).filter(Boolean))];
function responsesOf(matching){return Object.values(matching?.responses&&typeof matching.responses==='object'?matching.responses:{}).filter(r=>r&&r.status!=='deleted')}
function availablePersonIds(matching,slotId){
 return uniq(responsesOf(matching).filter(r=>Array.isArray(r.slotIds)&&r.slotIds.includes(slotId)).map(r=>r.participantId||r.personId||r.identityId).filter(Boolean));
}
function buildAssignmentDraft({matching,slot,work,studio,roles}={}){
 if(!matching||!slot?.id||!slot?.date||!slot?.time)throw new Error('matching_slot_required');
 const availableIds=availablePersonIds(matching,slot.id);
 return {
  source:'matching',
  sourceMatchingId:txt(matching.id||matching.matchingId),
  sourceSlotId:txt(slot.id),
  date:txt(slot.date),
  startTime:txt(slot.time),
  workId:txt(work?.id||work?.workId),
  workName:txt(work?.name||work?.workName),
  studioId:txt(studio?.id||studio?.studioId),
  studioName:txt(studio?.name||studio?.studioName),
  availablePersonIds:availableIds,
  roles:(roles||[]).map(r=>({roleId:txt(r.id||r.roleId||r.name),roleName:txt(r.name||r.roleName),eligiblePersonIds:uniq(r.eligiblePersonIds||r.personIds).filter(id=>availableIds.includes(id)),selectedPersonIds:[]}))
 };
}
function validateSelection(draft){
 const allowed=new Set(draft?.availablePersonIds||[]);
 const errors=[];
 (draft?.roles||[]).forEach(r=>(r.selectedPersonIds||[]).forEach(id=>{if(!allowed.has(String(id)))errors.push({roleId:r.roleId,personId:String(id),error:'person_not_available'})}));
 return {valid:errors.length===0,errors};
}
window.JLYWorkScheduleMatchingBridge={responsesOf,availablePersonIds,buildAssignmentDraft,validateSelection};
})();