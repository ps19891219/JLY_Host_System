(function () {
  "use strict";

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function createCustomSlotId() {
    return (
      "custom-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
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

  function readCommonSlotsFromForm() {
    const rows =
      Array.from(
        document.querySelectorAll(
          ".matching-common-slot"
        )
      );

    return rows.map(
      function (
        row,
        index
      ) {
        const enabledInput =
          row.querySelector(
            ".matching-slot-enabled"
          );

        const labelInput =
          row.querySelector(
            ".matching-slot-label"
          );

        const timeInput =
          row.querySelector(
            ".matching-slot-time"
          );

        const currentSlots =
          window
            .currentMatchingCar &&
          window
            .currentMatchingCar
            .matching &&
          Array.isArray(
            window
              .currentMatchingCar
              .matching
              .commonSlots
          )
            ? window
                .currentMatchingCar
                .matching
                .commonSlots
            : [];

        const originalSlot =
          currentSlots[index] ||
          {};

        return {
          id:
            originalSlot.id ||
            createCustomSlotId(),

          label:
            labelInput
              ? labelInput
                  .value
                  .trim()
              : "",

          icon:
            originalSlot.icon ||
            "🕒",

          time:
            timeInput
              ? timeInput.value
              : "",

          enabled:
            enabledInput
              ? enabledInput
                  .checked
              : false,

          isCustom:
            originalSlot
              .isCustom ===
              true
        };
      }
    );
  }

  function addCustomCommonSlot() {
    const car =
      window.currentMatchingCar;

    if (
      !car ||
      !car.matching
    ) {
      alert(
        "媒合資料尚未載入"
      );

      return;
    }

    const commonSlots =
      Array.isArray(
        car.matching
          .commonSlots
      )
        ? [
            ...car.matching
              .commonSlots
          ]
        : [];

    commonSlots.push({
      id:
        createCustomSlotId(),

      label:
        "自訂",

      icon:
        "🕒",

      time:
        "20:00",

      enabled:
        true,

      isCustom:
        true
    });

    car.matching = {
      ...car.matching,
      commonSlots
    };

    window
      .JLYMatchingRender
      .renderApp(car);

    const rows =
      document.querySelectorAll(
        ".matching-common-slot"
      );

    const lastRow =
      rows[
        rows.length - 1
      ];

    if (lastRow) {
      const labelInput =
        lastRow.querySelector(
          ".matching-slot-label"
        );

      if (labelInput) {
        labelInput.focus();
        labelInput.select();
      }
    }
  }

  function removeCommonSlot(
    index
  ) {
    const car =
      window.currentMatchingCar;

    if (
      !car ||
      !car.matching ||
      !Array.isArray(
        car.matching
          .commonSlots
      )
    ) {
      return;
    }

    const commonSlots = [
      ...car.matching
        .commonSlots
    ];

    const target =
      commonSlots[index];

    if (
      !target ||
      target.isCustom !==
        true
    ) {
      return;
    }

    commonSlots.splice(
      index,
      1
    );

    car.matching = {
      ...car.matching,
      commonSlots
    };

    window
      .JLYMatchingRender
      .renderApp(car);
  }

  async function saveCommonSlots() {
    const carId =
      getCarId();

    const button =
      document.getElementById(
        "saveCommonSlotsButton"
      );

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    const commonSlots =
      readCommonSlotsFromForm();

    const invalidSlot =
      commonSlots.find(
        function (slot) {
          return (
            slot.enabled &&
            (
              !slot.label ||
              !slot.time
            )
          );
        }
      );

    if (invalidSlot) {
      alert(
        "啟用中的時段必須填寫名稱與時間。"
      );

      return;
    }

    try {
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "儲存中…";
      }

      const result =
        await window
          .JLYMatchingData
          .saveCommonSlots(
            carId,
            commonSlots
          );

      window.currentMatchingCar = {
        ...window
          .currentMatchingCar,

        matching: {
          ...window
            .currentMatchingCar
            .matching,

          commonSlots:
            result.commonSlots,

          updatedAt:
            result.updatedAt
        }
      };

      window
        .JLYMatchingRender
        .renderApp(
          window
            .currentMatchingCar
        );

      alert(
        "常用時段已儲存。"
      );
    } catch (error) {
      console.error(
        "儲存常用時段失敗：",
        error
      );

      alert(
        "儲存失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );

      if (button) {
        button.disabled =
          false;

        button.textContent =
          "儲存常用時段";
      }
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

  window.addCustomCommonSlot =
    addCustomCommonSlot;

  window.removeCommonSlot =
    removeCommonSlot;

  window.saveCommonSlots =
    saveCommonSlots;

  window.backToMatchingCar =
    backToMatchingCar;

  window.JLYMatchingActions = {
    startMatchingSetup,
    addCustomCommonSlot,
    removeCommonSlot,
    saveCommonSlots,
    backToMatchingCar
  };

  console.log(
    "✅ Matching Actions V2 已載入"
  );
})();