"use strict";

const { buildPendingEntry, resolvePayerLabel } = require("../accounting/pending-entry");
const { saveAccountingDraft } = require("../firebase/accounting-draft-repository");
const { createRepository } = require("../firebase/activity-accounting-repository");

function member(item, role) {
  const source = item && typeof item === "object" ? item : {}, nested = source.memberSnapshot || source.member || source.player || {};
  const personId = String(source.personId || source.memberId || source.playerId || source.profileId || source.id || nested.personId || nested.memberId || nested.playerId || nested.profileId || nested.id || "").trim();
  const displayName = String(source.displayName || source.playerName || source.name || source.nickname || nested.displayName || nested.playerName || nested.name || nested.nickname || "").trim();
  return personId ? { personId, displayName, role } : null;
}

function collectMembers(car) {
  const list = [], seen = new Set(), add = value => { if (value && !seen.has(value.personId)) { seen.add(value.personId); list.push(value); } };
  add(member({ personId: car && car.ownerId, memberId: car && car.ownerMemberId, displayName: car && car.ownerName }, "owner"));
  (Array.isArray(car && car.players) ? car.players : []).filter(item => item && item.status !== "cancelled").forEach(item => add(member(item, "player")));
  (Array.isArray(car && car.staffSlots) ? car.staffSlots : []).forEach(item => add(member(item, "staff")));
  return list;
}

async function prepareQuickAccounting(context, command, car, authority, dependencies = {}) {
  const members = collectMembers(car), actorId = String(authority && authority.playerId || "").trim();
  if (!actorId) return { saved: false, reason: "identity_required" };
  const payerInput = String(command.payerInput || "").trim();
  const resolution = payerInput ? resolvePayerLabel(payerInput, members) : { status: "resolved", member: members.find(item => item.personId === actorId), matches: [] };
  if (resolution.status === "resolved" && resolution.member) {
    if (payerInput && resolution.member.personId !== actorId && !(authority && authority.canManageAll)) return { saved: false, reason: "payer_permission_denied" };
    return { saved: false, reason: "payer_resolved", payer: resolution.member, members };
  }
  if (!(authority && authority.canManageAll)) return { saved: false, reason: "payer_permission_denied" };
  const now = new Date(Number(context.timestamp) || Date.now()).toISOString(), draftId = `line-${context.message.id}`;
  const draft = buildPendingEntry({ draftId, carId: context.accountingCarId, title: command.title, amount: command.amount, type: command.type, payerInput, payerCandidateIds: resolution.matches.map(item => item.personId), createdBy: actorId, sourceGroupId: context.source.groupId, sourceMessageId: context.message.id }, now);
  await (dependencies.saveAccountingDraft || saveAccountingDraft)(draft);
  return { saved: true, reason: "pending_identity", draft, resolution };
}

async function saveResolvedQuickAccounting(context, command, payer, car, authority, dependencies = {}) {
  const now = new Date(Number(context.timestamp) || Date.now()).toISOString();
  const repository = dependencies.repository || createRepository();
  return repository.saveTransaction({
    transactionId: `line-${context.message.id}`, activityId: context.accountingCarId, activityType: "car", villageType: "script_village", carId: context.accountingCarId,
    type: command.type || "expense", title: command.title, amount: command.amount, currency: "TWD",
    createdBy: authority.playerId, paidBy: payer.personId, participants: [], splits: [], splitStatus: "pending", settlementStatus: "pending",
    source: "line_group", note: `LINE group ${context.source.groupId}`, createdAt: now, updatedAt: now
  }, { accountingManagerPersonId: String(car && car.ownerId || authority.playerId) });
}

module.exports = { collectMembers, prepareQuickAccounting, saveResolvedQuickAccounting };
