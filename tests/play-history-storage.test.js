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
 console.log('Play-history storage: 9 checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
