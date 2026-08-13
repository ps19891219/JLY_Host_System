"use strict";

const { createSplit, validateSplitTotal } = require("./split");
const { getTransactionSettlementStatus } = require("./settlement");

function text(value) { return String(value == null ? "" : value).trim(); }
function positiveAmount(value) { const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw new Error("transaction_amount_invalid"); return number; }

function createTransaction(input = {}) {
  const transactionId = text(input.transactionId || input.entryId || input.messageId);
  const activityId = text(input.activityId || input.carId);
  const createdBy = text(input.createdBy || input.actorMemberId);
  const paidBy = text(input.paidBy || input.payerMemberId || createdBy);
  const title = text(input.title || input.description);
  if (!transactionId || !activityId || !createdBy || !paidBy || !title) throw new Error("transaction_fields_required");
  const splits = Array.isArray(input.splits || input.shares) ? (input.splits || input.shares).map(createSplit).map(split => (
    split.personId === paidBy && split.settlementStatus === "payment_due"
      ? { ...split, settlementStatus: "settled", confirmedBy: paidBy, confirmedAt: text(input.createdAt || input.updatedAt) || new Date().toISOString() }
      : split
  )) : [];
  const splitStatus = text(input.splitStatus) || (splits.length ? "completed" : "pending");
  if (splitStatus === "completed" && !validateSplitTotal(splits, input.amount).valid) throw new Error("split_total_mismatch");
  const now = text(input.updatedAt || input.createdAt) || new Date().toISOString();
  return {
    transactionId,
    activityId,
    activityType: text(input.activityType) || "car",
    villageType: text(input.villageType) || "script_village",
    carId: text(input.carId) || activityId,
    type: input.type === "income" ? "income" : "expense",
    title,
    category: text(input.category) || "uncategorized",
    amount: positiveAmount(input.amount),
    currency: text(input.currency) || "TWD",
    createdBy,
    paidBy,
    participants: Array.isArray(input.participants) ? input.participants.map(text).filter(Boolean) : splits.map(split => split.personId),
    splits,
    splitStatus,
    settlementStatus: splitStatus === "completed" ? getTransactionSettlementStatus(splits) : "pending",
    note: text(input.note),
    source: text(input.source) || "jly_activity",
    status: text(input.status) || "active",
    createdAt: text(input.createdAt) || now,
    updatedAt: now
  };
}

module.exports = { createTransaction };
