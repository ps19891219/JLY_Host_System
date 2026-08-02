(function () {
  "use strict";

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  async function startMatchingSetup() {
    const carId =
      getCarId();

    if (!carId) {
      alert(
        "找不到車團 ID"
      );
      return;
    }

    try {
      const matching =
        await window
          .JLYMatchingData
          .createMatching(
            carId
          );

      window.currentMatchingCar = {
        ...window
          .currentMatchingCar,

        matching
      };

      window
        .JLYMatchingRender
        .renderApp(
          window
            .currentMatchingCar
        );
    } catch (error) {
      console.error(
        "建立時間媒合失敗：",
        error
      );

      alert(
        "建立時間媒合失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  function backToMatchingCar() {
    const carId =
      getCarId();

    location.href =
      "car-detail.html?id=" +
      encodeURIComponent(
        carId || ""
      );
  }

  window.startMatchingSetup =
    startMatchingSetup;

  window.backToMatchingCar =
    backToMatchingCar;

  window.JLYMatchingActions = {
    startMatchingSetup,
    backToMatchingCar
  };

  console.log(
    "✅ Matching Actions V1 已載入"
  );
})();