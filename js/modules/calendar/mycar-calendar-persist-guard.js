(function () {
  "use strict";

  const API_BASE = "https://www.googleapis.com/calendar/v3";
  const text = (value) => String(value == null ? "" : value).trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getAccessToken() {
    const auth = window.JLYCalendarAuth;
    const token = text(auth?.getAccessToken?.());
    if (!token) {
      throw new Error("MyCar 驗證失敗：找不到目前這次 OAuth 的 Access Token");
    }
    return token;
  }

  async function googleFetch(path, token) {
    const response = await fetch(API_BASE + path, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    if (!response.ok) {
      const googleMessage = text(body?.error?.message) || "Google Calendar API 錯誤";
      const error = new Error(`${googleMessage}（HTTP ${response.status}）`);
      error.httpStatus = response.status;
      error.googleMessage = googleMessage;
      throw error;
    }

    return {
      status: response.status,
      body
    };
  }

  function expectedResource(carId, car) {
    const provider = window.JLYCalendarProviderGoogle;
    if (!provider || typeof provider.buildEventResource !== "function") {
      throw new Error("MyCar 驗證失敗：Google Calendar Provider 尚未載入");
    }

    return provider.buildEventResource({
      carId,
      car,
      durationMinutes: Number(
        car?.calendar?.eventDurationMinutes || car?.eventDurationMinutes || 60
      ) || 60,
      carUrl:
        location.origin +
        "/pages/car-detail.html?id=" +
        encodeURIComponent(carId)
    });
  }

  function eventCarId(event) {
    return text(event?.extendedProperties?.private?.carId);
  }

  function eventTime(event, edge) {
    return text(event?.[edge]?.dateTime || event?.[edge]?.date);
  }

  function diagnosticMessage(diag) {
    return [
      `Google Calendar：${diag.calendarId || "primary"}`,
      `Car ID：${diag.carId || ""}`,
      `Event ID：${diag.eventId || ""}`,
      `JLY：${diag.expectedStart || ""} → ${diag.expectedEnd || ""}`,
      `Google：${diag.actualStart || "未取得"} → ${diag.actualEnd || "未取得"}`,
      `Exact GET：${diag.exactGetStatus || "未完成"}`,
      `Targeted LIST：${diag.listStatus || "未完成"}`
    ].join("｜");
  }

  async function verify(carId, eventId) {
    const cfg = text(window.JLYCalendarConfig?.calendarId) || "primary";
    if (cfg !== "primary") {
      throw new Error("MyCar 只允許同步 Google primary");
    }

    const snapshot = await window.db.collection("cars").doc(carId).get();
    if (!snapshot.exists) {
      throw new Error("找不到正式車團資料");
    }

    const car = snapshot.data() || {};
    if (!text(car.gameDate) || !text(car.gameTime)) {
      throw new Error("正式車團缺少日期或時間");
    }

    const expected = expectedResource(carId, car);
    const token = getAccessToken();
    const diag = {
      calendarId: "primary",
      carId: text(carId),
      eventId: text(eventId),
      expectedStart: eventTime(expected, "start"),
      expectedEnd: eventTime(expected, "end"),
      actualStart: "",
      actualEnd: "",
      exactGetStatus: "pending",
      listStatus: "pending",
      verifiedAt: new Date().toISOString()
    };

    try {
      const identityResult = await googleFetch(
        "/calendars/primary",
        token
      );
      diag.calendarId =
        text(identityResult.body?.id || identityResult.body?.summary) || "primary";

      const exactResult = await googleFetch(
        "/calendars/primary/events/" + encodeURIComponent(eventId),
        token
      );
      const event = exactResult.body || {};
      diag.exactGetStatus = `HTTP ${exactResult.status}`;
      diag.actualStart = eventTime(event, "start");
      diag.actualEnd = eventTime(event, "end");

      if (text(event.id) !== text(eventId)) {
        throw new Error("Exact GET 回傳的 Event ID 不一致");
      }

      if (eventCarId(event) !== text(carId)) {
        throw new Error("Google event 的 private.carId 與 JLY Car ID 不一致");
      }

      if (
        diag.actualStart !== diag.expectedStart ||
        diag.actualEnd !== diag.expectedEnd
      ) {
        throw new Error("Google event 的日期時間與 JLY 正式車團不一致");
      }

      const params = new URLSearchParams({
        privateExtendedProperty: "carId=" + text(carId),
        singleEvents: "true",
        showDeleted: "false",
        maxResults: "25"
      });

      let listFound = false;
      let lastListStatus = "未完成";

      for (let index = 0; index < 5; index += 1) {
        if (index > 0) {
          await wait(800 * (index + 1));
        }

        const listResult = await googleFetch(
          "/calendars/primary/events?" + params.toString(),
          token
        );
        lastListStatus = `HTTP ${listResult.status}`;
        const items = Array.isArray(listResult.body?.items)
          ? listResult.body.items
          : [];

        listFound = items.some(function (item) {
          return (
            text(item?.id) === text(eventId) &&
            eventCarId(item) === text(carId)
          );
        });

        if (listFound) {
          break;
        }
      }

      diag.listStatus = listFound
        ? `${lastListStatus} / found`
        : `${lastListStatus} / not found`;

      if (!listFound) {
        throw new Error(
          "Exact GET 找得到事件，但 targeted LIST 尚未找得到；禁止標記 synced"
        );
      }

      window.JLYMyCarPersistDiagnostics =
        window.JLYMyCarPersistDiagnostics || {};
      window.JLYMyCarPersistDiagnostics[carId] = diag;

      return event;
    } catch (error) {
      if (error?.httpStatus && diag.exactGetStatus === "pending") {
        diag.exactGetStatus = `HTTP ${error.httpStatus}`;
      }

      window.JLYMyCarPersistDiagnostics =
        window.JLYMyCarPersistDiagnostics || {};
      window.JLYMyCarPersistDiagnostics[carId] = diag;

      const baseMessage = text(error?.message) || "Google event 驗證失敗";
      throw new Error(`${baseMessage}｜${diagnosticMessage(diag)}`);
    }
  }

  function install() {
    const data = window.JLYCalendarData;
    if (!data || data.__persistGuard) {
      return;
    }

    const original = data.updateCarCalendar.bind(data);

    data.updateCarCalendar = async function (carId, patch) {
      if (patch?.syncStatus === "synced" && patch?.eventId) {
        await verify(carId, patch.eventId);
      }
      return original(carId, patch);
    };

    data.__persistGuard = true;
  }

  install();
})();
