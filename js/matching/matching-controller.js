(function () {
  "use strict";

  let unsubscribeMatchingCar =
    null;

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function renderControllerError(
    error
  ) {
    console.error(
      "媒合頁即時讀取失敗：",
      error
    );

    if (
      window.JLYMatchingRender &&
      typeof window
        .JLYMatchingRender
        .renderError ===
        "function"
    ) {
      window
        .JLYMatchingRender
        .renderError(error);
    }
  }

  function handleCarSnapshot(
    snapshot
  ) {
    if (!snapshot.exists) {
      renderControllerError(
        new Error(
          "找不到這台車"
        )
      );

      return;
    }

    const car = {
      id:
        snapshot.id,

      ...snapshot.data()
    };

    const isFirstLoad =
      !window.currentMatchingCar;

    window.currentMatchingCar =
      car;

    /*
      首次載入時渲染整個媒合頁。
    */
    if (isFirstLoad) {
      window
        .JLYMatchingRender
        .renderApp(car);

      return;
    }

    /*
      玩家提交回覆時，只更新 Step 4
      的回覆統計，不重新渲染整頁。

      這樣主揪正在編輯日期或候選時段時，
      不會被即時更新打斷。
    */
    const responseSummary =
      document.getElementById(
        "matchingResponseSummary"
      );

    if (
      responseSummary &&
      window.JLYMatchingRender &&
      typeof window
        .JLYMatchingRender
        .renderResponseSummary ===
        "function"
    ) {
      window
        .JLYMatchingRender
        .renderResponseSummary(
          car.matching
        );
    }
  }

  function initializeMatchingPage() {
    const carId =
      getCarId();

    if (!carId) {
      renderControllerError(
        new Error(
          "網址缺少車團 ID"
        )
      );

      return;
    }

    if (
      unsubscribeMatchingCar
    ) {
      unsubscribeMatchingCar();

      unsubscribeMatchingCar =
        null;
    }

    unsubscribeMatchingCar =
      window.db
        .collection("cars")
        .doc(carId)
        .onSnapshot(
          handleCarSnapshot,
          renderControllerError
        );
  }

  function waitForFirebase() {
    if (window.db) {
      initializeMatchingPage();
      return;
    }

    let attempts = 0;

    const timer =
      setInterval(
        function () {
          attempts += 1;

          if (window.db) {
            clearInterval(
              timer
            );

            initializeMatchingPage();
            return;
          }

          if (
            attempts >= 40
          ) {
            clearInterval(
              timer
            );

            renderControllerError(
              new Error(
                "Firebase 載入失敗，請重新整理"
              )
            );
          }
        },
        250
      );
  }

  window.addEventListener(
    "beforeunload",
    function () {
      if (
        unsubscribeMatchingCar
      ) {
        unsubscribeMatchingCar();

        unsubscribeMatchingCar =
          null;
      }
    }
  );

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      waitForFirebase
    );
  } else {
    waitForFirebase();
  }

  console.log(
    "✅ Matching Controller V2 已載入"
  );
})();