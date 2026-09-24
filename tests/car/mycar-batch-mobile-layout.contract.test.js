"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const css=fs.readFileSync("css/mycar.css","utf8");
const page=fs.readFileSync("pages/mycar.html","utf8");

assert(css.includes(".batch-check {\n  position: absolute;"),"batch selector must be absolutely positioned");
assert(css.includes(".mycar-card.batch-selectable {\n    grid-template-columns: 82px minmax(0, 1fr);"),"mobile batch card must keep normal two-column grid");
assert(css.includes("padding-top: 46px"),"mobile batch card must reserve vertical space for selector badge");
assert(css.includes(".mycar-card.batch-selectable .car-info {\n    min-width: 0;\n    padding-right: 0;"),"batch card info must keep usable width");
assert(page.includes("../css/mycar.css?v=7"),"MyCar page must load refreshed batch layout CSS");
console.log("mycar batch mobile layout contract ok");
