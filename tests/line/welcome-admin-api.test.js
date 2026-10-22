"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../../api/line-welcome-admin");

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}
function request(url, authorization, method = "GET") {
  return {method, url, headers: authorization ? {authorization} : {}};
}
const token = "Bearer test.token";
const admin = {getAdminApp: () => ({auth: () => ({verifyIdToken: async () => ({admin: true})})})};
const regular = {getAdminApp: () => ({auth: () => ({verifyIdToken: async () => ({admin: false})})})};

test("rejects requests without a verified admin token", async () => {
  const res = response();
  await handler(request("/api/line-welcome-admin"), res, {
    ...admin,
    listWelcomeGroups: async () => { throw new Error("must not read"); }
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "admin_required");
});

test("rejects signed-in non-admins without reading any group data", async () => {
  const res = response();
  await handler(request("/api/line-welcome-admin", token), res, {
    ...regular,
    listWelcomeGroups: async () => { throw new Error("must not read"); }
  });
  assert.equal(res.statusCode, 403);
});

test("reads paginated group summaries only for verified admin", async () => {
  const res = response();
  await handler(request("/api/line-welcome-admin?cursor=G123&limit=500", token), res, {
    ...admin,
    listWelcomeGroups: async (limit, cursor) => {
      assert.equal(limit, 50);
      assert.equal(cursor, "G123");
      return {groups: [{groupId: "G456"}], nextId: ""};
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.groups[0].groupId, "G456");
});

test("reads a single group audit page with a cursor", async () => {
  const res = response();
  await handler(request("/api/line-welcome-admin?groupId=G456&cursor=event1", token), res, {
    ...admin,
    listWelcomeChanges: async (groupId, limit, cursor) => {
      assert.equal(groupId, "G456");
      assert.equal(limit, 20);
      assert.equal(cursor, "event1");
      return {changes: [{id: "event2", actorId: "U1"}], nextId: ""};
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.changes[0].actorId, "U1");
});

test("rejects mutations without touching audit data", async () => {
  const res = response();
  await handler(request("/api/line-welcome-admin", token, "POST"), res, admin);
  assert.equal(res.statusCode, 405);
});
