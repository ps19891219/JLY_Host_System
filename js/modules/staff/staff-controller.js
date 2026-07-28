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
      !window.JLYStaffData
    ) {
      return null;
    }

    const staffSlots =
      window.JLYStaffData
        .getStaffSlots(car);

    return staffSlots.find(
      function (staff) {
        return (
          staff.id === staffId
        );
      }
    ) || null;
  }

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
      getCurrentCar();

    if (!car) {
      alert(
        "目前找不到車團資料"
      );

      return;
    }

    window.JLYStaffActions
      .addStaffSlot(car);

    refresh(car);
  }

  function editStaffLabel(
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

    const defaultTitle =
      String(
        staff.label || ""
      );

    const newLabel =
      prompt(
        "請輸入工作人員稱謂。\n留空會恢復為數字編號：",
        defaultTitle
      );

    if (newLabel === null) {
      return;
    }

    window.JLYStaffActions
      .updateStaffLabel(
        car,
        staffId,
        newLabel
      );

    refresh(car);
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

    if (!staff) {
      alert(
        "找不到這個工作人員欄位"
      );

      return;
    }

    const newName =
      prompt(
        "請輸入工作人員名稱：",
        staff.displayName || ""
      );

    if (newName === null) {
      return;
    }

    window.JLYStaffActions
      .updateStaffName(
        car,
        staffId,
        newName
      );

    refresh(car);
  }

  window.JLYStaffController = {
    render,
    refresh,
    addStaffSlot,
    editStaffLabel,
    editStaffPerson
  };
})();