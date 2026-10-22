"use strict";
const text=v=>String(v==null?"":v).trim();
const idOK=v=>/^[A-Za-z0-9_-]{6,128}$/.test(text(v));
const managerRoles=new Set(["admin","administrator","system_admin"]);
function isManager(profile){return (Array.isArray(profile&&profile.roles)?profile.roles:[]).some(r=>managerRoles.has(text(r).toLowerCase()))}
async function resolveCanonicalPerson(db,id,readDoc){
 let current=text(id);if(!idOK(current))throw Object.assign(new Error("person_id_invalid"),{statusCode:400});
 const seen=new Set();
 for(let depth=0;depth<8;depth++){
  if(seen.has(current))throw Object.assign(new Error("person_alias_cycle"),{statusCode:409});seen.add(current);
  const ref=db.collection("players").doc(current),snap=await (readDoc?readDoc(ref):ref.get());if(!snap.exists)throw Object.assign(new Error("person_not_found"),{statusCode:404});
  const p=snap.data()||{};const next=text(p.canonicalPersonId||p.mergedIntoPersonId);
  if(!next){if(["merged","deleted","removed"].includes(text(p.status).toLowerCase()))throw Object.assign(new Error("person_alias_target_missing"),{statusCode:409});return {id:current,profile:p,aliases:[...seen]}}
  if(!idOK(next))throw Object.assign(new Error("person_alias_invalid"),{statusCode:409});current=next;
 }
 throw Object.assign(new Error("person_alias_depth_exceeded"),{statusCode:409});
}
async function authenticate(db,session){
 if(!session||session.provisional===true||!idOK(session.profileId)||!text(session.lineUserId))throw Object.assign(new Error("line_login_required"),{statusCode:401});
 const person=await resolveCanonicalPerson(db,session.profileId);
 if(text(person.profile.lineUserId)!==text(session.lineUserId))throw Object.assign(new Error("identity_not_linked"),{statusCode:403});
 return {...person,manager:isManager(person.profile),lineUserId:text(session.lineUserId)};
}
module.exports={text,idOK,isManager,resolveCanonicalPerson,authenticate};
