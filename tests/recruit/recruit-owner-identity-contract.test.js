const fs = require('fs');
const path = require('path');
function read(rel){return fs.readFileSync(path.join(__dirname,'..','..',rel),'utf8');}
const data=read('js/recruit/recruit-data.js');
const page=read('pages/recruit.html');
if(!data.includes('resolveOwnerIdentityIds')) throw new Error('Recruit data must resolve owner identity aliases');
if(!data.includes('linkedPlayerIds')) throw new Error('Recruit owner resolution must include linkedPlayerIds');
if(data.includes('.collection("cars")\n      .get()')) throw new Error('Recruit owner resolution must not scan all cars');
if(!data.includes('const ownerIdentityCache = new Map()')) throw new Error('Recruit must cache owner identity expansion for one page lifetime');
if(!data.includes('ownerIdentityCache.has(normalizedOwnerId)')) throw new Error('Recruit must reuse resolved owner identities');
if(!data.includes('ownerIdentityCache.set(normalizedOwnerId, resolvedIds)')) throw new Error('Recruit must retain completed owner identity expansion');
if(!page.includes('recruit-data.js?v=6')) throw new Error('Recruit page must load the current data revision');
console.log('recruit owner identity contract ok');