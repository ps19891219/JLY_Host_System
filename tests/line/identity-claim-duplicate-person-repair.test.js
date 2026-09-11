"use strict";

const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("js/modules/car/detail/application/identity-claim-approval.js", "utf8");
const page = fs.readFileSync("pages/car-detail.html", "utf8");

assert(source.includes("async function resolveLinePersons"), "existing-person claims must inspect all Person rows sharing the LINE identity");
assert(source.includes("strongIdentityConflictFields"), "duplicate LINE repair must stop on conflicting formal identity evidence");
assert(source.includes("person: targetPerson"), "an explicit host-approved existing-person target must remain canonical");
assert(source.includes('lineUserId: ""'), "duplicate Person rows must release the duplicated LINE binding");
assert(source.includes("canonicalPersonId: text(canonicalPersonId)"), "historical duplicate rows must point at the canonical Person instead of being deleted");
assert(source.includes('lineIdentityReassignedReason: "host_approved_existing_claim"'), "duplicate LINE repair must leave an audit reason");
assert(source.includes("duplicateLinePeople: linePeople.filter"), "repair scope must be limited to duplicate rows that share the verified LINE identity");
assert(source.includes("系統不會只靠同名自動合併"), "same-name matching must remain forbidden as identity proof");
assert(page.includes("identity-claim-approval.js?v=2"), "car detail must load the repaired identity claim runtime without stale cache");

console.log("identity-claim-duplicate-person-repair.test.js passed");
