"use strict";
const bookingService=require("./studio-booking-activity-service");
const bookingRepo=require("../firebase/studio-booking-repository");
const pendingRepo=require("../firebase/pending-action-repository");
const lifecycle=require("./studio-activity-lifecycle-service");
const txt=v=>String(v==null?"":v).trim(),actorId=a=>txt(a&& (a.personId||a.userId||a.uid));
async function execute(command={},actor={}){
 const c=txt(command.command);if(!c)throw new Error("studio_operation_command_required");
 if(c==="confirm_booking")return bookingService.confirmBooking(command.bookingId,{confirmedBy:actorId(actor)});
 if(c==="reject_booking")return bookingRepo.updateStatus(command.bookingId,"rejected",{rejectedBy:actorId(actor)||null,rejectionReason:txt(command.reason)||null,rejectedAt:new Date().toISOString()});
 if(c==="propose_booking_adjustment")return bookingRepo.updateStatus(command.bookingId,"adjustment_proposed",{proposedBy:actorId(actor)||null,proposedChanges:command.changes||{},proposalNote:txt(command.note)||null,proposedAt:new Date().toISOString()});
 if(c==="resolve_host_request"){const d=txt(command.decision);if(!["approve","reject"].includes(d))throw new Error("host_request_adjustment_requires_domain_proposal");const action=await pendingRepo.get(command.pendingActionId);if(!action||action.status!=="pending")throw new Error("host_request_not_available");if(d==="reject")return pendingRepo.resolve(command.pendingActionId,{status:"rejected",resolvedBy:actorId(actor)});if(action.type==="host_request_cancellation")return lifecycle.approveCancellation(command.pendingActionId,{actorId:actorId(actor),reason:txt(command.reason)});if(action.type==="host_request_reschedule")throw new Error("host_request_reschedule_requires_activity_change_command");throw new Error("host_request_type_unsupported");}
 throw new Error("studio_operation_command_not_supported");
}
module.exports={execute};