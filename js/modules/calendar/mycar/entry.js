(function () {
  "use strict";
  if (window.__JLYMyCarCalendarEntryLoading) return;
  window.__JLYMyCarCalendarEntryLoading = true;

  function load(src) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  // MyCar 身分／角色修復由 pages/mycar.html 單一路徑載入。
  // 這裡只保留 Calendar lifecycle，避免同一 repair script 被執行兩次，
  // 造成頁面看起來像重新整理第二遍，或不同 repair 互相覆寫 Prepared View。
  load("/js/modules/calendar/mycar/lifecycle-sync.js?v=1");
  load("/js/modules/calendar/mycar/player-personal-sync.js?v=1");
})();
