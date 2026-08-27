(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.JLYPairwiseObligation = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const MODEL = "pairwise_v1";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function amount(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  function normalizePayments(transaction) {
    const supplied = Array.isArray(transaction && transaction.payments)
      ? transaction.payments
      : [];

    if (supplied.length) {
      return supplied
        .map(item => ({
          personId: text(item && (item.personId || item.memberId || item.playerId)),
          amount: amount(item && item.amount)
        }))
        .filter(item => item.personId && item.amount > 0);
    }

    const personId = text(transaction && (transaction.paidBy || transaction.payerMemberId));
    const paid = amount(transaction && transaction.amount);
    return personId && paid ? [{ personId, amount: paid }] : [];
  }

  function normalizeSplits(transaction) {
    const supplied = Array.isArray(transaction && transaction.splits)
      ? transaction.splits
      : Array.isArray(transaction && transaction.shares)
        ? transaction.shares
        : [];

    return supplied
      .map(item => ({
        personId: text(item && (item.personId || item.memberId || item.playerId)),
        amount: amount(item && item.amount)
      }))
      .filter(item => item.personId && item.amount > 0);
  }

  function settledDebtorIds(transaction) {
    const entry = transaction || {};
    const payer = text(entry.paidBy || entry.payerMemberId);
    const supplied = Array.isArray(entry.splits)
      ? entry.splits
      : Array.isArray(entry.shares)
        ? entry.shares
        : [];

    return new Set(
      supplied
        .filter(item => {
          const personId = text(item && (item.personId || item.memberId || item.playerId));
          return personId && personId !== payer && text(item && item.settlementStatus) === "settled";
        })
        .map(item => text(item && (item.personId || item.memberId || item.playerId)))
    );
  }

  function normalizeStoredObligation(item, index) {
    const fromPersonId = text(item && item.fromPersonId);
    const toPersonId = text(item && item.toPersonId);
    const value = amount(item && item.amount);
    if (!fromPersonId || !toPersonId || fromPersonId === toPersonId || !value) return null;

    return {
      obligationId: text(item.obligationId) || `obligation-${index + 1}`,
      sourceTransactionId: text(item.sourceTransactionId || item.transactionId),
      fromPersonId,
      toPersonId,
      amount: value,
      responsibilityModel: MODEL
    };
  }

  function buildTransactionObligations(transaction) {
    const entry = transaction || {};
    if (entry.status === "deleted" || entry.type !== "expense" || entry.splitStatus !== "completed") {
      return [];
    }

    const settledDebtors = settledDebtorIds(entry);

    if (Array.isArray(entry.obligations) && entry.obligations.length) {
      return entry.obligations
        .map(normalizeStoredObligation)
        .filter(Boolean)
        .filter(item => !settledDebtors.has(item.fromPersonId));
    }

    const balances = new Map();
    const add = (personId, value) => {
      const id = text(personId);
      if (!id || !value) return;
      balances.set(id, (balances.get(id) || 0) + value);
    };

    normalizePayments(entry).forEach(item => add(item.personId, item.amount));
    normalizeSplits(entry).forEach(item => add(item.personId, -item.amount));

    const debtors = [];
    const creditors = [];
    balances.forEach((balance, personId) => {
      if (balance < 0) debtors.push({ personId, amount: -balance });
      if (balance > 0) creditors.push({ personId, amount: balance });
    });

    debtors.sort((a, b) => a.personId.localeCompare(b.personId));
    creditors.sort((a, b) => a.personId.localeCompare(b.personId));

    const transactionId = text(entry.transactionId || entry.entryId || entry.messageId);
    const obligations = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const value = Math.min(debtor.amount, creditor.amount);

      if (value > 0 && debtor.personId !== creditor.personId) {
        obligations.push({
          obligationId: `${transactionId || "transaction"}:${debtor.personId}:${creditor.personId}:${obligations.length + 1}`,
          sourceTransactionId: transactionId,
          fromPersonId: debtor.personId,
          toPersonId: creditor.personId,
          amount: value,
          responsibilityModel: MODEL
        });
      }

      debtor.amount -= value;
      creditor.amount -= value;
      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }

    return obligations.filter(item => !settledDebtors.has(item.fromPersonId));
  }

  function pairKey(a, b) {
    return [text(a), text(b)].sort().join("\u0000");
  }

  function aggregatePairwiseObligations(transactions, additionalObligations) {
    const directed = new Map();
    const pairs = new Set();

    const allObligations = [];
    (transactions || []).forEach(transaction => {
      allObligations.push(...buildTransactionObligations(transaction));
    });
    (additionalObligations || []).forEach((item, index) => {
      const normalized = normalizeStoredObligation(item, index);
      if (normalized) allObligations.push({ ...item, ...normalized });
    });

    allObligations.forEach(obligation => {
        const direction = `${obligation.fromPersonId}\u0000${obligation.toPersonId}`;
        const current = directed.get(direction) || { amount: 0, sources: [] };
        current.amount += obligation.amount;
        current.sources.push({
          obligationId: obligation.obligationId,
          transactionId: obligation.sourceTransactionId,
          amount: obligation.amount
        });
        directed.set(direction, current);
        pairs.add(pairKey(obligation.fromPersonId, obligation.toPersonId));
    });

    const results = [];
    pairs.forEach(key => {
      const [a, b] = key.split("\u0000");
      const aToB = directed.get(`${a}\u0000${b}`) || { amount: 0, sources: [] };
      const bToA = directed.get(`${b}\u0000${a}`) || { amount: 0, sources: [] };
      const difference = aToB.amount - bToA.amount;

      if (!difference) return;
      const forward = difference > 0;
      results.push({
        pairId: key,
        fromPersonId: forward ? a : b,
        toPersonId: forward ? b : a,
        amount: Math.abs(difference),
        grossForwardAmount: forward ? aToB.amount : bToA.amount,
        grossReverseAmount: forward ? bToA.amount : aToB.amount,
        sourceObligations: forward ? aToB.sources : bToA.sources,
        offsetObligations: forward ? bToA.sources : aToB.sources,
        responsibilityModel: MODEL
      });
    });

    return results.sort((left, right) =>
      left.fromPersonId.localeCompare(right.fromPersonId) ||
      right.amount - left.amount ||
      left.toPersonId.localeCompare(right.toPersonId)
    );
  }

  function isPairwiseSettlement(record) {
    return record && record.responsibilityModel === MODEL;
  }

  function isCompatibleSettlement(record) {
    if (!record || record.status !== "settled") return false;
    const from = text(record.fromPersonId);
    const to = text(record.toPersonId);
    const value = amount(record.amount);
    if (!from || !to || from === to || !value) return false;

    const model = text(record.responsibilityModel);
    return !model || model === MODEL;
  }

  function applySettlements(obligations, settlements) {
    const paidByDirection = new Map();
    (settlements || []).forEach(record => {
      if (!isCompatibleSettlement(record)) return;
      const from = text(record.fromPersonId);
      const to = text(record.toPersonId);
      const value = amount(record.amount);
      if (!from || !to || from === to || !value) return;
      const key = `${from}\u0000${to}`;
      paidByDirection.set(key, (paidByDirection.get(key) || 0) + value);
    });

    return (obligations || [])
      .map(item => {
        const key = `${item.fromPersonId}\u0000${item.toPersonId}`;
        const settledAmount = Math.min(item.amount, paidByDirection.get(key) || 0);
        paidByDirection.set(key, Math.max(0, (paidByDirection.get(key) || 0) - settledAmount));
        return {
          ...item,
          originalAmount: item.amount,
          settledAmount,
          amount: item.amount - settledAmount
        };
      })
      .filter(item => item.amount > 0);
  }

  function buildPersonBalances(obligations) {
    const map = new Map();
    const ensure = personId => {
      if (!map.has(personId)) {
        map.set(personId, { personId, payableAmount: 0, receivableAmount: 0, balance: 0 });
      }
      return map.get(personId);
    };

    (obligations || []).forEach(item => {
      const debtor = ensure(item.fromPersonId);
      const receiver = ensure(item.toPersonId);
      debtor.payableAmount += item.amount;
      debtor.balance -= item.amount;
      receiver.receivableAmount += item.amount;
      receiver.balance += item.amount;
    });

    return [...map.values()];
  }

  return {
    MODEL,
    normalizePayments,
    normalizeSplits,
    buildTransactionObligations,
    aggregatePairwiseObligations,
    applySettlements,
    buildPersonBalances,
    isPairwiseSettlement,
    isCompatibleSettlement
  };
});