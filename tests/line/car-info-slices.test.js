"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {buildStoreInfo,buildTimeInfo,buildPeopleInfo}=require("../../services/line/car-info-slices");
const car={scriptName:"溫床",studioName:"玩硬",address:"台北市測試路1號",date:"2026-08-20",time:"19:00",totalPeople:6,players:[{id:"1"},{id:"2"},{id:"3",status:"cancelled"}]};
test("store shortcut returns only store location and navigation",()=>{const output=buildStoreInfo(car);assert.match(output,/玩硬/);assert.match(output,/台北市測試路1號/);assert.match(output,/google\.com\/maps/);assert.doesNotMatch(output,/目前玩家/);});
test("time shortcut returns the activity date and start time",()=>{const output=buildTimeInfo(car);assert.match(output,/2026-08-20/);assert.match(output,/19:00/);});
test("people shortcut counts active players and vacancies",()=>{const output=buildPeopleInfo(car);assert.match(output,/目前玩家：2 \/ 6/);assert.match(output,/尚缺：4 人/);});
