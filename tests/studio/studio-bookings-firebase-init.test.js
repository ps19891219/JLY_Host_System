"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const page=fs.readFileSync("pages/studio-bookings.html","utf8");
const inbox=fs.readFileSync("js/studio/studio-booking-inbox.js","utf8");

assert(page.includes('/firebase/firebase.js?v=27'),"Studio Booking page must load the shared Firebase bootstrap");
assert(!page.includes('../js/firebase-config.js'),"Studio Booking page must not reference the removed firebase-config.js");
assert(page.includes('/js/studio/studio-booking-inbox.js?v=2'),"Studio Booking inbox asset must be cache-bumped");
assert(inbox.includes("window.db.collection('studioBookingInboxViews')"),"Booking inbox must read the prepared inbox view");
assert(inbox.includes("Firebase 尚未初始化"),"Booking inbox must fail clearly if Firebase bootstrap is missing");
console.log("studio booking Firebase bootstrap regression checks passed");
