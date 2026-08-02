(function () {
  "use strict";

  const SETTINGS_KEY =
    "jlyCalendarSettingsV1";

  function getSettings() {
    const defaults = {
      calendarSyncEnabled:
        false,

      calendarAutoCreateEnabled:
        false,

      scheduleCheckEnabled:
        true,

      defaultDurationMinutes:
        60,

      calendarId:
        "primary",

      titleTemplate:
        "【活動類型】－【活動名稱】"
    };

    try {
      const raw =
        localStorage.getItem(
          SETTINGS_KEY
        );

      if (!raw) {
        return defaults;
      }

      return {
        ...defaults,
        ...JSON.parse(raw)
      };
    } catch (error) {
      console.warn(
        "讀取 Calendar 設定失敗：",
        error
      );

      return defaults;
    }
  }

  function saveSettings(
    patch
  ) {
    const next = {
      ...getSettings(),
      ...patch
    };

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(next)
    );

    return next;
  }

  function applyCreatePageDefaults() {
    const settings =
      getSettings();

    const syncInput =
      document.getElementById(
        "calendarSyncEnabled"
      );

    const checkInput =
      document.getElementById(
        "calendarScheduleCheckEnabled"
      );

    const durationInput =
      document.getElementById(
        "calendarDurationMinutes"
      );

    if (syncInput) {
      syncInput.checked =
        settings
          .calendarAutoCreateEnabled ===
        true;
    }

    if (checkInput) {
      checkInput.checked =
        settings
          .scheduleCheckEnabled !==
        false;
    }

    if (durationInput) {
      durationInput.value =
        String(
          settings
            .defaultDurationMinutes ||
          60
        );
    }
  }

  async function checkBeforeCreate(
    config
  ) {
    return window
      .JLYCalendarScheduleCheck
      .checkBeforeCreate(
        config
      );
  }

  async function syncCreatedCar(
    config
  ) {
    return window
      .JLYCalendarSync
      .syncCreatedCar(
        config
      );
  }

  window.JLYCalendarController = {
    getSettings,
    saveSettings,
    applyCreatePageDefaults,
    checkBeforeCreate,
    syncCreatedCar
  };

  document.addEventListener(
    "DOMContentLoaded",
    applyCreatePageDefaults
  );
})();