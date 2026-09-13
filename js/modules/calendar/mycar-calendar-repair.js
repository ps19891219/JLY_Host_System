(function () {
  "use strict";

  const batch = document.createElement("script");
  batch.src = "/js/mycar-batch-selection-scope.js?v=1";
  batch.async = false;
  batch.onload = function () {
    const entry = document.createElement("script");
    entry.src = "/js/modules/calendar/mycar/entry.js?v=2";
    entry.async = false;
    document.head.appendChild(entry);
  };
  document.head.appendChild(batch);
})();
