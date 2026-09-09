const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const firebase = fs.readFileSync('firebase/firebase.js', 'utf8');

test('Work Schedule has a scoped Firestore REST fallback', () => {
  assert.match(firebase, /\/pages\\\/work-schedule\\\.html/);
  assert.match(firebase, /documents:runQuery/);
  assert.match(firebase, /collectionId: "workShifts"/);
  assert.match(firebase, /fieldPath: "monthKey"/);
});

test('Work Schedule falls back after SDK query timeout without changing writes', () => {
  assert.match(firebase, /SDK_QUERY_TIMEOUT/);
  assert.match(firebase, /2500/);
  assert.match(firebase, /return readWorkShiftsByRest\(monthFilter\.value\)/);
  assert.match(firebase, /if \(name !== "workShifts"\) return collection/);
});
