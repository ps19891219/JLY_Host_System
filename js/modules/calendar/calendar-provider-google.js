(function () {
  "use strict";

  const API_BASE =
    "https://www.googleapis.com/calendar/v3";

  function getConfig() {
    return (
      window.JLYCalendarConfig ||
      {}
    );
  }

  async function authorizedFetch(
    url,
    options = {}
  ) {
    const token =
      await window
        .JLYCalendarAuth
        .requestAccessToken();

    const headers =
      new Headers(
        options.headers || {}
      );

    headers.set(
      "Authorization",
      "Bearer " + token
    );

    if (
      options.body &&
      !headers.has("Content-Type")
    ) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }

    const response =
      await fetch(url, {
        ...options,
        headers
      });

    if (!response.ok) {
      let message =
        "Google Calendar API 錯誤（" +
        response.status +
        "）";

      try {
        const body =
          await response.json();

        message =
          body &&
          body.error &&
          body.error.message
            ? body.error.message
            : message;
      } catch (error) {
        // 使用預設錯誤訊息
      }

      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  function pad(value) {
    return String(value)
      .padStart(2, "0");
  }

  function formatLocalDateTime(
    date
  ) {
    const year =
      date.getFullYear();

    const month =
      pad(date.getMonth() + 1);

    const day =
      pad(date.getDate());

    const hour =
      pad(date.getHours());

    const minute =
      pad(date.getMinutes());

    const second =
      pad(date.getSeconds());

    const offsetMinutes =
      -date.getTimezoneOffset();

    const sign =
      offsetMinutes >= 0
        ? "+"
        : "-";

    const absoluteOffset =
      Math.abs(offsetMinutes);

    const offsetHour =
      pad(
        Math.floor(
          absoluteOffset / 60
        )
      );

    const offsetMinute =
      pad(
        absoluteOffset % 60
      );

    return (
      `${year}-${month}-${day}` +
      `T${hour}:${minute}:${second}` +
      `${sign}${offsetHour}:${offsetMinute}`
    );
  }

  function buildDayRange(
    gameDate
  ) {
    const start =
      new Date(
        gameDate +
        "T00:00:00"
      );

    const end =
      new Date(start);

    end.setDate(
      end.getDate() + 1
    );

    return {
      timeMin:
        formatLocalDateTime(start),

      timeMax:
        formatLocalDateTime(end)
    };
  }

  function buildEventDateTimes(
    gameDate,
    gameTime,
    durationMinutes
  ) {
    const start =
      new Date(
        gameDate +
        "T" +
        gameTime +
        ":00"
      );

    if (
      Number.isNaN(
        start.getTime()
      )
    ) {
      throw new Error(
        "無法解析活動日期或時間"
      );
    }

    const duration =
      Number(
        durationMinutes || 60
      );

    const end =
      new Date(
        start.getTime() +
        duration * 60000
      );

    return {
      start,
      end,

      startDateTime:
        formatLocalDateTime(start),

      endDateTime:
        formatLocalDateTime(end)
    };
  }

  function buildEventResource(
    config
  ) {
    const car =
      config.car || {};

    const durationMinutes =
      Number(
        config.durationMinutes ||
        (
          car.calendar &&
          car.calendar
            .eventDurationMinutes
        ) ||
        getConfig()
          .defaultDurationMinutes ||
        60
      );

    const range =
      buildEventDateTimes(
        car.gameDate,
        car.gameTime,
        durationMinutes
      );

    const activityType =
      car.activityType ||
      getConfig()
        .defaultActivityType ||
      "劇本";

    const activityName =
      car.activityName ||
      car.scriptName ||
      "未命名活動";

    /*
      標題不放時間。
      Google Calendar 本身會顯示時間。
    */
    const title =
      activityType +
      "－" +
      activityName;

    const carUrl =
      config.carUrl || "";

    const studioName =
      car.studioName ||
      car.organizerName ||
      car.organizer ||
      "";

    const locationText =
      car.location ||
      car.locationName ||
      car.address ||
      "";

    const descriptionLines = [
      "🎭 " + activityType,
      "",
      "名稱",
      activityName,

      studioName
        ? ""
        : "",

      studioName
        ? "🏠 主辦"
        : "",

      studioName
        ? studioName
        : "",

      locationText
        ? ""
        : "",

      locationText
        ? "📍 地點"
        : "",

      locationText
        ? locationText
        : "",

      "",
      "────────────",
      "",

      carUrl
        ? "🔗 JLY Host System"
        : "",

      carUrl
        ? carUrl
        : ""
    ].filter(function (line) {
      return line !== null &&
        line !== undefined;
    });

    return {
      summary: title,

      location:
        locationText,

      description:
        descriptionLines.join("\n"),

      start: {
        dateTime:
          range.startDateTime,

        timeZone:
          getConfig().timeZone ||
          "Asia/Taipei"
      },

      end: {
        dateTime:
          range.endDateTime,

        timeZone:
          getConfig().timeZone ||
          "Asia/Taipei"
      },

      extendedProperties: {
        private: {
          source: "JLY",

          village:
            getConfig()
              .sourceVillage ||
            "script",

          sourceModule:
            getConfig()
              .sourceModule ||
            "host",

          carId:
            String(
              config.carId || ""
            ),

          ...(
            String(
              config.actorId || ""
            ).trim()
              ? {
                  jlyActorId:
                    String(
                      config.actorId || ""
                    ).trim()
                }
              : {}
          )
        }
      }
    };
  }

  async function listEventsForDate(
    gameDate
  ) {
    const range =
      buildDayRange(gameDate);

    const calendarId =
      encodeURIComponent(
        getConfig().calendarId ||
        "primary"
      );

    const params =
      new URLSearchParams({
        timeMin:
          range.timeMin,

        timeMax:
          range.timeMax,

        singleEvents:
          "true",

        orderBy:
          "startTime",

        showDeleted:
          "false",

        maxResults:
          "100"
      });

    const result =
      await authorizedFetch(
        `${API_BASE}/calendars/` +
        `${calendarId}/events?` +
        params.toString()
      );

    return Array.isArray(
      result.items
    )
      ? result.items
      : [];
  }


  // Same car-ID-first reconciliation policy as existing MyCar batch sync.
  async function findEventByCarId(carId, gameDate) {
    const id = String(carId || "").trim();
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("JLY 車團 ID 不正確");
    const calendarId = encodeURIComponent(getConfig().calendarId || "primary");
    async function query(params) {
      const response = await authorizedFetch(API_BASE + "/calendars/" + calendarId +
        "/events?" + params.toString());
      if (response.nextPageToken) throw new Error("Google 查詢不完整，已停止避免重複行程");
      return Array.isArray(response.items) ? response.items : [];
    }
    const exact = (await query(new URLSearchParams({
      privateExtendedProperty: "carId=" + id, showDeleted: "false", maxResults: "250"
    }))).filter(event => event && event.status !== "cancelled" &&
      String(event.extendedProperties?.private?.carId || "") === id);
    if (exact.length > 1) throw new Error("Google 有多筆同車團活動，已停止避免覆寫");
    if (exact.length) return exact[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(gameDate || ""))) {
      throw new Error("車團日期不正確，已停止避免重複行程");
    }
    const dayStart = new Date(gameDate + "T00:00:00+08:00");
    if (!Number.isFinite(dayStart.getTime())) throw new Error("車團日期無法解析");
    const day = await query(new URLSearchParams({
      timeMin: dayStart.toISOString(),
      timeMax: new Date(dayStart.getTime() + 86400000).toISOString(),
      singleEvents: "true", showDeleted: "false", maxResults: "250"
    }));
    const linked = day.filter(event => {
      if (!event || event.status === "cancelled") return false;
      const ids = Array.from(String(event.description || "")
        .matchAll(/(?:[?&]id=|JLY Car ID:\s*)([A-Za-z0-9_-]+)/g), match => match[1]);
      return ids.includes(id);
    });
    if (linked.length > 1) throw new Error("Google 有多筆同車團連結，已停止避免覆寫");
    return linked[0] || null;
  }

  async function createEvent(
    config
  ) {
    const calendarId =
      encodeURIComponent(
        config.calendarId ||
        getConfig().calendarId ||
        "primary"
      );

    const resource =
      buildEventResource(config);

    return authorizedFetch(
      `${API_BASE}/calendars/` +
      `${calendarId}/events`,
      {
        method: "POST",

        body:
          JSON.stringify(resource)
      }
    );
  }

  async function updateEvent(
    config
  ) {
    const eventId =
      String(
        config.eventId || ""
      ).trim();

    if (!eventId) {
      throw new Error(
        "找不到 Google Calendar eventId"
      );
    }

    const calendarId =
      encodeURIComponent(
        config.calendarId ||
        getConfig().calendarId ||
        "primary"
      );

    const encodedEventId =
      encodeURIComponent(eventId);

    const resource =
      buildEventResource(config);

    return authorizedFetch(
      `${API_BASE}/calendars/` +
      `${calendarId}/events/` +
      encodedEventId,
      {
        method: "PATCH",

        body:
          JSON.stringify(resource)
      }
    );
  }

  async function deleteEvent(
    config
  ) {
    const eventId =
      String(
        config.eventId || ""
      ).trim();

    if (!eventId) {
      return {
        skipped: true,
        reason: "missing_event_id"
      };
    }

    const calendarId =
      encodeURIComponent(
        config.calendarId ||
        getConfig().calendarId ||
        "primary"
      );

    const encodedEventId =
      encodeURIComponent(eventId);

    await authorizedFetch(
      `${API_BASE}/calendars/` +
      `${calendarId}/events/` +
      encodedEventId,
      {
        method: "DELETE"
      }
    );

    return {
      skipped: false,
      deleted: true
    };
  }

  window
    .JLYCalendarProviderGoogle = {
      listEventsForDate,
      findEventByCarId,
      createEvent,
      updateEvent,
      deleteEvent,
      buildEventResource
    };

  console.log(
    "✅ Google Calendar Provider V2 已載入"
  );
})();