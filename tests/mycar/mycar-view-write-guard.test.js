const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../js/data-view/mycar-view.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('async function write'),
  'MyCar View module must expose its write path'
);
assert(
  source.includes('mycar_empty_view_overwrite_blocked'),
  'MyCar View write path must guard destructive empty replacement'
);

console.log('PASS mycar-view-write-guard');
