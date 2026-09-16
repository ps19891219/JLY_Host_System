"use strict";

const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "../../pages/mycar.html"), "utf8");
const mycar = fs.readFileSync(path.join(__dirname, "../../js/mycar.js"), "utf8");
const view = fs.readFileSync(path.join(__dirname, "../../js/data-view/mycar-view.js"), "utf8");
const membershipSync = fs.readFileSync(path.join(__dirname, "../../js/data-view/membership-view-sync.js"), "utf8");
const impactResolver = fs.readFileSync(path.join(__dirname, "../../js/data-view/view-impact-resolver.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!html.includes("mycar-legacy-identity-repair.js"), "normal MyCar page must not rebuild identity/view");
assert(mycar.includes("car.isHost === true"), "host classification must use prepared host role");
assert(mycar.includes('car.role || ""'), "host classification may consume prepared role");
assert(mycar.includes('car.ownerType || ""'), "host classification may consume prepared ownerType");
assert(mycar.includes("!isMyHostCar(car) &&"), "non-host/player classification must never duplicate host cars");
assert(mycar.includes("car.isPlayer === true"), "player classification must use prepared player role");
assert(mycar.includes("await module.read("), "normal MyCar runtime must read prepared view");
assert(!mycar.includes('collection("cars")'), "normal MyCar runtime must not scan cars core");

for (const field of ["personId", "identityId", "memberId", "linkedPlayerIds"]) {
  assert(membershipSync.includes(field), `membership sync must preserve historical ${field}`);
}
assert(membershipSync.includes('startsWith("line:")'), "synthetic LINE ids must not become formal membership identity");
assert(!membershipSync.includes('collection("cars")'), "membership mutation sync must remain bounded and never scan cars core");

assert(impactResolver.includes('result.add("mycar")'), "unknown car mutations must keep MyCar prepared view in sync");
for (const field of ["ownerPersonId", "ownerProfileId", "hostId", "hostPersonId", "hostProfileId", "createdByPersonId"]) {
  assert(impactResolver.includes(field), `MyCar impact resolver must recognize ${field}`);
}

/* Projection contract: these formal fields must be supported before this PR can merge. */
for (const field of ["personId", "identityId", "memberId", "linkedPlayerIds"]) {
  assert(view.includes(field), `MyCar prepared projection must preserve historical ${field}`);
}
for (const field of ["ownerPersonId", "ownerProfileId", "hostId", "hostPersonId", "hostProfileId", "createdByPersonId"]) {
  assert(view.includes(field), `MyCar host projection must recognize ${field}`);
}

console.log("PASS mycar-host-nonhost-contract");
