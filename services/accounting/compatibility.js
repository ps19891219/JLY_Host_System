"use strict";

const { createTransaction } = require("./transaction");

function text(value) { return String(value == null ? "" : value).trim(); }

function mapLegacySplit(share = {}) {
  return {
    splitId: text(share.splitId),
    personId: text(share.personId || share.memberId || share.playerId),
    displayName: text(share.displayName || share.memberName),
    amount: Number(share.amount) || 0,
    settlementStatus: text(share.settlementStatus) || "payment_due",
    paymentClaimedBy: text(share.paymentClaimedBy),
    paymentClaimedAt: text(share.paymentClaimedAt),
    confirmedBy: text(share.confirmedBy),
    confirmedAt: text(share.confirmedAt)
  };
}

function inspectLegacyIdentity(entry = {}) {
  const missingFields = [];
  if (!text(entry.createdBy || entry.actorMemberId)) missingFields.push("createdBy");
  if (!text(entry.paidBy || entry.payerMemberId)) missingFields.push("paidBy");
  const shares = Array.isArray(entry.splits || entry.shares) ? (entry.splits || entry.shares) : [];
  if (shares.some(share => !text(share.personId || share.memberId || share.playerId))) missingFields.push("split.personId");
  return { resolvable: missingFields.length === 0, missingFields };
}

function upgradeLegacyEntry(entry = {}, context = {}) {
  const identity = inspectLegacyIdentity(entry);
  if (!identity.resolvable) {
    return {
      status: "identity_resolution_required",
      missingFields: identity.missingFields,
      transactionId: text(entry.transactionId || entry.id || entry.entryId || entry.messageId),
      legacyEntry: { ...entry }
    };
  }
  const transaction = createTransaction({
    ...entry,
    transactionId: entry.transactionId || entry.id || entry.entryId || entry.messageId,
    activityId: entry.activityId || entry.carId || context.carId,
    activityType: entry.activityType || context.activityType || "car",
    villageType: entry.villageType || context.villageType || "script_village",
    carId: entry.carId || context.carId,
    title: entry.title || entry.description,
    createdBy: entry.createdBy || entry.actorMemberId,
    paidBy: entry.paidBy || entry.payerMemberId,
    splits: (entry.splits || entry.shares || []).map(mapLegacySplit),
    note: entry.note || ""
  });
  return { status: "ready", transaction };
}

function toLegacyAccountingAliases(transaction) {
  return {
    entryId: transaction.transactionId,
    messageId: transaction.transactionId,
    description: transaction.title,
    actorMemberId: transaction.createdBy,
    payerMemberId: transaction.paidBy,
    shares: transaction.splits.map(split => ({
      splitId: split.splitId,
      memberId: split.personId,
      displayName: split.displayName,
      amount: split.amount,
      settlementStatus: split.settlementStatus,
      paymentClaimedBy: split.paymentClaimedBy,
      paymentClaimedAt: split.paymentClaimedAt,
      confirmedBy: split.confirmedBy,
      confirmedAt: split.confirmedAt
    }))
  };
}

module.exports = { mapLegacySplit, inspectLegacyIdentity, upgradeLegacyEntry, toLegacyAccountingAliases };
