const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('js/matching/matching-conflict.js', 'utf8');
const cars = [
  { id: 'other-late', scriptName: 'Late car', gameDate: '2027-05-02', gameTime: '23:30', status: '開團中' },
  { id: 'other-near', scriptName: 'Near car', gameDate: '2027-05-02', gameTime: '19:30', status: '開團中' }
];
const sandbox = { window: { JLYMatchingData: { getConflictCars: async () => cars } }, console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
(async () => {
  const api = sandbox.window.JLYMatchingConflict;
  await api.loadConflictCars(true);
  const conflicts = api.findConflictsForSlot({ date: '2027-05-02', time: '19:00' }, 'current');
  assert.strictEqual(conflicts.length, 2, 'all same-day cars must be visible, even outside the 120-minute buffer');
  assert.strictEqual(conflicts[0].isWithinBuffer, true);
  assert.strictEqual(conflicts[1].isWithinBuffer, false);
  console.log('matching-conflict-same-day.test.js passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
