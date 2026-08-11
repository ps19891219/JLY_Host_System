/*
JLY Host System

Module:
LINE Reply Service V1

Responsibilities:

1. Send reply messages through LINE Messaging API
2. Use replyToken from webhook event
3. Use LINE_MESSAGING_CHANNEL_ACCESS_TOKEN from Vercel
4. Return a normalized result

V1 supports:
- Text reply only

V1 does NOT:
- Push messages
- Multicast
- Broadcast
- Write Firebase
*/

"use strict";

const LINE_REPLY_URL =
  "https://api.line.me/v2/bot/message/reply";

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Get Channel Access Token
// ============================================================

function getChannelAccessToken() {
  return normalizeText(
    process.env
      .LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  );
}

// ============================================================
// Send Reply
// ============================================================

async function sendReplyMessage(
  replyToken,
  messages
) {
  const token =
    getChannelAccessToken();

  const normalizedReplyToken =
    normalizeText(
      replyToken
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

  if (!normalizedReplyToken) {
    throw new Error(
      "LINE reply token is missing."
    );
  }

  if (messageList.length === 0) {
    throw new Error(
      "LINE reply messages are empty."
    );
  }

  const response =
    await fetch(
      LINE_REPLY_URL,
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
            replyToken:
              normalizedReplyToken,

            messages:
              messageList
          })
      }
    );

  if (!response.ok) {
    let errorBody = "";

    try {
      errorBody =
        await response.text();
    } catch (error) {
      errorBody = "";
    }

    console.error(
      "LINE reply API failed.",
      {
        status:
          response.status,

        body:
          errorBody
      }
    );

    throw new Error(
      `line_reply_failed_${response.status}`
    );
  }

  return {
    success: true,
    status:
      response.status
  };
}

// ============================================================
// Send Text Reply
// ============================================================

async function sendTextReply(
  replyToken,
  text
) {
  const normalizedText =
    normalizeText(
      text
    );

  if (!normalizedText) {
    throw new Error(
      "LINE reply text is empty."
    );
  }

  return sendReplyMessage(
    replyToken,
    [
      {
        type: "text",
        text:
          normalizedText
      }
    ]
  );
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  sendReplyMessage,
  sendTextReply
};