"use strict";
console.log("dm-join.js V1 已成功載入！");

let currentCar = null;
let currentCarId = "";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getCarId() {
  const p = new URLSearchParams(location.search);
  return text(p.get("carId") || p.get("id"));
}

function getIdentityIds() {
  if (
    window.JLYIdentity &&
    typeof window.JLYIdentity.getAllPlayerIdentityIds === "function"
  ) {
    return window.JLYIdentity
      .getAllPlayerIdentityIds()
      .map(text)
      .filter(Boolean);
  }

  return [
    localStorage.getItem("currentPlayerProfileId"),
    localStorage.getItem("currentPlayerId")
  ].map(text).filter(Boolean);
}

async function getMember() {
  const profileId = text(
    localStorage.getItem("currentPlayerProfileId")
  );

  if (!profileId || !window.db) return null;

  const snap = await window.db
    .collection("players")
    .doc(profileId)
    .get();

  return snap.exists
    ? { id: snap.id, ...snap.data() }
    : null;
}

function findExisting(slots, ids) {
  const set = new Set(ids.map(text).filter(Boolean));

  return slots.find(function(slot) {
    const memberId = text(slot && slot.memberId);
    return memberId && set.has(memberId);
  }) || null;
}

function findEmptyDmSlot(slots) {
  return slots.find(function(slot) {
    const label = text(
      slot && (slot.label || slot.roleLabel || slot.title)
    ).toLowerCase();

    const dmLike = !label || label.includes("dm");

    return (
      dmLike &&
      !text(slot && slot.memberId) &&
      !text(slot && slot.displayName)
    );
  }) || null;
}

function startDmLineLogin() {
  if (
    !window.JLYLineLogin ||
    typeof window.JLYLineLogin.start !== "function"
  ) {
    alert("LINE 登入模組尚未載入");
    return;
  }

  window.JLYLineLogin.start({
    returnUrl: location.pathname + location.search
  });
}

function renderLogin(car) {
  document.getElementById("dmJoinBox").innerHTML = `
    <h2>${esc(car.scriptName || car.name || "這台車")}</h2>
    <p>請先使用 LINE 登入，JLY 才能把你的正式身分連到這場活動。</p>
    <button type="button" class="primary" onclick="startDmLineLogin()">
      使用 LINE 登入
    </button>
  `;
}

function renderReady(car, member) {
  const name = text(
    member.displayName || member.nickname || member.name
  ) || text(localStorage.getItem("currentPlayerName")) || "我的 JLY 身分";

  document.getElementById("dmJoinBox").innerHTML = `
    <h2>${esc(car.scriptName || car.name || "這台車")}</h2>
    <p>你將以 <strong>DM</strong> 身分加入這場活動。</p>
    <p>JLY 身分：<strong>${esc(name)}</strong></p>
    <button id="confirmDmJoin" type="button" class="primary"
      onclick="confirmDmJoin()">
      🎭 確認我是本場 DM
    </button>
    <p><small>DM 不會占用玩家男位、女位或不限位。</small></p>
  `;
}

function renderJoined(car, slot) {
  document.getElementById("dmJoinBox").innerHTML = `
    <h2>${esc(car.scriptName || car.name || "這台車")}</h2>
    <p>✅ 你的 JLY 身分已經連結到這場活動。</p>
    <p><strong>${esc(slot.label || "DM")}</strong> ${esc(slot.displayName || "")}</p>
  `;
}

async function loadDmJoinPage() {
  const box = document.getElementById("dmJoinBox");

  try {
    currentCarId = getCarId();

    if (!currentCarId) throw new Error("報名連結缺少車團 ID");
    if (!window.db) throw new Error("Firebase 尚未載入");

    const snap = await window.db
      .collection("cars")
      .doc(currentCarId)
      .get();

    if (!snap.exists) throw new Error("找不到這台車");

    currentCar = { id: snap.id, ...snap.data() };

    const slots = Array.isArray(currentCar.staffSlots)
      ? currentCar.staffSlots
      : [];

    const existing = findExisting(slots, getIdentityIds());

    if (existing) {
      renderJoined(currentCar, existing);
      return;
    }

    const member = await getMember();

    if (!member) {
      renderLogin(currentCar);
      return;
    }

    renderReady(currentCar, member);
  } catch (error) {
    console.error("讀取 DM 身分連結頁失敗：", error);
    box.innerHTML = `<h3>讀取失敗</h3><p>${esc(error.message || "未知錯誤")}</p>`;
  }
}

async function confirmDmJoin() {
  const button = document.getElementById("confirmDmJoin");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "連結中...";
    }

    const member = await getMember();

    if (!member) {
      alert("請先完成 LINE 登入");
      return;
    }

    const memberId =
      text(localStorage.getItem("currentPlayerProfileId")) ||
      text(member.id);

    const displayName = text(
      member.displayName || member.nickname || member.name
    );

    if (!memberId) throw new Error("找不到你的 JLY Person ID");
    if (!displayName) throw new Error("找不到你的 JLY 顯示名稱");

    const carRef = window.db.collection("cars").doc(currentCarId);

    await window.db.runTransaction(async function(transaction) {
      const snap = await transaction.get(carRef);
      if (!snap.exists) throw new Error("找不到這台車");

      const car = { id: snap.id, ...snap.data() };
      const slots = Array.isArray(car.staffSlots)
        ? car.staffSlots.map(function(slot){ return {...slot}; })
        : [];

      const ids = Array.from(new Set([
        ...getIdentityIds(),
        memberId,
        member.id
      ].map(text).filter(Boolean)));

      if (findExisting(slots, ids)) return;

      const empty = findEmptyDmSlot(slots);

      if (empty) {
        empty.memberId = memberId;
        empty.displayName = displayName;
        empty.label = text(empty.label) || "DM";
        empty.source = "dm_self_join";
      } else {
        slots.push({
          id: "staff_" + Date.now() + "_" +
            Math.random().toString(36).slice(2,8),
          order: slots.length + 1,
          label: "DM",
          memberId,
          displayName,
          source: "dm_self_join"
        });
      }

      const updateData = { staffSlots: slots };

      if (
        window.firebase &&
        window.firebase.firestore &&
        window.firebase.firestore.FieldValue
      ) {
        updateData.updatedAt =
          window.firebase.firestore.FieldValue.serverTimestamp();
      }

      transaction.update(carRef, updateData);
    });

    alert("🎭 DM 身分連結完成！");
    await loadDmJoinPage();
  } catch (error) {
    console.error("DM 身分連結失敗：", error);
    alert("DM 身分連結失敗：" + (error.message || "未知錯誤"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🎭 確認我是本場 DM";
    }
  }
}

window.startDmLineLogin = startDmLineLogin;
window.confirmDmJoin = confirmDmJoin;

document.addEventListener("DOMContentLoaded", loadDmJoinPage);
