"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const source=fs.readFileSync("js/cardetail.js","utf8");
const page=fs.readFileSync("pages/car-detail.html","utf8");

const start=source.indexOf("async function cancelCar()");
const end=source.indexOf("/* =========================\n   報名申請",start);
const fn=source.slice(start,end);

assert(fn.includes("const currentCalendar = currentCar.calendar || {}"),"cancel must inspect current calendar state");
assert(fn.includes("authorizeForCar"),"cancel must request Google authorization before Firestore await");
assert(fn.includes("removeSyncedEvent"),"cancel must delete synced Google event");
assert(fn.includes('syncStatus: "cancelled"'),"cancel must persist cancelled calendar status");
assert(fn.includes('eventId: ""'),"cancel must clear eventId after deletion");
assert(fn.includes('eventUrl: ""'),"cancel must clear eventUrl after deletion");
assert(fn.includes("alreadyCancelled"),"cancel must support cleanup for already-cancelled cars");
assert(fn.includes("Google 行程已清除"),"already-cancelled cleanup must record history");
assert(fn.includes('"calendar"'),"Prepared View sync must include calendar changes");
assert(page.includes("/js/cardetail.js?v=63"),"car detail must load refreshed cancel lifecycle asset");
console.log("car cancel calendar lifecycle regression checks passed");
