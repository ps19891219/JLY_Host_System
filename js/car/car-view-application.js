"use strict";

(function () {
  function text(value) { return String(value == null ? "" : value).trim(); }
  function esc(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function params() { return new URLSearchParams(location.search); }
  function carId() { return text(params().get("id")); }
  function applyMode() { return text(params().get("apply")); }
  function now() { return new Date().toISOString(); }

  function getPanel() {
    let panel = document.getElementById("car-view-application-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "car-view-application-panel";
      panel.className = "card car-view-application-panel";
      const content = document.getElementById("car-view-content");
      if (content && content.parentNode) content.parentNode.insertBefore(panel, content.nextSibling);
    }
    return panel;
  }

  function closePanel() {
    const panel = document.getElementById("car-view-application-panel");
    if (panel) panel.remove();
    const p = params();
    p.delete("apply");
    history.replaceState(null, "", location.pathname + "?" + p.toString());
  }

  function getIdentityIds() {
    if (window.JLYIdentity && typeof window.JLYIdentity.getAllPlayerIdentityIds === "function") {
      return window.JLYIdentity.getAllPlayerIdentityIds().map(text).filter(Boolean);
    }
    return [
      localStorage.getItem("currentPlayerProfileId"),
      localStorage.getItem("currentPlayerId")
    ].map(text).filter(Boolean);
  }

  async function getMember() {
    const profileId = text(localStorage.getItem("currentPlayerProfileId"));
    if (!profileId || !window.db) return null;
    const snap = await window.db.collection("players").doc(profileId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  function displayName(member) {
    return text(member && (member.displayName || member.nickname || member.name)) ||
      text(localStorage.getItem("currentPlayerName")) || "我的 JLY 身分";
  }

  function startLineLogin() {
    if (!window.JLYLineLogin || typeof window.JLYLineLogin.start !== "function") {
      alert("LINE 登入模組尚未載入");
      return;
    }
    window.JLYLineLogin.start({ returnUrl: location.pathname + location.search });
  }

  function renderPlayerPanel() {
    const panel = getPanel();
    panel.innerHTML = `
      <div class="car-view-application-head">
        <h3>🙋 玩家報名</h3>
        <button type="button" data-close-application>關閉</button>
      </div>
      <p>直接在這份車團總覽送出報名，不再跳到舊報名頁。</p>
      <label>你的暱稱</label>
      <input id="carViewJoinName" placeholder="例：小梅" value="${esc(localStorage.getItem("joinPlayerName") || "")}">
      <label>報名位置</label>
      <select id="carViewJoinRole">
        <option value="男位">男位</option>
        <option value="女位">女位</option>
        <option value="不限">不限</option>
      </select>
      <label class="checkbox-row"><input id="carViewJoinCross" type="checkbox"> 我是反串</label>
      <button id="carViewJoinSubmit" type="button">送出報名</button>
    `;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitPlayer() {
    const id = carId();
    const name = text(document.getElementById("carViewJoinName")?.value);
    const role = text(document.getElementById("carViewJoinRole")?.value) || "不限";
    const isCrossPlay = Boolean(document.getElementById("carViewJoinCross")?.checked);
    if (!name) return alert("請輸入玩家暱稱");
    if (!window.db) return alert("Firebase 尚未載入");

    const button = document.getElementById("carViewJoinSubmit");
    if (button) button.disabled = true;
    try {
      const ref = window.db.collection("cars").doc(id);
      await window.db.runTransaction(async function (transaction) {
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error("找不到這台車");
        const car = snap.data() || {};
        const players = Array.isArray(car.players) ? car.players : [];
        const applications = Array.isArray(car.applications) ? car.applications.map(item => ({ ...item })) : [];
        const lower = name.toLowerCase();
        if (players.some(player => text(player.playerName || player.name || player.displayName).toLowerCase() === lower)) {
          throw new Error("你已經是這台車的玩家囉！");
        }
        if (applications.some(app => text(app.name || app.playerName || app.displayName).toLowerCase() === lower && text(app.status || "pending") !== "rejected")) {
          throw new Error("你已經送出過報名，請等待主揪審核。");
        }
        applications.push({
          name,
          playerName: name,
          role,
          position: role,
          roleChoice: role,
          isCrossPlay,
          status: "pending",
          applicationType: "player",
          participantRole: "player",
          source: "car_view",
          createdAt: now(),
          updatedAt: now()
        });
        transaction.update(ref, { applications, updatedAt: now() });
      });
      localStorage.setItem("joinPlayerName", name);
      getPanel().innerHTML = `<h3>🟡 已送出玩家報名</h3><p>等待主揪審核即可。</p><button type="button" data-close-application>返回車團總覽</button>`;
    } catch (error) {
      alert(error.message || "報名失敗");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function getStaffSlots(car) { return Array.isArray(car && car.staffSlots) ? car.staffSlots : []; }
  function claimableDmSlots(car) {
    return getStaffSlots(car).filter(function (slot) {
      const label = text(slot && (slot.label || slot.roleLabel || slot.title)).toLowerCase();
      return (!label || label.includes("dm")) && !text(slot && slot.memberId) && text(slot && slot.displayName);
    });
  }

  function existingStaff(car, ids) {
    const set = new Set(ids.map(text).filter(Boolean));
    return getStaffSlots(car).find(slot => text(slot && slot.memberId) && set.has(text(slot.memberId))) || null;
  }

  function pendingDm(car, ids) {
    const set = new Set(ids.map(text).filter(Boolean));
    const apps = Array.isArray(car && car.dmApplications) ? car.dmApplications : [];
    return apps.find(app => app && text(app.status) === "pending" && [app.memberId, app.profileId, app.identityId].map(text).some(id => id && set.has(id))) || null;
  }

  async function renderDmPanel() {
    const panel = getPanel();
    panel.innerHTML = `<h3>🎭 DM 身分申請</h3><p>讀取中...</p>`;
    if (!window.db) {
      panel.innerHTML = `<h3>🎭 DM 身分申請</h3><p>Firebase 尚未載入</p>`;
      return;
    }
    const snap = await window.db.collection("cars").doc(carId()).get();
    if (!snap.exists) return panel.innerHTML = `<h3>🎭 DM 身分申請</h3><p>找不到這台車</p>`;
    const car = { id: snap.id, ...snap.data() };
    const ids = getIdentityIds();
    const existing = existingStaff(car, ids);
    if (existing) {
      panel.innerHTML = `<div class="car-view-application-head"><h3>🎭 DM 身分</h3><button type="button" data-close-application>關閉</button></div><p>✅ 你的 JLY 身分已經是本場工作人員。</p>`;
      return;
    }
    const member = await getMember();
    if (!member) {
      panel.innerHTML = `<div class="car-view-application-head"><h3>🎭 DM 身分申請</h3><button type="button" data-close-application>關閉</button></div><p>查看車團不需要登入；只有送出 DM 身分申請時需要確認正式 JLY 身分。</p><button id="carViewDmLogin" type="button">使用 LINE 登入後申請</button>`;
      return;
    }
    const allIds = Array.from(new Set([...ids, member.id].map(text).filter(Boolean)));
    if (pendingDm(car, allIds)) {
      panel.innerHTML = `<div class="car-view-application-head"><h3>🎭 DM 身分申請</h3><button type="button" data-close-application>關閉</button></div><p>🟡 申請已送出，目前等待主揪審核。</p>`;
      return;
    }
    const choices = claimableDmSlots(car).map(slot => `<label class="checkbox-row"><input type="radio" name="carViewDmClaim" value="existing" data-staff-id="${esc(slot.id || slot.slotId)}"> 我是 <strong>${esc(slot.label || "DM")}｜${esc(slot.displayName)}</strong></label>`).join("");
    panel.innerHTML = `
      <div class="car-view-application-head"><h3>🎭 DM 身分申請</h3><button type="button" data-close-application>關閉</button></div>
      <p>JLY 身分：<strong>${esc(displayName(member))}</strong></p>
      <p>直接在這份車團總覽選擇本場 DM 身分，送出後由主揪審核。</p>
      ${choices}
      <label class="checkbox-row"><input type="radio" name="carViewDmClaim" value="new" checked> 名單沒有我，新增我</label>
      <button id="carViewDmSubmit" type="button">🎭 送出 DM 身分申請</button>
    `;
    panel.dataset.memberId = text(member.id);
    panel.dataset.memberName = displayName(member);
  }

  async function submitDm() {
    const member = await getMember();
    if (!member) return startLineLogin();
    const memberId = text(localStorage.getItem("currentPlayerProfileId")) || text(member.id);
    const selected = document.querySelector('input[name="carViewDmClaim"]:checked');
    const claimType = selected && selected.value === "existing" ? "existing_slot" : "new";
    const targetStaffId = selected && selected.dataset ? text(selected.dataset.staffId) : "";
    const ref = window.db.collection("cars").doc(carId());
    const button = document.getElementById("carViewDmSubmit");
    if (button) button.disabled = true;
    try {
      await window.db.runTransaction(async function (transaction) {
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error("找不到這台車");
        const car = { id: snap.id, ...snap.data() };
        const ids = Array.from(new Set([...getIdentityIds(), memberId, member.id].map(text).filter(Boolean)));
        if (existingStaff(car, ids)) throw new Error("你已經是這台車的工作人員");
        if (pendingDm(car, ids)) throw new Error("你已經送出 DM 身分申請");
        const apps = Array.isArray(car.dmApplications) ? car.dmApplications.map(app => ({ ...app })) : [];
        let target = null;
        if (claimType === "existing_slot") {
          target = claimableDmSlots(car).find(slot => text(slot.id || slot.slotId) === targetStaffId);
          if (!target) throw new Error("這個 DM 名單已被其他人綁定，請重新選擇");
        }
        apps.push({
          id: "dm_app_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          applicationType: "dm",
          participantRole: "dm",
          status: "pending",
          memberId,
          profileId: text(member.id),
          displayName: displayName(member),
          claimType,
          targetStaffId: target ? text(target.id || target.slotId) : "",
          targetStaffName: target ? text(target.displayName) : "",
          targetStaffLabel: target ? text(target.label || "DM") : "",
          source: "car_view",
          createdAt: now(),
          updatedAt: now()
        });
        transaction.update(ref, { dmApplications: apps, updatedAt: now() });
      });
      getPanel().innerHTML = `<h3>🟡 DM 身分申請已送出</h3><p>等待主揪審核即可。</p><button type="button" data-close-application>返回車團總覽</button>`;
    } catch (error) {
      alert(error.message || "DM 身分申請失敗");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openMode(mode) {
    if (mode === "dm") renderDmPanel();
    else renderPlayerPanel();
  }

  document.addEventListener("click", function (event) {
    const close = event.target.closest("[data-close-application]");
    if (close) return closePanel();
    const join = event.target.closest(".car-view-join-button");
    if (join) {
      event.preventDefault();
      return openMode("player");
    }
    if (event.target.id === "carViewJoinSubmit") return submitPlayer();
    if (event.target.id === "carViewDmLogin") return startLineLogin();
    if (event.target.id === "carViewDmSubmit") return submitDm();
  });

  document.addEventListener("jly:car-view-ready", function () {
    const mode = applyMode();
    if (mode === "player" || mode === "dm") openMode(mode);
  });
})();
