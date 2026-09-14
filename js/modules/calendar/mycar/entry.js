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

  // 回到 2026-08-09 已驗證的 MyCar 身分讀取語意：
  // 使用既有 Car Data 對 current/profile/linked identities 做正式查找，
  // 只重建 Prepared View，不在進頁時改寫 Core car.ownerId。
  load("/js/modules/car/identity/mycar-legacy-identity-repair.js?v=1");
  load("/js/modules/calendar/mycar/lifecycle-sync.js?v=1");
})();
