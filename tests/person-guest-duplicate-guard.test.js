"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../js/modules/car/detail/player/player-search.js"),"utf8");
test("manual guest creation blocks silent same-name duplicates",()=>{
 assert.match(src,/same_name_person_requires_resolution/);
 assert.match(src,/sameNameOverride=true/);
 assert.match(src,/另一位不同的真人/);
});
test("manual guest creation writes Person and prepared directory in one transaction",()=>{
 assert.match(src,/collection\("personDirectoryViews"\)\.doc\("canonical"\)/);
 assert.match(src,/runTransaction/);
 assert.match(src,/tx\.set\(ref,row/);
 assert.doesNotMatch(src,/collection\("players"\)\.get\(/);
});
