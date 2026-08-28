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
  if (car && car.role === "player") {
    return `<span class="identity-dot identity-player" title="我是玩家" style="background:#3b82f6"></span>`;
  }

  if (car && car.role === "host") {
    return `<span class="identity-dot identity-host" title="我是主揪" style="background:#22c55e"></span>`;
  }

  if (car.isHost === true || car.ownerType === "self") {
    return `<span class="identity-dot identity-host" title="我是主揪" style="background:#22c55e"></span>`;
  }

  if (car.isPlayer === true) {
    return `<span class="identity-dot identity-player" title="我是玩家" style="background:#3b82f6"></span>`;
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

function getCurrentBatchActorId() {
  if (
    window.JLYIdentity &&
    typeof window.JLYIdentity.getCurrentPlayerId === "function"
  ) {
    return String(
      window.JLYIdentity.getCurrentPlayerId() || ""
    ).trim();
  }

  return String(
    localStorage.getItem("currentPlayerId") || ""
  ).trim();
}

async function setSelectedCarsPublic() {
  if (typeof selectedCars === "undefined" || selectedCars.size === 0) {
    alert("請先選取要改成公開的車團");
    return;
  }

  if (!window.db) {
    alert("Firebase 尚未載入");
    return;
  }

  const actorId = getCurrentBatchActorId();

  if (!actorId) {
    alert("請先登入 JLY 身分");
    return;
  }

  const ids = Array.from(selectedCars);
  const refs = ids.map(carId =>
    window.db.collection("cars").doc(carId)
  );

  try {
    const snapshots = await Promise.all(
      refs.map(ref => ref.get())
    );

    const editable = [];
    let skipped = 0;

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) {
        skipped += 1;
        return;
      }

      const car = snapshot.data() || {};
      const ownerId = String(car.ownerId || "").trim();
      const legacyHost = !ownerId && car.isHost === true;

      if (ownerId !== actorId && !legacyHost) {
        skipped += 1;
        return;
      }

      editable.push({
        ref: refs[index],
        car
      });
    });

    if (!editable.length) {
      alert("選取的車團中沒有可由目前身分修改的主揪車");
      return;
    }

    const batch = window.db.batch();
    const now = new Date().toISOString();
    const FieldValue =
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue;

    editable.forEach(item => {
      const updateData = {
        visibility: "public",
        updatedAt: now
      };

      if (FieldValue && typeof FieldValue.arrayUnion === "function") {
        updateData.history = FieldValue.arrayUnion({
          type: "批次公開車團",
          text: "批次操作設為公開招募",
          time: now
        });
      }

      batch.update(item.ref, updateData);
    });

    await batch.commit();

    selectedCars.clear();

    if (typeof updateSelectedCarCount === "function") {
      updateSelectedCarCount();
    }

    if (typeof renderMyCars === "function") {
      await renderMyCars({ restoreScroll: true });
    }

    alert(
      `已將 ${editable.length} 台車設為公開` +
      (skipped ? `；另有 ${skipped} 台非主揪車已略過` : "")
    );
  } catch (error) {
    console.error("批次設為公開失敗：", error);
    alert("批次設為公開失敗：" + (error.message || "未知錯誤"));
  }
}

function installBatchPublicButton() {
  const toolbar = document.getElementById("batchToolbar");
  const countBox = document.getElementById("selectedCarCount");

  if (!toolbar || !countBox || document.getElementById("batchSetPublicButton")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "batchSetPublicButton";
  button.type = "button";
  button.className = "batch-convert-button";
  button.textContent = "🌍 設為公開車";
  button.addEventListener("click", setSelectedCarsPublic);
  countBox.insertAdjacentElement("afterend", button);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", installBatchPublicButton);
}

function buildCarCard(car, options) {
  const settings = options || {};
  const isBatchMode = settings.batchMode === true;
  const isSelected = settings.selected === true;

  const status = getAutoStatus(car);
  const statusColor = getStatusColor(status);
  const needText = getNeedText(car);

  const isPlanning =
  typeof isCarPlanning ===
    "function"
    ? isCarPlanning(car)
    : !car.gameDate;

const dateLine =
  isPlanning
    ? "📅 日期待安排"
    : (
        "📅 " +
        (
          car.gameDate ||
          "日期未定"
        ) +
        (
          car.gameTime
            ? " " +
              car.gameTime
            : ""
        )
      );

  const cardClass = [
    "mycar-card",
    isBatchMode ? "batch-selectable" : "",
    isSelected ? "selected" : ""
  ].filter(Boolean).join(" ");

  const clickAction = isBatchMode
    ? `toggleCarSelection('${car.id}')`
    : `location.href='car-detail.html?id=${car.id}'`;

  return `
    <div
      class="${cardClass}"
      onclick="${clickAction}"
      data-car-id="${car.id}"
    >
      ${
        isBatchMode
          ? `
            <div class="batch-check">
              ${isSelected ? "☑️ 已選取" : "⬜ 點擊選取"}
            </div>
          `
          : ""
      }

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
  ${dateLine}
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