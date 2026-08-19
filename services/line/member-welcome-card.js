"use strict";

function normalizeText(value) {
  return String(value || "").trim();
}

function cleanBaseUrl(value) {
  return normalizeText(value).replace(/\/$/, "");
}

function getCarTitle(car) {
  return normalizeText(
    car && (car.scriptName || car.name)
  ) || "這場活動";
}

function uriButton(label, uri, color) {
  return {
    type: "button",
    style: "primary",
    color: color,
    margin: "md",
    action: {
      type: "uri",
      label,
      uri
    }
  };
}

function buildMemberWelcomeCard(
  car,
  options = {}
) {
  const baseUrl =
    cleanBaseUrl(options.baseUrl);

  const carId =
    encodeURIComponent(
      normalizeText(
        options.carId ||
        (car && (car.id || car.carId))
      )
    );

  const title = getCarTitle(car);

  const dmUrl =
    `${baseUrl}/pages/dm-join.html?id=${carId}`;

  const playerUrl =
    `${baseUrl}/pages/join.html?id=${carId}`;

  return {
    type: "flex",
    altText:
      `歡迎加入《${title}》｜請選擇你的身分`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `歡迎加入《${title}》`,
            weight: "bold",
            size: "lg",
            wrap: true
          },
          {
            type: "text",
            text: "請依這次參與身分選擇入口",
            size: "sm",
            color: "#777777",
            margin: "sm",
            wrap: true
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          uriButton(
            "🎭 我是本場 DM",
            dmUrl,
            "#806A9B"
          ),
          uriButton(
            "🎮 我要報名玩家",
            playerUrl,
            "#487A91"
          )
        ]
      }
    }
  };
}

module.exports = {
  buildMemberWelcomeCard
};
