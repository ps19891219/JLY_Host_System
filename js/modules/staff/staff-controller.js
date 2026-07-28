console.log(
  "staff-controller.js 已成功載入！"
);

(function () {
  function render(car) {
    if (
      !window.JLYStaffData ||
      !window.JLYStaffRender
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

  function addStaffSlot() {
    const car =
      window.currentCarData;

    if (!car) {
      alert(
        "目前找不到車團資料"
      );

      return;
    }

    if (
      !window.JLYStaffActions ||
      typeof window
        .JLYStaffActions
        .addStaffSlot !==
        "function"
    ) {
      console.error(
        "JLYStaffActions 尚未載入"
      );

      return;
    }

    window.JLYStaffActions
      .addStaffSlot(car);

    refresh(car);
  }

  window.JLYStaffController = {
    render,
    refresh,
    addStaffSlot
  };
})();