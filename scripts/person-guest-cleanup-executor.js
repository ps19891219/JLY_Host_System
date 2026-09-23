"use strict";
function text(v){return String(v==null?"":v).trim();}
function list(v){return Array.isArray(v)?v:[];}
function removableIds(report){return list(report&&report.rows).filter(r=>r&&r.decision==="SAFE_TO_REMOVE_GUEST").map(r=>text(r.personId)).filter(Boolean);}
function planCleanup(report,view){
 const ids=new Set(removableIds(report));
 const people=list(view&&view.people).filter(p=>!ids.has(text(p&&p.id))&&!ids.has(text(p&&p.canonicalPersonId)));
 return {mode:"plan-only",deletePersonIds:[...ids],preparedView:{...(view||{}),schemaVersion:1,people,count:people.length},deleteActivities:[],deleteMemberships:[]};
}
async function executeCleanup(db,plan,{confirmed=false}={}){
 if(!confirmed)throw new Error("guest_cleanup_confirmation_required");
 const ids=list(plan&&plan.deletePersonIds).map(text).filter(Boolean);
 const viewRef=db.collection("personDirectoryViews").doc("canonical");
 await db.runTransaction(async tx=>{
  const snap=await tx.get(viewRef);
  const view=snap.exists?(snap.data()||{}):{schemaVersion:1,people:[]};
  const remove=new Set(ids);
  const people=list(view.people).filter(p=>!remove.has(text(p&&p.id))&&!remove.has(text(p&&p.canonicalPersonId)));
  ids.forEach(id=>tx.delete(db.collection("players").doc(id)));
  tx.set(viewRef,{...view,schemaVersion:1,people,count:people.length,updatedAt:new Date().toISOString()},{merge:false});
 });
 return {deletedGuestPersons:ids.length,activitiesDeleted:0,membershipsDeleted:0};
}
module.exports={removableIds,planCleanup,executeCleanup};
