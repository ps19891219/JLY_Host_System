(function () {
  "use strict";

  const marker = "__JLYMyCarCalendarEntryLoading";
  if (window[marker]) return;
  window[marker] = true;

  function load(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("無法載入 MyCar Calendar 模組：" + src));
      };
      document.head.appendChild(script);
    });
  }

  load("/js/modules/calendar/mycar/persist-guard.js?v=1")
    .then(function () {
      return load("/js/modules/calendar/mycar/source-guard.js?v=1");
    })
    .then(function () {
      return load("/js/modules/calendar/mycar/sync.js?v=1");
    })
    .catch(function (error) {
      console.error("MyCar Calendar 模組載入失敗：", error);
    });
})();
