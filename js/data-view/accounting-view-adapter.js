console.log("accounting-view-adapter.js 已成功載入！");

(function () {
  "use strict";

  /*
    Accounting 已有正式 View：
    cars/{carId}/accountingViews/main
    cars/{carId}/accountingViews/admin

    這支不複製 Accounting Core，
    只把既有 View 接到 JLY Cloud View Core。
  */

  function getRepository() {
    return (
      window.JLYCarAccountingRepository ||
      window.CarAccountingRepository ||
      null
    );
  }

  async function read(context) {
    const settings = context || {};
    const carId = String(settings.carId || "").trim();

    if (!carId) {
      throw new Error("accounting_view_car_required");
    }

    const repo = getRepository();

    if (
      !repo ||
      typeof repo.getCarAccountingView !== "function"
    ) {
      throw new Error(
        "accounting_repository_not_ready"
      );
    }

    return repo.getCarAccountingView(carId);
  }

  const api = {
    viewType: "activity_accounting",
    read
  };

  window.JLYAccountingViewAdapter = api;

  if (window.JLYViewCore) {
    window.JLYViewCore.registerViewType(
      "activity_accounting",
      api
    );
  }
})();