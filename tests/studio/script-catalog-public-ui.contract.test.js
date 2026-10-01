"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const html=fs.readFileSync("pages/script-catalog.html","utf8");
test("public catalog uses only the prepared-view API",()=>{
 assert.match(html,/fetch\(url,\{cache:"no-store"\}\)/);
 assert.match(html,/\/api\/script-catalog/);
 assert.doesNotMatch(html,/collection\(["']scripts["']\)/);
 assert.doesNotMatch(html,/firebase\.firestore/);
});
test("public script browse does not require LINE authentication",()=>{
 assert.doesNotMatch(html,/line-login|line\/login|LIFF|liff\.login/i);
 assert.match(html,/瀏覽劇本不需登入/);
});
test("script metadata is rendered as text, not injected HTML",()=>{
 assert.match(html,/node\.textContent=String\(value\)/);
 assert.doesNotMatch(html,/innerHTML\s*=/);
});
