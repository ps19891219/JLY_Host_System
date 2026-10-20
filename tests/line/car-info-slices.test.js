"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {buildStoreInfo,buildTimeInfo,buildPeopleInfo}=require("../../services/line/car-info-slices");
const car={scriptName:"溫床",studioName:"玩硬",address:"台北市測試路1號",date:"2026-08-20",time:"19:00",totalPeople:6,players:[{id:"1"},{id:"2"},{id:"3",status:"cancelled"}]};
test("store shortcut returns only saved store and location",()=>{const output=buildStoreInfo(car);assert.match(output,/玩硬/);assert.match(output,/台北市測試路1號/);assert.doesNotMatch(output,/導航|google\.com\/maps/);assert.doesNotMatch(output,/目前玩家/);});
test("store shortcut only shows navigation when an explicit link was saved",()=>{const output=buildStoreInfo({...car,navigationUrl:"https://maps.example.test/store"});assert.match(output,/導航：https:\/\/maps\.example\.test\/store/);});
test("time shortcut returns the activity date and start time",()=>{const output=buildTimeInfo(car);assert.match(output,/2026-08-20/);assert.match(output,/19:00/);});
test("time shortcut prioritizes the current formal game date and time fields",()=>{const output=buildTimeInfo({...car,date:"old-date",time:"old-time",gameDate:"2026-09-12",gameTime:"13:30"});assert.match(output,/日期：2026-09-12/);assert.match(output,/開始：13:30/);assert.doesNotMatch(output,/old-date|old-time/);});
test("people shortcut shows numbered players and empty seats",()=>{const output=buildPeopleInfo(car);assert.match(output,/1\\. /);assert.match(output,/2\\. /);assert.match(output,/3\\. /);assert.doesNotMatch(output,/尚缺：|目前玩家：|空缺/);});
test("people shortcut shows DM and named roles without vacancy text",()=>{
 const output=buildPeopleInfo({scriptName:"測試",staffSlots:[{label:"DM",displayName:"小明"},{label:"荼硯",displayName:"詩婕"}],slots:[{id:"s1",characterName:"溫也"},{id:"s2",characterName:"現西",playerId:"p1"}],players:[{playerId:"p1",playerName:"小美"}]});
 assert.match(output,/🎭 DM/);assert.match(output,/1\\. 小明/);assert.match(output,/荼硯：詩婕/);assert.match(output,/溫也：\\n/);assert.match(output,/現西：小美/);
});
