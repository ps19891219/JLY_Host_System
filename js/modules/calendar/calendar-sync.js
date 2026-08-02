(function () {
  "use strict";

  function nowIso() {
    return new Date()
      .toISOString();
  }

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
            syncEnabled: true,
            syncStatus: "syncing",
            lastError: ""
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
              config.durationMinutes,

            calendarId:
              config.calendarId
          });

      const calendar =
        await window
          .JLYCalendarData
          .updateCarCalendar(
            carId,
            {
              syncEnabled: true,

              calendarId:
                config.calendarId ||
                "primary",

              eventId:
                event.id || "",

              eventUrl:
                event.htmlLink || "",

              eventDurationMinutes:
                Number(
                  config.durationMinutes ||
                  60
                ),

              syncStatus:
                "synced",

              lastSyncAt:
                nowIso(),

              lastError: ""
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
              syncEnabled: true,
              syncStatus: "failed",
              lastSyncAt: nowIso(),

              lastError:
                error.message ||
                "未知錯誤"
            }
          );
      } catch (writeError) {
        console.error(
          "寫回同步錯誤失敗：",
          writeError
        );
      }

      return {
        ok: false,
        error
      };
    }
  }

  async function syncUpdatedCar(
    config
  ) {
    const carId =
      config.carId;

    const car =
      config.car || {};

    const calendar =
      car.calendar || {};

    if (
      calendar.syncEnabled !== true ||
      !calendar.eventId
    ) {
      return {
        ok: true,
        skipped: true,
        reason: "not_synced"
      };
    }

    try {
      await window
        .JLYCalendarData
        .updateCarCalendar(
          carId,
          {
            syncStatus: "syncing",
            lastError: ""
          }
        );

      const event =
        await window
          .JLYCalendarProviderGoogle
          .updateEvent({
            carId,
            car,

            eventId:
              calendar.eventId,

            calendarId:
              calendar.calendarId ||
              "primary",

            durationMinutes:
              calendar
                .eventDurationMinutes ||
              60,

            carUrl:
              config.carUrl
          });

      const nextCalendar =
        await window
          .JLYCalendarData
          .updateCarCalendar(
            carId,
            {
              syncEnabled: true,

              eventId:
                event.id ||
                calendar.eventId,

              eventUrl:
                event.htmlLink ||
                calendar.eventUrl ||
                "",

              syncStatus:
                "synced",

              lastSyncAt:
                nowIso(),

              lastError: ""
            }
          );

      return {
        ok: true,
        skipped: false,
        event,
        calendar:
          nextCalendar
      };
    } catch (error) {
      console.error(
        "Google Calendar 更新失敗：",
        error
      );

      try {
        await window
          .JLYCalendarData
          .updateCarCalendar(
            carId,
            {
              syncStatus: "failed",
              lastSyncAt: nowIso(),

              lastError:
                error.message ||
                "未知錯誤"
            }
          );
      } catch (writeError) {
        console.error(
          "寫回更新錯誤失敗：",
          writeError
        );
      }

      return {
        ok: false,
        skipped: false,
        error
      };
    }
  }

  async function removeSyncedEvent(
    config
  ) {
    const car =
      config.car || {};

    const calendar =
      car.calendar || {};

    if (!calendar.eventId) {
      return {
        ok: true,
        skipped: true,
        reason: "missing_event_id"
      };
    }

    try {
      await window
        .JLYCalendarProviderGoogle
        .deleteEvent({
          eventId:
            calendar.eventId,

          calendarId:
            calendar.calendarId ||
            "primary"
        });

      return {
        ok: true,
        skipped: false
      };
    } catch (error) {
      console.error(
        "Google Calendar 刪除失敗：",
        error
      );

      return {
        ok: false,
        skipped: false,
        error
      };
    }
  }

  window.JLYCalendarSync = {
    syncCreatedCar,
    syncUpdatedCar,
    removeSyncedEvent
  };

  console.log(
    "✅ Calendar Sync V2 已載入"
  );
})();