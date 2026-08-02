(function () {
  "use strict";

  async function syncCreatedCar(
    config
  ) {
    const carId =
      config.carId;

    const car =
      config.car;

    try {
      await window
        .JLYCalendarData
        .updateCarCalendar(
          carId,
          {
            syncEnabled:
              true,

            syncStatus:
              "syncing",

            lastError:
              ""
          }
        );

      const event =
        await window
          .JLYCalendarProviderGoogle
          .createEvent({
            carId,

            car,

            carUrl:
              config.carUrl,

            durationMinutes:
              config
                .durationMinutes,

            titleTemplate:
              config
                .titleTemplate,

            calendarId:
              config.calendarId
          });

      const calendar =
        await window
          .JLYCalendarData
          .updateCarCalendar(
            carId,
            {
              syncEnabled:
                true,

              calendarId:
                config.calendarId ||
                "primary",

              eventId:
                event.id ||
                "",

              eventUrl:
                event.htmlLink ||
                "",

              eventDurationMinutes:
                Number(
                  config
                    .durationMinutes ||
                  60
                ),

              syncStatus:
                "synced",

              lastSyncAt:
                new Date()
                  .toISOString(),

              lastError:
                ""
            }
          );

      return {
        ok: true,

        event,

        calendar
      };
    } catch (error) {
      console.error(
        "Google Calendar 建立事件失敗：",
        error
      );

      try {
        await window
          .JLYCalendarData
          .updateCarCalendar(
            carId,
            {
              syncEnabled:
                true,

              syncStatus:
                "failed",

              lastSyncAt:
                new Date()
                  .toISOString(),

              lastError:
                error.message ||
                "未知錯誤"
            }
          );
      } catch (writeError) {
        console.error(
          "寫回 Calendar 同步錯誤失敗：",
          writeError
        );
      }

      return {
        ok: false,

        error
      };
    }
  }

  window.JLYCalendarSync = {
    syncCreatedCar
  };
})();