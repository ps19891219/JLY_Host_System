"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "../..");
const mycar = fs.readFileSync(path.join(root, "js/mycar-temporary-share.js"), "utf8");
const shareData = fs.readFileSync(path.join(root, "js/recruit/recruit-share-data.js"), "utf8");
const recruitRender = fs.readFileSync(path.join(root, "js/recruit/recruit-render.js"), "utf8");
const carView = fs.readFileSync(path.join(root, "js/car/car-view.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api/car-view-context.js"), "utf8");

assert(mycar.includes("mycarTemporaryShareShowPlayers"));
assert(mycar.includes("{ showPlayers }"));
assert(shareData.includes("showPlayers,"));
assert(recruitRender.includes("setShareRef"));
assert(recruitRender.includes('"&share="'));
assert(carView.includes('searchParams.set("share"'));
assert(api.includes("temporarySharePolicy"));
assert(api.includes("hidePublicRoster"));
assert(api.includes("players: []"));
assert(api.includes('page.showPlayers === true'));

console.log("temporary share player visibility contract passed");
