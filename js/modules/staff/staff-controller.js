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
        "請輸入工作人員稱謂。\n留空會恢復為數字編號：",
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

  async function editStaffPerson(
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

  if (
    !window.JLYMemberPicker ||
    typeof window.JLYMemberPicker
      .open !== "function"
  ) {
    alert(
      "人員選擇器尚未載入完成"
    );

    return;
  }

  window.JLYMemberPicker.open({
    type: "staff",

    currentMemberId:
      staff.memberId || "",

    currentDisplayName:
      String(
        staff.displayName ||
        ""
      ),

    onSelect:
      async function (
        member
      ) {
        const newName =
          String(
            member?.displayName ||
            member?.name ||
            ""
          ).trim();

        if (!newName) {
          alert(
            "找不到工作人員名稱"
          );

          return;
        }

        if (
          !window.JLYStaffActions ||
          typeof window
            .JLYStaffActions
            .updateStaffName !==
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
            .updateStaffName(
              car,
              staffId,
              newName
            );

          refresh(car);
        } catch (error) {
          console.error(
            "修改工作人員名稱失敗：",
            error
          );

          alert(
            "工作人員儲存失敗，請稍後再試。"
          );
        }
      }
  });
}

  window.JLYStaffController = {
    render,
    refresh,
    addStaffSlot,
    editStaffLabel,
    editStaffPerson
  };
})();