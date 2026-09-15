const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../pages/mycar.html'), 'utf8');
const mycar = fs.readFileSync(path.join(__dirname, '../../js/mycar.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!html.includes('mycar-legacy-identity-repair.js'), 'normal MyCar page must not auto-run identity recovery');
assert(mycar.includes('function isMyHostCar'), 'host role must be filtered from prepared car fields');
assert(mycar.includes('function isMyPlayerCar'), 'player role must be filtered from prepared car fields');
assert(mycar.includes('car.isPlayer === true'), 'player classification must use prepared View role data');
assert(mycar.includes('car.isHost === true'), 'host classification must use prepared View role data');
assert(mycar.includes('await module.read('), 'normal MyCar path must read prepared View');

console.log('PASS mycar-view-first-contract');
