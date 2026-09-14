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

  // MyCar identity behavior lives under car/identity. This entry only
  // attaches the page-specific runtime because MyCar already loads here.
  load("/js/modules/car/identity/mycar-identity-runtime.js?v=1");
  load("/js/modules/calendar/mycar/lifecycle-sync.js?v=1");
})();
