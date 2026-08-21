"use strict";

const pairwise = require("../../shared/accounting/pairwise-obligation");

// ============================================================
// Helpers
// ============================================================

function text(value) {
  return String(
    value || ""
  ).trim();
}

function amount(value) {
  return Math.max(
    0,
    Math.round(
      Number(value) || 0
    )
  );
}

// ============================================================
// Payments
// ============================================================

function normalizePayments(
  transaction
) {
  const supplied =
    Array.isArray(
      transaction &&
      transaction.payments
    )
      ? transaction.payments
      : [];

  if (supplied.length) {
    return supplied
      .map(
        payment => ({
          personId:
            text(
              payment.personId ||
              payment.memberId ||
              payment.playerId
            ),

          amount:
            amount(
              payment.amount
            )
        })
      )
      .filter(
        payment =>
          payment.personId &&
          payment.amount > 0
      );
  }

  const paidBy =
    text(
      transaction &&
      (
        transaction.paidBy ||
        transaction.payerMemberId
      )
    );

  const total =
    amount(
      transaction &&
      transaction.amount
    );

  if (
    !paidBy ||
    !total
  ) {
    return [];
  }

  return [
    {
      personId: paidBy,
      amount: total
    }
  ];
}

// ============================================================
// Settlement Plan
// ============================================================

function buildSettlementPlan(
  balances
) {
  const creditors = [];
  const debtors = [];

  for (
    const item of
    balances || []
  ) {
    const personId =
      text(
        item.personId
      );

    const netAmount =
      Number(
        item.netAmount
      ) || 0;

    if (
      !personId ||
      netAmount === 0
    ) {
      continue;
    }

    if (netAmount > 0) {
      creditors.push({
        personId,
        amount: netAmount
      });
    } else {
      debtors.push({
        personId,
        amount:
          Math.abs(
            netAmount
          )
      });
    }
  }

  // Larger balances first.
  // personId provides deterministic ordering.
  creditors.sort(
    (a, b) =>
      b.amount -
        a.amount ||
      a.personId.localeCompare(
        b.personId
      )
  );

  debtors.sort(
    (a, b) =>
      b.amount -
        a.amount ||
      a.personId.localeCompare(
        b.personId
      )
  );

  const transfers = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (
    debtorIndex <
      debtors.length &&
    creditorIndex <
      creditors.length
  ) {
    const debtor =
      debtors[
        debtorIndex
      ];

    const creditor =
      creditors[
        creditorIndex
      ];

    const transferAmount =
      Math.min(
        debtor.amount,
        creditor.amount
      );

    if (
      transferAmount > 0
    ) {
      transfers.push({
        fromPersonId:
          debtor.personId,

        toPersonId:
          creditor.personId,

        amount:
          transferAmount
      });

      debtor.amount -=
        transferAmount;

      creditor.amount -=
        transferAmount;
    }

    if (
      debtor.amount === 0
    ) {
      debtorIndex += 1;
    }

    if (
      creditor.amount === 0
    ) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

// ============================================================
// Apply Completed Settlements
// ============================================================

function applySettlements(
  balanceMap,
  settlements
) {
  const result =
    new Map(
      balanceMap
    );

  const ensure =
    personId => {
      const id =
        text(
          personId
        );

      if (!id) {
        return "";
      }

      if (
        !result.has(id)
      ) {
        result.set(
          id,
          0
        );
      }

      return id;
    };

  for (
    const record of
    settlements || []
  ) {
    if (
      !record ||
      record.status !==
        "settled"
    ) {
      continue;
    }

    const from =
      ensure(
        record.fromPersonId
      );

    const to =
      ensure(
        record.toPersonId
      );

    const paid =
      amount(
        record.amount
      );

    if (
      !from ||
      !to ||
      from === to ||
      !paid
    ) {
      continue;
    }

    /*
     * Before settlement:
     * payer / debtor is negative.
     * receiver / creditor is positive.
     *
     * A completed transfer brings both balances toward zero.
     */
    result.set(
      from,
      (
        result.get(from) ||
        0
      ) + paid
    );

    result.set(
      to,
      (
        result.get(to) ||
        0
      ) - paid
    );
  }

  return result;
}

// ============================================================
// Activity Accounting Summary
// ============================================================

function buildActivityAccountingSummary(
  transactions,
  settlements
) {
  const active =
    (
      transactions ||
      []
    ).filter(
      item =>
        item &&
        item.status !==
          "deleted"
    );

  const members =
    new Map();

  const settlementBalance =
    new Map();

  const member =
    id => {
      const personId =
        text(id);

      if (!personId) {
        return null;
      }

      if (
        !members.has(
          personId
        )
      ) {
        members.set(
          personId,
          {
            personId,

            // All actual expense payments,
            // including transactions still waiting for split.
            paidAmount: 0,

            // Amount already allocated to this person
            // by completed splits.
            shareAmount: 0,

            // Actual payments from transactions
            // whose split has been completed.
            allocatedPaidAmount: 0
          }
        );
      }

      if (
        !settlementBalance.has(
          personId
        )
      ) {
        settlementBalance.set(
          personId,
          0
        );
      }

      return members.get(
        personId
      );
    };

  let totalIncome = 0;
  let totalExpense = 0;

  // ----------------------------------------------------------
  // Transactions
  // ----------------------------------------------------------

  for (
    const entry of active
  ) {
    const value =
      amount(
        entry.amount
      );

    if (
      entry.type ===
        "income"
    ) {
      totalIncome +=
        value;
    }

    if (
      entry.type !==
        "expense"
    ) {
      continue;
    }

    totalExpense +=
      value;

    const payments =
      normalizePayments(
        entry
      );

    // Historical actual payments always remain visible.
    for (
      const payment of
      payments
    ) {
      const payer =
        member(
          payment.personId
        );

      if (!payer) {
        continue;
      }

      payer.paidAmount +=
        payment.amount;
    }

    /*
     * A transaction cannot participate in member settlement
     * until its allocation is known.
     */
    if (
      entry.splitStatus !==
        "completed"
    ) {
      continue;
    }

    // Completed payment allocation
    for (
      const payment of
      payments
    ) {
      const payer =
        member(
          payment.personId
        );

      if (!payer) {
        continue;
      }

      payer.allocatedPaidAmount +=
        payment.amount;

      settlementBalance.set(
        payer.personId,
        (
          settlementBalance.get(
            payer.personId
          ) || 0
        ) +
          payment.amount
      );
    }

    // Completed responsibility allocation
    for (
      const split of
      entry.splits ||
      entry.shares ||
      []
    ) {
      const personId =
        text(
          split.personId ||
          split.memberId
        );

      const share =
        amount(
          split.amount
        );

      const participant =
        member(
          personId
        );

      if (
        !participant ||
        !share
      ) {
        continue;
      }

      participant.shareAmount +=
        share;

      settlementBalance.set(
        personId,
        (
          settlementBalance.get(
            personId
          ) || 0
        ) -
          share
      );
    }
  }

  // ----------------------------------------------------------
  // Historical Completed Settlements
  // ----------------------------------------------------------

  const currentBalance =
    applySettlements(
      settlementBalance,
      settlements
    );

  // ----------------------------------------------------------
  // Member Summary
  // ----------------------------------------------------------

  const memberSummaries =
    [
      ...members.values()
    ].map(
      item => {
        const netAmount =
          settlementBalance.get(
            item.personId
          ) || 0;

        const currentNetAmount =
          currentBalance.get(
            item.personId
          ) || 0;

        return {
          ...item,

          /*
           * Original balance before reimbursement.
           *
           * + = should receive
           * - = should pay
           */
          netAmount,

          /*
           * Balance after confirmed settlement records.
           */
          currentNetAmount,

          receivableAmount:
            currentNetAmount >
              0
              ? currentNetAmount
              : 0,

          payableAmount:
            currentNetAmount <
              0
              ? Math.abs(
                  currentNetAmount
                )
              : 0
        };
      }
    );

  // ----------------------------------------------------------
  // Global Settlement Plan
  // ----------------------------------------------------------

  const grossObligations =
    pairwise.applySettlements(
      active.flatMap(item =>
        pairwise.buildTransactionObligations(item)
      ),
      settlements || []
    );

  const settlementTransfers =
    pairwise.aggregatePairwiseObligations(
      [],
      grossObligations
    );

  const outstandingAmount =
    settlementTransfers.reduce(
      (sum, item) =>
        sum +
        item.amount,
      0
    );

  return {
    summaryVersion: 2,

    totalIncome,

    totalExpense,

    balance:
      totalIncome -
      totalExpense,

    memberSummaries,

    /*
     * Compatibility alias.
     *
     * Old UI may still read obligationsByPair.
     * It now represents pairwise obligations after same-pair offset and confirmed settlements.
     */
    grossObligations,

    pairwiseObligations:
      settlementTransfers,

    obligationsByPair:
      settlementTransfers.map(
        item => ({
          fromPersonId: item.fromPersonId,
          toPersonId: item.toPersonId,
          amount: item.amount
        })
      ),

    settlementTransfers:
      settlementTransfers.map(
        item => ({
          fromPersonId: item.fromPersonId,
          toPersonId: item.toPersonId,
          amount: item.amount
        })
      ),

    outstandingAmount
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  buildActivityAccountingSummary,
  buildSettlementPlan,
  normalizePayments,
  applySettlements
};