console.log(
  "staff-actions.js 已成功載入！"
);

(function () {
  function getStaffSlots(car) {
    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData.getStaffSlots ===
        "function"
    ) {
      const staffSlots =
        window.JLYStaffData.getStaffSlots(car);

      if (Array.isArray(staffSlots)) {
        return staffSlots.map(function (
          staff
        ) {
          return {
            ...staff
          };
        });
      }
    }

    return [];
  }

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

      // 空白時顯示 1、2、3
      label:
        "",

      memberId:
        "",

      displayName:
        "",

      source:
        "host_manual"
    };
  }

  function updateCarStaffSlots(
    car,
    staffSlots
  ) {
    car.staffSlots =
      staffSlots.map(function (
        staff,
        index
      ) {
        return {
          ...staff,
          order:
            index + 1
        };
      });

    window.currentCarData =
      car;

    return car.staffSlots;
  }

  function addStaffSlot(car) {
    if (!car) {
      console.error(
        "新增工作人員失敗：找不到車團資料"
      );

      return [];
    }

    const staffSlots =
      getStaffSlots(car);

    staffSlots.push(
      createLocalStaffSlot(
        staffSlots.length + 1
      )
    );

    return updateCarStaffSlots(
      car,
      staffSlots
    );
  }

  function updateStaffLabel(
    car,
    staffId,
    label
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      staffSlots.find(function (
        staff
      ) {
        return (
          staff.id === staffId
        );
      });

    if (!target) {
      console.error(
        "找不到要修改的工作人員席位"
      );

      return staffSlots;
    }

    target.label =
      String(label || "").trim();

    return updateCarStaffSlots(
      car,
      staffSlots
    );
  }

  function updateStaffName(
    car,
    staffId,
    displayName
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      staffSlots.find(function (
        staff
      ) {
        return (
          staff.id === staffId
        );
      });

    if (!target) {
      console.error(
        "找不到要指派的工作人員席位"
      );

      return staffSlots;
    }

    target.displayName =
      String(
        displayName || ""
      ).trim();

    return updateCarStaffSlots(
      car,
      staffSlots
    );
  }

  window.JLYStaffActions = {
    addStaffSlot,
    updateStaffLabel,
    updateStaffName
  };
})();