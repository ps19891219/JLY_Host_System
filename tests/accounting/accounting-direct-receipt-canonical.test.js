"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("canonical receiver can directly settle a legacy receiver obligation", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../../js/modules/accounting/accounting-repository.js"
    ),
    "utf8"
  );

  assert.match(
    source,
    /receiverSettle\s*\?\s*input\.actorPersonId === to\s*\|\|\s*input\.actorPersonId === canonicalToPersonId/
  );

  assert.match(
    source,
    /if\s*\(!allowed\s*\|\|\s*!from\s*\|\|\s*!to\)\s*throw new Error\("net_settlement_not_allowed"\)/
  );
});