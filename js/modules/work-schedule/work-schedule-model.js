(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYWorkScheduleModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const ids=v=>Array.from(new Set((v||[]).map(x=>String(x)).filter(Boolean)));
function normalizeRole(role={}){return {id:String(role.id||role.roleId||''),name:String(role.name||role.roleName||''),eligiblePersonIds:ids(role.eligiblePersonIds||role.personIds||[])};}
function resolveRolePools(work,row={}){const base=(work&&Array.isArray(work.roles)&&work.roles.length?work.roles:(row.rolePoolsSnapshot||[])).map(normalizeRole);const roleId=String(row.rolePoolId||row.roleId||'');const roleName=String(row.roleName||'');let current=base.find(r=>(roleId&&r.id===roleId)||(!roleId&&roleName&&r.name===roleName));if(!current&&roleName){current=normalizeRole({id:roleId||`legacy-${roleName}`,name:roleName,eligiblePersonIds:row.eligiblePersonIds||row.personIds||[]});base.push(current);}return {roles:base,currentRoleId:current?current.id:''};}
function visibleAssignmentIds(eligible,assigned){return ids([...(eligible||[]),...(assigned||[])]);}
function assignmentAfterPoolRemoval(assigned){return ids(assigned);}
function endDate(date,start,end){const d=new Date(`${date}T${end}:00`);if(String(end)<=String(start))d.setDate(d.getDate()+1);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
function durationMinutes(row){const end=row.endDate||endDate(row.date,row.startTime,row.endTime);const a=new Date(`${row.date}T${row.startTime}:00`),b=new Date(`${end}T${row.endTime}:00`);return Math.max(1,Math.round((b-a)/60000));}
function isMine(row,identityIds){const mine=new Set(ids(identityIds));return ids(row.assignedPersonIds||row.personIds||[]).some(id=>mine.has(id));}
return {normalizeRole,resolveRolePools,visibleAssignmentIds,assignmentAfterPoolRemoval,endDate,durationMinutes,isMine};
});