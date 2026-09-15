const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../pages/mycar.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  !html.includes('mycar-legacy-identity-repair.js'),
  'MyCar normal page load must not run legacy identity rebuild/write repair'
);
assert(
  html.includes('/js/mycar.js?v=48'),
  'MyCar normal page must keep the View-first reader'
);
assert(
  html.includes('/js/modules/calendar/mycar-calendar-repair.js?v=9'),
  'MyCar calendar accepted repair must remain loaded'
);

console.log('PASS mycar-page-readonly-contract');
