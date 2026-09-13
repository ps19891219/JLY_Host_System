(function () {
  "use strict";

  // Compatibility bridge only. MyCar Calendar now lives under
  // /js/modules/calendar/mycar/ and must not leak back into shared Calendar Core.
  const script = document.createElement("script");
  script.src = "/js/modules/calendar/mycar/entry.js?v=1";
  script.async = false;
  document.head.appendChild(script);
})();
