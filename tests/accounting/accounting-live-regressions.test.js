"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
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

test("stale Accounting prepared view is refreshed once before dashboard load", async () => {
  const refresh = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-view-refresh.js"),"utf8");
  const page = fs.readFileSync(path.join(__dirname,"../../pages/car-detail.html"),"utf8");
  assert.match(page,/accounting-repository\.js\?v=28[\s\S]*accounting-view-refresh\.js\?v=1[\s\S]*accounting-controller\.js\?v=40/);

  const events = [];
  const viewRef = {
    async get() { events.push("get"); return { exists:true, data(){ return { projectionRuntimeRevision:0 }; } }; },
    async delete() { events.push("delete"); },
    async set(data, options) { events.push(["set", data, options]); }
  };
  const repository = {
    async loadDashboard(carId, currentPersonId) {
      events.push(["load", carId, currentPersonId]);
      return { ok:true };
    }
  };
  const context = {
    window: {
      JLYAccountingRepository: repository,
      db: {
        collection() {
          return { doc(){ return { collection(){ return { doc(){ return viewRef; } }; } }; } };
        }
      }
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(refresh, context);
  const result = await repository.loadDashboard("car-1", "person-1");
  assert.equal(result.ok, true);
  assert.deepEqual(events[0], "get");
  assert.deepEqual(events[1], "delete");
  assert.deepEqual(events[2], ["load", "car-1", "person-1"]);
  assert.equal(events[3][0], "set");
  assert.equal(events[3][1].projectionRuntimeRevision, 1);
});
