"use strict";

const { createSplit } = require("./split");

function text(value) { return String(value == null ? "" : value).trim(); }

function claimPayment(split, actorPersonId, now = new Date().toISOString()) {
  const current = createSplit(split);
  const actor = text(actorPersonId);
  if (current.personId !== actor) throw new Error("payment_claim_actor_mismatch");
  if (!["payment_due", "settlement_rejected"].includes(current.settlementStatus)) throw new Error("payment_claim_invalid_status");
  return { ...current, settlementStatus: "payment_claimed", paymentClaimedBy: actor, paymentClaimedAt: now, rejectedBy: "", rejectedAt: "" };
}

function withdrawPaymentClaim(split, actorPersonId) {
  const current = createSplit(split);
  const actor = text(actorPersonId);
  if (current.settlementStatus !== "payment_claimed" || current.paymentClaimedBy !== actor) throw new Error("payment_withdraw_not_allowed");
  return { ...current, settlementStatus: "payment_due", paymentClaimedBy: "", paymentClaimedAt: "" };
}

function confirmPayment(split, receiverPersonId, expectedReceiverPersonId, now = new Date().toISOString()) {
  const current = createSplit(split);
  const actor = text(receiverPersonId);
  if (!actor || actor !== text(expectedReceiverPersonId)) throw new Error("payment_confirmation_receiver_required");
  if (current.settlementStatus !== "payment_claimed") throw new Error("payment_confirmation_invalid_status");
  return { ...current, settlementStatus: "settled", confirmedBy: actor, confirmedAt: now };
}

function rejectPaymentClaim(split, receiverPersonId, expectedReceiverPersonId, now = new Date().toISOString()) {
  const current = createSplit(split);
  const actor = text(receiverPersonId);
  if (!actor || actor !== text(expectedReceiverPersonId)) throw new Error("payment_rejection_receiver_required");
  if (current.settlementStatus !== "payment_claimed") throw new Error("payment_rejection_invalid_status");
  return { ...current, settlementStatus: "settlement_rejected", rejectedBy: actor, rejectedAt: now, confirmedBy: "", confirmedAt: "" };
}

function getTransactionSettlementStatus(splits) {
  const list = Array.isArray(splits) ? splits : [];
  return list.length > 0 && list.every(split => split.settlementStatus === "settled") ? "settled" : "pending";
}

module.exports = { claimPayment, withdrawPaymentClaim, confirmPayment, rejectPaymentClaim, getTransactionSettlementStatus };
