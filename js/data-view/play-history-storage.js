/* JLY Play History storage adapter. Dormant until server rules and identity binding are verified. */
(function(root){
'use strict';
const COLLECTION='playHistorySessions', VIEW_COLLECTION='playHistoryViews';
function createAdapter({db,core,authorize}={}){
  if(!db||typeof db.runTransaction!=='function'||!core||typeof core.buildReadView!=='function'||typeof authorize!=='function')throw Error('缺少資料庫、資料驗證或正式授權程序');
  const check=async viewerId=>{
    const result=await authorize(viewerId);
    if(result!==true)throw Error('未通過正式玩家授權，拒絕存取遊玩紀錄');
  };
  function refs(viewerId,id){
    // Sessions are nested under viewer. The index is one read per viewer.
    return {
      view:db.collection(VIEW_COLLECTION).doc(viewerId),
      session:id?db.collection(COLLECTION).doc(viewerId).collection('sessions').doc(id):null
    };
  }
  async function read(viewerId){
    await check(viewerId);
    const snapshot=await refs(viewerId).view.get();
    if(!snapshot.exists)return null;
    const value=snapshot.data();
    if(!core.validateReadView(value,viewerId))throw Error('遊玩紀錄快照版本或玩家身分不正確');
    return value;
  }
  async function put(viewerId,record){
    await check(viewerId);
    const session=core.prepareSession(record);
    const {view,session:source}=refs(viewerId,session.id);
    return db.runTransaction(async tx=>{
      const current=await tx.get(view);
      const sourceCurrent=await tx.get(source);
      const previous=current.exists?current.data():null;
      if(previous&&!core.validateReadView(previous,viewerId))throw Error('遊玩紀錄快照不正確，停止覆寫');
      const entries=previous?previous.sessions.slice():[];
      const index=entries.findIndex(x=>x.id===session.id);
      if((index>=0)!==sourceCurrent.exists)throw Error('場次來源與 Prepared View 不一致，停止覆寫並等待修復');
      if(index>=0){
        const actual=sourceCurrent.data();
        if(JSON.stringify(actual)!==JSON.stringify(entries[index]))throw Error('場次來源內容與 Prepared View 不一致，停止覆寫');
        entries[index]=session;
      }else entries.push(session);
      const next=core.buildReadView(viewerId,entries,(previous?.revision||0)+1);
      // Both documents are written in the same Firestore transaction.
      tx.set(source,session);
      tx.set(view,next);
      return {id:session.id,revision:next.revision,total:next.total};
    });
  }
  async function remove(viewerId,id){
    await check(viewerId);
    if(!/^r[a-z0-9]{8,40}$/i.test(String(id)))throw Error('場次 ID 不正確');
    const {view,session:source}=refs(viewerId,id);
    return db.runTransaction(async tx=>{
      const current=await tx.get(view);
      const sourceCurrent=await tx.get(source);
      if(!current.exists)throw Error('遊玩紀錄快照不存在，停止刪除');
      const previous=current.data();
      if(!core.validateReadView(previous,viewerId))throw Error('遊玩紀錄快照不正確，停止刪除');
      if(!previous.sessions.some(x=>x.id===id))throw Error('找不到要刪除的場次');
      if(!sourceCurrent.exists)throw Error('場次來源缺失，停止刪除並等待修復');
      const indexed=previous.sessions.find(x=>x.id===id);
      if(JSON.stringify(sourceCurrent.data())!==JSON.stringify(indexed))throw Error('場次來源內容與 Prepared View 不一致，停止刪除');
      const next=core.buildReadView(viewerId,previous.sessions.filter(x=>x.id!==id),(previous.revision||0)+1);
      tx.delete(source);
      tx.set(view,next);
      return {id,revision:next.revision,total:next.total};
    });
  }
  async function importBatch(viewerId,records,{dryRun=true}={}){
    await check(viewerId);
    if(!Array.isArray(records)||records.length>100)throw Error('每批最多匯入 100 場');
    const sessions=records.map(core.prepareSession),ids=new Set();
    for(const session of sessions){
      if(ids.has(session.id))throw Error('同批次有重複場次 ID，已取消匯入');
      ids.add(session.id);
    }
    const view=refs(viewerId).view;
    return db.runTransaction(async tx=>{
      const current=await tx.get(view);
      const previous=current.exists?current.data():null;
      if(previous&&!core.validateReadView(previous,viewerId))throw Error('遊玩紀錄快照不正確，停止匯入');
      // Firestore requires all reads before any transaction writes.
      const sourceRefs=sessions.map(s=>refs(viewerId,s.id).session);
      const sourceSnapshots=await Promise.all(sourceRefs.map(ref=>tx.get(ref)));
      const existing=previous?previous.sessions.slice():[];
      const known=new Set(existing.map(s=>s.id));
      for(let i=0;i<sessions.length;i++){
        if(known.has(sessions[i].id)||sourceSnapshots[i].exists)throw Error('正式資料已有相同場次 ID，停止整批匯入');
      }
      if(sessions.length===0)throw Error('沒有可匯入的場次');
      const next=core.buildReadView(viewerId,existing.concat(sessions),(previous?.revision||0)+1);
      const report={dryRun:!!dryRun,added:sessions.length,total:next.total,revision:next.revision};
      if(dryRun)return report;
      for(let i=0;i<sessions.length;i++)tx.set(sourceRefs[i],sessions[i]);
      tx.set(view,next);
      return report;
    });
  }
  return Object.freeze({read,put,remove,importBatch});
}
const api=Object.freeze({createAdapter,COLLECTION,VIEW_COLLECTION});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.JLYPlayHistoryStorage=api;
})(typeof window!=='undefined'?window:null);
