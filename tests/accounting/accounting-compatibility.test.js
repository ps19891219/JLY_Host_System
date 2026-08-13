"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { upgradeLegacyEntry, toLegacyAccountingAliases } = require("../../services/accounting/compatibility");

test("legacy car entry upgrades in place to the activity transaction schema", () => {
  const result = upgradeLegacyEntry({
    id:"line-message-1", carId:"car-99", type:"expense", description:"晚餐", amount:690,
    actorMemberId:"member-shijie", payerMemberId:"member-xiaowen", splitStatus:"completed",
    shares:[{memberId:"member-shijie",displayName:"詩婕",amount:300},{memberId:"member-xiaowen",displayName:"小霙",amount:390}],
    createdAt:"2026-08-13T01:00:00.000Z"
  });
  assert.equal(result.status,"ready");
  assert.equal(result.transaction.transactionId,"line-message-1");
  assert.equal(result.transaction.activityId,"car-99");
  assert.equal(result.transaction.createdBy,"member-shijie");
  assert.equal(result.transaction.paidBy,"member-xiaowen");
  assert.deepEqual(result.transaction.splits.map(split=>split.personId),["member-shijie","member-xiaowen"]);
});

test("legacy entry without formal identities is preserved for later resolution", () => {
  const result = upgradeLegacyEntry({id:"old-1",carId:"car-99",description:"舊帳",amount:100,userId:"U-line-only"});
  assert.equal(result.status,"identity_resolution_required");
  assert.deepEqual(result.missingFields,["createdBy","paidBy"]);
  assert.equal(result.legacyEntry.userId,"U-line-only");
});

test("canonical transaction exposes temporary aliases for the current accounting view", () => {
  const upgraded = upgradeLegacyEntry({id:"entry-1",carId:"car-1",description:"停車",amount:200,actorMemberId:"a",payerMemberId:"a",splitStatus:"completed",shares:[{memberId:"a",amount:100},{memberId:"b",amount:100}]}).transaction;
  const aliases = toLegacyAccountingAliases(upgraded);
  assert.equal(aliases.description,"停車");
  assert.equal(aliases.payerMemberId,"a");
  assert.equal(aliases.shares[1].memberId,"b");
});
