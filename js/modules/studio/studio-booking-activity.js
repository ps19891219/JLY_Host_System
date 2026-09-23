(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioBookingActivity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';

const BOOKING_STATUS=Object.freeze({PENDING:'pending',ADJUSTMENT:'adjustment_proposed',ACCEPTED:'accepted',REJECTED:'rejected',CANCELLED:'cancelled'});
const CHANGE_STATUS=Object.freeze({PENDING:'pending',ACCEPTED:'accepted',REJECTED:'rejected'});
const IMPORTANT_ACTIVITY_FIELDS=Object.freeze(['scriptId','scriptName','studioId','branchId','gameDate','date','gameTime','time','price']);

function text(v){return String(v==null?'':v).trim();}
function same(a,b){return JSON.stringify(a??null)===JSON.stringify(b??null);}
function vacancy(activity={}){
  const total=Math.max(0,Number(activity.totalPeople||activity.capacity||0));
  const active=(Array.isArray(activity.players)?activity.players:[]).filter(p=>!['cancelled','canceled','取消','已取消'].includes(text(p&&p.status).toLowerCase())).length;
  return Math.max(0,total-active);
}
function recruitmentVisible(activity={}){
  const preference=activity.publicRecruitmentPreference===true || activity.publicRecruitment===true;
  const studioBound=!!text(activity.studioId||activity.organizationId);
  const status=text(activity.status).toLowerCase();
  const valid=!['cancelled','canceled','ended','completed','已取消','已結束'].includes(status);
  return preference&&studioBound&&valid&&vacancy(activity)>0;
}
function bindingDifferences(activity={},booking={}){
  const pairs=[['scriptId','scriptId'],['studioId','studioId'],['branchId','branchId'],['gameDate','date'],['gameTime','time']];
  return pairs.flatMap(([activityField,bookingField])=>{
    const a=activity[activityField],b=booking[bookingField];
    if(a==null||a===''||b==null||b===''||same(a,b))return [];
    return [{field:activityField,activityValue:a,bookingValue:b}];
  });
}
function bookingAcceptancePlan({booking={},activity=null}={}){
  if(text(booking.status)!==BOOKING_STATUS.PENDING&&text(booking.status)!==BOOKING_STATUS.ADJUSTMENT)throw new Error('booking_not_confirmable');
  if(activity){
    const requestedId=text(booking.activityId);
    const activityId=text(activity.id||activity.activityId);
    if(requestedId&&activityId&&requestedId!==activityId)throw new Error('booking_activity_mismatch');
    const differences=bindingDifferences(activity,booking);
    if(differences.length)return {action:'needs_human_confirmation',activityId,differences};
    return {action:'bind_existing_activity',activityId,createActivity:false};
  }
  if(text(booking.activityId))throw new Error('existing_activity_required');
  return {action:'create_formal_activity',activityId:'',createActivity:true};
}
function importantChanges(before={},after={}){
  return IMPORTANT_ACTIVITY_FIELDS.filter(field=>!same(before[field],after[field]));
}
function studioChangePlan(before={},after={}){
  const fields=importantChanges(before,after);
  return fields.length?{applyImmediately:false,pendingActionRequired:true,fields}:{applyImmediately:true,pendingActionRequired:false,fields:[]};
}
function cancellationPlan(activity={},meta={}){
  return {...activity,status:'cancelled',cancellationBy:text(meta.by),cancellationReason:text(meta.reason),cancelledAt:text(meta.at),updatedAt:text(meta.at)||activity.updatedAt};
}
function makePendingAction({type,responsiblePersonId,responsibleStudioId,source,target,createdAt}={}){
  if(!text(type))throw new Error('pending_action_type_required');
  if(!text(responsiblePersonId)&&!text(responsibleStudioId))throw new Error('pending_action_responsible_scope_required');
  return {type:text(type),responsiblePersonId:text(responsiblePersonId)||null,responsibleStudioId:text(responsibleStudioId)||null,status:'pending',source:source||null,target:target||null,createdAt:text(createdAt),resolvedAt:null};
}
return {BOOKING_STATUS,CHANGE_STATUS,IMPORTANT_ACTIVITY_FIELDS,vacancy,recruitmentVisible,bindingDifferences,bookingAcceptancePlan,importantChanges,studioChangePlan,cancellationPlan,makePendingAction};
});