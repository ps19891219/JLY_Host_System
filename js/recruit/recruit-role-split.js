console.log("recruit-role-split.js 已成功載入！");

(function () {
  "use strict";

  const tabs = window.JLYRecruitTabs;

  if (!tabs || typeof tabs.setCarGroups !== "function") {
    return;
  }

  const setCarGroups = tabs.setCarGroups.bind(tabs);

  function isPlayerRole(car) {
    if (!car) return false;

    const role = String(car.myRole || "").trim().toLowerCase();

    /* Canonical Car Role precedence: explicit myRole wins. */
    if (role === "host") return false;
    if (role === "player") return true;
    if (role === "favorite") return false;

    return car.isPlayer === true && car.isHost !== true;
  }

  tabs.setCarGroups = function (groups) {
    const source = groups && typeof groups === "object" ? groups : {};
    const originalHost = Array.isArray(source.host) ? source.host : [];
    const originalAssist = Array.isArray(source.assist) ? source.assist : [];
    const explicitPlayerCars = originalHost.filter(isPlayerRole);
    const explicitPlayerIds = new Set(
      explicitPlayerCars.map(function (car) { return car && car.id; }).filter(Boolean)
    );

    /*
      The MyCar-backed host group is the canonical participant-role projection.
      assistRecruiting is only an auxiliary recruiting permission/relation and
      must not demote a canonical host car. Only an explicit player role may
      move a host candidate to the non-host/assist tab.
    */
    const canonicalHostIds = new Set(
      originalHost
        .filter(function (car) { return car && car.id && !explicitPlayerIds.has(car.id); })
        .map(function (car) { return car.id; })
    );

    const assistById = new Map();
    originalAssist.forEach(function (car) {
      if (car && car.id && !canonicalHostIds.has(car.id)) {
        assistById.set(car.id, car);
      }
    });
    explicitPlayerCars.forEach(function (car) {
      if (car && car.id) assistById.set(car.id, car);
    });

    const assist = Array.from(assistById.values());
    const host = originalHost.filter(function (car) {
      return car && car.id && canonicalHostIds.has(car.id);
    });

    return setCarGroups({
      ...source,
      host: host,
      assist: assist
    });
  };
})();