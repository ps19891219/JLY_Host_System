const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "../../js/recruit/recruit-render.js"), "utf8");
const sandbox = { window: {}, console };
vm.runInNewContext(source, sandbox);
const render = sandbox.window.JLYRecruitRender;

assert.equal(render.getNeedText({ seatSummary: { maleTotal: 3, maleOccupied: 2, femaleTotal: 3, femaleOccupied: 1, flexibleTotal: 0, flexibleOccupied: 0 } }), "👥 尚缺 1男 2女");
assert.equal(render.getNeedText({ seatSummary: { maleTotal: 3, maleOccupied: 3, femaleTotal: 3, femaleOccupied: 3 } }), "✅ 已滿");
assert.equal(render.getNeedText({ totalPeople: 6, players: [{status:"已加入"},{status:"已加入"}] }), "👥 尚缺 4 人");
console.log("recruit gender vacancy contract passed");
