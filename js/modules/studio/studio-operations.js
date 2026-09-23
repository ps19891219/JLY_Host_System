(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioOperations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';

const ACTION=Object.freeze({
 VIEW_BOOKINGS:'booking.view',
 MANAGE_BOOKINGS:'booking.manage',
 VIEW_ACTIVITIES:'activity.view',
 PROPOSE_ACTIVITY_CHANGE:'activity.change.propose',
 RESOLVE_HOST_REQUEST:'activity.host_request.resolve',
 VIEW_STAFF_SCHEDULE:'staff_schedule.view',
 MANAGE_STAFF_ASSIGNMENT:'staff_assignment.manage',
 VIEW_PLAYERS:'activity_players.view',
 EDIT_PLAYER_ACTIVITY_LABEL:'activity_players.label.edit',
 MANAGE_RECRUITMENT:'recruitment.manage',
 MANAGE_STUDIO:'studio.manage'
});
const FEATURE=Object.freeze({LINE_PROACTIVE_NOTIFICATION:'notification.line.proactive'});
const txt=v=>String(v==null?'':v).trim();
const list=v=>Array.isArray(v)?v.map(txt).filter(Boolean):[];
function permissionSet(membership={}){
 const raw=[...list(membership.permissions),...list(membership.effectivePermissions)],p=new Set();
 for(const x of raw){p.add(x);p.add(x.replace(/:/g,'.'));}
 const roles=new Set(list(membership.roles||membership.roleIds));
 if(roles.has('owner')||roles.has('manager')){[ACTION.MANAGE_BOOKINGS,ACTION.VIEW_BOOKINGS,ACTION.VIEW_ACTIVITIES,ACTION.RESOLVE_HOST_REQUEST,ACTION.VIEW_STAFF_SCHEDULE,ACTION.MANAGE_STAFF_ASSIGNMENT,ACTION.VIEW_PLAYERS,ACTION.MANAGE_RECRUITMENT,ACTION.MANAGE_STUDIO].forEach(x=>p.add(x));}
 return p;
}
function can(membership,action){if(!membership||txt(membership.status||'active')!=='active')return false;const p=permissionSet(membership);return p.has('*')||p.has(ACTION.MANAGE_STUDIO)||p.has(txt(action));}
function featureEnabled(studio={},feature){const enabled=new Set([...list(studio.enabledFeatures),...list(studio.features)]);return enabled.has(txt(feature));}
function lineProactiveAllowed(studio={},membership={}){return featureEnabled(studio,FEATURE.LINE_PROACTIVE_NOTIFICATION)&&can(membership,ACTION.MANAGE_STUDIO);}
function operationScope(membership={}){return {studioId:txt(membership.studioId||membership.organizationId),personId:txt(membership.personId),roles:list(membership.roles||membership.roleIds),permissions:[...permissionSet(membership)]};}
return {ACTION,FEATURE,permissionSet,can,featureEnabled,lineProactiveAllowed,operationScope};
});
