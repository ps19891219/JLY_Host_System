"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
function read(p){return fs.readFileSync(path.join(__dirname,"..",p),"utf8");}
test("Person Directory normal reads use one prepared view and never scan players Core",()=>{
 const picker=read("js/modules/member/picker/picker-data.js");
 assert.match(picker,/collection\("personDirectoryViews"\)\.doc\("canonical"\)/);
 assert.doesNotMatch(picker,/collection\("players"\)\.get\(\)/);
});
test("Car Detail manual player search has no players Core fallback scan",()=>{
 const source=read("js/modules/car/detail/player/player-search.js");
 assert.match(source,/loadPersonDirectory/);
 assert.doesNotMatch(source,/collection\("players"\)\.get\(\)/);
});
test("Legacy player typing does not trigger Firestore render reload",()=>{
 const source=read("js/player.js");
 assert.doesNotMatch(source,/addEventListener\("input",\s*renderPlayers\)/);
 assert.doesNotMatch(source,/collection\("players"\)\.orderBy[\s\S]*\.get\(\)/);
 assert.match(source,/loadPersonDirectory/);
});

test("Person Directory create and edit write through the prepared view",()=>{
 const source=read("js/modules/member/person-directory.js");
 assert.match(source,/collection\("personDirectoryViews"\)\.doc\("canonical"\)/);
 assert.match(source,/runTransaction/);
 assert.match(source,/aliases/);
});
