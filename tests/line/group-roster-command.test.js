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


test("existing car history remains serializable for LINE player and DM roster updates", async () => {
  const history = [
    { type: "建立車團", text: "舊車團紀錄", time: "2026-10-01T01:00:00.000Z" },
    {
      type: "調整",
      text: "既有玩家紀錄",
      player: { playerId: "legacy-1", displayName: "舊玩家" },
      memberSnapshot: { memberId: "legacy-1", displayName: "舊玩家" },
      time: "2026-10-02T01:00:00.000Z"
    }
  ];

  function assertNoUndefined(value, location = "updateData") {
    assert.notEqual(value, undefined, location + " must not contain undefined");
    if (Array.isArray(value)) {
      value.forEach((item, index) => assertNoUndefined(item, location + "[" + index + "]"));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        assertNoUndefined(item, location + "." + key);
      });
    }
  }

  for (const role of ["female", "dm"]) {
    const beforeCar = {
      id: "car-history",
      ownerId: "owner-person",
      history: structuredClone(history),
      players: [],
      playerIds: [],
      staffSlots: [],
      slots: [{ id: "seat-f1", originalType: "female", type: "female", playerId: null }]
    };
    let updatedCar = null;
    const result = await addMentionedRosterMembers({
      timestamp: 1791413509000,
      source: { type: "group", groupId: "test-group", userId: "owner-line" },
      accountingCarId: "car-history",
      message: { mentions: [{ type: "user", userId: "friend-line", isSelf: false }] }
    }, role, {
      findPlayerByLineUserId: async () => ({
        id: "owner-person", lineUserId: "owner-line"
      }),
      findPlayersByLineUserIds: async () => [{
        id: "friend-person", lineUserId: "friend-line", displayName: "車友"
      }],
      applyCarMutation: async (_carId, mutator) => {
        const mutation = await mutator(beforeCar);
        assertNoUndefined(mutation.updateData);
        updatedCar = { ...beforeCar, ...mutation.updateData };
        return { ...mutation, beforeCar, afterCar: updatedCar };
      }
    });
    assert.equal(result.changed, true);
    assert.equal(result.addedCount, 1);
    assert.deepEqual(updatedCar.history.slice(0, history.length), history);
    assert.equal(Object.hasOwn(updatedCar.history[0], "player"), false);
    assert.equal(Object.hasOwn(updatedCar.history[0], "memberSnapshot"), false);
    assert.equal(updatedCar.history.length, history.length + 1);
    if (role === "dm") {
      assert.equal(updatedCar.staffSlots[0].memberId, "friend-person");
    } else {
      assert.equal(updatedCar.players[0].playerId, "friend-person");
      assert.equal(updatedCar.slots[0].playerId, "friend-person");
    }
    assert.deepEqual(beforeCar.history, history);
  }
});

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
    getGroupMemberProfile: async (_groupId, lineUserId) => ({
      userId: lineUserId,
      displayName: lineUserId === "U2" ? "阿哲" : ""
    }),
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
          },
          {
            id: "seat-flex1",
            originalType: "flexible",
            type: "flexible",
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
  assert.equal(result.addedCount, 2);
  assert.equal(result.seatedCount, 2);
  assert.equal(result.pendingIdentityCount, 1);
  assert.equal(finalCar.players.length, 2);
  assert.equal(finalCar.players[0].playerId, "person-1");
  assert.equal(finalCar.players[0].position, "男位");
  assert.equal(finalCar.players[1].playerId, "line:U2");
  assert.equal(finalCar.players[1].pendingLineUserId, "U2");
  assert.equal(finalCar.players[1].displayName, "阿哲");
  assert.equal(finalCar.players[1].isLineLinked, false);
  assert.equal(finalCar.slots[0].playerId, "person-1");
  assert.equal(finalCar.slots[1].playerId, "line:U2");
  assert.equal(finalCar.slots[1].originalType, "flexible");
  assert.equal(finalCar.slots[1].type, "male");
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
