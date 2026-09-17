console.log("recruit-role-split.js 已成功載入！");

(function () {
  "use strict";

  const tabs = window.JLYRecruitTabs;

  if (!tabs || typeof tabs.setCarGroups !== "function") {
    return;
  }

  const setCarGroups = tabs.setCarGroups.bind(tabs);

  function isPlayerRole(car) {
    return String(car && car.myRole || "").trim().toLowerCase() === "player";
  }

  tabs.setCarGroups = function (groups) {
    const source = groups && typeof groups === "object" ? groups : {};
    const originalHost = Array.isArray(source.host) ? source.host : [];
    const explicitPlayerCars = originalHost.filter(isPlayerRole);
    const originalAssist = Array.isArray(source.assist) ? source.assist : [];

    const assistById = new Map();
    [originalAssist, explicitPlayerCars].forEach(function (cars) {
      cars.forEach(function (car) {
        if (car && car.id) assistById.set(car.id, car);
      });
    });

    const assist = Array.from(assistById.values());
    const assistIds = new Set(assistById.keys());
    const host = originalHost.filter(function (car) {
      return car && !assistIds.has(car.id) && !isPlayerRole(car);
    });

    return setCarGroups({
      ...source,
      host: host,
      assist: assist
    });
  };
})();
