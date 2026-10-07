"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractScriptHint,
  extractDateHint,
  extractTimeHint,
  detectGroupCar
} = require("../../services/line/group-auto-binding-service");
const {
  routeEvent
} = require("../../services/line/event-router");


test("compact four-digit group time is removed from exact script hint and used for matching", async () => {
  const groupName = "2026/10/20 0900 測試車車";
  assert.equal(extractScriptHint(groupName), "測試車車");
  assert.deepEqual(extractDateHint(groupName), {
    year: "2026", month: "10", day: "20"
  });
  assert.equal(extractTimeHint(groupName), "09:00");
  assert.equal(extractTimeHint("測試車車 2026"), "");

  let queryName = "";
  const result = await detectGroupCar("group-compact-time", {
    getGroupSummary: async () => ({
      groupId: "group-compact-time",
      groupName
    }),
    findCarDetailViewsByScriptName: async (name, options) => {
      queryName = name;
      assert.equal(options.limit, 12);
      return [
        { id: "car-wrong-date", scriptName: name, gameDate: "2026-10-21", gameTime: "09:00", status: "招募中" },
        { id: "car-correct", scriptName: name, gameDate: "2026-10-20", gameTime: "09:00", status: "招募中" },
        { id: "car-wrong-time", scriptName: name, gameDate: "2026-10-20", gameTime: "19:00", status: "招募中" }
      ];
    }
  });
  assert.equal(queryName, "測試車車");
  assert.equal(result.detected, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].carId, "car-correct");
});

test("group name extracts script, date and time without scanning cars", async () => {
  assert.equal(
    extractScriptHint("《民國17年》 12/07 19:00 車群"),
    "民國17年"
  );
  assert.deepEqual(
    extractDateHint("《民國17年》 12/07 19:00 車群"),
    { year: "", month: "12", day: "07" }
  );
  assert.equal(
    extractTimeHint("《民國17年》 12/07 19:00 車群"),
    "19:00"
  );

  let requestedScript = "";
  const result = await detectGroupCar("group-1", {
    getGroupSummary: async () => ({
      groupId: "group-1",
      groupName: "《民國17年》 12/07 19:00 車群"
    }),
    findCarDetailViewsByScriptName: async scriptName => {
      requestedScript = scriptName;
      return [
        {
          id: "car-a",
          scriptName: "民國17年",
          gameDate: "2026-12-06",
          gameTime: "19:00",
          status: "招募中"
        },
        {
          id: "car-b",
          scriptName: "民國17年",
          gameDate: "2026-12-07",
          gameTime: "19:00",
          status: "招募中"
        }
      ];
    }
  });

  assert.equal(requestedScript, "民國17年");
  assert.equal(result.detected, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].carId, "car-b");
});

test("LINE join event replies with one-click auto-binding candidate", async () => {
  let sent = null;
  const result = await routeEvent({
    type: "join",
    replyToken: "reply-join",
    source: {
      type: "group",
      groupId: "group-1"
    }
  }, {
    resolveGroupBinding: async () => ({
      bound: false,
      reason: "binding_not_found",
      binding: null
    }),
    detectGroupCar: async () => ({
      detected: true,
      reason: "single_candidate",
      group: {
        groupId: "group-1",
        groupName: "《民國17年》 12/07 19:00"
      },
      scriptHint: "民國17年",
      candidates: [{
        carId: "car-b",
        scriptName: "民國17年",
        gameDate: "2026-12-07",
        gameTime: "19:00"
      }]
    }),
    sendReplyMessage: async (_token, messages) => {
      sent = messages;
    }
  });

  assert.equal(result.route, "join_auto_binding_candidate");
  assert.equal(sent[0].type, "text");
  assert.equal(sent[0].quickReply.items.length, 1);
  assert.equal(
    sent[0].quickReply.items[0].action.type,
    "postback"
  );
  assert.match(
    sent[0].quickReply.items[0].action.data,
    /jly_action=auto_bind/
  );
});

test("auto-binding postback uses existing secure group binding service", async () => {
  let requestedCarId = "";
  let sent = null;

  const result = await routeEvent({
    type: "postback",
    replyToken: "reply-postback",
    source: {
      type: "group",
      groupId: "group-1",
      userId: "host-line"
    },
    postback: {
      data: "jly_action=auto_bind&carId=car-b"
    }
  }, {
    bindGroupToCar: async (_context, carId) => {
      requestedCarId = carId;
      return {
        bound: true,
        car: {
          id: "car-b",
          label: "民國17年",
          date: "2026-12-07"
        }
      };
    },
    getPublicBaseUrl: () => "https://example.com",
    sendReplyMessage: async (_token, messages) => {
      sent = messages;
    }
  });

  assert.equal(requestedCarId, "car-b");
  assert.equal(result.route, "postback_auto_bound");
  assert.equal(sent.length, 2);
  assert.match(sent[0].text, /已成功綁定/);
  assert.match(sent[0].text, /新增男位/);
});
