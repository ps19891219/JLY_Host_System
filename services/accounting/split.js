"use strict";

function text(value) { return String(value == null ? "" : value).trim(); }
function amount(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }

function createSplit(input = {}) {
  const personId = text(input.personId || input.memberId || input.playerId);
  if (!personId) throw new Error("split_person_required");
  const splitAmount = amount(input.amount);
  if (splitAmount < 0) throw new Error("split_amount_invalid");
  return {
    splitId: text(input.splitId) || `split-${personId}`,
    personId,
    displayName: text(input.displayName),
    amount: splitAmount,
    settlementStatus: text(input.settlementStatus) || "payment_due",
    paymentClaimedBy: text(input.paymentClaimedBy),
    paymentClaimedAt: text(input.paymentClaimedAt),
    confirmedBy: text(input.confirmedBy),
    confirmedAt: text(input.confirmedAt),
    rejectedBy: text(input.rejectedBy),
    rejectedAt: text(input.rejectedAt)
  };
}

function validateSplitTotal(splits, transactionAmount) {
  const list = Array.isArray(splits) ? splits.map(createSplit) : [];
  const total = list.reduce((sum, split) => sum + split.amount, 0);
  return { valid: list.length > 0 && total === amount(transactionAmount), total, expected: amount(transactionAmount), splits: list };
}

function buildEqualSplits(participants, transactionAmount) {
  const people = Array.isArray(participants) ? participants : [];
  if (!people.length) throw new Error("split_participants_required");
  const total = amount(transactionAmount);
  if (total <= 0) throw new Error("transaction_amount_invalid");
  const base = Math.floor(total / people.length);
  return people.map((person, index) => createSplit({
    personId: person.personId || person.memberId || person.playerId,
    displayName: person.displayName,
    amount: index === people.length - 1 ? total - base * (people.length - 1) : base
  }));
}

module.exports = { createSplit, validateSplitTotal, buildEqualSplits };
