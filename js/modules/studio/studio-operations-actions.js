(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioOperationsActions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const txt=v=>String(v==null?'':v).trim();
const BOOKING_ACTIONS=new Set(['accept','reject','propose_adjustment']);
const HOST_REQUEST_ACTIONS=new Set(['approve','reject','propose_adjustment']);
function requireId(v,name){const id=txt(v);if(!id)throw new Error(name+'_required');return id;}
function bookingCommand(task,action,payload={}){if(!task||task.type!=='booking')throw new Error('booking_task_required');if(!BOOKING_ACTIONS.has(action))throw new Error('invalid_booking_action');const bookingId=requireId(task.source&&task.source.bookingId,'booking_id');if(action==='accept')return{command:'confirm_booking',bookingId};if(action==='reject')return{command:'reject_booking',bookingId,reason:txt(payload.reason)};return{command:'propose_booking_adjustment',bookingId,changes:payload.changes||{},note:txt(payload.note)};}
function hostRequestCommand(task,action,payload={}){if(!task||task.type!=='host_request')throw new Error('host_request_task_required');if(!HOST_REQUEST_ACTIONS.has(action))throw new Error('invalid_host_request_action');const pendingActionId=requireId(String(task.id||'').replace(/^pending:/,''),'pending_action_id');return{command:'resolve_host_request',pendingActionId,decision:action,changes:payload.changes||{},note:txt(payload.note)};}
function staffIssueCommand(task,action,payload={}){if(!task||!['staff_issue','staff_confirmation'].includes(task.type))throw new Error('staff_task_required');if(!['invite_replacement','withdraw_tentative','open_schedule'].includes(action))throw new Error('invalid_staff_action');return{command:action,taskId:requireId(task.id,'task_id'),replacementPersonId:txt(payload.replacementPersonId)||null};}
return{bookingCommand,hostRequestCommand,staffIssueCommand};
});
