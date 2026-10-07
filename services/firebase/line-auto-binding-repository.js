"use strict";

const { getFirestore } = require("./admin");

const COLLECTION = "carDetailViews";
const DEFAULT_LIMIT = 12;

function text(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeLimit(value) {
  return Math.max(1, Math.min(DEFAULT_LIMIT, Number(value) || DEFAULT_LIMIT));
}

function viewCar(doc) {
  const data = doc && typeof doc.data === "function" ? (doc.data() || {}) : {};
  const car = data.car && typeof data.car === "object" ? data.car : null;
  if (!car) return null;
  return {
    ...car,
    id: text(car.id || data.carId || doc.id),
    carId: text(car.carId || car.id || data.carId || doc.id),
    preparedRead: true
  };
}

async function findCarDetailViewsByScriptName(scriptName, options = {}) {
  const name = text(scriptName);
  if (!name) return [];

  const db = options.db || getFirestore();
  const limit = normalizeLimit(options.limit);
  const snapshot = await db
    .collection(COLLECTION)
    .where("car.scriptName", "==", name)
    .limit(limit)
    .get();

  return snapshot.docs
    .map(viewCar)
    .filter(Boolean);
}

module.exports = {
  COLLECTION,
  DEFAULT_LIMIT,
  findCarDetailViewsByScriptName
};
