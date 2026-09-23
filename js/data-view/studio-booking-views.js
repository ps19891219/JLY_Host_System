(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioBookingViews=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const txt=v=>String(v==null?'':v).trim();
const arr=v=>Array.isArray(v)?v:[];
const activeStatuses=new Set(['pending','adjustment_proposed']);
function compactBooking(row={}){
 return {id:txt(row.id||row.bookingId),activityId:txt(row.activityId),studioId:txt(row.studioId||row.organizationId),branchId:txt(row.branchId),scriptId:txt(row.scriptId),scriptName:txt(row.scriptName),date:txt(row.date||row.gameDate),time:txt(row.time||row.gameTime),hostPersonId:txt(row.hostPersonId||row.ownerId),status:txt(row.status||'pending'),updatedAt:row.updatedAt||null,createdAt:row.createdAt||null};
}
function buildInboxView(studioId,rows=[]){
 const id=txt(studioId);if(!id)throw new Error('studio_id_required');
 const bookings=arr(rows).map(compactBooking).filter(x=>x.id&&x.studioId===id&&activeStatuses.has(x.status));
 return {schemaVersion:1,viewType:'studio_booking_inbox',studioId:id,bookings,count:bookings.length,builtAt:new Date().toISOString()};
}
function compactRecruitment(activity={},domain){
 return {activityId:txt(activity.id||activity.activityId),studioId:txt(activity.studioId||activity.organizationId),scriptName:txt(activity.scriptName||activity.title),gameDate:txt(activity.gameDate||activity.date),gameTime:txt(activity.gameTime||activity.time),status:txt(activity.status),publicRecruitmentPreference:activity.publicRecruitmentPreference===true,vacancy:domain&&typeof domain.vacancy==="function"?domain.vacancy(activity):Math.max(0,Number(activity.totalPeople||activity.capacity||0)-arr(activity.players).length),seatSummary:activity.seatSummary||null,totalPeople:Number(activity.totalPeople||activity.capacity||0),players:arr(activity.players).map(p=>({playerId:txt(p&&p.playerId||p&&p.id),status:txt(p&&p.status)}))};
}
function buildRecruitmentView(studioId,activities=[],domain){
 const id=txt(studioId);if(!id)throw new Error('studio_id_required');if(!domain||typeof domain.recruitmentVisible!=='function')throw new Error('studio_booking_domain_required');
 const items=arr(activities).filter(a=>txt(a&&a.studioId||a&&a.organizationId)===id&&domain.recruitmentVisible(a)).map(a=>compactRecruitment(a,domain));
 return {schemaVersion:1,viewType:'studio_recruitment',studioId:id,activities:items,count:items.length,builtAt:new Date().toISOString()};
}
function applyById(view,key,row,include){
 const list=arr(view&&view[key]);const id=txt(row&&row.id||row&&row.bookingId||row&&row.activityId);const next=list.filter(x=>txt(x.id||x.bookingId||x.activityId)!==id);if(include)next.push(row);return {...view,[key]:next,count:next.length,builtAt:new Date().toISOString()};
}
function applyBookingMutation(view,booking){const row=compactBooking(booking);return applyById(view,'bookings',row,!!row.id&&row.studioId===txt(view&&view.studioId)&&activeStatuses.has(row.status));}
function applyRecruitmentMutation(view,activity,domain){const row=compactRecruitment(activity,domain);return applyById(view,'activities',row,!!row.activityId&&row.studioId===txt(view&&view.studioId)&&domain.recruitmentVisible(activity));}
return {compactBooking,buildInboxView,compactRecruitment,buildRecruitmentView,applyBookingMutation,applyRecruitmentMutation};
});