/*
JLY Host System

Module:
LINE Group Accounting Service V1
*/

"use strict";

const {
  saveGroupAccountingEntry,
  listGroupAccountingEntries,
  getEntryCode,
  findGroupAccountingEntryByCode,
  mutateGroupAccountingEntry
} = require(
  "../firebase/line-group-accounting-repository"
);

const {
  saveCarAccountingEntry,
  listCarAccountingEntries,
  findCarAccountingEntryByCode,
  mutateCarAccountingEntry,
  getCarAccountingView
} = require(
  "../firebase/car-accounting-repository"
);

const TAIPEI_OFFSET_MS =
  8 * 60 * 60 * 1000;

const {
  canMutateEntry: defaultCanMutateEntry
} = require(
  "./accounting-authorization-service"
);

function getTaipeiPeriod(scope, timestamp) {
  if (scope === "all" || scope === "recent") {
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
    (
      context && context.accountingCarId
        ? saveCarAccountingEntry
        : saveGroupAccountingEntry
    );

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

  if (!context.accountingCarId) {
    return {
      saved: false,
      reason: "car_binding_required"
    };
  }

  const entry = await saveEntry({
    carId: context.accountingCarId,
    groupId: context.source.groupId,
    messageId: context.message.id,
    userId: context.source.userId,
    actorMemberId: context.accountingActorMemberId || "",
    actorDisplayName: context.accountingActorDisplayName || "",
    payerMemberId: command.payerMemberId || context.accountingActorMemberId || "",
    payerDisplayName: command.payerDisplayName || context.accountingActorDisplayName || "",
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
  const readAccountingView =
    dependencies.getCarAccountingView ||
    getCarAccountingView;
  const listEntries =
    dependencies.listGroupAccountingEntries ||
    (
      context && context.accountingCarId
        ? listCarAccountingEntries
        : listGroupAccountingEntries
    );

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

  if (scope === "all" && context.accountingCarId) {
    const view = await readAccountingView(context.accountingCarId);
    const count = Number(view && view.activeEntryCount) || 0;
    return {
      found: count > 0,
      reason: count > 0 ? "accounting_found" : "accounting_empty",
      entries: [],
      summary: {
        count,
        income: Number(view && view.totalIncome) || 0,
        expense: Number(view && view.totalExpense) || 0,
        balance: Number(view && view.balance) || 0
      },
      memberBalances: Array.isArray(view && view.memberBalances)
        ? view.memberBalances
        : [],
      source: "car_accounting_view",
      period: { startAt: "", endBefore: "" }
    };
  }

  const period = getTaipeiPeriod(
    scope,
    context.timestamp
  );

  const entries = await listEntries(
    context.accountingCarId || context.source.groupId,
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
    source: "accounting_entries",
    period
  };
}

async function mutateGroupAccounting(
  context,
  mutation,
  authority,
  dependencies = {}
) {
  const findEntry =
    dependencies.findGroupAccountingEntryByCode ||
    (
      context && context.accountingCarId
        ? findCarAccountingEntryByCode
        : findGroupAccountingEntryByCode
    );
  const mutateEntry =
    dependencies.mutateGroupAccountingEntry ||
    (
      context && context.accountingCarId
        ? mutateCarAccountingEntry
        : mutateGroupAccountingEntry
    );
  const canMutate =
    dependencies.canMutateEntry ||
    defaultCanMutateEntry;
  const entry = await findEntry(
    context.accountingCarId || context.source.groupId,
    mutation.entryCode
  );

  if (!entry) {
    return { changed: false, reason: "entry_not_found" };
  }

  const permission = canMutate(
    entry,
    context.source.userId,
    authority
  );

  if (!permission.allowed) {
    return { changed: false, reason: permission.reason };
  }

  const after = await mutateEntry({
    carId: context.accountingCarId || "",
    groupId: context.source.groupId,
    entryId: entry.id,
    actorUserId: context.source.userId,
    actorMemberId: authority && authority.playerId || "",
    actorDisplayName: authority && authority.playerDisplayName || "",
    operation: mutation.operation,
    authorityReason: permission.reason,
    changes: mutation
  });

  return {
    changed: Boolean(after),
    reason: after ? "accounting_changed" : "entry_not_found",
    entry: after,
    entryCode: getEntryCode(entry.id),
    authorityReason: permission.reason
  };
}

module.exports = {
  recordGroupAccounting,
  queryGroupAccounting,
  mutateGroupAccounting,
  getTaipeiPeriod,
  summarizeEntries,
  timestampToIso
};
