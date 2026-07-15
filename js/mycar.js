console.log("mycar.js 已成功載入！");

let currentTab = "all";

// ===== 批次管理 =====
let batchMode = false;
let selectedCars = new Set();

function setMyCarTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".mycar-tabs .tab").forEach(function (button) {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  renderMyCars();
}

function getTimeValue(car) {
  return getCarDateTime(car).getTime();
}

function sortCars(cars, keyword) {
  if (keyword) {
    return cars.sort(function (a, b) {
      return getTimeValue(a) - getTimeValue(b);
    });
  }

  return cars.sort(function (a, b) {
    const aEnded = isCarEnded(a);
    const bEnded = isCarEnded(b);

    if (aEnded !== bEnded) {
      return aEnded ? 1 : -1;
    }

    return getTimeValue(a) - getTimeValue(b);
  });
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
    const snapshot = await db.collection("cars").get();

    let cars = snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });

    const keyword = (searchInput && searchInput.value ? searchInput.value : "")
      .trim()
      .toLowerCase();

    if (currentTab === "active") {
      cars = cars.filter(function (car) {
        return !isCarEnded(car);
      });
    }

    if (currentTab === "done") {
      cars = cars.filter(function (car) {
        return isCarEnded(car);
      });
    }

    if (keyword) {
      cars = cars.filter(function (car) {
        const tags = Array.isArray(car.tags) ? car.tags.join(" ") : "";
        const scriptTags = Array.isArray(car.scriptTags) ? car.scriptTags.join(" ") : "";

        const text = [
          car.scriptName || "",
          car.gameDate || "",
          car.gameTime || "",
          getLocationText(car),
          getOrganizerText(car),
          car.dmName || "",
          tags,
          scriptTags,
          getAutoStatus(car),
          getNeedText(car)
        ].join(" ").toLowerCase();

        return text.includes(keyword);
      });
    }

    cars = sortCars(cars, keyword);

    if (cars.length === 0) {
      list.innerHTML = '<div class="card"><h3>目前沒有符合的車</h3></div>';
      return;
    }

    list.innerHTML = cars.map(buildCarCard).join("");

  } catch (error) {
    console.error("讀取失敗：", error);
    list.innerHTML =
      '<div class="card"><h3>讀取失敗</h3><p>' +
      error.message +
      '</p></div>';
  }
}

window.renderMyCars = renderMyCars;
window.setMyCarTab = setMyCarTab;

document.addEventListener("DOMContentLoaded", function () {
  renderMyCars();

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", renderMyCars);
  }
});