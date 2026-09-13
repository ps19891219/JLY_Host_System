(function () {
  "use strict";

  function nowIso() {
    return new Date().toISOString();
  }

  function buildDefaultCalendarData(options = {}) {
    return {
      provider: "google",
      syncEnabled: options.syncEnabled === true,
      calendarId: options.calendarId || "primary",
      eventId: "",
      eventUrl: "",
      eventDurationMinutes: Number(options.eventDurationMinutes || 60),
      syncStatus: "not_synced",
      lastSyncAt: "",
      lastError: ""
    };
  }

  async function updateCarCalendar(carId, calendarPatch) {
    const db = window.db;
    if (!db) throw new Error("Firebase 尚未載入");
    if (!carId) throw new Error("找不到車團 ID");

    const carRef = db.collection("cars").doc(carId);
    const snapshot = await carRef.get();
    if (!snapshot.exists) throw new Error("找不到車團資料");

    const current = snapshot.data().calendar || {};
    const next = {
      ...buildDefaultCalendarData(),
      ...current,
      ...calendarPatch
    };

    await carRef.update({
      calendar: next,
      updatedAt: nowIso()
    });

    return next;
  }

  window.JLYCalendarData = {
    buildDefaultCalendarData,
    updateCarCalendar
  };

  if (
    typeof window !== "undefined" &&
    /\/pages\/mycar\.html$/.test(window.location.pathname)
  ) {
    const selectionScopeScript = document.createElement("script");
    selectionScopeScript.src = "/js/mycar-batch-selection-scope.js?v=1";
    selectionScopeScript.async = false;
    document.head.appendChild(selectionScopeScript);

    const script = document.createElement("script");
    script.src = "/js/modules/calendar/mycar-calendar-clean-sync.js?v=1";
    script.async = false;
    document.head.appendChild(script);
  }
})();