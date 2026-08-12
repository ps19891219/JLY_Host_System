/*
JLY Host System

Module:
LINE Group Accounting Command V1
*/

"use strict";

const MAX_AMOUNT = 100000000;

function normalizeText(value) {
  return String(value || "").trim();
}

function parseAccountingCommand(value) {
  const text = normalizeText(value);
  const match = text.match(
    /^jly\s*(支出|收入)\s+([\d,]+)(?:\s+(.+))?$/i
  );

  if (!match) {
    return null;
  }

  const type =
    match[1] === "收入"
      ? "income"
      : "expense";

  const amountText =
    match[2].replace(/,/g, "");

  const amount = Number(amountText);
  const description = normalizeText(match[3]);

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return {
      valid: false,
      error: "invalid_amount"
    };
  }

  if (!description) {
    return {
      valid: false,
      error: "description_missing"
    };
  }

  return {
    valid: true,
    command: {
      type,
      amount,
      description
    }
  };
}

function parseAccountingQuery(value) {
  const normalized =
    normalizeText(value)
      .toLowerCase()
      .replace(/\s+/g, "");

  switch (normalized) {
    case "jly今日帳目":
      return {
        scope: "today"
      };

    case "jly本月帳目":
      return {
        scope: "month"
      };

    case "jly帳本餘額":
      return {
        scope: "all"
      };

    default:
      return null;
  }
}

module.exports = {
  MAX_AMOUNT,
  parseAccountingCommand,
  parseAccountingQuery
};
