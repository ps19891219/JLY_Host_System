"use strict";

function text(value, fallback = "") { return String(value || fallback).trim(); }
function title(car) { return text(car && (car.scriptName || car.title || car.name), "JLY 車團"); }
function activePlayers(car) { return (Array.isArray(car && car.players) ? car.players : []).filter(item => item && item.status !== "cancelled" && item.status !== "已取消"); }
function buildStoreInfo(car) { const studio=text(car&&(car.studioName||car.organizerName||car.organizer),"尚未設定工作室"),location=text(car&&(car.locationName||car.location||car.address||car.storeAddress),"尚未設定地點"),navigation=text(car&&(car.navigationUrl||car.navigationLink||car.mapUrl));return[`🏠 ${title(car)}｜店家資訊`,`工作室：${studio}`,`地點：${location}`,navigation&&`導航：${navigation}`].filter(Boolean).join("\n"); }
function buildTimeInfo(car) { const date=text(car&&(car.gameDate||car.date||car.startDate),"尚未設定日期"),start=text(car&&(car.gameTime||car.time||car.startTime),"尚未設定時間"),gathering=text(car&&(car.gatheringTime||car.meetTime||car.meetingTime));return[`📅 ${title(car)}｜時間資訊`,`日期：${date}`,gathering&&`集合：${gathering}`,`開始：${start}`].filter(Boolean).join("\n"); }
function personName(row) { return text(row && (row.hostAlias || row.playerName || row.displayName || row.name || row.nickname || row.memberSnapshot?.displayName || row.player?.hostAlias || row.player?.playerName || row.player?.displayName)); }
function roleName(row) { const value=text(row && (row.characterName || row.roleName || row.character || row.roleChoice || row.seatLabel || row.scriptRole || row.roleLabel || row.label)); return value==="DM"?"":value; }
function playerId(row) { return text(row && (row.playerId || row.profileId || row.player?.playerId || row.memberId)); }
function numberedRows(rows) { return rows.map((row,i) => roleName(row) ? roleName(row)+"："+personName(row) : (i+1)+". "+personName(row)); }
function buildPeopleInfo(car) {
 const safe=car||{},players=activePlayers(safe),staff=Array.isArray(safe.staffSlots)?safe.staffSlots:[],slots=Array.isArray(safe.slots)?safe.slots:[];
 const byId=new Map(players.map(p=>[playerId(p),p]).filter(pair=>pair[0]));
 const used=new Set();
 const seats=slots.map(slot=>{
  const id=text(slot && (slot.playerId || slot.player?.playerId)),player=byId.get(id);
  if(player)used.add(id);
  return { ...slot, ...(player||{}),characterName:roleName(slot)||roleName(player),displayName:personName(player)||personName(slot&&slot.player)||personName(slot) };
 });
 players.forEach(p=>{if(!used.has(playerId(p)))seats.push(p);});
 if(!slots.length){const capacity=Math.min(Math.max(0,Number(safe.totalPeople||safe.capacity)||0),100);while(seats.length<capacity)seats.push({});}
 const lines=["👥 "+title(safe)+"｜人員資訊"];
 if(staff.length)lines.push("","🎭 DM",...numberedRows(staff));
 lines.push("","👥 玩家",...numberedRows(seats));
 return lines.join("\n");
}
module.exports = { buildStoreInfo, buildTimeInfo, buildPeopleInfo, activePlayers };
