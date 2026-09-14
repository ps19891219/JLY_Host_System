"use strict";

console.log("application-review.js V4 linked identity review loaded");

let currentReviewType = "player";
let currentReviewSummary = { total: 0, playerCount: 0, dmCount: 0, cars: [] };

function reviewText(value) { return String(value == null ? "" : value).trim(); }
function reviewEscape(value) { return reviewText(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }

function getOwnerIds() {
  const ids = new Set();
  const identity = window.JLYIdentity;
  const add = value => { const id = reviewText(value); if (id) ids.add(id); };
  const addMany = values => (Array.isArray(values) ? values : []).forEach(add);
  if (identity) {
    if (typeof identity.getCurrentPlayerId === "function") add(identity.getCurrentPlayerId());
    if (typeof identity.getCurrentPlayerProfileId === "function") add(identity.getCurrentPlayerProfileId());
    if (typeof identity.getAllPlayerIdentityIds === "function") addMany(identity.getAllPlayerIdentityIds());
    if (typeof identity.getLinkedPlayerIds === "function") addMany(identity.getLinkedPlayerIds());
  }
  try { add(localStorage.getItem("currentPlayerId")); add(localStorage.getItem("currentPlayerProfileId")); } catch (_) {}
  return Array.from(ids);
}

async function loadOwnedCars(ownerIds) {
  const map = new Map();
  for (const ownerId of ownerIds) {
    const rows = await window.JLYCarData.getCarsByOwner(ownerId);
    (Array.isArray(rows) ? rows : []).forEach(car => { if (car && car.id) map.set(car.id, car); });
  }
  return Array.from(map.values());
}

function setReviewType(type) { currentReviewType = type === "dm" ? "dm" : "player"; renderReviewList(); }
function buildPlayerItem(app) {
  const name = reviewEscape(app.name || app.playerName || "未命名玩家");
  const position = reviewEscape(app.role || app.position || "不限");
  const cross = app.isCrossPlay === true ? "／反串" : "";
  const claim = app.claimType === "existing_person" ? "認領既有玩家｜" + reviewEscape(app.targetPlayerName || app.name || app.playerName || "既有玩家") : "新增玩家報名";
  return `<div style="padding:10px 0;border-top:1px solid #eee;"><strong>🎮 ${name}</strong><div>${claim}</div><div>${position}${cross}</div></div>`;
}
function buildDmItem(app) {
  const name = reviewEscape(app.displayName || "未命名 DM");
  const claim = app.claimType === "existing_slot" ? "認領 " + reviewEscape((app.targetStaffLabel ? app.targetStaffLabel + "｜" : "") + (app.targetStaffName || "既有 DM")) : "新增為本場 DM";
  return `<div style="padding:10px 0;border-top:1px solid #eee;"><strong>🎭 ${name}</strong><div>${claim}</div></div>`;
}
function renderReviewList() {
  const list = document.getElementById("registrationReviewList"); if (!list) return;
  const key = currentReviewType === "dm" ? "dmApplications" : "playerApplications";
  const rows = currentReviewSummary.cars.filter(item => Array.isArray(item[key]) && item[key].length > 0);
  if (!rows.length) { list.innerHTML = `<div class="card"><h3>${currentReviewType === "dm" ? "🎭 DM" : "🎮 玩家"}</h3><p>目前沒有待審核申請。</p></div>`; return; }
  list.innerHTML = rows.map(item => {
    const car = item.car || {}, apps = item[key], body = apps.map(currentReviewType === "dm" ? buildDmItem : buildPlayerItem).join("");
    const carId = encodeURIComponent(reviewText(car.id));
    return `<div class="card"><h3>${reviewEscape(car.scriptName || car.name || "未命名劇本")}</h3><p>${apps.length} 筆待審核</p>${body}<button type="button" onclick="location.href='car-detail.html?id=${carId}'">前往處理</button></div>`;
  }).join("");
}

async function loadRegistrationReview() {
  const list = document.getElementById("registrationReviewList");
  try {
    const ownerIds = getOwnerIds();
    if (!ownerIds.length) throw new Error("尚未建立主揪身分");
    if (!window.JLYCarData || typeof window.JLYCarData.getCarsByOwner !== "function") throw new Error("Car Data 模組尚未載入");
    if (!window.JLYPendingActions) throw new Error("Pending Actions 模組尚未載入");
    const cars = await loadOwnedCars(ownerIds);
    currentReviewSummary = window.JLYPendingActions.buildRegistrationSummary(cars);
    const playerCount = document.getElementById("playerReviewCount"), dmCount = document.getElementById("dmReviewCount");
    if (playerCount) playerCount.textContent = String(currentReviewSummary.playerCount);
    if (dmCount) dmCount.textContent = String(currentReviewSummary.dmCount);
    renderReviewList();
  } catch (error) {
    console.error("報名審核讀取失敗：", error);
    if (list) list.innerHTML = `<div class="card"><h3>報名審核讀取失敗</h3><p>${reviewEscape(error.message || "未知錯誤")}</p></div>`;
  }
}

window.setReviewType = setReviewType;
document.addEventListener("DOMContentLoaded", loadRegistrationReview);
