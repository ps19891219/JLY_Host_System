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

  // 先修正「開團中」的 host/player 篩選分支。
  load("/js/modules/car/identity/mycar-role-filter-repair.js?v=1");

  // 回到已驗證的 MyCar 身分讀取語意，並補回歷史 Membership / Owner。
  // Repair 只重建 Prepared View，不改寫 Core car ownership / membership。
  load("/js/modules/car/identity/mycar-legacy-identity-repair.js?v=3");

  // Prepared View 建好後，再用 Core car 的完整 owner/player identity fields
  // 修正主揪/玩家角色投影，讓篩選與綠/藍燈使用同一份判定。
  load("/js/modules/car/identity/mycar-role-projection-repair.js?v=1");

  load("/js/modules/calendar/mycar/lifecycle-sync.js?v=1");
})();
