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
    const ownerId = text(car && car.ownerId);
    return Boolean(
      actorId &&
      (ownerId === actorId || (!ownerId && car && car.isHost === true))
    );
  }

  function carName(car) {
    return text(
      (car && (car.activityName || car.scriptName || car.title)) ||
      "未命名車團"
    );
  }

  function carUrl(carId) {
    return `${location.origin}/pages/car-detail.html?id=${encodeURIComponent(carId)}`;
  }

  function eventCarId(event) {
    return text(event?.extendedProperties?.private?.carId);
  }

  function eventSourceModule(event) {
    return text(event?.extendedProperties?.private?.sourceModule);
  }

  function belongsToMyCar(event, carId) {
    return Boolean(
      event &&
      event.id &&
      event.status !== "cancelled" &&
      eventCarId(event) === String(carId) &&
      (!eventSourceModule(event) || eventSourceModule(event) === "host")
    );
  }

  async function googleFetch(token, url) {
    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      // 204 或沒有 JSON 時保留 null。
    }

    return {
      ok: response.ok,
      status: response.status,
      body
    };
  }

  async function readPrimaryCalendar(token) {
    const result = await googleFetch(
      token,
      `${API_BASE}/calendars/primary`
    );

    if (!result.ok) {
      throw new Error(
        `無法讀取 Google 主要行事曆（${result.status}）`
      );
    }

    return result.body || {};
  }

  async function getExactEvent(token, eventId) {
    const cleanId = text(eventId);
    if (!cleanId) {
      return {
        found: false,
        status: 0,
        event: null
      };
    }

    const result = await googleFetch(
      token,
      `${API_BASE}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(cleanId)}`
    );

    if (result.status === 404 || result.status === 410) {
      return {
        found: false,
        status: result.status,
        event: result.body || null
      };
    }

    if (!result.ok) {
      const message = text(result.body?.error?.message) ||
        `Google Calendar API 錯誤（${result.status}）`;
      throw new Error(message);
    }

    return {
      found: true,
      status: result.status,
      event: result.body || null
    };
  }

  async function readOfficialCars(ids) {
    if (!window.db) {
      throw new Error("Firebase 尚未載入");
    }

    const actorId = getActorId();
    if (!actorId) {
      throw new Error("請先登入 JLY 身分");
    }

    const items = [];

    for (const carId of ids) {
      const snapshot = await window.db
        .collection("cars")
        .doc(carId)
        .get();

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
        throw new Error(
          `正式車團缺少日期或時間，禁止同步：${carName(car)}｜${carId}`
        );
      }

      items.push({
        carId,
        car,
        name: carName(car),
        gameDate,
        gameTime,
        durationMinutes: Number(
          car.calendar?.eventDurationMinutes ||
          car.eventDurationMinutes ||
          60
        ) || 60
      });
    }

    return items;
  }

  async function updateCalendarState(carId, patch) {
    if (
      !window.JLYCalendarData ||
      typeof window.JLYCalendarData.updateCarCalendar !== "function"
    ) {
      throw new Error("Calendar Data 模組尚未載入");
    }

    return window.JLYCalendarData.updateCarCalendar(carId, patch);
  }

  async function findCurrentEvent(token, item) {
    const storedId = text(item.car?.calendar?.eventId);

    if (storedId) {
      const exact = await getExactEvent(token, storedId);
      if (
        exact.found &&
        belongsToMyCar(exact.event, item.carId)
      ) {
        return exact.event;
      }
    }

    const provider = window.JLYCalendarProviderGoogle;
    if (
      !provider ||
      typeof provider.listEventsForDate !== "function"
    ) {
      throw new Error("Google Calendar Provider 尚未載入");
    }

    const events = await provider.listEventsForDate(item.gameDate);
    return events.find(function (event) {
      return belongsToMyCar(event, item.carId);
    }) || null;
  }

  async function syncOne(token, item) {
    const provider = window.JLYCalendarProviderGoogle;
    if (!provider) {
      throw new Error("Google Calendar Provider 尚未載入");
    }

    const currentCalendar = item.car.calendar || {};

    await updateCalendarState(item.carId, {
      syncEnabled: true,
      calendarId: CALENDAR_ID,
      syncStatus: "syncing",
      lastError: ""
    });

    try {
      const currentEvent = await findCurrentEvent(token, item);
      let event;

      const config = {
        carId: item.carId,
        car: item.car,
        calendarId: CALENDAR_ID,
        durationMinutes: item.durationMinutes,
        carUrl: carUrl(item.carId)
      };

      if (currentEvent?.id) {
        event = await provider.updateEvent({
          ...config,
          eventId: currentEvent.id
        });
      } else {
        event = await provider.createEvent(config);
      }

      const returnedId = text(event?.id);
      if (!returnedId) {
        throw new Error("Google 沒有回傳 eventId");
      }

      const verification = await getExactEvent(token, returnedId);
      if (!verification.found || !verification.event) {
        throw new Error(
          `Google 事件建立／更新後無法讀回（${verification.status || "unknown"}）`
        );
      }

      const verified = verification.event;
      if (!belongsToMyCar(verified, item.carId)) {
        throw new Error("Google 事件驗證失敗：活動與 JLY 車團不一致");
      }

      await updateCalendarState(item.carId, {
        syncEnabled: true,
        calendarId: CALENDAR_ID,
        eventId: verified.id,
        eventUrl: text(verified.htmlLink),
        eventDurationMinutes: item.durationMinutes,
        syncStatus: "synced",
        lastSyncAt: nowIso(),
        lastVerifiedAt: nowIso(),
        googleEventStatus: text(verified.status),
        organizerEmail: text(verified.organizer?.email),
        creatorEmail: text(verified.creator?.email),
        lastError: ""
      });

      return verified;
    } catch (error) {
      await updateCalendarState(item.carId, {
        syncEnabled: true,
        calendarId: CALENDAR_ID,
        syncStatus: "error",
        lastSyncAt: nowIso(),
        lastError: error?.message || "Google Calendar 同步失敗"
      });
      throw error;
    }
  }

  function createOverlay() {
    const old = document.getElementById("mycarGoogleUnifiedPanel");
    if (old) {
      old.remove();
    }

    const panel = document.createElement("div");
    panel.id = "mycarGoogleUnifiedPanel";
    panel.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:100000",
      "background:rgba(0,0,0,.45)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:16px",
      "box-sizing:border-box"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "width:min(680px,100%)",
      "max-height:82vh",
      "overflow:auto",
      "background:#fff",
      "border-radius:18px",
      "padding:18px",
      "box-sizing:border-box",
      "box-shadow:0 14px 40px rgba(0,0,0,.22)"
    ].join(";");

    panel.appendChild(card);
    document.body.appendChild(panel);
    return { panel, card };
  }

  function showConfirmation(account, items, onConfirm) {
    const ui = createOverlay();
    const title = document.createElement("h3");
    title.textContent = "確認同步到 Google Calendar";
    title.style.margin = "0 0 8px";
    ui.card.appendChild(title);

    const note = document.createElement("div");
    const accountLabel = text(account?.id || account?.summary) || "primary";
    note.textContent =
      `Google：${accountLabel}\n` +
      "日期與時間只讀取 Firestore cars/{carId}，不使用 Google 同名活動、Work Schedule 或聊天內容推測。";
    note.style.cssText =
      "font-size:13px;line-height:1.55;white-space:pre-wrap;color:#555;margin-bottom:14px";
    ui.card.appendChild(note);

    items.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;white-space:pre-wrap;word-break:break-word";
      box.textContent =
        `🎭 ${item.name}\n${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘\nCar ID：${item.carId}`;
      ui.card.appendChild(box);
    });

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = `確認同步 ${items.length} 台車`;
    confirmButton.style.cssText =
      "width:100%;padding:13px;border:0;border-radius:12px;font-weight:800;font-size:16px";
    confirmButton.addEventListener("click", function () {
      ui.panel.remove();
      onConfirm();
    });
    ui.card.appendChild(confirmButton);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText =
      "width:100%;margin-top:10px;padding:12px;border-radius:12px;font-weight:700";
    cancel.addEventListener("click", function () {
      ui.panel.remove();
    });
    ui.card.appendChild(cancel);
  }

  function eventTimeText(event) {
    const start = text(event?.start?.dateTime || event?.start?.date);
    const end = text(event?.end?.dateTime || event?.end?.date);
    return start && end ? `${start} → ${end}` : (start || end || "Google 未回傳時間");
  }

  function showResults(successes, failures) {
    const ui = createOverlay();
    const title = document.createElement("h3");
    title.textContent =
      `Google 同步結果｜成功 ${successes.length} 台、失敗 ${failures.length} 台`;
    title.style.margin = "0 0 14px";
    ui.card.appendChild(title);

    successes.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;word-break:break-word";

      const details = document.createElement("div");
      details.style.cssText = "white-space:pre-wrap;font-size:13px;line-height:1.55";
      details.textContent =
        `✅ ${item.name}\n` +
        `Event ID：${item.event.id}\n` +
        `Google 時間：${eventTimeText(item.event)}\n` +
        `Organizer：${text(item.event.organizer?.email) || "未回傳"}`;
      box.appendChild(details);

      if (item.event.htmlLink) {
        const link = document.createElement("a");
        link.href = item.event.htmlLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText =
          "display:inline-block;margin-top:9px;font-weight:800;text-decoration:none";
        box.appendChild(link);
      }

      ui.card.appendChild(box);
    });

    failures.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #efcaca;border-radius:12px;padding:12px;margin-bottom:10px;font-size:13px;line-height:1.5;word-break:break-word";
      box.textContent = `❌ ${item.name || item.carId}：${item.message}`;
      ui.card.appendChild(box);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText =
      "width:100%;padding:12px;border-radius:12px;font-weight:700";
    close.addEventListener("click", function () {
      ui.panel.remove();
    });
    ui.card.appendChild(close);
  }

  async function executeSync(token, items, button) {
    const successes = [];
    const failures = [];

    button.disabled = true;
    button.textContent = "📅 同步中…";

    try {
      for (const item of items) {
        try {
          const event = await syncOne(token, item);
          successes.push({
            ...item,
            event
          });
        } catch (error) {
          failures.push({
            carId: item.carId,
            name: item.name,
            message: error?.message || "未知錯誤"
          });
        }
      }

      if (typeof renderMyCars === "function") {
        await renderMyCars({ restoreScroll: true });
      }

      showResults(successes, failures);
    } finally {
      button.disabled = false;
      button.textContent = "📅 同步 Google";
    }
  }

  async function startUnifiedSync(button) {
    if (
      typeof selectedCars === "undefined" ||
      !selectedCars.size
    ) {
      alert("請先勾選要同步 Google 的車團");
      return;
    }

    const auth = window.JLYCalendarAuth;
    if (!auth || typeof auth.requestAccessToken !== "function") {
      alert("Google Calendar 授權模組尚未載入");
      return;
    }

    const ids = Array.from(selectedCars);

    button.disabled = true;
    button.textContent = "📅 選擇 Google 帳號…";

    try {
      // 必須在實際按鈕 tap handler 中立刻觸發 OAuth，避免 iPhone Safari 阻擋 popup。
      if (typeof auth.clearToken === "function") {
        auth.clearToken();
      }
      const token = await auth.requestAccessToken({ selectAccount: true });

      button.textContent = "📅 讀取正式車團…";
      const account = await readPrimaryCalendar(token);
      const items = await readOfficialCars(ids);

      button.disabled = false;
      button.textContent = "📅 同步 Google";

      showConfirmation(account, items, function () {
        executeSync(token, items, button).catch(function (error) {
          console.error("MyCar Google 同步失敗：", error);
          alert("Google 同步未完成：" + (error?.message || "未知錯誤"));
          button.disabled = false;
          button.textContent = "📅 同步 Google";
        });
      });
    } catch (error) {
      console.error("MyCar Google 授權／來源驗證失敗：", error);
      alert("Google 同步未開始：" + (error?.message || "未知錯誤"));
      button.disabled = false;
      button.textContent = "📅 同步 Google";
    }
  }

  function installButton() {
    const countBox = document.getElementById("selectedCarCount");
    if (!countBox) {
      return;
    }

    const old = document.getElementById("batchGoogleRepairButton");
    if (old) {
      old.remove();
    }

    if (document.getElementById("batchGoogleUnifiedButton")) {
      return;
    }

    const button = document.createElement("button");
    button.id = "batchGoogleUnifiedButton";
    button.type = "button";
    button.className = "batch-convert-button";
    button.textContent = "📅 同步 Google";
    button.addEventListener("click", function () {
      startUnifiedSync(button);
    });

    countBox.insertAdjacentElement("afterend", button);
  }

  window.JLYMyCarCalendar = {
    readOfficialCars,
    syncOne,
    startUnifiedSync
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installButton);
  } else {
    installButton();
  }
})();
