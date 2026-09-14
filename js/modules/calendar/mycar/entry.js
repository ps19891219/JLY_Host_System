(function () {
  "use strict";
  if (window.__JLYMyCarCalendarEntryLoading) return;
  window.__JLYMyCarCalendarEntryLoading = true;
  const script = document.createElement("script");
  script.src = "/js/modules/calendar/mycar/lifecycle-sync.js?v=1";
  script.async = false;
  document.head.appendChild(script);
})();
