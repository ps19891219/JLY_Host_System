const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "pages/mycar.html"), "utf8");
const mycar = fs.readFileSync(path.join(root, "js/mycar.js"), "utf8");
const share = fs.readFileSync(path.join(root, "js/mycar-temporary-share.js"), "utf8");

test("MyCar batch exposes selected temporary recruit share", () => {
  assert.match(html, /id="batchTemporaryShareButton"/);
  assert.match(html, /openMyCarTemporaryShare\(\)/);
  assert.match(html, /mycar-temporary-share\.js\?v=1/);
  assert.match(share, /JLYRecruitShareData\.createSelectedShareToken/);
  assert.match(share, /Array\.from\(selectedCars\)/);
});

test("MyCar batch selection survives page navigation and select-all stays page scoped", () => {
  assert.match(mycar, /let selectedCars = new Set\(\)/);
  assert.match(mycar, /visibleCarIds\.forEach/);
  assert.match(mycar, /selectedCars\.add/);
  assert.match(mycar, /function goMyCarNextPage\(\)[\s\S]*?renderMyCars/);
  assert.doesNotMatch(
    mycar.match(/function goMyCarNextPage\(\)[\s\S]*?function getCurrentPageCursorId/)?.[0] || "",
    /selectedCars\.clear/
  );
  assert.doesNotMatch(
    mycar.match(/function goMyCarPreviousPage\(\)[\s\S]*?function goMyCarNextPage/)?.[0] || "",
    /selectedCars\.clear/
  );
});

test("temporary share reuses existing selected recruit token architecture", () => {
  assert.match(html, /recruit-share-data\.js/);
  assert.doesNotMatch(share, /collection\(["']cars["']\)/);
  assert.doesNotMatch(share, /collectionGroup/);
  assert.match(share, /"never"/);
  assert.match(share, /"30"/);
});
