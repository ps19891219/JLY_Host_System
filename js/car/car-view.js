console.log(
  "car-view.js 已成功載入！"
);

(function () {
  "use strict";

  // ==========================================================
  // 玩家查看頁即時資料控制
  // ==========================================================

  let unsubscribeCarSnapshot =
    null;

  let firebaseWaitTimer =
    null;

  // ==========================================================
  // 基本工具
  // ==========================================================

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function getContainer() {
    return document.getElementById(
      "car-view-content"
    );
  }

  function getRenderModule() {
    return window.JLYCarViewRender;
  }

  function stopFirebaseWaitTimer() {
    if (!firebaseWaitTimer) {
      return;
    }

    clearInterval(
      firebaseWaitTimer
    );

    firebaseWaitTimer =
      null;
  }

  function stopCarListener() {
    if (
      typeof unsubscribeCarSnapshot ===
      "function"
    ) {
      unsubscribeCarSnapshot();
    }

    unsubscribeCarSnapshot =
      null;
  }

  // ==========================================================
  // 錯誤訊息
  // ==========================================================

  function showMissingRenderError() {
    console.error(
      "找不到 JLYCarViewRender"
    );
  }

  function showMissingCarId(
    container
  ) {
    const renderModule =
      getRenderModule();

    renderModule.renderError(
      container,
      "缺少車團 ID"
    );
  }

  function showFirebaseError(
    container
  ) {
    const renderModule =
      getRenderModule();

    renderModule.renderError(
      container,
      "Firebase 尚未載入，請重新整理頁面"
    );
  }

  // ==========================================================
  // 即時顯示單一車團
  // ==========================================================

  async function subscribeCar(
    carId,
    container
  ) {
    const renderModule =
      getRenderModule();

    stopCarListener();

    renderModule.renderLoading(
      container
    );

    try {
      const response = await fetch(
        "/api/car-view-context?id=" + encodeURIComponent(carId),
        { credentials: "same-origin", cache: "no-store" }
      );
      const result = await response.json();
      if (response.status === 404) return renderModule.renderNotFound(container);
      if (!response.ok || !result.success) throw new Error(result.error || "讀取車團資料失敗");
      const car = { ...result.car, id: result.car.id || carId, viewAccess: result.access };
      window.currentPublicCarData = car;
      renderModule.renderCarView(container, car, carId);
      console.log("玩家頁已載入車團資料：", carId, result.access);
    } catch (error) {
      console.error("玩家頁讀取失敗：", error);
      renderModule.renderError(container, error && error.message ? error.message : "讀取車團資料失敗");
    }
  }

  // ==========================================================
  // 等待 Firebase 載入
  // ==========================================================

  function waitForFirebase(
    carId,
    container
  ) {
    let waitCount =
      0;

    const maxWaitCount =
      50;

    stopFirebaseWaitTimer();

    firebaseWaitTimer =
      setInterval(
        function () {
          waitCount += 1;

          if (window.db) {
            stopFirebaseWaitTimer();

            subscribeCar(
              carId,
              container
            );

            return;
          }

          if (
            waitCount >=
            maxWaitCount
          ) {
            stopFirebaseWaitTimer();

            showFirebaseError(
              container
            );
          }
        },
        200
      );
  }

  // ==========================================================
  // 初始化玩家查看頁
  // ==========================================================

  function initCarView() {
    const container =
      getContainer();

    const renderModule =
      getRenderModule();

    if (!container) {
      console.error(
        "找不到玩家查看頁容器 car-view-content"
      );

      return;
    }

    if (!renderModule) {
      showMissingRenderError();

      return;
    }

    const carId =
      getCarId();

    if (!carId) {
      showMissingCarId(
        container
      );

      return;
    }

    renderModule.renderLoading(
      container
    );

    subscribeCar(
      carId,
      container
    );
  }

  // ==========================================================
  // 離開頁面時關閉監聽
  // ==========================================================

  function cleanupCarView() {
    stopFirebaseWaitTimer();
    stopCarListener();
  }

  document.addEventListener(
    "DOMContentLoaded",
    initCarView
  );

  window.addEventListener(
    "pagehide",
    cleanupCarView
  );

  window.addEventListener(
    "beforeunload",
    cleanupCarView
  );

  window.JLYCarViewController = {
    init:
      initCarView,

    subscribe:
      subscribeCar,

    cleanup:
      cleanupCarView
  };
})();
