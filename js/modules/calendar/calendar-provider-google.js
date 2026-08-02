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
        options.headers ||
        {}
      );

    headers.set(
      "Authorization",
      "Bearer " + token
    );

    if (
      options.body &&
      !headers.has(
        "Content-Type"
      )
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
        // 保留預設錯誤訊息
      }

      throw new Error(message);
    }

    if (
      response.status === 204
    ) {
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
      pad(
        date.getMonth() + 1
      );

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

    const abs =
      Math.abs(
        offsetMinutes
      );

    const offsetHour =
      pad(
        Math.floor(
          abs / 60
        )
      );

    const offsetMinute =
      pad(abs % 60);

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
        formatLocalDateTime(
          start
        ),

      timeMax:
        formatLocalDateTime(
          end
        )
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
        durationMinutes ||
        60
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
        formatLocalDateTime(
          start
        ),

      endDateTime:
        formatLocalDateTime(
          end
        )
    };
  }

  function formatTimeRange(
    gameDate,
    gameTime,
    durationMinutes
  ) {
    const range =
      buildEventDateTimes(
        gameDate,
        gameTime,
        durationMinutes
      );

    return (
      pad(
        range.start
          .getHours()
      ) +
      ":" +
      pad(
        range.start
          .getMinutes()
      ) +
      "-" +
      pad(
        range.end
          .getHours()
      ) +
      ":" +
      pad(
        range.end
          .getMinutes()
      )
    );
  }

  function applyTitleTemplate(
    template,
    values
  ) {
    return String(
      template ||
      "【時間】 【活動類型】-【活動名稱】"
    )
      .replaceAll(
        "【時間】",
        values.timeRange ||
        ""
      )
      .replaceAll(
        "【開始時間】",
        values.startTime ||
        ""
      )
      .replaceAll(
        "【結束時間】",
        values.endTime ||
        ""
      )
      .replaceAll(
        "【活動類型】",
        values.activityType ||
        ""
      )
      .replaceAll(
        "【活動名稱】",
        values.activityName ||
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function buildEventResource(
    config
  ) {
    const car =
      config.car ||
      {};

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

    const timeRange =
      formatTimeRange(
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

    const title =
      applyTitleTemplate(
        config.titleTemplate ||
        getConfig()
          .defaultTitleTemplate,
        {
          timeRange,

          startTime:
            car.gameTime ||
            "",

          endTime:
            pad(
              range.end
                .getHours()
            ) +
            ":" +
            pad(
              range.end
                .getMinutes()
            ),

          activityType,

          activityName
        }
      );

    const carUrl =
      config.carUrl ||
      "";

    const studioName =
      car.studioName ||
      car.organizerName ||
      car.organizer ||
      "";

    const descriptionLines = [
      "活動類型：" +
        activityType,

      "活動名稱：" +
        activityName,

      studioName
        ? "工作室：" +
          studioName
        : "",

      carUrl
        ? "JLY 車團：" +
          carUrl
        : ""
    ].filter(Boolean);

    return {
      summary: title,

      location:
        car.location ||
        car.locationName ||
        "",

      description:
        descriptionLines.join(
          "\n"
        ),

      start: {
        dateTime:
          range.startDateTime,

        timeZone:
          getConfig()
            .timeZone ||
          "Asia/Taipei"
      },

      end: {
        dateTime:
          range.endDateTime,

        timeZone:
          getConfig()
            .timeZone ||
          "Asia/Taipei"
      },

      extendedProperties: {
        private: {
          source: "JLY",

          village: "script",

          sourceModule:
            "host",

          carId:
            String(
              config.carId ||
              ""
            )
        }
      }
    };
  }

  async function listEventsForDate(
    gameDate
  ) {
    const range =
      buildDayRange(
        gameDate
      );

    const calendarId =
      encodeURIComponent(
        getConfig()
          .calendarId ||
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
        getConfig()
          .calendarId ||
        "primary"
      );

    const resource =
      buildEventResource(
        config
      );

    return authorizedFetch(
      `${API_BASE}/calendars/` +
      `${calendarId}/events`,
      {
        method: "POST",

        body:
          JSON.stringify(
            resource
          )
      }
    );
  }

  window
    .JLYCalendarProviderGoogle = {
      listEventsForDate,
      createEvent,
      buildEventResource,
      formatTimeRange
    };
})();