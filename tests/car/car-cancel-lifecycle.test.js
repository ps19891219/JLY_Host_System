"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const source=fs.readFileSync("js/cardetail.js","utf8");
const page=fs.readFileSync("pages/car-detail.html","utf8");

assert(!source.includes("finishCurrentCar()"),"manual finish action should not be rendered");
assert(!source.includes("🏁 結束車團"),"manual finish button should be removed");
assert(source.includes('onclick="cancelCar()"'),"cancel menu action must call the real cancel function");
assert(source.includes('status: "已取消"'),"cancel keeps the car and marks it cancelled");
assert(source.includes('cancelReason: reasonText'),"cancel reason must be preserved");
assert(source.includes('cancelledAt: nowTime()'),"cancel timestamp must be preserved");
assert(source.includes('"車團已取消，原因："'),"cancel history must be recorded");
assert(source.includes("syncJLYViewsFromKnownMutation"),"cancel must sync prepared views");
assert(page.includes("/js/cardetail.js?v=63"),"car detail must load the refreshed lifecycle asset");
console.log("car cancel lifecycle regression checks passed");
