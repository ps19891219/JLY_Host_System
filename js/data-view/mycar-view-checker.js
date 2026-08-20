console.log("mycar-view-checker.js 已成功載入！");

(function () {
  "use strict";

  async function checkCurrentUser() {
    if (
      !window
        .JLYMyCarViewBootstrap ||
      !window.JLYMyCarView
    ) {
      throw new Error(
        "MyCar View Checker 依賴尚未載入"
      );
    }

    const identity =
      window
        .JLYMyCarViewBootstrap
        .getViewerIdentity();

    const view =
      await window
        .JLYMyCarView
        .read(
          identity.viewerId
        );

    if (!view) {
      return {
        ok: false,
        reason:
          "view_not_found"
      };
    }

    /*
      Checker 是人工診斷工具。
      明確執行時才讀 Core。
      正常 UI 絕對不會呼叫它。
    */
    const [
      hostCars,
      playerCars
    ] =
      await Promise.all([
        window
          .JLYMyCarViewBootstrap
          .queryHostCars(
            identity.viewerId
          ),

        window
          .JLYMyCarViewBootstrap
          .queryPlayerCars(
            identity.identityIds
          )
      ]);

    const coreIds =
      new Set(
        [
          ...hostCars,
          ...playerCars
        ].map(
          car =>
            String(
              car.id ||
              ""
            ).trim()
        )
      );

    const viewIds =
      new Set(
        (
          Array.isArray(
            view.cars
          )
            ? view.cars
            : []
        ).map(
          car =>
            String(
              car.id ||
              ""
            ).trim()
        )
      );

    const missingInView =
      Array.from(coreIds)
        .filter(
          id =>
            !viewIds.has(id)
        );

    const staleInView =
      Array.from(viewIds)
        .filter(
          id =>
            !coreIds.has(id)
        );

    const result = {
      ok:
        missingInView.length === 0 &&
        staleInView.length === 0,

      coreCount:
        coreIds.size,

      viewCount:
        viewIds.size,

      missingInView,
      staleInView
    };

    console.log(
      "🔎 MyCar View Consistency",
      result
    );

    return result;
  }

  window.JLYMyCarViewChecker = {
    checkCurrentUser
  };
})();