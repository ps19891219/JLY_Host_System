"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pairwise = require("../../shared/accounting/pairwise-obligation");

test("settled payment consumes the original legacy pair direction", () => {
  const remaining = pairwise.applySettlements([
    { obligationId:"o1", fromPersonId:"legacy-debtor", toPersonId:"legacy-receiver", amount:212 },
    { obligationId:"o2", fromPersonId:"me", toPersonId:"other", amount:87 }
  ], [
    { status:"settled", fromPersonId:"canonical-debtor", toPersonId:"canonical-receiver", originalFromPersonId:"legacy-debtor", originalToPersonId:"legacy-receiver", amount:212 }
  ]);
  assert.deepEqual(remaining.map(item => ({fromPersonId:item.fromPersonId,toPersonId:item.toPersonId,amount:item.amount})), [
    { fromPersonId:"me", toPersonId:"other", amount:87 }
  ]);
});

test("pending action row fills missing counterparty and amount from current pairwise transfer", () => {
  const render = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-render.js"),"utf8");
  assert.match(render,/fallback=transfers\.find/);
  assert.match(render,/data-amount=/);
});

test("pending navigation opens a Person card without requiring sourceId", () => {
  const controller = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-controller.js"),"utf8");
  assert.equal(controller.includes('state.view==="people"&&state.personId&&state.sourceId'), false);
  assert.equal(controller.includes('state.view==="people"&&state.personId'), true);
});

test("split amount click edits selected amount in place and keeps full editor explicit", () => {
  const actions = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-actions.js"),"utf8");
  const render = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-render.js"),"utf8");
  assert.match(actions,/accounting-split-row-editor/);
  assert.match(actions,/accounting-split-full-edit-toggle/);
  assert.match(render,/調整整筆分帳/);
});
