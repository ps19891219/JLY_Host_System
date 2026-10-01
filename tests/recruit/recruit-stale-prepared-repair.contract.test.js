"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../api/maintenance-repair-recruit-prepared.js"),"utf8");
test("Recruit repair is bounded to exact selected temporary token carIds",()=>{
 assert.match(source,/collection\("recruitPages"\)\.doc\(token\)\.get\(\)/);
 assert.match(source,/collection\("cars"\)\.doc\(id\)\.get\(\)/);
 assert.match(source,/collection\("carDetailViews"\)\.doc\(id\)\.get\(\)/);
 assert.match(source,/scope\)!=="selected"/);
 assert.match(source,/share\.temporary!==true/);
 assert.match(source,/!carIds\.length\|\|carIds\.length>50/);
 assert.doesNotMatch(source,/collection\("cars"\)\.get\(/);
 assert.doesNotMatch(source,/collection\("carDetailViews"\)\.get\(/);
});
test("Recruit repair defaults to preview and requires explicit repair confirmation",()=>{
 assert.match(source,/mode=text\(input\.mode\)\|\|"preview"/);
 assert.match(source,/mode!=="repair"/);
 assert.match(source,/repair_confirmation_required/);
 assert.match(source,/if\(mode==="preview"\)return/);
});