"use strict";

function text(value) { return String(value == null ? "" : value).trim(); }
function normalizeName(value) { return text(value).toLowerCase().replace(/[\s・·._-]+/g, ""); }

function resolvePayerLabel(label, members) {
  const input = normalizeName(label);
  if (!input) return { status: "missing", matches: [] };
  const list = (members || []).filter(member => member && member.personId && member.displayName);
  const exact = list.filter(member => normalizeName(member.displayName) === input);
  if (exact.length === 1) return { status: "resolved", member: exact[0], matches: exact };
  if (exact.length > 1) return { status: "ambiguous", matches: exact };
  const similar = list.filter(member => {
    const name = normalizeName(member.displayName);
    return name.includes(input) || input.includes(name);
  });
  return similar.length === 1
    ? { status: "candidate", member: similar[0], matches: similar }
    : { status: similar.length ? "ambiguous" : "not_found", matches: similar };
}

function buildPendingEntry(input, now) {
  const amount = Number(input && input.amount);
  const draft = {
    draftId: text(input && input.draftId), activityId: text(input && (input.activityId || input.carId)),
    activityType: "script_car", villageType: "script", carId: text(input && input.carId),
    type: text(input && input.type) || "expense", title: text(input && (input.title || input.description)),
    amount, currency: "TWD", payerInput: text(input && input.payerInput), payerCandidateIds: (input && input.payerCandidateIds || []).map(text).filter(Boolean),
    createdBy: text(input && input.createdBy), source: text(input && input.source) || "line_group",
    sourceGroupId: text(input && input.sourceGroupId), sourceMessageId: text(input && input.sourceMessageId),
    status: "pending_identity", createdAt: now, updatedAt: now
  };
  if (!draft.draftId || !draft.carId || !draft.title || !Number.isSafeInteger(amount) || amount <= 0 || !draft.createdBy) throw new Error("pending_entry_invalid");
  return draft;
}

module.exports = { normalizeName, resolvePayerLabel, buildPendingEntry };
