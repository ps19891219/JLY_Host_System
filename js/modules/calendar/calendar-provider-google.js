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
      createEvent,
      updateEvent,
      deleteEvent,
      buildEventResource
    };

  console.log(
    "✅ Google Calendar Provider V2 已載入"
  );
})();