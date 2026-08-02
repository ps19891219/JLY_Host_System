(function () {
  "use strict";

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function createId(prefix) {
    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  function getMatching() {
    const car =
      window.currentMatchingCar;

    if (
      !car ||
      !car.matching
    ) {
      return null;
    }

    return car.matching;
  }

  async function startMatchingSetup() {
    const carId =
      getCarId();

    if (!carId) {
      alert("找不到車團 ID");
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
        "建立媒合失敗：",
        error
      );

      alert(
        "建立媒合失敗：" +
        error.message
      );
    }
  }

  function readCommonSlotsFromForm() {
    const matching =
      getMatching();

    const originalSlots =
      matching &&
      Array.isArray(
        matching.commonSlots
      )
        ? matching.commonSlots
        : [];

    return Array.from(
      document.querySelectorAll(
        ".matching-common-slot"
      )
    ).map(function (
      row,
      index
    ) {
      const original =
        originalSlots[index] ||
        {};

      return {
        id:
          original.id ||
          createId("slot"),

        label:
          row
            .querySelector(
              ".matching-slot-label"
            )
            .value
            .trim(),

        icon:
          original.icon ||
          "🕒",

        time:
          row
            .querySelector(
              ".matching-slot-time"
            )
            .value,

        enabled:
          row
            .querySelector(
              ".matching-slot-enabled"
            )
            .checked,

        isCustom:
          original.isCustom ===
          true
      };
    });
  }

  function syncCommonSlotsToMemory() {
    const matching =
      getMatching();

    if (!matching) {
      return [];
    }

    const slots =
      readCommonSlotsFromForm();

    matching.commonSlots =
      slots;

    return slots;
  }

  function addCustomCommonSlot() {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    const slots =
      syncCommonSlotsToMemory();

    slots.push({
      id:
        createId("custom"),

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

    matching.commonSlots =
      slots;

    window
      .JLYMatchingRender
      .renderApp(
        window
          .currentMatchingCar
      );
  }

  function removeCommonSlot(
    index
  ) {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    const slots =
      syncCommonSlotsToMemory();

    if (
      !slots[index] ||
      slots[index]
        .isCustom !== true
    ) {
      return;
    }

    slots.splice(
      index,
      1
    );

    matching.commonSlots =
      slots;

    refreshCandidatePreview();

    window
      .JLYMatchingRender
      .renderApp(
        window
          .currentMatchingCar
      );
  }

  async function saveCommonSlots() {
    const carId =
      getCarId();

    const slots =
      readCommonSlotsFromForm();

    try {
      const result =
        await window
          .JLYMatchingData
          .saveCommonSlots(
            carId,
            slots
          );

      const matching =
        getMatching();

      matching.commonSlots =
        result.commonSlots;

      refreshCandidatePreview();

      alert(
        "本次媒合時段已儲存。"
      );
    } catch (error) {
      alert(
        "儲存失敗：" +
        error.message
      );
    }
  }

  function buildCandidateSlots() {
    const matching =
      getMatching();

    if (!matching) {
      return [];
    }

    const dates =
      Array.isArray(
        matching.selectedDates
      )
        ? matching.selectedDates
        : [];

    const templates =
      Array.isArray(
        matching.commonSlots
      )
        ? matching.commonSlots
            .filter(
              function (slot) {
                return (
                  slot.enabled !==
                    false &&
                  slot.time
                );
              }
            )
        : [];

    const existing =
      Array.isArray(
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : [];

    const existingMap =
      new Map();

    existing.forEach(
      function (slot) {
        const key =
          slot.date +
          "|" +
          (
            slot.sourceSlotId ||
            slot.id
          );

        existingMap.set(
          key,
          slot
        );
      }
    );

    const next = [];

    dates.forEach(
      function (dateKey) {
        templates.forEach(
          function (template) {
            const key =
              dateKey +
              "|" +
              template.id;

            const oldSlot =
              existingMap.get(
                key
              );

            next.push(
              oldSlot
                ? {
                    ...oldSlot
                  }
                : {
                    id:
                      createId(
                        "candidate"
                      ),

                    date:
                      dateKey,

                    label:
                      template.label,

                    icon:
                      template.icon,

                    time:
                      template.time,

                    enabled:
                      true,

                    sourceSlotId:
                      template.id,

                    conflictNotes:
                      []
                  }
            );
          }
        );
      }
    );

    return next;
  }

  function refreshCandidatePreview() {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    matching.commonSlots =
      readCommonSlotsFromForm();

    matching.candidateSlots =
      buildCandidateSlots();

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );
  }

  function updateCandidateTime(
    index,
    value
  ) {
    const matching =
      getMatching();

    if (
      !matching ||
      !matching
        .candidateSlots[index]
    ) {
      return;
    }

    matching
      .candidateSlots[index]
      .time = value;

    matching
      .candidateSlots[index]
      .conflictNotes = [];

    /*
      下一輪會在這裡重新檢查
      Google Calendar 與 JLY 行程。
    */
  }

  function updateCandidateLabel(
    index,
    value
  ) {
    const matching =
      getMatching();

    if (
      !matching ||
      !matching
        .candidateSlots[index]
    ) {
      return;
    }

    matching
      .candidateSlots[index]
      .label =
        String(value || "")
          .trim();
  }

  function toggleCandidateSlot(
    index,
    enabled
  ) {
    const matching =
      getMatching();

    if (
      !matching ||
      !matching
        .candidateSlots[index]
    ) {
      return;
    }

    matching
      .candidateSlots[index]
      .enabled =
        enabled;

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );
  }

  function removeCandidateSlot(
    index
  ) {
    const matching =
      getMatching();

    if (
      !matching ||
      !Array.isArray(
        matching.candidateSlots
      )
    ) {
      return;
    }

    matching
      .candidateSlots
      .splice(
        index,
        1
      );

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );
  }

  function addCandidateSlot(
    dateKey
  ) {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    matching
      .candidateSlots
      .push({
        id:
          createId(
            "candidate"
          ),

        date:
          dateKey,

        label:
          "加開",

        icon:
          "🕒",

        time:
          "20:00",

        enabled:
          true,

        sourceSlotId:
          "",

        conflictNotes:
          []
      });

    matching
      .candidateSlots
      .sort(function (
        a,
        b
      ) {
        return (
          (
            a.date +
            a.time
          ).localeCompare(
            b.date +
            b.time
          )
        );
      });

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );
  }

  async function saveCandidateSlots() {
    const carId =
      getCarId();

    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    const enabledSlots =
      matching
        .candidateSlots
        .filter(
          function (slot) {
            return (
              slot.enabled !==
                false &&
              slot.date &&
              slot.time
            );
          }
        );

    if (
      enabledSlots.length === 0
    ) {
      alert(
        "至少要保留一個候選時段。"
      );

      return;
    }

    try {
      const result =
        await window
          .JLYMatchingData
          .saveCandidateSlots(
            carId,
            matching.selectedDates,
            matching.candidateSlots
          );

      matching.selectedDates =
        result.selectedDates;

      matching.candidateSlots =
        result.candidateSlots;

      matching.updatedAt =
        result.updatedAt;

      alert(
        "候選時段已儲存。"
      );
    } catch (error) {
      alert(
        "儲存失敗：" +
        error.message
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

  window.addCustomCommonSlot =
    addCustomCommonSlot;

  window.removeCommonSlot =
    removeCommonSlot;

  window.saveCommonSlots =
    saveCommonSlots;

  window.updateCandidateTime =
    updateCandidateTime;

  window.updateCandidateLabel =
    updateCandidateLabel;

  window.toggleCandidateSlot =
    toggleCandidateSlot;

  window.removeCandidateSlot =
    removeCandidateSlot;

  window.addCandidateSlot =
    addCandidateSlot;

  window.saveCandidateSlots =
    saveCandidateSlots;

  window.backToMatchingCar =
    backToMatchingCar;

  window.JLYMatchingActions = {
    refreshCandidatePreview
  };

  console.log(
    "✅ Matching Actions V3 已載入"
  );
})();