"use strict";

const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "../../pages/mycar.html"), "utf8");
const mycar = fs.readFileSync(path.join(__dirname, "../../js/mycar.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!html.includes("mycar-legacy-identity-repair.js"), "normal MyCar page must not rebuild identity/view");
assert(mycar.includes("car.isHost === true"), "host classification must use prepared host role");
assert(mycar.includes('car.role || ""'), "host classification may consume prepared role");
assert(mycar.includes('car.ownerType || ""'), "host classification may consume prepared ownerType");
assert(mycar.includes("!isMyHostCar(car) &&"), "non-host/player classification must never duplicate host cars");
assert(mycar.includes("car.isPlayer === true"), "player classification must use prepared player role");
assert(mycar.includes("await module.read("), "normal MyCar runtime must read prepared view");
assert(!mycar.includes('collection("cars")'), "normal MyCar runtime must not scan cars core");

console.log("PASS mycar-host-nonhost-contract");
