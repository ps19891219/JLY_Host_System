(function () {
  function normalizeSeat(slot, index) {
    const seat = slot || {};

    return {
      seatId: seat.seatId || `slot-${index + 1}`,
      id: seat.id || seat.seatId || `slot-${index + 1}`,

      type: seat.type || "flexible",
      originalType:
        seat.originalType || seat.type || "flexible",

      order:
        typeof seat.order === "number"
          ? seat.order
          : index + 1,

      playerId: seat.playerId || null,

      player: seat.player || null,

      updatedAt:
        seat.updatedAt || null
    };
  }

  function upgradeSeats(slots) {
    if (!Array.isArray(slots)) {
      return [];
    }

    return slots.map(function (slot, index) {
      return normalizeSeat(slot, index);
    });
  }

  window.JLYUpgradeSeat = {
    normalizeSeat,
    upgradeSeats
  };

  console.log("✅ Upgrade Seat 已載入");
})();