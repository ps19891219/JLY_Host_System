(function () {
  "use strict";

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
    return /404|not found|resource has been deleted/i.test(
      String(error?.message || error || "")
    );
  }

  async function findExistingEvent(carId, car) {
    const provider = window.JLYCalendarProviderGoogle;

    if (!provider || !car?.gameDate) {
      return null;
    }

    const events = await provider.listEventsForDate(car.gameDate);

    return (
      events.find(function (event) {
        return String(
          event?.extendedProperties?.private?.carId || ""
        ) === String(carId);
      }) || null
    );
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
    const calendarId = calendar.calendarId || "primary";
    const durationMinutes = Number(
      calendar.eventDurationMinutes || 60
    );

    await data.updateCarCalendar(carId, {
      syncEnabled: true,
      syncStatus: "syncing",
      lastError: ""
    });

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

    await data.updateCarCalendar(carId, {
      syncEnabled: true,
      calendarId,
      eventId: event?.id || calendar.eventId || "",
      eventUrl: event?.htmlLink || calendar.eventUrl || "",
      eventDurationMinutes: durationMinutes,
      syncStatus: "synced",
      lastSyncAt: new Date().toISOString(),
      lastError: ""
    });

    return event;
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
    let success = 0;
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

        await repairOne(carId, car);
        success += 1;
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

    const failedText = failed.length
      ? `\n\n失敗 ${failed.length} 台：\n` +
        failed
          .map(
            item =>
              `• ${item.carId}：${item.message}`
          )
          .join("\n")
      : "";

    alert(
      `Google 補登完成：成功 ${success} 台、失敗 ${failed.length} 台${failedText}`
    );
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
        button.textContent = "📅 Google 授權中…";

        try {
          await auth.requestAccessToken();
          button.textContent = "📅 補登中…";
          await repairSelectedCars();
        } catch (error) {
          console.error("Google 補登授權失敗：", error);
          alert(
            "Google 授權未完成：" +
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