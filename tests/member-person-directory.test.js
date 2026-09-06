"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPickerData() {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/modules/member/picker/picker-data.js"),
    "utf8"
  );
  const context = {
    window: {},
    console: { log() {}, warn() {} },
    Set,
    Map,
    String,
    Array,
    Boolean,
    Math
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.JLYMemberPickerData;
}

test("Person Directory marks an existing LINE-linked Person as reusable identity", () => {
  const data = loadPickerData();
  const person = { id: "person-1", displayName: "小安", lineUserId: "U123" };
  assert.equal(data.isLineLinked(person), true);
  assert.equal(data.getIdentityState(person), "line_linked");
  assert.equal(data.getIdentityLabel(person), "已連結 LINE");
});

test("provisional line: profile is not treated as formal Person identity", () => {
  const data = loadPickerData();
  const person = { id: "legacy-1", displayName: "Ian", profileId: "line:U123" };
  assert.equal(data.hasFormalIdentity(person), false);
  assert.equal(data.getIdentityState(person), "guest");
});

test("same-name People remain separate without strong identity evidence", () => {
  const data = loadPickerData();
  const people = [
    { id: "p1", displayName: "Ian" },
    { id: "p2", displayName: "Ian" }
  ];
  assert.equal(data.dedupeCanonicalMembers(people).length, 2);
});

test("shared strong LINE identity dedupes to one canonical directory entry", () => {
  const data = loadPickerData();
  const people = [
    { id: "p1", displayName: "小安", lineUserId: "U123" },
    { id: "p2", displayName: "小安舊資料", lineUserId: "U123", playCount: 4 }
  ];
  assert.equal(data.dedupeCanonicalMembers(people).length, 1);
});

test("manual player search is wired to canonical Person Directory", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/modules/car/detail/player/player-search.js"),
    "utf8"
  );
  assert.match(source, /loadPersonDirectory/);
  assert.match(source, /sameNameOverride/);
  assert.match(source, /已連結 LINE/);
});
