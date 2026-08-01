(function () {
  function normalizeSeat(
  slot,
  index,
  players = []
) {
  const seat = slot || {};

  const playerId =
    seat.playerId || null;

  let player =
    seat.player || null;

  if (playerId) {
    const matchedPlayer =
      players.find(function (p) {
        return (
          p &&
          p.playerId === playerId
        );
      });

    if (matchedPlayer) {
      player = matchedPlayer;
    } else {
      return {
        seatId:
          seat.seatId ||
          `slot-${index + 1}`,

        id:
          seat.id ||
          seat.seatId ||
          `slot-${index + 1}`,

        type:
          seat.originalType ||
          seat.type ||
          "flexible",

        originalType:
          seat.originalType ||
          seat.type ||
          "flexible",

        order:
          typeof seat.order ===
          "number"
            ? seat.order
            : index + 1,

        playerId: null,

        player: null,

        updatedAt:
          seat.updatedAt ||
          null
      };
    }
  }

  return {
    seatId:
      seat.seatId ||
      `slot-${index + 1}`,

    id:
      seat.id ||
      seat.seatId ||
      `slot-${index + 1}`,

    type:
      seat.type ||
      "flexible",

    originalType:
      seat.originalType ||
      seat.type ||
      "flexible",

    order:
      typeof seat.order ===
      "number"
        ? seat.order
        : index + 1,

    playerId,

    player,

    updatedAt:
      seat.updatedAt ||
      null
  };
}

  function upgradeSeats(
  slots,
  players = []
) {
  if (!Array.isArray(slots)) {
    return [];
  }

  return slots.map(function (
    slot,
    index
  ) {
    return normalizeSeat(
      slot,
      index,
      players
    );
  });
}

  window.JLYUpgradeSeat = {
    normalizeSeat,
    upgradeSeats
  };

  console.log("✅ Upgrade Seat 已載入");
})();