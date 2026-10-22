/* Play-history identity review. A candidate is never a verified Person. */
(function(root){
'use strict';
const text=value=>String(value==null?'':value).trim();
const validId=id=>/^[A-Za-z0-9_-]{6,128}$/.test(text(id));
function reviewCandidates({roster,candidates,verifiedPeople}={}){
 if(!Array.isArray(roster)||!candidates||typeof candidates!=='object'||Array.isArray(candidates))throw Error('車友或候選資料格式不正確');
 const names=new Set(roster.map(text).filter(Boolean));
 const results=[];
 for(const [rawName,rawId] of Object.entries(candidates)){
  const nickname=text(rawName),personId=text(rawId);
  if(!names.has(nickname)||!validId(personId))throw Error('候選身分不符合車友名單');
  // verifiedPeople must be an independently authenticated directory lookup.
  const person=verifiedPeople&&Object.prototype.hasOwnProperty.call(verifiedPeople,personId)?verifiedPeople[personId]:null;
  results.push({nickname,personId,status:person&&person.id===personId?'candidate-found':'unverified',verified:false});
 }
 return results;
}
function confirmMatch({nickname,personId,roster,proof}={}){
 if(!Array.isArray(roster)||!roster.includes(nickname)||!validId(personId))throw Error('車友或 Person ID 不正確');
 // A verified lookup alone is insufficient: explicit owner approval and independently established identity binding are both required.
 if(!proof||proof.ownerApproved!==true||proof.identityVerified!==true||proof.personId!==personId||proof.nickname!==nickname)throw Error('缺少本人確認與身分驗證，不得建立正式關係');
 return Object.freeze({nickname,personId,verified:true,proofRef:text(proof.proofRef)});
}
const api=Object.freeze({reviewCandidates,confirmMatch});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.JLYPlayHistoryPersonReview=api;
})(typeof window!=='undefined'?window:null);
