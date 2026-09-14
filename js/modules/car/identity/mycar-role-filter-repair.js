(function () {
  "use strict";

  function install() {
    if (typeof window.renderMyCars !== "function") return;

    window.buildCurrentCarFilter = function () {
      return function (car) {
        if (currentTab === "planning") return isCarPlanning(car);

        if (currentTab === "active") {
          if (isCarEnded(car) || isCarPlanning(car)) return false;
          if (currentActiveRoleTab === "host") return isMyHostCar(car);
          if (currentActiveRoleTab === "player") return isMyPlayerCar(car);
        }

        if (currentTab === "done") return isCarEnded(car);
        return true;
      };
    };

    console.log("✅ MyCar host/player filter repair 已套用");
  }

  install();
})();
