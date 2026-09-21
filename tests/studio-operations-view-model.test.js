const assert=require('assert');const VM=require('../js/modules/studio/studio-operations-view-model.js');
const rows=[{id:'b',type:'booking',status:'pending'},{id:'h',type:'host_request',status:'needs_action'},{id:'s',type:'staff_issue',status:'declined'},{id:'done',type:'booking',status:'resolved'}];
const s=VM.summary(rows);assert.deepEqual(s,{total:3,booking:1,activity:1,staff:1,recruitment:0,other:0});
const g=VM.group(rows);assert.equal(g.booking[0].title,'新訂場待處理');assert.equal(g.activity[0].id,'h');console.log('studio operations view model ok');