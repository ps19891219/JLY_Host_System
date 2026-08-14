"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePayerLabel, buildPendingEntry } = require("../../services/accounting/pending-entry");

const members = [
  { personId: "p1", displayName: "小英" },
  { personId: "p2", displayName: "小瑛" },
  { personId: "p3", displayName: "詩婕" }
];

test("payer label resolves only one exact formal member", () => {
  const result = resolvePayerLabel("小英", members);
  assert.equal(result.status, "resolved");
  assert.equal(result.member.personId, "p1");
});

test("ambiguous or missing payer stays outside formal transactions", () => {
  assert.equal(resolvePayerLabel("小", members).status, "ambiguous");
  assert.equal(resolvePayerLabel("阿明", members).status, "not_found");
  const draft = buildPendingEntry({ draftId: "line-m1", carId: "car-1", title: "晚餐", amount: 690, payerInput: "阿明", createdBy: "host" }, "2026-08-14T10:00:00.000Z");
  assert.equal(draft.status, "pending_identity");
  assert.equal(draft.payerInput, "阿明");
  assert.equal(draft.activityType, "script_car");
});
