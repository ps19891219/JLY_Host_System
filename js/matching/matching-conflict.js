(function () {
  "use strict";

  const BUFFER_MINUTES = 120;

  let cachedCars = [];
  let cachedDateKey = "";

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function timeToMinutes(value) {
    const text = normalizeText(value);
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function isIgnoredCar(car) {
    const status = normalizeText(car.status);
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
    return car.scriptName || car.activityName || car.name || "未命名車團";
  }

  function getCandidateDates(candidateSlots) {
    return Array.from(new Set(
      (Array.isArray(candidateSlots) ? candidateSlots : [])
        .map(function (slot) { return normalizeText(slot && slot.date); })
        .filter(Boolean)
    )).sort();
  }

  async function loadConflictCars(forceReload = false, candidateSlots = []) {
    const dates = getCandidateDates(candidateSlots);
    const dateKey = dates.join("|");

    if (!forceReload && dateKey && cachedDateKey === dateKey) {
      return cachedCars;
    }

    if (dates.length === 0) {
      cachedCars = [];
      cachedDateKey = "";
      return cachedCars;
    }

    if (!window.db) {
      throw new Error("Firebase 尚未載入");
    }

    const carsById = new Map();

    /*
      Conflict only needs cars on candidate dates. Never scan the whole cars
      collection. Chunk the Firestore `in` query conservatively for compat.
    */
    for (let index = 0; index < dates.length; index += 10) {
      const dateChunk = dates.slice(index, index + 10);
      const snapshot = await window.db
        .collection("cars")
        .where("gameDate", "in", dateChunk)
        .get();

      snapshot.docs.forEach(function (doc) {
        carsById.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }

    cachedCars = Array.from(carsById.values());
    cachedDateKey = dateKey;
    return cachedCars;
  }

  function findConflictsForSlot(candidateSlot, currentCarId) {
    if (!candidateSlot || !candidateSlot.date || !candidateSlot.time) return [];

    const candidateMinutes = timeToMinutes(candidateSlot.time);
    if (candidateMinutes === null) return [];

    return cachedCars
      .filter(function (car) {
        if (!car) return false;
        if (String(car.id) === String(currentCarId)) return false;
        if (isIgnoredCar(car)) return false;
        if (!car.gameDate) return false;
        return String(car.gameDate).trim() === String(candidateSlot.date).trim();
      })
      .map(function (car) {
        const carMinutes = timeToMinutes(car.gameTime);
        const difference = carMinutes === null
          ? null
          : Math.abs(candidateMinutes - carMinutes);

        return {
          source: "car",
          id: car.id,
          carId: car.id,
          title: getCarTitle(car),
          date: car.gameDate,
          time: car.gameTime || "",
          differenceMinutes: difference,
          isWithinBuffer: difference !== null && difference <= BUFFER_MINUTES
        };
      })
      .sort(function (a, b) {
        if (a.isWithinBuffer !== b.isWithinBuffer) {
          return a.isWithinBuffer ? -1 : 1;
        }
        const aDifference = a.differenceMinutes == null ? Number.MAX_SAFE_INTEGER : a.differenceMinutes;
        const bDifference = b.differenceMinutes == null ? Number.MAX_SAFE_INTEGER : b.differenceMinutes;
        if (aDifference !== bDifference) return aDifference - bDifference;
        return String(a.time || "").localeCompare(String(b.time || ""));
      });
  }

  async function applyConflicts(candidateSlots, currentCarId, options = {}) {
    const slots = Array.isArray(candidateSlots) ? candidateSlots : [];
    await loadConflictCars(options.forceReload !== false, slots);

    return slots.map(function (slot) {
      return {
        ...slot,
        conflicts: findConflictsForSlot(slot, currentCarId)
      };
    });
  }

  function clearCache() {
    cachedCars = [];
    cachedDateKey = "";
  }

  window.JLYMatchingConflict = {
    BUFFER_MINUTES,
    loadConflictCars,
    findConflictsForSlot,
    applyConflicts,
    clearCache
  };

  console.log("✅ Matching Conflict V3 已載入");
})();