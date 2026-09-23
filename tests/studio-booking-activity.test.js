const assert=require('assert');
const D=require('../js/modules/studio/studio-booking-activity.js');

const activity={id:'car-1',studioId:'studio-a',branchId:'b1',scriptId:'s1',gameDate:'2026-10-01',gameTime:'19:00',totalPeople:6,players:[{id:'p1'},{id:'p2'}],publicRecruitmentPreference:true,status:'open'};
assert.equal(D.vacancy(activity),4);
assert.equal(D.recruitmentVisible(activity),true);
assert.equal(D.recruitmentVisible({...activity,players:[1,2,3,4,5,6].map(id=>({id}))}),false);
assert.equal(D.recruitmentVisible({...activity,publicRecruitmentPreference:false}),false);

let plan=D.bookingAcceptancePlan({booking:{status:'pending',activityId:'car-1',studioId:'studio-a',branchId:'b1',scriptId:'s1',date:'2026-10-01',time:'19:00'},activity});
assert.equal(plan.action,'bind_existing_activity');
assert.equal(plan.createActivity,false);

plan=D.bookingAcceptancePlan({booking:{status:'pending',studioId:'studio-a',date:'2026-10-01',time:'19:00'}});
assert.equal(plan.action,'create_formal_activity');
assert.equal(plan.createActivity,true);

plan=D.bookingAcceptancePlan({booking:{status:'pending',activityId:'car-1',studioId:'studio-a',branchId:'b1',scriptId:'s1',date:'2026-10-02',time:'19:00'},activity});
assert.equal(plan.action,'needs_human_confirmation');
assert.deepEqual(plan.differences.map(x=>x.field),['gameDate']);

plan=D.studioChangePlan(activity,{...activity,gameTime:'20:00'});
assert.equal(plan.applyImmediately,false);
assert.equal(plan.pendingActionRequired,true);
assert.deepEqual(plan.fields,['gameTime']);

const cancelled=D.cancellationPlan(activity,{by:'studio-a',reason:'host request',at:'2026-09-21T10:00:00+08:00'});
assert.equal(cancelled.status,'cancelled');
assert.equal(cancelled.id,'car-1');
assert.equal(cancelled.players.length,2);

const pending=D.makePendingAction({type:'studio_activity_change',responsiblePersonId:'host-1',source:{studioId:'studio-a'},target:{activityId:'car-1'},createdAt:'2026-09-21T10:00:00+08:00'});
assert.equal(pending.status,'pending');
assert.equal(pending.responsiblePersonId,'host-1');
assert.equal(pending.responsibleStudioId,null);

console.log('studio-booking-activity domain contract ok');
