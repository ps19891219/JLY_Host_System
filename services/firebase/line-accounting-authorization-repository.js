"use strict";

const { getFirestore } = require("./admin");

async function findPlayerByLineUserId(lineUserId) {
  if (!lineUserId) return null;

  const snapshot = await getFirestore()
    .collection("players")
    .where("lineUserId", "==", lineUserId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  return { id: document.id, ...document.data() };
}

async function getCarById(carId) {
  if (!carId) return null;

  const snapshot = await getFirestore()
    .collection("cars")
    .doc(carId)
    .get();

  return snapshot.exists
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

async function getActorNamesByLineUserIds(lineUserIds) {
  const ids = Array.from(new Set(
    (Array.isArray(lineUserIds) ? lineUserIds : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  )).slice(0, 20);
  const pairs = await Promise.all(ids.map(async function (lineUserId) {
    const player = await findPlayerByLineUserId(lineUserId);
    return [
      lineUserId,
      player
        ? String(player.displayName || player.nickname || player.lineDisplayName || "").trim()
        : ""
    ];
  }));
  return Object.fromEntries(pairs.filter(pair => pair[1]));
}

module.exports = {
  findPlayerByLineUserId,
  getCarById,
  getActorNamesByLineUserIds
};
