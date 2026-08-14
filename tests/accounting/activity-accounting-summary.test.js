"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildActivityAccountingSummary,
  buildSettlementPlan
} = require(
  "../../services/accounting/activity-accounting-summary"
);

// ============================================================
// Legacy Single Payer
// ============================================================

test(
  "車團總帳以全車淨額產生結算方案",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            type: "expense",
            amount: 690,
            status: "active",

            paidBy: "shijie",

            splitStatus: "completed",

            splits: [
              {
                personId: "shijie",
                amount: 345
              },
              {
                personId: "xiaoying",
                amount: 345,
                settlementStatus:
                  "payment_due"
              }
            ]
          },

          {
            type: "expense",
            amount: 100,
            status: "active",

            paidBy: "xiaoying",

            splitStatus: "completed",

            splits: [
              {
                personId: "shijie",
                amount: 40,
                settlementStatus:
                  "payment_due"
              },
              {
                personId: "xiaoying",
                amount: 60
              }
            ]
          }
        ],
        []
      );

    assert.equal(
      summary.totalExpense,
      790
    );

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId: "xiaoying",
          toPersonId: "shijie",
          amount: 305
        }
      ]
    );

    assert.equal(
      summary.outstandingAmount,
      305
    );

    const shijie =
      summary.memberSummaries.find(
        item =>
          item.personId === "shijie"
      );

    const xiaoying =
      summary.memberSummaries.find(
        item =>
          item.personId === "xiaoying"
      );

    assert.equal(
      shijie.paidAmount,
      690
    );

    assert.equal(
      shijie.shareAmount,
      385
    );

    assert.equal(
      shijie.netAmount,
      305
    );

    assert.equal(
      shijie.currentNetAmount,
      305
    );

    assert.equal(
      xiaoying.paidAmount,
      100
    );

    assert.equal(
      xiaoying.shareAmount,
      405
    );

    assert.equal(
      xiaoying.netAmount,
      -305
    );
  }
);

// ============================================================
// Multiple Actual Payers
// ============================================================

test(
  "同一筆消費可由多人付款並依最終負擔計算個人淨額",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            transactionId:
              "tx-dinner",

            type:
              "expense",

            amount:
              1000,

            status:
              "active",

            payments: [
              {
                personId:
                  "xiaoying",
                amount:
                  350
              },
              {
                personId:
                  "shijie",
                amount:
                  350
              },
              {
                personId:
                  "xiaohuang",
                amount:
                  300
              }
            ],

            splitStatus:
              "completed",

            splits: [
              {
                personId:
                  "xiaoying",
                amount:
                  250
              },
              {
                personId:
                  "shijie",
                amount:
                  250
              },
              {
                personId:
                  "xiaohuang",
                amount:
                  250
              },
              {
                personId:
                  "azhe",
                amount:
                  250
              }
            ]
          }
        ],
        []
      );

    assert.equal(
      summary.totalExpense,
      1000
    );

    const byId =
      new Map(
        summary.memberSummaries.map(
          item => [
            item.personId,
            item
          ]
        )
      );

    assert.equal(
      byId.get("xiaoying")
        .paidAmount,
      350
    );

    assert.equal(
      byId.get("xiaoying")
        .shareAmount,
      250
    );

    assert.equal(
      byId.get("xiaoying")
        .netAmount,
      100
    );

    assert.equal(
      byId.get("shijie")
        .netAmount,
      100
    );

    assert.equal(
      byId.get("xiaohuang")
        .netAmount,
      50
    );

    assert.equal(
      byId.get("azhe")
        .netAmount,
      -250
    );

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "shijie",
          amount:
            100
        },
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "xiaoying",
          amount:
            100
        },
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "xiaohuang",
          amount:
            50
        }
      ]
    );

    assert.equal(
      summary.outstandingAmount,
      250
    );
  }
);

// ============================================================
// Global Settlement Plan
// ============================================================

test(
  "全車結算依應收池與應付池重新安排付款方向",
  () => {
    const transfers =
      buildSettlementPlan(
        [
          {
            personId:
              "shijie",
            netAmount:
              1500
          },
          {
            personId:
              "azhe",
            netAmount:
              1000
          },
          {
            personId:
              "xiaoying",
            netAmount:
              -500
          },
          {
            personId:
              "xiaohuang",
            netAmount:
              -1000
          },
          {
            personId:
              "xiaomei",
            netAmount:
              -500
          },
          {
            personId:
              "amin",
            netAmount:
              -500
          }
        ]
      );

    assert.deepEqual(
      transfers,
      [
        {
          fromPersonId:
            "xiaohuang",
          toPersonId:
            "shijie",
          amount:
            1000
        },
        {
          fromPersonId:
            "amin",
          toPersonId:
            "shijie",
          amount:
            500
        },
        {
          fromPersonId:
            "xiaomei",
          toPersonId:
            "azhe",
          amount:
            500
        },
        {
          fromPersonId:
            "xiaoying",
          toPersonId:
            "azhe",
          amount:
            500
        }
      ]
    );
  }
);

// ============================================================
// Partial Settlement
// ============================================================

test(
  "部分核銷只降低目前待結清金額並保留歷史付款與負擔",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            transactionId:
              "tx-partial",

            type:
              "expense",

            amount:
              1000,

            status:
              "active",

            payments: [
              {
                personId:
                  "a",
                amount:
                  1000
              }
            ],

            splitStatus:
              "completed",

            splits: [
              {
                personId:
                  "a",
                amount:
                  500
              },
              {
                personId:
                  "b",
                amount:
                  500
              }
            ]
          }
        ],
        [
          {
            status:
              "settled",

            fromPersonId:
              "b",

            toPersonId:
              "a",

            amount:
              300
          }
        ]
      );

    assert.equal(
      summary.totalExpense,
      1000
    );

    const a =
      summary.memberSummaries.find(
        item =>
          item.personId === "a"
      );

    const b =
      summary.memberSummaries.find(
        item =>
          item.personId === "b"
      );

    // 歷史資料保留
    assert.equal(
      a.paidAmount,
      1000
    );

    assert.equal(
      a.shareAmount,
      500
    );

    assert.equal(
      a.netAmount,
      500
    );

    // 已核銷 300，
    // 所以目前只剩應收 200
    assert.equal(
      a.currentNetAmount,
      200
    );

    assert.equal(
      a.receivableAmount,
      200
    );

    assert.equal(
      b.currentNetAmount,
      -200
    );

    assert.equal(
      b.payableAmount,
      200
    );

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId:
            "b",
          toPersonId:
            "a",
          amount:
            200
        }
      ]
    );

    assert.equal(
      summary.outstandingAmount,
      200
    );
  }
);

// ============================================================
// Fully Settled
// ============================================================

test(
  "全部核銷後待結清歸零但車團總支出與實際付款不歸零",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            transactionId:
              "tx-settled",

            type:
              "expense",

            amount:
              1000,

            status:
              "active",

            payments: [
              {
                personId:
                  "a",
                amount:
                  1000
              }
            ],

            splitStatus:
              "completed",

            splits: [
              {
                personId:
                  "a",
                amount:
                  500
              },
              {
                personId:
                  "b",
                amount:
                  500
              }
            ]
          }
        ],
        [
          {
            status:
              "settled",

            fromPersonId:
              "b",

            toPersonId:
              "a",

            amount:
              500
          }
        ]
      );

    assert.equal(
      summary.totalExpense,
      1000
    );

    assert.equal(
      summary.outstandingAmount,
      0
    );

    assert.deepEqual(
      summary.settlementTransfers,
      []
    );

    const a =
      summary.memberSummaries.find(
        item =>
          item.personId === "a"
      );

    const b =
      summary.memberSummaries.find(
        item =>
          item.personId === "b"
      );

    // 原始歷史仍完整保留
    assert.equal(
      a.paidAmount,
      1000
    );

    assert.equal(
      a.shareAmount,
      500
    );

    assert.equal(
      a.netAmount,
      500
    );

    // 只有目前待結清歸零
    assert.equal(
      a.currentNetAmount,
      0
    );

    assert.equal(
      b.currentNetAmount,
      0
    );

    assert.equal(
      a.receivableAmount,
      0
    );

    assert.equal(
      b.payableAmount,
      0
    );
  }
);

// ============================================================
// Pending Split
// ============================================================

test(
  "尚未分帳的支出保留實際付款但不提前進入成員結算",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            transactionId:
              "tx-pending",

            type:
              "expense",

            amount:
              600,

            status:
              "active",

            payments: [
              {
                personId:
                  "shijie",
                amount:
                  600
              }
            ],

            splitStatus:
              "pending",

            splits:
              []
          }
        ],
        []
      );

    assert.equal(
      summary.totalExpense,
      600
    );

    const shijie =
      summary.memberSummaries.find(
        item =>
          item.personId ===
          "shijie"
      );

    // 已經真的拿出去的錢仍要看得到
    assert.equal(
      shijie.paidAmount,
      600
    );

    // 尚未決定誰負擔，
    // 所以不能提前產生應收應付
    assert.equal(
      shijie.allocatedPaidAmount,
      0
    );

    assert.equal(
      shijie.shareAmount,
      0
    );

    assert.equal(
      shijie.netAmount,
      0
    );

    assert.equal(
      shijie.currentNetAmount,
      0
    );

    assert.equal(
      summary.outstandingAmount,
      0
    );

    assert.deepEqual(
      summary.settlementTransfers,
      []
    );
  }
);

// ============================================================
// Compatibility Alias
// ============================================================

test(
  "舊 obligationsByPair 欄位暫時相容新版全車結算方案",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            type:
              "expense",

            amount:
              300,

            status:
              "active",

            paidBy:
              "a",

            splitStatus:
              "completed",

            splits: [
              {
                personId:
                  "a",
                amount:
                  100
              },
              {
                personId:
                  "b",
                amount:
                  200
              }
            ]
          }
        ],
        []
      );

    assert.deepEqual(
      summary.obligationsByPair,
      summary.settlementTransfers
    );

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId:
            "b",
          toPersonId:
            "a",
          amount:
            200
        }
      ]
    );
  }
);