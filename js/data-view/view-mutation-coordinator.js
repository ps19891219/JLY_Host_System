console.log("view-mutation-coordinator.js 已成功載入！");

(function () {
  "use strict";

  async function updateCarViews(options) {
    const settings = options || {};
    const beforeCar = settings.beforeCar || null;
    const afterCar = settings.afterCar || null;
    const changedFields = Array.isArray(settings.changedFields)
      ? settings.changedFields
      : [];

    const resolver = window.JLYViewImpactResolver;
    const affected = resolver
      ? resolver.resolveCarViews(changedFields)
      : ["car_detail"];

    const results = [];

    if (
      affected.includes("car_detail") &&
      afterCar &&
      window.JLYCloudCarView &&
      typeof window.JLYCloudCarView.writeFromCar === "function"
    ) {
      try {
        await window.JLYCloudCarView.writeFromCar(afterCar);
        results.push({ type: "car_detail", ok: true });
      } catch (error) {
        results.push({ type: "car_detail", ok: false, error });
      }
    }

    if (
      affected.includes("mycar") &&
      window.JLYMyCarView &&
      typeof window.JLYMyCarView.applyCarMutation === "function"
    ) {
      try {
        await window.JLYMyCarView.applyCarMutation(
          beforeCar,
          afterCar
        );
        results.push({ type: "mycar", ok: true });
      } catch (error) {
        results.push({ type: "mycar", ok: false, error });
      }
    }

    /*
      Home View 目前只保留接口。
      首頁正式 sections 尚未定案，因此不在這裡猜資料。
    */
    if (affected.includes("home")) {
      results.push({
        type: "home",
        ok: true,
        deferred: true
      });
    }

    return results;
  }

  async function updateAccountingViews(options) {
    const settings = options || {};
    const resolver = window.JLYViewImpactResolver;
    const affected = resolver
      ? resolver.resolveAccountingViews(settings.eventType)
      : ["activity_accounting"];

    /*
      Accounting 既有 repository 已經在 mutation transaction
      內維護正式 accountingViews。
      這裡只做共同 affected-view 紀錄，不再重掃 entries。
    */
    return affected.map(type => ({
      type,
      ok: true,
      delegated: type === "activity_accounting"
    }));
  }

  window.JLYViewMutationCoordinator = {
    updateCarViews,
    updateAccountingViews
  };
})();