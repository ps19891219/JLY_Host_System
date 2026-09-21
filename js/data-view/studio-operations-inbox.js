(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioOperationsInbox=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const txt=v=>String(v==null?'':v).trim(),arr=v=>Array.isArray(v)?v:[];
function item(x={},fallbackType='task'){return {id:txt(x.id),type:txt(x.type||fallbackType),status:txt(x.status||'pending'),title:txt(x.title),target:x.target||null,source:x.source||null,createdAt:x.createdAt||null,updatedAt:x.updatedAt||null};}
function build(studioId,prepared={}){const id=txt(studioId);if(!id)throw new Error('studio_id_required');const groups=[
 ['booking',prepared.bookings],['activity_change',prepared.activityChanges],['host_request',prepared.hostRequests],
 ['staff_confirmation',prepared.staffConfirmations],['staff_issue',prepared.staffIssues]
];const items=groups.flatMap(([type,rows])=>arr(rows).map(x=>item(x,type))).filter(x=>x.id&&['pending','adjustment_proposed','needs_action','declined','invalidated'].includes(x.status));items.sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));return {schemaVersion:1,viewType:'studio_operations_inbox',studioId:id,items,count:items.length};}
function apply(view,row){const r=item(row),next=arr(view&&view.items).filter(x=>x.id!==r.id);if(r.id&&['pending','adjustment_proposed','needs_action','declined','invalidated'].includes(r.status))next.push(r);next.sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));return {...view,items:next,count:next.length};}
return {build,apply};
});
