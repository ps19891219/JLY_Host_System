const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");

function renderTransaction(splits, names) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.JLYAccountingRender.buildDashboardHtml({
    members: [], membersById: new Map(), memberNames: new Map(names),
    transactions: [{
      transactionId: "drink-350", title: "飲料", amount: 350,
      paidBy: "payer", splitStatus: "completed", splits
    }],
    currentPersonId: "payer", viewPersonId: "payer", isManager: false,
    managementMode: false, counts: { total: 0, paymentConfirmation: 0 },
    personalSettlement: { payable: 0, receivable: 0, transfers: [] },
    personalObligations: { payable: [], receivable: [], payableTotal: 0, receivableTotal: 0 },
    activeNetSettlements: [], settlementHistory: [], detailMode: true,
    detailHasMore: false, getFilterState: () => "settled"
  });
}

test("逐筆帳目只顯示 Transaction、付款人、Split 與分帳狀態", () => {
  const html = renderTransaction([
    { splitId: "s1", personId: "p1", amount: 87 },
    { splitId: "s2", personId: "p2", amount: 87 },
    { splitId: "s3", personId: "p3", amount: 89 },
    { splitId: "s4", personId: "p4", amount: 87 }
  ], [["payer", "小霙"], ["p1", "詩婕"], ["p2", "小霙"], ["p3", "兩"], ["p4", "小白"]]);
  assert.match(html, /飲料/);
  assert.match(html, /\$350/);
  assert.match(html, /付款人：小霙/);
  assert.match(html, /分帳完成/);
  const entry = html.match(/<article class="accounting-entry"[^]*?<\/article>/)[0];
  assert.doesNotMatch(entry, /已列入彙總|Pairwise|Settlement|Obligation|Projection/);
});

test("同名但不同 personId 不合併並提供安全辨識", () => {
  const html = renderTransaction([
    { splitId: "visitor", personId: "visitor-shijie", amount: 87 },
    { splitId: "linked", personId: "member-shijie", amount: 87 }
  ], [["payer", "小霙"], ["visitor-shijie", "詩婕"], ["member-shijie", "詩婕"]]);
  assert.match(html, /詩婕（成員 1）/);
  assert.match(html, /詩婕（成員 2）/);
  assert.equal((html.match(/data-split-person-id=/g) || []).length, 2);
});

test("同一 personId 重複 Split 合併為一列並標示資料異常", () => {
  const html = renderTransaction([
    { splitId: "legacy-1", personId: "member-shijie", amount: 87 },
    { splitId: "legacy-2", personId: "member-shijie", amount: 87 }
  ], [["payer", "小霙"], ["member-shijie", "詩婕"]]);
  assert.equal((html.match(/data-split-person-id="member-shijie"/g) || []).length, 1);
  assert.match(html, /同一成員有 2 筆分帳資料，請確認來源/);
  assert.match(html, /\$87 \+ \$87/);
});
