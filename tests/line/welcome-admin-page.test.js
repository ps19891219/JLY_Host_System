"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("welcome audit admin page uses ISO timestamps from persisted audit records", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../pages/line-welcome-admin.html"), "utf8");
  assert.match(html, /typeof rawTime === "string"/);
  assert.match(html, /change\.before/);
  assert.match(html, /change\.after/);
  assert.match(html, /textContent/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
});
