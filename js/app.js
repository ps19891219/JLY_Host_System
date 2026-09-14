"use strict";

console.log("app.js V27 已成功載入！");

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getPlayers(car) {
  return Array.isArray(car && car.players) ? car.players : [];
}

function getTotal(car) {
  return Number(car && car.totalPeople ? car.totalPeople : 0);
}

function getNeed(car) {
  return Math.max(getTotal(car) - getPlayers(car).length, 0);
}

function getAutoStatus(car) {
  if (car.status === "已完成") return "已完成";
  if (car.status === "已取消") return "已取消";

  const total = getTotal(car);
  const players = getPlayers(car);

  if (total > 0 && players.length >= total) return "已滿車";
  return "招募中";
}

function normalizeId(value) {
  return String(value == null ? "" : value).trim();
}

function getCurrentIdentityIds() {
  const ids = new Set();
  const identity = window.JLYIdentity;

  function add(value) {
    const id = normalizeId(value);
    if (id) ids.add(id);
  }

  function addMany(values) {
    (Array.isArray(values) ? values : []).forEach(add);
  }

  if (identity) {
    if (typeof identity.getCurrentPlayerId === "function") {
      add(identity.getCurrentPlayerId());
    }
    if (typeof identity.getCurrentPlayerProfileId === "function") {
      add(identity.getCurrentPlayerProfileId());
    }
    if (typeof identity.getAllPlayerIdentityIds === "function") {
      addMany(identity.getAllPlayerIdentityIds());
    }
    if (typeof identity.getLinkedPlayerIds === "function") {
      addMany(identity.getLinkedPlayerIds());
    }
  }

  try {
    add(localStorage.getItem("currentPlayerId"));
    add(localStorage.getItem("currentPlayerProfileId"));
  } catch (_error) {}

  return Array.from(ids);
}

async function getDashboardHostCars(identityIds) {
  const ids = Array.isArray(identityIds) ? identityIds.filter(Boolean) : [];
  const map = new Map();

  if (
    ids.length > 0 &&
    window.JLYCarData &&
    typeof window.JLYCarData.getCarsByOwner === "function"
  ) {
    for (const ownerId of ids) {
      const ownerCars = await window.JLYCarData.getCarsByOwner(ownerId);
      ownerCars.forEach(function (car) {
        if (car && car.id) map.set(car.id, car);
      });
    }
  }

  return Array.from(map.values());
}

async function getDashboardPlayerCars(identityIds) {
  const ids = Array.isArray(identityIds) ? identityIds.filter(Boolean) : [];

  if (
    ids.length === 0 ||
    !window.JLYCarData ||
    typeof window.JLYCarData.getCarsByPlayerId !== "function"
  ) {
    return [];
  }

  try {
    return await window.JLYCarData.getCarsByPlayerId(ids[0]);
  } catch (error) {
    console.warn("首頁玩家車讀取失敗：", error);
    return [];
  }
}

function mergeCars(groups) {
  const map = new Map();

  (Array.isArray(groups) ? groups : []).forEach(function (cars) {
    (Array.isArray(cars) ? cars : []).forEach(function (car) {
      if (car && car.id) map.set(car.id, car);
    });
  });

  return Array.from(map.values());
}

function renderRegistrationPending(cars) {
  const count = document.getElementById("registrationPendingCount");
  const text = document.getElementById("registrationPendingText");

  if (!window.JLYPendingActions) {
    if (text) text.textContent = "待處理模組尚未載入";
    return;
  }

  const summary = window.JLYPendingActions.buildRegistrationSummary(cars);
  if (count) count.textContent = String(summary.total);
  if (text) {
    text.textContent = summary.total > 0
      ? "玩家 " + summary.playerCount + "｜DM " + summary.dmCount
      : "目前無待處理";
  }
}

async function renderDashboard() {
  const db = window.db;
  if (!db) {
    console.error("Firebase 尚未載入");
    return;
  }

  try {
    const identityIds = getCurrentIdentityIds();
    const hostCars = await getDashboardHostCars(identityIds);
    const playerCars = await getDashboardPlayerCars(identityIds);
    const cars = mergeCars([hostCars, playerCars]);

    const active = cars.filter(function (car) {
      const status = getAutoStatus(car);
      return status !== "已完成" && status !== "已取消";
    });

    const needCars = active.filter(function (car) {
      return getNeed(car) > 0;
    });

    const fullCars = active.filter(function (car) {
      return getTotal(car) > 0 && getNeed(car) === 0;
    });

    const todayCars = active.filter(function (car) {
      return car.gameDate === todayString();
    });

    const activeCount = document.getElementById("activeCount");
    const needCount = document.getElementById("needCount");
    const fullCount = document.getElementById("fullCount");
    const todayCount = document.getElementById("todayCount");

    if (activeCount) activeCount.innerText = active.length;
    if (needCount) needCount.innerText = needCars.length;
    if (fullCount) fullCount.innerText = fullCars.length;
    if (todayCount) todayCount.innerText = todayCars.length;

    // 報名審核仍只屬於我主揪的車；首頁車團統計則是主揪＋玩家的總和。
    renderRegistrationPending(hostCars);

    console.log("首頁統計", {
      identityIds,
      主揪車: hostCars.length,
      玩家車: playerCars.length,
      總和: cars.length,
      開團中: active.length,
      還缺人: needCars.length,
      已滿車: fullCars.length,
      今天開團: todayCars.length
    });
  } catch (error) {
    console.error("首頁統計讀取失敗：", error);
  }
}

window.renderDashboard = renderDashboard;
document.addEventListener("DOMContentLoaded", renderDashboard);
