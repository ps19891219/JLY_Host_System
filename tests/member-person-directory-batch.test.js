"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
function read(p){return fs.readFileSync(path.join(__dirname,"..",p),"utf8");}
test("home routes roster management to canonical Person Directory",()=>{const s=read("index.html");assert.match(s,/pages\/person-directory\.html/);});
test("Person Directory supports create, edit, member and guest filters",()=>{const page=read("pages/person-directory.html");const js=read("js/modules/member/person-directory.js");assert.match(page,/data-person-filter="member"/);assert.match(page,/data-person-filter="guest"/);assert.match(page,/createPersonButton/);assert.match(js,/collection\("players"\)\.add/);assert.match(js,/collection\("players"\)\.doc\(id\)\.update/);assert.match(js,/hasFormalIdentity/);});
test("LINE group welcome links carry group UI context",()=>{const s=read("services/line/member-welcome-card.js");assert.match(s,/source=line_group/);});
test("group player and DM entry have no self-add roster option",()=>{const s=read("js/car/car-view-actions.js");assert.match(s,/isGroupEntry/);assert.match(s,/名單沒有你的名字時，請聯絡主揪新增/);assert.doesNotMatch(s,/名單沒有我／新增我的名字/);assert.match(s,/公開揪團報名不顯示主揪後台人員名單/);});
test("manual add preserves explicit same-name Person override",()=>{const s=read("js/modules/car/detail/player/player-search.js");assert.match(s,/approvedSameNameIds/);assert.match(s,/sameNameOverride=true/);assert.match(s,/same_name_person_requires_resolution/);});
