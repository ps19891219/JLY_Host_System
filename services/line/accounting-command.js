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

    case "jly最近帳目":
      return {
        scope: "recent"
      };

    case "jly異動紀錄":
      return {
        scope: "audit"
      };

    default:
      return null;
  }
}

function parseAccountingMutation(value) {
  const text = normalizeText(value);
  const deleteMatch = text.match(
    /^jly\s*刪除帳目\s+([a-z0-9_-]{4,64})$/i
  );

  if (deleteMatch) {
    return {
      valid: true,
      mutation: {
        operation: "delete",
        entryCode: deleteMatch[1]
      }
    };
  }

  const updateMatch = text.match(
    /^jly\s*修改帳目\s+([a-z0-9_-]{4,64})\s+(支出|收入)\s+([\d,]+)(?:\s+(.+))?$/i
  );

  if (!updateMatch) {
    return null;
  }

  const parsed = parseAccountingCommand(
    `JLY ${updateMatch[2]} ${updateMatch[3]} ${updateMatch[4] || ""}`
  );

  if (!parsed || !parsed.valid) {
    return {
      valid: false,
      error: parsed ? parsed.error : "invalid_format"
    };
  }

  return {
    valid: true,
    mutation: {
      operation: "update",
      entryCode: updateMatch[1],
      ...parsed.command
    }
  };
}

function parseGroupBindingCommand(value) {
  const text = normalizeText(value);
  const pairingMatch = text.match(
    /^jly\s*(綁定|確認綁定|取消綁定)\s+([a-z0-9]{6})$/i
  );
  if (pairingMatch) {
    const action = pairingMatch[1] === "確認綁定"
      ? "confirm"
      : pairingMatch[1] === "取消綁定" ? "cancel" : "prepare";
    return { pairingCode: pairingMatch[2].toUpperCase(), action };
  }
  const match = text.match(
    /^jly\s*綁定車團\s+([a-z0-9_-]{6,128})$/i
  );

  return match
    ? { carId: match[1], action: "legacy" }
    : null;
}

module.exports = {
  MAX_AMOUNT,
  parseAccountingCommand,
  parseAccountingQuery,
  parseAccountingMutation,
  parseGroupBindingCommand
};
