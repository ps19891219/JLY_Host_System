const fs = require('fs');
const path = require('path');
function read(rel){return fs.readFileSync(path.join(__dirname,'..','..',rel),'utf8');}
const data=read('js/recruit/recruit-data.js');
if(!data.includes('resolveOwnerIdentityIds')) throw new Error('Recruit data must resolve owner identity aliases');
if(!data.includes('linkedPlayerIds')) throw new Error('Recruit owner resolution must include linkedPlayerIds');
if(data.includes('.collection("cars")\n      .get()')) throw new Error('Recruit owner resolution must not scan all cars');
console.log('recruit owner identity contract ok');
