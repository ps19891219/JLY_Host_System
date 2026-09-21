"use strict";
function text(v){return String(v==null?"":v).trim();}
function list(v){return Array.isArray(v)?v:[];}
function canonicalId(p){return text(p&&(p.canonicalPersonId||p.mergedIntoPersonId||p.personId||p.id));}
function compact(p,id){
 const row={...(p||{}),id:text(id||(p&&p.id))};
 return {
  id:row.id,canonicalPersonId:canonicalId(row),displayName:text(row.displayName||row.nickname||row.playerName||row.lineDisplayName),
  nickname:text(row.nickname),playerName:text(row.playerName),lineDisplayName:text(row.lineDisplayName),
  aliases:list(row.aliases).map(text).filter(Boolean),linkedPlayerIds:list(row.linkedPlayerIds).map(text).filter(Boolean),
  lineUserId:text(row.lineUserId),lineIdentityId:text(row.lineIdentityId),identityId:text(row.identityId),
  profileId:text(row.profileId),personId:text(row.personId),mergedIntoPersonId:text(row.mergedIntoPersonId),identityStatus:text(row.identityStatus),
  memberType:text(row.memberType),type:text(row.type),status:text(row.status),note:text(row.note||row.hostNote),
  playCount:Number(row.playCount||0),updatedAt:row.updatedAt||null
 };
}
function applyPersonMutation(view,person,id){
 const base=view&&typeof view==="object"?view:{};
 const rows=list(base.people).filter(Boolean);
 const next=compact(person,id);
 const removeIds=new Set([next.id,next.canonicalPersonId,...next.linkedPlayerIds].map(text).filter(Boolean));
 const kept=rows.filter(row=>{
  const rid=text(row.id),rc=text(row.canonicalPersonId);
  return !removeIds.has(rid)&&!removeIds.has(rc)&&!list(row.linkedPlayerIds).some(x=>removeIds.has(text(x)));
 });
 if(next.status!=="deleted"&&next.status!=="removed"&&next.status!=="merged"&&!text(next.mergedIntoPersonId))kept.push(next);
 kept.sort((a,b)=>text(a.displayName).localeCompare(text(b.displayName),"zh-Hant"));
 return {...base,schemaVersion:1,people:kept,count:kept.length,updatedAt:new Date().toISOString()};
}
async function syncPerson(db,person,id,transaction){
 const ref=db.collection("personDirectoryViews").doc("canonical");
 if(transaction){const snap=await transaction.get(ref);transaction.set(ref,applyPersonMutation(snap.exists?snap.data():{},person,id),{merge:false});return;}
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);tx.set(ref,applyPersonMutation(snap.exists?snap.data():{},person,id),{merge:false});});
}
module.exports={compact,applyPersonMutation,syncPerson};
