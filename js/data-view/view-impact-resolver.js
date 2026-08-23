console.log("view-impact-resolver.js 已成功載入！");

(function () {
  "use strict";

  const CAR_DETAIL_FIELDS = new Set([
    "scriptName", "gameDate", "gameTime", "status",
    "studioName", "location", "address", "price",
    "players", "staffSlots", "slots", "applications",
    "history", "matching", "reminder", "notes", "note",
    "updatedAt"
  ]);

  const MYCAR_FIELDS = new Set([
    "scriptName", "gameDate", "gameTime", "status",
    "studioName", "location", "address", "ownerId",
    "players", "playerIds", "slots", "maleSlots",
    "femaleSlots", "flexibleSlots", "totalPeople",
    "updatedAt"
  ]);

  const HOME_FIELDS = new Set([
    "scriptName", "gameDate", "gameTime", "status",
    "ownerId", "updatedAt"
  ]);

  function normalizeChangedFields(fields) {
    return Array.isArray(fields)
      ? fields.map(v => String(v || "").trim()).filter(Boolean)
      : [];
  }

  function intersects(fields, set) {
    return fields.some(field => set.has(field));
  }

  function resolveCarViews(changedFields) {
    const fields = normalizeChangedFields(changedFields);
    const result = new Set();

    if (fields.length === 0) {
      result.add("car_detail");
      return Array.from(result);
    }

    if (intersects(fields, CAR_DETAIL_FIELDS)) {
      result.add("car_detail");
    }

    if (intersects(fields, MYCAR_FIELDS)) {
      result.add("mycar");
    }

    if (intersects(fields, HOME_FIELDS)) {
      result.add("home");
    }

    return Array.from(result);
  }

  function resolveAccountingViews(eventType) {
    const type = String(eventType || "").trim();

    if (!type) {
      return [];
    }

    return [
      "activity_accounting",
      "pending_action",
      "home"
    ];
  }

  window.JLYViewImpactResolver = {
    resolveCarViews,
    resolveAccountingViews
  };
})();
