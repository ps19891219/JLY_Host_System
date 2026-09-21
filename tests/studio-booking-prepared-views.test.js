const assert=require('assert');const D=require('../js/modules/studio/studio-booking-activity.js');const V=require('../js/data-view/studio-booking-views.js');
let inbox=V.buildInboxView('s1',[{id:'b1',studioId:'s1',status:'pending'},{id:'b2',studioId:'s2',status:'pending'},{id:'b3',studioId:'s1',status:'accepted'}]);assert.equal(inbox.count,1);assert.equal(inbox.bookings[0].id,'b1');
inbox=V.applyBookingMutation(inbox,{id:'b1',studioId:'s1',status:'accepted'});assert.equal(inbox.count,0);
inbox=V.applyBookingMutation(inbox,{id:'b4',studioId:'s1',status:'adjustment_proposed'});assert.equal(inbox.count,1);
const a={id:'a1',studioId:'s1',status:'open',totalPeople:3,players:[{id:'p1'}],publicRecruitmentPreference:true};let recruit=V.buildRecruitmentView('s1',[a,{...a,id:'a2',studioId:'s2'}],D);assert.equal(recruit.count,1);assert.equal(recruit.activities[0].activityId,'a1');
recruit=V.applyRecruitmentMutation(recruit,{...a,players:[{id:'p1'},{id:'p2'},{id:'p3'}]},D);assert.equal(recruit.count,0);
recruit=V.applyRecruitmentMutation(recruit,{...a,publicRecruitmentPreference:false},D);assert.equal(recruit.count,0);
console.log('studio booking prepared views ok');