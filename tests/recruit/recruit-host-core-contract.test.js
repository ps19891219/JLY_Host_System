const fs = require("fs");
const path = require("path");

const controller = fs.readFileSync(
  path.join(__dirname, "../../js/recruit/recruit-controller.js"),
  "utf8"
);

if (!controller.includes("getRecruitCarsByOwner")) {
  throw new Error("Recruit must read host cars through formal Car Data owner query");
}

if (controller.includes("ownerCars.filter(\n    isHostCar")) {
  throw new Error("Raw Core owner cars must not be filtered by Prepared View role fields");
}

if (!controller.includes("const hostCars =")) {
  throw new Error("Recruit host group must be built from owner cars");
}

if (!controller.includes("filterRecruitCars(\n      hostCars")) {
  throw new Error("Recruit host cars must still pass recruiting/public filters");
}

console.log("recruit host core contract: ok");
