const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadBrowserModule(relativePath, window) {
  vm.runInNewContext(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    { window, console },
    { filename: relativePath }
  );
}

function player(id, position) {
  return { playerId: id, position, status: "已加入" };
}

function slot(id, originalType, playerId, type = originalType) {
  return { slotId: id, originalType, type, playerId: playerId || "" };
}

test("membership and seat mutations are formal MyCar projection impacts", () => {
  const window = {};
  loadBrowserModule("js/data-view/view-impact-resolver.js", window);

  for (const field of ["players", "playerIds", "slots", "maleSlots", "femaleSlots", "flexibleSlots", "totalPeople"]) {
    assert.ok(
      window.JLYViewImpactResolver.resolveCarViews([field]).includes("mycar"),
      `${field} must invalidate MyCar prepared view`
    );
  }
});

test("fixed gender seats stay consistent after approved join and removal", () => {
  const window = {};
  loadBrowserModule("js/data-view/mycar-view.js", window);
  const view = {
    viewerId: "host",
    identityIds: ["host"],
    cars: []
  };
  const base = {
    id: "car-fixed",
    ownerId: "host",
    totalPeople: 6,
    maleSlots: 3,
    femaleSlots: 3,
    players: [player("m1", "男"), player("m2", "男"), player("f1", "女"), player("f2", "女")],
    slots: [
      slot("m-1", "male", "m1"), slot("m-2", "male", "m2"), slot("m-3", "male"),
      slot("f-1", "female", "f1"), slot("f-2", "female", "f2"), slot("f-3", "female")
    ]
  };
  const joined = {
    ...base,
    players: [...base.players, player("m3", "男")],
    slots: base.slots.map(item => item.slotId === "m-3" ? { ...item, playerId: "m3" } : item)
  };
  const joinedView = window.JLYMyCarView.applyMutationToView(view, base, joined);
  const summary = joinedView.cars[0].seatSummary;

  assert.equal(summary.maleOccupied, 3);
  assert.equal(summary.femaleOccupied, 2);
  assert.equal(summary.maleTotal - summary.maleOccupied, 0);
  assert.equal(summary.femaleTotal - summary.femaleOccupied, 1);

  const removedView = window.JLYMyCarView.applyMutationToView(joinedView, joined, base);
  assert.equal(removedView.cars[0].seatSummary.maleOccupied, 2);
});

test("total-capacity mode becomes full and never reports negative remaining seats", () => {
  const window = {};
  loadBrowserModule("js/data-view/mycar-view.js", window);
  const players = Array.from({ length: 6 }, (_, index) => player(`p${index + 1}`, "不限"));
  const slots = players.map((entry, index) => slot(`s${index + 1}`, "flexible", entry.playerId));
  const compact = window.JLYMyCarView.compactCar({
    id: "car-total",
    ownerId: "host",
    totalPeople: 6,
    players,
    slots
  }, ["host"]);

  assert.equal(compact.seatSummary.occupiedSeatCount, 6);
  assert.equal(
    Math.max(compact.seatSummary.totalSeatCount - compact.seatSummary.occupiedSeatCount, 0),
    0
  );
});

test("cross-play occupies the formal original seat section instead of player.position", () => {
  const window = {};
  loadBrowserModule("js/data-view/mycar-view.js", window);
  const compact = window.JLYMyCarView.compactCar({
    id: "car-cross-play",
    ownerId: "host",
    players: [player("cross", "男")],
    slots: [slot("flex-1", "flexible", "cross", "male")]
  }, ["host"]);

  assert.equal(compact.seatSummary.flexibleOccupied, 1);
  assert.equal(compact.seatSummary.maleOccupied, 0);
});

test("membership mutation refreshes every known member view without a collection scan", async () => {
  const resolvedAliases = [];
  const updatedViewers = [];
  const window = {
    JLYViewMutationCoordinator: {
      updateCarViews: async () => []
    },
    JLYMyCarView: {
      applyViewerMutation: async viewerId => {
        updatedViewers.push(viewerId);
        return { ok: true, viewerId };
      }
    },
    JLYMyCarViewAlias: {
      resolveViewerIds: async ids => {
        resolvedAliases.push(...ids);
        return ids.map(id => `viewer-${id}`);
      }
    }
  };
  loadBrowserModule("js/data-view/membership-view-sync.js", window);

  await window.JLYMembershipViewSync.sync({
    beforeCar: {
      playerIds: ["p1", "p2"],
      players: [player("p1", "男"), player("p2", "女")]
    },
    afterCar: {
      playerIds: ["p1", "p2", "p3"],
      players: [player("p1", "男"), player("p2", "女"), player("p3", "男")]
    },
    playerIds: ["p3"],
    changedFields: ["players", "playerIds", "slots"]
  });

  assert.deepEqual(Array.from(resolvedAliases).sort(), ["p1", "p2", "p3"]);
  assert.deepEqual(Array.from(updatedViewers).sort(), ["viewer-p1", "viewer-p2", "viewer-p3"]);
});
