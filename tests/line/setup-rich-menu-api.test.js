"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createHandler,
  secretsMatch
} = require(
  "../../api/setup-line-rich-menu"
);

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value) {
      this.body = value || "";
    }
  };
}

async function withEnvironment(
  values,
  callback
) {
  const previous = {};

  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test(
  "secret comparison requires an exact non-empty match",
  function () {
    assert.equal(
      secretsMatch("correct", "correct"),
      true
    );
    assert.equal(
      secretsMatch("wrong", "correct"),
      false
    );
    assert.equal(
      secretsMatch("", ""),
      false
    );
  }
);

test(
  "setup endpoint rejects requests while disabled",
  async function () {
    await withEnvironment(
      {
        JLY_RICH_MENU_SETUP_ENABLED: "false",
        JLY_RICH_MENU_SETUP_SECRET: "secret",
        LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "token"
      },
      async function () {
        const handler = createHandler({
          applyRichMenu: async function () {
            throw new Error("must not run");
          }
        });
        const response = createResponse();

        await handler(
          {
            method: "POST",
            body: { secret: "secret" }
          },
          response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(
          JSON.parse(response.body).error,
          "setup_disabled"
        );
      }
    );
  }
);

test(
  "setup endpoint rejects an invalid secret",
  async function () {
    await withEnvironment(
      {
        JLY_RICH_MENU_SETUP_ENABLED: "true",
        JLY_RICH_MENU_SETUP_SECRET: "correct-secret",
        LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "token"
      },
      async function () {
        const handler = createHandler({
          applyRichMenu: async function () {
            throw new Error("must not run");
          }
        });
        const response = createResponse();

        await handler(
          {
            method: "POST",
            body: { secret: "wrong-secret" }
          },
          response
        );

        assert.equal(response.statusCode, 401);
        assert.equal(
          JSON.parse(response.body).error,
          "setup_unauthorized"
        );
      }
    );
  }
);

test(
  "setup endpoint applies menu with server-side LINE token",
  async function () {
    await withEnvironment(
      {
        JLY_RICH_MENU_SETUP_ENABLED: "true",
        JLY_RICH_MENU_SETUP_SECRET: "correct-secret",
        LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "server-token"
      },
      async function () {
        let receivedToken = "";
        const handler = createHandler({
          applyRichMenu: async function (token) {
            receivedToken = token;
            return "richmenu-test";
          }
        });
        const response = createResponse();

        await handler(
          {
            method: "POST",
            body: { secret: "correct-secret" }
          },
          response
        );

        const result = JSON.parse(response.body);

        assert.equal(response.statusCode, 200);
        assert.equal(result.success, true);
        assert.equal(result.richMenuId, "richmenu-test");
        assert.equal(receivedToken, "server-token");
        assert.equal(
          response.body.includes("server-token"),
          false
        );
      }
    );
  }
);
