(function () {
  "use strict";

  const GOOGLE_CALENDAR_API =
    "https://www.googleapis.com/calendar/v3";

  function getActorId() {
    if (
      window.JLYIdentity &&
      typeof window.JLYIdentity.getCurrentPlayerId === "function"
    ) {
      return String(
        window.JLYIdentity.getCurrentPlayerId() || ""
      ).trim();
    }

    return String(
      localStorage.getItem("currentPlayerId") || ""
    ).trim();
  }

  function isEditableCar(car, actorId) {
    const ownerId = String(car?.ownerId || "").trim();
    const legacyHost = !ownerId && car?.isHost === true;
    return Boolean(
      actorId &&
      (ownerId === actorId || legacyHost)
    );
  }

  function carUrl(carId) {
    return `${location.origin}/pages/car-detail.html?id=${encodeURIComponent(carId)}`;
  }

  function goneError(error) {
    return /404|410|not found|resource has been deleted/i.test(
      String(error?.message || error || "")
    );
  }

  function eventCarId(event) {
    return String(
      event?.extendedProperties?.private?.carId || ""
    ).trim();
  }

  function configuredCalendarId() {
    return String(
      window.JLYCalendarConfig?.calendarId || "primary"
    ).trim() || "primary";
  }

  async function getPrimaryCalendarIdentity() {
    const auth = window.JLYCalendarAuth;

    if (!auth || typeof auth.requestAccessToken !== "function") {
      throw new Error("Google Calendar 授權模組尚未載入");
    }

    const token = await auth.requestAccessToken();
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
    const auth = window.JLYCalendarAuth;
    let info = await getPrimaryCalendarIdentity();
    let accountLabel = String(
      info?.id || info?.summary || "目前 Google 帳號"
    ).trim();

    const accepted = window.confirm(
      `這次會補登到：\n${accountLabel}\n\n` +
      "確認用這個 Google 帳號補登嗎？"
    );

    if (accepted) {
      return info;
    }

    if (typeof auth.clearToken === "function") {
      auth.clearToken();
    }

    await auth.requestAccessToken({ selectAccount: true });
    info = await getPrimaryCalendarIdentity();
    accountLabel = String(
      info?.id || info?.summary || "目前 Google 帳號"
    ).trim();

    const acceptedAfterRetry = window.confirm(
      `重新選擇後的 Google 行事曆：\n${accountLabel}\n\n` +
      "確認用這個帳號補登嗎？"
    );

    if (!acceptedAfterRetry) {
      throw new Error("已取消補登：Google 行事曆帳號未確認");
    }

    return info;
  }

  async function findExistingEvent(carId, car) {
    const provider = window.JLYCalendarProviderGoogle;

    if (!provider || !car?.gameDate) {
      return null;
    }

    const events = await provider.listEventsForDate(car.gameDate);

    return (
      events.find(function (event) {
        return eventCarId(event) === String(carId);
      }) || null
    );
  }

  async function getEventById(calendarId, eventId) {
    const auth = window.JLYCalendarAuth;
    const cleanEventId = String(eventId || "").trim();

    if (!auth || typeof auth.requestAccessToken !== "function") {
      throw new Error("Google Calendar 授權模組尚未載入");
    }

    if (!cleanEventId) {
      throw new Error("Google 建立後沒有回傳 eventId");
    }

    const token = await auth.requestAccessToken();
    const url =
      `${GOOGLE_CALENDAR_API}/calendars/` +
      `${encodeURIComponent(calendarId)}/events/` +
      encodeURIComponent(cleanEventId);

    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!response.ok) {
      let message =
        `Google 建立後驗證失敗（${response.status}）`;

      try {
        const body = await response.json();
        if (body?.error?.message) {
          message += `：${body.error.message}`;
        }
      } catch (error) {
        // 保留狀態碼訊息
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function verifyRepairedEvent(
    carId,
    calendarId,
    event
  ) {
    const expectedId = String(event?.id || "").trim();
    const verified = await getEventById(
      calendarId,
      expectedId
    );

    if (!verified?.id) {
      throw new Error(
        "Google 建立後驗證失敗：查不到建立後的活動"
      );
    }

    if (String(verified.id) !== expectedId) {
      throw new Error(
        "Google 建立後驗證失敗：eventId 不一致"
      );
    }

    if (eventCarId(verified) !== String(carId)) {
      throw new Error(
        "Google 建立後驗證失敗：活動與車團 ID 不一致"
      );
    }

    return verified;
  }

  function eventTimeText(event) {
    const start = String(
      event?.start?.dateTime ||
      event?.start?.date ||
      ""
    ).trim();
    const end = String(
      event?.end?.dateTime ||
      event?.end?.date ||
      ""
    ).trim();

    if (start && end) {
      return `${start} → ${end}`;
    }

    return start || end || "Google 未回傳時間";
  }

  function carName(car) {
    return String(
      car?.activityName ||
      car?.scriptName ||
      car?.title ||
      "未命名車團"
    ).trim();
  }

  function showRepairDiagnostics(successItems, failedItems) {
    const existing = document.getElementById(
      "mycarGoogleRepairDiagnostics"
    );

    if (existing) {
      existing.remove();
    }

    const panel = document.createElement("div");
    panel.id = "mycarGoogleRepairDiagnostics";
    panel.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "background:rgba(0,0,0,.45)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:16px"
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
    title.textContent =
      `Google 補登診斷｜成功 ${successItems.length} 台、失敗 ${failedItems.length} 台`;
    title.style.margin = "0 0 14px";
    card.appendChild(title);

    successItems.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = [
        "border:1px solid #ddd",
        "border-radius:12px",
        "padding:12px",
        "margin:0 0 12px",
        "word-break:break-word"
      ].join(";");

      const name = document.createElement("strong");
      name.textContent = `✅ ${item.name}`;
      box.appendChild(name);

      const details = document.createElement("div");
      details.style.cssText =
        "margin-top:8px;font-size:13px;line-height:1.55;white-space:pre-wrap";
      details.textContent =
        `Car ID：${item.carId}\n` +
        `Event ID：${item.eventId}\n` +
        `Google 時間：${item.timeText}`;
      box.appendChild(details);

      if (item.eventUrl) {
        const link = document.createElement("a");
        link.href = item.eventUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText = [
          "display:inline-block",
          "margin-top:10px",
          "padding:9px 12px",
          "border-radius:10px",
          "background:#f2f2f2",
          "font-weight:700",
          "text-decoration:none"
        ].join(";");
        box.appendChild(link);
      } else {
        const noLink = document.createElement("div");
        noLink.textContent = "⚠️ Google 沒有回傳 eventUrl";
        noLink.style.cssText =
          "margin-top:10px;font-size:13px;font-weight:700";
        box.appendChild(noLink);
      }

      card.appendChild(box);
    });

    if (failedItems.length) {
      const failedTitle = document.createElement("h4");
      failedTitle.textContent = "失敗明細";
      failedTitle.style.margin = "16px 0 8px";
      card.appendChild(failedTitle);

      failedItems.forEach(function (item) {
        const failed = document.createElement("div");
        failed.textContent =
          `❌ ${item.carId}：${item.message}`;
        failed.style.cssText =
          "font-size:13px;line-height:1.5;margin-bottom:8px;word-break:break-word";
        card.appendChild(failed);
      });
    }

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText = [
      "width:100%",
      "margin-top:8px",
      "padding:12px",
      "border-radius:12px",
      "font-weight:700"
    ].join(";");
    close.addEventListener("click", function () {
      panel.remove();
    });
    card.appendChild(close);

    panel.addEventListener("click", function (event) {
      if (event.target === panel) {
        panel.remove();
      }
    });

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  async function repairOne(carId, car) {
    if (!car?.gameDate || !car?.gameTime) {
      throw new Error("車團尚未設定日期或時間");
    }

    const provider = window.JLYCalendarProviderGoogle;
    const data = window.JLYCalendarData;

    if (!provider || !data) {
      throw new Error("Google Calendar 模組尚未載入");
    }

    const calendar = car.calendar || {};
    const calendarId = configuredCalendarId();
    const durationMinutes = Number(
      calendar.eventDurationMinutes || 60
    );

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
          durationMinutes,
          carUrl: carUrl(carId)
        });
      } else if (calendar.eventId) {
        try {
          event = await provider.updateEvent({
            carId,
            car,
            eventId: calendar.eventId,
            calendarId,
            durationMinutes,
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
            durationMinutes,
            carUrl: carUrl(carId)
          });
        }
      } else {
        event = await provider.createEvent({
          carId,
          car,
          calendarId,
          durationMinutes,
          carUrl: carUrl(carId)
        });
      }

      event = await verifyRepairedEvent(
        carId,
        calendarId,
        event
      );

      await data.updateCarCalendar(carId, {
        syncEnabled: true,
        calendarId,
        eventId: event.id,
        eventUrl: event.htmlLink || calendar.eventUrl || "",
        eventDurationMinutes: durationMinutes,
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
        lastError: error?.message || "Google 補登驗證失敗"
      });

      throw error;
    }
  }

  async function repairSelectedCars() {
    if (
      typeof selectedCars === "undefined" ||
      !selectedCars.size
    ) {
      alert("請先勾選要補登 Google 行事曆的車團");
      return;
    }

    if (!window.db) {
      alert("Firebase 尚未載入");
      return;
    }

    const actorId = getActorId();

    if (!actorId) {
      alert("請先登入 JLY 身分");
      return;
    }

    const ids = Array.from(selectedCars);
    const succeeded = [];
    const failed = [];

    for (const carId of ids) {
      try {
        const snapshot = await window.db
          .collection("cars")
          .doc(carId)
          .get();

        if (!snapshot.exists) {
          throw new Error("找不到車團資料");
        }

        const car = snapshot.data() || {};

        if (!isEditableCar(car, actorId)) {
          throw new Error("不是目前身分可修改的主揪車");
        }

        const event = await repairOne(carId, car);
        succeeded.push({
          carId,
          name: carName(car),
          eventId: String(event?.id || "").trim(),
          eventUrl: String(event?.htmlLink || "").trim(),
          timeText: eventTimeText(event)
        });
      } catch (error) {
        failed.push({
          carId,
          message: error?.message || "未知錯誤"
        });
      }
    }

    if (typeof renderMyCars === "function") {
      await renderMyCars({
        restoreScroll: true
      });
    }

    showRepairDiagnostics(succeeded, failed);
  }

  function installBatchRepairButton() {
    const toolbar = document.getElementById("batchToolbar");
    const countBox = document.getElementById("selectedCarCount");

    if (
      !toolbar ||
      !countBox ||
      document.getElementById("batchGoogleRepairButton")
    ) {
      return;
    }

    const button = document.createElement("button");
    button.id = "batchGoogleRepairButton";
    button.type = "button";
    button.className = "batch-convert-button";
    button.textContent = "📅 補登 Google";

    button.addEventListener(
      "click",
      async function () {
        const auth = window.JLYCalendarAuth;

        if (
          !auth ||
          typeof auth.requestAccessToken !== "function"
        ) {
          alert("Google Calendar 授權模組尚未載入");
          return;
        }

        button.disabled = true;
        button.textContent = "📅 選擇 Google 帳號…";

        try {
          if (typeof auth.clearToken === "function") {
            auth.clearToken();
          }
          await auth.requestAccessToken({ selectAccount: true });
          await confirmGoogleAccount();
          button.textContent = "📅 補登中…";
          await repairSelectedCars();
        } catch (error) {
          console.error("Google 補登授權失敗：", error);
          alert(
            "Google 補登未完成：" +
            (error?.message || "未知錯誤")
          );
        } finally {
          button.disabled = false;
          button.textContent = "📅 補登 Google";
        }
      }
    );

    countBox.insertAdjacentElement(
      "afterend",
      button
    );
  }

  function removeStandaloneRepairEntry() {
    const menu = document.getElementById("mycarMenu");

    if (!menu) {
      return;
    }

    menu
      .querySelectorAll("button")
      .forEach(function (button) {
        const handler = String(
          button.getAttribute("onclick") || ""
        );

        if (
          handler.includes("startGoogleCalendarRepairMode")
        ) {
          button.remove();
        }
      });
  }

  window.repairSelectedCarsGoogleCalendar =
    repairSelectedCars;

  function install() {
    removeStandaloneRepairEntry();
    installBatchRepairButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }
})();