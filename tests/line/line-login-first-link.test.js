"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { linkPlayerProfile, allowsVerifiedFirstLink } = require("../../api/line-login");

function emptyPlayersDb() {
  return {
    collection(name) {
      assert.equal(name, "players");
      return {
        where() {
          return {
            limit() {
              return {
                async get() {
                  return { empty: true, docs: [] };
                }
              };
            }
          };
        }
      };
    }
  };
}

test("only signed car-entry purposes may continue a first-time LINE identity", function () {
  assert.equal(allowsVerifiedFirstLink("car_dm_entry"), true);
  assert.equal(allowsVerifiedFirstLink("car_player_entry"), true);
  assert.equal(allowsVerifiedFirstLink(""), false);
  assert.equal(allowsVerifiedFirstLink("myprofile"), false);
});

test("verified first-time DM gets a provisional identity without creating a players document", async function () {
  const result = await linkPlayerProfile("", "", {
    userId: "U-new-dm",
    displayName: "新 DM"
  }, {
    db: emptyPlayersDb(),
    allowVerifiedFirstLink: true
  });

  assert.equal(result.profileId, "line:U-new-dm");
  assert.equal(result.identityId, "");
  assert.equal(result.displayName, "新 DM");
  assert.equal(result.provisional, true);
  assert.equal(result.linked, false);
});

test("ordinary first-link flow keeps the original-browser protection", async function () {
  await assert.rejects(
    () => linkPlayerProfile("", "", {
      userId: "U-untrusted",
      displayName: "未連結"
    }, { db: emptyPlayersDb() }),
    /first_link_requires_original_browser/
  );
});
