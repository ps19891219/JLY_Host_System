"use strict";

function text(value, fallback = "") { return String(value || fallback).trim(); }
function title(car) { return text(car && (car.scriptName || car.title || car.name), "JLY 車團"); }
function activePlayers(car) { return (Array.isArray(car && car.players) ? car.players : []).filter(item => item && item.status !== "cancelled" && item.status !== "已取消"); }
function buildStoreInfo(car) { const studio=text(car&&(car.studioName||car.organizerName||car.organizer),"尚未設定工作室"),location=text(car&&(car.locationName||car.location||car.address||car.storeAddress),"尚未設定地點"),navigation=text(car&&(car.navigationUrl||car.navigationLink||car.mapUrl));return[`🏠 ${title(car)}｜店家資訊`,`工作室：${studio}`,`地點：${location}`,navigation&&`導航：${navigation}`].filter(Boolean).join("\n"); }
function buildTimeInfo(car) { const date=text(car&&(car.gameDate||car.date||car.startDate),"尚未設定日期"),start=text(car&&(car.gameTime||car.time||car.startTime),"尚未設定時間"),gathering=text(car&&(car.gatheringTime||car.meetTime||car.meetingTime));return[`📅 ${title(car)}｜時間資訊`,`日期：${date}`,gathering&&`集合：${gathering}`,`開始：${start}`].filter(Boolean).join("\n"); }
function buildPeopleInfo(car) { const current=activePlayers(car).length,capacity=Number(car&&(car.totalPeople||car.capacity))||0,missing=capacity?Math.max(0,capacity-current):0;return[`👥 ${title(car)}｜人員資訊`,`目前玩家：${current}${capacity?` / ${capacity}`:""}`,capacity?(missing?`尚缺：${missing} 人`:"狀態：已滿團"):"固定人數：尚未設定"].join("\n"); }
module.exports = { buildStoreInfo, buildTimeInfo, buildPeopleInfo, activePlayers };
