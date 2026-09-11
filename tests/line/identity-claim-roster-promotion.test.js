"use strict";

const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("js/modules/car/detail/application/identity-claim-approval.js", "utf8");
const page = fs.readFileSync("pages/car-detail.html", "utf8");

assert(source.includes("function promotedRosterPersonPayload"), "legacy roster claims must be promotable to a formal Person");
assert(source.includes('source: "legacy_roster_promoted_by_host_approved_line_claim"'), "promoted Person must record its source");
assert(source.includes("promotedFromLegacyRoster: true"), "promoted Person must carry an explicit audit flag");
assert(source.includes("promotedFromCarId: carId()"), "promotion must record the source car");
assert(source.includes("createPerson: targetPerson.create === true"), "existing claim resolution must distinguish newly promoted Person creation");
assert(source.includes("resolved.createPerson ? null : await transaction.get(personRef)"), "promotion must not require a pre-existing Person document");
assert(source.includes("updateExistingRosterIdentity(freshTarget, latestPerson, current)"), "promotion must rewrite the exact roster slot to the formal Person ID");
assert(source.includes("strongIdentityConflictFields"), "promotion must preserve strong identity conflict protection");
assert(source.includes("duplicateLineRepairPatch"), "promotion must preserve duplicate LINE identity repair");
assert(!source.includes("請先用 Member Picker 串回正式 Person"), "explicit host-approved existing roster claims must not be bounced to Member Picker");
assert(page.includes("identity-claim-approval.js?v=3"), "car detail cache version must advance for roster promotion");

console.log("identity-claim-roster-promotion.test.js passed");
