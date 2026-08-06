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

  let conflictRefreshToken = 0;

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

    function renderCurrentMatching() {
    const car =
      window.currentMatchingCar;

    if (
      !car ||
      !window.JLYMatchingRender ||
      typeof window
        .JLYMatchingRender
        .renderApp !==
        "function"
    ) {
      return;
    }

    window
      .JLYMatchingRender
      .renderApp(car);
  }

  function goToStep(step) {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    matching.currentStep =
      Number(step) === 3
        ? 3
        : 2;

    renderCurrentMatching();
  }

  function backToDateStep() {
    goToStep(2);
  }

  /*
    接受：
    9:00
    09:00
    19:30

    回傳統一格式：
    09:00
    19:30
  */
  function normalizeMatchingTime(
    value
  ) {
    const text =
      String(value || "")
        .trim();

    const match =
      text.match(
        /^(\d{1,2}):(\d{2})$/
      );

    if (!match) {
      return "";
    }

    const hour =
      Number(match[1]);

    const minute =
      Number(match[2]);

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return "";
    }

    return (
      String(hour)
        .padStart(2, "0") +
      ":" +
      String(minute)
        .padStart(2, "0")
    );
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
        ...window.currentMatchingCar,
        matching
      };

      window
        .JLYMatchingRender
        .renderApp(
          window.currentMatchingCar
        );
    } catch (error) {
      console.error(
        "建立媒合失敗：",
        error
      );

      alert(
        "建立媒合失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
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

    const rows =
      Array.from(
        document.querySelectorAll(
          ".matching-common-slot"
        )
      );

    /*
      畫面尚未存在時，
      保留目前記憶體裡的資料。
    */
    if (rows.length === 0) {
      return originalSlots.map(
        function (slot) {
          return {
            ...slot
          };
        }
      );
    }

    return rows.map(
      function (
        row,
        index
      ) {
        const original =
          originalSlots[index] ||
          {};

        const labelInput =
          row.querySelector(
            ".matching-slot-label"
          );

        const timeInput =
          row.querySelector(
            ".matching-slot-time"
          );

        const enabledInput =
          row.querySelector(
            ".matching-slot-enabled"
          );

        return {
          id:
            original.id ||
            createId("slot"),

          label:
            labelInput
              ? labelInput
                  .value
                  .trim()
              : (
                  original.label ||
                  ""
                ),

          icon:
            original.icon ||
            "🕒",

          time:
            timeInput
              ? String(
                  timeInput.value ||
                  ""
                ).trim()
              : (
                  original.time ||
                  ""
                ),

          enabled:
            enabledInput
              ? enabledInput.checked
              : original.enabled !==
                false,

          isCustom:
            original.isCustom ===
            true
        };
      }
    );
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
      alert(
        "媒合資料尚未載入"
      );

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
        window.currentMatchingCar
      );

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
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    const slots =
      syncCommonSlotsToMemory();

    const target =
      slots[index];

    if (
      !target ||
      target.isCustom !== true
    ) {
      return;
    }

    slots.splice(
      index,
      1
    );

    matching.commonSlots =
      slots;

    /*
      刪除模板後重新整理候選時段。
    */
    matching.candidateSlots =
      buildCandidateSlots();

    window
      .JLYMatchingRender
      .renderApp(
        window.currentMatchingCar
      );
  }

  async function saveCommonSlots() {
    const carId =
      getCarId();

    const button =
      document.getElementById(
        "saveCommonSlotsButton"
      );

    if (!carId) {
      alert("找不到車團 ID");
      return;
    }

    const slots =
      readCommonSlotsFromForm();

    let hasInvalidSlot =
      false;

    const normalizedSlots =
      slots.map(
        function (slot) {
          if (
            slot.enabled === false
          ) {
            return {
              ...slot,

              time:
                slot.time || ""
            };
          }

          const normalizedTime =
            normalizeMatchingTime(
              slot.time
            );

          if (
            !slot.label ||
            !normalizedTime
          ) {
            hasInvalidSlot =
              true;
          }

          return {
            ...slot,

            label:
              String(
                slot.label || ""
              ).trim(),

            time:
              normalizedTime
          };
        }
      );

    if (hasInvalidSlot) {
      alert(
        "啟用中的時段必須填寫名稱與正確時間。\n\n例如：09:00、14:30、19:00"
      );

      return;
    }

    const enabledSlots =
      normalizedSlots.filter(
        function (slot) {
          return (
            slot.enabled ===
              true &&
            slot.time
          );
        }
      );

    if (
      enabledSlots.length === 0
    ) {
      alert(
        "至少要保留一個啟用中的時段。"
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
            normalizedSlots
          );

      const matching =
        getMatching();

      matching.commonSlots =
        result.commonSlots;

      matching.updatedAt =
        result.updatedAt;

      /*
        套用更新後的模板，
        但已經手動改過的候選時間會保留。
      */
      matching.candidateSlots =
        buildCandidateSlots();

      window
        .JLYMatchingRender
        .renderApp(
          window.currentMatchingCar
        );

      alert(
        "本次媒合時段已儲存。"
      );
    } catch (error) {
      console.error(
        "儲存本次媒合時段失敗：",
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
          "儲存本次媒合時段";
      }
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

    const templateMap =
      new Map();

    existing.forEach(
      function (slot) {
        if (!slot.sourceSlotId) {
          return;
        }

        const key =
          slot.date +
          "|" +
          slot.sourceSlotId;

        templateMap.set(
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
              templateMap.get(
                key
              );

            if (oldSlot) {
              next.push({
                ...oldSlot
              });

              return;
            }

            next.push({
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

              conflicts:
                []
            });
          }
        );
      }
    );

    /*
      保留主揪手動加開的時段。
    */
    existing.forEach(
      function (slot) {
        if (
          slot.sourceSlotId
        ) {
          return;
        }

        if (
          !dates.includes(
            slot.date
          )
        ) {
          return;
        }

        next.push({
          ...slot
        });
      }
    );

    next.sort(
      function (a, b) {
        return (
          (
            a.date +
            "|" +
            a.time
          ).localeCompare(
            b.date +
            "|" +
            b.time
          )
        );
      }
    );

    return next;
  }

  async function refreshCandidateConflicts(
    options = {}
  ) {
    const matching =
      getMatching();

    const car =
      window.currentMatchingCar;

    if (
      !matching ||
      !car ||
      !window
        .JLYMatchingConflict
    ) {
      return;
    }

    const currentToken =
      ++conflictRefreshToken;

    try {
      const nextSlots =
        await window
          .JLYMatchingConflict
          .applyConflicts(
            matching
              .candidateSlots,

            car.id ||
            getCarId(),

            {
              forceReload:
                options.forceReload ===
                true
            }
          );

      /*
        若使用者在查詢期間又修改時間，
        舊結果不應覆蓋新結果。
      */
      if (
        currentToken !==
        conflictRefreshToken
      ) {
        return;
      }

      matching.candidateSlots =
        nextSlots;

      window
        .JLYMatchingRender
        .renderCandidatePreview(
          matching
        );
    } catch (error) {
      console.error(
        "候選時段衝突檢查失敗：",
        error
      );
    }
  }

  async function clearAllMatchingDates() {
  const matching =
    getMatching();

  const carId =
    getCarId();

  if (
    !matching ||
    !carId
  ) {
    alert("媒合資料尚未載入");
    return;
  }

  const hasSelectedDates =
    Array.isArray(
      matching.selectedDates
    ) &&
    matching.selectedDates.length > 0;

  const hasCandidateSlots =
    Array.isArray(
      matching.candidateSlots
    ) &&
    matching.candidateSlots.length > 0;

  if (
    !hasSelectedDates &&
    !hasCandidateSlots
  ) {
    return;
  }

  const confirmed =
    confirm(
      "確定要清除所有已選日期與候選時段嗎？\n\n本次媒合時段模板不會被清除。"
    );

  if (!confirmed) {
    return;
  }

  try {
    const result =
      await window
        .JLYMatchingData
        .saveCandidateSlots(
          carId,
          [],
          []
        );

    matching.selectedDates =
      Array.isArray(
        result.selectedDates
      )
        ? result.selectedDates
        : [];

    matching.candidateSlots =
      Array.isArray(
        result.candidateSlots
      )
        ? result.candidateSlots
        : [];

    matching.updatedAt =
      result.updatedAt;

    matching.currentStep = 2;

    renderCurrentMatching();
  } catch (error) {
    console.error(
      "清除媒合日期失敗：",
      error
    );

    alert(
      "清除失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );
  }
}

    async function continueToCandidateStep() {
    const matching =
      getMatching();

    const carId =
      getCarId();

    const button =
      document.getElementById(
        "continueToCandidateButton"
      );

    if (
      !matching ||
      !carId
    ) {
      alert(
        "媒合資料尚未載入"
      );

      return;
    }

    const commonSlots =
      readCommonSlotsFromForm();

    const normalizedCommonSlots =
      commonSlots.map(
        function (slot) {
          const normalizedTime =
            normalizeMatchingTime(
              slot.time
            );

          return {
            ...slot,

            label:
              String(
                slot.label || ""
              ).trim(),

            time:
              slot.enabled === false
                ? String(
                    slot.time || ""
                  ).trim()
                : normalizedTime
          };
        }
      );

    const invalidSlot =
      normalizedCommonSlots.find(
        function (slot) {
          return (
            slot.enabled !== false &&
            (
              !slot.label ||
              !slot.time
            )
          );
        }
      );

    if (invalidSlot) {
      alert(
        "啟用中的時段必須填寫名稱與正確時間。\n\n例如：09:00、14:30、19:00"
      );

      return;
    }

    const enabledSlots =
      normalizedCommonSlots.filter(
        function (slot) {
          return (
            slot.enabled !== false &&
            slot.label &&
            slot.time
          );
        }
      );

    if (
      enabledSlots.length === 0
    ) {
      alert(
        "請至少保留一個有效的媒合時段。"
      );

      return;
    }

    if (
      !Array.isArray(
        matching.selectedDates
      ) ||
      matching.selectedDates
        .length === 0
    ) {
      alert(
        "請至少選擇一個日期。"
      );

      return;
    }

    try {
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "正在建立候選時段…";
      }

      const commonResult =
        await window
          .JLYMatchingData
          .saveCommonSlots(
            carId,
            normalizedCommonSlots
          );

      matching.commonSlots =
        commonResult.commonSlots;

      matching.updatedAt =
        commonResult.updatedAt;

      matching.candidateSlots =
        buildCandidateSlots();

      const candidateResult =
        await window
          .JLYMatchingData
          .saveCandidateSlots(
            carId,
            matching.selectedDates,
            matching.candidateSlots
          );

      matching.selectedDates =
        candidateResult.selectedDates;

      matching.candidateSlots =
        candidateResult.candidateSlots;

      matching.updatedAt =
        candidateResult.updatedAt;

      matching.currentStep = 3;

      renderCurrentMatching();
    } catch (error) {
      console.error(
        "建立候選時段失敗：",
        error
      );

      alert(
        "無法進入候選時段確認：" +
        (
          error.message ||
          "未知錯誤"
        )
      );

      if (button) {
        button.disabled =
          false;

        button.textContent =
          "下一步：確認候選時段";
      }
    }
  }

    function refreshCandidatePreview() {
    const matching =
      getMatching();

    if (!matching) {
      return;
    }

    const formRows =
      document.querySelectorAll(
        ".matching-common-slot"
      );

    /*
      有模板表單時才同步，
      避免重新渲染過程讀到空畫面。
    */
    if (formRows.length > 0) {
      matching.commonSlots =
        readCommonSlotsFromForm();
    }

    matching.candidateSlots =
      buildCandidateSlots();

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );

    refreshCandidateConflicts();
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

    const normalizedTime =
      normalizeMatchingTime(
        value
      );

    if (!normalizedTime) {
      alert(
        "請輸入正確時間。\n\n例如：09:00、14:30、19:00"
      );

      window
        .JLYMatchingRender
        .renderCandidatePreview(
          matching
        );

      return;
    }

    matching
      .candidateSlots[index]
      .time =
        normalizedTime;

    matching
      .candidateSlots[index]
      .conflicts = [];

    matching
      .candidateSlots
      .sort(
        function (a, b) {
          return (
            (
              a.date +
              "|" +
              a.time
            ).localeCompare(
              b.date +
              "|" +
              b.time
            )
          );
        }
      );

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );

    refreshCandidateConflicts();
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

    const label =
      String(value || "")
        .trim();

    matching
      .candidateSlots[index]
      .label =
        label || "自訂";
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
        enabled === true;

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

    if (
      !Array.isArray(
        matching.candidateSlots
      )
    ) {
      matching.candidateSlots =
        [];
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

        conflicts:
          []
      });

    matching
      .candidateSlots
      .sort(
        function (a, b) {
          return (
            (
              a.date +
              "|" +
              a.time
            ).localeCompare(
              b.date +
              "|" +
              b.time
            )
          );
        }
      );

    window
      .JLYMatchingRender
      .renderCandidatePreview(
        matching
      );

    refreshCandidateConflicts();
  }

  async function saveCandidateSlots() {
    const carId =
      getCarId();

    const matching =
      getMatching();

    const button =
      document.getElementById(
        "saveCandidateSlotsButton"
      );

    if (!carId) {
      alert("找不到車團 ID");
      return;
    }

    if (!matching) {
      alert(
        "媒合資料尚未載入"
      );

      return;
    }

    const normalizedSlots =
      (
        Array.isArray(
          matching.candidateSlots
        )
          ? matching.candidateSlots
          : []
      ).map(
        function (slot) {
          const normalizedTime =
            normalizeMatchingTime(
              slot.time
            );

          return {
            ...slot,

            label:
              String(
                slot.label ||
                "自訂"
              ).trim(),

            time:
              normalizedTime
          };
        }
      );

    const invalidSlot =
      normalizedSlots.find(
        function (slot) {
          return (
            slot.enabled !==
              false &&
            (
              !slot.date ||
              !slot.label ||
              !slot.time
            )
          );
        }
      );

    if (invalidSlot) {
      alert(
        "啟用中的候選時段必須有日期、名稱與正確時間。"
      );

      return;
    }

    const enabledSlots =
      normalizedSlots.filter(
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
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "儲存中…";
      }

      const result =
        await window
          .JLYMatchingData
          .saveCandidateSlots(
            carId,
            matching.selectedDates,
            normalizedSlots
          );

      matching.selectedDates =
        result.selectedDates;

      matching.candidateSlots =
        result.candidateSlots;

      matching.updatedAt =
        result.updatedAt;

      window
        .JLYMatchingRender
        .renderCandidatePreview(
          matching
        );

      alert(
        "候選時段已儲存。"
      );
    } catch (error) {
      console.error(
        "儲存候選時段失敗：",
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
          "儲存候選時段";
      }
    }
  }

    function openConflictCar(
    conflictCarId
  ) {
    const id =
      String(
        conflictCarId || ""
      ).trim();

    if (!id) {
      return;
    }

    window.open(
      "car-detail.html?id=" +
        encodeURIComponent(id),

      "_blank",

      "noopener"
    );
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

    window.continueToCandidateStep =
  continueToCandidateStep;

window.backToDateStep =
  backToDateStep;

window.goToMatchingStep =
  goToStep;

  window.openConflictCar =
    openConflictCar;

  window.backToMatchingCar =
    backToMatchingCar;

    window.clearAllMatchingDates =
  clearAllMatchingDates;

    window.JLYMatchingActions = {
    refreshCandidatePreview,
    refreshCandidateConflicts,
    normalizeMatchingTime,
    openConflictCar,
    continueToCandidateStep,
    backToDateStep,
    clearAllMatchingDates,
    goToStep
  };

    console.log(
    "✅ Matching Actions V6 已載入"
  );
})();