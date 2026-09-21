"use strict";
const text=v=>String(v||"").trim();
function addId(set,v){const id=text(v);if(id)set.add(id)}
function addPlayerAliases(ids,doc){if(!doc||!doc.exists)return false;const before=ids.size,d=doc.data()||{};addId(ids,doc.id);for(const k of["identityId","playerId","personId","canonicalPersonId","profileId"])addId(ids,d[k]);for(const id of(d.linkedPlayerIds||[]))addId(ids,id);return ids.size>before}
async function expandFormalPersonIds(db,seedIds,{maxReads=8}={}){const ids=new Set([...seedIds].map(text).filter(Boolean)),seen=new Set();let changed=true,passes=0,reads=0;while(changed&&passes<4&&reads<maxReads){changed=false;passes++;for(const id of [...ids]){if(reads>=maxReads)break;if(seen.has(id)||id.startsWith("line:"))continue;seen.add(id);try{reads++;const doc=await db.collection("players").doc(id).get();if(addPlayerAliases(ids,doc))changed=true}catch(_){}}}return ids}
module.exports={expandFormalPersonIds};
