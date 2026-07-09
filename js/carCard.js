console.log("carCard.js 已成功載入！");

function buildCover(car) {
  const imageUrl = car.coverImageUrl || car.scriptCoverUrl || car.scriptImageUrl || "";

  if (imageUrl) {
    return `
      <div class="car-cover">
        <img
          src="${imageUrl}"
          alt="${car.scriptName || "劇本封面"}"
          onerror="this.parentElement.innerHTML='${car.scriptName || "劇本"}'"
        >
      </div>
    `;
  }

  return `
    <div class="car-cover-placeholder">
      ${car.scriptName || "劇本"}
    </div>
  `;
}

function getIdentityDot(car) {
  if (car.isHost === true || car.role === "host" || car.ownerType === "self") {
    return `<span class="identity-dot identity-host" title="我是主揪"></span>`;
  }

  if (car.isPlayer === true) {
    return `<span class="identity-dot identity-player" title="我參加"></span>`;
  }

  return "";
}

function getTagLine(car) {
  const tags = car.tags || car.scriptTags || [];

  if (!Array.isArray(tags) || tags.length === 0) {
    return "";
  }

  const showTags = tags.slice(0, 4).join("・");
  const more = tags.length > 4 ? " +" + (tags.length - 4) : "";

  return `
    <div class="car-line car-tags">
      🏷 ${showTags}${more}
    </div>
  `;
}

function buildCarCard(car) {
  const status = getAutoStatus(car);
  const statusColor = getStatusColor(status);
  const needText = getNeedText(car);

  return `
    <div
      class="mycar-card"
      onclick="location.href='car-detail.html?id=${car.id}'"
    >
      ${getIdentityDot(car)}

      <div
        class="car-status"
        style="background:${statusColor};"
      >
        ${status}
      </div>

      ${buildCover(car)}

      <div class="car-info">
        <h3 class="car-title">
          ${car.scriptName || "未命名劇本"}
        </h3>

        ${getTagLine(car)}

        <div class="car-line">
          📅 ${car.gameDate || "日期未定"} ${car.gameTime || ""}
        </div>

        <div class="car-line">
          📍 ${getLocationText(car) || "地點未填"}
        </div>

        <div class="car-line">
          🏠 ${getOrganizerText(car) || "開團單位未填"}
        </div>

        <div class="car-need">
          👤 ${needText}
        </div>
      </div>
    </div>
  `;
}