"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  richMenu
} = require(
  "../../scripts/setup-line-rich-menu"
);

test(
  "Rich Menu upload image stays below LINE 1 MB limit",
  function () {
    const imagePath = path.resolve(
      __dirname,
      "../../assets/line/jly-assistant-rich-menu-v1.jpg"
    );
    const imageSize =
      fs.statSync(
        imagePath
      ).size;

    assert.ok(
      imageSize > 0
    );
    assert.ok(
      imageSize <= 1024 * 1024,
      `Rich Menu image is ${imageSize} bytes`
    );
  }
);

test(
  "Rich Menu has three complete non-overlapping areas",
  function () {
    assert.equal(
      richMenu.areas.length,
      3
    );

    assert.deepEqual(
      richMenu.areas.map(
        function (area) {
          return area.action.text;
        }
      ),
      [
        "JLY 記帳",
        "JLY 車團資訊",
        "JLY 使用說明"
      ]
    );

    const totalWidth =
      richMenu.areas.reduce(
        function (sum, area) {
          return sum +
            area.bounds.width;
        },
        0
      );

    assert.equal(
      totalWidth,
      richMenu.size.width
    );
  }
);
