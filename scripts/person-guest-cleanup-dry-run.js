"use strict";
function text(v){return String(v==null?"":v).trim();}
function list(v){return Array.isArray(v)?v:[];}
function hasIdentity(p){return !!(text(p.lineUserId)||text(p.lineIdentityId)||text(p.identityId)||text(p.profileId)||p.isLineLinked===true);}
function isGuest(p){return !hasIdentity(p)&&["guest",""].includes(text(p.memberType||p.type||p.identityStatus).toLowerCase());}
function activityReferencesPerson(activity,id){
 const target=text(id); if(!target)return[];
 const refs=[];
 for(const key of ["players","applications","dmApplications","staffSlots"]){
  list(activity&&activity[key]).forEach((row,index)=>{
   const ids=[row&&row.id,row&&row.playerId,row&&row.personId,row&&row.profileId,row&&row.canonicalPersonId].map(text).filter(Boolean);
   if(ids.includes(target))refs.push({field:key,index,hasSnapshotName:!!text(row&&(row.playerName||row.displayName||row.nickname||row.name)),role:text(row&&(row.roleChoice||row.role||row.position))});
  });
 }
 return refs;
}
function assessGuest(person,activities){
 const id=text(person&&person.id);
 if(!id)return{personId:id,decision:"KEEP_INVALID",reason:"missing_person_id"};
 if(!isGuest(person))return{personId:id,decision:"KEEP_MEMBER",reason:"formal_identity_or_member"};
 const refs=[]; for(const a of list(activities)){const found=activityReferencesPerson(a,id);if(found.length)refs.push({activityId:text(a.id),references:found});}
 const unsafe=refs.some(a=>a.references.some(r=>!r.hasSnapshotName));
 return {personId:id,displayName:text(person.displayName||person.nickname||person.playerName),decision:unsafe?"KEEP_HISTORY_DEPENDENCY":"SAFE_TO_REMOVE_GUEST",reason:unsafe?"activity_reference_requires_person":"history_snapshot_self_contained",activityReferences:refs};
}
function buildDryRun(people,activities){
 const rows=list(people).map(p=>assessGuest(p,activities));
 const counts=rows.reduce((m,r)=>(m[r.decision]=(m[r.decision]||0)+1,m),{});
 return {mode:"dry-run",peopleChecked:rows.length,counts,rows};
}
function removalPlan(report){
 if(!report||report.mode!=="dry-run")throw new Error("dry_run_report_required");
 const entries=list(report.rows).filter(r=>r.decision==="SAFE_TO_REMOVE_GUEST").map(r=>({personId:r.personId,displayName:r.displayName,action:"remove_guest_person_and_directory_row",preserveActivityHistory:true}));
 return {mode:"plan-only",entries,deletePersonIds:entries.map(r=>r.personId),preparedViewRemoveIds:entries.map(r=>r.personId),count:entries.length};
}
function applyPreparedViewRemovals(view,ids){
 const remove=new Set(list(ids).map(text).filter(Boolean));
 const base=view&&typeof view==="object"?view:{};
 const people=list(base.people).filter(row=>!remove.has(text(row&&row.id))&&!remove.has(text(row&&row.canonicalPersonId)));
 return {...base,schemaVersion:1,people,count:people.length,updatedAt:new Date().toISOString()};
}
module.exports={hasIdentity,isGuest,activityReferencesPerson,assessGuest,buildDryRun,removalPlan,applyPreparedViewRemovals};


function applyDirectoryRemoval(view,personIds){
 const remove=new Set(list(personIds).map(text).filter(Boolean));
 const base=view&&typeof view==="object"?view:{};
 const people=list(base.people).filter(row=>!remove.has(text(row&&row.id))&&!remove.has(text(row&&row.canonicalPersonId)));
 return {...base,schemaVersion:1,people,count:people.length,updatedAt:new Date().toISOString()};
}

module.exports={hasIdentity,isGuest,activityReferencesPerson,assessGuest,buildDryRun,removalPlan,applyPreparedViewRemovals,applyDirectoryRemoval};
