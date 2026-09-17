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

    /*
      Keep the same precedence as the canonical Car Role contract:
      explicit myRole wins over persisted compatibility flags.
      A historical/stale isPlayer=true must not turn myRole=host into player.
    */
    if (role === "host") return false;
    if (role === "player") return true;
    if (role === "favorite") return false;

    return car.isPlayer === true && car.isHost !== true;
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