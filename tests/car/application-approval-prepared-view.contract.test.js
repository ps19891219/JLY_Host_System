const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/modules/car/detail/application/application-actions.js","utf8");
assert(src.includes("syncCarPreparedViewMutation"));
assert(src.includes('changedFields:["players","playerIds","applications","slots","history","updatedAt"]'));
const updateAt=src.indexOf("await carRef.update");
const preparedAt=src.indexOf("await syncCarPreparedViewMutation",updateAt);
const membershipAt=src.indexOf("await syncKnownMembershipMutation",updateAt);
assert(updateAt>=0&&preparedAt>updateAt&&membershipAt>preparedAt);
console.log("application approval prepared-view sync contract ok");
