"use strict";

console.log(
  "app.js V25 已成功載入！"
);

function todayString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function getPlayers(car) {
  return Array.isArray(
    car && car.players
  )
    ? car.players
    : [];
}

function getTotal(car) {
  return Number(
    car && car.totalPeople
      ? car.totalPeople
      : 0
  );
}

function getNeed(car) {
  return Math.max(
    getTotal(car) -
      getPlayers(car).length,
    0
  );
}

function getAutoStatus(car) {
  if (
    car.status === "已完成"
  ) {
    return "已完成";
  }

  if (
    car.status === "已取消"
  ) {
    return "已取消";
  }

  const total =
    getTotal(car);

  const players =
    getPlayers(car);

  if (
    total > 0 &&
    players.length >= total
  ) {
    return "已滿車";
  }

  return "招募中";
}

function getCurrentOwnerId() {
  if (
    window.JLYIdentity &&
    typeof window.JLYIdentity
      .getCurrentPlayerId ===
        "function"
  ) {
    return String(
      window.JLYIdentity
        .getCurrentPlayerId() ||
      ""
    ).trim();
  }

  return String(
    localStorage.getItem(
      "currentPlayerId"
    ) ||
    ""
  ).trim();
}

function renderRegistrationPending(
  cars
) {
  const count =
    document.getElementById(
      "registrationPendingCount"
    );

  const text =
    document.getElementById(
      "registrationPendingText"
    );

  if (
    !window.JLYPendingActions
  ) {
    if (text) {
      text.textContent =
        "待處理模組尚未載入";
    }

    return;
  }

  const summary =
    window.JLYPendingActions
      .buildRegistrationSummary(
        cars
      );

  if (count) {
    count.textContent =
      String(
        summary.total
      );
  }

  if (text) {
    text.textContent =
      summary.total > 0
        ? (
            "玩家 " +
            summary.playerCount +
            "｜DM " +
            summary.dmCount
          )
        : "目前無待處理";
  }
}

async function renderDashboard() {
  const db =
    window.db;

  if (!db) {
    console.error(
      "Firebase 尚未載入"
    );
    return;
  }

  try {
    const ownerId =
      getCurrentOwnerId();

    let cars = [];

    if (
      ownerId &&
      window.JLYCarData &&
      typeof window.JLYCarData
        .getCarsByOwner ===
          "function"
    ) {
      cars =
        await window.JLYCarData
          .getCarsByOwner(
            ownerId
          );
    } else {
      const snapshot =
        await db
          .collection("cars")
          .get();

      cars =
        snapshot.docs.map(
          function (doc) {
            return {
              id: doc.id,
              ...doc.data()
            };
          }
        );
    }

    const active =
      cars.filter(
        function (car) {
          const status =
            getAutoStatus(car);

          return (
            status !== "已完成" &&
            status !== "已取消"
          );
        }
      );

    const needCars =
      active.filter(
        function (car) {
          return (
            getNeed(car) > 0
          );
        }
      );

    const fullCars =
      active.filter(
        function (car) {
          return (
            getTotal(car) > 0 &&
            getNeed(car) === 0
          );
        }
      );

    const todayCars =
      active.filter(
        function (car) {
          return (
            car.gameDate ===
            todayString()
          );
        }
      );

    const activeCount =
      document.getElementById(
        "activeCount"
      );

    const needCount =
      document.getElementById(
        "needCount"
      );

    const fullCount =
      document.getElementById(
        "fullCount"
      );

    const todayCount =
      document.getElementById(
        "todayCount"
      );

    if (activeCount) {
      activeCount.innerText =
        active.length;
    }

    if (needCount) {
      needCount.innerText =
        needCars.length;
    }

    if (fullCount) {
      fullCount.innerText =
        fullCars.length;
    }

    if (todayCount) {
      todayCount.innerText =
        todayCars.length;
    }

    renderRegistrationPending(
      ownerId
        ? cars
        : []
    );

    console.log(
      "首頁統計",
      {
        全部:
          cars.length,
        開團中:
          active.length,
        還缺人:
          needCars.length,
        已滿車:
          fullCars.length,
        今天開團:
          todayCars.length
      }
    );
  } catch (error) {
    console.error(
      "首頁統計讀取失敗：",
      error
    );
  }
}

window.renderDashboard =
  renderDashboard;

document.addEventListener(
  "DOMContentLoaded",
  renderDashboard
);
