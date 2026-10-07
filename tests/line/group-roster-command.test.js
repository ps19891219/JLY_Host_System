"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRosterCommand
} = require("../../services/line/message-router");
const {
  addMentionedRosterMembers
} = require("../../services/line/group-roster-service");
const {
  routeEvent
} = require("../../services/line/event-router");

test("roster commands distinguish DM, male and female additions", () => {
  assert.equal(parseRosterCommand("新增DM @甲").role, "dm");
  assert.equal(parseRosterCommand("新增男位 @甲 @乙").role, "male");
  assert.equal(parseRosterCommand("JLY 新增女位 @丙").role, "female");
  assert.equal(parseRosterCommand("大家新增照片"), null);
});

test("male mention command adds linked player and keeps unlinked user pending", async () => {
  const context = {
    timestamp: 1,
    source: {
      type: "group",
      groupId: "group-1",
      userId: "host-line"
    },
    accountingCarId: "car-1",
    message: {
      mentions: [
        { type: "user", userId: "U1", isSelf: false },
        { type: "user", userId: "U2", isSelf: false }
      ]
    }
  };

  let finalCar = null;
  const result = await addMentionedRosterMembers(context, "male", {
    findPlayerByLineUserId: async () => ({
      id: "host-person",
      lineUserId: "host-line"
    }),
    findPlayersByLineUserIds: async () => [{
      id: "person-1",
      lineUserId: "U1",
      displayName: "小明",
      memberType: "member"
    }],
    applyCarMutation: async (_carId, mutator) => {
      const beforeCar = {
        id: "car-1",
        ownerId: "host-person",
        players: [],
        playerIds: [],
        staffSlots: [],
        slots: [
          {
            id: "seat-m1",
            originalType: "male",
            type: "male",
            playerId: null
          }
        ],
        history: []
      };
      const mutation = await mutator(beforeCar);
      finalCar = {
        ...beforeCar,
        ...(mutation.updateData || {})
      };
      return {
        ...mutation,
        beforeCar,
        afterCar: finalCar,
        updatedMyCarViews: 0
      };
    }
  });

  assert.equal(result.changed, true);
  assert.equal(result.addedCount, 1);
  assert.equal(result.seatedCount, 1);
  assert.equal(result.pendingIdentityCount, 1);
  assert.equal(finalCar.players.length, 1);
  assert.equal(finalCar.players[0].playerId, "person-1");
  assert.equal(finalCar.players[0].position, "男位");
  assert.equal(finalCar.slots[0].playerId, "person-1");
  assert.equal(finalCar.lineRosterCandidates.length, 1);
  assert.equal(finalCar.lineRosterCandidates[0].lineUserId, "U2");
  assert.equal(finalCar.lineRosterCandidates[0].status, "pending_identity");
});

test("DM mention command writes existing member into staffSlots, not players", async () => {
  let finalCar = null;
  const result = await addMentionedRosterMembers({
    timestamp: 1,
    source: {
      type: "group",
      groupId: "group-1",
      userId: "host-line"
    },
    accountingCarId: "car-1",
    message: {
      mentions: [
        { type: "user", userId: "UDM", isSelf: false }
      ]
    }
  }, "dm", {
    findPlayerByLineUserId: async () => ({
      id: "host-person",
      lineUserId: "host-line"
    }),
    findPlayersByLineUserIds: async () => [{
      id: "dm-person",
      lineUserId: "UDM",
      displayName: "阿哲"
    }],
    applyCarMutation: async (_carId, mutator) => {
      const beforeCar = {
        id: "car-1",
        ownerId: "host-person",
        players: [],
        staffSlots: [],
        history: []
      };
      const mutation = await mutator(beforeCar);
      finalCar = {
        ...beforeCar,
        ...(mutation.updateData || {})
      };
      return {
        ...mutation,
        beforeCar,
        afterCar: finalCar
      };
    }
  });

  assert.equal(result.changed, true);
  assert.equal(result.addedCount, 1);
  assert.equal(finalCar.players.length, 0);
  assert.equal(finalCar.staffSlots.length, 1);
  assert.equal(finalCar.staffSlots[0].label, "DM");
  assert.equal(finalCar.staffSlots[0].memberId, "dm-person");
});


test("explicit roster command wins over reminder mention capture", async () => {
  let rosterCalls = 0;
  let reminderCalls = 0;
  let replyText = "";

  const result = await routeEvent({
    type: "message",
    timestamp: 1,
    replyToken: "reply-token",
    source: {
      type: "group",
      groupId: "group-1",
      userId: "host-line"
    },
    message: {
      id: "message-1",
      type: "text",
      text: "新增女位 @小美",
      mention: {
        mentionees: [
          { type: "user", userId: "UF", isSelf: false }
        ]
      }
    }
  }, {
    resolveGroupBinding: async groupId => ({
      bound: true,
      binding: { groupId, carId: "car-1" }
    }),
    addMentionedRosterMembers: async (_context, role) => {
      rosterCalls += 1;
      assert.equal(role, "female");
      return {
        changed: true,
        addedCount: 1,
        seatedCount: 1,
        pendingIdentityCount: 0,
        alreadyExistsCount: 0
      };
    },
    captureGroupReminderTargets: async () => {
      reminderCalls += 1;
      return { captured: true };
    },
    sendTextReply: async (_token, value) => {
      replyText = value;
    }
  });

  assert.equal(result.route, "assistant_roster_added");
  assert.equal(rosterCalls, 1);
  assert.equal(reminderCalls, 0);
  assert.match(replyText, /女位登記完成/);
});
