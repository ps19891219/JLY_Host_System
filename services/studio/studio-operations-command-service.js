"use strict";
const bookingService=require("./studio-booking-activity-service");
const bookingRepo=require("../firebase/studio-booking-repository");
const pendingRepo=require("../firebase/pending-action-repository");
const txt=v=>String(v==null?"":v).trim();
function actorId(actor={}){return txt(actor.personId||actor.userId||actor.uid)}
async function execute(command={},actor={}){
 const c=txt(command.command);if(!c)throw new Error("studio_operation_command_required");
 if(c==="confirm_booking")return bookingService.confirmBooking(command.bookingId,{confirmedBy:actorId(actor)});
 if(c==="reject_booking"){const id=txt(command.bookingId);if(!id)throw new Error("booking_id_required");return bookingRepo.updateStatus(id,"rejected",{rejectedBy:actorId(actor)||null,rejectionReason:txt(command.reason)||null,rejectedAt:new Date().toISOString()});}
 if(c==="propose_booking_adjustment"){const id=txt(command.bookingId);if(!id)throw new Error("booking_id_required");return bookingRepo.updateStatus(id,"adjustment_proposed",{proposedBy:actorId(actor)||null,proposedChanges:command.changes||{},proposalNote:txt(command.note)||null,proposedAt:new Date().toISOString()});}
 if(c==="resolve_host_request"){const id=txt(command.pendingActionId);if(!id)throw new Error("pending_action_id_required");const decision=txt(command.decision);if(!["approve","reject","propose_adjustment"].includes(decision))throw new Error("host_request_decision_invalid");if(decision==="propose_adjustment")return pendingRepo.resolveWithProposal(id,{resolvedBy:actorId(actor),changes:command.changes||{},note:txt(command.note)});return pendingRepo.resolve(id,{status:decision==="approve"?"accepted":"rejected",resolvedBy:actorId(actor)});}
 throw new Error("studio_operation_command_not_supported");
}
module.exports={execute};
