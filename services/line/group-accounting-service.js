/*
JLY Host System

Module:
LINE Group Accounting Service V1
*/

"use strict";

const {
  saveGroupAccountingEntry
} = require(
  "../firebase/line-group-accounting-repository"
);

function timestampToIso(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
}

async function recordGroupAccounting(
  context,
  command,
  dependencies = {}
) {
  const saveEntry =
    dependencies.saveGroupAccountingEntry ||
    saveGroupAccountingEntry;

  if (
    !context ||
    context.source.type !== "group" ||
    !context.source.groupId
  ) {
    return {
      saved: false,
      reason: "group_required"
    };
  }

  const entry = await saveEntry({
    groupId: context.source.groupId,
    messageId: context.message.id,
    userId: context.source.userId,
    type: command.type,
    amount: command.amount,
    description: command.description,
    createdAt: timestampToIso(context.timestamp)
  });

  return {
    saved: true,
    reason: "accounting_saved",
    entry
  };
}

module.exports = {
  recordGroupAccounting,
  timestampToIso
};
