console.log("carStatus.js 已成功載入！");

function getPlayers(car) {
  return car.players || [];
}

function getTotal(car) {
  const total = Number(car.totalPeople || 0);
  const male = Number(car.maleSlots || 0);
  const female = Number(car.femaleSlots || 0);

  if (total > 0) return total;
  if (male + female > 0) return male + female;
  return 0;
}

function getCarDateTime(car) {
  const date = car.gameDate || "9999-12-31";
  const time = car.gameTime || "23:59";
  return new Date(date + "T" + time);
}

function isCarEnded(car) {
  if (car.status === "已結束" || car.status === "已取消") return true;

  const carTime = getCarDateTime(car);
  const now = new Date();

  return carTime < now;
}

function getPlayerPosition(player) {
  return player.position || player.roleChoice || player.role || "";
}

function getNeedText(car) {
  const players = getPlayers(car);

  const maleSlots = Number(car.maleSlots || 0);
  const femaleSlots = Number(car.femaleSlots || 0);
  const total = getTotal(car);

  const maleCount = players.filter(function (p) {
    return getPlayerPosition(p).includes("男");
  }).length;

  const femaleCount = players.filter(function (p) {
    return getPlayerPosition(p).includes("女");
  }).length;

  if (maleSlots > 0 || femaleSlots > 0) {
    const maleNeed = Math.max(maleSlots - maleCount, 0);
    const femaleNeed = Math.max(femaleSlots - femaleCount, 0);

    if (maleNeed === 0 && femaleNeed === 0) return "已滿";

    const parts = [];
    if (maleNeed > 0) parts.push(maleNeed + "男");
    if (femaleNeed > 0) parts.push(femaleNeed + "女");

    return "缺" + parts.join("");
  }

  const need = Math.max(total - players.length, 0);
  return need > 0 ? "缺" + need + "人" : "已滿";
}

function getAutoStatus(car) {
  if (isCarEnded(car)) return "已結束";

  const needText = getNeedText(car);
  if (needText === "已滿") return "已滿";

  return "招募中";
}

function getStatusColor(status) {
  if (status === "招募中") return "#22c55e";
  if (status === "已滿") return "#3b82f6";
  return "#9ca3af";
}

function getLocationText(car) {
  return car.locationName || car.location || car.placeName || "";
}

function getOrganizerText(car) {
  return car.organizerName || car.studioName || car.groupName || "";
}