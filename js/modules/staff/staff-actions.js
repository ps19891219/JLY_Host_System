console.log(
  "staff-actions.js 已成功載入！"
);

(function () {
  function getStaffSlots(car) {
    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .getStaffSlots ===
        "function"
    ) {
      const staffSlots =
        window.JLYStaffData
          .getStaffSlots(car);

      if (
        Array.isArray(staffSlots)
      ) {
        return staffSlots.map(
          function (staff) {
            return {
              ...staff
            };
          }
        );
      }
    }

    return [];
  }

  function createStaffId() {
    return (
      "staff_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  function createLocalStaffSlot(
    order
  ) {
    return {
      id:
        createStaffId(),

      order:
        Number(order || 0),

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

  function normalizeStaffSlots(
    staffSlots
  ) {
    const safeStaffSlots =
      Array.isArray(staffSlots)
        ? staffSlots
        : [];

    return safeStaffSlots.map(
      function (
        staff,
        index
      ) {
        return {
          id:
            String(
              staff.id ||
              createStaffId()
            ),

          order:
            index + 1,

          label:
            String(
              staff.label || ""
            ).trim(),

          memberId:
            String(
              staff.memberId || ""
            ).trim(),

          displayName:
            String(
              staff.displayName || ""
            ).trim(),

          source:
            String(
              staff.source ||
              "host_manual"
            )
        };
      }
    );
  }

  async function saveStaffSlots(
    car,
    staffSlots
  ) {
    const db =
      window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    if (
      !car ||
      !car.id
    ) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    const normalizedSlots =
      normalizeStaffSlots(
        staffSlots
      );

    const updateData = {
      staffSlots:
        normalizedSlots
    };

    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore
        .FieldValue
    ) {
      updateData.updatedAt =
        window.firebase.firestore
          .FieldValue
          .serverTimestamp();
    }

    await db
      .collection("cars")
      .doc(car.id)
      .update(updateData);

    car.staffSlots =
      normalizedSlots;

    window.currentCarData =
      car;

    return normalizedSlots;
  }

  async function addStaffSlot(
    car
  ) {
    if (!car) {
      throw new Error(
        "找不到目前車團資料"
      );
    }

    const staffSlots =
      getStaffSlots(car);

    const newStaffSlot =
      createLocalStaffSlot(
        staffSlots.length + 1
      );

    staffSlots.push(
      newStaffSlot
    );

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  async function updateStaffLabel(
    car,
    staffId,
    label
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      staffSlots.find(
        function (staff) {
          return (
            String(staff.id) ===
            String(staffId)
          );
        }
      );

    if (!target) {
      throw new Error(
        "找不到要修改的工作人員欄位"
      );
    }

    target.label =
      String(
        label || ""
      ).trim();

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  async function updateStaffName(
    car,
    staffId,
    displayName
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      staffSlots.find(
        function (staff) {
          return (
            String(staff.id) ===
            String(staffId)
          );
        }
      );

    if (!target) {
      throw new Error(
        "找不到要修改的工作人員欄位"
      );
    }

    target.displayName =
      String(
        displayName || ""
      ).trim();

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  window.JLYStaffActions = {
    getStaffSlots,
    createLocalStaffSlot,
    normalizeStaffSlots,
    saveStaffSlots,
    addStaffSlot,
    updateStaffLabel,
    updateStaffName
  };
})();