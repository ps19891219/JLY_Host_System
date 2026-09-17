console.log("recruit-role-split.js 已成功載入！");

(function () {
  "use strict";

  const tabs = window.JLYRecruitTabs;

  if (!tabs || typeof tabs.setCarGroups !== "function") {
    return;
  }

  const setCarGroups = tabs.setCarGroups.bind(tabs);

  tabs.setCarGroups = function (groups) {
    const source = groups && typeof groups === "object" ? groups : {};
    const assist = Array.isArray(source.assist) ? source.assist : [];
    const assistIds = new Set(
      assist.map(function (car) {
        return car && car.id;
      }).filter(Boolean)
    );

    const host = (Array.isArray(source.host) ? source.host : []).filter(
      function (car) {
        return car && !assistIds.has(car.id);
      }
    );

    return setCarGroups({
      ...source,
      host: host,
      assist: assist
    });
  };
})();
