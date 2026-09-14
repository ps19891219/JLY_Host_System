(function () {
  "use strict";
  if (window.__JLYMyCarCalendarEntryLoading) return;
  window.__JLYMyCarCalendarEntryLoading = true;
  const script = document.createElement("script");
  script.src = "/js/modules/calendar/mycar/sync.js?v=3";
  script.async = false;
  document.head.appendChild(script);
})();
