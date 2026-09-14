(function () {
  "use strict";

  const API_BASE = "https://www.googleapis.com/calendar/v3";
  const CALENDAR_ID = "primary";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getActorId() {
    if (
      window.JLYIdentity &&
      typeof window.JLYIdentity.getCurrentPlayerId === "function"
    ) {
      return text(window.JLYIdentity.getCurrentPlayerId());
    }
    return text(localStorage.getItem("currentPlayerId"));
  }

  function isEditableCar(car, actorId) {
    const ownerId = text(car?.ownerId);
    return Boolean(
      actorId &&
      (ownerId === actorId || (!ownerId && car?.isHost === true))
    );
  }

  function carName(car) {
    return text(car?.activityName || car?.scriptName || car?.title) || "未命名車團";
  }

  function carUrl(carId) {
    return location.origin + "/pages/car-detail.html?id=" + encodeURIComponent(carId);
  }

  function durationMinutes(car) {
    return Number(
      car?.calendar?.eventDurationMinutes ||
      car?.eventDurationMinutes ||
      60
    ) || 60;
  }

  function eventCarId(event) {
    return text(event?.extendedProperties?.private?.carId);
  }

  function eventTime(event, edge) {
    return text(event?.[edge]?.dateTime || event?.[edge]?.date);
  }

  function expectedResource(carId, car, minutes) {
    const provider = window.JLYCalendarProviderGoogle;
    if (!provider || typeof provider.buildEventResource !== "function") {
      throw new Error("Google Calendar Provider 尚未載入");
    }
    return provider.buildEventResource({
      carId,
      car,
      calendarId: CALENDAR_ID,
      durationMinutes: minutes,
      carUrl: carUrl(carId)
    });
  }

  async function readOfficialCars(ids) {
    if (!window.db) throw new Error("Firebase 尚未載入");

    const actorId = getActorId();
    if (!actorId) throw new Error("請先登入 JLY 身分");

    const result = [];
    for (const carId of ids) {
      const snapshot = await window.db.collection("cars").doc(carId).get();
      if (!snapshot.exists) {
        throw new Error(`找不到正式車團資料：${carId}`);
      }

      const car = snapshot.data() || {};
      if (!isEditableCar(car, actorId)) {
        throw new Error(`這台不是目前身分可修改的主揪車：${carId}`);
      }

      const gameDate = text(car.gameDate);
      const gameTime = text(car.gameTime);
      if (!gameDate || !gameTime) {
        throw new Error(`正式車團缺少日期或時間：${carName(car)}｜${carId}`);
      }

      result.push({
        carId,
        car,
        name: carName(car),
        gameDate,
        gameTime,
        durationMinutes: durationMinutes(car)
      });
    }
    return result;
  }

  function sameFormalSchedule(before, after) {
    return (
      text(before?.gameDate) === text(after?.gameDate) &&
      text(before?.gameTime) === text(after?.gameTime) &&
      Number(before?.durationMinutes || 60) === Number(after?.durationMinutes || 60)
    );
  }

  function googleError(status, body, fallback) {
    const message = text(body?.error?.message) || fallback || "Google Calendar API 錯誤";
    const error = new Error(`${message}（HTTP ${status}）`);
    error.httpStatus = status;
    error.googleMessage = message;
    return error;
  }

  async function googleFetch(token, path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + token);
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(API_BASE + path, {
      ...options,
      headers
    });

    let body = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }
    }

    if (!response.ok) {
      throw googleError(response.status, body);
    }

    return { status: response.status, body };
  }

  async function getPrimaryIdentity(token) {
    const result = await googleFetch(token, "/calendars/primary");
    return result.body || {};
  }

  async function exactGet(token, eventId) {
    return googleFetch(
      token,
      "/calendars/primary/events/" + encodeURIComponent(eventId)
    );
  }

  async function exactGetOrNull(token, eventId) {
    if (!text(eventId)) return null;
    try {
      return (await exactGet(token, eventId)).body || null;
    } catch (error) {
      if (error?.httpStatus === 404 || error?.httpStatus === 410) return null;
      throw error;
    }
  }

  async function findByCarId(token, carId) {
    const params = new URLSearchParams({
      privateExtendedProperty: "carId=" + text(carId),
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "10"
    });

    const result = await googleFetch(
      token,
      "/calendars/primary/events?" + params.toString()
    );
    const items = Array.isArray(result.body?.items) ? result.body.items : [];
    const matches = items.filter((event) => eventCarId(event) === text(carId));

    if (matches.length > 1) {
      throw new Error(`Google Calendar 有 ${matches.length} 筆相同 Car ID，已停止避免重複覆寫`);
    }

    return matches[0] || null;
  }

  async function createEvent(token, resource) {
    const result = await googleFetch(token, "/calendars/primary/events", {
      method: "POST",
      body: JSON.stringify(resource)
    });
    return result.body || {};
  }

  async function updateEvent(token, eventId, resource) {
    const result = await googleFetch(
      token,
      "/calendars/primary/events/" + encodeURIComponent(eventId),
      {
        method: "PATCH",
        body: JSON.stringify(resource)
      }
    );
    return result.body || {};
  }

  function verifyExactEvent(carId, expected, event) {
    if (!text(event?.id)) throw new Error("Google 沒有回傳 Event ID");
    if (eventCarId(event) !== text(carId)) {
      throw new Error("Google event private.carId 與 JLY Car ID 不一致");
    }

    const expectedStart = eventTime(expected, "start");
    const expectedEnd = eventTime(expected, "end");
    const actualStart = eventTime(event, "start");
    const actualEnd = eventTime(event, "end");

    if (expectedStart !== actualStart || expectedEnd !== actualEnd) {
      throw new Error(
        `Google 日期時間與 JLY 不一致｜JLY ${expectedStart} → ${expectedEnd}｜Google ${actualStart} → ${actualEnd}`
      );
    }
  }

  async function writeCalendarState(carId, patch) {
    const data = window.JLYCalendarData;
    if (!data || typeof data.updateCarCalendar !== "function") {
      throw new Error("Calendar Data 尚未載入");
    }
    return data.updateCarCalendar(carId, patch);
  }

  async function syncOne(token, item) {
    const { carId, car, name, durationMinutes: minutes } = item;
    const expected = expectedResource(carId, car, minutes);

    await writeCalendarState(carId, {
      syncEnabled: true,
      calendarId: CALENDAR_ID,
      syncStatus: "syncing",
      lastError: ""
    });

    try {
      let existing = null;
      const storedEventId = text(car?.calendar?.eventId);

      if (storedEventId) {
        const stored = await exactGetOrNull(token, storedEventId);
        if (stored && eventCarId(stored) === text(carId)) {
          existing = stored;
        }
      }

      if (!existing) {
        existing = await findByCarId(token, carId);
      }

      let writeResult;
      let action;
      if (existing?.id) {
        writeResult = await updateEvent(token, existing.id, expected);
        action = "updated";
      } else {
        writeResult = await createEvent(token, expected);
        action = "created";
      }

      const eventId = text(writeResult?.id);
      if (!eventId) throw new Error("Google 寫入後沒有回傳 Event ID");

      const exactResult = await exactGet(token, eventId);
      const verifiedEvent = exactResult.body || {};
      verifyExactEvent(carId, expected, verifiedEvent);

      await writeCalendarState(carId, {
        syncEnabled: true,
        calendarId: CALENDAR_ID,
        eventId,
        eventUrl: text(verifiedEvent.htmlLink),
        eventDurationMinutes: minutes,
        syncStatus: "synced",
        lastSyncAt: nowIso(),
        lastError: ""
      });

      return {
        carId,
        name,
        action,
        event: verifiedEvent,
        exactGetStatus: `HTTP ${exactResult.status}`
      };
    } catch (error) {
      const message = text(error?.message) || "Google 同步失敗";
      await writeCalendarState(carId, {
        syncEnabled: true,
        calendarId: CALENDAR_ID,
        syncStatus: "error",
        lastSyncAt: nowIso(),
        lastError: message
      });
      throw error;
    }
  }

  function eventTimeText(event) {
    const start = eventTime(event, "start");
    const end = eventTime(event, "end");
    return start && end ? `${start} → ${end}` : start || end || "Google 未回傳時間";
  }

  function showResults(calendarIdentity, succeeded, failed) {
    document.getElementById("mycarGoogleSingleFlowPanel")?.remove();
    document.getElementById("mycarGoogleResultPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarGoogleResultPanel";
    panel.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";

    const card = document.createElement("div");
    card.style.cssText = "width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-sizing:border-box";

    const title = document.createElement("h3");
    title.textContent = `Google 同步結果｜成功 ${succeeded.length} 台、失敗 ${failed.length} 台`;
    card.appendChild(title);

    const identity = document.createElement("div");
    identity.textContent = `Google Calendar：${text(calendarIdentity?.id || calendarIdentity?.summary) || "primary"}`;
    identity.style.cssText = "font-size:13px;margin:0 0 12px;color:#555;word-break:break-word";
    card.appendChild(identity);

    succeeded.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #ddd;border-radius:12px;padding:12px;margin:0 0 10px;word-break:break-word";
      box.innerText =
        `✅ ${item.name}\n` +
        `${item.action === "created" ? "建立" : "更新"}｜${item.exactGetStatus}\n` +
        `${eventTimeText(item.event)}\n` +
        `Car ID：${item.carId}\nEvent ID：${text(item.event?.id)}`;

      const eventUrl = text(item.event?.htmlLink);
      if (eventUrl) {
        const link = document.createElement("a");
        link.href = eventUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText = "display:inline-block;margin-top:8px;font-weight:700";
        box.appendChild(document.createElement("br"));
        box.appendChild(link);
      }
      card.appendChild(box);
    });

    failed.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #ddd;border-radius:12px;padding:12px;margin:0 0 10px;word-break:break-word";
      box.textContent = `❌ ${item.name || item.carId}：${item.message}`;
      card.appendChild(box);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText = "width:100%;margin-top:8px;padding:12px;border-radius:12px;font-weight:700";
    close.addEventListener("click", () => panel.remove());
    card.appendChild(close);

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  function showOfficialConfirmation(items, onConfirm) {
    document.getElementById("mycarGoogleSingleFlowPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarGoogleSingleFlowPanel";
    panel.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";

    const card = document.createElement("div");
    card.style.cssText = "width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-sizing:border-box;box-shadow:0 14px 40px rgba(0,0,0,.22)";

    const title = document.createElement("h3");
    title.textContent = "重新同步 Google Calendar";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent = "只使用 JLY cars/{carId} 正式日期時間與 private.carId。完全不使用 Google 同名事件或 Work Schedule 推測。";
    note.style.cssText = "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    card.appendChild(note);

    items.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.55;word-break:break-word;white-space:pre-wrap";
      box.textContent = `🎭 ${item.name}\n${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘\nCar ID：${item.carId}`;
      card.appendChild(box);
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "確認資料正確，重新同步 Google";
    confirm.style.cssText = "width:100%;margin-top:8px;padding:13px;border:0;border-radius:12px;font-weight:800;font-size:16px";
    confirm.addEventListener("click", () => onConfirm(confirm, panel));
    card.appendChild(confirm);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText = "width:100%;margin-top:10px;padding:12px;border-radius:12px;font-weight:700";
    cancel.addEventListener("click", () => panel.remove());
    card.appendChild(cancel);

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  async function runConfirmedSync(preflightItems, button, panel) {
    const auth = window.JLYCalendarAuth;
    if (!auth || typeof auth.requestAccessToken !== "function") {
      alert("Google Calendar 授權模組尚未載入");
      return;
    }

    button.disabled = true;
    button.textContent = "📅 選擇 Google 帳號…";

    try {
      if (typeof auth.clearToken === "function") auth.clearToken();

      const token = await auth.requestAccessToken({ selectAccount: true });
      if (!text(token)) throw new Error("Google OAuth 沒有回傳 Access Token");

      const calendarIdentity = await getPrimaryIdentity(token);
      const accountLabel = text(calendarIdentity?.id || calendarIdentity?.summary) || "primary";
      if (!window.confirm(`這次會同步到：\n${accountLabel}\n\n確認使用這個 Google Calendar 嗎？`)) {
        throw new Error("已取消：Google Calendar 帳號未確認");
      }

      button.textContent = "📅 重新讀取 JLY 正式資料…";
      const latestItems = await readOfficialCars(preflightItems.map((item) => item.carId));
      for (let index = 0; index < latestItems.length; index += 1) {
        if (!sameFormalSchedule(preflightItems[index], latestItems[index])) {
          throw new Error(`車團資料在確認後已變更，已停止同步：${latestItems[index].name}`);
        }
      }

      const succeeded = [];
      const failed = [];
      button.textContent = "📅 同步中…";

      for (const item of latestItems) {
        try {
          succeeded.push(await syncOne(token, item));
        } catch (error) {
          failed.push({
            carId: item.carId,
            name: item.name,
            message: text(error?.message) || "未知錯誤"
          });
        }
      }

      if (typeof renderMyCars === "function") {
        await renderMyCars({ restoreScroll: true });
      }
      showResults(calendarIdentity, succeeded, failed);
    } catch (error) {
      console.error("MyCar Google 同步未完成：", error);
      alert("Google 同步未完成：" + (text(error?.message) || "未知錯誤"));
    } finally {
      button.disabled = false;
      button.textContent = "確認資料正確，重新同步 Google";
      if (panel?.isConnected) panel.remove();
    }
  }

  async function openSingleFlow() {
    if (typeof selectedCars === "undefined" || !selectedCars.size) {
      alert("請先勾選要重新同步 Google Calendar 的車團");
      return;
    }

    try {
      const official = await readOfficialCars(Array.from(selectedCars));
      showOfficialConfirmation(official, (button, panel) => {
        runConfirmedSync(official, button, panel);
      });
    } catch (error) {
      console.error("MyCar Google 正式資料讀取失敗：", error);
      alert("Google 同步已停止：\n" + (text(error?.message) || "無法確認 JLY 正式車團資料"));
    }
  }

  function installButton() {
    const toolbar = document.getElementById("batchToolbar");
    const countBox = document.getElementById("selectedCarCount");
    if (!toolbar || !countBox) return;

    document.getElementById("batchGoogleRepairButton")?.remove();
    document.getElementById("batchGoogleSingleFlowButton")?.remove();

    const button = document.createElement("button");
    button.id = "batchGoogleSingleFlowButton";
    button.type = "button";
    button.className = "batch-convert-button";
    button.textContent = "📅 重新同步 Google";
    button.addEventListener("click", openSingleFlow);
    countBox.insertAdjacentElement("afterend", button);
  }

  window.JLYMyCarCalendarSingleFlow = {
    open: openSingleFlow,
    readOfficialCars
  };

  function install() {
    installButton();
    setTimeout(installButton, 300);
    setTimeout(installButton, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
