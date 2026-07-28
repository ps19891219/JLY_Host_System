console.log("staff-data.js 已成功載入！");

(function () {
  function cloneStaffSlot(slot) {
    return {
      id:
        slot.id ||
        slot.slotId ||
        "",

      order:
        Number(slot.order || 0),

      label:
        String(
          slot.label ||
          slot.roleLabel ||
          slot.title ||
          ""
        ).trim(),

      memberId:
        slot.memberId ||
        slot.playerId ||
        "",

      displayName:
        String(
          slot.displayName ||
          slot.name ||
          ""
        ).trim(),

      source:
        slot.source ||
        "staff_slot"
    };
  }

  function createStaffSlot(index, data = {}) {
    const order =
      Number(data.order || index || 1);

    return {
      id:
        data.id ||
        data.slotId ||
        "staff-slot-" +
          Date.now() +
          "-" +
          order,

      order,

      label:
        String(
          data.label ||
          data.roleLabel ||
          order
        ),

      memberId:
        data.memberId ||
        "",

      displayName:
        String(
          data.displayName ||
          data.name ||
          ""
        ).trim(),

      source:
        data.source ||
        "staff_slot"
    };
  }

  function convertDmListToStaffSlots(car) {
    const dmList =
      Array.isArray(car.dmList)
        ? car.dmList
        : [];

    return dmList.map(function (
      dm,
      index
    ) {
      const data =
        typeof dm === "string"
          ? {
              displayName: dm
            }
          : dm || {};

      return createStaffSlot(
        index + 1,
        {
          label:
            data.label ||
            data.role ||
            data.title ||
            "DM",

          memberId:
            data.memberId ||
            data.playerId ||
            "",

          displayName:
            data.displayName ||
            data.name ||
            data.dmName ||
            "",

          source:
            "legacy_dmList"
        }
      );
    });
  }

  function getStaffSlots(car) {
    const safeCar =
      car || {};

    if (
      Array.isArray(
        safeCar.staffSlots
      )
    ) {
      return safeCar.staffSlots
        .map(cloneStaffSlot)
        .sort(function (a, b) {
          return a.order - b.order;
        });
    }

    return convertDmListToStaffSlots(
      safeCar
    );
  }

  function normalizeStaffSlots(
    staffSlots
  ) {
    const safeSlots =
      Array.isArray(staffSlots)
        ? staffSlots
        : [];

    return safeSlots.map(function (
      slot,
      index
    ) {
      return createStaffSlot(
        index + 1,
        {
          ...slot,
          order: index + 1
        }
      );
    });
  }

  window.JLYStaffData = {
    cloneStaffSlot,
    createStaffSlot,
    convertDmListToStaffSlots,
    getStaffSlots,
    normalizeStaffSlots
  };
})();