const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const firebase = fs.readFileSync('firebase/firebase.js', 'utf8');

test('mobile Firestore transport is forced to long polling', () => {
  assert.match(firebase, /experimentalForceLongPolling\s*:\s*true/);
  assert.doesNotMatch(firebase, /experimentalAutoDetectLongPolling\s*:\s*true/);
});
