console.log("car-view.js 已成功載入！");

(function () {
  "use strict";

  function getCarId() {
    return new URLSearchParams(location.search).get("id");
  }

  function getContainer() {
    return document.getElementById("car-view-content");
  }

  async function loadCar() {
    const container = getContainer();

    if (!window.JLYCarViewRender) {
      console.error("找不到 JLYCarViewRender");
      return;
    }

    window.JLYCarViewRender.renderLoading(container);

    const carId = getCarId();

    if (!carId) {
      window.JLYCarViewRender.renderError(
        container,
        "缺少車團 ID"
      );
      return;
    }

    try {

    if (!window.JLYCarData) {
        throw new Error(
            "JLYCarData 尚未載入"
        );
    }

    const car =
        await window.JLYCarData.getCarById(
            carId
        );

    if (!car) {
        window.JLYCarViewRender.renderError(
            container,
            "找不到這台車"
        );
        return;
    }

      window.JLYCarViewRender.renderCarView(
        container,
        car,
        carId
      );

      // 如果 Seat Engine 已載入，就畫座位
      if (
        window.JLYSeatController &&
        typeof window.JLYSeatController.render ===
          "function"
      ) {
        const seatMount =
          document.getElementById(
            "carViewSeatMount"
          );

        if (seatMount) {
          window.JLYSeatController.render(
            seatMount,
            car,
            car.players || [],
            {
              editable: false,
              draggable: false,
              showWaitingArea: false,
              showSummary: true
            }
          );
        }
      }
    } catch (error) {
      console.error(error);

      window.JLYCarViewRender.renderError(
        container,
        error.message
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    loadCar
  );
})();