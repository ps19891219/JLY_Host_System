"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const pending =
  require(
    "../../js/modules/pending/pending-actions"
  );

test(
  "registration summary separates player and DM pending applications",
  function () {
    const result =
      pending
        .buildRegistrationSummary(
          [
            {
              id: "car-1",
              applications: [
                {
                  name: "玩家A",
                  status:
                    "pending"
                },
                {
                  name: "已處理",
                  status:
                    "approved"
                }
              ],
              dmApplications: [
                {
                  displayName:
                    "DM A",
                  status:
                    "pending"
                }
              ]
            }
          ]
        );

    assert.equal(
      result.total,
      2
    );

    assert.equal(
      result.playerCount,
      1
    );

    assert.equal(
      result.dmCount,
      1
    );
  }
);

test(
  "legacy player application without status is still treated as pending",
  function () {
    const result =
      pending
        .getPendingPlayerApplications(
          {
            applications: [
              {
                name:
                  "舊資料玩家"
              }
            ]
          }
        );

    assert.equal(
      result.length,
      1
    );
  }
);

test(
  "approved and rejected DM applications do not appear in pending summary",
  function () {
    const result =
      pending
        .buildRegistrationSummary(
          [
            {
              id: "car-1",
              dmApplications: [
                {
                  status:
                    "approved"
                },
                {
                  status:
                    "rejected"
                }
              ]
            }
          ]
        );

    assert.equal(
      result.total,
      0
    );
  }
);
