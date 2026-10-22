/* Shared historical session source + compact per-Person Prepared Views. Dormant until a server auth/rules gate is wired. */
(function(root){'use strict';
 const COLLECTION='playHistorySessions', VIEW_COLLECTION='personPlayHistoryViews';
 function createAdapter({db,core,authorize}={}){
  if(!db||typeof db.runTransaction!=='function'||!core||typeof core.buildPersonView!=='function'||typeof authorize!=='function')throw Error('缺少資料庫、資料驗證或授權程序');
  const check=async personId=>{if(await authorize(personId)!==true)throw Error('未通過正式 Person 授權')};
  const sourceRef=id=>db.collection(COLLECTION).doc(id), viewRef=id=>db.collection(VIEW_COLLECTION).doc(id);
  async function read(personId){await check(personId);const snap=await viewRef(personId).get();if(!snap.exists)return null;const v=snap.data();if(!core.validatePersonView(v,personId))throw Error('Person 遊玩紀錄 Prepared View 不正確');return v}
  async function put(input){const session=core.prepareSession(input), people=[...new Set(session.participants.map(p=>p.personId))];if(!people.length)throw Error('共同場次至少需有一位確認參與者');for(const id of people)await check(id);const src=sourceRef(session.id), views=people.map(viewRef);return db.runTransaction(async tx=>{const old=await tx.get(src);const previous=old.exists?old.data():null;if(previous){const normalized=core.prepareSession(previous);if(JSON.stringify(normalized)!==JSON.stringify(previous))throw Error('共同場次來源需先修復，不覆寫');}
    const affected=[...new Set([...people,...(previous?.participants||[]).map(p=>p.personId)])],refs=affected.map(viewRef),snaps=[];for(const ref of refs)snaps.push(await tx.get(ref));const current=new Map();snaps.forEach((s,i)=>{if(s.exists){if(!core.validatePersonView(s.data(),affected[i]))throw Error('Person Prepared View 不正確，不覆寫');current.set(affected[i],s.data())}});
    const allIds=new Set([...people,...(previous?.participants||[]).map(p=>p.personId)]);const nextByPerson=new Map();for(const id of allIds){const cards=current.get(id)?.sessions||[];const prior=previous&&cards.find(x=>x.sessionId===session.id);if(previous&&!prior)throw Error('既有共同場次與 Person View 不一致');if(!previous&&cards.some(x=>x.sessionId===session.id))throw Error('Person View 已有孤兒場次');const view=core.applySessionToPersonView(id,current.get(id),session,(current.get(id)?.revision||0)+1);nextByPerson.set(id,view)}
    tx.set(src,session);for(const [id,view] of nextByPerson)tx.set(viewRef(id),view);return {sessionId:session.id,participants:people.length,viewsUpdated:affected.length};});}
  return Object.freeze({read,put});
 }
 const api=Object.freeze({createAdapter,COLLECTION,VIEW_COLLECTION});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JLYPlayHistoryStorage=api;
})(typeof window!=='undefined'?window:null);
