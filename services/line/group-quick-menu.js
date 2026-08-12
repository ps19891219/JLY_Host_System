/*
JLY Host System

Module:
LINE Group Quick Menu V1

Responsibilities:

1. Build the LINE quick reply shown after a group calls JLY Assistant
2. Keep every action in the current group conversation
3. Send text commands that the existing message router can handle
*/

"use strict";

const GROUP_MENU_ITEMS = [
  {
    label: "記帳",
    text: "JLY 記帳"
  },
  {
    label: "提醒",
    text: "JLY 提醒"
  },
  {
    label: "車團資訊",
    text: "JLY 車團資訊"
  },
  {
    label: "使用說明",
    text: "JLY 使用說明"
  }
];

function buildGroupQuickMenuMessage() {
  return {
    type: "text",
    text: "我在這裡 🤖\n請選擇這個群組要使用的功能：",
    quickReply: {
      items: GROUP_MENU_ITEMS.map(
        function (item) {
          return {
            type: "action",
            action: {
              type: "message",
              label: item.label,
              text: item.text
            }
          };
        }
      )
    }
  };
}

module.exports = {
  GROUP_MENU_ITEMS,
  buildGroupQuickMenuMessage
};
