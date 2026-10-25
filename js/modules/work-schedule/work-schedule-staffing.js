(function(){
'use strict';
if(window.JLYWorkScheduleStaffing)return;
const MAX_REQUIRED=30;
function count(value){
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=0&&n<=MAX_REQUIRED?n:null;
}
function defaultForRole(role){
  if(!role)return null;
  if(Object.prototype.hasOwnProperty.call(role,'requiredStaffCount'))return count(role.requiredStaffCount);
  // Older Work role configurations used requiredCount as the default headcount.
  return count(role.requiredCount);
}
function summarize(row){
  const required=count(row?.requiredStaffCount);
  const ids=row?.assignedPersonIds||row?.personIds||[];
  const assigned=new Set(ids.map(String).filter(Boolean)).size;
  if(required===null)return{required:null,assigned,missing:null,status:'unconfigured',label:'尚未設定需求'};
  if(required===0)return{required,assigned,missing:0,status:'not_required',label:''};
  const missing=Math.max(0,required-assigned);
  return missing?{required,assigned,missing,status:'pending',label:`尚缺 ${missing} 位 ${String(row?.roleName||'工作人員')}`}:{required,assigned,missing:0,status:'complete',label:`${String(row?.roleName||'工作人員')} 已排滿`};
}
window.JLYWorkScheduleStaffing={count,defaultForRole,summarize,maxRequired:MAX_REQUIRED};
})();
