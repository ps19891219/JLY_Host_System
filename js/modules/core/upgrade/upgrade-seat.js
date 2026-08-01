(function () {
  function upgradeSeats(slots) {
    if (!Array.isArray(slots)) {
      return [];
    }

    return slots.map(function (slot) {
      return {
        ...slot
      };
    });
  }

  window.JLYUpgradeSeat = {
    upgradeSeats
  };

  console.log(
    "✅ Upgrade Seat 已載入"
  );
})();