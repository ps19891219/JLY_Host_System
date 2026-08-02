(function () {
  "use strict";

  function formatGoogleEventTime(
    event
  ) {
    const startValue =
      event.start &&
      (
        event.start.dateTime ||
        event.start.date
      );

    const endValue =
      event.end &&
      (
        event.end.dateTime ||
        event.end.date
      );

    if (!startValue) {
      return "時間未提供";
    }

    if (
      event.start.date &&
      !event.start.dateTime
    ) {
      return "全天";
    }

    const start =
      new Date(
        startValue
      );

    const end =
      endValue
        ? new Date(
            endValue
          )
        : null;

    const formatter =
      new Intl.DateTimeFormat(
        "zh-TW",
        {
          hour: "2-digit",

          minute:
            "2-digit",

          hour12: false
        }
      );

    if (
      !end ||
      Number.isNaN(
        end.getTime()
      )
    ) {
      return formatter
        .format(start);
    }

    return (
      formatter
        .format(start) +
      "-" +
      formatter
        .format(end)
    );
  }

  function buildMessage(
    config
  ) {
    const jlyCars =
      Array.isArray(
        config.jlyCars
      )
        ? config.jlyCars
        : [];

    const googleEvents =
      Array.isArray(
        config.googleEvents
      )
        ? config.googleEvents
        : [];

    const lines = [
      "⚠️ 當天已有其他行程",
      ""
    ];

    if (
      jlyCars.length > 0
    ) {
      lines.push(
        "JLY 車團"
      );

      jlyCars.forEach(
        function (car) {
          lines.push(
            "🎭 " +
            (
              car.scriptName ||
              "未命名劇本"
            ) +
            "｜" +
            (
              car.gameTime ||
              "時間未填"
            )
          );
        }
      );

      lines.push("");
    }

    if (
      googleEvents.length >
      0
    ) {
      lines.push(
        "Google Calendar"
      );

      googleEvents.forEach(
        function (event) {
          lines.push(
            "📌 " +
            (
              event.summary ||
              "未命名活動"
            ) +
            "｜" +
            formatGoogleEventTime(
              event
            )
          );
        }
      );

      lines.push("");
    }

    lines.push(
      "仍要建立這台新車嗎？"
    );

    return lines.join(
      "\n"
    );
  }

  async function checkBeforeCreate(
    config
  ) {
    const jlyCars =
      Array.isArray(
        config.jlyCars
      )
        ? config.jlyCars
        : [];

    let googleEvents = [];

    let googleCheckError =
      null;

    if (
      config.checkGoogle ===
      true
    ) {
      try {
        googleEvents =
          await window
            .JLYCalendarProviderGoogle
            .listEventsForDate(
              config.gameDate
            );
      } catch (error) {
        googleCheckError =
          error;
      }
    }

    if (googleCheckError) {
      const proceedWithoutGoogle =
        confirm(
          "⚠️ 無法確認 Google Calendar 當天行程。\n\n" +
          (
            googleCheckError
              .message ||
            "未知錯誤"
          ) +
          "\n\n是否仍要繼續建立？"
        );

      if (
        !proceedWithoutGoogle
      ) {
        return {
          proceed: false,

          googleEvents: [],

          googleCheckError
        };
      }
    }

    if (
      jlyCars.length === 0 &&
      googleEvents.length ===
        0
    ) {
      return {
        proceed: true,

        googleEvents,

        googleCheckError
      };
    }

    return {
      proceed:
        confirm(
          buildMessage({
            jlyCars,
            googleEvents
          })
        ),

      googleEvents,

      googleCheckError
    };
  }

  window
    .JLYCalendarScheduleCheck = {
      checkBeforeCreate,
      buildMessage
    };
})();