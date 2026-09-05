"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const page=fs.readFileSync(path.join(__dirname,"../../js/line/membership-review-page.js"),"utf8");
const detail=fs.readFileSync(path.join(__dirname,"../../js/line/car-detail-membership-review.js"),"utf8");
test("LINE review treats player/LINE count as reference rather than correctness",()=>{assert.match(page,/人數只供核對參考/);assert.match(page,/不要求 LINE 與玩家人數相等/);assert.doesNotMatch(page,/人數不同，優先核對/);});
test("review opens car detail in verification context and detail returns to same group",()=>{assert.match(page,/lineReview=1&groupId=/);assert.match(detail,/確認目前人員名單/);assert.match(detail,/line-membership-review\.html\?carId=/);assert.match(detail,/groupId=/);});
