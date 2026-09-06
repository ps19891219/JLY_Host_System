"use strict";

(function () {
  function text(value) { return String(value == null ? "" : value).trim(); }
  function carId() { return text(new URLSearchParams(location.search).get("id")); }
  function requestedEntry() {
    const value = text(new URLSearchParams(location.search).get("entry")).toLowerCase();
    return value === "dm" ? "dm" : "player";
  }

  function actionHost() {
    const oldButton = document.querySelector("a.car-view-join-button");
    if (oldButton) {
      let host = document.getElementById("car-view-entry-actions");
      if (!host) {
        host = document.createElement("div");
        host.id = "car-view-entry-actions";
        oldButton.parentNode.insertBefore(host, oldButton);
      }
      oldButton.remove();
      return host;
    }
    return document.getElementById("car-view-entry-actions");
  }

  async function login(entry) {
    try {
      const returnPath = location.pathname + location.search;
      const response = await fetch("/api/line-login-state", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerProfileId: text(localStorage.getItem("currentPlayerProfileId")),
          identityId: text(localStorage.getItem("currentPlayerId")),
          returnPath
        })
      });
      const data = await response.json();
      if (!response.ok || !data || !data.state) {
        throw new Error((data && data.error) || "login_state_failed");
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: "2010653666",
        redirect_uri: `${location.origin}/pages/line-callback.html`,
        state: data.state,
        scope: "openid profile"
      });

      location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
      return true;
    } catch (error) {
      console.error("車團報名 LINE OAuth 啟動失敗：", error);
      alert(
        error && error.message
          ? `LINE 身分確認無法啟動：${error.message}`
          : "LINE 身分確認無法啟動，請稍後再試。"
      );
      return false;
    }
  }

  async function loadContext() {
    const response = await fetch(`/api/car-view-context?id=${encodeURIComponent(carId())}`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "讀取報名狀態失敗");
    return result;
  }

  function button(host, label, handler, disabled) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "car-view-entry-button";
    element.textContent = label;
    element.disabled = Boolean(disabled);
    if (handler) element.addEventListener("click", handler);
    host.appendChild(element);
    return element;
  }

  function note(host, value) {
    const p = document.createElement("p");
    p.className = "car-view-entry-note";
    p.textContent = value;
    host.appendChild(p);
  }

  async function submit(payload, host) {
    const controls = host.querySelectorAll("button,select,input");
    controls.forEach(item => { item.disabled = true; });
    try {
      const response = await fetch("/api/car-view-context", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: carId(), ...payload })
      });
      const result = await response.json();
      if (response.status === 401) {
        const started = await login(payload.type);
        if (!started) controls.forEach(item => { item.disabled = false; });
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.error || "報名失敗");
      await renderActions();
    } catch (error) {
      alert(error && error.message ? error.message : "報名失敗");
      controls.forEach(item => { item.disabled = false; });
    }
  }

  function renderPlayer(host, viewer) {
    if (viewer.playerStatus === "joined") {
      button(host, "✅ 你已加入這台車", null, true);
      return;
    }
    if (viewer.playerStatus === "pending") {
      button(host, "🟡 玩家報名等待審核中", null, true);
      return;
    }
    if (!viewer.authenticated) {
      button(host, "🎮 使用 LINE 身分繼續報名", function () { login("player"); });
      note(host, "車團資訊可直接查看，只有送出報名時需要確認身分。");
      return;
    }

    const row = document.createElement("div");
    row.className = "car-view-entry-form";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "報名位置");
    ["男位", "女位", "不限"].forEach(function (value) {
      const option = document.createElement("option");
      option.value = value; option.textContent = value; select.appendChild(option);
    });
    const crossLabel = document.createElement("label");
    const cross = document.createElement("input");
    cross.type = "checkbox";
    crossLabel.appendChild(cross);
    crossLabel.appendChild(document.createTextNode(" 我是反串"));
    row.appendChild(select);
    row.appendChild(crossLabel);
    host.appendChild(row);
    button(host, "🎮 送出玩家報名", function () {
      submit({ type: "player", position: select.value, isCrossPlay: cross.checked }, host);
    });
  }

  function renderDm(host, viewer) {
    if (viewer.dmStatus === "joined") {
      button(host, "✅ 你已是本場工作人員", null, true);
      return;
    }
    if (viewer.dmStatus === "pending") {
      button(host, "🟡 DM 身分申請等待審核中", null, true);
      return;
    }
    if (!viewer.authenticated) {
      button(host, "🎭 使用 LINE 身分繼續 DM 申請", function () { login("dm"); });
      note(host, "車團總覽不需要登入，只有送出 DM 身分申請時需要確認身分。");
      return;
    }

    note(host, `目前身分：${viewer.displayName || "JLY 成員"}`);
    const slots = Array.isArray(viewer.dmClaimableSlots) ? viewer.dmClaimableSlots : [];
    const row = document.createElement("div");
    row.className = "car-view-entry-form";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "DM 身分選擇");
    const newOption = document.createElement("option");
    newOption.value = "";
    newOption.textContent = "名單沒有我，新增我";
    select.appendChild(newOption);
    slots.forEach(function (slot) {
      const option = document.createElement("option");
      option.value = text(slot.id);
      option.textContent = `我是 ${text(slot.label) || "DM"}｜${text(slot.displayName)}`;
      select.appendChild(option);
    });
    row.appendChild(select);
    host.appendChild(row);
    button(host, "🎭 送出本場 DM 身分申請", function () {
      submit({ type: "dm", targetStaffId: select.value }, host);
    });
  }

  async function renderActions() {
    const id = carId();
    if (!id) return;
    const host = actionHost();
    if (!host) return;
    host.innerHTML = "";
    try {
      const context = await loadContext();
      const viewer = context.viewer || { authenticated: false, playerStatus: "available", dmStatus: "available" };
      if (requestedEntry() === "dm") renderDm(host, viewer);
      else renderPlayer(host, viewer);
    } catch (error) {
      note(host, error && error.message ? error.message : "無法讀取報名狀態");
    }
  }

  function observe() {
    const container = document.getElementById("car-view-content");
    if (!container) return;
    const observer = new MutationObserver(function () {
      if (document.querySelector("a.car-view-join-button")) renderActions();
    });
    observer.observe(container, { childList: true, subtree: true });
    renderActions();
  }

  document.addEventListener("DOMContentLoaded", observe);
  window.JLYCarViewActions = { render: renderActions, submit, login };
})();
