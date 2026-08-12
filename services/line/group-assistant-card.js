"use strict";

function text(value, fallback = "") {
  return String(value || fallback).trim();
}

function messageButton(label, command, color = "#2F6B57") {
  return {
    type: "button",
    style: "primary",
    color,
    height: "sm",
    action: { type: "message", label, text: command }
  };
}

function buildCard(title, subtitle, buttons) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F3EBDD",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, weight: "bold", size: "xl", color: "#382F2A", wrap: true },
          { type: "text", text: subtitle, size: "sm", color: "#766B63", margin: "md", wrap: true }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "18px",
        contents: buttons
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        contents: [{ type: "text", text: "需要時再次輸入「JLY 小助手」即可叫出入口", size: "xs", color: "#999999", wrap: true }]
      }
    }
  };
}

function getCarTitle(car) {
  return text(car && (car.scriptName || car.title || car.name), "JLY 車團");
}

function getCarSubtitle(car) {
  const date = text(car && (car.date || car.startDate));
  return date ? `${date}｜車團小助手` : "車團小助手";
}

function buildGroupAssistantCard(car) {
  return buildCard(
    `🐻 ${getCarTitle(car)}`,
    getCarSubtitle(car),
    [
      messageButton("💰 車團帳務", "JLY 車團帳務"),
      messageButton("🚐 車團資訊", "JLY 車團資訊", "#487A91"),
      messageButton("👥 成員與座位", "JLY 成員座位", "#806A9B"),
      messageButton("⏰ 提醒功能", "JLY 提醒", "#B17B42"),
      messageButton("📣 最新通知", "JLY 最新通知", "#9A5960"),
      messageButton("❓ 使用說明", "JLY 使用說明", "#777777")
    ]
  );
}

function buildAccountingMenuCard(car) {
  return buildCard(
    `💰 ${getCarTitle(car)}｜車團帳務`,
    "選擇要使用的帳務功能",
    [
      messageButton("➕ 新增分帳", "JLY 新增分帳"),
      messageButton("📒 帳目總覽", "JLY 帳本餘額", "#487A91"),
      messageButton("👤 我的應收／應付", "JLY 我的分帳", "#806A9B"),
      messageButton("✏️ 我的帳目", "JLY 我的帳目", "#B17B42")
    ]
  );
}

module.exports = {
  buildGroupAssistantCard,
  buildAccountingMenuCard,
  getCarTitle,
  getCarSubtitle
};
