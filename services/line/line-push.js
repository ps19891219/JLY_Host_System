/*
JLY Host System

Module:
LINE Push Service V1

Responsibilities:

1. Send proactive LINE messages
2. Support group/user recipient IDs
3. Keep Push separate from Reply
4. Use server-side Messaging API token only
*/

"use strict";

const LINE_PUSH_URL =
  "https://api.line.me/v2/bot/message/push";


function normalizeText(value) {
  return String(
    value == null ? "" : value
  ).trim();
}


function getChannelAccessToken() {
  return normalizeText(
    process.env
      .LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  );
}


async function sendPushMessage(
  recipientId,
  messages
) {
  const token =
    getChannelAccessToken();

  const to =
    normalizeText(
      recipientId
    );

  const messageList =
    Array.isArray(messages)
      ? messages
      : [];

  if (!token) {
    throw new Error(
      "LINE Messaging channel access token is missing."
    );
  }

  if (!to) {
    throw new Error(
      "LINE push recipient is missing."
    );
  }

  if (messageList.length === 0) {
    throw new Error(
      "LINE push messages are empty."
    );
  }

  const response =
    await fetch(
      LINE_PUSH_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            to,
            messages:
              messageList
          })
      }
    );

  if (!response.ok) {
    let body = "";

    try {
      body =
        await response.text();
    } catch (error) {
      body = "";
    }

    console.error(
      "LINE push API failed.",
      {
        status:
          response.status,

        body
      }
    );

    throw new Error(
      `line_push_failed_${response.status}`
    );
  }

  return {
    success: true,
    status:
      response.status
  };
}


async function sendTextPush(
  recipientId,
  text
) {
  const normalizedText =
    normalizeText(
      text
    );

  if (!normalizedText) {
    throw new Error(
      "LINE push text is empty."
    );
  }

  return sendPushMessage(
    recipientId,
    [
      {
        type: "text",
        text:
          normalizedText
      }
    ]
  );
}


module.exports = {
  sendPushMessage,
  sendTextPush
};