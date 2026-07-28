console.log(
  "staff-actions.js 已成功載入！"
);

(function () {
  function createLocalStaffSlot(
    order
  ) {
    return {
      id:
        "staff_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      order:
        Number(order || 0),

      label:
        "DM",

      memberId:
        "",

      displayName:
        "",

      source:
        "host_manual"
    };
  }

  function addStaffSlot(car) {
    if (!car) {
      console.error(
        "新增工作人員失敗：找不到車團資料"
      );

      return [];
    }

    let staffSlots = [];

    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .getStaffSlots ===
        "function"
    ) {
      staffSlots =
        window.JLYStaffData
          .getStaffSlots(car);
    }

    if (
      !Array.isArray(staffSlots)
    ) {
      staffSlots = [];
    }

    staffSlots =
      staffSlots.map(function (
        staff
      ) {
        return {
          ...staff
        };
      });

    const newStaff =
      createLocalStaffSlot(
        staffSlots.length + 1
      );

    staffSlots.push(newStaff);

    car.staffSlots =
      staffSlots;

    window.currentCarData =
      car;

    return staffSlots;
  }

  window.JLYStaffActions = {
    addStaffSlot
  };
})();