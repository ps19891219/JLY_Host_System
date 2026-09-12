"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  linkPlayerProfile,
  createHandler
} = require("../../api/line-login");

function makeDb(options = {}) {
  const existing = options.existing || null;
  const target = options.target || null;
  let targetWrites = 0;

  const collection = {
    where() {
      return {
        limit() {
          return {
            async get() {
              return existing
                ? {
                    empty: false,
                    docs: [{
                      id: existing.id,
                      data: () => ({ ...existing.data })
                    }]
                  }
                : { empty: true, docs: [] };
            }
          };
        }
      };
    },
    doc(id) {
      return {
        async get() {
          if (!target || target.id !== id) return { exists: false, data: () => ({}) };
          return { exists: true, data: () => ({ ...target.data }) };
        },
        async set() { targetWrites += 1; }
      };
    }
  };

  return {
    collection(name) {
      assert.equal(name, "players");
      return collection;
    },
    getTargetWrites() { return targetWrites; }
  };
}

function lineProfile() {
  return {
    userId: "U-existing-line",
    displayName: "詩婕 LINE",
    pictureUrl: "https://example.com/p.jpg"
  };
}

test("car entry recovers the existing LINE-linked profile instead of rebinding a temporary profile", async () => {
  const db = makeDb({
    existing: {
      id: "player-existing",
      data: {
        identityId: "person-existing",
        displayName: "詩婕"
      }
    },
    target: {
      id: "player-entry-temp",
      data: { identityId: "person-temp" }
    }
  });

  const result = await linkPlayerProfile(
    "player-entry-temp",
    "person-temp",
    lineProfile(),
    { db, recoverExistingLinkedProfile: true }
  );

  assert.deepEqual(result, {
    profileId: "player-existing",
    identityId: "person-existing",
    displayName: "詩婕",
    linked: true,
    recovered: true,
    provisional: false
  });
  assert.equal(db.getTargetWrites(), 0);
});

test("non-car login still rejects a LINE account linked to another profile", async () => {
  const db = makeDb({
    existing: {
      id: "player-existing",
      data: { identityId: "person-existing", displayName: "詩婕" }
    },
    target: {
      id: "player-other",
      data: { identityId: "person-other" }
    }
  });

  await assert.rejects(
    () => linkPlayerProfile(
      "player-other",
      "person-other",
      lineProfile(),
      { db, recoverExistingLinkedProfile: false }
    ),
    error => error && error.message === "line_already_linked" && error.statusCode === 409
  );
});

test("car player entry handler enables recovery and preserves the current car returnPath", async () => {
  let linkOptions = null;
  let responseBody = null;
  const handler = createHandler({
    stateSecret: "test-secret",
    verifyLoginState: () => ({
      valid: true,
      data: {
        purpose: "car_player_entry",
        playerProfileId: "player-entry-temp",
        identityId: "person-temp",
        returnPath: "/pages/car-view.html?id=car-123&entry=player&source=line_group"
      }
    }),
    exchangeAuthorizationCode: async () => "access-token",
    fetchLineProfile: async () => lineProfile(),
    linkPlayerProfile: async (_profileId, _identityId, _lineUser, options) => {
      linkOptions = options;
      return {
        profileId: "player-existing",
        identityId: "person-existing",
        displayName: "詩婕",
        linked: true,
        recovered: true,
        provisional: false
      };
    }
  });

  const headers = {};
  await handler(
    { method: "POST", body: { code: "oauth-code", state: "signed-state" } },
    {
      statusCode: 0,
      setHeader(name, value) { headers[name] = value; },
      end(body) { responseBody = JSON.parse(body); }
    }
  );

  assert.equal(linkOptions.allowVerifiedFirstLink, true);
  assert.equal(linkOptions.recoverExistingLinkedProfile, true);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.memberLink.recovered, true);
  assert.equal(
    responseBody.returnPath,
    "/pages/car-view.html?id=car-123&entry=player&source=line_group"
  );
  assert.match(String(headers["Set-Cookie"] || ""), /jly_member_session=/);
});

test("car DM entry enables the same existing identity recovery", async () => {
  let linkOptions = null;
  let responseBody = null;
  const handler = createHandler({
    stateSecret: "test-secret",
    verifyLoginState: () => ({
      valid: true,
      data: {
        purpose: "car_dm_entry",
        playerProfileId: "player-entry-temp",
        identityId: "person-temp",
        returnPath: "/pages/car-view.html?id=car-456&entry=dm&source=line_group"
      }
    }),
    exchangeAuthorizationCode: async () => "access-token",
    fetchLineProfile: async () => lineProfile(),
    linkPlayerProfile: async (_profileId, _identityId, _lineUser, options) => {
      linkOptions = options;
      return {
        profileId: "player-existing",
        identityId: "person-existing",
        displayName: "詩婕",
        linked: true,
        recovered: true,
        provisional: false
      };
    }
  });

  await handler(
    { method: "POST", body: { code: "oauth-code", state: "signed-state" } },
    {
      statusCode: 0,
      setHeader() {},
      end(body) { responseBody = JSON.parse(body); }
    }
  );

  assert.equal(linkOptions.recoverExistingLinkedProfile, true);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.returnPath.includes("entry=dm"), true);
});
