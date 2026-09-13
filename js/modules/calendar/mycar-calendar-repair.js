(function () {
  "use strict";

  const GOOGLE_CALENDAR_API =
    "https://www.googleapis.com/calendar/v3";

  function text(value) {
    return String(value == null ? "" : value).trim();
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
    return (
      location.origin +
      "/pages/car-detail.html?id=" +
      encodeURIComponent(carId)
    );
  }

  function configuredCalendarId() {
    return text(window.JLYCalendarConfig?.calendarId) || "primary";
  }

  function eventCarId(event) {
    return text(event?.extendedProperties?.private?.carId);
  }

  function goneError(error) {
    return /404|410|not found|resource has been deleted/i.test(
      text(error?.message || error)
    );
  }

  function durationMinutes(car) {
    return Number(
      car?.calendar?.eventDurationMinutes ||
      car?.eventDurationMinutes ||
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
      Number(before?.durationMinutes || 60) ===
        Number(after?.durationMinutes || 60)
    );
  }

  function showOfficialConfirmation(items, onConfirm) {
    document.getElementById("mycarGoogleSingleFlowPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarGoogleSingleFlowPanel";
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
    title.textContent = "重新同步 Google Calendar";
    title.style.margin = "0 0 8px";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent =
      "以下日期／時間只讀取 JLY 正式 cars/{carId}。不使用 Google 同名事件、Work Schedule 或其他來源推測。";
    note.style.cssText =
      "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    card.appendChild(note);

    items.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = [
        "border:1px solid #ddd",
        "border-radius:12px",
        "padding:12px",
        "margin-bottom:10px",
        "line-height:1.55",
        "word-break:break-word"
      ].join(";");

      const name = document.createElement("strong");
      name.textContent = `🎭 ${item.name}`;
      box.appendChild(name);

      const details = document.createElement("div");
      details.textContent =
        `${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘\n` +
        `Car ID：${item.carId}`;
      details.style.cssText =
        "margin-top:6px;font-size:13px;white-space:pre-wrap";
      box.appendChild(details);
      card.appendChild(box);
    });

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "確認資料正確，重新同步 Google";
    confirmButton.style.cssText = [
      "width:100%",
      "margin-top:8px",
      "padding:13px",
      "border:0",
      "border-radius:12px",
      "font-weight:800",
      "font-size:16px"
    ].join(";");

    confirmButton.addEventListener("click", function () {
      onConfirm(confirmButton, panel);
    });
    card.appendChild(confirmButton);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText = [
      "width:100%",
      "margin-top:10px",
      "padding:12px",
      "border-radius:12px",
      "font-weight:700"
    ].join(";");
    cancel.addEventListener("click", function () {
      panel.remove();
    });
    card.appendChild(cancel);

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  async function getPrimaryCalendarIdentity() {
    const auth = window.JLYCalendarAuth;
    if (!auth || typeof auth.requestAccessToken !== "function") {
      throw new Error("Google Calendar 授權模組尚未載入");
    }

    const token = auth.getAccessToken?.() ||
      await auth.requestAccessToken();

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary`,
      {
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `無法確認目前 Google 行事曆帳號（${response.status}）`
      );
    }

    return response.json();
  }

  async function confirmGoogleAccount() {
    const info = await getPrimaryCalendarIdentity();
    const accountLabel = text(info?.id || info?.summary) || "目前 Google 帳號";

    if (!window.confirm(
      `這次會同步到：\n${accountLabel}\n\n確認使用這個 Google Calendar 嗎？`
    )) {
      throw new Error("已取消：Google Calendar 帳號未確認");
    }

    return info;
  }

  async function findExistingEvent(carId, car) {
    const provider = window.JLYCalendarProviderGoogle;
    if (!provider) {
      throw new Error("Google Calendar Provider 尚未載入");
    }

    const events = await provider.listEventsForDate(car.gameDate);
    return events.find(function (event) {
      return eventCarId(event) === text(carId);
    }) || null;
  }

  function validateGoogleResponse(carId, car, event) {
    if (!event || !text(event.id)) {
      throw new Error("Google 沒有回傳 eventId");
    }

    if (eventCarId(event) !== text(carId)) {
      throw new Error("Google 回傳事件與 JLY 車團 ID 不一致");
    }

    const provider = window.JLYCalendarProviderGoogle;
    const expected = provider.buildEventResource({
      carId,
      car,
      durationMinutes: durationMinutes(car),
      carUrl: carUrl(carId)
    });

    if (
      text(event?.start?.dateTime) !== text(expected?.start?.dateTime) ||
      text(event?.end?.dateTime) !== text(expected?.end?.dateTime)
    ) {
      throw new Error("Google 回傳的日期時間與 JLY 正式車團不一致");
    }

    return event;
  }

  async function syncOne(item) {
    const provider = window.JLYCalendarProviderGoogle;
    const data = window.JLYCalendarData;

    if (!provider || !data) {
      throw new Error("Google Calendar 模組尚未載入");
    }

    const carId = item.carId;
    const car = item.car;
    const calendar = car.calendar || {};
    const calendarId = configuredCalendarId();
    const minutes = item.durationMinutes;

    await data.updateCarCalendar(carId, {
      syncEnabled: true,
      calendarId,
      syncStatus: "syncing",
      lastError: ""
    });

    try {
      let event = await findExistingEvent(carId, car);

      if (event?.id) {
        event = await provider.updateEvent({
          carId,
          car,
          eventId: event.id,
          calendarId,
          durationMinutes: minutes,
          carUrl: carUrl(carId)
        });
      } else if (text(calendar.eventId)) {
        try {
          event = await provider.updateEvent({
            carId,
            car,
            eventId: calendar.eventId,
            calendarId,
            durationMinutes: minutes,
            carUrl: carUrl(carId)
          });
        } catch (error) {
          if (!goneError(error)) {
            throw error;
          }

          event = await provider.createEvent({
            carId,
            car,
            calendarId,
            durationMinutes: minutes,
            carUrl: carUrl(carId)
          });
        }
      } else {
        event = await provider.createEvent({
          carId,
          car,
          calendarId,
          durationMinutes: minutes,
          carUrl: carUrl(carId)
        });
      }

      event = validateGoogleResponse(carId, car, event);

      await data.updateCarCalendar(carId, {
        syncEnabled: true,
        calendarId,
        eventId: text(event.id),
        eventUrl: text(event.htmlLink),
        eventDurationMinutes: minutes,
        syncStatus: "synced",
        lastSyncAt: new Date().toISOString(),
        lastError: ""
      });

      return event;
    } catch (error) {
      await data.updateCarCalendar(carId, {
        syncEnabled: true,
        calendarId,
        syncStatus: "error",
        lastSyncAt: new Date().toISOString(),
        lastError: text(error?.message) || "Google 同步失敗"
      });
      throw error;
    }
  }

  function eventTimeText(event) {
    const start = text(event?.start?.dateTime || event?.start?.date);
    const end = text(event?.end?.dateTime || event?.end?.date);
    return start && end ? `${start} → ${end}` : start || end || "Google 未回傳時間";
  }

  function showResults(successItems, failedItems) {
    document.getElementById("mycarGoogleSingleFlowPanel")?.remove();
    document.getElementById("mycarGoogleResultPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarGoogleResultPanel";
    panel.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";

    const card = document.createElement("div");
    card.style.cssText =
      "width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-sizing:border-box";

    const title = document.createElement("h3");
    title.textContent =
      `Google 同步結果｜成功 ${successItems.length} 台、失敗 ${failedItems.length} 台`;
    card.appendChild(title);

    successItems.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:12px;margin:0 0 10px;word-break:break-word";
      box.innerText =
        `✅ ${item.name}\n${item.timeText}\nEvent ID：${item.eventId}`;

      if (item.eventUrl) {
        const link = document.createElement("a");
        link.href = item.eventUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText =
          "display:inline-block;margin-top:8px;font-weight:700";
        box.appendChild(document.createElement("br"));
        box.appendChild(link);
      }

      card.appendChild(box);
    });

    failedItems.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:12px;margin:0 0 10px;word-break:break-word";
      box.textContent = `❌ ${item.name || item.carId}：${item.message}`;
      card.appendChild(box);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText =
      "width:100%;margin-top:8px;padding:12px;border-radius:12px;font-weight:700";
    close.addEventListener("click", function () {
      panel.remove();
    });
    card.appendChild(close);

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
      if (typeof auth.clearToken === "function") {
        auth.clearToken();
      }

      /*
        This is intentionally the first awaited operation after the physical
        confirmation tap, preserving iPhone Safari's OAuth user gesture.
      */
      await auth.requestAccessToken({ selectAccount: true });
      await confirmGoogleAccount();

      button.textContent = "📅 重新讀取 JLY 正式資料…";

      const latestItems = await readOfficialCars(
        preflightItems.map(function (item) {
          return item.carId;
        })
      );

      for (let index = 0; index < latestItems.length; index += 1) {
        if (!sameFormalSchedule(preflightItems[index], latestItems[index])) {
          throw new Error(
            `車團資料在確認後已變更，已停止同步：${latestItems[index].name}`
          );
        }
      }

      const succeeded = [];
      const failed = [];

      button.textContent = "📅 同步中…";

      for (const item of latestItems) {
        try {
          const event = await syncOne(item);
          succeeded.push({
            carId: item.carId,
            name: item.name,
            eventId: text(event?.id),
            eventUrl: text(event?.htmlLink),
            timeText: eventTimeText(event)
          });
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

      showResults(succeeded, failed);
    } catch (error) {
      console.error("MyCar Google 同步未完成：", error);
      alert(
        "Google 同步未完成：" +
        (text(error?.message) || "未知錯誤")
      );
    } finally {
      button.disabled = false;
      button.textContent = "確認資料正確，重新同步 Google";
      if (panel?.isConnected) {
        panel.remove();
      }
    }
  }

  async function openSingleFlow() {
    if (
      typeof selectedCars === "undefined" ||
      !selectedCars.size
    ) {
      alert("請先勾選要重新同步 Google Calendar 的車團");
      return;
    }

    try {
      const ids = Array.from(selectedCars);
      const official = await readOfficialCars(ids);
      showOfficialConfirmation(
        official,
        function (button, panel) {
          runConfirmedSync(official, button, panel);
        }
      );
    } catch (error) {
      console.error("MyCar Google 正式資料讀取失敗：", error);
      alert(
        "Google 同步已停止：\n" +
        (text(error?.message) || "無法確認 JLY 正式車團資料")
      );
    }
  }

  function installButton() {
    const toolbar = document.getElementById("batchToolbar");
    const countBox = document.getElementById("selectedCarCount");

    if (!toolbar || !countBox) {
      return;
    }

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
    open: openSingleFlow
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
