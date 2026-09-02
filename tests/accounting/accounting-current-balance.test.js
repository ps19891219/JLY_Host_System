"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const dataModule = require("../../js/modules/accounting/accounting-data");

const root = path.join(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-current-balance.js"), "utf8");
const page = fs.readFileSync(path.join(root, "pages/car-detail.html"), "utf8");

function loadProjection() {
  const data = { ...dataModule };
  const context = { window: { JLYAccountingData: data } };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.JLYAccountingData;
}

test("我的帳務完全互抵後直接歸零，不保留已互抵人物列", () => {
  const data = loadProjection();
  const result = data.personalAccountingProjection([
    { fromPersonId: "me", toPersonId: "mist", amount: 87 },
    { fromPersonId: "mist", toPersonId: "me", amount: 87 }
  ], "me");

  assert.equal(result.payableTotal, 0);
  assert.equal(result.receivableTotal, 0);
  assert.equal(result.netAmount, 0);
  assert.equal(result.direction, "settled");
  assert.deepEqual(Array.from(result.people), []);
});

test("互抵歸零後新增金額只顯示最新剩餘淨額", () => {
  const data = loadProjection();
  const result = data.personalAccountingProjection([
    { fromPersonId: "me", toPersonId: "mist", amount: 87 },
    { fromPersonId: "mist", toPersonId: "me", amount: 87 },
    { fromPersonId: "mist", toPersonId: "me", amount: 50 }
  ], "me");

  assert.equal(result.payableTotal, 0);
  assert.equal(result.receivableTotal, 50);
  assert.equal(result.netAmount, 50);
  assert.equal(result.direction, "receivable");
  assert.deepEqual(Array.from(result.people, item => [item.personId, item.direction, item.amount]), [
    ["mist", "receivable", 50]
  ]);
});

test("current balance 在互抵前先使用 canonical Person identity", () => {
  const data = loadProjection();
  const canonicalize = id => ({ "legacy-me": "me", "legacy-mist": "mist" }[id] || id);
  const result = data.personalAccountingProjection([
    { fromPersonId: "legacy-me", toPersonId: "mist", amount: 87 },
    { fromPersonId: "legacy-mist", toPersonId: "me", amount: 87 }
  ], "me", canonicalize);

  assert.equal(result.payableTotal, 0);
  assert.equal(result.receivableTotal, 0);
  assert.deepEqual(Array.from(result.people), []);
});

test("Car Detail 在 Accounting controller 前載入 current-balance projection", () => {
  assert.match(page, /accounting-data\.js\?v=12[\s\S]*accounting-current-balance\.js\?v=1[\s\S]*accounting-controller\.js\?v=41/);
});
