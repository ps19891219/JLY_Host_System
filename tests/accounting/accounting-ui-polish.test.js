"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");
const polish = require("../../js/modules/accounting/accounting-ui-polish");
const css = fs.readFileSync(path.join(root, "css/pages/accounting-ui-polish.css"), "utf8");
const page = fs.readFileSync(path.join(root, "pages/car-detail.html"), "utf8");

function model(pendingActions, transfers) {
  return {
    members: [
      { personId: "me", identityIds: ["legacy-me"] },
      { personId: "other", identityIds: ["legacy-other"] }
    ],
    pendingActions,
    netSettlement: { transfers }
  };
}

test("已無目前應付餘額時，不再顯示 stale 待付款 action", () => {
  const result = polish.filterPendingActions(model([
    { actionType: "payment_due", responsiblePersonId: "legacy-me", toPersonId: "legacy-other", amount: 87 }
  ], []));
  assert.deepEqual(result, []);
});

test("仍有目前 Pairwise 淨額時保留待付款 action", () => {
  const action = { actionType: "payment_due", responsiblePersonId: "legacy-me", toPersonId: "legacy-other", amount: 87 };
  const result = polish.filterPendingActions(model([action], [
    { fromPersonId: "me", toPersonId: "other", amount: 50 }
  ]));
  assert.equal(result.length, 1);
  assert.equal(result[0], action);
});

test("非付款類 Pending Action 不因 current balance 歸零被誤刪", () => {
  const action = { actionType: "payment_confirmation", responsiblePersonId: "other", settlementId: "s1", amount: 87 };
  const result = polish.filterPendingActions(model([action], []));
  assert.equal(result.length, 1);
});

test("逐筆單筆修改確認取消使用小型按鈕", () => {
  assert.match(css, /\.accounting-split-row-editor button\{[^}]*width:auto!important;[^}]*min-height:34px!important;/s);
  assert.match(css, /\[data-inline-row-save\]/);
  assert.match(css, /\[data-inline-row-cancel\]/);
});

test("店家總收款人物明細改為全寬向下展開", () => {
  assert.match(css, /\.accounting-store-received-list > \.accounting-store-received-person\{[^}]*display:block!important;[^}]*width:100%;/s);
  assert.match(css, /\.accounting-store-received-list > \.accounting-store-received-person > \.accounting-store-person-detail\{[^}]*width:100%;/s);
});

test("Car Detail 在 Accounting render 後載入 UI polish 並載入 override CSS", () => {
  assert.match(page, /accounting\.css\?v=35[\s\S]*accounting-ui-polish\.css\?v=1/);
  assert.match(page, /accounting-render\.js\?v=24[\s\S]*accounting-ui-polish\.js\?v=1[\s\S]*accounting-controller\.js\?v=41/);
});
