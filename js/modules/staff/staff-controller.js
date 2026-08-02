console.log(
  "staff-controller.js V2 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 拖曳狀態
  // ============================================================

  const dragState = {
    type: "",
    sourceStaffId: ""
  };

  // ============================================================
  // 基礎工具
  // ============================================================

  function getText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function getCurrentCar() {
    return (
      window.currentCarData ||
      null
    );
  }

  function getStaffSlots(car) {
    if (
      !car ||
      !window.JLYStaffData ||
      typeof window.JLYStaffData
        .getStaffSlots !==
        "function"
    ) {
      return [];
    }

    const staffSlots =
      window.JLYStaffData
        .getStaffSlots(car);

    return Array.isArray(
      staffSlots
    )
      ? staffSlots
      : [];
  }

  function getStaffById(
    car,
    staffId
  ) {
    const targetId =
      getText(
        staffId
      );

    if (!targetId) {
      return null;
    }

    const staffSlots =
      getStaffSlots(car);

    return (
      staffSlots.find(
        function (staff) {
          return (
            getText(
              staff && staff.id
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function getStaffLabel(
    staff,
    fallbackIndex
  ) {
    const safeStaff =
      staff || {};

    return (
      getText(
        safeStaff.label
      ) ||
      String(
        Number(
          fallbackIndex || 0
        ) + 1
      )
    );
  }

  function getStaffDescription(
    staff,
    fallbackIndex
  ) {
    const safeStaff =
      staff || {};

    const label =
      getStaffLabel(
        safeStaff,
        fallbackIndex
      );

    const displayName =
      getText(
        safeStaff.displayName
      );

    if (
      label &&
      displayName
    ) {
      return (
        label +
        "｜" +
        displayName
      );
    }

    return (
      displayName ||
      label ||
      "工作人員欄位"
    );
  }

  // ============================================================
  // Render 與重新整理
  // ============================================================

  function render(car) {
    if (
      !window.JLYStaffData ||
      !window.JLYStaffRender ||
      typeof window.JLYStaffData
        .getStaffSlots !==
        "function" ||
      typeof window.JLYStaffRender
        .renderStaff !==
        "function"
    ) {
      return "";
    }

    const staffSlots =
      window.JLYStaffData
        .getStaffSlots(
          car || {}
        );

    return window.JLYStaffRender
      .renderStaff(
        staffSlots
      );
  }

  function refresh(car) {
    const sourceCar =
      car ||
      getCurrentCar();

    const staffSection =
      document.getElementById(
        "staffSection"
      );

    if (!staffSection) {
      console.error(
        "找不到工作人員區塊 staffSection"
      );

      return;
    }

    staffSection.outerHTML =
      render(
        sourceCar
      );
  }

  // ============================================================
  // Busy 狀態
  // ============================================================

  function setSectionBusy(
    isBusy
  ) {
    const staffSection =
      document.getElementById(
        "staffSection"
      );

    if (!staffSection) {
      return;
    }

    staffSection.classList.toggle(
      "is-busy",
      Boolean(isBusy)
    );

    staffSection.setAttribute(
      "aria-busy",
      isBusy
        ? "true"
        : "false"
    );
  }

  function setAddButtonBusy(
    isBusy
  ) {
    const addButton =
      document.querySelector(
        ".staff-add-button"
      );

    if (!addButton) {
      return;
    }

    addButton.disabled =
      Boolean(isBusy);

    addButton.textContent =
      isBusy
        ? "儲存中……"
        : "＋ 新增工作人員";
  }

  function setStaffButtonBusy(
    staffId,
    isBusy
  ) {
    const targetId =
      getText(
        staffId
      );

    const rows =
      document.querySelectorAll(
        "[data-staff-row]"
      );

    let targetRow = null;

    rows.forEach(
      function (row) {
        if (
          getText(
            row.getAttribute(
              "data-staff-id"
            )
          ) === targetId
        ) {
          targetRow =
            row;
        }
      }
    );

    if (!targetRow) {
      return;
    }

    const personButton =
      targetRow.querySelector(
        ".staff-seat-person"
      );

    if (personButton) {
      personButton.disabled =
        Boolean(isBusy);

      personButton.setAttribute(
        "aria-busy",
        isBusy
          ? "true"
          : "false"
      );
    }

    targetRow.classList.toggle(
      "is-saving",
      Boolean(isBusy)
    );
  }

  // ============================================================
  // 新增工作人員欄位
  // ============================================================

  async function addStaffSlot() {
    const car =
      getCurrentCar();

    if (!car) {
      alert(
        "目前找不到車團資料"
      );

      return;
    }

    if (
      !window.JLYStaffActions ||
      typeof window.JLYStaffActions
        .addStaffSlot !==
        "function"
    ) {
      console.error(
        "JLYStaffActions 尚未正確載入"
      );

      alert(
        "工作人員模組尚未載入完成"
      );

      return;
    }

    try {
      setAddButtonBusy(
        true
      );

      await window
        .JLYStaffActions
        .addStaffSlot(
          car
        );

      refresh(car);
    } catch (error) {
      console.error(
        "新增工作人員失敗：",
        error
      );

      alert(
        "新增失敗，請稍後再試。"
      );
    } finally {
      setAddButtonBusy(
        false
      );
    }
  }

  // ============================================================
  // 修改工作人員欄位名稱
  // ============================================================

  async function editStaffLabel(
    staffId
  ) {
    const car =
      getCurrentCar();

    const staff =
      getStaffById(
        car,
        staffId
      );

    if (!staff) {
      alert(
        "找不到這個工作人員欄位"
      );

      return;
    }

    const newLabel =
      prompt(
        "請輸入工作人員欄位名稱。\n留空會恢復為數字編號：",
        getText(
          staff.label
        )
      );

    if (
      newLabel === null
    ) {
      return;
    }

    if (
      !window.JLYStaffActions ||
      typeof window.JLYStaffActions
        .updateStaffLabel !==
        "function"
    ) {
      alert(
        "工作人員模組尚未載入完成"
      );

      return;
    }

    try {
      setSectionBusy(
        true
      );

      await window
        .JLYStaffActions
        .updateStaffLabel(
          car,
          staffId,
          newLabel
        );

      refresh(car);
    } catch (error) {
      console.error(
        "修改工作人員欄位名稱失敗：",
        error
      );

      alert(
        "欄位名稱儲存失敗，請稍後再試。"
      );
    } finally {
      setSectionBusy(
        false
      );
    }
  }

  // ============================================================
  // 儲存會員選擇結果
  // ============================================================

  async function saveSelectedMember(
    car,
    staffId,
    selectedMember
  ) {
    if (
      !window.JLYStaffActions ||
      typeof window.JLYStaffActions
        .updateStaffMember !==
        "function"
    ) {
      throw new Error(
        "updateStaffMember 尚未載入"
      );
    }

    setStaffButtonBusy(
      staffId,
      true
    );

    try {
      await window
        .JLYStaffActions
        .updateStaffMember(
          car,
          staffId,
          selectedMember
        );

      refresh(car);
    } finally {
      setStaffButtonBusy(
        staffId,
        false
      );
    }
  }

  // ============================================================
  // 開啟會員選擇器
  // ============================================================

  function openMemberPicker(
    car,
    staffId
  ) {
    if (
      !window.JLYMemberPicker ||
      typeof window.JLYMemberPicker
        .open !==
        "function"
    ) {
      console.error(
        "JLYMemberPicker 尚未正確載入"
      );

      alert(
        "人員選擇器尚未載入完成"
      );

      return;
    }

    window.JLYMemberPicker.open({
      car,

      role:
        "staff",

      staffId,

      onSelect:
        async function (
          selectedMember
        ) {
          try {
            await saveSelectedMember(
              car,
              staffId,
              selectedMember
            );
          } catch (error) {
            console.error(
              "安排工作人員失敗：",
              error
            );

            alert(
              "工作人員儲存失敗，請稍後再試。"
            );

            throw error;
          }
        }
    });
  }

  // ============================================================
  // 點名字選擇或更換工作人員
  // ============================================================

  function editStaffPerson(
    staffId
  ) {
    const car =
      getCurrentCar();

    const staff =
      getStaffById(
        car,
        staffId
      );

    if (!car) {
      alert(
        "目前找不到車團資料"
      );

      return;
    }

    if (!staff) {
      alert(
        "找不到這個工作人員欄位"
      );

      return;
    }

    openMemberPicker(
      car,
      staffId
    );
  }

  // ============================================================
  // 刪除整個工作人員欄位
  // ============================================================

  async function removeStaffSlot(
    staffId
  ) {
    const car =
      getCurrentCar();

    const staffSlots =
      getStaffSlots(car);

    const staffIndex =
      staffSlots.findIndex(
        function (staff) {
          return (
            getText(
              staff && staff.id
            ) ===
            getText(
              staffId
            )
          );
        }
      );

    const staff =
      staffIndex >= 0
        ? staffSlots[
            staffIndex
          ]
        : null;

    if (
      !car ||
      !staff
    ) {
      alert(
        "找不到這個工作人員欄位"
      );

      return;
    }

    const description =
      getStaffDescription(
        staff,
        staffIndex
      );

    const confirmed =
      confirm(
        `確定要刪除「${description}」這個工作人員欄位嗎？\n\n` +
        "此操作只會刪除這台車中的欄位，" +
        "不會刪除會員或玩家資料庫中的人物。"
      );

    if (!confirmed) {
      return;
    }

    if (
      !window.JLYStaffActions ||
      typeof window.JLYStaffActions
        .removeStaffSlot !==
        "function"
    ) {
      alert(
        "工作人員刪除功能尚未載入完成"
      );

      return;
    }

    try {
      setSectionBusy(
        true
      );

      await window
        .JLYStaffActions
        .removeStaffSlot(
          car,
          staffId
        );

      refresh(car);
    } catch (error) {
      console.error(
        "刪除工作人員欄位失敗：",
        error
      );

      alert(
        "欄位刪除失敗，請稍後再試。"
      );
    } finally {
      setSectionBusy(
        false
      );
    }
  }

  // ============================================================
  // 舊版函式相容
  //
  // 舊畫面若仍呼叫 clearStaffPerson，
  // 也改為刪除整個工作人員欄位。
  // ============================================================

  async function clearStaffPerson(
    staffId
  ) {
    return await removeStaffSlot(
      staffId
    );
  }

  // ============================================================
  // 拖曳視覺狀態
  // ============================================================

  function clearDragClasses() {
    document
      .querySelectorAll(
        [
          ".staff-seat-row.is-dragging",
          ".staff-seat-row.is-drag-over",
          ".staff-seat-person.is-dragging"
        ].join(",")
      )
      .forEach(
        function (element) {
          element.classList.remove(
            "is-dragging",
            "is-drag-over"
          );
        }
      );
  }

  function resetDragState() {
    dragState.type =
      "";

    dragState.sourceStaffId =
      "";

    clearDragClasses();
  }

  function getStaffIdFromElement(
    element
  ) {
    if (!element) {
      return "";
    }

    const holder =
      element.closest(
        "[data-staff-id]"
      );

    return holder
      ? getText(
          holder.getAttribute(
            "data-staff-id"
          )
        )
      : "";
  }

  // ============================================================
  // 拖曳開始
  // ============================================================

  function handleStaffDragStart(
    event
  ) {
    const staffSection =
      event.target.closest(
        "#staffSection"
      );

    if (!staffSection) {
      return;
    }

    const memberElement =
      event.target.closest(
        "[data-staff-member-drag='true']"
      );

    const rowElement =
      event.target.closest(
        "[data-staff-row-drag='true']"
      );

    if (
      memberElement &&
      getText(
        memberElement.getAttribute(
          "draggable"
        )
      ) === "true"
    ) {
      const staffId =
        getStaffIdFromElement(
          memberElement
        );

      if (!staffId) {
        event.preventDefault();

        return;
      }

      dragState.type =
        "member";

      dragState.sourceStaffId =
        staffId;

      memberElement.classList.add(
        "is-dragging"
      );

      if (
        event.dataTransfer
      ) {
        event.dataTransfer.effectAllowed =
          "move";

        event.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            type:
              "staff-member",

            staffId
          })
        );
      }

      event.stopPropagation();

      return;
    }

    if (!rowElement) {
      return;
    }

    const staffId =
      getStaffIdFromElement(
        rowElement
      );

    if (!staffId) {
      event.preventDefault();

      return;
    }

    dragState.type =
      "row";

    dragState.sourceStaffId =
      staffId;

    rowElement.classList.add(
      "is-dragging"
    );

    if (
      event.dataTransfer
    ) {
      event.dataTransfer.effectAllowed =
        "move";

      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          type:
            "staff-row",

          staffId
        })
      );
    }
  }

  // ============================================================
  // 拖曳經過
  // ============================================================

  function handleStaffDragOver(
    event
  ) {
    if (
      !dragState.type ||
      !dragState.sourceStaffId
    ) {
      return;
    }

    const targetRow =
      event.target.closest(
        "[data-staff-row='true']"
      );

    if (!targetRow) {
      return;
    }

    const targetStaffId =
      getStaffIdFromElement(
        targetRow
      );

    if (
      !targetStaffId ||
      targetStaffId ===
        dragState.sourceStaffId
    ) {
      return;
    }

    event.preventDefault();

    if (
      event.dataTransfer
    ) {
      event.dataTransfer.dropEffect =
        "move";
    }

    document
      .querySelectorAll(
        ".staff-seat-row.is-drag-over"
      )
      .forEach(
        function (row) {
          if (
            row !== targetRow
          ) {
            row.classList.remove(
              "is-drag-over"
            );
          }
        }
      );

    targetRow.classList.add(
      "is-drag-over"
    );
  }

  // ============================================================
  // 放下
  // ============================================================

  async function handleStaffDrop(
    event
  ) {
    if (
      !dragState.type ||
      !dragState.sourceStaffId
    ) {
      return;
    }

    const targetRow =
      event.target.closest(
        "[data-staff-row='true']"
      );

    if (!targetRow) {
      resetDragState();

      return;
    }

    const targetStaffId =
      getStaffIdFromElement(
        targetRow
      );

    if (
      !targetStaffId ||
      targetStaffId ===
        dragState.sourceStaffId
    ) {
      resetDragState();

      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const car =
      getCurrentCar();

    if (!car) {
      resetDragState();

      alert(
        "目前找不到車團資料"
      );

      return;
    }

    const dragType =
      dragState.type;

    const sourceStaffId =
      dragState.sourceStaffId;

    resetDragState();

    try {
      setSectionBusy(
        true
      );

      if (
        dragType === "member"
      ) {
        if (
          !window.JLYStaffActions ||
          typeof window
            .JLYStaffActions
            .moveStaffMember !==
            "function"
        ) {
          throw new Error(
            "moveStaffMember 尚未載入"
          );
        }

        await window
          .JLYStaffActions
          .moveStaffMember(
            car,
            sourceStaffId,
            targetStaffId
          );
      } else {
        if (
          !window.JLYStaffActions ||
          typeof window
            .JLYStaffActions
            .moveStaffSlot !==
            "function"
        ) {
          throw new Error(
            "moveStaffSlot 尚未載入"
          );
        }

        await window
          .JLYStaffActions
          .moveStaffSlot(
            car,
            sourceStaffId,
            targetStaffId
          );
      }

      refresh(car);
    } catch (error) {
      console.error(
        "移動工作人員失敗：",
        error
      );

      alert(
        "工作人員移動失敗，請稍後再試。"
      );
    } finally {
      setSectionBusy(
        false
      );
    }
  }

  function handleStaffDragEnd() {
    resetDragState();
  }

  // ============================================================
  // 全頁事件委派
  //
  // 因為工作人員區每次儲存後會重新 Render，
  // 使用事件委派就不需要反覆重新綁定。
  // ============================================================

  function bindGlobalDragEvents() {
    if (
      document.documentElement
        .dataset
        .jlyStaffDragBound ===
      "true"
    ) {
      return;
    }

    document.documentElement
      .dataset
      .jlyStaffDragBound =
      "true";

    document.addEventListener(
      "dragstart",
      handleStaffDragStart
    );

    document.addEventListener(
      "dragover",
      handleStaffDragOver
    );

    document.addEventListener(
      "drop",
      handleStaffDrop
    );

    document.addEventListener(
      "dragend",
      handleStaffDragEnd
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYStaffController = {
    getCurrentCar,

    getStaffSlots,

    getStaffById,

    getStaffLabel,

    getStaffDescription,

    render,

    refresh,

    setSectionBusy,

    setAddButtonBusy,

    setStaffButtonBusy,

    addStaffSlot,

    editStaffLabel,

    saveSelectedMember,

    openMemberPicker,

    editStaffPerson,

    removeStaffSlot,

    clearStaffPerson,

    clearDragClasses,

    resetDragState,

    getStaffIdFromElement,

    handleStaffDragStart,

    handleStaffDragOver,

    handleStaffDrop,

    handleStaffDragEnd,

    bindGlobalDragEvents
  };

  bindGlobalDragEvents();

  console.log(
    "✅ Staff Controller V2 已載入"
  );
})();