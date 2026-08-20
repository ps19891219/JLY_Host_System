const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Car Detail carries carId from MyCar card URL into the Core loader", () => {
  const cardSource = read("js/carCard.js");
  const detailSource = read("js/cardetail.js");
  const loaderSource = read("js/modules/car/detail/controller/detail-loader.js");

  assert.match(cardSource, /car-detail\.html\?id=\$\{car\.id\}/);
  assert.match(detailSource, /function getCarId\(\)\s*\{[\s\S]*new URLSearchParams\([\s\S]*location\.search[\s\S]*\.get\("id"\)/);
  assert.match(detailSource, /const carId\s*=\s*getCarId\(\)/);
  assert.match(loaderSource, /collection\("cars"\)\s*\.doc\(carId\)\s*\.get\(\)/);
});

test("Car Detail deploys the repaired runtime cache version", () => {
  const html = read("pages/car-detail.html");

  assert.match(html, /\/js\/cardetail\.js\?v=60/);
});
