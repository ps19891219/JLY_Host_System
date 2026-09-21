"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../js/modules/member/person-directory.js"),"utf8");
test("guest removal protects formal members and only deletes Person plus prepared-view row",()=>{
 assert.match(src,/hasFormalIdentity\(current\)/);assert.match(src,/isLineLinked\(current\)/);
 assert.match(src,/tx\.delete\(personRef\)/);assert.match(src,/personDirectoryViews/);
 assert.doesNotMatch(src,/collection\("cars"\).*delete/);
});
test("member cards do not expose guest delete action",()=>assert.match(src,/isMember\(p\)\?"":/));
