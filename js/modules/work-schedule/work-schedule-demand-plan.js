(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.JLYWorkScheduleDemandPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
function count(v){if(v===null||v===undefined||text(v)==='')return null;const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=30?n:null}
function invalidDemand(value){return value!==null&&value!==undefined&&text(value)!==''&&count(value)===null}
function key(row){return[row.date,row.workId||row.workName,row.startTime,row.endTime,row.studioName||''].join('|')}
function defaultOf(role){
 if(!role)return null;
 return count(Object.prototype.hasOwnProperty.call(role,'requiredStaffCount')?role.requiredStaffCount:role.requiredCount);
}
function normalizedRole(name){const n=upper(name);return n==='GM'?'DM':n==='PC'?'NPC':n}
function roleOf(row,work){
 const roles=work?.roles||[],id=text(row?.rolePoolId),name=upper(row?.roleName);
 const byId=id?roles.find(r=>text(r.id)===id):null;
 if(byId){if(name&&normalizedRole(byId.name)!==normalizedRole(name))return null;return byId}
 return roles.find(r=>normalizedRole(r.name)===normalizedRole(name))||null;
}
function cancelled(row){return['cancelled','canceled','已取消','取消'].includes(text(row?.status).toLowerCase())}
function distinctSessions(rows,workId){
 const map=new Map();for(const r of rows||[]){if(text(r?.workId)!==text(workId)||!r?.id||cancelled(r))continue;
 const k=key(r);if(!map.has(k))map.set(k,{key:k,date:r.date,startTime:r.startTime,endTime:r.endTime,rows:[]});map.get(k).rows.push(r)}
 return[...map.values()].sort((a,b)=>text(a.date).localeCompare(text(b.date))||text(a.startTime).localeCompare(text(b.startTime)));
}
function buildPlan({rows=[],work,sessionKeys=[],values={},overrideExisting=false}){
 const edits=[],skipped=[],problems=[],keys=new Set(sessionKeys),seenIds=new Set(),seenRoleSessions=new Set();
 if(!work?.id||!Array.isArray(work.roles))return{edits,skipped,problems:['work_missing']};
 for(const row of rows){
  if(text(row?.workId)!==text(work.id)||!keys.has(key(row))||!row?.id||cancelled(row))continue;
  if(seenIds.has(String(row.id))){problems.push(`duplicate_shift:${row.id}`);continue}seenIds.add(String(row.id));
  const normalized=normalizedRole(row.roleName);
  if(!['DM','NPC'].includes(normalized)){skipped.push({id:row.id,reason:'other_role'});continue}
  const role=roleOf(row,work);if(!role){problems.push(`role_mismatch:${row.id}`);continue}
  const roleSession=`${key(row)}::${normalized}`;
  if(seenRoleSessions.has(roleSession)){problems.push(`duplicate_session_role:${row.id}`);continue}seenRoleSessions.add(roleSession);
  if(invalidDemand(row.requiredStaffCount)){problems.push(`invalid_existing_demand:${row.id}`);continue}
  if(invalidDemand(role.requiredStaffCount)){problems.push(`invalid_work_default:${row.id}`);continue}
  const candidate=Object.prototype.hasOwnProperty.call(values,normalized)?count(values[normalized]):defaultOf(role);
  if(candidate===null){skipped.push({id:row.id,reason:'default_unconfigured'});continue}
  const oldCount=count(row.requiredStaffCount);
  if(oldCount!==null&&!overrideExisting){skipped.push({id:row.id,reason:'already_configured'});continue}
  if(oldCount===candidate){skipped.push({id:row.id,reason:'unchanged'});continue}
  edits.push({id:String(row.id),workId:work.id,roleId:text(row.rolePoolId),roleName:text(row.roleName),normalizedRole:normalized,
   sessionKey:key(row),oldCount,newCount:candidate,defaultCount:defaultOf(role),useDefault:!Object.prototype.hasOwnProperty.call(values,normalized)});
 }
 return{edits,skipped,problems};
}
function validateFresh(edit,live,work,{overrideExisting=false}={}){
 if(!live)return'row_missing';
 if(text(live.workId)!==text(edit.workId)||key(live)!==edit.sessionKey)return'row_moved';
 if(cancelled(live))return'row_cancelled';
 if(text(live.rolePoolId)!==edit.roleId||upper(live.roleName)!==upper(edit.roleName))return'role_changed';
 const liveRole=roleOf(live,work);if(!liveRole)return'role_missing';
 if(invalidDemand(live.requiredStaffCount)||invalidDemand(liveRole.requiredStaffCount))return'invalid_demand';
 if(edit.useDefault&&defaultOf(roleOf(live,work))!==edit.defaultCount)return'default_changed';
 const actual=count(live.requiredStaffCount);
 if(actual!==edit.oldCount)return'demand_changed';
 if(!overrideExisting&&actual!==null)return'already_configured';
 return'';
}
function payload(edit,live,serverTime){
 const assigned=[...new Set((live.assignedPersonIds||live.personIds||[]).map(text).filter(Boolean))].length;
 const missing=Math.max(0,edit.newCount-assigned);
 return{requiredStaffCount:edit.newCount,missingCount:missing,
  staffingStatus:edit.newCount===0?'not_required':missing?'pending':'complete',updatedAt:serverTime};
}
return{count,key,defaultOf,normalizedRole,roleOf,distinctSessions,buildPlan,validateFresh,payload,invalidDemand};
});
