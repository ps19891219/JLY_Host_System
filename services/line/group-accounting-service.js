/*
JLY Host System

Module:
LINE Group Accounting Service V1
*/

"use strict";

const {
  saveGroupAccountingEntry,
  listGroupAccountingEntries
} = require(
  "../firebase/line-group-accounting-repository"
);

const TAIPEI_OFFSET_MS =
  8 * 60 * 60 * 1000;

function getTaipeiPeriod(scope, timestamp) {
  if (scope === "all") {
    return {
      startAt: "",
      endBefore: ""
    };
  }

  const current = new Date(
    Number(timestamp) || Date.now()
  );

  const taipei = new Date(
    current.getTime() + TAIPEI_OFFSET_MS
  );

  const year = taipei.getUTCFullYear();
  const month = taipei.getUTCMonth();
  const day = taipei.getUTCDate();

  const startUtc =
    scope === "month"
      ? Date.UTC(year, month, 1) - TAIPEI_OFFSET_MS
      : Date.UTC(year, month, day) - TAIPEI_OFFSET_MS;

  const endUtc =
    scope === "month"
      ? Date.UTC(year, month + 1, 1) - TAIPEI_OFFSET_MS
      : Date.UTC(year, month, day + 1) - TAIPEI_OFFSET_MS;

  return {
    startAt: new Date(startUtc).toISOString(),
    endBefore: new Date(endUtc).toISOString()
  };
}

function summarizeEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];

  return list.reduce(
    function (summary, entry) {
      const amount = Number(entry.amount) || 0;

      if (entry.type === "income") {
        summary.income += amount;
      } else if (entry.type === "expense") {
        summary.expense += amount;
      }

      summary.count += 1;
      summary.balance =
        summary.income - summary.expense;

      return summary;
    },
    {
      count: 0,
      income: 0,
      expense: 0,
      balance: 0
    }
  );
}

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

async function queryGroupAccounting(
  context,
  scope,
  dependencies = {}
) {
  const listEntries =
    dependencies.listGroupAccountingEntries ||
    listGroupAccountingEntries;

  if (
    !context ||
    context.source.type !== "group" ||
    !context.source.groupId
  ) {
    return {
      found: false,
      reason: "group_required",
      entries: [],
      summary: summarizeEntries([])
    };
  }

  const period = getTaipeiPeriod(
    scope,
    context.timestamp
  );

  const entries = await listEntries(
    context.source.groupId,
    period
  );

  return {
    found: entries.length > 0,
    reason:
      entries.length > 0
        ? "accounting_found"
        : "accounting_empty",
    entries,
    summary: summarizeEntries(entries),
    period
  };
}

module.exports = {
  recordGroupAccounting,
  queryGroupAccounting,
  getTaipeiPeriod,
  summarizeEntries,
  timestampToIso
};
