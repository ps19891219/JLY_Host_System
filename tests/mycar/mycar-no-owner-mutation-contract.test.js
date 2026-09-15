const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../pages/mycar.html'), 'utf8');

if (html.includes('mycar-identity-runtime.js')) {
  throw new Error('MyCar page must not load owner-id migration runtime');
}
if (html.includes('mycar-legacy-identity-repair.js')) {
  throw new Error('MyCar page must not load automatic identity mutation/rebuild repair');
}
console.log('PASS mycar-no-owner-mutation-contract');
