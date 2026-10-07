"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findCarDetailViewsByScriptName
} = require("../../services/firebase/line-auto-binding-repository");

test("LINE auto-binding lookup is one bounded Prepared View query", async () => {
  const calls = [];
  const docs = [{
    id: "car-1",
    data: () => ({
      carId: "car-1",
      car: {
        id: "car-1",
        scriptName: "新月舊事"
      }
    })
  }];

  const db = {
    collection(name) {
      calls.push(["collection", name]);
      assert.equal(name, "carDetailViews");
      return {
        where(field, operator, value) {
          calls.push(["where", field, operator, value]);
          return {
            limit(size) {
              calls.push(["limit", size]);
              return {
                async get() {
                  calls.push(["get"]);
                  return { docs };
                }
              };
            }
          };
        }
      };
    }
  };

  const rows = await findCarDetailViewsByScriptName("新月舊事", {
    db,
    limit: 8
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].preparedRead, true);
  assert.deepEqual(calls, [
    ["collection", "carDetailViews"],
    ["where", "car.scriptName", "==", "新月舊事"],
    ["limit", 8],
    ["get"]
  ]);
});
