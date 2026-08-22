(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JLYDelegatedPayment = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const MODEL = "delegated_payment_v1";
  const text = value => String(value == null ? "" : value).trim();
  const amount = value => {
    const result = Math.round(Number(value) || 0);
    if (result <= 0) throw new Error("delegated_payment_amount_invalid");
    return result;
  };
  const requireDifferent = (left, right, error) => {
    if (!left || !right || left === right) throw new Error(error);
  };

  function createRequest(input = {}, now = new Date().toISOString()) {
    const requestId = text(input.requestId);
    const activityId = text(input.activityId || input.carId);
    const debtorPersonId = text(input.debtorPersonId);
    const delegatePersonId = text(input.delegatePersonId);
    const receiverPersonId = text(input.receiverPersonId);
    const requestedBy = text(input.requestedBy);
    if (!requestId || !activityId || requestedBy !== debtorPersonId) throw new Error("delegated_payment_request_fields_required");
    requireDifferent(debtorPersonId, delegatePersonId, "delegated_payment_delegate_must_differ");
    requireDifferent(debtorPersonId, receiverPersonId, "delegated_payment_receiver_invalid");
    const value = amount(input.amount);
    return {
      requestId, activityId, carId: text(input.carId || activityId),
      debtorPersonId, delegatePersonId, receiverPersonId,
      amount: value, reimbursementRequired: input.reimbursementRequired === true,
      status: "pending_acceptance", requestedBy, createdAt: now, updatedAt: now,
      history: [{ action: "requested", actorPersonId: requestedBy, at: now }],
      schemaVersion: 1, delegationModel: MODEL
    };
  }

  function transitionRequest(request, action, actorPersonId, now = new Date().toISOString()) {
    const current = { ...(request || {}) };
    const actor = text(actorPersonId);
    if (current.status !== "pending_acceptance" || actor !== text(current.delegatePersonId)) throw new Error("delegated_payment_request_action_not_allowed");
    if (!['accept', 'reject'].includes(action)) throw new Error("delegated_payment_request_action_unknown");
    const status = action === "accept" ? "accepted" : "rejected";
    return { ...current, status, acceptedBy: action === "accept" ? actor : "", acceptedAt: action === "accept" ? now : "", rejectedBy: action === "reject" ? actor : "", rejectedAt: action === "reject" ? now : "", updatedAt: now, history: [...(current.history || []), { action: status, actorPersonId: actor, at: now }] };
  }

  function createClaim(input = {}, now = new Date().toISOString()) {
    const settlementId = text(input.settlementId);
    const activityId = text(input.activityId || input.carId);
    const debtorPersonId = text(input.debtorPersonId || input.fromPersonId);
    const paidBy = text(input.paidBy || input.actorPersonId);
    const receiverPersonId = text(input.receiverPersonId || input.toPersonId);
    if (!settlementId || !activityId || !debtorPersonId || !paidBy || !receiverPersonId) throw new Error("delegated_payment_claim_fields_required");
    requireDifferent(debtorPersonId, receiverPersonId, "delegated_payment_receiver_invalid");
    const value = amount(input.amount);
    return {
      settlementId, activityId, carId: text(input.carId || activityId),
      fromPersonId: debtorPersonId, toPersonId: receiverPersonId,
      debtorPersonId, paidBy, amount: value, status: "payment_claimed",
      paymentClaimedBy: paidBy, paymentClaimedAt: now,
      delegatedPayment: paidBy !== debtorPersonId,
      delegatedRequestId: text(input.delegatedRequestId),
      reimbursementRequired: input.reimbursementRequired === true,
      reimbursementCreated: false,
      responsibilityModel: "pairwise_v1", delegationModel: MODEL,
      createdAt: now, updatedAt: now,
      history: [{ action: "payment_claimed", actorPersonId: paidBy, debtorPersonId, authority: paidBy === debtorPersonId ? "self" : "delegated_payer", at: now }]
    };
  }

  function buildReimbursementObligation(settlement) {
    if (!settlement || settlement.status !== "settled" || settlement.reimbursementRequired !== true || settlement.reimbursementCreated === true) return null;
    const debtor = text(settlement.debtorPersonId || settlement.fromPersonId);
    const delegate = text(settlement.paidBy || settlement.paymentClaimedBy);
    if (!debtor || !delegate || debtor === delegate) return null;
    return {
      obligationId: `reimbursement-${text(settlement.settlementId)}`,
      sourceSettlementId: text(settlement.settlementId), sourceTransactionId: "",
      fromPersonId: debtor, toPersonId: delegate, amount: amount(settlement.amount),
      responsibilityModel: "pairwise_v1", obligationType: "reimbursement",
      affectsActivityExpense: false
    };
  }

  return { MODEL, createRequest, transitionRequest, createClaim, buildReimbursementObligation };
});
