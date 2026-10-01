"use strict";const assert=require("node:assert/strict"),fs=require("node:fs"),test=require("node:test");
const api=fs.readFileSync("api/car-view-context.js","utf8"),repo=fs.readFileSync("services/firebase/car-detail-view-repository.js","utf8");
test("car-view GET uses the same carDetailViews prepared source as Recruit",()=>{assert.match(api,/car-detail-view-repository/);assert.match(repo,/collection\("carDetailViews"\)\.doc\(id\)\.get\(\)/);assert.doesNotMatch(repo,/collection\("cars"\)/);});
test("car-view keeps exact Core access only in POST entry service",()=>{const entry=fs.readFileSync("services/car/car-entry-service.js","utf8");assert.match(entry,/collection\("cars"\)\.doc\(carId\)/);assert.match(entry,/runTransaction/);assert.match(api,/req\.method === "POST"/);});
test("temporary share policy remains an exact token read",()=>{assert.match(api,/collection\("recruitPages"\)\.doc\(ref\)\.get\(\)/);});
