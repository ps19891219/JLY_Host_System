console.log(
  "staff-controller.js 已成功載入！"
);

(function () {
  function getCurrentCar() {
    return (
      window.currentCarData ||
      null
    );
  }

  function getStaffById(
    car,
    staffId
  ) {
    if (
      !car ||
      !window.JLYStaffData ||
      typeof window.JLYStaffData
        .getStaffSlots !==
        "function"
    ) {
      return null;
    }

    const staffSlots =
      window.JLYStaffData
        .getStaffSlots(car);

    if (
      !Array.isArray(staffSlots)
    ) {
      return null;
    }

    return (
      staffSlots.find(
        function (staff) {
          return (
            String(staff.id) ===
            String(staffId)
          );
        }
      ) ||
      null
    );
  }

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
        .getStaffSlots(car);

    return window.JLYStaffRender
      .renderStaff(
        staffSlots
      );
  }

  function refresh(car) {
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
      render(car);
  }

  function setBusyState(
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
    const row =
      document.querySelector(
        `[data-staff-id="${staffId}"]`
      );

    if (!row) {
      return;
    }

    const personButton =
      row.querySelector(
        ".staff-seat-person"
      );

    if (!personButton) {
      return;
    }

    personButton.disabled =
      Boolean(isBusy);

    if (isBusy) {
      personButton.dataset
        .originalText =
        personButton.textContent;

      personButton.textContent =
        "儲存中……";
    } else {
      personButton.textContent =
        personButton.dataset
          .originalText ||
        personButton.textContent;

      delete personButton.dataset
        .originalText;
    }
  }

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
      setBusyState(true);

      await window
        .JLYStaffActions
        .addStaffSlot(car);

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
      setBusyState(false);
    }
  }

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
        "請輸入工作人員稱謂。\n例如：DM、主DM、副DM、主持人。\n留空會恢復為數字編號：",
        String(
          staff.label || ""
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
        "修改工作人員稱謂失敗：",
        error
      );

      alert(
        "稱謂儲存失敗，請稍後再試。"
      );
    }
  }

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

  async function clearStaffPerson(
    staffId
  ) {
    const car =
      getCurrentCar();

    const staff =
      getStaffById(
        car,
        staffId
      );

    if (
      !car ||
      !staff
    ) {
      alert(
        "找不到這個工作人員欄位"
      );

      return;
    }

    if (
      !staff.memberId &&
      !staff.displayName
    ) {
      return;
    }

    const confirmed =
      confirm(
        `確定要清除「${
          staff.displayName ||
          "尚未安排"
        }」嗎？\n工作人員欄位會保留。`
      );

    if (!confirmed) {
      return;
    }

    if (
      !window.JLYStaffActions ||
      typeof window.JLYStaffActions
        .clearStaffMember !==
        "function"
    ) {
      alert(
        "工作人員模組尚未載入完成"
      );

      return;
    }

    try {
      setStaffButtonBusy(
        staffId,
        true
      );

      await window
        .JLYStaffActions
        .clearStaffMember(
          car,
          staffId
        );

      refresh(car);
    } catch (error) {
      console.error(
        "清除工作人員失敗：",
        error
      );

      alert(
        "清除失敗，請稍後再試。"
      );
    } finally {
      setStaffButtonBusy(
        staffId,
        false
      );
    }
  }

  window.JLYStaffController = {
    render,
    refresh,

    addStaffSlot,
    editStaffLabel,
    editStaffPerson,
    clearStaffPerson
  };
})();