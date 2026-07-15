console.log("mycar.js 已成功載入！");

let currentTab = "all";
let batchMode = false;
let selectedCars = new Set();
let visibleCarIds = [];

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

function startBatchMode() {
  batchMode = true;
  selectedCars.clear();
  updateBatchToolbar();
  renderMyCars();
}

function cancelBatchMode() {
  batchMode = false;
  selectedCars.clear();
  updateBatchToolbar();
  renderMyCars();
}

function updateBatchToolbar() {
  const normalToolbar = document.getElementById("normalToolbar");
  const batchToolbar = document.getElementById("batchToolbar");

  if (normalToolbar) {
    normalToolbar.hidden = batchMode;
  }

  if (batchToolbar) {
    batchToolbar.hidden = !batchMode;
  }

  updateSelectedCarCount();
}

function updateSelectedCarCount() {
  const count = selectedCars.size;
  const countBox = document.getElementById("selectedCarCount");
  const joinButton = document.getElementById("joinSelectedCarsButton");
  const selectAll = document.getElementById("selectAllCars");

  if (countBox) {
    countBox.textContent = `已選取 ${count} 台車`;
  }

  if (joinButton) {
    joinButton.textContent = `👤 加入已選取車團（${count}）`;
    joinButton.disabled = count === 0;
  }

  if (selectAll) {
    const selectedVisibleCount = visibleCarIds.filter(function (carId) {
      return selectedCars.has(carId);
    }).length;

    selectAll.checked =
      visibleCarIds.length > 0 &&
      selectedVisibleCount === visibleCarIds.length;

    selectAll.indeterminate =
      selectedVisibleCount > 0 &&
      selectedVisibleCount < visibleCarIds.length;
  }
}

function toggleSelectAllCars(checked) {
  visibleCarIds.forEach(function (carId) {
    if (checked) {
      selectedCars.add(carId);
    } else {
      selectedCars.delete(carId);
    }
  });

  updateSelectedCarCount();
  renderMyCars();
}

function toggleCarSelection(carId) {
  if (!batchMode) {
    return;
  }

  if (selectedCars.has(carId)) {
    selectedCars.delete(carId);
  } else {
    selectedCars.add(carId);
  }

  updateSelectedCarCount();
  renderMyCars();
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

    visibleCarIds = cars.map(function (car) {
  return car.id;
});

list.innerHTML = cars.map(function (car) {
  return buildCarCard(car, {
    batchMode,
    selected: selectedCars.has(car.id)
  });
}).join("");

updateSelectedCarCount();

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

window.startBatchMode = startBatchMode;
window.cancelBatchMode = cancelBatchMode;
window.toggleSelectAllCars = toggleSelectAllCars;