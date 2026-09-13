(function () {
  "use strict";

  const marker = "__JLYMyCarCalendarEntryLoading";
  if (window[marker]) return;
  window[marker] = true;

  const script = document.createElement("script");
  script.src = "/js/modules/calendar/mycar/sync.js?v=2";
  script.async = false;
  document.head.appendChild(script);
})();
