"use strict";
const bookingService=require("./studio-booking-activity-service");
const bookingRepo=require("../firebase/studio-booking-repository");
const pendingRepo=require("../firebase/pending-action-repository");
const txt=v=>String(v==null?"":v).trim(),actorId=a=>txt(a&& (a.personId||a.userId||a.uid));
async function execute(command={},actor={}){
 const c=txt(command.command);if(!c)throw new Error("studio_operation_command_required");
 if(c==="confirm_booking")return bookingService.confirmBooking(command.bookingId,{confirmedBy:actorId(actor)});
 if(c==="reject_booking")return bookingRepo.updateStatus(command.bookingId,"rejected",{rejectedBy:actorId(actor)||null,rejectionReason:txt(command.reason)||null,rejectedAt:new Date().toISOString()});
 if(c==="propose_booking_adjustment")return bookingRepo.updateStatus(command.bookingId,"adjustment_proposed",{proposedBy:actorId(actor)||null,proposedChanges:command.changes||{},proposalNote:txt(command.note)||null,proposedAt:new Date().toISOString()});
 if(c==="resolve_host_request"){const d=txt(command.decision);if(!["approve","reject"].includes(d))throw new Error("host_request_adjustment_requires_domain_proposal");return pendingRepo.resolve(command.pendingActionId,{status:d==="approve"?"accepted":"rejected",resolvedBy:actorId(actor)});}
 throw new Error("studio_operation_command_not_supported");
}
module.exports={execute};