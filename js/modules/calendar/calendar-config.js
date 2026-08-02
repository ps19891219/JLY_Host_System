(function () {
  "use strict";

  /*
  ========================================
  JLY Host System

  Calendar Sync V1
  calendar-config.js

  Version: 1.0.1
  ========================================
  */

  window.JLYCalendarConfig = {
    /*
      Google OAuth Web Client ID
    */
    googleClientId:
      "600556274479-ebr6ecfvertv6omjj6a27q3e888du8sg.apps.googleusercontent.com",

    /*
      Calendar API 授權範圍

      calendar.events 可：
      - 查詢活動
      - 建立活動
      - 更新活動
      - 取消或刪除活動
    */
    scopes:
      "https://www.googleapis.com/auth/calendar.events",

    /*
      預設同步到使用者的主要行事曆
    */
    calendarId:
      "primary",

    /*
      JLY 目前使用台灣時區
    */
    timeZone:
      "Asia/Taipei",

    /*
      沒有劇本建議時長、
      使用者也沒有手動修改時，
      預設建立 1 小時的事件。
    */
    defaultDurationMinutes:
      60,

    /*
      Calendar 活動類型
      目前劇本村固定為「劇本」。
    */
    defaultActivityType:
      "劇本",

    /*
      Google Calendar 標題格式

      範例：
      19:00-20:00 劇本-逃出迷霧鎮
    */
    defaultTitleTemplate:
      "【活動類型】－【活動名稱】",

    /*
      建立車團前是否預設檢查
      Google Calendar 當日行程。
    */
    defaultScheduleCheckEnabled:
      true,

    /*
      建立新車時是否預設勾選同步。

      目前依照我們的定案：
      預設關閉，由使用者自行勾選。
    */
    defaultSyncEnabled:
      false,

    /*
      未來跨村共用 Calendar Core 時使用。
      現階段先代表劇本村。
    */
    sourceVillage:
      "script",

    sourceModule:
      "host"
  };

  console.log(
    "✅ JLY Calendar Config V1.0.1 已載入",
    {
      calendarId:
        window.JLYCalendarConfig
          .calendarId,

      timeZone:
        window.JLYCalendarConfig
          .timeZone,

      defaultDurationMinutes:
        window.JLYCalendarConfig
          .defaultDurationMinutes,

      defaultActivityType:
        window.JLYCalendarConfig
          .defaultActivityType,

      defaultScheduleCheckEnabled:
        window.JLYCalendarConfig
          .defaultScheduleCheckEnabled,

      defaultSyncEnabled:
        window.JLYCalendarConfig
          .defaultSyncEnabled
    }
  );
})();