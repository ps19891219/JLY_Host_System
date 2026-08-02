(function () {
  "use strict";

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  async function initializeMatchingPage() {
    const carId =
      getCarId();

    if (!carId) {
      window
        .JLYMatchingRender
        .renderError(
          new Error(
            "網址缺少車團 ID"
          )
        );

      return;
    }

    try {
      const car =
        await window
          .JLYMatchingData
          .getCar(
            carId
          );

      window.currentMatchingCar =
        car;

      window
        .JLYMatchingRender
        .renderApp(
          car
        );
    } catch (error) {
      console.error(
        "媒合頁初始化失敗：",
        error
      );

      window
        .JLYMatchingRender
        .renderError(
          error
        );
    }
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

          if (attempts >= 40) {
            clearInterval(
              timer
            );

            window
              .JLYMatchingRender
              .renderError(
                new Error(
                  "Firebase 載入失敗，請重新整理"
                )
              );
          }
        },
        250
      );
  }

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
    "✅ Matching Controller V1 已載入"
  );
})();