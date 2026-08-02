(function () {
  "use strict";

  const BUFFER_MINUTES = 120;

  let cachedCars = [];
  let hasLoadedCars = false;

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function timeToMinutes(value) {
    const text =
      normalizeText(value);

    const match =
      text.match(
        /^(\d{1,2}):(\d{2})$/
      );

    if (!match) {
      return null;
    }

    const hour =
      Number(match[1]);

    const minute =
      Number(match[2]);

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return (
      hour * 60 +
      minute
    );
  }

  function isIgnoredCar(car) {
    const status =
      normalizeText(
        car.status
      );

    return (
      status === "已取消" ||
      status === "取消" ||
      status === "已結束" ||
      status === "已封存" ||
      car.isDeleted === true ||
      car.deletedAt
    );
  }

  function getCarTitle(car) {
    return (
      car.scriptName ||
      car.activityName ||
      car.name ||
      "未命名車團"
    );
  }

  async function loadConflictCars(
    forceReload = false
  ) {
    if (
      hasLoadedCars &&
      !forceReload
    ) {
      return cachedCars;
    }

    if (
      !window.JLYMatchingData ||
      typeof window
        .JLYMatchingData
        .getConflictCars !==
        "function"
    ) {
      throw new Error(
        "Matching Data 尚未提供車團行程資料"
      );
    }

    cachedCars =
      await window
        .JLYMatchingData
        .getConflictCars();

    hasLoadedCars = true;

    return cachedCars;
  }

  function findConflictsForSlot(
    candidateSlot,
    currentCarId
  ) {
    if (
      !candidateSlot ||
      !candidateSlot.date ||
      !candidateSlot.time
    ) {
      return [];
    }

    const candidateMinutes =
      timeToMinutes(
        candidateSlot.time
      );

    if (
      candidateMinutes === null
    ) {
      return [];
    }

    return cachedCars
      .filter(function (car) {
        if (!car) {
          return false;
        }

        if (
          String(car.id) ===
          String(currentCarId)
        ) {
          return false;
        }

        if (isIgnoredCar(car)) {
          return false;
        }

        if (!car.gameDate) {
          return false;
        }

        return (
          car.gameDate ===
          candidateSlot.date
        );
      })
      .map(function (car) {
        const carMinutes =
          timeToMinutes(
            car.gameTime
          );

        if (
          carMinutes === null
        ) {
          return null;
        }

        const difference =
          Math.abs(
            candidateMinutes -
            carMinutes
          );

        if (
          difference >
          BUFFER_MINUTES
        ) {
          return null;
        }

        return {
          source:
            "car",

          id:
            car.id,

          carId:
            car.id,

          title:
            getCarTitle(car),

          date:
            car.gameDate,

          time:
            car.gameTime,

          differenceMinutes:
            difference
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (
          a.differenceMinutes !==
          b.differenceMinutes
        ) {
          return (
            a.differenceMinutes -
            b.differenceMinutes
          );
        }

        return String(
          a.time || ""
        ).localeCompare(
          String(
            b.time || ""
          )
        );
      });
  }

  async function applyConflicts(
    candidateSlots,
    currentCarId,
    options = {}
  ) {
    await loadConflictCars(
      options.forceReload ===
        true
    );

    const slots =
      Array.isArray(
        candidateSlots
      )
        ? candidateSlots
        : [];

    return slots.map(
      function (slot) {
        return {
          ...slot,

          conflicts:
            findConflictsForSlot(
              slot,
              currentCarId
            )
        };
      }
    );
  }

  function clearCache() {
    cachedCars = [];
    hasLoadedCars = false;
  }

  window.JLYMatchingConflict = {
    BUFFER_MINUTES,
    loadConflictCars,
    findConflictsForSlot,
    applyConflicts,
    clearCache
  };

  console.log(
    "✅ Matching Conflict V1 已載入"
  );
})();