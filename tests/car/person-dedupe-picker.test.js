"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBrowserModule(relativePath, windowOverrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");
  const window = { ...windowOverrides };
  const context = { window, console };
  vm.runInNewContext(source, context, { filename: relativePath });
  return window;
}

test("Person picker never merges two records by name alone", () => {
  const window = loadBrowserModule("js/modules/member/picker/picker-data.js");
  const data = window.JLYMemberPickerData;
  const result = data.dedupeCanonicalMembers([
    { id: "person-a", displayName: "Ian" },
    { id: "person-b", displayName: "Ian" }
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(Array.from(result, item => item.id).sort(), ["person-a", "person-b"]);
});

test("Person picker collapses records that share strong LINE identity evidence", () => {
  const window = loadBrowserModule("js/modules/member/picker/picker-data.js");
  const data = window.JLYMemberPickerData;
  const result = data.dedupeCanonicalMembers([
    { id: "legacy-a", displayName: "Ian", lineUserId: "U123" },
    { id: "canonical-a", displayName: "Ian", lineUserId: "U123", identityId: "identity-1" }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "canonical-a");
});

test("Person picker resolves mergedIntoPersonId back to the canonical document id", () => {
  const window = loadBrowserModule("js/modules/member/picker/picker-data.js");
  const data = window.JLYMemberPickerData;
  const result = data.dedupeCanonicalMembers([
    { id: "canonical-a", displayName: "Ian", isCanonicalPerson: true },
    { id: "legacy-a", displayName: "Ian old", mergedIntoPersonId: "canonical-a" }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "canonical-a");
});

test("synthetic line:<userId> values are not treated as formal Person evidence", () => {
  const window = loadBrowserModule("js/modules/member/picker/picker-data.js");
  const data = window.JLYMemberPickerData;
  const result = data.dedupeCanonicalMembers([
    { id: "record-a", displayName: "A", profileId: "line:U123" },
    { id: "record-b", displayName: "B", profileId: "line:U123" }
  ]);

  assert.equal(result.length, 2);
});

test("same-name creation requires explicit override and never silently reuses a Person", async () => {
  const existing = { id: "person-ian", displayName: "Ian" };
  let addCount = 0;
  const dataModule = {
    findDuplicateMembers(members, displayName) {
      return String(displayName).trim().toLowerCase() === "ian" ? members.filter(item => item.id === "person-ian") : [];
    },
    async loadAllMembers() { return [existing]; }
  };
  const stateModule = {
    getAllMembers() { return [existing]; },
    addMember() {}
  };
  const db = {
    collection(name) {
      assert.equal(name, "players");
      return {
        async add() {
          addCount += 1;
          return { id: "person-new" };
        }
      };
    }
  };

  const window = loadBrowserModule("js/modules/member/picker/picker-create.js", {
    db,
    JLYMemberPickerData: dataModule,
    JLYMemberPickerState: stateModule
  });
  const create = window.JLYMemberPickerCreate;

  const blocked = await create.createMember("Ian");
  assert.equal(blocked.created, false);
  assert.equal(blocked.requiresExplicitSameNameOverride, true);
  assert.equal(blocked.member, null);
  assert.equal(addCount, 0);

  await assert.rejects(
    () => create.createOrUseExisting("Ian"),
    error => error && error.code === "same_name_person_requires_resolution"
  );
  assert.equal(addCount, 0);

  const allowed = await create.createMember("Ian", { allowSameNamePerson: true });
  assert.equal(allowed.created, true);
  assert.equal(allowed.member.id, "person-new");
  assert.equal(allowed.member.sameNameOverride, true);
  assert.deepEqual(Array.from(allowed.member.sameNameReferenceIds), ["person-ian"]);
  assert.equal(addCount, 1);
});