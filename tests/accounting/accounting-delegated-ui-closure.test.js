"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const controller = read("js/modules/accounting/accounting-controller.js");
const repository = read("js/modules/accounting/accounting-repository.js");
const render = read("js/modules/accounting/accounting-render.js");
const viewModel = read("shared/accounting/activity-accounting-view-model.js");

test("新版人物明細提供請人代付與幫他代付入口", () => {
  assert.match(controller, /accounting-person-delegated-action/);
  assert.match(controller, /data-action=\"request_delegate\"/);
  assert.match(controller, /data-action=\"delegated_claim\"/);
  assert.match(controller, /其他付款方式/);
});

test("代付入口沿用正式 repository，不建立第二套帳務計算", () => {
  assert.match(controller, /repository\.createDelegatedRequest\(carId/);
  assert.match(controller, /repository\.claimNetSettlement\(carId,\{action:\"delegated_claim\"/);
  assert.match(repository, /async function createDelegatedRequest/);
  assert.match(repository, /delegatedClaim = input\.action === \"delegated_claim\"/);
  assert.doesNotMatch(controller, /buildSettlementPlan\(/);
});

test("請人代付保留原債務人、指定代付者與正式收款方", () => {
  assert.match(controller, /debtorPersonId:input\.fromPersonId/);
  assert.match(controller, /delegatePersonId:input\.delegatePersonId/);
  assert.match(controller, /receiverPersonId:input\.toPersonId/);
  assert.match(controller, /requestedBy:currentPersonId/);
});

test("代付仍走付款申報後由收款方確認的 Settlement 流程", () => {
  assert.match(repository, /status: receiverSettle \? \"settled\" : \"payment_claimed\"/);
  assert.match(repository, /actionType: \"payment_confirmation\"/);
  assert.match(repository, /responsiblePersonId: canonicalToPersonId \|\| to/);
});

test("Activity Accounting 仍只使用共用正式 Projection", () => {
  assert.match(controller, /window\.JLYActivityAccountingViewModel\.build/);
  assert.match(viewModel, /JLYActivityAccountingViewModel/);
  assert.doesNotMatch(render, /JLYActivityAccountingViewModel\.build/);
});
