(function () {
  "use strict";

  const BUTTON_ID = "batchGoogleSyncButton";
  const PANEL_ID = "mycarGoogleSyncPanel";
  const VERIFY_WAIT_MS = 3000;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
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

  function carName(car) {
    return text(
      car &&
      (car.activityName || car.scriptName || car.title)
    ) || "未命名車團";
  }

  function canEdit(car, actorId) {
    const ownerId = text(car && car.ownerId);
    return Boolean(
      actorId &&
      (ownerId === actorId || (!ownerId && car && car.isHost === true))
    );
  }

  function durationOf(car) {
    return Number(
      car && car.calendar && car.calendar.eventDurationMinutes ||
      car && car.eventDurationMinutes ||
      60
    ) || 60;
  }

  async function readOfficialCars(ids) {
    if (!window.db) {
      throw new Error("Firebase 尚未載入");
    }

    const actorId = getActorId();
    if (!actorId) {
      throw new Error("請先登入 JLY 身分");
    }

    const result = [];

    for (const carId of ids) {
      const snapshot = await window.db
        .collection("cars")
        .doc(carId)
        .get();

      if (!snapshot.exists) {
        throw new Error(`找不到正式車團：${carId}`);
      }

      const car = snapshot.data() || {};
      if (!canEdit(car, actorId)) {
        throw new Error(`這台不是目前身分可修改的主揪車：${carId}`);
      }

      if (!text(car.gameDate) || !text(car.gameTime)) {
        throw new Error(`正式車團缺少日期或時間：${carName(car)}`);
      }

      result.push({
        carId,
        car,
        name: carName(car),
        durationMinutes: durationOf(car)
      });
    }

    return result;
  }

  function removePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
  }

  function makePanel(titleText) {
    removePanel();

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
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

    const title = document.createElement("h3");
    title.textContent = titleText;
    title.style.margin = "0 0 12px";
    card.appendChild(title);

    panel.appendChild(card);
    document.body.appendChild(panel);

    return { panel, card };
  }

  function addClose(card, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label || "關閉";
    button.style.cssText = [
      "width:100%",
      "margin-top:10px",
      "padding:12px",
      "border-radius:12px",
      "font-weight:700"
    ].join(";");
    button.addEventListener("click", removePanel);
    card.appendChild(button);
  }

  function getCarUrl(carId) {
    return location.origin +
      "/pages/car-detail.html?id=" +
      encodeURIComponent(carId);
  }

  async function findExistingEvent(item) {
    const provider = window.JLYCalendarProviderGoogle;
    const carId = item.carId;
    const car = item.car;

    const events = await provider.listEventsForDate(car.gameDate);
    const byCarId = events.find(function (event) {
      return text(
        event &&
        event.extendedProperties &&
        event.extendedProperties.private &&
        event.extendedProperties.private.carId
      ) === String(carId);
    });

    if (byCarId) return byCarId;

    const eventId = text(car.calendar && car.calendar.eventId);
    if (!eventId || typeof provider.getEventById !== "function") {
      return null;
    }

    try {
      const event = await provider.getEventById(
        car.calendar && car.calendar.calendarId || "primary",
        eventId
      );

      if (
        event &&
        text(
          event.extendedProperties &&
          event.extendedProperties.private &&
          event.extendedProperties.private.carId
        ) === String(carId)
      ) {
        return event;
      }
    } catch (error) {
      if (!/404|410|not found|resource has been deleted/i.test(
        String(error && error.message || error || "")
      )) {
        throw error;
      }
    }

    return null;
  }

  async function writeGoogleEvent(item) {
    const provider = window.JLYCalendarProviderGoogle;
    const existing = await findExistingEvent(item);
    const config = {
      carId: item.carId,
      car: item.car,
      calendarId: "primary",
      durationMinutes: item.durationMinutes,
      carUrl: getCarUrl(item.carId)
    };

    if (existing && existing.id) {
      try {
        return await provider.updateEvent({
          ...config,
          eventId: existing.id
        });
      } catch (error) {
        if (!/404|410|not found|resource has been deleted/i.test(
          String(error && error.message || error || "")
        )) {
          throw error;
        }
      }
    }

    return provider.createEvent(config);
  }

  async function verifyEvent(item, event) {
    const provider = window.JLYCalendarProviderGoogle;
    if (!event || !event.id) {
      return { ok: false, reason: "Google 沒有回傳 Event ID" };
    }

    let exact = event;
    if (typeof provider.getEventById === "function") {
      try {
        exact = await provider.getEventById("primary", event.id);
      } catch (error) {
        return {
          ok: false,
          reason: error && error.message ? error.message : "Event ID 無法讀回"
        };
      }
    }

    if (!exact || exact.status === "cancelled") {
      return { ok: false, reason: "Google 事件不存在或已取消" };
    }

    const linkedCarId = text(
      exact.extendedProperties &&
      exact.extendedProperties.private &&
      exact.extendedProperties.private.carId
    );

    if (linkedCarId !== String(item.carId)) {
      return { ok: false, reason: "Google Event 與 JLY Car ID 不一致" };
    }

    const events = await provider.listEventsForDate(item.car.gameDate);
    const listed = events.some(function (candidate) {
      return candidate &&
        candidate.id === exact.id &&
        candidate.status !== "cancelled";
    });

    if (!listed) {
      return { ok: false, reason: "Google 日期清單找不到剛同步的事件" };
    }

    return { ok: true, event: exact };
  }

  async function saveCalendarState(item, patch) {
    const current = item.car.calendar || {};
    await window.db
      .collection("cars")
      .doc(item.carId)
      .update({
        calendar: {
          provider: "google",
          syncEnabled: true,
          calendarId: "primary",
          ...current,
          ...patch
        },
        updatedAt: new Date().toISOString()
      });
  }

  async function syncItems(items, button) {
    const succeeded = [];
    const failed = [];
    const staged = [];

    for (const item of items) {
      try {
        await saveCalendarState(item, {
          syncStatus: "syncing",
          lastError: ""
        });

        const event = await writeGoogleEvent(item);
        staged.push({ item, event });
      } catch (error) {
        failed.push({
          item,
          message: error && error.message ? error.message : "Google 同步失敗"
        });
      }
    }

    if (staged.length) {
      button.textContent = "📅 驗證 Google 事件…";
      await sleep(VERIFY_WAIT_MS);
    }

    for (const row of staged) {
      let verified;
      try {
        verified = await verifyEvent(row.item, row.event);

        if (!verified.ok) {
          await sleep(1200);
          verified = await verifyEvent(row.item, row.event);
        }

        if (!verified.ok) {
          throw new Error(verified.reason || "Google 事件驗證失敗");
        }

        const event = verified.event;
        await saveCalendarState(row.item, {
          eventId: event.id,
          eventUrl: event.htmlLink || "",
          eventDurationMinutes: row.item.durationMinutes,
          syncStatus: "synced",
          lastSyncAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
          lastError: ""
        });

        succeeded.push({ item: row.item, event });
      } catch (error) {
        try {
          await saveCalendarState(row.item, {
            syncStatus: "error",
            lastSyncAt: new Date().toISOString(),
            lastError: error && error.message ? error.message : "Google 事件驗證失敗"
          });
        } catch (_) {}

        failed.push({
          item: row.item,
          message: error && error.message ? error.message : "Google 事件驗證失敗"
        });
      }
    }

    return { succeeded, failed };
  }

  function showResults(result) {
    const ui = makePanel(
      `Google 同步結果｜成功 ${result.succeeded.length} 台、失敗 ${result.failed.length} 台`
    );

    result.succeeded.forEach(function (row) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #d7e8da;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.55;word-break:break-word";

      const event = row.event || {};
      box.textContent =
        `✅ ${row.item.name}\n` +
        `Car ID：${row.item.carId}\n` +
        `Event ID：${text(event.id)}\n` +
        `Google 時間：${text(event.start && (event.start.dateTime || event.start.date))} → ${text(event.end && (event.end.dateTime || event.end.date))}`;

      if (event.htmlLink) {
        const link = document.createElement("a");
        link.href = event.htmlLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText = "display:block;margin-top:8px;font-weight:800";
        box.appendChild(link);
      }

      ui.card.appendChild(box);
    });

    result.failed.forEach(function (row) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #efc7c7;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.55;word-break:break-word";
      box.textContent =
        `❌ ${row.item ? row.item.name : "車團"}\n` +
        `${row.item ? row.item.carId : ""}\n` +
        row.message;
      ui.card.appendChild(box);
    });

    addClose(ui.card);
  }

  function showConfirmation(items, button) {
    const ui = makePanel("請核對 JLY 正式車團資料");

    const note = document.createElement("div");
    note.textContent = "Google 同步只使用 Firestore cars/{carId} 的正式日期／時間，不使用 Google 同名活動或 Work Schedule 推測。";
    note.style.cssText = "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    ui.card.appendChild(note);

    items.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.55;word-break:break-word;white-space:pre-wrap";
      box.textContent =
        `🎭 ${item.name}\n` +
        `${item.car.gameDate} ${item.car.gameTime}｜${item.durationMinutes} 分鐘\n` +
        `Car ID：${item.carId}`;
      ui.card.appendChild(box);
    });

    const action = document.createElement("button");
    action.type = "button";
    action.textContent = "確認資料正確，同步 Google";
    action.style.cssText = "width:100%;margin-top:8px;padding:13px;border:0;border-radius:12px;font-weight:800;font-size:16px";

    action.addEventListener("click", async function () {
      const auth = window.JLYCalendarAuth;
      if (!auth || typeof auth.requestAccessToken !== "function") {
        alert("Google Calendar 授權模組尚未載入");
        return;
      }

      action.disabled = true;
      action.textContent = "選擇 Google 帳號…";

      try {
        if (typeof auth.clearToken === "function") auth.clearToken();
        await auth.requestAccessToken({ selectAccount: true });

        removePanel();
        button.disabled = true;
        button.textContent = "📅 同步中…";

        const result = await syncItems(items, button);
        showResults(result);

        if (typeof renderMyCars === "function") {
          await renderMyCars({ restoreScroll: true });
        }
      } catch (error) {
        alert("Google 同步未完成：" + (error && error.message ? error.message : "未知錯誤"));
      } finally {
        button.disabled = false;
        button.textContent = "📅 同步 Google";
      }
    });

    ui.card.appendChild(action);
    addClose(ui.card, "取消");
  }

  async function start(button) {
    if (typeof selectedCars === "undefined" || !selectedCars.size) {
      alert("請先勾選要同步 Google 的車團");
      return;
    }

    button.disabled = true;
    button.textContent = "📅 讀取 JLY 正式車團…";

    try {
      const items = await readOfficialCars(Array.from(selectedCars));
      showConfirmation(items, button);
    } catch (error) {
      alert("Google 同步已停止：" + (error && error.message ? error.message : "無法讀取 JLY 正式車團"));
    } finally {
      button.disabled = false;
      button.textContent = "📅 同步 Google";
    }
  }

  function removeLegacyButtons() {
    [
      "batchGoogleRepairButton",
      "batchGoogleRepairConfirmedButton",
      "batchGoogleCleanSyncButton",
      "batchGoogleSyncResultButton"
    ].forEach(function (id) {
      const element = document.getElementById(id);
      if (element) element.remove();
    });
  }

  function install() {
    const count = document.getElementById("selectedCarCount");
    if (!count) return;

    removeLegacyButtons();

    let button = document.getElementById(BUTTON_ID);
    if (button) return;

    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "batch-convert-button";
    button.textContent = "📅 同步 Google";
    button.addEventListener("click", function () {
      start(button);
    });

    count.insertAdjacentElement("afterend", button);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }

  setTimeout(install, 400);
  setTimeout(install, 1200);
})();
