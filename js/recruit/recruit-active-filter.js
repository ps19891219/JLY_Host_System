console.log("recruit-active-filter.js 已成功載入！");

(function () {
  "use strict";

  const render = window.JLYRecruitRender;

  if (!render || typeof render.getStatus !== "function") {
    return;
  }

  const getStatus = render.getStatus.bind(render);

  function isPastCar(car) {
    const date = String(car && (car.gameDate || car.date) || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const time = String(car && (car.gameTime || car.time) || "").trim();
    const value = new Date(date + "T" + (/^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "23:59"));

    return !Number.isNaN(value.getTime()) && value.getTime() < Date.now();
  }

  render.getStatus = function (car) {
    if (isPastCar(car)) return "已結束";
    return getStatus(car);
  };
})();
