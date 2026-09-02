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
  assert.match(page,/accounting-repository\.js\?v=28[\s\S]*accounting-view-refresh\.js\?v=2[\s\S]*accounting-controller\.js\?v=41/);

  const events = [];
  const viewRef = {
    async get() { events.push("view-get"); return { exists:true, data(){ return { projectionRuntimeRevision:1 }; } }; },
    async delete() { events.push("delete"); },
    async set(data, options) { events.push(["set", data, options]); }
  };
  const carRef = {
    async get() { events.push("car-get"); return { exists:true, data(){ return { players:[] }; } }; },
    collection() { return { doc(){ return viewRef; } }; }
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
      JLYAccountingData: {
        collectActivityMembers(){ return [{ personId:"person-1", identityIds:["person-1"] }]; },
        canonicalActivityPersonId(members,id){ return id; },
        getCurrentIdentity(){ return { identityIds:["person-1"] }; },
        linkCurrentIdentityToActivityMembers(members){ return members; }
      },
      JLYPairwiseObligation: { applySettlements(items){ return items; } },
      db: { collection(){ return { doc(){ return carRef; } }; } },
      localStorage: {}
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(refresh, context);
  const result = await repository.loadDashboard("car-1", "person-1");
  assert.equal(result.ok, true);
  assert.deepEqual(events.slice(0,4), ["car-get","view-get","delete",["load","car-1","person-1"]]);
  assert.equal(events[4][0], "set");
  assert.equal(events[4][1].projectionRuntimeRevision, 2);
});

test("legacy and canonical activity identities are normalized before settled amount is applied", async () => {
  const refresh = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-view-refresh.js"),"utf8");
  const events = [];
  const viewRef = {
    async get() { return { exists:true, data(){ return { projectionRuntimeRevision:1 }; } }; },
    async delete() { events.push("delete"); },
    async set() {}
  };
  const carRef = {
    async get() {
      return { exists:true, data(){ return { players:[
        { personId:"canonical-debtor", linkedPlayerIds:["legacy-debtor"] },
        { personId:"canonical-receiver", linkedPlayerIds:["legacy-receiver"] }
      ] }; } };
    },
    collection() { return { doc(){ return viewRef; } }; }
  };
  const accountingData = {
    collectActivityMembers(car) {
      return car.players.map(player => ({ personId:player.personId, identityIds:[player.personId,...(player.linkedPlayerIds||[])] }));
    },
    canonicalActivityPersonId(members,id) {
      const member = members.find(item => (item.identityIds||[]).includes(id));
      return member ? member.personId : id;
    },
    getCurrentIdentity(){ return { identityIds:[] }; },
    linkCurrentIdentityToActivityMembers(members){ return members; }
  };
  const pairwiseRuntime = {
    applySettlements(obligations, settlements) {
      events.push({ obligations, settlements });
      const settled = settlements[0];
      return obligations.filter(item => !(item.fromPersonId===settled.fromPersonId && item.toPersonId===settled.toPersonId));
    }
  };
  const repository = {
    async loadDashboard() {
      return {
        grossObligations: pairwiseRuntime.applySettlements(
          [{ fromPersonId:"legacy-debtor", toPersonId:"legacy-receiver", amount:212 }],
          [{ status:"settled", fromPersonId:"canonical-debtor", toPersonId:"canonical-receiver", amount:212 }]
        )
      };
    }
  };
  const context = {
    window: {
      JLYAccountingRepository: repository,
      JLYAccountingData: accountingData,
      JLYPairwiseObligation: pairwiseRuntime,
      db: { collection(){ return { doc(){ return carRef; } }; } },
      localStorage: {}
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(refresh, context);
  const result = await repository.loadDashboard("car-1", "canonical-receiver");
  assert.equal(result.grossObligations.length, 0);
  const applied = events.find(item => item && item.obligations);
  assert.equal(applied.obligations[0].fromPersonId, "canonical-debtor");
  assert.equal(applied.obligations[0].toPersonId, "canonical-receiver");
  assert.equal(applied.settlements[0].fromPersonId, "canonical-debtor");
  assert.equal(applied.settlements[0].toPersonId, "canonical-receiver");
  assert.ok(events.includes("delete"));
});


test("我的帳務只顯示逐人物互抵後的目前餘額", () => {
  const data = require("../../js/modules/accounting/accounting-data");
  const result = data.personalAccountingProjection([
    { fromPersonId:"me", toPersonId:"snow", amount:87 },
    { fromPersonId:"snow", toPersonId:"me", amount:87 }
  ], "me");
  assert.equal(result.payableTotal, 0);
  assert.equal(result.receivableTotal, 0);
  assert.equal(result.netAmount, 0);
  assert.deepEqual(result.people, []);
});

test("互抵後新增金額會重新進入目前餘額", () => {
  const data = require("../../js/modules/accounting/accounting-data");
  const result = data.personalAccountingProjection([
    { fromPersonId:"me", toPersonId:"snow", amount:87 },
    { fromPersonId:"snow", toPersonId:"me", amount:87 },
    { fromPersonId:"snow", toPersonId:"me", amount:50 }
  ], "me");
  assert.equal(result.payableTotal, 0);
  assert.equal(result.receivableTotal, 50);
  assert.equal(result.netAmount, 50);
  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].direction, "receivable");
  assert.equal(result.people[0].amount, 50);
});

test("我的帳務零餘額不再顯示已互抵文字", () => {
  const controller = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-controller.js"),"utf8");
  const page = fs.readFileSync(path.join(__dirname,"../../pages/car-detail.html"),"utf8");
  assert.equal(controller.includes('netLabel=myAccounting.direction==="receivable"?"應收":myAccounting.direction==="payable"?"應付":"已互抵"'), false);
  assert.match(controller,/currency=value=>"\$"\+Number/);
  assert.match(controller,/currency\(currentPayable\)/);
  assert.match(controller,/currency\(currentReceivable\)/);
  assert.match(controller,/netText=.*:"\$0"/);
  assert.match(controller,/目前沒有未結清帳務/);
  assert.match(page,/accounting-data\.js\?v=12[\s\S]*accounting-controller\.js\?v=41/);
});
