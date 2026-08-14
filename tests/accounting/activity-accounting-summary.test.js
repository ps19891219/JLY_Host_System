"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  buildActivityAccountingSummary
} =
  require(
    "../../services/accounting/activity-accounting-summary"
  );

// ============================================================
// Legacy single payer
// ============================================================

test(
  "車團總帳依全車淨額產生結算方案",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            type: "expense",
            amount: 690,
            status: "active",
            paidBy: "shijie",
            splitStatus:
              "completed",
            splits: [
              {
                personId:
                  "shijie",
                amount: 345
              },
              {
                personId:
                  "xiaoying",
                amount: 345
              }
            ]
          },

          {
            type: "expense",
            amount: 100,
            status: "active",
            paidBy: "xiaoying",
            splitStatus:
              "completed",
            splits: [
              {
                personId:
                  "shijie",
                amount: 40
              },
              {
                personId:
                  "xiaoying",
                amount: 60
              }
            ]
          }
        ],
        []
      );

    assert.equal(
      summary.summaryVersion,
      2
    );

    assert.equal(
      summary.totalExpense,
      790
    );

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId:
            "xiaoying",

          toPersonId:
            "shijie",

          amount: 305
        }
      ]
    );

    assert.equal(
      summary.outstandingAmount,
      305
    );

    assert.equal(
      summary.memberSummaries
        .find(
          item =>
            item.personId ===
            "shijie"
        )
        .paidAmount,
      690
    );
  }
);

// ============================================================
// Multiple Payers
// ============================================================

test(
  "同一筆消費可以由多人付款並依全車淨額結算",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            type: "expense",
            amount: 1000,
            status: "active",

            payments: [
              {
                personId:
                  "xiaoying",
                amount: 350
              },
              {
                personId:
                  "shijie",
                amount: 350
              },
              {
                personId:
                  "xiaohuang",
                amount: 300
              }
            ],

            splitStatus:
              "completed",

            splits: [
              {
                personId:
                  "xiaoying",
                amount: 250
              },
              {
                personId:
                  "shijie",
                amount: 250
              },
              {
                personId:
                  "xiaohuang",
                amount: 250
              },
              {
                personId:
                  "azhe",
                amount: 250
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

    assert.deepEqual(
      summary.settlementTransfers,
      [
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "shijie",
          amount: 100
        },
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "xiaoying",
          amount: 100
        },
        {
          fromPersonId:
            "azhe",
          toPersonId:
            "xiaohuang",
          amount: 50
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
// Settlement keeps history
// ============================================================

test(
  "已確認核銷只清除待結清金額不刪除歷史總支出",
  () => {
    const summary =
      buildActivityAccountingSummary(
        [
          {
            type: "expense",
            amount: 300,
            status: "active",
            paidBy: "a",
            splitStatus:
              "completed",
            splits: [
              {
                personId: "b",
                amount: 300
              }
            ]
          }
        ],
        [
          {
            status: "settled",
            fromPersonId: "b",
            toPersonId: "a",
            amount: 300
          }
        ]
      );

    assert.equal(
      summary.totalExpense,
      300
    );

    assert.equal(
      summary.outstandingAmount,
      0
    );

    assert.deepEqual(
      summary.settlementTransfers,
      []
    );

    assert.equal(
      summary.memberSummaries
        .find(
          item =>
            item.personId ===
            "a"
        )
        .paidAmount,
      300
    );
  }
);