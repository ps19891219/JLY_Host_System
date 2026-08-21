console.log(
  "carStatus.js Planning V1 已成功載入！"
);

function getPlayers(car) {
  return Array.isArray(car.players)
    ? car.players
    : [];
}

function getTotal(car) {
  const total =
    Number(
      car.totalPeople || 0
    );

  const male =
    Number(
      car.maleSlots || 0
    );

  const female =
    Number(
      car.femaleSlots || 0
    );

  const flexible =
    Number(
      car.flexibleSlots || 0
    );

  if (total > 0) {
    return total;
  }

  if (
    male +
    female +
    flexible >
    0
  ) {
    return (
      male +
      female +
      flexible
    );
  }

  return 0;
}

function isCarPlanning(car) {
  return Boolean(
    car &&
    (
      car.status ===
        "規劃中" ||
      car.planningStatus ===
        "unscheduled" ||
      !car.gameDate
    ) &&
    car.status !==
      "已結束" &&
    car.status !==
      "已取消"
  );
}

function getCarDateTime(car) {
  /*
    沒日期的車排在有日期的車之前，
    但不會被判斷成已結束。
  */
  if (isCarPlanning(car)) {
    return new Date(
      "1900-01-01T00:00:00"
    );
  }

  const date =
    car.gameDate ||
    "9999-12-31";

  const time =
    car.gameTime ||
    "23:59";

  return new Date(
    date +
    "T" +
    time
  );
}

function isCarEnded(car) {
  if (
    car.status ===
      "已結束" ||
    car.status ===
      "已取消"
  ) {
    return true;
  }

  if (isCarPlanning(car)) {
    return false;
  }

  const carTime =
    getCarDateTime(car);

  const now =
    new Date();

  return carTime < now;
}

function getPlayerPosition(
  player
) {
  return (
    player.position ||
    player.roleChoice ||
    player.role ||
    ""
  );
}

function getNeedText(car) {
  if (isCarPlanning(car)) {
    return "等待安排日期";
  }

  const players =
    getPlayers(car);

  const activePlayers =
    players.filter(
      function (player) {
        return (
          player.status !==
          "已取消"
        );
      }
    );

  const maleSlots =
    Number(
      car.maleSlots || 0
    );

  const femaleSlots =
    Number(
      car.femaleSlots || 0
    );

  const flexibleSlots =
    Number(
      car.flexibleSlots || 0
    );

  const total =
    getTotal(car);

  const seatSummary =
    car &&
    car.seatSummary &&
    typeof car.seatSummary ===
      "object"
      ? car.seatSummary
      : null;

  if (
    seatSummary &&
    (
      Number(
        seatSummary.totalSeatCount ||
        0
      ) > 0 ||
      Number(
        seatSummary.maleTotal ||
        0
      ) > 0 ||
      Number(
        seatSummary.femaleTotal ||
        0
      ) > 0 ||
      Number(
        seatSummary.flexibleTotal ||
        0
      ) > 0
    )
  ) {
    const maleTotal =
      Number(
        seatSummary.maleTotal ||
        maleSlots ||
        0
      );

    const femaleTotal =
      Number(
        seatSummary.femaleTotal ||
        femaleSlots ||
        0
      );

    const flexibleTotal =
      Number(
        seatSummary.flexibleTotal ||
        flexibleSlots ||
        0
      );

    const maleNeed =
      Math.max(
        maleTotal -
        Number(
          seatSummary.maleOccupied ||
          0
        ),
        0
      );

    const femaleNeed =
      Math.max(
        femaleTotal -
        Number(
          seatSummary.femaleOccupied ||
          0
        ),
        0
      );

    const flexibleNeed =
      Math.max(
        flexibleTotal -
        Number(
          seatSummary.flexibleOccupied ||
          0
        ),
        0
      );

    if (
      maleNeed === 0 &&
      femaleNeed === 0 &&
      flexibleNeed === 0
    ) {
      return "已滿";
    }

    const parts = [];

    if (maleNeed > 0) {
      parts.push(
        maleNeed + "男"
      );
    }

    if (femaleNeed > 0) {
      parts.push(
        femaleNeed + "女"
      );
    }

    if (flexibleNeed > 0) {
      parts.push(
        flexibleNeed + "不限"
      );
    }

    return (
      "缺" +
      parts.join("")
    );
  }

  const maleCount =
    activePlayers.filter(
      function (player) {
        return getPlayerPosition(
          player
        ).includes("男");
      }
    ).length;

  const femaleCount =
    activePlayers.filter(
      function (player) {
        return getPlayerPosition(
          player
        ).includes("女");
      }
    ).length;

  if (
    maleSlots > 0 ||
    femaleSlots > 0
  ) {
    const maleNeed =
      Math.max(
        maleSlots -
        maleCount,
        0
      );

    const femaleNeed =
      Math.max(
        femaleSlots -
        femaleCount,
        0
      );

    const occupiedFixed =
      maleCount +
      femaleCount;

    const remainingFlexible =
      Math.max(
        flexibleSlots -
        Math.max(
          activePlayers.length -
          occupiedFixed,
          0
        ),
        0
      );

    if (
      maleNeed === 0 &&
      femaleNeed === 0 &&
      remainingFlexible === 0
    ) {
      return "已滿";
    }

    const parts = [];

    if (maleNeed > 0) {
      parts.push(
        maleNeed + "男"
      );
    }

    if (femaleNeed > 0) {
      parts.push(
        femaleNeed + "女"
      );
    }

    if (
      remainingFlexible >
      0
    ) {
      parts.push(
        remainingFlexible +
        "不限"
      );
    }

    return (
      "缺" +
      parts.join("")
    );
  }

  const need =
    Math.max(
      total -
      activePlayers.length,
      0
    );

  return need > 0
    ? "缺" + need + "人"
    : "已滿";
}

function getAutoStatus(car) {
  if (
    car.status ===
    "已取消"
  ) {
    return "已取消";
  }

  if (
    car.status ===
    "已結束"
  ) {
    return "已結束";
  }

  if (isCarPlanning(car)) {
    return "規劃中";
  }

  if (isCarEnded(car)) {
    return "已結束";
  }

  const needText =
    getNeedText(car);

  if (
    needText === "已滿"
  ) {
    return "已滿";
  }

  return "招募中";
}

function getStatusColor(
  status
) {
  if (
    status ===
    "規劃中"
  ) {
    return "#eab308";
  }

  if (
    status ===
    "招募中"
  ) {
    return "#22c55e";
  }

  if (
    status ===
    "已滿"
  ) {
    return "#3b82f6";
  }

  if (
    status ===
    "已取消"
  ) {
    return "#ef4444";
  }

  return "#9ca3af";
}

function getLocationText(car) {
  return (
    car.locationName ||
    car.location ||
    car.placeName ||
    ""
  );
}

function getOrganizerText(car) {
  return (
    car.organizerName ||
    car.studioName ||
    car.groupName ||
    ""
  );
}