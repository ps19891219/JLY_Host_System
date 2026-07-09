console.log("mycar.js 已成功載入！");

function getFilter() {
  return new URLSearchParams(location.search).get("filter") || "all";
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

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

function getAutoStatus(car) {
  if (car.status === "已結束") return "已結束";
  if (car.status === "已取消") return "已結束";

  const total = getTotal(car);
  const players = getPlayers(car);

  if (total > 0 && players.length >= total) return "已滿";
  return "招募中";
}

function getPosition(player) {
  return player.position || player.roleChoice || player.role || "";
}

function getNeedText(car) {
  const players = getPlayers(car);
  const maleSlots = Number(car.maleSlots || 0);
  const femaleSlots = Number(car.femaleSlots || 0);
  const total = getTotal(car);

  const maleCount = players.filter(function (p) {
    return getPosition(p).includes("男");
  }).length;

  const femaleCount = players.filter(function (p) {
    return getPosition(p).includes("女");
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

function getStatusColor(status) {
  if (status === "招募中") return "#22c55e";
  if (status === "已滿") return "#3b82f6";
  return "#6b7280";
}

function getIdentityDot(car) {
  if (car.isHost === true || car.role === "host" || car.ownerType === "self") {
    return '<span title="我是主揪" style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block;"></span>';
  }

  if (car.isPlayer === true) {
    return '<span title="我參加" style="width:9px;height:9px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>';
  }

  return "";
}

function getLocationText(car) {
  return car.locationName || car.location || car.placeName || "";
}

function getOrganizerText(car) {
  return car.organizerName || car.studioName || car.groupName || "";
}

function getCoverHtml(car) {
  const imageUrl = car.coverImageUrl || car.scriptCoverUrl || car.scriptImageUrl || "";

  if (imageUrl) {
    return `
      <div style="
        width:88px;
        height:122px;
        border-radius:12px;
        overflow:hidden;
        flex-shrink:0;
        background:#f1f1f1;
      ">
        <img
          src="${imageUrl}"
          alt="${car.scriptName || "劇本封面"}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none'"
        >
      </div>
    `;
  }

  return `
    <div style="
      width:88px;
      height:122px;
      border-radius:12px;
      flex-shrink:0;
      background:linear-gradient(135deg,#f3f4f6,#e5e7eb);
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      padding:8px;
      box-sizing:border-box;
      color:#555;
      font-weight:700;
      line-height:1.3;
    ">
      ${car.scriptName || "劇本"}
    </div>
  `;
}
function getTagLine(car) {
  const tags = car.tags || car.scriptTags || [];
  if (!Array.isArray(tags) || tags.length === 0) return "";

  const showTags = tags.slice(0, 4).join("・");
  const more = tags.length > 4 ? " +" + (tags.length - 4) : "";

  return `
    <p style="margin:3px 0;color:#777;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      🏷 ${showTags}${more}
    </p>
  `;
}

function buildCarCard(car) {
  const status = getAutoStatus(car);
  const statusColor = getStatusColor(status);
  const needText = getNeedText(car);
  const locationText = getLocationText(car);
  const organizerText = getOrganizerText(car);

  return `
    <div
      class="card"
      onclick="location.href='car-detail.html?id=${car.id}'"
      style="
        position:relative;
        display:flex;
        gap:12px;
        min-height:142px;
        box-sizing:border-box;
        cursor:pointer;
      "
    >
      <div style="position:absolute;top:12px;left:12px;">
        ${getIdentityDot(car)}
      </div>

      <div style="
        position:absolute;
        top:10px;
        right:12px;
        font-size:12px;
        color:white;
        background:${statusColor};
        border-radius:999px;
        padding:3px 8px;
        line-height:1.4;
      ">
        ${status}
      </div>

      ${getCoverHtml(car)}

      <div style="
        flex:1;
        min-width:0;
        padding-right:54px;
        display:flex;
        flex-direction:column;
      ">
        <h3 style="
          margin:0 0 4px;
          font-size:17px;
          line-height:1.25;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        ">
          🎭 ${car.scriptName || "未命名劇本"}
        </h3>

        ${getTagLine(car)}

        <p style="margin:3px 0;color:#555;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          📅 ${car.gameDate || "日期未定"} ${car.gameTime || ""}
        </p>

        <p style="margin:3px 0;color:#555;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          📍 ${locationText || "地點未填"}
        </p>

        <p style="margin:3px 0;color:#555;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          🏠 ${organizerText || "開團單位未填"}
        </p>

        <div style="
          margin-top:auto;
          text-align:right;
          font-weight:700;
          color:#333;
          font-size:14px;
        ">
          👤 ${needText}
        </div>
      </div>
    </div>
  `;
}

async function renderMyCars() {
  const db = window.db;
  const list = document.getElementById("carList");
  const searchInput = document.getElementById("searchInput");

  if (!list) return;

  if (!db) {
    list.innerHTML = '<div class="card"><h3>Firebase 尚未載入</h3></div>';
    return;
  }

  list.innerHTML = '<div class="card">載入中...</div>';

  try {
    const snapshot = await db.collection("cars").orderBy("createdAt", "desc").get();

    let cars = snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });

    const filter = getFilter();
    const keyword = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();

    if (filter === "need") {
      cars = cars.filter(function (car) {
        return getNeedText(car) !== "已滿";
      });
    }

    if (filter === "full") {
      cars = cars.filter(function (car) {
        return getAutoStatus(car) === "已滿";
      });
    }

    if (filter === "today") {
      cars = cars.filter(function (car) {
        return car.gameDate === todayString();
      });
    }

    if (filter === "done") {
      cars = cars.filter(function (car) {
        return getAutoStatus(car) === "已結束";
      });
    }

    if (keyword) {
      cars = cars.filter(function (car) {
        const tagText = Array.isArray(car.tags) ? car.tags.join(" ") : "";

        const text = [
          car.scriptName || "",
          car.gameDate || "",
          car.gameTime || "",
          getLocationText(car),
          getOrganizerText(car),
          car.dmName || "",
          tagText,
          getAutoStatus(car),
          getNeedText(car)
        ].join(" ").toLowerCase();

        return text.includes(keyword);
      });
    }

    if (cars.length === 0) {
      list.innerHTML = '<div class="card"><h3>目前沒有符合的車</h3></div>';
      return;
    }

    list.innerHTML = cars.map(buildCarCard).join("");

  } catch (error) {
    console.error("讀取失敗：", error);
    list.innerHTML = '<div class="card"><h3>讀取失敗</h3><p>' + error.message + '</p></div>';
  }
}

window.renderMyCars = renderMyCars;

document.addEventListener("DOMContentLoaded", function () {
  renderMyCars();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", renderMyCars);
  }
});