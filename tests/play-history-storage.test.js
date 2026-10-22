// Run: node tests/play-history-storage.test.js
'use strict';
const assert=require('node:assert/strict');
const core=require('../js/data-view/play-history-core.js');
const {createAdapter}=require('../js/data-view/play-history-storage.js');
function fakeDb(){
 const docs=new Map(),writes=[];
 const ref=path=>({path,get:async()=>snap(path),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})});
 const snap=path=>({exists:docs.has(path),data:()=>structuredClone(docs.get(path))});
 return {docs,writes,collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async callback=>{
   const pending=[];
   const tx={get:async r=>snap(r.path),set:(r,v)=>pending.push(['set',r.path,structuredClone(v)]),delete:r=>pending.push(['delete',r.path])};
   const result=await callback(tx);
   for(const [op,path,value] of pending){if(op==='set')docs.set(path,value);else docs.delete(path)}
   writes.push(pending);
   return result;
 }};
}
(async()=>{
 const db=fakeDb(),adapter=createAdapter({db,core,authorize:async id=>id==='player12345'});
 const a={id:'r123456789',name:'重刷劇本',date:'2026-10-21',roster:[]};
 await assert.rejects(adapter.put('otherPlayer',a),/授權/);
 assert.equal(db.docs.size,0);
 await adapter.put('player12345',a);
 await adapter.put('player12345',{...a,id:'r987654321'});
 let view=await adapter.read('player12345');
 assert.equal(view.total,2);
 assert.equal(db.writes.length,2);
 assert.equal(db.writes[0].length,2,'單次交易寫入 Source 和 Prepared View');
 await assert.rejects(adapter.put('player12345',{...a,id:'bad'}),/ID/);
 assert.equal((await adapter.read('player12345')).total,2);
 await adapter.remove('player12345',a.id);
 view=await adapter.read('player12345');
 assert.equal(view.total,1);
 assert.equal(db.docs.has('playHistorySessions/player12345/sessions/'+a.id),false);
 assert.equal(db.writes[2].length,2,'刪除交易同步移除 Source 和更新 Prepared View');
 const brokenDb=fakeDb(),broken=createAdapter({db:brokenDb,core,authorize:async()=>true});
 brokenDb.docs.set('playHistorySessions/player12345/sessions/'+a.id,core.prepareSession(a));
 await assert.rejects(broken.put('player12345',a),/不一致/);
 assert.equal(brokenDb.writes.length,0,'來源孤兒資料不得被靜默覆寫');
 brokenDb.docs.clear();
 brokenDb.docs.set('playHistoryViews/player12345',core.buildReadView('player12345',[a],1));
 await assert.rejects(broken.remove('player12345',a.id),/來源缺失/);
 assert.equal(brokenDb.writes.length,0,'來源缺失不得刪除快照');
 const batchDb=fakeDb(),batch=createAdapter({db:batchDb,core,authorize:async()=>true});
 const items=[a,{...a,id:'r987654321'}];
 const preview=await batch.importBatch('player12345',items);
 assert.equal(preview.dryRun,true);
 assert.equal(preview.added,2);
 assert.equal(batchDb.docs.size,0,'dry-run 不得寫入資料');
 const imported=await batch.importBatch('player12345',items,{dryRun:false});
 assert.equal(imported.added,2);
 assert.equal(batchDb.writes[0].length,3,'整批兩場與快照同筆交易');
 await assert.rejects(batch.importBatch('player12345',items,{dryRun:false}),/相同場次 ID/);
 assert.equal(batchDb.docs.size,3,'重複匯入不得部分寫入');
 await assert.rejects(batch.importBatch('player12345',[a,a]),/重複場次 ID/);
 const divergentDb=fakeDb(),divergent=createAdapter({db:divergentDb,core,authorize:async()=>true});
 const session=core.prepareSession(a);
 divergentDb.docs.set('playHistorySessions/player12345/sessions/'+a.id,{...session,name:'被外部更改'});
 divergentDb.docs.set('playHistoryViews/player12345',core.buildReadView('player12345',[a],1));
 await assert.rejects(divergent.put('player12345',a),/內容與 Prepared View 不一致/);
 await assert.rejects(divergent.remove('player12345',a.id),/內容與 Prepared View 不一致/);
 assert.equal(divergentDb.writes.length,0,'內容不一致時不得寫入');
 await assert.rejects(batch.importBatch('player12345',[],{dryRun:false}),/沒有可匯入/);
 console.log('Play-history storage: 20 checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
