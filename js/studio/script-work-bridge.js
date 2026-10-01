(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.JLYScriptWorkBridge=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const text=v=>String(v==null?"":v).trim();
const ids=v=>Array.from(new Set((Array.isArray(v)?v:[]).map(text).filter(Boolean)));
function normalizeRole(role={},index=0){return {roleId:text(role.roleId||role.id||("role-"+(index+1))),name:text(role.name||role.roleName),type:text(role.type||role.roleType||"PC").toUpperCase(),eligiblePersonIds:ids(role.eligiblePersonIds||role.personIds)};}
function fromWork(work={}){
 const scriptId=text(work.scriptId||work.id);
 return {
  scriptId,
  workId:text(work.id||work.workId||scriptId),
  name:text(work.name||work.workName),
  studioId:text(work.studioId),
  branchId:text(work.branchId),
  studioName:text(work.studioName),
  coverUrl:text(work.coverUrl),
  summary:text(work.summary||work.description),
  tags:ids(work.tags),
  playerCount:Math.max(0,Number(work.playerCount||work.totalPeople||0)||0),
  maleSlots:Math.max(0,Number(work.maleSlots||0)||0),
  femaleSlots:Math.max(0,Number(work.femaleSlots||0)||0),
  durationMinutes:Math.max(0,Number(work.durationMinutes||0)||0),
  roles:(Array.isArray(work.roles)?work.roles:[]).map(normalizeRole)
 };
}
function mergeScriptIntoWork(work={},script={}){
 const current=fromWork(work),incoming=fromWork({...script,id:script.scriptId||current.scriptId});
 return {
  ...work,
  scriptId:incoming.scriptId||current.scriptId||text(work.id),
  name:incoming.name||current.name,
  studioId:incoming.studioId||current.studioId,
  branchId:incoming.branchId||current.branchId,
  studioName:incoming.studioName||current.studioName,
  coverUrl:incoming.coverUrl,
  summary:incoming.summary,
  tags:incoming.tags,
  playerCount:incoming.playerCount,
  maleSlots:incoming.maleSlots,
  femaleSlots:incoming.femaleSlots,
  durationMinutes:incoming.durationMinutes,
  // Qualification is already owned by the existing Work record. Preserve it
  // unless an explicit role payload is supplied by the studio editor.
  roles:Array.isArray(script.roles)?incoming.roles:(Array.isArray(work.roles)?work.roles:[])
 };
}
function toPublicScript(work={}){
 const s=fromWork(work);
 return {scriptId:s.scriptId,name:s.name,coverUrl:s.coverUrl,summary:s.summary,tags:s.tags,playerCount:s.playerCount,maleSlots:s.maleSlots,femaleSlots:s.femaleSlots,durationMinutes:s.durationMinutes};
}
return {normalizeRole,fromWork,mergeScriptIntoWork,toPublicScript};
});
