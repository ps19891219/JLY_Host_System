/*
JLY Host System

Creates the first JLY Assistant Rich Menu.

Default mode is dry-run and does not call LINE.
Use --apply only after explicit approval.

Required for --apply:
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
*/

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const API_BASE =
  "https://api.line.me/v2/bot";

const DATA_API_BASE =
  "https://api-data.line.me/v2/bot";

const IMAGE_WIDTH = 2172;
const IMAGE_HEIGHT = 724;

const imagePath = path.resolve(
  __dirname,
  "../assets/line/jly-assistant-rich-menu-v1.jpg"
);

const richMenu = {
  size: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT
  },
  selected: true,
  name: "JLY Assistant Menu V1",
  chatBarText: "JLY 小助手",
  areas: [
    {
      bounds: {
        x: 0,
        y: 0,
        width: 724,
        height: IMAGE_HEIGHT
      },
      action: {
        type: "message",
        label: "記帳",
        text: "JLY 記帳"
      }
    },
    {
      bounds: {
        x: 724,
        y: 0,
        width: 724,
        height: IMAGE_HEIGHT
      },
      action: {
        type: "message",
        label: "車團資訊",
        text: "JLY 車團資訊"
      }
    },
    {
      bounds: {
        x: 1448,
        y: 0,
        width: 724,
        height: IMAGE_HEIGHT
      },
      action: {
        type: "message",
        label: "使用說明",
        text: "JLY 使用說明"
      }
    }
  ]
};

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

async function lineRequest(
  url,
  token,
  options = {}
) {
  const response = await fetch(
    url,
    {
      ...options,
      headers: {
        Authorization:
          `Bearer ${token}`,
        ...(options.headers || {})
      }
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `LINE API ${response.status}: ${responseText}`
    );
  }

  return responseText
    ? JSON.parse(responseText)
    : {};
}

async function applyRichMenu(token) {
  const created = await lineRequest(
    `${API_BASE}/richmenu`,
    token,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body:
        JSON.stringify(
          richMenu
        )
    }
  );

  const richMenuId =
    normalizeText(
      created.richMenuId
    );

  if (!richMenuId) {
    throw new Error(
      "LINE API did not return richMenuId."
    );
  }

  await lineRequest(
    `${DATA_API_BASE}/richmenu/${richMenuId}/content`,
    token,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "image/jpeg"
      },
      body:
        fs.readFileSync(
          imagePath
        )
    }
  );

  await lineRequest(
    `${API_BASE}/user/all/richmenu/${richMenuId}`,
    token,
    {
      method: "POST"
    }
  );

  return richMenuId;
}

async function main() {
  if (!fs.existsSync(imagePath)) {
    throw new Error(
      `Rich menu image not found: ${imagePath}`
    );
  }

  const shouldApply =
    process.argv.includes(
      "--apply"
    );

  if (!shouldApply) {
    console.log(
      "JLY Rich Menu dry-run: OK"
    );
    console.log(
      JSON.stringify(
        richMenu,
        null,
        2
      )
    );
    console.log(
      "No LINE API request was sent."
    );
    return;
  }

  const token = normalizeText(
    process.env
      .LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  );

  if (!token) {
    throw new Error(
      "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is required."
    );
  }

  const richMenuId =
    await applyRichMenu(
      token
    );

  console.log(
    `JLY Rich Menu applied: ${richMenuId}`
  );
}

if (require.main === module) {
  main().catch(
    function (error) {
      console.error(
        "JLY Rich Menu setup failed.",
        error
      );
      process.exitCode = 1;
    }
  );
}

module.exports = {
  richMenu,
  applyRichMenu
};
