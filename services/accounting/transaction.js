"use strict";

const {
  createSplit,
  validateSplitTotal
} = require("./split");

const {
  getTransactionSettlementStatus
} = require("./settlement");

// ============================================================
// Helpers
// ============================================================

function text(value) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

function positiveAmount(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new Error(
      "transaction_amount_invalid"
    );
  }

  return number;
}

// ============================================================
// Payment
// ============================================================

function createPayment(
  input = {},
  index = 0
) {
  const personId =
    text(
      input.personId ||
      input.memberId ||
      input.playerId
    );

  if (!personId) {
    throw new Error(
      "payment_person_required"
    );
  }

  const paymentAmount =
    positiveAmount(
      input.amount
    );

  return {
    paymentId:
      text(input.paymentId) ||
      `payment-${personId}-${index + 1}`,

    personId,

    displayName:
      text(input.displayName),

    amount:
      paymentAmount
  };
}

function validatePaymentTotal(
  payments,
  transactionAmount
) {
  const list =
    Array.isArray(payments)
      ? payments.map(
          (payment, index) =>
            createPayment(
              payment,
              index
            )
        )
      : [];

  const total =
    list.reduce(
      (sum, payment) =>
        sum + payment.amount,
      0
    );

  const expected =
    positiveAmount(
      transactionAmount
    );

  return {
    valid:
      list.length > 0 &&
      total === expected,

    total,
    expected,
    payments: list
  };
}

// ============================================================
// Normalize Payments
// ============================================================

function buildPayments(
  input,
  transactionAmount,
  fallbackPaidBy
) {
  const supplied =
    Array.isArray(input.payments)
      ? input.payments
      : [];

  if (supplied.length) {
    const validation =
      validatePaymentTotal(
        supplied,
        transactionAmount
      );

    if (!validation.valid) {
      throw new Error(
        "payment_total_mismatch"
      );
    }

    return validation.payments;
  }

  const payer =
    text(
      fallbackPaidBy
    );

  if (!payer) {
    throw new Error(
      "transaction_payer_required"
    );
  }

  return [
    createPayment(
      {
        personId: payer,
        amount: transactionAmount
      },
      0
    )
  ];
}

// ============================================================
// Transaction
// ============================================================

function createTransaction(
  input = {}
) {
  const transactionId =
    text(
      input.transactionId ||
      input.entryId ||
      input.messageId
    );

  const activityId =
    text(
      input.activityId ||
      input.carId
    );

  const createdBy =
    text(
      input.createdBy ||
      input.actorMemberId
    );

  const title =
    text(
      input.title ||
      input.description
    );

  if (
    !transactionId ||
    !activityId ||
    !createdBy ||
    !title
  ) {
    throw new Error(
      "transaction_fields_required"
    );
  }

  const transactionAmount =
    positiveAmount(
      input.amount
    );

  // ----------------------------------------------------------
  // Legacy payer compatibility
  // ----------------------------------------------------------

  const legacyPaidBy =
    text(
      input.paidBy ||
      input.payerMemberId
    );

  const firstSuppliedPayment =
    Array.isArray(input.payments) &&
    input.payments.length
      ? input.payments[0]
      : null;

  const fallbackPaidBy =
    legacyPaidBy ||
    text(
      firstSuppliedPayment &&
      (
        firstSuppliedPayment.personId ||
        firstSuppliedPayment.memberId ||
        firstSuppliedPayment.playerId
      )
    ) ||
    createdBy;

  // ----------------------------------------------------------
  // Payments
  // ----------------------------------------------------------

  const payments =
    buildPayments(
      input,
      transactionAmount,
      fallbackPaidBy
    );

  /*
   * paidBy is retained only as a compatibility alias.
   *
   * New accounting calculations must use payments[].
   *
   * For a multi-payer transaction it points to the first
   * payment participant and must NOT be interpreted as the
   * person who paid the entire transaction.
   */
  const paidBy =
    legacyPaidBy ||
    payments[0].personId;

  // ----------------------------------------------------------
  // Splits
  // ----------------------------------------------------------

  const rawSplits =
    Array.isArray(
      input.splits ||
      input.shares
    )
      ? (
          input.splits ||
          input.shares
        )
      : [];

  let splits =
    rawSplits.map(
      createSplit
    );

  const splitStatus =
    text(
      input.splitStatus
    ) ||
    (
      splits.length
        ? "completed"
        : "pending"
    );

  if (
    splitStatus ===
      "completed" &&
    !validateSplitTotal(
      splits,
      transactionAmount
    ).valid
  ) {
    throw new Error(
      "split_total_mismatch"
    );
  }

  /*
   * Compatibility:
   *
   * For a traditional single-payer transaction only,
   * the payer's own share has no reimbursement step.
   *
   * Multi-payer transactions are intentionally NOT
   * auto-settled here. Their final reimbursement must
   * be calculated from activity-wide net balances.
   */
  if (
    payments.length === 1 &&
    payments[0].amount ===
      transactionAmount
  ) {
    const onlyPayer =
      payments[0].personId;

    const now =
      text(
        input.createdAt ||
        input.updatedAt
      ) ||
      new Date().toISOString();

    splits =
      splits.map(
        split =>
          split.personId ===
            onlyPayer &&
          split.settlementStatus ===
            "payment_due"
            ? {
                ...split,
                settlementStatus:
                  "settled",
                confirmedBy:
                  onlyPayer,
                confirmedAt:
                  now
              }
            : split
      );
  }

  // ----------------------------------------------------------
  // Participants
  // ----------------------------------------------------------

  const participantIds =
    Array.isArray(
      input.participants
    )
      ? input.participants
          .map(text)
          .filter(Boolean)
      : [
          ...splits.map(
            split =>
              split.personId
          ),

          ...payments.map(
            payment =>
              payment.personId
          )
        ];

  const participants =
    [
      ...new Set(
        participantIds
      )
    ];

  // ----------------------------------------------------------
  // Time
  // ----------------------------------------------------------

  const now =
    text(
      input.updatedAt ||
      input.createdAt
    ) ||
    new Date().toISOString();

  // ----------------------------------------------------------
  // Result
  // ----------------------------------------------------------

  return {
    transactionId,

    activityId,

    activityType:
      text(
        input.activityType
      ) ||
      "car",

    villageType:
      text(
        input.villageType
      ) ||
      "script_village",

    carId:
      text(
        input.carId
      ) ||
      activityId,

    type:
      input.type ===
        "income"
        ? "income"
        : "expense",

    title,

    category:
      text(
        input.category
      ) ||
      "uncategorized",

    amount:
      transactionAmount,

    currency:
      text(
        input.currency
      ) ||
      "TWD",

    createdBy,

    // Compatibility alias
    paidBy,

    // Formal actual-payment source
    payments,

    participants,

    splits,

    splitStatus,

    settlementStatus:
      splitStatus ===
        "completed"
        ? getTransactionSettlementStatus(
            splits
          )
        : "pending",

    note:
      text(
        input.note
      ),

    source:
      text(
        input.source
      ) ||
      "jly_activity",

    status:
      text(
        input.status
      ) ||
      "active",

    createdAt:
      text(
        input.createdAt
      ) ||
      now,

    updatedAt:
      now
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  createTransaction,
  createPayment,
  validatePaymentTotal
};