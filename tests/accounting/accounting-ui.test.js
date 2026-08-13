const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const render = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-actions.js"), "utf8");

test("個人應付與應收摘要可開啟各自的明細小視窗", () => {
  assert.match(render, /data-settlement-dialog="payable"/);
  assert.match(render, /data-settlement-dialog="receivable"/);
  assert.match(render, /id="accountingSettlementDialog"/);
  assert.match(actions, /showModal/);
  assert.match(actions, /我要付給誰/);
  assert.match(actions, /誰要付給我/);
});

test("結算小視窗沿用已載入的個人淨額，不另外查詢資料", () => {
  assert.match(render, /model\.personalSettlement&&model\.personalSettlement\.transfers/);
  assert.doesNotMatch(actions, /getDocs|fetch\(|\.get\(/);
});
