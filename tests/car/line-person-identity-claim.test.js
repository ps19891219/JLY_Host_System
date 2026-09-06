"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { viewerState, identityIds } = require("../../services/car/car-view-access");
const { submitCarEntry, formalProfileId } = require("../../services/car/car-entry-service");
const { hydrateMemberSession } = require("../../api/car-view-context");

function fakeCarDb(initialCar) {
  let car = JSON.parse(JSON.stringify(initialCar));
  const carRef = { kind: "car" };
  return {
    get car() { return car; },
    collection(name) {
      assert.equal(name, "cars");
      return {
        doc() { return carRef; }
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          assert.equal(ref, carRef);
          return { exists: true, id: initialCar.id || "car-1", data: () => JSON.parse(JSON.stringify(car)) };
        },
        update(ref, patch) {
          assert.equal(ref, carRef);
          car = { ...car, ...JSON.parse(JSON.stringify(patch)) };
        }
      };
      return callback(transaction);
    }
  };
}

test("provisional LINE profileId is never treated as a formal Person/Profile id", () => {
  const session = {
    profileId: "line:U123",
    identityId: "",
    lineUserId: "U123",
    displayName: "紫菱",
    provisional: true
  };
  assert.equal(formalProfileId(session), "");
  assert.deepEqual(identityIds({ profileId: "line:U123", memberId: "person-1" }), ["person-1"]);
});

test("provisional LINE viewer sees both player and DM claim choices without becoming a member", () => {
  const state = viewerState({
    players: [
      { playerId: "person-ian", playerName: "Ian", status: "已加入" },
      { playerId: "person-other", playerName: "Other", lineUserId: "U999", status: "已加入" }
    ],
    staffSlots: [
      { id: "staff-sayu", memberId: "person-sayu", displayName: "Sayu" },
      { id: "staff-bound", memberId: "person-bound", displayName: "Bound", lineUserId: "U999" }
    ]
  }, {
    profileId: "line:U123",
    lineUserId: "U123",
    displayName: "紫菱",
    provisional: true
  });

  assert.equal(state.authenticated, true);
  assert.equal(state.playerStatus, "available");
  assert.equal(state.dmStatus, "available");
  assert.deepEqual(state.playerClaimablePeople.map(item => item.displayName), ["Ian"]);
  assert.deepEqual(state.dmClaimableSlots.map(item => item.displayName), ["Sayu"]);
});

test("player existing-person claim stores LINE claimant separately from target Person", async () => {
  const db = fakeCarDb({
    id: "car-1",
    players: [{ playerId: "person-ian", playerName: "Ian", status: "已加入" }],
    applications: []
  });
  await submitCarEntry({ carId: "car-1", type: "player", targetPlayerId: "person-ian" }, {
    profileId: "line:U123",
    identityId: "",
    lineUserId: "U123",
    displayName: "紫菱",
    provisional: true
  }, { db });

  const app = db.car.applications[0];
  assert.equal(app.claimType, "existing_person");
  assert.equal(app.targetPlayerId, "person-ian");
  assert.equal(app.targetPlayerName, "Ian");
  assert.equal(app.playerName, "Ian");
  assert.equal(app.lineDisplayName, "紫菱");
  assert.equal(app.lineUserId, "U123");
  assert.equal(app.memberId, "");
  assert.equal(app.profileId, "");
  assert.equal(app.provisionalIdentity, true);
});

test("DM existing-person claim never writes line:<userId> into memberId/profileId", async () => {
  const db = fakeCarDb({
    id: "car-1",
    staffSlots: [{ id: "staff-ian", memberId: "person-ian", displayName: "Ian", label: "DM" }],
    dmApplications: []
  });
  await submitCarEntry({ carId: "car-1", type: "dm", targetStaffId: "staff-ian" }, {
    profileId: "line:U123",
    identityId: "",
    lineUserId: "U123",
    displayName: "紫菱",
    provisional: true
  }, { db });

  const app = db.car.dmApplications[0];
  assert.equal(app.claimType, "existing_slot");
  assert.equal(app.targetStaffName, "Ian");
  assert.equal(app.targetPersonId, "person-ian");
  assert.equal(app.lineDisplayName, "紫菱");
  assert.equal(app.memberId, "");
  assert.equal(app.profileId, "");
});

test("approved LINE linkage hydrates an old provisional cookie to the canonical Person", async () => {
  const docs = [{
    id: "person-ian",
    data: () => ({ identityId: "identity-ian", displayName: "Ian", lineUserId: "U123" })
  }];
  const db = {
    collection(name) {
      assert.equal(name, "players");
      return {
        where(field, op, value) {
          assert.equal(field, "lineUserId");
          assert.equal(op, "==");
          assert.equal(value, "U123");
          return {
            limit() {
              return { get: async () => ({ empty: false, docs }) };
            }
          };
        }
      };
    }
  };

  const hydrated = await hydrateMemberSession({
    profileId: "line:U123",
    identityId: "",
    lineUserId: "U123",
    displayName: "紫菱",
    provisional: true
  }, { db });

  assert.equal(hydrated.profileId, "person-ian");
  assert.equal(hydrated.identityId, "identity-ian");
  assert.equal(hydrated.displayName, "Ian");
  assert.equal(hydrated.provisional, false);
});
