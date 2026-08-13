"use strict";

function text(value) { return String(value == null ? "" : value).trim(); }

function createPendingAction(input = {}) {
  const actionType = text(input.actionType);
  const responsiblePersonId = text(input.responsiblePersonId);
  const transactionId = text(input.transactionId);
  if (!actionType || !responsiblePersonId || !transactionId) throw new Error("pending_action_fields_required");
  return {
    pendingActionId: text(input.pendingActionId) || `${actionType}-${transactionId}-${text(input.splitId) || responsiblePersonId}`,
    actionType,
    responsiblePersonId,
    transactionId,
    splitId: text(input.splitId),
    activityId: text(input.activityId || input.carId),
    carId: text(input.carId || input.activityId),
    status: text(input.status) || "pending",
    createdAt: text(input.createdAt) || new Date().toISOString(),
    completedAt: text(input.completedAt)
  };
}

function buildPendingActions(transaction, accountingManagerPersonId) {
  const result = [];
  if (transaction.splitStatus === "pending") {
    result.push(createPendingAction({ actionType: "pending_split", responsiblePersonId: accountingManagerPersonId || transaction.createdBy, transactionId: transaction.transactionId, activityId: transaction.activityId, carId: transaction.carId, createdAt: transaction.updatedAt }));
    return result;
  }
  for (const split of (transaction.splits || [])) {
    if (split.personId === transaction.paidBy || split.settlementStatus === "settled") continue;
    const awaitingConfirmation = split.settlementStatus === "payment_claimed";
    result.push(createPendingAction({
      actionType: awaitingConfirmation ? "payment_confirmation" : split.settlementStatus === "settlement_rejected" ? "settlement_rejected" : "payment_due",
      responsiblePersonId: awaitingConfirmation ? transaction.paidBy : split.personId,
      transactionId: transaction.transactionId,
      splitId: split.splitId,
      activityId: transaction.activityId,
      carId: transaction.carId,
      createdAt: transaction.updatedAt
    }));
  }
  return result;
}

module.exports = { createPendingAction, buildPendingActions };
