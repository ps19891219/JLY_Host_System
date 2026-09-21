const assert=require('assert'),A=require('../js/modules/studio/studio-operations-actions.js');
const b={id:'booking:b1',type:'booking',source:{bookingId:'b1'}};assert.deepEqual(A.bookingCommand(b,'accept'),{command:'confirm_booking',bookingId:'b1'});assert.equal(A.bookingCommand(b,'reject',{reason:'滿場'}).reason,'滿場');
const h={id:'pending:p1',type:'host_request'};assert.equal(A.hostRequestCommand(h,'approve').pendingActionId,'p1');
assert.throws(()=>A.bookingCommand(b,'delete'));console.log('studio operations actions ok');