const test = require("node:test");
const assert = require("node:assert/strict");
const accountingData = require("../../js/modules/accounting/accounting-data");

test("collectActivityMembers merges formal owner, player, and staff identities", () => {
  const members = accountingData.collectActivityMembers({
    ownerId: "owner-1",
    ownerName: "詩婕",
    players: [
      { playerId: "player-1", playerName: "小霙" },
      { playerId: "shared-1", playerName: "共同成員" },
      { playerId: "cancelled-1", playerName: "取消玩家", status: "cancelled" },
      { playerName: "沒有正式 ID" }
    ],
    staffSlots: [
      { memberId: "staff-1", displayName: "DM" },
      { memberId: "shared-1", displayName: "共同成員" }
    ]
  });

  assert.deepEqual(members.map(item => item.personId), ["owner-1", "player-1", "shared-1", "staff-1"]);
  assert.deepEqual(members.find(item => item.personId === "shared-1").roles, ["player", "staff"]);
  assert.equal(members.find(item => item.personId === "staff-1").usesSystem, false);
});

test("registration identity does not enable personal accounting by itself", () => {
  const members=accountingData.collectActivityMembers({ownerId:"host",players:[{memberId:"registered-1",profileId:"profile-1",lineUserId:"U-registration",playerName:"燕餃"},{memberId:"active-1",playerName:"小霙",accountingSelfServiceEnabled:true}]});
  assert.equal(members.find(item=>item.personId==="registered-1").usesSystem,false);
  assert.equal(members.find(item=>item.personId==="active-1").usesSystem,true);
  const current=accountingData.resolveCurrentActivityMember(members,{identityIds:["registered-1"],displayName:"燕餃"});
  assert.equal(current.usesSystem,true);
});

test("buildQuickTransaction creates one pending Activity transaction and separates creator from payer", () => {
  const transaction = accountingData.buildQuickTransaction({ transactionId: "web-1", carId: "car-99", title: "晚餐", amount: 1680, createdBy: "member-shijie", paidBy: "member-xiaoying" }, "2026-08-13T01:00:00.000Z");
  assert.equal(transaction.activityId, "car-99");
  assert.equal(transaction.activityType, "car");
  assert.equal(transaction.villageType, "script_village");
  assert.equal(transaction.createdBy, "member-shijie");
  assert.equal(transaction.paidBy, "member-xiaoying");
  assert.equal(transaction.splitStatus, "pending");
  assert.equal(transaction.settlementStatus, "pending");
  assert.equal(transaction.amount, 1680);
});

test("buildQuickTransaction rejects missing formal creator identity", () => {
  assert.throws(() => accountingData.buildQuickTransaction({ transactionId: "web-2", carId: "car-99", title: "停車費", amount: 200, createdBy: "" }), /quick_transaction_invalid/);
});

test("current profile resolves to an older linked car identity and keeps the person's name", () => {
  const members = accountingData.collectActivityMembers({
    ownerId: "old-jly-identity",
    organizerName: "凱崴私團"
  });
  members[0].identityIds.push("profile-shijie");

  const current = accountingData.resolveCurrentActivityMember(members, {
    identityIds: ["profile-shijie", "old-jly-identity"],
    displayName: "詩婕"
  });

  assert.equal(current.personId, "old-jly-identity");
  assert.equal(current.displayName, "詩婕");
  assert.notEqual(current.displayName, "凱崴私團");
});

test("current formal identity links owner and legacy player member records without using display name",()=>{
  const members=[
    {personId:"owner-id",identityIds:["owner-id"],displayName:"詩婕",roles:["owner"]},
    {personId:"legacy-player-id",identityIds:["legacy-player-id"],displayName:"詩婕",roles:["player"]},
    {personId:"same-name-other",identityIds:["same-name-other"],displayName:"詩婕",roles:["player"]}
  ],linked=accountingData.linkCurrentIdentityToActivityMembers(members,{identityIds:["owner-id","legacy-player-id","profile-id"]});
  assert.deepEqual(linked[0].identityIds,["owner-id","legacy-player-id","profile-id"]);
  assert.deepEqual(linked[1].identityIds,["legacy-player-id","owner-id","profile-id"]);
  assert.deepEqual(linked[2].identityIds,["same-name-other"]);
});

test("a formally matched identity replaces only the owner role placeholder",()=>{
  const linked=accountingData.linkCurrentIdentityToActivityMembers([{personId:"owner-id",identityIds:["owner-id"],displayName:"車團主揪",roles:["owner"]}],{identityIds:["owner-id","profile-id"],displayName:"詩婕"});
  assert.equal(linked[0].displayName,"詩婕");assert.deepEqual(linked[0].identityIds,["owner-id","profile-id"]);
});

test("getCurrentIdentity includes profile, device, and linked identities", () => {
  const values = new Map([
    ["currentPlayerProfileId", "profile-shijie"],
    ["currentPlayerId", "device-shijie"],
    ["currentPlayerName", "詩婕"],
    ["linkedPlayerIds", JSON.stringify(["old-jly-identity"])]
  ]);
  const identity = accountingData.getCurrentIdentity({ getItem: key => values.get(key) || "" });
  assert.deepEqual(identity.identityIds, ["profile-shijie", "device-shijie", "old-jly-identity"]);
  assert.equal(identity.displayName, "詩婕");
});

test("browser equal split assigns the remainder to the last selected member", () => {
  const splits = accountingData.buildEqualSplits([
    { personId: "a", displayName: "詩婕" },
    { personId: "b", displayName: "小霙" },
    { personId: "c", displayName: "玩家 A" }
  ], 100, "a");
  assert.deepEqual(splits.map(split => split.amount), [33, 33, 34]);
  assert.equal(splits[0].settlementStatus, "settled");
  assert.equal(splits[1].settlementStatus, "payment_due");
});

test("browser custom split must equal the transaction amount", () => {
  const people = [{ personId: "a", displayName: "詩婕" }, { personId: "b", displayName: "小霙" }];
  assert.throws(() => accountingData.buildCustomSplits(people, { a: 300, b: 380 }, 690, "a"), /split_total_mismatch/);
  assert.deepEqual(accountingData.buildCustomSplits(people, { a: 310, b: 380 }, 690, "a").map(split => split.amount), [310, 380]);
});

test("browser settlement requires debtor claim and receiver confirmation", () => {
  const due={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_due"};
  const claimed=accountingData.transitionSettlement(due,"claim","b","a","2026-08-13T02:00:00.000Z");
  assert.equal(claimed.settlementStatus,"payment_claimed");
  assert.throws(()=>accountingData.transitionSettlement(claimed,"confirm","b","a"),/settlement_action_not_allowed/);
  assert.equal(accountingData.transitionSettlement(claimed,"confirm","a","a").settlementStatus,"settled");
});

test("browser payment claim can be withdrawn or rejected", () => {
  const claimed={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_claimed",paymentClaimedBy:"b"};
  assert.equal(accountingData.transitionSettlement(claimed,"withdraw","b","a").settlementStatus,"payment_due");
  assert.equal(accountingData.transitionSettlement(claimed,"reject","a","a").settlementStatus,"settlement_rejected");
});

test("accounting list classifies the current person's next action", () => {
  const base={splitStatus:"completed",paidBy:"a",settlementStatus:"payment_due",splits:[{personId:"b",settlementStatus:"payment_due"}]};
  assert.equal(accountingData.transactionFilterState(base,"b"),"payment_due");
  assert.equal(accountingData.transactionFilterState({...base,splits:[{personId:"b",settlementStatus:"payment_claimed"}]},"a"),"payment_confirmation");
  assert.equal(accountingData.transactionFilterState({splitStatus:"pending"},"a"),"pending_split");
  assert.equal(accountingData.transactionFilterState({splitStatus:"completed",settlementStatus:"settled",splits:[{personId:"a",settlementStatus:"settled"}]},"a"),"settled");
});

test("accounting list filters pending and settled transactions without copying data", () => {
  const rows=[{transactionId:"1",splitStatus:"pending"},{transactionId:"2",splitStatus:"completed",settlementStatus:"settled",splits:[{personId:"a",settlementStatus:"settled"}]}];
  assert.deepEqual(accountingData.filterTransactions(rows,"pending","a").map(row=>row.transactionId),["1"]);
  assert.strictEqual(accountingData.filterTransactions(rows,"all","a")[0],rows[0]);
});

test("manager can record a debtor payment without pretending to be the debtor", () => {
  const due={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_due"};
  const claimed=accountingData.transitionSettlement(due,"manager_claim","host","a","2026-08-13T03:00:00.000Z","host");
  assert.equal(claimed.settlementStatus,"payment_claimed");
  assert.equal(claimed.paymentClaimedBy,"b");
  assert.equal(claimed.paymentRecordedBy,"host");
  assert.equal(claimed.paymentRecordSource,"manager");
});

test("actual receiver can directly record received payment", () => {
  const due={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_due"};
  const settled=accountingData.transitionSettlement(due,"receiver_settle","a","a","2026-08-13T03:00:00.000Z","a");
  assert.equal(settled.settlementStatus,"settled");
  assert.equal(settled.confirmedBy,"a");
  assert.throws(()=>accountingData.transitionSettlement(due,"receiver_settle","outsider","a",undefined,"host"),/settlement_action_not_allowed/);
});

test("manager can settle on behalf of the receiver with explicit authority history", () => {
  const due={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_due"};
  const settled=accountingData.transitionSettlement(due,"receiver_settle","host","a","2026-08-13T04:00:00.000Z","host");
  assert.equal(settled.settlementStatus,"settled");
  assert.equal(settled.confirmedBy,"host");
  assert.equal(settled.confirmationAuthority,"manager");
  assert.equal(settled.paymentRecordSource,"manager_override");
});

test("transaction is not fully settled while any split remains unpaid", () => {
  const transaction={splitStatus:"completed",settlementStatus:"settled",splits:[{personId:"a",settlementStatus:"settled"},{personId:"b",settlementStatus:"payment_due"}]};
  assert.equal(accountingData.transactionFilterState(transaction,"a"),"pending_other");
});

test("net settlement offsets debts across transactions and shows final transfers", () => {
  const transactions = [
    { transactionId:"dinner",status:"active",splitStatus:"completed",paidBy:"shijie",splits:[{personId:"shijie",amount:300,settlementStatus:"settled"},{personId:"xiaoying",amount:300,settlementStatus:"payment_due"}] },
    { transactionId:"parking",status:"active",splitStatus:"completed",paidBy:"xiaoying",splits:[{personId:"shijie",amount:100,settlementStatus:"payment_due"},{personId:"xiaoying",amount:100,settlementStatus:"settled"}] }
  ];
  const result = accountingData.calculateNetSettlement(transactions);
  assert.deepEqual(result.transfers,[{fromPersonId:"xiaoying",toPersonId:"shijie",amount:200}]);
});

test("net settlement ignores pending split, deleted, and already settled obligations", () => {
  const transactions = [
    { splitStatus:"pending",paidBy:"a",splits:[{personId:"b",amount:500,settlementStatus:"payment_due"}] },
    { status:"deleted",splitStatus:"completed",paidBy:"a",splits:[{personId:"b",amount:300,settlementStatus:"payment_due"}] },
    { status:"active",splitStatus:"completed",paidBy:"a",splits:[{personId:"b",amount:200,settlementStatus:"settled"}] }
  ];
  assert.deepEqual(accountingData.calculateNetSettlement(transactions).transfers,[]);
});

test("stored activity balances recreate the same net transfer without reading transactions", () => {
  assert.deepEqual(accountingData.netSettlementFromBalances([
    {personId:"shijie",balance:200},
    {personId:"xiaoying",balance:-200}
  ]).transfers,[{fromPersonId:"xiaoying",toPersonId:"shijie",amount:200}]);
});

test("personal settlement only returns money involving the selected person", () => {
  const personal=accountingData.personalSettlement({transfers:[{fromPersonId:"a",toPersonId:"b",amount:200},{fromPersonId:"c",toPersonId:"d",amount:500}]},"a");
  assert.equal(personal.payable,200);
  assert.equal(personal.receivable,0);
  assert.equal(personal.transfers.length,1);
});

test("我的帳務依 canonical Person 逐人互抵並保留整體摘要",()=>{
  const obligations=[
    {fromPersonId:"xiaowu",toPersonId:"me",amount:100},{fromPersonId:"me",toPersonId:"legacy-xiaowu",amount:50},
    {fromPersonId:"aliang",toPersonId:"me",amount:200},{fromPersonId:"me",toPersonId:"aliang",amount:100},
    {fromPersonId:"xiaojie",toPersonId:"me",amount:100},{fromPersonId:"xiaoyun",toPersonId:"me",amount:150},
    {fromPersonId:"xiaoling",toPersonId:"me",amount:100},{fromPersonId:"me",toPersonId:"xiaoling",amount:300}
  ],canonical=id=>id==="legacy-xiaowu"?"xiaowu":id,result=accountingData.personalAccountingProjection(obligations,"me",canonical);
  assert.equal(result.receivableTotal,650);assert.equal(result.payableTotal,450);assert.equal(result.direction,"receivable");assert.equal(result.netAmount,200);
  assert.deepEqual(result.people.map(item=>[item.personId,item.direction,item.amount]),[["aliang","receivable",100],["xiaojie","receivable",100],["xiaoling","payable",200],["xiaowu","receivable",50],["xiaoyun","receivable",150]]);
});

test("personal obligations keep gross payable and receivable before netting", () => {
  const result=accountingData.personalObligations([{fromPersonId:"a",toPersonId:"b",amount:300},{fromPersonId:"b",toPersonId:"a",amount:100},{fromPersonId:"c",toPersonId:"d",amount:500}],"a");
  assert.equal(result.payableTotal,300);
  assert.equal(result.receivableTotal,100);
  assert.equal(result.payable.length,1);
  assert.equal(result.receivable.length,1);
});

test("manager cannot operate payment confirmation for a system user", () => {
  const due={splitId:"split-b",personId:"b",amount:300,settlementStatus:"payment_due"};
  assert.throws(()=>accountingData.transitionSettlement(due,"manager_claim","host","a",undefined,"host",true),/settlement_action_not_allowed/);
  assert.equal(accountingData.transitionSettlement(due,"manager_claim","host","a",undefined,"host",false).settlementStatus,"payment_claimed");
});

test("net settlement never creates a transfer from a person to themselves", () => {
  const result=accountingData.netSettlementFromBalances([{personId:"shijie",balance:25},{personId:"shijie",balance:-25}]);
  assert.equal(result.transfers.some(item=>item.fromPersonId===item.toPersonId),false);
});

test("pairwise settlement only offsets debts between the same two people", () => {
  const result=accountingData.netSettlementFromObligations([
    {fromPersonId:"shijie",toPersonId:"yanjiao",amount:100},
    {fromPersonId:"yanjiao",toPersonId:"shijie",amount:40},
    {fromPersonId:"xiaoying",toPersonId:"shijie",amount:80}
  ]);
  assert.deepEqual(result.transfers,[
    {fromPersonId:"shijie",toPersonId:"yanjiao",amount:60},
    {fromPersonId:"xiaoying",toPersonId:"shijie",amount:80}
  ]);
});

test("Activity identity normalization follows linked identities across owner and legacy player records", () => {
  const members = [
    { personId:"owner-person", identityIds:["owner-person","profile-person"], displayName:"詩婕", roles:["owner"] },
    { personId:"legacy-player", identityIds:["legacy-player","profile-person"], displayName:"詩婕", roles:["player"] }
  ];
  const component = accountingData.activityIdentityComponent(members,["legacy-player"]);
  assert.deepEqual([...component].sort(),["legacy-player","owner-person","profile-person"]);
  assert.equal(accountingData.canonicalActivityPersonId(members,"legacy-player"),"owner-person");
  const current = accountingData.resolveCurrentActivityMember(members,{identityIds:["legacy-player"],displayName:"詩婕"});
  assert.equal(accountingData.canonicalActivityPersonId(members,current.personId),"owner-person");
  assert.deepEqual(current.roles.sort(),["owner","player"]);
});
