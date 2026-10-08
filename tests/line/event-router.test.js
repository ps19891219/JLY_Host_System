"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  routeEvent
} = require(
  "../../services/line/event-router"
);

function createTextEvent(options = {}) {
  return {
    type: "message",
    timestamp: 1,
    replyToken:
      Object.prototype.hasOwnProperty.call(
        options,
        "replyToken"
      )
        ? options.replyToken
        : "reply-token",
    source: {
      type:
        options.sourceType ||
        "group",
      groupId:
        options.groupId ||
        "group-1",
      userId: "user-1"
    },
    message: {
      id: "message-1",
      type: "text",
      text:
        options.text ||
        "JLY 小助手",
      ...(Array.isArray(options.mentions)
        ? {
            mention: {
              mentionees:
                options.mentions
            }
          }
        : {})
    }
  };
}

test(
  "normal group chat stays silent and does not read binding",
  async function () {
    let bindingCalls = 0;
    let replyCalls = 0;

    const result = await routeEvent(
      createTextEvent({
        text: "大家晚安"
      }),
      {
        resolveGroupBinding: async function () {
          bindingCalls += 1;
        },
        sendTextReply: async function () {
          replyCalls += 1;
        }
      }
    );

    assert.equal(result.handled, false);
    assert.equal(result.route, "ignore_normal_chat");
    assert.equal(bindingCalls, 0);
    assert.equal(replyCalls, 0);
  }
);

test(
  "assistant call in a group resolves binding before replying",
  async function () {
    const calls = [];

    const result = await routeEvent(
      createTextEvent(),
      {
        resolveGroupBinding: async function (groupId) {
          calls.push([
            "binding",
            groupId
          ]);

          return {
            bound: true,
            reason: "binding_found",
            binding: {
              groupId,
              carId: "car-1",
              active: true
            }
          };
        },
        getCarById: async function () {
          return {
            id: "car-1",
            scriptName: "測試劇本",
            date: "2026-08-20"
          };
        },
        getReminderStatus: async function () {
          throw new Error("Quick menu should not query reminder status");
        },
        createGroupAssistantToken: function () { return "signed-token"; },
        getPublicBaseUrl: function () { return "https://example.com"; },
        sendReplyMessage: async function (
          replyToken,
          messages
        ) {
          calls.push([
            "reply",
            replyToken,
            messages
          ]);
        }
      }
    );

    assert.equal(result.handled, true);
    assert.equal(result.route, "assistant_called");
    assert.equal(result.groupBinding.bound, true);
    assert.equal(
      result.groupBinding.binding.carId,
      "car-1"
    );
    assert.equal(calls[0][0], "binding");
    assert.equal(calls[1][0], "reply");
    assert.equal(calls[1][2][0].type, "flex");
    assert.deepEqual(calls[1][2][0].contents.body.contents.map(
      function (item) { return item.action.type; }
    ), ["message", "message", "message", "uri", "uri", "message"]);
  }
);

test("accounting button opens the persistent second-level menu", async function () {
  let messages = null;
  const result = await routeEvent(
    createTextEvent({ text: "JLY 車團帳務" }),
    {
      resolveGroupBinding: async function (groupId) {
        return { bound: true, reason: "binding_found", binding: { groupId, carId: "car-1" } };
      },
      getCarById: async function () {
        return { id: "car-1", scriptName: "測試劇本" };
      },
      createGroupAssistantToken: function () { return "signed"; },
      getPublicBaseUrl: function () { return "https://example.com"; },
      sendReplyMessage: async function (_replyToken, sent) { messages = sent; }
    }
  );
  assert.equal(result.route, "assistant_accounting_card");
  assert.equal(messages[0].type, "flex");
  assert.equal(messages[0].contents.body.contents.length, 4);
});

test(
  "binding lookup failure does not prevent assistant reply",
  async function () {
    let replyCalls = 0;

    const result = await routeEvent(
      createTextEvent(),
      {
        resolveGroupBinding: async function () {
          throw new Error("firebase unavailable");
        },
        sendReplyMessage: async function () {
          replyCalls += 1;
        }
      }
    );

    assert.equal(result.handled, true);
    assert.equal(replyCalls, 1);
    assert.equal(result.groupBinding.bound, false);
    assert.equal(
      result.groupBinding.reason,
      "binding_lookup_failed"
    );
  }
);

test(
  "one-to-one assistant call does not query group binding",
  async function () {
    let bindingCalls = 0;

    const result = await routeEvent(
      createTextEvent({
        sourceType: "user",
        groupId: ""
      }),
      {
        resolveGroupBinding: async function () {
          bindingCalls += 1;
        },
        sendTextReply: async function () {}
      }
    );

    assert.equal(result.handled, true);
    assert.equal(bindingCalls, 0);
    assert.equal(result.groupBinding, null);
  }
);

test(
  "group accounting command writes the current group entry",
  async function () {
    const calls = [];

    const result = await routeEvent(
      createTextEvent({
        text: "JLY 支出 350 聚餐飲料"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        resolveAccountingAuthority: async function () {
          return {
            canManageAll: false,
            reason: "member",
            playerId: "member-1",
            playerDisplayName: "詩婕"
          };
        },
        recordGroupAccounting: async function (
          context,
          command
        ) {
          calls.push([
            "save",
            context.source.groupId,
            command
          ]);

          return {
            saved: true,
            entry: {
              ...command,
              messageId: "message-ABCD1234"
            }
          };
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          calls.push([
            "reply",
            replyToken,
            text
          ]);
        }
      }
    );

    assert.equal(result.route, "accounting_create");
    assert.equal(calls[0][0], "save");
    assert.equal(calls[0][1], "group-1");
    assert.equal(calls[0][2].amount, 350);
    assert.ok(calls[1][2].includes("記帳成功"));
    assert.ok(calls[1][2].includes("聚餐飲料"));
    assert.ok(calls[1][2].includes("帳目編號：ABCD1234"));
  }
);

test(
  "private chat accounting command does not write a group entry",
  async function () {
    let saveCalls = 0;
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        sourceType: "user",
        groupId: "",
        text: "JLY 支出 350 聚餐飲料"
      }),
      {
        recordGroupAccounting: async function () {
          saveCalls += 1;
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(
      result.route,
      "accounting_group_required"
    );
    assert.equal(saveCalls, 0);
    assert.ok(replyText.includes("只能在 LINE 群組"));
  }
);

test(
  "accounting command without reply token does not write",
  async function () {
    let saveCalls = 0;

    const result = await routeEvent(
      createTextEvent({
        replyToken: "",
        text: "JLY 支出 350 聚餐飲料"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        recordGroupAccounting: async function () {
          saveCalls += 1;
        }
      }
    );

    assert.equal(
      result.route,
      "message_missing_reply_token"
    );
    assert.equal(saveCalls, 0);
  }
);

test(
  "today accounting query replies with summary and entries",
  async function () {
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        text: "JLY 今日帳目"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        queryGroupAccounting: async function (
          context,
          scope
        ) {
          assert.equal(context.source.groupId, "group-1");
          assert.equal(scope, "today");

          return {
            found: true,
            entries: [
              {
                type: "income",
                amount: 1000,
                description: "成員繳費"
              },
              {
                type: "expense",
                amount: 350,
                description: "聚餐飲料"
              }
            ],
            summary: {
              count: 2,
              income: 1000,
              expense: 350,
              balance: 650
            }
          };
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(result.route, "accounting_query");
    assert.ok(replyText.includes("今日帳目"));
    assert.ok(replyText.includes("收入：$1,000"));
    assert.ok(replyText.includes("結餘：$650"));
    assert.ok(replyText.includes("+$1,000 成員繳費"));
  }
);

test(
  "empty month accounting query replies clearly",
  async function () {
    let replyText = "";

    await routeEvent(
      createTextEvent({
        text: "JLY 本月帳目"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        queryGroupAccounting: async function () {
          return {
            found: false,
            entries: [],
            summary: {
              count: 0,
              income: 0,
              expense: 0,
              balance: 0
            }
          };
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.ok(replyText.includes("本月帳目"));
    assert.ok(replyText.includes("目前沒有帳目"));
  }
);

test(
  "private chat cannot query a group account",
  async function () {
    let queryCalls = 0;
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        sourceType: "user",
        groupId: "",
        text: "JLY 帳本餘額"
      }),
      {
        queryGroupAccounting: async function () {
          queryCalls += 1;
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(
      result.route,
      "accounting_group_required"
    );
    assert.equal(queryCalls, 0);
    assert.ok(replyText.includes("只能在 LINE 群組"));
  }
);

test(
  "entry creator can update an accounting entry",
  async function () {
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        text:
          "JLY 修改帳目 ABCD1234 支出 400 新說明"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        resolveAccountingAuthority: async function () {
          return {
            canManageAll: false,
            canViewAudit: false,
            reason: "member"
          };
        },
        mutateGroupAccounting: async function (
          context,
          mutation
        ) {
          assert.equal(context.source.userId, "user-1");
          assert.equal(mutation.amount, 400);

          return {
            changed: true,
            reason: "accounting_changed",
            entryCode: "ABCD1234"
          };
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(result.route, "accounting_mutation");
    assert.ok(replyText.includes("帳目已修改"));
    assert.ok(replyText.includes("異動紀錄已保存"));
  }
);

test(
  "ordinary member cannot view accounting audit logs",
  async function () {
    let auditCalls = 0;
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        text: "JLY 異動紀錄"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: false,
            reason: "binding_not_found",
            binding: null
          };
        },
        resolveAccountingAuthority: async function () {
          return { canManageAll: false, reason: "member" };
        },
        listCarAccountingAuditLogs: async function () {
          auditCalls += 1;
          return [];
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(result.route, "accounting_audit_denied");
    assert.equal(auditCalls, 0);
    assert.ok(replyText.includes("僅供系統管理者"));
  }
);

test(
  "verified host cannot view accounting audit logs",
  async function () {
    let auditCalls = 0;
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        text: "JLY 異動紀錄"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: true,
            reason: "binding_found",
            binding: { carId: "car-1" }
          };
        },
        resolveAccountingAuthority: async function () {
          return {
            canManageAll: true,
            canViewAudit: false,
            reason: "car_owner"
          };
        },
        listCarAccountingAuditLogs: async function () {
          auditCalls += 1;
          return [];
        },
        sendTextReply: async function (replyToken, text) {
          replyText = text;
        }
      }
    );

    assert.equal(result.route, "accounting_audit_denied");
    assert.equal(auditCalls, 0);
    assert.ok(replyText.includes("系統管理者"));
  }
);

test(
  "system admin can view accounting audit logs",
  async function () {
    let replyText = "";

    const result = await routeEvent(
      createTextEvent({
        text: "JLY 異動紀錄"
      }),
      {
        resolveGroupBinding: async function () {
          return {
            bound: true,
            reason: "binding_found",
            binding: { carId: "car-1" }
          };
        },
        resolveAccountingAuthority: async function () {
          return {
            canManageAll: true,
            canViewAudit: true,
            reason: "system_admin"
          };
        },
        listCarAccountingAuditLogs: async function () {
          return [
            {
              entryId: "message-ABCD1234",
              operation: "delete",
              actorUserId: "user-2"
            }
          ];
        },
        getActorNamesByLineUserIds: async function () {
          return { "user-2": "詩婕" };
        },
        sendTextReply: async function (
          replyToken,
          text
        ) {
          replyText = text;
        }
      }
    );

    assert.equal(result.route, "accounting_audit");
    assert.ok(replyText.includes("ABCD1234"));
    assert.ok(replyText.includes("刪除"));
    assert.ok(replyText.includes("詩婕"));
  }
);

test("one-time pairing shows confirm and cancel buttons before binding", async function () {
  let sentMessages = null;
  const result = await routeEvent(
    createTextEvent({ text: "JLY 綁定《測試劇本》 A7K9P2" }),
    {
      resolveGroupBinding: async function () {
        return { bound: false, reason: "binding_not_found", binding: null };
      },
      prepareGroupPairing: async function () {
        return {
          prepared: true,
          code: "A7K9P2",
          car: { id: "car-1", label: "測試劇本", date: "2026-08-20" }
        };
      },
      sendReplyMessage: async function (_replyToken, messages) {
        sentMessages = messages;
      }
    }
  );

  assert.equal(result.route, "group_car_pairing_prepared");
  assert.ok(sentMessages[0].text.includes("測試劇本"));
  assert.deepEqual(
    sentMessages[0].quickReply.items.map(item => item.action.label),
    ["確認綁定", "取消"]
  );
});

test("successful binding only shows the player-facing result and next step", async function () {
  let sentMessages = null;
  const result = await routeEvent(
    createTextEvent({ text: "JLY 確認綁定 A7K9P2" }),
    {
      resolveGroupBinding: async function () {
        return { bound: false, reason: "binding_not_found", binding: null };
      },
      confirmGroupPairing: async function () {
        return {
          bound: true,
          migration: { migrated: 3 },
          car: { id: "car-1", label: "紅豆3：黑金時代" }
        };
      },
      getPublicBaseUrl: function () { return "https://example.com"; },
      sendReplyMessage: async function (_replyToken, messages) { sentMessages = messages; }
    }
  );

  assert.equal(result.route, "group_car_bound");
  assert.equal(Array.isArray(sentMessages), true);
  assert.equal(sentMessages.length, 2);
  const replyText = sentMessages[0].text;
  assert.ok(replyText.includes("已成功綁定《紅豆3：黑金時代》"));
  assert.ok(replyText.includes("JLY 小助手"));
  assert.equal(replyText.includes("遷移"), false);
  assert.equal(replyText.includes("3 筆"), false);
  assert.equal(sentMessages[1].type, "flex");
});
test("quick accounting saves an unresolved payer silently as a pending draft", async function () {
  let replyText = "";
  const result = await routeEvent(createTextEvent({ text: "@JLY小助手 記帳 晚餐 690 小英付" }), {
    resolveGroupBinding: async groupId => ({ bound: true, binding: { groupId, carId: "car-1" } }),
    resolveAccountingAuthority: async () => ({ playerId: "host", playerDisplayName: "詩婕", canManageAll: true }),
    getCarById: async () => ({ id: "car-1" }),
    prepareQuickAccounting: async () => ({ saved: true, reason: "pending_identity", draft: { draftId: "line-message-1" } }),
    sendTextReply: async (_token, text) => { replyText = text; }
  });
  assert.equal(result.route, "accounting_quick_pending");
  assert.match(replyText, /已暫存，等待確認付款人/);
  assert.match(replyText, /項目：晚餐/);
  assert.match(replyText, /金額：\$690/);
  assert.match(replyText, /車團帳務的「待確認」/);
  assert.doesNotMatch(replyText, /小英|請選擇|可能是/);
});

test("quick accounting with one resolved payer creates the formal entry", async function () {
  let savedCommand;
  let replyText = "";
  const result = await routeEvent(createTextEvent({ text: "@JLY小助手 記帳 晚餐 690 小英付" }), {
    resolveGroupBinding: async groupId => ({ bound: true, binding: { groupId, carId: "car-1" } }),
    resolveAccountingAuthority: async () => ({ playerId: "host", playerDisplayName: "詩婕", canManageAll: true }),
    getCarById: async () => ({ id: "car-1" }),
    prepareQuickAccounting: async () => ({ saved: false, reason: "payer_resolved", payer: { personId: "p1", displayName: "小英" } }),
    saveResolvedQuickAccounting: async (_context, command, payer) => { savedCommand = { ...command, payerMemberId: payer.personId }; return { transactionId: "line-message-1" }; },
    sendTextReply: async (_token, text) => { replyText = text; }
  });
  assert.equal(result.route, "accounting_quick_created");
  assert.equal(savedCommand.payerMemberId, "p1");
  assert.match(replyText, /已正式記帳/);
  assert.match(replyText, /項目：晚餐/);
  assert.match(replyText, /金額：\$690/);
  assert.match(replyText, /付款人：小英/);
  assert.match(replyText, /待分帳/);
});
test("car information shortcuts reply with only the requested slice", async function () {
  const replies = [];
  for (const text of ["JLY 店家", "JLY 時間", "JLY 人員"]) {
    const result = await routeEvent(createTextEvent({ text }), {
      resolveGroupBinding: async groupId => ({ bound: true, binding: { groupId, carId: "car-1" } }),
      getCarById: async () => ({ scriptName: "溫床", studioName: "玩硬", address: "測試路1號", date: "2026-08-20", time: "19:00", totalPeople: 6, players: [{ id: "p1" }] }),
      sendTextReply: async (_token, reply) => { replies.push(reply); }
    });
    assert.match(result.route, /^assistant_(store|time|people)_info$/);
  }
  assert.match(replies[0], /店家資訊/);assert.doesNotMatch(replies[0], /時間資訊/);
  assert.match(replies[1], /時間資訊/);assert.doesNotMatch(replies[1], /人員資訊/);
  assert.match(replies[2], /人員資訊/);assert.doesNotMatch(replies[2], /店家資訊/);
});


test("JLY 提醒 is read-only for historical cars and never enables or scans Core", async () => {
  let reads=0, writes=0, reply="";
  const result=await routeEvent(createTextEvent({text:"JLY 提醒"}),{
    resolveGroupBinding:async(groupId)=>({bound:true,binding:{groupId,carId:"car-1"}}),
    getReminderStatus:async(carId,car)=>{
      reads++;assert.equal(carId,"car-1");assert.equal(car,null);
      return {configured:false,enabled:false,reminder:null};
    },
    getCarById:async()=>{throw Error("unnecessary Core read")},
    enableGroupPreTripReminder:async()=>{writes++;throw Error("unwanted write")},
    captureGroupReminderTargets:async()=>{writes++;throw Error("unwanted write")},
    sendTextReply:async(_token,text)=>{reply=text}
  });
  assert.equal(result.route,"assistant_reminder_status");
  assert.equal(reads,1);
  assert.equal(writes,0);
  assert.match(reply,/尚未開啟/);
  assert.match(reply,/開啟行前通知/);
});

test("reminder status reports schedule and deduplicated target count without LINE identifiers",async()=>{
  let reply="";
  const result=await routeEvent(createTextEvent({text:"JLY 提醒狀態"}),{
    resolveGroupBinding:async(groupId)=>({bound:true,binding:{groupId,carId:"car-1"}}),
    getReminderStatus:async()=>({configured:true,enabled:true,reminder:{
      status:"scheduled",
      scheduledAt:"2027-01-27T07:00:00Z",
      targetLineUserIds:["UID-ONE","UID-TWO","UID-ONE"]
    }}),
    sendTextReply:async(_token,text)=>{reply=text}
  });
  assert.equal(result.route,"assistant_reminder_status");
  assert.match(reply,/已排程/);
  assert.match(reply,/2027/);
  assert.match(reply,/2 人/);
  assert.doesNotMatch(reply,/UID-ONE|UID-TWO/);
});

test("unbound group cannot read reminder status",async()=>{
  let reads=0, reply="";
  const result=await routeEvent(createTextEvent({text:"JLY 提醒"}),{
    resolveGroupBinding:async()=>({bound:false}),
    getReminderStatus:async()=>{reads++;throw Error("unwanted")},
    sendTextReply:async(_token,text)=>{reply=text}
  });
  assert.equal(reads,0);
  assert.equal(result.route,"assistant_reminder_status_binding_required");
  assert.match(reply,/綁定/);
});

test("status lookup failure reports read error and never enables",async()=>{
  let writes=0,reply="";
  const result=await routeEvent(createTextEvent({text:"JLY 通知狀態"}),{
    resolveGroupBinding:async(groupId)=>({bound:true,binding:{groupId,carId:"car-1"}}),
    getReminderStatus:async()=>{throw Error("simulated read error")},
    enableGroupPreTripReminder:async()=>{writes++},
    sendTextReply:async(_token,text)=>{reply=text}
  });
  assert.equal(writes,0);
  assert.equal(result.route,"assistant_reminder_status_failed");
  assert.match(reply,/沒有修改任何提醒設定/);
});

test("report represents sent, sending, failed, and action-required without guaranteed delivery",()=>{
  const {buildReminderStatusReport}=require("../../services/line/reminder-service");
  for(const [status,expected] of [
    ["sent",/已提交 LINE 發送/],
    ["sending",/發送處理中/],
    ["failed",/發送失敗/],
    ["action_required",/需要調整/]
  ]){
    const message=buildReminderStatusReport({
      configured:true,enabled:true,reminder:{
        status,
        scheduledAt:"2027-01-27T07:00:00Z",
        targetLineUserIds:[]
      }
    });
    assert.match(message,expected);
    assert.match(message,/實際送達仍以 LINE 結果為準/);
    assert.doesNotMatch(message,/保證送達/);
  }
});
