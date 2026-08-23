const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

test("MyCar production render runs in a browser global without Node module", async () => {
  const carList = { innerHTML: "", addEventListener() {} };
  const elements = {
    carList,
    searchInput: { value: "", addEventListener() {} }
  };
  const browserErrors = [];
  const document = {
    addEventListener() {},
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const preparedCar = {
    id: "browser-car",
    ownerId: "viewer-1",
    scriptName: "Browser Runtime",
    status: "規劃中",
    players: [],
    playerIds: [],
    totalPeople: 6,
    slots: []
  };
  const window = {
    db: {},
    scrollY: 0,
    scrollTo() {},
    addEventListener() {},
    JLYIdentity: {
      getCurrentPlayerId() {
        return "viewer-1";
      }
    },
    JLYMyCarView: {
      async read() {
        return {
          schemaVersion: 4,
          viewType: "mycar_index",
          viewerId: "viewer-1",
          identityIds: ["viewer-1"],
          cars: [preparedCar]
        };
      },
      compactCar(car) {
        return { ...car, isHost: true, viewerRole: "owner" };
      }
    }
  };
  const context = {
    window,
    document,
    console: {
      log() {},
      warn() {},
      error(...args) {
        browserErrors.push(args.map(String).join(" "));
      }
    },
    localStorage: { getItem() { return ""; }, setItem() {} },
    sessionStorage: { getItem() { return ""; }, setItem() {}, removeItem() {} },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    URLSearchParams,
    location: { href: "http://localhost/pages/mycar.html", search: "" },
    history: { replaceState() {} },
    buildCarCard(car) {
      return `<article data-car-id="${car.id}">${car.scriptName}</article>`;
    }
  };

  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/mycar.js"), "utf8"),
    context,
    { filename: "pages/mycar.html -> js/mycar.js" }
  );

  await window.renderMyCars({ restoreScroll: false });

  assert.match(carList.innerHTML, /Browser Runtime/);
  assert.doesNotMatch(carList.innerHTML, /讀取失敗/);
  assert.equal(
    browserErrors.some(message => /(?:Can't find variable|is not defined):? module/.test(message)),
    false
  );
});
