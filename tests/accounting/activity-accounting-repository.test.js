"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepository } = require("../../services/firebase/activity-accounting-repository");

function fakeFirestore(seed = {}) {
  const store = new Map(Object.entries(seed));
  class Ref {
    constructor(path) { this.path = path; this.id = path.split("/").pop(); }
    collection(name) { return new Collection(`${this.path}/${name}`); }
  }
  class Collection {
    constructor(path, filters = []) { this.path = path; this.filters = filters; }
    doc(id) { return new Ref(`${this.path}/${id}`); }
    where(field, _operator, value) { return new Collection(this.path, [...this.filters, [field, value]]); }
    async get() { return querySnapshot(this); }
  }
  function documentSnapshot(ref) { const data = store.get(ref.path); return { id: ref.id, exists: Boolean(data), data: () => data }; }
  function querySnapshot(query) {
    const prefix = `${query.path}/`;
    const docs = [...store.entries()].filter(([path, data]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/") && query.filters.every(([field,value]) => data[field] === value)).map(([path]) => documentSnapshot(new Ref(path)));
    return { docs };
  }
  const db = {
    collection(name) { return new Collection(name); },
    async runTransaction(callback) {
      return callback({
        get(target) { return target instanceof Ref ? Promise.resolve(documentSnapshot(target)) : Promise.resolve(querySnapshot(target)); },
        set(ref, data) { store.set(ref.path, JSON.parse(JSON.stringify(data))); }
      });
    }
  };
  return { db, store };
}

function pendingTransaction(overrides = {}) {
  return { transactionId:"tx-1",activityId:"car-99",carId:"car-99",createdBy:"creator",paidBy:"payer",title:"晚餐",amount:600,createdAt:"2026-08-13T01:00:00.000Z",...overrides };
}

test("repository stores one canonical transaction and its pending split action atomically", async () => {
  const fake = fakeFirestore();
  const repository = createRepository({db:fake.db,now:()=>"2026-08-13T02:00:00.000Z"});
  const saved = await repository.saveTransaction(pendingTransaction(),{accountingManagerPersonId:"manager"});
  assert.equal(saved.transactionId,"tx-1");
  assert.equal(saved.description,"晚餐");
  assert.equal(saved.pendingActionIds.length,1);
  assert.equal(fake.store.get("cars/car-99/accountingEntries/tx-1").schemaVersion,1);
  const action = fake.store.get(`cars/car-99/accountingPendingActions/${saved.pendingActionIds[0]}`);
  assert.equal(action.actionType,"pending_split");
  assert.equal(action.responsiblePersonId,"manager");
});

test("finishing a split completes old pending action and creates payment due actions", async () => {
  const fake = fakeFirestore();
  let clock = "2026-08-13T02:00:00.000Z";
  const repository = createRepository({db:fake.db,now:()=>clock});
  const first = await repository.saveTransaction(pendingTransaction(),{accountingManagerPersonId:"manager"});
  clock = "2026-08-13T03:00:00.000Z";
  const second = await repository.saveTransaction(pendingTransaction({splitStatus:"completed",splits:[{personId:"payer",amount:300},{personId:"friend",amount:300}]}),{accountingManagerPersonId:"manager"});
  const oldAction = fake.store.get(`cars/car-99/accountingPendingActions/${first.pendingActionIds[0]}`);
  assert.equal(oldAction.status,"completed");
  assert.equal(oldAction.history.at(-1).status,"completed");
  assert.equal(second.pendingActionIds.length,1);
  const due = fake.store.get(`cars/car-99/accountingPendingActions/${second.pendingActionIds[0]}`);
  assert.equal(due.actionType,"payment_due");
  assert.equal(due.responsiblePersonId,"friend");
});

test("pending action query can be limited to the responsible person", async () => {
  const fake = fakeFirestore();
  const repository = createRepository({db:fake.db,now:()=>"2026-08-13T02:00:00.000Z"});
  await repository.saveTransaction(pendingTransaction(),{accountingManagerPersonId:"manager"});
  assert.equal((await repository.listPendingActions("car-99","manager")).length,1);
  assert.equal((await repository.listPendingActions("car-99","someone-else")).length,0);
});
