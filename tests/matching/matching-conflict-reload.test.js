"use strict";
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

(async () => {
  let reads = 0;
  const context = {
    console,
    window: {
      JLYMatchingData: {
        async getConflictCars() {
          reads += 1;
          return [{ id: `existing-${reads}`, gameDate: "2027-10-04", gameTime: "19:00", scriptName: `車 ${reads}` }];
        }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/matching/matching-conflict.js", "utf8"), context);

  const slot = [{ id: "s1", date: "2027-10-04", time: "19:00" }];
  const first = await context.window.JLYMatchingConflict.applyConflicts(slot, "car-a");
  const second = await context.window.JLYMatchingConflict.applyConflicts(slot, "car-b");

  assert.strictEqual(reads, 2, "each car conflict pass must reload current cars");
  assert.strictEqual(first[0].conflicts[0].id, "existing-1");
  assert.strictEqual(second[0].conflicts[0].id, "existing-2");
  console.log("matching conflict reload test passed");
})().catch(error => { console.error(error); process.exit(1); });
