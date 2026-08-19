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

function uriButton(label, uri, color = "#2F6B57") {
  return {
    type: "button",
    style: "primary",
    color,
    height: "sm",
    action: { type: "uri", label, uri }
  };
}


function reminderControl(reminder) {
  const source =
    reminder &&
    typeof reminder === "object"
      ? reminder
      : null;

  if (
    source &&
    source.enabled === true
  ) {
    const sent =
      String(
        source.status || ""
      ).trim() === "sent";

    return {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      cornerRadius: "8px",
      backgroundColor: "#F2F2F2",
      contents: [
        {
          type: "text",
          text:
            sent
              ? "✅ 行前通知已發送"
              : "✅ 行前通知已開啟",
          align: "center",
          color: "#777777",
          size: "sm",
          weight: "bold"
        }
      ]
    };
  }

  return messageButton(
    "🔔 行前通知",
    "開啟行前通知",
    "#A66A45"
  );
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
  const date = text(car && (car.gameDate || car.date || car.startDate));
  return date ? `${date}｜車團小助手` : "車團小助手";
}

function buildGroupAssistantCard(car, options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const token = encodeURIComponent(String(options.token || ""));
  const link = tab => `${baseUrl}/pages/group-assistant.html?token=${token}&tab=${tab}`;
  return buildCard(
    `🐻 ${getCarTitle(car)}`,
    getCarSubtitle(car),
    [
      uriButton("💰 車團帳務", link("accounting")),
      uriButton("🚐 車團資訊", link("info"), "#487A91"),
      uriButton("👥 成員與座位", link("members"), "#806A9B"),
      uriButton("⏰ 提醒功能", link("notices"), "#B17B42"),
      uriButton("📣 最新通知", link("notices"), "#9A5960"),
      uriButton("❓ 使用說明", link("info"), "#777777")
    ]
  );
}

function buildAccountingMenuCard(car, options = {}) {
  const baseUrl=String(options.baseUrl||"").replace(/\/$/,""),token=encodeURIComponent(String(options.token||""));
  const totalLink=`${baseUrl}/pages/group-assistant.html?token=${token}&tab=accounting`;
  return buildCard(
    `💰 ${getCarTitle(car)}｜車團帳務`,
    "選擇要使用的帳務功能",
    [
      uriButton("📊 車團總帳", totalLink, "#487A91"),
      messageButton("➕ 新增分帳", "JLY 新增分帳"),
      messageButton("👤 我的應收／應付", "JLY 我的分帳", "#806A9B"),
      messageButton("✏️ 我的帳目", "JLY 我的帳目", "#B17B42")
    ]
  );
}

function buildGroupAssistantQuickInfoCard(car, options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, ""), token = encodeURIComponent(String(options.token || ""));
  const link = tab => `${baseUrl}/pages/group-assistant.html?token=${token}&tab=${tab}`;
  const carId = encodeURIComponent(text(options.carId || (car && (car.id || car.carId))));
  const playerViewLink = carId
    ? `${baseUrl}/pages/car-view.html?id=${carId}`
    : link("info");
  return buildCard(`🚗 ${getCarTitle(car)}`, getCarSubtitle(car), [
  messageButton("🏠 店家資訊", "JLY 店家"),
  messageButton("📅 時間資訊", "JLY 時間", "#487A91"),
  messageButton("👥 人員資訊", "JLY 人員", "#806A9B"),
  uriButton("⚡ 快速記帳", link("accounting"), "#B17B42"),
  reminderControl(options.reminder),
  uriButton("🚗 車團總覽", playerViewLink, "#9A5960"),
  messageButton("❓ 使用說明", "JLY 使用說明", "#777777")
]);
}

module.exports = {
  buildGroupAssistantCard: buildGroupAssistantQuickInfoCard,
  buildAccountingMenuCard,
  getCarTitle,
  getCarSubtitle
};

